// 岗位编辑页本地编辑态模型与常量
// 逐字对齐原 React 版：lib/types/job-source.ts（Position 编辑态视图）
// + lib/converters/job-converters.ts（convert* 系列字段映射）
// 说明：Vue 侧 types/job.ts 只描述后端裸 JSON DTO，编辑态（salaryRange 元组、
// certificates/responsibilities/abilityBindings 内联）为页面局部模型，按契约禁止改 types/*.ts，故内联于此。

import type {
  AbilityDomain as ApiAbilityDomain,
  AbilityPoint as ApiAbilityPoint,
  CareerPosition,
  PositionAbilityBinding as ApiPositionAbilityBinding,
  PositionCertificate as ApiPositionCertificate,
  PositionResponsibility as ApiPositionResponsibility,
  PositionType
} from '@/types/job';

export type CompetencyLevel = 'understand' | 'comprehend' | 'master' | 'proficient' | 'expert';

/** 工作职责（编辑态） */
export interface LocalResponsibility {
  id: string;
  name: string;
  description: string;
}

/** 岗位关联证书（编辑态；libraryId 指向证书库条目） */
export interface LocalCertificate {
  id: string;
  libraryId?: string;
  name: string;
  url: string;
  description: string;
  image?: string;
}

/** 职责 ↔ 能力点绑定（编辑态） */
export interface LocalAbilityBinding {
  id: string;
  responsibilityId: string;
  source: 'public' | 'custom';
  /** 引用公共能力点库时的能力点 id */
  publicAbilityId?: string;
  abilityPointId?: string;
  name: string;
  level: CompetencyLevel;
  rubricDescription: string;
  description?: string;
  attributes?: string[];
  domain?: string;
}

/** 能力域（编辑态） */
export interface LocalAbilityDomain {
  id: string;
  name: string;
  description: string;
  bindingIds: string[];
}

/** 公共能力点库条目（编辑态） */
export interface LocalAbility {
  id: string;
  name: string;
  code?: string;
  description: string;
  attributes: string[];
  isPublic: boolean;
  createdAt?: string;
}

/** 岗位编辑态（对齐 React Position） */
export interface LocalPosition {
  id: string;
  code: string;
  batchId: string;
  version: string;
  status: string;
  name: string;
  shortName: string;
  /** 行业字典 id（React Position.industry 同义） */
  industry: string;
  /** 专业字典 id 列表 */
  majors: string[];
  positionType: PositionType;
  salaryRange: [number, number];
  coverImage?: string;
  description: string;
  requirements: string[];
  careerPath: string;
  certificates: LocalCertificate[];
  responsibilities: LocalResponsibility[];
  abilityBindings: LocalAbilityBinding[];
  abilityDomains: LocalAbilityDomain[];
  createdBy: string;
  collaborators: string[];
  createdAt: string;
  updatedAt: string;
  sourceType?: 'school' | 'enterprise';
}

// ===== 常量（逐字对齐 React） =====

/** 掌握程度五档（step-ability-modeling.tsx competencyLevels） */
export const COMPETENCY_LEVELS: { value: CompetencyLevel; label: string; description: string }[] = [
  { value: 'understand', label: '了解', description: '了解基本概念，能在指导下完成简单任务' },
  { value: 'comprehend', label: '理解', description: '理解原理和方法，能独立完成基本任务' },
  { value: 'master', label: '掌握', description: '能独立完成常规任务，处理一般问题' },
  { value: 'proficient', label: '熟练', description: '能处理复杂任务，指导他人，优化流程' },
  { value: 'expert', label: '精通', description: '行业专家水平，能创新和引领发展方向' }
];

/** 能力属性三档（ABILITY_ATTRIBUTES） */
export const ABILITY_ATTRIBUTES = ['知识', '素养', '技能'];

/** 能力领域字典（step3-result-table.tsx ABILITY_DOMAINS，保存值保持不变） */
export const ABILITY_DOMAINS: { value: string; hint: string }[] = [
  { value: '岗位与行业认知', hint: '如行业常识、岗位职责、发展趋势类能力点' },
  { value: '专业知识', hint: '如专业理论、概念、原理、标准、规范、法规等知识类能力点' },
  { value: '专业技能', hint: '如实操、工具使用、业务处理、专项操作类能力点' },
  { value: '通用能力', hint: '如沟通、协作、思维、学习、执行、管理等通用综合能力点' },
  { value: '职业素养/价值观', hint: '价值观、责任心、敬业度、职业操守等素养类能力点' }
];

