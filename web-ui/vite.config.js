import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    // Cloudflare Tunnel preserves the public Host header. Keep both the
    // temporary Quick Tunnel suffix and the stable self-hosted hostname in
    // the allow-list; Vite otherwise returns "Blocked request" before the
    // request can reach the Vue app.
    allowedHosts: ['.trycloudflare.com', 'linshe.0000114.xyz'],
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
