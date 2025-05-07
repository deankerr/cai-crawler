import type { Id } from './_generated/dataModel'
import type { ImageQueryParams } from './civitai/validators'
import { literals } from 'convex-helpers/validators'
import { v } from 'convex/values'
import { internal } from './_generated/api'
import { internalAction, internalMutation } from './_generated/server'
import { fetchImages } from './civitai/query'
import { getPathAndQuery } from './utils/url'

const MAX_CRAWLED_ITEMS = 100000
const IMAGE_PAGE_SIZE = 200

const MAX_RETRIES = 10
const MAX_BACKOFF_SECONDS = 300

const vTimePeriod = literals('AllTime', 'Year', 'Month', 'Week', 'Day')
const vSortOrder = literals('Most Reactions', 'Most Collected', 'Most Comments', 'Newest')

const vImageQueryParams = v.object({
  postId: v.optional(v.number()),
  modelId: v.optional(v.number()),
  modelVersionId: v.optional(v.number()),
  username: v.optional(v.string()),
  nsfw: v.optional(v.boolean()),
  sort: v.optional(vSortOrder),
  period: v.optional(vTimePeriod),
  startCursor: v.optional(v.string()),

  maxNewImages: v.optional(v.number()),
})

// Define the state object interface
const vCrawlState = v.object({
  args: vImageQueryParams,
  totalFetched: v.number(),
  newImagesCreated: v.number(),
  nextCursor: v.optional(v.string()),
  lastMetadata: v.optional(v.any()),
  maxNewImages: v.optional(v.number()),
  failureCount: v.number(),
})

export const startImageCrawl = internalMutation({
  args: vImageQueryParams,
  handler: async (ctx, args) => {
    // Create the initial state object
    const initialState = {
      args: {
        nsfw: args.nsfw ?? true,
        sort: args.sort ?? 'Most Reactions',
        period: args.period ?? 'AllTime',
        postId: args.postId,
        modelId: args.modelId,
        modelVersionId: args.modelVersionId,
        username: args.username,
      },
      totalFetched: 0,
      newImagesCreated: 0,
      nextCursor: args.startCursor,
      lastMetadata: null,
      maxNewImages: args.maxNewImages,
      failureCount: 0,
    }

    console.log('Starting image crawl with initial state:', initialState)

    // Schedule the first run
    await ctx.scheduler.runAfter(0, internal.run.runImageCrawl, { state: initialState })
  },
})

