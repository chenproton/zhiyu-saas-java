// 企业平台（Partner）API，契约见 docs/spec/partner-enterprise-platform.md §5
import { partnerRequest, buildQuery } from '../api-helpers'
import type { LoginRequest, LoginResponse, ListResponse } from '../api-helpers'
import type {
  PartnerEnterprise,
  PartnerEnterpriseUpdateRequest,
  PartnerExpert,
  PartnerMember,
  PartnerMemberCreateRequest,
  PartnerMemberUpdateRequest,
  PartnerRegisterRequest,
  PartnerMeResponse,
  PartnerDashboard,
  PartnerSchool,
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

export const partnerExpertApi = {
  list: (params?: ListParams) =>
    partnerRequest<ListResponse<PartnerExpert>>(`/partner/experts${buildQuery(params || {})}`),
  get: (id: string) => partnerRequest<PartnerExpert>(`/partner/experts/${id}`),
  create: (req: Partial<PartnerExpert>) =>
    partnerRequest<PartnerExpert>('/partner/experts', {
      method: 'POST',
      body: JSON.stringify(req),
    }),
  update: (id: string, req: Partial<PartnerExpert>) =>
    partnerRequest<PartnerExpert>(`/partner/experts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(req),
    }),
  delete: (id: string) =>
    partnerRequest<{ id: string }>(`/partner/experts/${id}`, { method: 'DELETE' }),
}

export const partnerMemberApi = {
  list: () => partnerRequest<ListResponse<PartnerMember>>('/partner/members'),
  create: (req: PartnerMemberCreateRequest) =>
    partnerRequest<PartnerMember>('/partner/members', {
      method: 'POST',
      body: JSON.stringify(req),
    }),
  update: (id: string, req: PartnerMemberUpdateRequest) =>
    partnerRequest<PartnerMember>(`/partner/members/${id}`, {
      method: 'PUT',
      body: JSON.stringify(req),
    }),
  delete: (id: string) =>
    partnerRequest<{ id: string }>(`/partner/members/${id}`, { method: 'DELETE' }),
}

export const partnerWorkspaceApi = {
  dashboard: () => partnerRequest<PartnerDashboard>('/partner/workspace/dashboard'),
}

export const partnerSchoolApi = {
  list: (params?: ListParams) =>
    partnerRequest<ListResponse<PartnerSchool>>(`/partner/schools${buildQuery(params || {})}`),
}

export const partnerMeApi = {
  changePassword: (req: PartnerChangePasswordRequest) =>
    partnerRequest<{ id: string }>('/partner/me/password', {
      method: 'PUT',
      body: JSON.stringify(req),
    }),
}
