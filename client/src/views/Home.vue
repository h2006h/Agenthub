<template>
  <div class="home-container">
    <Sidebar activeMenu="chat" />
    <div class="chat-list">
      <div class="chat-list-header">
        <div class="search-bar">
          <el-input placeholder="搜索会话..." v-model="searchQuery" prefix-icon="Search" clearable />
        </div>
        <div class="new-chat-btn">
          <el-button type="primary" @click="showNewChatModal = true">
            <Plus :size="16" /> 新会话
          </el-button>
        </div>
      </div>
      <el-scrollbar class="conversation-list">
        <el-list v-if="!isLoadingConversations">
          <el-list-item
            v-for="conv in filteredConversations"
            :key="conv.id"
            :class="{ active: conv.id === messagesStore.currentConversationId }"
            @click="selectConversation(conv.id)"
          >
            <template #prefix>
              <div class="conv-avatar" :class="[`conv-type-${conv.type}`, { 'has-avatar': conv.avatar }]">
                <el-avatar :size="42" :src="conv.avatar">
                  <UserFilled v-if="conv.type === 'single'" :size="18" />
                  <User v-else-if="conv.type === 'group'" :size="18" />
                  <Cpu v-else :size="18" />
                </el-avatar>
                <span class="conv-online-dot" v-if="conv.type !== 'agent'"></span>
              </div>
            </template>
            <template #default>
              <div class="conv-info">
                <div class="conv-name-row">
                  <span class="conv-name">{{ conv.name }}</span>
                  <span class="conv-type-tag" :class="conv.type">
                    {{ conv.type === 'single' ? '单聊' : conv.type === 'group' ? '群组' : 'AI' }}
                  </span>
                </div>
                <div class="conv-preview">{{ conv.lastMessage || '暂无消息' }}</div>
              </div>
            </template>
            <template #suffix>
              <div class="conv-meta">
                <span class="conv-time">{{ formatTime(conv.lastTime) }}</span>
                <span
                  v-if="conv.unreadCount && conv.unreadCount > 0"
                  class="conv-unread"
                >{{ conv.unreadCount > 99 ? '99+' : conv.unreadCount }}</span>
              </div>
            </template>
          </el-list-item>
        </el-list>
        <div v-else class="conv-skeleton">
          <div v-for="i in 6" :key="i" class="skeleton-item">
            <el-skeleton animated>
              <template #template>
                <div class="sk-flex">
                  <el-skeleton-item variant="circle" style="width:42px;height:42px" />
                  <div style="flex:1">
                    <el-skeleton-item variant="text" style="width:70%;margin-bottom:6px" />
                    <el-skeleton-item variant="text" style="width:50%" />
                  </div>
                </div>
              </template>
            </el-skeleton>
          </div>
        </div>
      </el-scrollbar>
    </div>
    <div class="chat-area">
      <div v-if="messagesStore.currentConversation" class="chat-window">
        <div class="chat-header">
            <el-avatar
              :size="32"
              :src="messagesStore.currentConversation.avatar"
              class="header-avatar"
              @click="openAvatarModal"
            >
              <UserFilled v-if="messagesStore.currentConversation.type === 'single'" />
              <User v-else-if="messagesStore.currentConversation.type === 'group'" />
              <Cpu v-else />
            </el-avatar>
            <div class="header-info">
              <h3
                v-if="!isRenaming"
                :class="{ 'editable-name': messagesStore.currentConversation.type !== 'single' }"
                @click="startRename"
              >
                {{ messagesStore.currentConversation.name }}
              </h3>
              <el-input
                v-else
                v-model="renameValue"
                ref="renameInputRef"
                size="small"
                class="rename-input"
                @blur="commitRename"
                @keyup.enter="commitRename"
                @keyup.escape="cancelRename"
              />
              <span class="status" :class="messagesStore.currentConversation.type">
                {{ getStatusText(messagesStore.currentConversation.type) }}
              </span>
            </div>
            <div class="header-actions">
              <!-- 群聊: 成员管理 -->
              <el-button
                v-if="messagesStore.currentConversation.type === 'group'"
                type="text"
                @click="openParticipantsModal"
              >
                <User /> 成员
              </el-button>
              <!-- 群聊/Agent: 修改头像和名称 -->
              <el-button
                v-if="messagesStore.currentConversation.type !== 'single'"
                type="text"
                @click="openAvatarModal"
              >
                修改头像
              </el-button>
              <!-- 所有类型: 清空记录 -->
              <el-button type="text" @click="clearHistory">
                清空记录
              </el-button>
            </div>
          </div>
        <el-scrollbar class="message-list" ref="messageScrollRef" @scroll="handleMessageScroll" @click="onMessageListClick">
          <div v-if="messagesStore.isLoadingEarlier" class="loading-earlier">
            <el-spinner size="small" />
          </div>
          <div v-if="messagesStore.hasMore && !messagesStore.isLoadingEarlier" class="load-earlier-hint" @click="messagesStore.loadEarlierMessages()">
            加载更早的消息
          </div>
          <div
            v-for="msg in messagesStore.messages"
            :key="msg.id"
            class="message-row"
            :class="{ 'is-self': msg.senderId === userStore.user?.id }"
          >
            <!-- Other's message: avatar left + bubble right -->
            <template v-if="msg.senderId !== userStore.user?.id">
              <el-avatar :size="36" :src="getMsgAvatar(msg)" class="msg-avatar-left">
                <Cpu v-if="isAgentMessage(msg)" :size="18" />
                <User v-else :size="18" />
              </el-avatar>
              <div class="msg-main">
                <div class="msg-sender-name">{{ msg.senderName }}</div>
                <div class="msg-bubble is-other">
                  <template v-if="isAgentMessage(msg)">
                    <div class="markdown-body" v-html="renderMarkdown(msg.content)" />
                  </template>
                  <template v-else>
                    <pre v-if="msg.type === 'code'" class="code-block">{{ msg.content }}</pre>
                    <span v-else>{{ msg.content }}</span>
                  </template>
                </div>
                <div class="msg-time">{{ formatTime(msg.timestamp) }}</div>
              </div>
            </template>
            <!-- My message: bubble right, no avatar -->
            <template v-else>
              <div class="msg-main">
                <div class="msg-bubble is-self">
                  <pre v-if="msg.type === 'code'" class="code-block">{{ msg.content }}</pre>
                  <span v-else>{{ msg.content }}</span>
                </div>
                <div class="msg-time">{{ formatTime(msg.timestamp) }}</div>
              </div>
            </template>
          </div>
          <!-- Streaming agent reply -->
          <div v-if="messagesStore.streamingMessage" class="message-row">
            <el-avatar :size="36" class="msg-avatar-left agent-avatar">
              <Cpu :size="18" />
            </el-avatar>
            <div class="msg-main">
              <div class="msg-sender-name">AI助手</div>
              <div class="msg-bubble is-other streaming-bubble">
                <template v-if="messagesStore.streamingMessage.content">
                  <span>{{ messagesStore.streamingMessage.content }}</span>
                  <span class="streaming-cursor">|</span>
                </template>
                <span v-else class="thinking-indicator">
                  思考中<span class="thinking-dots"><i>.</i><i>.</i><i>.</i></span>
                </span>
              </div>
            </div>
          </div>
          <div v-if="messagesStore.isLoading" class="loading-more">
            <el-spinner size="small" />
          </div>
        </el-scrollbar>
        <div class="chat-input">
          <div v-if="convAgentIds.length > 0 && messagesStore.currentConversation?.type !== 'agent'" class="agent-mention-hint">
            <Cpu :size="12" /> @提及AI助手可让其回复：
            <span v-for="a in convAgents" :key="a.id" class="agent-hint-tag" @click="mentionAgent(a)">@{{ a.name }}</span>
          </div>
          <el-select
            v-if="messagesStore.currentConversation?.type === 'agent'"
            v-model="messageType"
            class="type-select"
          >
            <el-option label="文本" value="text" />
            <el-option label="代码" value="code" />
            <el-option label="任务" value="task" />
          </el-select>
          <el-input
            v-model="inputMessage"
            :placeholder="inputPlaceholder"
            @keyup.enter="sendMessage"
          />
          <el-button type="primary" @click="sendMessage" :disabled="!inputMessage.trim()">
            发送
          </el-button>
        </div>
      </div>
      <div v-else class="empty-state">
        <Cpu :size="48" />
        <p>选择一个会话开始聊天</p>
        <el-button type="primary" @click="showNewChatModal = true">
          开始新会话
        </el-button>
      </div>
    </div>

    <el-dialog title="新建会话" v-model="showNewChatModal" @closed="resetNewChatForm">
      <el-form :model="newChatForm">
        <el-form-item label="会话类型">
          <el-select v-model="newChatForm.type" @change="onChatTypeChange">
            <el-option label="单聊" value="single" />
            <el-option label="群聊" value="group" />
            <el-option label="Agent" value="agent" />
          </el-select>
        </el-form-item>

        <!-- Agent chat: pick agent type -->
        <template v-if="newChatForm.type === 'agent'">
          <el-form-item label="Agent类型">
            <el-select v-model="newChatForm.agentType">
              <el-option label="知识问答" value="knowledge" />
              <el-option label="任务管理" value="task" />
              <el-option label="代码助手" value="code" />
            </el-select>
          </el-form-item>
        </template>

        <!-- Single chat: pick chat partner -->
        <template v-if="newChatForm.type === 'single'">
          <el-form-item label="聊天对象">
            <el-select
              v-model="newChatForm.partnerId"
              filterable
              remote
              :remote-method="searchUserList"
              :loading="searchingUsers"
              placeholder="搜索并选择用户"
              clearable
            >
              <el-option
                v-for="u in userSearchResults"
                :key="u.id"
                :label="u.username"
                :value="u.id"
              />
            </el-select>
          </el-form-item>
        </template>

        <!-- Group chat: pick initial members -->
        <template v-if="newChatForm.type === 'group'">
          <el-form-item label="初始成员">
            <el-select
              v-model="newChatForm.participants"
              filterable
              remote
              multiple
              :remote-method="searchUserList"
              :loading="searchingUsers"
              placeholder="搜索并添加成员"
            >
              <el-option
                v-for="u in userSearchResults"
                :key="u.id"
                :label="u.username"
                :value="u.id"
              />
            </el-select>
          </el-form-item>
        </template>

        <!-- Single/Group: optionally invite an agent -->
        <template v-if="newChatForm.type !== 'agent'">
          <el-form-item label="邀请Agent（可选）">
            <el-select
              v-model="newChatForm.invitedAgents"
              multiple
              placeholder="选择要邀请的AI助手"
              clearable
            >
              <el-option
                v-for="a in availableAgents"
                :key="a.id"
                :label="a.name + ' (' + agentTypeLabel(a.type) + ')'"
                :value="a.id"
              />
            </el-select>
          </el-form-item>
        </template>

        <!-- Name: auto for agent/single, manual for group -->
        <el-form-item label="会话名称">
          <el-input
            v-model="newChatForm.name"
            :placeholder="namePlaceholder"
            :disabled="newChatForm.type === 'agent'"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showNewChatModal = false">取消</el-button>
        <el-button type="primary" @click="createNewChat" :disabled="!canCreateChat">创建</el-button>
      </template>
    </el-dialog>

    <el-dialog title="成员管理" v-model="showParticipantsModal" width="420px">
      <div class="participants-list">
        <div class="add-participant-row">
          <el-select
            v-model="selectedNewMember"
            filterable
            remote
            :remote-method="searchUserList"
            :loading="searchingUsers"
            placeholder="搜索用户..."
            clearable
            style="flex:1"
          >
            <el-option
              v-for="u in userSearchResults"
              :key="u.id"
              :label="u.username"
              :value="u.id"
            />
          </el-select>
          <el-button type="primary" @click="addSelectedParticipant" :disabled="!selectedNewMember">
            <Plus /> 添加
          </el-button>
        </div>
        <el-scrollbar max-height="260px">
          <div v-for="p in participants" :key="p.id" class="participant-item">
            <el-avatar :size="32">
              <UserFilled />
            </el-avatar>
            <span class="participant-name">{{ p.username }}</span>
            <el-tag v-if="p.id === userStore.user?.id" size="small" type="info">我</el-tag>
            <el-button
              v-if="p.id !== userStore.user?.id"
              type="danger"
              size="small"
              text
              @click="removeParticipantFromConv(p.id)"
            >
              <Close /> 移除
            </el-button>
          </div>
          <div v-if="participantAgents.length > 0 && participants.length > 0" class="participant-divider">
            <span>AI助手</span>
          </div>
          <div v-for="a in participantAgents" :key="a.id" class="participant-item agent-item">
            <el-avatar :size="32" class="agent-avatar-icon">
              <Cpu />
            </el-avatar>
            <span class="participant-name">{{ a.name }}</span>
            <el-tag size="small" type="warning">{{ agentTypeLabel(a.type) }}</el-tag>
            <el-button
              type="danger"
              size="small"
              text
              @click="removeAgentFromConv(a.id)"
            >
              <Close /> 移除
            </el-button>
          </div>
        </el-scrollbar>
      </div>
      <template #footer>
        <el-button @click="showParticipantsModal = false">关闭</el-button>
      </template>
    </el-dialog>

    <el-dialog title="修改头像" v-model="showAvatarModal">
      <div class="avatar-upload">
        <el-avatar :size="100" :src="currentAvatar">
          <Plus />
        </el-avatar>
        <input
          type="file"
          accept="image/*"
          class="avatar-input"
          @change="handleAvatarUpdate"
        />
        <span class="upload-tip">点击上传头像</span>
      </div>
      <template #footer>
        <el-button @click="showAvatarModal = false">取消</el-button>
        <el-button type="primary" @click="saveAvatar">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, watch } from 'vue'
