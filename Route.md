# AgentHub — 大模型Agent框架技术路线

## 概述

AgentHub 的Agent框架是一套**自研的轻量级Multi-Agent调度系统**，基于Node.js + TypeScript构建，不依赖LangChain等第三方Agent框架，从底层实现了LLM调用、流式响应、上下文管理、Agent路由、Prompt热加载等核心基础设施。

---

## 一、整体架构：分层设计

```
┌─────────────────────────────────────────────────┐
│              会话层 (WebSocket/HTTP)               │
│   handleSendMessage → handleAgentReply           │
│   (消息入口  →  @提及解析  →  Agent触发)           │
└────────────────────┬────────────────────────────┘
                     │
┌────────────────────┴────────────────────────────┐
│              Agent调度层 (agents/index.ts)         │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────┐ │
│  │ loadAgentConfig│ │ agentRouter  │ │getAgentName│ │
│  │  (DB+TLL缓存) │ │ (type→handler)│ │           │ │
│  └──────────────┘ └──────────────┘ └──────────┘ │
└────────────────────┬────────────────────────────┘
                     │
┌────────────────────┴────────────────────────────┐
│           LLM基础设施层 (agents/llm.ts)            │
│  ┌────────────────┐  ┌────────────────────────┐ │
│  │   callLLM()     │  │   callLLMStream()       │ │
│  │   非流式调用     │  │   流式调用(SSE→chunk)    │ │
│  │   3次重试+退避   │  │   3次重试+退避+Abort    │ │
│  └────────────────┘  └────────────────────────┘ │
└────────────────────┬────────────────────────────┘
                     │
┌────────────────────┴────────────────────────────┐
│         上下文管理层 (agents/context.ts)           │
│  ┌────────────────┐  ┌────────────────────────┐ │
│  │ estimateTokens()│  │  truncateContext()       │ │
│  │ 启发式Token估算  │  │  滑动窗口截断             │ │
│  │ 中日韩/ASCII    │  │  System Prompt保留       │ │
│  └────────────────┘  └────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

---

## 二、LLM调用引擎 (`server/src/agents/llm.ts`)

### 2.1 统一LLM接口设计

不绑定特定模型厂商，通过环境变量注入实现模型可替换：

```typescript
const API_KEY  = process.env.API_KEY    // 支持任意OpenAI兼容API
const API_URL  = process.env.API_URL    // 默认: GLM-4-Flash (智谱)
const API_MODEL = process.env.API_MODEL
```

核心数据结构使用标准的OpenAI Chat Completions格式（`system/user/assistant`三元组），天然兼容DeepSeek/GLM/Qwen/GPT等主流模型。

### 2.2 非流式调用 `callLLM()`

```
callLLM(messages, model) → Promise<string>
```

- 标准HTTP POST请求，`temperature: 0.7`, `max_tokens: 8192`
- 支持 `reasoning_content` 解析（部分模型如GLM的思维链输出）

### 2.3 流式调用 `callLLMStream()` — 核心技术

```
callLLMStream(messages, onChunk, model, signal?) → Promise<string>
```

**实现流程：**

```
Client Request
     │
     ▼
axios.post({ stream: true, responseType: 'stream' })
     │
     ▼
SSE Stream (data chunks arriving)
     │
     ├── Buffer缓冲区 → 按 \n 行分割
     │   buffer = chunk.toString()
     │   lines = buffer.split('\n')
     │   buffer = lines.pop()  // 保留未完成行
     │
     ├── 逐行解析 SSE 协议
     │   trimmed.startsWith('data:')
     │   jsonStr = trimmed.slice(5)       // 去掉 "data:" 前缀
     │   jsonStr === '[DONE]' → 跳过       // 流结束信号
     │
     ├── 提取 delta.content
     │   parsed.choices[0]?.delta?.content
     │   → answerContent += delta.content  // 累积完整回复
     │   → onChunk(delta.content)          // 回调推送每一段
     │
     └── stream.on('end') → resolve(answerContent)
