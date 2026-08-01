"use client"

import { useCallback, useEffect, useMemo, useReducer, useRef } from "react"
import {
  type EvalRuleConfig,
  type EvalRuleMethodKey,
  type EvalRulePoint,
  type EvalRuleReviewStepInput,
  type EvalRuleSubjectConfig,
  type EvalObjectType,
  type EvalScoreType,
  makeDefaultEvalRuleConfig,
  mergeEvalRuleMethods,
} from "@/lib/types/evaluation"

export type EvalPointField =
  | "randomDrawEvalPoints"
  | "reviewEvalPoints"
  | "paperEvalPoints"
  | "questionBankEvalPoints"
  | "outcomeEvalPoints"
  | "homeworkEvalPoints"
  | "quizEvalPoints"

export type ScoreTypeField =
  | "randomDrawScoreType"
  | "reviewScoreType"
  | "outcomeScoreType"
  | "homeworkScoreType"

export type RubricIdField =
  | "randomDrawRubricId"
  | "reviewRubricId"
  | "outcomeRubricId"
  | "homeworkRubricId"

export type QuestionIdField =
  | "randomDrawQuestions"
  | "questionBankQuestions"
  | "quizQuestions"

const evalPointFieldMap: Record<string, EvalPointField> = {
  random_draw: "randomDrawEvalPoints",
  review: "reviewEvalPoints",
  paper: "paperEvalPoints",
  question_bank: "questionBankEvalPoints",
  outcome: "outcomeEvalPoints",
  homework: "homeworkEvalPoints",
  quiz: "quizEvalPoints",
}

const scoreTypeFieldMap: Record<string, ScoreTypeField> = {
  random_draw: "randomDrawScoreType",
  review: "reviewScoreType",
  outcome: "outcomeScoreType",
  homework: "homeworkScoreType",
}

const rubricIdFieldMap: Record<string, RubricIdField> = {
  random_draw: "randomDrawRubricId",
  review: "reviewRubricId",
  outcome: "outcomeRubricId",
  homework: "homeworkRubricId",
}

const questionIdFieldMap: Record<string, QuestionIdField> = {
  random_draw: "randomDrawQuestions",
  question_bank: "questionBankQuestions",
  quiz: "quizQuestions",
}

function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v))
}

export interface EvalRuleState extends EvalRuleConfig {
  // 计算属性/派生状态在 hook 中通过 useMemo 提供
}

export type EvalRuleAction =
  | { type: "SET_CONFIG"; payload: Partial<EvalRuleConfig> }
  | { type: "SET_METHODS"; payload: EvalRuleMethodKey[] }
  | { type: "SET_METHOD_WEIGHT"; methodKey: string; weight: number }
  | { type: "DISTRIBUTE_WEIGHTS" }
  | { type: "MOVE_METHOD_UP"; index: number }
  | { type: "MOVE_METHOD_DOWN"; index: number }
  | { type: "SET_EVAL_OBJECT"; evalObject: EvalObjectType }
  | { type: "SET_METHOD_EVAL_OBJECT"; methodKey: string; evalObject: EvalObjectType }
  | { type: "SET_EVAL_SUBJECTS"; subjects: EvalRuleSubjectConfig[] }
  | { type: "SET_METHOD_EVAL_SUBJECTS"; methodKey: string; subjects: EvalRuleSubjectConfig[] }
  | { type: "ADD_EVAL_POINT"; field: EvalPointField; point: Partial<EvalRulePoint> }
  | { type: "UPDATE_EVAL_POINT"; field: EvalPointField; id: string; updates: Partial<EvalRulePoint> }
  | { type: "REMOVE_EVAL_POINT"; field: EvalPointField; id: string }
  | { type: "SET_SCORE_TYPE"; field: ScoreTypeField; scoreType: EvalScoreType | null }
  | { type: "SET_RUBRIC_ID"; field: RubricIdField; rubricId: string | null }
  | { type: "SET_QUESTION_IDS"; field: QuestionIdField; ids: string[] }
  | { type: "TOGGLE_QUESTION"; field: QuestionIdField; id: string }
  | { type: "SET_REVIEW_STEPS"; steps: EvalRuleReviewStepInput[] }
  | { type: "SET_GRADE_MAPPING"; gradeMapping: EvalRuleConfig["gradeMapping"] }
  | { type: "SET_RESOURCE_CONFIG"; methodKey: string; resourceConfig: Record<string, any> }
  | { type: "SET_CUSTOM_QUESTIONS"; questions: EvalRuleConfig["randomDrawCustomQuestions"] }
  | { type: "SET_SELECTED_QUESTION_IDS"; ids: string[] }

