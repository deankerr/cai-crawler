import { v } from 'convex/values'
import { up } from 'up-fetch'
import { internalAction } from './_generated/server'

const BATCH_SIZE = 100 // Maximum 100 items per request

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
    timeout: 60000,
    retry: {
      attempts: 5,
      delay: ctx => ctx.attempt ** 2 * 1000,
    },
  }
})

export const enqueue = internalAction({
  args: v.object({
    tasks: v.array(v.object({
      sourceUrl: v.string(),
      storageKey: v.string(),
    })),
  }),
  handler: async (ctx, { tasks }) => {
    const batches = []

    // Split tasks into batches of 100
    for (let i = 0; i < tasks.length; i += BATCH_SIZE) {
      const batch = tasks.slice(i, i + BATCH_SIZE)
      batches.push(batch)
    }

    // Process all batches in parallel
    const results = await Promise.allSettled(
      batches.map(async (batchTasks) => {
        await upFetch('/enqueue', {
          body: { tasks: batchTasks },
        })
        return batchTasks.length
      }),
    )

    for (const result of results) {
      if (result.status !== 'fulfilled') {
        console.error('[STORAGE] Error enqueuing tasks:', result.reason)
      }
    }
  },
})
