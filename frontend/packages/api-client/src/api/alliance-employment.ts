import type {
  AllianceListResponse,
  EmploymentApplication,
  EmploymentJob,
  EmploymentProject,
} from '../types/alliance'
import { buildQuery, partnerRequest, portalRequest } from '../api-helpers'

type ListParams = Record<string, string | number | boolean | undefined>

function list<T>(path: string, params?: ListParams) {
  return portalRequest<AllianceListResponse<T>>(`${path}${buildQuery(params || {})}`)
}

// ===== 管理端（/portal/apps/alliance 就业服务管理） =====

export const allianceEmploymentProjectApi = {
  list: (params?: ListParams) => list<EmploymentProject>('/alliance/employment-projects', params),
  get: (id: string) => portalRequest<EmploymentProject>(`/alliance/employment-projects/${id}`),
  create: (req: Partial<EmploymentProject>) =>
    portalRequest<EmploymentProject>('/alliance/employment-projects', {
      method: 'POST',
      body: JSON.stringify(req),
    }),
  update: (id: string, req: Partial<EmploymentProject>) =>
    portalRequest<EmploymentProject>(`/alliance/employment-projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(req),
    }),
  delete: (id: string) =>
    portalRequest<{ id: string }>(`/alliance/employment-projects/${id}`, { method: 'DELETE' }),
}

/** 管理端岗位与投递总览 */
export const allianceEmploymentAdminApi = {
  listJobs: (params?: ListParams) => list<EmploymentJob>('/alliance/employment-jobs', params),
  // 学校端治理：下架(closed)/恢复(published)
  setJobStatus: (id: string, status: 'closed' | 'published') =>
    portalRequest<{ id: string; status: string }>(`/alliance/employment-jobs/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    }),
  listApplications: (params?: ListParams) =>
    list<EmploymentApplication>('/alliance/employment-applications', params),
}

// ===== 前台大厅（登录公开；学生按 target_groups 过滤） =====

export const allianceEmploymentPublicApi = {
  listProjects: (tenantId: string, params?: ListParams) =>
    portalRequest<AllianceListResponse<EmploymentProject>>(
      `/alliance/public/employment-projects${buildQuery({ tenantId, ...(params || {}) })}`,
    ),
  getProject: (id: string, tenantId: string) =>
    portalRequest<EmploymentProject>(
      `/alliance/public/employment-projects/${id}${buildQuery({ tenantId })}`,
    ),
  listProjectJobs: (projectId: string, tenantId: string) =>
    portalRequest<AllianceListResponse<EmploymentJob>>(
      `/alliance/public/employment-projects/${projectId}/jobs${buildQuery({ tenantId })}`,
    ),
  getJob: (id: string, tenantId: string) =>
    portalRequest<EmploymentJob>(`/alliance/public/employment-jobs/${id}${buildQuery({ tenantId })}`),
  apply: (jobId: string, coverLetter: string) =>
    portalRequest<{ id: string }>(`/alliance/public/employment-jobs/${jobId}/apply`, {
      method: 'POST',
      body: JSON.stringify({ coverLetter }),
    }),
  myApplications: () =>
    portalRequest<AllianceListResponse<EmploymentApplication>>(
      '/alliance/public/employment-applications/mine',
    ),
}

// ===== 企业端（partner） =====

export const partnerEmploymentApi = {
  listProjects: (schoolTenantId?: string) =>
    partnerRequest<AllianceListResponse<EmploymentProject>>(
      `/partner/employment-projects${buildQuery({ schoolTenantId })}`,
    ),
  getProject: (id: string) =>
    partnerRequest<EmploymentProject>(`/partner/employment-projects/${id}`),
  listJobs: (params?: ListParams) =>
    partnerRequest<AllianceListResponse<EmploymentJob>>(
      `/partner/employment-jobs${buildQuery(params || {})}`,
    ),
  getJob: (id: string) => partnerRequest<EmploymentJob>(`/partner/employment-jobs/${id}`),
  createJob: (req: Partial<EmploymentJob> & { schoolTenantId: string }) =>
    partnerRequest<EmploymentJob>('/partner/employment-jobs', {
      method: 'POST',
      body: JSON.stringify(req),
    }),
  updateJob: (id: string, req: Partial<EmploymentJob>) =>
    partnerRequest<EmploymentJob>(`/partner/employment-jobs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(req),
    }),
  deleteJob: (id: string) =>
    partnerRequest<{ id: string }>(`/partner/employment-jobs/${id}`, { method: 'DELETE' }),
  // publish 可同时绑定/改绑就业项目（projectId 可选）
  setJobStatus: (id: string, action: 'publish' | 'close', projectId?: string) =>
    partnerRequest<{ id: string; status: string }>(`/partner/employment-jobs/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ action, projectId }),
    }),
  listApplications: (jobId: string) =>
    partnerRequest<AllianceListResponse<EmploymentApplication>>(
      `/partner/employment-jobs/${jobId}/applications`,
    ),
  getApplication: (id: string) =>
    partnerRequest<EmploymentApplication>(`/partner/employment-applications/${id}`),
}
