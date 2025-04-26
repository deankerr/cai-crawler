import { z } from 'zod'

export const CIVITAI_API_BASE = 'https://civitai.com/api/v1'
export const CIVITAI_API_KEY = Bun.env.CIVITAI_API_KEY

export class CivitaiError extends Error {
  constructor(message: string, public status?: number, public data?: unknown) {
    super(message)
    this.name = 'CivitaiError'
  }
}

export async function fetchFromCivitai<T>(
  endpoint: string,
  params: Record<string, any> = {},
  schema: z.ZodType<T>,
): Promise<T> {
  const searchParams = new URLSearchParams()

  // Convert params to URLSearchParams, skipping undefined values
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      searchParams.append(key, value.toString())
    }
  })

  const queryString = searchParams.toString()
  const url = `${CIVITAI_API_BASE}${endpoint}${queryString ? `?${queryString}` : ''}`
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (CIVITAI_API_KEY) {
    headers.Authorization = `Bearer ${CIVITAI_API_KEY}`
  }

  console.log(`GET ${url}`)
  const response = await fetch(url, { headers })

  if (!response.ok) {
    throw new CivitaiError(
      `Failed to fetch from ${endpoint}: ${response.statusText}`,
      response.status,
      await response.json().catch(() => undefined),
    )
  }

  const data = await response.json()
  console.log(data)
  return schema.parse(data)
}

// Common schemas that can be reused across endpoints
export const ModelType = z.enum([
  'Checkpoint',
  'TextualInversion',
  'Hypernetwork',
  'AestheticGradient',
  'LORA',
  'Controlnet',
  'Poses',
])

export const FileMetadata = z.object({
  fp: z.enum(['fp16', 'fp32']).nullable().optional(),
  size: z.enum(['full', 'pruned']).nullable().optional(),
  format: z.enum(['SafeTensor', 'PickleTensor', 'Other']).optional(),
})

export const ModelFile = z.object({
  name: z.string(),
  id: z.number(),
  sizeKB: z.number(),
  type: z.string(),
  metadata: FileMetadata.optional(),
  pickleScanResult: z.string(),
  pickleScanMessage: z.string().optional(),
  virusScanResult: z.string(),
  scannedAt: z.string().datetime().nullable(),
  hashes: z.record(z.string(), z.string()).optional(),
  downloadUrl: z.string().url(),
  primary: z.boolean().optional(),
})

export const ImageMeta = z.record(z.string(), z.unknown()).nullable()

export const ModelImage = z.object({
  url: z.string().url(),
  nsfw: z.boolean().optional(),
  width: z.number(),
  height: z.number(),
  hash: z.string(),
  meta: ImageMeta.optional(),
})

export const ModelStats = z.object({
  downloadCount: z.number(),
  favoriteCount: z.number().optional(),
  commentCount: z.number().optional(),
  ratingCount: z.number(),
  rating: z.number(),
})

export const ModelVersionStats = z.object({
  downloadCount: z.number(),
  ratingCount: z.number(),
  rating: z.number(),
})

export const Creator = z.object({
  username: z.string(),
  image: z.string().url().nullable(),
})

export const PaginationMetadata = z.object({
  totalItems: z.number().optional(),
  currentPage: z.number().optional(),
  pageSize: z.number().optional(),
  totalPages: z.number().optional(),
  nextPage: z.string().url().optional(),
  prevPage: z.string().url().optional(),
  nextCursor: z.string().optional(),
})

export const CursorMetadata = z.object({
  nextCursor: z.string().optional(),
  currentPage: z.number().optional(),
  pageSize: z.number().optional(),
  nextPage: z.string().url().optional(),
})

// Helper function to save query results to a file
export async function saveQueryResult<T>(data: T, filename: string): Promise<void> {
  // Create output directory if it doesn't exist
  try {
    // Use Bun.write which will create directories as needed
    await Bun.write(`demo/demo-query-client/output/${filename}`, JSON.stringify(data, null, 2))
    console.log(`Saved query result to output/${filename}`)
  }
  catch (error) {
    console.error(`Failed to save query result: ${error}`)
    throw error
  }
}
