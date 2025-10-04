import type { Id } from '../../convex/_generated/dataModel'
import type { Route } from './+types/images.$id'
import { useQuery } from 'convex/react'
import { Link } from 'react-router'
import { api } from '../../convex/_generated/api'
import { ImageDetail } from '../components/ImageDetail'
import { Button } from '../components/ui/button'

export function meta({ params }: Route.MetaArgs) {
  return [
    { title: `Image ${params.id} - CivitAI Crawler` },
    { name: 'description', content: 'Image details' },
  ]
}

export default function ImageDetailPage({ params }: Route.ComponentProps) {
  const image = useQuery(api.images.get, { id: params.id as Id<'images'> })

  if (image === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (image === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Image not found</p>
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
        <ImageDetail image={image} />
      </main>
    </div>
  )
}
