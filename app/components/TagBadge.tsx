import type { Id } from '../../convex/_generated/dataModel'
import { X } from 'lucide-react'
import { Badge } from './ui/badge'
import { Button } from './ui/button'

interface TagBadgeProps {
  tag: {
    _id: Id<'tags'>
    name: string
    color?: string
  }
  onRemove?: () => void
  variant?: 'default' | 'outline' | 'secondary'
}

export function TagBadge({ tag, onRemove, variant = 'default' }: TagBadgeProps) {
  return (
    <Badge
      variant={variant}
      className="gap-1 pr-1"
      style={tag.color ? { backgroundColor: tag.color } : undefined}
    >
      <span>{tag.name}</span>
      {onRemove && (
        <Button
          variant="ghost"
          size="sm"
          className="h-4 w-4 p-0 hover:bg-transparent"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onRemove()
          }}
        >
          <X className="h-3 w-3" />
          <span className="sr-only">Remove tag</span>
        </Button>
      )}
    </Badge>
  )
}
