const MAX_CONTEXT_TOKENS = 60000 // Leave room for response (128K total for GLM)

// Heuristic token estimation
// Chinese chars ~1.3 tokens/char, English ~0.4 tokens/char, spaces/punctuation ~0.25
export const estimateTokens = (text: string): number => {
  let tokens = 0
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    if (code >= 0x4e00 && code <= 0x9fff) {
      // CJK Unified Ideographs
      tokens += 1.3
    } else if (
      (code >= 0x3040 && code <= 0x309f) || // Hiragana
      (code >= 0x30a0 && code <= 0x30ff) || // Katakana
      (code >= 0xac00 && code <= 0xd7af)    // Hangul
    ) {
      tokens += 1.2
    } else if (code <= 0x7f) {
      // ASCII
      tokens += code === 0x20 ? 0.25 : 0.35
    } else {
      // Other unicode
      tokens += 0.5
    }
  }
  return Math.ceil(tokens)
}

interface ContextMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

// Truncate context using a sliding window: keep system prompt, then keep
// as many recent messages as fit within the token budget.
export const truncateContext = (
  messages: ContextMessage[],
  maxTokens: number = MAX_CONTEXT_TOKENS
): ContextMessage[] => {
  if (messages.length === 0) return messages

  // Always preserve the system prompt
  const systemMessages = messages.filter(m => m.role === 'system')
  const nonSystemMessages = messages.filter(m => m.role !== 'system')

  let systemTokens = 0
  for (const sm of systemMessages) {
    systemTokens += estimateTokens(sm.content) + 4
  }

  const availableTokens = maxTokens - systemTokens
  if (availableTokens <= 0) {
    // Edge case: system prompt alone exceeds budget — trim it
    const truncatedSystem = systemMessages.map(sm => ({
      ...sm,
      content: sm.content.slice(0, Math.floor(maxTokens * 0.8 * 3))
    }))
    return truncatedSystem
  }

  // Reverse iterate through non-system messages, keeping most recent
  const kept: ContextMessage[] = []
  let usedTokens = 0

  for (let i = nonSystemMessages.length - 1; i >= 0; i--) {
    const msg = nonSystemMessages[i]
    const msgTokens = estimateTokens(msg.content) + 4 // overhead per message

    if (usedTokens + msgTokens > availableTokens) {
      // Truncate last message's content to fit if possible
      const remaining = availableTokens - usedTokens
      if (remaining > 50) {
        const charBudget = Math.floor(remaining * 3) // ~3 chars per token
        kept.unshift({
          ...msg,
          content: msg.content.slice(0, charBudget) + '...'
        })
      }
      break
    }

    kept.unshift(msg)
    usedTokens += msgTokens
  }

  return [...systemMessages, ...kept]
}
