import type { StudentHonor, StudentHonorPayload } from '../types/portal'
import { request, buildQuery, ListResponse } from '../api-helpers'

export const studentHonorApi = {
  list: (params?: { userId?: string }) =>
    request<ListResponse<StudentHonor>>(`/portal/workspace/honors${buildQuery(params || {})}`),
  create: (req: StudentHonorPayload) =>
    request<{ id: string }>('/portal/workspace/honors', { method: 'POST', body: JSON.stringify(req) }),
  update: (id: string, req: StudentHonorPayload) =>
    request<{ id: string }>(`/portal/workspace/honors/${id}`, { method: 'PUT', body: JSON.stringify(req) }),
  remove: (id: string) => request<{ id: string }>(`/portal/workspace/honors/${id}`, { method: 'DELETE' }),
}
