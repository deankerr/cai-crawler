import { v } from 'convex/values'
import { up } from 'up-fetch'
import { internalAction } from './_generated/server'

const upFetch = up(fetch, () => {
  const workerEnqueueUrl = process.env.ASSETS_WORKER_URL
  const workerSecret = process.env.ASSETS_SECRET

  if (!workerEnqueueUrl || !workerSecret) {
    console.error('Worker enqueue URL or secret not configured in Convex environment.')
  }

  return {
    method: 'POST',
    baseUrl: workerEnqueueUrl,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${workerSecret}`,
      'User-Agent': 'ConvexCivitaiCrawler/1.0',
    },
    timeout: 10000,
    retry: {
      attempts: 5,
      delay: ctx => ctx.attempt ** 2 * 1000,
    },
  }
})

export async function storeAssets(tasks: { sourceUrl: string, storageKey: string }[]) {
  await upFetch('/enqueue', {
    body: { tasks },
  })
}

export const enqueue = internalAction({
  args: v.object({
    tasks: v.array(v.object({
      sourceUrl: v.string(),
      storageKey: v.string(),
    })),
  }),
  handler: async (ctx, args) => {
    await storeAssets(args.tasks)
  },
})
