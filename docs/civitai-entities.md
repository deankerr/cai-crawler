# CivitAI Entities

This document outlines the core entities in the CivitAI API ecosystem, their relationships, and important attributes based on our observations from sample API responses.

## Entity Overview

The CivitAI API revolves around several key entities that represent different aspects of AI image generation models and their usage. Below is a detailed description of each entity and how they relate to one another.

## 1. Model

Models are the central entity in CivitAI, representing the AI image generation models themselves (like Checkpoints, LORAa, etc.).

### Key Attributes
- **id**: Unique identifier for the model
- **name**: The model's display name
- **description**: HTML-formatted description of the model
- **type**: Type of model (Checkpoint, TextualInversion, LORA, etc.)
- **nsfw**: Boolean indicating adult content
- **stats**: Download counts, ratings, etc.
- **creator**: Reference to the Creator who published it

### Relationships
- **creator**: References a single Creator
- **tags**: Contains array of Tags
- **modelVersions**: Contains array of ModelVersions

### Example Usage
```json
{
  "id": 15003,
  "name": "CyberRealistic",
  "type": "Checkpoint",
  "nsfw": false,
  "creator": {
    "username": "Cyberdelia",
    "image": "https://image.civitAI.com/xG1nkqKTMzGDvpLrqFT7WA/63c3d8a0-6f3b-4293-9be7-9efc8c1d9bc8/width=96/Cyberdelia.jpeg"
  },
  "tags": [
    "photorealistic",
    "female",
    "highly detailed",
    "base model",
    "beautiful",
    "male",
    "photorealism",
    "realistic"
  ],
  "modelVersions": [...]
}
```

## 2. ModelVersion

Represents a specific version/release of a Model, containing downloadable files and sample images.

### Key Attributes
- **id**: Unique identifier
- **modelId**: Reference to parent Model
- **name**: Version name (e.g., "v8.0")
- **createdAt**: Creation timestamp
- **baseModel**: Base model information 
- **trainedWords**: Array of special trained words
- **stats**: Download counts, ratings for this version
- **files**: Downloadable files for this version

### Relationships
- **model**: Parent Model it belongs to
- **files**: Contains array of ModelFiles
- **images**: Contains array of ModelImages (reduced forms of Image)

### Example Usage
```json
{
  "id": 1460987,
  "modelId": 15003,
  "name": "v8.0",
  "baseModel": "SD 1.5",
  "description": "My goal was to push the boundaries even further than the last version...",
  "stats": {
    "downloadCount": 15862,
    "ratingCount": 0,
    "thumbsUpCount": 806
  },
  "files": [...],
  "images": [...]
}
```

## 3. ModelFile

Represents an actual downloadable file for a ModelVersion, such as weights, configs, or VAEs.

### Key Attributes
- **id**: Unique identifier
- **name**: Filename
- **sizeKB**: File size in kilobytes
- **type**: File type (Model, VAE, etc.)
- **metadata**: Format info (fp16/fp32, pruned/full, etc.)
- **hashes**: Various hash algorithms for file verification
- **downloadUrl**: URL to download the file
- **primary**: Boolean indicating if it's the main file

### Relationships
- Always belongs to a ModelVersion

### Example Usage
```json
{
  "name": "cyberrealistic_v80.safetensors",
  "id": 1362148,
  "sizeKB": 2082667.150390625,
  "type": "Model",
  "metadata": {
    "fp": "fp16",
    "size": "pruned",
    "format": "SafeTensor"
  },
  "downloadUrl": "https://civitAI.com/api/download/models/1460987",
  "primary": true
}
```

## 4. ModelImage

A reduced representation of an Image that's associated with a ModelVersion. This is not a separate entity but rather a simplified view of the Image entity when returned by model-related endpoints.

### Key Attributes
- **url**: Image URL (this is the same URL as in the full Image entity)
- **width/height**: Dimensions
- **hash**: Perceptual hash for similarity comparison (may be the same as in the full Image)
- **meta**: Generation parameters (prompt, seed, etc.)

### Relationships
- Always belongs to a ModelVersion
- Corresponds to a full Image but lacks some properties (like id, stats, postId)

### Example Usage
```json
{
  "url": "https://image.civitAI.com/xG1nkqKTMzGDvpLrqFT7WA/dd0b7252-9b82-44e3-8631-dccc79e94019/width=1600/60055394.jpeg",
  "width": 1600,
  "height": 2400,
  "hash": "UREVEDrq_NM{?bt7yDR*Iq%MWYxux]oz%Mxu",
  "meta": {
    "prompt": "Portrait of a young woman with natural lighting...",
    "sampler": "DPM++ SDE",
    "cfgScale": 5,
    "steps": 30
  }
}
```

