import express from 'express'
import { getDB } from '../database'
import { spawn } from 'child_process'
import { existsSync, mkdirSync, copyFileSync, readdirSync, rmSync, statSync } from 'fs'
import { join, dirname } from 'path'
import multer from 'multer'
import AdmZip from 'adm-zip'

const router = express.Router()

const uploadDir = join(process.cwd(), 'uploads')
if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true })

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ts = Date.now()
    cb(null, `${ts}_${file.originalname}`)
  }
})
const upload = multer({ storage, limits: { fileSize: 100 * 1024 * 1024 } })

router.get('/', async (req, res) => {
  try {
    const db = getDB()
    const deployments = await db.all('SELECT * FROM deployments WHERE user_id = ? ORDER BY created_at DESC', [req.userId!])
    res.json(deployments)
  } catch (error) {
    res.status(500).json({ error: '获取部署记录失败' })
  }
})

router.get('/:id', async (req, res) => {
  const { id } = req.params
  try {
    const db = getDB()
    const deployment = await db.get('SELECT * FROM deployments WHERE id = ? AND user_id = ?', [id, req.userId!])
    if (!deployment) {
      return res.status(404).json({ error: '部署记录不存在' })
    }
    res.json(deployment)
  } catch (error) {
    res.status(500).json({ error: '获取部署记录失败' })
  }
})

router.post('/', async (req, res) => {
  const { environment, version, type, branch, buildCommand, outputDir, projectDir } = req.body
  if (!environment) {
    return res.status(400).json({ error: '缺少必要字段' })
  }

  try {
    const db = getDB()
    const deploymentId = `deploy_${Date.now()}`
    const versionStr = version || '1.0.0'
    const branchStr = branch || 'main'
    const buildCmd = buildCommand || 'npm run build'
    const deployType = type || 'full'
    const outputDirStr = outputDir || './dist'
    const projectDirStr = projectDir || process.cwd()

    if (!existsSync(projectDirStr)) {
      return res.status(400).json({ error: `项目目录不存在: ${projectDirStr}` })
    }

    await db.run(
      'INSERT INTO deployments (id, user_id, environment, version, deploy_type, branch, build_command, output_dir, status, log) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [deploymentId, req.userId!, environment, versionStr, deployType, branchStr, buildCmd, outputDirStr, 'running', '初始化部署...']
    )

    const deployment = await db.get('SELECT * FROM deployments WHERE id = ?', [deploymentId])
    res.json(deployment)

    // Run pipeline asynchronously
    runDeployPipeline({
      deploymentId, environment, version: versionStr,
      branch: branchStr, buildCommand: buildCmd, outputDir: outputDirStr, app: req.app,
      projectDir: projectDirStr
    })
  } catch (error) {
    res.status(500).json({ error: '创建部署记录失败' })
  }
})

router.post('/upload', upload.single('file'), async (req, res) => {
  const { environment, version, type, buildCommand, outputDir } = req.body

  if (!req.file) {
    return res.status(400).json({ error: '请上传部署文件' })
  }
  if (!environment) {
    return res.status(400).json({ error: '缺少必要字段' })
  }

  try {
    const db = getDB()
    const deploymentId = `deploy_${Date.now()}`
    const versionStr = version || '1.0.0'
    const buildCmd = buildCommand || 'npm run build'
    const deployType = type || 'full'
    const outputDirStr = outputDir || './dist'
    const uploadedFile = req.file.filename

    // Extract zip to temp directory
    const extractDir = join(process.cwd(), 'temp', deploymentId)
    const zip = new AdmZip(req.file.path)
    zip.extractAllTo(extractDir, true)

    // Handle nested single-folder case (common when zipping a project folder)
    let projectDir = extractDir
    const entries = readdirSync(extractDir)
    if (entries.length === 1) {
      const single = join(extractDir, entries[0])
      if (existsSync(single) && statSync(single).isDirectory()) {
        projectDir = single
      }
    }

    await db.run(
      'INSERT INTO deployments (id, user_id, environment, version, deploy_type, branch, build_command, output_dir, status, log) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [deploymentId, req.userId!, environment, versionStr, deployType, uploadedFile, buildCmd, outputDirStr, 'running', '解压上传文件...']
    )

    const deployment = await db.get('SELECT * FROM deployments WHERE id = ?', [deploymentId])
    res.json(deployment)

    // Run pipeline on extracted files (no git steps for uploads)
    runDeployPipeline({
      deploymentId, environment, version: versionStr,
      branch: '', buildCommand: buildCmd, outputDir: outputDirStr, app: req.app,
      projectDir,
      skipGit: true,
      onComplete: () => {
        // Cleanup temp files
        try { rmSync(extractDir, { recursive: true, force: true }) } catch {}
        try { rmSync(req.file!.path) } catch {}
      }
    })
  } catch (error: any) {
    res.status(500).json({ error: '创建部署记录失败: ' + error.message })
  }
})

