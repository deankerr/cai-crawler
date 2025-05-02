import type { ImageQueryParams } from './civitai/validators'
import { asyncMap } from 'convex-helpers'
import { literals } from 'convex-helpers/validators'
import { v } from 'convex/values'
import { internal } from './_generated/api'
import { action, internalMutation } from './_generated/server'
import { fetchImages } from './civitai/query'
import schema from './schema'
import { getPathAndQuery } from './utils/url'

const MAX_CRAWLED_ITEMS = 100000 // safety limit during dev
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
        console.debug(`Processing ${newItemsToProcess.length} new image snapshots...`)
        const imageResults = await ctx.runMutation(internal.images.insertImages, { items: newItemsToProcess })
        // Update the count based on *newly processed* images in this batch
        newImagesCreated = newImagesCreated + imageResults.filter(r => r.success).length
      }
      else {
        console.debug('No new image snapshots to process in this batch.')
      }

      if (newImagesCreated >= maxNewImages) {
        break
      }

      // Safety break based on new images created
      if (newImagesCreated >= MAX_CRAWLED_ITEMS) {
        console.warn(`Reached MAX_CRAWLED_ITEMS limit (${MAX_CRAWLED_ITEMS}) based on new images created, stopping crawl`)
        break
      }

      if (!nextCursor) {
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
