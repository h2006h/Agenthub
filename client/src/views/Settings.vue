<template>
  <div class="page-container">
    <Sidebar activeMenu="settings" />

    <div class="settings-container">
      <!-- Hero: Avatar + Identity -->
      <section class="hero-section">
        <div class="hero-avatar" @click="triggerAvatarInput">
          <el-avatar :size="88" :src="profileForm.avatar" class="hero-avatar-img">
            <UserFilled :size="40" />
          </el-avatar>
          <div class="hero-avatar-badge">
            <Camera :size="14" />
          </div>
        </div>
        <input ref="avatarInputRef" type="file" accept="image/*" class="avatar-file-input" @change="onAvatarFileChange" />
        <div class="hero-text">
          <h2 class="hero-name">{{ profileForm.username || '未命名用户' }}</h2>
          <p class="hero-bio">{{ profileForm.bio || '暂无简介 — 在下方编辑资料中填写' }}</p>
          <p class="hero-meta">注册时间 {{ createdAtText }}</p>
        </div>
      </section>

      <!-- Two-column grid -->
      <div class="settings-grid">
        <!-- Left Column -->
        <div class="settings-col">
          <section class="setting-section">
            <div class="section-head">
              <h3>编辑资料</h3>
              <p>更新您的用户名和个人简介，其他用户可以看到这些信息</p>
            </div>
            <el-card class="section-card">
              <el-form :model="profileForm" label-width="80px" class="setting-form">
                <el-form-item label="用户名">
                  <el-input v-model="profileForm.username" placeholder="输入用户名" maxlength="30" show-word-limit />
                  <div class="form-hint">用户名是您在本平台的唯一标识，支持中英文和数字</div>
                </el-form-item>
                <el-form-item label="个人简介">
                  <el-input type="textarea" v-model="profileForm.bio" :rows="3" placeholder="介绍一下自己，让其他人更了解你..." maxlength="200" show-word-limit />
                  <div class="form-hint">简要描述您的角色、技能或兴趣，最多 200 字</div>
                </el-form-item>
                <el-form-item>
                  <el-button type="primary" @click="saveProfile" :loading="savingProfile">保存资料</el-button>
                </el-form-item>
              </el-form>
            </el-card>
          </section>

          <section class="setting-section">
            <div class="section-head">
              <h3>账号安全</h3>
              <p>修改登录密码，建议定期更新以保障账号安全</p>
            </div>
            <el-card class="section-card">
              <el-form :model="passwordForm" label-width="80px" class="setting-form">
                <el-form-item label="原密码">
                  <el-input v-model="passwordForm.oldPassword" type="password" show-password placeholder="输入当前密码" />
                </el-form-item>
                <el-form-item label="新密码">
                  <el-input v-model="passwordForm.newPassword" type="password" show-password placeholder="至少 6 位字符" />
                </el-form-item>
                <el-form-item label="确认密码">
                  <el-input v-model="passwordForm.confirmPassword" type="password" show-password placeholder="再次输入新密码" />
                </el-form-item>
                <el-form-item>
                  <el-button type="primary" @click="changePwd" :loading="changingPwd">修改密码</el-button>
                </el-form-item>
              </el-form>
            </el-card>
          </section>
        </div>

        <!-- Right Column -->
        <div class="settings-col">
          <section class="setting-section">
            <div class="section-head">
              <h3>账号信息</h3>
              <p>您的账号基本信息和平台版本</p>
            </div>
            <el-card class="section-card">
              <div class="info-table">
                <div class="info-row">
                  <span class="info-label">用户 ID</span>
                  <code class="info-value">{{ userStore.user?.id || '-' }}</code>
                </div>
                <div class="info-row">
                  <span class="info-label">电子邮箱</span>
                  <code class="info-value">{{ userStore.user?.email || '-' }}</code>
                </div>
                <div class="info-row">
                  <span class="info-label">平台版本</span>
                  <span class="info-value">AgentHub v1.0</span>
                </div>
              </div>
            </el-card>
          </section>

          <section class="setting-section">
            <div class="section-head danger-head">
              <h3>危险操作</h3>
              <p>这些操作不可撤销，请谨慎执行</p>
            </div>
            <el-card class="danger-card">
              <div class="danger-content">
                <div class="danger-text">
                  <strong>退出登录</strong>
                  <p>退出后将清除本地登录凭证，需要重新输入账号密码才能访问</p>
                </div>
                <el-button type="danger" plain @click="handleLogout">
                  <SwitchButton /> 退出登录
                </el-button>
              </div>
            </el-card>
          </section>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { SwitchButton, UserFilled, Camera } from '@element-plus/icons-vue'
