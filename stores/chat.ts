import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

const API_BASE = 'http://127.0.0.1:8000/chat'

export interface ChatMessage {
  id?: number
  role: 'user' | 'bot'
  content: string
  created_at?: string
}

export interface Conversation {
  id: number
  title: string
  created_at: string
  updated_at: string
  messages?: ChatMessage[]
}

export const useChatStore = defineStore('chat', () => {
  // State
  const conversations = ref<Conversation[]>([])
  const currentConversationId = ref<number | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Computed
  const currentConversation = computed(() => {
    return conversations.value.find(c => c.id === currentConversationId.value)
  })

  const currentMessages = computed(() => {
    return currentConversation.value?.messages || []
  })

  // Actions
  async function fetchConversations() {
    loading.value = true
    error.value = null
    try {
      const response = await fetch(`${API_BASE}/conversations`)
      if (!response.ok) throw new Error('Failed to fetch conversations')
      conversations.value = await response.json()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Unknown error'
      console.error('Error fetching conversations:', e)
    } finally {
      loading.value = false
    }
  }

  async function createConversation(title: string) {
    loading.value = true
    error.value = null
    try {
      const response = await fetch(`${API_BASE}/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title })
      })
      if (!response.ok) throw new Error('Failed to create conversation')
      const newConversation = await response.json()
      conversations.value.unshift(newConversation)
      currentConversationId.value = newConversation.id
      return newConversation
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Unknown error'
      console.error('Error creating conversation:', e)
      throw e
    } finally {
      loading.value = false
    }
  }

  async function selectConversation(id: number) {
    loading.value = true
    error.value = null
    try {
      const response = await fetch(`${API_BASE}/conversations/${id}`)
      if (!response.ok) throw new Error('Failed to fetch conversation')
      const conversation = await response.json()
      
      // Update in list
      const index = conversations.value.findIndex(c => c.id === id)
      if (index !== -1) {
        conversations.value[index] = conversation
      }
      
      currentConversationId.value = id
      return conversation
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Unknown error'
      console.error('Error selecting conversation:', e)
    } finally {
      loading.value = false
    }
  }

  async function deleteConversation(id: number) {
    loading.value = true
    error.value = null
    try {
      const response = await fetch(`${API_BASE}/conversations/${id}`, {
        method: 'DELETE'
      })
      if (!response.ok) throw new Error('Failed to delete conversation')
      
      conversations.value = conversations.value.filter(c => c.id !== id)
      if (currentConversationId.value === id) {
        currentConversationId.value = conversations.value[0]?.id || null
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Unknown error'
      console.error('Error deleting conversation:', e)
      throw e
    } finally {
      loading.value = false
    }
  }

  async function sendMessage(conversationId: number, message: string) {
    error.value = null
    const conversation = conversations.value.find(c => c.id === conversationId)
    if (!conversation) throw new Error('Conversation not found')

    // Add user message optimistically
    if (!conversation.messages) conversation.messages = []
    conversation.messages.push({
      role: 'user',
      content: message,
      created_at: new Date().toISOString()
    })

    try {
      const response = await fetch(`${API_BASE}/conversations/${conversationId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      })

      if (!response.ok) throw new Error('Failed to send message')
      if (!response.body) throw new Error('No response body')

      const botMessage: ChatMessage = {
        role: 'bot',
        content: '',
        created_at: new Date().toISOString()
      }
      conversation.messages.push(botMessage)

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let streamEnded = false

      while (!streamEnded) {
        const { value, done } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const events = buffer.split(/\r?\n\r?\n/)
        buffer = events.pop() ?? ''

        for (const event of events) {
          const lines = event.split(/\r?\n/)
          for (const line of lines) {
            if (line.startsWith('data:')) {
              const data = line.replace(/^data:\s?/, '')
              if (data === '[END]') {
                streamEnded = true
              } else {
                botMessage.content += data
              }
            }
          }
        }
      }
    } catch (e) {
      // Remove user message on error
      if (conversation.messages) {
        conversation.messages = conversation.messages.slice(0, -1)
      }
      error.value = e instanceof Error ? e.message : 'Unknown error'
      console.error('Error sending message:', e)
      throw e
    }
  }

  function clearError() {
    error.value = null
  }

  return {
    // State
    conversations,
    currentConversationId,
    loading,
    error,

    // Computed
    currentConversation,
    currentMessages,

    // Actions
    fetchConversations,
    createConversation,
    selectConversation,
    deleteConversation,
    sendMessage,
    clearError
  }
})
