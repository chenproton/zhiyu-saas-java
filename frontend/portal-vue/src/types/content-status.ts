// 统一内容状态机（五类内容资源：岗位/场景/课程/题库/试卷）
export type ContentStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'published' | 'archived';

export const CONTENT_STATUS_LABELS: Record<ContentStatus, string> = {
  draft: '草稿',
  pending: '审批中',
  approved: '待发布',
  rejected: '已驳回',
  published: '已发布',
  archived: '已归档'
};

export function contentStatusLabel(status: string): string {
  return CONTENT_STATUS_LABELS[status as ContentStatus] || status;
}
