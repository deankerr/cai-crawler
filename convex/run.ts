import { internal } from './_generated/api'
import { action } from './_generated/server'

export const demoImages = action({
  handler: async (ctx, args) => {
    await ctx.runAction(internal.civitai.query.images, { limit: 3, modelVersionId: 1218156 })
  },
})
