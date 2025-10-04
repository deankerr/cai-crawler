import type { Doc } from '../../convex/_generated/dataModel'
import { getAssetUrl, isVideoUrl } from '../lib/media'

export function ImageDetail({ image }: { image: Doc<'images'> }) {
  const mediaUrl = getAssetUrl(image.storageKey)
  const isVideo = isVideoUrl(image.url)

  if (!mediaUrl) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Image not yet stored</p>
      </div>
    )
  }

  return (
    <div className="grid lg:grid-cols-[1fr_400px] gap-8 overflow-hidden">
      <div className="flex overflow-hidden justify-center">
        {isVideo
          ? (
              <video
                src={mediaUrl}
                className="object-contain rounded-lg"
                width={image.width}
                height={image.height}
                controls
                loop
                playsInline
                autoPlay
              />
            )
          : (
              <img
                src={mediaUrl}
                alt={`Image ${image.imageId}`}
                className="object-contain rounded-lg"
                width={image.width}
                height={image.height}
              />
            )}
      </div>

      <div className="space-y-6 overflow-y-auto">
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
  )
}
