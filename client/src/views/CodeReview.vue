<template>
  <div class="page-container">
    <Sidebar activeMenu="code" />
    <div class="code-review-container">
      <div class="review-header">
        <h2>代码审查</h2>
        <div class="header-actions">
          <el-radio-group v-model="reviewMode" size="small">
            <el-radio-button value="ai">AI 审查</el-radio-button>
            <el-radio-button value="diff">代码对比</el-radio-button>
          </el-radio-group>
        </div>
      </div>

      <!-- AI Review Panel -->
      <template v-if="reviewMode === 'ai'">
        <div class="ai-review-panel">
          <div class="ai-input-area">
            <div class="input-header">
              <el-input v-model="reviewTitle" placeholder="审查标题（可选）" class="title-input" />
              <el-select v-model="reviewLang" class="lang-select">
                <el-option label="JavaScript" value="javascript" />
                <el-option label="TypeScript" value="typescript" />
                <el-option label="Python" value="python" />
                <el-option label="Java" value="java" />
                <el-option label="C/C++" value="cpp" />
                <el-option label="Go" value="go" />
                <el-option label="Rust" value="rust" />
                <el-option label="HTML" value="html" />
                <el-option label="CSS" value="css" />
                <el-option label="SQL" value="sql" />
                <el-option label="Other" value="" />
              </el-select>
              <el-button type="primary" @click="runAiReview" :loading="reviewing">
                <Cpu /> {{ reviewing ? '审查中...' : '开始审查' }}
              </el-button>
            </div>
            <el-input
              type="textarea"
              v-model="reviewCodeInput"
              rows="12"
              placeholder="粘贴代码，AI 将从质量、安全、性能、可维护性四个维度进行审查..."
              class="code-textarea"
            />
          </div>

          <div v-if="reviewResult" class="ai-result-panel">
            <div class="result-summary">
              <el-icon :size="20"><InfoFilled /></el-icon>
              <span>{{ reviewResult.summary }}</span>
            </div>

            <div class="score-cards">
              <div class="score-card" v-for="s in scoreList" :key="s.key">
                <el-progress type="dashboard" :percentage="s.value * 10" :color="s.color" :width="90">
                  <span class="score-text">{{ s.value }}/10</span>
                </el-progress>
                <div class="score-label">{{ s.label }}</div>
              </div>
            </div>

            <div v-if="reviewResult.issues.length > 0" class="issues-section">
              <h4>发现 {{ reviewResult.issues.length }} 个问题</h4>
              <div v-for="(issue, i) in reviewResult.issues" :key="i" class="issue-item" :class="issue.severity">
                <div class="issue-header">
                  <el-tag :type="issue.severity === 'high' ? 'danger' : issue.severity === 'medium' ? 'warning' : 'info'" size="small">
                    {{ issue.severity === 'high' ? '高' : issue.severity === 'medium' ? '中' : '低' }}
                  </el-tag>
                  <el-tag size="small" class="issue-category">{{ issue.category }}</el-tag>
                  <span v-if="issue.line" class="issue-line">L{{ issue.line }}</span>
                  <span class="issue-title">{{ issue.title }}</span>
                </div>
                <div class="issue-body">
                  <p>{{ issue.description }}</p>
                  <p class="issue-suggestion"><strong>建议：</strong>{{ issue.suggestion }}</p>
                </div>
              </div>
            </div>

            <div v-if="reviewResult.strengths.length > 0" class="strengths-section">
              <h4>代码亮点</h4>
              <ul>
                <li v-for="(s, i) in reviewResult.strengths" :key="i">{{ s }}</li>
              </ul>
            </div>

            <div v-if="reviewResult.improvedCode" class="improved-section">
              <h4>改进后代码</h4>
              <div class="improved-code-wrapper">
                <pre class="improved-code"><code>{{ reviewResult.improvedCode }}</code></pre>
                <el-button size="small" class="copy-btn" @click="copyCode(reviewResult.improvedCode)">
                  <CopyDocument /> 复制
                </el-button>
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- Diff Compare Panel -->
      <template v-if="reviewMode === 'diff'">
        <div class="diff-panel">
          <div class="compare-editors">
            <div class="editor-pane">
              <div class="pane-label">原始代码</div>
              <div ref="originalEditorRef" class="monaco-editor-container"></div>
            </div>
            <div class="editor-pane">
              <div class="pane-label">修改后代码</div>
              <div ref="modifiedEditorRef" class="monaco-editor-container"></div>
            </div>
          </div>
          <div class="diff-toolbar">
            <el-button type="primary" @click="runDiffCompare"><Document /> 生成对比</el-button>
          </div>
          <div v-if="diffResult" class="diff-result">
            <h4>对比结果</h4>
            <div class="diff-html" v-html="diffResult"></div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, nextTick, onBeforeUnmount } from 'vue'
