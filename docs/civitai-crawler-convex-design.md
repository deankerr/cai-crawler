# Civitai Crawler - Convex Implementation Design

## 1. Overview

This document outlines the architecture for a Civitai API crawler system built on Convex. The system will fetch, store, and make queryable data from the Civitai API, handling rate limiting, queueing, and providing a local cache of models, model versions, images, and related metadata.

## 2. Technology Stack

- **Backend Platform**: Convex (database, functions, actions)
- **Storage**: Convex + R2 (for blob/asset storage)
- **Schema Validation**: Zod
- **Runtime**: Convex Node.js environment

## 3. Core Components

### 3.1 Data Model

The system will use Convex tables for the following entities:

#### Images

```typescript
// convex/schema.ts
export const images = defineTable({
  url: v.string(),
  width: v.number(),
  height: v.number(),
  nsfw: v.boolean(),
  nsfwLevel: v.string(),
  createdAt: v.string(),
  postId: v.optional(v.number()),
  hash: v.string(),
  username: v.string(),
  
  // References to other entities
  referencedModels: v.array(
    v.object({
      type: v.string(), // "checkpoint", "lora", etc.
      id: v.optional(v.number()),
      versionId: v.optional(v.number()),
      weight: v.optional(v.number()),
      hash: v.optional(v.string()),
      name: v.optional(v.string()),
    })
  ),
  
  // Storage reference
  storageId: v.optional(v.string()),
  
  // Stats for sorting
  totalReactions: v.number(),
  stats: v.object({
    likeCount: v.number(),
    heartCount: v.number(),
    laughCount: v.number(),
    cryCount: v.number(),
    commentCount: v.number(),
  }),
  
  // Original data
  meta: v.any(),
  rawData: v.any(),
  
  // Processing metadata
  processedAt: v.optional(v.string()),
  processingErrors: v.optional(v.array(v.string())),
}).index("by_hash", ["hash"])
  .index("by_username", ["username"])
  .index("by_createdAt", ["createdAt"]);
  ```

#### Models

```typescript
export const models = defineTable({
  modelId: v.number(),
  name: v.string(),
  description: v.string(),
  type: v.string(), // "Checkpoint", "LoRA", etc.
  nsfw: v.boolean(),
  
  // Creator reference
  creatorUsername: v.string(),
  
  // Stats
  stats: v.object({
    downloadCount: v.number(),
    favoriteCount: v.number(),
    commentCount: v.number(),
    ratingCount: v.number(),
    rating: v.number(),
  }),
  
  // Tags
  tags: v.array(v.string()),
  
  // Version references
  versionIds: v.array(v.number()),
  
  // Original data
  rawData: v.any(),
  
  // Processing metadata
  processedAt: v.optional(v.string()),
  processingErrors: v.optional(v.array(v.string())),
}).index("by_modelId", ["modelId"])
  .index("by_creator", ["creatorUsername"])
  .index("by_type", ["type"]);
```

#### ModelVersions

```typescript
export const modelVersions = defineTable({
  versionId: v.number(),
  modelId: v.number(),
  name: v.string(),
  createdAt: v.string(),
  baseModel: v.string(), // "SD 1.5", "SDXL", etc.
  
  // Files
  files: v.array(
    v.object({
      id: v.number(),
      name: v.string(),
      type: v.string(),
      sizeKB: v.number(),
      hashes: v.map(v.string(), v.string()),
      downloadUrl: v.string(),
      primary: v.optional(v.boolean()),
    })
  ),
  
  // Image references
  imageIds: v.array(v.id("images")),
  
  // Original data
  rawData: v.any(),
  
  // Processing metadata
  processedAt: v.optional(v.string()),
  processingErrors: v.optional(v.array(v.string())),
}).index("by_versionId", ["versionId"])
  .index("by_modelId", ["modelId"])
  .index("by_createdAt", ["createdAt"]);
```

#### Creators

```typescript
export const creators = defineTable({
  username: v.string(),
  image: v.optional(v.string()),
  
  // References
  modelIds: v.array(v.number()),
  imageIds: v.array(v.id("images")),
  
  // Original data
  rawData: v.any(),
  
  // Processing metadata
  processedAt: v.optional(v.string()),
  processingErrors: v.optional(v.array(v.string())),
}).index("by_username", ["username"]);
```

### 3.2 API Client

The API client will be implemented as Convex actions to allow for external API calls:

```typescript
// convex/actions/api.ts
export const fetchFromCivitai = action({
  args: {
    endpoint: v.string(),
    params: v.any(),
  },
  handler: async (ctx, args) => {
    const { endpoint, params } = args;
    const apiKey = process.env.CIVITAI_API_KEY;
    
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.append(key, value.toString());
      }
    });
    
    const queryString = searchParams.toString();
    const url = `https://civitai.com/api/v1${endpoint}${queryString ? `?${queryString}` : ''}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }
    
    const response = await fetch(url, { headers });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch from ${endpoint}: ${response.statusText}`);
    }
    
    return await response.json();
  },
});
```