```

**关键设计点：**
- **Buffer行分割**：SSE数据可能跨chunk到达（TCP分片），用buffer缓存未完成行，避免JSON解析错误
- **容错处理**：try-catch包裹每个JSON.parse，跳过unparseable行而不中断整个流
- **AbortController支持**：外部可通过`signal`随时取消进行中的流式请求（如用户切换会话时丢弃未完成的Agent回复）

### 2.4 重试机制 — 指数退避 + 随机抖动

```typescript
const MAX_RETRIES = 3
const BASE_DELAY_MS = 1000

for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
  try {
    return await callLLMCore(messages, model)
  } catch (error) {
    if (attempt < MAX_RETRIES && isRetryableError(error)) {
      const jitter = Math.random() * 0.5 + 0.5     // [0.5, 1.0]
      const waitMs = BASE_DELAY_MS * Math.pow(2, attempt) * jitter
      // attempt=0: 500~1000ms, attempt=1: 1000~2000ms, attempt=2: 2000~4000ms
      await delay(waitMs)
      continue
    }
    break
  }
}
```

**可重试错误判断策略：**
- `5xx` (服务端错误) → 重试
- `429` (限流) → 重试
- 网络错误（无HTTP status） → 重试
- `4xx` (客户端错误，如401/400) → **不重试**，直接抛出

**流式调用的特殊处理：**
- 每次重试前检查 `signal.aborted`，已被取消则立即抛出`AbortError`不再重试
- 重试时重新发起完整的流式请求（从头开始），因为部分流已损坏

---

## 三、上下文窗口管理 (`server/src/agents/context.ts`)

### 3.1 Token估算算法 `estimateTokens()`

不依赖外部Tokenizer库，实现**字符级启发式估算**（零外部依赖、离线可用）：

```typescript
export const estimateTokens = (text: string): number => {
  let tokens = 0
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    if (code >= 0x4e00 && code <= 0x9fff) {
      tokens += 1.3          // CJK统一汉字：约1.3 token/字
    } else if (
      (code >= 0x3040 && code <= 0x309f) ||  // 平假名
      (code >= 0x30a0 && code <= 0x30ff) ||  // 片假名
      (code >= 0xac00 && code <= 0xd7af)     // 韩文
    ) {
      tokens += 1.2          // 日韩文字：约1.2 token/字
    } else if (code <= 0x7f) {
      tokens += code === 0x20 ? 0.25 : 0.35  // ASCII空格0.25, 其他0.35
    } else {
      tokens += 0.5          // 其他Unicode
    }
  }
  return Math.ceil(tokens)   // 向上取整，留安全余量
}
```

**设计思想：** Tokenizer将中文拆为单字token（1字≈1 token），英文拆为subword（平均3-4字符≈1 token），按字符Unicode块分类估算，误差控制在±15%以内。

### 3.2 滑动窗口截断 `truncateContext()`

```
truncateContext(messages, maxTokens=60000) → messages[]
```

**截断策略（三级优先级）：**

```
1. System Prompt  →  ALWAYS保留（位于窗口最顶部）
2. 最近消息        →  从尾部反向遍历，优先保留
3. 超出预算的消息  →  截断内容 or 丢弃

