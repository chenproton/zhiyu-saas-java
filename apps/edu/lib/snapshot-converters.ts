/**
 * 资源快照 bundle（snake_case jsonb）→ 前端页面模型（camelCase）转换。
 *
 * 学习页/题库浏览页改走 getSnapshot 后，页面渲染逻辑沿用既有模型形状，
 * 转换统一收口在此。bundle 契约 = 教学内容 + 测评配置（文档 8.14），
 * creator/updatedAt/viewCount 等动态元数据不在快照内，由调用方走 live 接口补齐后 merge。
 */
import type {
  AbilityPoint,
  Course,
  CourseSnapshot,
  CourseSnapshotNode,
  HybridNodeModule,
  KnowledgePoint,
  NodeResource,
  Question,
  QuestionBank,
  QuestionBankSnapshot,
  Scenario,
  ScenarioSnapshot,
  ScenarioSnapshotEvalMethod,
  ScenarioTask,
  SnapshotAbilityPoint,
  SnapshotKnowledgePoint,
  SnapshotResourceItem,
  TaskEvalPoint,
  TaskResource,
  TaskReviewStep,
  TaskScoreRule,
  TaskEvaluationMethod,
} from '@/lib/types'
import type { SystemCourseNode } from '@/lib/types/lesson-source'

const num = (v: unknown, fallback = 0): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

/* ---------- 通用：连带引用内容 ---------- */

export function snapshotKnowledgePoint(k: SnapshotKnowledgePoint): KnowledgePoint {
  return {
    id: k.id,
    name: k.name,
    code: k.code,
    description: k.description,
    linked: false,
    granularLessonIds: [],
    createdAt: '',
    updatedAt: '',
  }
}

export function snapshotKnowledgeMap(items: SnapshotKnowledgePoint[]): Map<string, KnowledgePoint> {
  const map = new Map<string, KnowledgePoint>()
  items.forEach((k) => map.set(k.id, snapshotKnowledgePoint(k)))
  return map
}

export function snapshotAbilityPoint(a: SnapshotAbilityPoint): AbilityPoint {
  return {
    id: a.id,
    name: a.name,
    code: a.code,
    description: a.description,
    // DB jsonb 为 string[]（domain AbilityPoint.Attributes）；快照类型标注宽泛，这里按实际收窄
    attributes: Array.isArray(a.attributes) ? (a.attributes as unknown as string[]) : [],
    isPublic: false,
    createdAt: '',
  }
}

export function snapshotAbilityMap(items: SnapshotAbilityPoint[]): Map<string, AbilityPoint> {
  const map = new Map<string, AbilityPoint>()
  items.forEach((a) => map.set(a.id, snapshotAbilityPoint(a)))
  return map
}

/** 与原 resourceLibraryApi.list 映射口径一致（type 取 resource_type，size 取 file_size 字符串化） */
export function snapshotResource(r: SnapshotResourceItem): TaskResource {
  return {
    id: r.id,
    name: r.name,
    type: r.resource_type || 'file',
    url: r.url,
    description: r.description,
    thumbnail: r.thumbnail,
    size: r.file_size !== undefined ? String(r.file_size) : undefined,
    extraData: r.metadata,
    uploadedAt: '',
  }
}

export function snapshotResourceMap(items: SnapshotResourceItem[]): Map<string, TaskResource> {
  const map = new Map<string, TaskResource>()
  items.forEach((r) => map.set(r.id, snapshotResource(r)))
  return map
}

function snapshotNodeResource(r: SnapshotResourceItem, nodeId: string): NodeResource {
  return {
    id: r.id,
    nodeId,
    name: r.name,
    type: r.resource_type || 'file',
    url: r.url || '',
    size: r.file_size,
    description: r.description,
  }
}

/* ---------- 场景快照 ---------- */

export function scenarioSnapshotTask(t: ScenarioSnapshot['scenario_tasks'][number]): ScenarioTask {
  return {
    id: t.id,
    scenarioId: t.scenario_id,
    name: t.name,
    code: t.code ?? '',
    sortOrder: t.sort_order ?? 0,
    description: t.description,
    detailedDescription: t.detailed_description,
    descriptionPdf: t.description_pdf,
    estimatedHours: t.estimated_hours ?? 0,
    taskType: (t.task_type as ScenarioTask['taskType']) || 'training',
    difficulty: num(t.difficulty, 3),
    background: t.background,
    dependencyIds: t.dependency_ids,
    isReferenced: t.is_referenced ?? false,
    sourceScenarioId: t.source_scenario_id,
    knowledgePointIds: t.knowledge_point_ids,
    abilityPointIds: t.ability_point_ids,
    resourceIds: t.resource_ids,
    evalData: t.eval_data,
  }
}

