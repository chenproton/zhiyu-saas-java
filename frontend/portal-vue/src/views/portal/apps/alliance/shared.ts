// 联盟管理应用（portal/apps/alliance）共享类型与工具函数。
// 本组页面只允许修改 views/portal/apps/alliance/ 与 router/index.ts，
// 故此处自包含一份联盟品牌相关类型与字典，不依赖 src/types/alliance.ts 的补充字段。

// ==================== 类型 ====================

export interface AllianceBrand {
  id: string;
  tenantId: string;
  brandType: string;
  name: string;
  status: string;
  isPublic: boolean;
  isFeatured: boolean;
  coverImage?: string;
  description?: string;
  data: Record<string, any>;
  studentId?: string;
  enterpriseId?: string;
  positionId?: string;
  majorId?: string;
  teacherId?: string;
  expertId?: string;
  sortOrder: number;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
}

/** 雇主品牌视图（引用企业资料只读展示） */
export interface EmployerBrand extends AllianceBrand {
  enterpriseName?: string;
  enterpriseLogo?: string;
  enterpriseIndustry?: string;
  enterpriseRegion?: string;
  enterpriseDescription?: string;
  enterpriseCreditCode?: string;
  enterpriseContactPerson?: string;
  enterpriseContactPhone?: string;
  enterpriseContactEmail?: string;
  enterpriseAddress?: string;
  enterpriseEstablishedYear?: number;
  enterpriseEmployeeCount?: number;
  enterpriseCoverImage?: string;
  enterpriseCoverPhotos?: string[];
  enterpriseBusinessLicensePhotos?: string[];
  enterpriseIntellectualPropertyPhotos?: string[];
  enterpriseQualificationPhotos?: string[];
}

/** 岗位品牌视图（关联岗位资料） */
export interface JobBrand extends AllianceBrand {
  positionName?: string;
  positionType?: string;
  salaryMin?: number;
  salaryMax?: number;
  majorNames?: string[];
  positionStatus?: string;
}

