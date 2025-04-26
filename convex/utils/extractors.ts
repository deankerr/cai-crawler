/**
 * Modular model reference extraction system
 *
 * This file contains specialized functions to extract model references from
 * Civitai image metadata. Each function focuses on a single pattern/location
 * and returns any data it finds.
 */

// Types for model references
export interface ModelReference {
  type: string
  name?: string
  id?: number
  versionId?: number
  weight?: number
  hash?: string
}

/**
 * Main extraction function that combines all specialized extractors
 *
 * @param imageData Raw image data from Civitai API
 * @returns Combined array of model references from all sources
 */
export function extractModelReferences(imageData: any): ModelReference[] {
  // Run all extractors and collect their results
  const extractors = [
    extractFromCivitaiResources,
    extractFromResources,
    extractFromModelField,
    extractFromHashes,
    extractFromPrompt,
    // Add new extractors here as patterns are discovered
  ]

  // Run each extractor and collect all references
  const allReferences: ModelReference[] = []

  for (const extractor of extractors) {
    try {
      const references = extractor(imageData)
      if (references.length > 0) {
        allReferences.push(...references)
      }
    }
    catch {
      // Silently continue if an extractor fails
      // We want to be resilient to different data formats
    }
  }

  // Consolidate and deduplicate references
  return consolidateReferences(allReferences)
}

/**
 * Extract model references from civitaiResources array
 *
 * Pattern: imageData.meta.civitaiResources array of objects with:
 * - type: "checkpoint" or "lora"
 * - modelVersionId: numeric ID
 * - modelVersionName: string version name
 * - weight (optional): numeric weight for LoRAs
 */
function extractFromCivitaiResources(imageData: any): ModelReference[] {
  const references: ModelReference[] = []

  if (imageData.meta?.civitaiResources && Array.isArray(imageData.meta.civitaiResources)) {
    for (const resource of imageData.meta.civitaiResources) {
      if (
        resource.type?.toLowerCase() === 'checkpoint'
        || resource.type?.toLowerCase() === 'lora'
      ) {
        references.push({
          type: resource.type.toLowerCase(),
          versionId: resource.modelVersionId,
          name: resource.modelVersionName,
          weight: resource.weight,
        })
      }
    }
  }

  return references
}

/**
 * Extract model references from resources array
 *
 * Pattern: imageData.meta.resources array of objects with:
 * - type: "lora" or other model type
 * - name: string name of model
 * - hash: string hash identifier
 * - modelId (optional): numeric model ID
 * - modelVersionId (optional): numeric version ID
 */
function extractFromResources(imageData: any): ModelReference[] {
  const references: ModelReference[] = []

  if (imageData.meta?.resources && Array.isArray(imageData.meta.resources)) {
    for (const resource of imageData.meta.resources) {
      // Only include checkpoints and loras
      if (
        resource.type?.toLowerCase() === 'checkpoint'
        || resource.type?.toLowerCase() === 'lora'
        || resource.type?.toLowerCase() === 'model'
      ) {
        references.push({
          type: resource.type?.toLowerCase() === 'model' ? 'checkpoint' : resource.type?.toLowerCase(),
          name: resource.name,
          id: resource.modelId,
          versionId: resource.modelVersionId,
          weight: resource.weight,
          hash: resource.hash,
        })
      }
    }
  }

  return references
}

/**
 * Extract main model reference from Model field
 *
 * Pattern: imageData.meta.Model string field with model name
 * May also have imageData.meta["Model hash"] with hash
 */
function extractFromModelField(imageData: any): ModelReference[] {
  const references: ModelReference[] = []

  if (imageData.meta?.Model) {
    const reference: ModelReference = {
      type: 'checkpoint',
      name: imageData.meta.Model,
    }

    // Try to find hash if it exists
    if (imageData.meta?.['Model hash']) {
      reference.hash = imageData.meta['Model hash']
    }

    references.push(reference)
  }

  return references
}

