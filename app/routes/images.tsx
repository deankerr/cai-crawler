import type { Id } from '../../convex/_generated/dataModel'
import { useMutation, usePaginatedQuery, useQuery } from 'convex/react'
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { api } from '../../convex/_generated/api'
import { ImageGrid } from '../components/ImageGrid'
import { ImageModal } from '../components/ImageModal'
import { Sidebar } from '../components/Sidebar'

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

  const closeModal = () => {
    const newParams = new URLSearchParams(searchParams)
    newParams.delete('modal')
    navigate(`?${newParams.toString()}`, { preventScrollReset: true })
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

  const handleRenameTag = async (tagId: Id<'tags'>, newName: string) => {
    await renameTag({ tagId, newName })
  }

  const confirmDeleteTag = async (tagId: Id<'tags'>) => {
    await deleteTag({ tagId })
    if (selectedTagId === tagId) {
      handleTagSelect(undefined)
    }
  }

  const selectedTag = allTags?.find(t => t._id === selectedTagId)

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
        </div>
      </header>

      <div className="flex">
        <Sidebar
          allTags={allTags}
          selectedTagId={selectedTagId}
          selectedTag={selectedTag}
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          onTagSelect={handleTagSelect}
          onRenameTag={(tagId, newName) => handleRenameTag(tagId, newName)}
          onDeleteTag={confirmDeleteTag}
        />

        {/* Main content */}
        <ImageGrid
          images={results}
          status={status}
          onLoadMore={loadMore}
          searchParams={searchParams}
        />
      </div>

      <ImageModal
        modalImageId={modalImageId}
        modalImage={modalImage}
        onClose={closeModal}
      />
    </div>
  )
}
