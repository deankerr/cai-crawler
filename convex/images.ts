import { asyncMap } from 'convex-helpers'
import { v } from 'convex/values'
import { internalMutation } from './_generated/server'
import { Image } from './civitai/validators'
import { generateStorageKey } from './storage'
import { extractModelReferences } from './utils/extractors'

export const createImages = internalMutation({
  args: {
    items: v.array(v.object({ apiResultId: v.id('apiResults'), result: v.string() })),
  },
  handler: async (ctx, { items }) => {
    const results = await asyncMap(items, async ({ apiResultId, result }) => {
      const parsed = Image.safeParse(JSON.parse(result))
      if (!parsed.success) {
        console.error('Failed to parse image data', parsed.error.flatten(), JSON.parse(result))
        return { apiResultId, success: false, error: parsed.error.flatten() }
      }

      const { id: imageId, hash: blurHash, meta, ...imageData } = parsed.data

      const existing = await ctx.db.query('images').withIndex('by_imageId', q => q.eq('imageId', imageId)).first()
      if (existing) {
        return { apiResultId, success: false, error: `imageId already exists: ${existing._id}` }
      }

      const models = extractModelReferences(meta ?? {})
      const storageKey = generateStorageKey('images', imageId)

      const docId = await ctx.db.insert('images', {
        imageId,
        apiResultId,
        ...imageData,
        blurHash,
        totalReactions: imageData.stats.likeCount + imageData.stats.heartCount + imageData.stats.laughCount + imageData.stats.cryCount + imageData.stats.commentCount,
        models,
        storageKey,
      })

      return ({ apiResultId, success: true, url: imageData.url, imageId, docId })
    })

    // TODO:
    // await ctx.scheduler.runAfter(0, [enqueue batch function path], [{args}])

    return results
  },
})
