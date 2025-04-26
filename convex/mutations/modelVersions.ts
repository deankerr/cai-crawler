import { v } from 'convex/values'
import { mutation } from '../_generated/server'

/**
 * Store a model version from Civitai API in our database
 *
 * This checks if the model version already exists by versionId, and only stores it if it doesn't.
 */
export const storeModelVersion = mutation({
  args: {
    versionData: v.object({
      versionId: v.number(),
      modelId: v.number(),
      name: v.string(),
      createdAt: v.string(),
      baseModel: v.string(),
      files: v.array(
        v.object({
          id: v.number(),
          name: v.string(),
          type: v.string(),
          sizeKB: v.number(),
          hashes: v.record(v.string(), v.string()),
          downloadUrl: v.string(),
          primary: v.optional(v.boolean()),
        }),
      ),
      imageIds: v.array(v.id('images')),
      rawData: v.any(),
      processedAt: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const { versionData } = args

    // Check if model version already exists
    const existingVersion = await ctx.db
      .query('modelVersions')
      .withIndex('by_versionId', q => q.eq('versionId', versionData.versionId))
      .first()

    if (existingVersion) {
      console.warn('Model version already exists:', versionData.name, 'base model:', versionData.baseModel)
      // Model version already exists, just return its ID
      return {
        id: existingVersion._id,
        isNew: false,
      }
    }

    // Store model version in database
    const id = await ctx.db.insert('modelVersions', versionData)
    console.log('Stored new model version:', versionData.name, 'base model:', versionData.baseModel)

    return {
      id,
      isNew: true,
    }
  },
})
