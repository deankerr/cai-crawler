import type { ImageQueryParams } from './validators'
import { isResponseError, up } from 'up-fetch'
import { z } from 'zod'
import { buildURL } from '../utils/url'
import { CursorMetadata } from './validators'

const baseUrl = 'https://civitai.com/api/v1'
const apiKey = process.env.CIVITAI_API_KEY

const upFetch = up(fetch, () => ({
  headers: {
    Authorization: apiKey ? `Bearer ${apiKey}` : undefined,
  },
  timeout: 10000,
  retry: {
    attempts: 5,
    delay: ctx => ctx.attempt ** 2 * 1000,
  },
}))

export async function fetchImages(args: ImageQueryParams) {
  try {
    const query = buildURL(baseUrl, ['images'], args)

    const result = await upFetch(query, {
      schema: z.object({
        items: z.array(z.object({ id: z.number() }).passthrough()),
        metadata: CursorMetadata,
      }),
    })

    console.debug('fetchImages', { result, query })
    return { result, query }
  }
  catch (err) {
    if (isResponseError(err)) {
      console.error(err.status, err.name, err.message, err.data, err.response.headers)
    }
    throw err
  }
}

// /images
// export const images = internalAction({
//   handler: async (ctx, args: ImageQueryParams) => {
//     const { result, query } = await fetchImages(args)

//     for (const item of result.items) {
//       await ctx.runMutation(internal.civitai.query.insertResult, {
//         query: getPathAndQuery(query),
//         entityType: 'image',
//         entityId: item.id,
//         result: JSON.stringify(item),
//       })
//     }

//     return result.metadata
//   },
// })

// // /models/:modelId
// export const model = internalAction({
//   handler: async (ctx, { modelId }: { modelId: number }) => {
//     const query = buildURL(baseUrl, ['models', modelId])

//     const result = await upFetch(query, {
//       schema: z.object({ id: z.number(), modelVersions: z.array(z.object({ id: z.number() }).passthrough()) }).passthrough(),
//     })

//     // Store the model result
//     await ctx.runMutation(internal.civitai.query.insertResult, {
//       query: getPathAndQuery(query),
//       entityType: 'model',
//       entityId: result.id,
//       result: JSON.stringify(result),
//     })

//     // Store each modelVersion result
//     for (const version of result.modelVersions) {
//       const versionId = z.object({ id: z.number() }).parse(version)
//       await ctx.runMutation(internal.civitai.query.insertResult, {
//         query: getPathAndQuery(query),
//         entityType: 'modelVersion',
//         entityId: versionId.id,
//         parentId: result.id,
//         result: JSON.stringify(version),
//       })
//     }
//   },
// })

// // /model-versions/:versionId
// export const modelVersion = internalAction({
//   handler: async (ctx, { versionId }: { versionId: number }) => {
//     const query = buildURL(baseUrl, ['model-versions', versionId])

//     const result = await upFetch(query, {
//       schema: z.object({ id: z.number() }).passthrough(),
//     })

//     await ctx.runMutation(internal.civitai.query.insertResult, {
//       query: getPathAndQuery(query),
//       entityType: 'modelVersion',
//       entityId: result.id,
//       result: JSON.stringify(result),
//     })
//   },
// })
