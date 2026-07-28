import type { GradeMapping } from "./lesson"

// ==================== 统一评价规则配置模型 ====================

export type EvalRuleMethodKey =
  | "question_bank"
  | "paper"
  | "random_draw"
  | "review"
  | "outcome"
  | "homework"
  | "quiz"

export type EvalObjectType = "individual" | "group"

export type EvalScoreType = "eval_points" | "ability_levels"

export type EvalSubjectType =
  | "teacher"
  | "enterprise_mentor"
  | "peer"
  | "self"
  | "ai"
  | "service_target"

export interface EvalRuleSubjectConfig {
  type: EvalSubjectType
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
  scoringMethod?: "score" | "level" | "rubric"
  gradeMapping?: GradeMapping[]
  weight?: number
}

export interface EvalRuleReviewStep {
  id: string
  label: string
  desc?: string
  enabled: boolean
  subjectType?: string
  weight?: number
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
  randomDrawCustomQuestions: { id: string; name: string; description: string; answer: string; majorId: string }[]
  randomDrawSelectedIds: string[]
  randomDrawEvalPoints: EvalRulePoint[]
  randomDrawScoreType: EvalScoreType
  randomDrawRubricId: string | null
  reviewEvalPoints: EvalRulePoint[]
  reviewScoreType: EvalScoreType
  reviewRubricId: string | null
  reviewSteps: EvalRuleReviewStepInput[]
  paperIds: string[]
  paperWeights: Record<string, number>
  paperEvalPoints: EvalRulePoint[]
  questionBankQuestions: string[]
  questionBankEvalPoints: EvalRulePoint[]
  outcomeEvalPoints: EvalRulePoint[]
  outcomeScoreType: EvalScoreType
  outcomeRubricId: string | null
  homeworkEvalPoints: EvalRulePoint[]
  homeworkScoreType: EvalScoreType
  homeworkRubricId: string | null
  quizQuestions: string[]
  quizEvalPoints: EvalRulePoint[]
  gradeMapping: GradeMapping[]
  methodResourceConfigs: Record<string, Record<string, any>>
}

export interface EvalRuleMethodInput {
  methodKey: string
  weight: number
  evalObject: string
  scoreType?: string | null
  evalSubjects?: EvalRuleSubjectConfig[]
  rubricTemplateId?: string | null
  resourceConfig?: Record<string, any>
  isEnabled: boolean
  evalPoints?: EvalRulePointInput[]
  reviewSteps?: EvalRuleReviewStepInput[]
}

export interface EvalRulePointInput {
  name: string
  description?: string | null
  subType?: string | null
  types?: string[]
  weight: number
  scoringMethod: string
  gradeMapping?: GradeMapping[]
  knowledgePointIds?: string[]
  abilityPointIds?: string[]
  sortOrder: number
}

export interface EvalRuleReviewStepInput {
  label: string
  description?: string | null
  enabled: boolean
  subjectType?: string | null
  weight: number
  sortOrder: number
}

export const EVAL_RULE_METHOD_KEYS: EvalRuleMethodKey[] = [
  "question_bank",
  "paper",
  "random_draw",
  "review",
  "outcome",
  "homework",
  "quiz",
]

export const DEFAULT_EVAL_RULE_GRADE_MAPPING: GradeMapping[] = [
  { id: "grade-1", grade: "A", minScore: 90, maxScore: 100, color: "bg-green-500", remark: "表现卓越" },
  { id: "grade-2", grade: "B", minScore: 75, maxScore: 89, color: "bg-blue-500", remark: "表现良好" },
  { id: "grade-3", grade: "C", minScore: 60, maxScore: 74, color: "bg-yellow-500", remark: "基本达标" },
  { id: "grade-4", grade: "D", minScore: 0, maxScore: 59, color: "bg-red-500", remark: "未达标" },
]

