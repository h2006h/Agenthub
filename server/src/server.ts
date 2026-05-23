import 'dotenv/config'
import express from 'express'
import http from 'http'
import cors from 'cors'
import { initDatabase } from './database'
import { initWebSocketServer } from './websocket/server'
import { authMiddleware, unless } from './middleware/auth'
import { initCronJobs } from './cron'
import authRoutes from './routes/auth'
import conversationRoutes from './routes/conversations'
import messageRoutes from './routes/messages'
import taskRoutes from './routes/tasks'
import agentRoutes from './routes/agents'
import codeRoutes from './routes/code'
import deployRoutes from './routes/deploy'

const app = express()
const server = http.createServer(app)
const PORT = process.env.PORT || 3000

app.use(cors())
app.use(express.json({ limit: '5mb' }))

// JWT auth middleware for all /api/* routes except auth
app.use('/api', unless(['/auth', '/health'], authMiddleware))

app.use('/api/auth', authRoutes)
app.use('/api/conversations', conversationRoutes)
app.use('/api/messages', messageRoutes)
app.use('/api/tasks', taskRoutes)
app.use('/api/agents', agentRoutes)
app.use('/api/code', codeRoutes)
app.use('/api/deploy', deployRoutes)

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() })
})

const startServer = async () => {
  try {
    await initDatabase()
    const wss = initWebSocketServer(server)
    // Store wss reference for deploy route broadcasts
    ;(app as any)._wss = wss
    initCronJobs()

    server.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`)
      console.log(`WebSocket server running on ws://localhost:${PORT}`)
    })
  } catch (error) {
    console.error('Failed to start server:', error)
    process.exit(1)
  }
}

startServer()
