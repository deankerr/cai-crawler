import { v } from 'convex/values'
import { mutation } from '../_generated/server'

/**
 * Store a model from Civitai API in our database
 *
 * This checks if the model already exists by modelId, and only stores it if it doesn't.
 */
export const storeModel = mutation({
  args: {
    modelData: v.object({
      modelId: v.number(),
      name: v.string(),
      description: v.string(),
      type: v.string(),
      nsfw: v.boolean(),
      creatorUsername: v.string(),
      stats: v.object({
        downloadCount: v.number(),
        favoriteCount: v.optional(v.number()),
        commentCount: v.optional(v.number()),
        ratingCount: v.number(),
        rating: v.number(),
      }),
      tags: v.array(v.string()),
      versionIds: v.array(v.number()),
      rawData: v.any(),
      processedAt: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const { modelData } = args

    // Check if model already exists
    const existingModel = await ctx.db
      .query('models')
      .withIndex('by_modelId', q => q.eq('modelId', modelData.modelId))
      .first()

    if (existingModel) {
      console.warn('Model already exists:', modelData.name)
      // Model already exists, just return its ID
      return {
        id: existingModel._id,
        isNew: false,
      }
    }

    // Store model in database
    const id = await ctx.db.insert('models', modelData)
    console.log('Stored new model:', modelData.name)
    return {
      id,
      isNew: true,
    }
  },
})
