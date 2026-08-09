import type { Status } from './content-status'

// 难度等级
export type Difficulty = 'easy' | 'medium' | 'hard'

export const DIFFICULTY_LABELS: Record<string, string> = {
  easy: '简单',
  medium: '中等',
  hard: '困难',
}

// 题目难度配色，与 DIFFICULTY_LABELS 配套。
export const DIFFICULTY_COLORS: Record<string, string> = {
  easy: '#22c55e',
  medium: '#f59e0b',
  hard: '#ef4444',
}

// 题目类型枚举
export type QuestionType = 'single' | 'multiple' | 'judge' | 'fill' | 'essay' | 'short_answer'

// 规范题型键列表（去重后的权威顺序，UI 遍历统一使用，避免 judge/judgment 别名重复渲染）
export const QUESTION_TYPES: QuestionType[] = [
  'single',
  'multiple',
  'judge',
  'fill',
  'essay',
  'short_answer',
]

// 题目类型中文映射（完整版：含"题"后缀，用于前台展示）
export const QUESTION_TYPE_LABELS: Record<string, string> = {
  single: '单选题',
  multiple: '多选题',
  judge: '判断题',
  judgment: '判断题',
  fill: '填空题',
  fill_blank: '填空题',
  essay: '问答题',
  short_answer: '简答题',
}

// 题目类型中文映射（紧凑版：用于徽标/表格等紧凑场景）
export const QUESTION_TYPE_LABELS_SHORT: Record<string, string> = {
  single: '单选',
  multiple: '多选',
  judge: '判断',
  judgment: '判断',
  fill: '填空',
  fill_blank: '填空',
  essay: '论述',
  short_answer: '简答',
}

// 题目类型徽标颜色（Badge 用）
export const QUESTION_TYPE_BADGE_CLASSES: Record<string, string> = {
  single: 'bg-blue-500',
  multiple: 'bg-indigo-500',
  judgment: 'bg-amber-500',
  judge: 'bg-amber-500',
  fill_blank: 'bg-purple-500',
  fill: 'bg-purple-500',
  essay: 'bg-rose-500',
  short_answer: 'bg-teal-500',
}

// 评价方式标签（学习端展示：随机抽题/评审/...）
export const EVAL_METHOD_LABELS: Record<string, string> = {
  random_draw: '随机抽题',
  review: '评审',
  paper: '试卷',
  question_bank: '题库',
  outcome: '成果',
  homework: '作业',
  quiz: '测验',
}

// 评价方式标签（评分端展示：现场问答/现场评审/...）
export const EVAL_METHOD_LABELS_GRADING: Record<string, string> = {
  random_draw: '现场问答',
  review: '现场评审',
  paper: '试卷',
  question_bank: '题库',
  outcome: '成果评价',
  homework: '作业',
  quiz: '随堂测',
}

// 评价方式颜色（hex，学习端）
export const EVAL_METHOD_COLORS: Record<string, string> = {
  random_draw: '#6366f1',
  review: '#f43f5e',
  paper: '#0ea5e9',
  question_bank: '#8b5cf6',
  outcome: '#10b981',
  homework: '#f59e0b',
  quiz: '#06b6d4',
}

// 题库接口
export interface QuestionBank {
  id: string
  code?: string
  name: string
  description?: string
  coverImage?: string
  status: Status
  questionCount: number
  creatorId?: string
  creatorName?: string
  collaboratorIds?: string[]
  collaboratorNames?: string[]
  collaboratorDeptIds?: string[]
  batchId?: string
  version?: string
  ownerType: 'mine' | 'collaborate' | 'public'
  isDraftPool?: boolean
  /** 驳回原因（后端审批驳回时返回） */
  rejectReason?: string
  createdAt: string
  updatedAt: string
}

// 创建题库表单数据
export interface QuestionBankFormData {
  name: string
  description?: string
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
  createdAt: string
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
  description?: string
  status: Status
  totalScore: number
  duration: number // 分钟
  /** 列表接口返回的题目数（列表不再挂载 questions 数组，性能优化） */
  questionCount?: number
  questions?: ExamQuestion[]
  coverImage?: string
  collaboratorIds?: string[]
  collaboratorDeptIds?: string[]
  batchId?: string
  version?: string
  ownerType: 'mine' | 'collaborate' | 'public'
  creatorId?: string
  creatorName?: string
  collaboratorNames?: string[]
  createdAt: string
  updatedAt: string
  isTemp?: boolean
  /** 驳回原因（后端审批驳回时返回） */
  rejectReason?: string
}

// 创建试卷表单数据
export interface ExamFormData {
  name: string
  description?: string
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
  targetType?: 'class' | 'major' | 'department' | 'public' | 'task' | 'node' | 'course'
  targetIds: string[]
  status: 'draft' | 'pending' | 'published' | 'scheduled' | 'in_progress' | 'finished'
  activationMode?: 'manual' | 'scheduled' | 'always'
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
  answers?: Record<string, unknown>
  gradingStatus?: 'pending' | 'evaluated'
  gradingScores?: Record<string, unknown>
  gradingComment?: string
  graderId?: string
  gradedAt?: string
  submitTime: string
  createdAt: string
}

// 测评中心条目（landing 考试中心）
export interface ExamCenterItem {
  id: string
  examId: string
  usageName: string
  examName: string
  description?: string
  startTime?: string
  endTime?: string
  duration?: number
  status: 'published' | 'in_progress' | 'finished'
  questionCount: number
  totalScore: number
  participatable: boolean
  submitted: boolean
  score?: number
  studentView: boolean
}

export interface EvaluationBatch {
  id: string
  tenantId?: string
  name: string
  code?: string
  orgNodeId?: string
  majorId?: string
  workflowId?: string
  status: 'open' | 'closed'
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