/** 按 config_id 组装测评方法（替代 taskEvaluationApi.listMethods 的活读组装） */
export function scenarioSnapshotEvalMethods(
  snap: ScenarioSnapshot,
  taskId: string,
): TaskEvaluationMethod[] {
  return snap.task_evaluation_methods
    .filter((m) => m.task_id === taskId && m.is_enabled !== false)
    .map((m: ScenarioSnapshotEvalMethod) => {
      const evalPoints: TaskEvalPoint[] = snap.task_eval_points
        .filter((p) => p.config_id === m.id)
        .map((p) => ({
          id: p.id,
          configId: p.config_id,
          name: p.name,
          description: p.description,
          subType: p.sub_type,
          types: p.types,
          weight: p.weight ?? 0,
          scoringMethod: p.scoring_method ?? '',
          gradeMapping: Array.isArray(p.grade_mapping)
            ? (p.grade_mapping as Record<string, any>[])
            : undefined,
          knowledgePointIds: p.knowledge_point_ids,
          abilityPointIds: p.ability_point_ids,
          sortOrder: p.sort_order ?? 0,
        }))
      const scoreRules: TaskScoreRule[] = snap.task_eval_score_rules
        .filter((r) => r.config_id === m.id)
        .map((r) => ({
          id: r.id,
          configId: r.config_id,
          name: r.name,
          description: r.description,
          // DB rule 列为 text（domain TaskScoreRule.Rule *string），快照类型标注宽泛，按实际收窄
          rule: r.rule as unknown as string | undefined,
          weight: r.weight ?? 0,
          sortOrder: r.sort_order ?? 0,
        }))
      const reviewSteps: TaskReviewStep[] = snap.task_review_steps
        .filter((s) => s.config_id === m.id)
        .map((s) => ({
          id: s.id,
          configId: s.config_id,
          label: s.label,
          description: s.description,
          enabled: s.enabled !== false,
          subjectType: s.subject_type,
          weight: s.weight ?? 0,
          sortOrder: s.sort_order ?? 0,
        }))
      return {
        id: m.id,
        taskId: m.task_id,
        methodKey: m.method_key,
        weight: m.weight ?? 0,
        evalObject: m.eval_object ?? '',
        scoreType: m.score_type,
        // DB eval_subjects 为 jsonb 数组；快照类型标注为单对象，按实际兼容两种形态
        evalSubjects: Array.isArray(m.eval_subjects)
          ? (m.eval_subjects as Record<string, any>[])
          : m.eval_subjects
            ? [m.eval_subjects]
            : [],
        standardName: m.standard_name,
        standardMode: m.standard_mode as TaskEvaluationMethod['standardMode'],
        resourceConfig: m.resource_config ?? {},
        version: m.version ?? 0,
        isEnabled: m.is_enabled !== false,
        evalPoints,
        scoreRules,
        reviewSteps,
      }
    })
}

/** 能力点 → 能力领域映射（原 abilityApi.listBindings 活读；快照取内嵌岗位树的绑定 domain） */
export function scenarioSnapshotAbilityDomainMap(snap: ScenarioSnapshot): Map<string, string> {
  const map = new Map<string, string>()
  snap.position?.position_ability_bindings?.forEach((b) => {
    if (b.domain && b.ability_point_id) map.set(b.ability_point_id, b.domain)
  })
  return map
}

/**
 * 场景主表合并：bundle 内容字段（名称/封面/版本/背景/难度/岗位）覆盖 live 元数据，
 * live 的 creatorId/updatedAt/viewCount/industryNames 等动态字段保留。
 */
export function mergeScenarioSnapshot(
  live: Scenario | null,
  s: ScenarioSnapshot['scenario'],
): Scenario {
  return {
    ...(live ?? ({} as Scenario)),
    id: s.id,
    name: s.name,
    code: s.code,
    coverImage: s.cover_image,
    careerPositionId: s.career_position_id,
    industryIds: s.industry_ids,
    professionIds: s.profession_ids,
    batchId: s.batch_id,
    difficulty: num(s.difficulty, 3),
    version: s.version ?? live?.version ?? '',
    background: s.background,
    deliveryGoal: s.delivery_goal,
    coBuilderIds: s.co_builder_ids,
    status: live?.status ?? 'published',
    creatorId: live?.creatorId ?? '',
    createdAt: live?.createdAt ?? '',
    updatedAt: live?.updatedAt ?? '',
  }
}

/* ---------- 课程快照 ---------- */

export function mergeCourseSnapshot(live: Course | null, c: CourseSnapshot['course']): Course {
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
    updatedAt: live?.updatedAt ?? '',
  }
}

