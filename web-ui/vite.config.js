import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    // Quick Tunnel forwards its random *.trycloudflare.com Host header.
    // Keep the allow-list scoped to Cloudflare's temporary tunnel domain.
    allowedHosts: ['.trycloudflare.com'],
    proxy: {
      '/api': {
        target: 'http://localhost:3099',
        changeOrigin: true,
        // SSE 长连接在生图期间可能长时间无数据，禁用代理层超时
        timeout: 0,
        proxyTimeout: 0,
      },
      '/images': {
        target: 'http://localhost:3099',
        changeOrigin: true,
      },
      '/avatars': {
        target: 'http://localhost:3099',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: '../agent-core/public',
    emptyOutDir: true,
  },
})
