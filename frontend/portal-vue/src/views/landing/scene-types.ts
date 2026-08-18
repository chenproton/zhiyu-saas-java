// 场景 landing（列表/详情/学习页）共享类型与转换工具。
// 逐字对齐 React frontend/edu/lib/snapshot-converters.ts + learn-links.ts 的语义：
// 学习端走 GET /scene/scenarios/{id}/snapshot 单次快照 bundle（snake_case jsonb），
// 页面渲染沿用 camelCase 模型；动态元数据（创建人/更新时间/浏览量/行业名）由 live 接口补齐后 merge。

import type { Scenario } from '@/types/scene';

/* ============ 快照 bundle 类型（最小集，按实际消费字段收窄） ============ */

export interface SceneSnapshotScenario {
  id: string;
  name: string;
  code?: string;
  cover_image?: string;
  career_position_id?: string;
  industry_ids?: string[];
  profession_ids?: string[];
  batch_id?: string;
  difficulty?: string;
  version?: string;
  background?: string;
  delivery_goal?: string;
  co_builder_ids?: string[];
}

export interface SceneSnapshotTask {
  id: string;
  scenario_id: string;
  name: string;
  code?: string;
  sort_order?: number;
  description?: string;
  detailed_description?: string;
  description_pdf?: string;
  estimated_hours?: number;
  task_type?: string;
  difficulty?: string;
  background?: string;
  dependency_ids?: string[];
  is_referenced?: boolean;
  source_scenario_id?: string;
  knowledge_point_ids?: string[];
  ability_point_ids?: string[];
  resource_ids?: string[];
  eval_data?: Record<string, unknown>;
}

export interface SceneSnapshotEvalMethod {
  id: string;
  task_id: string;
  method_key: string;
  weight?: number;
  resource_config?: Record<string, unknown>;
  version?: number;
  is_enabled?: boolean;
}

export interface SceneSnapshotEvalPoint {
  id: string;
  config_id: string;
  name: string;
  description?: string;
  weight?: number;
  scoring_method?: string;
  grade_mapping?: Record<string, unknown>;
  knowledge_point_ids?: string[];
  ability_point_ids?: string[];
  sort_order?: number;
}

export interface SceneSnapshotReviewStep {
  id: string;
  config_id: string;
  label: string;
  description?: string;
  enabled?: boolean;
  subject_type?: string;
  weight?: number;
  sort_order?: number;
}

export interface SceneSnapshotResourceItem {
  id: string;
  name: string;
  resource_type?: string;
  url?: string;
  description?: string;
  thumbnail?: string;
  file_size?: number;
  metadata?: Record<string, unknown>;
}

export interface SceneSnapshotKnowledgePoint {
  id: string;
  name: string;
  code?: string;
  description?: string;
}

export interface SceneSnapshotAbilityPoint {
  id: string;
  name: string;
  code?: string;
  description?: string;
  attributes?: unknown;
}

export interface SceneSnapshotPositionBinding {
  id: string;
  ability_point_id?: string;
  domain?: string;
}

export interface SceneSnapshotPosition {
  position_ability_bindings?: SceneSnapshotPositionBinding[];
}

export interface SceneSnapshot {
  scenario: SceneSnapshotScenario;
  scenario_tasks: SceneSnapshotTask[];
  task_evaluation_methods: SceneSnapshotEvalMethod[];
  task_eval_points: SceneSnapshotEvalPoint[];
  task_review_steps: SceneSnapshotReviewStep[];
  knowledge_points: SceneSnapshotKnowledgePoint[];
  ability_points: SceneSnapshotAbilityPoint[];
  resource_library: SceneSnapshotResourceItem[];
  position?: SceneSnapshotPosition;
}

/* ============ 页面模型 ============ */

export interface SceneTaskView {
  id: string;
  name: string;
  code?: string;
  sortOrder: number;
  description?: string;
  detailedDescription?: string;
  descriptionPdf?: string;
  estimatedHours: number;
  taskType: 'assessment' | 'training';
  difficulty: number;
  background?: string;
  knowledgePointIds: string[];
  abilityPointIds: string[];
  resourceIds: string[];
  evalData?: Record<string, unknown>;
}

