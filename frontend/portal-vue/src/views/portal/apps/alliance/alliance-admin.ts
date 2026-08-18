// 联盟管理应用（portal/apps/alliance）管理端类型与工具（企业/专家/权限/就业）。
// 复用前台 shared 的字典/标签/格式化；补充管理端额外字段。
// 与同目录 shared.ts（品牌组）独立，互不覆盖。

export {
  allianceLabel,
  ALLIANCE_DICTS,
  EMPLOYMENT_PROJECT_TYPE_LABELS,
  EMPLOYMENT_PROJECT_PHASE_LABELS,
  deriveEmploymentProjectPhase,
  EMPLOYMENT_JOB_TYPE_LABELS,
  EMPLOYMENT_JOB_STATUS_LABELS,
  formatDate,
  formatDateTime,
  fetchAllPages,
} from '@/views/portal/alliance/shared';

export type {
  AllianceEnterprise,
  AllianceProject,
  AllianceAchievement,
  EmploymentJob,
} from '@/views/portal/alliance/shared';

// AllianceAgreement 在 types/alliance.ts（shared 无此类型）
export type { AllianceAgreement } from '@/types/alliance';

import { EMPLOYMENT_PROJECT_TYPE_LABELS } from '@/views/portal/alliance/shared';

export interface ListResponse<T> {
  items: T[];
  total: number;
}

export interface AllianceExpert {
  id: string;
  tenantId: string;
  name: string;
  gender?: string;
  age?: number;
  title?: string;
  position?: string;
  expertType?: string;
  industry?: string;
  professionalFields?: string[];
  specialties?: string[];
  experienceYears?: number;
  education?: string;
  introduction?: string;
  workExperience?: string;
  city?: string;
  avatarUrl?: string;
  coverImage?: string;
  partnerSource?: string;
  positionDirection?: string;
  photos?: string[];
  attachments?: string[];
  enterpriseId?: string;
  enterpriseName?: string;
  organization?: string;
  userId?: string;
  rating?: string;
  status: string;
  secondaryColleges?: string[];
  isPublic: boolean;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmploymentTargetGroup {
  orgNodeId?: string;
  orgNodeName?: string;
  majorId?: string;
  majorName?: string;
  graduateYear?: number;
}

export interface EmploymentProject {
  id: string;
  tenantId: string;
  name: string;
  type: string;
  organizer?: string;
  description?: string;
  coverImage?: string;
  startDate?: string;
  endDate?: string;
  publishStatus: 'draft' | 'published';
  enterpriseIds?: string[];
  targetGroups?: EmploymentTargetGroup[];
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  jobCount: number;
  applicationCount: number;
}

export interface EmploymentApplication {
  id: string;
  tenantId: string;
  jobId: string;
  enterpriseId: string;
  studentId: string;
  studentName?: string;
  studentNo?: string;
  majorName?: string;
  className?: string;
  phone?: string;
  email?: string;
  coverLetter?: string;
  status: 'pending';
  createdAt: string;
  updatedAt: string;
  jobTitle?: string;
  enterpriseName?: string;
  projectName?: string;
}

export interface GrantResourceOption {
  id: string;
  name: string;
  type: 'position' | 'scene';
  source: 'enterprise' | 'school';
  sourceEnterpriseId?: string;
  sourceEnterpriseName?: string;
  status: string;
  batchId?: string;
  batchName?: string;
}

export interface AllianceResourceGrant {
  id: string;
  tenantId: string;
  enterpriseId: string;
  resourceType: 'position' | 'scene';
  resourceIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AllianceDictItem {
  id: string;
  code: string;
  name: string;
  sortOrder?: number;
}

/** 类型展示：内置枚举用标签，custom:<文本> 展示自定义文本，其余未知值原样。 */
export function employmentTypeLabel(type: string | undefined): string {
  if (!type) return '-';
  if (type.startsWith('custom:')) return type.slice('custom:'.length);
  return EMPLOYMENT_PROJECT_TYPE_LABELS[type] ?? type;
}

export function targetGroupSummary(g: EmploymentTargetGroup): string {
  const parts: string[] = [];
  if (g.orgNodeName || g.orgNodeId) parts.push(g.orgNodeName || g.orgNodeId || '');
  if (g.majorName || g.majorId) parts.push(g.majorName || g.majorId || '');
  if (g.graduateYear) parts.push(String(g.graduateYear));
  return parts.length > 0 ? parts.join(' · ') : '-';
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

export const STATUS_OPTIONS = [
  { value: 'draft', label: '草稿' },
  { value: 'pending', label: '审批中' },
  { value: 'approved', label: '已通过' },
  { value: 'rejected', label: '已驳回' },
  { value: 'published', label: '已发布' },
  { value: 'archived', label: '已归档' },
];

export const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: '草稿', color: '#909399', bg: '#f4f4f5' },
  pending: { label: '审批中', color: '#b88230', bg: '#fdf6ec' },
  approved: { label: '已通过', color: '#529b2e', bg: '#f0f9eb' },
  rejected: { label: '已驳回', color: '#c45656', bg: '#fef0f0' },
  published: { label: '已发布', color: '#409eff', bg: '#ecf5ff' },
  archived: { label: '已归档', color: '#909399', bg: '#f4f4f5' },
};

export function statusConfigOf(s: string): { label: string; color: string; bg: string } {
  return STATUS_CONFIG[s] || { label: s, color: '#909399', bg: '#f4f4f5' };
}
