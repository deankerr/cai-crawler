import type { WindowVirtualizerHandle } from 'virtua'
import type { Doc } from '../../convex/_generated/dataModel'
import { useRef } from 'react'
import { WindowVirtualizer } from 'virtua'
import { ImageCard } from './ImageCard'

type Image = Doc<'images'>

interface ImageGridProps {
  images: Image[]
  status: string
  onLoadMore: (numItems: number) => void
  searchParams: URLSearchParams
}

export function ImageGrid({ images, status, onLoadMore, searchParams }: ImageGridProps) {
  const virtualizerRef = useRef<WindowVirtualizerHandle>(null)
  const fetchedCountRef = useRef(-1)

  const handleScroll = () => {
    if (!virtualizerRef.current)
      return
    if (status !== 'CanLoadMore')
      return

    const rowCount = Math.ceil(images.length / 4)
    const endIndex = virtualizerRef.current.findEndIndex()

    // Trigger load when we're within 3 rows of the end
    if (fetchedCountRef.current < rowCount && endIndex + 3 > rowCount) {
      fetchedCountRef.current = rowCount
      onLoadMore(20)
    }
  }

  /* Chunk results into groups of 4 */
  const rows = []
  for (let i = 0; i < images.length; i += 4) {
    rows.push(images.slice(i, i + 4))
  }

  return (
    <main className="flex-1 p-4 lg:p-8">
      <WindowVirtualizer ref={virtualizerRef} onScroll={handleScroll}>
        {rows.map(row => (
          <div
            key={row[0]._id}
            className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-4"
          >
            {row.map(image => (
              <ImageCard
                key={image._id}
                image={image}
                searchParams={searchParams}
              />
            ))}
          </div>
        ))}
        {status === 'LoadingMore' && (
          <div className="py-8 flex justify-center">
            <p className="text-muted-foreground">Loading more...</p>
          </div>
        )}
      </WindowVirtualizer>
    </main>
  )
}
