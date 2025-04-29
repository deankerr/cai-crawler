import type { ImageQueryParams } from './civitai/validators'
import { literals } from 'convex-helpers/validators'
import { v } from 'convex/values'
import { api, internal } from './_generated/api'
import { action, internalMutation } from './_generated/server'
import { fetchImages } from './civitai/query'
import schema from './schema'
import { getPathAndQuery } from './utils/url'

const MAX_CRAWLED_ITEMS = 100000
const IMAGE_PAGE_SIZE = 50

const vTimePeriod = literals('AllTime', 'Year', 'Month', 'Week', 'Day')
const vSortOrder = literals('Most Reactions', 'Most Comments', 'Newest')

const vImageQueryParams = v.object({
  postId: v.optional(v.number()),
  modelId: v.optional(v.number()),
  modelVersionId: v.optional(v.number()),
  username: v.optional(v.string()),
  nsfw: v.optional(v.boolean()),
  sort: v.optional(vSortOrder),
  period: v.optional(vTimePeriod),
  cursor: v.optional(v.string()),
  // page and limit are managed internally

  maxItems: v.number(), // Renamed to maxNewImages internally for clarity
})

export const startImageCrawl = action({
  args: vImageQueryParams,
  handler: async (ctx, { maxItems: maxNewImages, cursor, ...args }) => {
    let totalFetched = 0
    let newImagesCreated = 0 // Counter for newly created image records
    let nextCursor: string | undefined = cursor
    let lastMetadata: any = null

    console.debug('Starting image crawl', {
      maxNewImages,
      args,
    })

    // Loop until the desired number of *new* images are created
    while (newImagesCreated < maxNewImages) {
      // Prepare query params for this batch
      const queryParams: ImageQueryParams = {
        ...args,
        limit: Math.min(IMAGE_PAGE_SIZE, maxNewImages - totalFetched),
        ...(nextCursor ? { cursor: nextCursor } : {}),
      }

      const { result, query } = await fetchImages(queryParams)
      const items = result.items || []
      lastMetadata = result.metadata
      totalFetched += items.length // Still track total fetched for logging/debugging
      nextCursor = result.metadata?.nextCursor

      console.debug('Crawl progress:', {
        query: getPathAndQuery(query),
        totalFetched,
        batchSize: items.length,
        newImagesCreated, // Log new images count
        metadata: result.metadata,
      })

      // Store each item in the batch
      for (const item of items) {
        // Attempt to insert the raw API result, checking for duplicates
        const apiResultId = await ctx.runMutation(internal.run.insertResult, {
          query: getPathAndQuery(query),
          entityType: 'image',
          entityId: item.id,
          result: JSON.stringify(item), // Store the full result
        })

        if (!apiResultId)
          continue
        // Only proceed if it's a new, unique result

        await ctx.runMutation(internal.civitai.images.create, {
          apiResultId,
          result: JSON.stringify(item), // Pass the result again
        })
        newImagesCreated++ // Increment only when a new image is actually created
      }

      // Check if we hit the new image limit *after* processing the batch
      if (newImagesCreated >= maxNewImages) {
        break // Exit the outer while loop
      }

      // Safety break based on new images created
      if (newImagesCreated >= MAX_CRAWLED_ITEMS) {
        console.warn(`Reached MAX_CRAWLED_ITEMS limit (${MAX_CRAWLED_ITEMS}) based on new images created, stopping crawl`)
        break
      }

      if (!nextCursor || items.length === 0) {
        console.log('No next cursor or no items in batch, stopping crawl.')
        break
      }
    }

    console.log('Image crawl finished.', {
      totalFetched,
      newImagesCreated,
      metadata: lastMetadata,
    })

    return {
      totalFetched, // Total items retrieved from API
      newImagesCreated, // Actual new unique images added to DB
      metadata: lastMetadata,
    }
  },
})

export const insertResult = internalMutation({
  args: schema.tables.apiResults.validator,
  handler: async (ctx, args) => {
    const existing = await ctx.db.query('apiResults').withIndex('by_entity', q => q.eq('entityType', args.entityType).eq('entityId', args.entityId)).first()
    if (existing) {
      return null
    }
    return await ctx.db.insert('apiResults', args)
  },
})
