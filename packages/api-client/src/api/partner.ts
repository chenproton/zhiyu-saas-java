// 企业平台（Partner）API，契约见 docs/spec/partner-enterprise-platform.md §5
import { partnerRequest, buildQuery } from '../api-helpers'
import type { LoginRequest, LoginResponse, ListResponse, SelectTenantRequest } from '../api-helpers'
import type {
  PartnerEnterprise,
  PartnerEnterpriseUpdateRequest,
  PartnerExpert,
  PartnerRegisterRequest,
  PartnerMeResponse,
  PartnerDashboard,
  PartnerSchool,
  PartnerSchoolStatus,
  PartnerCooperationOverview,
  PartnerMentorTaskList,
  PartnerChangePasswordRequest,
} from '../types/partner'

type ListParams = Record<string, string | number | boolean | undefined>

export const partnerAuthApi = {
  login: (req: LoginRequest) =>
    partnerRequest<LoginResponse>('/auth/partner/login', {
      method: 'POST',
      body: JSON.stringify(req),
    }),
  register: (req: PartnerRegisterRequest) =>
    partnerRequest<LoginResponse>('/auth/partner/register', {
      method: 'POST',
      body: JSON.stringify(req),
    }),
  // 多企业候选登录：选择企业后签发对应租户 token（公开接口，无平台限制）
  selectTenant: (req: SelectTenantRequest) =>
    partnerRequest<LoginResponse>('/auth/select-tenant', {
      method: 'POST',
      body: JSON.stringify(req),
    }),
  me: () => partnerRequest<PartnerMeResponse>('/auth/partner/me'),
}

export const partnerEnterpriseApi = {
  getProfile: () => partnerRequest<PartnerEnterprise>('/partner/enterprise/profile'),
  updateProfile: (req: PartnerEnterpriseUpdateRequest) =>
    partnerRequest<PartnerEnterprise>('/partner/enterprise/profile', {
      method: 'PUT',
      body: JSON.stringify(req),
    }),
}

export interface PartnerExpertCreateResponse {
  expert: PartnerExpert
  username: string
  initialPassword: string
}

export const partnerExpertApi = {
  list: (params?: ListParams) =>
    partnerRequest<ListResponse<PartnerExpert>>(`/partner/experts${buildQuery(params || {})}`),
  get: (id: string) => partnerRequest<PartnerExpert>(`/partner/experts/${id}`),
  // 创建专家并自动生成登录账号（管理员填用户名+密码）
  create: (req: Partial<PartnerExpert> & { username: string; password: string }) =>
    partnerRequest<PartnerExpertCreateResponse>('/partner/experts', {
      method: 'POST',
      body: JSON.stringify(req),
    }),
  update: (id: string, req: Partial<PartnerExpert> & { password?: string }) =>
    partnerRequest<PartnerExpert>(`/partner/experts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(req),
    }),
  delete: (id: string) =>
    partnerRequest<{ id: string }>(`/partner/experts/${id}`, { method: 'DELETE' }),
  // 专家本人的档案（成员角色只能访问本人）
  me: () => partnerRequest<PartnerExpert>('/partner/experts/me'),
  updateMe: (req: Partial<PartnerExpert>) =>
    partnerRequest<PartnerExpert>('/partner/experts/me', {
      method: 'PUT',
      body: JSON.stringify(req),
    }),
}

export const partnerWorkspaceApi = {
  dashboard: () => partnerRequest<PartnerDashboard>('/partner/workspace/dashboard'),
}

export const partnerSchoolApi = {
  list: (params?: ListParams) =>
    partnerRequest<ListResponse<PartnerSchool>>(`/partner/schools${buildQuery(params || {})}`),
  updateStatus: (tenantId: string, status: PartnerSchoolStatus) =>
    partnerRequest<PartnerSchool>(`/partner/schools/${tenantId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    }),
}

export const partnerCooperationApi = {
  overview: () => partnerRequest<PartnerCooperationOverview>('/partner/cooperation'),
}

export const partnerMentorTaskApi = {
  list: () => partnerRequest<PartnerMentorTaskList>('/partner/mentor-tasks'),
}

export const partnerMeApi = {
  changePassword: (req: PartnerChangePasswordRequest) =>
    partnerRequest<{ id: string }>('/partner/me/password', {
      method: 'PUT',
      body: JSON.stringify(req),
    }),
}
