import express from 'express'
import { getDB } from '../database'

const router = express.Router()
const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200

const isParticipant = async (conversationId: string, userId: string): Promise<boolean> => {
  const db = getDB()
  const row = await db.get(
    'SELECT 1 FROM conversation_participants WHERE conversation_id = ? AND user_id = ?',
    [conversationId, userId]
  )
  return !!row
}

const toCamelCase = (row: any) => ({
  id: row.id,
  conversationId: row.conversation_id,
  senderId: row.sender_id,
  senderName: row.sender_name,
  content: row.content,
  type: row.type,
  timestamp: row.timestamp * 1000,
})

router.get('/:conversationId', async (req, res) => {
  const { conversationId } = req.params
  const limit = Math.min(parseInt(req.query.limit as string) || DEFAULT_LIMIT, MAX_LIMIT)
  const offset = parseInt(req.query.offset as string) || 0

  try {
    const db = getDB()

    // Verify user is a participant
    const conv = await db.get('SELECT type FROM conversations WHERE id = ?', [conversationId])
    if (!conv) {
      return res.status(404).json({ error: '会话不存在' })
    }
    if (!(await isParticipant(conversationId, req.userId!))) {
      return res.status(403).json({ error: '无权访问此会话的消息' })
    }

    const total = await db.get(
      'SELECT COUNT(*) as count FROM messages WHERE conversation_id = ?',
      [conversationId]
    )

    const rows = await db.all(
      'SELECT * FROM messages WHERE conversation_id = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?',
      [conversationId, limit, offset]
    )

    // Return in chronological order for the client
    rows.reverse()

    const messages = rows.map(toCamelCase)

    const hasMore = offset + limit < total.count

    res.json({ messages, total: total.count, hasMore })
  } catch (error) {
    res.status(500).json({ error: '获取消息失败' })
  }
})

router.post('/', async (req, res) => {
  const { conversationId, senderId, senderName, content, type } = req.body

  if (!conversationId || !senderId || !senderName || !content) {
    return res.status(400).json({ error: '缺少必要字段' })
  }

  if (senderId !== req.userId) {
    return res.status(403).json({ error: '无权以他人身份发送消息' })
  }

  // Verify user is a participant
  const conv = await getDB().get('SELECT type FROM conversations WHERE id = ?', [conversationId])
  if (!conv) {
    return res.status(404).json({ error: '会话不存在' })
  }
  if (!(await isParticipant(conversationId, req.userId!))) {
    return res.status(403).json({ error: '无权在此会话发送消息' })
  }

  try {
    const db = getDB()
    const messageId = `msg_${Date.now()}`

    await db.run(
      'INSERT INTO messages (id, conversation_id, sender_id, sender_name, content, type) VALUES (?, ?, ?, ?, ?, ?)',
      [messageId, conversationId, senderId, senderName, content, type || 'text']
    )

    const row = await db.get('SELECT * FROM messages WHERE id = ?', [messageId])
    res.json(toCamelCase(row))
  } catch (error) {
    res.status(500).json({ error: '发送消息失败' })
  }
})

router.delete('/:conversationId', async (req, res) => {
  const { conversationId } = req.params

  try {
    const db = getDB()

    // Verify user is a participant
    const conv = await db.get('SELECT type FROM conversations WHERE id = ?', [conversationId])
    if (!conv) {
      return res.status(404).json({ error: '会话不存在' })
    }
    if (!(await isParticipant(conversationId, req.userId!))) {
      return res.status(403).json({ error: '无权清空此会话的消息' })
    }

    await db.run('DELETE FROM messages WHERE conversation_id = ?', [conversationId])
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: '清空消息失败' })
  }
})

export default router
