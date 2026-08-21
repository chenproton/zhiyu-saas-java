// 系统课程编辑页（course-edit.vue）共享类型与纯函数。
// 与原 React 版 lesson/admin/system/add 对齐：
// - 节点契约（响应 {order,type,...} / 保存 {sortOrder,refType,...}）
// - evalData.evalRuleConfig 完整 JSON 结构（后端 task_evaluation 契约）
// 本文件只含类型与纯函数，不发起任何请求。

/* ---------- 通用 ---------- */

export function uid(prefix = 'id'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

// 分页拉取全量（后端 limit 钳制 200，逐页翻到 total）
export async function fetchAllPages<T>(
  fn: (params: { limit: number; offset: number }) => Promise<{ items: T[]; total: number }>,
): Promise<T[]> {
  const PAGE = 200
  const items: T[] = []
  let offset = 0
  for (;;) {
    const res = await fn({ limit: PAGE, offset })
    items.push(...res.items)
    if (res.items.length < PAGE || items.length >= res.total) break
    offset += PAGE
  }
  return items
}

export function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v))
}

/* ---------- 课程节点 ---------- */

export type NodeRefType = 'normal' | 'original'

export interface NodeKnowledgePoint {
  id: string
  name: string
  code?: string
  description?: string
  linked: boolean
}

export interface NodeResourceItem {
  id: string
  name: string
  type: string
  url?: string
  size?: number
  description?: string
  uploadedBy?: string
  uploadedAt?: string
}

// 节点响应形状（后端 SystemCourseNodeResponse）
export interface SysNode {
  id: string
  courseId: string
  parentId: string | null
  name: string
  code?: string
  order: number
  type: NodeRefType
  sourceId?: string
  sourceName?: string
  teachingGoals?: string
  detailedDescription?: string
  descriptionPdf?: string
  background?: string
  estimatedHours?: number
  duration?: number
  difficulty?: number
  knowledgePoints?: NodeKnowledgePoint[]
  resources?: NodeResourceItem[]
  quizzes?: unknown[]
  evalData?: Record<string, any>
  status: string
}

export const NODE_REF_TYPE_LABELS: Record<NodeRefType, string> = {
  normal: '手动编辑',
  original: '颗粒课',
}

// 判断把 nodeId 移动到 targetId 的兄弟位置是否会把 nodeId 挂到自身/后代之下（形成 parentId 环）
export function wouldCreateCycle(nodes: SysNode[], nodeId: string, targetId: string): boolean {
  if (nodeId === targetId) return true
  const childrenByParent = new Map<string | null, SysNode[]>()
  for (const n of nodes) {
    const key = n.parentId ?? null
    const list = childrenByParent.get(key) || []
    list.push(n)
    childrenByParent.set(key, list)
  }
  const stack: string[] = [nodeId]
  const visited = new Set<string>()
  while (stack.length > 0) {
    const id = stack.pop()!
    if (visited.has(id)) continue
    visited.add(id)
    for (const child of childrenByParent.get(id) || []) {
      if (child.id === targetId) return true
      stack.push(child.id)
    }
  }
  return false
}

/* ---------- 知识点 / 资源 ---------- */

export interface KnowledgePointItem {
  id: string
  name: string
  code?: string
  description?: string
  linked: boolean
  granularLessons?: string[]
}

export interface ResourceItem {
  id: string
  name: string
  type: string
  url?: string
  uploadedBy?: string
  uploadedAt?: string
  thumbnail?: string
  description?: string
  size?: string | number
}

export interface AbilityPointItem {
  id: string
  name: string
  code?: string
  description?: string
}

/* ---------- 评价规则配置（EvalRuleConfig，与 shared-types/evaluation-rules 一致） ---------- */

export type EvalRuleMethodKey =
  | 'question_bank'
  | 'paper'
  | 'random_draw'
  | 'review'
  | 'outcome'
  | 'homework'
  | 'quiz'

