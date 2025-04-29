import type { Doc } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import { extractModelReferences } from '../utils/extractors'
import { Image } from './validators'

export async function createImage(ctx: MutationCtx, apiResult: Doc<'apiResults'>) {
  const { result } = apiResult
  const { id, hash, meta, ...imageData } = Image.parse(JSON.parse(result))

  const models = extractModelReferences(meta ?? {})

  await ctx.db.insert('images', {
    imageId: id,
    ...imageData,
    blurHash: hash,
    totalReactions: imageData.stats.likeCount + imageData.stats.heartCount + imageData.stats.laughCount + imageData.stats.cryCount + imageData.stats.commentCount,
    models,
  })
}
