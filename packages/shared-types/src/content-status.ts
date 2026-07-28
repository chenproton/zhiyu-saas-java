// 状态枚举：与后端 content_status 保持一致
export type Status = 'draft' | 'pending' | 'approved' | 'rejected' | 'published' | 'archived'

// 状态中文映射
export const STATUS_LABELS: Record<Status, string> = {
  draft: '草稿',
  pending: '审批中',
  approved: '已通过',
  rejected: '已驳回',
  published: '已发布',
  archived: '已归档',
}

// 状态流转操作
export type StatusAction =
  | 'save_draft'      // 保存草稿
  | 'submit'          // 提交审批
  | 'withdraw'        // 撤回
  | 'approve'         // 通过
  | 'reject'          // 驳回
  | 'publish'         // 发布
  | 'unpublish'       // 取消发布
  | 'archive'         // 归档

// 状态流转规则：与后端状态机保持一致
export const STATUS_TRANSITIONS: Record<StatusAction, { from: Status[], to: Status }> = {
  save_draft: { from: ['draft', 'rejected', 'approved', 'published', 'archived'], to: 'draft' },
  submit: { from: ['draft', 'rejected'], to: 'pending' },
  withdraw: { from: ['pending'], to: 'draft' },
  approve: { from: ['pending'], to: 'approved' },
  reject: { from: ['pending'], to: 'rejected' },
  publish: { from: ['approved'], to: 'published' },
  unpublish: { from: ['published'], to: 'draft' },
  archive: { from: ['draft', 'rejected', 'approved', 'published'], to: 'archived' },
}

// 判断操作是否可用
export function canPerformAction(currentStatus: Status, action: StatusAction): boolean {
  const transition = STATUS_TRANSITIONS[action]
  return transition.from.includes(currentStatus)
}

// 获取下一个状态
export function getNextStatus(action: StatusAction): Status {
  return STATUS_TRANSITIONS[action].to
}
