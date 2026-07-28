// 用户接口
export interface User {
  id: string
  name: string
  avatar?: string
  email: string
  department?: string
}

// 协作者接口
export interface Collaborator {
  userId: string
  role: 'owner' | 'editor' | 'viewer'
  addedAt: Date
}

// 知识点
export interface EvalKnowledgePoint {
  id: string
  name: string
}

// 批次分组
export interface Batch {
  id: string
  name: string
  description?: string
}

// 部门
export interface Department {
  id: string
  name: string
}

// 状态枚举：与后端 content_status 保持一致
export type Status = 'draft' | 'pending' | 'approved' | 'rejected' | 'published' | 'archived'

// 状态中文映射
export const STATUS_LABELS: Record<Status, string> = {
  draft: '草稿',
  pending: '审批中',
  approved: '已通过',
  rejected: '已驳回',
  published: '已发布',
  archived: '已归档',
}

// 状态流转操作
export type StatusAction =
  | 'save_draft'      // 保存草稿
  | 'submit'          // 提交审批
  | 'withdraw'        // 撤回
  | 'approve'         // 通过
  | 'reject'          // 驳回
  | 'publish'         // 发布
  | 'unpublish'       // 取消发布
  | 'archive'         // 归档

// 状态流转规则：与后端状态机保持一致
export const STATUS_TRANSITIONS: Record<StatusAction, { from: Status[], to: Status }> = {
  save_draft: { from: ['draft', 'rejected', 'approved', 'published', 'archived'], to: 'draft' },
  submit: { from: ['draft', 'rejected'], to: 'pending' },
  withdraw: { from: ['pending'], to: 'draft' },
  approve: { from: ['pending'], to: 'approved' },
  reject: { from: ['pending'], to: 'rejected' },
  publish: { from: ['approved'], to: 'published' },
  unpublish: { from: ['published'], to: 'draft' },
  archive: { from: ['draft', 'rejected', 'approved', 'published'], to: 'archived' },
}

// 判断操作是否可用
export function canPerformAction(currentStatus: Status, action: StatusAction): boolean {
  const transition = STATUS_TRANSITIONS[action]
  return transition.from.includes(currentStatus)
}

// 获取下一个状态
export function getNextStatus(action: StatusAction): Status {
  return STATUS_TRANSITIONS[action].to
}

// ==================== 场景任务测评相关 ====================

// 一级测评分类
export interface EvaluationMethodCategory {
  id: string
  name: string
  order: number
}

// 二级测评方式
export interface EvaluationMethod {
  id: string
  categoryId: string
  name: string
  enabled: boolean
  relatedTaskIds: string[]
  description?: string
  docLink?: string
  subCategoryName?: string
}

// 场景任务
export interface SceneTask {
  id: string
  name: string
  sceneName: string
  methodIds: string[]
}

// 场景任务测评结果
export interface SceneEvaluationResult {
  id: string
  taskId: string
  sceneId?: string
  methodKey: string
  evaluateeId: string
  evaluatorId?: string
  evaluatorType?: string
  status: "pending" | "evaluated"
  totalScore?: number
  maxScore: number
  evalPointScores: Record<string, any>
  objectiveAnswers: Record<string, any>
  subjectiveContent: Record<string, any>
  drawnQuestions: Record<string, any>
  comment?: string
  gradedAt?: Date
  gradedBy?: string
  createdAt?: Date
  updatedAt?: Date
}

// 岗位能力测评结果
export interface JobAbilityResult {
  id: string
  positionId: string
  positionName: string
  positionCode: string
  studentName: string
  studentId: string
  className?: string
  majorId?: string
  majorName?: string
  department?: string
  totalAbilityPoints: number
  achievedAbilityPoints: number
  achievementRate: number
  grade?: string
  evaluationTime: string | Date
  createdAt?: string
  updatedAt?: string
}

// 审批类型
export type ApprovalType = 'question' | 'questionBank' | 'exam' | 'onlineExam'

export const APPROVAL_TYPE_LABELS: Record<ApprovalType, string> = {
  question: '题目',
  questionBank: '题库',
  exam: '试卷',
  onlineExam: '在线考试',
}

// 审批状态
export type ApprovalStatus = 'pending' | 'approved' | 'rejected'

export const APPROVAL_STATUS_LABELS: Record<ApprovalStatus, string> = {
  pending: '待审批',
  approved: '已通过',
  rejected: '已驳回',
}

// 审批项
export interface ApprovalItem {
  id: string
  type: ApprovalType
  title: string
  description?: string
  submitterName: string
  submitTime: Date
  status: ApprovalStatus
  remark?: string
}

// ==================== 场景任务评价相关（从 zhiyu-scene 迁移）====================

export interface SceneGradingStudent {
  id: string
  name: string
  studentNumber: string
  class: string
  department: string
  enrollmentYear: number
}

export interface SceneGradingSubmission {
  id: string
  studentId: string
  scenarioId: string
  scenarioName: string
  taskId: string
  taskName: string
  assessmentForm: string
  method: '试卷' | '题库' | '评审' | '现场问答'
  status: 'pending' | 'graded'
  submittedAt: string
  maxScore: number
}

export interface SceneGradingScenario {
  id: string
  name: string
  code: string
  positionName?: string
  tasks: {
    id: string
    name: string
    code: string
    taskType: 'assessment' | 'training'
    assessmentForm?: string
  }[]
}

// ==================== 在线课堂评价相关 ====================

export interface OnlineClassroomStudent {
  id: string
  name: string
  studentNumber: string
  className: string
  enrollmentYear: number
  status: 'pending' | 'graded'
  submittedAt?: string
  score?: number
}

export interface OnlineClassroom {
  id: string
  name: string
  code: string
  category: string
  teacherName: string
  studentCount: number
  pendingCount: number
  gradedCount: number
  students: OnlineClassroomStudent[]
}

// ==================== 智慧课程评价相关 ====================

export interface SmartCourseChapter {
  id: string
  name: string
  order: number
  studentCount: number
  pendingCount: number
  gradedCount: number
}

export interface SmartCourseStudent {
  id: string
  name: string
  studentNumber: string
  className: string
  enrollmentYear: number
  status: 'pending' | 'graded'
  submittedAt?: string
  score?: number
}

export interface SmartCourse {
  id: string
  name: string
  code: string
  category: string
  teacherName: string
  chapters: SmartCourseChapter[]
  students: SmartCourseStudent[]
}

// ==================== 微证书管理相关 ====================

export interface CertType {
  id: string
  name: string
}

export interface MicroCertTemplate {
  id: string
  title: string
  certTypeId: string
  certTypeName: string
  content: string
  coverImage?: string
  createdAt: Date
  updatedAt: Date
}

export type IssueStatus = 'issued' | 'revoked'

export const ISSUE_STATUS_LABELS: Record<IssueStatus, string> = {
  issued: '已颁发',
  revoked: '已撤销',
}

export interface CertIssuanceRecord {
  id: string
  templateId: string
  templateTitle: string
  certTypeName: string
  studentName: string
  studentId: string
  className: string
  issueDate: Date
  expireDate?: Date
  status: IssueStatus
  certNumber: string
  revokedAt?: Date
  revokeReason?: string
}

export interface MicroCertTemplateFormData {
  title: string
  certTypeId: string
  content: string
  coverImage?: string
}

// ==================== Re-exports from split modules ====================

export * from "./certification"
export * from "./graduation"
export * from "./portrait"
export * from "./evaluation-rules"
export * from "./evaluation-exam"
