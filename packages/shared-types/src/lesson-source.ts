export type CourseStatus = 'draft' | 'pending' | 'rejected' | 'published' | 'archived'
export type CourseType = 'system' | 'granular' | 'hybrid'

export interface Course {
  id: string
  code: string
  name: string
  type: CourseType
  category: string
  major: string
  teacher: string
  industry: string
  version: string
  updateDate: string
  nodeCount: number
  lessonCount: number
  resourceCount: number
  studyCount: number
  status: CourseStatus
  coverColor?: string
  coverImage?: string
  courseTag?: string
  creator?: string
  creatorId?: string
  createDate?: string
  coCreator?: string
  coCreatorIds?: string[]
  batchId?: string
  batchName?: string
  /** 混合课程：线上学时 */
  onlineHours?: number
  /** 混合课程：线下学时 */
  offlineHours?: number
  /** 混合课程：线上成绩权重 */
  onlineWeight?: number
  /** 混合课程：线下成绩权重 */
  offlineWeight?: number
  /** 混合课程：学期 */
  semester?: string
  /** 混合课程：班级 */
  className?: string
}

export interface CourseStats {
  totalCourses: number
  systemCourses: number
  granularCourses: number
  hybridCourses: number
  knowledgePoints: number
}

export interface AdminCourseStats {
  total: number
  draft: number
  pending: number
  rejected: number
  published: number
}

export const COURSE_STATUS_LABELS: Record<CourseStatus, string> = {
  draft: '草稿',
  pending: '审批中',
  rejected: '已驳回',
  published: '已发布',
  archived: '已归档',
}

export const COURSE_STATUS_COLORS: Record<CourseStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  pending: 'bg-yellow-100 text-yellow-700',
  rejected: 'bg-red-100 text-red-700',
  published: 'bg-green-100 text-green-700',
  archived: 'bg-slate-100 text-slate-700',
}

export const INDUSTRIES = [
  '全部',
  '电子信息',
  '软件测试工程师',
  '公共管理与服务',
  '计算机行业',
  '交通运输',
  '公安与司法',
  '教育与体育',
  '新闻传播',
  '文化艺术',
  '旅游',
  '财经商贸',
  '医药卫生',
  '农林牧渔',
  '食品药品与粮食',
]

export const COURSE_TYPE_OPTIONS = [
  { value: 'all', label: '全部' },
  { value: 'system', label: '体系课' },
  { value: 'granular', label: '颗粒课' },
  { value: 'hybrid', label: '混合课程' },
]

export const COURSE_TYPE_LABELS: Record<CourseType, string> = {
  system: '体系课',
  granular: '颗粒课',
  hybrid: '混合课程',
}

export const COURSE_TYPE_COLORS: Record<CourseType, string> = {
  system: 'bg-blue-100 text-blue-700',
  granular: 'bg-emerald-100 text-emerald-700',
  hybrid: 'bg-purple-100 text-purple-700',
}

// ====== 体系课节点相关类型 ======

export type NodeRefType = 'normal' | 'original' | 'resource'

export interface KnowledgePoint {
  name: string
  linked: boolean
}

export interface NodeResource {
  id: string
  name: string
  type: string
  size: number
  url: string
}

export interface QuizQuestion {
  id: string
  type: 'single' | 'multiple' | 'essay' | 'judge'
  question: string
  options?: { key: string; text: string }[]
  answer?: string
  score: number
}

export interface NodeQuiz {
  id: string
  title: string
  type: 'paper' | 'question_bank'
  questions: QuizQuestion[]
  timeLimit?: number
}

export interface NodeHomework {
  id: string
  title: string
  requirement: string
  needAttachment: boolean
  deadline?: string
}

export interface SystemCourseNode {
  id: string
  courseId: string
  parentId: string | null
  name: string
  order: number
  type: NodeRefType
  sourceId?: string
  sourceName?: string
  teachingGoals?: string
  knowledgePoints?: KnowledgePoint[]
  duration?: number
  resources?: NodeResource[]
  quizzes?: NodeQuiz[]
  homeworks?: NodeHomework[]
  status: CourseStatus
}

export const NODE_REF_TYPE_LABELS: Record<NodeRefType, string> = {
  normal: '普通课程',
  original: '颗粒课',
  resource: '资源',
}

export const NODE_REF_TYPE_COLORS: Record<NodeRefType, string> = {
  normal: 'bg-gray-100 text-gray-600',
  original: 'bg-purple-50 text-purple-600',
  resource: 'bg-green-50 text-green-600',
}

export interface KnowledgeGraphNode {
  id: string
  label: string
  x: number
  y: number
  type: 'core' | 'related' | 'extended'
  description?: string
}

export interface KnowledgeGraphEdge {
  from: string
  to: string
  label?: string
}

// ====== 学生能力画像相关类型（从 zhiyu-evaluation 迁移） ======

export type EvaluationGrade = 'A' | 'B' | 'C' | 'D' | 'E'

export type AbilityDomain = 'industry' | 'professional' | 'skill' | 'general' | 'quality'

export interface AbilityDomainScore {
  domain: AbilityDomain
  domainLabel: string
  score: number
  level: string
}

export interface CourseRecord {
  courseName: string
  credit: number
  grade: EvaluationGrade
  finalScore: number
}

export interface StudentAbilityPortrait {
  id: string
  studentName: string
  studentId: string
  className: string
  majorName: string
  positionName: string
  overallGrade: EvaluationGrade
  domainScores: AbilityDomainScore[]
  classRank: number
  classTotal: number
  majorRank: number
  majorTotal: number
  recommendPositions: { positionName: string; matchRate: number }[]
  updatedAt: Date
  gender: string
  gradeYear: string
  avatarUrl?: string
  courses: string[]
  scenes: string[]
  completedCourses: number
  completedScenes: number
  totalCredits: number
  archiveCount: number
  courseRecords: CourseRecord[]
  graduationQualified: boolean
  attendanceRate: number
  diplomaBadge: string
  yearRank: number
  yearTotal: number
  dualBadge: string
}

export interface PortraitUpdateConfig {
  autoUpdate: boolean
  updateTime: string
  lastUpdateTime: Date
}
