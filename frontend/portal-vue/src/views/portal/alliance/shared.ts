// 产教联盟前台（portal/alliance）共享类型与工具函数。
// 逐字移植原 React 版 shared-types 的 alliance.ts、
// lib/format-utils.ts、format-salary.ts 与 public-cards 中的纯函数。
// 因任务约束禁止修改 src/types/alliance.ts / src/api/*.ts，此处自包含一份完整前台类型与字典。

// ==================== 类型 ====================

export interface AllianceEnterprise {
  id: string;
  tenantId: string;
  name: string;
  enterpriseType: string;
  industry?: string;
  region?: string;
  description?: string;
  logoUrl?: string;
  coverImage?: string;
  status: string;
  rating?: string;
  cooperationTypes?: string[];
  contactPerson?: string;
  contactPhone?: string;
  contactEmail?: string;
  address?: string;
  unifiedSocialCreditCode?: string;
  establishedYear?: number;
  employeeCount?: number;
  businessLicensePhotos?: string[];
  qualificationPhotos?: string[];
  intellectualPropertyPhotos?: string[];
  coverPhotos?: string[];
  secondaryColleges?: string[];
  isPublic: boolean;
  enablePublic?: boolean;
  projectCount?: number;
  agreementCount?: number;
  achievementCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface AllianceProject {
  id: string;
  tenantId: string;
  name: string;
  type?: string;
  description?: string;
  phase: string;
  publishStatus: string;
  startDate?: string;
  endDate?: string;
  budget?: string;
  coverImage?: string;
  enterpriseIds?: string[];
  agreementIds?: string[];
  secondaryColleges?: string[];
  isPublic: boolean;
  progress?: number;
  createdAt: string;
  updatedAt: string;
}

export interface AllianceProjectMilestone {
  id: string;
  tenantId: string;
  projectId: string;
  name: string;
  description?: string;
  dueDate?: string;
  completedDate?: string;
  isCompleted: boolean;
  sortOrder: number;
}

export interface AllianceRelatedRef {
  id: string;
  name: string;
  code?: string;
  coverImage?: string;
}

export interface AllianceAchievement {
  id: string;
  tenantId: string;
  title: string;
  type: string;
  description?: string;
  achievementDate?: string;
  coverImage?: string;
  attachments?: string[];
  citationReason?: string;
  images?: string[];
  ownerPersons?: string[];
  coBuilders?: string[];
  enterpriseIds?: string[];
  projectIds?: string[];
  relatedPositions?: AllianceRelatedRef[];
  relatedScenes?: AllianceRelatedRef[];
  relatedCourses?: AllianceRelatedRef[];
  status: string;
  viewCount: number;
  secondaryColleges?: string[];
  isPublic: boolean;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
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
  attachments?: string[];
  enterpriseId?: string;
  enterpriseName?: string;
  organization?: string;
  rating?: string;
  status: string;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AlliancePublicAgreement {
  id: string;
  name: string;
  type?: string;
  status: string;
  startDate?: string;
  endDate?: string;
  enterpriseIds?: string[];
  projectIds?: string[];
}

export interface PositionResponsibility {
  id: string;
  careerPositionId: string;
  name: string;
  description?: string;
  sortOrder: number;
}

export interface PositionCertificate {
  id: string;
  careerPositionId: string;
  certificateLibraryId: string;
  name: string;
  url?: string;
  description?: string;
  imageUrl?: string;
}

export interface AlliancePublicBrand {
  id: string;
  tenantId: string;
  brandType: string;
  name: string;
  status: string;
  isPublic: boolean;
  isFeatured: boolean;
  coverImage?: string;
  coverVideo?: string;
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
  // 雇主品牌：引用合作企业资料
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
  // 岗位品牌
  positionName?: string;
  positionType?: string;
  salaryMin?: number;
  salaryMax?: number;
  majorNames?: string[];
  industryName?: string;
  positionStatus?: string;
  positionDescription?: string;
  positionRequirements?: string[];
  positionCareerPath?: string;
  positionCoverImage?: string;
  responsibilities?: PositionResponsibility[];
  certificates?: PositionCertificate[];
  // 师资品牌
  personName?: string;
  personAvatar?: string;
  personTitle?: string;
  personPosition?: string;
  personOrganization?: string;
  personIndustry?: string;
  personExperienceYears?: number;
  personEducation?: string;
  personIntroduction?: string;
  personWorkExperience?: string;
  personCity?: string;
  personExpertType?: string;
  personRating?: string;
  personStatus?: string;
  personGender?: string;
  personAge?: number;
  personSpecialties?: string[];
  personProfessionalFields?: string[];
  personAttachments?: string[];
}

export interface AlliancePublicStats {
  enterpriseCount: number;
  projectCount: number;
  expertCount: number;
  achievementCount: number;
  brandCount: number;
}

export interface TalentRankStudent {
  studentId: string;
  studentNo: string;
  name: string;
  majorId?: string;
  majorName: string;
  className: string;
  departmentName: string;
  avgAbilityCognitionScore?: number;
}

export interface TalentRankMajorGroup {
  majorId: string;
  majorName: string;
  enabled: boolean;
  rankLimit: number;
  studentCount: number;
  students: TalentRankStudent[];
}

export type EmploymentProjectType = string;

export interface EmploymentProject {
  id: string;
  tenantId: string;
  name: string;
  type: EmploymentProjectType;
  organizer?: string;
  description?: string;
  coverImage?: string;
  startDate?: string;
  endDate?: string;
  publishStatus: 'draft' | 'published';
  enterpriseIds?: string[];
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  jobCount: number;
  applicationCount: number;
}

export interface EmploymentJob {
  id: string;
  tenantId: string;
  enterpriseId: string;
  projectId?: string;
  title: string;
  jobType: string;
  location?: string;
  salaryMin?: number;
  salaryMax?: number;
  headcount?: number;
  education?: string;
  suitableMajors?: string[];
  description?: string;
  responsibilities?: string;
  requirements?: string;
  contactPerson?: string;
  contactPhone?: string;
  deadline?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  enterpriseName?: string;
  projectName?: string;
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
  coverLetter?: string;
  status: 'pending';
  createdAt: string;
  updatedAt: string;
  jobTitle?: string;
  enterpriseName?: string;
  projectName?: string;
}

export interface TenantSchool {
  id: string;
  name: string;
  shortName?: string;
  logoUrl?: string;
  website?: string;
  address?: string;
  province?: string;
  city?: string;
  educationLevel?: string;
  educationNature?: string;
  description?: string;
  scaleData?: Record<string, any>;
  secondaryColleges?: Array<{ name: string; description?: string }>;
}

// ==================== 字典与标签 ====================

export const ALLIANCE_DICTS = {
  enterpriseType: {
    cooperation: '合作企业',
    'third-party': '第三方雇主企业',
    platform: '第三方雇主企业',
    'school-based': '合作企业',
  },
  enterpriseStatus: {
    negotiating: '洽谈中',
    active: '合作中',
    paused: '已暂停',
    terminated: '已终止',
  },
  enterpriseRating: {
    strategic: '战略合作',
    deep: '深度合作',
    general: '一般合作',
  },
  projectPhase: {
    initiation: '启动',
    execution: '执行中',
    acceptance: '验收',
    closure: '关闭',
    archived: '已归档',
    terminated: '已终止',
  },
  publishStatus: {
    draft: '草稿',
    published: '已发布',
    archived: '已归档',
  },
  achievementType: {
    job: '岗位成果',
    scene: '场景成果',
    course: '课程成果',
    custom: '自定义成果',
  },
  achievementStatus: {
    draft: '草稿',
    published: '已发布',
    archived: '已归档',
  },
  agreementStatus: {
    draft: '草稿',
    active: '生效中',
    expired: '已失效',
    renewed: '已续签',
    terminated: '已终止',
  },
  expertRating: {
    gold: '金牌专家',
    silver: '银牌专家',
    copper: '铜牌专家',
  },
  expertStatus: {
    active: '正常',
    inactive: '已停用',
  },
  brandType: {
    talent: '人才品牌',
    employer: '雇主品牌',
    job: '岗位品牌',
    major: '专业品牌',
    teacher: '师资品牌',
    culture: '文化品牌',
  },
  brandStatus: {
    draft: '草稿',
    published: '已发布',
    archived: '已归档',
  },
} as const;

export type AllianceDictKey = keyof typeof ALLIANCE_DICTS;

export function allianceLabel(dictKey: AllianceDictKey, value?: string | null): string {
  if (value == null || value === '') return '-';
  const dict = ALLIANCE_DICTS[dictKey] as Record<string, string>;
  return dict[value] ?? value;
}

export const EMPLOYMENT_PROJECT_TYPE_LABELS: Record<string, string> = {
  spring: '春季招聘',
  autumn: '秋季招聘',
  directed: '定向招聘',
  order: '订单班招聘',
};

export type EmploymentProjectPhase = 'preparing' | 'ongoing' | 'ended';

export const EMPLOYMENT_PROJECT_PHASE_LABELS: Record<EmploymentProjectPhase, string> = {
  preparing: '筹备中',
  ongoing: '进行中',
  ended: '已结束',
};

export function deriveEmploymentProjectPhase(p: {
  startDate?: string;
  endDate?: string;
}): EmploymentProjectPhase {
  const today = new Date().toISOString().slice(0, 10);
  if (p.startDate && p.startDate > today) return 'preparing';
  if (p.endDate && p.endDate < today) return 'ended';
  return 'ongoing';
}

export const EMPLOYMENT_JOB_TYPE_LABELS: Record<string, string> = {
  'full-time': '全职',
  'part-time': '兼职',
  internship: '实习',
  apprentice: '学徒',
};

export const EMPLOYMENT_JOB_STATUS_LABELS: Record<string, string> = {
  draft: '草稿',
  published: '招聘中',
  closed: '已关闭',
};

// ==================== 工具函数 ====================

export function formatDate(value?: string | Date | null, fallback = '-'): string {
  if (!value) return fallback;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return fallback;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function formatDateTime(value?: string | Date | null, fallback = '-'): string {
  if (!value) return fallback;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return fallback;
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
}

export function formatSalaryRange(p: { salaryMin?: number; salaryMax?: number }): string | null {
  if (p.salaryMin == null && p.salaryMax == null) return null;
  if (p.salaryMin == null) return `${p.salaryMax}K`;
  if (p.salaryMax == null) return `${p.salaryMin}K`;
  return `${p.salaryMin}-${p.salaryMax}K`;
}

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

export function normalizeRelatedRefs(
  refs: (AllianceRelatedRef | string)[] | undefined | null,
): AllianceRelatedRef[] {
  return (refs || []).map((ref) => (typeof ref === 'string' ? { id: ref, name: ref } : { ...ref }));
}

export function getInitials(name?: string | null): string {
  if (!name) return '-';
  return name.slice(0, 2);
}

export interface EmployerEnterprise {
  name?: string;
  logoUrl?: string;
  industry?: string;
  region?: string;
  description?: string;
  creditCode?: string;
  contactPerson?: string;
  contactPhone?: string;
  contactEmail?: string;
  address?: string;
  establishedYear?: number;
  employeeCount?: number;
  coverImage?: string;
  coverPhotos?: string[];
  businessLicensePhotos?: string[];
  intellectualPropertyPhotos?: string[];
  qualificationPhotos?: string[];
}

/** 品牌关联企业资料归一化：引用企业取 enterprise* 字段，独立雇主企业取 data.enterpriseInfo */
export function employerBrandOf(brand: AlliancePublicBrand): EmployerEnterprise {
  const info = (brand.data?.enterpriseInfo ?? {}) as Record<string, any>;
  const first = <T,>(a?: T, b?: T): T | undefined => (a != null && a !== '' ? a : (b ?? undefined));
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
    coverImage: first(brand.enterpriseCoverImage, info.coverImage),
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
  };
}

export function brandTags(brand: { data: Record<string, any> }): string[] {
  return Array.isArray(brand.data?.tags) ? (brand.data.tags as string[]) : [];
}

export const COVER_GRADIENTS = [
  'linear-gradient(135deg,#7c3aed,#a855f7)',
  'linear-gradient(135deg,#0e7490,#06b6d4)',
  'linear-gradient(135deg,#047857,#10b981)',
  'linear-gradient(135deg,#b45309,#f59e0b)',
  'linear-gradient(135deg,#1d4ed8,#3b82f6)',
  'linear-gradient(135deg,#b91c1c,#ef4444)',
  'linear-gradient(135deg,#0f766e,#14b8a6)',
  'linear-gradient(135deg,#4338ca,#818cf8)',
];

export function coverGradientFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return COVER_GRADIENTS[h % COVER_GRADIENTS.length];
}