import Sidebar from '@/components/Sidebar.vue'
import { useUserStore } from '@/stores/user'
import { getProfile, updateProfile, changePassword } from '@/api/auth'
import { ElMessage, ElMessageBox } from 'element-plus'

const userStore = useUserStore()

const profileForm = reactive({ username: '', bio: '', avatar: '' })
const passwordForm = reactive({ oldPassword: '', newPassword: '', confirmPassword: '' })
const savingProfile = ref(false)
const changingPwd = ref(false)
const createdAtText = ref('')
const avatarInputRef = ref<HTMLInputElement | null>(null)

onMounted(async () => {
  try {
    const profile = await getProfile()
    profileForm.username = profile.username
    profileForm.bio = profile.bio || ''
    profileForm.avatar = profile.avatar || ''
    createdAtText.value = new Date(profile.createdAt).toLocaleString()
  } catch {
    // use defaults
  }
})

const triggerAvatarInput = () => {
  avatarInputRef.value?.click()
}

const onAvatarFileChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  if (file.size > 2 * 1024 * 1024) {
    ElMessage.warning('头像文件大小不能超过 2MB')
    return
  }

  const reader = new FileReader()
  reader.onload = (e) => {
    const dataUrl = e.target?.result as string
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const size = Math.min(img.width, img.height, 256)
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')!
      const sx = (img.width - size) / 2
      const sy = (img.height - size) / 2
      ctx.drawImage(img, sx, sy, size, size, 0, 0, size, size)
      profileForm.avatar = canvas.toDataURL('image/jpeg', 0.85)
    }
    img.src = dataUrl
  }
  reader.readAsDataURL(file)
}

const saveProfile = async () => {
  if (!profileForm.username.trim()) {
    ElMessage.warning('用户名不能为空')
    return
  }

  savingProfile.value = true
  try {
    const result = await updateProfile({
      username: profileForm.username,
      bio: profileForm.bio,
      avatar: profileForm.avatar
    })
    if (result.avatar !== undefined) {
      userStore.user!.avatar = result.avatar
    }
    ElMessage.success('个人信息已更新')
  } catch (error: any) {
    ElMessage.error(error.message || '更新失败')
  } finally {
    savingProfile.value = false
  }
}

const changePwd = async () => {
  if (!passwordForm.oldPassword || !passwordForm.newPassword) {
    ElMessage.warning('请填写完整密码信息')
    return
  }
  if (passwordForm.newPassword.length < 6) {
    ElMessage.warning('新密码至少6位')
    return
  }
  if (passwordForm.newPassword !== passwordForm.confirmPassword) {
    ElMessage.warning('两次密码不一致')
    return
  }

  changingPwd.value = true
  try {
    await changePassword(passwordForm.oldPassword, passwordForm.newPassword)
    ElMessage.success('密码修改成功，请重新登录')
    passwordForm.oldPassword = ''
    passwordForm.newPassword = ''
    passwordForm.confirmPassword = ''
  } catch (error: any) {
    ElMessage.error(error.message || '修改失败')
  } finally {
    changingPwd.value = false
  }
}

const handleLogout = () => {
  ElMessageBox.confirm('确定要退出登录吗？', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    localStorage.removeItem('agenthub_token')
    window.location.href = '/login'
  }).catch(() => {})
}
</script>

<style>
.settings-container {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 30%, #f0f4ff 100%);
  padding: 36px 48px 48px;
}

/* ========== Hero Section ========== */
.hero-section {
  display: flex;
  align-items: center;
  gap: 24px;
  margin-bottom: 40px;
}

.hero-avatar {
  position: relative;
  cursor: pointer;
  flex-shrink: 0;
}

