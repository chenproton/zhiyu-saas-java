// 审批类型
export type ApprovalType = 'question' | 'questionBank' | 'exam' | 'onlineExam'

export const APPROVAL_TYPE_LABELS: Record<ApprovalType, string> = {
  question: '题目',
  questionBank: '题库',
  exam: '试卷',
  onlineExam: '在线考试',
}

// 审批状态
export type ApprovalStatus = 'pending' | 'approved' | 'rejected'

export const APPROVAL_STATUS_LABELS: Record<ApprovalStatus, string> = {
  pending: '待审批',
  approved: '已通过',
  rejected: '已驳回',
}

// 审批项
export interface ApprovalItem {
  id: string
  type: ApprovalType
  title: string
  description?: string
  submitterName: string
  submitTime: Date
  status: ApprovalStatus
  remark?: string
}