export type EvalObjectType = 'individual' | 'group'
export type EvalScoreType = 'eval_points' | 'ability_levels'
export type EvalStandardMode = 'rubric' | 'score_rule'

export interface GradeMapping {
  id: string
  grade: string
  minScore: number
  maxScore: number
  color: string
  remark?: string
}

export interface EvalRuleSubjectConfig {
  type: string
  enabled: boolean
  params?: Record<string, any>
}

export interface EvalRulePoint {
  id: string
  name: string
  desc: string
  subType?: string
  types?: string[]
  knowledgePointIds?: string[]
  abilityPointIds?: string[]
  scoringMethod?: 'score' | 'level' | 'rubric'
  gradeMapping?: GradeMapping[]
  weight?: number
}

export interface EvalRuleScoreRule {
  id: string
  name: string
  desc: string
  rule?: string
  weight?: number
}

export interface EvalRuleReviewStepInput {
  id?: string
  label: string
  description?: string | null
  enabled: boolean
  subjectType?: string | null
  assignedUserIds?: string[]
  weight: number
  sortOrder: number
}

export interface EvalRuleConfig {
  evaluationMethods: EvalRuleMethodKey[]
  disabledEvaluationMethods: EvalRuleMethodKey[]
  methodWeights: Record<string, number>
  evalObject: EvalObjectType
  methodEvalObjects: Record<string, EvalObjectType>
  evalSubjects: EvalRuleSubjectConfig[]
  methodEvalSubjects: Record<string, EvalRuleSubjectConfig[]>
  randomDrawQuestions: string[]
  randomDrawCustomQuestions: {
    id: string
    name: string
    description: string
    answer: string
    majorId: string
  }[]
  randomDrawSelectedIds: string[]
  randomDrawEvalPoints: EvalRulePoint[]
  randomDrawScoreType: EvalScoreType
  randomDrawRubricId: string | null
  randomDrawStandardName?: string
  randomDrawStandardMode?: EvalStandardMode
  randomDrawScoreRules?: EvalRuleScoreRule[]
  reviewEvalPoints: EvalRulePoint[]
  reviewScoreType: EvalScoreType
  reviewRubricId: string | null
  reviewStandardName?: string
  reviewStandardMode?: EvalStandardMode
  reviewScoreRules?: EvalRuleScoreRule[]
  reviewSteps: EvalRuleReviewStepInput[]
  paperIds: string[]
  paperWeights: Record<string, number>
  paperEvalPoints: EvalRulePoint[]
  questionBankQuestions: string[]
  questionBankEvalPoints: EvalRulePoint[]
  outcomeEvalPoints: EvalRulePoint[]
  outcomeScoreType: EvalScoreType
  outcomeRubricId: string | null
  outcomeStandardName?: string
  outcomeStandardMode?: EvalStandardMode
  outcomeScoreRules?: EvalRuleScoreRule[]
  homeworkEvalPoints: EvalRulePoint[]
  homeworkScoreType: EvalScoreType
  homeworkRubricId: string | null
  homeworkStandardName?: string
  homeworkStandardMode?: EvalStandardMode
  homeworkScoreRules?: EvalRuleScoreRule[]
  quizQuestions: string[]
  quizEvalPoints: EvalRulePoint[]
  gradeMapping: GradeMapping[]
  methodResourceConfigs: Record<string, Record<string, any>>
}

export const EVAL_RULE_METHOD_KEYS: EvalRuleMethodKey[] = [
  'question_bank',
  'paper',
  'random_draw',
  'review',
  'outcome',
  'homework',
  'quiz',
]