function reducer(state: EvalRuleState, action: EvalRuleAction): EvalRuleState {
  // 浅拷贝顶层状态，各分支按需 spread 嵌套层级，避免每次 action 全量 JSON 序列化
  const next: EvalRuleState = { ...state }

  switch (action.type) {
    case "SET_CONFIG": {
      return { ...next, ...action.payload }
    }

    case "SET_METHODS": {
      return mergeEvalRuleMethods(next, action.payload)
    }

    case "SET_METHOD_WEIGHT": {
      const weight = Math.max(0, Math.min(100, action.weight))
      next.methodWeights = { ...next.methodWeights, [action.methodKey]: weight }
      return next
    }

    case "DISTRIBUTE_WEIGHTS": {
      const count = next.evaluationMethods.length
      if (count === 0) return next
      const base = Math.floor(100 / count)
      const remainder = 100 % count
      next.methodWeights = {}
      next.evaluationMethods.forEach((m, i) => {
        next.methodWeights[m] = base + (i < remainder ? 1 : 0)
      })
      return next
    }

    case "MOVE_METHOD_UP": {
      const idx = action.index
      if (idx <= 0) return next
      const methods = [...next.evaluationMethods]
      const temp = methods[idx]
      methods[idx] = methods[idx - 1]
      methods[idx - 1] = temp
      next.evaluationMethods = methods
      return next
    }

    case "MOVE_METHOD_DOWN": {
      const idx = action.index
      if (idx >= next.evaluationMethods.length - 1) return next
      const methods = [...next.evaluationMethods]
      const temp = methods[idx]
      methods[idx] = methods[idx + 1]
      methods[idx + 1] = temp
      next.evaluationMethods = methods
      return next
    }

    case "SET_EVAL_OBJECT": {
      next.evalObject = action.evalObject
      return next
    }

    case "SET_METHOD_EVAL_OBJECT": {
      next.methodEvalObjects = { ...next.methodEvalObjects, [action.methodKey]: action.evalObject }
      return next
    }

    case "SET_EVAL_SUBJECTS": {
      next.evalSubjects = action.subjects
      return next
    }

    case "SET_METHOD_EVAL_SUBJECTS": {
      next.methodEvalSubjects = { ...next.methodEvalSubjects, [action.methodKey]: action.subjects }
      return next
    }

    case "ADD_EVAL_POINT": {
      const field = action.field
      const preset = action.point
      const newPoint: EvalRulePoint = {
        id: uid("ep"),
        name: preset?.name?.trim() || "未命名评价点",
        desc: preset?.desc || "",
        subType: preset?.subType,
        types: preset?.types,
        knowledgePointIds: preset?.knowledgePointIds,
        abilityPointIds: preset?.abilityPointIds,
        scoringMethod: preset?.scoringMethod || "level",
        gradeMapping: preset?.gradeMapping !== undefined
          ? preset.gradeMapping
          : preset?.name === ""
            ? []
            : clone(next.gradeMapping),
        weight: preset?.weight,
      }
      ;(next as any)[field] = [...((next as any)[field] as EvalRulePoint[]), newPoint]
      return next
    }

    case "UPDATE_EVAL_POINT": {
      const field = action.field
      ;(next as any)[field] = ((next as any)[field] as EvalRulePoint[]).map(p =>
        p.id === action.id ? { ...p, ...action.updates } : p
      )
      return next
    }

    case "REMOVE_EVAL_POINT": {
      const field = action.field
      ;(next as any)[field] = ((next as any)[field] as EvalRulePoint[]).filter(p => p.id !== action.id)
      return next
    }

    case "SET_SCORE_TYPE": {
      ;(next as any)[action.field] = action.scoreType
      return next
    }

    case "SET_RUBRIC_ID": {
      ;(next as any)[action.field] = action.rubricId
      return next
    }

    case "SET_QUESTION_IDS": {
      ;(next as any)[action.field] = action.ids
      return next
    }

    case "TOGGLE_QUESTION": {
      const field = action.field
      const arr = (next as any)[field] as string[]
      const exists = arr.includes(action.id)
      ;(next as any)[field] = exists ? arr.filter(x => x !== action.id) : [...arr, action.id]
      return next
    }

    case "SET_REVIEW_STEPS": {
      next.reviewSteps = action.steps
      // Keep a copy in review resourceConfig for backward compatibility with older consumers.
      next.methodResourceConfigs = {
        ...next.methodResourceConfigs,
        review: { ...(next.methodResourceConfigs.review || {}), reviewSteps: action.steps },
      }
      return next
    }

    case "SET_GRADE_MAPPING": {
      next.gradeMapping = action.gradeMapping
      return next
    }

    case "SET_RESOURCE_CONFIG": {
      next.methodResourceConfigs = {
        ...next.methodResourceConfigs,
        [action.methodKey]: action.resourceConfig,
      }
      return next
    }

    case "SET_CUSTOM_QUESTIONS": {
      next.randomDrawCustomQuestions = action.questions
      return next
    }

    case "SET_SELECTED_QUESTION_IDS": {
      next.randomDrawSelectedIds = action.ids
      return next
    }

    default:
      return next
  }
}

