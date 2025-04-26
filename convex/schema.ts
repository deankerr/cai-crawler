import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema(
  {
    images: defineTable({
      url: v.string(),
      width: v.number(),
      height: v.number(),
      nsfw: v.boolean(),
      nsfwLevel: v.string(),
      createdAt: v.string(),
      postId: v.optional(v.number()),
      hash: v.string(),
      username: v.string(),

      // References to other entities
      referencedModels: v.array(
        v.object({
          type: v.string(), // "checkpoint", "lora", etc.
          id: v.optional(v.number()),
          versionId: v.optional(v.number()),
          weight: v.optional(v.number()),
          hash: v.optional(v.string()),
          name: v.optional(v.string()),
        }),
      ),

      // Storage reference
      storageId: v.optional(v.string()),

      // Stats for sorting
      totalReactions: v.number(),
      stats: v.object({
        likeCount: v.number(),
        heartCount: v.number(),
        laughCount: v.number(),
        cryCount: v.number(),
        commentCount: v.number(),
      }),

      // Original data
      meta: v.any(),
      rawData: v.any(),

      // Processing metadata
      processedAt: v.optional(v.string()),
      processingErrors: v.optional(v.array(v.string())),
    })
      .index('by_hash', ['hash'])
      .index('by_username', ['username'])
      .index('by_createdAt', ['createdAt']),

    models: defineTable({
      modelId: v.number(),
      name: v.string(),
      description: v.string(),
      type: v.string(), // "Checkpoint", "LoRA", etc.
      nsfw: v.boolean(),

      // Creator reference
      creatorUsername: v.string(),

      // Stats
      stats: v.object({
        downloadCount: v.number(),
        favoriteCount: v.optional(v.number()),
        commentCount: v.optional(v.number()),
        ratingCount: v.number(),
        rating: v.number(),
      }),

      // Tags
      tags: v.array(v.string()),

      // Version references
      versionIds: v.array(v.number()),

      // Original data
      rawData: v.any(),

      // Processing metadata
      processedAt: v.optional(v.string()),
      processingErrors: v.optional(v.array(v.string())),
    })
      .index('by_modelId', ['modelId'])
      .index('by_creator', ['creatorUsername'])
      .index('by_type', ['type']),

    modelVersions: defineTable({
      versionId: v.number(),
      modelId: v.number(),
      name: v.string(),
      createdAt: v.string(),
      baseModel: v.string(), // "SD 1.5", "SDXL", etc.

      // Files
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

      // Image references
      imageIds: v.array(v.id('images')),

      // Original data
      rawData: v.any(),

      // Processing metadata
      processedAt: v.optional(v.string()),
      processingErrors: v.optional(v.array(v.string())),
    })
      .index('by_versionId', ['versionId'])
      .index('by_modelId', ['modelId'])
      .index('by_createdAt', ['createdAt']),

    creators: defineTable({
      username: v.string(),
      image: v.optional(v.string()),

      // References
      modelIds: v.array(v.number()),
      imageIds: v.array(v.id('images')),

      // Original data
      rawData: v.any(),

      // Processing metadata
      processedAt: v.optional(v.string()),
      processingErrors: v.optional(v.array(v.string())),
    })
      .index('by_username', ['username']),
  },
  // If you ever get an error about schema mismatch
  // between your data and your schema, and you cannot
  // change the schema to match the current data in your database,
  // you can:
  //  1. Use the dashboard to delete tables or individual documents
  //     that are causing the error.
  //  2. Change this option to `false` and make changes to the data
  //     freely, ignoring the schema. Don't forget to change back to `true`!
  { schemaValidation: true },
)