### 3.3 Processing Pipeline

For our initial POC, we'll focus on a workflow that processes a page of images:

```typescript
// convex/actions/images.ts
export const processImagesPage = action({
  args: {
    params: v.object({
      limit: v.optional(v.number()),
      page: v.optional(v.number()),
      modelVersionId: v.optional(v.number()),
      // other params as needed
    }),
  },
  handler: async (ctx, args) => {
    // 1. Fetch a page of images from Civitai
    const imagesData = await ctx.runAction(api.fetchFromCivitai, {
      endpoint: "/images",
      params: args.params,
    });
    
    // 2. Process each image sequentially
    const results = [];
    for (const imageData of imagesData.items) {
      try {
        const result = await ctx.runAction(internal.processImage, {
          imageData,
        });
        results.push(result);
      } catch (error) {
        console.error(`Error processing image ${imageData.id}:`, error);
        results.push({ id: imageData.id, error: error.message });
      }
    }
    
    return {
      processed: results,
      metadata: imagesData.metadata,
    };
  },
});

// This is an internal action that can be called by the main action
const processImage = internalAction({
  args: {
    imageData: v.any(),
  },
  handler: async (ctx, args) => {
    const { imageData } = args;
    
    // 1. Extract data and references we're interested in
    const referencedModels = extractModelReferences(imageData);
    
    // 2. Store the image in Convex
    const imageId = await ctx.runMutation(internal.storeImage, {
      imageData,
      referencedModels,
    });
    
    // 3. Store the image file in R2 (stubbed for now)
    // This will be implemented later
    
    // 4. Process referenced models/versions
    for (const ref of referencedModels) {
      if (ref.id) {
        // Check if model exists, fetch if not
        const modelExists = await ctx.runQuery(internal.modelExists, { modelId: ref.id });
        if (!modelExists) {
          await ctx.runAction(internal.fetchAndStoreModel, { modelId: ref.id });
        }
      }
      
      if (ref.versionId) {
        // Check if version exists, fetch if not
        const versionExists = await ctx.runQuery(internal.modelVersionExists, { versionId: ref.versionId });
        if (!versionExists) {
          await ctx.runAction(internal.fetchAndStoreModelVersion, { versionId: ref.versionId });
        }
      }
    }
    
    // 5. Process creator
    const creatorExists = await ctx.runQuery(internal.creatorExists, { username: imageData.username });
    if (!creatorExists) {
      await ctx.runAction(internal.fetchAndStoreCreator, { username: imageData.username });
    }
    
    return { id: imageId, processed: true };
  },
});
```

### 3.4 Helper Functions

We'll need helper functions to extract references from images:

```typescript
// convex/utils/extractors.ts
export function extractModelReferences(imageData) {
  const references = [];
  
  // Extract from meta.prompt if it exists
  if (imageData.meta?.prompt) {
    // Parse LoRA references from prompt
    // Format is typically <lora:model_name:weight>
    const loraMatches = imageData.meta.prompt.match(/<lora:([^:]+):([^>]+)>/g);
    if (loraMatches) {
      for (const match of loraMatches) {
        const parts = match.match(/<lora:([^:]+):([^>]+)>/);
        if (parts && parts.length >= 3) {
          references.push({
            type: "lora",
            name: parts[1],
            weight: parseFloat(parts[2]),
          });
        }
      }
    }
  }
  
  // Extract from resources if they exist (more structured)
  if (imageData.meta?.resources) {
    for (const resource of imageData.meta.resources) {
      references.push({
        type: resource.type.toLowerCase(),
        name: resource.name,
        id: resource.modelId,
        versionId: resource.modelVersionId,
        weight: resource.weight,
      });
    }
  }
  
  return references;
}
```

## 4. Storage Strategy

### 4.1 Convex Database

Convex will store all the document/structured data as described in the schema section.

### 4.2 R2 Storage

Images and potentially other assets will be stored in R2:

```typescript
// To be implemented:
// Functionality to store images in R2 and reference them from Convex
```

## 5. Expansion Plan

### 5.1 Initial POC

1. Implement the basic processing of a single page of images
2. Extract and store model references
3. Implement simple R2 storage integration

### 5.2 Full Implementation

1. Implement Convex scheduled tasks for regular crawling
2. Add rate limiting and backoff strategies
3. Create task queue with prioritization
4. Implement full asset storage in R2 with proper organization
5. Create query endpoints for cached data

### 5.3 Future Enhancements

1. User interface for crawl status and statistics
2. Advanced search capabilities
3. Civitai-compatible API endpoints
4. Analytics on stored data

## 6. Next Steps

For immediate implementation:

1. Set up Convex schema
2. Create API action for fetching images
3. Implement the image processing pipeline
4. Add model/version reference handling
5. Test end-to-end with a small batch of images

This design will evolve as we learn more about the system's behavior and Convex's capabilities. 