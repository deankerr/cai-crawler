# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Asset and metadata crawler for CivitAI API using Convex for database/orchestration and Cloudflare R2/Worker/Queue for asset storage. Strategy is data preservation focused - storing full JSON payloads first, then processing into structured documents in a second step. This allows continued collection without validation issues and enables enrichment over time.

## Data Statistics

- There are currently 111,000+ images/entitySnapshots in the production database. NEVER `collect` these tables.

## Commands

Development:
- `bun run dev` - Start both frontend (React Router) and backend (Convex) concurrently
- `bun run dev:frontend` - React Router dev server only
- `bun run dev:backend` - Convex dev server only

Code quality:
- `bun check` - Run typecheck and lint together (use this to validate code)
- `bun typecheck` - TypeScript type checking
- `bun lint` - ESLint with auto-fix

Build and deploy:
- `bun run build` - Build for production
- `bun run start` - Start production server
- `bun run typegen` - Generate React Router types

## Architecture

### Two-Step Processing Pattern

1. **Raw capture** → `entitySnapshots` table stores stringified JSON from CivitAI API responses
2. **Structured processing** → Parse snapshots into typed documents (e.g., `images` table)

This pattern is critical:
- Never reject data due to validation issues during collection
- Can reprocess entities by updating extractors without re-fetching
- All entitySnapshots link back to their processed document via `processedDocumentId`

### Task Queue System

Uses Convex Workpool component for distributed task processing:

1. **Query insertion** → `insertQuery()` creates a `queries` document and enqueues a worker
2. **Worker picks task** → `startTask()` finds highest priority pending query
3. **Fetch and process** → `worker()` fetches CivitAI API, creates entitySnapshots, processes to images
4. **Continue or complete** → `endTask()` updates cursor for next page or marks complete
5. **Worker re-enqueues** → Continues processing until no pending queries remain

Priority system: higher number = higher priority (default: 10)

### Asset Storage Flow

Images/videos are stored in Cloudflare R2:
1. After image document inserted, `storage.enqueue()` scheduled with `sourceUrl` and `storageKey`
2. Tasks batched (max 100) and sent to Cloudflare Worker endpoint via `up-fetch`
3. Worker pulls asset from CivitAI CDN and stores in R2 with key: `images/{imageId}`
4. Frontend retrieves via `${VITE_ASSETS_BASE_URL}/images/${imageId}`

Note: Many "images" are actually videos - check for `.mp4` extension in original URL.

### Database Schema

**entitySnapshots**: Raw API response storage
- `entityType`: 'image' | 'model' | 'modelVersion'
- `entityId`: CivitAI entity ID
- `queryKey`: Which API query produced this
- `rawData`: Stringified JSON blob
- `processedDocumentId`: Link to processed doc (optional until processed)

**images**: Processed image documents
- `imageId`: CivitAI image ID (unique, indexed)
- `url`, `width`, `height`, `nsfw`, `nsfwLevel`, `createdAt`
- `username`, `postId`, `blurHash`
- `storageKey`: R2 storage key (format: `images/{imageId}`)
- `models`: Array of extracted model references (checkpoints, loras, etc.)
- `stats`: Reaction counts (like, heart, laugh, cry, comment)
- `totalReactions`: Computed sum for sorting
- `entitySnapshotId`: Link back to source snapshot

**queries**: Task queue entries
- `status`: 'pending' | 'in_progress' | 'completed' | 'failed' | 'stopped'
- `url`: Current API URL with cursor
- `priority`: Sort order for task picking
- `limit`: Max items to collect
- `count`: Items collected so far

### CivitAI API

Base URL: `https://civitai.com/api`

Currently used endpoints:
- `GET /v1/images` - Main query endpoint

Query builders in `tasks.ts`:
- `addImagesByModelVersionQuery` - Images for specific model version
- `addImagesByModelQuery` - Images for specific model (all versions)
- `addImagesByUsernameQuery` - Images by user
- `addImagesMonthlyTopQuery` - Top collected images this month

Supported parameters: `modelVersionId`, `modelId`, `username`, `nsfw`, `sort`, `period`, `cursor`

API uses cursor-based pagination via `metadata.nextCursor`.

## Convex Specifics

- Workpool component configured as `civitaiWorkpool` in `convex.config.ts`
- Uses `asyncMap` from convex-helpers for parallel db operations
- Actions are internal by default (pattern: `internalAction`, `internalMutation`, `internalQuery`)
- Public queries in `images.ts`: `list` (paginated), `get` (by id)
- When calling functions in same file, annotate return type to avoid circularity: `const result: string = await ctx.runQuery(...)`
- Schema validation enabled - set to `false` in `schema.ts` for unrestricted data modifications

## Frontend (React Router 7)

- Routes: `/` (home with infinite scroll image grid), `/images/:id` (image detail modal)
- Uses `virtua` for virtual scrolling performance
- TailwindCSS v4 + shadcn/ui components
- Add components: `bunx shadcn@latest add <name>`

## Development Notes

- System is single-user only, managed via Convex Dashboard
- Only processing images currently (no model data beyond what's in image records)
- Never consider backwards compatibility - refactor/delete freely
- Functions should be idempotent where possible
- Fail fast - don't catch errors just to log (Convex logs automatically)
- No Docker, no tests
- Bun is the package manager and runtime
