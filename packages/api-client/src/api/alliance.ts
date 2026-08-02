import type {
  AllianceEnterprise,
  AllianceProject,
  AllianceProjectMilestone,
  AllianceAchievement,
  AllianceExpert,
  AllianceAgreement,
  AlliancePermission,
  AllianceBrand,
  AllianceListResponse,
} from '../types/alliance'
import { portalRequest, buildQuery } from '../api-helpers'

type ListParams = Record<string, string | number | boolean | undefined>

function list<T>(path: string, params?: ListParams) {
  return portalRequest<AllianceListResponse<T>>(`${path}${buildQuery(params || {})}`)
}

export const allianceEnterpriseApi = {
  list: (params?: ListParams) => list<AllianceEnterprise>('/alliance/enterprises', params),
  get: (id: string) => portalRequest<AllianceEnterprise>(`/alliance/enterprises/${id}`),
  create: (req: Partial<AllianceEnterprise>) =>
    portalRequest<AllianceEnterprise>('/alliance/enterprises', {
      method: 'POST',
      body: JSON.stringify(req),
    }),
  update: (id: string, req: Partial<AllianceEnterprise>) =>
    portalRequest<AllianceEnterprise>(`/alliance/enterprises/${id}`, {
      method: 'PUT',
      body: JSON.stringify(req),
    }),
  delete: (id: string) =>
    portalRequest<{ id: string }>(`/alliance/enterprises/${id}`, { method: 'DELETE' }),
  togglePublic: (id: string, isPublic: boolean) =>
    portalRequest<AllianceEnterprise>(`/alliance/enterprises/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ isPublic }),
    }),
}

export const allianceProjectApi = {
  list: (params?: ListParams) => list<AllianceProject>('/alliance/projects', params),
  get: (id: string) => portalRequest<AllianceProject>(`/alliance/projects/${id}`),
  create: (req: Partial<AllianceProject>) =>
    portalRequest<AllianceProject>('/alliance/projects', {
      method: 'POST',
      body: JSON.stringify(req),
    }),
  update: (id: string, req: Partial<AllianceProject>) =>
    portalRequest<AllianceProject>(`/alliance/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(req),
    }),
  delete: (id: string) =>
    portalRequest<{ id: string }>(`/alliance/projects/${id}`, { method: 'DELETE' }),
  listMilestones: (projectId: string) =>
    portalRequest<AllianceListResponse<AllianceProjectMilestone>>(
      `/alliance/projects/${projectId}/milestones`,
    ),
}

export const allianceAgreementApi = {
  list: (params?: ListParams) => list<AllianceAgreement>('/alliance/agreements', params),
  get: (id: string) => portalRequest<AllianceAgreement>(`/alliance/agreements/${id}`),
  create: (req: Partial<AllianceAgreement>) =>
    portalRequest<AllianceAgreement>('/alliance/agreements', {
      method: 'POST',
      body: JSON.stringify(req),
    }),
  update: (id: string, req: Partial<AllianceAgreement>) =>
    portalRequest<AllianceAgreement>(`/alliance/agreements/${id}`, {
      method: 'PUT',
      body: JSON.stringify(req),
    }),
  delete: (id: string) =>
    portalRequest<{ id: string }>(`/alliance/agreements/${id}`, { method: 'DELETE' }),
}

export const allianceAchievementApi = {
  list: (params?: ListParams) => list<AllianceAchievement>('/alliance/achievements', params),
  get: (id: string) => portalRequest<AllianceAchievement>(`/alliance/achievements/${id}`),
  create: (req: Partial<AllianceAchievement>) =>
    portalRequest<AllianceAchievement>('/alliance/achievements', {
      method: 'POST',
      body: JSON.stringify(req),
    }),
  update: (id: string, req: Partial<AllianceAchievement>) =>
    portalRequest<AllianceAchievement>(`/alliance/achievements/${id}`, {
      method: 'PUT',
      body: JSON.stringify(req),
    }),
  delete: (id: string) =>
    portalRequest<{ id: string }>(`/alliance/achievements/${id}`, { method: 'DELETE' }),
}

export const allianceExpertApi = {
  list: (params?: ListParams) => list<AllianceExpert>('/alliance/experts', params),
  get: (id: string) => portalRequest<AllianceExpert>(`/alliance/experts/${id}`),
  create: (req: Partial<AllianceExpert>) =>
    portalRequest<AllianceExpert>('/alliance/experts', {
      method: 'POST',
      body: JSON.stringify(req),
    }),
  update: (id: string, req: Partial<AllianceExpert>) =>
    portalRequest<AllianceExpert>(`/alliance/experts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(req),
    }),
  delete: (id: string) =>
    portalRequest<{ id: string }>(`/alliance/experts/${id}`, { method: 'DELETE' }),
}

export const allianceBrandApi = {
  list: (params?: ListParams) => list<AllianceBrand>('/alliance/brands', params),
  get: (id: string) => portalRequest<AllianceBrand>(`/alliance/brands/${id}`),
  create: (req: Partial<AllianceBrand>) =>
    portalRequest<AllianceBrand>('/alliance/brands', {
      method: 'POST',
      body: JSON.stringify(req),
    }),
  update: (id: string, req: Partial<AllianceBrand>) =>
    portalRequest<AllianceBrand>(`/alliance/brands/${id}`, {
      method: 'PUT',
      body: JSON.stringify(req),
    }),
  delete: (id: string) =>
    portalRequest<{ id: string }>(`/alliance/brands/${id}`, { method: 'DELETE' }),
}

export const alliancePermissionApi = {
  list: (params?: ListParams) => list<AlliancePermission>('/alliance/permissions', params),
  create: (req: Partial<AlliancePermission>) =>
    portalRequest<AlliancePermission>('/alliance/permissions', {
      method: 'POST',
      body: JSON.stringify(req),
    }),
  update: (id: string, req: Partial<AlliancePermission>) =>
    portalRequest<AlliancePermission>(`/alliance/permissions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(req),
    }),
  delete: (id: string) =>
    portalRequest<{ id: string }>(`/alliance/permissions/${id}`, { method: 'DELETE' }),
  toggleEnabled: (id: string, isEnabled: boolean) =>
    portalRequest<AlliancePermission>(`/alliance/permissions/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ isEnabled }),
    }),
}
