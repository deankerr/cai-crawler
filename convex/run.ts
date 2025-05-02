import type { ImageQueryParams } from './civitai/validators'
import { asyncMap } from 'convex-helpers'
import { literals } from 'convex-helpers/validators'
import { v } from 'convex/values'
import { internal } from './_generated/api'
import { action, internalMutation } from './_generated/server'
import { fetchImages } from './civitai/query'
import schema from './schema'
import { getPathAndQuery } from './utils/url'

const MAX_CRAWLED_ITEMS = 100000
const IMAGE_PAGE_SIZE = 200

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
  startCursor: v.optional(v.string()),
  // page and limit are managed internally

  maxNewImages: v.optional(v.number()),
})

export const runImageCrawl = action({
  args: vImageQueryParams,
  handler: async (ctx, { maxNewImages, startCursor, ...restArgs }) => {
    const args = {
      nsfw: true,
      sort: 'Most Reactions' as const,
      period: 'AllTime' as const,
      ...restArgs,
    }

    let totalFetched = 0
    let newImagesCreated = 0
    let nextCursor: string | undefined = startCursor
    let lastMetadata: any = null

    console.log('Starting image crawl', {
      maxNewImages,
      args,
      MAX_CRAWLED_ITEMS,
    })

    // Loop until max crawled items reached
    while (totalFetched < MAX_CRAWLED_ITEMS) {
      // Calculate remaining items needed, considering both limits
      const remainingForMaxNew = maxNewImages ? maxNewImages - newImagesCreated : Infinity
      const remainingForTotal = MAX_CRAWLED_ITEMS - totalFetched
      const limit = Math.min(IMAGE_PAGE_SIZE, remainingForTotal, remainingForMaxNew)

      // Break if limit becomes 0 or negative (edge case)
      if (limit <= 0) {
        console.log('Limit calculated as <= 0, stopping crawl.', { limit, remainingForMaxNew, remainingForTotal })
        break
      }

      // Prepare query params for this batch
      const queryParams: ImageQueryParams = {
        ...args,
        limit,
        ...(nextCursor ? { cursor: nextCursor } : {}),
      }

      const { result, query } = await fetchImages(queryParams)
      const items = result.items || []
      const batchSize = items.length
      lastMetadata = result.metadata
      totalFetched += batchSize // Update total fetched count
      nextCursor = result.metadata?.nextCursor

      console.log('Crawl progress:', {
        query: getPathAndQuery(query),
        totalFetched,
        batchSize,
        newImagesCreated,
        metadata: result.metadata,
      })

      if (batchSize === 0) {
        console.log('Received 0 items in batch, assuming end of results.')
        break
      }

      const entitySnapshotResults = await ctx.runMutation(internal.run.insertEntitySnapshots, { items: items.map(item => ({
        entityId: item.id,
        entityType: 'image' as const,
        queryKey: getPathAndQuery(query),
        rawData: JSON.stringify(item), // result payload
      })) })

      // Filter for *only* the newly inserted snapshots to process
      const newItemsToProcess = entitySnapshotResults
        .filter(result => result.inserted)
        .map(({ entitySnapshotId, rawData }) => ({ entitySnapshotId, rawData }))

      if (newItemsToProcess.length > 0) {
        console.log(`Processing ${newItemsToProcess.length} new image snapshots...`)
        const imageResults = await ctx.runMutation(internal.images.insertImages, { items: newItemsToProcess })
        newImagesCreated += imageResults.filter(r => r.success).length
      }
      else {
        console.log('No new image snapshots to process in this batch.')
      }

      // Check optional maxNewImages limit if provided
      if (maxNewImages !== undefined && newImagesCreated >= maxNewImages) {
        console.log(`Reached maxNewImages limit (${maxNewImages}), stopping crawl.`)
        break
      }

      // Primary break condition based on total fetched
      if (totalFetched >= MAX_CRAWLED_ITEMS) {
        console.warn(`Reached MAX_CRAWLED_ITEMS limit (${MAX_CRAWLED_ITEMS}), stopping crawl`)
        break
      }

      if (!nextCursor) {
        console.log('No next cursor, stopping crawl.')
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

export const insertEntitySnapshots = internalMutation({
  args: { items: v.array(schema.tables.entitySnapshots.validator) },
  handler: async (ctx, { items }) => {
    const results = await asyncMap(items, async (arg) => {
      const existing = await ctx.db.query('entitySnapshots').withIndex('by_entity', q => q.eq('entityType', arg.entityType).eq('entityId', arg.entityId)).first()
      if (existing) {
        return ({
          ...arg,
          inserted: false,
          entitySnapshotId: existing._id,
        })
      }

      const entitySnapshotId = await ctx.db.insert('entitySnapshots', arg)
      return ({
        ...arg,
        inserted: true,
        entitySnapshotId,
      })
    })

    return results
  },
})

export const linkSnapshot = internalMutation({
  args: {
    entitySnapshotId: v.id('entitySnapshots'),
    processedDocumentId: v.string(),
  },
  handler: async (ctx, { entitySnapshotId, processedDocumentId }) => {
    await ctx.db.patch(entitySnapshotId, { processedDocumentId })
    console.debug(`Linked snapshot ${entitySnapshotId} to document ${processedDocumentId}`)
  },
})

const UNPROCESSED_BATCH_SIZE = 100

export const processUnlinkedSnapshots = internalMutation(
  {
    args: { cursor: v.optional(v.string()), entityType: v.literal('image') }, // Start with images
    handler: async (ctx, { cursor, entityType }) => {
      const results = await ctx.db
        .query('entitySnapshots')
        .withIndex('by_entityType_unprocessed', q =>
          q.eq('entityType', entityType).eq('processedDocumentId', undefined))
        .order('asc') // Or 'desc' if preferred
        .paginate({ numItems: UNPROCESSED_BATCH_SIZE, cursor: cursor ?? null })

      console.log(
        `Processing batch of ${results.page.length} unlinked '${entityType}' snapshots...`,
      )

      // Prepare batch for insertImages mutation
      const itemsToProcess = results.page.map(snapshot => ({
        entitySnapshotId: snapshot._id,
        rawData: snapshot.rawData,
      }))

      // Call insertImages directly if there are items
      if (itemsToProcess.length > 0) {
        const results = await ctx.runMutation(internal.images.insertImages, { items: itemsToProcess })
        await asyncMap(results, async (result) => {
          if ('docId' in result && result.docId) {
            await ctx.runMutation(internal.run.linkSnapshot, {
              entitySnapshotId: result.entitySnapshotId,
              processedDocumentId: result.docId,
            })
          }
        })
      }
      else {
        console.log('No unlinked snapshots found in this batch.')
      }

      // Schedule the next batch if needed
      if (!results.isDone) {
        await ctx.scheduler.runAfter(
          0,
          internal.run.processUnlinkedSnapshots,
          { cursor: results.continueCursor, entityType },
        )
      }
      else {
        console.log(`Finished processing all unlinked '${entityType}' snapshots.`)
      }
    },
  },
)
