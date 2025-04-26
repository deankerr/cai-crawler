import { z } from 'zod'
import {
  Creator,
  fetchFromCivitai,
  ModelFile,
  ModelImage,
  ModelStats,
  ModelType,
  ModelVersionStats,
  PaginationMetadata,
  saveQueryResult,
} from './base'

// Query Parameters Schema
export const ModelSort = z.enum(['Highest Rated', 'Most Downloaded', 'Newest'])
export const TimePeriod = z.enum(['AllTime', 'Year', 'Month', 'Week', 'Day'])
export const CommercialUse = z.enum(['None', 'Image', 'Rent', 'Sell']).or(z.array(z.string()))

export const ModelsQueryParams = z.object({
  limit: z.number().min(1).max(100).optional(),
  page: z.number().optional(),
  query: z.string().optional(),
  tag: z.string().optional(),
  username: z.string().optional(),
  types: z.array(ModelType).optional(),
  sort: ModelSort.optional(),
  period: TimePeriod.optional(),
  rating: z.number().optional(),
  favorites: z.boolean().optional(),
  hidden: z.boolean().optional(),
  primaryFileOnly: z.boolean().optional(),
  allowNoCredit: z.boolean().optional(),
  allowDerivatives: z.boolean().optional(),
  allowDifferentLicenses: z.boolean().optional(),
  allowCommercialUse: CommercialUse.optional(),
  nsfw: z.boolean().optional(),
  supportsGeneration: z.boolean().optional(),
})

// Response Schemas
export const Tag = z.object({
  name: z.string(),
})

export const ModelMode = z.enum(['Archived', 'TakenDown']).nullable()

export const ModelVersion = z.object({
  id: z.number(),
  modelId: z.number().optional(),
  name: z.string(),
  description: z.string().nullable(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
  trainedWords: z.array(z.string()).optional(),
  baseModel: z.string().optional(),
  earlyAccessTimeFrame: z.number().optional(),
  downloadUrl: z.string().url(),
  stats: ModelVersionStats,
  files: z.array(ModelFile),
  images: z.array(ModelImage),
})

export const Model = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string(),
  type: ModelType,
  poi: z.boolean().optional(),
  nsfw: z.boolean(),
  allowNoCredit: z.boolean().optional(),
  allowCommercialUse: CommercialUse.optional(),
  allowDerivatives: z.boolean().optional(),
  allowDifferentLicense: z.boolean().optional(),
  stats: ModelStats,
  creator: Creator,
  tags: z.array(Tag).or(z.array(z.string())),
  mode: ModelMode.optional(),
  modelVersions: z.array(ModelVersion),
})

export const ModelsResponse = z.object({
  items: z.array(Model),
  metadata: PaginationMetadata,
})

export type ModelsQueryParamsType = z.infer<typeof ModelsQueryParams>
export type ModelsResponseType = z.infer<typeof ModelsResponse>

export async function fetchModels(params?: ModelsQueryParamsType): Promise<ModelsResponseType> {
  const queryParams = params ? ModelsQueryParams.parse(params) : {}

  // Handle types array parameter by converting to a string for the API
  if (queryParams.types && Array.isArray(queryParams.types)) {
    const typesString = queryParams.types.join(',')
    // @ts-expect-error - We're manually handling this conversion for the API
    queryParams.types = typesString
  }

  const result = await fetchFromCivitai('/models', queryParams, ModelsResponse)

  // Save the result to a file
  await saveQueryResult(result, 'models.json')

  return result
}
