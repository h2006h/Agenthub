import { getDB } from '../database'

export type AgentType = 'knowledge' | 'task' | 'code'

export interface AgentResponse {
  response: string
  agentId: string
  agentName: string
}

export interface AgentConfig {
  systemPrompt?: string
  temperature?: number
  responseFormat?: string
}

// Simple TTL cache for agent configs
const configCache: Map<string, { config: AgentConfig; expiresAt: number }> = new Map()
const CACHE_TTL_MS = 60_000

export const loadAgentConfig = async (agentId: string): Promise<AgentConfig> => {
  const cached = configCache.get(agentId)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.config
  }

  try {
    const db = getDB()
    const agent = await db.get('SELECT config FROM agents WHERE id = ?', [agentId])
    if (agent?.config) {
      const parsed = JSON.parse(agent.config) as AgentConfig
      configCache.set(agentId, { config: parsed, expiresAt: Date.now() + CACHE_TTL_MS })
      return parsed
    }
  } catch (e) {
    // Config parse or DB error — fall back to defaults below
  }

  return {}
}

export const clearAgentConfigCache = () => {
  configCache.clear()
}

export const getAgentName = (type: AgentType): string => {
  const names: Record<AgentType, string> = {
    knowledge: '知识问答助手',
    task: '任务管理助手',
    code: '代码助手'
  }
  return names[type]
}

// Kept for backward compatibility with non-streaming HTTP chat endpoint
import { knowledgeAgent } from './knowledge'
import { taskAgent } from './taskAgent'
import { codeAgent } from './codeAgent'

export const agentHandlers: Record<AgentType, (message: string, context?: string[]) => Promise<string | unknown>> = {
  knowledge: knowledgeAgent,
  task: taskAgent as unknown as (message: string, context?: string[]) => Promise<string | unknown>,
  code: codeAgent
}

export const getAgentResponse = async (
  agentId: string,
  message: string,
  context: string[] = []
): Promise<AgentResponse> => {
  const agentType = agentId as AgentType

  if (!agentHandlers[agentType]) {
    throw new Error(`未知的Agent类型: ${agentId}`)
  }

  const response = await agentHandlers[agentType](message, context)

  const responseStr = typeof response === 'string' ? response : JSON.stringify(response)

  return {
    response: responseStr,
    agentId,
    agentName: getAgentName(agentType)
  }
}