export const DEFAULT_EVAL_RULE_GRADE_MAPPING: GradeMapping[] = [
  { id: 'grade-1', grade: 'A', minScore: 90, maxScore: 100, color: '#67c23a', remark: '表现卓越' },
  { id: 'grade-2', grade: 'B', minScore: 75, maxScore: 89, color: '#409eff', remark: '表现良好' },
  { id: 'grade-3', grade: 'C', minScore: 60, maxScore: 74, color: '#e6a23c', remark: '基本达标' },
  { id: 'grade-4', grade: 'D', minScore: 0, maxScore: 59, color: '#f56c6c', remark: '未达标' },
]

export const DEFAULT_EVAL_RULE_SUBJECTS: EvalRuleSubjectConfig[] = [
  {
    type: 'teacher',
    enabled: true,
    params: {
      teacherBackground: '计算机/软件工程相关专业',
      scorerCount: 2,
      weightPercent: 50,
      scoringDimensions: [
        'knowledge_mastery',
        'operation_standard',
        'task_completion',
        'result_quality',
      ],
      minTeachingYears: 3,
    },
  },
  {
    type: 'enterprise_mentor',
    enabled: true,
    params: {
      expertise: '网络安全 / 渗透测试',
      minYears: 5,
      scorerCount: 1,
      weightPercent: 20,
      companyType: '互联网/科技公司',
    },
  },
  {
    type: 'self',
    enabled: true,
    params: { requiresReflection: true, weightPercent: 10, reflectionMinLength: 500 },
  },
  {
    type: 'peer',
    enabled: false,
    params: { peerCount: 4, peerRule: '随机分配', anonymous: true, weightPercent: 15 },
  },
  {
    type: 'ai',
    enabled: false,
    params: { aiModel: 'GPT-4', weightPercent: 5, confidenceThreshold: 85, autoReview: true },
  },
  {
    type: 'service_target',
    enabled: false,
    params: { serviceMethod: '满意度问卷', sampleSize: 20, weightPercent: 5 },
  },
]

export const EVAL_SUBJECT_LABELS: Record<string, string> = {
  teacher: '教师',
  enterprise_mentor: '企业导师',
  self: '学生自评',
  peer: '小组互评',
  ai: 'AI 助手',
  service_target: '服务对象',
}

export const EVAL_SUB_TYPE_LABELS: Record<string, string> = {
  knowledge_mastery: '知识掌握',
  operation_standard: '操作规范',
  task_completion: '任务完成度',
  result_quality: '成果质量',
  communication: '沟通表达',
  collaboration: '协作能力',
  professionalism: '职业素养',
  innovation: '创新能力',
  adaptability: '应变能力',
}

export function makeDefaultEvalRuleConfig(methods: EvalRuleMethodKey[]): EvalRuleConfig {
  const count = methods.length
  const methodWeights: Record<string, number> = {}
  methods.forEach((m, i) => {
    methodWeights[m] = count > 0 ? Math.floor(100 / count) + (i < 100 % count ? 1 : 0) : 0
  })
  return {
    evaluationMethods: methods,
    disabledEvaluationMethods: [],
    methodWeights,
    evalObject: 'individual',
    methodEvalObjects: {},
    evalSubjects: clone(DEFAULT_EVAL_RULE_SUBJECTS),
    methodEvalSubjects: {},
    randomDrawQuestions: [],
    randomDrawCustomQuestions: [],
    randomDrawSelectedIds: [],
    randomDrawEvalPoints: [],
    randomDrawScoreType: 'eval_points',
    randomDrawRubricId: null,
    reviewEvalPoints: [],
    reviewScoreType: 'eval_points',
    reviewRubricId: null,
    reviewSteps: [],
    paperIds: [],
    paperWeights: {},
    paperEvalPoints: [],
    questionBankQuestions: [],
    questionBankEvalPoints: [],
    outcomeEvalPoints: [],
    outcomeScoreType: 'eval_points',
    outcomeRubricId: null,
    homeworkEvalPoints: [],
    homeworkScoreType: 'eval_points',
    homeworkRubricId: null,
    quizQuestions: [],
    quizEvalPoints: [],
    gradeMapping: clone(DEFAULT_EVAL_RULE_GRADE_MAPPING),
    methodResourceConfigs: {},
  }
}

