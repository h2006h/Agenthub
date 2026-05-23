import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useUserStore } from './user'
import { websocketClient } from '@/websocket/client'
import { getMessages as fetchMessages, sendMessage as sendApiMessage, type Message } from '@/api/messages'
import { getConversations, createConversation, updateConversationAvatar as updateAvatarApi, type Conversation } from '@/api/conversations'

const PAGE_SIZE = 50

export interface StreamingMessage {
  messageId: string
  conversationId: string
  content: string
}

export const useMessagesStore = defineStore('messages', () => {
  const conversations = ref<Conversation[]>([])
  const currentConversationId = ref<string>('')
  const messages = ref<Message[]>([])
  const isConnected = ref(false)
  const isLoading = ref(false)
  const isLoadingEarlier = ref(false)
  const hasMore = ref(false)
  const total = ref(0)
  const streamingMessage = ref<StreamingMessage | null>(null)

  const currentConversation = computed(() => {
    return conversations.value.find(c => c.id === currentConversationId.value)
  })

  const loadConversations = async () => {
    try {
      conversations.value = await getConversations()
    } catch (error) {
      console.error('Failed to load conversations:', error)
    }
  }

  const loadMessages = async (conversationId: string) => {
    isLoading.value = true
    try {
      const result = await fetchMessages(conversationId, PAGE_SIZE, 0)
      messages.value = result.messages
      hasMore.value = result.hasMore
      total.value = result.total
      currentConversationId.value = conversationId
    } catch (error) {
      console.error('Failed to load messages:', error)
    } finally {
      isLoading.value = false
    }
  }

  const loadEarlierMessages = async () => {
    if (!currentConversationId.value || !hasMore.value || isLoadingEarlier.value) return

    isLoadingEarlier.value = true
    try {
      const result = await fetchMessages(currentConversationId.value, PAGE_SIZE, messages.value.length)
      messages.value = [...result.messages, ...messages.value]
      hasMore.value = result.hasMore
    } catch (error) {
      console.error('Failed to load earlier messages:', error)
    } finally {
      isLoadingEarlier.value = false
    }
  }

  const sendMessage = async (content: string, type: string = 'text') => {
    const userStore = useUserStore()
    if (!userStore.user || !currentConversationId.value) return

    const message: Message = {
      id: `msg_${Date.now()}`,
      conversationId: currentConversationId.value,
      senderId: userStore.user.id,
      senderName: userStore.user.username,
      content,
      type: type as Message['type'],
      timestamp: Date.now()
    }

    messages.value.push(message)
    total.value++

    try {
      if (isConnected.value) {
        websocketClient.sendMessage(
          currentConversationId.value,
          userStore.user.id,
          userStore.user.username,
          content,
          type
        )
      } else {
        await sendApiMessage(
          currentConversationId.value,
          userStore.user.id,
          userStore.user.username,
          content,
          type
        )
      }
    } catch (error) {
      console.error('Failed to send message:', error)
    }
  }

  const receiveMessage = (message: Message) => {
    if (message.conversationId === currentConversationId.value) {
      messages.value.push(message)
      total.value++
    }
  }

  // -- Streaming handlers --

  const handleAgentReplyStart = (payload: any) => {
    if (payload.conversationId === currentConversationId.value) {
      streamingMessage.value = {
        messageId: payload.messageId,
        conversationId: payload.conversationId,
        content: ''
      }
    }
  }

  const handleAgentChunk = (payload: any) => {
    if (payload.conversationId === currentConversationId.value && streamingMessage.value) {
      streamingMessage.value.content += payload.content
    }
  }

  const handleAgentReplyEnd = (payload: any) => {
    if (payload.conversationId === currentConversationId.value) {
      streamingMessage.value = null
      messages.value.push({
        id: payload.messageId,
        conversationId: payload.conversationId,
        senderId: payload.senderId,
        senderName: payload.senderName,
        content: payload.content,
        type: payload.type,
        timestamp: payload.timestamp
      })
      total.value++
    }
  }

  const handleAgentReplyError = (payload: any) => {
    if (payload.conversationId === currentConversationId.value) {
      streamingMessage.value = null
      messages.value.push({
        id: payload.messageId,
        conversationId: payload.conversationId,
        senderId: 'system',
        senderName: '系统',
        content: '[AI响应失败: ' + (payload.error || '未知错误') + ']',
        type: 'system',
        timestamp: Date.now()
      })
      total.value++
    }
  }

  const createNewConversation = async (name: string, type: 'single' | 'group' | 'agent', participants?: string[], avatar?: string, agentIds?: string[]) => {
    const conversation = await createConversation(name, type, participants, avatar, agentIds)
    conversations.value.push(conversation)
    return conversation
  }

  const updateConversationAvatar = async (id: string, avatar: string) => {
    const updatedConversation = await updateAvatarApi(id, avatar)
    const index = conversations.value.findIndex(c => c.id === id)
    if (index !== -1) {
      conversations.value[index] = updatedConversation
    }
    return updatedConversation
  }

  const connectWebSocket = async () => {
    const userStore = useUserStore()
    if (userStore.user && !isConnected.value) {
      try {
        const savedToken = localStorage.getItem('agenthub_token')
        await websocketClient.connect(savedToken || userStore.token)
        isConnected.value = true

        websocketClient.on('message', (payload) => {
          receiveMessage(payload as Message)
        })

        websocketClient.on('agentReplyStart', (payload) => {
          handleAgentReplyStart(payload)
        })

        websocketClient.on('agentChunk', (payload) => {
          handleAgentChunk(payload)
        })

        websocketClient.on('agentReplyEnd', (payload) => {
          handleAgentReplyEnd(payload)
        })

        websocketClient.on('agentReplyError', (payload) => {
          handleAgentReplyError(payload)
        })

        websocketClient.on('connected', () => {
          isConnected.value = true
        })

        websocketClient.on('disconnected', () => {
          isConnected.value = false
        })
      } catch (error) {
        console.error('WebSocket connection failed:', error)
      }
    }
  }

  const disconnectWebSocket = () => {
    websocketClient.disconnect()
    isConnected.value = false
  }

  const subscribe = (conversationId: string) => {
    if (currentConversationId.value) {
      websocketClient.unsubscribe(currentConversationId.value)
    }
    currentConversationId.value = conversationId
    websocketClient.subscribe(conversationId)
  }

  return {
    conversations,
    currentConversationId,
    currentConversation,
    messages,
    isConnected,
    isLoading,
    isLoadingEarlier,
    hasMore,
    total,
    streamingMessage,
    loadConversations,
    loadMessages,
    loadEarlierMessages,
    sendMessage,
    receiveMessage,
    handleAgentReplyStart,
    handleAgentChunk,
    handleAgentReplyEnd,
    handleAgentReplyError,
    createNewConversation,
    updateConversationAvatar,
    connectWebSocket,
    disconnectWebSocket,
    subscribe
  }
})
