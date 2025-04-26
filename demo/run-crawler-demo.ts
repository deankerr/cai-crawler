/**
 * This is a simple client script to test our Civitai crawler workflow
 *
 * Run with: bun demo/run-crawler-demo.ts
 */

import { ConvexClient } from 'convex/browser'
import { api } from '../convex/_generated/api'

async function main() {
  console.log('Starting Civitai crawler demo client...')

  const client = new ConvexClient(process.env.CONVEX_URL || '')

  try {
    console.log('Running crawler demo workflow...')
    console.log('------------------------------')

    const result = await client.action(api.action.workflow.runCrawlerDemo, {
      limit: 50,
      nsfw: false,
      sort: 'Most Reactions',
      period: 'Month',
      processModels: true,
    })

    console.log('------------------------------')
    console.log('Crawler demo workflow complete!')
    console.log(`Processed ${result.totalImages} images (${result.newImages} new)`)
    console.log(`Found ${result.modelReferencesFound.checkpoints} checkpoints and ${result.modelReferencesFound.loras} LoRAs`)
    console.log(`Total duration: ${result.durationMs}ms`)

    // Present model/modelVersion/creator stats
    console.log('\nModel Processing Stats:')
    console.table([
      { Type: 'Models', ...result.modelsProcessed.models },
      { Type: 'Model Versions', ...result.modelsProcessed.modelVersions },
      { Type: 'Creators', ...result.modelsProcessed.creators },
    ])

    // Insufficient data
    console.log('\nReferences with insufficient data:', result.modelsProcessed.insufficientData)

    // Reference summary
    console.log('\nReference Summary:')
    console.table([
      { Type: 'Checkpoints', Count: result.modelReferencesFound.checkpoints },
      { Type: 'LoRAs', Count: result.modelReferencesFound.loras },
      { Type: 'Total', Count: result.modelReferencesFound.total },
    ])
  }
  catch (error) {
    console.error('Error running crawler demo workflow:', error)
  }
  finally {
    // Disconnect the client when done
    await client.close()
  }
}

main().catch(console.error)
