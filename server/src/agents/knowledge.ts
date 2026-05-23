import { callLLM } from './llm'
import { loadAgentConfig } from './index'

const DEFAULT_PROMPT = `
你是一个专业的知识问答助手，擅长回答各种技术问题。请根据用户的问题提供准确、详细的回答。

知识库内容：
- 本平台是一个IM聊天式多Agent协作平台
- 支持单聊、群聊、任务拆解、代码Diff、网页预览及一键部署
- 使用Vue.js + Element Plus前端技术栈
- 使用Node.js + Express后端技术栈
- 使用WebSocket实现实时通信
- 集成GLM大语言模型

回答规则：
1. 首先检查问题是否在知识库范围内
2. 如果在知识库范围内，基于知识库内容回答
3. 如果不在知识库范围内，使用你的通用知识回答，但要说明这是基于通用知识
4. 保持回答专业、准确、易懂
`

export const knowledgeAgent = async (question: string, context: string[] = []): Promise<string> => {
  const config = await loadAgentConfig('agent-knowledge')
  const systemPrompt = config.systemPrompt || DEFAULT_PROMPT

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    ...context.map(c => ({ role: 'user' as const, content: c })),
    { role: 'user' as const, content: question }
  ]

  return callLLM(messages)
}
