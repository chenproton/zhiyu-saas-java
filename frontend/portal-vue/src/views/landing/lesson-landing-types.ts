// 课程广场（lesson landing）共享类型与工具。
// 对齐 React 侧 frontend/packages/shared-types（SCENE_DIFFICULTY / EVAL_METHOD_LABELS / EVAL_METHOD_COLORS /
// evalRuleConfigToMethods、snapshot.ts 课程快照）与 frontend/edu/lib/snapshot-converters.ts 的课程快照转换。
// 接口契约与 React 完全一致（裸 JSON、{items,total}、limit/offset、snake_case 快照 bundle）。
import { request, buildQuery } from '@/api/http';
import type { ListResponse } from '@/api/http';
import type { Course, KnowledgePoint, SystemCourseNode } from '@/types/lesson';
import { RESOURCE_TYPE_SHORT_LABELS } from '@/types/library';
import { coverGradientFor, formatDate } from './evaluation-types';

export { coverGradientFor, formatDate, RESOURCE_TYPE_SHORT_LABELS };

/* ---------- 难度（对齐 SCENE_DIFFICULTY，课程 difficulty 1-5） ---------- */

export interface SceneDifficultyConfig {
  label: string;
  color: string;
  bg: string;
  border: string;
}

export const SCENE_DIFFICULTY: Record<number, SceneDifficultyConfig> = {
  1: { label: '入门', color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
  2: { label: '初级', color: '#ca8a04', bg: '#fefce8', border: '#fde047' },
  3: { label: '中级', color: '#ea580c', bg: '#fff7ed', border: '#fed7aa' },
  4: { label: '高级', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
  5: { label: '专家', color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' }
};

/* ---------- 评价方式（学习端展示，对齐 EVAL_METHOD_LABELS / EVAL_METHOD_COLORS） ---------- */

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

/** 测评方法视图模型（学习页 EvalMethodCard / 提交弹窗消费） */
export interface EvalMethodViewModel {
  methodKey: string;
  weight: number;
  label?: string;
  description?: string;
  resourceConfig?: Record<string, any>;
  reviewSteps?: Array<{ id?: string; label: string; description?: string; enabled: boolean; [key: string]: any }>;
  evalPoints?: Array<{ id?: string; name: string; [key: string]: any }>;
}

/** 测评结果最小结构（NodeEvaluationResult 兼容） */
export interface LearnEvalResult {
  methodKey: string;
  status: string;
  totalScore?: number;
  maxScore?: number;
}

export interface EvalMethodSubmitPayload {
  methodKey: string;
  subjectiveContent?: Record<string, any>;
  maxScore?: number;
}

export interface UploadedFile {
  name: string;
  url: string;
  size: number;
}

/** 评价规则配置解析（对齐 React evalRuleConfigToMethods，宽松类型：node.evalData 为 jsonb 任意结构） */
export interface EvalRuleMethodInput {
  methodKey: string;
  weight: number;
  evalObject: string;
  scoreType?: string | null;
  evalSubjects?: unknown[];
  standardName?: string | null;
  standardMode?: string | null;
  isEnabled: boolean;
  evalPoints: Array<{ id?: string; name: string; [key: string]: any }>;
  scoreRules: unknown[];
  reviewSteps: Array<{ id?: string; label: string; description?: string; enabled: boolean; [key: string]: any }>;
  resourceConfig: Record<string, any>;
}

export function evalRuleConfigToMethods(config: any): EvalRuleMethodInput[] {
  const evalPointFieldMap: Record<string, string> = {
    random_draw: 'randomDrawEvalPoints',
    review: 'reviewEvalPoints',
    paper: 'paperEvalPoints',
    question_bank: 'questionBankEvalPoints',
    outcome: 'outcomeEvalPoints',
    homework: 'homeworkEvalPoints',
    quiz: 'quizEvalPoints'
  };
  const scoreTypeFieldMap: Record<string, string> = {
    random_draw: 'randomDrawScoreType',
    review: 'reviewScoreType',
    outcome: 'outcomeScoreType',
    homework: 'homeworkScoreType'
  };
  const standardNameFieldMap: Record<string, string> = {
    random_draw: 'randomDrawStandardName',
    review: 'reviewStandardName',
    outcome: 'outcomeStandardName',
    homework: 'homeworkStandardName'
  };
  const standardModeFieldMap: Record<string, string> = {
    random_draw: 'randomDrawStandardMode',
    review: 'reviewStandardMode',
    outcome: 'outcomeStandardMode',
    homework: 'homeworkStandardMode'
  };
  const scoreRulesFieldMap: Record<string, string> = {
    random_draw: 'randomDrawScoreRules',
    review: 'reviewScoreRules',
    outcome: 'outcomeScoreRules',
    homework: 'homeworkScoreRules'
  };

  const allMethodKeys = Array.from(
    new Set<string>([...(config?.evaluationMethods || []), ...(config?.disabledEvaluationMethods || [])])
  );

  return allMethodKeys.map((mk) => {
    const evalPoints = (evalPointFieldMap[mk] ? (config?.[evalPointFieldMap[mk]] as any[]) || [] : []).map(
      (p: any, i: number) => ({
        id: p.id,
        name: p.name,
        description: p.desc || null,
        weight: p.weight || 0,
        sortOrder: i
      })
    );
    const scoreType = scoreTypeFieldMap[mk] ? (config?.[scoreTypeFieldMap[mk]] as string | null) : null;
    const standardName = standardNameFieldMap[mk]
      ? (config?.[standardNameFieldMap[mk]] as string | undefined)
      : undefined;
    const standardMode = standardModeFieldMap[mk]
      ? (config?.[standardModeFieldMap[mk]] as string | undefined)
      : undefined;
    const scoreRules = (
      scoreRulesFieldMap[mk] ? (config?.[scoreRulesFieldMap[mk]] as any[]) || [] : []
    ).map((sr: any, i: number) => ({
      name: sr.name,
      description: sr.desc || null,
      rule: sr.rule || null,
      weight: sr.weight || 0,
      sortOrder: i
    }));

    const resourceConfig: Record<string, any> = { ...(config?.methodResourceConfigs?.[mk] || {}) };
    if (mk === 'paper') {
      const paperId = config?.paperIds?.[0];
      if (paperId) {
        resourceConfig.paperId = paperId;
        resourceConfig.paperWeight = config?.paperWeights?.[paperId] ?? 100;
      }
    }
    if (mk === 'question_bank') resourceConfig.questionIds = config?.questionBankQuestions;
    if (mk === 'quiz') resourceConfig.questionIds = config?.quizQuestions;
    if (mk === 'random_draw') {
      resourceConfig.customQuestions = config?.randomDrawCustomQuestions;
      resourceConfig.selectedQuestionIds = config?.randomDrawSelectedIds;
    }

    return {
      methodKey: mk,
      weight: config?.methodWeights?.[mk] || 0,
      evalObject: config?.methodEvalObjects?.[mk] || config?.evalObject || 'individual',
      scoreType,
      evalSubjects: config?.methodEvalSubjects?.[mk]?.length ? config.methodEvalSubjects[mk] : config?.evalSubjects || [],
      standardName: standardName || null,
      standardMode: standardMode || null,
      isEnabled: (config?.evaluationMethods || []).includes(mk),
      evalPoints: standardMode === 'score_rule' ? [] : evalPoints,
      scoreRules: standardMode === 'score_rule' ? scoreRules || [] : [],
      reviewSteps: mk === 'review' ? config?.reviewSteps || [] : [],
      resourceConfig
    };
  });
}

/* ---------- 课程快照 bundle（/lesson/courses/{id}/snapshot，snake_case jsonb） ---------- */

export interface SnapshotKnowledgePoint {
  id: string;
  name: string;
  code?: string;
  description?: string;
}

export interface SnapshotResourceItem {
  id: string;
  name: string;
  resource_type?: string;
  url?: string;
  description?: string;
  thumbnail?: string;
  file_size?: number;
  metadata?: Record<string, unknown>;
}

export interface CourseSnapshotCourse {
  id: string;
  code?: string;
  name: string;
  type?: string;
  category?: string;
  major_id?: string;
  teacher_id?: string;
  industry_id?: string;
  version?: string;
  online_hours?: number;
  offline_hours?: number;
  online_weight?: number;
  offline_weight?: number;
  semester?: string;
  class_name?: string;
  status?: string;
  cover_color?: string;
  cover_image?: string;
  course_tag?: string;
  difficulty?: string | number;
  description?: string;
  creator_id?: string;
  co_creator_ids?: string[];
  batch_id?: string;
  knowledge_point_ids?: string[];
  ability_point_ids?: string[];
  resource_ids?: string[];
  eval_data?: Record<string, unknown>;
  node_count?: number;
  resource_count?: number;
  study_count?: number;
}

export interface CourseSnapshotNode {
  id: string;
  course_id: string;
  parent_id?: string;
  name: string;
  code?: string;
  sort_order?: number;
  ref_type?: string;
  source_id?: string;
  source_name?: string;
  teaching_goals?: string;
  detailed_description?: string;
  description_pdf?: string;
  background?: string;
  estimated_hours?: number;
  duration?: number;
  difficulty?: string | number;
  knowledge_point_ids?: string[];
  resource_ids?: string[];
  ability_point_ids?: string[];
  eval_data?: Record<string, unknown>;
  status?: string;
}

export interface CourseSnapshotResourceBinding {
  id: string;
  course_id: string;
  resource_id: string;
}

export interface CourseSnapshotNodeKnowledgeBinding {
  id: string;
  node_id: string;
  knowledge_point_id: string;
}

export interface CourseSnapshotNodeResourceBinding {
  id: string;
  node_id: string;
  resource_id: string;
}

export interface CourseSnapshotHybridModule {
  id: string;
  node_id: string;
  module_key: string;
  mode?: string;
  data?: Record<string, any>;
}

export interface CourseSnapshot {
  course: CourseSnapshotCourse;
  system_course_nodes: CourseSnapshotNode[];
  node_quizzes: unknown[];
  node_quiz_questions: unknown[];
  hybrid_node_modules: CourseSnapshotHybridModule[];
  course_knowledge_bindings: unknown[];
  course_resource_bindings: CourseSnapshotResourceBinding[];
  node_knowledge_point_bindings: CourseSnapshotNodeKnowledgeBinding[];
  node_resource_bindings: CourseSnapshotNodeResourceBinding[];
  knowledge_points: SnapshotKnowledgePoint[];
  resource_library: SnapshotResourceItem[];
  granular_courses: Record<string, unknown>;
}

/* ---------- 快照 → 页面模型转换（对齐 React snapshot-converters.ts 课程部分） ---------- */

const num = (v: unknown, fallback = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

/** 学习页/详情页使用的完整节点模型（SystemCourseNode + 快照补充字段） */
export interface LessonNodeResource {
  id: string;
  nodeId: string;
  name: string;
  type: string;
  url: string;
  size?: number;
  description?: string;
}

export interface LessonNodeKnowledgePoint {
  id: string;
  name: string;
  code?: string;
  description?: string;
  linked?: boolean;
}

export interface LessonNode extends SystemCourseNode {
  descriptionPdf?: string;
  knowledgePoints?: LessonNodeKnowledgePoint[];
  resources?: LessonNodeResource[];
  evalData?: Record<string, unknown>;
}

/** 快照知识点 → 页面模型（补全 KnowledgePoint 缺省字段，对齐 React snapshotKnowledgePoint） */
export function snapshotKnowledgeMap(items: SnapshotKnowledgePoint[]): Map<string, KnowledgePoint> {
  const map = new Map<string, KnowledgePoint>();
  items.forEach((k) =>
    map.set(k.id, {
      id: k.id,
      name: k.name,
      code: k.code,
      description: k.description,
      linked: false,
      granularLessonIds: [],
      createdAt: '',
      updatedAt: ''
    })
  );
  return map;
}

function snapshotNodeResource(r: SnapshotResourceItem, nodeId: string): LessonNodeResource {
  return {
    id: r.id,
    nodeId,
    name: r.name,
    type: r.resource_type || 'file',
    url: r.url || '',
    size: r.file_size,
    description: r.description
  };
}

/** 主表合并：bundle 内容字段覆盖 live 元数据（creator/updatedAt/viewCount 等动态字段保留 live） */
export function mergeCourseSnapshot(live: Course | null, c: CourseSnapshotCourse): Course {
  return {
    ...(live ?? ({} as Course)),
    id: c.id,
    code: c.code,
    name: c.name,
    type: (c.type as Course['type']) || 'system',
    category: c.category ?? live?.category ?? '',
    majorId: c.major_id,
    teacherId: c.teacher_id,
    industryId: c.industry_id,
    version: c.version ?? live?.version,
    onlineHours: c.online_hours,
    offlineHours: c.offline_hours,
    onlineWeight: c.online_weight,
    offlineWeight: c.offline_weight,
    semester: c.semester,
    className: c.class_name,
    coverColor: c.cover_color,
    coverImage: c.cover_image,
    courseTag: c.course_tag,
    difficulty: c.difficulty !== undefined ? num(c.difficulty) : undefined,
    description: c.description,
    creatorId: c.creator_id ?? live?.creatorId ?? '',
    coCreatorIds: c.co_creator_ids,
    batchId: c.batch_id,
    knowledgePointIds: c.knowledge_point_ids,
    abilityPointIds: c.ability_point_ids,
    resourceIds: c.resource_ids,
    evalData: c.eval_data,
    nodeCount: c.node_count ?? live?.nodeCount ?? 0,
    resourceCount: c.resource_count ?? live?.resourceCount ?? 0,
    studyCount: c.study_count ?? live?.studyCount ?? 0,
    status: (c.status as Course['status']) || live?.status || 'published',
    createdAt: live?.createdAt ?? '',
    updatedAt: live?.updatedAt ?? ''
  };
}

/** 节点资源 id 集 = 节点列 resource_ids ∪ node_resource_bindings，经 resource_library 取内容 */
export function courseSnapshotNodes(snap: CourseSnapshot): LessonNode[] {
  const kpMap = new Map(snap.knowledge_points.map((k) => [k.id, k]));
  const resMap = new Map(snap.resource_library.map((r) => [r.id, r]));
  const nodeKpBindings = new Map<string, string[]>();
  snap.node_knowledge_point_bindings.forEach((b) => {
    const list = nodeKpBindings.get(b.node_id) || [];
    list.push(b.knowledge_point_id);
    nodeKpBindings.set(b.node_id, list);
  });
  const nodeResBindings = new Map<string, string[]>();
  snap.node_resource_bindings.forEach((b) => {
    const list = nodeResBindings.get(b.node_id) || [];
    list.push(b.resource_id);
    nodeResBindings.set(b.node_id, list);
  });
  const dedupe = (ids: (string | undefined)[]) => Array.from(new Set(ids.filter(Boolean) as string[]));

  return snap.system_course_nodes.map((n: CourseSnapshotNode) => {
    const kpIds = dedupe([...(n.knowledge_point_ids || []), ...(nodeKpBindings.get(n.id) || [])]);
    const resIds = dedupe([...(n.resource_ids || []), ...(nodeResBindings.get(n.id) || [])]);
    return {
      id: n.id,
      courseId: n.course_id,
      parentId: n.parent_id ?? null,
      name: n.name,
      code: n.code,
      order: n.sort_order ?? 0,
      type: (n.ref_type as string) || 'normal',
      sourceId: n.source_id,
      sourceName: n.source_name,
      teachingGoals: n.teaching_goals,
      detailedDescription: n.detailed_description,
      descriptionPdf: n.description_pdf,
      background: n.background,
      estimatedHours: n.estimated_hours,
      duration: n.duration,
      difficulty: n.difficulty !== undefined ? num(n.difficulty) : undefined,
      status: n.status || 'published',
      knowledgePoints: kpIds
        .map((kid) => kpMap.get(kid))
        .filter(Boolean)
        .map((k) => ({ id: k!.id, name: k!.name, code: k!.code, description: k!.description, linked: false })),
      resources: resIds
        .map((rid) => resMap.get(rid))
        .filter(Boolean)
        .map((r) => snapshotNodeResource(r!, n.id)),
      evalData: n.eval_data
    };
  });
}

/** 课程级资源（原 courseResourceApi.list）：课程列 resource_ids ∪ course_resource_bindings */
export function courseSnapshotCourseResources(snap: CourseSnapshot): LessonNodeResource[] {
  const resMap = new Map(snap.resource_library.map((r) => [r.id, r]));
  const ids = new Set<string>([
    ...(snap.course.resource_ids || []),
    ...snap.course_resource_bindings.map((b) => b.resource_id)
  ]);
  return Array.from(ids)
    .map((rid) => resMap.get(rid))
    .filter(Boolean)
    .map((r) => snapshotNodeResource(r!, 'course'));
}

export function courseSnapshotHybridModules(snap: CourseSnapshot): CourseSnapshotHybridModule[] {
  return snap.hybrid_node_modules.map((m) => ({
    id: m.id,
    node_id: m.node_id,
    module_key: m.module_key,
    mode: m.mode || 'online',
    data: m.data ?? {}
  }));
}

/* ---------- 直连端点（Vue api 层未封装，按 React 用法 request() 直连同一后端契约） ---------- */

/** GET /lesson/courses/{id}/snapshot（version 缺省 = 最新已发布快照，学生侧已剥离答案） */
export function courseSnapshotGet(id: string, params?: { version?: string }): Promise<CourseSnapshot> {
  return request<CourseSnapshot>(`/lesson/courses/${id}/snapshot${buildQuery(params || {})}`);
}

/** GET /lesson/course-resources（live 预览路径，教师/管理员） */
export function courseResourceList(params?: {
  courseId?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<ListResponse<LessonNodeResource>> {
  return request<ListResponse<LessonNodeResource>>(`/lesson/course-resources${buildQuery(params || {})}`);
}

/** GET /lesson/hybrid-modules（混合课 live 预览路径） */
export function hybridModuleList(params?: { nodeId?: string; courseId?: string; limit?: number }): Promise<
  ListResponse<CourseSnapshotHybridModule>
> {
  return request<ListResponse<CourseSnapshotHybridModule>>(`/lesson/hybrid-modules${buildQuery(params || {})}`);
}

/** POST /lesson/node-evaluation-results（提交测评结果，api/lesson.ts 未封装 submit） */
export function nodeEvaluationResultSubmit(req: {
  nodeId: string;
  expectedVersion?: string;
  methodKey: string;
  evaluateeId: string;
  maxScore?: number;
  subjectiveContent?: Record<string, any>;
}): Promise<unknown> {
  return request('/lesson/node-evaluation-results', { method: 'POST', body: JSON.stringify(req) });
}

/* ---------- 其它工具 ---------- */

/** 字节数格式化（对齐 React formatSize） */
export function formatSize(bytes?: number | null): string {
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** 考试作答页链接（对齐 React examHref，参数以对端页面实际消费为准） */
export function examHref(examId: string, params: Record<string, string | null | undefined>): string {
  const query = Object.entries(params)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}=${encodeURIComponent(v as string)}`)
    .join('&');
  return `/evaluation/landing/exams/${examId}${query ? `?${query}` : ''}`;
}