export const DEFAULT_EVAL_RULE_SUBJECTS: EvalRuleSubjectConfig[] = [
  { type: "teacher", enabled: true, params: { teacherBackground: "计算机/软件工程相关专业", scorerCount: 2, weightPercent: 50, scoringDimensions: ["knowledge_mastery", "operation_standard", "task_completion", "result_quality"], minTeachingYears: 3 } },
  { type: "enterprise_mentor", enabled: true, params: { expertise: "网络安全 / 渗透测试", minYears: 5, scorerCount: 1, weightPercent: 20, companyType: "互联网/科技公司" } },
  { type: "self", enabled: true, params: { requiresReflection: true, weightPercent: 10, reflectionMinLength: 500 } },
  { type: "peer", enabled: false, params: { peerCount: 4, peerRule: "随机分配", anonymous: true, weightPercent: 15 } },
  { type: "ai", enabled: false, params: { aiModel: "GPT-4", weightPercent: 5, confidenceThreshold: 85, autoReview: true } },
  { type: "service_target", enabled: false, params: { serviceMethod: "满意度问卷", sampleSize: 20, weightPercent: 5 } },
]

// NOTE: These runtime utility functions shouldn't be in a types package.
// When this module is restructured, move them to @zhiyu/ui/src/lib/object-utils.ts.
// They are kept here because shared-types cannot depend on @zhiyu/ui (circular dep).

function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v))
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
    evalObject: "individual",
    methodEvalObjects: {},
    evalSubjects: clone(DEFAULT_EVAL_RULE_SUBJECTS),
    methodEvalSubjects: {},
    randomDrawQuestions: [],
    randomDrawCustomQuestions: [],
    randomDrawSelectedIds: [],
    randomDrawEvalPoints: [],
    randomDrawScoreType: "eval_points",
    randomDrawRubricId: null,
    reviewEvalPoints: [],
    reviewScoreType: "eval_points",
    reviewRubricId: null,
    reviewSteps: [],
    paperIds: [],
    paperWeights: {},
    paperEvalPoints: [],
    questionBankQuestions: [],
    questionBankEvalPoints: [],
    outcomeEvalPoints: [],
    outcomeScoreType: "eval_points",
    outcomeRubricId: null,
    homeworkEvalPoints: [],
    homeworkScoreType: "eval_points",
    homeworkRubricId: null,
    quizQuestions: [],
    quizEvalPoints: [],
    gradeMapping: clone(DEFAULT_EVAL_RULE_GRADE_MAPPING),
    methodResourceConfigs: {},
  }
}

