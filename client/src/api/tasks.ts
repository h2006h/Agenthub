import { request } from './base'

export interface Task {
  id: string
  title: string
  description: string
  status: 'pending' | 'in_progress' | 'completed'
  priority: 'high' | 'medium' | 'low'
  assignee: string
  parentId?: string
  result?: string
  result_type?: string
  createdAt: number
  updatedAt: number
}

export const getTasks = async (status?: string): Promise<Task[]> => {
  const url = status ? `/tasks?status=${status}` : '/tasks'
  return request(url, 'GET')
}

export const getTask = async (id: string): Promise<Task> => {
  return request(`/tasks/${id}`, 'GET')
}

export const createTask = async (
  title: string,
  description: string,
  status: 'pending' | 'in_progress' | 'completed',
  priority: 'high' | 'medium' | 'low',
  assignee: string,
  parentId?: string
): Promise<Task> => {
  return request('/tasks', 'POST', {
    title,
    description,
    status,
    priority,
    assignee,
    parentId
  })
}

export const updateTask = async (
  id: string,
  updates: Partial<Pick<Task, 'title' | 'description' | 'status' | 'priority' | 'assignee'>>
): Promise<Task> => {
  return request(`/tasks/${id}`, 'PUT', updates)
}

export const deleteTask = async (id: string): Promise<{ success: boolean }> => {
  return request(`/tasks/${id}`, 'DELETE')
}

export interface ExecutionEvent {
  type: 'start' | 'chunk' | 'done' | 'aborted' | 'error'
  content?: string
  taskId?: string
  resultType?: string
  error?: string
}

export const executeTaskStream = (
  id: string,
  onEvent: (event: ExecutionEvent) => void,
  signal?: AbortSignal
): Promise<void> => {
  const token = localStorage.getItem('agenthub_token')
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  return fetch(`/api/tasks/${id}/execute`, {
    method: 'POST',
    headers,
    signal
  }).then(async (response) => {
    if (!response.ok) {
      const err = await response.json()
      throw new Error(err.error || '请求失败')
    }

    const reader = response.body?.getReader()
    if (!reader) throw new Error('No response body')

    const decoder = new TextDecoder()
    let buffer = ''

    const processLines = () => {
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim()
        if (!line) continue

        if (line.startsWith('event:')) {
          const eventType = line.slice(6).trim()
          const dataLine = lines[i + 1]
          if (dataLine && dataLine.trim().startsWith('data:')) {
            try {
              const data = JSON.parse(dataLine.trim().slice(5).trim())
              onEvent({ type: eventType as ExecutionEvent['type'], ...data })
            } catch {}
            i++
          }
        }
      }
    }

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      processLines()
    }

    decoder.decode()
    processLines()
  })
}

export const executeTask = async (id: string): Promise<Task> => {
  return request(`/tasks/${id}/execute`, 'POST')
}

export const stopTask = async (id: string): Promise<{ success: boolean }> => {
  return request(`/tasks/${id}/stop`, 'POST')
}

export const exportCompletedTasks = async (): Promise<void> => {
  const token = localStorage.getItem('agenthub_token')
  const response = await fetch('/api/tasks/export', {
    headers: token ? { 'Authorization': `Bearer ${token}` } : {}
  })
  if (!response.ok) {
    const err = await response.json()
    throw new Error(err.error || '导出失败')
  }
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'completed-tasks.zip'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
