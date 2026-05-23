import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface Task {
  id: string
  title: string
  description: string
  status: 'pending' | 'in_progress' | 'completed'
  priority: 'high' | 'medium' | 'low'
  assignee: string
  createdAt: number
  updatedAt: number
  parentId?: string
  children?: string[]
}

export const useTaskStore = defineStore('task', () => {
  const tasks = ref<Task[]>([
    {
      id: 't1',
      title: '完成用户认证模块',
      description: '实现用户注册、登录、JWT认证功能',
      status: 'in_progress',
      priority: 'high',
      assignee: '张三',
      createdAt: Date.now() - 86400000,
      updatedAt: Date.now()
    },
    {
      id: 't2',
      title: '设计数据库表结构',
      description: '设计用户、消息、任务等核心表结构',
      status: 'completed',
      priority: 'high',
      assignee: '李四',
      createdAt: Date.now() - 172800000,
      updatedAt: Date.now() - 86400000
    },
    {
      id: 't3',
      title: '实现WebSocket通信',
      description: '实现实时消息推送功能',
      status: 'pending',
      priority: 'medium',
      assignee: '张三',
      createdAt: Date.now() - 43200000,
      updatedAt: Date.now() - 43200000
    },
    {
      id: 't4',
      title: '集成DeepSeek API',
      description: '集成AI模型，实现Agent问答功能',
      status: 'pending',
      priority: 'high',
      assignee: '王五',
      createdAt: Date.now() - 21600000,
      updatedAt: Date.now() - 21600000
    }
  ])

  const addTask = (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newTask: Task = {
      ...task,
      id: `t${Date.now()}`,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
    tasks.value.push(newTask)
    return newTask
  }

  const updateTask = (taskId: string, updates: Partial<Task>) => {
    const index = tasks.value.findIndex(t => t.id === taskId)
    if (index !== -1) {
      tasks.value[index] = {
        ...tasks.value[index],
        ...updates,
        updatedAt: Date.now()
      }
    }
  }

  const deleteTask = (taskId: string) => {
    tasks.value = tasks.value.filter(t => t.id !== taskId)
  }

  const getTasksByStatus = (status: Task['status']) => {
    return tasks.value.filter(t => t.status === status)
  }

  return {
    tasks,
    addTask,
    updateTask,
    deleteTask,
    getTasksByStatus
  }
})
