/**
 * Builds a URL from a base URL and path segments, returning a URL object
 * that can be further manipulated or converted to string
 *
 * @param baseUrl - The base URL (e.g., 'https://example.com')
 * @param pathSegments - Array of path segments or a single path string to append
 * @param params - Object of search parameters
 * @returns URL object
 */
export function buildURL(
  baseUrl: string,
  pathSegments: (string | number)[] = [],
  params: Record<string, string | number | boolean | null | undefined> = {},
): URL {
  const url = new URL(baseUrl)

  const segments: string[] = [url.pathname, ...pathSegments.map(segment => String(segment))]
  url.pathname = segments
    .filter(Boolean) // Remove empty segments
    .join('/')
    .replace(/\/+/g, '/') // Replace multiple slashes with a single slash

  // Add search parameters
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      url.searchParams.append(key, String(value))
    }
  })

  return url
}

/**
 * Gets the path and query string portion of a URL
 *
 * @param url - URL to extract from
 * @returns Path and query portion (e.g., '/users/profile?id=123')
 */
export function getPathAndQuery(url: string | URL): string {
  const urlObj = url instanceof URL ? url : new URL(url)
  const search = urlObj.searchParams.toString()

  return urlObj.pathname + (search ? `?${search}` : '')
}
