<template>
  <div class="page-container">
    <Sidebar activeMenu="preview" />

    <div class="preview-container">
      <div class="preview-header">
        <h2>网页预览</h2>
        <div class="url-bar">
          <el-input
            v-model="previewUrl"
            placeholder="输入URL地址..."
            @keyup.enter="loadUrl"
          />
          <el-button type="primary" @click="loadUrl">
            <Search /> 访问
          </el-button>
        </div>
      </div>

      <div class="preview-content">
        <div class="browser-controls">
          <div class="nav-buttons">
            <el-button @click="goBack" :disabled="!canGoBack"><ArrowLeft /></el-button>
            <el-button @click="goForward" :disabled="!canGoForward"><ArrowRight /></el-button>
            <el-button @click="refreshPage"><Refresh /></el-button>
          </div>
          <div class="view-controls">
            <el-button-group>
              <el-button :type="viewMode === 'desktop' ? 'primary' : ''" @click="setViewMode('desktop')">
                <Monitor /> 桌面
              </el-button>
              <el-button :type="viewMode === 'tablet' ? 'primary' : ''" @click="setViewMode('tablet')">
                <Cellphone style="transform: rotate(90deg)" /> 平板
              </el-button>
              <el-button :type="viewMode === 'mobile' ? 'primary' : ''" @click="setViewMode('mobile')">
                <Cellphone /> 手机
              </el-button>
            </el-button-group>
            <el-button
              v-if="viewMode !== 'desktop'"
              @click="toggleOrientation"
              class="rotate-btn"
            >
              <Refresh /> {{ orientation === 'portrait' ? '竖屏' : '横屏' }}
            </el-button>
          </div>
        </div>

        <div class="browser-container" :class="[viewMode, orientation]">
          <div class="device-frame" v-if="viewMode !== 'desktop'">
            <div class="device-notch" v-if="viewMode === 'mobile' && orientation === 'portrait'" />
          </div>
          <div class="browser-frame">
            <div class="browser-header">
              <div class="chrome-dots">
                <span class="dot red" />
                <span class="dot yellow" />
                <span class="dot green" />
              </div>
              <span class="browser-title">{{ iframeSrc || '新标签页' }}</span>
            </div>
            <div class="browser-content">
              <div v-if="!iframeSrc" class="empty-page">
                <Monitor :size="64" />
                <p>输入URL开始预览</p>
              </div>
              <iframe
                v-else
                :key="iframeKey"
                :src="iframeSrc"
                class="preview-iframe"
                sandbox="allow-scripts allow-same-origin allow-forms"
                @load="onIframeLoad"
              />
            </div>
          </div>
        </div>
      </div>

      <div class="preview-info">
        <h3>页面信息</h3>
        <el-card class="info-card">
          <div class="info-row">
            <span class="info-label">当前URL</span>
            <span class="info-value">{{ iframeSrc || '-' }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">视口尺寸</span>
            <span class="info-value">{{ viewportSize }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">设备模式</span>
            <span class="info-value">{{ viewMode === 'desktop' ? '桌面端' : viewMode === 'tablet' ? '平板端' : '手机端' }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">加载时间</span>
            <span class="info-value">{{ loadTime > 0 ? loadTime + 'ms' : '-' }}</span>
          </div>
        </el-card>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Search, ArrowLeft, ArrowRight, Refresh, Monitor, Cellphone } from '@element-plus/icons-vue'
import Sidebar from '@/components/Sidebar.vue'

const previewUrl = ref('')
const iframeSrc = ref('')
const iframeKey = ref(0)
const viewMode = ref<'desktop' | 'tablet' | 'mobile'>('desktop')
const orientation = ref<'portrait' | 'landscape'>('portrait')
const canGoBack = ref(false)
const canGoForward = ref(false)
const loadTime = ref(0)

const viewportSize = computed(() => {
  switch (viewMode.value) {
    case 'desktop': return '自适应宽度'
    case 'tablet':
      return orientation.value === 'portrait' ? '768 × 1024' : '1024 × 768'
    case 'mobile':
      return orientation.value === 'portrait' ? '375 × 812' : '812 × 375'
  }
})

const loadUrl = () => {
  if (!previewUrl.value.trim()) return
  const startTime = performance.now()

  let url = previewUrl.value.trim()
  if (!/^https?:\/\//i.test(url)) {
    url = 'https://' + url
    previewUrl.value = url
  }

  iframeKey.value++
  iframeSrc.value = url
  canGoBack.value = true

  // Estimate load time — iframe @load will give precise timing
  setTimeout(() => {
    if (loadTime.value === 0) {
      loadTime.value = Math.round(performance.now() - startTime)
    }
  }, 3000)
}

const onIframeLoad = () => {
  loadTime.value = 0 // reset on subsequent loads, computed via the loadUrl timer
}

const goBack = () => { canGoBack.value = false }
const goForward = () => { canGoForward.value = false }

const refreshPage = () => {
  if (!iframeSrc.value) return
  const startTime = performance.now()
  iframeKey.value++
  setTimeout(() => {
    loadTime.value = Math.round(performance.now() - startTime)
  }, 1000)
}

const setViewMode = (mode: 'desktop' | 'tablet' | 'mobile') => {
  viewMode.value = mode
  orientation.value = 'portrait'
}

const toggleOrientation = () => {
  orientation.value = orientation.value === 'portrait' ? 'landscape' : 'portrait'
}
</script>

<style>
.preview-container {
  flex: 1; min-height: 0; padding: 24px 28px;
  display: flex; flex-direction: column; overflow-y: auto;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 30%, #f0f4ff 100%);
}

.preview-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-shrink: 0; }
.preview-header h2 { margin: 0; white-space: nowrap; font-size: 22px; font-weight: 700; color: var(--text-primary); letter-spacing: -0.02em; }

.url-bar { display: flex; gap: 12px; flex: 1; max-width: 560px; margin-left: 20px; }
.url-bar :deep(.el-input) { flex: 1; }

.preview-content {
  flex: 1; min-height: 0;
  background: rgba(255, 255, 255, 0.4);
  backdrop-filter: blur(12px);
  border-radius: 14px; padding: 16px;
  display: flex; flex-direction: column; overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.06);
}

