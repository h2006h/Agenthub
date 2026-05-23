<template>
  <div class="page-container">
    <Sidebar activeMenu="tasks" />
    <div class="tasks-container">
      <div class="tasks-header">
        <h2>任务管理</h2>
      <div class="header-actions">
        <el-button @click="showDecomposeModal = true" class="decompose-btn">
          <MagicStick /> AI拆解
        </el-button>
        <el-button type="primary" @click="showAddModal = true">
          <Plus /> 新建任务
        </el-button>
      </div>
    </div>
    <div class="tasks-board">
      <div class="task-column">
        <div class="column-header pending">
          <span class="column-title">待处理</span>
          <el-badge :value="pendingTasks.length" />
        </div>
        <el-scrollbar class="task-list">
          <el-card
            v-for="task in pendingTasks"
            :key="task.id"
            class="task-card"
            @click="editTask(task)"
          >
            <div class="task-title">{{ task.title }}</div>
            <div class="task-desc">{{ task.description }}</div>
            <div class="task-meta">
              <el-tag :type="getPriorityTag(task.priority)">
                {{ getPriorityText(task.priority) }}
              </el-tag>
              <span class="task-assignee">{{ task.assignee }}</span>
            </div>
            <div v-if="task.parentId" class="task-parent">
              <span class="parent-label">子任务</span>
            </div>
            <div class="task-actions">
              <el-button
                size="small"
                type="primary"
                :loading="executingTaskId === task.id"
                :disabled="executingTaskId !== null"
                @click.stop="handleExecute(task)"
              >
                <Cpu /> {{ executingTaskId === task.id ? '执行中...' : '执行' }}
              </el-button>
            </div>
          </el-card>
        </el-scrollbar>
      </div>
      <div class="task-column">
        <div class="column-header in_progress">
          <span class="column-title">进行中</span>
          <el-badge :value="inProgressTasks.length" />
        </div>
        <el-scrollbar class="task-list">
          <el-card
            v-for="task in inProgressTasks"
            :key="task.id"
            class="task-card in-progress"
            @click="openExecutionMonitor(task)"
          >
            <div class="task-title">
              <span class="pulse-dot" />
              {{ task.title }}
            </div>
            <div class="task-desc">{{ task.description }}</div>
            <div class="task-meta">
              <el-tag :type="getPriorityTag(task.priority)">
                {{ getPriorityText(task.priority) }}
              </el-tag>
              <span class="task-assignee">{{ task.assignee }}</span>
            </div>
            <div v-if="task.parentId" class="task-parent">
              <span class="parent-label">子任务</span>
            </div>
            <div v-if="executingTaskId === task.id" class="task-actions">
              <el-button
                size="small"
                type="danger"
                @click.stop="handleStopExecution"
              >
                <Close /> 停止
              </el-button>
            </div>
          </el-card>
        </el-scrollbar>
      </div>
      <div class="task-column">
        <div class="column-header completed">
          <span class="column-title">已完成</span>
          <div style="display:flex;align-items:center;gap:8px;">
            <el-badge :value="completedTasks.length" />
            <el-button
              v-if="completedTasks.length > 0"
              size="small"
              type="success"
              plain
              @click.stop="handleExport"
            >
              <Download /> 导出
            </el-button>
          </div>
        </div>
        <el-scrollbar class="task-list">
          <el-card
            v-for="task in completedTasks"
            :key="task.id"
            class="task-card completed"
            @click="editTask(task)"
          >
            <div class="task-title">{{ task.title }}</div>
            <div class="task-desc">{{ task.description }}</div>
            <div class="task-meta">
              <el-tag type="success">已完成</el-tag>
              <span class="task-assignee">{{ task.assignee }}</span>
            </div>
            <div v-if="task.parentId" class="task-parent">
              <span class="parent-label">子任务</span>
            </div>
          </el-card>
        </el-scrollbar>
      </div>
    </div>

    <el-dialog title="任务详情" v-model="showAddModal" @closed="closeModal">
      <el-form :model="form" label-width="100px">
        <el-form-item label="任务标题">
          <el-input v-model="form.title" />
        </el-form-item>
        <el-form-item label="任务描述">
          <el-input type="textarea" v-model="form.description" rows="3" />
        </el-form-item>
        <el-form-item v-if="editingTask" label="状态">
          <el-select v-model="form.status">
            <el-option label="待处理" value="pending" />
            <el-option label="进行中" value="in_progress" />
            <el-option label="已完成" value="completed" />
          </el-select>
        </el-form-item>
        <el-form-item label="优先级">
          <el-select v-model="form.priority">
            <el-option label="高" value="high" />
            <el-option label="中" value="medium" />
            <el-option label="低" value="low" />
          </el-select>
        </el-form-item>
        <el-form-item label="负责人">
          <el-input v-model="form.assignee" />
        </el-form-item>
        <el-form-item v-if="editingTask?.result" label="执行结果">
          <div class="result-viewer">
            <div class="result-meta-row">
              <el-tag size="small" :type="editingTask.result_type === 'code' ? 'primary' : 'success'">
                {{ editingTask.result_type === 'code' ? '代码' : editingTask.result_type === 'document' ? '文档' : editingTask.result_type === 'design' ? '设计方案' : '文本' }}
              </el-tag>
            </div>
            <pre class="result-code"><code>{{ editingTask.result }}</code></pre>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button v-if="editingTask" type="danger" @click="deleteCurrentTask">删除</el-button>
        <el-button @click="closeModal">取消</el-button>
        <el-button type="primary" @click="saveTask">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog title="AI任务拆解" v-model="showDecomposeModal" width="600px">
      <div class="decompose-content">
        <el-form-item label="需求描述">
          <el-input type="textarea"
            v-model="decomposeForm.requirement"
            rows="4"
            placeholder="请输入您的需求描述，AI将自动拆解为子任务..."
          />
        </el-form-item>
        
        <div v-if="decomposeResult.length > 0" class="decompose-result">
          <h4>拆解结果：</h4>
          <el-checkbox-group v-model="selectedTasks">
            <el-card
              v-for="(task, index) in decomposeResult"
              :key="index"
              class="result-card"
            >
              <el-checkbox :label="index" class="task-checkbox" />
              <div class="result-content">
                <div class="result-title">
                  <span class="task-num">{{ index + 1 }}.</span>
                  {{ task.title }}
                </div>
                <div class="result-desc">{{ task.description }}</div>
                <div class="result-meta">
                  <el-tag :type="getPriorityTag(task.priority)">
                    {{ getPriorityText(task.priority) }}
                  </el-tag>
                </div>
              </div>
            </el-card>
          </el-checkbox-group>
        </div>
      </div>
      <template #footer>
        <el-button @click="closeDecomposeModal">取消</el-button>
        <el-button v-if="!isDecomposing" type="primary" @click="decomposeTask">
          <MagicStick /> 开始拆解
        </el-button>
        <el-button v-else type="primary" :loading="true">拆解中...</el-button>
        <el-button
          v-if="decomposeResult.length > 0"
          type="success"
          @click="createDecomposedTasks"
        >
          <Plus /> 创建选中任务
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      title="任务执行监控"
      v-model="showExecutionModal"
      width="750px"
      @closed="closeExecutionModal"
    >
      <div class="execution-monitor">
        <div class="execution-header">
          <div class="execution-task-info">
            <span class="execution-label">正在执行</span>
            <span class="execution-title">{{ executionTask?.title }}</span>
          </div>
          <el-tag
            :type="executionStatus === 'running' ? 'warning' : executionStatus === 'completed' ? 'success' : executionStatus === 'aborted' ? 'info' : 'danger'"
            size="small"
          >
            {{ executionStatus === 'running' ? '执行中' : executionStatus === 'completed' ? '已完成' : executionStatus === 'aborted' ? '已停止' : '出错' }}
          </el-tag>
        </div>
        <div class="execution-output" ref="outputContainer">
          <pre v-if="executionStatus === 'error'" class="execution-error"><code>{{ executionErrorMessage || '执行失败，请稍后重试' }}</code></pre>
          <pre v-else class="execution-content"><code>{{ executionContent || (executionStatus === 'running' ? 'Agent 正在思考...' : '') }}</code><span v-if="executionStatus === 'running'" class="cursor-blink">|</span></pre>
        </div>
      </div>
      <template #footer>
        <el-button @click="closeExecutionModal">关闭</el-button>
        <el-button
          v-if="executionStatus === 'running'"
          type="danger"
          @click="handleStopExecution"
        >
          <Close /> 停止执行
        </el-button>
      </template>
    </el-dialog>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive } from 'vue'
