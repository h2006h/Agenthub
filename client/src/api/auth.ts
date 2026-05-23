import { request } from './base'

export interface AuthResponse {
  token: string
  userId: string
  username: string
}

export const register = async (username: string, password: string): Promise<AuthResponse> => {
  return request('/auth/register', 'POST', { username, password })
}

export const login = async (username: string, password: string): Promise<AuthResponse> => {
  return request('/auth/login', 'POST', { username, password })
}

export const verifyToken = async (): Promise<{ userId: string; username: string; email: string; avatar: string }> => {
  return request('/auth/verify', 'GET')
}

export interface UserProfile {
  id: string
  username: string
  bio: string
  avatar: string
  createdAt: number
}

export const getProfile = async (): Promise<UserProfile> => {
  return request('/auth/profile', 'GET')
}

export const updateProfile = async (data: { username?: string; bio?: string; avatar?: string }): Promise<UserProfile> => {
  return request('/auth/profile', 'PUT', data)
}

export const changePassword = async (oldPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> => {
  return request('/auth/password', 'PUT', { oldPassword, newPassword })
}

export const searchUsers = async (query?: string): Promise<{ id: string; username: string }[]> => {
  const qs = query ? `?q=${encodeURIComponent(query)}` : ''
  return request(`/auth/users/search${qs}`, 'GET')
}
