<template>
  <div class="login-container">
    <div class="background-decoration">
      <div class="decoration-circle circle-1"></div>
      <div class="decoration-circle circle-2"></div>
      <div class="decoration-circle circle-3"></div>
      <div class="decoration-circle circle-4"></div>
      <div class="decoration-circle circle-5"></div>
    </div>
    
    <div class="login-card">
      <div class="logo-section">
        <div class="logo">
          <Cpu :size="48" />
        </div>
        <h2>AgentHub</h2>
        <p>智能协作平台</p>
      </div>
      
      <el-tabs v-model="activeTab" class="login-tabs">
        <el-tab-pane label="登录" name="login">
          <el-form :model="loginForm" label-width="80px">
            <el-form-item label="用户名">
              <el-input
                v-model="loginForm.username"
                placeholder="请输入用户名"
                @keyup.enter="handleLogin"
              />
            </el-form-item>
            <el-form-item label="密码">
              <el-input
                v-model="loginForm.password"
                type="password"
                show-password
                placeholder="请输入密码"
                @keyup.enter="handleLogin"
              />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" class="login-btn" @click="handleLogin" :loading="isLoading">
                登录
              </el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <el-tab-pane label="注册" name="register">
          <el-form :model="registerForm" label-width="80px">
            <el-form-item label="用户名">
              <el-input
                v-model="registerForm.username"
                placeholder="请输入用户名"
                @keyup.enter="handleRegister"
              />
            </el-form-item>
            <el-form-item label="密码">
              <el-input
                v-model="registerForm.password"
                type="password"
                show-password
                placeholder="请输入密码（至少6位）"
                @keyup.enter="handleRegister"
              />
            </el-form-item>
            <el-form-item label="确认密码">
              <el-input
                v-model="registerForm.confirmPassword"
                type="password"
                show-password
                placeholder="请再次输入密码"
                @keyup.enter="handleRegister"
              />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" class="login-btn" @click="handleRegister" :loading="isLoading">
                注册
              </el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>
      </el-tabs>
      
      <div v-if="errorMessage" class="error-message">
        <Warning /> {{ errorMessage }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { Warning, Cpu } from '@element-plus/icons-vue'

const router = useRouter()
const userStore = useUserStore()

const activeTab = ref('login')
const isLoading = ref(false)
const errorMessage = ref('')

const loginForm = reactive({
  username: '',
  password: ''
})

const registerForm = reactive({
  username: '',
  password: '',
  confirmPassword: ''
})

const handleLogin = async () => {
  if (!loginForm.username || !loginForm.password) {
    errorMessage.value = '请输入用户名和密码'
    return
  }

  isLoading.value = true
  errorMessage.value = ''

  try {
    await userStore.handleLogin(loginForm.username, loginForm.password)
    router.push('/')
  } catch (error) {
    errorMessage.value = (error as Error).message || '登录失败'
  } finally {
    isLoading.value = false
  }
}

const handleRegister = async () => {
  errorMessage.value = ''

  if (!registerForm.username || !registerForm.password || !registerForm.confirmPassword) {
    errorMessage.value = '请填写所有字段'
    return
  }

  if (registerForm.password.length < 6) {
    errorMessage.value = '密码至少需要6位'
    return
  }

  if (registerForm.password !== registerForm.confirmPassword) {
    errorMessage.value = '两次输入的密码不一致'
    return
  }

  isLoading.value = true

  try {
    await userStore.handleRegister(registerForm.username, registerForm.password)
    router.push('/')
  } catch (error) {
    errorMessage.value = (error as Error).message || '注册失败'
  } finally {
    isLoading.value = false
  }
}
</script>

<style>
.login-container {
  height: 100vh;
  width: 100vw;
  max-width: 100vw;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  position: relative;
  overflow: hidden;
}

.background-decoration {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
}

.decoration-circle {
  position: absolute;
  border-radius: 50%;
  opacity: 0.3;
  animation: float 8s ease-in-out infinite;
}

.circle-1 {
  width: 300px;
  height: 300px;
  background: rgba(255, 255, 255, 0.3);
  top: -100px;
  right: -50px;
  animation-delay: 0s;
}

.circle-2 {
  width: 200px;
  height: 200px;
  background: rgba(255, 255, 255, 0.2);
  bottom: -50px;
  left: -30px;
  animation-delay: 2s;
}

.circle-3 {
  width: 150px;
  height: 150px;
  background: rgba(255, 255, 255, 0.25);
  top: 50%;
  right: 20%;
  animation-delay: 4s;
}

.circle-4 {
  width: 100px;
  height: 100px;
  background: rgba(255, 255, 255, 0.15);
  bottom: 30%;
  right: 10%;
  animation-delay: 1s;
}

.circle-5 {
  width: 80px;
  height: 80px;
  background: rgba(255, 255, 255, 0.2);
  top: 20%;
  left: 15%;
  animation-delay: 3s;
}

@keyframes float {
  0%, 100% {
    transform: translateY(0) rotate(0deg);
  }
  50% {
    transform: translateY(-20px) rotate(5deg);
  }
}

.login-card {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-radius: 24px;
  padding: 48px;
  width: 420px;
  max-width: 90vw;
  box-shadow: 0 25px 80px rgba(0, 0, 0, 0.2);
  position: relative;
  z-index: 10;
}

.logo-section {
  text-align: center;
  margin-bottom: 30px;
}

.logo {
  width: 80px;
  height: 80px;
  margin: 0 auto 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
}

.logo-section h2 {
  margin: 0 0 8px 0;
  font-size: 24px;
  color: #333;
}

.logo-section p {
  margin: 0;
  color: #999;
  font-size: 14px;
}

.login-tabs {
  margin-bottom: 20px;
}

.login-btn {
  width: 100%;
  height: 44px;
  font-size: 16px;
}

.error-message {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #f56c6c;
  font-size: 14px;
  padding: 12px;
  background: #fef0f0;
  border-radius: 8px;
  margin-top: 16px;
}
</style>
