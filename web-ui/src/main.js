import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHashHistory } from 'vue-router'
import App from './App.vue'
import ChatView from './views/ChatView.vue'
import { initTheme } from './themes.js'
import './theme.css'

// Apply the saved skin before Vue mounts to avoid a flash of the default palette.
initTheme()

const loadGroupChat = () => import('./views/GroupChatView.vue')
const loadMoments = () => import('./views/MomentsView.vue')
const loadEvents = () => import('./views/EventsView.vue')
const loadSchedule = () => import('./views/ScheduleView.vue')
const loadGallery = () => import('./views/GalleryView.vue')
const loadTavern = () => import('./views/TavernView.vue')
const loadMailbox = () => import('./views/MailboxView.vue')
const loadSettings = () => import('./views/SettingsView.vue')
const loadMemorySettings = () => import('./views/MemorySettingsView.vue')
const loadMaibotBridge = () => import('./views/MaibotBridgeView.vue')

const routes = [
  { path: '/', redirect: '/chat' },
  { path: '/chat', component: ChatView },
  { path: '/chat/:id', component: ChatView },
  { path: '/group/:id', component: loadGroupChat },
  { path: '/moments', component: loadMoments },
  { path: '/events', component: loadEvents },
  { path: '/schedule', component: loadSchedule },
  { path: '/gallery', component: loadGallery },
  { path: '/tavern', component: loadTavern },
  { path: '/mailbox', component: loadMailbox },
  { path: '/settings', component: loadSettings },
  { path: '/settings/memory', component: loadMemorySettings },
  { path: '/settings/maibot', component: loadMaibotBridge },
]

const router = createRouter({ history: createWebHashHistory(), routes })
const pinia = createPinia()

const app = createApp(App).use(router).use(pinia)
router.isReady().then(() => {
  app.mount('#app')

  // Warm only the two most common secondary destinations after the chat shell
  // is interactive. Other routes stay fully lazy and load on demand.
  const prefetchCommonRoutes = () => {
    void loadMoments()
    void loadSettings()
  }
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(prefetchCommonRoutes, { timeout: 8_000 })
  } else {
    window.setTimeout(prefetchCommonRoutes, 5_000)
  }
})
