import type { PositionResponsibility, PositionCertificate } from './job'

export interface AllianceSchoolInfo {
  id: string
  tenantId: string
  name: string
  shortName?: string
  schoolType?: string
  province?: string
  city?: string
  address?: string
  website?: string
  contactPhone?: string
  description?: string
  logoUrl?: string
  scaleData?: Record<string, any>
  secondaryColleges?: Array<{ name: string; description?: string }>
  createdAt: string
  updatedAt: string
}

export interface AllianceEnterprise {
  id: string
  tenantId: string
  name: string
  enterpriseType: string
  industry?: string
  region?: string
  description?: string
  logoUrl?: string
  coverImage?: string
  status: string
  rating?: string
  cooperationTypes?: string[]
  contactPerson?: string
  contactPhone?: string
  contactEmail?: string
  address?: string
  unifiedSocialCreditCode?: string
  establishedYear?: number
  employeeCount?: number
  businessLicensePhotos?: string[]
  qualificationPhotos?: string[]
  intellectualPropertyPhotos?: string[]
  coverPhotos?: string[]
  secondaryColleges?: string[]
  ratingRecord?: Record<string, any>
  /** 学校侧 link 字段：是否在本校前台展示（与企业侧 enablePublic 双控） */
  isPublic: boolean
  /** 企业侧主体字段：企业"愿意对外展示"开关（企业服务台维护，学校只读） */
  enablePublic?: boolean
  /** 门户前台公开列表返回：该校与该企业的合作项目数 */
  projectCount?: number
  /** 门户前台公开列表返回：该校与该企业的合作协议数 */
  agreementCount?: number
  /** 门户前台公开列表返回：该校与该企业的合作成果数 */
  achievementCount?: number
  createdBy?: string
  createdAt: string
  updatedAt: string
}

/** 学校侧企业更新请求（PUT /alliance/enterprises/{id}）：仅 link 管理字段 */
export interface AllianceEnterpriseLinkUpdate {
  rating?: string
  status?: string
  enterpriseType?: string
  isPublic?: boolean
  secondaryColleges?: string[]
}

/** 学校代注册企业请求（POST /alliance/enterprises/register）：创建企业租户并直接建立合作关联 */
export interface AllianceEnterpriseRegisterRequest {
  enterpriseName: string
  username: string
  password: string
  unifiedSocialCreditCode?: string
  contactPerson?: string
  contactPhone?: string
  contactEmail?: string
}

export interface AllianceEnterpriseAgreement {
  id: string
  tenantId: string
  enterpriseId: string
  name: string
  type?: string
  startDate?: string
  endDate?: string
  status: string
  content?: string
  attachments?: string[]
  createdAt: string
  updatedAt: string
}

export interface AllianceProject {
  id: string
  tenantId: string
  name: string
  type?: string
  description?: string
  phase: string
  publishStatus: string
  startDate?: string
  endDate?: string
  budget?: string
  coverImage?: string
  enterpriseIds?: string[]
  /** 关联的合作协议 id 列表（与协议.projectIds 双向同步） */
  agreementIds?: string[]
  secondaryColleges?: string[]
  isPublic: boolean
  /** 里程碑完成率（0-100），公开接口返回：已完成里程碑数 / 里程碑总数 × 100 */
  progress?: number
  createdBy?: string
  createdAt: string
  updatedAt: string
}