export function mergeEvalRuleMethods(
  config: EvalRuleConfig,
  nextMethods: EvalRuleMethodKey[],
): EvalRuleConfig {
  const currentMethods = new Set(config.evaluationMethods)
  const currentDisabled = new Set(config.disabledEvaluationMethods || [])
  const nextMethodsSet = new Set(nextMethods)
  const added = nextMethods.filter((m) => !currentMethods.has(m) && !currentDisabled.has(m))

  const next = clone(config)
  next.evaluationMethods = nextMethods
  next.disabledEvaluationMethods = (config.disabledEvaluationMethods || []).filter(
    (m) => !nextMethodsSet.has(m),
  )

  if (added.length > 0) {
    const remainingWeight =
      100 -
      nextMethods
        .filter((m) => !added.includes(m))
        .reduce((sum, m) => sum + (next.methodWeights[m] || 0), 0)
    const base = Math.floor(remainingWeight / added.length)
    added.forEach((m, i) => {
      next.methodWeights[m] = base + (i < remainingWeight - base * added.length ? 1 : 0)
    })
  }

  const total = nextMethods.reduce((sum, m) => sum + (next.methodWeights[m] || 0), 0)
  if (total !== 100 && nextMethods.length > 0) {
    const base = Math.floor(100 / nextMethods.length)
    const remainder = 100 % nextMethods.length
    nextMethods.forEach((m, i) => {
      next.methodWeights[m] = base + (i < remainder ? 1 : 0)
    })
  }

  return next
}

export function buildDefaultReviewSteps(): EvalRuleReviewStepInput[] {
  const step = (label: string, description: string, enabled: boolean, subjectType: string, weight: number): EvalRuleReviewStepInput => ({
    label,
    description,
    enabled,
    subjectType,
    assignedUserIds: [],
    weight,
    sortOrder: 0,
  })
  return [
    step('学生自评', '学生根据量规进行自我评价', true, 'self', 20),
    step('小组互评', '小组内成员互相评价', false, 'peer', 0),
    step('教师评审', '教师根据提交材料和表现评分', true, 'teacher', 80),
  ]
}

/* ---------- 节点保存 ---------- */

export interface NodeDraft {
  hours: string
  learningGoal: string
  learningGoalPdf: string | null
  detailedDescription: string
  background: string
  estimatedHours: string
  knowledgePoints: KnowledgePointItem[]
  selectedResourceIds: string[]
  selectedEvalMethods: string[]
  evalData?: { methods: string[]; evalRuleConfig?: EvalRuleConfig }
  difficulty: number
}

export interface NodeSavePayload {
  courseId: string
  parentId?: string
  name: string
  code: string
  sortOrder: number
  refType: 'normal' | 'original'
  sourceId?: string
  sourceName?: string
  evalData: Record<string, any>
  status: string
  teachingGoals?: string
  descriptionPdf?: string
  detailedDescription?: string
  background?: string
  estimatedHours?: number
  duration?: number
  difficulty?: number
  knowledgePointIds?: string[]
  resourceIds?: string[]
}

export function buildEvalDataForSave(
  nodeEvalData?: Record<string, any>,
  draftEvalData?: { methods?: string[]; evalRuleConfig?: EvalRuleConfig },
): Record<string, any> {
  const merged: Record<string, any> = {
    ...(nodeEvalData || {}),
    ...(draftEvalData || {}),
  }
  const hasEvalRuleConfig =
    draftEvalData?.evalRuleConfig !== undefined || nodeEvalData?.evalRuleConfig !== undefined
  if (hasEvalRuleConfig) {
    merged.evalRuleConfig = draftEvalData?.evalRuleConfig ?? nodeEvalData?.evalRuleConfig
  }
  return merged
}

