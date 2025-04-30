import { httpRouter } from 'convex/server'
import { httpAction } from './_generated/server'

const http = httpRouter()

// Basic health check or test route
http.route({
  path: '/hello',
  method: 'GET',
  handler: httpAction(async (_ctx, _request) => {
    // Added underscores to unused ctx and request parameters
    return new Response('Hello from Convex HTTP Router!', { status: 200 })
  }),
})

// Removed the /updateImageStorage route as the worker callback is no longer used
/*
http.route({
  path: '/updateImageStorage',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
     // ... implementation removed ...
  }),
})
*/

export default http