export interface SceneResourceView {
  id: string;
  name: string;
  type: string;
  url?: string;
  description?: string;
  thumbnail?: string;
  size?: string;
}

export interface SceneKnowledgeView {
  id: string;
  name: string;
  code?: string;
  description?: string;
}

export interface SceneAbilityView {
  id: string;
  name: string;
  code?: string;
  description?: string;
  attributes: string[];
}

export interface SceneEvalPointView {
  id: string;
  name: string;
  description?: string;
  weight: number;
  scoringMethod: string;
  gradeMapping?: Record<string, unknown>[];
}

export interface SceneEvalMethodView {
  id: string;
  methodKey: string;
  weight: number;
  resourceConfig: Record<string, unknown>;
  evalPoints: SceneEvalPointView[];
  reviewSteps: { id: string; label: string; enabled: boolean; weight: number }[];
}

export interface SceneEvalResult {
  id: string;
  taskId: string;
  methodKey: string;
  status: string;
  totalScore?: number;
  maxScore?: number;
  comment?: string;
  gradedAt?: string;
  [key: string]: unknown;
}

/* ============ 常量（对齐 React shared-types） ============ */

export const SCENE_DIFFICULTY: Record<number, { label: string; color: string; bg: string; border: string }> = {
  1: { label: '入门', color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
  2: { label: '初级', color: '#ca8a04', bg: '#fefce8', border: '#fde047' },
  3: { label: '中级', color: '#ea580c', bg: '#fff7ed', border: '#fed7aa' },
  4: { label: '高级', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
  5: { label: '专家', color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' }
};

export const EVAL_METHOD_LABELS: Record<string, string> = {
  random_draw: '随机抽题',
  review: '评审',
  paper: '试卷',
  question_bank: '题库',
  outcome: '成果',
  homework: '作业',
  quiz: '测验'
};

export const EVAL_METHOD_COLORS: Record<string, string> = {
  random_draw: '#6366f1',
  review: '#f43f5e',
  paper: '#0ea5e9',
  question_bank: '#8b5cf6',
  outcome: '#10b981',
  homework: '#f59e0b',
  quiz: '#06b6d4'
};

export const RESOURCE_TYPE_SHORT_LABELS: Record<string, string> = {
  document: '文档',
  spreadsheet: '表格',
  image: '图片',
  link: '链接',
  audio: '音频',
  video: '视频',
  archive: '压缩包',
  venue: '场地',
  facility: '设施',
  software: '软件',
  other: '其他',
  file: '文件',
  presentation: '演示',
  pdf: 'PDF'
};

/* ============ 转换工具 ============ */

export function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function mergeScenarioSnapshot(live: Scenario | null, s: SceneSnapshotScenario): Scenario {
  const base = live ?? ({} as Scenario);
  return {
    ...base,
    id: s.id,
    name: s.name,
    code: s.code,
    coverImage: s.cover_image,
    careerPositionId: s.career_position_id,
    industryIds: s.industry_ids,
    professionIds: s.profession_ids,
    batchId: s.batch_id,
    difficulty: num(s.difficulty, 3),
    version: s.version ?? base.version ?? '',
    background: s.background,
    deliveryGoal: s.delivery_goal,
    coBuilderIds: s.co_builder_ids,
    status: base.status ?? 'published',
    creatorId: base.creatorId ?? '',
    createdAt: base.createdAt ?? '',
    updatedAt: base.updatedAt ?? ''
  };
}

export function snapshotTask(t: SceneSnapshotTask): SceneTaskView {
  return {
    id: t.id,
    name: t.name,
    code: t.code,
    sortOrder: t.sort_order ?? 0,
    description: t.description,
    detailedDescription: t.detailed_description,
    descriptionPdf: t.description_pdf,
    estimatedHours: t.estimated_hours ?? 0,
    taskType: (t.task_type === 'assessment' ? 'assessment' : 'training') as SceneTaskView['taskType'],
    difficulty: num(t.difficulty, 3),
    background: t.background,
    knowledgePointIds: t.knowledge_point_ids ?? [],
    abilityPointIds: t.ability_point_ids ?? [],
    resourceIds: t.resource_ids ?? [],
    evalData: t.eval_data
  };
}

export function snapshotResourceMap(items: SceneSnapshotResourceItem[]): Map<string, SceneResourceView> {
  const map = new Map<string, SceneResourceView>();
  items.forEach((r) =>
    map.set(r.id, {
      id: r.id,
      name: r.name,
      type: r.resource_type || 'file',
      url: r.url,
      description: r.description,
      thumbnail: r.thumbnail,
      size: r.file_size !== undefined ? String(r.file_size) : undefined
    })
  );
  return map;
}

export function snapshotKnowledgeMap(items: SceneSnapshotKnowledgePoint[]): Map<string, SceneKnowledgeView> {
  const map = new Map<string, SceneKnowledgeView>();
  items.forEach((k) => map.set(k.id, { id: k.id, name: k.name, code: k.code, description: k.description }));
  return map;
}

export function snapshotAbilityMap(items: SceneSnapshotAbilityPoint[]): Map<string, SceneAbilityView> {
  const map = new Map<string, SceneAbilityView>();
  items.forEach((a) =>
    map.set(a.id, {
      id: a.id,
      name: a.name,
      code: a.code,
      description: a.description,
      attributes: Array.isArray(a.attributes) ? (a.attributes as unknown as string[]) : []
    })
  );
  return map;
}

/** 能力点 → 能力领域映射（快照内嵌岗位树的绑定 domain） */
export function snapshotAbilityDomainMap(snap: SceneSnapshot): Map<string, string> {
  const map = new Map<string, string>();
  snap.position?.position_ability_bindings?.forEach((b) => {
    if (b.domain && b.ability_point_id) map.set(b.ability_point_id, b.domain);
  });
  return map;
}

/** 按 config_id 组装测评方法（替代 taskEvaluationApi.listMethods 的活读） */
export function snapshotEvalMethods(snap: SceneSnapshot, taskId: string): SceneEvalMethodView[] {
  return snap.task_evaluation_methods
    .filter((m) => m.task_id === taskId && m.is_enabled !== false)
    .map((m) => {
      const evalPoints: SceneEvalPointView[] = snap.task_eval_points
        .filter((p) => p.config_id === m.id)
        .map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          weight: p.weight ?? 0,
          scoringMethod: p.scoring_method ?? '',
          gradeMapping: Array.isArray(p.grade_mapping)
            ? (p.grade_mapping as unknown as Record<string, unknown>[])
            : undefined
        }));
      const reviewSteps = snap.task_review_steps
        .filter((s) => s.config_id === m.id)
        .map((s) => ({
          id: s.id,
          label: s.label,
          enabled: s.enabled !== false,
          weight: s.weight ?? 0
        }));
      return {
        id: m.id,
        methodKey: m.method_key,
        weight: m.weight ?? 0,
        resourceConfig: m.resource_config ?? {},
        evalPoints,
        reviewSteps
      };
    });
}

