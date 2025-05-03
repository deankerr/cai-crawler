import type { Id } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'
import { asyncMap } from 'convex-helpers'
import { ConvexError, v } from 'convex/values'
import { internal } from './_generated/api'
import { internalMutation } from './_generated/server'
import { Image } from './civitai/validators'
import { backlinkProcessedDocument, getEntitySnapshot } from './entitySnapshots'
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
  handler: async (ctx, { items }) => {
    const processedResults = await asyncMap(items, async ({ entitySnapshotId }) => {
      try {
        return await processEntityToImage(ctx, { entitySnapshotId })
      }
      catch (error) {
        return { entitySnapshotId, inserted: false, error }
      }
    })

    const imageEntityPairs = processedResults.filter(e => 'image' in e)

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
