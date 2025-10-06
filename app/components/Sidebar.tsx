import type { Doc, Id } from '../../convex/_generated/dataModel'
import { Edit2, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { TagList } from './TagList'
import { Button } from './ui/button'
import { Input } from './ui/input'

type Tag = Doc<'tags'>

interface SidebarProps {
  allTags: Tag[] | undefined
  selectedTagId: Id<'tags'> | null
  selectedTag: Tag | undefined
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  onTagSelect: (tagId: Id<'tags'> | undefined) => void
  onRenameTag: (tagId: Id<'tags'>, newName: string) => Promise<void>
  onDeleteTag: (tagId: Id<'tags'>) => Promise<void>
}

export function Sidebar({
  allTags,
  selectedTagId,
  selectedTag,
  sidebarOpen,
  setSidebarOpen,
  onTagSelect,
  onRenameTag,
  onDeleteTag,
}: SidebarProps) {
  const [editingTagId, setEditingTagId] = useState<Id<'tags'> | null>(null)
  const [editingTagName, setEditingTagName] = useState('')
  const [deletingTagId, setDeletingTagId] = useState<Id<'tags'> | null>(null)

  const handleRenameTag = async () => {
    if (editingTagName.trim() && editingTagId) {
      await onRenameTag(editingTagId, editingTagName.trim())
      setEditingTagId(null)
      setEditingTagName('')
    }
  }

  const confirmDeleteTag = async () => {
    if (deletingTagId) {
      await onDeleteTag(deletingTagId)
      setDeletingTagId(null)
    }
  }

  const startEditingTag = (tag: Tag) => {
    setEditingTagId(tag._id)
    setEditingTagName(tag.name)
  }

  return (
    <>
      {/* Sidebar */}
      <aside
        className={`
          fixed lg:sticky top-[73px] left-0 h-[calc(100vh-73px)] w-64 border-r bg-background p-4 overflow-y-auto z-40
          transition-transform duration-200 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0
        `}
      >
        <div className="space-y-4">
          <div>
            <h2 className="text-sm font-semibold mb-2">Collections</h2>
            {allTags
              ? (
                  <TagList
                    tags={allTags}
                    selectedTagId={selectedTagId || undefined}
                    onTagSelect={onTagSelect}
                  />
                )
              : (
                  <p className="text-sm text-muted-foreground">Loading tags...</p>
                )}
          </div>

          {selectedTag && (
            <div className="space-y-2 pt-4 border-t">
              <h3 className="text-sm font-semibold">Manage Tag</h3>
              {editingTagId === selectedTag._id
                ? (
                    <div className="space-y-2">
                      <Input
                        value={editingTagName}
                        onChange={e => setEditingTagName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleRenameTag()
                          }
                          else if (e.key === 'Escape') {
                            setEditingTagId(null)
                            setEditingTagName('')
                          }
                        }}
                        placeholder="Tag name"
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={handleRenameTag}
                        >
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingTagId(null)
                            setEditingTagName('')
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )
                : (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => startEditingTag(selectedTag)}
                      >
                        <Edit2 className="h-4 w-4 mr-2" />
                        Rename
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => setDeletingTagId(selectedTag._id)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </Button>
                    </div>
                  )}
            </div>
          )}
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Delete Tag Confirmation Dialog */}
      {deletingTagId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background p-6 rounded-lg max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">Delete Tag</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Are you sure you want to delete this tag? This will remove it from all images.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setDeletingTagId(null)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={confirmDeleteTag}>
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
