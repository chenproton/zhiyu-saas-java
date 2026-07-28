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

export interface CertIssuanceRecord {
  id: string
  templateId: string
  templateTitle: string
  certTypeName: string
  studentName: string
  studentId: string
  className: string
  issueDate: Date
  expireDate?: Date
  status: IssueStatus
  certNumber: string
  revokedAt?: Date
  revokeReason?: string
}

export interface MicroCertTemplateFormData {
  title: string
  certTypeId: string
  content: string
  coverImage?: string
}
