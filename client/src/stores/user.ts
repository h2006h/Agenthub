import { defineStore } from 'pinia'
import { ref } from 'vue'
import { register, login, verifyToken, type AuthResponse } from '@/api/auth'

export const useUserStore = defineStore('user', () => {
  const user = ref<{ id: string; username: string; email: string; avatar: string } | null>(null)
  const token = ref<string>('')
  const isLoggedIn = ref(false)

  const setUser = (userData: { id: string; username: string; email?: string; avatar?: string }) => {
    user.value = {
      id: userData.id,
      username: userData.username,
      email: userData.email || '',
      avatar: userData.avatar || ''
    }
    isLoggedIn.value = true
  }

  const setToken = (newToken: string) => {
    token.value = newToken
    localStorage.setItem('agenthub_token', newToken)
  }

  const clearUser = () => {
    user.value = null
    token.value = ''
    isLoggedIn.value = false
    localStorage.removeItem('agenthub_token')
  }

  const handleLogin = async (username: string, password: string): Promise<AuthResponse> => {
    const response = await login(username, password)
    setToken(response.token)
    setUser({ id: response.userId, username: response.username })
    return response
  }

  const handleRegister = async (username: string, password: string): Promise<AuthResponse> => {
    const response = await register(username, password)
    setToken(response.token)
    setUser({ id: response.userId, username: response.username })
    return response
  }

  const handleLogout = () => {
    clearUser()
  }

  const checkAuth = async () => {
    const savedToken = localStorage.getItem('agenthub_token')
    if (savedToken && !isLoggedIn.value) {
      try {
        token.value = savedToken
        const response = await verifyToken()
        setUser({ id: response.userId, username: response.username, email: response.email, avatar: response.avatar })
        return true
      } catch {
        localStorage.removeItem('agenthub_token')
        token.value = ''
        return false
      }
    }
    return isLoggedIn.value
  }

  return {
    user,
    token,
    isLoggedIn,
    setUser,
    setToken,
    clearUser,
    handleLogin,
    handleRegister,
    handleLogout,
    checkAuth
  }
})
