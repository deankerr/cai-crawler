# API Result Blob Storage Architecture

## Overview

This document describes the rationale, design, and guiding principles for the new approach to storing Civitai API results in the civitai-crawler project (2025 rewrite).

---

## Why This Change?

### 1. **Preserve All Data, Forever**
- Civitai's API is unstable, fields change, and undocumented data appears frequently.
- By storing the **entire, unmodified API response** as a stringified blob, we guarantee that no information is lost, even if our extractors or schemas are incomplete or buggy.

### 2. **Decoupling Extraction from Ingestion**
- Entity tables (`images`, `models`, `modelVersions`, etc.) only store the fields we need for querying and business logic.
- Extraction logic can be improved, rerun, or replaced at any time, using the original blobs as the source of truth.
- If new fields are needed, or bugs are found, we can re-extract from historical data without re-fetching from the API.

### 3. **Performance and Simplicity**
- Entity queries remain fast and simple, as they don't need to load or parse large blobs.
- The ingestion pipeline is robust to API changes and can be extended with new extractors or workflows independently.

### 4. **Debuggability and Auditability**
- If we see unexpected results, we can always inspect the original API response.
- Historical blobs allow us to track how entities change over time, and to detect when re-fetching is unnecessary.

### 5. **Future-Proofing**
- If Civitai adds new fields or changes formats, we already have the data.
- Enables new workflows (e.g., analytics, reprocessing, diffing) without changing the ingestion pipeline.

---

## Design Principles

- **Store each API entity as a separate blob.**
  - For endpoints returning arrays (e.g., `/images`), split and store each item individually.
  - For endpoints returning a parent with children (e.g., `/models/:id`), store both the parent and each child (e.g., modelVersion) as separate blobs.
- **Reference blobs from entity tables by entityId and endpoint.**
- **Blobs are immutable and append-only.** Never delete unless storage becomes a critical issue.
- **Index blobs by endpoint, params, entityType, entityId, parentId, and timestamp.**
- **No deduplication or storage optimization is performed at this stage.** Storage is cheap; data loss is expensive.

---

## Example Table Schema

```typescript
defineTable({
  endpoint: v.string(), // e.g., "/images", "/models/:id"
  params: v.optional(v.string()), // JSON-stringified query params
  entityType: v.string(), // "image", "model", "modelVersion"
  entityId: v.number(), // e.g., imageId, modelId, modelVersionId
  parentId: v.optional(v.number()), // e.g., modelId for modelVersion
  result: v.string(), // stringified JSON blob for this entity
  fetchedAt: v.string(), // ISO timestamp
})
```

---

## Tradeoffs

- **Pros:**
  - Maximum flexibility and future-proofing.
  - Easy to debug, audit, and reprocess.
  - Enables independent, parallel workflows.
- **Cons:**
  - Increased storage usage (not a concern at current scale).
  - Slightly more complex ingestion logic (splitting batch results).

---

## Migration Steps (Summary)

1. Remove `rawData`/`meta` fields from entity tables.
2. Add new `api_results` table as described above.
3. Update ingestion logic to split batch results and store each entity as a separate blob.
4. Update extractors to reference blobs by entityId.
5. Test with `/images` and `/models/:id` endpoints.

---

## Open Questions

- Should we deduplicate blobs if the same entity is fetched multiple times? (Currently, we store all versions for audit/history.)
- How should we handle parent/child relationships for complex endpoints?
- What is the best way to link entity tables to their source blobs for traceability?

---

## Conclusion

This architecture prioritizes **data preservation, flexibility, and debuggability** over storage efficiency. It is designed to support rapid iteration, robust error recovery, and future analytics or reprocessing needs.

If you are reading this and considering a change, **do not remove the blob storage layer without a very good reason**—it is the foundation for reliable, evolvable data workflows in this project. 