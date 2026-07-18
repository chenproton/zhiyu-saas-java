// 用户角色类型
export type UserRole = 'admin' | 'builder' | 'reviewer' | 'student'

// 用户信息
export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  avatar?: string
  department?: string
}

// 批次状态
export type BatchStatus = 'open' | 'closed'

// 批次
export interface Batch {
  id: string
  name: string
  orgNodeId?: string
  department: string
  majorId?: string
  major: string
  workflowId: string
  status: BatchStatus
  positionCount: number
  publishedCount: number
  pendingCount: number
  createdAt: string
  updatedAt: string
}

// 审批流程步骤
export interface WorkflowStep {
  name: string
  order: number
  approverIds: string[]
  approvalMode: "any" | "all"
}

export interface Workflow {
  id: string
  name: string
  description: string
  steps: WorkflowStep[]
  majorIds: string[]
  createdAt: string
}

// 岗位类型：企业岗位 / 教学岗位
export type PositionType = 'enterprise' | 'teaching'

// 岗位状态
export type PositionStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'published' | 'archived'

// 职业发展路径
export type CareerPath = string

// 岗位证书
export interface PositionCertificate {
  id: string
  name: string
  url?: string
  description?: string
  image?: string
}

// 能力点
export interface Ability {
  id: string
  name: string
  category: string
  description: string
  isPublic: boolean
  createdAt: string
}

// 能力单元
export interface AbilityUnit {
  id: string
  name: string
  description: string
  abilityIds: string[]
}

// 工作职责
export interface PositionResponsibility {
  id: string
  name: string
  description: string
}

// 岗位能力绑定（职责 -> 能力点）
export interface PositionAbilityBinding {
  id: string
  responsibilityId: string      // 对应职责ID
  source: 'public' | 'custom'   // 来源：公共池引用 / 自建
  publicAbilityId?: string       // 公共池能力ID（source=public时）
  abilityPointId?: string        // 后端能力点ID（source=custom时由保存创建）
  name: string                   // 能力名称
  category: string               // 能力分类
  level: CompetencyLevel
  rubricDescription: string      // 量规表现描述
  description?: string           // 能力描述
  attributes?: string[]          // 能力属性：知识/素养/技能
  domain?: string                // 所属能力域
}

// 能力领域
export interface AbilityDomain {
  id: string
  name: string
  description?: string
  bindingIds: string[]           // 包含的 PositionAbilityBinding id
}

// 图谱节点位置
export interface NodePosition {
  x: number
  y: number
}

// 能力图谱节点
export interface AbilityGraphNode {
  id: string
  type: 'responsibility' | 'unit' | 'ability'
  data: {
    label: string
    description?: string
    category?: string
  }
  position: NodePosition
}

// 能力图谱边
export interface AbilityGraphEdge {
  id: string
  source: string
  target: string
  type?: string
}

// 能力模型
export interface AbilityModel {
  nodes: AbilityGraphNode[]
  edges: AbilityGraphEdge[]
}

// 胜任力等级
export type CompetencyLevel = 'understand' | 'comprehend' | 'master' | 'proficient' | 'expert'

// 胜任力配置项
export interface CompetencyItem {
  id: string
  abilityId: string
  abilityName: string
  level: CompetencyLevel
  ruleDescription: string
  weight: number
}

// 岗位
export interface Position {
  id: string
  batchId: string
  version: string
  status: PositionStatus
  
  // 基础信息
  name: string
  shortName: string
  industry: string
  majors: string[]
  positionType: PositionType
  salaryRange: [number, number]
  coverImage?: string
  certificates: PositionCertificate[]
  
  // 详细描述
  description: string
  responsibilities: PositionResponsibility[]
  requirements: string[]
  careerPath: CareerPath
  
  // 能力模型（保留兼容）
  abilityModel: AbilityModel
  
  // Step2: 职责-能力绑定
  abilityBindings: PositionAbilityBinding[]
  
  // Step3: 能力领域归类
  abilityDomains: AbilityDomain[]
  
  // 胜任力配置（保留兼容）
  competencyConfig: CompetencyItem[]
  
  // 元数据
  createdBy: string
  collaborators: string[]
  createdAt: string
  updatedAt: string
  
  // 收藏数
  favoriteCount: number
}

// 审批状态
export type ApprovalStatus = 'pending' | 'approved' | 'rejected'

// 审批历史项
export interface ApprovalHistoryItem {
  id: string
  stepId: string
  stepName: string
  reviewerId: string
  reviewerName: string
  status: ApprovalStatus
  comment: string
  createdAt: string
}

// 审批记录
export interface ApprovalRecord {
  id: string
  positionId: string
  positionName: string
  workflowId: string
  currentStepIndex: number
  status: ApprovalStatus
  submittedBy: string
  submittedByName: string
  history: ApprovalHistoryItem[]
  createdAt: string
  updatedAt: string
}

// 评价规则
export interface EvaluationRule {
  id: string
  name: string
  description: string
  category: string
  criteria: string[]
  createdAt: string
}

// 收藏记录
export interface FavoriteRecord {
  id: string
  userId: string
  positionId: string
  createdAt: string
}

// 统计数据
export interface DashboardStats {
  totalBatches: number
  openBatches: number
  totalPositions: number
  publishedPositions: number
  pendingApprovals: number
  totalAbilities: number
}

// 胜任力等级标签映射
export const COMPETENCY_LEVEL_LABELS: Record<CompetencyLevel, string> = {
  understand: '了解',
  comprehend: '理解',
  master: '掌握',
  proficient: '熟练',
  expert: '精通',
}

// 岗位状态标签映射
export const POSITION_STATUS_LABELS: Record<PositionStatus, string> = {
  draft: '草稿',
  pending: '审批中',
  approved: '已通过',
  rejected: '已驳回',
  published: '已上架',
  archived: '已归档',
}

// 批次状态标签映射
export const BATCH_STATUS_LABELS: Record<BatchStatus, string> = {
  open: '开放中',
  closed: '已截止',
}

// 角色标签映射
export const ROLE_LABELS: Record<UserRole, string> = {
  admin: '管理员',
  builder: '建设者',
  reviewer: '审批者',
  student: '学生',
}

// 岗位推荐配置（按专业配置前台推荐岗位及顺序）
export interface PositionRecommendation {
  id: string
  majorId?: string          // 专业ID (UUID FK)
  major: string             // 专业名称（显示用）
  positionId: string        // 岗位ID
  positionType: PositionType
  reason?: string           // 推荐原因
  order: number             // 展示顺序，越小越靠前
  isEnabled: boolean        // 是否在前台展示
  createdBy: string         // 配置人（老师）ID
  createdAt: string
  updatedAt: string
}

// 岗位类型标签映射
export const POSITION_TYPE_LABELS: Record<PositionType, string> = {
  enterprise: '企业岗位',
  teaching: '教学岗位',
}
