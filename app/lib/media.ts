export function isVideoUrl(url: string) {
  const videoExtensions = ['.mp4', '.webm', '.mov', '.avi', '.m4v']
  const urlLower = url.toLowerCase()
  return videoExtensions.some(ext => urlLower.includes(ext))
}

export function getAssetUrl(storageKey: string | undefined) {
  if (!storageKey) {
    return null
  }
  const assetsBaseUrl = import.meta.env.VITE_ASSETS_BASE_URL
  if (!assetsBaseUrl) {
    console.error('VITE_ASSETS_BASE_URL not configured')
    return null
  }
  return `${assetsBaseUrl}/${storageKey}`
}
