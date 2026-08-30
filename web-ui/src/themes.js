export const THEME_STORAGE_KEY = 'linshe-theme'
export const FX_STORAGE_KEY = 'linshe-fx-mode'

export const THEME_OPTIONS = Object.freeze([
  Object.freeze({
    id: 'default',
    name: '邻舍默认',
    subtitle: '暖色玻璃',
    description: '保留当前的轻盈暖色界面。',
    signature: '舒缓卡片 · 宽松阅读',
    layout: 'airy',
    colorScheme: 'light',
    swatches: Object.freeze(['#f0ece8', '#ffffff', '#e07b6c']),
  }),
  Object.freeze({
    id: 'elemental',
    name: '元素冒险',
    subtitle: '暖沙与碧玉',
    description: '清爽羊皮纸暖白配碧青色元素光。',
    signature: '冒险轻语 · 碧玉暖金',
    layout: 'adventure',
    colorScheme: 'light',
    swatches: Object.freeze(['#f5efe3', '#fffdf9', '#2baaa4']),
  }),
  Object.freeze({
    id: 'ink',
    name: '纸上手记',
    subtitle: '素纸与朱砂',
    description: '一本素雅明净的纸质手账，朱墨分明。',
    signature: '雅致手账 · 朱墨相映',
    layout: 'editorial',
    colorScheme: 'light',
    swatches: Object.freeze(['#f4efe6', '#fffdfa', '#bd4f3e']),
  }),
  Object.freeze({
    id: 'breeze',
    name: '晴空海风',
    subtitle: '蔚蓝与白沙',
    description: '明亮通透的澄澈蓝白，视觉清晰清爽。',
    signature: '晴空视野 · 明净通透',
    layout: 'breeze',
    colorScheme: 'light',
    swatches: Object.freeze(['#eef4fa', '#ffffff', '#3b82f6']),
  }),
  Object.freeze({
    id: 'matcha',
    name: '翠竹晨露',
    subtitle: '嫩绿与暖光',
    description: '清新柔和的竹林绿白，生机与雅致并存。',
    signature: '生机绿意 · 舒适护眼',
    layout: 'matcha',
    colorScheme: 'light',
    swatches: Object.freeze(['#edf5ee', '#ffffff', '#2e9e5b']),
  }),
])

export const FX_OPTIONS = Object.freeze([
  Object.freeze({ id: 'dynamic', name: '灵动光影', description: '呼吸光晕与微交互质感' }),
  Object.freeze({ id: 'static', name: '极简纯净', description: '静态平整与低耗渲染' }),
])
export const FX_MODES = FX_OPTIONS

const VALID_THEME_IDS = new Set(THEME_OPTIONS.map(theme => theme.id))
const VALID_FX_MODES = new Set(['dynamic', 'static'])

export function normalizeThemeId(value) {
  return VALID_THEME_IDS.has(value) ? value : 'default'
}

export function normalizeFxMode(value) {
  return VALID_FX_MODES.has(value) ? value : 'dynamic'
}

export function getStoredThemeId(storage = typeof localStorage === 'undefined' ? null : localStorage) {
  try {
    return normalizeThemeId(storage?.getItem(THEME_STORAGE_KEY))
  } catch {
    return 'default'
  }
}

export function getStoredFxMode(storage = typeof localStorage === 'undefined' ? null : localStorage) {
  try {
    return normalizeFxMode(storage?.getItem(FX_STORAGE_KEY))
  } catch {
    return 'dynamic'
  }
}

export function applyTheme(themeId) {
  const normalized = normalizeThemeId(themeId)
  if (typeof document === 'undefined') return normalized

  document.documentElement.dataset.linsheTheme = normalized
  const theme = THEME_OPTIONS.find(item => item.id === normalized)
  document.documentElement.style.colorScheme = theme?.colorScheme || 'light'
  if (document.body) document.body.dataset.linsheTheme = normalized
  return normalized
}

export function applyFxMode(fxMode) {
  const normalized = normalizeFxMode(fxMode)
  if (typeof document === 'undefined') return normalized

  document.documentElement.dataset.linsheFx = normalized
  if (document.body) document.body.dataset.linsheFx = normalized
  return normalized
}

export function persistThemeId(themeId, storage = typeof localStorage === 'undefined' ? null : localStorage) {
  const normalized = normalizeThemeId(themeId)
  try {
    storage?.setItem(THEME_STORAGE_KEY, normalized)
  } catch {
    // Safari private browsing and embedded webviews may deny localStorage.
  }
  return normalized
}

export function persistFxMode(fxMode, storage = typeof localStorage === 'undefined' ? null : localStorage) {
  const normalized = normalizeFxMode(fxMode)
  try {
    storage?.setItem(FX_STORAGE_KEY, normalized)
  } catch {
    // Safari private browsing and embedded webviews may deny localStorage.
  }
  return normalized
}

export function initTheme() {
  const theme = applyTheme(getStoredThemeId())
  applyFxMode(getStoredFxMode())
  return theme
}
