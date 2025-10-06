import type { Doc } from '../../convex/_generated/dataModel'
import { ImageDetail } from './ImageDetail'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'

type Image = Doc<'images'>

interface ImageModalProps {
  modalImageId: string | null
  modalImage: Image | null | undefined
  onClose: () => void
}

export function ImageModal({ modalImageId, modalImage, onClose }: ImageModalProps) {
  return (
    <Dialog open={!!modalImageId} onOpenChange={open => !open && onClose()}>
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
  )
}
