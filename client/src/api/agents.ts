import { request } from './base'

export interface Agent {
  id: string
  name: string
  type: 'knowledge' | 'task' | 'code'
  description: string
  config: string
  createdAt: number
}

export interface AgentResponse {
  response: string
  agentId: string
  agentName: string
}

export const getAgents = async (): Promise<Agent[]> => {
  return request('/agents', 'GET')
}

export const getAgent = async (id: string): Promise<Agent> => {
  return request(`/agents/${id}`, 'GET')
}

export const chatWithAgent = async (
  agentId: string,
  message: string,
  context?: string[]
): Promise<AgentResponse> => {
  return request('/agents/chat', 'POST', { agentId, message, context })
}