.hero-avatar-img {
  border: 4px solid rgba(255, 255, 255, 0.9);
  box-shadow:
    0 0 0 1px rgba(0,0,0,0.04),
    0 4px 16px rgba(0,0,0,0.08),
    0 0 0 4px rgba(99, 102, 241, 0.04);
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.hero-avatar:hover .hero-avatar-img {
  box-shadow:
    0 0 0 1px rgba(0,0,0,0.06),
    0 8px 24px rgba(99,102,241,0.18),
    0 0 0 8px rgba(99, 102, 241, 0.06);
  transform: scale(1.02);
}

.hero-avatar-badge {
  position: absolute;
  bottom: 2px;
  right: 2px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 3px solid #f1f5f9;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.35);
  transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.hero-avatar:hover .hero-avatar-badge {
  transform: scale(1.12);
}

.avatar-file-input { display: none; }

.hero-text {
  flex: 1;
  min-width: 0;
}

.hero-name {
  margin: 0 0 6px;
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.02em;
}

.hero-bio {
  margin: 0 0 6px;
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.hero-meta {
  margin: 0;
  font-size: 12px;
  color: var(--text-muted);
}

/* ========== Two-Column Grid ========== */
.settings-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 32px;
  align-items: start;
}

/* ========== Settings Sections ========== */
.setting-section {
  margin-bottom: 32px;
}

.settings-grid .setting-section:last-child {
  margin-bottom: 0;
}

.section-head {
  margin-bottom: 16px;
}

.section-head h3 {
  margin: 0 0 4px;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.section-head p {
  margin: 0;
  font-size: 13px;
  color: var(--text-secondary);
}

.danger-head h3 {
  color: var(--danger-text);
}

.section-card {
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(12px);
  box-shadow:
    0 1px 2px rgba(0,0,0,0.04),
    0 4px 12px rgba(0,0,0,0.04);
  transition: all var(--transition-smooth);
}

.section-card:hover {
  background: rgba(255, 255, 255, 0.85);
  box-shadow:
    0 1px 2px rgba(0,0,0,0.04),
    0 8px 24px rgba(0,0,0,0.06),
    0 0 0 1px rgba(99, 102, 241, 0.06);
}

.setting-form .el-form-item {
  margin-bottom: 22px;
}

.setting-form .el-form-item:last-child {
  margin-bottom: 0;
}

.form-hint {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 6px;
  line-height: 1.4;
}

/* ========== Info Table ========== */
.info-table {
  display: flex;
  flex-direction: column;
}

.info-row {
  display: flex;
  align-items: center;
  padding: 14px 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.04);
}

.info-row:first-child {
  padding-top: 0;
}

.info-row:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.info-label {
  width: 120px;
  font-size: 13px;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.info-value {
  font-size: 13px;
  color: #374151;
}

code.info-value {
  background: rgba(99, 102, 241, 0.06);
  padding: 3px 8px;
  border-radius: 5px;
  font-family: 'SF Mono', 'Cascadia Code', 'Consolas', monospace;
  font-size: 12px;
  color: var(--accent);
  border: 1px solid rgba(99, 102, 241, 0.1);
}

/* ========== Danger Zone ========== */
.danger-card {
  border: 1px solid var(--danger-border);
  border-radius: 14px;
  background: rgba(254, 242, 242, 0.7);
  backdrop-filter: blur(12px);
  box-shadow:
    0 1px 2px rgba(0,0,0,0.03),
    0 4px 12px rgba(220, 38, 38, 0.04);
  transition: all var(--transition-smooth);
}

.danger-card:hover {
  background: rgba(254, 242, 242, 0.85);
  box-shadow:
    0 1px 2px rgba(0,0,0,0.03),
    0 8px 24px rgba(220, 38, 38, 0.06),
    0 0 0 1px rgba(220, 38, 38, 0.08);
}

.danger-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
}

.danger-text strong {
  display: block;
  font-size: 14px;
  color: var(--danger-text);
  margin-bottom: 4px;
}

.danger-text p {
  margin: 0;
  font-size: 12px;
  color: var(--danger-text-light);
  line-height: 1.5;
}

@media (max-width: 900px) {
  .settings-grid {
    grid-template-columns: 1fr;
  }
}
</style>
