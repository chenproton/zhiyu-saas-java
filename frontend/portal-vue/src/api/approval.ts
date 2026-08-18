import { request, buildQuery } from './http';
import type { ListResponse } from './http';
import type { ApprovalRecord } from '@/types/approval';

export const approvalApi = {
  list: (params?: {
    targetType?: string;
    targetId?: string;
    status?: string;
    submitterId?: string;
    limit?: number;
    offset?: number;
  }) => request<ListResponse<ApprovalRecord>>(`/approvals${buildQuery(params || {})}`),
  review: (id: string, req: { status: 'approved' | 'rejected'; comment?: string; stepIdx?: number }) =>
    request<ApprovalRecord>(`/approvals/${id}/review`, {
      method: 'POST',
      body: JSON.stringify({ action: req.status, remark: req.comment, nextStepIdx: req.stepIdx })
    })
};
