import express from 'express'
import { getDB } from '../database'
import { callLLMStream } from '../agents/llm'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const ZipArchive = require('archiver').ZipArchive

const router = express.Router()

// Track active executions for abort support
const activeExecutions = new Map<string, AbortController>()

router.get('/', async (req, res) => {
  const { status } = req.query

  try {
    const db = getDB()
    let query = 'SELECT * FROM tasks WHERE user_id = ?'
    let params: string[] = [req.userId!]

    if (status) {
      query += ' AND status = ?'
      params.push(status as string)
    }

    query += ' ORDER BY priority DESC, created_at DESC'

    const tasks = await db.all(query, params)
    res.json(tasks)
  } catch (error) {
    res.status(500).json({ error: '获取任务失败' })
  }
})

router.get('/export', async (req, res) => {
  try {
    const db = getDB()
    const tasks = await db.all(
      "SELECT * FROM tasks WHERE user_id = ? AND status = 'completed' ORDER BY updated_at DESC",
      [req.userId!]
    )

    if (tasks.length === 0) {
      return res.status(404).json({ error: '没有已完成的任务' })
    }

    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', 'attachment; filename="completed-tasks.zip"')

    const archive = new ZipArchive({ zlib: { level: 9 } })

    archive.on('error', (err: Error) => {
      console.error('Archive error:', err)
      res.status(500).end()
    })

    archive.pipe(res)

    tasks.forEach((task: any) => {
      const taskFiles = buildTaskFile(task)
      taskFiles.forEach(f => {
        archive.append(f.content, { name: f.name })
      })
    })

    const indexContent = tasks.map((t: any, i: number) => {
      const files = buildTaskFile(t)
      const names = files.filter(f => !f.name.endsWith('_README.md')).map(f => f.name).join(', ')
      return `${i + 1}. ${names} | ${t.priority} | ${t.assignee || '未分配'} | ${new Date(t.updated_at * 1000).toLocaleString()}`
    }).join('\n')

    archive.append(`已完成任务导出清单\n${'='.repeat(50)}\n\n${indexContent}`, { name: 'README.txt' })

    await archive.finalize()
  } catch (error) {
    console.error('导出任务失败:', error)
    res.status(500).json({ error: '导出失败' })
  }
})

router.get('/:id', async (req, res) => {
  const { id } = req.params

  try {
    const db = getDB()
    const task = await db.get('SELECT * FROM tasks WHERE id = ? AND user_id = ?', [id, req.userId!])

    if (!task) {
      return res.status(404).json({ error: '任务不存在' })
    }

    res.json(task)
  } catch (error) {
    res.status(500).json({ error: '获取任务失败' })
  }
})

router.post('/', async (req, res) => {
  const { title, description, status, priority, assignee, parentId } = req.body
  
  if (!title || !status || !priority) {
    return res.status(400).json({ error: '缺少必要字段' })
  }

  try {
    const db = getDB()
    const taskId = `task_${Date.now()}`
    
    await db.run(
      'INSERT INTO tasks (id, user_id, title, description, status, priority, assignee, parent_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [taskId, req.userId!, title, description || '', status, priority, assignee || '', parentId || null]
    )

    const task = await db.get('SELECT * FROM tasks WHERE id = ?', [taskId])
    res.json(task)
  } catch (error) {
    res.status(500).json({ error: '创建任务失败' })
  }
})

router.put('/:id', async (req, res) => {
  const { id } = req.params
  const { title, description, status, priority, assignee } = req.body

  try {
    const db = getDB()

    const existingTask = await db.get('SELECT * FROM tasks WHERE id = ? AND user_id = ?', [id, req.userId!])
    if (!existingTask) {
      return res.status(404).json({ error: '任务不存在' })
    }

    const updateFields: string[] = []
    const updateParams: string[] = []
    
    if (title) {
      updateFields.push('title = ?')
      updateParams.push(title)
    }
    if (description !== undefined) {
      updateFields.push('description = ?')
      updateParams.push(description)
    }
    if (status) {
      updateFields.push('status = ?')
      updateParams.push(status)
    }
    if (priority) {
      updateFields.push('priority = ?')
      updateParams.push(priority)
    }
    if (assignee !== undefined) {
      updateFields.push('assignee = ?')
      updateParams.push(assignee)
    }
    
    updateFields.push('updated_at = strftime("%s", "now")')
    updateParams.push(id)
    
    await db.run(`UPDATE tasks SET ${updateFields.join(', ')} WHERE id = ?`, updateParams)

    const task = await db.get('SELECT * FROM tasks WHERE id = ?', [id])
    res.json(task)
  } catch (error) {
    res.status(500).json({ error: '更新任务失败' })
  }
})

