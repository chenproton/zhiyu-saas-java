// 联盟管理应用（portal/apps/alliance）——成果 / 协议 / 项目三组页面本地共享层。
// 因任务约束禁止修改 src/api/*.ts 与 src/types/*.ts，此处用 portalRequest/request 直连
// 与 React 完全相同的后端端点，并复用已 tracked 的 views/portal/alliance/shared 展示字典与工具。
// 与同目录 shared.ts（品牌组）alliance-admin.ts（企业/专家/就业组）相互独立，互不覆盖。

import { portalRequest, request, buildQuery } from '@/api/http';
import { allianceProjectApi, allianceAgreementApi } from '@/api/alliance';
import { organizationApi, orgTypeApi } from '@/api/system';
import type { Organization } from '@/types/system';
import type { AllianceAgreement } from '@/types/alliance';
import {
  allianceLabel,
  ALLIANCE_DICTS,
  fetchAllPages,
  normalizeRelatedRefs,
  formatDate,
  type AllianceEnterprise,
  type AllianceProject,
  type AllianceAchievement,
  type AllianceProjectMilestone,
  type AllianceRelatedRef,
} from '@/views/portal/alliance/shared';

export {
  allianceLabel,
  ALLIANCE_DICTS,
  fetchAllPages,
  normalizeRelatedRefs,
  formatDate,
  allianceProjectApi,
  allianceAgreementApi,
};
export type {
  AllianceEnterprise,
  AllianceProject,
  AllianceAchievement,
  AllianceAgreement,
  AllianceProjectMilestone,
  AllianceRelatedRef,
};

export interface ListResult<T> {
  items: T[];
  total: number;
}

export interface AllianceDictItem {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
}

// ===== 企业（Vue api/alliance.ts 缺失，直连 /alliance/enterprises）=====
export const enterpriseApi = {
  list: (params?: Record<string, string | number | undefined>) =>
    portalRequest<ListResult<AllianceEnterprise>>(
      `/alliance/enterprises${buildQuery(params || {})}`,
    ),
  get: (id: string) => portalRequest<AllianceEnterprise>(`/alliance/enterprises/${id}`),
};

export function listAllEnterprises(): Promise<AllianceEnterprise[]> {
  return fetchAllPages((page, pageSize) =>
    enterpriseApi.list({ limit: pageSize, offset: page * pageSize }),
  );
}

export function listAllProjects(): Promise<AllianceProject[]> {
  return fetchAllPages((page, pageSize) =>
    allianceProjectApi.list({ limit: pageSize, offset: page * pageSize }),
  );
}

// ===== 成果（types/alliance.ts 缺 isPublic/coBuilders/related 等字段，故本地直连）=====
export const achievementApi = {
  list: (params?: Record<string, string | number | undefined>) =>
    portalRequest<ListResult<AllianceAchievement>>(
      `/alliance/achievements${buildQuery(params || {})}`,
    ),
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
};

// ===== 项目里程碑（Vue api/alliance.ts 缺失，直连 /alliance/projects/:id/milestones）=====
export const milestoneApi = {
  list: (projectId: string) =>
    portalRequest<ListResult<AllianceProjectMilestone>>(
      `/alliance/projects/${projectId}/milestones`,
    ),
  create: (projectId: string, req: Record<string, unknown>) =>
    portalRequest<AllianceProjectMilestone>(`/alliance/projects/${projectId}/milestones`, {
      method: 'POST',
      body: JSON.stringify(req),
    }),
  update: (projectId: string, mid: string, req: Record<string, unknown>) =>
    portalRequest<AllianceProjectMilestone>(
      `/alliance/projects/${projectId}/milestones/${mid}`,
      { method: 'PUT', body: JSON.stringify(req) },
    ),
  delete: (projectId: string, mid: string) =>
    portalRequest<{ id: string }>(`/alliance/projects/${projectId}/milestones/${mid}`, {
      method: 'DELETE',
    }),
};

// ===== 联盟字典 =====
export function fetchAllianceDict(dictType: string): Promise<AllianceDictItem[]> {
  return portalRequest<ListResult<AllianceDictItem>>(`/alliance/dictionaries/${dictType}`)
    .then((r) => r.items || [])
    .catch(() => []);
}

