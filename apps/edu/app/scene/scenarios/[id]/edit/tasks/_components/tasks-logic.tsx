'use client'

import {
  Award,
  Book,
  CheckCircle2,
  FileText,
  Gavel,
  Lightbulb,
  Link2,
  Scale,
} from 'lucide-react'
import {
  type EvalRuleConfig,
  type EvalRuleReviewStepInput,
} from '@/components/evaluation-rules'
import { uid } from '@/components/evaluation-rules/utils'
import type { TaskEvaluationMethod } from '@/lib/types/scene'
import { methodsToEvalRuleConfig, evalRuleConfigToMethods } from '@/lib/types/evaluation'
import type { GradeMapping } from '@/lib/types/scene-mock'
import {
  EVALUATION_METHOD_OPTIONS,
  type EvaluationMethodOption,
} from '@/components/shared/eval-method-selector'

// 复用共享测评方式选项（唯一来源：components/shared/eval-method-selector.tsx）
export const evaluationMethodOptions: EvaluationMethodOption[] = EVALUATION_METHOD_OPTIONS

// ============ Types & Configs ============

export type CardType =
  | 'info'
  | 'description'
  | 'knowledge'
  | 'ability'
  | 'resources'
  | 'evaluation'
  | 'evaluationRules'
  | 'weight'

export const cardConfigs: { type: CardType; title: string; icon: React.ReactNode }[] = [
  { type: 'info', title: '配置任务基础信息', icon: <FileText className="h-4 w-4" /> },
  { type: 'description', title: '配置任务说明', icon: <Book className="h-4 w-4" /> },
  { type: 'knowledge', title: '考查知识点', icon: <Lightbulb className="h-4 w-4" /> },
  { type: 'ability', title: '考查能力点', icon: <Award className="h-4 w-4" /> },
  { type: 'resources', title: '配置任务资源', icon: <Link2 className="h-4 w-4" /> },
  { type: 'evaluation', title: '配置任务测评形式', icon: <CheckCircle2 className="h-4 w-4" /> },
  { type: 'evaluationRules', title: '配置任务评价规则', icon: <Gavel className="h-4 w-4" /> },
  { type: 'weight', title: '配置任务权重', icon: <Scale className="h-4 w-4" /> },
]

export const defaultGradeMapping: GradeMapping[] = [
  {
    id: 'grade-1',
    grade: 'A',
    minScore: 90,
    maxScore: 100,
    color: 'bg-green-500',
    remark: '表现卓越',
  },
  {
    id: 'grade-2',
    grade: 'B',
    minScore: 75,
    maxScore: 89,
    color: 'bg-blue-500',
    remark: '表现良好',
  },
  {
    id: 'grade-3',
    grade: 'C',
    minScore: 60,
    maxScore: 74,
    color: 'bg-yellow-500',
    remark: '基本达标',
  },
  { id: 'grade-4', grade: 'D', minScore: 0, maxScore: 59, color: 'bg-red-500', remark: '未达标' },
]

type EvalObjectType = 'individual' | 'group'

interface EvalSubjectConfig {
  type: 'teacher' | 'enterprise_mentor' | 'peer' | 'self'
  enabled: boolean
  params?: {
    teacherBackground?: string
    scorerCount?: number
    weightPercent?: number
    scoringDimensions?: string[]
    minTeachingYears?: number
    aggregationRule?: 'average' | 'median' | 'max' | 'min'
    expertise?: string
    minYears?: number
    companyType?: string
    jobExperience?: string
    peerCount?: number
    peerRule?: string
    anonymous?: boolean
    requiresReflection?: boolean
    reflectionMinLength?: number
  }
}

type EvalSubType =
  | 'knowledge_mastery'
  | 'operation_standard'
  | 'task_completion'
  | 'result_quality'
  | 'communication'
  | 'collaboration'
  | 'professionalism'
  | 'innovation'
  | 'adaptability'

