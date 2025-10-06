# Tags/Collections Feature - Design & Implementation Plan

## Overview

This document provides a complete design and implementation plan for adding a tagging/collections system to the CivitAI Crawler project. The feature allows users to organize images into collections using tags, making it easier to categorize and browse stored content.

## Goals

- Users can apply tags to images to categorize them
- Users can select a tag and view all images with that tag
- Users can easily add/remove tags from the image detail view
- Tags are created automatically when applied (no pre-creation required)
- Users can rename and delete tags
- Users can list all tags to view and manage them
- Users can view a feed of untagged images

## Terminology Decision

We will use **"tags"** as the primary nomenclature throughout the codebase and UI, as it's more intuitive and widely understood. The term "collections" may be used in UI copy where it feels more natural (e.g., "View your collections").

## Database Schema Design

### New Tables

#### `tags` table

Stores user-created tags. Tags have names and optional metadata.

```typescript
tags: defineTable({
  name: v.string(),
  description: v.optional(v.string()),
  color: v.optional(v.string()), // hex color for UI display
  isInternal: v.boolean(), // true for system-managed tags like "untagged"
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index('by_name', ['name'])
  .index('by_isInternal', ['isInternal'])
```

**Design rationale:**
- `name` is the primary identifier and must be unique (enforced at application level)
- `isInternal` flag separates system tags (like "untagged") from user tags
- `color` allows UI customization (can be added later if needed)
- Timestamps track creation and modification

#### `imageTags` table

Many-to-many relationship table linking images to tags.

```typescript
imageTags: defineTable({
  imageId: v.id('images'),
  tagId: v.id('tags'),
  createdAt: v.number(),
})
  .index('by_imageId', ['imageId'])
  .index('by_tagId', ['tagId'])
  .index('by_imageId_and_tagId', ['imageId', 'tagId'])
```

**Design rationale:**
- Composite index on `imageId` and `tagId` ensures uniqueness and efficient lookups
- Separate indexes allow querying from both directions (images by tag, tags by image)
- `createdAt` timestamp can be useful for sorting "recently tagged" items

### Schema Considerations

- **No changes to `images` table**: Keeps concerns separated and maintains data integrity
- **Indexes are critical**: Queries will be index-based, not filter-based (Convex best practice)
- **Many-to-many pattern**: Standard approach for tag systems, allows infinite flexibility

## Backend Implementation

### File Organization

Create a new file: `convex/tags.ts` to contain all tag-related functions.

### Core Functions

#### Tag Management

##### `getTagByName` (helper)
```typescript
async function getTagByName(ctx: QueryCtx, { name }: { name: string })
```
- Helper function to find a tag by name
- Used for tag creation to check for duplicates

##### `createTag` (internalMutation)
```typescript
export const createTag = internalMutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    color: v.optional(v.string()),
    isInternal: v.boolean(),
  },
  returns: v.id('tags'),
  handler: async (ctx, args) => { ... }
})
```
- Creates a new tag
- Checks for duplicate names (case-insensitive)
- Returns the tag ID
- Internal because it's called from other mutations

##### `ensureTag` (internalMutation)
```typescript
export const ensureTag = internalMutation({
  args: {
    name: v.string(),
  },
  returns: v.id('tags'),
  handler: async (ctx, args) => { ... }
})
```
- Gets existing tag by name or creates if doesn't exist
- Used when adding tags to images
- Implements the "no pre-creation required" feature

##### `ensureTagByName` (helper)
```typescript
async function ensureTagByName(ctx: MutationCtx, { name, isInternal = false })
```
- Helper function that ensures tag exists by name
- Can be used within other mutation functions without `ctx.runMutation`
- Automatically handles tag normalization and creation

##### `listTags` (query)
```typescript
export const listTags = query({
  args: {
    includeInternal: v.optional(v.boolean()),
  },
  returns: v.array(v.object({
    _id: v.id('tags'),
    _creationTime: v.number(),
    name: v.string(),
    description: v.optional(v.string()),
    color: v.optional(v.string()),
    isInternal: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
    imageCount: v.number(),
  })),
  handler: async (ctx, args) => { ... }
})
```
- Lists all tags with image counts
- Optionally includes internal tags
- Returns tags sorted by name
- Image count computed by querying `imageTags` table

