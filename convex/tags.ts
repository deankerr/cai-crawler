import type { Id } from './_generated/dataModel'
import type { QueryCtx } from './_generated/server'
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

async function getImageTagRelationship(ctx: QueryCtx, { imageId, tagId }: { imageId: Id<'images'>, tagId: Id<'tags'> }) {
  return await ctx.db
    .query('imageTags')
    .withIndex('by_imageId_and_tagId', q => q.eq('imageId', imageId).eq('tagId', tagId))
    .first()
}

async function countImagesByTag(ctx: QueryCtx, { tagId }: { tagId: Id<'tags'> }) {
  const relationships = await ctx.db
    .query('imageTags')
    .withIndex('by_tagId', q => q.eq('tagId', tagId))
    .collect()
  return relationships.length
}

async function getImageTagCount(ctx: QueryCtx, { imageId }: { imageId: Id<'images'> }) {
  const relationships = await ctx.db
    .query('imageTags')
    .withIndex('by_imageId', q => q.eq('imageId', imageId))
    .collect()

  // filter out internal tags
  const tags = await asyncMap(relationships, async (rel) => {
    return await ctx.db.get(rel.tagId)
  })

  return tags.filter(tag => tag && !tag.isInternal).length
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
    const normalizedName = args.name.trim().toLowerCase()
    const existing = await getTagByName(ctx, { name: normalizedName })

    if (existing) {
      return existing._id
    }

    const tagId: Id<'tags'> = await ctx.runMutation(internal.tags.createTag, {
      name: normalizedName,
      isInternal: args.isInternal,
    })

    return tagId
  },
})

export const listTags = query({
  args: {
    includeInternal: v.boolean(),
  },
  returns: v.array(
    v.object({
      _id: v.id('tags'),
      _creationTime: v.number(),
      name: v.string(),
      description: v.optional(v.string()),
      color: v.optional(v.string()),
      isInternal: v.boolean(),
      createdAt: v.number(),
      updatedAt: v.number(),
      imageCount: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const includeInternal = args.includeInternal ?? false

    const allTags = await ctx.db.query('tags').collect()

    const filteredTags = includeInternal
      ? allTags
      : allTags.filter(tag => !tag.isInternal)

    const tagsWithCounts = await asyncMap(filteredTags, async (tag) => {
      const imageCount: number = await countImagesByTag(ctx, { tagId: tag._id })
      return {
        ...tag,
        imageCount,
      }
    })

    // sort by name
    tagsWithCounts.sort((a, b) => a.name.localeCompare(b.name))

    return tagsWithCounts
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

    // delete all imageTags relationships
    const relationships = await ctx.db
      .query('imageTags')
      .withIndex('by_tagId', q => q.eq('tagId', args.tagId))
      .collect()

    for (const relationship of relationships) {
      await ctx.db.delete(relationship._id)
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
    const tagId: Id<'tags'> = await ctx.runMutation(internal.tags.ensureTag, {
      name: args.tagName,
      isInternal: false,
    })

    // check if relationship already exists (idempotent)
    const existing = await getImageTagRelationship(ctx, {
      imageId: args.imageId,
      tagId,
    })

    if (existing) {
      return null
    }

    // create relationship
    await ctx.db.insert('imageTags', {
      imageId: args.imageId,
      tagId,
      createdAt: Date.now(),
    })

    // remove "untagged" tag if present
    const untaggedTag = await getTagByName(ctx, { name: INTERNAL_TAGS.untagged })
    if (untaggedTag) {
      const untaggedRelationship = await getImageTagRelationship(ctx, {
        imageId: args.imageId,
        tagId: untaggedTag._id,
      })
      if (untaggedRelationship) {
        await ctx.db.delete(untaggedRelationship._id)
      }
    }

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
    const relationship = await getImageTagRelationship(ctx, {
      imageId: args.imageId,
      tagId: args.tagId,
    })

    if (!relationship) {
      return null
    }

    await ctx.db.delete(relationship._id)

    // check if this was the last user tag
    const userTagCount: number = await getImageTagCount(ctx, { imageId: args.imageId })

    if (userTagCount === 0) {
      // add "untagged" tag
      const untaggedTag = await getTagByName(ctx, { name: INTERNAL_TAGS.untagged })
      if (untaggedTag) {
        const existing = await getImageTagRelationship(ctx, {
          imageId: args.imageId,
          tagId: untaggedTag._id,
        })
        if (!existing) {
          await ctx.db.insert('imageTags', {
            imageId: args.imageId,
            tagId: untaggedTag._id,
            createdAt: Date.now(),
          })
        }
      }
    }

    return null
  },
})

export const getImageTags = query({
  args: {
    imageId: v.id('images'),
  },
  returns: v.array(
    v.object({
      _id: v.id('tags'),
      name: v.string(),
      description: v.optional(v.string()),
      color: v.optional(v.string()),
      isInternal: v.boolean(),
    }),
  ),
  handler: async (ctx, args) => {
    const relationships = await ctx.db
      .query('imageTags')
      .withIndex('by_imageId', q => q.eq('imageId', args.imageId))
      .collect()

    const tags = await asyncMap(relationships, async (rel) => {
      return await ctx.db.get(rel.tagId)
    })

    // filter out null values and return only non-internal tags
    const validTags = tags.filter((tag): tag is NonNullable<typeof tag> => tag !== null && !tag.isInternal)

    return validTags.map(tag => ({
      _id: tag._id,
      name: tag.name,
      description: tag.description,
      color: tag.color,
      isInternal: tag.isInternal,
    }))
  },
})

export const getTaggedImages = query({
  args: {
    tagId: v.id('tags'),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    // verify tag exists
    const tag = await ctx.db.get(args.tagId)
    if (!tag) {
      throw new ConvexError({ message: 'Tag not found', tagId: args.tagId })
    }

    // get all image relationships for this tag
    const relationships = await ctx.db
      .query('imageTags')
      .withIndex('by_tagId', q => q.eq('tagId', args.tagId))
      .collect()

    // get image IDs
    const imageIds = relationships.map(rel => rel.imageId)

    // fetch images using pagination
    // we need to filter the images query by the imageIds we have
    const allImages = await ctx.db.query('images').order('desc').collect()
    const filteredImages = allImages.filter(img => imageIds.includes(img._id))

    // manually implement pagination
    const { numItems, cursor } = args.paginationOpts
    const startIndex = cursor ? Number.parseInt(cursor) : 0
    const endIndex = startIndex + numItems

    const page = filteredImages.slice(startIndex, endIndex)
    const isDone = endIndex >= filteredImages.length
    const continueCursor = isDone ? '' : endIndex.toString()

    return {
      page,
      isDone,
      continueCursor,
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
