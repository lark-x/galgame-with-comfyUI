import test from 'node:test'
import assert from 'node:assert/strict'
import {
  FX_MODES,
  FX_STORAGE_KEY,
  THEME_OPTIONS,
  THEME_STORAGE_KEY,
  applyFxMode,
  applyTheme,
  getStoredFxMode,
  getStoredThemeId,
  normalizeFxMode,
  normalizeThemeId,
  persistFxMode,
  persistThemeId,
} from '../src/themes.js'

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial))
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null },
    setItem(key, value) { values.set(key, String(value)) },
  }
}

test('exposes all supported themes with distinct presentation metadata', () => {
  assert.deepEqual(THEME_OPTIONS.map(theme => theme.id), ['default', 'elemental', 'ink', 'breeze', 'matcha'])
  assert.equal(new Set(THEME_OPTIONS.map(theme => theme.layout)).size, THEME_OPTIONS.length)
  assert.ok(THEME_OPTIONS.every(theme => theme.signature))
  assert.equal(THEME_OPTIONS[1].name, '元素冒险')
  assert.equal(THEME_OPTIONS.find(theme => theme.id === 'breeze').colorScheme, 'light')
  assert.equal(THEME_OPTIONS.find(theme => theme.id === 'ink').colorScheme, 'light')
  assert.equal(THEME_OPTIONS.find(theme => theme.id === 'matcha').swatches.length, 3)
  assert.ok(THEME_OPTIONS.every(theme => theme.colorScheme === 'light'))
})

test('normalizes unknown theme ids to the safe default', () => {
  assert.equal(normalizeThemeId('elemental'), 'elemental')
  assert.equal(normalizeThemeId('unknown'), 'default')
  assert.equal(normalizeThemeId(null), 'default')
  assert.equal(applyTheme('unknown'), 'default')
})

test('reads and persists only supported theme ids', () => {
  const storage = createStorage({ [THEME_STORAGE_KEY]: 'elemental' })
  assert.equal(getStoredThemeId(storage), 'elemental')
  assert.equal(persistThemeId('unknown', storage), 'default')
  assert.equal(getStoredThemeId(storage), 'default')
})

test('survives storage errors without breaking theme selection', () => {
  const brokenStorage = {
    getItem() { throw new Error('blocked') },
    setItem() { throw new Error('blocked') },
  }
  assert.equal(getStoredThemeId(brokenStorage), 'default')
  assert.equal(persistThemeId('elemental', brokenStorage), 'elemental')
})

test('reads, normalizes, and persists fx modes with safe fallback', () => {
  assert.equal(normalizeFxMode('dynamic'), 'dynamic')
  assert.equal(normalizeFxMode('static'), 'static')
  assert.equal(normalizeFxMode('unknown'), 'dynamic')
  assert.equal(applyFxMode('unknown'), 'dynamic')

  const storage = createStorage({ [FX_STORAGE_KEY]: 'static' })
  assert.equal(getStoredFxMode(storage), 'static')
  assert.equal(persistFxMode('unknown', storage), 'dynamic')
  assert.equal(getStoredFxMode(storage), 'dynamic')
  assert.equal(persistFxMode('static', storage), 'static')
  assert.equal(getStoredFxMode(storage), 'static')

  const brokenStorage = {
    getItem() { throw new Error('blocked') },
    setItem() { throw new Error('blocked') },
  }
  assert.equal(getStoredFxMode(brokenStorage), 'dynamic')
  assert.equal(persistFxMode('static', brokenStorage), 'static')
})
