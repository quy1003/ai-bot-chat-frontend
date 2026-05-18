<template>
  <div class="flex w-full max-w-6xl gap-4">
    <!-- Sidebar - Conversation List -->
    <aside
      class="w-64 flex-shrink-0 rounded-lg border border-slate-200 bg-white shadow-lg"
    >
      <div class="border-b border-slate-200 p-4">
        <button
          @click="createNewConversation"
          :disabled="chatStore.loading"
          class="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:bg-slate-400"
        >
          + New Chat
        </button>
      </div>

      <div class="max-h-96 overflow-y-auto">
        <div
          v-if="chatStore.conversations.length === 0"
          class="p-4 text-center text-sm text-slate-500"
        >
          No conversations yet
        </div>

        <button
          v-for="conv in chatStore.conversations"
          :key="conv.id"
          @click="selectConversation(conv.id)"
          :class="[
            'w-full border-b border-slate-100 px-4 py-3 text-left text-sm transition hover:bg-slate-50',
            chatStore.currentConversationId === conv.id
              ? 'bg-blue-50 font-medium text-blue-900'
              : 'text-slate-700',
          ]"
        >
          <div class="truncate">{{ conv.title }}</div>
          <div class="text-xs text-slate-500">
            {{ formatDate(conv.updated_at) }}
          </div>
        </button>
      </div>
    </aside>

    <!-- Main Chat Area -->
    <section class="flex-1">
      <div
        v-if="!chatStore.currentConversation"
        class="flex h-[600px] items-center justify-center rounded-lg border border-slate-200 bg-slate-50"
      >
        <div class="text-center">
          <p class="text-lg font-medium text-slate-600">
            No conversation selected
          </p>
          <p class="mt-2 text-sm text-slate-500">
            Create a new chat to get started
          </p>
        </div>
      </div>

      <div
        v-else
        class="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl shadow-slate-950/30"
      >
        <!-- Header -->
        <header
          class="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4"
        >
          <div class="flex items-center gap-3">
            <div
              class="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-sm font-semibold text-white"
            >
              AI
            </div>
            <div>
              <h1 class="text-base font-semibold text-slate-950">
                {{ chatStore.currentConversation.title }}
              </h1>
              <div class="mt-1 flex items-center gap-2 text-xs text-slate-500">
                <span class="h-2 w-2 rounded-full bg-emerald-500"></span>
                Online
              </div>
            </div>
          </div>
          <button
            type="button"
            @click="deleteCurrentConversation"
            :disabled="chatStore.loading"
            class="rounded-md border border-red-200 px-3 py-2 text-xs font-medium text-red-600 transition hover:border-red-300 hover:bg-red-50 disabled:opacity-50"
          >
            Delete Chat
          </button>
        </header>

        <!-- Messages -->
        <div
          ref="chatBody"
          class="max-h-[min(62vh,540px)] min-h-[420px] space-y-5 overflow-y-auto bg-slate-50 px-5 py-6"
          aria-live="polite"
        >
          <div
            v-if="chatStore.currentMessages.length === 0"
            class="flex items-end gap-3"
          >
            <div
              class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-xs font-semibold text-slate-500 shadow-sm ring-1 ring-slate-200"
            >
              B
            </div>
            <div
              class="max-w-[80%] rounded-lg rounded-bl-sm border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-800 shadow-sm"
            >
              Hi, give some information about you and ask me anything to start
              our conversation.
            </div>
          </div>

          <template v-for="msg in chatStore.currentMessages" :key="msg.id">
            <div
              class="flex items-end gap-3"
              :class="msg.role === 'user' ? 'justify-end' : ''"
            >
              <div
                v-if="msg.role === 'bot'"
                class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-xs font-semibold text-slate-500 shadow-sm ring-1 ring-slate-200"
              >
                B
              </div>
              <div
                class="message-content rounded-lg px-4 py-3 text-sm leading-6 shadow-sm"
                :class="
                  msg.role === 'user'
                    ? 'rounded-br-sm bg-slate-900 text-white max-w-[70%]'
                    : 'prose prose-sm prose-slate rounded-bl-sm border border-slate-200 bg-white text-slate-800 max-w-[85%]'
                "
              >
                <template v-if="msg.role === 'user'">
                  {{ msg.content }}
                </template>
                <div v-else v-html="renderMarkdown(msg.content)"></div>
              </div>
              <div
                v-if="msg.role === 'user'"
                class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500 text-xs font-semibold text-white"
              >
                U
              </div>
            </div>
          </template>

          <div
            v-if="
              chatStore.loading &&
              (!chatStore.currentMessages.length ||
                chatStore.currentMessages[chatStore.currentMessages.length - 1]
                  ?.role === 'user')
            "
            class="flex items-end gap-3"
          >
            <div
              class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-xs font-semibold text-slate-500 shadow-sm ring-1 ring-slate-200"
            >
              B
            </div>
            <div
              class="inline-flex items-center gap-1 rounded-lg rounded-bl-sm border border-slate-200 bg-white px-4 py-3 shadow-sm"
            >
              <span
                class="h-2 w-2 animate-pulse rounded-full bg-slate-400"
              ></span>
              <span
                class="h-2 w-2 animate-pulse rounded-full bg-slate-400 [animation-delay:150ms]"
              ></span>
              <span
                class="h-2 w-2 animate-pulse rounded-full bg-slate-400 [animation-delay:300ms]"
              ></span>
            </div>
          </div>
        </div>

        <!-- Input -->
        <form
          class="border-t border-slate-200 bg-white p-4"
          @submit.prevent="sendMessage"
        >
          <div
            v-if="chatStore.error"
            class="mb-3 rounded-md bg-red-50 p-3 text-sm text-red-700"
          >
            {{ chatStore.error }}
          </div>
          <div class="flex gap-3">
            <input
              v-model="draft"
              type="text"
              placeholder="Enter a message..."
              autocomplete="off"
              :disabled="chatStore.loading"
              class="h-11 min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-100 disabled:bg-slate-50"
            />
            <button
              type="submit"
              :disabled="chatStore.loading || !draft.trim()"
              class="h-11 rounded-md bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              Send
            </button>
          </div>
        </form>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { useChatStore } from '../../stores/chat'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

