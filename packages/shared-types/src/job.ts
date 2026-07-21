export interface CareerPosition {
  id: string
  batchId?: string
  name: string
  shortName?: string
  industryId?: string
  majorIds: string[]
  majorNames?: string[]
  positionType: "enterprise" | "teaching"
  salaryMin?: number
  salaryMax?: number
  coverImage?: string
  description?: string
  requirements: string[]
  careerPath?: string
  version: string
  status: "draft" | "pending" | "approved" | "rejected" | "published" | "archived"
  createdBy: string
  createdByName?: string
  collaborators: string[]
  collaboratorNames?: string[]
  favoriteCount?: number
  viewCount?: number
  createdAt: string
  updatedAt: string
}

export interface PositionCertificate {
  id: string
  careerPositionId: string
  certificateLibraryId: string
  name: string
  url?: string
  description?: string
  imageUrl?: string
}

export interface CertificateLibraryItem {
  id: string
  tenantId: string
  name: string
  url?: string
  description?: string
  imageUrl?: string
  createdAt: string
}

export interface PositionResponsibility {
  id: string
  careerPositionId: string
  name: string
  description?: string
  sortOrder: number
}

export interface AbilityPoint {
  id: string
  name: string
  code?: string
  description?: string
  category: "knowledge" | "skill" | "quality"
  attributes: string[]
  isPublic: boolean
  createdAt: string
}

export interface PositionAbilityBinding {
  id: string
  careerPositionId: string
  responsibilityId: string
  abilityPointId: string
  source: "public" | "custom"
  domain?: string
  requiredLevel: string
  rubricDescription?: string
  attributes: string[]
  weight: number
}

export interface AbilityDomain {
  id: string
  careerPositionId: string
  name: string
  description?: string
  bindingIds: string[]
  sortOrder: number
}

export interface JobBatch {
  id: string
  tenantId?: string
  name: string
  code?: string
  orgNodeId?: string
  majorId?: string
  majorName?: string // Deprecated: 仅兼容旧读取
  workflowId?: string
  status: "open" | "closed"
  positionCount: number
  publishedCount: number
  pendingCount: number
  createdAt: string
  updatedAt: string
}

export interface PositionRecommendation {
  id: string
  majorId?: string
  majorName?: string
  careerPositionId: string
  positionType: string
  reason?: string
  sortOrder: number
  isEnabled: boolean
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface BannerConfig {
  id: string
  title: string
  imageUrl: string
  linkUrl?: string
  sortOrder: number
  isEnabled: boolean
  createdAt: string
  updatedAt: string
}

export interface LearnRoadStep {
  name: string
  description?: string
  resourceIds?: string[]
  tasks?: { id: string; name: string }[]
}

export interface LearnRoad {
  id: string
  name: string
  description?: string
  positionIds: string[]
  steps?: LearnRoadStep[]
  createdAt: string
  updatedAt: string
}
