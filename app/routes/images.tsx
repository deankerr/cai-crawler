import type { WindowVirtualizerHandle } from 'virtua'
import type { Id } from '../../convex/_generated/dataModel'
import { usePaginatedQuery, useQuery } from 'convex/react'
import { VideoIcon } from 'lucide-react'
import { useRef } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { WindowVirtualizer } from 'virtua'
import { api } from '../../convex/_generated/api'
import { ImageDetail } from '../components/ImageDetail'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog'
import { getAssetUrl, isVideoUrl } from '../lib/media'

export function meta() {
  return [
    { title: 'Images - CivitAI Crawler' },
    { name: 'description', content: 'Browse collected images' },
  ]
}

export default function Images() {
  const { results, status, loadMore } = usePaginatedQuery(
    api.images.list,
    {},
    { initialNumItems: 20 },
  )
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const modalImageId = searchParams.get('modal')
  const modalImage = useQuery(
    api.images.get,
    modalImageId ? { id: modalImageId as Id<'images'> } : 'skip',
  )

  const virtualizerRef = useRef<WindowVirtualizerHandle>(null)
  const fetchedCountRef = useRef(-1)

  const closeModal = () => {
    navigate('.', { preventScrollReset: true })
  }

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
    <div className="bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold">CivitAI Images</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
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
    </div>
  )
}
