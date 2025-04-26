import { z } from 'zod'
import { fetchFromCivitai, PaginationMetadata, saveQueryResult } from './base'

// Query Parameters Schema
export const CreatorsQueryParams = z.object({
  limit: z.number().min(1).max(100).optional(),
  page: z.number().optional(),
  query: z.string().optional(),
})

// Response Schemas
export const Creator = z.object({
  username: z.string(),
  modelCount: z.number().optional(),
  link: z.string().url(),
  image: z.string().url().nullable(),
})

export const CreatorsResponse = z.object({
  items: z.array(Creator),
  metadata: PaginationMetadata,
})

export type CreatorsQueryParamsType = z.infer<typeof CreatorsQueryParams>
export type CreatorType = z.infer<typeof Creator>
export type CreatorsResponseType = z.infer<typeof CreatorsResponse>

export async function fetchCreators(params?: CreatorsQueryParamsType): Promise<CreatorsResponseType> {
  const queryParams = params ? CreatorsQueryParams.parse(params) : {}
  const result = await fetchFromCivitai('/creators', queryParams, CreatorsResponse)

  // Save the result to a file
  await saveQueryResult(result, 'creators.json')

  return result
}
