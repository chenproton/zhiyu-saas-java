// 用户接口（全仓唯一权威定义，api-client 从此处 re-export）
export interface User {
  id: string
  tenantId?: string
  institutionId?: string
  orgNodeId?: string
  majorId?: string
  role: 'school' | 'enterprise' | 'operator'
  platform: 'saas' | 'portal'
  roleIds?: string[]
  roleCodes?: string[]
  roleNames?: string[]
  loginName?: string
  username: string
  name: string
  email?: string
  phone?: string
  avatarUrl?: string
  studentNo?: string
  workId?: string
  idCard?: string
  titleIds?: string[]
  oauth?: Record<string, any>
  status: string
  graduateYear?: number
  lastLoginAt?: string
  createdAt: string
  updatedAt: string
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