##### `renameTag` (mutation)
```typescript
export const renameTag = mutation({
  args: {
    tagId: v.id('tags'),
    newName: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => { ... }
})
```
- Renames a tag
- Validates new name doesn't conflict with existing tags
- Cannot rename internal tags
- Updates `updatedAt` timestamp

##### `deleteTag` (mutation)
```typescript
export const deleteTag = mutation({
  args: {
    tagId: v.id('tags'),
  },
  returns: v.null(),
  handler: async (ctx, args) => { ... }
})
```
- Deletes a tag
- Cannot delete internal tags
- Uses `deleteRelationship` helper for each image relationship
- Properly handles untagged tag management for each affected image

#### Image-Tag Relationships

##### `addTagToImage` (mutation)
```typescript
export const addTagToImage = mutation({
  args: {
    imageId: v.id('images'),
    tagName: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => { ... }
})
```
- Adds a tag to an image
- Creates tag if it doesn't exist (via `ensureTag`)
- Uses `createRelationship` helper for core logic
- Handles idempotency and untagged management internally

##### `removeTagFromImage` (mutation)
```typescript
export const removeTagFromImage = mutation({
  args: {
    imageId: v.id('images'),
    tagId: v.id('tags'),
  },
  returns: v.null(),
  handler: async (ctx, args) => { ... }
})
```
- Removes a tag from an image
- Uses `deleteRelationship` helper for core logic
- Handles untagged tag management internally

##### `getImageTags` (query)
```typescript
export const getImageTags = query({
  args: {
    imageId: v.id('images'),
  },
  returns: v.array(v.object({
    _id: v.id('tags'),
    name: v.string(),
    description: v.optional(v.string()),
    color: v.optional(v.string()),
    isInternal: v.boolean(),
  })),
  handler: async (ctx, args) => { ... }
})
```
- Gets all tags for an image
- Returns tag documents, not relationship documents
- Filters out internal tags by default (unless needed for UI state)

##### `getTaggedImages` (query)
```typescript
export const getTaggedImages = query({
  args: {
    tagId: v.id('tags'),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.any(), // standard Convex pagination result
  handler: async (ctx, args) => { ... }
})
```
- Gets paginated list of images for a tag
- Uses `imageTags` index to find image IDs
- Fetches full image documents
- Returns in same format as `images.list` for consistency

#### Batch Operations

##### `applyUntaggedToAllImages` (internalMutation)
```typescript
export const applyUntaggedToAllImages = internalMutation({
  args: {},
  returns: v.object({
    processed: v.number(),
    tagged: v.number(),
  }),
  handler: async (ctx, args) => { ... }
})
```
- One-time migration function
- Finds all images without any tags
- Applies "untagged" tag to them
- Can be called from Convex dashboard or a cron job

## Untagged Images Strategy

The challenge: Convex doesn't make it straightforward to query for documents that are NOT represented in a many-to-many table.

**Solution:** Use a special internal tag called "untagged".

### Implementation Details

1. **Creating the "untagged" tag:**
   - Create via dashboard or migration script
   - Set `isInternal: true`
   - Cannot be renamed or deleted by users

2. **Automatic management:**
   - When an image is inserted, check if it has any tags
   - If no tags exist, automatically apply "untagged"
   - When a user adds their first tag, remove "untagged"
   - When a user removes their last tag, re-apply "untagged"

3. **Migration for existing images:**
   - Run `applyUntaggedToAllImages` once after feature deployment
   - Processes all existing images without tags

### Alternative Approaches Considered

1. **Full table scan with filter:**
   - Problem: Inefficient, violates Convex best practices
   - Not suitable for large datasets

2. **Separate `untaggedImages` table:**
   - Problem: Duplicate state management, consistency issues
   - More complex to maintain

3. **Computed field on images table:**
   - Problem: Requires schema change to images table
   - Violates separation of concerns principle

The internal tag approach is the cleanest and most maintainable.

## Frontend Implementation

### UI Components

#### Tag Input Component (`app/components/TagInput.tsx`)

A component for adding tags with autocomplete/suggestions.

```typescript
interface TagInputProps {
  imageId: Id<'images'>
  existingTags: Array<{ _id: Id<'tags'>, name: string }>
  allTags: Array<{ _id: Id<'tags'>, name: string }>
}
```

**Features:**
- Text input with autocomplete dropdown
- Shows existing tags as suggestions
- Creates new tags on Enter or blur
- Accessible (keyboard navigation)

**Libraries to consider:**
- Use shadcn/ui Combobox component as base
- Customize for tag-specific behavior