import { Cpu, Plus, User, UserFilled, Close } from '@element-plus/icons-vue'
import { marked } from 'marked'
import Sidebar from '@/components/Sidebar.vue'
import { useUserStore } from '../stores/user'
import { useMessagesStore } from '../stores/messages'
import { createConversation, updateConversationAvatar, renameConversation, getConversationParticipants, getConversationAgents, addParticipants, removeParticipant, addAgent, removeAgent, getAgents, type Participant, type AgentInfo } from '../api/conversations'
import { deleteMessages } from '../api/messages'
import { searchUsers } from '../api/auth'

const userStore = useUserStore()
const messagesStore = useMessagesStore()

const isLoadingConversations = ref(true)
const searchQuery = ref('')
const showNewChatModal = ref(false)
const showAvatarModal = ref(false)
const inputMessage = ref('')
const messageType = ref('text')
const currentAvatar = ref('')

const newChatForm = ref({
  name: '',
  type: 'single' as 'single' | 'group' | 'agent',
  agentType: 'knowledge' as 'knowledge' | 'task' | 'code',
  partnerId: '',
  participants: [] as string[],
  invitedAgents: [] as string[],
  avatar: ''
})

const availableAgents = ref<AgentInfo[]>([])

const searchingUsers = ref(false)
const userSearchResults = ref<{ id: string; username: string }[]>([])
let searchTimer: ReturnType<typeof setTimeout> | null = null

