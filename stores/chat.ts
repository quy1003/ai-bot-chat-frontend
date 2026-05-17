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
    return conversations.value.find((c) => c.id === currentConversationId.value)
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
        body: JSON.stringify({ title }),
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
      const index = conversations.value.findIndex((c) => c.id === id)
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
        method: 'DELETE',
      })
      if (!response.ok) throw new Error('Failed to delete conversation')

      conversations.value = conversations.value.filter((c) => c.id !== id)
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
    loading.value = true
    const conversation = conversations.value.find(
      (c) => c.id === conversationId
    )
    if (!conversation) throw new Error('Conversation not found')

    const isFirstMessage =
      !conversation.messages || conversation.messages.length === 0

    // Add user message optimistically
    if (!conversation.messages) conversation.messages = []
    conversation.messages.push({
      role: 'user',
      content: message,
      created_at: new Date().toISOString(),
    })

    try {
      const response = await fetch(
        `${API_BASE}/conversations/${conversationId}/send`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message }),
        }
      )

      if (!response.ok) throw new Error('Failed to send message')
      if (!response.body) throw new Error('No response body')

      let textQueue = ''
      let isStreamEnded = false
      let botMessageIndex = -1
      let botMessageAdded = false

      // Separate worker to render characters smoothly
      const renderTyping = async () => {
        while (!isStreamEnded || textQueue.length > 0) {
          if (textQueue.length > 0 && botMessageIndex !== -1) {
            // How many chars to consume per tick depending on queue size to avoid falling too far behind
            const charsToTake = textQueue.length > 100 ? 3 : 1
            const chunk = textQueue.slice(0, charsToTake)
            textQueue = textQueue.slice(charsToTake)

            // Mutate the reactive proxy inside the array to trigger UI updates
            if (conversation.messages) {
              const msg = conversation.messages[botMessageIndex]
              if (msg) {
                msg.content += chunk
              }
            }
            await new Promise((r) => setTimeout(r, 20)) // 20ms delay for a nice reading speed
          } else {
            await new Promise((r) => setTimeout(r, 20)) // wait for more data
          }
        }
      }

      // Start the typing renderer without blocking the read loop
      const renderPromise = renderTyping()

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { value, done } = await reader.read()
        if (done) {
          isStreamEnded = true
          break
        }

        if (!botMessageAdded && conversation.messages) {
          conversation.messages.push({
            role: 'bot',
            content: '',
            created_at: new Date().toISOString(),
          })
          botMessageIndex = conversation.messages.length - 1
          botMessageAdded = true
        }

        buffer += decoder.decode(value, { stream: true })
        const events = buffer.split(/\r?\n\r?\n/)
        buffer = events.pop() ?? ''

        for (const event of events) {
          const lines = event.split(/\r?\n/)
          for (const line of lines) {
            if (line.startsWith('data:')) {
              const data = line.replace(/^data:\s?/, '')
              if (data === '[END]') {
                isStreamEnded = true
              } else {
                textQueue += data
              }
            }
          }
        }
      }

      // Wait for rendering to finish
      await renderPromise

      // If this was the first message, refetch the conversation to get the updated title
      if (isFirstMessage) {
        const updatedResponse = await fetch(
          `${API_BASE}/conversations/${conversationId}`
        )
        if (updatedResponse.ok) {
          const updatedConversation = await updatedResponse.json()
          const index = conversations.value.findIndex(
            (c) => c.id === conversationId
          )
          if (index !== -1) {
            conversations.value[index] = updatedConversation
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
    } finally {
      loading.value = false
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
    clearError,
  }
})
