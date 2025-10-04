import type { Id } from './_generated/dataModel'
import type { MutationCtx } from './_generated/server'
import { Workpool } from '@convex-dev/workpool'
import { ConvexError, v } from 'convex/values'
import { z } from 'zod'
import { components, internal } from './_generated/api'
import { internalAction, internalMutation } from './_generated/server'
import { baseUrl, civitaiQuery } from './civitai/query'
import { CursorMetadata } from './civitai/validators'
import { buildURL, getPathAndQuery } from './utils/url'
import { vSortOrder, vTimePeriod } from './validators'

const pool = new Workpool(components.civitaiWorkpool, {
  retryActionsByDefault: true,
  defaultRetryBehavior: { maxAttempts: 10, initialBackoffMs: 1000, base: 2 },
  maxParallelism: 1,
})

const DEFAULT_PRIORITY = 10

export async function insertQuery(ctx: MutationCtx, args: { url: URL, limit: number, priority?: number }) {
  const queryId = await ctx.db.insert('queries', {
    url: args.url.toString(),
    limit: args.limit,
    count: 0,
    status: 'pending',
    updatedAt: Date.now(),
    priority: args.priority ?? DEFAULT_PRIORITY,
  })

  const workId: string = await pool.enqueueAction(ctx, internal.tasks.worker, {})

  return { queryId, workId }
}

// * task worker runtime mutations
export const startTask = internalMutation({
  handler: async (ctx) => {
    const queries = await ctx.db.query('queries')
      .filter(q => q.eq(q.field('status'), 'pending'))
      .collect()

    // Sort by priority (higher number = higher priority)
    queries.sort((a, b) => b.priority - a.priority)

    // Get the highest priority query
    const nextQuery = queries[0]

    // all tasks finished
    if (!nextQuery) {
      return
    }

    // Update its status to in_progress
    await ctx.db.patch(nextQuery._id, {
      status: 'in_progress',
      updatedAt: Date.now(),
    })

    return {
      id: nextQuery._id,
      url: nextQuery.url,
    }
  },
})

export const endTask = internalMutation({
  args: {
    queryId: v.id('queries'),
    count: v.number(),
    nextCursor: v.optional(v.union(v.string(), v.number())),
  },
  handler: async (ctx, args) => {
    const query = await ctx.db.get(args.queryId)
    if (!query) {
      throw new ConvexError({ message: 'Query not found', queryId: args.queryId })
    }

    const nextUrl = new URL(query.url)
    if (args.nextCursor) {
      nextUrl.searchParams.set('cursor', args.nextCursor.toString())
    }
    else {
      nextUrl.searchParams.delete('cursor')
    }

    const newCount = query.count + args.count
    const isComplete = newCount >= query.limit || args.count === 0 || !args.nextCursor

    const updates = {
      status: isComplete ? 'completed' as const : 'pending' as const,
      count: newCount,
      url: nextUrl.toString(),
      updatedAt: Date.now(),
      error: undefined,
    }

    return await ctx.db.patch(args.queryId, updates)
  },
})

export const failTask = internalMutation({
  args: {
    queryId: v.id('queries'),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    const query = await ctx.db.get(args.queryId)
    if (!query) {
      throw new ConvexError({ message: 'Query not found', queryId: args.queryId })
    }

    return await ctx.db.patch(args.queryId, {
      status: 'failed',
      error: args.error,
      updatedAt: Date.now(),
    })
  },
})

// * task worker
export const worker = internalAction({
  handler: async (ctx) => {
    const query = await ctx.runMutation(internal.tasks.startTask)
    if (!query) {
      console.log('[QUERY] No query to process')
      return
    }

    const { items, metadata } = await civitaiQuery(query.url, {
      schema: z.object({
        items: z.array(z.object({ id: z.number() }).passthrough()),
        metadata: CursorMetadata,
      }),
    })

    // Process the items
    const entitySnapshotResults = await ctx.runMutation(internal.entitySnapshots.insertEntitySnapshots, { items: items.map(item => ({
      entityId: item.id,
      entityType: 'image' as const,
      queryKey: getPathAndQuery(query.url),
      rawData: JSON.stringify(item),
    })) })

    const imageResults = await ctx.runMutation(internal.images.insertImages, {
      items: entitySnapshotResults.map(({ entitySnapshotId, rawData }: { entitySnapshotId: Id<'entitySnapshots'>, rawData: string }) => ({
        entitySnapshotId,
        rawData,
      })),
    })

    const imagesCreated = imageResults.filter((r: { inserted: boolean }) => r.inserted).length
    console.log(`[QUERY] ${query.url} - ${imagesCreated} images created`)

    await ctx.runMutation(internal.tasks.endTask, {
      queryId: query.id,
      count: items.length,
      nextCursor: metadata.nextCursor,
    })

    await pool.enqueueAction(ctx, internal.tasks.worker, {})
  },
})

// * manual worker start for debugging
export const forceStartWorker = internalMutation(async (ctx) => {
  const workId: string = await pool.enqueueAction(ctx, internal.tasks.worker, {})
  return workId
})

// * query management
export const addImagesByModelVersionQuery = internalMutation({
  args: {
    modelVersionId: v.number(),
    limit: v.number(),
    nsfw: v.boolean(),
    sort: vSortOrder,
    period: vTimePeriod,
    priority: v.optional(v.number()),
  },
  handler: async (ctx, { limit, priority, ...searchParams }) => {
    const url = buildURL(baseUrl, ['images'], searchParams).toString()
    return await insertQuery(ctx, { url: new URL(url), limit, priority })
  },
})

export const addImagesByModelQuery = internalMutation({
  args: {
    modelId: v.number(),
    limit: v.number(),
    nsfw: v.boolean(),
    sort: vSortOrder,
    period: vTimePeriod,
    priority: v.optional(v.number()),
  },
  handler: async (ctx, { limit, priority, ...searchParams }) => {
    const url = buildURL(baseUrl, ['images'], searchParams).toString()
    return await insertQuery(ctx, { url: new URL(url), limit, priority })
  },
})

export const addImagesByUsernameQuery = internalMutation({
  args: {
    username: v.string(),
    limit: v.number(),
    nsfw: v.boolean(),
    sort: vSortOrder,
    period: vTimePeriod,
    priority: v.optional(v.number()),
  },
  handler: async (ctx, { limit, priority, ...searchParams }) => {
    const url = buildURL(baseUrl, ['images'], searchParams).toString()
    return await insertQuery(ctx, { url: new URL(url), limit, priority })
  },
})

export const addImagesMonthlyTopQuery = internalMutation({
  args: {
    limit: v.number(),
    priority: v.optional(v.number()),
  },
  handler: async (ctx, { limit, priority }) => {
    const url = buildURL(baseUrl, ['images'], {
      nsfw: true,
      sort: 'Most Collected',
      period: 'Month',
    }).toString()
    return await insertQuery(ctx, { url: new URL(url), limit, priority })
  },
})