router.put('/:id/status', async (req, res) => {
  const { id } = req.params
  const { status, log } = req.body
  try {
    const db = getDB()
    const existing = await db.get('SELECT * FROM deployments WHERE id = ? AND user_id = ?', [id, req.userId!])
    if (!existing) {
      return res.status(404).json({ error: '部署记录不存在' })
    }
    await db.run(
      'UPDATE deployments SET status = ?, log = ? WHERE id = ? AND user_id = ?',
      [status, log || existing.log, id, req.userId!]
    )
    const deployment = await db.get('SELECT * FROM deployments WHERE id = ?', [id])
    res.json(deployment)
  } catch (error) {
    res.status(500).json({ error: '更新部署状态失败' })
  }
})

const broadcastDeployStatus = (app: any, deploymentId: string, phase: string, status: string, log: string) => {
  if (app._wss) {
    app._wss.clients.forEach((ws: any) => {
      if (ws.readyState === 1) {
        ws.send(JSON.stringify({
          type: 'deployStatus',
          payload: { deploymentId, phase, status, log, timestamp: Date.now() }
        }))
      }
    })
  }
}

const execStep = (cmd: string, args: string[], cwd: string, onData: (line: string) => void): Promise<void> => {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, shell: true })
    child.stdout.on('data', (data: Buffer) => {
      data.toString().split('\n').filter(Boolean).forEach(onData)
    })
    child.stderr.on('data', (data: Buffer) => {
      data.toString().split('\n').filter(Boolean).forEach(onData)
    })
    child.on('close', (code: number) => {
      code === 0 ? resolve() : reject(new Error(`${cmd} 退出码: ${code}`))
    })
    child.on('error', (err: Error) => reject(err))
  })
}

const copyDirRecursive = (src: string, dest: string) => {
  if (!existsSync(dest)) mkdirSync(dest, { recursive: true })
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const srcPath = join(src, entry.name)
    const destPath = join(dest, entry.name)
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath)
    } else {
      mkdirSync(dirname(destPath), { recursive: true })
      copyFileSync(srcPath, destPath)
    }
  }
}

interface PipelineOptions {
  deploymentId: string
  environment: string
  version: string
  branch: string
  buildCommand: string
  outputDir: string
  app: any
  projectDir?: string
  skipGit?: boolean
  onComplete?: () => void
}

const runDeployPipeline = async (opts: PipelineOptions) => {
  const { deploymentId, environment, version, branch, buildCommand, outputDir, app, skipGit, onComplete } = opts
  const db = getDB()
  const projectDir = opts.projectDir || process.cwd()
  const broadcast = (phase: string, status: string, log: string) =>
    broadcastDeployStatus(app, deploymentId, phase, status, log)

  try {
    // Step 1: Prepare
    broadcast('preparing', 'running', `准备部署环境... 项目目录: ${projectDir}`)
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true })
      broadcast('preparing', 'running', `创建输出目录: ${outputDir}`)
    }

    // Step 2: Git checkout (skip for uploads)
    if (!skipGit) {
      broadcast('checkout', 'running', `切换到分支: ${branch}`)
      await execStep('git', ['checkout', branch], projectDir, (line) => {
        broadcast('checkout', 'running', `[GIT] ${line}`)
      })
      broadcast('checkout', 'running', `拉取最新代码...`)
      await execStep('git', ['pull'], projectDir, (line) => {
        broadcast('checkout', 'running', `[GIT] ${line}`)
      })
    } else {
      broadcast('preparing', 'running', '上传文件模式 — 跳过Git步骤')
    }

    // Step 3: Build
    broadcast('build', 'running', `执行构建: ${buildCommand}`)
    await execStep(buildCommand, [], projectDir, (line) => {
      broadcast('build', 'running', `[BUILD] ${line}`)
    })
    broadcast('build', 'success', '构建完成')

    // Step 4: Deploy — copy output to target
    broadcast('deploy', 'running', `部署产物到: ${outputDir}`)
    const possibleDirs = ['dist', 'build', '.next', 'out']
    let builtDir = ''
    for (const d of possibleDirs) {
      const full = join(projectDir, d)
      if (existsSync(full) && readdirSync(full).length > 0) {
        builtDir = full
        break
      }
    }
    if (builtDir) {
      copyDirRecursive(builtDir, outputDir)
      broadcast('deploy', 'success', `部署完成 — ${builtDir} → ${outputDir}`)
    } else {
      broadcast('deploy', 'success', `构建完成，未检测到标准产物目录 (已检查: ${possibleDirs.join(', ')})`)
    }

    await db.run('UPDATE deployments SET status = ? WHERE id = ?', ['success', deploymentId])
    broadcast('complete', 'success', '部署成功')

  } catch (error: any) {
    const errMsg = error.message || '部署失败'
    broadcast('error', 'failed', errMsg)
    await db.run('UPDATE deployments SET status = ?, log = ? WHERE id = ?', ['failed', `[ERROR] ${errMsg}`, deploymentId])
  } finally {
    onComplete?.()
  }
}

export default router
