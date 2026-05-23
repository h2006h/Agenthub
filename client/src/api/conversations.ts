import { request } from './base'

export interface AgentInfo {
  id: string
  name: string
  type: 'knowledge' | 'task' | 'code'
  description?: string
}

export interface Conversation {
  id: string
  name: string
  type: 'single' | 'group' | 'agent'
  avatar?: string
  participants: string[]
  agentParticipants?: string[]
  createdAt: number
  lastMessage?: string
  lastTime?: number
  unreadCount?: number
}

export const getConversations = async (): Promise<Conversation[]> => {
  return request('/conversations', 'GET')
}

export const getConversation = async (id: string): Promise<Conversation> => {
  return request(`/conversations/${id}`, 'GET')
}

export const createConversation = async (
  name: string,
  type: 'single' | 'group' | 'agent',
  participants?: string[],
  avatar?: string,
  agentIds?: string[]
): Promise<Conversation> => {
  return request('/conversations', 'POST', { name, type, participants, avatar, agentIds })
}

export const updateConversationAvatar = async (
  id: string,
  avatar: string
): Promise<Conversation> => {
  return request(`/conversations/${id}/avatar`, 'PUT', { avatar })
}

export const renameConversation = async (
  id: string,
  name: string
): Promise<Conversation> => {
  return request(`/conversations/${id}`, 'PUT', { name })
}

export interface Participant {
  id: string
  username: string
  email: string
}

export interface ConversationParticipants {
  participants: Participant[]
  agents: AgentInfo[]
}

export const getConversationParticipants = async (id: string): Promise<ConversationParticipants> => {
  return request(`/conversations/${id}/participants`, 'GET')
}

export const addParticipants = async (id: string, userIds: string[]): Promise<{ success: boolean }> => {
  return request(`/conversations/${id}/participants`, 'POST', { userIds })
}

export const removeParticipant = async (id: string, userId: string): Promise<{ success: boolean }> => {
  return request(`/conversations/${id}/participants/${userId}`, 'DELETE')
}

export const getConversationAgents = async (id: string): Promise<AgentInfo[]> => {
  return request(`/conversations/${id}/agents`, 'GET')
}

export const addAgent = async (id: string, agentId: string): Promise<{ success: boolean }> => {
  return request(`/conversations/${id}/agents`, 'POST', { agentId })
}

export const removeAgent = async (id: string, agentId: string): Promise<{ success: boolean }> => {
  return request(`/conversations/${id}/agents/${agentId}`, 'DELETE')
}

export const getAgents = async (): Promise<AgentInfo[]> => {
  return request('/agents', 'GET')
}
