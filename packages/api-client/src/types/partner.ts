// 企业平台（Partner）类型定义，API 契约见 docs/spec/partner-enterprise-platform.md §5
import type { User } from '../../../shared-types/src/shared-models'
import type { AllianceExpert } from '../../../shared-types/src/alliance'
import type { Role } from './backend'
import type { CareerPosition } from './job'
import type { Scenario, ScenarioTask } from './scene'

/** 企业主体（partner_enterprises，全局唯一，企业侧自维护） */
export interface PartnerEnterprise {
  id: string
  tenantId: string
  name: string
  unifiedSocialCreditCode?: string
  industry?: string
  region?: string
  description?: string
  logoUrl?: string
  coverImage?: string
  cooperationTypes?: string[]
  contactPerson?: string
  contactPhone?: string
  contactEmail?: string
  address?: string
  establishedYear?: number
  employeeCount?: number
  businessLicensePhotos?: string[]
  qualificationPhotos?: string[]
  intellectualPropertyPhotos?: string[]
  coverPhotos?: string[]
  /** 企业侧"愿意对外展示"开关（联盟前台展示双控之一） */
  enablePublic: boolean
  createdAt: string
  updatedAt: string
}

/** 企业主体信息更新请求（PUT /partner/enterprise/profile） */
export type PartnerEnterpriseUpdateRequest = Partial<
  Omit<PartnerEnterprise, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>
>

/** 企业专家档案（alliance_experts，归属企业租户；userId 绑定企业成员账号） */
export interface PartnerExpert extends AllianceExpert {
  userId?: string
}

/** 企业成员账号（users，platform=partner；后端返回 domain.User，角色在 roleCodes 数组） */
export interface PartnerMember {
  id: string
  username: string
  name: string
  phone?: string
  email?: string
  roleCode: 'enterprise_admin' | 'enterprise_member'
  /** 后端实际返回的角色字段（domain.User.roleCodes）；roleCode 仅供前端表单/请求使用 */
  roleCodes?: string[]
  status: string
  lastLoginAt?: string
  createdAt: string
}

export interface PartnerMemberCreateRequest {
  username: string
  password: string
  name: string
  phone?: string
  email?: string
  roleCode?: 'enterprise_admin' | 'enterprise_member'
}

export interface PartnerMemberUpdateRequest {
  name?: string
  phone?: string
  email?: string
  roleCode?: 'enterprise_admin' | 'enterprise_member'
  status?: string
  password?: string
}

/** 企业自助注册请求（POST /auth/partner/register，注册即生效并签发 token） */
export interface PartnerRegisterRequest {
  enterpriseName: string
  unifiedSocialCreditCode: string
  contactPerson: string
  contactPhone: string
  contactEmail?: string
  username: string
  password: string
}

/** GET /auth/partner/me：用户信息 + 企业主体合并返回 */
export interface PartnerMeResponse {
  user: User
  enterprise?: PartnerEnterprise
  roles?: Role[]
}

/** GET /partner/workspace/dashboard：服务台统计 */
export interface PartnerDashboard {
  expertCount: number
  schoolCount: number
  memberCount: number
  publicExpertCount?: number
  /** 共建岗位/场景数量 */
  coBuildPositionCount?: number
  coBuildScenarioCount?: number
  /** 近 6 个月每月新增合作学校数（服务台柱状图） */
  monthlySchoolCounts?: { month: string; count: number }[]
  /** 近 6 个月每月新增专家/共建岗位/共建场景数（卡片趋势） */
  monthlyNewCounts?: {
    month: string
    experts: number
    positions: number
    scenarios: number
  }[]
  /** 近 6 个月每月合作项目/协议/成果数（折线图） */
  contentMonthlyCounts?: {
    month: string
    projects: number
    agreements: number
    achievements: number
  }[]
}

/** GET /partner/schools：合作学校（link 反向视图，对应后端 domain.AlliancePartnerSchool） */
export interface PartnerSchool {
  linkId: string
  tenantId: string
  schoolName: string
  relationType: string
  /** link 管理字段（学校侧维护，企业只读） */
  status: string
  rating?: string
  enterpriseType?: string
  isPublic: boolean
  createdAt: string
}

/** PUT /partner/me/password */
export interface PartnerChangePasswordRequest {
  oldPassword: string
  newPassword: string
}

/** PUT /partner/schools/{tenantId}/status：合作状态流转（negotiating→active、active↔paused、任意→terminated） */
export type PartnerSchoolStatus = 'active' | 'paused' | 'terminated'

export interface PartnerSchoolStatusUpdateRequest {
  status: PartnerSchoolStatus
}

/** GET /partner/cooperation：按学校分组的合作内容总览（只返回有内容的学校） */
export interface PartnerCooperationProject {
  id: string
  name: string
  phase: string
  isPublic: boolean
  updatedAt: string
}

export interface PartnerCooperationAchievement {
  id: string
  title: string
  type: string
  isPublic: boolean
  updatedAt: string
}

