import { v } from 'convex/values'
import { mutation } from '../_generated/server'

/**
 * Store an image from Civitai API in our database
 *
 * This checks if the image already exists by hash, and only stores it if it doesn't.
 */
export const storeImage = mutation({
  args: {
    imageData: v.any(),
    referencedModels: v.array(
      v.object({
        type: v.string(),
        name: v.optional(v.string()),
        id: v.optional(v.number()),
        versionId: v.optional(v.number()),
        weight: v.optional(v.number()),
        hash: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const { imageData, referencedModels } = args

    // Check if image already exists
    const existingImage = await ctx.db
      .query('images')
      .withIndex('by_hash', q => q.eq('hash', imageData.hash))
      .first()

    if (existingImage) {
      // Image already exists, just return its ID
      return {
        id: existingImage._id,
        isNew: false,
      }
    }

    // Calculate total reactions for sorting
    const totalReactions
      = (imageData.stats.likeCount || 0)
        + (imageData.stats.heartCount || 0)
        + (imageData.stats.laughCount || 0)
        + (imageData.stats.cryCount || 0)

    // Store image in database
    const id = await ctx.db.insert('images', {
      url: imageData.url,
      width: imageData.width,
      height: imageData.height,
      nsfw: imageData.nsfw,
      nsfwLevel: imageData.nsfwLevel,
      createdAt: imageData.createdAt,
      postId: imageData.postId,
      hash: imageData.hash,
      username: imageData.username,
      referencedModels,
      totalReactions,
      stats: {
        likeCount: imageData.stats.likeCount || 0,
        heartCount: imageData.stats.heartCount || 0,
        laughCount: imageData.stats.laughCount || 0,
        cryCount: imageData.stats.cryCount || 0,
        commentCount: imageData.stats.commentCount || 0,
      },

    })

    return {
      id,
      isNew: true,
    }
  },
})
