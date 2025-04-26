import type { Id } from '../_generated/dataModel'
import { v } from 'convex/values'
import { api } from '../_generated/api'
import { action } from '../_generated/server'
import { fetchFromCivitai } from '../utils/api'

// Define the return types
interface FetchModelResult {
  modelId: number
  success: boolean
  storedId?: Id<'models'>
  error?: string
}

interface FetchVersionResult {
  versionId: number
  success: boolean
  storedId?: Id<'modelVersions'>
  error?: string
}

/**
 * Fetch and store a model by its ID
 *
 * This action:
 * 1. Fetches model data from Civitai API
 * 2. Stores it in our database if it doesn't exist
 *
 * Handles errors gracefully and returns success/failure info
 */
export const fetchAndStoreModel = action({
  args: {
    modelId: v.number(),
  },
  handler: async (ctx, args): Promise<FetchModelResult> => {
    try {
      // Fetch model data from Civitai API
      const modelData = await fetchFromCivitai(`/models/${args.modelId}`, {})

      if (!modelData || typeof modelData !== 'object') {
        return {
          modelId: args.modelId,
          success: false,
          error: 'Invalid response from Civitai API',
        }
      }

      // Extract relevant data for our database
      const modelRecord = {
        modelId: args.modelId,
        name: modelData.name || 'Unknown',
        description: modelData.description || '',
        type: modelData.type || 'Unknown',
        nsfw: !!modelData.nsfw,
        creatorUsername: modelData.creator?.username || 'unknown',
        stats: {
          downloadCount: modelData.stats?.downloadCount || 0,
          favoriteCount: modelData.stats?.favoriteCount || 0,
          commentCount: modelData.stats?.commentCount || 0,
          ratingCount: modelData.stats?.ratingCount || 0,
          rating: modelData.stats?.rating || 0,
        },
        tags: Array.isArray(modelData.tags) ? modelData.tags : [],
        versionIds: Array.isArray(modelData.modelVersions)
          ? modelData.modelVersions.map((v: any) => v.id).filter(Boolean)
          : [],
        rawData: modelData,
        processedAt: new Date().toISOString(),
      }

      // Store the model using our mutation
      const result = await ctx.runMutation(api.mutations.models.storeModel, {
        modelData: modelRecord,
      })

      return {
        modelId: args.modelId,
        success: true,
        storedId: result.id,
      }
    }
    catch (error) {
      console.error(`Error fetching model ${args.modelId}:`, error)
      return {
        modelId: args.modelId,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  },
})

/**
 * Fetch and store a model version by its ID
 *
 * This action:
 * 1. Fetches model version data from Civitai API
 * 2. Stores it in our database if it doesn't exist
 *
 * Handles errors gracefully and returns success/failure info
 */
export const fetchAndStoreModelVersion = action({
  args: {
    versionId: v.number(),
  },
  handler: async (ctx, args): Promise<FetchVersionResult> => {
    try {
      // Fetch model version data from Civitai API
      const versionData = await fetchFromCivitai(`/model-versions/${args.versionId}`, {})

      if (!versionData || typeof versionData !== 'object') {
        return {
          versionId: args.versionId,
          success: false,
          error: 'Invalid response from Civitai API',
        }
      }

      // Extract relevant data for our database
      const versionRecord = {
        versionId: args.versionId,
        modelId: versionData.modelId || 0,
        name: versionData.name || 'Unknown',
        createdAt: versionData.createdAt || new Date().toISOString(),
        baseModel: versionData.baseModel || 'Unknown',
        files: Array.isArray(versionData.files)
          ? versionData.files.map((file: any) => ({
              id: file.id,
              name: file.name || 'unknown',
              type: file.type || 'unknown',
              sizeKB: file.sizeKB || 0,
              hashes: file.hashes || {},
              downloadUrl: file.downloadUrl || '',
              primary: !!file.primary,
            }))
          : [],
        imageIds: [], // Will be populated later as we process images
        rawData: versionData,
        processedAt: new Date().toISOString(),
      }

      // Store the model version using our mutation
      const result = await ctx.runMutation(api.mutations.modelVersions.storeModelVersion, {
        versionData: versionRecord,
      })

      return {
        versionId: args.versionId,
        success: true,
        storedId: result.id,
      }
    }
    catch (error) {
      console.error(`Error fetching model version ${args.versionId}:`, error)
      return {
        versionId: args.versionId,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  },
})

/**
 * Fetch a model version by hash
 *
 * This action:
 * 1. Fetches model version data from Civitai API using hash
 * 2. Stores it in our database if it doesn't exist
 *
 * Handles errors gracefully and returns success/failure info
 */
export const fetchAndStoreModelVersionByHash = action({
  args: {
    hash: v.string(),
  },
  handler: async (ctx, args): Promise<FetchVersionResult | null> => {
    try {
      // Fetch model version data from Civitai API using hash
      const versionData = await fetchFromCivitai(`/model-versions/by-hash/${args.hash}`, {})

      if (!versionData || typeof versionData !== 'object') {
        console.warn(`No model version found for hash ${args.hash}`)
        return null
      }

      // We have model version data, now store it
      const versionId = versionData.id
      if (!versionId) {
        return {
          versionId: 0,
          success: false,
          error: 'Model version ID not found in response',
        }
      }

      // Extract relevant data for our database
      const versionRecord = {
        versionId,
        modelId: versionData.modelId || 0,
        name: versionData.name || 'Unknown',
        createdAt: versionData.createdAt || new Date().toISOString(),
        baseModel: versionData.baseModel || 'Unknown',
        files: Array.isArray(versionData.files)
          ? versionData.files.map((file: any) => ({
              id: file.id,
              name: file.name || 'unknown',
              type: file.type || 'unknown',
              sizeKB: file.sizeKB || 0,
              hashes: file.hashes || {},
              downloadUrl: file.downloadUrl || '',
              primary: !!file.primary,
            }))
          : [],
        imageIds: [], // Will be populated later as we process images
        rawData: versionData,
        processedAt: new Date().toISOString(),
      }

      // Store the model version
      const result = await ctx.runMutation(api.mutations.modelVersions.storeModelVersion, {
        versionData: versionRecord,
      })

      // If this version has a model, also fetch and store the model
      if (versionData.modelId) {
        await ctx.runAction(api.action.models.fetchAndStoreModel, {
          modelId: versionData.modelId,
        })
      }

      return {
        versionId,
        success: true,
        storedId: result.id,
      }
    }
    catch (error) {
      console.error(`Error fetching model version by hash ${args.hash}:`, error)
      return {
        versionId: 0,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  },
})

/**
 * Fetch and store a creator by username
 *
 * This action:
 * 1. Fetches creator data from Civitai API
 * 2. Stores it in our database if it doesn't exist
 *
 * Handles errors gracefully and returns success/failure info
 */
export const fetchAndStoreCreator = action({
  args: {
    username: v.string(),
  },
  handler: async (ctx, args): Promise<{
    username: string
    success: boolean
    storedId?: Id<'creators'>
    error?: string
  }> => {
    try {
      // Fetch creator data from Civitai API
      const creatorData = await fetchFromCivitai(`/creators/${encodeURIComponent(args.username)}`, {})

      if (!creatorData || typeof creatorData !== 'object') {
        return {
          username: args.username,
          success: false,
          error: 'Invalid response from Civitai API',
        }
      }

      // Extract relevant data for our database
      const creatorRecord = {
        username: creatorData.username,
        image: creatorData.image || undefined,
        modelIds: Array.isArray(creatorData.models) ? creatorData.models.map((m: any) => m.id).filter(Boolean) : [],
        imageIds: [], // To be filled in later if needed
        rawData: creatorData,
        processedAt: new Date().toISOString(),
      }

      // Store the creator using our mutation
      const result = await ctx.runMutation(api.mutations.creators.storeCreator, {
        creatorData: creatorRecord,
      })

      return {
        username: args.username,
        success: true,
        storedId: result.id,
      }
    }
    catch (error) {
      console.error(`Error fetching creator ${args.username}:`, error)
      return {
        username: args.username,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  },
})