export function resolveKnowledgePointIds(
  knowledgePoints: KnowledgePointItem[],
  idMapping: Map<string, string>,
): string[] {
  return knowledgePoints
    .map((kp) => idMapping.get(kp.id) || kp.id)
    .filter((id) => !id.startsWith('kp-custom-'))
}

export function resolveResourceIds(
  selectedResourceIds: string[],
  resourcePool: ResourceItem[],
  nodeId?: string,
): { existingResourceIds: string[]; localResources: ResourceItem[] } {
  const existingResourceIds: string[] = []
  const localResources: ResourceItem[] = []
  for (const resId of selectedResourceIds) {
    const localRes = resourcePool.find((r) => r.id === resId)
    if (localRes && (resId.startsWith('res-') || !nodeId)) {
      localResources.push(localRes)
    } else {
      existingResourceIds.push(resId)
    }
  }
  return { existingResourceIds, localResources }
}

export function buildNodeSavePayload(options: {
  node: SysNode
  draft?: NodeDraft
  effectiveCourseId: string
  parentId?: string
  contentCode: string
  resolvedKnowledgePointIds?: string[]
  existingResourceIds?: string[]
}): NodeSavePayload {
  const {
    node,
    draft,
    effectiveCourseId,
    parentId,
    contentCode,
    resolvedKnowledgePointIds = [],
    existingResourceIds = [],
  } = options

  const refType: NodeRefType = node.type === 'original' ? 'original' : 'normal'
  const isQuoteNode = refType === 'original'

  const payload: NodeSavePayload = {
    courseId: effectiveCourseId,
    parentId,
    name: node.name,
    code: contentCode,
    sortOrder: Math.round(node.order),
    refType,
    sourceId: node.sourceId,
    sourceName: node.sourceName,
    evalData: buildEvalDataForSave(node.evalData, draft?.evalData),
    status: node.status || 'draft',
  }

  if (!isQuoteNode) {
    payload.teachingGoals = draft ? draft.learningGoal : node.teachingGoals
    payload.descriptionPdf = draft ? (draft.learningGoalPdf ?? undefined) : node.descriptionPdf
    payload.detailedDescription = draft ? draft.detailedDescription : node.detailedDescription
    payload.background = draft ? draft.background : node.background
    const ev = draft?.estimatedHours
    if (ev !== undefined && ev !== '') {
      const n = parseFloat(ev)
      payload.estimatedHours = Number.isNaN(n) ? undefined : n
    }
    const hv = draft?.hours
    if (hv === undefined) {
      payload.duration = node.duration
    } else if (hv === '') {
      payload.duration = 0
    } else {
      const n = parseFloat(hv)
      payload.duration = Number.isNaN(n) ? 0 : n
    }
    payload.difficulty = draft?.difficulty ?? node.difficulty
    payload.knowledgePointIds = resolvedKnowledgePointIds
    payload.resourceIds = existingResourceIds
  }

  return payload
}

export function nodeToDraft(node: SysNode): NodeDraft {
  const nodeEvalData = (node.evalData || {}) as {
    methods?: string[]
    evalRuleConfig?: EvalRuleConfig
  }
  return {
    hours: String(node.duration || ''),
    learningGoal: node.teachingGoals || '',
    learningGoalPdf: node.descriptionPdf || null,
    detailedDescription: node.detailedDescription || '',
    background: node.background || '',
    estimatedHours: node.estimatedHours ? String(node.estimatedHours) : '',
    knowledgePoints: (node.knowledgePoints || []).map((kp) => ({
      id: kp.id,
      name: kp.name,
      code: kp.code,
      description: kp.description,
      linked: true,
    })),
    selectedResourceIds: (node.resources || []).map((r) => r.id),
    selectedEvalMethods: nodeEvalData.methods || [],
    evalData: {
      methods: nodeEvalData.methods || [],
      evalRuleConfig: nodeEvalData.evalRuleConfig,
    },
    difficulty: node.difficulty || 0,
  }
}
