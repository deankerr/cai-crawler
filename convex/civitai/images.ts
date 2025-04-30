import type { Doc, Id } from '../_generated/dataModel'
import type { ActionCtx, MutationCtx } from '../_generated/server'
import { v } from 'convex/values'
import { api, internal } from '../_generated/api'
import { action, internalMutation, internalQuery, mutation } from '../_generated/server'
import { generateStorageKey } from '../storage'
import { extractModelReferences } from '../utils/extractors'
import { Image } from './validators'

/**
 * Create an image record from a stored API result
 */
export async function createImage(ctx: MutationCtx, { apiResultId, result }: { apiResultId: Id<'apiResults'>, result: string }) {
  const parsed = Image.safeParse(JSON.parse(result))
  if (!parsed.success) {
    console.error('Failed to parse image data', parsed.error, JSON.parse(result))
    return null
  }

  const { id, hash, meta, ...imageData } = parsed.data

  const models = extractModelReferences(meta ?? {})

  return await ctx.db.insert('images', {
    imageId: id,
    ...imageData,
    blurHash: hash,
    totalReactions: imageData.stats.likeCount + imageData.stats.heartCount + imageData.stats.laughCount + imageData.stats.cryCount + imageData.stats.commentCount,
    models,
    apiResultId,
  })
}

/**
 * Create an image record in the database from API results
 */
export const create = internalMutation({
  args: v.object({
    apiResultId: v.id('apiResults'),
    result: v.string(),
  }),
  handler: async (ctx, args) => {
    return await createImage(ctx, args)
  },
})

/**
 * Update an image's storage information after uploading to R2
 */
export const updateStorage = internalMutation({
  args: v.object({
    imageId: v.id('images'),
    storageKey: v.string(),
    storedUrl: v.string(),
    size: v.number(),
  }),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.imageId, {
      storageKey: args.storageKey,
      storedUrl: args.storedUrl,
      storedSize: args.size,
    })
    return true
  },
})

/**
 * Get a batch of images that haven't been stored in R2 yet
 */
export const getUnstoredImages = internalQuery({
  args: v.object({
    numItems: v.optional(v.number()),
    cursor: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, { numItems = 10, cursor }) => {
    return await ctx.db
      .query('images')
      .withIndex('by_storageStatus', q => q.eq('storageKey', undefined))
      .paginate({ numItems, cursor })
  },
})

/**
 * Sends a task to the Cloudflare Worker endpoint to enqueue image storage processing.
 */
async function enqueueStorageTaskViaWorker(ctx: ActionCtx, image: Doc<'images'>) {
  const workerEnqueueUrl = process.env.ASSETS_WORKER_ENQUEUE_URL
  const workerSecret = process.env.ASSETS_SECRET // Shared secret

  if (!workerEnqueueUrl) {
    throw new Error('ASSETS_WORKER_ENQUEUE_URL environment variable not set in Convex')
  }
  if (!workerSecret) {
    throw new Error('ASSETS_SECRET environment variable not set in Convex')
  }

  // Ensure image.url exists before proceeding
  if (!image.url) {
    console.warn(`Skipping enqueue for image ${image._id} due to missing URL.`)
    return { success: false, error: 'Missing source URL' }
  }

  const storageKey = generateStorageKey('images', image.imageId)
  const payload = {
    imageId: image._id,
    sourceUrl: image.url,
    storageKey,
  }

  try {
    const response = await fetch(workerEnqueueUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Use the shared secret for authentication
        'Authorization': `Bearer ${workerSecret}`,
      },
      // Send the payload directly (not nested under "messages")
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      // Log specific error from worker if available
      console.error(`Worker endpoint returned error: ${response.status} ${response.statusText} - ${errorBody}`)
      // Throw to indicate failure to the calling action
      throw new Error(`Failed to send task to worker endpoint: ${response.status}`)
    }

    console.log(`Successfully sent storage task to worker for image ${image._id}`)
    return { success: true }
  }
  catch (error) {
    console.error(`Error sending task to worker for image ${image._id}:`, error)
    // Propagate error to indicate failure
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * Process a batch of unstored images, sending tasks to a Worker for enqueueing.
 * This function handles getting unstored images and schedules itself
 * for the next batch if there are more images to process.
 */
export const processUnstoredImages = action({
  args: v.object({
    limit: v.optional(v.number()),
    delaySeconds: v.optional(v.number()),
    cursor: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, { limit = 10, delaySeconds = 5, cursor }) => {
    const { page, isDone, continueCursor } = await ctx.runQuery(internal.civitai.images.getUnstoredImages, { numItems: limit, cursor })

    const results = {
      totalQueried: page.length,
      enqueued: 0,
      failedToEnqueue: 0,
      processed: [] as Array<{ id: string, success: boolean, error?: string }>, // Tracks enqueue attempts
    }

    // Send task to worker for each image
    for (const image of page) {
      // enqueueStorageTaskViaWorker now handles the URL check internally
      const enqueueResult = await enqueueStorageTaskViaWorker(ctx, image)

      if (enqueueResult.success) {
        results.enqueued++
        results.processed.push({ id: image._id, success: true })
      }
      else {
        results.failedToEnqueue++
        results.processed.push({
          id: image._id,
          success: false,
          error: enqueueResult.error || 'Unknown worker communication error',
        })
      }
    }

    console.log('Worker task submission results:', results)

    if (results.totalQueried > 0 && results.enqueued === 0) {
      console.error('Failed to send any tasks to the worker in this batch', results)
      throw new Error('Failed to send any tasks to the worker. Check Worker endpoint and configuration.')
    }

    // TODO: Uncomment
    // if (!isDone) {
    //   await ctx.scheduler.runAfter(delaySeconds * 1000, api.civitai.images.processUnstoredImages, { limit, delaySeconds, cursor: continueCursor })
    // }

    console.log(`Completed batch processing. Sent to worker: ${results.enqueued}, Failed: ${results.failedToEnqueue}. More batches: ${!isDone}`)
  },
})

/**
 * Start the process of storing images in R2
 * This will find all images without storage info and process them in batches
 */
export const startStorageProcess = mutation({
  args: v.object({
    batchSize: v.optional(v.number()),
    delaySeconds: v.optional(v.number()),
  }),
  handler: async (ctx, { batchSize = 20, delaySeconds = 0 }) => {
    // Schedule the storage process
    await ctx.scheduler.runAfter(delaySeconds, api.civitai.images.processUnstoredImages, {
      limit: batchSize,
      delaySeconds,
      cursor: null,
    })

    return {
      message: `Scheduled image storage process with batch size ${batchSize}`,
    }
  },
})
