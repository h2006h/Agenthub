import sqlite3 from 'sqlite3'
import { open, Database } from 'sqlite'

let db: Database | null = null

export const initDatabase = async () => {
  db = await open({
    filename: './database/agenthub.db',
    driver: sqlite3.Database
  })

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('single', 'group', 'agent')),
      avatar TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
    );

    CREATE TABLE IF NOT EXISTS conversation_participants (
      conversation_id TEXT,
      user_id TEXT,
      FOREIGN KEY(conversation_id) REFERENCES conversations(id),
      FOREIGN KEY(user_id) REFERENCES users(id),
      PRIMARY KEY(conversation_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      sender_id TEXT NOT NULL,
      sender_name TEXT NOT NULL,
      content TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('text', 'code', 'task', 'system')),
      timestamp INTEGER DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY(conversation_id) REFERENCES conversations(id)
    );

    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('knowledge', 'task', 'code')),
      description TEXT,
      config TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL CHECK(status IN ('pending', 'in_progress', 'completed')),
      priority TEXT NOT NULL CHECK(priority IN ('high', 'medium', 'low')),
      assignee TEXT,
      parent_id TEXT,
      result TEXT,
      result_type TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY(parent_id) REFERENCES tasks(id)
    );

    CREATE TABLE IF NOT EXISTS conversation_agents (
      conversation_id TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      FOREIGN KEY(conversation_id) REFERENCES conversations(id),
      PRIMARY KEY(conversation_id, agent_id)
    );

    CREATE TABLE IF NOT EXISTS code_reviews (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL DEFAULT '',
      file_name TEXT NOT NULL,
      old_content TEXT,
      new_content TEXT,
      diff_result TEXT NOT NULL,
      commit_id TEXT,
      applied INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
    );

    CREATE TABLE IF NOT EXISTS deployments (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL DEFAULT '',
      environment TEXT NOT NULL,
      version TEXT,
      deploy_type TEXT,
      branch TEXT,
      build_command TEXT,
      output_dir TEXT,
      status TEXT NOT NULL CHECK(status IN ('success', 'failed', 'running')),
      log TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
    );
  `)

  await runMigrations()
  await initAgents()
}

const runMigrations = async () => {
  if (!db) return

  const migrations = [
    'ALTER TABLE tasks ADD COLUMN result TEXT',
    'ALTER TABLE tasks ADD COLUMN result_type TEXT',
    'ALTER TABLE tasks ADD COLUMN user_id TEXT NOT NULL DEFAULT \'\'',
    'ALTER TABLE deployments ADD COLUMN deploy_type TEXT',
    'ALTER TABLE deployments ADD COLUMN branch TEXT',
    'ALTER TABLE deployments ADD COLUMN build_command TEXT',
    'ALTER TABLE deployments ADD COLUMN output_dir TEXT',
    'ALTER TABLE deployments ADD COLUMN user_id TEXT NOT NULL DEFAULT \'\'',
    'ALTER TABLE users ADD COLUMN bio TEXT',
    'ALTER TABLE users ADD COLUMN avatar TEXT',
    'ALTER TABLE code_reviews ADD COLUMN user_id TEXT NOT NULL DEFAULT \'\'',
  ]

  for (const sql of migrations) {
    try {
      await db.exec(sql)
    } catch {
      // Column already exists — safe to ignore
    }
  }
}

const initAgents = async () => {
  if (!db) return

  const existingAgents = await db.get('SELECT COUNT(*) as count FROM agents')
  if (existingAgents?.count === 0) {
    await db.run(`
      INSERT INTO agents (id, name, type, description, config) VALUES 
      ('agent-knowledge', '知识问答Agent', 'knowledge', '能够回答技术问题、提供文档支持的知识库助手', '{}'),
      ('agent-task', '任务管理Agent', 'task', '能够分析需求、拆解任务、分配工作的协调者', '{}'),
      ('agent-code', '代码助手Agent', 'code', '能够编写、审查、优化代码的智能助手', '{}')
    `)
  }
}

export const getDB = () => {
  if (!db) {
    throw new Error('Database not initialized')
  }
  return db
}