export interface AllianceProjectMilestone {
  id: string
  tenantId: string
  projectId: string
  name: string
  description?: string
  dueDate?: string
  completedDate?: string
  isCompleted: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

/** 成果关联对象（岗位/场景/课程）快照：关联时保存关键展示字段，前台据此渲染对象卡片 */
export interface AllianceRelatedRef {
  id: string
  name: string
  code?: string
  coverImage?: string
}

export interface AllianceAchievement {
  id: string
  tenantId: string
  title: string
  type: string
  description?: string
  achievementDate?: string
  coverImage?: string
  attachments?: string[]
  citationReason?: string
  images?: string[]
  ownerPersons?: string[]
  coBuilders?: string[]
  enterpriseIds?: string[]
  projectIds?: string[]
  relatedPositions?: AllianceRelatedRef[]
  relatedScenes?: AllianceRelatedRef[]
  relatedCourses?: AllianceRelatedRef[]
  status: string
  viewCount: number
  secondaryColleges?: string[]
  isPublic: boolean
  createdBy?: string
  createdAt: string
  updatedAt: string
}

export interface AllianceExpert {
  id: string
  tenantId: string
  name: string
  gender?: string
  age?: number
  title?: string
  position?: string
  expertType?: string
  industry?: string
  professionalFields?: string[]
  specialties?: string[]
  experienceYears?: number
  education?: string
  introduction?: string
  workExperience?: string
  city?: string
  avatarUrl?: string
  coverImage?: string
  partnerSource?: string
  positionDirection?: string
  photos?: string[]
  attachments?: string[]
  enterpriseId?: string
  /** 归属企业名称（前台公开接口返回） */
  enterpriseName?: string
  organization?: string
  /** 绑定的企业成员账号（partner 平台 users.id，可空） */
  userId?: string
  rating?: string
  status: string
  secondaryColleges?: string[]
  isPublic: boolean
  createdBy?: string
  createdAt: string
  updatedAt: string
}

/** 共建导师选项（GET /alliance/experts/mentor-options）：本校已引入企业的专家 + 绑定账号 */
export interface AllianceMentorOption {
  expertId: string
  name: string
  title?: string
  enterpriseId: string
  enterpriseName?: string
  /** 专家绑定的企业成员账号（partner 平台 users.id）；无绑定账号为 null，不可勾选 */
  userId: string | null
}

export interface AllianceAgreement {
  id: string
  tenantId: string
  name: string
  type?: string
  content?: string
  startDate?: string
  endDate?: string
  status: string
  enterpriseIds?: string[]
  projectIds?: string[]
  attachments?: string[]
  isPublic?: boolean
  createdBy?: string
  createdAt: string
  updatedAt: string
}

/** 门户前台公开协议视图（后端不暴露 content/attachments） */
export interface AlliancePublicAgreement {
  id: string
  name: string
  type?: string
  status: string
  startDate?: string
  endDate?: string
  enterpriseIds?: string[]
  /** 关联的项目 id（前台协议-项目二次关联） */
  projectIds?: string[]
}

export interface AlliancePermission {
  id: string
  tenantId: string
  accountName: string
  accountType: string
  enterpriseId?: string
  expertId?: string
  isEnabled: boolean
  resourcePermissions?: any[]
  platformPermissions?: string[]
  createdAt: string
  updatedAt: string
}

export interface AllianceDictionary {
  id: string
  tenantId: string
  dictType: string
  code: string
  name: string
  sortOrder: number
  createdAt: string
}

export interface AllianceBrand {
  id: string
  tenantId: string
  brandType: string
  name: string
  status: string
  isPublic: boolean
  isFeatured: boolean
  coverImage?: string
  coverVideo?: string
  description?: string
  data: Record<string, any>
  studentId?: string
  enterpriseId?: string
  positionId?: string
  majorId?: string
  teacherId?: string
  expertId?: string
  sortOrder: number
  viewCount: number
  createdAt: string
  updatedAt: string
}

// EmployerBrand 雇主品牌视图（引用企业资料只读展示）
export interface EmployerBrand extends AllianceBrand {
  enterpriseName?: string
  enterpriseLogo?: string
  enterpriseIndustry?: string
  enterpriseRegion?: string
  enterpriseDescription?: string
  enterpriseCreditCode?: string
  enterpriseContactPerson?: string
  enterpriseContactPhone?: string
  enterpriseContactEmail?: string
  enterpriseAddress?: string
  enterpriseEstablishedYear?: number
  enterpriseEmployeeCount?: number
  enterpriseCoverImage?: string
  enterpriseCoverPhotos?: string[]
  enterpriseBusinessLicensePhotos?: string[]
  enterpriseIntellectualPropertyPhotos?: string[]
  enterpriseQualificationPhotos?: string[]
}

// JobBrand 岗位品牌视图（关联岗位资料；教学岗位只读，企业岗位可在品牌模块编辑）
export interface JobBrand extends AllianceBrand {
  positionName?: string
  positionType?: string
  salaryMin?: number
  salaryMax?: number
  majorNames?: string[]
  positionStatus?: string
}

// AlliancePublicBrand 前台公开品牌视图：按品牌类型附带关联对象资料
// （雇主→引用企业资料，岗位→关联岗位资料，师资→教师/企业专家资料），
// landing / 品牌列表 / 品牌详情共用同一形状，各类型仅填充相关字段。
export interface AlliancePublicBrand extends AllianceBrand {
  // 雇主品牌：引用合作企业资料（独立雇主企业时为空，取 data.enterpriseInfo）
  enterpriseName?: string
  enterpriseLogo?: string
  enterpriseIndustry?: string
  enterpriseRegion?: string
  enterpriseDescription?: string
  enterpriseCreditCode?: string
  enterpriseContactPerson?: string
  enterpriseContactPhone?: string
  enterpriseContactEmail?: string
  enterpriseAddress?: string
  enterpriseEstablishedYear?: number
  enterpriseEmployeeCount?: number
  enterpriseCoverImage?: string
  enterpriseCoverPhotos?: string[]
  enterpriseBusinessLicensePhotos?: string[]
  enterpriseIntellectualPropertyPhotos?: string[]
  enterpriseQualificationPhotos?: string[]
  // 岗位品牌：关联岗位资料
  positionName?: string
  positionType?: string
  salaryMin?: number
  salaryMax?: number
  majorNames?: string[]
  industryName?: string
  positionStatus?: string
  positionDescription?: string
  positionRequirements?: string[]
  positionCareerPath?: string
  positionCoverImage?: string
  responsibilities?: PositionResponsibility[]
  certificates?: PositionCertificate[]
  // 师资品牌：教师/企业专家资料（专家档案优先，教师基础信息兜底）
  personName?: string
  personAvatar?: string
  personTitle?: string
  personPosition?: string
  personOrganization?: string
  personIndustry?: string
  personExperienceYears?: number
  personEducation?: string
  personIntroduction?: string
  personWorkExperience?: string
  personCity?: string
  personExpertType?: string
  personRating?: string
  personStatus?: string
  personGender?: string
  personAge?: number
  personSpecialties?: string[]
  personProfessionalFields?: string[]
  personAttachments?: string[]
}

// BrandMajorRankConfig 人才画像排名-专业启用配置
export interface BrandMajorRankConfig {
  majorId: string
  enabled: boolean
  rankLimit: number
}

// TalentRankPosition 学生单个岗位评估明细
export interface TalentRankPosition {
  positionId: string
  positionName: string
  achievementRate: number
  positionCompetency?: number
  positionCompetencyV2?: number
  abilityCognitionScore?: number
  totalAbilityPoints: number
  achievedAbilityPoints: number
  grade?: string
  evaluatedAt: string
  abilityPointDetails?: any
}

// TalentRankStudent 学生画像排名行（多岗位四指标平均）
export interface TalentRankStudent {
  studentId: string
  studentNo: string
  name: string
  majorId?: string
  majorName: string
  className: string
  departmentName: string
  avgAchievementRate?: number
  avgPositionCompetency?: number
  avgPositionCompetencyV2?: number
  avgAbilityCognitionScore?: number
  positionCount: number
  latestEvaluatedAt?: string
  positions?: TalentRankPosition[]
}

// TalentRankMajorGroup 人才画像排名-专业分组
export interface TalentRankMajorGroup {
  majorId: string
  majorName: string
  enabled: boolean
  rankLimit: number
  studentCount: number
  students: TalentRankStudent[]
}

export interface AlliancePublicStats {
  enterpriseCount: number
  projectCount: number
  expertCount: number
  achievementCount: number
  brandCount: number
}

export interface AllianceListResponse<T> {
  items: T[]
  total: number
}

// ===== 中文字典映射（展示用） =====

export const ALLIANCE_DICTS = {
  enterpriseType: {
    cooperation: '合作企业',
    'third-party': '第三方雇主企业',
    platform: '第三方雇主企业',
    'school-based': '合作企业',
  },
  enterpriseStatus: {
    negotiating: '洽谈中',
    active: '合作中',
    paused: '已暂停',
    terminated: '已终止',
  },
  enterpriseRating: {
    strategic: '战略合作',
    deep: '深度合作',
    general: '一般合作',
  },
  projectPhase: {
    initiation: '启动',
    execution: '执行中',
    acceptance: '验收',
    closure: '关闭',
    archived: '已归档',
    terminated: '已终止',
  },
  publishStatus: {
    draft: '草稿',
    published: '已发布',
    archived: '已归档',
  },
  achievementType: {
    job: '岗位成果',
    scene: '场景成果',
    course: '课程成果',
    custom: '自定义成果',
  },
  achievementStatus: {
    draft: '草稿',
    published: '已发布',
    archived: '已归档',
  },
  agreementStatus: {
    draft: '草稿',
    active: '生效中',
    expired: '已失效',
    renewed: '已续签',
    terminated: '已终止',
  },
  accountType: {
    enterprise: '企业账号',
    expert: '专家账号',
  },
  expertRating: {
    gold: '金牌专家',
    silver: '银牌专家',
    copper: '铜牌专家',
  },
  expertStatus: {
    active: '正常',
    inactive: '已停用',
  },
  brandType: {
    talent: '人才品牌',
    employer: '雇主品牌',
    job: '岗位品牌',
    major: '专业品牌',
    teacher: '师资品牌',
    culture: '文化品牌',
  },
  brandStatus: {
    draft: '草稿',
    published: '已发布',
    archived: '已归档',
  },
  brandTopicLayout: {
    grid: '网格布局',
    timeline: '时间线布局',
    magazine: '杂志布局',
  },
} as const

export type AllianceDictKey = keyof typeof ALLIANCE_DICTS

// 运行时字典（由联盟字典管理页配置，前端登录后注册覆盖静态映射）：
// key = ALLIANCE_DICTS 的键（如 enterpriseStatus），value = code → 展示名。
let runtimeAllianceDicts: Record<string, Record<string, string>> | null = null

/** 注册运行时字典（联盟字典管理页数据），allianceLabel 优先取用，未注册/缺失时回退静态映射。 */
export function registerAllianceDicts(
  dicts: Record<string, Record<string, string>>,
): void {
  runtimeAllianceDicts = dicts
}

/** 将英文枚举值转换为中文展示文案，未知值原样返回。 */
export function allianceLabel(dictKey: AllianceDictKey, value?: string | null): string {
  if (value == null || value === '') return '-'
  const dict =
    (runtimeAllianceDicts && runtimeAllianceDicts[dictKey]) ||
    (ALLIANCE_DICTS[dictKey] as Record<string, string>)
  return dict[value] ?? value
}

// ==================== 就业服务管理（人才与岗位供需服务大厅） ====================

/** 就业项目类型 */
export type EmploymentProjectType = 'spring' | 'autumn' | 'directed' | 'order' | (string & {})

export const EMPLOYMENT_PROJECT_TYPE_LABELS: Record<string, string> = {
  spring: '春季招聘',
  autumn: '秋季招聘',
  directed: '定向招聘',
  order: '订单班招聘',
}

/** 就业项目展示状态（由起止日期派生，不落库） */
export type EmploymentProjectPhase = 'preparing' | 'ongoing' | 'ended'

export const EMPLOYMENT_PROJECT_PHASE_LABELS: Record<EmploymentProjectPhase, string> = {
  preparing: '筹备中',
  ongoing: '进行中',
  ended: '已结束',
}

/** 由起止日期派生项目展示状态 */
export function deriveEmploymentProjectPhase(p: {
  startDate?: string
  endDate?: string
}): EmploymentProjectPhase {
  const today = new Date().toISOString().slice(0, 10)
  if (p.startDate && p.startDate > today) return 'preparing'
  if (p.endDate && p.endDate < today) return 'ended'
  return 'ongoing'
}

/** 面向学生群体条件（组内 AND、组间 OR；空数组 = 面向全校） */
export interface EmploymentTargetGroup {
  orgNodeId?: string
  orgNodeName?: string
  majorId?: string
  majorName?: string
  graduateYear?: number
}

export interface EmploymentProject {
  id: string
  tenantId: string
  name: string
  type: EmploymentProjectType
  organizer?: string
  description?: string
  /** 封面图 URL（landing/大厅封面大卡；空则用默认占位） */
  coverImage?: string
  startDate?: string
  endDate?: string
  publishStatus: 'draft' | 'published'
  enterpriseIds?: string[]
  targetGroups?: EmploymentTargetGroup[]
  createdBy?: string
  createdAt: string
  updatedAt: string
  jobCount: number
  applicationCount: number
}

/** 岗位类型 */
export type EmploymentJobType = 'full-time' | 'part-time' | 'internship' | 'apprentice'

export const EMPLOYMENT_JOB_TYPE_LABELS: Record<EmploymentJobType, string> = {
  'full-time': '全职',
  'part-time': '兼职',
  internship: '实习',
  apprentice: '学徒',
}

/** 岗位状态 */
export type EmploymentJobStatus = 'draft' | 'published' | 'closed'

export const EMPLOYMENT_JOB_STATUS_LABELS: Record<EmploymentJobStatus, string> = {
  draft: '草稿',
  published: '招聘中',
  closed: '已关闭',
}

export interface EmploymentJob {
  id: string
  tenantId: string
  enterpriseId: string
  projectId?: string
  title: string
  jobType: EmploymentJobType
  location?: string
  /** 薪资范围（千元/月） */
  salaryMin?: number
  salaryMax?: number
  headcount?: number
  education?: string
  suitableMajors?: string[]
  description?: string
  responsibilities?: string
  requirements?: string
  contactPerson?: string
  contactPhone?: string
  deadline?: string
  status: EmploymentJobStatus
  createdBy?: string
  createdAt: string
  updatedAt: string
  enterpriseName?: string
  projectName?: string
  applicationCount: number
}

export interface EmploymentApplication {
  id: string
  tenantId: string
  jobId: string
  enterpriseId: string
  studentId: string
  studentName?: string
  studentNo?: string
  majorName?: string
  className?: string
  phone?: string
  email?: string
  coverLetter?: string
  status: 'pending'
  createdAt: string
  updatedAt: string
  jobTitle?: string
  enterpriseName?: string
  projectName?: string
}
