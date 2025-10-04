import { usePaginatedQuery } from 'convex/react'
import { Link } from 'react-router'
import { api } from '../../convex/_generated/api'
import { Button } from '../components/ui/button'
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
                to={`/images/${image._id}`}
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
                {image.nsfw && (
                  <div className="absolute top-2 right-2 bg-destructive text-destructive-foreground text-xs px-2 py-1 rounded">
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
    </div>
  )
}