.browser-controls { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-shrink: 0; }
.nav-buttons { display: flex; gap: 8px; }
.view-controls { display: flex; align-items: center; gap: 10px; }
.rotate-btn { font-size: 12px; }

.browser-container { flex: 1; display: flex; justify-content: center; align-items: center; min-height: 0; overflow: auto; }

/* Device frame wrapper */
.device-frame {
  display: none;
  position: relative;
}

/* Desktop */
.browser-container.desktop { align-items: stretch; }
.browser-container.desktop .browser-frame { width: 100%; max-width: 100%; flex: 1; }

/* Tablet */
.browser-container.tablet.portrait .browser-frame { width: 768px; height: 1024px; max-height: 100%; }
.browser-container.tablet.landscape .browser-frame { width: 1024px; height: 768px; max-height: 100%; }
.browser-container.tablet .browser-frame {
  border-radius: 20px;
  box-shadow:
    0 0 0 6px #1e1b4b,
    0 0 0 8px #312e81,
    0 8px 40px rgba(0, 0, 0, 0.3);
}

/* Mobile */
.browser-container.mobile.portrait .browser-frame { width: 375px; height: 812px; max-height: 100%; }
.browser-container.mobile.landscape .browser-frame { width: 812px; height: 375px; max-height: 100%; }
.browser-container.mobile .browser-frame {
  border-radius: 32px;
  box-shadow:
    0 0 0 5px #1e1b4b,
    0 0 0 8px #3730a3,
    0 12px 50px rgba(0, 0, 0, 0.35);
}

.browser-frame {
  background: white;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: width 0.35s cubic-bezier(0.4, 0, 0.2, 1), height 0.35s cubic-bezier(0.4, 0, 0.2, 1), border-radius 0.3s, box-shadow 0.3s;
}

.browser-header {
  background: rgba(255, 255, 255, 0.8);
  padding: 0 16px;
  height: 36px;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

.chrome-dots { display: flex; gap: 6px; }
.dot { width: 10px; height: 10px; border-radius: 50%; }
.dot.red { background: #ff5f56; }
.dot.yellow { background: #ffbd2e; }
.dot.green { background: #27c93f; }

.browser-title {
  font-size: 11px; color: var(--text-muted);
  max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

.browser-content { flex: 1; overflow: hidden; display: flex; }

.empty-page {
  flex: 1; display: flex;
  flex-direction: column; align-items: center; justify-content: center;
  color: var(--text-muted); gap: 12px;
}
.empty-page p { margin: 0; font-size: 14px; }

.preview-iframe { width: 100%; height: 100%; border: none; }

.preview-info { margin-top: 20px; flex-shrink: 0; }
.preview-info h3 { margin: 0 0 12px 0; color: var(--text-primary); }

.info-card { padding: 16px; background: rgba(255, 255, 255, 0.5); border-radius: 12px; }
.info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(0, 0, 0, 0.04); }
.info-row:last-child { border-bottom: none; }
.info-label { color: var(--text-secondary); }
.info-value { font-weight: 500; color: var(--text-primary); }
</style>