export interface EvalPoint {
  id: string
  name: string
  desc: string
  subType?: EvalSubType
  types?: EvalSubType[]
  knowledgePointIds?: string[]
  abilityPointIds?: string[]
  scoringMethod?: 'score' | 'level' | 'rubric'
  gradeMapping?: GradeMapping[]
  weight?: number
}

export interface ScoringConfig {
  teacherBackground: string
  scorerCount: number
  requiresEnterpriseMentor: boolean
}

export interface TaskState {
  description: string
  descriptionPdf: string | null
  knowledgePoints: string[]
  knowledgeAutoResources: string[]
  abilityPoints: string[]
  abilityLevelMappings: { abilityId: string; level: number }[]
  resources: string[]
  evaluationMethods: string[]
  disabledEvaluationMethods: string[]
  randomDrawQuestions: string[]
  randomDrawCustomQuestions: {
    id: string
    name: string
    description: string
    answer: string
    majorId: string
  }[]
  randomDrawSelectedIds: string[]
  randomDrawEvalPoints: EvalPoint[]
  randomDrawScoreType: 'eval_points' | 'ability_levels'
  randomDrawRubricId: string | null
  reviewEvalPoints: EvalPoint[]
  reviewScoreType: 'eval_points' | 'ability_levels'
  reviewRubricId: string | null
  paperIds: string[]
  paperWeights: Record<string, number>
  paperEvalPoints: EvalPoint[]
  questionBankQuestions: string[]
  questionBankEvalPoints: EvalPoint[]
  outcomeEvalPoints: EvalPoint[]
  outcomeScoreType: 'eval_points' | 'ability_levels'
  outcomeRubricId: string | null
  homeworkEvalPoints: EvalPoint[]
  homeworkScoreType: 'eval_points' | 'ability_levels'
  homeworkRubricId: string | null
  quizQuestions: string[]
  quizEvalPoints: EvalPoint[]
  weight: number
  locked: boolean
  gradeMapping: GradeMapping[]
  scoringConfig: ScoringConfig
  evalObject: EvalObjectType
  evalSubjects: EvalSubjectConfig[]
  methodEvalObjects: Record<string, EvalObjectType>
  methodEvalSubjects: Record<string, EvalSubjectConfig[]>
  methodWeights: Record<string, number>
  evalMethodConfigs: Record<string, any>
  reviewSteps: any[]
  methodResourceConfigs: Record<string, any>
  evalMethodVersion: number
}

export function taskStateToEvalRuleConfig(state: TaskState): EvalRuleConfig {
  const normalizeMethod = (m: string) => (m === 'exam' ? 'homework' : m)
  const normalizeMap = <T,>(record: Record<string, T>): Record<string, T> => {
    const next: Record<string, T> = {}
    Object.entries(record || {}).forEach(([k, v]) => {
      next[normalizeMethod(k)] = v
    })
    return next
  }
  return {
    evaluationMethods: state.evaluationMethods.map(
      normalizeMethod,
    ) as EvalRuleConfig['evaluationMethods'],
    disabledEvaluationMethods: (state.disabledEvaluationMethods || []).map(
      normalizeMethod,
    ) as EvalRuleConfig['disabledEvaluationMethods'],
    methodWeights: normalizeMap(state.methodWeights || {}),
    evalObject: state.evalObject,
    methodEvalObjects: normalizeMap(state.methodEvalObjects || {}),
    evalSubjects: state.evalSubjects,
    methodEvalSubjects: normalizeMap(state.methodEvalSubjects || {}),
    randomDrawQuestions: state.randomDrawQuestions,
    randomDrawCustomQuestions: state.randomDrawCustomQuestions,
    randomDrawSelectedIds: state.randomDrawSelectedIds,
    randomDrawEvalPoints: state.randomDrawEvalPoints,
    randomDrawScoreType: state.randomDrawScoreType,
    randomDrawRubricId: state.randomDrawRubricId,
    reviewEvalPoints: state.reviewEvalPoints,
    reviewScoreType: state.reviewScoreType,
    reviewRubricId: state.reviewRubricId,
    paperIds: state.paperIds,
    paperWeights: state.paperWeights,
    paperEvalPoints: state.paperEvalPoints,
    questionBankQuestions: state.questionBankQuestions,
    questionBankEvalPoints: state.questionBankEvalPoints,
    outcomeEvalPoints: state.outcomeEvalPoints,
    outcomeScoreType: state.outcomeScoreType,
    outcomeRubricId: state.outcomeRubricId,
    homeworkEvalPoints: state.homeworkEvalPoints,
    homeworkScoreType: state.homeworkScoreType,
    homeworkRubricId: state.homeworkRubricId,
    quizQuestions: state.quizQuestions,
    quizEvalPoints: state.quizEvalPoints,
    gradeMapping: state.gradeMapping,
    methodResourceConfigs: normalizeMap(state.methodResourceConfigs || {}),
    reviewSteps: (state.reviewSteps || []).map((rs: any, i: number) => ({
      label: rs.label,
      description: rs.desc || null,
      enabled: rs.enabled,
      subjectType: rs.subjectType || null,
      weight: rs.weight,
      sortOrder: i,
    })),
  }
}

