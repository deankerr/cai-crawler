import { HeadObjectCommand, /* PutObjectCommand, */ S3Client } from '@aws-sdk/client-s3'
import { v } from 'convex/values'
import { action } from './_generated/server'

// Configure S3 client to work with R2
const s3Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
})

const BUCKET_NAME = process.env.R2_BUCKET_NAME || 'civitai-images'

/**
 * Internal helper to check if an asset exists in R2
 */
async function checkAssetExists(key: string) {
  try {
    const command = new HeadObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    })

    const result = await s3Client.send(command)

    return {
      exists: true,
      key,
      contentType: result.ContentType,
      size: result.ContentLength,
      lastModified: result.LastModified,
      etag: result.ETag,
      url: `https://${BUCKET_NAME}.r2.cloudflarestorage.com/${key}`,
    }
  }
  catch (error) {
    // If the error is "NotFound", asset doesn't exist
    if (error && typeof error === 'object' && 'name' in error && error.name === 'NotFound') {
      return {
        exists: false,
        key,
      }
    }

    // For other errors, log and return the error
    console.error('Error checking asset:', error)
    return {
      exists: false,
      key,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Check if an asset exists in R2 storage
 * @param key - The storage key to check
 * @returns Object with exists status and metadata if found
 */
export const checkAsset = action({
  args: {
    key: v.string(),
  },
  handler: async (ctx, { key }) => {
    return await checkAssetExists(key)
  },
})

// Removed storeAsset action as it's now handled by the Cloudflare Worker
/*
export const storeAsset = action({
  args: {
    key: v.string(),
    sourceUrl: v.string(),
    skipIfExists: v.optional(v.boolean()),
  },
  handler: async (ctx, { key, sourceUrl, skipIfExists = false }) => {
    // ... implementation removed ...
  },
})
*/

/**
 * Generate a storage key for a specific content type and ID
 *
 * @param contentType - The type of content (e.g., 'images', 'models')
 * @param id - The entity ID (using number here based on previous code, ensure consistency with imageId type)
 * @returns A storage key for R2
 */
export function generateStorageKey(contentType: string, id: number): string {
  // Consider if the ID should be string to align with Convex _id type if needed
  return `${contentType}/${id}`
}
