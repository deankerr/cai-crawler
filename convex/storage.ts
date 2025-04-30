// import { HeadObjectCommand, S3Client } from '@aws-sdk/client-s3'

// // Configure S3 client to work with R2
// const s3Client = new S3Client({
//   region: 'auto',
//   endpoint: process.env.R2_ENDPOINT,
//   credentials: {
//     accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
//     secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
//   },
// })

// const BUCKET_NAME = process.env.R2_BUCKET_NAME

// /**
//  * Internal helper to check if an asset exists in R2
//  */
// async function checkAssetExists(key: string) {
//   try {
//     const command = new HeadObjectCommand({
//       Bucket: BUCKET_NAME,
//       Key: key,
//     })

//     const result = await s3Client.send(command)

//     return {
//       exists: true,
//       key,
//       contentType: result.ContentType,
//       size: result.ContentLength,
//       lastModified: result.LastModified,
//       etag: result.ETag,
//       url: `https://${BUCKET_NAME}.r2.cloudflarestorage.com/${key}`,
//     }
//   }
//   catch (error) {
//     // If the error is "NotFound", asset doesn't exist
//     if (error && typeof error === 'object' && 'name' in error && error.name === 'NotFound') {
//       return {
//         exists: false,
//         key,
//       }
//     }

//     // For other errors, log and return the error
//     console.error('Error checking asset:', error)
//     return {
//       exists: false,
//       key,
//       error: error instanceof Error ? error.message : String(error),
//     }
//   }
// }

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