import { Document, CopyDocument, Cpu, InfoFilled } from '@element-plus/icons-vue'
import Sidebar from '@/components/Sidebar.vue'
import { reviewCode } from '@/api/code'
import { ElMessage } from 'element-plus'
import * as monaco from 'monaco-editor'
import { createPatch } from 'diff'
import * as Diff2Html from 'diff2html'
import 'diff2html/bundles/css/diff2html.min.css'

const reviewMode = ref<'ai' | 'diff'>('ai')

// ---- AI Review State ----
const reviewTitle = ref('')
const reviewLang = ref('javascript')
const reviewCodeInput = ref('')
const reviewing = ref(false)
const reviewResult = ref<any>(null)

const scoreList = reactive([
  { key: 'quality', label: '代码质量', value: 0, color: '#667eea' },
  { key: 'security', label: '安全性', value: 0, color: '#f56c6c' },
  { key: 'performance', label: '性能', value: 0, color: '#e6a23c' },
  { key: 'maintainability', label: '可维护性', value: 0, color: '#67c23a' },
])

const runAiReview = async () => {
  if (!reviewCodeInput.value.trim()) return
  reviewing.value = true
  reviewResult.value = null

  try {
    const result = await reviewCode(reviewCodeInput.value, reviewLang.value, reviewTitle.value || undefined)
    reviewResult.value = result
    scoreList[0].value = result.scores.quality
    scoreList[1].value = result.scores.security
    scoreList[2].value = result.scores.performance
    scoreList[3].value = result.scores.maintainability
    ElMessage.success('审查完成')
  } catch (e) {
    ElMessage.error('AI审查失败，请重试')
  } finally {
    reviewing.value = false
  }
}

const copyCode = (code: string) => {
  navigator.clipboard.writeText(code).then(() => ElMessage.success('已复制'))
}

// ---- Diff State ----
const diffResult = ref('')
const originalEditorRef = ref<HTMLElement | null>(null)
const modifiedEditorRef = ref<HTMLElement | null>(null)

let originalEditor: monaco.editor.IStandaloneCodeEditor | null = null
let modifiedEditor: monaco.editor.IStandaloneCodeEditor | null = null

onBeforeUnmount(() => {
  originalEditor?.dispose()
  modifiedEditor?.dispose()
})

const initEditors = async () => {
  await nextTick()
  if (!originalEditorRef.value || !modifiedEditorRef.value) return

  const defaultLang = 'javascript'
  const opts: monaco.editor.IStandaloneEditorConstructionOptions = {
    value: '',
    language: defaultLang,
    theme: 'vs-dark',
    minimap: { enabled: false },
    automaticLayout: true,
    fontSize: 13,
    lineNumbers: 'on',
    scrollBeyondLastLine: false,
    wordWrap: 'on',
  }

  if (!originalEditor) {
    originalEditor = monaco.editor.create(originalEditorRef.value, opts)
  }
  if (!modifiedEditor) {
    modifiedEditor = monaco.editor.create(modifiedEditorRef.value, opts)
  }
}

const runDiffCompare = () => {
  const originalCode = originalEditor?.getValue() || ''
  const modifiedCode = modifiedEditor?.getValue() || ''
  if (!originalCode || !modifiedCode) return

  const patch = createPatch('code', originalCode, modifiedCode, '', '')
  const diffJson = Diff2Html.parse(patch)
  diffResult.value = Diff2Html.html(diffJson, {
    drawFileList: false,
    matching: 'lines',
    outputFormat: 'side-by-side',
  })
}

// Init editors when switching to diff mode
import { watch } from 'vue'
watch(reviewMode, (mode) => {
  if (mode === 'diff') initEditors()
})
</script>

<style>
@import 'diff2html/bundles/css/diff2html.min.css';

