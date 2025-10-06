import type { Doc } from '../../convex/_generated/dataModel'
import { VideoIcon } from 'lucide-react'
import { Link } from 'react-router'
import { getAssetUrl, isVideoUrl } from '../lib/media'

type Image = Doc<'images'>

interface ImageCardProps {
  image: Image
  searchParams: URLSearchParams
}

export function ImageCard({ image, searchParams }: ImageCardProps) {
  const mediaUrl = getAssetUrl(image.storageKey)
  if (!mediaUrl)
    return null

  const isVideo = isVideoUrl(image.url)
  const modalUrl = `?${new URLSearchParams({
    ...Object.fromEntries(searchParams),
    modal: image._id,
  }).toString()}`

  return (
    <Link
      to={modalUrl}
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
}
