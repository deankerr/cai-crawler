import { v } from 'convex/values'
import { internal } from './_generated/api'
import { action } from './_generated/server'

export const listImages = action({
  args: {
    limit: v.optional(v.number()),
    modelVersionId: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.runAction(internal.civitai.query.images, {
      limit: args.limit,
      modelVersionId: args.modelVersionId,
    })
  },
})

export const getModel = action({
  args: {
    modelId: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.runAction(internal.civitai.query.model, {
      modelId: args.modelId,
    })
  },
})

export const getModelVersion = action({
  args: {
    versionId: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.runAction(internal.civitai.query.modelVersion, {
      versionId: args.versionId,
    })
  },
})
