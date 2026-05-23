import axios from 'axios'

const API_KEY = process.env.API_KEY || 'your_api_key_here'
const API_URL = process.env.API_URL || 'https://open.bigmodel.cn/api/paas/v4/chat/completions'
const API_MODEL = process.env.API_MODEL || 'glm-4-flash'

const MAX_RETRIES = 3
const BASE_DELAY_MS = 1000

interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
}

interface LLMResponse {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    index: number
    message: {
      role: string
      content: string
      reasoning_content?: string
    }
    finish_reason: string
  }>
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

const delay = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms))

const isRetryableError = (error: unknown): boolean => {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status
    if (status && (status >= 500 || status === 429)) return true
    if (!status) return true
    return false
  }
  return false
}

const callLLMCore = async (messages: Message[], model: string = API_MODEL): Promise<string> => {
  const response = await axios.post<LLMResponse>(
    API_URL,
    {
      model,
      messages,
      temperature: 0.7,
      max_tokens: 8192
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      }
    }
  )

  const msg = response.data.choices[0]?.message
  return msg?.content || msg?.reasoning_content || ''
}

export const callLLM = async (messages: Message[], model: string = API_MODEL): Promise<string> => {
  let lastError: unknown

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await callLLMCore(messages, model)
    } catch (error) {
      lastError = error

      if (attempt < MAX_RETRIES && isRetryableError(error)) {
        const jitter = Math.random() * 0.5 + 0.5
        const waitMs = BASE_DELAY_MS * Math.pow(2, attempt) * jitter
        console.warn(`LLM API retry ${attempt + 1}/${MAX_RETRIES} after ${Math.round(waitMs)}ms`)
        await delay(waitMs)
        continue
      }

      break
    }
  }

  const errMsg = axios.isAxiosError(lastError)
    ? `AI服务调用失败: ${lastError.response?.status} ${JSON.stringify(lastError.response?.data)}`
    : `AI服务调用失败: ${(lastError as any)?.message || lastError}`
  console.error('LLM API error (all retries exhausted):', errMsg)
  throw new Error(errMsg)
}

export const callLLMStream = async (
  messages: Message[],
  onChunk: (text: string) => void,
  model: string = API_MODEL,
  signal?: AbortSignal
): Promise<string> => {
  let lastError: unknown

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    // Check if already aborted before retrying
    if (signal?.aborted) {
      const err = new Error('Aborted') as Error & { name: string }
      err.name = 'AbortError'
      throw err
    }

    try {
      const response = await axios.post(
        API_URL,
        {
          model,
          messages,
          temperature: 0.7,
          max_tokens: 8192,
          stream: true
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_KEY}`
          },
          responseType: 'stream',
          signal
        }
      )

      return new Promise((resolve, reject) => {
        let answerContent = ''
        let buffer = ''

        const onAbort = () => {
          response.data.destroy()
          const err = new Error('Aborted') as Error & { name: string }
          err.name = 'AbortError'
          reject(err)
        }

        if (signal) {
          signal.addEventListener('abort', onAbort, { once: true })
        }

        response.data.on('data', (chunk: Buffer) => {
          buffer += chunk.toString()

          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed || !trimmed.startsWith('data:')) continue

            const jsonStr = trimmed.slice(5).trim()
            if (jsonStr === '[DONE]') continue

            try {
              const parsed = JSON.parse(jsonStr)
              const delta = parsed.choices?.[0]?.delta

              if (delta?.content) {
                answerContent += delta.content
                onChunk(delta.content)
              }
            } catch {
              // Skip unparseable chunks
            }
          }
        })

        response.data.on('end', () => {
          if (signal) signal.removeEventListener('abort', onAbort)
          resolve(answerContent)
        })

        response.data.on('error', (err: Error) => {
          if (signal) signal.removeEventListener('abort', onAbort)
          reject(err)
        })
      })
    } catch (error: any) {
      lastError = error
      if (error?.name === 'AbortError' || signal?.aborted) throw error

      if (attempt < MAX_RETRIES && isRetryableError(error)) {
        const jitter = Math.random() * 0.5 + 0.5
        const waitMs = BASE_DELAY_MS * Math.pow(2, attempt) * jitter
        console.warn(`LLM Stream retry ${attempt + 1}/${MAX_RETRIES} after ${Math.round(waitMs)}ms`)
        await delay(waitMs)
        continue
      }
      break
    }
  }

  const errMsg = axios.isAxiosError(lastError)
    ? `AI服务调用失败: ${lastError.response?.status} ${JSON.stringify(lastError.response?.data)}`
    : `AI服务调用失败: ${(lastError as any)?.message || lastError}`
  console.error('LLM Stream error (all retries exhausted):', errMsg)
  throw new Error(errMsg)
}
