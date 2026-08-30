import test from 'node:test'
import assert from 'node:assert/strict'
import { collectPerformanceSnapshot, percentile } from '../src/utils/performanceMetrics.js'

test('calculates nearest-rank percentiles', () => {
  assert.equal(percentile([40, 10, 20, 30], 0.5), 20)
  assert.equal(percentile([40, 10, 20, 30], 0.95), 40)
  assert.equal(percentile([], 0.5), null)
})

test('summarizes navigation, api and static resource timings', () => {
  const perf = {
    getEntriesByType(type) {
      if (type === 'navigation') return [{ responseStart: 125.4, domInteractive: 420.1, loadEventEnd: 610.8 }]
      return [
        { name: 'https://example.test/api/characters', duration: 90, transferSize: 500 },
        { name: 'https://example.test/api/config', duration: 310, transferSize: 600 },
        { name: 'https://example.test/assets/index.js', duration: 40, transferSize: 102400, encodedBodySize: 102400 },
        { name: 'https://example.test/assets/view.js', duration: 20, transferSize: 0, encodedBodySize: 10240, decodedBodySize: 20480 },
        { name: 'https://example.test/images/avatar.png', duration: 30, transferSize: 2000 },
      ]
    },
  }
  const snapshot = collectPerformanceSnapshot(perf)
  assert.deepEqual(snapshot.navigation, { ttfbMs: 125, interactiveMs: 420, loadMs: 611 })
  assert.deepEqual(snapshot.api, { count: 2, p50Ms: 90, p95Ms: 310, maxMs: 310 })
  assert.deepEqual(snapshot.staticAssets, { count: 2, transferredKb: 100, cachedCount: 1 })
})
