import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import * as api from '../api/index.js'
import { onEvent } from './unifiedStream.js'
import { createRequestGate } from '../utils/requestGate.js'

export const useMailboxStore = defineStore('mailbox', () => {
  const lettersGate = createRequestGate(30_000)
  const unreadGate = createRequestGate(60_000)
  const letters = ref([])
  const unreadCount = ref(0)
  const processingCount = ref(0)
  const loading = ref(false)

  let pollTimer = null
  let _unsubProcessing = null
  let _unsubReady = null
  let _pollingRefs = 0

  const pendingLetters = computed(() =>
    letters.value.filter(l => l.status === 'pending' || l.status === 'processing')
  )
  const completedLetters = computed(() =>
    letters.value.filter(l => l.status === 'completed')
  )

  async function fetchLetters(force = false) {
    loading.value = true
    try {
      return await lettersGate.run(async () => {
        const data = await api.listLetters()
        letters.value = data.letters || []
        return letters.value
      }, { force })
    } catch (err) {
      console.error('[mailbox] fetchLetters error:', err)
    } finally {
      loading.value = false
    }
  }

  async function fetchUnread(force = false) {
    try {
      return await unreadGate.run(async () => {
        const data = await api.getUnreadCount()
        unreadCount.value = data.unread || 0
        processingCount.value = data.processing || 0
        return data
      }, { force })
    } catch (err) {
      console.error('[mailbox] fetchUnread error:', err)
    }
  }

  async function sendLetter(characterId, title, content) {
    const result = await api.sendLetter(characterId, title, content)
    if (result.letter) {
      letters.value.unshift(result.letter)
    }
    return result
  }

  async function markRead(letterId) {
    await api.markLetterRead(letterId)
    const letter = letters.value.find(l => l.id === letterId)
    if (letter) {
      letter.is_read = 1
      fetchUnread(true)
    }
  }

  async function deleteLetter(letterId) {
    await api.deleteLetter(letterId)
    letters.value = letters.value.filter(l => l.id !== letterId)
    fetchUnread(true)
  }

  function _onReplyProcessing(data) {
    const letterId = data.letter_id
    const letter = letters.value.find(l => l.id === letterId)
    if (letter) {
      letter.status = 'processing'
    }
    fetchUnread(true)
  }

  function _onReplyReady(data) {
    const letterId = data.letter_id
    const letter = letters.value.find(l => l.id === letterId)
    if (letter) {
      letter.status = 'completed'
      letter.direction = 'char_to_user'
      letter.reply_content = data.reply_content
      letter.paper_path = data.paper_path
      letter.portrait_path = data.portrait_path
      letter.illustration_path = data.illustration_path
      letter.handwriting_font = data.handwriting_font || ''
      letter.is_read = 0
    } else {
      fetchLetters(true)
    }
    fetchUnread(true)
  }

  function startPolling() {
    _pollingRefs++
    if (_pollingRefs > 1) {
      fetchLetters()
      return
    }

    fetchLetters()
    fetchUnread()

    _unsubProcessing = onEvent('reply_processing', _onReplyProcessing)
    _unsubReady = onEvent('reply_ready', _onReplyReady)

    pollTimer = setInterval(() => {
      fetchUnread(true)
      if (letters.value.some(l => l.status === 'pending' || l.status === 'processing')) {
        fetchLetters(true)
      }
    }, 60000)
  }

  function stopPolling() {
    _pollingRefs = Math.max(0, _pollingRefs - 1)
    if (_pollingRefs > 0) return

    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
    if (_unsubProcessing) { _unsubProcessing(); _unsubProcessing = null }
    if (_unsubReady) { _unsubReady(); _unsubReady = null }
  }

  return {
    letters, unreadCount, processingCount, loading,
    pendingLetters, completedLetters,
    fetchLetters, fetchUnread, sendLetter, markRead, deleteLetter,
    startPolling, stopPolling,
  }
})