const searchUserList = (query: string) => {
  if (searchTimer) clearTimeout(searchTimer)
  if (!query) {
    userSearchResults.value = []
    return
  }
  searchingUsers.value = true
  searchTimer = setTimeout(async () => {
    try {
      userSearchResults.value = await searchUsers(query)
    } catch (e) {
      console.error('User search failed:', e)
    } finally {
      searchingUsers.value = false
    }
  }, 300)
}

const namePlaceholder = computed(() => {
  switch (newChatForm.value.type) {
    case 'agent': return '自动设为Agent名称'
    case 'single': return '自动设为对方用户名'
    case 'group': return '输入群聊名称'
    default: return '输入会话名称'
  }
})

const onChatTypeChange = () => {
  const type = newChatForm.value.type
  newChatForm.value.name = ''
  newChatForm.value.partnerId = ''
  newChatForm.value.participants = []
  newChatForm.value.invitedAgents = []
  userSearchResults.value = []
  if (type === 'agent') {
    const agentNames: Record<string, string> = {
      knowledge: '知识问答助手',
      task: '任务管理助手',
      code: '代码助手'
    }
    newChatForm.value.name = agentNames[newChatForm.value.agentType]
  }
}

watch(() => newChatForm.value.agentType, (val) => {
  if (newChatForm.value.type === 'agent') {
    const agentNames: Record<string, string> = {
      knowledge: '知识问答助手',
      task: '任务管理助手',
      code: '代码助手'
    }
    newChatForm.value.name = agentNames[val]
  }
})

const canCreateChat = computed(() => {
  const form = newChatForm.value
  switch (form.type) {
    case 'single': return !!form.partnerId
    case 'group': return form.name.trim().length > 0 && form.participants.length > 0
    case 'agent': return !!form.agentType
    default: return false
  }
})

const filteredConversations = computed(() => {
  if (!searchQuery.value) return messagesStore.conversations
  return messagesStore.conversations.filter(conv =>
    conv.name.toLowerCase().includes(searchQuery.value.toLowerCase())
  )
})

const formatTime = (timestamp?: number) => {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
  return `${date.getMonth() + 1}/${date.getDate()}`
}

