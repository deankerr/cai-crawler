import { z } from 'zod'
import { ImageMeta as BaseImageMeta, CursorMetadata, fetchFromCivitai, saveQueryResult } from './base'

// Query Parameters Schema
export const NSFWLevel = z.enum(['None', 'Soft', 'Mature', 'X'])
export const SortOrder = z.enum(['Most Reactions', 'Most Comments', 'Newest'])
export const TimePeriod = z.enum(['AllTime', 'Year', 'Month', 'Week', 'Day'])

export const ImageQueryParams = z.object({
  limit: z.number().min(0).max(200).optional(),
  postId: z.number().optional(),
  modelId: z.number().optional(),
  modelVersionId: z.number().optional(),
  username: z.string().optional(),
  nsfw: z.union([z.boolean(), NSFWLevel]).optional(),
  sort: SortOrder.optional(),
  period: TimePeriod.optional(),
  page: z.number().optional(),
})

// Response Schemas
export const ImageStats = z.object({
  cryCount: z.number(),
  laughCount: z.number(),
  likeCount: z.number(),
  heartCount: z.number(),
  commentCount: z.number(),
})

export const Image = z.object({
  id: z.number(),
  url: z.string().url(),
  hash: z.string(),
  width: z.number(),
  height: z.number(),
  nsfw: z.boolean(),
  nsfwLevel: NSFWLevel,
  createdAt: z.string().datetime(),
  postId: z.number(),
  stats: ImageStats,
  meta: BaseImageMeta,
  username: z.string(),
})

export const ImagesResponse = z.object({
  items: z.array(Image),
  metadata: CursorMetadata,
})

export type ImageQueryParamsType = z.infer<typeof ImageQueryParams>
export type ImageType = z.infer<typeof Image>
export type ImagesResponseType = z.infer<typeof ImagesResponse>

export async function fetchImages(params?: ImageQueryParamsType): Promise<ImagesResponseType> {
  const queryParams = params ? ImageQueryParams.parse(params) : {}
  const result = await fetchFromCivitai('/images', queryParams, ImagesResponse)

  // Save the result to a file
  await saveQueryResult(result, 'images.json')

  return result
}
