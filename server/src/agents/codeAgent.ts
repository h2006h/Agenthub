import { callLLM } from './llm'
import { loadAgentConfig } from './index'

const DEFAULT_PROMPT = `
你是一个专业的代码助手，擅长以下领域：
- JavaScript/TypeScript
- Vue.js 3
- Node.js
- Python
- SQL
- Git

你可以帮助用户：
1. 生成代码
2. 审查代码
3. 优化代码
4. 解释代码
5. 修复bug

回答规则：
1. 如果用户要求生成代码，请提供完整的可运行代码
2. 如果用户要求审查代码，请分析代码质量、安全性和性能
3. 如果用户要求优化代码，请提供具体的优化建议和优化后的代码
4. 使用markdown格式输出，代码用代码块包裹
5. 代码块需要指定语言

请直接给出答案，不要使用多余的解释。
`

export const codeAgent = async (query: string, context: string[] = []): Promise<string> => {
  const config = await loadAgentConfig('agent-code')
  const systemPrompt = config.systemPrompt || DEFAULT_PROMPT

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    ...context.map(c => ({ role: 'user' as const, content: c })),
    { role: 'user' as const, content: query }
  ]

  return callLLM(messages)
}

export const reviewCode = async (code: string, language: string = 'javascript'): Promise<string> => {
  const reviewPrompt = `
请审查以下${language}代码：

代码：
${code}

请从以下方面进行审查：
1. 代码质量
2. 安全性
3. 性能
4. 可读性
5. 最佳实践

提供具体的改进建议。
`

  const messages = [
    { role: 'system' as const, content: '你是一个专业的代码审查助手。' },
    { role: 'user' as const, content: reviewPrompt }
  ]

  return callLLM(messages)
}

export const generateCode = async (description: string, language: string = 'javascript'): Promise<string> => {
  const generatePrompt = `
请根据以下描述生成${language}代码：

需求描述：
${description}

要求：
1. 代码完整可运行
2. 包含必要的注释
3. 遵循最佳实践
4. 使用适当的设计模式

输出格式：
\`\`\`${language}
// 代码注释
代码内容
\`\`\`
`

  const messages = [
    { role: 'system' as const, content: '你是一个专业的代码生成助手。' },
    { role: 'user' as const, content: generatePrompt }
  ]

  return callLLM(messages)
}
