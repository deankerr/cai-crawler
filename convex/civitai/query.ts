import type { ImageQueryParams } from './validators'
import { z } from 'zod'
import { internal } from '../_generated/api'
import { internalAction, internalMutation } from '../_generated/server'
import schema from '../schema'
import { RawImagesResponse } from './validators'

export const CIVITAI_API_BASE = 'https://civitai.com/api/v1'
const apiKey = process.env.CIVITAI_API_KEY

function createQueryUrl(endpoint: string, params: Record<string, any>) {
  const url = new URL(CIVITAI_API_BASE + endpoint)
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      url.searchParams.append(key, String(value))
    }
  })
  url.searchParams.sort()
  return url
}

function createHeaders() {
  const headers = new Headers()
  headers.set('Content-Type', 'application/json')
  if (apiKey)
    headers.set('Authorization', `Bearer ${apiKey}`)
  return headers
}

export const images = internalAction({
  handler: async (ctx, args: ImageQueryParams) => {
    const url = createQueryUrl('/images', args)
    const response = await fetch(url, { headers: createHeaders() })

    if (!response.ok) {
      throw new Error(`Failed to fetch from Civitai API: ${response.status} ${response.statusText}`)
    }

    const rawResults = RawImagesResponse.parse(await response.json())

    for (const item of rawResults.items) {
      const imageId = z.object({ id: z.number() }).parse(item)
      await ctx.runMutation(internal.civitai.query.appendResult, {
        endpoint: '/images',
        params: url.searchParams.toString(),
        entityType: 'image',
        entityId: imageId.id,
        result: JSON.stringify(item),
      })
    }
  },
})

export const appendResult = internalMutation({
  args: schema.tables.apiResults.validator,
  handler: async (ctx, args) => {
    return await ctx.db.insert('apiResults', args)
  },
})