import { createTask, getTasks, updateTask, deleteTask, executeTaskStream, stopTask, exportCompletedTasks } from '@/api/tasks'
import type { Task, ExecutionEvent } from '@/api/tasks'
import { chatWithAgent } from '@/api/agents'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, MagicStick, Cpu, Download, Close } from '@element-plus/icons-vue'
import Sidebar from '@/components/Sidebar.vue'

const showAddModal = ref(false)
const showDecomposeModal = ref(false)
const editingTask = ref<Task | null>(null)
const isDecomposing = ref(false)
const executingTaskId = ref<string | null>(null)
const selectedTasks = ref<number[]>([])
const showExecutionModal = ref(false)
const executionContent = ref('')
const executionTask = ref<Task | null>(null)
const executionAbortController = ref<AbortController | null>(null)
const executionStatus = ref<'running' | 'completed' | 'aborted' | 'error'>('running')
const executionErrorMessage = ref('')

const allTasks = ref<Task[]>([])

const form = reactive({
  title: '',
  description: '',
  status: 'pending' as 'pending' | 'in_progress' | 'completed',
  priority: 'medium' as 'high' | 'medium' | 'low',
  assignee: ''
})

const decomposeForm = reactive({
  requirement: ''
})

interface DecomposeResult {
  title: string
  description: string
  priority: 'high' | 'medium' | 'low'
  dependencies: string[]
}

