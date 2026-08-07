// 审批类型：与后端 store/approvals.go 的审批 targetType 合法值对齐
export type ApprovalType =
  | 'career_position'
  | 'scenario'
  | 'course'
  | 'question_bank'
  | 'exam'
  | 'training_program'
  | 'teaching_plan'

export const APPROVAL_TYPE_LABELS: Record<ApprovalType, string> = {
  career_position: '岗位',
  scenario: '场景',
  course: '课程',
  question_bank: '题库',
  exam: '试卷',
  training_program: '人培方案',
  teaching_plan: '教学计划',
}

// 审批状态
export type ApprovalStatus = 'pending' | 'approved' | 'rejected'

export const APPROVAL_STATUS_LABELS: Record<ApprovalStatus, string> = {
  pending: '待审批',
  approved: '已通过',
  rejected: '已驳回',
}

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
