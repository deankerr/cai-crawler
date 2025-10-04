import type { Id } from '../../convex/_generated/dataModel'
import { usePaginatedQuery, useQuery } from 'convex/react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { api } from '../../convex/_generated/api'
import { ImageDetail } from '../components/ImageDetail'
import { Button } from '../components/ui/button'
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

  const closeModal = () => {
    navigate('.', { preventScrollReset: true })
  }

  if (status === 'LoadingFirstPage') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading images...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold">CivitAI Images</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {results.map((image) => {
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
                    <svg
                      className="w-3 h-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
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

        {status === 'CanLoadMore' && (
          <div className="mt-8 flex justify-center">
            <Button onClick={() => loadMore(20)} variant="outline">
              Load More
            </Button>
          </div>
        )}

        {status === 'LoadingMore' && (
          <div className="mt-8 flex justify-center">
            <p className="text-muted-foreground">Loading more...</p>
          </div>
        )}
      </main>

      <Dialog open={!!modalImageId} onOpenChange={open => !open && closeModal()}>
        <DialogContent className="sm:max-w-11/12 max-h-11/12">
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