const decomposeResult = ref<DecomposeResult[]>([])

const pendingTasks = computed(() => allTasks.value.filter(t => t.status === 'pending'))
const inProgressTasks = computed(() => allTasks.value.filter(t => t.status === 'in_progress'))
const completedTasks = computed(() => allTasks.value.filter(t => t.status === 'completed'))

const getPriorityTag = (priority: string) => {
  switch (priority) {
    case 'high': return 'danger'
    case 'medium': return 'warning'
    default: return 'info'
  }
}

const getPriorityText = (priority: string) => {
  switch (priority) {
    case 'high': return '高优先级'
    case 'medium': return '中优先级'
    default: return '低优先级'
  }
}

const editTask = (task: Task) => {
  editingTask.value = task
  form.title = task.title
  form.description = task.description
  form.status = task.status
  form.priority = task.priority
  form.assignee = task.assignee
  showAddModal.value = true
}

const closeModal = () => {
  showAddModal.value = false
  editingTask.value = null
  form.title = ''
  form.description = ''
  form.status = 'pending'
  form.priority = 'medium'
  form.assignee = ''
}

const closeDecomposeModal = () => {
  showDecomposeModal.value = false
  decomposeForm.requirement = ''
  decomposeResult.value = []
  selectedTasks.value = []
}

const saveTask = async () => {
  if (!form.title.trim()) return
  
  try {
    if (editingTask.value) {
      await updateTask(editingTask.value.id, {
        title: form.title,
        description: form.description,
        status: form.status,
        priority: form.priority,
        assignee: form.assignee
      })
    } else {
      await createTask(
        form.title,
        form.description,
        form.status,
        form.priority,
        form.assignee
      )
    }
    
    await loadTasks()
    closeModal()
  } catch (error) {
    console.error('保存任务失败:', error)
  }
}

const deleteCurrentTask = async () => {
  if (!editingTask.value) return
  
  try {
    await deleteTask(editingTask.value.id)
    await loadTasks()
    closeModal()
  } catch (error) {
    console.error('删除任务失败:', error)
  }
}

const decomposeTask = async () => {
  if (!decomposeForm.requirement.trim()) return
  
  isDecomposing.value = true
  
  try {
    const response = await chatWithAgent('task', decomposeForm.requirement)
    const result = JSON.parse(response.response)
    
    if (Array.isArray(result)) {
      decomposeResult.value = result.map((item: any) => ({
        title: item.title || item.task,
        description: item.description || item.desc || '',
        priority: (item.priority || 'medium') as 'high' | 'medium' | 'low',
        dependencies: item.dependencies || []
      }))
    } else {
      decomposeResult.value = [{
        title: '解析失败',
        description: '无法解析需求，请尝试用更清晰的语言描述',
        priority: 'low',
        dependencies: []
      }]
    }
    
    selectedTasks.value = decomposeResult.value.map((_, i) => i)
  } catch (error) {
    console.error('任务拆解失败:', error)
    decomposeResult.value = [{
      title: '拆解失败',
      description: 'AI服务暂时不可用，请稍后重试',
      priority: 'low',
      dependencies: []
    }]
  } finally {
    isDecomposing.value = false
  }
}

const createDecomposedTasks = async () => {
  const tasksToCreate = selectedTasks.value.map(index => decomposeResult.value[index])
  
  try {
    for (const task of tasksToCreate) {
      await createTask(
        task.title,
        task.description,
        'pending',
        task.priority,
        ''
      )
    }
    
    await loadTasks()
    closeDecomposeModal()
  } catch (error) {
    console.error('创建任务失败:', error)
  }
}

