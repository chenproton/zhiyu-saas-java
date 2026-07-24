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

// 难度等级
export type Difficulty = 'easy' | 'medium' | 'hard'

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: '简单',
  medium: '中等',
  hard: '困难',
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

// 题目接口
export interface Question {
  id: string
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

// 随机抽题筛选条件
export interface RandomQuestionFilter {
  bankIds: string[]
  types: QuestionType[]
  difficulties: Difficulty[]
  knowledgePoints: string[]
  count: number
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

// 规则状态类型
export type RuleStatus =
  | 'draft' // 草稿
  | 'not_submitted' // 未提交
  | 'reviewing' // 审批中
  | 'rejected' // 已驳回
  | 'ready' // 待发布
  | 'published' // 已发布
  | 'none' // 无规则

// 等级映射
export interface LevelMapping {
  level: string
  min: number
  max: number
}

// 关联任务
export interface RelatedTask {
  id: string
  name: string
  maxScore: number
  weight: number
}

// 能力点
export interface EvalAbilityPoint {
  id: string
  name: string
  description: string
  mappingType: 'inherit' | 'custom'
  customMapping?: LevelMapping[]
  requiredLevel: string // 岗位所需掌握度
  weight?: number // 能力点权重
  relatedTasks: RelatedTask[]
}

// 能力项
export interface EvalAbilityItem {
  id: string
  name: string
  abilityPoints: EvalAbilityPoint[]
}

// 岗位认证规则
export interface CertificationRule {
  id: string
  positionName: string
  status: RuleStatus
  ruleSource: 'inherit' | 'custom'
  abilityItems: EvalAbilityItem[]
}

// 岗位信息（列表页使用）
export interface Position {
  id: string
  name: string
  positionCode: string
  professionalDirection: string
  relatedAbilityCount: number
  ruleStatus: RuleStatus
  lastUpdated: string
  updatedBy: string
}

// 操作项配置
export const actionConfig: Record<string, {
  label: string
  showInStatus: RuleStatus[]
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost'
}> = {
  config: {
    label: '配置规则',
    showInStatus: ['draft', 'not_submitted', 'rejected', 'ready', 'published', 'none'],
    variant: 'default',
  },
  invite: {
    label: '邀请共建',
    showInStatus: ['draft', 'not_submitted'],
    variant: 'outline',
  },
  cancelApproval: {
    label: '取消审批',
    showInStatus: ['reviewing'],
    variant: 'destructive',
  },
  publish: {
    label: '发布',
    showInStatus: ['ready'],
    variant: 'default',
  },
  unpublish: {
    label: '取消发布',
    showInStatus: ['published'],
    variant: 'destructive',
  },
}

// 状态配置
export const statusConfig: Record<
  RuleStatus,
  { label: string; color: string; bgColor: string }
> = {
  draft: {
    label: '草稿',
    color: 'text-slate-600',
    bgColor: 'bg-slate-100',
  },
  not_submitted: {
    label: '未提交',
    color: 'text-slate-600',
    bgColor: 'bg-slate-100',
  },
  reviewing: {
    label: '审批中',
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
  },
  rejected: {
    label: '已驳回',
    color: 'text-red-600',
    bgColor: 'bg-red-50',
  },
  ready: {
    label: '待发布',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
  },
  published: {
    label: '已发布',
    color: 'text-green-600',
    bgColor: 'bg-green-50',
  },
  none: {
    label: '无规则',
    color: 'text-slate-500',
    bgColor: 'bg-slate-50',
  },
}

// 默认等级映射表
export const defaultLevelMapping: LevelMapping[] = [
  { level: '不合格', min: 0, max: 60 },
  { level: '了解L1', min: 61, max: 70 },
  { level: '理解L2', min: 71, max: 80 },
  { level: '掌握L3', min: 81, max: 85 },
  { level: '熟练L4', min: 86, max: 95 },
  { level: '精通L5', min: 96, max: 100 },
]

// 根据分数计算等级
export function calculateLevel(
  score: number,
  mapping: LevelMapping[],
): string {
  for (const level of mapping) {
    if (score >= level.min && score <= level.max) {
      return level.level
    }
  }
  return '不合格'
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

// ==================== 毕业设计管理相关 ====================

export type TopicSource = 'scene' | 'enterprise'
export type TopicStatus = 'draft' | 'pending' | 'published' | 'locked'

export interface GraduationProjectTopic {
  id: string
  name: string
  positionId: string
  positionName: string
  college: string
  source: TopicSource
  status: TopicStatus
  capacity: number
  appliedCount: number
  advisorName: string
  enterpriseMentorName?: string
  startDate: Date
  endDate: Date
  description?: string
  createdAt: Date
}

export type ArchivePhase = 'proposal' | 'midterm' | 'process' | 'final'
export type ArchiveDocStatus = 'making' | 'reviewing' | 'returned' | 'passed'

export interface GraduationProjectArchive {
  id: string
  topicId: string
  topicName: string
  studentName: string
  studentId: string
  advisorName: string
  enterpriseMentorName?: string
  positionName: string
  phase: ArchivePhase
  docStatus: ArchiveDocStatus
  docCount: number
  lastUpdated: Date
  hasRectification: boolean
}

export type EvaluationGrade = 'A' | 'B' | 'C' | 'D' | 'E'

export interface GraduationProjectEvaluation {
  id: string
  topicId: string
  topicName: string
  studentName: string
  studentId: string
  advisorScore: number
  enterpriseScore?: number
  defenseScore?: number
  comprehensiveGrade: EvaluationGrade
  isExcellent: boolean
  evaluationTime: Date
  status: 'pending' | 'completed'
}

export interface GraduationQueryResult {
  id: string
  studentName: string
  studentId: string
  className: string
  majorName: string
  creditCompleted: number
  creditRequired: number
  scenePassed: number
  sceneRequired: number
  projectGrade: EvaluationGrade | null
  graduationStatus: 'qualified' | 'unqualified' | 'pending'
  abilityCertStatus: 'certified' | 'uncertified' | 'pending'
  rectificationCount: number
}

// ==================== 学生能力画像管理相关 ====================

export type ArchiveMaterialType = 'certificate' | 'competition' | 'activity' | 'internship' | 'skill'
export type ArchiveAuditStatus = 'pending' | 'approved' | 'rejected'
export type ArchiveDirection = 'positive' | 'negative'

export interface StudentAbilityArchive {
  id: string
  studentName: string
  studentId: string
  className: string
  materialType: ArchiveMaterialType
  materialName: string
  issuingOrg: string
  obtainDate: Date
  auditStatus: ArchiveAuditStatus
  auditRemark?: string
  convertedCredit: number
  direction: ArchiveDirection
  isEnabled: boolean
  createdAt: Date
  level?: string
}

export type EvalAbilityDomain = 'industry' | 'professional' | 'skill' | 'general' | 'quality'

export interface AbilityDomainScore {
  domain: EvalAbilityDomain
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
  // 基础档案扩展
  gender: string
  gradeYear: string
  avatarUrl?: string
  courses: string[]
  scenes: string[]
  completedCourses: number
  completedScenes: number
  totalCredits: number
  archiveCount: number
  // 学历评价
  courseRecords: CourseRecord[]
  graduationQualified: boolean
  attendanceRate: number
  diplomaBadge: string
  // 能力评价扩展
  yearRank: number
  yearTotal: number
  dualBadge: string
}

// ==================== 表单数据类型 ====================

export interface GraduationProjectTopicFormData {
  name: string
  positionId: string
  college: string
  source: TopicSource
  capacity: number
  advisorName: string
  enterpriseMentorName?: string
  startDate: string
  endDate: string
  description?: string
}

export interface GraduationProjectEvaluationFormData {
  advisorScore: number
  enterpriseScore?: number
  defenseScore?: number
  comprehensiveGrade: EvaluationGrade
  isExcellent: boolean
}

export interface StudentAbilityArchiveFormData {
  studentName: string
  studentId: string
  className: string
  materialType: ArchiveMaterialType
  materialName: string
  issuingOrg: string
  obtainDate: string
  direction: ArchiveDirection
}

export interface ArchiveAuditFormData {
  auditStatus: ArchiveAuditStatus
  auditRemark?: string
  convertedCredit: number
}

// ==================== 演示用扩展类型 ====================

export interface ProcessEvaluation {
  id: string
  archiveId: string
  studentName: string
  topicName: string
  phase: 'proposal' | 'midterm' | 'process'
  advisorScore: number
  comment: string
  evaluatedAt: Date
}

export interface RectificationDetail {
  id: string
  archiveId: string
  studentId: string
  studentName: string
  topicName: string
  requirement: string
  deadline: Date
  status: 'pending' | 'submitted' | 'approved'
  studentResponse?: string
  submittedAt?: Date
}

export interface AppealRecord {
  id: string
  studentId: string
  studentName: string
  type: 'grade' | 'graduation' | 'ability'
  reason: string
  status: 'pending' | 'processing' | 'resolved' | 'rejected'
  createdAt: Date
}

export interface CreditConversionRule {
  id: string
  materialType: ArchiveMaterialType
  level: string
  credit: number
}

export interface ArchiveVersion {
  id: string
  archiveId: string
  version: number
  changedBy: string
  changeSummary: string
  createdAt: Date
}

export interface EvaluationStandard {
  id: string
  positionId: string
  positionName: string
  dimensions: { name: string; weight: number; maxScore: number }[]
}

export interface PortraitUpdateConfig {
  updateCycle: 'realtime' | 'daily' | 'weekly'
  queryLimit: number
  queryTimeStart: string
  queryTimeEnd: string
}

export interface TopicApplication {
  id: string
  topicId: string
  topicName: string
  studentId: string
  studentName: string
  className: string
  status: 'pending' | 'approved' | 'rejected' | 'allocated'
  applyReason: string
  appliedAt: Date
  allocatedAdvisorId?: string
  allocatedAdvisorName?: string
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

export interface CertificationAbilityItem {
  id: string
  ruleId: string
  name: string
  sortOrder: number
}

export interface CustomLevelMapping {
  level: string
  min: number
  max: number
}

export interface CertificationAbilityPoint {
  id: string
  itemId: string
  abilityPointId: string
  mappingType: "inherit" | "custom"
  customLevelMapping?: CustomLevelMapping[]
  requiredLevel: string
  weight: number
}

export interface CertificationRelatedTask {
  id: string
  certPointId: string
  taskId: string
  maxScore: number
  weight: number
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
  major?: string
  createdAt: string
  updatedAt: string
}
