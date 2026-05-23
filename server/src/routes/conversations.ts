import express from 'express'
import { getDB } from '../database'

const router = express.Router()

const isParticipant = async (conversationId: string, userId: string): Promise<boolean> => {
  const db = getDB()
  const row = await db.get(
    'SELECT 1 FROM conversation_participants WHERE conversation_id = ? AND user_id = ?',
    [conversationId, userId]
  )
  return !!row
}

router.get('/', async (req, res) => {
  try {
    const db = getDB()
    const conversations = await db.all(
      `SELECT DISTINCT c.* FROM conversations c
       LEFT JOIN conversation_participants cp ON c.id = cp.conversation_id
       WHERE cp.user_id = ?
       ORDER BY c.created_at DESC`,
      [req.userId]
    )

    // For single chats, resolve name/avatar from the other participant
    const enriched = await Promise.all(conversations.map(async (conv: any) => {
      if (conv.type === 'single') {
        const other = await db.get(
          `SELECT u.username, u.avatar FROM users u
           INNER JOIN conversation_participants cp ON u.id = cp.user_id
           WHERE cp.conversation_id = ? AND cp.user_id != ?`,
          [conv.id, req.userId]
        )
        if (other) {
          return { ...conv, name: other.username, avatar: other.avatar || null }
        }
      }
      return conv
    }))

    res.json(enriched)
  } catch (error) {
    res.status(500).json({ error: '获取会话失败' })
  }
})

router.get('/:id', async (req, res) => {
  const { id } = req.params

  try {
    const db = getDB()
    const conversation = await db.get('SELECT * FROM conversations WHERE id = ?', [id])

    if (!conversation) {
      return res.status(404).json({ error: '会话不存在' })
    }

    if (!(await isParticipant(id, req.userId!))) {
      return res.status(403).json({ error: '无权访问此会话' })
    }

    const participants = await db.all(
      'SELECT user_id FROM conversation_participants WHERE conversation_id = ?',
      [id]
    )

    const agents = await db.all(
      'SELECT agent_id FROM conversation_agents WHERE conversation_id = ?',
      [id]
    )

    let name = conversation.name
    let avatar = conversation.avatar

    // For single chats, resolve name/avatar from the other participant
    if (conversation.type === 'single') {
      const other = await db.get(
        `SELECT u.username, u.avatar FROM users u
         INNER JOIN conversation_participants cp ON u.id = cp.user_id
         WHERE cp.conversation_id = ? AND cp.user_id != ?`,
        [id, req.userId]
      )
      if (other) {
        name = other.username
        avatar = other.avatar || null
      }
    }

    res.json({
      ...conversation,
      name,
      avatar,
      participants: participants.map(p => p.user_id),
      agentParticipants: agents.map(a => a.agent_id)
    })
  } catch (error) {
    res.status(500).json({ error: '获取会话失败' })
  }
})

router.post('/', async (req, res) => {
  const { name, type, participants, agentIds, avatar } = req.body

  if (!name || !type) {
    return res.status(400).json({ error: '缺少必要字段' })
  }

  try {
    const db = getDB()
    const conversationId = `conv_${Date.now()}`

    await db.run(
      'INSERT INTO conversations (id, name, type, avatar) VALUES (?, ?, ?, ?)',
      [conversationId, name, type, avatar || null]
    )

    // Always add creator as participant
    await db.run(
      'INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)',
      [conversationId, req.userId!]
    )

    if (participants && Array.isArray(participants)) {
      for (const participantId of participants) {
        if (participantId !== req.userId) {
          await db.run(
            'INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)',
            [conversationId, participantId]
          )
        }
      }
    }

    // Optionally add agent participants (for single/group chats)
    if (agentIds && Array.isArray(agentIds)) {
      for (const agentId of agentIds) {
        try {
          await db.run(
            'INSERT INTO conversation_agents (conversation_id, agent_id) VALUES (?, ?)',
            [conversationId, agentId]
          )
        } catch {
          // Skip duplicates
        }
      }
    }

    const conversation = await db.get('SELECT * FROM conversations WHERE id = ?', [conversationId])
    res.json(conversation)
  } catch (error: any) {
    console.error('Create conversation error:', error.message)
    res.status(500).json({ error: '创建会话失败' })
  }
})

