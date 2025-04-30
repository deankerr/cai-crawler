import type { Id } from './_generated/dataModel'
import { httpRouter } from 'convex/server'
import { ConvexError } from 'convex/values'
import { internal } from './_generated/api'
import { httpAction } from './_generated/server'

const http = httpRouter()

// Define the expected structure
interface UpdateStorageArgs {
  imageId: Id<'images'>
  storageKey: string
  storedUrl: string
  size: number
  secret: string
}

// Simple type guard for basic validation
function isUpdateStorageArgs(obj: any): obj is UpdateStorageArgs {
  return (
    obj
    && typeof obj.imageId === 'string' // Convex IDs are strings
    && typeof obj.storageKey === 'string'
    && typeof obj.storedUrl === 'string'
    && typeof obj.size === 'number'
    && typeof obj.secret === 'string'
  )
}

http.route({
  path: '/hello',
  method: 'GET',
  handler: httpAction(async (ctx, request) => {
    return new Response('Hello, world!', { status: 200 })
  }),
})

http.route({
  path: '/updateImageStorage',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const expectedSecret = process.env.ASSETS_SECRET
    if (!expectedSecret) {
      console.error('ASSETS_SECRET environment variable not set in Convex deployment.')
      return new Response('Internal Server Error: Configuration missing', { status: 500 })
    }

    let body: any
    try {
      body = await request.json()
    }
    catch (error) {
      console.error('Failed to parse request body:', error)
      return new Response('Bad Request: Invalid JSON', { status: 400 })
    }

    // Manual type validation
    if (!isUpdateStorageArgs(body)) {
      console.error('Invalid request body structure or types:', body)
      return new Response(`Bad Request: Invalid body format`, { status: 400 })
    }

    // Now body is validated as UpdateStorageArgs
    const { imageId, storageKey, storedUrl, size, secret } = body

    if (secret !== expectedSecret) {
      console.warn('Unauthorized attempt to update image storage', { imageId, storageKey })
      return new Response('Unauthorized', { status: 401 })
    }

    console.log(`Received storage update callback for image ${imageId} with key ${storageKey}`)

    try {
      // We need to ensure imageId is a valid Id<'images'> format for the mutation
      // The type guard checks if it's a string, which is a basic check.
      // The mutation itself will provide stronger validation.
      await ctx.runMutation(internal.civitai.images.updateStorage, {
        imageId: imageId as Id<'images'>, // Cast needed after manual check
        storageKey,
        storedUrl,
        size,
      })
    }
    catch (error) {
      console.error(`Failed to update storage for image ${imageId}:`, error)
      // Check if it was a Convex validation error (e.g., invalid ID format)
      if (error instanceof ConvexError) {
        console.error('ConvexError during updateStorage mutation:', error.data)
        return new Response(`Bad Request: Invalid imageId format or data`, { status: 400 })
      }
      return new Response('Internal Server Error: Failed to update database', { status: 500 })
    }

    return new Response(JSON.stringify({ success: true, message: `Storage updated for image ${imageId}` }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })
  }),
})

export default http
