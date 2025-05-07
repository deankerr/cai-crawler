import { z } from 'zod'

// shared

export const PaginationMetadata = z.object({
  totalItems: z.number().optional(),
  currentPage: z.number().optional(),
  pageSize: z.number().optional(),
  totalPages: z.number().optional(),
  nextPage: z.string().url().optional(),
  prevPage: z.string().url().optional(),
  nextCursor: z.string().optional(),
})

export const CursorMetadata = z.object({
  nextCursor: z.string().optional(),
  currentPage: z.number().optional(),
  pageSize: z.number().optional(),
  nextPage: z.string().url().optional(),
})

export const ItemsResponse = z.object({
  items: z.array(z.unknown()),
  metadata: CursorMetadata,
})

export const TimePeriod = z.enum(['AllTime', 'Year', 'Month', 'Week', 'Day'])

// images
export const NSFWLevel = z.enum(['None', 'Soft', 'Mature', 'X', 'XXX'])
export const SortOrder = z.enum(['Most Reactions', 'Most Collected', 'Most Comments', 'Newest'])

export const ImageQueryParams = z.object({
  limit: z.number().min(0).max(200).optional(),
  postId: z.number().optional(),
  modelId: z.number().optional(),
  modelVersionId: z.number().optional(),
  username: z.string().optional(),
  nsfw: z.union([z.boolean(), NSFWLevel]).optional(),
  sort: SortOrder.optional(),
  period: TimePeriod.optional(),
  page: z.number().optional(),
  // cursor: z.string().optional(),
})
export type ImageQueryParams = z.infer<typeof ImageQueryParams>

export const ImageMeta = z.record(z.string(), z.unknown()).nullable()

export const ImageStats = z.object({
  cryCount: z.number(),
  laughCount: z.number(),
  likeCount: z.number(),
  heartCount: z.number(),
  commentCount: z.number(),
})

export const Image = z.object({
  id: z.number(),
  url: z.string().url(),
  hash: z.string(),
  width: z.number(),
  height: z.number(),
  nsfw: z.boolean(),
  nsfwLevel: NSFWLevel,
  createdAt: z.string().datetime(),
  postId: z.number(),
  stats: ImageStats,
  meta: ImageMeta,
  username: z.string().nullable(),
})

export const ImagesResponse = z.object({
  items: z.array(Image),
  metadata: CursorMetadata,
})

// models
export const ModelSort = z.enum(['Highest Rated', 'Most Downloaded', 'Newest'])

export const CommercialUse = z.enum(['None', 'Image', 'Rent', 'Sell']).or(z.array(z.string()))

export const ModelMode = z.enum(['Archived', 'TakenDown']).nullable()

export const ModelStats = z.object({
  downloadCount: z.number(),
  favoriteCount: z.number().optional(),
  commentCount: z.number().optional(),
  ratingCount: z.number(),
  rating: z.number(),
})

export const ModelType = z.enum([
  'Checkpoint',
  'TextualInversion',
  'Hypernetwork',
  'AestheticGradient',
  'LORA',
  'Controlnet',
  'Poses',
])

export const FileMetadata = z.object({
  fp: z.enum(['fp16', 'fp32']).nullable().optional(),
  size: z.enum(['full', 'pruned']).nullable().optional(),
  format: z.enum(['SafeTensor', 'PickleTensor', 'Other']).optional(),
})

export const ModelFile = z.object({
  name: z.string(),
  id: z.number(),
  sizeKB: z.number(),
  type: z.string(),
  metadata: FileMetadata.optional(),
  pickleScanResult: z.string(),
  pickleScanMessage: z.string().optional(),
  virusScanResult: z.string(),
  scannedAt: z.string().datetime().nullable(),
  hashes: z.record(z.string(), z.string()).optional(),
  downloadUrl: z.string().url(),
  primary: z.boolean().optional(),
})

export const ModelImage = z.object({
  url: z.string().url(),
  nsfw: z.boolean().optional(),
  width: z.number(),
  height: z.number(),
  hash: z.string(),
  meta: ImageMeta.optional(),
})

export const ModelVersion = z.object({
  id: z.number(),
  modelId: z.number().optional(),
  name: z.string(),
  description: z.string().nullable(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
  trainedWords: z.array(z.string()).optional(),
  baseModel: z.string().optional(),
  earlyAccessTimeFrame: z.number().optional(),
  downloadUrl: z.string().url(),
  stats: z.object({
    downloadCount: z.number(),
    ratingCount: z.number(),
    rating: z.number(),
  }),
  files: z.array(ModelFile),
  images: z.array(ModelImage),
})

export const Model = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string(),
  type: ModelType,
  poi: z.boolean().optional(),
  nsfw: z.boolean(),
  allowNoCredit: z.boolean().optional(),
  allowCommercialUse: CommercialUse.optional(),
  allowDerivatives: z.boolean().optional(),
  allowDifferentLicense: z.boolean().optional(),
  stats: ModelStats,
  creator: z.object({
    username: z.string().nullable(),
    image: z.string().url().nullable(),
  }),
  tags: z.array(z.object({
    name: z.string(),
  })).or(z.array(z.string())),
  mode: ModelMode.optional(),
  modelVersions: z.array(ModelVersion),
})

export const ModelsQueryParams = z.object({
  limit: z.number().min(1).max(100).optional(),
  page: z.number().optional(),
  query: z.string().optional(),
  tag: z.string().optional(),
  username: z.string().optional(),
  types: z.array(ModelType).optional(),
  sort: ModelSort.optional(),
  period: TimePeriod.optional(),
  rating: z.number().optional(),
  favorites: z.boolean().optional(),
  hidden: z.boolean().optional(),
  primaryFileOnly: z.boolean().optional(),
  allowNoCredit: z.boolean().optional(),
  allowDerivatives: z.boolean().optional(),
  allowDifferentLicenses: z.boolean().optional(),
  allowCommercialUse: CommercialUse.optional(),
  nsfw: z.boolean().optional(),
  supportsGeneration: z.boolean().optional(),
})

export const ModelsResponse = z.object({
  items: z.array(Model),
  metadata: PaginationMetadata,
})

// modelVersions
export const ModelVersionParent = z.object({
  name: z.string(),
  type: ModelType,
  nsfw: z.boolean(),
  poi: z.boolean().optional(),
  mode: ModelMode.optional(),
})

export const ModelVersionWithParent = ModelVersion.extend({
  modelId: z.number(),
  createdAt: z.string().datetime(),
  model: ModelVersionParent,
})
