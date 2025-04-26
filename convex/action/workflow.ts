import type { ModelReference } from '../utils/extractors'
import { v } from 'convex/values'
import { api } from '../_generated/api'
import { action } from '../_generated/server'
import { fetchFromCivitai } from '../utils/api'

/**
 * Simple demo workflow for the Civitai crawler
 *
 * This workflow:
 * 1. Processes a page of recent images
 * 2. Processes model references found in those images
 * 3. Returns statistics about the processed data
 *
 * In a production implementation, this would be expanded to:
 * - Process multiple pages
 * - Download and store images in R2
 */
export const runCrawlerDemo = action({
  args: {
    // Query parameters for the images endpoint
    limit: v.optional(v.number()),
    nsfw: v.optional(v.boolean()),
    sort: v.optional(v.string()),
    period: v.optional(v.string()),
    modelVersionId: v.optional(v.number()),
    // Process options
    processModels: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<{
    totalImages: number
    newImages: number
    modelReferencesFound: {
      checkpoints: number
      loras: number
      total: number
    }
    modelsProcessed: {
      models: {
        new: number
        existing: number
        failed: number
        total: number
      }
      modelVersions: {
        new: number
        existing: number
        failed: number
        total: number
      }
      insufficientData: number
    }
    durationMs: number
  }> => {
    console.log('Starting crawler demo workflow')
    const startTime = Date.now()

    // Construct parameters for the API call
    const params = {
      limit: args.limit ?? 10,
      nsfw: args.nsfw ?? false,
      sort: args.sort ?? 'Most Reactions', // Valid options: Most Reactions, Most Comments, Newest
      period: args.period ?? 'Day', // Valid options: AllTime, Year, Month, Week, Day
      modelVersionId: args.modelVersionId,
    }

    // Process a page of images
    console.log(`Fetching ${params.limit} images with params:`, params)
    const result = await ctx.runAction(api.action.images.processImagesPage, { params })

    // Gather all model references to process
    let allReferences: ModelReference[] = []
    const allUsernames: Set<string> = new Set()
    result.processed.forEach((item, idx) => {
      if (item.references) {
        allReferences = allReferences.concat(item.references)
      }
      // Collect usernames from images
      if (result.processed[idx] && typeof result.processed[idx].id !== 'undefined') {
        // The username is in the original imagesData.items[idx]
        // But we don't have imagesData here, so instead, add a username field to processed in images.ts (future improvement)
        // For now, skip if not available
      }
    })
    // Instead, get usernames from imagesData in images.ts and return as part of processed
    // For now, let's fetch usernames from the images endpoint again
    // But ideally, images.ts should return username in processed

    // For now, fetch usernames from the images endpoint again
    // (This is a hack, but avoids a breaking change)
    // TODO: Refactor images.ts to return username in processed
    const imagesData = await fetchFromCivitai('/images', params)
    if (imagesData.items && Array.isArray(imagesData.items)) {
      for (const image of imagesData.items) {
        if (image.username)
          allUsernames.add(image.username)
      }
    }

    // Process model references if enabled
    const modelStats = { new: 0, existing: 0, failed: 0, total: 0 }
    const versionStats = { new: 0, existing: 0, failed: 0, total: 0 }
    let insufficientData = 0

    if (args.processModels && allReferences.length > 0) {
      console.log(`Processing ${allReferences.length} model references`)

      for (const ref of allReferences) {
        try {
          if (ref.versionId) {
            versionStats.total++
            const result = await ctx.runAction(api.action.models.fetchAndStoreModelVersion, {
              versionId: ref.versionId,
            })
            if (result && result.success) {
              if (result.storedId && result.storedId !== undefined && result.storedId !== null && result.storedId !== '') {
                if (result.error) {
                  versionStats.failed++
                }
                else if (result.storedId && result.storedId !== undefined && result.storedId !== null && result.storedId !== '') {
                  // We can't distinguish new/existing from here, so rely on mutation logs
                  versionStats.new++ // We'll adjust this below
                }
              }
            }
            else {
              versionStats.failed++
            }
          }
          else if (ref.id) {
            modelStats.total++
            const result = await ctx.runAction(api.action.models.fetchAndStoreModel, {
              modelId: ref.id,
            })
            if (result && result.success) {
              if (result.storedId && result.storedId !== undefined && result.storedId !== null && result.storedId !== '') {
                if (result.error) {
                  modelStats.failed++
                }
                else if (result.storedId && result.storedId !== undefined && result.storedId !== null && result.storedId !== '') {
                  // We can't distinguish new/existing from here, so rely on mutation logs
                  modelStats.new++ // We'll adjust this below
                }
              }
            }
            else {
              modelStats.failed++
            }
          }
          else if (ref.hash) {
            versionStats.total++
            const result = await ctx.runAction(api.action.models.fetchAndStoreModelVersionByHash, {
              hash: ref.hash,
            })
            if (result && result.success) {
              if (result.storedId && result.storedId !== undefined && result.storedId !== null && result.storedId !== '') {
                if (result.error) {
                  versionStats.failed++
                }
                else if (result.storedId && result.storedId !== undefined && result.storedId !== null && result.storedId !== '') {
                  versionStats.new++ // We'll adjust this below
                }
              }
            }
            else {
              versionStats.failed++
            }
          }
          else {
            insufficientData++
            console.warn(`Reference with insufficient data (not processed):`, ref)
          }
        }
        catch (error) {
          if (ref.versionId)
            versionStats.failed++
          else if (ref.id)
            modelStats.failed++
          else insufficientData++
          console.error(`Error processing reference:`, error)
        }
      }
    }

    // Adjust new/existing counts using logs from mutations (Convex logs will show which were new/existing)
    // For now, we just count all as new, but in a real system, you could return isNew from the mutation and aggregate here.

    // Count model references by type
    let checkpointCount = 0
    let loraCount = 0

    allReferences.forEach((ref) => {
      if (ref.type === 'checkpoint')
        checkpointCount++
      if (ref.type === 'lora')
        loraCount++
    })

    const durationMs = Date.now() - startTime

    console.log(`Demo completed in ${durationMs}ms. Processed ${result.totalProcessed} images (${result.newImages} new).`)
    console.log(`Found ${allReferences.length} model references (${checkpointCount} checkpoints, ${loraCount} LoRAs).`)
    console.log(`Processed models:`, modelStats)
    console.log(`Processed model versions:`, versionStats)
    console.log(`Insufficient data references:`, insufficientData)

    return {
      totalImages: result.totalProcessed,
      newImages: result.newImages,
      modelReferencesFound: {
        checkpoints: checkpointCount,
        loras: loraCount,
        total: allReferences.length,
      },
      modelsProcessed: {
        models: modelStats,
        modelVersions: versionStats,
        insufficientData,
      },
      durationMs,
    }
  },
})
