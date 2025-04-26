import type { z } from 'zod'
import { fetchFromCivitai, saveQueryResult } from './base'
import { ModelVersion } from './modelVersionId'

export async function fetchModelVersionByHash(hash: string): Promise<z.infer<typeof ModelVersion>> {
  if (!hash) {
    throw new Error('Invalid hash provided')
  }

  const result = await fetchFromCivitai(`/model-versions/by-hash/${hash}`, {}, ModelVersion)

  // Save the result to a file
  await saveQueryResult(result, `model-version-hash-${hash}.json`)

  return result
}
