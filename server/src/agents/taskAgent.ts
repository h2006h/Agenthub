import { callLLM } from './llm'
import { loadAgentConfig } from './index'

const DEFAULT_PROMPT = `
你是一个专业的任务管理助手，擅长将自然语言需求拆解成清晰的任务列表。

任务拆解规则：
1. 将用户的需求分解为多个独立的子任务
2. 分析任务之间的依赖关系
3. 为每个任务分配优先级（高/中/低）
4. 输出格式为JSON数组，包含任务标题、描述、优先级和依赖

输出格式示例：
[
  {
    "title": "任务标题",
    "description": "任务描述",
    "priority": "high/medium/low",
    "dependencies": ["依赖任务ID"]
  }
]

请严格按照JSON格式输出，不要包含其他文本。
`

export interface TaskItem {
  title: string
  description: string
  priority: 'high' | 'medium' | 'low'
  dependencies: string[]
}

export const taskAgent = async (requirement: string): Promise<TaskItem[]> => {
  const config = await loadAgentConfig('agent-task')
  const systemPrompt = config.systemPrompt || DEFAULT_PROMPT

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    { role: 'user' as const, content: requirement }
  ]

  const response = await callLLM(messages)

  try {
    return JSON.parse(response)
  } catch {
    return [{
      title: '解析失败',
      description: '无法解析需求，请尝试用更清晰的语言描述',
      priority: 'low',
      dependencies: []
    }]
  }
}

export const analyzeTaskProgress = async (tasks: TaskItem[]): Promise<string> => {
  const messages = [
    { role: 'system' as const, content: '你是一个任务进度分析助手，请分析以下任务列表的完成情况和风险。' },
    { role: 'user' as const, content: JSON.stringify(tasks, null, 2) }
  ]

  return callLLM(messages)
}