const isAgentMessage = (msg: { senderId: string }) => {
  return msg.senderId?.startsWith('agent-')
}

const getMsgAvatar = (msg: { senderId: string; senderName: string }) => {
  // For group chats, try to find the sender in participants list
  if (participants.value.length > 0) {
    const p = participants.value.find(p => p.id === msg.senderId)
    // Participant doesn't have avatar field in current API; return undefined for icon fallback
    if (p) return undefined
  }
  return undefined
}

let codeBlockId = 0
const codeStore: Map<string, { code: string; lang: string }> = new Map()

const LANG_EXT: Record<string, string> = {
  javascript: '.js', js: '.js',
  typescript: '.ts', ts: '.ts',
  python: '.py', py: '.py',
  cpp: '.cpp', 'c++': '.cpp', c: '.c',
  java: '.java',
  go: '.go', golang: '.go',
  rust: '.rs', rs: '.rs',
  html: '.html', htm: '.html',
  css: '.css',
  scss: '.scss', sass: '.sass', less: '.less',
  json: '.json',
  xml: '.xml',
  yaml: '.yml', yml: '.yml',
  sql: '.sql',
  shell: '.sh', bash: '.sh', sh: '.sh', zsh: '.sh',
  ruby: '.rb', rb: '.rb',
  php: '.php',
  swift: '.swift',
  kotlin: '.kt', kt: '.kt',
  scala: '.scala',
  dart: '.dart',
  lua: '.lua',
  r: '.r',
  perl: '.pl',
  markdown: '.md', md: '.md',
  dockerfile: '.dockerfile', docker: '.dockerfile',
  toml: '.toml', ini: '.ini',
  makefile: '.mk',
  tsx: '.tsx', jsx: '.jsx', vue: '.vue', svelte: '.svelte',
}

const getExt = (lang: string): string => LANG_EXT[lang.toLowerCase()] || `.${lang.replace(/[^a-z0-9]/gi, '_')}`

class CodeBlockRenderer extends marked.Renderer {
  code(token: { text: string; lang?: string; escaped?: boolean }): string {
    const id = `cb-${++codeBlockId}`
    const lang = token.lang || 'text'
    codeStore.set(id, { code: token.text, lang })
    const toolbar = `<div class="code-toolbar"><span class="code-lang">${lang}</span><div class="code-toolbar-actions"><button class="code-btn" data-action="copy" data-code="${id}">复制</button><button class="code-btn" data-action="download" data-code="${id}">下载</button></div></div>`
    const escaped = token.escaped ? token.text : token.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    return `<div class="code-block-wrapper">${toolbar}<pre><code>${escaped}</code></pre></div>`
  }
}

const renderMarkdown = (content: string) => {
  codeBlockId = 0
  codeStore.clear()

  return marked.parse(content, {
    breaks: true,
    gfm: true,
    renderer: new CodeBlockRenderer()
  }) as string
}

