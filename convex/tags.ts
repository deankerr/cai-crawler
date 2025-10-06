import type { Id } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'
import { asyncMap } from 'convex-helpers'
import { paginationOptsValidator } from 'convex/server'
import { ConvexError, v } from 'convex/values'
import { internal } from './_generated/api'
import { internalMutation, mutation, query } from './_generated/server'
import { migrations } from './migrations'

export const INTERNAL_TAGS = {
  untagged: '_untagged',
}

// * helper functions

async function getTagByName(ctx: QueryCtx, { name }: { name: string }) {
  return await ctx.db
    .query('tags')
    .withIndex('by_name', q => q.eq('name', name.toLowerCase()))
    .first()
}

async function ensureTagByName(ctx: MutationCtx, { name, isInternal = false }: { name: string, isInternal?: boolean }) {
  const normalizedName = name.trim().toLowerCase()
  const existing = await getTagByName(ctx, { name: normalizedName })

  if (existing) {
    return existing._id
  }

  const tagId: Id<'tags'> = await ctx.runMutation(internal.tags.createTag, {
    name: normalizedName,
    isInternal,
  })

  return tagId
}

async function getImageTagRelationship(ctx: QueryCtx, { imageId, tagId }: { imageId: Id<'images'>, tagId: Id<'tags'> }) {
  return await ctx.db
    .query('imageTags')
    .withIndex('by_imageId_and_tagId', q => q.eq('imageId', imageId).eq('tagId', tagId))
    .first()
}

async function getUserTagsForImage(ctx: QueryCtx, { imageId }: { imageId: Id<'images'> }) {
  const relationships = await ctx.db
    .query('imageTags')
    .withIndex('by_imageId', q => q.eq('imageId', imageId))
    .collect()

  // filter out internal tags
  const tags = await asyncMap(relationships, async (rel) => {
    return await ctx.db.get(rel.tagId)
  })

  return tags.filter(tag => tag && !tag.isInternal)
}

async function createRelationship(ctx: MutationCtx, { imageId, tagId }: { imageId: Id<'images'>, tagId: Id<'tags'> }) {
  // check if relationship already exists (idempotent)
  const existing = await getImageTagRelationship(ctx, { imageId, tagId })
  if (existing) {
    return null
  }

  // create relationship
  await ctx.db.insert('imageTags', {
    imageId,
    tagId,
    createdAt: Date.now(),
  })

  // remove "untagged" tag if present
  const untaggedTagId = await ensureTagByName(ctx, { name: INTERNAL_TAGS.untagged, isInternal: true })
  const untaggedRelationship = await getImageTagRelationship(ctx, {
    imageId,
    tagId: untaggedTagId,
  })
  if (untaggedRelationship) {
    await ctx.db.delete(untaggedRelationship._id)
  }

  return true
}

async function deleteRelationship(ctx: MutationCtx, { imageId, tagId }: { imageId: Id<'images'>, tagId: Id<'tags'> }) {
  const relationship = await getImageTagRelationship(ctx, { imageId, tagId })
  if (!relationship) {
    return null
  }

  await ctx.db.delete(relationship._id)

  // check if this was the last user tag
  const userTags = await getUserTagsForImage(ctx, { imageId })

  if (userTags.length === 0) {
    // add "untagged" tag
    const untaggedTagId = await ensureTagByName(ctx, { name: INTERNAL_TAGS.untagged, isInternal: true })
    const existing = await getImageTagRelationship(ctx, {
      imageId,
      tagId: untaggedTagId,
    })
    if (!existing) {
      await ctx.db.insert('imageTags', {
        imageId,
        tagId: untaggedTagId,
        createdAt: Date.now(),
      })
    }
  }

  return true
}

// * tag management

export const createTag = internalMutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    color: v.optional(v.string()),
    isInternal: v.boolean(),
  },
  returns: v.id('tags'),
  handler: async (ctx, args) => {
    const normalizedName = args.name.trim().toLowerCase()

    if (!normalizedName) {
      throw new ConvexError({ message: 'Tag name cannot be empty' })
    }

    if (normalizedName.length > 50) {
      throw new ConvexError({ message: 'Tag name must be 50 characters or less' })
    }

    const existing = await getTagByName(ctx, { name: normalizedName })
    if (existing) {
      throw new ConvexError({ message: 'Tag with this name already exists', name: normalizedName })
    }

    const now = Date.now()
    const tagId: Id<'tags'> = await ctx.db.insert('tags', {
      name: normalizedName,
      description: args.description,
      color: args.color,
      isInternal: args.isInternal,
      createdAt: now,
      updatedAt: now,
    })

    return tagId
  },
})

export const ensureTag = internalMutation({
  args: {
    name: v.string(),
    isInternal: v.boolean(),
  },
  returns: v.id('tags'),
  handler: async (ctx, args) => {
    return await ensureTagByName(ctx, args)
  },
})