#### Tag Badge Component (`app/components/TagBadge.tsx`)

Displays a tag with optional remove button.

```typescript
interface TagBadgeProps {
  tag: { _id: Id<'tags'>, name: string, color?: string }
  onRemove?: () => void
  variant?: 'default' | 'outline'
}
```

**Features:**
- Displays tag name
- Shows color if provided
- Remove button (X) when `onRemove` provided
- Matches existing UI design language

#### Tag List Sidebar (`app/components/TagList.tsx`)

Component for displaying all tags with counts.

```typescript
interface TagListProps {
  tags: Array<{ _id: Id<'tags'>, name: string, imageCount: number }>
  selectedTagId?: Id<'tags'>
  onTagSelect: (tagId: Id<'tags'>) => void
}
```

**Features:**
- Lists all tags alphabetically
- Shows image count per tag
- Highlights selected tag
- Responsive design (collapsible on mobile)

### Route Changes

#### Main Images Route (`app/routes/images.tsx`)

**Changes needed:**
1. Add tag list sidebar (left side on desktop, collapsible on mobile)
2. Support `?tag=<tagId>` search parameter
3. When tag selected, call `getTaggedImages` instead of `images.list`
4. Show "All Images" vs "Filtered by [Tag Name]" header
5. Add tag management UI when a tag is selected (rename/delete buttons)

**Layout structure:**
```
┌──────────────────────────────────────────────┐
│ Header: CivitAI Images                       │
├──────────┬───────────────────────────────────┤
│          │                                   │
│  Tag     │  Image Grid                       │
│  List    │  (existing infinite scroll)       │
│          │                                   │
│  [+]     │                                   │
└──────────┴───────────────────────────────────┘
```

#### Image Detail (`app/components/ImageDetail.tsx`)

**Changes needed:**
1. Add tags section to the metadata sidebar
2. Display existing tags as badges with remove buttons
3. Add `TagInput` component for adding new tags
4. Call `getImageTags`, `addTagToImage`, `removeTagFromImage` mutations

**Placement:** Add between "Reactions" and "Models Used" sections.

### URL State Management

Use search parameters to maintain state:
- `?modal=<imageId>` - existing modal state
- `?tag=<tagId>` - filter by tag

**Example URLs:**
- `/images` - all images
- `/images?tag=k7g12hf8` - images with specific tag
- `/images?tag=k7g12hf8&modal=k5f3g2h8` - tag filtered view with modal open

**Benefits:**
- Shareable URLs
- Browser back/forward works correctly
- State persists on refresh

### Data Flow

```
User adds tag to image
  ↓
Call addTagToImage mutation
  ↓
Backend: ensureTag (create if new)
  ↓
Backend: create imageTags relationship
  ↓
Backend: remove "untagged" if present
  ↓
Frontend: optimistic update (Convex handles this)
  ↓
UI updates automatically via subscription
```

## Implementation Phases

### Phase 1: Backend Foundation (Estimate: 2-3 hours)

1. **Schema changes** (`convex/schema.ts`)
   - Add `tags` table definition
   - Add `imageTags` table definition
   - Deploy schema changes

2. **Core tag functions** (`convex/tags.ts`)
   - Implement `getTagByName`, `createTag`, `ensureTag`
   - Implement `listTags`
   - Write tests via Convex dashboard

3. **Relationship functions** (`convex/tags.ts`)
   - Implement `addTagToImage`, `removeTagFromImage`
   - Implement `getImageTags`, `getTaggedImages`
   - Test via dashboard

4. **Create "untagged" system tag**
   - Use dashboard to create tag with `isInternal: true`
   - Note the tag ID for reference

### Phase 2: Untagged Image Handling (Estimate: 1-2 hours)

1. **Migration function** (`convex/tags.ts`)
   - Implement `applyUntaggedToAllImages`
   - Run migration via dashboard
   - Verify results

2. **Automatic untagged management** (`convex/tags.ts`)
   - Update `addTagToImage` to remove "untagged"
   - Update `removeTagFromImage` to add "untagged" when needed
   - Test edge cases

3. **New image integration** (`convex/images.ts`)
   - Modify `insertImages` to check for tags
   - Apply "untagged" to new images automatically
   - Test with new image ingestion

### Phase 3: Frontend Components (Estimate: 3-4 hours)

