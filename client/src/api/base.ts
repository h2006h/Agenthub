const BASE_URL = '/api'

let onUnauthorized: (() => void) | null = null

export const setOnUnauthorized = (handler: () => void) => {
  onUnauthorized = handler
}

export const request = async <T>(
  url: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' = 'GET',
  data?: Record<string, unknown>
): Promise<T> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }

  const token = localStorage.getItem('agenthub_token')
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const options: RequestInit = {
    method,
    headers
  }

  if (data) {
    options.body = JSON.stringify(data)
  }

  const response = await fetch(`${BASE_URL}${url}`, options)

  if (response.status === 401) {
    localStorage.removeItem('agenthub_token')
    if (onUnauthorized) {
      onUnauthorized()
    }
    throw new Error('登录已过期，请重新登录')
  }

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || '请求失败')
  }

  return response.json()
}