export const listTags = query({
  args: {
    includeInternal: v.boolean(),
  },
  handler: async (ctx, args) => {
    const allTags = await ctx.db.query('tags').collect()

    const filteredTags = args.includeInternal
      ? allTags
      : allTags.filter(tag => !tag.isInternal)

    // sort by name
    filteredTags.sort((a, b) => a.name.localeCompare(b.name))

    return filteredTags
  },
})

export const renameTag = mutation({
  args: {
    tagId: v.id('tags'),
    newName: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const tag = await ctx.db.get(args.tagId)

    if (!tag) {
      throw new ConvexError({ message: 'Tag not found', tagId: args.tagId })
    }

    if (tag.isInternal) {
      throw new ConvexError({ message: 'Cannot rename internal tags' })
    }

    const normalizedName = args.newName.trim().toLowerCase()

    if (!normalizedName) {
      throw new ConvexError({ message: 'Tag name cannot be empty' })
    }

    if (normalizedName.length > 50) {
      throw new ConvexError({ message: 'Tag name must be 50 characters or less' })
    }

    // check for conflicts (excluding current tag)
    const existing = await getTagByName(ctx, { name: normalizedName })
    if (existing && existing._id !== args.tagId) {
      throw new ConvexError({ message: 'Tag with this name already exists', name: normalizedName })
    }

    await ctx.db.patch(args.tagId, {
      name: normalizedName,
      updatedAt: Date.now(),
    })

    return null
  },
})

export const deleteTag = mutation({
  args: {
    tagId: v.id('tags'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const tag = await ctx.db.get(args.tagId)

    if (!tag) {
      throw new ConvexError({ message: 'Tag not found', tagId: args.tagId })
    }

    if (tag.isInternal) {
      throw new ConvexError({ message: 'Cannot delete internal tags' })
    }

    // delete all imageTags relationships using the helper
    const relationships = await ctx.db
      .query('imageTags')
      .withIndex('by_tagId', q => q.eq('tagId', args.tagId))
      .collect()

    for (const relationship of relationships) {
      await deleteRelationship(ctx, { imageId: relationship.imageId, tagId: args.tagId })
    }

    // delete the tag
    await ctx.db.delete(args.tagId)

    return null
  },
})

// * image-tag relationships

export const addTagToImage = mutation({
  args: {
    imageId: v.id('images'),
    tagName: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // verify image exists
    const image = await ctx.db.get(args.imageId)
    if (!image) {
      throw new ConvexError({ message: 'Image not found', imageId: args.imageId })
    }

    // ensure tag exists (create if needed)
    const tagId: Id<'tags'> = await ensureTagByName(ctx, {
      name: args.tagName,
      isInternal: false,
    })

    // create relationship (handles idempotency and untagged logic)
    await createRelationship(ctx, { imageId: args.imageId, tagId })

    return null
  },
})

export const removeTagFromImage = mutation({
  args: {
    imageId: v.id('images'),
    tagId: v.id('tags'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // delete relationship (handles untagged logic)
    await deleteRelationship(ctx, { imageId: args.imageId, tagId: args.tagId })

    return null
  },
})

export const getImageTags = query({
  args: {
    imageId: v.id('images'),
  },
  handler: async (ctx, args) => {
    const userTags = await getUserTagsForImage(ctx, { imageId: args.imageId })
    return userTags
  },
})

export const getTaggedImages = query({
  args: {
    tagId: v.id('tags'),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    // verify tag exists
    const tag = await ctx.db.get(args.tagId)
    if (!tag) {
      throw new ConvexError({ message: 'Tag not found', tagId: args.tagId })
    }

    // paginate through imageTags relationships for this tag
    const relationshipsPage = await ctx.db
      .query('imageTags')
      .withIndex('by_tagId', q => q.eq('tagId', args.tagId))
      .order('desc')
      .paginate(args.paginationOpts)

    // get the actual image documents for these relationships
    const images = await asyncMap(relationshipsPage.page, async (rel) => {
      return await ctx.db.get(rel.imageId)
    })

    // filter out any null images (shouldn't happen but defensive)
    const validImages = images.filter((img): img is NonNullable<typeof img> => img !== null)

    // return the paginated result with page replaced
    return {
      ...relationshipsPage,
      page: validImages,
    }
  },
})

// * batch operations

const migrate_applyUntagged_tagId = 'jx71rdyygcfxckxmqdddpach4n7ryfnx' as Id<'tags'>
export const migrate_applyUntagged = migrations.define({
  table: 'images',
  migrateOne: async (ctx, doc) => {
    await ctx.db.insert('imageTags', { imageId: doc._id, tagId: migrate_applyUntagged_tagId, createdAt: Date.now() })
  },
})