/** 节点资源 id 集 = 节点列 resource_ids ∪ node_resource_bindings，经 resource_library 取内容 */
export function courseSnapshotNodes(snap: CourseSnapshot): SystemCourseNode[] {
  const kpMap = new Map(snap.knowledge_points.map((k) => [k.id, k]))
  const resMap = new Map(snap.resource_library.map((r) => [r.id, r]))
  const nodeKpBindings = new Map<string, string[]>()
  snap.node_knowledge_point_bindings.forEach((b) => {
    const list = nodeKpBindings.get(b.node_id) || []
    list.push(b.knowledge_point_id)
    nodeKpBindings.set(b.node_id, list)
  })
  const nodeResBindings = new Map<string, string[]>()
  snap.node_resource_bindings.forEach((b) => {
    const list = nodeResBindings.get(b.node_id) || []
    list.push(b.resource_id)
    nodeResBindings.set(b.node_id, list)
  })
  const dedupe = (ids: (string | undefined)[]) => Array.from(new Set(ids.filter(Boolean) as string[]))

  return snap.system_course_nodes.map((n: CourseSnapshotNode) => {
    const kpIds = dedupe([...(n.knowledge_point_ids || []), ...(nodeKpBindings.get(n.id) || [])])
    const resIds = dedupe([...(n.resource_ids || []), ...(nodeResBindings.get(n.id) || [])])
    return {
      id: n.id,
      courseId: n.course_id,
      parentId: n.parent_id ?? null,
      name: n.name,
      code: n.code,
      order: n.sort_order ?? 0,
      type: (n.ref_type as SystemCourseNode['type']) || 'normal',
      sourceId: n.source_id,
      sourceName: n.source_name,
      teachingGoals: n.teaching_goals,
      detailedDescription: n.detailed_description,
      descriptionPdf: n.description_pdf,
      background: n.background,
      estimatedHours: n.estimated_hours,
      duration: n.duration,
      difficulty: n.difficulty !== undefined ? num(n.difficulty) : undefined,
      knowledgePoints: kpIds
        .map((kid) => kpMap.get(kid))
        .filter(Boolean)
        .map((k) => ({ id: k!.id, name: k!.name, code: k!.code, description: k!.description, linked: false })),
      resources: resIds
        .map((rid) => resMap.get(rid))
        .filter(Boolean)
        .map((r) => snapshotNodeResource(r!, n.id)),
      evalData: n.eval_data,
      status: (n.status as SystemCourseNode['status']) || 'published',
    }
  })
}

/** 课程级资源（原 courseResourceApi.list）：课程列 resource_ids ∪ course_resource_bindings */
export function courseSnapshotCourseResources(snap: CourseSnapshot): NodeResource[] {
  const resMap = new Map(snap.resource_library.map((r) => [r.id, r]))
  const ids = new Set<string>([
    ...(snap.course.resource_ids || []),
    ...snap.course_resource_bindings.map((b) => b.resource_id),
  ])
  return Array.from(ids)
    .map((rid) => resMap.get(rid))
    .filter(Boolean)
    .map((r) => snapshotNodeResource(r!, 'course'))
}

export function courseSnapshotHybridModules(snap: CourseSnapshot): HybridNodeModule[] {
  return snap.hybrid_node_modules.map((m) => ({
    id: m.id,
    nodeId: m.node_id,
    moduleKey: m.module_key,
    mode: (m.mode as HybridNodeModule['mode']) || 'online',
    data: m.data ?? {},
  }))
}

/* ---------- 题库快照 ---------- */

export function bankSnapshotQuestions(snap: QuestionBankSnapshot): Question[] {
  return snap.questions.map((q) => ({
    id: q.id,
    code: q.code,
    bankId: q.bank_id,
    type: (q.type as Question['type']) || 'single',
    content: q.content,
    options: q.options,
    answer: q.answer ?? '',
    analysis: q.analysis,
    score: q.score ?? 0,
    difficulty: q.difficulty as Question['difficulty'],
    knowledgePoints: q.knowledge_point_ids,
    source: q.source,
    status: (q.status as Question['status']) || 'published',
    createdAt: q.created_at ?? '',
  }))
}

/** 题库主表合并：bundle 内容字段覆盖 live 元数据（creatorName/updatedAt 保留 live） */
export function mergeBankSnapshot(
  live: QuestionBank | null,
  b: QuestionBankSnapshot['question_bank'],
): QuestionBank {
  return {
    ...(live ?? ({} as QuestionBank)),
    id: b.id,
    code: b.code,
    name: b.name,
    description: b.description,
    coverImage: b.cover_image,
    status: (b.status as QuestionBank['status']) || live?.status || 'published',
    questionCount: b.question_count ?? live?.questionCount ?? 0,
    collaboratorIds: b.collaborator_ids,
    collaboratorDeptIds: b.collaborator_dept_ids,
    batchId: b.batch_id,
    version: b.version ?? live?.version,
    ownerType: (b.owner_type as QuestionBank['ownerType']) || live?.ownerType || 'mine',
    isDraftPool: b.is_draft_pool,
    createdAt: live?.createdAt ?? '',
    updatedAt: live?.updatedAt ?? '',
  }
}
