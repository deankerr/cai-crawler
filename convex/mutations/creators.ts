import { v } from 'convex/values'
import { mutation } from '../_generated/server'

/**
 * Store a creator from Civitai API in our database
 *
 * This checks if the creator already exists by username, and only stores it if it doesn't.
 */
export const storeCreator = mutation({
  args: {
    creatorData: v.object({
      username: v.string(),
      image: v.optional(v.string()),
      modelIds: v.array(v.number()),
      imageIds: v.array(v.id('images')),
      rawData: v.any(),
      processedAt: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const { creatorData } = args

    // Check if creator already exists
    const existingCreator = await ctx.db
      .query('creators')
      .withIndex('by_username', q => q.eq('username', creatorData.username))
      .first()

    if (existingCreator) {
      console.warn('Creator already exists:', creatorData.username)
      // Creator already exists, just return its ID
      return {
        id: existingCreator._id,
        isNew: false,
      }
    }

    // Store creator in database
    const id = await ctx.db.insert('creators', creatorData)
    console.log('Stored new creator:', creatorData.username)
    return {
      id,
      isNew: true,
    }
  },
})
