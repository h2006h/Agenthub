import express from 'express'
import { getDB } from '../database'
import { callLLM } from '../agents/llm'

const router = express.Router()

router.get('/diff/:id', async (req, res) => {
  const { id } = req.params

  try {
    const db = getDB()
    const diff = await db.get('SELECT * FROM code_reviews WHERE id = ? AND user_id = ?', [id, req.userId!])

    if (!diff) {
      return res.status(404).json({ error: 'Diff记录不存在' })
    }

    res.json(diff)
  } catch (error) {
    res.status(500).json({ error: '获取Diff失败' })
  }
})

router.post('/diff', async (req, res) => {
  const { fileName, oldContent, newContent, diffResult, commitId } = req.body
  
  if (!fileName || !diffResult) {
    return res.status(400).json({ error: '缺少必要字段' })
  }

  try {
    const db = getDB()
    const diffId = `diff_${Date.now()}`
    
    await db.run(
      'INSERT INTO code_reviews (id, user_id, file_name, old_content, new_content, diff_result, commit_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [diffId, req.userId!, fileName, oldContent || '', newContent || '', diffResult, commitId || '']
    )

    const diff = await db.get('SELECT * FROM code_reviews WHERE id = ?', [diffId])
    res.json(diff)
  } catch (error) {
    res.status(500).json({ error: '创建Diff记录失败' })
  }
})

router.get('/diff/list', async (req, res) => {
  try {
    const db = getDB()
    const diffs = await db.all('SELECT * FROM code_reviews WHERE user_id = ? ORDER BY created_at DESC', [req.userId!])
    res.json(diffs)
  } catch (error) {
    res.status(500).json({ error: '获取Diff列表失败' })
  }
})

router.post('/apply/:id', async (req, res) => {
  const { id } = req.params

  try {
    const db = getDB()
    const diff = await db.get('SELECT * FROM code_reviews WHERE id = ? AND user_id = ?', [id, req.userId!])

    if (!diff) {
      return res.status(404).json({ error: 'Diff记录不存在' })
    }

    await db.run('UPDATE code_reviews SET applied = 1 WHERE id = ? AND user_id = ?', [id, req.userId!])
    
    res.json({ success: true, message: '变更已应用' })
  } catch (error) {
    res.status(500).json({ error: '应用变更失败' })
  }
})

router.post('/review', async (req, res) => {
  const { code, language, title } = req.body

  if (!code) {
    return res.status(400).json({ error: '缺少代码内容' })
  }

  const systemPrompt = `你是一个资深代码审查专家。请从以下四个维度审查用户提交的代码：

1. **代码质量** (0-10分)：命名规范、代码结构、可读性、注释
2. **安全性** (0-10分)：注入风险、敏感信息泄露、权限控制、输入验证
3. **性能** (0-10分)：算法复杂度、内存使用、IO效率、缓存策略
4. **可维护性** (0-10分)：模块化程度、错误处理、测试覆盖、扩展性

输出格式（严格JSON）：
{
  "summary": "总体评价（一句话）",
  "scores": { "quality": 8, "security": 7, "performance": 6, "maintainability": 8 },
  "issues": [
    { "severity": "high|medium|low", "category": "quality|security|performance|maintainability", "line": 42, "title": "问题标题", "description": "问题描述", "suggestion": "修改建议" }
  ],
  "strengths": ["优点1", "优点2"],
  "improvedCode": "改进后的完整代码（如果有必要修改的话，否则为空）"
}

只输出JSON，不要包含markdown代码块标记。`

  const userPrompt = `请审查以下${language || '代码'}:\n\n${title ? '标题: ' + title + '\n\n' : ''}\`\`\`${language || ''}\n${code}\n\`\`\``

  try {
    const messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]

    const response = await callLLM(messages)
    let result

    try {
      // Extract JSON from response (may be wrapped in ```json)
      const json = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      result = JSON.parse(json)
    } catch {
      result = {
        summary: 'AI审查结果解析失败',
        scores: { quality: 0, security: 0, performance: 0, maintainability: 0 },
        issues: [],
        strengths: ['审查失败，请重试'],
        improvedCode: '',
        rawResponse: response
      }
    }

    // Save to DB
    const db = getDB()
    const reviewId = `review_${Date.now()}`
    await db.run(
      `INSERT INTO code_reviews (id, user_id, file_name, old_content, new_content, diff_result, commit_id)
       VALUES (?, ?, ?, ?, '', ?, '')`,
      [reviewId, req.userId!, title || `review_${language || 'code'}`, code, JSON.stringify(result)]
    )

    res.json({ id: reviewId, ...result })
  } catch (error) {
    console.error('代码审查失败:', error)
    res.status(500).json({ error: '代码审查失败，请稍后重试' })
  }
})

export default router
