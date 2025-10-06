import type { Id } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'
import { asyncMap } from 'convex-helpers'
import { paginationOptsValidator } from 'convex/server'
import { ConvexError, v } from 'convex/values'
import { internal } from './_generated/api'
import { internalMutation, query } from './_generated/server'
import { Image } from './civitai/validators'
import { backlinkProcessedDocument, getEntitySnapshot } from './entitySnapshots'
import { INTERNAL_TAGS } from './tags'
import { extractModelReferences } from './utils/extractors'

export async function getImageByImageId(ctx: QueryCtx, { imageId }: { imageId: number }) {
  return await ctx.db.query('images').withIndex('by_imageId', q => q.eq('imageId', imageId)).first()
}

export async function requireImageByImageId(ctx: QueryCtx, { imageId }: { imageId: number }) {
  const image = await getImageByImageId(ctx, { imageId })
  if (!image)
    throw new ConvexError({ message: 'required', imageId, image })
  return image
}

export const insertImages = internalMutation({
  args: {
    items: v.array(v.object({ entitySnapshotId: v.id('entitySnapshots'), rawData: v.string() })),
  },
  returns: v.any(),
  handler: async (ctx, { items }) => {
    // * ensure untagged tag exists once for the entire batch
    const untaggedTagId: Id<'tags'> = await ctx.runMutation(internal.tags.ensureTag, {
      name: INTERNAL_TAGS.untagged,
      isInternal: true,
    })

    const processedResults = await asyncMap(items, async ({ entitySnapshotId }) => {
      try {
        return await processEntityToImage(ctx, { entitySnapshotId })
      }
      catch (error) {
        return { entitySnapshotId, inserted: false, error }
      }
    })

    const imageEntityPairs = processedResults.filter(e => 'image' in e)

    // * apply untagged tag to newly inserted images (batch)
    const newlyInsertedImages = imageEntityPairs.filter(e => e.inserted)
    if (newlyInsertedImages.length > 0) {
      await asyncMap(newlyInsertedImages, async (result) => {
        await ctx.db.insert('imageTags', {
          imageId: result.image._id,
          tagId: untaggedTagId,
          createdAt: Date.now(),
        })
      })
    }

    await ctx.scheduler.runAfter(0, internal.storage.enqueue, {
      tasks: imageEntityPairs.map(e => ({
        sourceUrl: e.image.url,
        storageKey: e.image.storageKey!,
      })),
    })

    return processedResults
  },
})

async function processEntityToImage(ctx: MutationCtx, { entitySnapshotId }: { entitySnapshotId: Id<'entitySnapshots'> }) {
  const entitySnapshot = await getEntitySnapshot(ctx, entitySnapshotId)
  if (!entitySnapshot)
    throw new ConvexError({ message: 'Invalid entitySnapshotId', entitySnapshotId })

  const parsed = Image.safeParse(JSON.parse(entitySnapshot.rawData))
  if (!parsed.success)
    throw new ConvexError({ message: 'Failed to parse entity as image', entitySnapshotId, error: parsed.error.flatten() })

  const existingImage = await getImageByImageId(ctx, { imageId: parsed.data.id })
  if (existingImage) {
    // * link entitySnapshots which failed to be processed previously
    if (entitySnapshot.processedDocumentId !== existingImage._id) {
      await backlinkProcessedDocument(ctx, { entitySnapshotId, processedDocumentId: existingImage._id })
    }
    // return existing
    return { entitySnapshotId, entitySnapshot, inserted: false, image: existingImage }
  }

  const { id: imageId, hash: blurHash, meta, url, ...imageData } = parsed.data
  const models = extractModelReferences(meta ?? {})
  const storageKey = generateStorageKey('images', imageId)

  // insert new image
  await ctx.db.insert('images', {
    imageId,
    entitySnapshotId,
    url,
    ...imageData,
    blurHash,
    totalReactions: imageData.stats.likeCount + imageData.stats.heartCount + imageData.stats.laughCount + imageData.stats.cryCount + imageData.stats.commentCount,
    models,
    storageKey,
  })

  // enforce imageId uniqueness
  const image = (await ctx.db.query('images').withIndex('by_imageId', q => q.eq('imageId', imageId)).unique())!
  await backlinkProcessedDocument(ctx, { entitySnapshotId, processedDocumentId: image._id })
  return ({ entitySnapshotId, entitySnapshot, inserted: true, image })
}

export function generateStorageKey(contentType: string, id: number): string {
  return `${contentType}/${id}`
}

export const list = query({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  returns: v.any(),
  handler: async (ctx, { paginationOpts }) => {
    return await ctx.db.query('images').order('desc').paginate(paginationOpts)
  },
})

export const get = query({
  args: {
    id: v.id('images'),
  },
  returns: v.union(
    v.object({
      _id: v.id('images'),
      _creationTime: v.number(),
      imageId: v.number(),
      url: v.string(),
      width: v.number(),
      height: v.number(),
      nsfw: v.boolean(),
      nsfwLevel: v.string(),
      createdAt: v.string(),
      postId: v.optional(v.number()),
      blurHash: v.string(),
      username: v.union(v.string(), v.null()),
      storageKey: v.optional(v.string()),
      models: v.array(
        v.object({
          modelId: v.optional(v.number()),
          versionId: v.optional(v.number()),
          type: v.string(),
          name: v.optional(v.string()),
          hash: v.optional(v.string()),
        }),
      ),
      totalReactions: v.number(),
      stats: v.object({
        likeCount: v.number(),
        heartCount: v.number(),
        laughCount: v.number(),
        cryCount: v.number(),
        commentCount: v.number(),
      }),
      entitySnapshotId: v.id('entitySnapshots'),
    }),
    v.null(),
  ),
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id)
  },
})
