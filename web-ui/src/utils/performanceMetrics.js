function round(value) {
  return Number.isFinite(value) ? Math.round(value) : null
}

export function percentile(values, ratio) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1))
  return round(sorted[index])
}

function isApiResource(entry) {
  try {
    return new URL(entry.name, 'http://local').pathname.startsWith('/api/')
  } catch {
    return false
  }
}

function isStaticResource(entry) {
  try {
    return new URL(entry.name, 'http://local').pathname.startsWith('/assets/')
  } catch {
    return false
  }
}

export function collectPerformanceSnapshot(perf = globalThis.performance) {
  const navigation = perf?.getEntriesByType?.('navigation')?.[0] || null
  const resources = perf?.getEntriesByType?.('resource') || []
  const apiEntries = resources.filter(isApiResource)
  const staticEntries = resources.filter(isStaticResource)
  const apiDurations = apiEntries.map(entry => Number(entry.duration)).filter(Number.isFinite)
  const staticBytes = staticEntries.reduce((sum, entry) => {
    const rawSize = entry.transferSize === undefined ? entry.encodedBodySize : entry.transferSize
    const size = Number(rawSize || 0)
    return sum + (Number.isFinite(size) ? size : 0)
  }, 0)
  const cachedStaticCount = staticEntries.filter(entry => (
    Number(entry.transferSize) === 0 && Number(entry.decodedBodySize || entry.encodedBodySize) > 0
  )).length

  return {
    navigation: {
      ttfbMs: round(navigation?.responseStart),
      interactiveMs: round(navigation?.domInteractive),
      loadMs: round(navigation?.loadEventEnd || navigation?.duration),
    },
    api: {
      count: apiEntries.length,
      p50Ms: percentile(apiDurations, 0.5),
      p95Ms: percentile(apiDurations, 0.95),
      maxMs: apiDurations.length ? round(Math.max(...apiDurations)) : null,
    },
    staticAssets: {
      count: staticEntries.length,
      transferredKb: round(staticBytes / 1024),
      cachedCount: cachedStaticCount,
    },
  }
}

export function getBuildVersion() {
  return import.meta.env.VITE_LINSHE_BUILD_VERSION || '1.0.0'
}
