<template>
  <section class="theme-picker" aria-labelledby="theme-picker-title">
    <div class="theme-picker-heading">
      <div>
        <span class="theme-eyebrow">PERSONALIZE</span>
        <h3 id="theme-picker-title">界面皮肤</h3>
        <p>选择邻舍的视觉氛围，切换会立即生效。</p>
      </div>
      <span class="theme-current">当前：{{ selectedTheme.name }}</span>
    </div>

    <div class="theme-fx-bar">
      <span class="theme-fx-label">动效质感：</span>
      <div class="theme-fx-buttons">
        <button
          v-for="fx in FX_OPTIONS"
          :key="fx.id"
          type="button"
          class="theme-fx-btn"
          :class="{ 'theme-fx-btn--active': settings.fxMode === fx.id }"
          @click="selectFx(fx.id)"
        >
          <span class="theme-fx-dot"></span>
          <span class="theme-fx-title">{{ fx.name }}</span>
          <span class="theme-fx-desc">({{ fx.description }})</span>
        </button>
      </div>
    </div>

    <div class="theme-options" role="list" aria-label="界面皮肤选项">
      <button
        v-for="theme in THEME_OPTIONS"
        :key="theme.id"
        type="button"
        class="theme-option"
        :class="{ 'theme-option--active': settings.themeId === theme.id }"
        :aria-pressed="settings.themeId === theme.id"
        @click="selectTheme(theme.id)"
      >
        <span class="theme-preview" :class="`theme-preview--${theme.id}`" aria-hidden="true">
          <span class="theme-preview-orbit"></span>
          <span class="theme-preview-crystal"></span>
          <span class="theme-preview-panel theme-preview-panel--top"></span>
          <span class="theme-preview-panel theme-preview-panel--bottom"></span>
        </span>
        <span class="theme-option-copy">
          <span class="theme-option-title">{{ theme.name }}</span>
          <span class="theme-option-subtitle">{{ theme.subtitle }}</span>
          <span class="theme-option-layout">{{ theme.signature }}</span>
          <span class="theme-option-description">{{ theme.description }}</span>
          <span class="theme-swatches">
            <span v-for="swatch in theme.swatches" :key="swatch" class="theme-swatch" :style="{ background: swatch }"></span>
          </span>
        </span>
        <span class="theme-option-check" aria-hidden="true">✓</span>
      </button>
    </div>

    <p class="theme-note">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3 4.5 6.5v5.25c0 4.42 3.2 7.92 7.5 9.25 4.3-1.33 7.5-4.83 7.5-9.25V6.5L12 3Z" />
        <path d="m8.5 12 2.2 2.2 4.8-5" />
      </svg>
      皮肤仅改变视觉配色与光影质感，不会修改界面布局、字体，也不会影响角色与对话数据。
    </p>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { useSettingsStore } from '../stores/settings.js'
import { FX_OPTIONS, THEME_OPTIONS } from '../themes.js'

const settings = useSettingsStore()
const selectedTheme = computed(() => THEME_OPTIONS.find(theme => theme.id === settings.themeId) || THEME_OPTIONS[0])

function selectTheme(themeId) {
  settings.setTheme(themeId)
}

function selectFx(fxMode) {
  settings.setFxMode(fxMode)
}
</script>

<style scoped>
.theme-picker {
  margin-bottom: 20px;
  padding: 22px 24px 18px;
  border: 1px solid var(--glass-border);
  border-radius: 16px;
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  box-shadow: var(--glass-shadow);
}

.theme-picker-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 14px;
}

.theme-eyebrow {
  display: block;
  margin-bottom: 5px;
  color: var(--accent);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.18em;
}

.theme-picker h3 {
  margin: 0 0 4px;
  color: var(--text-bright);
  font-size: 16px;
  font-weight: 700;
}

.theme-picker-heading p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.5;
}

.theme-current {
  flex: 0 0 auto;
  padding: 5px 10px;
  border: 1px solid var(--accent-light);
  border-radius: 999px;
  color: var(--accent-hover);
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
}

.theme-fx-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
  padding: 8px 14px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: color-mix(in srgb, var(--bg-secondary) 65%, transparent);
}

.theme-fx-label {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 700;
  color: var(--text-secondary);
}

.theme-fx-buttons {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  flex: 1;
}

.theme-fx-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--control-bg);
  color: var(--text-secondary);
  font-size: 11px;
  cursor: pointer;
  transition: all 0.18s ease;
}

.theme-fx-btn:hover {
  border-color: var(--accent-light);
  color: var(--text-bright);
  background: var(--control-hover);
}