/** 合并字典与存量值：当前值不在字典中时追加为选项，保证存量数据可正常展示/编辑 */
export function mergeDictOptions(
  items: AllianceDictItem[],
  currentValue?: string | null,
): { label: string; value: string }[] {
  const opts = items.map((d) => ({ label: d.name, value: d.code }));
  if (currentValue && !items.some((d) => d.code === currentValue)) {
    opts.unshift({ label: currentValue, value: currentValue });
  }
  return opts;
}

// ===== 二级学院（对齐 React useSecondaryColleges）=====
function flattenOrgs(nodes: Organization[]): Organization[] {
  const out: Organization[] = [];
  for (const n of nodes) {
    out.push(n);
    if (n.children && n.children.length > 0) out.push(...flattenOrgs(n.children));
  }
  return out;
}

export async function loadSecondaryColleges(tenantId?: string): Promise<string[]> {
  if (!tenantId) return [];
  try {
    const [treeRes, typesRes] = await Promise.all([
      organizationApi.tree({ tenantId }),
      orgTypeApi.list({ tenantId, limit: 1000 }),
    ]);
    const collegeTypeIds = new Set<string>();
    for (const t of typesRes.items) {
      if (t.name === '二级学院') collegeTypeIds.add(t.id);
    }
    if (collegeTypeIds.size === 0) return [];
    return flattenOrgs(treeRes.items)
      .filter((n) => collegeTypeIds.has(n.typeId))
      .map((n) => n.name);
  } catch {
    return [];
  }
}

// ===== 关联对象搜索（成果详情「添加关联岗位/场景/课程」）=====
export type RelatedKind = 'positions' | 'scenes' | 'courses';

function toRefs(
  items: { id: string; name: string; code?: string; coverImage?: string }[],
): AllianceRelatedRef[] {
  return items.map((i) => ({ id: i.id, name: i.name, code: i.code, coverImage: i.coverImage }));
}

export async function searchRelated(kind: RelatedKind, keyword: string): Promise<AllianceRelatedRef[]> {
  const q = keyword.trim();
  if (kind === 'positions') {
    const res = await portalRequest<
      ListResult<{ id: string; name: string; code?: string; coverImage?: string }>
    >(`/job/positions${buildQuery({ search: q, limit: 20 })}`);
    return toRefs(res.items || []);
  }
  if (kind === 'scenes') {
    const res = await request<
      ListResult<{ id: string; name: string; code?: string; coverImage?: string }>
    >(`/scene/scenarios${buildQuery({ search: q, limit: 20 })}`);
    return toRefs(res.items || []);
  }
  const res = await request<
    ListResult<{ id: string; name: string; code?: string; coverImage?: string }>
  >(`/lesson/courses${buildQuery({ type: 'system', search: q, limit: 20 })}`);
  return toRefs(res.items || []);
}

// ===== 协议-项目双向关联同步（对齐 React lib/alliance-links.ts）=====
export async function syncAgreementProjectLinks(
  agreementId: string,
  targetProjectIds: string[],
): Promise<void> {
  const agreement = await allianceAgreementApi.get(agreementId);
  const current = agreement.projectIds ?? [];
  const added = targetProjectIds.filter((pid) => !current.includes(pid));
  const removed = current.filter((pid) => !targetProjectIds.includes(pid));

  for (const pid of added) {
    const p = await allianceProjectApi.get(pid);
    await allianceProjectApi.update(pid, {
      ...p,
      agreementIds: [...new Set([...(p.agreementIds ?? []), agreementId])],
    });
  }
  for (const pid of removed) {
    const p = await allianceProjectApi.get(pid);
    await allianceProjectApi.update(pid, {
      ...p,
      agreementIds: (p.agreementIds ?? []).filter((x) => x !== agreementId),
    });
  }
  if (added.length > 0 || removed.length > 0) {
    await allianceAgreementApi.update(agreementId, { ...agreement, projectIds: targetProjectIds });
  }
}
