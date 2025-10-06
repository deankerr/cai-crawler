import type { WindowVirtualizerHandle } from 'virtua'
import type { Id } from '../../convex/_generated/dataModel'
import { useMutation, usePaginatedQuery, useQuery } from 'convex/react'
import { Edit2, Menu, Trash2, VideoIcon, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { WindowVirtualizer } from 'virtua'
import { api } from '../../convex/_generated/api'
import { ImageDetail } from '../components/ImageDetail'
import { TagList } from '../components/TagList'
import { Button } from '../components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog'
import { Input } from '../components/ui/input'
import { getAssetUrl, isVideoUrl } from '../lib/media'

export function meta() {
  return [
    { title: 'Images - CivitAI Crawler' },
    { name: 'description', content: 'Browse collected images' },
  ]
}

export default function Images() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const modalImageId = searchParams.get('modal')
  const selectedTagId = searchParams.get('tag') as Id<'tags'> | null
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [editingTagId, setEditingTagId] = useState<Id<'tags'> | null>(null)
  const [editingTagName, setEditingTagName] = useState('')
  const [deletingTagId, setDeletingTagId] = useState<Id<'tags'> | null>(null)

  const allTags = useQuery(api.tags.listTags, { includeInternal: true })
  const renameTag = useMutation(api.tags.renameTag)
  const deleteTag = useMutation(api.tags.deleteTag)

  const allImagesQuery = usePaginatedQuery(
    api.images.list,
    selectedTagId ? 'skip' : {},
    { initialNumItems: 20 },
  )

  const taggedImagesQuery = usePaginatedQuery(
    api.tags.getTaggedImages,
    selectedTagId ? { tagId: selectedTagId } : 'skip',
    { initialNumItems: 20 },
  )

  const { results, status, loadMore } = selectedTagId ? taggedImagesQuery : allImagesQuery

  const modalImage = useQuery(
    api.images.get,
    modalImageId ? { id: modalImageId as Id<'images'> } : 'skip',
  )

  const virtualizerRef = useRef<WindowVirtualizerHandle>(null)
  const fetchedCountRef = useRef(-1)

  const closeModal = () => {
    navigate('.', { preventScrollReset: true })
  }

  const handleTagSelect = (tagId: Id<'tags'> | undefined) => {
    const newParams = new URLSearchParams(searchParams)
    if (tagId) {
      newParams.set('tag', tagId)
    }
    else {
      newParams.delete('tag')
    }
    setSearchParams(newParams, { preventScrollReset: true })
    setSidebarOpen(false)
  }

  const handleRenameTag = async (tagId: Id<'tags'>) => {
    if (editingTagName.trim()) {
      await renameTag({ tagId, newName: editingTagName.trim() })
      setEditingTagId(null)
      setEditingTagName('')
    }
  }

  const confirmDeleteTag = async () => {
    if (deletingTagId) {
      await deleteTag({ tagId: deletingTagId })
      if (selectedTagId === deletingTagId) {
        handleTagSelect(undefined)
      }
      setDeletingTagId(null)
    }
  }

  const selectedTag = allTags?.find(t => t._id === selectedTagId)

  const handleScroll = () => {
    if (!virtualizerRef.current)
      return
    if (status !== 'CanLoadMore')
      return

    const rowCount = Math.ceil(results.length / 4)
    const endIndex = virtualizerRef.current.findEndIndex()

    // Trigger load when we're within 3 rows of the end
    if (fetchedCountRef.current < rowCount && endIndex + 3 > rowCount) {
      fetchedCountRef.current = rowCount
      loadMore(20)
    }
  }

  /* Chunk results into groups of 4 */
  const rows = []
  for (let i = 0; i < results.length; i += 4) {
    rows.push(results.slice(i, i + 4))
  }

  if (status === 'LoadingFirstPage') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading images...</p>
      </div>
    )
  }

  return (
    <div className="bg-background min-h-screen">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">
            CivitAI Images
            {selectedTag && (
              <span className="text-lg font-normal text-muted-foreground ml-2">
                /
                {' '}
                {selectedTag.name}
              </span>
            )}
          </h1>
          <Button
            variant="outline"
            size="sm"
            className="lg:hidden"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>
        </div>
      </header>

      <div className="flex">
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
                      selectedTagId={selectedTagId ?? undefined}
                      onTagSelect={handleTagSelect}
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
                              handleRenameTag(selectedTag._id)
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
                            onClick={() => handleRenameTag(selectedTag._id)}
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
                          onClick={() => {
                            setEditingTagId(selectedTag._id)
                            setEditingTagName(selectedTag.name)
                          }}
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

        {/* Main content */}
        <main className="flex-1 p-4 lg:p-8">
          <WindowVirtualizer ref={virtualizerRef} onScroll={handleScroll}>
            {rows.map(row => (
              <div
                key={row[0]._id}
                className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4"
              >
                {row.map((image) => {
                  const mediaUrl = getAssetUrl(image.storageKey)
                  if (!mediaUrl)
                    return null
                  const isVideo = isVideoUrl(image.url)
                  return (
                    <Link
                      key={image._id}
                      to={`?modal=${image._id}`}
                      preventScrollReset
                      className="group relative aspect-[3/4] overflow-hidden rounded-lg border bg-muted hover:border-primary transition-colors"
                    >
                      {isVideo
                        ? (
                            <video
                              src={mediaUrl}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              muted
                              loop
                              playsInline
                              onMouseEnter={e => e.currentTarget.play()}
                              onMouseLeave={(e) => {
                                e.currentTarget.pause()
                                e.currentTarget.currentTime = 0
                              }}
                            />
                          )
                        : (
                            <img
                              src={mediaUrl}
                              alt={`Image ${image.imageId}`}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              loading="lazy"
                            />
                          )}
                      {isVideo && (
                        <div className="absolute bottom-2 right-2 bg-black/50 backdrop-blur-sm text-white text-xs px-1.5 py-1 rounded">
                          <VideoIcon />
                        </div>
                      )}
                      {image.nsfw && (
                        <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-sm text-white text-xs px-2 py-0.5 rounded">
                          NSFW
                        </div>
                      )}
                    </Link>
                  )
                })}
              </div>
            ))}
            {status === 'LoadingMore' && (
              <div className="py-8 flex justify-center">
                <p className="text-muted-foreground">Loading more...</p>
              </div>
            )}
          </WindowVirtualizer>
        </main>
      </div>

      <Dialog open={!!modalImageId} onOpenChange={open => !open && closeModal()}>
        <DialogContent className="sm:max-w-11/12 max-h-11/12" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              {modalImageId && (
                <a
                  href={`/images/${modalImageId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  permalink →
                </a>
              )}
            </DialogTitle>
          </DialogHeader>
          {modalImage === undefined && (
            <div className="py-8 text-center">
              <p className="text-muted-foreground">Loading...</p>
            </div>
          )}
          {modalImage === null && (
            <div className="py-8 text-center">
              <p className="text-muted-foreground">Image not found</p>
            </div>
          )}
          {modalImage && <ImageDetail image={modalImage} />}
        </DialogContent>
      </Dialog>

      {/* Delete Tag Confirmation Dialog */}
      <Dialog open={!!deletingTagId} onOpenChange={open => !open && setDeletingTagId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Tag</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
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
        </DialogContent>
      </Dialog>
    </div>
  )
}
