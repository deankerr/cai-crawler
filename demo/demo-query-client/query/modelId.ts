import { z } from 'zod'
import { fetchFromCivitai, saveQueryResult } from './base'
import { Model as BaseModel } from './models'

// Create a modified version of the Model schema with description field optional in modelVersions
const ModelVersion = z.object({
  id: z.number(),
  modelId: z.number().optional(),
  name: z.string(),
  description: z.string().nullable().optional(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
  trainedWords: z.array(z.string()).optional(),
  baseModel: z.string().optional(),
  earlyAccessTimeFrame: z.number().optional(),
  downloadUrl: z.string().url(),
  stats: z.any(),
  files: z.array(z.any()),
  images: z.array(z.any()),
})

// Create a modified version of the Model schema
const Model = BaseModel.extend({
  modelVersions: z.array(ModelVersion),
})

export async function fetchModelById(modelId: number): Promise<z.infer<typeof Model>> {
  if (!modelId || Number.isNaN(modelId)) {
    throw new Error('Invalid modelId provided')
  }

  const result = await fetchFromCivitai(`/models/${modelId}`, {}, Model)

  // Save the result to a file
  await saveQueryResult(result, `model-${modelId}.json`)

  return result
}