export interface PartnerCooperationAgreement {
  id: string
  name: string
  type: string
  status: string
  isPublic: boolean
  updatedAt: string
}

export interface PartnerCooperationSchool {
  tenantId: string
  schoolName: string
  projects: PartnerCooperationProject[]
  achievements: PartnerCooperationAchievement[]
  agreements: PartnerCooperationAgreement[]
}

export interface PartnerCooperationOverview {
  schools: PartnerCooperationSchool[]
}

/** GET /partner/cooperation/projects/{id}：合作项目详情（仅合作学校内容，企业只读） */
export interface PartnerCooperationProjectDetail {
  id: string
  name: string
  type?: string
  description?: string
  phase: string
  publishStatus: string
  startDate?: string
  endDate?: string
  budget?: string
  secondaryColleges: string[]
  isPublic: boolean
  createdAt: string
  updatedAt: string
  milestones: {
    id: string
    name: string
    description?: string
    dueDate?: string
    completedDate?: string
    isCompleted: boolean
  }[]
}

/** GET /partner/cooperation/achievements/{id}：合作成果详情（仅合作学校内容，企业只读） */
export interface PartnerCooperationAchievementDetail {
  id: string
  title: string
  type: string
  description?: string
  achievementDate?: string
  citationReason?: string
  ownerPersons: string[]
  coBuilders: string[]
  secondaryColleges: string[]
  status: string
  viewCount: number
  isPublic: boolean
  createdAt: string
  updatedAt: string
}

/** GET /partner/cooperation/agreements/{id}：合作协议详情（企业为合作当事方，可见正文） */
export interface PartnerCooperationAgreementDetail {
  id: string
  name: string
  type?: string
  content?: string
  startDate?: string
  endDate?: string
  status: string
  isPublic: boolean
  createdAt: string
  updatedAt: string
}

/** GET /partner/mentor-tasks：本企业专家被学校分配的测评任务（打分在学校端进行，企业只读） */
export interface PartnerMentorTask {
  taskId: string
  taskName: string
  stepLabel: string
  schoolName: string
  expertName: string
  /** 该任务分配给本企业专家的待评分对象数 */
  assignedCount: number
  /** 已完成评分的对象数 */
  gradedCount: number
  updatedAt: string
}

export interface PartnerMentorTaskList {
  items: PartnerMentorTask[]
}

/* ============================================================
   企业端资源共建（/partner/co-build/*）
   响应 DTO 对齐 portal 对应端点，外加 schoolTenantId/schoolName；
   sourceType/sourceEnterpriseId 已在 CareerPosition/Scenario 上（可选）。
   ============================================================ */

/** 共建内容状态（与学校端内容状态一致，六态） */
export type CoBuildStatus =
  | 'draft'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'published'
  | 'archived'

/** GET /partner/co-build/schools/{tenantId}/co-builders：共建人候选
 * （group=teacher 学校教师 | expert 企业专家；id 为可保存进 collaborators 的 users.id） */
export interface CoBuildUserOption {
  id: string
  name: string
  group: 'teacher' | 'expert'
  title?: string
  expertId?: string
  enterpriseName?: string
}

/** GET/POST /partner/co-build/positions：企业为学校共建的岗位（数据落在学校租户） */
export interface CoBuildPosition extends CareerPosition {
  schoolTenantId: string
  schoolName?: string
}

/** POST /partner/co-build/positions：学校 + 名称 + 岗位类型，后端落 draft + source 标记 */
export interface CoBuildPositionCreateRequest {
  schoolTenantId: string
  name: string
  positionType: string
}

/** POST /partner/co-build/positions/{id}/save-full：与 portal 岗位 save-full 请求同形 */
export interface CoBuildPositionSaveFullRequest {
  batchId: string
  name: string
  shortName: string
  industry: string
  majors: string[]
  positionType: string
  salaryRange: [number, number]
  coverImage?: string
  description?: string
  requirements: string[]
  careerPath?: string
  version: string
  collaborators: string[]
  responsibilities: { id: string; name: string; description?: string }[]
  certificates: {
    id: string
    name: string
    url?: string
    description?: string
    image?: string
  }[]
  abilityBindings: {
    id: string
    responsibilityId: string
    source: string
    publicAbilityId?: string
    abilityPointId?: string
    name: string
    level: string
    rubricDescription?: string
    description?: string
    attributes?: string[]
    domain?: string
  }[]
  abilityDomains: { id: string; name: string; description?: string; bindingIds: string[] }[]
}

/** GET/POST /partner/co-build/scenes：企业为学校共建的场景 */
export interface CoBuildScenario extends Scenario {
  schoolTenantId: string
  schoolName?: string
}

/** POST /partner/co-build/scenes：只需学校 + 名称，后端落 draft + source 标记 */
export interface CoBuildScenarioCreateRequest {
  schoolTenantId: string
  name: string
}

/** 共建场景任务（/partner/co-build/scenes/{id}/tasks 与 /partner/co-build/tasks/{taskId}） */
export type CoBuildTask = ScenarioTask
