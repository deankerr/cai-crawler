import type { ActionCtx } from './_generated/server'
import { asyncMap } from 'convex-helpers'
import { v } from 'convex/values'
import { internal } from './_generated/api'
import { internalAction, internalMutation, internalQuery } from './_generated/server'
import { Image } from './civitai/validators'
import { generateStorageKey } from './storage'
import { extractModelReferences } from './utils/extractors'

// Define the structure expected by the worker's /enqueue endpoint for a single task
const assetStorageTaskValidator = v.object({
  sourceUrl: v.string(),
  storageKey: v.string(),
})

// Validator for the batch argument to the enqueue action
const enqueueBatchArgsValidator = v.object({
  tasks: v.array(assetStorageTaskValidator),
})

export const insertImages = internalMutation({
  args: {
    items: v.array(v.object({ entitySnapshotId: v.id('entitySnapshots'), rawData: v.string() })),
  },
  handler: async (ctx, { items }) => {
    const results = await asyncMap(items, async ({ entitySnapshotId, rawData }) => {
      try {
        const parsed = Image.safeParse(JSON.parse(rawData))
        if (!parsed.success) {
          console.error('Failed to parse image data', parsed.error.flatten(), JSON.parse(rawData))
          return { entitySnapshotId, success: false, error: parsed.error.flatten() }
        }

        const { id: imageId, hash: blurHash, meta, url, ...imageData } = parsed.data

        const existing = await ctx.db.query('images').withIndex('by_imageId', q => q.eq('imageId', imageId)).first()
        if (existing) {
          return { entitySnapshotId, success: false, sourceUrl: url, storageKey: existing.storageKey, docId: existing._id }
        }

        const models = extractModelReferences(meta ?? {})
        const storageKey = generateStorageKey('images', imageId)

        const docId = await ctx.db.insert('images', {
          imageId,
          entitySnapshotId,
          url, // Keep original URL for reference
          ...imageData,
          blurHash,
          totalReactions: imageData.stats.likeCount + imageData.stats.heartCount + imageData.stats.laughCount + imageData.stats.cryCount + imageData.stats.commentCount,
          models,
          storageKey,
        })

        // Link the snapshot to the newly created image document
        await ctx.runMutation(internal.run.linkSnapshot, {
          entitySnapshotId,
          processedDocumentId: docId,
        })

        // Return necessary info for the enqueue step
        return ({ entitySnapshotId, success: true, sourceUrl: url, storageKey, docId })
      }
      catch (error) {
        console.error(`Error processing snapshot ${entitySnapshotId}:`, error)
        return { entitySnapshotId, success: false, error: error instanceof Error ? error.message : String(error) }
      }
    })

    // Filter successful inserts and prepare tasks for the worker
    const successfulTasks = results
      .filter(r => r.success && r.sourceUrl && r.storageKey)
      .map(r => ({ sourceUrl: r.sourceUrl!, storageKey: r.storageKey! }))

    if (successfulTasks.length > 0) {
      console.log(`Scheduling enqueue action for ${successfulTasks.length} images.`)
      // Schedule the internal action to send the batch to the worker
      await ctx.scheduler.runAfter(0, internal.images.enqueueImageStorageBatch, { tasks: successfulTasks })
    }

    // Return the results of the image creation attempts
    return results.map(({ sourceUrl: _su, storageKey: _sk, ...rest }) => rest) // Don't return sourceUrl/storageKey in final result
  },
})

/**
 * Internal Action: Sends a batch of storage tasks to the Cloudflare Worker.
 */
export const enqueueImageStorageBatch = internalAction({
  args: enqueueBatchArgsValidator,
  handler: async (ctx: ActionCtx, { tasks }) => {
    const workerEnqueueUrl = process.env.ASSETS_WORKER_ENQUEUE_URL
    const workerSecret = process.env.ASSETS_SECRET

    if (!workerEnqueueUrl || !workerSecret) {
      console.error('Worker enqueue URL or secret not configured in Convex environment.')
      // Fail the action if config is missing
      throw new Error('Worker communication environment variables not set.')
    }

    // The worker expects the tasks array nested under a "tasks" key
    const payload = { tasks }

    try {
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${workerSecret}`,
        'User-Agent': 'ConvexCivitaiCrawler/1.0',
      }

      console.log(`Sending batch of ${tasks.length} tasks to worker: ${workerEnqueueUrl}`)
      const response = await fetch(workerEnqueueUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorBody = await response.text()
        console.error(`Worker endpoint returned error: ${response.status} ${response.statusText} - ${errorBody}`)
        throw new Error(`Failed to send batch to worker endpoint: Status ${response.status}`)
      }

      const responseJson = await response.json()
      if (!responseJson.success) {
        console.warn(`Worker endpoint reported failure for batch`, responseJson)
        throw new Error(`Worker endpoint reported batch failure.`)
      }

      console.log(`Successfully sent batch of ${responseJson.enqueuedCount || tasks.length} tasks to worker.`)
      return { success: true, sentCount: responseJson.enqueuedCount || tasks.length }
    }
    catch (error) {
      console.error(`Error sending batch to worker:`, error)
      // Throw the error so the action fails and potentially gets retried by Convex
      throw error
    }
  },
})