.code-review-container {
  flex: 1; min-width: 0; min-height: 0; padding: 24px 28px;
  display: flex; flex-direction: column; overflow: hidden;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 30%, #f0f4ff 100%);
}

.review-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-shrink: 0; }
.review-header h2 { margin: 0; font-size: 22px; font-weight: 700; color: var(--text-primary); letter-spacing: -0.02em; }

/* AI Review Panel */
.ai-review-panel { flex: 1; display: flex; flex-direction: column; overflow: hidden; gap: 16px; }

.ai-input-area { flex-shrink: 0; }
.input-header { display: flex; gap: 12px; align-items: center; margin-bottom: 10px; }
.title-input { width: 200px; }
.lang-select { width: 140px; }
.code-textarea textarea { font-family: 'Cascadia Code', 'SF Mono', 'Consolas', monospace; font-size: 13px; line-height: 1.5; }

.ai-result-panel { flex: 1; overflow-y: auto; }

.result-summary {
  display: flex; align-items: center; gap: 8px;
  background: rgba(99, 102, 241, 0.06);
  border: 1px solid rgba(99, 102, 241, 0.12);
  border-radius: 10px; padding: 12px 16px; margin-bottom: 16px;
  font-size: 14px; color: var(--accent);
}

.score-cards { display: flex; gap: 16px; margin-bottom: 20px; justify-content: center; }
.score-card { text-align: center; }
.score-text { font-size: 14px; font-weight: 600; }
.score-label { font-size: 12px; color: var(--text-secondary); margin-top: 4px; }

.issues-section { margin-bottom: 20px; }
.issues-section h4, .strengths-section h4, .improved-section h4 { margin: 0 0 12px 0; font-size: 15px; color: var(--text-primary); }

.issue-item {
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(8px);
  border-radius: 10px; padding: 12px 16px; margin-bottom: 10px;
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-left: 4px solid #e6a23c;
}
.issue-item.high { border-left-color: #f56c6c; background: rgba(254, 240, 240, 0.7); }
.issue-item.medium { border-left-color: #e6a23c; }
.issue-item.low { border-left-color: #909399; }

.issue-header { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.issue-category { font-size: 11px; }
.issue-line { font-size: 11px; color: var(--text-muted); font-family: monospace; }
.issue-title { font-weight: 500; color: var(--text-primary); }
.issue-body { font-size: 13px; color: var(--text-secondary); }
.issue-body p { margin: 4px 0; }
.issue-suggestion { color: #10b981; }

.strengths-section { margin-bottom: 20px; }
.strengths-section ul { margin: 0; padding-left: 20px; }
.strengths-section li { font-size: 13px; color: var(--text-secondary); margin-bottom: 4px; }

.improved-code-wrapper { position: relative; }
.improved-code {
  background: linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f0d2e 100%);
  color: #e2e8f0; border-radius: 10px; padding: 16px;
  font-family: 'Cascadia Code', 'SF Mono', 'Consolas', monospace;
  font-size: 13px; line-height: 1.5; overflow: auto; max-height: 400px;
  white-space: pre-wrap; word-break: break-word; margin: 0;
  border: 1px solid rgba(255, 255, 255, 0.05);
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.3);
}
.improved-code code { color: #e2e8f0; }
.improved-code-wrapper .copy-btn { position: absolute; top: 8px; right: 8px; opacity: 0.8; }
.improved-code-wrapper .copy-btn:hover { opacity: 1; }

/* Diff Panel */
.diff-panel { flex: 1; display: flex; flex-direction: column; gap: 12px; overflow: hidden; }
.compare-editors { display: flex; gap: 16px; height: 350px; flex-shrink: 0; }
.editor-pane { flex: 1; display: flex; flex-direction: column; }
.pane-label { font-weight: 500; margin-bottom: 8px; color: var(--text-primary); }
.monaco-editor-container { flex: 1; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }

.diff-toolbar { display: flex; justify-content: flex-end; }
.diff-result { flex: 1; overflow-y: auto; }
.diff-result h4 { margin: 0 0 12px 0; font-size: 14px; color: var(--text-primary); }

:deep(.d2h-wrapper) { border: 1px solid var(--border); border-radius: 8px; }
:deep(.d2h-file-header) { display: none; }
</style>