const handleExecute = async (task: Task) => {
  if (executingTaskId.value) return
  executingTaskId.value = task.id
  executionTask.value = task
  executionContent.value = ''
  executionErrorMessage.value = ''
  executionStatus.value = 'running'
  showExecutionModal.value = true

  // Immediately move to in_progress
  await updateTask(task.id, { status: 'in_progress' })
  await loadTasks()

  const abortController = new AbortController()
  executionAbortController.value = abortController

  try {
    await executeTaskStream(task.id, (event: ExecutionEvent) => {
      switch (event.type) {
        case 'chunk':
          if (event.content) executionContent.value += event.content
          break
        case 'done':
          executionStatus.value = 'completed'
          break
        case 'aborted':
          executionStatus.value = 'aborted'
          break
        case 'error':
          executionStatus.value = 'error'
          executionErrorMessage.value = event.error || '执行失败'
          break
      }
    }, abortController.signal)

    await loadTasks()
    if (executionStatus.value === 'completed') {
      ElMessage.success('任务执行完成')
    }
  } catch (error: any) {
    if (error?.name !== 'AbortError') {
      await loadTasks()
      executionStatus.value = 'error'
      executionErrorMessage.value = error?.message || '任务执行失败'
      ElMessage.error(executionErrorMessage.value)
    }
  } finally {
    executingTaskId.value = null
    executionAbortController.value = null
  }
}

const handleStopExecution = async () => {
  if (!executionTask.value) return

  try {
    executionAbortController.value?.abort()
    await stopTask(executionTask.value.id)
    await loadTasks()
    executionStatus.value = 'aborted'
    ElMessage.info('任务已停止')
  } catch (error) {
    // AbortError is expected
  }
}

const openExecutionMonitor = (task: Task) => {
  executionTask.value = task
  executionStatus.value = 'running'
  showExecutionModal.value = true
}

const closeExecutionModal = () => {
  showExecutionModal.value = false
  executionContent.value = ''
  executionErrorMessage.value = ''
  executionTask.value = null
  executionStatus.value = 'running'
}

const handleExport = async () => {
  try {
    await exportCompletedTasks()
    ElMessage.success('导出成功')
  } catch (error) {
    ElMessage.error('导出失败')
  }
}

const loadTasks = async () => {
  try {
    allTasks.value = await getTasks()
  } catch (error) {
    console.error('加载任务失败:', error)
  }
}

loadTasks()
</script>

<style>
.tasks-container {
  flex: 1;
  min-width: 0;
  min-height: 0;
  padding: 24px 28px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 30%, #f0f4ff 100%);
}

.tasks-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  flex-shrink: 0;
}

.tasks-header h2 {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.02em;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.header-actions .el-button--primary {
  background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
  border: none;
  font-weight: 600;
  border-radius: 10px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  box-shadow:
    0 2px 8px rgba(99, 102, 241, 0.35),
    0 0 0 1px rgba(255, 255, 255, 0.1) inset;
  transition: all var(--transition-smooth);
}

.header-actions .el-button--primary:hover {
  background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%);
  color: white;
  box-shadow:
    0 4px 20px rgba(99, 102, 241, 0.45),
    0 0 0 1px rgba(255, 255, 255, 0.15) inset;
  transform: translateY(-1px);
}

.decompose-btn {
  background: linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #8b5cf6 100%);
  border: none;
  color: white;
  font-weight: 600;
  border-radius: 10px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  box-shadow:
    0 2px 8px rgba(99, 102, 241, 0.35),
    0 0 0 1px rgba(255, 255, 255, 0.1) inset;
  transition: all var(--transition-smooth);
}

.decompose-btn:hover {
  background: linear-gradient(135deg, #4f46e5 0%, #9333ea 50%, #7c3aed 100%);
  color: white;
  box-shadow:
    0 4px 20px rgba(99, 102, 241, 0.45),
    0 0 0 1px rgba(255, 255, 255, 0.15) inset;
  transform: translateY(-1px);
}

.tasks-board {
  flex: 1;
  display: flex;
  gap: 20px;
  overflow: hidden;
  min-height: 0;
}

.task-column {
  flex: 1;
  background: rgba(255, 255, 255, 0.5);
  backdrop-filter: blur(12px);
  border-radius: 14px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
  border: 1px solid rgba(0, 0, 0, 0.06);
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
}

.column-header {
  padding: 14px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-radius: 14px 14px 0 0;
  flex-shrink: 0;
  position: relative;
  overflow: hidden;
}

.column-header::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 60%);
  pointer-events: none;
}

.column-header.pending {
  background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
  box-shadow: 0 2px 12px rgba(99, 102, 241, 0.25);
}

.column-header.in_progress {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  box-shadow: 0 2px 12px rgba(245, 158, 11, 0.25);
}

