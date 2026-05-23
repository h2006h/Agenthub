import express from 'express'
import { getDB } from '../database'
import { generateToken, verifyToken } from '../utils/jwt'

const router = express.Router()

router.post('/register', async (req, res) => {
  const { username, password } = req.body

  if (!username || !password) {
    return res.status(400).json({ error: '缺少必要字段' })
  }

  const db = getDB()

  try {
    const existingUser = await db.get('SELECT * FROM users WHERE username = ?', [username])
    if (existingUser) {
      return res.status(400).json({ error: '用户已存在' })
    }

    const userId = `user_${Date.now()}`
    const email = `${username}@agenthub.local`
    await db.run('INSERT INTO users (id, username, email, password) VALUES (?, ?, ?, ?)', [
      userId, username, email, password
    ])

    const token = generateToken(userId)
    res.json({ token, userId, username })
  } catch (error: any) {
    console.error('Register error:', error.message)
    res.status(500).json({ error: '注册失败' })
  }
})

router.post('/login', async (req, res) => {
  const { username, password } = req.body

  if (!username || !password) {
    return res.status(400).json({ error: '缺少必要字段' })
  }

  const db = getDB()

  try {
    const user = await db.get('SELECT * FROM users WHERE username = ? AND password = ?', [username, password])
    if (!user) {
      return res.status(401).json({ error: '用户名或密码错误' })
    }

    const token = generateToken(user.id)
    res.json({ token, userId: user.id, username: user.username })
  } catch (error: any) {
    console.error('Login error:', error.message)
    res.status(500).json({ error: '登录失败' })
  }
})

router.get('/verify', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1]

  if (!token) {
    return res.status(401).json({ error: '未授权' })
  }

  const decoded = verifyToken(token)
  if (!decoded) {
    return res.status(401).json({ error: 'token无效' })
  }

  const db = getDB()
  const user = await db.get('SELECT id, username, email, avatar FROM users WHERE id = ?', [decoded.userId])

  if (!user) {
    return res.status(401).json({ error: '用户不存在' })
  }

  res.json({ userId: user.id, username: user.username, email: user.email, avatar: user.avatar || '' })
})

const getUserId = (req: express.Request): string | null => {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) return null
  const decoded = verifyToken(token)
  return decoded?.userId || null
}

router.get('/profile', async (req, res) => {
  const userId = getUserId(req)
  if (!userId) return res.status(401).json({ error: '未授权' })

  const db = getDB()
  const user = await db.get('SELECT id, username, bio, avatar, created_at FROM users WHERE id = ?', [userId])
  if (!user) return res.status(404).json({ error: '用户不存在' })

  res.json({
    id: user.id,
    username: user.username,
    bio: user.bio || '',
    avatar: user.avatar || '',
    createdAt: user.created_at * 1000
  })
})

router.put('/profile', async (req, res) => {
  const userId = getUserId(req)
  if (!userId) return res.status(401).json({ error: '未授权' })

  const { username, bio, avatar } = req.body
  if (!username && bio === undefined && avatar === undefined) {
    return res.status(400).json({ error: '至少需要修改一项' })
  }

  const db = getDB()
  try {
    if (username) {
      const existing = await db.get('SELECT id FROM users WHERE username = ? AND id != ?', [username, userId])
      if (existing) return res.status(400).json({ error: '用户名已被占用' })
      await db.run('UPDATE users SET username = ?, updated_at = strftime(\'%s\', \'now\') WHERE id = ?', [username, userId])
    }
    if (bio !== undefined) {
      await db.run('UPDATE users SET bio = ?, updated_at = strftime(\'%s\', \'now\') WHERE id = ?', [bio, userId])
    }
    if (avatar !== undefined) {
      await db.run('UPDATE users SET avatar = ?, updated_at = strftime(\'%s\', \'now\') WHERE id = ?', [avatar, userId])
    }

    const user = await db.get('SELECT id, username, bio, avatar, created_at FROM users WHERE id = ?', [userId])
    res.json({ id: user.id, username: user.username, bio: user.bio || '', avatar: user.avatar || '', createdAt: user.created_at * 1000 })
  } catch (error: any) {
    res.status(500).json({ error: '更新失败' })
  }
})

router.put('/password', async (req, res) => {
  const userId = getUserId(req)
  if (!userId) return res.status(401).json({ error: '未授权' })

  const { oldPassword, newPassword } = req.body
  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: '缺少必要字段' })
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: '新密码至少6位' })
  }

  const db = getDB()
  try {
    const user = await db.get('SELECT password FROM users WHERE id = ?', [userId])
    if (!user || user.password !== oldPassword) {
      return res.status(400).json({ error: '原密码错误' })
    }

    await db.run('UPDATE users SET password = ?, updated_at = strftime(\'%s\', \'now\') WHERE id = ?', [newPassword, userId])
    res.json({ success: true, message: '密码修改成功' })
  } catch (error: any) {
    res.status(500).json({ error: '修改密码失败' })
  }
})

// User search for single/group chat creation
router.get('/users/search', async (req, res) => {
  const userId = getUserId(req)
  if (!userId) return res.status(401).json({ error: '未授权' })

  const { q } = req.query
  const db = getDB()

  try {
    let query: string
    let params: string[]

    if (q) {
      query = "SELECT id, username FROM users WHERE username LIKE ? AND id != ? LIMIT 20"
      params = [`%${q}%`, userId]
    } else {
      query = "SELECT id, username FROM users WHERE id != ? LIMIT 20"
      params = [userId]
    }

    const users = await db.all(query, params)
    res.json(users)
  } catch (error) {
    res.status(500).json({ error: '搜索用户失败' })
  }
})

export default router
