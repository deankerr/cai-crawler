import { fetchImages } from './query/images'
import { fetchModelById } from './query/modelId'
import { fetchModels } from './query/models'
import { fetchModelVersionById } from './query/modelVersionId'
import { fetchModelVersionByHash } from './query/modelVersionsByHash'
import { fetchTags } from './query/tags'

const DEMO_MODEL_ID = 15003 // CyberRealistic
const DEMO_MODEL_VERSION_ID = 1218156 // v7.0
const DEMO_MODEL_HASH = '99FDC43DD3D0' // v7.0

// Test all endpoints
async function main() {
  try {
    // Test images endpoint
    console.log('Fetching images...')
    const images = await fetchImages({ limit: 4, modelVersionId: DEMO_MODEL_VERSION_ID, nsfw: false })
    console.log(`Successfully fetched ${images.items.length} images`)

    // Test models endpoint
    console.log('Fetching models...')
    const models = await fetchModels({ limit: 2, types: ['Checkpoint'], nsfw: false })
    console.log(`Successfully fetched ${models.items.length} models`)

    // Test modelId endpoint
    console.log(`Fetching model with ID ${DEMO_MODEL_ID}...`)
    const model = await fetchModelById(DEMO_MODEL_ID)
    console.log(`Successfully fetched model: ${model.name}`)

    // Test modelVersionId endpoint
    console.log(`Fetching model version with ID ${DEMO_MODEL_VERSION_ID}...`)
    const modelVersionDetails = await fetchModelVersionById(DEMO_MODEL_VERSION_ID)
    console.log(`Successfully fetched model version: ${modelVersionDetails.name}`)

    // Test modelVersionsByHash endpoint
    console.log(`Fetching model version by hash ${DEMO_MODEL_HASH}...`)
    const modelVersionByHash = await fetchModelVersionByHash(DEMO_MODEL_HASH)
    console.log(`Successfully fetched model version by hash: ${modelVersionByHash.name}`)

    // Test creators endpoint
    // NOTE: This endpoint barely works and is not useful
    // console.log('Fetching creators...')
    // const creators = await fetchCreators({ limit: 2 })
    // console.log(`Successfully fetched ${creators.items.length} creators`)

    // Test tags endpoint`
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