export function methodsToEvalRuleConfig(methods: Array<{
  methodKey: string
  weight: number
  evalObject?: string
  scoreType?: string | null
  evalSubjects?: EvalRuleSubjectConfig[]
  rubricTemplateId?: string | null
  resourceConfig?: Record<string, any>
  isEnabled?: boolean
  evalPoints?: Array<{
    id: string
    name: string
    description?: string | null
    subType?: string | null
    types?: string[]
    weight: number
    scoringMethod: string
    gradeMapping?: GradeMapping[]
    knowledgePointIds?: string[]
    abilityPointIds?: string[]
    sortOrder: number
  }>
  reviewSteps?: Array<{
    id: string
    label: string
    description?: string | null
    enabled: boolean
    subjectType?: string | null
    weight: number
    sortOrder: number
  }>
}>): EvalRuleConfig {
  const allKeys = methods.map(m => m.methodKey as EvalRuleMethodKey)
  const state = makeDefaultEvalRuleConfig(allKeys)
  if (!methods || methods.length === 0) return state
  state.evaluationMethods = methods.filter(m => m.isEnabled !== false).map(m => m.methodKey as EvalRuleMethodKey)
  state.disabledEvaluationMethods = methods.filter(m => m.isEnabled === false).map(m => m.methodKey as EvalRuleMethodKey)
  methods.forEach(m => {
    state.methodWeights[m.methodKey] = m.weight
    state.methodEvalObjects[m.methodKey] = (m.evalObject as EvalObjectType) || "individual"
    state.methodEvalSubjects[m.methodKey] = (m.evalSubjects || []) as EvalRuleSubjectConfig[]
    const resourceConfig = m.resourceConfig || {}
    state.methodResourceConfigs[m.methodKey] = resourceConfig
    const toLocalEvalPoint = (ep: any): EvalRulePoint => ({
      id: ep.id || uid("ep"),
      name: ep.name,
      desc: ep.description || "",
      subType: ep.subType,
      types: ep.types,
      knowledgePointIds: ep.knowledgePointIds,
      abilityPointIds: ep.abilityPointIds,
      scoringMethod: ep.scoringMethod as EvalRulePoint["scoringMethod"],
      gradeMapping: ep.gradeMapping,
      weight: ep.weight,
    })
    switch (m.methodKey) {
      case "random_draw":
        state.randomDrawEvalPoints = (m.evalPoints || []).map(toLocalEvalPoint)
        state.randomDrawScoreType = m.scoreType === "ability_levels" ? "ability_levels" : "eval_points"
        state.randomDrawRubricId = m.rubricTemplateId || null
        if (resourceConfig.selectedQuestionIds) state.randomDrawSelectedIds = resourceConfig.selectedQuestionIds
        if (resourceConfig.customQuestions) state.randomDrawCustomQuestions = resourceConfig.customQuestions
        break
      case "review":
        state.reviewEvalPoints = (m.evalPoints || []).map(toLocalEvalPoint)
        state.reviewScoreType = m.scoreType === "ability_levels" ? "ability_levels" : "eval_points"
        state.reviewRubricId = m.rubricTemplateId || null
        state.reviewSteps = (m.reviewSteps || []).map((rs: any, i: number) => ({
          label: rs.label,
          description: rs.description || null,
          enabled: rs.enabled,
          subjectType: rs.subjectType || null,
          weight: rs.weight,
          sortOrder: rs.sortOrder ?? i,
        }))
        break
      case "paper":
        state.paperEvalPoints = (m.evalPoints || []).map(toLocalEvalPoint)
        if (resourceConfig.paperId) state.paperIds = [resourceConfig.paperId]
        if (resourceConfig.paperWeight !== undefined && resourceConfig.paperId) {
          state.paperWeights[resourceConfig.paperId] = resourceConfig.paperWeight
        }
        break
      case "question_bank":
        state.questionBankEvalPoints = (m.evalPoints || []).map(toLocalEvalPoint)
        if (resourceConfig.questionIds) state.questionBankQuestions = resourceConfig.questionIds
        break
      case "outcome":
        state.outcomeEvalPoints = (m.evalPoints || []).map(toLocalEvalPoint)
        state.outcomeScoreType = m.scoreType === "ability_levels" ? "ability_levels" : "eval_points"
        state.outcomeRubricId = m.rubricTemplateId || null
        break
      case "homework":
        state.homeworkEvalPoints = (m.evalPoints || []).map(toLocalEvalPoint)
        state.homeworkScoreType = m.scoreType === "ability_levels" ? "ability_levels" : "eval_points"
        state.homeworkRubricId = m.rubricTemplateId || null
        break
      case "quiz":
        state.quizEvalPoints = (m.evalPoints || []).map(toLocalEvalPoint)
        if (resourceConfig.questionIds) state.quizQuestions = resourceConfig.questionIds
        break
    }
  })
  return state
}

