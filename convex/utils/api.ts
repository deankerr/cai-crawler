/**
 * Utility function to fetch data from Civitai API
 *
 * Handles constructing URLs with parameters and adding API key if available
 */
export async function fetchFromCivitai(
  endpoint: string,
  params: Record<string, any> = {},
): Promise<any> {
  const apiKey = process.env.CIVITAI_API_KEY

  // Convert params to query string
  const searchParams = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      searchParams.append(key, String(value))
    }
  })

  const queryString = searchParams.toString()
  const url = `https://civitai.com/api/v1${endpoint}${queryString ? `?${queryString}` : ''}`

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`
  }

  try {
    console.log(`Fetching from Civitai API: ${endpoint}`)
    const response = await fetch(url, { headers })

    if (!response.ok) {
      throw new Error(`Failed to fetch from Civitai API: ${response.status} ${response.statusText}`)
    }

    return await response.json()
  }
  catch (error) {
    console.error(`Error fetching from Civitai API (${endpoint}):`, error)
    throw error
  }
}
