import type { Id } from '../../convex/_generated/dataModel'
import type { Route } from './+types/images.$id'
import { useQuery } from 'convex/react'
import { Link } from 'react-router'
import { api } from '../../convex/_generated/api'
import { Button } from '../components/ui/button'
import { getAssetUrl, isVideoUrl } from '../lib/media'

export function meta({ params }: Route.MetaArgs) {
  return [
    { title: `Image ${params.id} - CivitAI Crawler` },
    { name: 'description', content: 'Image details' },
  ]
}

export default function ImageDetail({ params }: Route.ComponentProps) {
  const image = useQuery(api.images.get, { id: params.id as Id<'images'> })
  const mediaUrl = image ? getAssetUrl(image.storageKey) : null
  const isVideo = image ? isVideoUrl(image.url) : false

  if (image === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (image === null || !mediaUrl) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">
            {image === null ? 'Image not found' : 'Image not yet stored'}
          </p>
          <Link to="/images">
            <Button variant="outline">Back to Images</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <Link to="/images">
            <Button variant="ghost" size="sm">
              ← Back to Images
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="grid lg:grid-cols-[1fr_400px] gap-8">
          {isVideo
            ? (
                <video
                  src={mediaUrl}
                  className="w-full max-h-[85vh] object-contain rounded-lg"
                  controls
                  loop
                  playsInline
                />
              )
            : (
                <img
                  src={mediaUrl}
                  alt={`Image ${image.imageId}`}
                  className="w-full max-h-[85vh] object-contain rounded-lg"
                />
              )}

          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold mb-2">
                Image
                {' '}
                {image.imageId}
              </h1>
              {image.username && (
                <p className="text-muted-foreground">
                  by
                  {' '}
                  {image.username}
                </p>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <h2 className="text-sm font-medium text-muted-foreground mb-1">Dimensions</h2>
                <p>
                  {image.width}
                  {' '}
                  x
                  {' '}
                  {image.height}
                </p>
              </div>

              <div>
                <h2 className="text-sm font-medium text-muted-foreground mb-1">NSFW</h2>
                <p>{image.nsfw ? `Yes (${image.nsfwLevel})` : 'No'}</p>
              </div>

              <div>
                <h2 className="text-sm font-medium text-muted-foreground mb-1">Created</h2>
                <p>{new Date(image.createdAt).toLocaleDateString()}</p>
              </div>

              <div>
                <h2 className="text-sm font-medium text-muted-foreground mb-1">Source</h2>
                <a
                  href={image.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline"
                >
                  View on CivitAI →
                </a>
              </div>

              <div>
                <h2 className="text-sm font-medium text-muted-foreground mb-1">Reactions</h2>
                <div className="flex gap-4 text-sm">
                  <span>
                    ❤️
                    {' '}
                    {image.stats.heartCount}
                  </span>
                  <span>
                    👍
                    {' '}
                    {image.stats.likeCount}
                  </span>
                  <span>
                    😂
                    {' '}
                    {image.stats.laughCount}
                  </span>
                  <span>
                    😢
                    {' '}
                    {image.stats.cryCount}
                  </span>
                  <span>
                    💬
                    {' '}
                    {image.stats.commentCount}
                  </span>
                </div>
              </div>

              {image.models.length > 0 && (
                <div>
                  <h2 className="text-sm font-medium text-muted-foreground mb-2">Models Used</h2>
                  <div className="space-y-2">
                    {image.models.map((model, idx) => (
                      <div key={idx} className="text-sm border rounded p-2">
                        <div className="font-medium">{model.name || 'Unknown'}</div>
                        <div className="text-xs text-muted-foreground">
                          Type:
                          {' '}
                          {model.type}
                        </div>
                        {model.hash && (
                          <div className="text-xs text-muted-foreground font-mono">
                            Hash:
                            {' '}
                            {model.hash}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
