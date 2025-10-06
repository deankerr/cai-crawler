import type { Id } from '../../convex/_generated/dataModel'
import { Button } from './ui/button'

interface Tag {
  _id: Id<'tags'>
  name: string
  description?: string
  color?: string
  isInternal: boolean
  createdAt: number
  updatedAt: number
}

interface TagListProps {
  tags: Array<Tag>
  selectedTagId?: Id<'tags'>
  onTagSelect: (tagId: Id<'tags'> | undefined) => void
}

export function TagList({ tags, selectedTagId, onTagSelect }: TagListProps) {
  return (
    <div className="space-y-1">
      <Button
        variant={selectedTagId === undefined ? 'secondary' : 'ghost'}
        className="w-full justify-start"
        onClick={() => onTagSelect(undefined)}
      >
        <span>All Images</span>
      </Button>

      <div className="space-y-0.5">
        {tags.map(tag => (
          <Button
            key={tag._id}
            variant={selectedTagId === tag._id ? 'secondary' : 'ghost'}
            className="w-full justify-start"
            onClick={() => onTagSelect(tag._id)}
          >
            <span className="truncate">{tag.name}</span>
          </Button>
        ))}
      </div>

      {tags.length === 0 && (
        <div className="py-8 text-center text-sm text-muted-foreground">
          No tags yet. Add tags to images to organize them.
        </div>
      )}
    </div>
  )
}
