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
  isPublic: boolean
  createdBy?: string
  createdAt: string
  updatedAt: string
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
  secondaryColleges?: string[]
  isPublic: boolean
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
  relatedPositions?: string[]
  relatedScenes?: string[]
  relatedCourses?: string[]
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
  organization?: string
  rating?: string
  status: string
  secondaryColleges?: string[]
  isPublic: boolean
  createdBy?: string
  createdAt: string
  updatedAt: string
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
  attachments?: string[]
  createdAt: string
  updatedAt: string
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
    cooperation: "合作企业",
    "third-party": "第三方雇主企业",
    platform: "第三方雇主企业",
    "school-based": "合作企业",
  },
  enterpriseStatus: {
    negotiating: "洽谈中",
    active: "合作中",
    paused: "已暂停",
    terminated: "已终止",
  },
  enterpriseRating: {
    strategic: "战略合作",
    deep: "深度合作",
    general: "一般合作",
  },
  projectPhase: {
    initiation: "启动",
    execution: "执行中",
    acceptance: "验收",
    closure: "关闭",
    archived: "已归档",
    terminated: "已终止",
  },
  publishStatus: {
    draft: "草稿",
    published: "已发布",
    archived: "已归档",
  },
  achievementType: {
    job: "岗位成果",
    scene: "场景成果",
    course: "课程成果",
    custom: "自定义成果",
  },
  achievementStatus: {
    draft: "草稿",
    published: "已发布",
    archived: "已归档",
  },
  agreementStatus: {
    draft: "草稿",
    active: "生效中",
    expired: "已失效",
    renewed: "已续签",
    terminated: "已终止",
  },
  accountType: {
    enterprise: "企业账号",
    expert: "专家账号",
  },
  expertRating: {
    gold: "金牌专家",
    silver: "银牌专家",
    copper: "铜牌专家",
  },
  expertStatus: {
    active: "正常",
    inactive: "已停用",
  },
  brandType: {
    talent: "人才品牌",
    employer: "雇主品牌",
    job: "岗位品牌",
    major: "专业品牌",
    teacher: "师资品牌",
    culture: "文化品牌",
  },
  brandStatus: {
    draft: "草稿",
    published: "已发布",
    archived: "已归档",
  },
  brandTopicLayout: {
    grid: "网格布局",
    timeline: "时间线布局",
    magazine: "杂志布局",
  },
} as const

export type AllianceDictKey = keyof typeof ALLIANCE_DICTS

/** 将英文枚举值转换为中文展示文案，未知值原样返回。 */
export function allianceLabel(dictKey: AllianceDictKey, value?: string | null): string {
  if (value == null || value === "") return "-"
  const dict = ALLIANCE_DICTS[dictKey] as Record<string, string>
  return dict[value] ?? value
}
