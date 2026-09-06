export function imageUrl(value) {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object') {
    if (typeof value.artifactId === 'string' && value.artifactId) {
      return `/api/images/artifacts/${encodeURIComponent(value.artifactId)}`
    }
    if (typeof value.url === 'string' && value.url) return value.url
    if (typeof value.src === 'string' && value.src) return value.src
    if (typeof value.base64 === 'string' && value.base64) return value.base64
  }
  return ''
}

export function normalizeImage(value) {
  if (value && typeof value === 'object') {
    return { ...value, url: imageUrl(value), base64: null }
  }
  return { url: imageUrl(value), base64: null }
}

export function normalizeImages(values) {
  return Array.isArray(values) ? values.map(normalizeImage).filter(img => img.url) : []
}

export function imageIdentity(value) {
  if (value && typeof value === 'object' && value.artifactId) return `artifact:${value.artifactId}`
  return imageUrl(value)
}
