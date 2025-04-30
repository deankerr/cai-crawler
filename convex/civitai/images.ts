import type { Doc, Id } from '../_generated/dataModel'
import type { ActionCtx, MutationCtx } from '../_generated/server'
import { v } from 'convex/values'
import { internal } from '../_generated/api'
import { action, internalMutation } from '../_generated/server'
import { generateStorageKey } from '../storage'
import { extractModelReferences } from '../utils/extractors'
import { Image } from './validators'

// TODO: Delete this module, rewrite the enqueue code in storage.ts

/**
 * Sends a task to the Cloudflare Worker endpoint to enqueue image storage processing.
 * Now includes the storageKey directly.
 */
async function enqueueStorageTaskViaWorker(ctx: ActionCtx, image: Doc<'images'>) {
  const workerEnqueueUrl = process.env.ASSETS_WORKER_ENQUEUE_URL
  const workerSecret = process.env.ASSETS_SECRET // Shared secret for Convex -> Worker

  if (!workerEnqueueUrl || !workerSecret) {
    console.error('Worker enqueue URL or secret not configured in Convex environment.')
    // Throw an error to potentially fail the calling action if config is missing
    throw new Error('Worker communication environment variables not set.')
  }

  // Ensure image.url and storageKey exist before proceeding
  if (!image.url || !image.storageKey) {
    console.warn(`Skipping enqueue for image ${image._id} due to missing URL or storageKey.`)
    return { success: false, error: 'Missing source URL or storageKey' }
  }

  const payload = {
    imageId: image._id,
    sourceUrl: image.url,
    storageKey: image.storageKey,
  }

  try {
    // Add a User-Agent
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${workerSecret}`,
      'User-Agent': 'ConvexCivitaiCrawler/1.0',
    }

    console.log(`Sending task to worker: ${workerEnqueueUrl}`, payload)
    const response = await fetch(workerEnqueueUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      console.error(`Worker endpoint returned error: ${response.status} ${response.statusText} - ${errorBody}`)
      throw new Error(`Failed to send task to worker endpoint: Status ${response.status}`)
    }

    const responseJson = await response.json() // Assuming worker returns { success: true }
    if (!responseJson.success) {
      console.warn(`Worker endpoint reported failure`, responseJson)
      throw new Error(`Worker endpoint reported failure.`)
    }

    console.log(`Successfully sent storage task to worker for image ${image._id}`)
    return { success: true }
  }
  catch (error) {
    console.error(`Error sending task to worker for image ${image._id}:`, error)
    // Return failure but don't necessarily throw from here, let the action decide
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}