export function evalRuleConfigToTaskStateUpdates(config: EvalRuleConfig): Partial<TaskState> {
  // 只保留 exam -> homework 的正向归一化，确保 TaskState 中始终使用规范键 homework
  const normalizeMethod = (m: string) => (m === 'exam' ? 'homework' : m)
  const normalizeMap = <T,>(record: Record<string, T>): Record<string, T> => {
    const next: Record<string, T> = {}
    Object.entries(record || {}).forEach(([k, v]) => {
      next[normalizeMethod(k)] = v
    })
    return next
  }
  return {
    evaluationMethods: config.evaluationMethods.map(normalizeMethod),
    disabledEvaluationMethods: (config.disabledEvaluationMethods || []).map(normalizeMethod),
    methodWeights: normalizeMap(config.methodWeights || {}),
    evalObject: config.evalObject,
    methodEvalObjects: normalizeMap(config.methodEvalObjects || {}),
    evalSubjects: config.evalSubjects as EvalSubjectConfig[],
    methodEvalSubjects: normalizeMap(config.methodEvalSubjects || {}) as Record<
      string,
      EvalSubjectConfig[]
    >,
    randomDrawQuestions: config.randomDrawQuestions,
    randomDrawCustomQuestions: config.randomDrawCustomQuestions,
    randomDrawSelectedIds: config.randomDrawSelectedIds,
    randomDrawEvalPoints: config.randomDrawEvalPoints as EvalPoint[],
    randomDrawScoreType: config.randomDrawScoreType,
    randomDrawRubricId: config.randomDrawRubricId,
    reviewEvalPoints: config.reviewEvalPoints as EvalPoint[],
    reviewScoreType: config.reviewScoreType,
    reviewRubricId: config.reviewRubricId,
    paperIds: config.paperIds,
    paperWeights: config.paperWeights,
    paperEvalPoints: config.paperEvalPoints as EvalPoint[],
    questionBankQuestions: config.questionBankQuestions,
    questionBankEvalPoints: config.questionBankEvalPoints as EvalPoint[],
    outcomeEvalPoints: config.outcomeEvalPoints as EvalPoint[],
    outcomeScoreType: config.outcomeScoreType,
    outcomeRubricId: config.outcomeRubricId,
    homeworkEvalPoints: config.homeworkEvalPoints as EvalPoint[],
    homeworkScoreType: config.homeworkScoreType,
    homeworkRubricId: config.homeworkRubricId,
    quizQuestions: config.quizQuestions,
    quizEvalPoints: config.quizEvalPoints as EvalPoint[],
    gradeMapping: config.gradeMapping,
    methodResourceConfigs: normalizeMap(config.methodResourceConfigs || {}),
    reviewSteps: (config.reviewSteps || []).map((rs: EvalRuleReviewStepInput) => ({
      id: (rs as { id?: string }).id || uid('rs'),
      label: rs.label,
      desc: rs.description || '',
      enabled: rs.enabled,
      subjectType: rs.subjectType || '',
      weight: rs.weight,
    })),
  }
}

