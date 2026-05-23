import express from 'express'
import { getDB } from '../database'
import { getAgentResponse, getAgentName } from '../agents'

const router = express.Router()

router.get('/', async (req, res) => {
  try {
    const db = getDB()
    const agents = await db.all('SELECT * FROM agents')
    res.json(agents)
  } catch (error) {
    res.status(500).json({ error: '获取Agent失败' })
  }
})

router.get('/:id', async (req, res) => {
  const { id } = req.params
  
  try {
    const db = getDB()
    const agent = await db.get('SELECT * FROM agents WHERE id = ?', [id])
    
    if (!agent) {
      return res.status(404).json({ error: 'Agent不存在' })
    }
    
    res.json(agent)
  } catch (error) {
    res.status(500).json({ error: '获取Agent失败' })
  }
})

router.post('/chat', async (req, res) => {
  const { agentId, message, context } = req.body

  if (!agentId || !message) {
    return res.status(400).json({ error: '缺少必要字段' })
  }

  try {
    const db = getDB()
    // Support both 'task' and 'agent-task' formats
    const lookupId = agentId.startsWith('agent-') ? agentId : `agent-${agentId}`
    const agent = await db.get('SELECT * FROM agents WHERE id = ?', [lookupId])
    
    if (!agent) {
      return res.status(404).json({ error: 'Agent不存在' })
    }

    const response = await getAgentResponse(agentId, message, context || [])
    
    res.json({ 
      response: response.response, 
      agentId: response.agentId, 
      agentName: response.agentName 
    })
  } catch (error) {
    console.error('Agent call error:', error)
    res.status(500).json({ error: '调用Agent失败' })
  }
})

export default router