.theme-fx-btn--active {
  border-color: var(--accent);
  background: var(--soft-accent);
  color: var(--accent-hover);
  font-weight: 700;
}

.theme-fx-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.theme-fx-title {
  font-weight: 700;
}

.theme-fx-desc {
  font-size: 10px;
  opacity: 0.8;
}

.theme-options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.theme-option {
  position: relative;
  display: grid;
  grid-template-columns: 106px minmax(0, 1fr);
  align-items: stretch;
  gap: 14px;
  min-width: 0;
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: 13px;
  background: color-mix(in srgb, var(--bg-secondary) 76%, transparent);
  color: var(--text-primary);
  text-align: left;
  cursor: pointer;
  transition: border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
}

.theme-option:hover {
  border-color: var(--accent-light);
  box-shadow: 0 5px 18px color-mix(in srgb, var(--accent) 13%, transparent);
  transform: translateY(-1px);
}

.theme-option:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}

.theme-option--active {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 16%, transparent), 0 6px 20px color-mix(in srgb, var(--accent) 12%, transparent);
}

.theme-preview {
  position: relative;
  min-height: 92px;
  overflow: hidden;
  border-radius: 9px;
  isolation: isolate;
}

.theme-preview--default {
  background: linear-gradient(145deg, #f7f4ef, #eee1d6);
}

.theme-preview--elemental {
  background:
    radial-gradient(circle at 80% 15%, rgba(43, 170, 164, 0.25), transparent 30%),
    linear-gradient(145deg, #fdfaf4 0%, #f5efe3 58%, #e8decb 100%);
}

.theme-preview--ink {
  background:
    radial-gradient(circle at 85% 15%, rgba(189, 79, 62, 0.2), transparent 28%),
    linear-gradient(145deg, #fffdfa 0%, #f4efe6 58%, #e4dac9 100%);
}

.theme-preview--breeze {
  background:
    radial-gradient(circle at 80% 15%, rgba(59, 130, 246, 0.24), transparent 30%),
    linear-gradient(145deg, #ffffff 0%, #eef4fa 58%, #d5e5f5 100%);
}

.theme-preview--matcha {
  background:
    radial-gradient(circle at 80% 15%, rgba(46, 158, 91, 0.24), transparent 30%),
    linear-gradient(145deg, #ffffff 0%, #edf5ee 58%, #d4e8d6 100%);
}

.theme-preview::before,
.theme-preview::after {
  position: absolute;
  content: '';
  pointer-events: none;
}

.theme-preview::before {
  inset: 7px;
  border: 1px solid rgba(201, 154, 74, 0.4);
  border-radius: 7px;
}

.theme-preview--default::before { border-color: rgba(210, 164, 143, 0.35); }
.theme-preview--elemental::before { border-color: rgba(43, 170, 164, 0.35); }
.theme-preview--ink::before { border-color: rgba(189, 79, 62, 0.3); }
.theme-preview--breeze::before { border-color: rgba(59, 130, 246, 0.3); }
.theme-preview--matcha::before { border-color: rgba(46, 158, 91, 0.3); }

.theme-preview::after {
  top: 12px;
  right: 12px;
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: #fff5d4;
  box-shadow: -19px 12px 0 rgba(255, 245, 212, 0.78), -38px 2px 0 rgba(255, 245, 212, 0.5), -9px 35px 0 rgba(255, 245, 212, 0.62);
}

.theme-preview-orbit {
  position: absolute;
  top: 11px;
  left: 11px;
  width: 50px;
  height: 24px;
  border: 1px solid rgba(201, 154, 74, 0.4);
  border-radius: 50%;
  transform: rotate(-27deg);
}

.theme-preview--default .theme-preview-orbit {
  border-color: rgba(204, 147, 124, 0.36);
}

.theme-preview--elemental .theme-preview-orbit {
  border-color: rgba(43, 170, 164, 0.45);
}

.theme-preview--ink .theme-preview-orbit {
  border-color: rgba(189, 79, 62, 0.45);
}

.theme-preview--breeze .theme-preview-orbit {
  border-color: rgba(59, 130, 246, 0.45);
}

.theme-preview--matcha .theme-preview-orbit {
  border-color: rgba(46, 158, 91, 0.45);
}

.theme-preview-crystal {
  position: absolute;
  top: 21px;
  left: 31px;
  width: 19px;
  height: 27px;
  border: 1px solid #d9b65d;
  background: linear-gradient(145deg, #8be0d7 0%, #3ab5b1 52%, #216f86 100%);
  clip-path: polygon(50% 0, 100% 28%, 82% 100%, 18% 100%, 0 28%);
  transform: rotate(8deg);
  box-shadow: 0 0 10px rgba(98, 200, 192, 0.3);
}

.theme-preview--default .theme-preview-crystal {
  border: 0;
  background: linear-gradient(145deg, #efb89e, #d98476);
  box-shadow: 0 0 10px rgba(224, 123, 108, 0.25);
}

.theme-preview--elemental .theme-preview-crystal {
  border-color: #2baaa4;
  background: linear-gradient(145deg, #8de3df, #2baaa4 58%, #1f8f89);
  box-shadow: 0 0 10px rgba(43, 170, 164, 0.3);
}

.theme-preview--ink .theme-preview-crystal {
  border: 0;
  background: linear-gradient(145deg, #eb8e80, #bd4f3e 62%, #8e3123);
  box-shadow: 0 0 10px rgba(189, 79, 62, 0.25);
}

.theme-preview--breeze .theme-preview-crystal {
  border-color: #3b82f6;
  background: linear-gradient(145deg, #93c5fd, #3b82f6 58%, #1d4ed8);
  box-shadow: 0 0 10px rgba(59, 130, 246, 0.3);
}

.theme-preview--matcha .theme-preview-crystal {
  border-color: #2e9e5b;
  background: linear-gradient(145deg, #86efac, #2e9e5b 58%, #15803d);
  box-shadow: 0 0 10px rgba(46, 158, 91, 0.3);
}

.theme-preview-panel {
  position: absolute;
  left: 12px;
  right: 12px;
  height: 12px;
  border-radius: 5px;
  background: rgba(244, 233, 212, 0.86);
}

.theme-preview-panel--top { bottom: 29px; width: 65%; }
.theme-preview-panel--bottom { right: 16px; bottom: 11px; width: 45%; opacity: 0.7; }

.theme-preview--default .theme-preview-panel { background: rgba(255, 255, 255, 0.72); }
.theme-preview--elemental .theme-preview-panel { background: rgba(255, 253, 249, 0.82); }
.theme-preview--ink .theme-preview-panel { background: rgba(255, 253, 250, 0.85); }
.theme-preview--breeze .theme-preview-panel { background: rgba(255, 255, 255, 0.85); }
.theme-preview--matcha .theme-preview-panel { background: rgba(255, 255, 255, 0.85); }

.theme-option-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  justify-content: center;
  padding-right: 18px;
}

.theme-option-title { color: var(--text-bright); font-size: 14px; font-weight: 700; }
.theme-option-subtitle { margin-top: 2px; color: var(--accent); font-size: 11px; font-weight: 600; }
.theme-option-layout {
  display: inline-flex;
  align-self: flex-start;
  margin-top: 7px;
  padding: 3px 7px;
  border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
  border-radius: 5px;
  color: var(--text-bright);
  background: color-mix(in srgb, var(--accent) 9%, transparent);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.02em;
  line-height: 1.2;
}
.theme-option-description { margin-top: 6px; color: var(--text-secondary); font-size: 11px; line-height: 1.45; }

.theme-swatches {
  display: flex;
  gap: 5px;
  margin-top: 9px;
}

.theme-swatch {
  width: 14px;
  height: 14px;
  border: 1px solid color-mix(in srgb, var(--text-primary) 18%, transparent);
  border-radius: 50%;
}

.theme-option-check {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  width: 19px;
  height: 19px;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--accent);
  border-radius: 50%;
  color: #fff;
  background: var(--accent);
  font-size: 12px;
  font-weight: 800;
  opacity: 0;
  transform: scale(0.7);
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.theme-option--active .theme-option-check { opacity: 1; transform: scale(1); }

.theme-note {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 14px 0 0;
  color: var(--text-secondary);
  font-size: 11px;
  line-height: 1.5;
}

.theme-note svg { width: 15px; height: 15px; flex: 0 0 15px; fill: none; stroke: var(--accent); stroke-linecap: round; stroke-linejoin: round; stroke-width: 1.6; }

@media (max-width: 767px) {
  .theme-picker { padding: 18px 16px 16px; }
  .theme-picker-heading { align-items: flex-start; flex-direction: column; gap: 8px; }
  .theme-fx-bar { flex-direction: column; align-items: flex-start; gap: 8px; }
  .theme-options { grid-template-columns: 1fr; }
  .theme-option { grid-template-columns: 88px minmax(0, 1fr); gap: 11px; min-height: 116px; }
  .theme-preview { min-height: 96px; }
  .theme-option-description { display: none; }
}
</style>