const defaultEvalSubjects: EvalSubjectConfig[] = [
  { type: 'teacher', enabled: true, params: { weightPercent: 50, scorerCount: 1 } },
  { type: 'enterprise_mentor', enabled: false, params: { weightPercent: 20 } },
  { type: 'self', enabled: false, params: { weightPercent: 10 } },
  { type: 'peer', enabled: false, params: { weightPercent: 20, peerCount: 3 } },
]

export function makeDefaultTaskState(count: number, index: number): TaskState {
  return {
    description: '',
    descriptionPdf: null,
    knowledgePoints: [],
    knowledgeAutoResources: [],
    abilityPoints: [],
    abilityLevelMappings: [],
    resources: [],
    evaluationMethods: [],
    disabledEvaluationMethods: [],
    methodWeights: {},
    randomDrawQuestions: [],
    randomDrawCustomQuestions: [],
    randomDrawSelectedIds: [],
    randomDrawEvalPoints: [],
    randomDrawScoreType: 'eval_points',
    randomDrawRubricId: null,
    reviewEvalPoints: [],
    reviewScoreType: 'eval_points',
    reviewRubricId: null,
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
    weight: count > 0 ? Math.floor(100 / count) + (index < 100 % count ? 1 : 0) : 0,
    locked: false,
    gradeMapping: JSON.parse(JSON.stringify(defaultGradeMapping)),
    scoringConfig: { teacherBackground: '', scorerCount: 1, requiresEnterpriseMentor: false },
    evalObject: 'individual',
    evalSubjects: JSON.parse(JSON.stringify(defaultEvalSubjects)),
    methodEvalObjects: {},
    methodEvalSubjects: {},
    evalMethodConfigs: {},
    reviewSteps: [],
    methodResourceConfigs: {},
    evalMethodVersion: 0,
  }
}

export function taskStateFromMethods(methods: TaskEvaluationMethod[]): TaskState {
  const state = makeDefaultTaskState(0, 0)
  if (!methods || methods.length === 0) return state

  const evalConfig = methodsToEvalRuleConfig(methods as any)
  // 将统一评价规则配置合并到 TaskState
  Object.assign(state, {
    evaluationMethods: evalConfig.evaluationMethods,
    disabledEvaluationMethods: evalConfig.disabledEvaluationMethods,
    methodWeights: evalConfig.methodWeights,
    evalObject: evalConfig.evalObject,
    methodEvalObjects: evalConfig.methodEvalObjects,
    evalSubjects: evalConfig.evalSubjects,
    methodEvalSubjects: evalConfig.methodEvalSubjects,
    randomDrawQuestions: evalConfig.randomDrawQuestions,
    randomDrawCustomQuestions: evalConfig.randomDrawCustomQuestions,
    randomDrawSelectedIds: evalConfig.randomDrawSelectedIds,
    randomDrawEvalPoints: evalConfig.randomDrawEvalPoints,
    randomDrawScoreType: evalConfig.randomDrawScoreType,
    randomDrawRubricId: evalConfig.randomDrawRubricId,
    reviewEvalPoints: evalConfig.reviewEvalPoints,
    reviewScoreType: evalConfig.reviewScoreType,
    reviewRubricId: evalConfig.reviewRubricId,
    paperIds: evalConfig.paperIds,
    paperWeights: evalConfig.paperWeights,
    paperEvalPoints: evalConfig.paperEvalPoints,
    questionBankQuestions: evalConfig.questionBankQuestions,
    questionBankEvalPoints: evalConfig.questionBankEvalPoints,
    outcomeEvalPoints: evalConfig.outcomeEvalPoints,
    outcomeScoreType: evalConfig.outcomeScoreType,
    outcomeRubricId: evalConfig.outcomeRubricId,
    homeworkEvalPoints: evalConfig.homeworkEvalPoints,
    homeworkScoreType: evalConfig.homeworkScoreType,
    homeworkRubricId: evalConfig.homeworkRubricId,
    quizQuestions: evalConfig.quizQuestions,
    quizEvalPoints: evalConfig.quizEvalPoints,
    gradeMapping: evalConfig.gradeMapping,
    methodResourceConfigs: evalConfig.methodResourceConfigs,
  })

  // 评审步骤在统一模型中按方法存储，恢复为 TaskState 顶层字段
  const reviewMethod = methods.find((m) => m.methodKey === 'review')
  if (reviewMethod?.reviewSteps) {
    state.reviewSteps = reviewMethod.reviewSteps.map((rs: any) => ({
      id: rs.id,
      label: rs.label,
      desc: rs.description || '',
      enabled: rs.enabled,
      subjectType: rs.subjectType,
      weight: rs.weight,
    }))
  }

  state.evalMethodVersion = methods.reduce((max, m) => Math.max(max, m.version || 0), 0)

  return state
}

