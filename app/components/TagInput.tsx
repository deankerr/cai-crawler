import type { Id } from '../../convex/_generated/dataModel'
import { Check } from 'lucide-react'
import { useState } from 'react'
import { Button } from './ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from './ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from './ui/popover'

interface TagInputProps {
  allTags: Array<{ _id: Id<'tags'>, name: string }>
  existingTagIds: Set<Id<'tags'>>
  onAddTag: (tagName: string) => void
  placeholder?: string
}

export function TagInput({ allTags, existingTagIds, onAddTag, placeholder = 'Add tag...' }: TagInputProps) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')

  const availableTags = allTags.filter(tag => !existingTagIds.has(tag._id))

  const handleSelect = (tagName: string) => {
    onAddTag(tagName)
    setValue('')
    setOpen(false)
  }

  const handleCreateNew = () => {
    if (value.trim()) {
      onAddTag(value.trim())
      setValue('')
      setOpen(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="justify-start text-left font-normal"
        >
          {placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0">
        <Command loop>
          <CommandInput
            placeholder="Search or create tag..."
            value={value}
            onValueChange={setValue}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && value.trim()) {
                e.preventDefault()
                handleCreateNew()
              }
            }}
          />
          <CommandList>
            <CommandEmpty>
              <div className="py-6 text-center text-sm">
                <p className="text-muted-foreground">No tags found.</p>
                {value.trim() && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2"
                    onClick={handleCreateNew}
                  >
                    Create "
                    {value.trim()}
                    "
                  </Button>
                )}
              </div>
            </CommandEmpty>
            {availableTags.length > 0 && (
              <CommandGroup>
                {availableTags.map(tag => (
                  <CommandItem
                    key={tag._id}
                    value={tag.name}
                    onSelect={() => handleSelect(tag.name)}
                  >
                    <Check className="mr-2 h-4 w-4 opacity-0" />
                    {tag.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {value.trim() && !availableTags.some(t => t.name.toLowerCase() === value.toLowerCase()) && (
              <CommandGroup heading="Create new">
                <CommandItem
                  value={value}
                  onSelect={handleCreateNew}
                >
                  <Check className="mr-2 h-4 w-4 opacity-0" />
                  Create "
                  {value.trim()}
                  "
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