┌──────────────────────────────────────┐
│ System Prompt (不参与截断，永久保留)  │ ← 始终在顶部
├──────────────────────────────────────┤
│ [丢弃]  msg_1  msg_2  msg_3  ...     │ ← 旧消息被裁剪
├──────────────────────────────────────┤
│ msg_n-3  msg_n-2  msg_n-1  msg_n    │ ← 最近N条保留
└──────────────────────────────────────┘
```

**边界情况处理：**
- System Prompt单独超过预算 → 截断System Prompt本身（极端情况，只保留前80%）
- 最后一条消息太长 → 按剩余预算截断内容 + 追加`"..."`标记
- `estimateTokens(msg) + 4` — 每条消息额外预留4 tokens的结构开销（role标记等）

**关键代码片段：**
```typescript
// 反向遍历，保留最近的消息（时间倒序从尾部开始）
for (let i = nonSystemMessages.length - 1; i >= 0; i--) {
  const msgTokens = estimateTokens(msg.content) + 4
  if (usedTokens + msgTokens > availableTokens) {
    // 尝试截断最后一条消息的内容以适配剩余空间
    const remaining = availableTokens - usedTokens
    if (remaining > 50) {
      const charBudget = Math.floor(remaining * 3)
      kept.unshift({ ...msg, content: msg.content.slice(0, charBudget) + '...' })
    }
    break  // 丢弃更早的消息
  }
  kept.unshift(msg)
  usedTokens += msgTokens
}
```

---

## 四、Agent调度与类型路由

### 4.1 Agent类型注册表

```typescript
// agents/index.ts
export const agentHandlers: Record<AgentType, AgentHandler> = {
  knowledge: knowledgeAgent,   // 知识问答 → callLLM
  task:       taskAgent,       // 任务拆解 → callLLM → JSON.parse
  code:       codeAgent        // 代码助手 → callLLM
}
```

### 4.2 消息路由策略

**Agent专用会话（type='agent'）：** 每条消息都触发Agent回复，路由由消息类型字段决定：

| 消息类型 | 路由目标 | 说明 |
|----------|----------|------|
| `text` | knowledgeAgent | 知识问答/通用对话 |
| `code` | codeAgent | 代码生成/审查/优化 |
| `task` | taskAgent | 需求拆解、任务管理 |

**普通会话（单聊/群聊）：** 仅当消息中包含 `@AgentName` 时触发对应Agent：

```typescript
// websocket/server.ts
const parseAgentMentions = (content, agents) => {
  const mentionRegex = /@(\S+)/g         // 匹配所有@提及
  const mentioned = new Set<string>()
  let match
  while ((match = mentionRegex.exec(content)) !== null) {
    mentioned.add(match[1])
  }
  return agents.filter(a => mentioned.has(a.name))  // 匹配Agent名称
}

// 示例: 用户输入 "@知识问答助手 什么是闭包？"
// → 正则匹配到 "知识问答助手"
// → 与conversation_agents表中该会话的Agent列表对比
// → 匹配成功 → 触发 knowledgeAgent
```

### 4.3 Agent配置热加载

Agent的System Prompt不硬编码，而是存储在SQLite的`agents.config` JSON字段中：

```sql
SELECT config FROM agents WHERE id = 'agent-knowledge'
-- 返回: {"systemPrompt": "你是一个专业的知识问答助手...", "temperature": 0.7}
```

**TTL缓存机制：**
```typescript
const configCache: Map<string, { config; expiresAt }> = new Map()
const CACHE_TTL_MS = 60_000  // 60秒

export const loadAgentConfig = async (agentId: string): Promise<AgentConfig> => {
  const cached = configCache.get(agentId)
  if (cached && cached.expiresAt > Date.now()) return cached.config  // 命中缓存

  const agent = await db.get('SELECT config FROM agents WHERE id = ?', [agentId])
  const parsed = JSON.parse(agent.config)  // 从DB加载最新配置
  configCache.set(agentId, { config: parsed, expiresAt: Date.now() + CACHE_TTL_MS })
  return parsed
}
```

**效果：** 直接 `UPDATE agents SET config = '...'` 修改数据库，60秒内所有新请求自动使用新Prompt，无需重启进程。

**定时刷新：** `node-cron` 每5分钟调用 `clearAgentConfigCache()`，强制下一轮请求从DB重新加载。

---

## 五、WebSocket → Agent流式管道

### 5.1 推流链路

```
DeepSeek/GLM API (SSE)
     │  data: {"choices":[{"delta":{"content":"闭"}}]}
     │  data: {"choices":[{"delta":{"content":"包"}}]}
     │  data: [DONE]
     ▼
callLLMStream() 的 onChunk 回调
     │  onChunk("闭") → broadcast(convId, { type: 'agentChunk', payload: { content: "闭" } })
     │  onChunk("包") → broadcast(convId, { type: 'agentChunk', payload: { content: "包" } })
     ▼
