<template>
  <div class="card network-diagnostics-card">
    <div class="network-diagnostics-head">
      <div>
        <h3>远程访问诊断</h3>
        <p class="fd">仅统计当前页面的网络耗时，不会上传聊天内容或密钥。</p>
      </div>
      <button class="btn-ghost diagnostic-refresh" type="button" @click="refresh">刷新数据</button>
    </div>

    <div class="diagnostic-status-row">
      <span class="diagnostic-badge" :class="stream.connected ? 'ok' : 'warn'">
        推送连接：{{ stream.connected ? '正常' : stream.started ? '重连中' : '未启动' }}
      </span>
      <span>版本 {{ buildVersion }}</span>
      <span v-if="connectionType">网络 {{ connectionType }}</span>
    </div>

    <div class="diagnostic-grid">
      <div class="diagnostic-item">
        <span class="diagnostic-label">首字节</span>
        <strong>{{ displayMs(snapshot.navigation.ttfbMs) }}</strong>
      </div>
      <div class="diagnostic-item">
        <span class="diagnostic-label">页面可交互</span>
        <strong>{{ displayMs(snapshot.navigation.interactiveMs) }}</strong>
      </div>
      <div class="diagnostic-item">
        <span class="diagnostic-label">接口 P50 / P95</span>
        <strong>{{ displayMs(snapshot.api.p50Ms) }} / {{ displayMs(snapshot.api.p95Ms) }}</strong>
      </div>
      <div class="diagnostic-item">
        <span class="diagnostic-label">接口请求</span>
        <strong>{{ snapshot.api.count }} 次</strong>
      </div>
      <div class="diagnostic-item">
        <span class="diagnostic-label">静态资源传输</span>
        <strong>{{ snapshot.staticAssets.transferredKb ?? '—' }} KB</strong>
      </div>
      <div class="diagnostic-item">
        <span class="diagnostic-label">推送重连</span>
        <strong>{{ stream.reconnectCount }} 次</strong>
      </div>
    </div>

    <p class="diagnostic-tip" :class="healthClass">{{ healthText }}</p>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { collectPerformanceSnapshot, getBuildVersion } from '../utils/performanceMetrics.js'
import { getUnifiedStreamDiagnostics } from '../stores/unifiedStream.js'

const emptySnapshot = () => ({
  navigation: { ttfbMs: null, interactiveMs: null, loadMs: null },
  api: { count: 0, p50Ms: null, p95Ms: null, maxMs: null },
  staticAssets: { count: 0, transferredKb: 0, cachedCount: 0 },
})

const snapshot = ref(emptySnapshot())
const stream = ref(getUnifiedStreamDiagnostics())
const buildVersion = getBuildVersion()
const connectionType = navigator.connection?.effectiveType || ''

function refresh() {
  snapshot.value = collectPerformanceSnapshot()
  stream.value = getUnifiedStreamDiagnostics()
}

function displayMs(value) {
  return value == null ? '—' : `${value} ms`
}

const healthClass = computed(() => {
  const p95 = snapshot.value.api.p95Ms
  if (p95 == null) return ''
  return p95 > 1500 ? 'bad' : p95 > 700 ? 'warn' : 'ok'
})

const healthText = computed(() => {
  const p95 = snapshot.value.api.p95Ms
  if (p95 == null) return '操作几次页面后再刷新，可得到更准确的接口耗时。'
  if (p95 > 1500) return '接口尾部延迟较高。建议先确认手机代理线路，再检查 Cloudflare Tunnel 路由。'
  if (p95 > 700) return '当前可以使用，但网络延迟偏高；切换更近的代理节点通常会改善。'
  return '当前页面的接口响应正常。'
})

onMounted(() => requestAnimationFrame(refresh))
</script>

<style scoped>
.network-diagnostics-card { grid-column: 1 / -1; }
.network-diagnostics-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.network-diagnostics-head h3 { margin-bottom: 4px; }
.diagnostic-refresh { flex: 0 0 auto; }
.diagnostic-status-row { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 14px; margin: 14px 0; font-size: 12px; color: var(--text-secondary); }
.diagnostic-badge { padding: 4px 9px; border-radius: 999px; background: rgba(255, 166, 0, 0.12); color: #a46300; }
.diagnostic-badge.ok { background: rgba(39, 174, 96, 0.12); color: #21854d; }
.diagnostic-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.diagnostic-item { min-width: 0; padding: 12px; border: 1px solid var(--glass-border); border-radius: 10px; background: var(--glass-bg-strong); }
.diagnostic-item strong { display: block; margin-top: 5px; color: var(--text-bright); font-size: 14px; overflow-wrap: anywhere; }
.diagnostic-label { color: var(--text-secondary); font-size: 12px; }
.diagnostic-tip { margin: 12px 0 0; font-size: 12px; color: var(--text-secondary); }
.diagnostic-tip.ok { color: #21854d; }
.diagnostic-tip.warn { color: #a46300; }
.diagnostic-tip.bad { color: #c0392b; }
@media (max-width: 767px) {
  .network-diagnostics-head { align-items: stretch; flex-direction: column; }
  .diagnostic-refresh { width: 100%; }
  .diagnostic-grid { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 420px) {
  .diagnostic-grid { grid-template-columns: 1fr; }
}
</style>
