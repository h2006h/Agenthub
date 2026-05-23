import { WebSocketServer, WebSocket } from 'ws'
import { getDB } from '../database'
import { getAgentResponse } from '../agents'
import { callLLMStream } from '../agents/llm'
import { truncateContext } from '../agents/context'
import { verifyToken } from '../utils/jwt'

interface Client {
  ws: WebSocket
  userId?: string
  conversationIds: string[]
}

const clients: Map<string, Client> = new Map()
let clientIdCounter = 0

const isParticipant = async (conversationId: string, userId: string): Promise<boolean> => {
  const db = getDB()
  const row = await db.get(
    'SELECT 1 FROM conversation_participants WHERE conversation_id = ? AND user_id = ?',
    [conversationId, userId]
  )
  return !!row
}

const getConversationAgents = async (conversationId: string): Promise<Array<{ id: string; name: string; type: string }>> => {
  const db = getDB()
  return db.all(
    `SELECT a.id, a.name, a.type FROM agents a
     INNER JOIN conversation_agents ca ON a.id = ca.agent_id
     WHERE ca.conversation_id = ?`,
    [conversationId]
  )
}

const parseAgentMentions = (content: string, agents: Array<{ id: string; name: string; type: string }>): Array<{ id: string; name: string; type: string }> => {
  const mentionRegex = /@(\S+)/g
  const mentioned = new Set<string>()
  let match: RegExpExecArray | null
  while ((match = mentionRegex.exec(content)) !== null) {
    mentioned.add(match[1])
  }
  return agents.filter(a => mentioned.has(a.name))
}

export const initWebSocketServer = (server: any): WebSocketServer => {
  const wss = new WebSocketServer({ server })

  wss.on('connection', (ws: WebSocket) => {
    const clientId = `client_${++clientIdCounter}`

    clients.set(clientId, {
      ws,
      conversationIds: []
    })

    ws.on('message', async (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString())

        switch (message.type) {
          case 'auth':
            handleAuth(clientId, message.payload)
            break
          case 'subscribe':
            await handleSubscribe(clientId, message.payload)
            break
          case 'unsubscribe':
            handleUnsubscribe(clientId, message.payload)
            break
          case 'sendMessage':
            await handleSendMessage(clientId, message.payload)
            break
        }
      } catch (error) {
        console.error('WebSocket message error:', error)
      }
    })

    ws.on('close', () => {
      clients.delete(clientId)
    })

    ws.on('error', (error) => {
      console.error('WebSocket error:', error)
      clients.delete(clientId)
    })
  })

  console.log('WebSocket server started')
  return wss
}

const handleAuth = (clientId: string, payload: { token: string }) => {
  const client = clients.get(clientId)
  if (!client) return

  const decoded = verifyToken(payload.token)
  if (!decoded) {
    client.ws.send(JSON.stringify({
      type: 'authError',
      payload: { error: 'token无效或已过期' }
    }))
    return
  }

  client.userId = decoded.userId
  client.ws.send(JSON.stringify({
    type: 'authSuccess',
    payload: { userId: decoded.userId }
  }))
}

const handleSubscribe = async (clientId: string, payload: { conversationId: string }) => {
  const client = clients.get(clientId)
  if (!client || !client.userId) return

  // Verify user is a participant before allowing subscription
  const db = getDB()
  const conv = await db.get('SELECT type FROM conversations WHERE id = ?', [payload.conversationId])
  if (!conv) return

  if (!(await isParticipant(payload.conversationId, client.userId))) {
    client.ws.send(JSON.stringify({
      type: 'subscribeError',
      payload: { conversationId: payload.conversationId, error: '无权订阅此会话' }
    }))
    return
  }

  if (!client.conversationIds.includes(payload.conversationId)) {
    client.conversationIds.push(payload.conversationId)
  }
}

const handleUnsubscribe = (clientId: string, payload: { conversationId: string }) => {
  const client = clients.get(clientId)
  if (client) {
    client.conversationIds = client.conversationIds.filter(id => id !== payload.conversationId)
  }
}

const handleSendMessage = async (clientId: string, payload: {
  conversationId: string
  senderId: string
  senderName: string
  content: string
  type: string
}) => {
  const client = clients.get(clientId)
  if (!client || !client.userId) return

  // Prevent impersonation
  if (payload.senderId !== client.userId) {
    client.ws.send(JSON.stringify({
      type: 'sendError',
      payload: { error: '无权以他人身份发送消息' }
    }))
    return
  }

  // Verify user is a participant
  const db = getDB()
  const conv = await db.get('SELECT type FROM conversations WHERE id = ?', [payload.conversationId])
  if (!conv) return
  if (!(await isParticipant(payload.conversationId, client.userId))) {
    client.ws.send(JSON.stringify({
      type: 'sendError',
      payload: { error: '无权在此会话发送消息' }
    }))
    return
  }

  const messageId = `msg_${Date.now()}`

  await db.run(
    'INSERT INTO messages (id, conversation_id, sender_id, sender_name, content, type) VALUES (?, ?, ?, ?, ?, ?)',
    [messageId, payload.conversationId, payload.senderId, payload.senderName, payload.content, payload.type]
  )

  const row = await db.get('SELECT * FROM messages WHERE id = ?', [messageId])
  const message = {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    senderName: row.sender_name,
    content: row.content,
    type: row.type,
    timestamp: row.timestamp * 1000,
  }

  broadcastMessage(payload.conversationId, message)

  if (conv.type === 'agent') {
    // Agent conversations: auto-reply to every message
    await handleAgentReply(payload.conversationId, payload.content, payload.senderId, payload.senderName, payload.type)
  } else {
    // Single/group chats: agent only replies when @mentioned
    const agents = await getConversationAgents(payload.conversationId)
    if (agents.length > 0) {
      const mentionedAgents = parseAgentMentions(payload.content, agents)
      for (const agent of mentionedAgents) {
        const messageType = agent.type === 'task' ? 'task' : agent.type === 'code' ? 'code' : 'text'
        await handleAgentReply(payload.conversationId, payload.content, payload.senderId, payload.senderName, messageType, agent.id)
      }
    }
  }
}