WebSocket Server broadcast()
     │  JSON → ws.send()  → 所有订阅该会话的客户端
     ▼
Client WebSocket on('agentChunk')
     │  streamingMessage.content += chunk   (逐字累积)
     │  Vue reactivity → DOM更新 + 闪烁光标
     ▼
stream.on('end')
     │  resolve(answerContent)
     │  broadcast(convId, { type: 'agentReplyEnd', payload: { content: fullContent } })
     │  INSERT INTO messages (持久化完整消息)
     ▼
Client WebSocket on('agentReplyEnd')
     streamingMessage = null
     messages.push(fullMessage)   (替换为持久化的完整消息)
```

### 5.2 生命周期信号

| 信号 | 时机 | 前端响应 |
|------|------|----------|
| `agentReplyStart` | LLM流开始前 | 创建 `streamingMessage` 占位，显示"思考中..." |
| `agentChunk` | 每个SSE chunk到达 | 逐字追加到`streamingMessage.content`，闪烁光标 |
| `agentReplyEnd` | 流完成 + 消息存DB后 | 清除 `streamingMessage`，将完整消息push到消息列表 |
| `agentReplyError` | 所有重试耗尽后 | 清除 `streamingMessage`，显示"AI响应失败"系统消息 |

---

## 六、Prompt工程设计

### 6.1 Knowledge Agent — 知识问答

```
角色：专业知识问答助手
输出：Markdown格式（标题/列表/代码块/引用/表格）
约束：简洁直接，不冗余；技术问题给出可操作方案
领域：平台自有知识库 + 通用技术知识
```

### 6.2 Task Agent — 任务拆解

```
角色：任务管理助手
输出：严格JSON数组（不含markdown代码块标记）
Schema：
  [{ title, description, priority: "high|medium|low", dependencies: [] }]
拆解原则：每个任务独立可交付、优先级合理、依赖明确
容错：JSON.parse失败 → fallback为解析失败提示
```

### 6.3 Code Agent — 代码助手

```
角色：代码生成/审查/优化/修复
输出：Markdown + 语言标注的代码块
审查维度：代码质量、安全性、性能、可读性
生成约束：完整可运行、不省略关键部分
```

---

## 七、核心技术参数汇总

| 参数 | 值 | 含义 |
|------|-----|------|
| `MAX_CONTEXT_TOKENS` | 60,000 | 上下文窗口上限（GLM-4 128K总量，留68K给响应） |
| `MAX_RETRIES` | 3 | LLM调用最大重试次数 |
| `BASE_DELAY_MS` | 1,000 | 重试基础延迟（指数退避基数） |
| `CACHE_TTL_MS` | 60,000 | Agent配置缓存有效期 |
| `max_tokens` | 8,192 | 单次请求最大输出token数 |
| `temperature` | 0.7 | 生成温度（平衡创造力与确定性） |
| `PAGE_SIZE` | 50 | 消息分页每页条数 |

---

## 八、技术特点总结（简历用）

1. **自研Agent框架**：不依赖LangChain等第三方库，从底层实现LLM调用、流式处理、上下文管理、Agent路由全部基础设施
2. **流式推词管道**：SSE协议解析 → Buffer行分割 → chunk回调 → WebSocket广播 → 前端逐字渲染，完整端到端流式链路
3. **上下文窗口引擎**：Unicode块级Token估算算法 + 滑动窗口截断 + System Prompt保留策略，处理超长对话不丢失关键上下文
4. **Multi-Agent类型路由**：消息类型驱动 + @提及名称匹配的双通道Agent触发机制，支持单聊/群聊/Agent三种会话模式下的Agent按需介入
5. **配置热加载**：Agent System Prompt存储于数据库，TTL缓存 + 定时刷新，实现不重启进程的动态Prompt调优
6. **故障容错**：指数退避 + 随机Jitter重试 + AbortController取消 + 流式重试从头重建，覆盖网络中断/限流/服务端异常等故障场景
