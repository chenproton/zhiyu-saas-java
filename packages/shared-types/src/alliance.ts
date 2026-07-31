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
  enterpriseIds?: string[]
  projectIds?: string[]
  relatedPositions?: string[]
  relatedScenes?: string[]
  relatedCourses?: string[]
  status: string
  viewCount: number
  secondaryColleges?: string[]
  isPublic: boolean
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
  photos?: string[]
  attachments?: string[]
  enterpriseId?: string
  rating?: string
  status: string
  secondaryColleges?: string[]
  isPublic: boolean
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

export interface AllianceBrandTopic {
  id: string
  tenantId: string
  name: string
  theme?: string
  description?: string
  layout: string
  coverImage?: string
  contentBlocks?: any[]
  relatedBrandIds?: string[]
  status: string
  isRecommended: boolean
  sortOrder: number
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