1. **Tag Badge component** (`app/components/TagBadge.tsx`)
   - Create basic badge with remove button
   - Style to match existing design
   - Test with various tag names/colors

2. **Tag Input component** (`app/components/TagInput.tsx`)
   - Implement text input with Enter to add
   - Add autocomplete dropdown
   - Handle create vs select existing
   - Test keyboard navigation

3. **Tag List component** (`app/components/TagList.tsx`)
   - Display tags with counts
   - Handle selection
   - Add responsive behavior
   - Test with many tags

### Phase 4: Main UI Integration (Estimate: 3-4 hours)

1. **Update ImageDetail component**
   - Add tags section to sidebar
   - Integrate TagBadge for display
   - Integrate TagInput for adding
   - Wire up mutations
   - Test add/remove flow

2. **Update images route**
   - Add TagList sidebar
   - Implement tag filtering
   - Update query based on `?tag` param
   - Handle "All Images" vs filtered view
   - Test navigation and state management

3. **Tag management UI**
   - Add rename functionality (inline edit or modal)
   - Add delete functionality with confirmation
   - Handle errors gracefully
   - Test edge cases

### Phase 5: Polish & Testing (Estimate: 2-3 hours)

1. **Error handling**
   - Handle tag name conflicts
   - Handle missing tags/images
   - Show user-friendly error messages
   - Add loading states

2. **UX improvements**
   - Add keyboard shortcuts (e.g., 't' to focus tag input)
   - Add tag color picker (optional)
   - Improve mobile experience
   - Add transitions/animations

3. **Documentation**
   - Update README with tag feature
   - Document tag management workflow
   - Add screenshots if helpful

4. **Testing**
   - Test with real data
   - Test edge cases (empty states, many tags, etc.)
   - Test performance with large datasets
   - Fix any bugs found

### Phase 6: Optional Enhancements (Future)

These are explicitly out of scope for initial implementation but documented for future reference:

1. **Complex tag queries**
   - AND/OR combinations (e.g., "landscape AND sunset")
   - Exclusion (e.g., "NOT portrait")
   - Requires more complex query UI and backend logic

2. **Batch operations**
   - Select multiple images and apply tags
   - Requires selection UI state management
   - More complex UX patterns

3. **Tag hierarchies**
   - Parent/child tag relationships (e.g., "Nature → Landscapes")
   - Requires schema changes and tree UI

4. **Tag suggestions/ML**
   - Auto-suggest tags based on image content
   - Requires ML model integration
   - Out of scope for MVP

## Database Migration Plan

### Step 1: Schema Deployment
```bash
# Schema changes are deployed automatically by Convex
# No manual migration needed for table creation
```

### Step 2: Create Untagged Tag
```typescript
// Run in Convex dashboard
ctx.db.insert('tags', {
  name: 'untagged',
  isInternal: true,
  createdAt: Date.now(),
  updatedAt: Date.now(),
})
```

### Step 3: Apply Untagged to Existing Images
```typescript
// Run in Convex dashboard
ctx.runMutation(internal.tags.applyUntaggedToAllImages)
```

### Rollback Strategy

If issues arise, rollback is straightforward:
1. Remove frontend code (no impact on data)
2. Keep backend functions (harmless if not called)
3. Optionally delete `tags` and `imageTags` tables via dashboard

## Performance Considerations

### Query Performance

1. **Index usage:** All queries use indexes, not filters
2. **Pagination:** Tag-filtered image lists use pagination
3. **Batch operations:** Use `asyncMap` for parallel operations

### Scaling Considerations

