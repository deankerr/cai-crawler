import { literals } from 'convex-helpers/validators'
import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

const entityType = literals('image', 'model', 'modelVersion')

export default defineSchema(
  {
    images: defineTable({
      imageId: v.number(),
      url: v.string(),
      width: v.number(),
      height: v.number(),
      nsfw: v.boolean(),
      nsfwLevel: v.string(),
      createdAt: v.string(),
      postId: v.optional(v.number()),
      blurHash: v.string(),
      username: v.union(v.string(), v.null()),

      // R2 storage information
      storageKey: v.optional(v.string()),

      // References to other entities
      models: v.array(
        v.object({
          modelId: v.optional(v.number()),
          versionId: v.optional(v.number()),
          type: v.string(), // "checkpoint", "lora", etc.
          name: v.optional(v.string()),
          hash: v.optional(v.string()),
        }),
      ),

      // Stats for sorting
      totalReactions: v.number(),
      stats: v.object({
        likeCount: v.number(),
        heartCount: v.number(),
        laughCount: v.number(),
        cryCount: v.number(),
        commentCount: v.number(),
      }),

      entitySnapshotId: v.id('entitySnapshots'),
    })
      .index('by_imageId', ['imageId'])
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
    })
      .index('by_modelId', ['modelId'])
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
    })
      .index('by_versionId', ['versionId'])
      .index('by_modelId', ['modelId'])
      .index('by_createdAt', ['createdAt']),

    entitySnapshots: defineTable({
      entityType,
      entityId: v.number(), // e.g., imageId, modelId, modelVersionId
      parentId: v.optional(v.number()), // e.g., modelId for modelVersion
      queryKey: v.string(),
      rawData: v.string(), // stringified JSON blob for this entity
      processedDocumentId: v.optional(v.string()), // Link to the processed doc (image, model, etc.)
    })
      .index('by_entity', ['entityType', 'entityId'])
      .index('by_entityType_unprocessed', ['entityType', 'processedDocumentId']),
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
