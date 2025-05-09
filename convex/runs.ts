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

export async function createRun(ctx: MutationCtx, args: { url: URL, itemsTarget: number, priority?: number }) {
  const runId = await ctx.db.insert('runs', {
    url: args.url.toString(),
    itemsTarget: args.itemsTarget,
    itemsRead: 0,
    status: 'pending',
    updatedAt: Date.now(),
    priority: args.priority ?? DEFAULT_PRIORITY,
  })

  const workId: string = await pool.enqueueAction(ctx, internal.runs.runCivitaiQuery, {})

  return { runId, workId }
}

// * run instance functions
export const startRunTask = internalMutation({
  handler: async (ctx) => {
    const runs = await ctx.db.query('runs')
      .filter(q => q.eq(q.field('status'), 'pending'))
      .collect()

    // Sort by priority (higher number = higher priority)
    runs.sort((a, b) => b.priority - a.priority)

    // Get the highest priority run
    const nextRun = runs[0]

    // If there are no pending runs, return
    if (!nextRun) {
      return
    }

    // Update its status to in_progress
    await ctx.db.patch(nextRun._id, {
      status: 'in_progress',
      updatedAt: Date.now(),
      finishedAt: undefined,
    })

    return {
      id: nextRun._id,
      url: nextRun.url,
    }
  },
})

export const endRunTask = internalMutation({
  args: {
    runId: v.id('runs'),
    runItemsRead: v.number(),
    nextCursor: v.optional(v.union(v.string(), v.number())),
  },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId)
    if (!run) {
      throw new ConvexError({ message: 'Run not found', runId: args.runId })
    }

    const totalItemsRead = run.itemsRead + args.runItemsRead

    const nextUrl = new URL(run.url)
    if (args.nextCursor) {
      nextUrl.searchParams.set('cursor', args.nextCursor.toString())
    }
    else {
      nextUrl.searchParams.delete('cursor')
    }

    const isComplete = totalItemsRead >= run.itemsTarget || args.runItemsRead === 0 || !args.nextCursor

    const updates = {
      status: isComplete ? 'completed' as const : 'pending' as const,
      itemsRead: totalItemsRead,
      url: nextUrl.toString(),
      updatedAt: Date.now(),
      finishedAt: isComplete ? Date.now() : undefined,
      error: undefined,
    }

    return await ctx.db.patch(args.runId, updates)
  },
})

export const failRunTask = internalMutation({
  args: {
    runId: v.id('runs'),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId)
    if (!run) {
      throw new ConvexError({ message: 'Run not found', runId: args.runId })
    }

    return await ctx.db.patch(args.runId, {
      status: 'failed',
      error: args.error,
      updatedAt: Date.now(),
      finishedAt: Date.now(),
    })
  },
})

// * images run
export const runCivitaiQuery = internalAction({
  handler: async (ctx) => {
    const run = await ctx.runMutation(internal.runs.startRunTask)
    if (!run) {
      console.log('[RUN] No run to process')
      return
    }

    const { items, metadata } = await civitaiQuery(run.url, {
      schema: z.object({
        items: z.array(z.object({ id: z.number() }).passthrough()),
        metadata: CursorMetadata,
      }),
    })

    // Process the items
    const entitySnapshotResults = await ctx.runMutation(internal.entitySnapshots.insertEntitySnapshots, { items: items.map(item => ({
      entityId: item.id,
      entityType: 'image' as const,
      queryKey: getPathAndQuery(run.url),
      rawData: JSON.stringify(item),
    })) })

    const imageResults = await ctx.runMutation(internal.images.insertImages, {
      items: entitySnapshotResults.map(({ entitySnapshotId, rawData }: { entitySnapshotId: Id<'entitySnapshots'>, rawData: string }) => ({
        entitySnapshotId,
        rawData,
      })),
    })

    const imagesCreated = imageResults.filter((r: { inserted: boolean }) => r.inserted).length
    console.log(`[RUN] ${run.url} - ${imagesCreated} images created`)

    await ctx.runMutation(internal.runs.endRunTask, {
      runId: run.id,
      runItemsRead: items.length,
      nextCursor: metadata.nextCursor,
    })

    await pool.enqueueAction(ctx, internal.runs.runCivitaiQuery, {})
  },
})

// * run management
export const startWorker = internalMutation(async (ctx) => {
  const workId: string = await pool.enqueueAction(ctx, internal.runs.runCivitaiQuery, {})
  return workId
})

export const addImagesByModelVersionRun = internalMutation({
  args: {
    modelVersionId: v.number(),
    itemsTarget: v.number(),
    nsfw: v.boolean(),
    sort: vSortOrder,
    period: vTimePeriod,
    priority: v.optional(v.number()),
  },
  handler: async (ctx, { itemsTarget, priority, ...searchParams }) => {
    const url = buildURL(baseUrl, ['images'], searchParams).toString()

    return await createRun(ctx, { url: new URL(url), itemsTarget, priority })
  },
})

export const addImagesByModelRun = internalMutation({
  args: {
    modelId: v.number(),
    itemsTarget: v.number(),
    nsfw: v.boolean(),
    sort: vSortOrder,
    period: vTimePeriod,
    priority: v.optional(v.number()),
  },
  handler: async (ctx, { itemsTarget, priority, ...searchParams }) => {
    const url = buildURL(baseUrl, ['images'], searchParams).toString()

    return await createRun(ctx, { url: new URL(url), itemsTarget, priority })
  },
})

export const addImagesByUsernameRun = internalMutation({
  args: {
    username: v.string(),
    itemsTarget: v.number(),
    nsfw: v.boolean(),
    sort: vSortOrder,
    period: vTimePeriod,
    priority: v.optional(v.number()),
  },
  handler: async (ctx, { itemsTarget, priority, ...searchParams }) => {
    const url = buildURL(baseUrl, ['images'], searchParams).toString()

    return await createRun(ctx, { url: new URL(url), itemsTarget, priority })
  },
})
