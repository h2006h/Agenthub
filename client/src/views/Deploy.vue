<template>
  <div class="page-container">
    <Sidebar activeMenu="deploy" />
    <div class="deploy-container">
      <div class="deploy-header">
        <h2>一键部署</h2>
        <el-radio-group v-model="deploySource" size="small">
          <el-radio-button value="local">本机项目</el-radio-button>
          <el-radio-button value="upload">上传文件</el-radio-button>
        </el-radio-group>
      </div>

    <div class="deploy-content">
      <div class="deploy-config">
        <div class="config-section">
          <h3>部署配置</h3>
          <el-form :model="config" label-width="120px">
            <el-form-item label="部署环境">
              <el-select v-model="config.environment">
                <el-option label="开发环境" value="development" />
                <el-option label="测试环境" value="test" />
                <el-option label="生产环境" value="production" />
              </el-select>
            </el-form-item>
            <el-form-item label="部署类型">
              <el-select v-model="config.type">
                <el-option label="全量部署" value="full" />
                <el-option label="增量部署" value="incremental" />
                <el-option label="热更新" value="hot" />
              </el-select>
            </el-form-item>
            <el-form-item label="版本号">
              <el-input v-model="config.version" />
            </el-form-item>
            <el-form-item v-if="deploySource === 'local'" label="项目目录">
              <el-input v-model="config.projectDir" placeholder="例如 D:\my-project，留空使用当前目录" />
            </el-form-item>
            <el-form-item v-if="deploySource === 'local'" label="分支">
              <el-input v-model="config.branch" placeholder="main" />
            </el-form-item>
            <el-form-item v-if="deploySource === 'upload'" label="上传项目">
              <el-upload
                :auto-upload="false"
                :limit="1"
                accept=".zip,.tar.gz,.tgz"
                :on-change="handleFileChange"
                :on-remove="handleFileRemove"
                :file-list="fileList"
                drag
              >
                <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
                <div class="el-upload__text">拖拽或<em>点击上传</em>项目压缩包</div>
                <template #tip>
                  <div class="el-upload__tip">支持 .zip / .tar.gz 格式，最大 100MB</div>
                </template>
              </el-upload>
            </el-form-item>
            <el-form-item label="构建命令">
              <el-input v-model="config.buildCommand" placeholder="npm run build" />
            </el-form-item>
            <el-form-item label="输出目录">
              <el-input v-model="config.outputDir" placeholder="./dist" />
            </el-form-item>
          </el-form>
        </div>
        
        <div class="deploy-btn">
          <el-button
            type="primary"
            :loading="isDeploying"
            :disabled="isDeploying"
            @click="startDeploy"
          >
            <ArrowRight /> 开始部署
          </el-button>
        </div>
      </div>
      
      <div class="deploy-log">
        <div class="log-header">
          <h3>部署日志</h3>
          <el-button @click="clearLog">
            <Delete /> 清空日志
          </el-button>
        </div>
        <el-scrollbar class="log-content">
          <div v-for="(log, index) in logs" :key="index" class="log-item" :class="log.type">
            <span class="log-time">{{ log.time }}</span>
            <span class="log-prefix" :class="log.type">[{{ log.prefix }}]</span>
            <span class="log-message">{{ log.message }}</span>
          </div>
        </el-scrollbar>
      </div>
    </div>
    
    <div class="deploy-status">
      <h3>最近部署记录</h3>
      <el-table :data="deployHistory" border>
        <el-table-column prop="id" label="ID" />
        <el-table-column prop="environment" label="环境" />
        <el-table-column prop="version" label="版本" />
        <el-table-column prop="status" label="状态">
          <template #default="scope">
            <el-tag :type="getStatusTag(scope.row.status)">
              {{ getStatusText(scope.row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="time" label="时间" />
      </el-table>
    </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, nextTick, watch } from 'vue'
import { ArrowRight, UploadFilled, Delete } from '@element-plus/icons-vue'
import Sidebar from '@/components/Sidebar.vue'
import { websocketClient } from '@/websocket/client'
import { createDeployment, createDeploymentWithUpload, getDeployments } from '@/api/deploy'

interface LogItem {
  time: string
  prefix: string
  type: 'info' | 'success' | 'error' | 'warning'
  message: string
}

interface DeployRecord {
  id: string
  environment: string
  version: string
  status: 'success' | 'failed' | 'running'
  time: string
}

const deploySource = ref<'local' | 'upload'>('local')
const uploadFile = ref<File | null>(null)
const fileList = ref<any[]>([])

const handleFileChange = (file: any) => {
  uploadFile.value = file.raw
  fileList.value = [file]
}

const handleFileRemove = () => {
  uploadFile.value = null
  fileList.value = []
}

const config = reactive({
  environment: 'development',
  type: 'full',
  version: '',
  branch: 'main',
  buildCommand: 'npm run build',
  outputDir: './dist',
  projectDir: ''
})

const isDeploying = ref(false)
const logs = ref<LogItem[]>([
  { time: '--:--:--', prefix: 'INFO', type: 'info', message: '部署系统已就绪' }
])

const deployHistory = ref<DeployRecord[]>([])

const addLog = (prefix: string, type: LogItem['type'], message: string) => {
  const now = new Date()
  const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`
  logs.value.push({ time, prefix, type, message })
}

const clearLog = () => {
  logs.value = []
}

const getStatusTag = (status: string) => {
  switch (status) { case 'success': return 'success'; case 'failed': return 'danger'; default: return 'warning' }
}

const getStatusText = (status: string) => {
  switch (status) { case 'success': return '成功'; case 'failed': return '失败'; default: return '进行中' }
}

const logContainer = ref<HTMLElement | null>(null)

const scrollToBottom = async () => {
  await nextTick()
  const el = document.querySelector('.log-content .el-scrollbar__wrap')
  if (el) (el as HTMLElement).scrollTop = (el as HTMLElement).scrollHeight
}

const startDeploy = async () => {
  if (deploySource.value === 'upload' && !uploadFile.value) {
    addLog('ERROR', 'error', '请先选择要上传的项目文件')
    return
  }

  isDeploying.value = true
  addLog('DEPLOY', 'info', deploySource.value === 'upload' ? '上传并开始部署...' : '开始部署...')

  try {
    if (deploySource.value === 'upload') {
      const formData = new FormData()
      formData.append('file', uploadFile.value!)
      formData.append('environment', config.environment)
      formData.append('version', config.version)
      formData.append('type', config.type)
      formData.append('buildCommand', config.buildCommand)
      formData.append('outputDir', config.outputDir)
      formData.append('projectDir', config.projectDir)

      await createDeploymentWithUpload(formData)
    } else {
      await createDeployment(
        config.environment,
        config.version,
        config.type,
        config.branch,
        config.buildCommand,
        config.outputDir,
        config.projectDir || undefined
      )
    }

    const handler = (payload: any) => {
      const prefixMap: Record<string, string> = {
        preparing: 'SETUP',
        checkout: 'GIT',
        build: 'BUILD',
        deploy: 'DEPLOY',
        complete: 'DONE',
        error: 'ERROR'
      }
      const prefix = prefixMap[payload.phase] || 'INFO'
      const type: LogItem['type'] = payload.status === 'failed' ? 'error' : payload.status === 'success' ? 'success' : 'info'
      addLog(prefix, type, payload.log)
      scrollToBottom()

      if (payload.phase === 'complete') {
        isDeploying.value = false
        deployHistory.value.unshift({
          id: payload.deploymentId,
          environment: config.environment === 'development' ? '开发环境' : config.environment === 'test' ? '测试环境' : '生产环境',
          version: config.version || 'v1.0.0',
          status: 'success',
          time: new Date().toLocaleString()
        })
        addLog('DONE', 'success', '部署成功！')
        scrollToBottom()
        websocketClient.off('deployStatus', handler)
      }
      if (payload.phase === 'error') {
        isDeploying.value = false
        deployHistory.value.unshift({
          id: payload.deploymentId,
          environment: config.environment === 'development' ? '开发环境' : config.environment === 'test' ? '测试环境' : '生产环境',
          version: config.version || 'v1.0.0',
          status: 'failed',
          time: new Date().toLocaleString()
        })
        addLog('ERROR', 'error', '部署失败')
        scrollToBottom()
        websocketClient.off('deployStatus', handler)
      }
    }

    websocketClient.on('deployStatus', handler)
  } catch (error: any) {
    addLog('ERROR', 'error', error.message || '部署请求失败')
    isDeploying.value = false
  }
}

// Clear file when switching to local mode
watch(deploySource, (mode) => {
  if (mode === 'local') {
    uploadFile.value = null
    fileList.value = []
  }
})

// Load deploy history on mount
onMounted(async () => {
  try {
    const data = await getDeployments()
    deployHistory.value = data.map((d: any) => ({
      id: d.id,
      environment: d.environment,
      version: d.version,
      status: d.status,
      time: new Date(d.created_at * 1000).toLocaleString()
    }))
  } catch {
    // Use empty history
  }
})
</script>

<style>
.deploy-container {
  flex: 1;
  min-width: 0;
  min-height: 0;
  padding: 24px 28px;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 30%, #f0f4ff 100%);
}

.deploy-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
.deploy-header h2 { margin: 0; font-size: 22px; font-weight: 700; color: var(--text-primary); letter-spacing: -0.02em; }

.deploy-content {
  display: flex;
  gap: 20px;
  margin-bottom: 20px;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.deploy-config {
  flex: 0 0 340px;
  min-width: 260px;
  max-width: 460px;
  background: rgba(255, 255, 255, 0.5);
  backdrop-filter: blur(12px);
  border-radius: 14px;
  padding: 20px;
  overflow-y: auto;
  border: 1px solid rgba(0, 0, 0, 0.06);
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
}

.config-section h3 {
  margin: 0 0 16px 0;
  color: var(--text-primary);
  font-weight: 600;
}

.deploy-btn {
  margin-top: 20px;
}

.deploy-log {
  flex: 1;
  background: linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f0d2e 100%);
  border-radius: 14px;
  display: flex;
  flex-direction: column;
  border: 1px solid rgba(255, 255, 255, 0.05);
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.3), 0 2px 8px rgba(0, 0, 0, 0.15);
}

.log-header {
  padding: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.log-header h3 {
  margin: 0;
  color: #e2e8f0;
  font-weight: 600;
}

.log-content {
  flex: 1;
  padding: 16px;
}

.log-item {
  display: flex;
  gap: 12px;
  margin-bottom: 8px;
  font-family: 'Cascadia Code', 'SF Mono', 'Consolas', monospace;
  font-size: 13px;
}

.log-time {
  color: #64748b;
  flex-shrink: 0;
}

.log-prefix {
  font-weight: 500;
  flex-shrink: 0;
}

.log-prefix.info { color: #818cf8; }
.log-prefix.success { color: #34d399; }
.log-prefix.error { color: #f87171; }
.log-prefix.warning { color: #fbbf24; }

.log-message {
  color: #e2e8f0;
}

.deploy-status {
  flex: 1;
  min-height: 200px;
}

.deploy-status h3 {
  margin: 0 0 16px 0;
  color: var(--text-primary);
}

.el-upload-dragger {
  padding: 16px;
  border-radius: 12px;
  border: 2px dashed rgba(0, 0, 0, 0.1);
  background: rgba(255, 255, 255, 0.4);
  transition: all var(--transition-smooth);
}
.el-upload-dragger:hover {
  border-color: var(--accent);
  background: rgba(99, 102, 241, 0.04);
}
.el-upload__tip {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 8px;
}
</style>
