# AgentHub - IM 聊天式多 Agent 协作平台

基于 Vue 3 + Element Plus + Express + WebSocket + DeepSeek API 构建的多智能体协作平台，集成知识问答、任务管理、代码审查与一键部署能力。

![UI Style](https://img.shields.io/badge/UI-Uiverse%20Glass%20Morphism-6366f1) ![License](https://img.shields.io/badge/license-MIT-green)

## 技术栈

| 分类 | 技术 |
|------|------|
| 前端 | Vue 3 (Composition API) + Element Plus + Pinia + Vue Router |
| 后端 | Node.js + Express + TypeScript |
| 数据库 | SQLite |
| 实时通信 | WebSocket (ws) |
| AI 模型 | DeepSeek API (流式输出) |
| 构建 | Webpack 5 + ts-loader |
| 代码编辑器 | Monaco Editor + diff2html |
| 设计风格 | Uiverse Glass Morphism + CSS 设计令牌 |

## 项目结构

```
agenthub/
├── client/                          # Vue 前端
│   └── src/
│       ├── api/                     # API 请求封装
│       │   ├── auth.ts              # 认证 + 用户资料 + 头像上传
│       │   ├── messages.ts          # 消息 (分页)
│       │   ├── conversations.ts     # 会话 + 参与者管理
│       │   ├── tasks.ts             # 任务 CRUD + 流式执行
│       │   ├── agents.ts            # Agent 查询
│       │   ├── code.ts              # 代码审查 + Diff
│       │   └── deploy.ts            # 部署触发 + 文件上传
│       ├── components/
│       │   └── Sidebar.vue          # 共享侧边栏 (玻璃质感)
│       ├── stores/                  # Pinia 状态管理
│       │   ├── user.ts              # 用户状态 (含头像)
│       │   ├── messages.ts          # 消息 + 流式状态
│       │   └── task.ts              # 任务状态
│       ├── views/                   # 页面视图
│       │   ├── Login.vue            # 登录/注册
│       │   ├── Home.vue             # 主聊天页面 (IM 风格气泡)
│       │   ├── Settings.vue         # 个人设置 (头像/资料/安全/危险操作)
│       │   ├── Tasks.vue            # 任务看板 (Kanban 三列)
│       │   ├── CodeReview.vue       # 代码审查 (Monaco + diff2html)
│       │   ├── Deploy.vue           # 一键部署 (本机/上传)
│       │   └── Preview.vue          # 网页预览 (多设备模拟)
│       ├── router/                  # Vue Router 路由
│       ├── websocket/               # WebSocket 客户端
│       └── main.ts                  # 入口文件
├── server/                          # Node.js 后端
│   └── src/
│       ├── agents/                  # AI Agent 实现
│       │   ├── knowledge.ts         # 知识问答 Agent
│       │   ├── taskAgent.ts         # 任务管理 Agent
│       │   ├── codeAgent.ts         # 代码助手 Agent
│       │   ├── deepseek.ts          # DeepSeek API (流式 + 重试)
│       │   ├── context.ts           # 上下文窗口管理 (Token 估算)
│       │   └── index.ts             # Agent 配置缓存 (60s TTL)
│       ├── routes/                  # REST API 路由
│       │   ├── auth.ts              # 认证 + 用户资料 + 头像
│       │   ├── conversations.ts     # 会话管理
│       │   ├── messages.ts          # 消息 (分页 + 数据隔离)
│       │   ├── tasks.ts             # 任务 CRUD + 流式执行
│       │   ├── agents.ts            # Agent 查询
│       │   ├── code.ts              # 代码审查 + Diff
│       │   └── deploy.ts            # 部署流水线 + 文件上传
│       ├── middleware/
│       │   └── auth.ts              # JWT 认证中间件
│       ├── websocket/
│       │   └── server.ts            # WS 服务端 (认证 + 流式推送)
│       ├── cron/
│       │   └── index.ts             # 定时任务 (清理/健康检查/缓存刷新)
│       ├── utils/
│       │   └── jwt.ts               # JWT 工具函数
│       ├── database.ts              # SQLite 初始化 + Migration
│       └── server.ts                # 服务入口
└── cankao.md                        # 项目参考文档
```

## 功能特性

### 用户系统
- **JWT 认证** — 注册/登录/Token 验证，中间件保护所有 API 路由
- **个人设置** — 头像上传（裁剪压缩）、用户名/简介编辑、密码修改
- **账号信息** — 用户 ID、邮箱、注册时间展示

### 实时聊天
- **多会话类型** — 单聊、群聊、Agent 对话，带类型标识标签
- **WebSocket 推送** — 消息实时收发，流式 AI 回复逐 Token 显示
- **消息分页** — 滚动到顶加载历史消息，`limit/offset` 查询
- **群聊管理** — 参与者添加/移除，成员头像上传
- **数据隔离** — 所有消息/会话按 `user_id` 隔离，Agent 会话不共享

### AI Agent
- **三大 Agent** — 知识问答、任务管理、代码助手
- **流式输出 (SSE)** — DeepSeek API `stream: true`，实时逐 Token 推送前端
- **上下文管理** — 滑动窗口截断，启发式 Token 估算（中文 1.3/字，英文 0.4/字符）
- **API 重试** — 3 次指数退避重试（1s/2s/4s + jitter），仅对 5xx/429/网络错误
- **可配置 Prompt** — Agent 配置从数据库加载，60s TTL 缓存，支持热更新

### 任务管理
- **Kanban 看板** — 三列（待处理/进行中/已完成），拖拽式状态管理
- **AI 拆解** — 输入需求文本，自动拆分为子任务列表
- **流式执行** — 任务执行过程实时推送输出，支持手动中止
- **优先级/指派人** — 高/中/低优先级标签，指派人字段

### 代码审查
- **AI 审查** — 多语言支持，输出评分、问题列表、改进建议
- **Diff 对比** — Monaco Editor 双栏编辑 + diff2html 差异渲染
- **代码保存** — 审查结果可持久化查询

### 一键部署
- **双模式** — 本机项目部署 + ZIP 文件上传部署
- **流水线执行** — preparing → checkout → build → deploy → complete
- **实时日志** — WebSocket 推送各阶段 stdout/stderr 日志
- **部署历史** — 历史记录查询与回放

### 设计系统
- **CSS 设计令牌** — 50+ 自定义属性（颜色/阴影/圆角/过渡）
- **Glass Morphism** — 毛玻璃半透明面板 + `backdrop-filter: blur()`
- **发光效果** — 多层 box-shadow 辉光，hover 时紫色微光边框
- **渐变背景** — 全局 `#f8fafc → #f0f4ff` 渐变，深色终端代码块
- **响应式** — Grid 双列自适应，<900px 自动回退单列

## 快速开始

### 环境要求

- Node.js >= 18
- npm >= 9

### 1. 安装依赖

```bash
# 后端
cd server
npm install

# 前端
cd ../client
npm install
```

### 2. 配置环境变量

编辑 `server/.env`：

```env
PORT=3000
JWT_SECRET=agenthub_secret_key
NODE_ENV=development
API_KEY=your_api_key_here
API_URL=https://open.bigmodel.cn/api/paas/v4/chat/completions
API_MODEL=glm-5.1
```

### 3. 启动服务

```bash
# 终端 1 — 启动后端 (端口 3000)
cd server
npm run dev        # ts-node + nodemon 热重载

# 终端 2 — 启动前端 (端口 8080)
cd client
npm run dev        # webpack-dev-server，/api 代理 → localhost:3000
```

浏览器访问 `http://localhost:8080`，注册账号后即可使用。

> **注意：** AI Agent 功能需要有效的 API Key（当前使用智谱 GLM，也支持 DeepSeek/OpenAI 兼容格式）。

## WebSocket 消息类型

| 类型 | 方向 | 说明 |
|------|------|------|
| `auth` | C → S | 绑定 userId（含 JWT 校验） |
| `subscribe` | C → S | 订阅会话 |
| `sendMessage` | C → S | 发送消息 |
| `newMessage` | S → C | 新消息广播 |
| `agentReplyStart` | S → C | Agent 开始回复 |
| `agentChunk` | S → C | 流式 Token 推送（前台显示光标闪烁） |
| `agentReplyEnd` | S → C | Agent 回复完成（持久化 DB） |
| `deployStatus` | S → C | 部署阶段状态 + 实时日志 |

## 数据库表

| 表名 | 关键字段 | 说明 |
|------|----------|------|
| `users` | id, username, email, password_hash, bio, avatar, created_at | 用户信息 |
| `conversations` | id, name, type, avatar, created_at | 会话记录 |
| `conversation_participants` | conversation_id, user_id | 会话参与者 |
| `messages` | id, conversation_id, sender_id, type, content, timestamp | 消息记录 |
| `agents` | id, name, type, config (JSON) | Agent 配置 (可自定义 system prompt) |
| `tasks` | id, title, description, status, priority, assignee, parent_id | 任务管理 |
| `code_reviews` | id, title, language, original_code, improved_code, score | 代码审查记录 |
| `deployments` | id, environment, type, branch, build_command, output_dir, status | 部署历史 |

## 设计令牌

项目使用 CSS 自定义属性统一管理视觉风格：

```css
:root {
  --accent: #6366f1;           /* 主题色 (Indigo) */
  --accent-glow: rgba(99, 102, 241, 0.25);
  --surface-glass: rgba(255, 255, 255, 0.65);  /* 毛玻璃表面 */
  --shadow-glow: 0 0 0 3px rgba(99, 102, 241, 0.25);
  --radius-md: 12px;
  --transition-smooth: 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  /* ... 50+ 令牌 */
}
```