const RESP_COLORS = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#f43f5e',
  '#8b5cf6',
  '#06b6d4',
  '#f97316',
  '#14b8a6'
];

/** 职责色点（对齐 React getRespColor 的 hash 取模逻辑） */
export function getRespColor(respId: string): string {
  let hash = 0;
  for (let i = 0; i < respId.length; i++) {
    hash = respId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return RESP_COLORS[Math.abs(hash) % RESP_COLORS.length];
}

/** 生成本地 id（对齐 React `${prefix}-${Date.now()}-${random}`） */
export function localId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** 掌握程度：兼容后端/AI 可能返回的中文标签（Java 演示实现返回「掌握」） */
export function normalizeLevel(raw?: string): CompetencyLevel {
  if (!raw) return 'understand';
  const hit = COMPETENCY_LEVELS.find((l) => l.value === raw || l.label === raw);
  return hit ? hit.value : 'understand';
}

// ===== 转换器（对齐 job-converters.ts） =====

export function convertCareerPositionToLocal(cp: CareerPosition): LocalPosition {
  return {
    id: cp.id,
    code: cp.code || '',
    batchId: cp.batchId || '',
    version: cp.version,
    status: cp.status,
    name: cp.name,
    shortName: cp.shortName || (cp.name.length > 10 ? cp.name.slice(0, 10) : cp.name),
    industry: cp.industryId || '',
    majors: cp.majorIds || [],
    positionType: cp.positionType,
    // 任一端缺失时两端一并置 0，避免出现 [8000, 0] 这类非单调区间
    salaryRange:
      cp.salaryMin != null && cp.salaryMax != null ? [cp.salaryMin, cp.salaryMax] : [0, 0],
    coverImage: cp.coverImage,
    description: cp.description || '',
    requirements: cp.requirements || [],
    careerPath: cp.careerPath || '',
    certificates: [],
    responsibilities: [],
    abilityBindings: [],
    abilityDomains: [],
    createdBy: cp.createdBy,
    collaborators: cp.collaborators || [],
    createdAt: cp.createdAt,
    updatedAt: cp.updatedAt,
    sourceType: cp.sourceType
  };
}

export function convertApiResponsibilityToLocal(r: ApiPositionResponsibility): LocalResponsibility {
  return { id: r.id, name: r.name, description: r.description ?? '' };
}

export function convertApiCertificateToLocal(c: ApiPositionCertificate): LocalCertificate {
  return {
    id: c.id,
    libraryId: c.certificateLibraryId,
    name: c.name,
    url: c.url ?? '',
    description: c.description ?? '',
    image: c.imageUrl ?? ''
  };
}

export function convertApiAbilityBindingToLocal(
  b: ApiPositionAbilityBinding
): LocalAbilityBinding {
  return {
    id: b.id,
    responsibilityId: b.responsibilityId,
    source: (b.source as 'public' | 'custom') || 'custom',
    publicAbilityId: b.source === 'public' ? b.abilityPointId : undefined,
    abilityPointId: b.abilityPointId,
    // 后端 JOIN 直接返回名称，无需再拉全量能力点列表
    name: b.abilityName || '',
    level: normalizeLevel(b.requiredLevel),
    rubricDescription: b.rubricDescription ?? '',
    description: b.rubricDescription ?? '',
    attributes: b.attributes || [],
    domain: b.domain ?? ''
  };
}

export function convertApiAbilityDomainToLocal(d: ApiAbilityDomain): LocalAbilityDomain {
  return {
    id: d.id,
    name: d.name,
    description: d.description ?? '',
    bindingIds: d.bindingIds || []
  };
}

export function convertApiAbilityToLocal(a: ApiAbilityPoint): LocalAbility {
  return {
    id: a.id,
    name: a.name,
    code: a.code,
    description: a.description ?? '',
    attributes: a.attributes || [],
    isPublic: a.isPublic ?? false,
    createdAt: a.createdAt
  };
}

/**
 * 分页全量拉取（对齐 @zhiyu/api-client fetchAllPages）：
 * 后端列表接口 maxPageSize 上限 200，客户端需分页合并避免静默截断。
 */
export async function fetchAllPages<T>(
  fetcher: (page: number, pageSize: number) => Promise<{ items: T[] }>,
  pageSize = 200,
  maxPages = 1000
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
