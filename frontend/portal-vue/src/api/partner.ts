import { partnerRequest, buildQuery } from './http';
import type { ListResponse } from './http';
import type {
  PartnerExpert,
  PartnerEnterprise,
  PartnerDashboard,
  CoBuildPosition,
  CoBuildScenario,
  EmploymentProject,
  EmploymentJob,
  PartnerSchool,
  PartnerSchoolStatus,
  PartnerCooperationOverview,
  PartnerCooperationProjectDetail,
  PartnerCooperationAchievementDetail,
  PartnerCooperationAgreementDetail,
  PartnerMentorTask
} from '@/types/partner';

export const partnerEmploymentApi = {
  listProjects: (schoolTenantId?: string) =>
    partnerRequest<ListResponse<EmploymentProject>>(
      `/partner/employment-projects${buildQuery({ schoolTenantId })}`
    ),
  listJobs: (params?: Record<string, string | number | boolean | undefined>) =>
    partnerRequest<ListResponse<EmploymentJob>>(`/partner/employment-jobs${buildQuery(params || {})}`),
  createJob: (req: Partial<EmploymentJob> & { schoolTenantId: string }) =>
    partnerRequest<EmploymentJob>('/partner/employment-jobs', { method: 'POST', body: JSON.stringify(req) }),
  updateJob: (id: string, req: Partial<EmploymentJob>) =>
    partnerRequest<EmploymentJob>(`/partner/employment-jobs/${id}`, { method: 'PUT', body: JSON.stringify(req) }),
  deleteJob: (id: string) =>
    partnerRequest<{ id: string }>(`/partner/employment-jobs/${id}`, { method: 'DELETE' })
};

export const partnerCobuildScenarioApi = {
  list: (params?: Record<string, string | number | boolean | undefined>) =>
    partnerRequest<ListResponse<CoBuildScenario>>(`/partner/co-build/scenes${buildQuery(params || {})}`),
  get: (id: string) => partnerRequest<CoBuildScenario>(`/partner/co-build/scenes/${id}`),
  create: (req: { schoolTenantId: string; name: string; difficulty: number }) =>
    partnerRequest<CoBuildScenario>('/partner/co-build/scenes', { method: 'POST', body: JSON.stringify(req) }),
  update: (id: string, req: Partial<CoBuildScenario>) =>
    partnerRequest<CoBuildScenario>(`/partner/co-build/scenes/${id}`, { method: 'PUT', body: JSON.stringify(req) }),
  delete: (id: string) =>
    partnerRequest<{ id: string }>(`/partner/co-build/scenes/${id}`, { method: 'DELETE' })
};

export const partnerCobuildPositionApi = {
  list: (params?: Record<string, string | number | boolean | undefined>) =>
    partnerRequest<ListResponse<CoBuildPosition>>(`/partner/co-build/positions${buildQuery(params || {})}`),
  get: (id: string) => partnerRequest<CoBuildPosition>(`/partner/co-build/positions/${id}`),
  create: (req: { schoolTenantId: string; name: string; positionType: string }) =>
    partnerRequest<CoBuildPosition>('/partner/co-build/positions', {
      method: 'POST',
      body: JSON.stringify(req)
    }),
  update: (id: string, req: Partial<CoBuildPosition>) =>
    partnerRequest<CoBuildPosition>(`/partner/co-build/positions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(req)
    }),
  delete: (id: string) =>
    partnerRequest<{ id: string }>(`/partner/co-build/positions/${id}`, { method: 'DELETE' })
};

export const partnerWorkspaceApi = {
  dashboard: () => partnerRequest<PartnerDashboard>('/partner/workspace/dashboard')
};

export const partnerEnterpriseApi = {
  getProfile: () => partnerRequest<PartnerEnterprise>('/partner/enterprise/profile'),
  updateProfile: (req: Partial<PartnerEnterprise>) =>
    partnerRequest<PartnerEnterprise>('/partner/enterprise/profile', {
      method: 'PUT',
      body: JSON.stringify(req)
    })
};

export const partnerSchoolApi = {
  list: (params?: Record<string, string | number | boolean | undefined>) =>
    partnerRequest<ListResponse<PartnerSchool>>(`/partner/schools${buildQuery(params || {})}`),
  updateStatus: (tenantId: string, status: PartnerSchoolStatus) =>
    partnerRequest<PartnerSchool>(`/partner/schools/${tenantId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    })
};

export const partnerCooperationApi = {
  overview: () => partnerRequest<PartnerCooperationOverview>('/partner/cooperation'),
  project: (id: string) =>
    partnerRequest<PartnerCooperationProjectDetail>(`/partner/cooperation/projects/${id}`),
  achievement: (id: string) =>
    partnerRequest<PartnerCooperationAchievementDetail>(`/partner/cooperation/achievements/${id}`),
  agreement: (id: string) =>
    partnerRequest<PartnerCooperationAgreementDetail>(`/partner/cooperation/agreements/${id}`)
};

export const partnerMentorTaskApi = {
  list: () => partnerRequest<{ items: PartnerMentorTask[] }>('/partner/mentor-tasks')
};

export const partnerMeApi = {
  changePassword: (req: { oldPassword: string; newPassword: string }) =>
    partnerRequest<{ id: string }>('/partner/me/password', {
      method: 'PUT',
      body: JSON.stringify(req)
    })
};

export const partnerExpertApi = {
  list: (params?: Record<string, string | number | boolean | undefined>) =>
    partnerRequest<ListResponse<PartnerExpert>>(`/partner/experts${buildQuery(params || {})}`),
  get: (id: string) => partnerRequest<PartnerExpert>(`/partner/experts/${id}`),
  create: (req: Partial<PartnerExpert>) =>
    partnerRequest<PartnerExpert>('/partner/experts', { method: 'POST', body: JSON.stringify(req) }),
  update: (id: string, req: Partial<PartnerExpert>) =>
    partnerRequest<PartnerExpert>(`/partner/experts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(req)
    }),
  delete: (id: string) =>
    partnerRequest<{ id: string }>(`/partner/experts/${id}`, { method: 'DELETE' })
};
