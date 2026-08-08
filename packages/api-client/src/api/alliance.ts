import type {
  AllianceEnterprise,
  AllianceEnterpriseLinkUpdate,
  AllianceProject,
  AllianceProjectMilestone,
  AllianceAchievement,
  AllianceExpert,
  AllianceMentorOption,
  AllianceMentorLinkResult,
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
  // 列表为 link 合并视图：企业主体字段 + 本校 link 管理字段（rating/status/enterprise_type/is_public/secondary_colleges）
  list: (params?: ListParams) => list<AllianceEnterprise>('/alliance/enterprises', params),
  get: (id: string) => portalRequest<AllianceEnterprise>(`/alliance/enterprises/${id}`),
  // 全局企业池搜索（跨租户只读，供"引入企业"用）
  search: (keyword: string) =>
    portalRequest<AllianceListResponse<AllianceEnterprise>>(
      `/alliance/enterprises/search${buildQuery({ keyword })}`,
    ),
  // 引入企业（建立学校-企业 link）
  link: (id: string) =>
    portalRequest<AllianceEnterprise>(`/alliance/enterprises/${id}/link`, { method: 'POST' }),
  // 解除引入（历史协议/项目/成果引用保留，页面不再展示）
  unlink: (id: string) =>
    portalRequest<{ id: string }>(`/alliance/enterprises/${id}/link`, { method: 'DELETE' }),
  // 仅更新学校侧 link 管理字段
  update: (id: string, req: AllianceEnterpriseLinkUpdate) =>
    portalRequest<AllianceEnterprise>(`/alliance/enterprises/${id}`, {
      method: 'PUT',
      body: JSON.stringify(req),
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

// 专家档案归属企业租户，学校端跨租户只读（按本校已引入企业过滤）
export const allianceExpertApi = {
  list: (params?: ListParams) => list<AllianceExpert>('/alliance/experts', params),
  get: (id: string) => portalRequest<AllianceExpert>(`/alliance/experts/${id}`),
  // 共建导师选项：本校已引入企业的专家 + 影子账号启用状态
  mentorOptions: () =>
    portalRequest<AllianceListResponse<AllianceMentorOption>>('/alliance/experts/mentor-options'),
  // 启用专家为共建导师（幂等；首次创建影子账号时响应含 initialPassword）
  mentorLink: (id: string) =>
    portalRequest<AllianceMentorLinkResult>(`/alliance/experts/${id}/mentor-link`, {
      method: 'POST',
    }),
  // 停用共建导师（停用后该导师无法登录共建）
  unlinkMentor: (id: string) =>
    portalRequest<{ id: string }>(`/alliance/experts/${id}/mentor-link`, { method: 'DELETE' }),
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