const handleAgentReply = async (conversationId: string, userMessage: string, userId: string, userName: string, messageType?: string, explicitAgentId?: string) => {
  const db = getDB()

  const conversation = await db.get('SELECT type FROM conversations WHERE id = ?', [conversationId])
  if (!conversation) return

  // Determine agent ID: explicit agent overrides message-type routing
  let agentId: string
  if (explicitAgentId) {
    // Use the agent ID format from the agents table (e.g., 'agent-knowledge')
    agentId = explicitAgentId.startsWith('agent-') ? explicitAgentId.replace('agent-', '') : explicitAgentId
  } else {
    // Only agent-type conversations get auto-reply without explicit mention
    if (conversation.type !== 'agent') return
    agentId = messageType === 'task' ? 'task' :
              messageType === 'code' ? 'code' : 'knowledge'
  }

  console.log('[Agent] reply triggered:', { conversationId, agentId, messageType, userMessage: userMessage.slice(0, 50) })

  const historyMessages = await db.all(
    'SELECT sender_id, content FROM messages WHERE conversation_id = ? ORDER BY timestamp DESC LIMIT 10',
    [conversationId]
  )

  const context = historyMessages.reverse().map((m: any) => m.content)

  const knowledgeMessages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = []
  for (const c of context) {
    knowledgeMessages.push({ role: 'user' as const, content: c })
  }

  const replyId = `msg_${Date.now()}`

  // Notify clients that agent is starting to reply
  broadcast(conversationId, {
    type: 'agentReplyStart',
    payload: { messageId: replyId, conversationId, agentId }
  })

  try {
    const messageList = truncateContext([
      { role: 'system' as const, content: getSystemPrompt(agentId) },
      ...knowledgeMessages,
      { role: 'user' as const, content: userMessage }
    ])

    const fullContent = await callLLMStream(messageList,
      (chunk: string) => {
        broadcast(conversationId, {
          type: 'agentChunk',
          payload: { messageId: replyId, conversationId, content: chunk }
        })
      }
    )

    // Persist the complete message
    await db.run(
      'INSERT INTO messages (id, conversation_id, sender_id, sender_name, content, type) VALUES (?, ?, ?, ?, ?, ?)',
      [replyId, conversationId, `agent-${agentId}`, `AI助手-${agentId}`, fullContent, 'text']
    )

    broadcast(conversationId, {
      type: 'agentReplyEnd',
      payload: {
        messageId: replyId,
        conversationId,
        senderId: `agent-${agentId}`,
        senderName: `AI助手-${agentId}`,
        content: fullContent,
        type: 'text',
        timestamp: Date.now()
      }
    })
  } catch (error) {
    console.error('Agent reply error:', error)
    broadcast(conversationId, {
      type: 'agentReplyError',
      payload: { messageId: replyId, conversationId, error: 'AI服务调用失败' }
    })
  }
}

const getSystemPrompt = (agentId: string): string => {
  if (agentId === 'knowledge') {
    return `你是一个专业的知识问答助手。请根据用户的问题提供准确、详细、易理解的回答。
回答要求：
- 使用markdown格式组织内容，适当使用标题、列表、加粗
- 对于技术问题，给出具体可操作的方案或代码示例
- 回答简洁直接，避免冗长的客套话`
  }
  if (agentId === 'task') {
    return `你是一个专业的任务管理助手。请将用户的需求拆解为结构化的任务列表。
输出格式（严格的JSON数组）：
[
  {
    "title": "任务标题",
    "description": "任务描述",
    "priority": "high|medium|low",
    "dependencies": []
  }
]
拆解原则：
- 每个任务独立可交付
- 优先级合理分配
- 明确任务间的依赖关系
- 只输出JSON数组，不要包含markdown代码块标记`
  }
  return `你是一个专业的代码助手。擅长编写、审查、优化和解释代码。
回答要求：
- 代码使用markdown代码块包裹，并指定语言
- 提供完整可运行的代码，不要省略关键部分
- 审查代码时从质量、安全、性能、可读性四个方面评估
- 给出具体改进建议，而不是泛泛而谈`
}

const broadcastMessage = (conversationId: string, message: any) => {
  broadcast(conversationId, {
    type: 'newMessage',
    payload: message
  })
}

const broadcast = (conversationId: string, data: any) => {
  clients.forEach((client) => {
    if (client.conversationIds.includes(conversationId) && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(data))
    }
  })
}
