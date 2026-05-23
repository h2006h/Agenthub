<template>
  <div class="sidebar">
    <div class="logo">
      <Cpu :size="32" />
      <span>AgentHub</span>
    </div>
    <div class="nav-menu">
      <el-tooltip v-for="item in navItems" :key="item.index" :content="item.label" placement="right" :show-after="400">
        <div
          class="nav-item"
          :class="{ active: activeMenu === item.index }"
          @click="navigateTo(item.path)"
        >
          <component :is="item.icon" :size="20" />
        </div>
      </el-tooltip>
    </div>
    <div class="sidebar-footer">
      <el-tooltip :content="userStore.user?.username || '未登录'" placement="right" :show-after="300">
        <el-avatar :size="36" :src="userStore.user?.avatar" class="user-avatar">
          <UserFilled />
        </el-avatar>
      </el-tooltip>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { Cpu, ChatRound, List, View, Monitor, Upload, Setting, UserFilled } from '@element-plus/icons-vue'
import type { Component } from 'vue'

defineProps<{ activeMenu: string }>()

const router = useRouter()
const userStore = useUserStore()

interface NavItem {
  index: string
  label: string
  path: string
  icon: Component
}

const navItems: NavItem[] = [
  { index: 'chat', label: '聊天', path: '/', icon: ChatRound },
  { index: 'tasks', label: '任务管理', path: '/tasks', icon: List },
  { index: 'code', label: '代码审查', path: '/code-review', icon: View },
  { index: 'deploy', label: '部署', path: '/deploy', icon: Upload },
  { index: 'preview', label: '预览', path: '/preview', icon: Monitor },
  { index: 'settings', label: '设置', path: '/settings', icon: Setting },
]

const navigateTo = (path: string) => {
  if (router.currentRoute.value.path !== path) {
    router.push(path)
  }
}
</script>

<style scoped>
.sidebar {
  width: 72px;
  flex-shrink: 0;
  background: linear-gradient(180deg, #0f0d2e 0%, #1e1b4b 30%, #312e81 70%, #3730a3 100%);
  display: flex;
  flex-direction: column;
  padding: 20px 0;
  height: 100%;
  box-shadow: 4px 0 24px rgba(0, 0, 0, 0.2);
  position: relative;
  z-index: 10;
}

.sidebar::after {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at 50% 30%, rgba(99, 102, 241, 0.12) 0%, transparent 70%);
  pointer-events: none;
}

.logo {
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  margin-bottom: 24px;
  padding: 0 12px;
  position: relative;
  z-index: 1;
}

.logo span { display: none; }

.nav-menu {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 0 8px;
  position: relative;
  z-index: 1;
}

.nav-item {
  width: 52px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  backdrop-filter: blur(0px);
}

.nav-item:hover {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.85);
  transform: translateX(2px);
}

.nav-item.active {
  background: rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(8px);
  color: white;
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.1),
    0 4px 12px rgba(0, 0, 0, 0.2),
    0 0 20px rgba(99, 102, 241, 0.2);
}

.nav-item.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 20px;
  background: linear-gradient(180deg, #818cf8, #6366f1, #4f46e5);
  border-radius: 0 3px 3px 0;
  box-shadow: 0 0 8px rgba(129, 140, 248, 0.5);
}

.sidebar-footer {
  display: flex;
  justify-content: center;
  padding: 16px 8px 0;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  margin: 0 12px;
  position: relative;
  z-index: 1;
}

.user-avatar {
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  border: 2px solid rgba(255, 255, 255, 0.15);
}

.user-avatar:hover {
  transform: scale(1.08);
  box-shadow: 0 0 16px rgba(99, 102, 241, 0.35);
  border-color: rgba(255, 255, 255, 0.35);
}
</style>
