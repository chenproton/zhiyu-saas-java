'use client'

import {
  Award,
  Book,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Database,
  FileQuestion,
  FileText,
  FolderCheck,
  Gavel,
  Lightbulb,
  Link2,
  Package,
  Scale,
  Shield,
} from 'lucide-react'
import {
  type EvalRuleConfig,
  type EvalRuleReviewStepInput,
  uid,
} from '@/components/evaluation-rules'
import type { TaskEvaluationMethod } from '@/lib/types/scene'
import { methodsToEvalRuleConfig, evalRuleConfigToMethods } from '@/lib/types/evaluation'
import type { GradeMapping } from '@/lib/types/scene-mock'

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

export const evaluationMethodOptions = [
  // 平台通用 - 知识评价
  {
    key: 'question_bank',
    label: '题库',
    icon: <Database className="h-5 w-5" />,
    color: 'bg-orange-50 text-orange-600 border-orange-200',
    available: true,
    desc: '从题库选题组成测评资源',
    primaryCategory: 'platform',
    secondaryCategory: '知识评价',
  },
  {
    key: 'paper',
    label: '试卷',
    icon: <ClipboardList className="h-5 w-5" />,
    color: 'bg-green-50 text-green-600 border-green-200',
    available: true,
    desc: '使用固定试卷进行考核',
    primaryCategory: 'platform',
    secondaryCategory: '知识评价',
  },
  {
    key: 'quiz',
    label: '随堂测',
    icon: <FileQuestion className="h-5 w-5" />,
    color: 'bg-red-50 text-red-600 border-red-200',
    available: true,
    desc: '课堂即时测验',
    primaryCategory: 'platform',
    secondaryCategory: '知识评价',
  },
  // 平台通用 - 过程评价
  {
    key: 'random_draw',
    label: '现场问答',
    icon: <FileQuestion className="h-5 w-5" />,
    color: 'bg-blue-50 text-blue-600 border-blue-200',
    available: true,
    desc: '从题库抽取题目，教师现场提问',
    primaryCategory: 'platform',
    secondaryCategory: '过程评价',
  },
  // 平台通用 - 成果评价
  {
    key: 'review',
    label: '现场评审',
    icon: <Gavel className="h-5 w-5" />,
    color: 'bg-purple-50 text-purple-600 border-purple-200',
    available: true,
    desc: '教师根据表现/材料给评价点打分',
    primaryCategory: 'platform',
    secondaryCategory: '成果评价',
  },
  {
    key: 'outcome',
    label: '成果评价',
    icon: <FolderCheck className="h-5 w-5" />,
    color: 'bg-cyan-50 text-cyan-600 border-cyan-200',
    available: true,
    desc: '对学生成果进行评价',
    primaryCategory: 'platform',
    secondaryCategory: '成果评价',
  },
  {
    key: 'homework',
    label: '作业',
    icon: <BookOpen className="h-5 w-5" />,
    color: 'bg-pink-50 text-pink-600 border-pink-200',
    available: true,
    desc: '学生提交作业进行评价',
    primaryCategory: 'platform',
    secondaryCategory: '成果评价',
  },
  // 行业专属 - 智慧物流
  {
    key: 'wms_inbound',
    label: 'WMS(入库单)自动化评分',
    icon: <Package className="h-5 w-5" />,
    color: 'bg-indigo-50 text-indigo-600 border-indigo-200',
    available: false,
    desc: '基于 WMS 入库单操作的自动化评分',
    primaryCategory: 'industry',
    secondaryCategory: '智慧物流',
  },
  {
    key: 'wms_outbound',
    label: 'WMS(出库单)自动化评分',
    icon: <Package className="h-5 w-5" />,
    color: 'bg-indigo-50 text-indigo-600 border-indigo-200',
    available: false,
    desc: '基于 WMS 出库单操作的自动化评分',
    primaryCategory: 'industry',
    secondaryCategory: '智慧物流',
  },
  {
    key: 'wms_wave',
    label: 'WMS(波次分拣)自动化评分',
    icon: <Package className="h-5 w-5" />,
    color: 'bg-indigo-50 text-indigo-600 border-indigo-200',
    available: false,
    desc: '基于 WMS 波次分拣操作的自动化评分',
    primaryCategory: 'industry',
    secondaryCategory: '智慧物流',
  },
  // 行业专属 - 网络安全
  {
    key: 'network_traffic',
    label: '网络流量分析自助评价',
    icon: <Shield className="h-5 w-5" />,
    color: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    available: false,
    desc: '基于网络流量分析的自助评价',
    primaryCategory: 'industry',
    secondaryCategory: '网络安全',
  },
  {
    key: 'cyber_range',
    label: '网络靶场自助评价',
    icon: <Shield className="h-5 w-5" />,
    color: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    available: false,
    desc: '基于网络靶场环境的自助评价',
    primaryCategory: 'industry',
    secondaryCategory: '网络安全',
  },
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
    methodResourceConfigs: state.methodResourceConfigs,
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
  const normalizeMethod = (m: string) => (m === 'homework' ? 'exam' : m)
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
    methodResourceConfigs: config.methodResourceConfigs,
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
  const evalConfig = methodsToEvalRuleConfig([])
  Object.assign(evalConfig, {
    evaluationMethods: ts.evaluationMethods,
    disabledEvaluationMethods: ts.disabledEvaluationMethods || [],
    methodWeights: ts.methodWeights,
    evalObject: ts.evalObject,
    methodEvalObjects: ts.methodEvalObjects,
    evalSubjects: ts.evalSubjects,
    methodEvalSubjects: ts.methodEvalSubjects,
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
    methodResourceConfigs: ts.methodResourceConfigs,
  })

  const methods = evalRuleConfigToMethods(evalConfig)

  // 恢复评审步骤到 review 方法
  if (ts.evaluationMethods.includes('review')) {
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
