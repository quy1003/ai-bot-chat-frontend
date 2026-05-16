<template>
  <section class="w-full max-w-3xl">
    <div class="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl shadow-slate-950/30">
      <header class="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
        <div class="flex items-center gap-3">
          <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-sm font-semibold text-white">
            AI
          </div>
          <div>
            <h1 class="text-base font-semibold text-slate-950">Chat bot AI Demo</h1>
            <div class="mt-1 flex items-center gap-2 text-xs text-slate-500">
              <span class="h-2 w-2 rounded-full bg-emerald-500"></span>
              Online
            </div>
          </div>
        </div>
        <button
          type="button"
          class="rounded-md border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950"
          @click="clearChat"
        >
          Delete Chat
        </button>
      </header>

      <div
        ref="chatBody"
        class="max-h-[min(62vh,540px)] min-h-[420px] space-y-5 overflow-y-auto bg-slate-50 px-5 py-6"
        aria-live="polite"
      >
        <div class="flex items-end gap-3">
          <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-xs font-semibold text-slate-500 shadow-sm ring-1 ring-slate-200">
            B
          </div>
          <div class="max-w-[80%] rounded-lg rounded-bl-sm border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-800 shadow-sm">
            Hi, give some information about you and ask me anything to start our conversation.
          </div>
        </div>

        <template v-for="(item, index) in messages" :key="index">
          <div class="flex items-end gap-3" :class="item.role === 'user' ? 'justify-end' : ''">
            <div
              v-if="item.role === 'bot'"
              class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-xs font-semibold text-slate-500 shadow-sm ring-1 ring-slate-200"
            >
              B
            </div>
            <div
              class="max-w-[80%] rounded-lg px-4 py-3 text-sm leading-6 shadow-sm"
              :class="
                item.role === 'user'
                  ? 'rounded-br-sm bg-slate-900 text-white'
                  : 'rounded-bl-sm border border-slate-200 bg-white text-slate-800'
              "
            >
              {{ item.text }}
            </div>
            <div
              v-if="item.role === 'user'"
              class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500 text-xs font-semibold text-white"
            >
              U
            </div>
          </div>
        </template>

        <div v-if="loading && !streamingStarted" class="flex items-end gap-3">
          <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-xs font-semibold text-slate-500 shadow-sm ring-1 ring-slate-200">
            B
          </div>
          <div class="inline-flex items-center gap-1 rounded-lg rounded-bl-sm border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <span class="h-2 w-2 animate-pulse rounded-full bg-slate-400"></span>
            <span class="h-2 w-2 animate-pulse rounded-full bg-slate-400 [animation-delay:150ms]"></span>
            <span class="h-2 w-2 animate-pulse rounded-full bg-slate-400 [animation-delay:300ms]"></span>
          </div>
        </div>
      </div>

      <form class="border-t border-slate-200 bg-white p-4" @submit.prevent="sendMessage">
        <div class="flex gap-3">
          <input
            v-model="draft"
            type="text"
            placeholder="Enter a message..."
            autocomplete="off"
            class="h-11 min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-100 disabled:bg-slate-50"
            :disabled="loading"
          />
          <button
            type="submit"
            class="h-11 rounded-md bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            :disabled="loading || !draft.trim()"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  </section>
</template>

<script setup lang="ts">
import { nextTick, ref } from 'vue'

type ChatMessage = {
  role: 'user' | 'bot'
  text: string
}

const messages = ref<ChatMessage[]>([])
const draft = ref('')
const loading = ref(false)
const streamingStarted = ref(false)
const chatBody = ref<HTMLElement | null>(null)

const scrollToBottom = async () => {
  await nextTick()
  if (chatBody.value) {
    chatBody.value.scrollTop = chatBody.value.scrollHeight
  }
}

const sendMessage = async () => {
  const prompt = draft.value.trim()
  if (!prompt || loading.value) {
    return
  }

  messages.value.push({ role: 'user', text: prompt })
  draft.value = ''
  loading.value = true
  streamingStarted.value = false
  await scrollToBottom()

  try {
    const response = await fetch('http://127.0.0.1:8000/chat', {
      method: 'POST',
      headers: {
        Accept: 'text/event-stream',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: prompt }),
    })

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`)
    }

    if (!response.body) {
      throw new Error('Streaming is not supported by this browser.')
    }

    const botMessageIndex = messages.value.push({ role: 'bot', text: '' }) - 1
    const botMessage = messages.value[botMessageIndex]!

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let streamEnded = false

    const appendStreamEvent = async (event: string) => {
      const data = event
        .split(/\r?\n/)
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.replace(/^data:\s?/, ''))
        .join('\n')

      if (!data) {
        return
      }

      if (data === '[END]') {
        streamEnded = true
        return
      }

      streamingStarted.value = true
      botMessage.text += data
      await scrollToBottom()
    }

    while (!streamEnded) {
      const { value, done } = await reader.read()

      if (done) {
        break
      }

      buffer += decoder.decode(value, { stream: true })
      const events = buffer.split(/\r?\n\r?\n/)
      buffer = events.pop() ?? ''

      for (const event of events) {
        await appendStreamEvent(event)
        if (streamEnded) {
          await reader.cancel()
          break
        }
      }
    }

    buffer += decoder.decode()

    if (buffer.trim() && !streamEnded) {
      await appendStreamEvent(buffer)
    }

    if (!botMessage.text) {
      botMessage.text = 'No reply from bot.'
    }
  } catch (error) {
    messages.value.push({
      role: 'bot',
      text: 'Could not connect to the streaming API. Please check that the backend is running.',
    })
  } finally {
    loading.value = false
    streamingStarted.value = false
    await scrollToBottom()
  }
}

const clearChat = () => {
  messages.value = []
}
</script>