export interface UseEvalRuleStoreOptions {
  initialConfig?: Partial<EvalRuleConfig>
  evaluationMethods?: string[]
  onChange?: (config: EvalRuleConfig) => void
}

export function useEvalRuleStore(options: UseEvalRuleStoreOptions) {
  const { initialConfig, evaluationMethods = [], onChange } = options

  const normalizedMethods = useMemo<EvalRuleMethodKey[]>(
    () => evaluationMethods.map(m => (m === "exam" ? "homework" : m) as EvalRuleMethodKey),
    [evaluationMethods]
  )

  const initialState = useMemo<EvalRuleState>(() => {
    const base = makeDefaultEvalRuleConfig(normalizedMethods)
    return initialConfig ? { ...base, ...initialConfig, evaluationMethods: normalizedMethods } : base
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // 仅在挂载时计算一次，后续由 props 变化通过 effect 同步

  const [state, dispatch] = useReducer(reducer, initialState)
  const lastMethodsRef = useRef<string>(JSON.stringify(normalizedMethods))
  const onChangeRef = useRef(onChange)

  // 标记是否需要跳过下一次通知：prop 同步导致的状态变化不应反向通知父组件，避免无限循环
  const skipNextNotificationRef = useRef(false)
  const isInitialRenderRef = useRef(true)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  // 同步 props 中的 evaluationMethods 变化，采用合并策略而非全量重置
  useEffect(() => {
    const serialized = JSON.stringify(normalizedMethods)
    if (lastMethodsRef.current === serialized) return
    lastMethodsRef.current = serialized
    skipNextNotificationRef.current = true
    dispatch({ type: "SET_METHODS", payload: normalizedMethods })
  }, [normalizedMethods])

  // 同步 initialConfig 变化（仅在挂载后首次变化或外部强制更新时）
  // 用 ref 记录首次序列化值作比较，避免把 JSON.stringify(initialConfig) 直接当依赖
  const lastInitialConfigRef = useRef<string>(JSON.stringify(initialConfig ?? null))
  useEffect(() => {
    if (!initialConfig) return
    const serialized = JSON.stringify(initialConfig)
    if (lastInitialConfigRef.current === serialized) return
    lastInitialConfigRef.current = serialized
    skipNextNotificationRef.current = true
    dispatch({ type: "SET_CONFIG", payload: initialConfig })
  }, [initialConfig])

  // 通知外部变化：跳过首次渲染以及由 prop 同步触发的那一次渲染，防止受控组件无限重渲染
  useEffect(() => {
    if (isInitialRenderRef.current) {
      isInitialRenderRef.current = false
      return
    }
    if (skipNextNotificationRef.current) {
      skipNextNotificationRef.current = false
      return
    }
    if (onChangeRef.current) {
      const exportConfig: EvalRuleConfig = {
        ...state,
        evaluationMethods: state.evaluationMethods.map(m =>
          m === "homework" ? ("exam" as EvalRuleMethodKey) : m
        ) as EvalRuleConfig["evaluationMethods"],
      }
      onChangeRef.current(exportConfig)
    }
  }, [state])

  const setConfig = useCallback((payload: Partial<EvalRuleConfig>) => {
    dispatch({ type: "SET_CONFIG", payload })
  }, [])

  const setMethods = useCallback((methods: EvalRuleMethodKey[]) => {
    dispatch({ type: "SET_METHODS", payload: methods })
  }, [])

  const setMethodWeight = useCallback((methodKey: string, weight: number) => {
    dispatch({ type: "SET_METHOD_WEIGHT", methodKey, weight })
  }, [])

  const distributeWeights = useCallback(() => {
    dispatch({ type: "DISTRIBUTE_WEIGHTS" })
  }, [])

  const moveMethodUp = useCallback((index: number) => {
    dispatch({ type: "MOVE_METHOD_UP", index })
  }, [])

  const moveMethodDown = useCallback((index: number) => {
    dispatch({ type: "MOVE_METHOD_DOWN", index })
  }, [])

  const setEvalObject = useCallback((evalObject: EvalObjectType) => {
    dispatch({ type: "SET_EVAL_OBJECT", evalObject })
  }, [])

  const setMethodEvalObject = useCallback((methodKey: string, evalObject: EvalObjectType) => {
    dispatch({ type: "SET_METHOD_EVAL_OBJECT", methodKey, evalObject })
  }, [])

  const setEvalSubjects = useCallback((subjects: EvalRuleSubjectConfig[]) => {
    dispatch({ type: "SET_EVAL_SUBJECTS", subjects })
  }, [])

  const setMethodEvalSubjects = useCallback((methodKey: string, subjects: EvalRuleSubjectConfig[]) => {
    dispatch({ type: "SET_METHOD_EVAL_SUBJECTS", methodKey, subjects })
  }, [])

  const addEvalPoint = useCallback((field: EvalPointField, point?: Partial<EvalRulePoint>) => {
    dispatch({ type: "ADD_EVAL_POINT", field, point: point || {} })
  }, [])

  const updateEvalPoint = useCallback((field: EvalPointField, id: string, updates: Partial<EvalRulePoint>) => {
    dispatch({ type: "UPDATE_EVAL_POINT", field, id, updates })
  }, [])

  const removeEvalPoint = useCallback((field: EvalPointField, id: string) => {
    dispatch({ type: "REMOVE_EVAL_POINT", field, id })
  }, [])

  const setScoreType = useCallback((field: ScoreTypeField, scoreType: EvalScoreType | null) => {
    dispatch({ type: "SET_SCORE_TYPE", field, scoreType })
  }, [])

  const setRubricId = useCallback((field: RubricIdField, rubricId: string | null) => {
    dispatch({ type: "SET_RUBRIC_ID", field, rubricId })
  }, [])

  const setQuestionIds = useCallback((field: QuestionIdField, ids: string[]) => {
    dispatch({ type: "SET_QUESTION_IDS", field, ids })
  }, [])

  const toggleQuestion = useCallback((field: QuestionIdField, id: string) => {
    dispatch({ type: "TOGGLE_QUESTION", field, id })
  }, [])

  const setReviewSteps = useCallback((steps: EvalRuleReviewStepInput[]) => {
    dispatch({ type: "SET_REVIEW_STEPS", steps })
  }, [])

  const setGradeMapping = useCallback((gradeMapping: EvalRuleConfig["gradeMapping"]) => {
    dispatch({ type: "SET_GRADE_MAPPING", gradeMapping })
  }, [])

  const setResourceConfig = useCallback((methodKey: string, resourceConfig: Record<string, any>) => {
    dispatch({ type: "SET_RESOURCE_CONFIG", methodKey, resourceConfig })
  }, [])

  const setCustomQuestions = useCallback((questions: EvalRuleConfig["randomDrawCustomQuestions"]) => {
    dispatch({ type: "SET_CUSTOM_QUESTIONS", questions })
  }, [])

  const setSelectedQuestionIds = useCallback((ids: string[]) => {
    dispatch({ type: "SET_SELECTED_QUESTION_IDS", ids })
  }, [])

  const getEvalPoints = useCallback(
    (methodKey: string) => {
      const field = evalPointFieldMap[methodKey]
      return field ? ((state as any)[field] as EvalRulePoint[]) : []
    },
    [state]
  )

  const getScoreType = useCallback(
    (methodKey: string) => {
      const field = scoreTypeFieldMap[methodKey]
      return field ? ((state as any)[field] as EvalScoreType | null) : null
    },
    [state]
  )

  const getRubricId = useCallback(
    (methodKey: string) => {
      const field = rubricIdFieldMap[methodKey]
      return field ? ((state as any)[field] as string | null) : null
    },
    [state]
  )

  const getQuestionIds = useCallback(
    (methodKey: string) => {
      const field = questionIdFieldMap[methodKey]
      return field ? ((state as any)[field] as string[]) : []
    },
    [state]
  )

  const methodWeightTotal = useMemo(
    () => state.evaluationMethods.reduce((sum, m) => sum + (state.methodWeights[m] || 0), 0),
    [state.evaluationMethods, state.methodWeights]
  )

  return useMemo(
    () => ({
      state,
      dispatch,
      setConfig,
      setMethods,
      setMethodWeight,
      distributeWeights,
      moveMethodUp,
      moveMethodDown,
      setEvalObject,
      setMethodEvalObject,
      setEvalSubjects,
      setMethodEvalSubjects,
      addEvalPoint,
      updateEvalPoint,
      removeEvalPoint,
      setScoreType,
      setRubricId,
      setQuestionIds,
      toggleQuestion,
      setReviewSteps,
      setGradeMapping,
      setResourceConfig,
      setCustomQuestions,
      setSelectedQuestionIds,
      getEvalPoints,
      getScoreType,
      getRubricId,
      getQuestionIds,
      methodWeightTotal,
      evalPointFieldMap,
      scoreTypeFieldMap,
      rubricIdFieldMap,
      questionIdFieldMap,
    }),
    [
      state,
      dispatch,
      setConfig,
      setMethods,
      setMethodWeight,
      distributeWeights,
      moveMethodUp,
      moveMethodDown,
      setEvalObject,
      setMethodEvalObject,
      setEvalSubjects,
      setMethodEvalSubjects,
      addEvalPoint,
      updateEvalPoint,
      removeEvalPoint,
      setScoreType,
      setRubricId,
      setQuestionIds,
      toggleQuestion,
      setReviewSteps,
      setGradeMapping,
      setResourceConfig,
      setCustomQuestions,
      setSelectedQuestionIds,
      getEvalPoints,
      getScoreType,
      getRubricId,
      getQuestionIds,
      methodWeightTotal,
    ]
  )
}

export { evalPointFieldMap, scoreTypeFieldMap, rubricIdFieldMap, questionIdFieldMap }