export interface AllianceEnterprise {
  id: string;
  tenantId: string;
  name: string;
  enterpriseType: string;
  industry?: string;
  region?: string;
  description?: string;
  logoUrl?: string;
  status: string;
  rating?: string;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AllianceExpert {
  id: string;
  tenantId: string;
  name: string;
  gender?: string;
  title?: string;
  position?: string;
  organization?: string;
  industry?: string;
  rating?: string;
  status: string;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AllianceDictionary {
  id: string;
  tenantId: string;
  dictType: string;
  code: string;
  name: string;
  sortOrder: number;
  createdAt: string;
}

/** 独立雇主企业资料（学校登记，仅品牌模块可见） */
export interface EnterpriseInfo {
  name?: string;
  enterpriseType?: string;
  unifiedSocialCreditCode?: string;
  industry?: string;
  region?: string;
  establishedYear?: number;
  employeeCount?: number;
  contactPerson?: string;
  contactPhone?: string;
  contactEmail?: string;
  address?: string;
  description?: string;
  logoUrl?: string;
  coverImage?: string;
  coverPhotos?: string[];
  businessLicensePhotos?: string[];
  qualificationPhotos?: string[];
  intellectualPropertyPhotos?: string[];
  secondaryColleges?: string[];
}

export interface RefItem {
  id: string;
  name: string;
}

// 人才画像排名
export interface TalentRankPosition {
  positionId: string;
  positionName: string;
  achievementRate: number;
  positionCompetency?: number;
  positionCompetencyV2?: number;
  abilityCognitionScore?: number;
  totalAbilityPoints: number;
  achievedAbilityPoints: number;
  grade?: string;
  evaluatedAt: string;
}

export interface TalentRankStudent {
  studentId: string;
  studentNo: string;
  name: string;
  majorId?: string;
  majorName: string;
  className: string;
  departmentName: string;
  avgAchievementRate?: number;
  avgPositionCompetency?: number;
  avgPositionCompetencyV2?: number;
  avgAbilityCognitionScore?: number;
  positionCount: number;
  positions?: TalentRankPosition[];
}

export interface TalentRankMajorGroup {
  majorId: string;
  majorName: string;
  enabled: boolean;
  rankLimit: number;
  studentCount: number;
  students: TalentRankStudent[];
}

export interface BrandMajorRankConfig {
  majorId: string;
  enabled: boolean;
  rankLimit: number;
}

export interface MajorOption {
  id: string;
  name: string;
  code?: string;
}

// ==================== 字典与标签 ====================

export function brandTypeLabel(value?: string | null): string {
  const map: Record<string, string> = {
    talent: '人才品牌',
    employer: '雇主品牌',
    job: '岗位品牌',
    major: '专业品牌',
    teacher: '师资品牌',
    culture: '文化品牌',
  };
  if (value == null || value === '') return '-';
  return map[value] ?? value;
}

export function positionTypeLabel(value?: string | null): string {
  if (value === 'teaching') return '教学岗位';
  if (value === 'enterprise') return '企业岗位';
  return '-';
}

export function enterpriseTypeLabel(value?: string | null): string {
  if (value === 'cooperation') return '合作企业';
  if (value === 'third-party' || value === 'platform') return '第三方雇主企业';
  if (value === 'school-based') return '合作企业';
  if (value == null || value === '') return '-';
  return value;
}

export function formatSalaryRange(p: {
  salaryMin?: number | null;
  salaryMax?: number | null;
}): string | null {
  const min = p.salaryMin;
  const max = p.salaryMax;
  if (min == null && max == null) return null;
  if (min == null) return `${max}K`;
  if (max == null) return `${min}K`;
  return `${min}-${max}K`;
}

export function salaryText(p: { salaryMin?: number | null; salaryMax?: number | null }): string {
  return formatSalaryRange(p) ?? '-';
}

// ==================== 工具函数 ====================

/** 分页全量拉取（对齐 React fetchAllPages：后端列表 maxPageSize 上限 200） */
export async function fetchAllPages<T>(
  fetcher: (page: number, pageSize: number) => Promise<{ items: T[] }>,
  pageSize = 200,
  maxPages = 1000,
): Promise<T[]> {
  const all: T[] = [];
  for (let page = 0; ; page++) {
    if (page >= maxPages) {
      throw new Error(`fetchAllPages: 超过最大页数 ${maxPages}，疑似分页未生效，已中止`);
    }
    const res = await fetcher(page, pageSize);
    const items = res.items || [];
    all.push(...items);
    if (items.length < pageSize) break;
  }
  return all;
}

/** 兼容旧数据字段（logo/creditCode → logoUrl/unifiedSocialCreditCode） */
export function normalizeEnterpriseInfo(raw?: Record<string, any> | null): EnterpriseInfo {
  if (!raw) return {};
  return {
    ...raw,
    logoUrl: raw.logoUrl || raw.logo || undefined,
    unifiedSocialCreditCode: raw.unifiedSocialCreditCode || raw.creditCode || undefined,
  };
}

export function enterpriseInfoOf(item?: EmployerBrand | AllianceBrand | null): EnterpriseInfo {
  return normalizeEnterpriseInfo(item?.data?.enterpriseInfo);
}

export function positionsOf(item?: EmployerBrand | null): any[] {
  return item?.data?.positions ?? [];
}

export function hiredStudentsOf(item?: EmployerBrand | null): any[] {
  return item?.data?.hiredStudents ?? [];
}

/** 品牌关联企业资料归一化：引用企业取 enterprise* 字段，独立雇主企业取 data.enterpriseInfo */
export function employerEnterpriseOf(brand: EmployerBrand | null): Record<string, any> {
  if (!brand) return {};
  const info = (brand.data?.enterpriseInfo ?? {}) as Record<string, any>;
  const first = <T,>(a?: T, b?: T): T | undefined =>
    a != null && a !== '' ? a : (b ?? undefined);
  return {
    name: first(brand.enterpriseName, info.name ?? brand.name),
    logoUrl: first(brand.enterpriseLogo, info.logoUrl ?? info.logo),
    industry: first(brand.enterpriseIndustry, info.industry),
    region: first(brand.enterpriseRegion, info.region),
    description: first(brand.enterpriseDescription, info.description),
    creditCode: first(brand.enterpriseCreditCode, info.unifiedSocialCreditCode ?? info.creditCode),
    contactPerson: first(brand.enterpriseContactPerson, info.contactPerson),
    contactPhone: first(brand.enterpriseContactPhone, info.contactPhone),
    contactEmail: first(brand.enterpriseContactEmail, info.contactEmail),
    address: first(brand.enterpriseAddress, info.address),
    establishedYear: first(brand.enterpriseEstablishedYear, info.establishedYear),
    employeeCount: first(brand.enterpriseEmployeeCount, info.employeeCount),
    coverImage: first(brand.enterpriseCoverImage ?? undefined, info.coverImage),
    coverPhotos: (brand.enterpriseCoverPhotos?.length
      ? brand.enterpriseCoverPhotos
      : info.coverPhotos ?? []) as string[],
    businessLicensePhotos: (brand.enterpriseBusinessLicensePhotos?.length
      ? brand.enterpriseBusinessLicensePhotos
      : info.businessLicensePhotos ?? []) as string[],
    intellectualPropertyPhotos: (brand.enterpriseIntellectualPropertyPhotos?.length
      ? brand.enterpriseIntellectualPropertyPhotos
      : info.intellectualPropertyPhotos ?? []) as string[],
    qualificationPhotos: (brand.enterpriseQualificationPhotos?.length
      ? brand.enterpriseQualificationPhotos
      : info.qualificationPhotos ?? []) as string[],
    secondaryColleges: (info.secondaryColleges ?? []) as string[],
  };
}