.column-header.completed {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  box-shadow: 0 2px 12px rgba(16, 185, 129, 0.25);
}

.column-title {
  color: white;
  font-weight: 600;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  position: relative;
  z-index: 1;
}

.column-header .el-badge__content {
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(4px);
  color: white;
  font-weight: 700;
  border: 1px solid rgba(255, 255, 255, 0.25);
  position: relative;
  z-index: 1;
}

.task-list {
  flex: 1;
  padding: 12px;
  min-height: 0;
  overflow: hidden;
}

.task-card {
  margin-bottom: 12px;
  cursor: pointer;
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(8px);
  box-shadow: 0 1px 2px rgba(0,0,0,0.03), 0 2px 8px rgba(0,0,0,0.03);
  transition: all var(--transition-smooth);
}

.task-card:hover {
  transform: translateY(-2px);
  background: rgba(255, 255, 255, 0.9);
  box-shadow:
    0 1px 2px rgba(0,0,0,0.04),
    0 8px 20px rgba(0,0,0,0.06),
    0 0 0 1px rgba(99, 102, 241, 0.08);
}

.task-card:active {
  transform: translateY(0);
}

.task-card.completed {
  opacity: 0.7;
}

.task-card.in-progress {
  border-left: 3px solid #f5576c;
}

.task-title {
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--text-primary);
  font-size: 14px;
}

.task-desc {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 12px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.task-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.task-assignee {
  font-size: 12px;
  color: var(--text-muted);
}

.task-parent {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
}

.parent-label {
  font-size: 11px;
  color: var(--text-muted);
  background: rgba(0, 0, 0, 0.04);
  padding: 2px 8px;
  border-radius: 4px;
}

.task-actions {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
  display: flex;
  justify-content: flex-end;
}

.decompose-content {
  padding: 10px;
}

.decompose-result {
  margin-top: 20px;
}

.decompose-result h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  color: var(--text-primary);
}

.result-card {
  margin-bottom: 12px;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(8px);
  border-radius: 10px;
  padding: 12px;
  border: 1px solid rgba(0, 0, 0, 0.06);
  transition: all var(--transition-smooth);
}

.result-card:hover {
  background: rgba(255, 255, 255, 0.85);
  box-shadow: var(--shadow-sm);
}

.task-checkbox {
  margin-top: 4px;
}

.result-content {
  flex: 1;
}

.result-title {
  font-weight: 500;
  margin-bottom: 4px;
  color: var(--text-primary);
}

.task-num {
  color: var(--accent);
  font-weight: 600;
}

.result-desc {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.result-meta {
  display: flex;
  gap: 8px;
}

.execution-monitor {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.execution-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  background: rgba(248, 249, 250, 0.7);
  backdrop-filter: blur(8px);
  border-radius: 10px;
  border: 1px solid rgba(0, 0, 0, 0.06);
}

.execution-task-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.execution-label {
  font-size: 12px;
  color: var(--text-muted);
}

.execution-title {
  font-weight: 600;
  color: var(--text-primary);
}

.execution-output {
  background: linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f0d2e 100%);
  border-radius: 10px;
  padding: 16px;
  max-height: 450px;
  overflow-y: auto;
  min-height: 200px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.3), 0 2px 8px rgba(0, 0, 0, 0.15);
}

.execution-content {
  color: #e2e8f0;
  font-family: 'Cascadia Code', 'SF Mono', 'Consolas', monospace;
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
}

.execution-content code {
  color: #e2e8f0;
}

.execution-error {
  color: #f87171;
  font-family: 'Cascadia Code', 'SF Mono', 'Consolas', monospace;
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
}

.execution-error code {
  color: #f87171;
}

.cursor-blink {
  color: #818cf8;
  animation: blink 1s infinite;
  font-weight: bold;
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}

.pulse-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #f5576c;
  box-shadow: 0 0 8px rgba(245, 87, 108, 0.5);
  animation: pulse 1.5s infinite;
  margin-right: 6px;
  vertical-align: middle;
}

@keyframes pulse {
  0% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(1.3); }
  100% { opacity: 1; transform: scale(1); }
}

.result-viewer {
  width: 100%;
}

.result-meta-row {
  margin-bottom: 8px;
}

.result-code {
  background: linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f0d2e 100%);
  color: #e2e8f0;
  border-radius: 8px;
  padding: 12px;
  max-height: 350px;
  overflow: auto;
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
  border: 1px solid rgba(255, 255, 255, 0.05);
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.3);
}

.result-code code {
  color: #e2e8f0;
  font-family: 'Cascadia Code', 'SF Mono', 'Consolas', monospace;
}
</style>
