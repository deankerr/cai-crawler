import type { ImageQueryParams } from './validators'
import { up } from 'up-fetch'
import { z } from 'zod'
import { internal } from '../_generated/api'
import { internalAction, internalMutation } from '../_generated/server'
import schema from '../schema'
import { CursorMetadata } from './validators'

const apiKey = process.env.CIVITAI_API_KEY

const upFetch = up(fetch, () => ({
  baseUrl: 'https://civitai.com/api/v1',
  headers: {
    Authorization: apiKey ? `Bearer ${apiKey}` : undefined,
  },
  timeout: 10000,
  retry: {
    attempts: 5,
    delay: ctx => ctx.attempt ** 2 * 1000,
  },
}))

function buildQuery(path: string, params: Record<string, any> = {}) {
  const searchParams = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.append(key, String(value))
    }
  })
  searchParams.sort()
  return searchParams.size ? `${path}?${searchParams.toString()}` : path
}

// /images
export const images = internalAction({
  handler: async (ctx, args: ImageQueryParams) => {
    const query = buildQuery('/images', args)

    const result = await upFetch(query, {
      schema: z.object({
        items: z.array(z.object({ id: z.number() }).passthrough()),
        metadata: CursorMetadata,
      }),
    })

    for (const item of result.items) {
      await ctx.runMutation(internal.civitai.query.insertResult, {
        query,
        entityType: 'image',
        entityId: item.id,
        result: JSON.stringify(item),
      })
    }
  },
})

// /models/:modelId
export const model = internalAction({
  handler: async (ctx, { modelId }: { modelId: number }) => {
    const query = buildQuery(`/models/${modelId}`)

    const result = await upFetch(query, {
      schema: z.object({ id: z.number(), modelVersions: z.array(z.object({ id: z.number() }).passthrough()) }).passthrough(),
    })

    // Store the model result
    await ctx.runMutation(internal.civitai.query.insertResult, {
      query,
      entityType: 'model',
      entityId: result.id,
      result: JSON.stringify(result),
    })

    // Store each modelVersion result
    for (const version of result.modelVersions) {
      const versionId = z.object({ id: z.number() }).parse(version)
      await ctx.runMutation(internal.civitai.query.insertResult, {
        query,
        entityType: 'modelVersion',
        entityId: versionId.id,
        parentId: result.id,
        result: JSON.stringify(version),
      })
    }
  },
})

// /model-versions/:versionId
export const modelVersion = internalAction({
  handler: async (ctx, { versionId }: { versionId: number }) => {
    const query = buildQuery(`/model-versions/${versionId}`)

    const result = await upFetch(query, {
      schema: z.object({ id: z.number() }).passthrough(),
    })

    await ctx.runMutation(internal.civitai.query.insertResult, {
      query,
      entityType: 'modelVersion',
      entityId: result.id,
      result: JSON.stringify(result),
    })
  },
})

export const insertResult = internalMutation({
  args: schema.tables.apiResults.validator,
  handler: async (ctx, args) => {
    return await ctx.db.insert('apiResults', args)
  },
})
