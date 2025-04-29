import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
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
 * Process a batch of unstored images, storing them in R2
 * This function handles the actual processing and storage, and schedules itself
 * for the next batch if there are more images to process
 */
export const processUnstoredImages = action({
  args: v.object({
    limit: v.optional(v.number()),
    delaySeconds: v.optional(v.number()),
    cursor: v.union(v.string(), v.null()),

  }),
  handler: async (ctx, { limit = 10, delaySeconds = 5, cursor }) => {
    // Get unstored images
    const { page, isDone, continueCursor } = await ctx.runQuery(internal.civitai.images.getUnstoredImages, { numItems: limit, cursor })

    const results = {
      total: page.length,
      success: 0,
      failed: 0,
      processed: [] as Array<{ id: string, success: boolean, error?: string }>,
    }

    // Process each image
    for (const image of page) {
      try {
        // Generate storage key for the image
        const storageKey = generateStorageKey('images', image.imageId)

        // Call the store asset action
        const storageResult = await ctx.runAction(api.storage.storeAsset, {
          key: storageKey,
          sourceUrl: image.url,
          skipIfExists: true,
        })

        if (storageResult.success) {
          // Update database with storage info
          await ctx.runMutation(internal.civitai.images.updateStorage, {
            imageId: image._id,
            storageKey,
            size: storageResult.size || 0,
            storedUrl: storageResult.url || '',
          })

          results.success++
          results.processed.push({ id: image._id, success: true })
        }
        else {
          results.failed++
          results.processed.push({
            id: image._id,
            success: false,
            error: storageResult.error || 'Unknown error',
          })
        }
      }
      catch (error) {
        results.failed++
        results.processed.push({
          id: image._id,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    if (!results.success) {
      console.error('Failed to process a batch of images', results)
      throw new Error('Failed to process a batch of images')
    }

    // Schedule the next batch if there were results
    if (!isDone) {
      // Use the current function reference to schedule next run
      await ctx.scheduler.runAfter(delaySeconds, api.civitai.images.processUnstoredImages, { limit, cursor: continueCursor })
    }

    console.log('Processed images', results)
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