export const runImageCrawl = internalAction({
  args: {
    state: vCrawlState,
  },
  handler: async (ctx, { state }): Promise<typeof state> => {
    const { args, totalFetched, newImagesCreated, nextCursor, maxNewImages, failureCount } = state

    // Check if we've already reached any of our stopping conditions
    if (totalFetched >= MAX_CRAWLED_ITEMS) {
      console.log(`Already reached MAX_CRAWLED_ITEMS limit (${MAX_CRAWLED_ITEMS}), finishing crawl.`)
      return state
    }

    if (maxNewImages !== undefined && newImagesCreated >= maxNewImages) {
      console.log(`Already reached maxNewImages limit (${maxNewImages}), finishing crawl.`)
      return state
    }

    if (!nextCursor && totalFetched > 0) {
      console.log('No next cursor available, finishing crawl.')
      return state
    }

    // Calculate how many items to fetch in this batch
    const remainingForMaxNew = maxNewImages ? maxNewImages - newImagesCreated : Infinity
    const remainingForTotal = MAX_CRAWLED_ITEMS - totalFetched
    const limit = Math.min(IMAGE_PAGE_SIZE, remainingForTotal, remainingForMaxNew)

    if (limit <= 0) {
      console.log('Limit calculated as <= 0, finishing crawl.', { limit, remainingForMaxNew, remainingForTotal })
      return state
    }

    // Prepare query params for this batch
    const queryParams: ImageQueryParams = {
      ...args,
      limit,
      ...(nextCursor ? { cursor: nextCursor } : {}),
    }

    console.log('Executing single batch of image crawl:', {
      queryParams,
      totalFetchedSoFar: totalFetched,
      newImagesCreatedSoFar: newImagesCreated,
    })

    try {
      // Make a single API call
      const { result, query } = await fetchImages(queryParams)
      const items = result.items || []
      const batchSize = items.length
      const updatedNextCursor = result.metadata?.nextCursor
      const updatedTotalFetched = totalFetched + batchSize

      console.log('Batch results:', {
        query: getPathAndQuery(query),
        batchSize,
        metadata: result.metadata,
      })

      if (batchSize === 0) {
        console.log('Received 0 items in batch, finishing crawl.')
        return {
          ...state,
          lastMetadata: result.metadata,
          failureCount: 0, // Reset failure count on success
        }
      }

      // Process the items
      const entitySnapshotResults = await ctx.runMutation(internal.entitySnapshots.insertEntitySnapshots, { items: items.map(item => ({
        entityId: item.id,
        entityType: 'image' as const,
        queryKey: getPathAndQuery(query),
        rawData: JSON.stringify(item),
      })) })

      const imageResults = await ctx.runMutation(internal.images.insertImages, {
        items: entitySnapshotResults.map(({ entitySnapshotId, rawData }: { entitySnapshotId: Id<'entitySnapshots'>, rawData: string }) => ({
          entitySnapshotId,
          rawData,
        })),
      })
      const newBatchImagesCreated = imageResults.filter((r: { inserted: boolean }) => r.inserted).length

      // Update the state
      const updatedState = {
        ...state,
        totalFetched: updatedTotalFetched,
        newImagesCreated: newImagesCreated + newBatchImagesCreated,
        nextCursor: updatedNextCursor,
        lastMetadata: result.metadata,
        failureCount: 0, // Reset failure count on success
      }

      // Check if we need to schedule another run
      const shouldContinue
        = updatedTotalFetched < MAX_CRAWLED_ITEMS
          && (maxNewImages === undefined || updatedState.newImagesCreated < maxNewImages)
          && updatedNextCursor !== undefined
          && batchSize > 0

      if (shouldContinue) {
        console.log('Scheduling next batch of image crawl.')
        // Schedule the next run
        await ctx.scheduler.runAfter(0, internal.run.runImageCrawl, { state: updatedState })
      }
      else {
        console.log('Image crawl finished.', {
          totalFetched: updatedTotalFetched,
          newImagesCreated: updatedState.newImagesCreated,
          metadata: result.metadata,
        })
      }

      return updatedState
    }
    catch (error) {
      // Handle the failure
      const newFailureCount = failureCount + 1
      console.error(`Image crawl batch failed (attempt ${newFailureCount}):`, error)

      // Calculate backoff time with exponential backoff (1s, 2s, 4s, 8s, etc.)
      // Cap at 5 minutes (300 seconds)
      const backoffSeconds = Math.min(2 ** (newFailureCount - 1), MAX_BACKOFF_SECONDS)
      console.log(`Retrying after ${backoffSeconds} seconds...`)

      // Max retries - stop after 10 failures
      if (newFailureCount <= MAX_RETRIES) {
        // Schedule retry with backoff
        await ctx.scheduler.runAfter(backoffSeconds, internal.run.runImageCrawl, {
          state: {
            ...state,
            failureCount: newFailureCount,
          },
        })
      }
      else {
        console.error(`Exceeded maximum retry attempts (${MAX_RETRIES}), stopping crawl.`)
      }

      return {
        ...state,
        failureCount: newFailureCount,
      }
    }
  },
})

// const UNPROCESSED_BATCH_SIZE = 100

// export const processUnlinkedSnapshots = internalMutation(
//   {
//     args: { cursor: v.optional(v.string()), entityType: v.literal('image') },
//     handler: async (ctx, { cursor, entityType }) => {
//       // paginate entitySnapshots which lack processedDocumentIds
//       const results = await ctx.db
//         .query('entitySnapshots')
//         .withIndex('by_entityType_processedDocumentId', q =>
//           q.eq('entityType', entityType).eq('processedDocumentId', undefined))
//         .order('asc')
//         .paginate({ numItems: UNPROCESSED_BATCH_SIZE, cursor: cursor ?? null })

//       console.log(
//         `Processing batch of ${results.page.length} unlinked '${entityType}' snapshots...`,
//       )

//       // Prepare batch for insertImages mutation
//       const itemsToProcess = results.page.map(snapshot => ({
//         entitySnapshotId: snapshot._id,
//         rawData: snapshot.rawData,
//       }))

//       // Call insertImages directly if there are items
//       if (itemsToProcess.length > 0) {
//         await ctx.runMutation(internal.images.insertImages, { items: itemsToProcess })
//       }
//       else {
//         console.log('No unlinked snapshots found in this batch.')
//       }

//       // Schedule the next batch if needed
//       if (!results.isDone) {
//         await ctx.scheduler.runAfter(
//           0,
//           internal.run.processUnlinkedSnapshots,
//           { cursor: results.continueCursor, entityType },
//         )
//       }
//       else {
//         console.log(`Finished processing all unlinked '${entityType}' snapshots.`)
//       }
//     },
//   },
// )
