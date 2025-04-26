import { z } from 'zod'
import { fetchFromCivitai, PaginationMetadata, saveQueryResult } from './base'

// Query Parameters Schema
export const TagsQueryParams = z.object({
  limit: z.number().min(1).max(100).optional(),
  page: z.number().optional(),
  query: z.string().optional(),
  type: z.enum(['Character', 'Style', 'General']).optional(),
})

// Response Schemas
export const Tag = z.object({
  name: z.string(),
  modelCount: z.number().optional(),
  link: z.string().url().optional(),
  type: z.enum(['Character', 'Style', 'General']).optional(),
})

export const TagsResponse = z.object({
  items: z.array(Tag),
  metadata: PaginationMetadata,
})

export type TagsQueryParamsType = z.infer<typeof TagsQueryParams>
export type TagType = z.infer<typeof Tag>
export type TagsResponseType = z.infer<typeof TagsResponse>

export async function fetchTags(params?: TagsQueryParamsType): Promise<TagsResponseType> {
  const queryParams = params ? TagsQueryParams.parse(params) : {}
  const result = await fetchFromCivitai('/tags', queryParams, TagsResponse)

  // Save the result to a file
  await saveQueryResult(result, 'tags.json')

  return result
}