export function taskStateToMethodsInput(ts: TaskState, extra?: { reviewSteps?: any[] }): any[] {
  // 防御性归一化：不允许任何旧的 exam 键写入后端
  const normalizeMethod = (m: string) => (m === 'exam' ? 'homework' : m)
  const normalizeMap = <T,>(record: Record<string, T>): Record<string, T> => {
    const next: Record<string, T> = {}
    Object.entries(record || {}).forEach(([k, v]) => {
      next[normalizeMethod(k)] = v
    })
    return next
  }

  const evalConfig = methodsToEvalRuleConfig([])
  Object.assign(evalConfig, {
    evaluationMethods: (ts.evaluationMethods || []).map(normalizeMethod),
    disabledEvaluationMethods: (ts.disabledEvaluationMethods || []).map(normalizeMethod),
    methodWeights: normalizeMap(ts.methodWeights || {}),
    evalObject: ts.evalObject,
    methodEvalObjects: normalizeMap(ts.methodEvalObjects || {}),
    evalSubjects: ts.evalSubjects,
    methodEvalSubjects: normalizeMap(ts.methodEvalSubjects || {}),
    randomDrawQuestions: ts.randomDrawQuestions,
    randomDrawCustomQuestions: ts.randomDrawCustomQuestions,
    randomDrawSelectedIds: ts.randomDrawSelectedIds,
    randomDrawEvalPoints: ts.randomDrawEvalPoints,
    randomDrawScoreType: ts.randomDrawScoreType,
    randomDrawRubricId: ts.randomDrawRubricId,
    reviewEvalPoints: ts.reviewEvalPoints,
    reviewScoreType: ts.reviewScoreType,
    reviewRubricId: ts.reviewRubricId,
    paperIds: ts.paperIds,
    paperWeights: ts.paperWeights,
    paperEvalPoints: ts.paperEvalPoints,
    questionBankQuestions: ts.questionBankQuestions,
    questionBankEvalPoints: ts.questionBankEvalPoints,
    outcomeEvalPoints: ts.outcomeEvalPoints,
    outcomeScoreType: ts.outcomeScoreType,
    outcomeRubricId: ts.outcomeRubricId,
    homeworkEvalPoints: ts.homeworkEvalPoints,
    homeworkScoreType: ts.homeworkScoreType,
    homeworkRubricId: ts.homeworkRubricId,
    quizQuestions: ts.quizQuestions,
    quizEvalPoints: ts.quizEvalPoints,
    gradeMapping: ts.gradeMapping,
    methodResourceConfigs: normalizeMap(ts.methodResourceConfigs || {}),
  })

  const methods = evalRuleConfigToMethods(evalConfig)

  // 恢复评审步骤到 review 方法
  if (evalConfig.evaluationMethods.includes('review')) {
    const reviewIdx = methods.findIndex((m) => m.methodKey === 'review')
    if (reviewIdx >= 0) {
      const reviewSteps = extra?.reviewSteps ?? ts.reviewSteps
      methods[reviewIdx].reviewSteps = (reviewSteps || []).map((rs: any, i: number) => ({
        label: rs.label,
        description: rs.desc || null,
        enabled: rs.enabled,
        subjectType: rs.subjectType,
        weight: rs.weight,
        sortOrder: i,
      }))
    }
  }

  return methods
}
