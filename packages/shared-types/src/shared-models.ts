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
