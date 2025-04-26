import type { Id } from '../_generated/dataModel'
import type { ModelReference } from '../utils/extractors'
import { v } from 'convex/values'
import { api } from '../_generated/api'
import { action } from '../_generated/server'
import { fetchFromCivitai } from '../utils/api'
import { extractModelReferences } from '../utils/extractors'

// Define the return type for process images
interface ProcessImagesResult {
  processed: Array<{
    id: Id<'images'> | string | number
    isNew?: boolean
    references?: ModelReference[]
    error?: string
  }>
  metadata: any
  totalProcessed: number
  newImages: number
}

export const processImagesPage = action({
  args: {
    params: v.object({
      limit: v.optional(v.number()),
      page: v.optional(v.number()),
      modelVersionId: v.optional(v.number()),
      nsfw: v.optional(v.boolean()),
      username: v.optional(v.string()),
      sort: v.optional(v.string()),
      period: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args): Promise<ProcessImagesResult> => {
    // Fetch images from API using our fetchFromCivitai utility function
    const imagesData: {
      items: any[]
      metadata: any
    } = await fetchFromCivitai('/images', args.params)

    if (!imagesData.items || !Array.isArray(imagesData.items)) {
      throw new Error(`Invalid response from Civitai API: missing items array`)
    }

    // Process each image sequentially
    const results = []
    for (const imageData of imagesData.items) {
      try {
        // Extract model references using robust extractor
        const referencedModels: ModelReference[] = extractModelReferences(imageData)

        // Store the image using our mutation
        const result: { id: Id<'images'>, isNew: boolean } = await ctx.runMutation(api.mutations.images.storeImage, {
          imageData,
          referencedModels,
        })

        results.push({
          id: result.id,
          isNew: result.isNew,
          references: referencedModels,
        })
      }
      catch (error) {
        console.error(`Error processing image ${imageData.id}:`, error)
        results.push({
          id: imageData.id,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    return {
      processed: results,
      metadata: imagesData.metadata,
      totalProcessed: results.length,
      newImages: results.filter(r => r.isNew).length,
    }
  },
})