1. **Image count per tag:** Unlimited, handled by pagination
2. **Tags per image:** Practically unlimited (Convex arrays support up to 8192 items, we'll use m2m instead)
3. **Total tags:** Unlimited, though UI may need virtualization with 1000+ tags

### Optimization Opportunities

1. **Precompute image counts:** Store count on tag document (trade-off: consistency complexity)
2. **Cache tag list:** Tags change infrequently, could use client-side caching
3. **Debounce autocomplete:** Prevent excessive queries while typing

Current approach prioritizes simplicity and correctness. Optimize only if performance issues arise.

## Testing Strategy

### Backend Testing (via Convex Dashboard)

1. **Tag CRUD operations:**
   - Create tags with various names
   - Attempt duplicate names (should fail)
   - Rename tags
   - Delete tags with and without images

2. **Image-tag relationships:**
   - Add tags to images
   - Remove tags from images
   - Add same tag twice (should be idempotent)
   - Remove last tag (should add "untagged")

3. **Queries:**
   - List tags with correct counts
   - Get images by tag
   - Get tags for image
   - Test pagination with many results

### Frontend Testing (Manual)

1. **Tag management:**
   - Add new tags to images
   - Remove tags from images
   - Rename tags via UI
   - Delete tags via UI

2. **Filtering:**
   - Select different tags and verify correct images shown
   - Test URL sharing (copy/paste URL with tag filter)
   - Test browser back/forward navigation

3. **Edge cases:**
   - Empty states (no tags, no images with tag)
   - Many tags (100+)
   - Long tag names
   - Special characters in tag names

4. **Mobile:**
   - Test responsive tag list
   - Test tag input on mobile keyboard
   - Verify usability on small screens

## Security Considerations

### Data Access

- All mutations are public (single-user system)
- No authentication/authorization needed
- Future: if multi-user, add user ownership to tags

### Input Validation

1. **Tag names:**
   - Validate non-empty
   - Validate maximum length (e.g., 50 characters)
   - Sanitize special characters if needed
   - Case-insensitive uniqueness check

2. **Tag deletion:**
   - Confirm deletion of tags with many images
   - Prevent deletion of internal tags

## Code Quality Standards

Following project philosophy:

1. **Pure functions:** Helper functions should be pure where possible
2. **No return types:** Except for generics and validators
3. **Single purpose:** Each function does one thing well
4. **Composability:** Functions can be combined to build features
5. **Fail fast:** No try/catch without specific reason
6. **Idempotency:** Mutations should be safely re-runnable

## API Reference

### Queries

```typescript
// Get all tags with image counts
api.tags.listTags({ includeInternal?: boolean })

// Get tags for a specific image
api.tags.getImageTags({ imageId: Id<'images'> })

// Get images for a specific tag (paginated)
api.tags.getTaggedImages({
  tagId: Id<'tags'>,
  paginationOpts: { numItems: number, cursor: string | null }
})
```

### Mutations

```typescript
// Add a tag to an image (creates tag if needed)
api.tags.addTagToImage({
  imageId: Id<'images'>,
  tagName: string
})

// Remove a tag from an image
api.tags.removeTagFromImage({
  imageId: Id<'images'>,
  tagId: Id<'tags'>
})

// Rename a tag
api.tags.renameTag({
  tagId: Id<'tags'>,
  newName: string
})

// Delete a tag
api.tags.deleteTag({
  tagId: Id<'tags'>
})
```

### Internal Functions

```typescript
// Ensure tag exists (create if needed)
internal.tags.ensureTag({ name: string })

// Apply untagged to all images without tags
internal.tags.applyUntaggedToAllImages({})

// Create a tag directly
internal.tags.createTag({
  name: string,
  description?: string,
  color?: string,
  isInternal: boolean
})
```

## Success Metrics

The feature is complete when:

1. ✅ Users can add tags to images from the detail view
2. ✅ Users can remove tags from images from the detail view
3. ✅ Tags are created automatically when first used
4. ✅ Users can filter images by tag from the main view
5. ✅ Users can see all their tags with image counts
6. ✅ Users can rename tags
7. ✅ Users can delete tags
8. ✅ Users can view untagged images via the "untagged" tag
9. ✅ All features work on mobile devices
10. ✅ URL state persists for sharing and navigation

## Future Considerations

### Potential Extensions

1. **Tag descriptions:** Already in schema, just need UI
2. **Tag colors:** Already in schema, add color picker
3. **Tag export/import:** Export tags as JSON, import from file
4. **Tag analytics:** Most used tags, tagging trends over time
5. **Smart tags:** ML-based auto-tagging (very complex)
6. **Nested tags:** Tag hierarchies (moderate complexity)

### API Compatibility

If CivitAI adds official tagging/collections:
- Keep our internal system for user organization
- Optionally sync with CivitAI tags
- Store both in separate fields

## Conclusion

This design provides a complete, production-ready tagging system that integrates cleanly with the existing architecture. It follows project principles of simplicity, composability, and idempotency while providing a solid foundation for future enhancements.

The phased implementation approach ensures each component can be built and tested independently, reducing risk and allowing for early feedback. The total estimated time is 11-16 hours for a complete, polished implementation.

---

**Document Version:** 1.0  
**Last Updated:** 2025-10-06  
**Author:** Claude (AI Assistant)

