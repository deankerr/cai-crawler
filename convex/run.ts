import type { ImageQueryParams } from './civitai/validators'
import { literals } from 'convex-helpers/validators'
import { v } from 'convex/values'
import { internal } from './_generated/api'
import { action } from './_generated/server'
import { fetchImages } from './civitai/query'
import { getPathAndQuery } from './utils/url'

const MAX_CRAWLED_ITEMS = 10000
const IMAGE_PAGE_SIZE = 100

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
  // page and limit are managed internally

  maxItems: v.number(), // total max items to fetch in this crawl
})

export const startImageCrawl = action({
  args: vImageQueryParams,
  handler: async (ctx, { maxItems, ...args }) => {
    let totalFetched = 0
    let nextCursor: string | undefined
    let lastMetadata: any = null

    console.debug('Starting image crawl', {
      maxItems,
      args,
    })

    while (totalFetched < maxItems) {
      // Prepare query params for this batch
      const queryParams: ImageQueryParams = {
        ...args,
        limit: Math.min(IMAGE_PAGE_SIZE, maxItems - totalFetched),
        ...(nextCursor ? { cursor: nextCursor } : {}),
      }

      const { result, query } = await fetchImages(queryParams)
      const items = result.items || []
      lastMetadata = result.metadata
      totalFetched += items.length
      nextCursor = result.metadata?.nextCursor

      console.debug('Crawl progress:', {
        query: getPathAndQuery(query),
        totalFetched,
        batchSize: items.length,
        metadata: result.metadata,
      })

      // Store each item in the batch
      for (const item of items) {
        await ctx.runMutation(internal.civitai.query.insertResult, {
          query: getPathAndQuery(query),
          entityType: 'image',
          entityId: item.id,
          result: JSON.stringify(item),
        })
      }

      if (totalFetched >= MAX_CRAWLED_ITEMS) {
        console.warn('Reached MAX_CRAWLED_ITEMS limit, stopping crawl')
        break
      }

      if (!nextCursor || items.length === 0)
        break
    }

    return {
      count: totalFetched,
      metadata: lastMetadata,
    }
  },
})
