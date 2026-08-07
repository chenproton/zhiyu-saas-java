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

// 证书发放记录：字段与后端 store/micro_cert.go 返回结构对齐
export interface CertIssuanceRecord {
  id: string
  templateId: string
  userId: string
  issueDate: string
  expireDate?: string
  status: IssueStatus
  certNumber: string
  revokedAt?: string
  revokeReason?: string
}

export interface MicroCertTemplateFormData {
  title: string
  certTypeId: string
  content: string
  coverImage?: string
}
