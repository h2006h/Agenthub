import { request } from './base'

export interface Message {
  id: string
  conversationId: string
  senderId: string
  senderName: string
  content: string
  type: 'text' | 'code' | 'task' | 'system'
  timestamp: number
}

export interface MessagesResponse {
  messages: Message[]
  total: number
  hasMore: boolean
}

export const getMessages = async (
  conversationId: string,
  limit: number = 50,
  offset: number = 0
): Promise<MessagesResponse> => {
  return request(`/messages/${conversationId}?limit=${limit}&offset=${offset}`, 'GET')
}

export const deleteMessages = async (conversationId: string): Promise<void> => {
  return request(`/messages/${conversationId}`, 'DELETE')
}

export const sendMessage = async (
  conversationId: string,
  senderId: string,
  senderName: string,
  content: string,
  type: string = 'text'
): Promise<Message> => {
  return request('/messages', 'POST', {
    conversationId,
    senderId,
    senderName,
    content,
    type
  })
}
