# Feature: Tags/Collections

## Goals

- The user should be able to apply tags to images to categorize them
- The user should be able to select a tag and view the collection of images with that tag
- The user should be able to easily add and remove tags from an image in the image detail view
- The user should not have to create a tag first before applying it to an image - it should happen automatically
- The user should be able to rename and delete tags
- The user should be able to list tags, to view their collection and manage them
- The user should be able to view a feed of images that have not been tagged.

## Implementation Notes

- We should decide on the tags/collections nomenclature
- We should probably have a tags table, and a many to many relationship table with images
- We should probably not mix concerns by introducing any schema changes to the image table itself
- It it not straightforward in convex to query for documents that are not represented in an m2m table.
  - The simplest solution is to apply an "untagged" tag to all images without a tag.
  - We can run a batch job to do this for existing images, and apply it to all new images.
  - We may want to have "internal" tags for this purpose. We could just utilise the same system but mark them as not user-editable.
- The image detail page should gain UI to add and remove tags.
- The image feed page can gain a tag selector to quickly view a collection, and use search params to store the state
- We could keep things simple by showing rename/delete tag UI when that tag is selected, meaning we don't need a whole new page

## Non-Goals/Out of Scope

- View combined/complex mix of tags in a feed
- Multi-select/batch editing
