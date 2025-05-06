import type { Id } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'
import { asyncMap } from 'convex-helpers'
import { v } from 'convex/values'
import { internalMutation } from './_generated/server'
import schema from './schema'

export async function getEntitySnapshot(ctx: QueryCtx, entitySnapshotId: Id<'entitySnapshots'>) {
  return await ctx.db.get(entitySnapshotId)
}

export const insertEntitySnapshots = internalMutation({
  args: { items: v.array(schema.tables.entitySnapshots.validator) },
  handler: async (ctx, { items }) => {
    const results = await asyncMap(items, async (arg) => {
      const existing = await ctx.db.query('entitySnapshots').withIndex('by_entity', q => q.eq('entityType', arg.entityType).eq('entityId', arg.entityId)).first()
      if (existing) {
        return ({
          ...arg,
          inserted: false,
          entitySnapshotId: existing._id,
        })
      }

      const entitySnapshotId = await ctx.db.insert('entitySnapshots', arg)
      return ({
        ...arg,
        inserted: true,
        entitySnapshotId,
      })
    })

    return results
  },
})

export async function backlinkProcessedDocument(ctx: MutationCtx, { entitySnapshotId, processedDocumentId }: { entitySnapshotId: Id<'entitySnapshots'>, processedDocumentId: string }) {
  await ctx.db.patch(entitySnapshotId, { processedDocumentId })
}