router.delete('/:id', async (req, res) => {
  const { id } = req.params

  try {
    const db = getDB()

    const existingTask = await db.get('SELECT * FROM tasks WHERE id = ? AND user_id = ?', [id, req.userId!])
    if (!existingTask) {
      return res.status(404).json({ error: '任务不存在' })
    }

    await db.run('DELETE FROM tasks WHERE id = ? AND user_id = ?', [id, req.userId!])
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: '删除任务失败' })
  }
})

router.post('/:id/execute', async (req, res) => {
  const { id } = req.params

  const db = getDB()
  const task = await db.get('SELECT * FROM tasks WHERE id = ? AND user_id = ?', [id, req.userId!])

  if (!task) {
    return res.status(404).json({ error: '任务不存在' })
  }

  if (task.status === 'completed') {
    return res.status(400).json({ error: '任务已完成' })
  }

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders()

  const abortController = new AbortController()
  activeExecutions.set(id, abortController)

  // Clean up if client disconnects mid-execution
  req.on('close', () => {
    if (activeExecutions.has(id)) {
      abortController.abort()
      activeExecutions.delete(id)
    }
  })

  // Mark as in_progress
  await db.run(
    "UPDATE tasks SET status = 'in_progress', updated_at = strftime('%s', 'now') WHERE id = ?",
    [id]
  )

  // Send initial event so client knows we started
  res.write(`event: start\ndata: ${JSON.stringify({ taskId: id })}\n\n`)

  const agentPrompt = `你是一个全栈开发助手。用户分配给你一个任务，请直接输出最终交付物。

任务标题: ${task.title}
任务描述: ${task.description || '无额外描述'}
优先级: ${task.priority === 'high' ? '高' : task.priority === 'medium' ? '中' : '低'}

交付要求：
- 如果是代码任务：每个文件用单独的markdown代码块包裹，代码块必须标注正确的语言标识（如\`\`\`python、\`\`\`javascript、\`\`\`html、\`\`\`css、\`\`\`typescript等），代码必须完整可运行，包含所有必要的import/依赖声明
- 如果是设计/分析任务：给出结构化方案，包含架构图（文字描述）、技术选型理由、接口设计
- 如果是文档任务：生成完整的markdown格式文档
- 如果是修复问题：给出修复后的完整代码（用代码块包裹），以及变更说明

直接输出结果，不要有"好的，我来帮你..."之类的开场白，不要包含思考过程和步骤解释。`

  const messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [
    { role: 'system', content: agentPrompt },
    { role: 'user', content: `请完成以下任务并直接给出结果：\n${task.title}\n${task.description || ''}` }
  ]

  let fullResult = ''

  try {
    fullResult = await callLLMStream(messages, (chunk: string) => {
      res.write(`event: chunk\ndata: ${JSON.stringify({ content: chunk })}\n\n`)
    }, undefined, abortController.signal)

    const resultType = detectResultType(task.title, task.description || '', fullResult)

    await db.run(
      "UPDATE tasks SET status = 'completed', result = ?, result_type = ?, updated_at = strftime('%s', 'now') WHERE id = ?",
      [fullResult, resultType, id]
    )

    res.write(`event: done\ndata: ${JSON.stringify({ taskId: id, resultType })}\n\n`)
    res.end()
  } catch (error: any) {
    if (error?.name === 'AbortError' || error?.code === 'ERR_CANCELED') {
      await db.run(
        "UPDATE tasks SET status = 'pending', result = ?, updated_at = strftime('%s', 'now') WHERE id = ?",
        [fullResult || '执行已中止', id]
      )
      res.write(`event: aborted\ndata: ${JSON.stringify({ taskId: id })}\n\n`)
    } else {
      const errMsg = error?.message || error?.toString() || '未知错误'
      console.error('执行任务失败:', errMsg)
      await db.run(
        "UPDATE tasks SET status = 'pending', updated_at = strftime('%s', 'now') WHERE id = ?",
        [id]
      )
      res.write(`event: error\ndata: ${JSON.stringify({ error: errMsg })}\n\n`)
    }
    res.end()
  } finally {
    activeExecutions.delete(id)
  }
})

