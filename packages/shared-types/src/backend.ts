export interface Tenant {
  id: string
  name: string
  code: string
  logoUrl?: string
  domain?: string
  enterpriseCode?: string
  contact?: string
  phone?: string
  address?: string
  description?: string
  adminIds: string[]
  status: "active" | "inactive"
  createdAt: string
  updatedAt: string
}

export interface Organization {
  id: string
  tenantId: string
  name: string
  typeId: string
  parentId?: string
  sortOrder: number
  memberCount: number
  children?: Organization[]
  createdAt: string
  updatedAt: string
}

export interface OrgType {
  id: string
  tenantId: string
  name: string
  category: "internal" | "business" | "external"
  description?: string
  isDefault?: boolean
  createdAt: string
}

export interface UserExtensionField {
  id: string
  tenantId: string
  fieldKey: string
  fieldName: string
  fieldType: "text" | "number" | "date" | "select"
  isEnabled: boolean
  isRequired: boolean
  applicableRoleCodes: string[]
  slotNumber: number
  createdAt: string
}

export interface UserRelation {
  id: string
  tenantId: string
  initiatorId: string
  initiatorOrgNodeId?: string
  targetId: string
  targetOrgNodeId?: string
  relationType: string
  description?: string
  createdAt: string
}

export interface StaffTitle {
  id: string
  tenantId: string
  code: string
  name: string
  description?: string
  userCount: number
  status: string
  createdAt: string
}

export interface Role {
  id: string
  tenantId: string
  code: string
  name: string
  description?: string
  permissions: Record<string, any>
  userCount: number
  status: string
  createdAt: string
}

export interface UserRoleBinding {
  id: string
  userId: string
  roleId: string
}

export interface LoginLog {
  id: string
  tenantId: string
  userId?: string
  userName?: string
  ip?: string
  location?: string
  device?: string
  status?: string
  createdAt: string
}

export interface OperationLog {
  id: string
  tenantId: string
  userId?: string
  userName?: string
  module?: string
  action: string
  targetType?: string
  targetId?: string
  detail?: string
  ip?: string
  status?: string
  createdAt: string
}

export interface Major {
  id: string
  tenantId: string
  orgNodeId?: string
  code: string
  name: string
  alias?: string
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export interface Industry {
  id: string
  tenantId: string
  code: string
  name: string
  parentId?: string
  enabled: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface ResourceCode {
  id: string
  tenantId: string
  code: string
  name: string
  description?: string
  type: "public" | "custom"
  createdAt: string
}

export interface SubscriptionPackage {
  id: string
  tenantId: string
  name: string
  validUntil?: string
  modules: Record<string, any>
  status: string
  createdAt: string
  updatedAt: string
}

export interface AppModule {
  id: string
  platform: string
  title: string
  description?: string
  href?: string
  sortOrder: number
}

export interface PlatformLink {
  id: string
  platform: string
  url: string
  enabled: boolean
}

export interface WorkflowStep {
  name: string
  order: number
  approverIds: string[]
  approvalMode: "any" | "all"
}

export interface Workflow {
  id: string
  tenantId?: string
  name: string
  scene?: string
  description?: string
  steps: WorkflowStep[]
  majorIds: string[]
  usageCount: number
  status: "active" | "inactive"
  createdAt: string
}

export interface ApprovalHistoryItem {
  stepId: string
  stepName: string
  reviewerId?: string
  reviewerName?: string
  status: string
  comment?: string
  createdAt: string
}

export interface ApprovalRecord {
  id: string
  tenantId?: string
  targetType: string
  targetId: string
  workflowId?: string
  currentStepIdx: number
  status: "pending" | "approved" | "rejected"
  submitterId: string
  history: ApprovalHistoryItem[]
  createdAt: string
  updatedAt: string
}