/**
 * Extract model references from hashes object
 *
 * Pattern: imageData.meta.hashes object with:
 * - model: hash for main model
 * - lora:name: hash for each lora
 */
function extractFromHashes(imageData: any): ModelReference[] {
  const references: ModelReference[] = []

  if (imageData.meta?.hashes && typeof imageData.meta.hashes === 'object') {
    const hashes = imageData.meta.hashes

    // Process main model hash
    if (hashes.model) {
      references.push({
        type: 'checkpoint',
        hash: hashes.model,
      })
    }

    // Process lora hashes (keys that start with "lora:")
    for (const key in hashes) {
      if (key.startsWith('lora:')) {
        const loraName = key.substring(5) // Remove "lora:" prefix
        references.push({
          type: 'lora',
          name: loraName,
          hash: hashes[key],
        })
      }
    }
  }

  return references
}

/**
 * Extract LoRA references from prompt text
 *
 * Pattern: <lora:model_name:weight> in imageData.meta.prompt
 */
function extractFromPrompt(imageData: any): ModelReference[] {
  const references: ModelReference[] = []

  if (imageData.meta?.prompt) {
    // Parse LoRA references from prompt
    // Format is typically <lora:model_name:weight>
    const loraMatches = imageData.meta.prompt.match(/<lora:([^:]+):([^>]+)>/g)
    if (loraMatches) {
      for (const match of loraMatches) {
        const parts = match.match(/<lora:([^:]+):([^>]+)>/)
        if (parts && parts.length >= 3) {
          references.push({
            type: 'lora',
            name: parts[1],
            weight: Number.parseFloat(parts[2]),
          })
        }
      }
    }
  }

  return references
}

/**
 * Consolidate references by merging duplicates and combining information
 *
 * This function tries to identify the same model referenced in different ways
 * and combines the information to create a more complete picture.
 */
function consolidateReferences(references: ModelReference[]): ModelReference[] {
  // Use a map to group references by identifiable properties
  const referenceMap = new Map<string, ModelReference>()

  for (const ref of references) {
    // Create keys for identification based on available properties
    const keys: string[] = []

    // Try to identify by versionId (most specific)
    if (ref.versionId) {
      keys.push(`versionId:${ref.versionId}`)
    }

    // Try to identify by model ID
    if (ref.id) {
      keys.push(`id:${ref.id}`)
    }

    // Try to identify by hash
    if (ref.hash) {
      keys.push(`hash:${ref.hash}`)
    }

    // Try to identify by name (least specific)
    if (ref.name) {
      keys.push(`${ref.type}:name:${ref.name.toLowerCase()}`)
    }

    // If we couldn't identify this reference, add it as is
    if (keys.length === 0) {
      const randomKey = `unknown:${Math.random()}`
      referenceMap.set(randomKey, ref)
      continue
    }

    // Try to merge with existing references using our keys
    let merged = false
    for (const key of keys) {
      if (referenceMap.has(key)) {
        // Merge with existing reference
        const existing = referenceMap.get(key)!
        referenceMap.set(key, mergeReferences(existing, ref))
        merged = true
        break
      }
    }

    // If not merged, add with first key
    if (!merged) {
      referenceMap.set(keys[0], ref)
    }
  }

  // Return consolidated references
  return Array.from(referenceMap.values())
}

/**
 * Merge two references that refer to the same model
 *
 * This combines information from both references, preferring more specific
 * information (IDs and hashes) over less specific (names).
 */
function mergeReferences(a: ModelReference, b: ModelReference): ModelReference {
  return {
    // Prefer consistent type, defaulting to a's type
    type: a.type || b.type,

    // Prefer IDs and hashes from either source
    id: a.id || b.id,
    versionId: a.versionId || b.versionId,
    hash: a.hash || b.hash,

    // For name and weight, prefer a if it exists
    name: a.name || b.name,
    weight: a.weight ?? b.weight,
  }
}