router.put('/:id', async (req, res) => {
  const { id } = req.params
  const { name } = req.body

  if (!name || !name.trim()) {
    return res.status(400).json({ error: '名称不能为空' })
  }

  try {
    const db = getDB()

    if (!(await isParticipant(id, req.userId!))) {
      return res.status(403).json({ error: '无权修改此会话' })
    }

    const conv = await db.get('SELECT type FROM conversations WHERE id = ?', [id])
    if (!conv) {
      return res.status(404).json({ error: '会话不存在' })
    }
    if (conv.type === 'single') {
      return res.status(400).json({ error: '单聊名称由系统自动生成，无法手动修改' })
    }

    await db.run('UPDATE conversations SET name = ? WHERE id = ?', [name.trim(), id])
    const conversation = await db.get('SELECT * FROM conversations WHERE id = ?', [id])
    res.json(conversation)
  } catch (error) {
    res.status(500).json({ error: '更新会话失败' })
  }
})

router.put('/:id/avatar', async (req, res) => {
  const { id } = req.params
  const { avatar } = req.body

  try {
    const db = getDB()

    if (!(await isParticipant(id, req.userId!))) {
      return res.status(403).json({ error: '无权修改此会话' })
    }

    const result = await db.run(
      'UPDATE conversations SET avatar = ? WHERE id = ?',
      [avatar, id]
    )

    if (result.changes === 0) {
      return res.status(404).json({ error: '会话不存在' })
    }

    const conversation = await db.get('SELECT * FROM conversations WHERE id = ?', [id])
    res.json(conversation)
  } catch (error) {
    res.status(500).json({ error: '更新头像失败' })
  }
})

// Participant management
router.get('/:id/participants', async (req, res) => {
  const { id } = req.params
  try {
    const db = getDB()

    if (!(await isParticipant(id, req.userId!))) {
      return res.status(403).json({ error: '无权查看此会话的成员' })
    }

    const participants = await db.all(
      `SELECT u.id, u.username, u.email FROM users u
       INNER JOIN conversation_participants cp ON u.id = cp.user_id
       WHERE cp.conversation_id = ?`,
      [id]
    )

    const agents = await db.all(
      `SELECT a.id, a.name, a.type, a.description FROM agents a
       INNER JOIN conversation_agents ca ON a.id = ca.agent_id
       WHERE ca.conversation_id = ?`,
      [id]
    )

    res.json({ participants, agents })
  } catch (error) {
    res.status(500).json({ error: '获取参与者失败' })
  }
})

router.post('/:id/participants', async (req, res) => {
  const { id } = req.params
  const { userIds } = req.body

  if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
    return res.status(400).json({ error: '缺少必要字段' })
  }

  try {
    const db = getDB()

    if (!(await isParticipant(id, req.userId!))) {
      return res.status(403).json({ error: '无权管理此会话的成员' })
    }

    for (const userId of userIds) {
      try {
        await db.run(
          'INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)',
          [id, userId]
        )
      } catch {
        // Skip duplicates
      }
    }
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: '添加参与者失败' })
  }
})

router.delete('/:id/participants/:userId', async (req, res) => {
  const { id, userId } = req.params

  try {
    const db = getDB()

    if (!(await isParticipant(id, req.userId!))) {
      return res.status(403).json({ error: '无权管理此会话的成员' })
    }

    await db.run(
      'DELETE FROM conversation_participants WHERE conversation_id = ? AND user_id = ?',
      [id, userId]
    )
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: '移除参与者失败' })
  }
})

// Agent participant management
router.get('/:id/agents', async (req, res) => {
  const { id } = req.params
  try {
    const db = getDB()

    if (!(await isParticipant(id, req.userId!))) {
      return res.status(403).json({ error: '无权查看此会话的Agent' })
    }

    const agents = await db.all(
      `SELECT a.id, a.name, a.type, a.description FROM agents a
       INNER JOIN conversation_agents ca ON a.id = ca.agent_id
       WHERE ca.conversation_id = ?`,
      [id]
    )
    res.json(agents)
  } catch (error) {
    res.status(500).json({ error: '获取Agent失败' })
  }
})

router.post('/:id/agents', async (req, res) => {
  const { id } = req.params
  const { agentId } = req.body

  if (!agentId) {
    return res.status(400).json({ error: '缺少agentId' })
  }

  try {
    const db = getDB()

    if (!(await isParticipant(id, req.userId!))) {
      return res.status(403).json({ error: '无权管理此会话的Agent' })
    }

    await db.run(
      'INSERT OR IGNORE INTO conversation_agents (conversation_id, agent_id) VALUES (?, ?)',
      [id, agentId]
    )
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: '添加Agent失败' })
  }
})

router.delete('/:id/agents/:agentId', async (req, res) => {
  const { id, agentId } = req.params

  try {
    const db = getDB()

    if (!(await isParticipant(id, req.userId!))) {
      return res.status(403).json({ error: '无权管理此会话的Agent' })
    }

    await db.run(
      'DELETE FROM conversation_agents WHERE conversation_id = ? AND agent_id = ?',
      [id, agentId]
    )
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: '移除Agent失败' })
  }
})

export default router
