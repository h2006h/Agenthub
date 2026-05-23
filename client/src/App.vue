<template>
  <div class="app-container">
    <router-view v-slot="{ Component }">
      <transition name="fade" mode="out-in">
        <component :is="Component" />
      </transition>
    </router-view>
  </div>
</template>

<script setup lang="ts">
</script>

<style>
/* ===== CSS 设计令牌 ===== */
:root {
  --accent: #6366f1;
  --accent-light: #818cf8;
  --accent-dark: #4f46e5;
  --accent-glow: rgba(99, 102, 241, 0.25);
  --accent-glow-strong: rgba(99, 102, 241, 0.4);
  --surface: #ffffff;
  --surface-glass: rgba(255, 255, 255, 0.65);
  --surface-elevated: #f9fafb;
  --text-primary: #111827;
  --text-secondary: #6b7280;
  --text-muted: #9ca3af;
  --border: #e5e7eb;
  --border-light: #f3f4f6;
  --danger-bg: #fef2f2;
  --danger-border: #fecaca;
  --danger-text: #991b1b;
  --danger-text-light: #b91c1c;
  --shadow-xs: 0 1px 2px rgba(0,0,0,0.04);
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
  --shadow-md: 0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px -2px rgba(0,0,0,0.05);
  --shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.08), 0 4px 6px -4px rgba(0,0,0,0.04);
  --shadow-xl: 0 20px 25px -5px rgba(0,0,0,0.08), 0 8px 10px -6px rgba(0,0,0,0.04);
  --shadow-glow: 0 0 0 3px var(--accent-glow);
  --shadow-glow-lg: 0 0 0 4px var(--accent-glow), 0 0 20px var(--accent-glow);
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 20px;
  --transition-fast: 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  --transition-smooth: 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  --transition-spring: 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  height: 100%;
  width: 100%;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
}

#app {
  height: 100%;
  width: 100%;
}

.app-container {
  height: 100vh;
  width: 100vw;
  max-width: 100vw;
  overflow: hidden;
  display: flex;
}

/* ===== 弹性页面容器 ===== */
.page-container {
  display: flex;
  height: 100%;
  width: 100%;
  max-width: 100vw;
  overflow: hidden;
}

/* ===== 全局滚动条 ===== */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: #d1d5db;
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: #9ca3af;
}

/* ===== Element Plus 全局调整 ===== */
.el-button {
  transition: all var(--transition-fast);
  border-radius: var(--radius-sm);
  font-weight: 500;
}

.el-button--primary {
  --el-button-bg-color: var(--accent);
  --el-button-border-color: var(--accent);
  --el-button-hover-bg-color: var(--accent-dark);
  --el-button-hover-border-color: var(--accent-dark);
  --el-button-active-bg-color: var(--accent-dark);
  --el-button-active-border-color: var(--accent-dark);
}

.el-button--primary:hover {
  box-shadow: var(--shadow-glow);
}

.el-card {
  --el-card-border-radius: var(--radius-md);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-xs);
  transition: box-shadow var(--transition-smooth), transform var(--transition-smooth);
}

.el-dialog {
  --el-dialog-border-radius: var(--radius-lg);
}

.el-input__wrapper {
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}

.el-input__wrapper:hover {
  box-shadow: 0 0 0 1px var(--accent-light) inset;
}

.el-input.is-focus .el-input__wrapper {
  box-shadow: 0 0 0 1px var(--accent) inset, var(--shadow-glow);
}

/* ===== 淡入淡出过渡 ===== */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