/* ============ 链接拼接（对齐 React learn-links） ============ */

function withResourceVersion(href: string, version?: string | null): string {
  if (!version) return href;
  const sep = href.includes('?') ? '&' : '?';
  return `${href}${sep}v=${encodeURIComponent(version)}`;
}

export function sceneLandingHref(scenarioId: string, version?: string | null): string {
  return withResourceVersion(`/scene/landing/${scenarioId}`, version);
}

export function sceneLearnHref(
  scenarioId: string,
  opts?: { taskId?: string | null; version?: string | null }
): string {
  const base = opts?.taskId
    ? `/scene/landing/${scenarioId}/learn?task=${encodeURIComponent(opts.taskId)}`
    : `/scene/landing/${scenarioId}/learn`;
  return withResourceVersion(base, opts?.version);
}

/** 考试类测评方式 → 作答页链接（试卷版本由对端按 usage 解析，链接不携带 v） */
export function sceneExamHref(
  examId: string,
  params: Record<string, string | null | undefined>
): string {
  const query = Object.entries(params)
    .filter(([, v]) => Boolean(v))
    .map(([k, v]) => `${k}=${encodeURIComponent(v as string)}`)
    .join('&');
  return `/evaluation/landing/exams/${examId}${query ? `?${query}` : ''}`;
}
