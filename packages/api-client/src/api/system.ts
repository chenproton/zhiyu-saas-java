import type {
  Organization,
  OrgType,
  Role,
  Major,
  Industry,
  Workflow,
  ApprovalRecord,
} from '../types/backend'
import { request, buildQuery, ListResponse } from '../api-helpers'
import { createCrudApi } from '../api-factory'

export const orgApi = {
  ...createCrudApi<
    Organization,
    Omit<Organization, 'id' | 'createdAt' | 'updatedAt'>,
    Partial<Omit<Organization, 'id' | 'createdAt' | 'updatedAt'>>
  >('/organizations'),
  tree: (params?: { tenantId?: string; typeId?: string }) =>
    request<{ items: (Organization & { children?: (Organization & { children?: any[] })[] })[] }>(
      `/organizations/tree${buildQuery(params || {})}`,
    ),
}

export const orgTypeApi = createCrudApi<
  OrgType,
  Omit<OrgType, 'id' | 'createdAt'>,
  Partial<Omit<OrgType, 'id' | 'createdAt'>>
>('/org-types')

export const roleApi = {
  ...createCrudApi<
    Role,
    Omit<Role, 'id' | 'userCount' | 'createdAt'>,
    Partial<Omit<Role, 'id' | 'userCount' | 'createdAt'>>
  >('/roles'),
  assign: (id: string, userId: string) =>
    request<Role>(`/roles/${id}/assign`, { method: 'POST', body: JSON.stringify({ userId }) }),
}

export const majorApi = createCrudApi<
  Major,
  Omit<Major, 'id' | 'createdAt' | 'updatedAt'>,
  Partial<Omit<Major, 'id' | 'createdAt' | 'updatedAt'>>
>('/majors')

export const industryApi = createCrudApi<
  Industry,
  Omit<Industry, 'id' | 'createdAt' | 'updatedAt'>,
  Partial<Omit<Industry, 'id' | 'createdAt' | 'updatedAt'>>
>('/industries')

export const workflowApi = createCrudApi<
  Workflow,
  Omit<Workflow, 'id' | 'usageCount' | 'createdAt'>,
  Partial<Omit<Workflow, 'id' | 'usageCount' | 'createdAt'>>
>('/workflows')

export const approvalApi = {
  list: (params?: {
    targetType?: string
    targetId?: string
    status?: string
    submitterId?: string
    limit?: number
    offset?: number
  }) => request<ListResponse<ApprovalRecord>>(`/approvals${buildQuery(params || {})}`),
  get: (id: string) => request<ApprovalRecord>(`/approvals/${id}`),
  create: (req: { targetType: string; targetId: string; workflowId?: string }) =>
    request<ApprovalRecord>('/approvals', { method: 'POST', body: JSON.stringify(req) }),
  review: (
    id: string,
    req: { status: 'approved' | 'rejected'; comment?: string; stepIdx?: number },
  ) =>
    request<ApprovalRecord>(`/approvals/${id}/review`, {
      method: 'POST',
      body: JSON.stringify({ action: req.status, remark: req.comment, nextStepIdx: req.stepIdx }),
    }),
}
