import { request } from './base'

export interface CodeDiff {
  id: string
  fileName: string
  oldContent: string
  newContent: string
  diffResult: string
  commitId: string
  applied: number
  createdAt: number
}

export const getDiff = async (id: string): Promise<CodeDiff> => {
  return request(`/code/diff/${id}`, 'GET')
}

export const getDiffList = async (): Promise<CodeDiff[]> => {
  return request('/code/diff/list', 'GET')
}

export const createDiff = async (
  fileName: string,
  oldContent: string,
  newContent: string,
  diffResult: string,
  commitId?: string
): Promise<CodeDiff> => {
  return request('/code/diff', 'POST', {
    fileName,
    oldContent,
    newContent,
    diffResult,
    commitId
  })
}

export const applyDiff = async (id: string): Promise<{ success: boolean; message: string }> => {
  return request(`/code/apply/${id}`, 'POST')
}

export interface DiffLine {
  number: number
  content: string
  type: 'add' | 'remove' | 'same'
}

export interface CompareResponse {
  diff: DiffLine[]
  additions: number
  deletions: number
}

export const compareCode = async (
  originalCode: string,
  newCode: string
): Promise<CompareResponse> => {
  return request('/code/compare', 'POST', {
    originalCode,
    newCode
  })
}

export interface CodeReview {
  id: number
  title: string
  author: string
  status: 'pending' | 'approved' | 'rejected'
  createdAt: string
  additions: number
  deletions: number
  fileCount: number
  diffs: Array<{ fileName: string; content: string }>
}

export const getCodeReviews = async (): Promise<CodeReview[]> => {
  return request('/code/reviews', 'GET')
}

export const createCodeReview = async (
  title: string,
  diffs: Array<{ fileName: string; content: string }>
): Promise<CodeReview> => {
  return request('/code/reviews', 'POST', {
    title,
    diffs
  })
}

export const updateReviewStatus = async (
  id: number,
  status: 'approved' | 'rejected'
): Promise<CodeReview> => {
  return request(`/code/reviews/${id}/status`, 'PATCH', { status })
}

export interface ReviewResult {
  id: string
  summary: string
  scores: { quality: number; security: number; performance: number; maintainability: number }
  issues: Array<{ severity: string; category: string; line: number; title: string; description: string; suggestion: string }>
  strengths: string[]
  improvedCode: string
  rawResponse?: string
}

export const reviewCode = async (
  code: string,
  language: string,
  title?: string
): Promise<ReviewResult> => {
  return request('/code/review', 'POST', { code, language, title })
}