const chatStore = useChatStore()
const draft = ref('')
const chatBody = ref<HTMLElement | null>(null)

const renderMarkdown = (text: string) => {
  if (!text) return ''
  return DOMPurify.sanitize(marked.parse(text) as string)
}

const scrollToBottom = async () => {
  await nextTick()
  if (chatBody.value) {
    chatBody.value.scrollTop = chatBody.value.scrollHeight
  }
}

const createNewConversation = async () => {
  try {
    const title = 'New Chat'
    await chatStore.createConversation(title)
    await scrollToBottom()
  } catch (error) {
    console.error('Error creating conversation:', error)
  }
}

const selectConversation = async (id: number) => {
  try {
    await chatStore.selectConversation(id)
    draft.value = ''
    await scrollToBottom()
  } catch (error) {
    console.error('Error selecting conversation:', error)
  }
}

const deleteCurrentConversation = async () => {
  if (!chatStore.currentConversationId) return
  if (!confirm('Are you sure you want to delete this conversation?')) return

  try {
    await chatStore.deleteConversation(chatStore.currentConversationId)
    draft.value = ''
  } catch (error) {
    console.error('Error deleting conversation:', error)
  }
}

const sendMessage = async () => {
  const message = draft.value.trim()
  if (!message || !chatStore.currentConversationId) return

  draft.value = ''
  chatStore.clearError()

  try {
    await chatStore.sendMessage(chatStore.currentConversationId, message)
    await scrollToBottom()
  } catch (error) {
    console.error('Error sending message:', error)
  }
}

// Load conversations on component mount
await chatStore.fetchConversations()

const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } else if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday'
  } else {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
  }
}
</script>

<style scoped>
.message-content {
  word-wrap: break-word;
  overflow-wrap: break-word;
  white-space: normal;
}
</style>
