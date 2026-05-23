import { request } from './base'

export interface Deployment {
  id: string
  environment: string
  version: string
  status: 'success' | 'failed' | 'running'
  log: string
  createdAt: number
}

export const getDeployments = async (): Promise<Deployment[]> => {
  return request('/deploy', 'GET')
}

export const getDeployment = async (id: string): Promise<Deployment> => {
  return request(`/deploy/${id}`, 'GET')
}

export const createDeployment = async (
  environment: string,
  version?: string,
  type?: string,
  branch?: string,
  buildCommand?: string,
  outputDir?: string,
  projectDir?: string
): Promise<Deployment> => {
  return request('/deploy', 'POST', { environment, version, type, branch, buildCommand, outputDir, projectDir })
}

export const updateDeploymentStatus = async (
  id: string,
  status: 'success' | 'failed' | 'running',
  log?: string
): Promise<Deployment> => {
  return request(`/deploy/${id}/status`, 'PUT', { status, log })
}

export const createDeploymentWithUpload = async (formData: FormData): Promise<Deployment> => {
  const token = localStorage.getItem('agenthub_token')
  const headers: Record<string, string> = {}
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch('/api/deploy/upload', {
    method: 'POST',
    headers,
    body: formData
  })

  if (response.status === 401) {
    localStorage.removeItem('agenthub_token')
    throw new Error('登录已过期，请重新登录')
  }

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || '上传失败')
  }

  return response.json()
}
