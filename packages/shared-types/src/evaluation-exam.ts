import type { Status } from "./evaluation"

// 难度等级
export type Difficulty = 'easy' | 'medium' | 'hard'

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: '简单',
  medium: '中等',
  hard: '困难',
}

// 题目类型枚举
export type QuestionType = 'single' | 'multiple' | 'judge' | 'fill' | 'essay' | 'short_answer'

// 题目类型中文映射
export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  single: '单选题',
  multiple: '多选题',
  judge: '判断题',
  fill: '填空题',
  essay: '问答题',
  short_answer: '简答题',
}

// 题库接口
export interface QuestionBank {
  id: string
  code?: string
  name: string
  description: string
  coverImage?: string
  status: Status
  questionCount: number
  creatorId?: string
  creatorName?: string
  collaboratorIds?: string[]
  collaboratorNames?: string[]
  collaboratorDeptIds?: string[]
  batchId?: string
  version: string
  ownerType: 'mine' | 'collaborate' | 'public'
  isDraftPool?: boolean
  createdAt: Date
  updatedAt: Date
}

// 创建题库表单数据
export interface QuestionBankFormData {
  name: string
  description: string
  coverImage?: string
  collaboratorIds?: string[]
  collaboratorDeptIds?: string[]
  batchId?: string
}

// 题目接口
export interface Question {
  id: string
  code?: string
  bankId: string
  type: QuestionType
  content: string
  options?: string[]
  answer: string | string[]
  analysis?: string
  score: number
  difficulty?: Difficulty
  knowledgePoints?: string[]
  creatorId?: string
  source?: string
  status: Status
  createdAt: Date
}

// 创建题目表单数据
export interface QuestionFormData {
  type: QuestionType
  content: string
  options?: string[]
  answer: string | string[]
  analysis?: string
  score: number
  difficulty?: Difficulty
  knowledgePoints?: string[]
}

// 试卷中的题目（快照）
export interface ExamQuestion {
  id: string
  questionId: string
  type: QuestionType
  content: string
  options?: string[]
  answer: string | string[]
  analysis?: string
  score: number
  order: number
}

// 试卷接口
export interface Exam {
  id: string
  code?: string
  name: string
  description: string
  status: Status
  totalScore: number
  duration: number // 分钟
  questions: ExamQuestion[]
  coverImage?: string
  collaboratorIds?: string[]
  collaboratorDeptIds?: string[]
  batchId?: string
  version: string
  ownerType: 'mine' | 'collaborate' | 'public'
  creatorId?: string
  creatorName?: string
  collaboratorNames?: string[]
  createdAt: Date
  updatedAt: Date
  isTemp?: boolean
}

// 创建试卷表单数据
export interface ExamFormData {
  name: string
  description: string
  duration: number
  coverImage?: string
  collaboratorIds?: string[]
  collaboratorDeptIds?: string[]
  batchId?: string
}

// 随机抽题筛选条件
export interface RandomQuestionFilter {
  bankIds: string[]
  types: QuestionType[]
  difficulties: Difficulty[]
  knowledgePoints: string[]
  count: number
}

// Types preserved for API compatibility with lib/api.ts
export interface ExamUsage {
  id: string
  examId: string
  name: string
  description?: string
  startTime?: string
  endTime?: string
  duration?: number
  targetType?: "class" | "major" | "department" | "public"
  targetIds: string[]
  status: "draft" | "pending" | "in_progress" | "finished"
  creatorId?: string
  createdAt: string
  updatedAt: string
}

export interface ExamResult {
  id: string
  examUsageId: string
  userId: string
  studentName: string
  className: string
  grade: string
  majorId?: string
  majorName?: string
  score: number
  totalScore: number
  isPass: boolean
  submitTime: string
  createdAt: string
}

export interface EvaluationBatch {
  id: string
  tenantId?: string
  name: string
  code?: string
  orgNodeId?: string
  majorId?: string
  workflowId?: string
  status: "open" | "closed"
  createdAt: string
  updatedAt: string
}

export interface RandomDrawQuestion {
  id: string
  name: string
  description?: string
  answer?: string
  majorId?: string
  majorName?: string
  createdAt: string
  updatedAt: string
}