const handleCodeAction = (action: string, id: string) => {
  const entry = codeStore.get(id)
  if (!entry) return

  if (action === 'copy') {
    navigator.clipboard.writeText(entry.code).then(() => {
    }).catch(() => {
      const ta = document.createElement('textarea')
      ta.value = entry.code
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    })
  } else if (action === 'download') {
    const blob = new Blob([entry.code], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `code-${id}${getExt(entry.lang)}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }
}

const agentTypeLabel = (type: string) => {
  switch (type) {
    case 'knowledge': return '知识问答'
    case 'task': return '任务管理'
    case 'code': return '代码助手'
    default: return type
  }
}

const convAgents = ref<AgentInfo[]>([])
const convAgentIds = computed(() => convAgents.value.map(a => a.id))

const getStatusText = (type: string) => {
  switch (type) {
    case 'single': return '在线'
    case 'group': return `${messagesStore.currentConversation?.participants?.length || 0} 位成员`
    case 'agent': return 'AI助手'
    default: return '离线'
  }
}

const inputPlaceholder = computed(() => {
  const convType = messagesStore.currentConversation?.type
  if (convType === 'agent') {
    return `输入${messageType.value === 'code' ? '代码' : messageType.value === 'task' ? '任务描述' : '消息'}...`
  }
  return '输入消息...'
})

const messageScrollRef = ref<any>(null)

const selectConversation = async (id: string) => {
  await messagesStore.loadMessages(id)
  messagesStore.subscribe(id)
  loadConvAgents()
  scrollToBottom()
}

const onMessageListClick = (e: MouseEvent) => {
  const target = e.target as HTMLElement
  const btn = target.closest('.code-btn') as HTMLElement | null
  if (!btn) return
  const action = btn.dataset.action
  const id = btn.dataset.code
  if (action && id) {
    handleCodeAction(action, id)
  }
}

const scrollToBottom = () => {
  nextTick(() => {
    const container = document.querySelector('.message-list .el-scrollbar__wrap')
    if (container) {
      (container as HTMLElement).scrollTop = (container as HTMLElement).scrollHeight
    }
  })
}

const handleMessageScroll = () => {
  const container = document.querySelector('.message-list .el-scrollbar__wrap')
  if (!container) return
  const el = container as HTMLElement
  if (el.scrollTop <= 50 && messagesStore.hasMore) {
    const prevScrollHeight = el.scrollHeight
    messagesStore.loadEarlierMessages().then(() => {
      nextTick(() => {
        el.scrollTop = el.scrollHeight - prevScrollHeight
      })
    })
  }
}

const sendMessage = async () => {
  if (!inputMessage.value.trim()) return
  
  await messagesStore.sendMessage(inputMessage.value, messageType.value)
  inputMessage.value = ''
  scrollToBottom()
}

const handleAvatarUpload = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) {
    const reader = new FileReader()
    reader.onload = (e) => {
      newChatForm.value.avatar = e.target?.result as string
    }
    reader.readAsDataURL(file)
  }
}

const handleAvatarUpdate = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) {
    const reader = new FileReader()
    reader.onload = (e) => {
      currentAvatar.value = e.target?.result as string
    }
    reader.readAsDataURL(file)
  }
}

const resetNewChatForm = () => {
  newChatForm.value = {
    name: '',
    type: 'single',
    agentType: 'knowledge',
    partnerId: '',
    participants: [],
    invitedAgents: [],
    avatar: ''
  }
  userSearchResults.value = []
}

const createNewChat = async () => {
  const form = newChatForm.value

  let name = form.name.trim()
  let participants: string[] = []

  if (form.type === 'agent') {
    const agentNames: Record<string, string> = {
      knowledge: '知识问答助手',
      task: '任务管理助手',
      code: '代码助手'
    }
    name = agentNames[form.agentType]
  } else if (form.type === 'single') {
    const partner = userSearchResults.value.find(u => u.id === form.partnerId)
    name = partner?.username || '单聊'
    participants = [form.partnerId]
  } else if (form.type === 'group') {
    if (!name) return
    participants = form.participants
  }

  try {
    const conv = await messagesStore.createNewConversation(
      name,
      form.type,
      participants,
      form.avatar,
      form.invitedAgents.length > 0 ? form.invitedAgents : undefined
    )

    await messagesStore.loadMessages(conv.id)
    messagesStore.subscribe(conv.id)
    loadConvAgents()
    showNewChatModal.value = false
    resetNewChatForm()
    scrollToBottom()
  } catch (e: any) {
    console.error('Create conversation failed:', e)
    alert('创建会话失败: ' + (e.message || '未知错误'))
  }
}

const openAvatarModal = () => {
  currentAvatar.value = messagesStore.currentConversation?.avatar || ''
  showAvatarModal.value = true
}

const saveAvatar = async () => {
  if (!currentAvatar.value || !messagesStore.currentConversationId) return

  await updateConversationAvatar(messagesStore.currentConversationId, currentAvatar.value)
  await messagesStore.updateConversationAvatar(messagesStore.currentConversationId, currentAvatar.value)
  showAvatarModal.value = false
}

// Inline rename for group/agent chats
const isRenaming = ref(false)
const renameValue = ref('')
const renameInputRef = ref<any>(null)

const startRename = () => {
  const conv = messagesStore.currentConversation
  if (!conv || conv.type === 'single') return
  renameValue.value = conv.name
  isRenaming.value = true
  nextTick(() => {
    renameInputRef.value?.focus?.()
  })
}

const commitRename = async () => {
  isRenaming.value = false
  const newName = renameValue.value.trim()
  if (!newName || !messagesStore.currentConversationId) return
  const conv = messagesStore.currentConversation
  if (!conv || newName === conv.name) return

  try {
    const updated = await renameConversation(messagesStore.currentConversationId, newName)
    const idx = messagesStore.conversations.findIndex(c => c.id === updated.id)
    if (idx !== -1) {
      messagesStore.conversations[idx] = updated
    }
  } catch (e: any) {
    console.error('Rename failed:', e)
  }
}

const cancelRename = () => {
  isRenaming.value = false
}

// Participant management
const showParticipantsModal = ref(false)
const participants = ref<Participant[]>([])
const participantAgents = ref<AgentInfo[]>([])
const selectedNewMember = ref('')

const openParticipantsModal = async () => {
  if (!messagesStore.currentConversationId) return
  try {
    const result = await getConversationParticipants(messagesStore.currentConversationId)
    participants.value = result.participants || []
    participantAgents.value = result.agents || []
    selectedNewMember.value = ''
    userSearchResults.value = []
    showParticipantsModal.value = true
  } catch (e) {
    console.error('Failed to load participants:', e)
  }
}

const addSelectedParticipant = async () => {
  if (!selectedNewMember.value || !messagesStore.currentConversationId) return
  try {
    await addParticipants(messagesStore.currentConversationId, [selectedNewMember.value])
    const result = await getConversationParticipants(messagesStore.currentConversationId)
    participants.value = result.participants || []
    participantAgents.value = result.agents || []
    selectedNewMember.value = ''
    userSearchResults.value = []
  } catch (e) {
    console.error('Failed to add participant:', e)
  }
}

const removeParticipantFromConv = async (userId: string) => {
  if (!messagesStore.currentConversationId) return
  try {
    await removeParticipant(messagesStore.currentConversationId, userId)
    participants.value = participants.value.filter(p => p.id !== userId)
  } catch (e) {
    console.error('Failed to remove participant:', e)
  }
}

const removeAgentFromConv = async (agentId: string) => {
  if (!messagesStore.currentConversationId) return
  try {
    await removeAgent(messagesStore.currentConversationId, agentId)
    participantAgents.value = participantAgents.value.filter(a => a.id !== agentId)
  } catch (e) {
    console.error('Failed to remove agent:', e)
  }
}

const mentionAgent = (agent: AgentInfo) => {
  inputMessage.value = inputMessage.value ? `${inputMessage.value} @${agent.name} ` : `@${agent.name} `
}

const loadConvAgents = async () => {
  if (!messagesStore.currentConversationId) return
  try {
    convAgents.value = await getConversationAgents(messagesStore.currentConversationId)
  } catch {
    convAgents.value = []
  }
}

const clearHistory = async () => {
  if (!messagesStore.currentConversationId) return
  try {
    await deleteMessages(messagesStore.currentConversationId)
    messagesStore.messages = []
    messagesStore.total = 0
    messagesStore.hasMore = false
  } catch (e) {
    console.error('Failed to clear history:', e)
    alert('清空记录失败')
  }
}


onMounted(async () => {
  try {
    await messagesStore.loadConversations()
    availableAgents.value = await getAgents()
  } finally {
    isLoadingConversations.value = false
  }
  await messagesStore.connectWebSocket()
})
</script>

<style>
.home-container {
  display: flex;
  height: 100vh;
  width: 100vw;
  max-width: 100vw;
  overflow: hidden;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 30%, #f0f4ff 100%);
}

/* ==================== Chat List Panel ==================== */
.chat-list {
  width: 288px;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.5);
  backdrop-filter: blur(20px);
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  border-right: 1px solid rgba(0, 0, 0, 0.06);
}

.chat-list-header {
  padding: 16px 14px 4px;
  flex-shrink: 0;
}

.search-bar {
  margin-bottom: 10px;
}

.search-bar .el-input__wrapper {
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.04);
  border: 1px solid transparent;
  box-shadow: none;
  height: 38px;
  transition: all var(--transition-fast);
}

.search-bar .el-input__wrapper:hover {
  background: rgba(0, 0, 0, 0.06);
}

.search-bar .el-input__wrapper:focus-within {
  background: white;
  border-color: var(--accent);
  box-shadow: var(--shadow-glow);
}

.new-chat-btn .el-button {
  width: 100%;
  height: 38px;
  border-radius: 10px;
  background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
  border: none;
  font-weight: 600;
  font-size: 13px;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.2), 0 0 0 0 rgba(99, 102, 241, 0);
  transition: all var(--transition-smooth);
}

.new-chat-btn .el-button:hover {
  background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%);
  box-shadow: 0 4px 16px rgba(99, 102, 241, 0.3), 0 0 0 4px rgba(99, 102, 241, 0.06);
  transform: translateY(-1px);
}

/* ==================== Conversation List ==================== */
.conversation-list {
  flex: 1;
  min-height: 0;
  padding: 6px 8px;
}

.el-list { padding: 0; }

.el-list-item {
  cursor: pointer;
  border-radius: 12px;
  margin-bottom: 2px;
  padding: 10px 10px !important;
  background: transparent;
  border: none;
  transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}

.el-list-item::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 12px;
  background: radial-gradient(circle at center, rgba(99, 102, 241, 0.12) 0%, transparent 70%);
  opacity: 0;
  transition: opacity 0.15s ease;
}

.el-list-item:active::after {
  opacity: 1;
}

.el-list-item::before {
  content: '';
  position: absolute;
  left: -2px;
  top: 50%;
  transform: translateY(-50%) scaleY(0);
  width: 3px;
  height: 24px;
  background: var(--accent);
  border-radius: 0 3px 3px 0;
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.el-list-item:hover {
  background: rgba(0, 0, 0, 0.04);
}

.el-list-item:active {
  transform: scale(0.98);
  background: rgba(99, 102, 241, 0.08);
}

.el-list-item:hover::before {
  transform: translateY(-50%) scaleY(0.6);
}

.el-list-item.active {
  background: rgba(99, 102, 241, 0.06);
}

.el-list-item.active::before {
  transform: translateY(-50%) scaleY(1);
  box-shadow: 0 0 8px rgba(99, 102, 241, 0.4);
}

.el-list-item.active:active {
  transform: scale(0.985);
}

.el-list-item__prefix {
  margin-right: 10px !important;
}

/* ==================== Conversation Avatar ==================== */
.conv-avatar { position: relative; flex-shrink: 0; }

.conv-avatar .el-avatar {
  width: 42px;
  height: 42px;
  font-size: 16px;
  background: linear-gradient(135deg, #e5e7eb 0%, #d1d5db 100%);
  transition: all var(--transition-smooth);
}

.conv-avatar.conv-type-single .el-avatar {
  background: linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%);
  color: #6366f1;
}

.conv-avatar.conv-type-group .el-avatar {
  background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
  color: #059669;
}

.conv-avatar.conv-type-agent .el-avatar {
  background: linear-gradient(135deg, #ede9fe 0%, #c4b5fd 100%);
  color: #7c3aed;
}

.conv-avatar.has-avatar .el-avatar {
  background: transparent;
  color: inherit;
}

.el-list-item.active .conv-avatar .el-avatar {
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
}

.conv-online-dot {
  position: absolute;
  bottom: 1px;
  right: 1px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #10b981;
  border: 2px solid white;
  box-shadow: 0 0 6px rgba(16, 185, 129, 0.4);
}

/* ==================== Conversation Info ==================== */
.conv-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.conv-name-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.conv-name {
  font-weight: 600;
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--text-primary);
  line-height: 1.4;
  flex: 1;
  min-width: 0;
}

.conv-type-tag {
  flex-shrink: 0;
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 4px;
  line-height: 1.6;
}

.conv-type-tag.single {
  background: rgba(99, 102, 241, 0.1);
  color: var(--accent);
}

.conv-type-tag.group {
  background: rgba(16, 185, 129, 0.1);
  color: #059669;
}

.conv-type-tag.agent {
  background: rgba(124, 58, 237, 0.1);
  color: #7c3aed;
}

.conv-preview {
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.4;
}

.conv-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
  flex-shrink: 0;
}

.conv-time {
  font-size: 11px;
  color: var(--text-muted);
  font-weight: 500;
}

.conv-unread {
  font-size: 11px;
  font-weight: 700;
  color: white;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  min-width: 20px;
  height: 20px;
  line-height: 20px;
  text-align: center;
  padding: 0 6px;
  border-radius: 10px;
  box-shadow: 0 2px 6px rgba(99, 102, 241, 0.35);
}

.chat-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 50%, #eef2ff 100%);
}

.chat-window {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  background: transparent;
}

.chat-header {
  display: flex;
  align-items: center;
  padding: 12px 20px;
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  gap: 12px;
  flex-shrink: 0;
}

.header-info { flex: 1; }

.header-info h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.01em;
}

h3.editable-name {
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 6px;
  margin: -2px -6px;
  transition: all var(--transition-fast);
}

h3.editable-name:hover {
  background: rgba(99, 102, 241, 0.08);
  color: var(--accent);
}

.rename-input {
  max-width: 180px;
}

.rename-input .el-input__wrapper {
  border-radius: 6px;
  box-shadow: 0 0 0 1px var(--accent);
}

.status {
  font-size: 12px;
  color: #10b981;
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
  font-weight: 600;
}

.status::before {
  content: '';
  width: 7px;
  height: 7px;
  background: #10b981;
  border-radius: 50%;
  animation: softPulse 2s ease-in-out infinite;
}

@keyframes softPulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(1.2); }
}

.status.group { color: #6b7280; }
.status.group::before { background: #9ca3af; }

.header-actions { margin-left: auto; display: flex; gap: 4px; }

.header-actions .el-button {
  border-radius: 8px;
  border: none;
  font-weight: 500;
  font-size: 12px;
  color: #6b7280;
  transition: all 0.15s ease;
}

.header-actions .el-button:hover {
  background: #f3f4f6;
  color: #4f46e5;
}

.message-list {
  flex: 1;
  min-height: 0;
  padding: 16px 20px;
}

.load-earlier-hint {
  text-align: center;
  padding: 8px 0 16px;
  font-size: 12px;
  color: var(--accent);
  cursor: pointer;
  user-select: none;
  font-weight: 500;
}

.load-earlier-hint:hover {
  text-decoration: underline;
}

/* ==================== Message Row ==================== */

.message-row {
  display: flex;
  gap: 10px;
  margin-bottom: 18px;
  align-items: flex-start;
}

.message-row.is-self {
  justify-content: flex-end;
}

/* ---- Left avatar (others/agents) ---- */
.msg-avatar-left {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
}

.msg-avatar-left .el-avatar {
  width: 100%;
  height: 100%;
  font-size: 16px;
  background: linear-gradient(135deg, #e5e7eb 0%, #d1d5db 100%);
  color: #6b7280;
}

.msg-avatar-left.agent-avatar .el-avatar {
  background: linear-gradient(135deg, #ede9fe 0%, #c4b5fd 100%);
  color: #7c3aed;
}

/* ---- Main message body ---- */
.msg-main {
  max-width: 68%;
  display: flex;
  flex-direction: column;
}

.message-row.is-self .msg-main {
  align-items: flex-end;
}

.msg-sender-name {
  font-size: 11px;
  color: #6b7280;
  margin-bottom: 3px;
  padding-left: 4px;
  font-weight: 600;
  line-height: 1;
}

.msg-time {
  font-size: 10px;
  color: #9ca3af;
  margin-top: 3px;
  padding: 0 4px;
  font-weight: 500;
}

.message-row.is-self .msg-time {
  text-align: right;
}

/* ==================== Message Bubble ==================== */

.msg-bubble {
  padding: 10px 14px;
  font-size: 14px;
  line-height: 1.6;
  word-break: break-word;
  position: relative;
}

/* Other's bubble (left side) */
.msg-bubble.is-other {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(6px);
  color: #1f2937;
  border-radius: 4px 18px 18px 18px;
  border: 1px solid rgba(0, 0, 0, 0.05);
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.03),
    0 2px 4px rgba(0, 0, 0, 0.04);
}

/* My bubble (right side) */
.msg-bubble.is-self {
  background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
  color: white;
  border-radius: 18px 4px 18px 18px;
  border: none;
  box-shadow:
    0 2px 8px rgba(99, 102, 241, 0.25),
    0 1px 2px rgba(99, 102, 241, 0.15);
}

/* Code block inside bubble */
.code-block {
  background: linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f0d2e 100%);
  color: #e2e8f0;
  padding: 14px;
  border-radius: 10px;
  overflow-x: auto;
  font-family: 'Cascadia Code', 'SF Mono', 'Consolas', monospace;
  font-size: 13px;
  line-height: 1.6;
  margin: 0;
  border: 1px solid rgba(255, 255, 255, 0.05);
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.3);
}

.msg-bubble.is-self .code-block {
  background: rgba(0, 0, 0, 0.25);
  border-color: rgba(255, 255, 255, 0.08);
}

/* Markdown content inside agent bubbles */
.markdown-body {
  word-break: break-word;
}

.markdown-body h1, .markdown-body h2, .markdown-body h3,
.markdown-body h4, .markdown-body h5, .markdown-body h6 {
  margin: 12px 0 6px;
  font-weight: 700;
  color: #1e293b;
  line-height: 1.3;
}

.markdown-body h1 { font-size: 1.3em; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; }
.markdown-body h2 { font-size: 1.15em; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
.markdown-body h3 { font-size: 1.05em; }
.markdown-body h4 { font-size: 1em; }

.markdown-body h1:first-child,
.markdown-body h2:first-child,
.markdown-body h3:first-child { margin-top: 0; }

.markdown-body p { margin: 4px 0; line-height: 1.7; }

.markdown-body ul, .markdown-body ol {
  padding-left: 20px;
  margin: 6px 0;
}

.markdown-body li { margin: 2px 0; line-height: 1.6; }

.markdown-body code {
  background: #f1f5f9;
  color: #e11d48;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 0.85em;
}

.markdown-body pre {
  background: linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f0d2e 100%);
  border-radius: 10px;
  padding: 12px;
  overflow-x: auto;
  margin: 10px 0;
  border: 1px solid rgba(255, 255, 255, 0.05);
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.3);
}

.markdown-body pre code {
  background: transparent;
  color: #e2e8f0;
  padding: 0;
  font-size: 0.83em;
  line-height: 1.6;
}

.markdown-body blockquote {
  border-left: 4px solid #6366f1;
  padding: 8px 16px;
  margin: 12px 0;
  background: #f8fafc;
  border-radius: 0 8px 8px 0;
  color: #475569;
}

.markdown-body table {
  border-collapse: collapse;
  margin: 12px 0;
  width: 100%;
}

.markdown-body th, .markdown-body td {
  border: 1px solid #e2e8f0;
  padding: 8px 14px;
  text-align: left;
}

.markdown-body th {
  background: #f1f5f9;
  font-weight: 700;
  color: #1e293b;
}

.markdown-body a {
  color: #6366f1;
  text-decoration: none;
}

.markdown-body a:hover { text-decoration: underline; }

.markdown-body hr { border: none; border-top: 1px solid #e2e8f0; margin: 16px 0; }

.markdown-body strong { font-weight: 700; color: #1e293b; }

.markdown-body img { max-width: 100%; border-radius: 8px; }

/* Code block wrapper with toolbar */
.code-block-wrapper {
  margin: 12px 0;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid #e2e8f0;
}

.code-block-wrapper pre {
  margin: 0 !important;
  border-radius: 0 !important;
}

.code-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 14px;
  background: #f1f5f9;
  border-bottom: 1px solid #e2e8f0;
}

.code-lang {
  font-size: 12px;
  color: #64748b;
  font-weight: 600;
  text-transform: uppercase;
}

.code-toolbar-actions {
  display: flex;
  gap: 6px;
}

.code-btn {
  padding: 3px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  background: white;
  color: #475569;
  font-size: 12px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.15s ease;
}

.code-btn:hover {
  background: #6366f1;
  color: white;
  border-color: #6366f1;
}

.code-btn:active {
  transform: scale(0.96);
}

.msg-time {
  font-size: 11px;
  color: #9ca3af;
  margin-top: 6px;
  padding: 0 4px;
  font-weight: 500;
}

.chat-input {
  display: flex;
  gap: 10px;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(12px);
  border-top: 1px solid rgba(0, 0, 0, 0.06);
  flex-shrink: 0;
}

.chat-input .type-select { width: 80px; flex-shrink: 0; }

.chat-input .el-input { flex: 1; }

.chat-input .type-select .el-select__wrapper {
  border-radius: 20px;
  background: rgba(0, 0, 0, 0.04);
  border: 1px solid transparent;
  box-shadow: none;
  font-weight: 600;
  font-size: 12px;
  height: 36px;
}

.chat-input .el-input__wrapper {
  border-radius: 20px;
  background: rgba(0, 0, 0, 0.04);
  border: 1px solid transparent;
  box-shadow: none;
  height: 36px;
  transition: all var(--transition-fast);
}

.chat-input .el-input__wrapper:focus-within,
.chat-input .el-input__wrapper.is-focus {
  background: white;
  border-color: var(--accent);
  box-shadow: var(--shadow-glow);
}

.chat-input .el-button {
  border-radius: 20px;
  padding: 0 22px;
  background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
  border: none;
  font-weight: 600;
  font-size: 13px;
  height: 36px;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.25), 0 0 0 0 rgba(99, 102, 241, 0);
  flex-shrink: 0;
  transition: all var(--transition-smooth);
}

.chat-input .el-button:hover {
  background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%);
  box-shadow: 0 4px 16px rgba(99, 102, 241, 0.35), 0 0 0 4px rgba(99, 102, 241, 0.06);
  transform: translateY(-1px);
}

.chat-input .el-button:disabled {
  opacity: 0.5;
  box-shadow: none;
  transform: none;
}

.agent-mention-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 0 8px;
  font-size: 12px;
  color: #6b7280;
  flex-wrap: wrap;
}

.agent-hint-tag {
  display: inline-flex;
  align-items: center;
  padding: 1px 8px;
  border-radius: 10px;
  background: linear-gradient(135deg, #ede9fe 0%, #e0e7ff 100%);
  color: #6366f1;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.agent-hint-tag:hover {
  background: linear-gradient(135deg, #c4b5fd 0%, #a5b4fc 100%);
  color: #4f46e5;
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  color: #9ca3af;
}

.empty-state p {
  font-size: 15px;
  margin: 0;
  font-weight: 500;
}

.avatar-upload {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.avatar-upload .el-avatar {
  cursor: pointer;
}

.avatar-input {
  position: absolute;
  width: 80px;
  height: 80px;
  opacity: 0;
  cursor: pointer;
}

.upload-tip {
  font-size: 12px;
  color: #94a3b8;
}

.participants-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.add-participant-row {
  display: flex;
  gap: 8px;
}

.participant-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
}

.participant-name {
  flex: 1;
  font-weight: 500;
}

.participant-divider {
  display: flex;
  align-items: center;
  padding: 8px 0 4px;
  font-size: 11px;
  color: #9ca3af;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.participant-divider::before,
.participant-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: #e5e7eb;
}

.participant-divider span {
  padding: 0 10px;
}

.agent-item .agent-avatar-icon {
  background: linear-gradient(135deg, #ede9fe 0%, #c4b5fd 100%) !important;
  color: #7c3aed !important;
}

.loading-earlier {
  display: flex;
  justify-content: center;
  padding: 16px;
}

.streaming-bubble {
  position: relative;
}

.streaming-cursor {
  display: inline;
  animation: blink 1s step-end infinite;
  color: #6366f1;
  font-weight: bold;
}

.thinking-indicator {
  color: #64748b;
  font-style: italic;
}

.thinking-dots i {
  animation: dotPulse 1.4s ease-in-out infinite both;
  font-style: normal;
  font-weight: bold;
}

.thinking-dots i:nth-child(1) { animation-delay: 0s; }
.thinking-dots i:nth-child(2) { animation-delay: 0.2s; }
.thinking-dots i:nth-child(3) { animation-delay: 0.4s; }

@keyframes dotPulse {
  0%, 80%, 100% { opacity: 0; }
  40% { opacity: 1; }
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}


/* ==================== Skeleton Loading ==================== */
.conv-skeleton { padding: 6px; }

.skeleton-item {
  padding: 10px 12px;
  margin-bottom: 6px;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.02);
}

.sk-flex {
  display: flex;
  align-items: center;
  gap: 12px;
}
</style>
