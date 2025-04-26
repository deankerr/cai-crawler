import { fetchCreators } from './query/creators'
import { fetchImages } from './query/images'
import { fetchModelById } from './query/modelId'
import { fetchModels } from './query/models'
import { fetchModelVersionById } from './query/modelVersionId'
import { fetchModelVersionByHash } from './query/modelVersionsByHash'
import { fetchTags } from './query/tags'

// Test all endpoints
async function main() {
  try {
    // Test images endpoint
    console.log('Fetching images...')
    const images = await fetchImages({ limit: 4 })
    console.log(`Successfully fetched ${images.items.length} images`)

    // Test models endpoint
    console.log('Fetching models...')
    const models = await fetchModels({ limit: 2, types: ['Checkpoint'] })
    console.log(`Successfully fetched ${models.items.length} models`)

    // Test modelId endpoint
    if (models.items && models.items.length > 0 && models.items[0]) {
      const modelId = models.items[0].id
      console.log(`Fetching model with ID ${modelId}...`)
      const model = await fetchModelById(modelId)
      console.log(`Successfully fetched model: ${model.name}`)

      // Test modelVersionId endpoint
      if (model.modelVersions && model.modelVersions.length > 0) {
        const modelVersion = model.modelVersions[0]
        if (modelVersion && modelVersion.id) {
          const modelVersionId = modelVersion.id
          console.log(`Fetching model version with ID ${modelVersionId}...`)
          const modelVersionDetails = await fetchModelVersionById(modelVersionId)
          console.log(`Successfully fetched model version: ${modelVersionDetails.name}`)

          // Test modelVersionsByHash endpoint if we have a hash
          if (
            modelVersionDetails.files
            && modelVersionDetails.files.length > 0
            && modelVersionDetails.files[0]?.hashes
          ) {
            const hashesObj = modelVersionDetails.files[0].hashes
            if (hashesObj) {
              const keys = Object.keys(hashesObj)
              if (keys.length > 0) {
                const firstHashKey = keys[0]
                if (firstHashKey && hashesObj[firstHashKey]) {
                  const hash = hashesObj[firstHashKey]
                  console.log(`Fetching model version by hash ${hash}...`)
                  try {
                    const modelVersionByHash = await fetchModelVersionByHash(hash)
                    console.log(`Successfully fetched model version by hash: ${modelVersionByHash.name}`)
                  }
                  catch (error: any) {
                    console.log(`Could not fetch model version by hash: ${error?.message || 'Unknown error'}`)
                  }
                }
              }
            }
          }
        }
      }
    }

    // Test creators endpoint
    console.log('Fetching creators...')
    const creators = await fetchCreators({ limit: 5 })
    console.log(`Successfully fetched ${creators.items.length} creators`)

    // Test tags endpoint
    console.log('Fetching tags...')
    const tags = await fetchTags({ limit: 10 })
    console.log(`Successfully fetched ${tags.items.length} tags`)

    console.log('All tests completed successfully!')
  }
  catch (error) {
    console.error('Error during tests:', error)
  }
}

main().catch(console.error)