router.post('/:id/stop', async (req, res) => {
  const { id } = req.params

  // Verify task belongs to user
  const db = getDB()
  const task = await db.get('SELECT * FROM tasks WHERE id = ? AND user_id = ?', [id, req.userId!])
  if (!task) {
    return res.status(404).json({ error: '任务不存在' })
  }

  const controller = activeExecutions.get(id)
  if (controller) {
    controller.abort()
    activeExecutions.delete(id)
    res.json({ success: true })
  } else {
    res.status(404).json({ error: '没有正在执行的任务' })
  }
})

const detectResultType = (title: string, description: string, result: string): string => {
  const combined = (title + description).toLowerCase()
  if (combined.includes('代码') || combined.includes('code') || combined.includes('函数') || combined.includes('bug') || combined.includes('修复')) return 'code'
  if (combined.includes('文档') || combined.includes('说明') || combined.includes('报告')) return 'document'
  if (combined.includes('设计') || combined.includes('架构') || combined.includes('方案')) return 'design'
  if (combined.includes('测试') || combined.includes('test')) return 'test'
  if (result.includes('```') || result.includes('function') || result.includes('import') || result.includes('class ')) return 'code'
  return 'text'
}

const sanitizeFilename = (name: string): string => {
  return name.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, '_').slice(0, 50) || 'task'
}

const getCodeExt = (lang: string): string => {
  const map: Record<string, string> = {
    python: '.py', py: '.py',
    javascript: '.js', js: '.js', jsx: '.jsx',
    typescript: '.ts', ts: '.ts', tsx: '.tsx',
    java: '.java',
    cpp: '.cpp', 'c++': '.cpp', c: '.c',
    html: '.html', htm: '.html',
    css: '.css', scss: '.scss', less: '.less',
    sql: '.sql',
    json: '.json', yaml: '.yml', yml: '.yml', xml: '.xml',
    go: '.go', rust: '.rs', php: '.php', ruby: '.rb', swift: '.swift',
    kotlin: '.kt', dart: '.dart', r: '.r', sh: '.sh', bash: '.sh',
    vue: '.vue', svelte: '.svelte',
    markdown: '.md', md: '.md', dockerfile: '', graphql: '.graphql',
  }
  return map[lang.toLowerCase()] || '.txt'
}

const extractCodeBlocks = (text: string): Array<{ lang: string; code: string }> => {
  const blocks: Array<{ lang: string; code: string }> = []
  const regex = /```(\w*)\n([\s\S]*?)```/g
  let match
  while ((match = regex.exec(text)) !== null) {
    const lang = match[1]?.trim() || ''
    const code = match[2].trim()
    if (code) blocks.push({ lang, code })
  }
  return blocks
}

const buildTaskFile = (task: any): Array<{ name: string; content: string }> => {
  const result = task.result || ''
  const codeBlocks = extractCodeBlocks(result)
  const files: Array<{ name: string; content: string }> = []
  const safeName = sanitizeFilename(task.title)

  if (task.result_type === 'code' && codeBlocks.length > 0) {
    // Produce one clean code file per code block
    codeBlocks.forEach((block, i) => {
      const ext = getCodeExt(block.lang)
      const filename = codeBlocks.length === 1
        ? `${safeName}${ext}`
        : `${safeName}_${i + 1}${ext}`
      files.push({ name: filename, content: block.code })
    })

    // Add a README with task context
    const readme = [
      `# ${task.title}`,
      '',
      task.description || '无描述',
      '',
      `优先级: ${task.priority === 'high' ? '高' : task.priority === 'medium' ? '中' : '低'}`,
      `负责人: ${task.assignee || '未分配'}`,
      `完成时间: ${new Date(task.updated_at * 1000).toLocaleString()}`,
    ].join('\n')
    files.push({ name: `${safeName}_README.md`, content: readme })
  } else if (codeBlocks.length > 0) {
    // Non-code task but has code blocks — save as markdown
    files.push({ name: `${safeName}.md`, content: result })
  } else {
    // Plain text result
    files.push({ name: `${safeName}.txt`, content: result })
  }

  return files
}

export default router