export function evalRuleConfigToMethods(config: EvalRuleConfig): EvalRuleMethodInput[] {
  const evalPointFieldMap: Record<string, keyof EvalRuleConfig> = {
    random_draw: "randomDrawEvalPoints",
    review: "reviewEvalPoints",
    paper: "paperEvalPoints",
    question_bank: "questionBankEvalPoints",
    outcome: "outcomeEvalPoints",
    homework: "homeworkEvalPoints",
    quiz: "quizEvalPoints",
  }
  const scoreTypeFieldMap: Record<string, keyof EvalRuleConfig> = {
    random_draw: "randomDrawScoreType",
    review: "reviewScoreType",
    outcome: "outcomeScoreType",
    homework: "homeworkScoreType",
  }
  const rubricFieldMap: Record<string, keyof EvalRuleConfig> = {
    random_draw: "randomDrawRubricId",
    review: "reviewRubricId",
    outcome: "outcomeRubricId",
    homework: "homeworkRubricId",
  }

  const allMethodKeys = Array.from(new Set([
    ...config.evaluationMethods,
    ...(config.disabledEvaluationMethods || []),
  ]))

  return allMethodKeys.map((mk) => {
    const fromLocalEvalPoint = (p: EvalRulePoint): EvalRulePointInput => ({
      name: p.name,
      description: p.desc || null,
      subType: p.subType || null,
      types: p.types || [],
      weight: p.weight || 0,
      scoringMethod: p.scoringMethod || "level",
      gradeMapping: p.gradeMapping || [],
      knowledgePointIds: p.knowledgePointIds || [],
      abilityPointIds: p.abilityPointIds || [],
      sortOrder: 0,
    })

    const evalField = evalPointFieldMap[mk]
    const evalPoints = evalField
      ? ((config as any)[evalField] as EvalRulePoint[] || []).map((p, i) => ({ ...fromLocalEvalPoint(p), sortOrder: i }))
      : []
    const scoreType = scoreTypeFieldMap[mk] ? ((config as any)[scoreTypeFieldMap[mk]] as EvalScoreType | null) : null
    const rubricId = rubricFieldMap[mk] ? ((config as any)[rubricFieldMap[mk]] as string | null) : null

    const resourceConfig: Record<string, any> = { ...(config.methodResourceConfigs?.[mk] || {}) }
    if (mk === "paper") {
      const paperId = config.paperIds?.[0]
      if (paperId) resourceConfig.paperId = paperId
      if (paperId) resourceConfig.paperWeight = config.paperWeights[paperId] ?? 100
    }
    if (mk === "question_bank") {
      resourceConfig.questionIds = config.questionBankQuestions
    }
    if (mk === "quiz") {
      resourceConfig.questionIds = config.quizQuestions
    }
    if (mk === "random_draw") {
      resourceConfig.customQuestions = config.randomDrawCustomQuestions
      resourceConfig.selectedQuestionIds = config.randomDrawSelectedIds
    }

    return {
      methodKey: mk,
      weight: config.methodWeights[mk] || 0,
      evalObject: config.methodEvalObjects[mk] || config.evalObject || "individual",
      scoreType,
      evalSubjects: config.methodEvalSubjects[mk] || config.evalSubjects || [],
      rubricTemplateId: rubricId || null,
      isEnabled: config.evaluationMethods.includes(mk),
      evalPoints,
      reviewSteps: mk === "review" ? (config.reviewSteps || []) : [],
      resourceConfig,
    }
  })
}

export function distributeEvalRuleWeights(methods: string[], existing: Record<string, number>): Record<string, number> {
  const count = methods.length
  if (count === 0) return {}
  const base = Math.floor(100 / count)
  const remainder = 100 % count
  const weights: Record<string, number> = {}
  methods.forEach((m, i) => {
    weights[m] = base + (i < remainder ? 1 : 0)
  })
  return weights
}

export function mergeEvalRuleMethods(
  config: EvalRuleConfig,
  nextMethods: EvalRuleMethodKey[]
): EvalRuleConfig {
  const currentMethods = new Set(config.evaluationMethods)
  const currentDisabled = new Set(config.disabledEvaluationMethods || [])
  const nextMethodsSet = new Set(nextMethods)
  const added = nextMethods.filter(m => !currentMethods.has(m) && !currentDisabled.has(m))
  const removed = config.evaluationMethods.filter(m => !nextMethodsSet.has(m))
  const reenabled = (config.disabledEvaluationMethods || []).filter(m => nextMethodsSet.has(m))

  const next = clone(config)
  next.evaluationMethods = nextMethods
  next.disabledEvaluationMethods = (config.disabledEvaluationMethods || []).filter(m => !nextMethodsSet.has(m))

  if (added.length > 0) {
    const remainingWeight = 100 - nextMethods
      .filter(m => !added.includes(m))
      .reduce((sum, m) => sum + (next.methodWeights[m] || 0), 0)
    const base = Math.floor(remainingWeight / added.length)
    added.forEach((m, i) => {
      next.methodWeights[m] = base + (i < (remainingWeight - base * added.length) ? 1 : 0)
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
