// 审批类型：与后端 store/approvals.go 的审批 targetType 合法值对齐
export type ApprovalType =
  | 'career_position'
  | 'scenario'
  | 'course'
  | 'question_bank'
  | 'exam'
  | 'training_program'
  | 'teaching_plan'

// 审批状态
export type ApprovalStatus = 'pending' | 'approved' | 'rejected'

// 审批项：与后端 domain.ApprovalRecord 结构对齐
export interface ApprovalItem {
  id: string
  tenantId?: string
  targetType: string
  targetId: string
  workflowId?: string
  currentStepIdx: number
  status: string
  submitterId: string
  history: unknown[]
  createdAt: string
  updatedAt: string
}
