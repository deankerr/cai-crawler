import type { ImageQueryParams } from './validators'
import { isResponseError, up } from 'up-fetch'
import { z } from 'zod'
import { buildURL } from '../utils/url'
import { CursorMetadata } from './validators'

export const baseUrl = 'https://civitai.com/api/v1'
const apiKey = process.env.CIVITAI_API_KEY

export const civitaiQuery = up(fetch, () => ({
  headers: {
    Authorization: apiKey ? `Bearer ${apiKey}` : undefined,
  },
  timeout: 60000,
  retry: {
    attempts: 5,
    delay: ctx => ctx.attempt ** 2 * 1000,
  },
}))

export async function fetchImages(args: ImageQueryParams) {
  try {
    const query = buildURL(baseUrl, ['images'], args)

    const result = await civitaiQuery(query, {
      schema: z.object({
        items: z.array(z.object({ id: z.number() }).passthrough()),
        metadata: CursorMetadata,
      }),
    })

    return { result, query }
  }
  catch (err) {
    if (isResponseError(err)) {
      console.error(err.status, err.name, err.message, err.data, err.response.headers)
    }
    throw err
  }
}

export async function fetchCivitaiModelById(modelId: number) {
  const query = buildURL(baseUrl, ['models', modelId])
  const result = await civitaiQuery(query, {
    schema: z.unknown(),
  })
  return result
}

export async function fetchCivitaiModelVersionById(modelVersionId: number) {
  const query = buildURL(baseUrl, ['model-versions', modelVersionId])
  const result = await civitaiQuery(query, {
    schema: z.unknown(),
  })
  return result
}

export async function fetchCivitaiModelVersionByHash(hash: string) {
  const query = buildURL(baseUrl, ['model-versions', 'by-hash'], { hash })
  const result = await civitaiQuery(query, {
    schema: z.unknown(),
  })
  return result
}
