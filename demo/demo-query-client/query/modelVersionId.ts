import { z } from 'zod'
import {
  fetchFromCivitai,
  ModelFile,
  ModelImage,
  ModelType,
  ModelVersionStats,
  saveQueryResult,
} from './base'

// Response Schema
export const ModelVersionModel = z.object({
  name: z.string(),
  type: ModelType,
  nsfw: z.boolean(),
  poi: z.boolean().optional(),
  mode: z.enum(['Archived', 'TakenDown']).nullable().optional(),
})

export const ModelVersion = z.object({
  id: z.number(),
  modelId: z.number(),
  name: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().optional(),
  trainedWords: z.array(z.string()).optional(),
  baseModel: z.string().optional(),
  earlyAccessTimeFrame: z.number().optional(),
  description: z.string().nullable(),
  stats: ModelVersionStats,
  model: ModelVersionModel,
  files: z.array(ModelFile),
  images: z.array(ModelImage),
  downloadUrl: z.string().url(),
})

export type ModelVersionType = z.infer<typeof ModelVersion>

export async function fetchModelVersionById(modelVersionId: number): Promise<ModelVersionType> {
  if (!modelVersionId || Number.isNaN(modelVersionId)) {
    throw new Error('Invalid modelVersionId provided')
  }

  const result = await fetchFromCivitai(`/model-versions/${modelVersionId}`, {}, ModelVersion)

  // Save the result to a file
  await saveQueryResult(result, `model-version-${modelVersionId}.json`)

  return result
}
