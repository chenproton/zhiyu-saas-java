import type {
  AllianceEnterprise,
  AllianceEnterpriseLinkUpdate,
  AllianceEnterpriseRegisterRequest,
  AllianceProject,
  AllianceProjectMilestone,
  AllianceAchievement,
  AllianceExpert,
  AllianceMentorOption,
  AllianceAgreement,
  AlliancePermission,
  AllianceBrand,
  BrandMajorRankConfig,
  TalentRankMajorGroup,
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
  // 学校代注册企业：创建企业租户+主体+管理员账号，并直接建立本校-企业合作关联（合作中）
  register: (req: AllianceEnterpriseRegisterRequest) =>
    portalRequest<AllianceEnterprise>(`/alliance/enterprises/register`, {
      method: 'POST',
      body: JSON.stringify(req),
    }),
  // 仅更新学校侧 link 管理字段
  update: (id: string, req: AllianceEnterpriseLinkUpdate) =>
    portalRequest<AllianceEnterprise>(`/alliance/enterprises/${id}`, {
      method: 'PUT',
      body: JSON.stringify(req),
    }),
}

export interface AllianceResourceGrant {
  id: string
  tenantId: string
  enterpriseId: string
  resourceType: 'position' | 'scene'
  resourceIds: string[]
  createdAt: string
  updatedAt: string
}

export interface AllianceGrantResourceOption {
  id: string
  name: string
  type: 'position' | 'scene'
  source: 'enterprise' | 'school'
}

/** 学校-企业资源授权（企业级：岗位/场景编辑权授予合作企业） */
export const allianceGrantApi = {
  // 某企业的授权（position/scene 两行）
  list: (enterpriseId: string) =>
    portalRequest<{ enterpriseId: string; grants: AllianceResourceGrant[] }>(
      `/alliance/grants${buildQuery({ enterpriseId })}`,
    ),
  // 覆盖式保存某类型授权（空数组=清空）
  save: (req: {
    enterpriseId: string
    resourceType: 'position' | 'scene'
    resourceIds: string[]
  }) =>
    portalRequest<{ enterpriseId: string; grants: AllianceResourceGrant[] }>('/alliance/grants', {
      method: 'PUT',
      body: JSON.stringify(req),
    }),
  // 可授权资源候选（该企业共建 + 学校自建已发布）
  resourceOptions: (enterpriseId: string) =>
    list<AllianceGrantResourceOption>(
      `/alliance/grants/resource-options${buildQuery({ enterpriseId })}`,
    ),
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
  // 前台公开里程碑（本校链接双控，tenantId 可选）
  listPublicMilestones: (projectId: string, tenantId?: string) =>
    portalRequest<AllianceListResponse<AllianceProjectMilestone>>(
      `/alliance/public/projects/${projectId}/milestones${buildQuery({ tenantId })}`,
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
  // 学校侧维护"前台展示"开关：仅控制专家在联盟首页等 is_public 双控场景展示，
  // 企业详情页"专家团队"不受影响
  updateDisplay: (id: string, isPublic: boolean) =>
    portalRequest<{ id: string; isPublic: boolean }>(`/alliance/experts/${id}/display`, {
      method: 'PUT',
      body: JSON.stringify({ isPublic }),
    }),
  // 共建导师选项：本校已引入企业的专家 + 绑定账号（无账号专家 userId 为 null，不可勾选）
  mentorOptions: () =>
    portalRequest<AllianceListResponse<AllianceMentorOption>>('/alliance/experts/mentor-options'),
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
  // 人才画像排名（管理端，返回全部专业分组）
  talentRanking: (params?: ListParams) =>
    portalRequest<AllianceListResponse<TalentRankMajorGroup>>(
      `/alliance/brands/talent-ranking${buildQuery(params || {})}`,
    ),
  // 专业排名启用配置
  rankConfigs: () =>
    portalRequest<AllianceListResponse<BrandMajorRankConfig>>('/alliance/brands/rank-configs'),
  saveRankConfigs: (configs: BrandMajorRankConfig[]) =>
    portalRequest<AllianceListResponse<BrandMajorRankConfig>>('/alliance/brands/rank-configs', {
      method: 'PUT',
      body: JSON.stringify({ configs }),
    }),
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