## 5. Image

User-uploaded or user-generated images, which may be associated with a model or not. This is the complete image entity returned by the images endpoint.

### Key Attributes
- **id**: Unique identifier
- **url**: Image URL (can be used to correlate with ModelImage)
- **width/height**: Dimensions
- **nsfw/nsfwLevel**: Adult content indicators
- **createdAt**: Upload timestamp
- **postId**: ID of the post containing this image
- **stats**: Community reaction statistics
- **meta**: Rich metadata including generation parameters and resource references

### Relationships
- **username**: References Creator/user
- Optional references to Model/ModelVersion in the meta.civitAIResources field
- May correspond to one or more ModelImages across different ModelVersions

### Example Usage
```json
{
  "id": 48399688,
  "url": "https://image.civitAI.com/xG1nkqKTMzGDvpLrqFT7WA/e82c268a-c450-4d2c-b9f4-057dd665c889/width=1466/e82c268a-c450-4d2c-b9f4-057dd665c889.jpeg",
  "nsfw": false,
  "nsfwLevel": "None",
  "postId": 10911709,
  "stats": {
    "likeCount": 203,
    "heartCount": 94
  },
  "meta": {
    "seed": 2243011553,
    "Model": "CyberRealistic_V7.0_FP16",
    "prompt": "Photo portrait of a 24-year-old Dutch woman...",
    "sampler": "DPM++ SDE",
    "cfgScale": 5,
    "resources": [
      {
        "hash": "e2617ad799",
        "name": "CyberRealistic_V7.0_FP16",
        "type": "model"
      }
    ]
  },
  "username": "Cyberdelia"
}
```

## 6. Creator

A user who creates and publishes models on CivitAI.

### Key Attributes
- **username**: Unique identifier
- **image**: Profile picture URL
- **modelCount**: Number of models created
- **link**: URL to creator's models

### Relationships
- Referenced by Models they've created
- Referenced by Images they've uploaded

### Example Usage
```json
{
  "username": "Cyberdelia",
  "modelCount": 4,
  "link": "https://civitAI.com/api/v1/models?username=Cyberdelia",
  "image": "https://image.civitAI.com/xG1nkqKTMzGDvpLrqFT7WA/63c3d8a0-6f3b-4293-9be7-9efc8c1d9bc8/width=96/Cyberdelia.jpeg"
}
```

## 7. Tag

Categorization labels for models.

### Key Attributes
- **name**: Tag text
- **modelCount**: Number of models with this tag
- **link**: URL to models with this tag
- **type**: Optional categorization (Character, Style, General)

### Relationships
- Referenced by Models

### Example Usage
```json
{
  "name": "photorealistic",
  "link": "https://civitAI.com/api/v1/models?tag=photorealistic"
}
```

## Entity Relationships Diagram

```
                ┌─────────┐
                │         │
                │   Tag   │◄────┐
                │         │     │
                └─────────┘     │
                                │
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│         │     │         │     │         │     │         │
│ Creator │◄────┤  Model  │────►│ModelVer │────►│ModelFile│
│         │     │         │     │ sion    │     │         │
└─────────┘     └─────────┘     └─────────┘     └─────────┘
      ▲                              │
      │                              │
      │                              ▼
      │                         ┌─────────┐
      │                         │ Model   │ (simplified
      │                         │ Image   │  view)
      │                         └─────────┘
      │                              ▲
      │                              │
      │         ┌─────────┐          │
      │         │         │          │
      └─────────┤  Image  │──────────┘
                │ (full)  │
                └─────────┘
```

## Notes

1. Most entities use pagination via metadata objects:
   - `PaginationMetadata`: For page-based navigation
   - `CursorMetadata`: For cursor-based navigation

2. References between entities are typically unidirectional:
   - A Model references its Creator, but Creator API responses don't include owned Models
   - A ModelVersion references its parent Model, but small Model previews are included in ModelVersion

3. **Important for Crawler Implementation**: 
   - ModelImage is actually a reduced representation of Image when returned from model-related endpoints
   - Images in ModelVersion responses don't include the Image ID, but they share the same URL and possibly the same hash
   - To correlate ModelImages with full Images, match by URL (most reliable) or hash
   - When crawling, it's important to deduplicate images by URL to avoid storing the same image multiple times
   - Consider maintaining a URL → Image ID mapping for efficient correlation
