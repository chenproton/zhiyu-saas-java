'use client'

import {
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Database,
  FileQuestion,
  Info,
  Lightbulb,
  ListOrdered,
  PenTool,
  Plus,
  RotateCcw,
  Scale,
  Search,
  Target,
  Trash2,
  User,
  UserCheck,
  Users,
  X,
  Award,
  BookOpen,
} from 'lucide-react'
import { useMemo, useState, useRef, useCallback, useEffect } from 'react'
import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { useToast, MixedTagEditor } from '@zhiyu/ui'
import { reportError } from '@/lib/error-handling'
import { FormFieldRow } from '@/components/shared/form-field-row'
import { ExamActivationConfig } from '@/components/evaluation-rules/exam-activation-config'
import type { KnowledgePointItem } from '@/lib/types/lesson'
import type { EvalRuleConfig } from '@/lib/types/evaluation'
import { useEvalRuleStore } from '@/lib/evaluation-rule-store'
import { ExamFormDialog } from '@/components/evaluation/exam-form-dialog'
import { BankQuestionSelectorPanel } from '@/components/evaluation-rules/bank-question-selector-panel'
import { examApi, randomDrawQuestionApi, majorApi, taskEvaluationApi } from '@/lib/api'
import {
  getLoadedExams,
  setLoadedExams,
  addLoadedExam,
  type LoadedExam,
} from '@/components/evaluation-rules/shared-defs'
import {
  evaluationMethodOptions,
  evalSubTypeLabels,
  evalSubTypeColors,
  defaultGradeMapping,
  defaultEvalSubjects,
} from './constants'
import {
  type EvalObjectType,
  type EvalSubType,
  type RubricScheme,
  type EvalPoint,
  type EvalRuleScoreRule,
  type EvalRuleSubjectConfig,
  type EvalRuleReviewStepInput,
} from './types'
import { uid } from './utils'

export interface AbilityPointItem {
  id: string
  name: string
  code?: string
  description?: string
}

export interface EvaluationRulesEditorProps {
  evaluationMethods: string[]
  config: EvalRuleConfig
  onChange: (config: EvalRuleConfig) => void
  knowledgePoints?: KnowledgePointItem[]
  abilityPoints?: AbilityPointItem[]
  inline?: boolean
  className?: string
  title?: string
  /**
   * 评价标准表单「保存」回调：把当前方法的评价标准立即关联到任务/节点。
   * 不传时仅通过 onChange 上抛配置（如课程侧由父组件统一持久化）。
   */
  onPersistStandard?: (methodKey: string, config: EvalRuleConfig) => Promise<void> | void
}

interface ReviewStep {
  id: string
  label: string
  desc: string
  enabled: boolean
  subjectType: string
  weight: number
}

function buildDefaultReviewSteps(): ReviewStep[] {
  return [
    {
      id: uid('rs'),
      label: '学生自评',
      desc: '学生根据量规进行自我评价',
      enabled: true,
      subjectType: 'self',
      weight: 20,
    },
    {
      id: uid('rs'),
      label: '小组互评',
      desc: '小组内成员互相评价',
      enabled: false,
      subjectType: 'peer',
      weight: 0,
    },
    {
      id: uid('rs'),
      label: '教师评审',
      desc: '教师根据提交材料和表现评分',
      enabled: true,
      subjectType: 'teacher',
      weight: 80,
    },
  ]
}

export function EvaluationRulesEditor({
  evaluationMethods,
  config: configProp,
  onChange,
  knowledgePoints: kpProp,
  abilityPoints: abProp,
  inline,
  className,
  title = '配置评价规则',
  onPersistStandard,
}: EvaluationRulesEditorProps) {
  const { toast } = useToast()
  const knowledgePoints = useMemo(() => kpProp || [], [kpProp])
  const abilityPoints = useMemo(() => abProp || [], [abProp])

  const store = useEvalRuleStore({
    initialConfig: configProp,
    evaluationMethods,
    onChange,
  })

  const { state: config, dispatch } = store

  // Compatibility shim: still use SET_CONFIG for most updates.
  const updateConfig = useCallback(
    (updates: Partial<EvalRuleConfig>) => {
      dispatch({ type: 'SET_CONFIG', payload: updates })
    },
    [dispatch],
  )

  // ============ Local UI states ============
  const [erDialogOpen, setErDialogOpen] = useState<
    'object' | 'subject' | 'resource' | 'method' | null
  >(null)
  const [erDialogMethod, setErDialogMethod] = useState<string | null>(null)
  const [isOrderConfigOpen, setIsOrderConfigOpen] = useState(false)
  const [isWeightConfigOpen, setIsWeightConfigOpen] = useState(false)
  const [methodInstanceCounts] = useState<Record<string, number>>({})

  const [showAddQuestion, setShowAddQuestion] = useState(false)
  const [questionDetailOpen, setQuestionDetailOpen] = useState(false)

  const [rdqSearch, setRdqSearch] = useState('')
  const [rdqActionOpen, setRdqActionOpen] = useState(false)
  const [rdqActionMode, setRdqActionMode] = useState<'add' | 'edit'>('add')
  const [rdqActionTarget, setRdqActionTarget] = useState<{
    id: string
    name: string
    description: string
    answer: string
    majorId: string
  } | null>(null)
  const [newRdqForm, setNewRdqForm] = useState({
    name: '',
    description: '',
    answer: '',
    majorId: '',
  })
  const [rdqDetailOpen, setRdqDetailOpen] = useState(false)
  const [selectedRdqForDetail, setSelectedRdqForDetail] = useState<string | null>(null)

  const [, setPaperDetailOpen] = useState(false)

  const [rubricKpDialogOpen, setRubricKpDialogOpen] = useState(false)
  const [rubricKpTargetPointId, setRubricKpTargetPointId] = useState<string | null>(null)
  const [rubricKpTargetField, setRubricKpTargetField] = useState<string | null>(null)
  const [rubricKpSearch, setRubricKpSearch] = useState('')
  const [rubricAbDialogOpen, setRubricAbDialogOpen] = useState(false)
  const [rubricAbTargetPointId, setRubricAbTargetPointId] = useState<string | null>(null)
  const [rubricAbTargetField, setRubricAbTargetField] = useState<string | null>(null)
  const [rubricAbSearch, setRubricAbSearch] = useState('')

  const [newPointName, setNewPointName] = useState('')
  const [methodDialogViews, setMethodDialogViews] = useState<
    Record<string, 'list' | 'edit' | 'template'>
  >({})
  const [rubricLibrary, setRubricLibrary] = useState<RubricScheme[]>([])
  // 评价标准编辑表单草稿（任务侧标准名称/类型，rubric | score_rule）
  const [stdDraft, setStdDraft] = useState<{ name: string; mode: 'rubric' | 'score_rule' }>({
    name: '',
    mode: 'rubric',
  })
  // 评价标准「保存」防重入：连点两次不会基于旧 state 重复提交
  const [isSavingStandard, setIsSavingStandard] = useState(false)

  const [reviewSteps, setReviewSteps] = useState<ReviewStep[]>(() => {
    const incoming = configProp.reviewSteps || []
    if (incoming.length > 0) {
      return incoming.map((rs, i) => ({
        id: uid(`rs-${i}`),
        label: rs.label,
        desc: rs.description || '',
        enabled: rs.enabled,
        subjectType: rs.subjectType || '',
        weight: rs.weight,
      }))
    }
    return buildDefaultReviewSteps()
  })

  const lastSyncedReviewStepsRef = useRef<EvalRuleReviewStepInput[] | null>(null)
  useEffect(() => {
    const incoming = configProp.reviewSteps || []
    const lastSynced = lastSyncedReviewStepsRef.current
    const changed =
      !lastSynced ||
      lastSynced.length !== incoming.length ||
      lastSynced.some((s, i) => {
        const inc = incoming[i]
        return (
          s.label !== inc.label ||
          s.description !== inc.description ||
          s.enabled !== inc.enabled ||
          s.subjectType !== inc.subjectType ||
          s.weight !== inc.weight ||
          s.sortOrder !== inc.sortOrder
        )
      })
    if (!changed) return
    lastSyncedReviewStepsRef.current = incoming
    if (incoming.length === 0) {
      // 默认评审步骤需要写入 config.reviewSteps，否则保存时不会随 onChange 持久化
      const defaults = buildDefaultReviewSteps()
      queueMicrotask(() => {
        store.setReviewSteps(
          defaults.map((rs, i) => ({
            label: rs.label,
            description: rs.desc || null,
            enabled: rs.enabled,
            subjectType: rs.subjectType || null,
            weight: rs.weight,
            sortOrder: i,
          })),
        )
      })
      return
    }
    // Defer state update to avoid cascading renders while still syncing external prop changes.
    queueMicrotask(() => {
      setReviewSteps(
        incoming.map((rs, i) => ({
          id: uid(`rs-${i}`),
          label: rs.label,
          desc: rs.description || '',
          enabled: rs.enabled,
          subjectType: rs.subjectType || '',
          weight: rs.weight,
        })),
      )
    })
  }, [configProp.reviewSteps, store])

  // 用户操作驱动本地 state 与 store 同步，避免 useEffect 双向同步导致的无限重渲染
  const setReviewStepsAndSync = useCallback(
    (updater: React.SetStateAction<ReviewStep[]>) => {
      setReviewSteps((prev) => {
        const next =
          typeof updater === 'function'
            ? (updater as (prev: ReviewStep[]) => ReviewStep[])(prev)
            : updater
        const synced: EvalRuleReviewStepInput[] = next.map((rs, i) => ({
          label: rs.label,
          description: rs.desc || null,
          enabled: rs.enabled,
          subjectType: rs.subjectType || null,
          weight: rs.weight,
          sortOrder: i,
        }))
        lastSyncedReviewStepsRef.current = synced
        store.setReviewSteps(synced)
        return next
      })
    },
    [store],
  )
  const [showAddStep, setShowAddStep] = useState(false)
  const [newStepLabel, setNewStepLabel] = useState('')
  const [newStepDesc, setNewStepDesc] = useState('')
  const [newStepSubjectType, setNewStepSubjectType] = useState('')
  const [editingReviewStepId, setEditingReviewStepId] = useState<string | null>(null)
  const [editingStepLabel, setEditingStepLabel] = useState('')
  const [editingStepDesc, setEditingStepDesc] = useState('')

  // EvalResourceOnlyPanel 状态（从内部组件提升）
  const [rdqMajorTab, setRdqMajorTab] = useState('全部')
  const [qbDrawMode, setQbDrawMode] = useState<'all' | 'practice'>('all')
  const [qbPassRate, setQbPassRate] = useState(60)

  // MethodDialogContent 状态（从内部组件提升）
  const [gradeMappingDialogOpen, setGradeMappingDialogOpen] = useState(false)
  const [editingGradeMappingPointId, setEditingGradeMappingPointId] = useState<string | null>(null)
  const [saveTemplateDialogOpen, setSaveTemplateDialogOpen] = useState(false)
  const [saveTemplateMode, setSaveTemplateMode] = useState<'new' | 'replace'>('new')
  const [selectedReplaceTemplateId, setSelectedReplaceTemplateId] = useState<string | null>(null)

  // 资源配置统一收敛到 config.methodResourceConfigs，确保可随 onChange 回传保存
  const getResourceConfig = useCallback(
    <T = Record<string, any>,>(methodKey: string, defaults: T): T => {
      return (config.methodResourceConfigs?.[methodKey] as T) || defaults
    },
    [config.methodResourceConfigs],
  )

  const updateResourceConfig = useCallback(
    <T = Record<string, any>,>(methodKey: string, updates: Partial<T>) => {
      updateConfig({
        methodResourceConfigs: {
          ...config.methodResourceConfigs,
          [methodKey]: { ...(config.methodResourceConfigs?.[methodKey] || {}), ...updates },
        },
      })
    },
    [config.methodResourceConfigs, updateConfig],
  )

  // Random draw question API state
  const [rdqApiQuestions, setRdqApiQuestions] = useState<any[]>([])
  const [loadingRdq, setLoadingRdq] = useState(false)
  const [majors, setMajors] = useState<any[]>([])

  // Paper loading
  const [loadingPapers, setLoadingPapers] = useState(false)
  const [paperSearch, setPaperSearch] = useState('')
  const [showCreatePaperLocal, setShowCreatePaperLocal] = useState(false)
  const [paperDetailOpenLocal, setPaperDetailOpenLocal] = useState(false)
  const [selectedPaperForDetailLocal, setSelectedPaperForDetailLocal] = useState<string | null>(
    null,
  )

  const loadRdqQuestions = useCallback(async () => {
    setLoadingRdq(true)
    try {
      const res = await randomDrawQuestionApi.list({ limit: 9999 })
      setRdqApiQuestions(res.items || [])
    } catch (err) {
      reportError(err, { source: '加载现场问答题列表' })
    } finally {
      setLoadingRdq(false)
    }
  }, [])

  const loadMajors = useCallback(async () => {
    try {
      const res = await majorApi.list({ limit: 1000 })
      setMajors((res.items || []).map((m: any) => ({ id: m.id, name: m.name })))
    } catch (err) {
      reportError(err, { source: '加载专业列表' })
    }
  }, [])

  const loadRubricTemplates = useCallback(async () => {
    try {
      const res = await taskEvaluationApi.listTemplates({ limit: 200 }).catch((err) => {
        reportError(err, { source: '加载评价标准模板列表' })
        return { items: [] as any[], total: 0 }
      })
      setRubricLibrary(
        (res.items || []).map((t: any) => ({
          id: t.id,
          name: t.name,
          types: t.types || [],
          desc: t.description || '',
          points: (t.data?.points || []).map((p: any) => ({
            id: p.id || uid('ep'),
            name: p.name,
            desc: p.description || '',
            subType: p.types?.[0],
            types: p.types || [],
            knowledgePointIds: p.knowledgePointIds || [],
            abilityPointIds: p.abilityPointIds || [],
            scoringMethod: p.scoringMethod || 'level',
            gradeMapping: p.gradeMapping || [],
            weight: p.weight || 0,
          })),
          mode: t.mode || 'rubric',
          scoreRuleItems: t.data?.scoreRuleItems || [],
        })),
      )
    } catch (err) {
      reportError(err, { source: '解析评价标准模板' })
    }
  }, [])

  const handleCreateRdq = useCallback(async () => {
    if (!newRdqForm.name.trim()) return
    try {
      if (rdqActionMode === 'edit' && rdqActionTarget) {
        await randomDrawQuestionApi.update(rdqActionTarget.id, {
          name: newRdqForm.name.trim(),
          description: newRdqForm.description.trim() || undefined,
          answer: newRdqForm.answer.trim() || undefined,
          majorId: newRdqForm.majorId || undefined,
        } as any)
      } else {
        await randomDrawQuestionApi.create({
          name: newRdqForm.name.trim(),
          description: newRdqForm.description.trim() || undefined,
          answer: newRdqForm.answer.trim() || undefined,
          majorId: newRdqForm.majorId || undefined,
        } as any)
      }
      await loadRdqQuestions()
    } catch (err) {
      reportError(err, { source: '保存现场问答题' })
      toast({ variant: 'destructive', title: '保存失败', description: '现场问答题保存失败' })
    }
    setRdqActionOpen(false)
    setRdqSearch('')
  }, [newRdqForm, rdqActionMode, rdqActionTarget, loadRdqQuestions, toast])

  const handleDeleteRdq = useCallback(
    async (id: string) => {
      try {
        await randomDrawQuestionApi.delete(id)
        updateConfig({
          randomDrawSelectedIds: config.randomDrawSelectedIds.filter((sid: string) => sid !== id),
        })
        await loadRdqQuestions()
      } catch (err) {
        reportError(err, { source: '删除现场问答题' })
        toast({ variant: 'destructive', title: '删除失败', description: '现场问答题删除失败' })
      }
    },
    [config.randomDrawSelectedIds, updateConfig, loadRdqQuestions, toast],
  )

  const loadPapers = useCallback(async () => {
    if (getLoadedExams().length > 0) return
    setLoadingPapers(true)
    try {
      const res = await examApi.list({ limit: 1000 })
      setLoadedExams((res.items || []) as LoadedExam[])
    } catch (err) {
      reportError(err, { source: '加载试卷列表' })
    } finally {
      setLoadingPapers(false)
    }
  }, [])

  // Mount 时预加载一次依赖数据；在微任务回调中触发加载，避免在 effect 体内同步 setState
  useEffect(() => {
    Promise.resolve().then(() => {
      loadPapers()
      loadRdqQuestions()
      loadMajors()
      loadRubricTemplates()
    })
  }, [loadPapers, loadRdqQuestions, loadMajors, loadRubricTemplates])

  const majorOptions = useMemo(
    () => [{ id: '全部', name: '全部' }, ...majors.map((m: any) => ({ id: m.id, name: m.name }))],
    [majors],
  )
  const majorNameMap = useMemo(() => {
    const map: Record<string, string> = {}
    majors.forEach((m: any) => {
      map[m.id] = m.name
    })
    return map
  }, [majors])

  const handleCreatePaper = useCallback(
    async (data: any) => {
      try {
        const created = await examApi.create(data as any)
        addLoadedExam(created as LoadedExam)
        updateConfig({ paperIds: [created.id], paperWeights: { [created.id]: 100 } })
      } catch (err) {
        reportError(err, { source: '创建试卷' })
        toast({ variant: 'destructive', title: '创建失败', description: '创建试卷失败' })
      }
    },
    [updateConfig, toast],
  )

  const mockResReview = getResourceConfig('review', {
    requiresMaterial: true,
    deadlineDays: 3,
    submitFormatDesc: '',
    venueResources: '',
    allowResubmit: false,
  })
  const setMockResReview = useCallback(
    (updates: Partial<typeof mockResReview>) => updateResourceConfig('review', updates),
    [updateResourceConfig],
  )

  const mockResQuestionBank = getResourceConfig('question_bank', {
    timeLimit: 30,
    allowRetake: true,
    retakeCount: 3,
    shuffleQuestions: true,
    showResult: true,
    activationMode: 'always' as string,
    scheduledTime: '',
    scheduledEndTime: '',
    questionScores: {} as Record<string, number>,
  })
  const setMockResQuestionBank = useCallback(
    (updates: Partial<typeof mockResQuestionBank>) =>
      updateResourceConfig('question_bank', updates),
    [updateResourceConfig],
  )

  const mockResOutcome = getResourceConfig('outcome', {
    requiresMaterial: true,
    deadlineDays: 3,
    submitFormatDesc: '',
    venueResources: '',
    allowResubmit: false,
  })
  const setMockResOutcome = useCallback(
    (updates: Partial<typeof mockResOutcome>) => updateResourceConfig('outcome', updates),
    [updateResourceConfig],
  )

  const mockResHomework = getResourceConfig('homework', {
    requiresMaterial: true,
    deadlineDays: 3,
    submitFormatDesc: '',
    venueResources: '',
    allowResubmit: false,
  })
  const setMockResHomework = useCallback(
    (updates: Partial<typeof mockResHomework>) => updateResourceConfig('homework', updates),
    [updateResourceConfig],
  )

  const mockResQuiz = getResourceConfig('quiz', {
    timeLimit: 30,
    allowRetake: true,
    retakeCount: 3,
    shuffleQuestions: true,
    showResult: true,
    activationMode: 'always' as string,
    scheduledTime: '',
    scheduledEndTime: '',
    questionScores: {} as Record<string, number>,
  })
  const setMockResQuiz = useCallback(
    (updates: Partial<typeof mockResQuiz>) => updateResourceConfig('quiz', updates),
    [updateResourceConfig],
  )

  // ============ Helpers ============
  const getMethodInstances = () => {
    const instances: { methodKey: string; instanceIndex: number }[] = []
    config.evaluationMethods.forEach((methodKey) => {
      const count = methodInstanceCounts[methodKey] || 1
      for (let i = 0; i < count; i++) instances.push({ methodKey, instanceIndex: i })
    })
    return instances
  }

  const subjectLabels: Record<string, string> = {
    teacher: '教师',
    enterprise_mentor: '企业导师',
    self: '自评',
    peer: '互评',
    ai: 'AI 评价',
    service_target: '服务对象',
  }

  const getMethodConfigSummary = (methodKey: string) => {
    const titleMap: Record<string, string> = {
      random_draw: '现场问答',
      review: '现场评审',
      paper: '试卷',
      question_bank: '题库',
      outcome: '成果评价',
      homework: '作业',
      quiz: '随堂测',
    }
    const hasResourceContent = (methodKey: string) => {
      const res = (config.methodResourceConfigs || {})[methodKey]
      return !!res && typeof res === 'object' && Object.keys(res).length > 0
    }
    const configured = (() => {
      switch (methodKey) {
        case 'random_draw':
          return config.randomDrawSelectedIds.length > 0
        case 'review':
          return (
            config.reviewEvalPoints.length > 0 ||
            !!config.reviewRubricId ||
            (config.reviewScoreRules?.length || 0) > 0 ||
            hasResourceContent('review')
          )
        case 'paper':
          return config.paperIds.length > 0
        case 'question_bank':
          return config.questionBankQuestions.length > 0
        case 'outcome':
          return (
            config.outcomeEvalPoints.length > 0 ||
            !!config.outcomeRubricId ||
            (config.outcomeScoreRules?.length || 0) > 0 ||
            hasResourceContent('outcome')
          )
        case 'homework':
          return (
            config.homeworkEvalPoints.length > 0 ||
            !!config.homeworkRubricId ||
            (config.homeworkScoreRules?.length || 0) > 0 ||
            hasResourceContent('homework')
          )
        case 'quiz':
          return config.quizQuestions.length > 0
        default:
          return false
      }
    })()
    return {
      title: titleMap[methodKey] || '',
      summary: configured ? '已配置' : '未配置',
      configured,
    }
  }

  // 评价主体取值：methodEvalSubjects 中的空数组视为未配置，逐级回退到全局默认主体
  const getMethodSubjects = (methodKey: string) => {
    const ms = config.methodEvalSubjects[methodKey]
    if (ms && ms.length > 0) return ms
    return config.evalSubjects && config.evalSubjects.length > 0
      ? config.evalSubjects
      : defaultEvalSubjects
  }

  const updateMethodEvalSubject = (
    methodKey: string,
    idx: number,
    updates: Partial<EvalRuleSubjectConfig>,
  ) => {
    const baseSubjects = getMethodSubjects(methodKey)
    const newSubjects = [...baseSubjects]
    newSubjects[idx] = { ...newSubjects[idx], ...updates }
    updateConfig({ methodEvalSubjects: { ...config.methodEvalSubjects, [methodKey]: newSubjects } })
  }

  type EvalPointField =
    | 'randomDrawEvalPoints'
    | 'reviewEvalPoints'
    | 'paperEvalPoints'
    | 'questionBankEvalPoints'
    | 'outcomeEvalPoints'
    | 'homeworkEvalPoints'
    | 'quizEvalPoints'

  const getEvalPoints = (field: EvalPointField) => {
    switch (field) {
      case 'randomDrawEvalPoints':
        return config.randomDrawEvalPoints
      case 'reviewEvalPoints':
        return config.reviewEvalPoints
      case 'paperEvalPoints':
        return config.paperEvalPoints
      case 'questionBankEvalPoints':
        return config.questionBankEvalPoints
      case 'outcomeEvalPoints':
        return config.outcomeEvalPoints
      case 'homeworkEvalPoints':
        return config.homeworkEvalPoints
      case 'quizEvalPoints':
        return config.quizEvalPoints
    }
  }

  const setEvalPoints = (field: EvalPointField, points: EvalPoint[]) => {
    switch (field) {
      case 'randomDrawEvalPoints':
        updateConfig({ randomDrawEvalPoints: points })
        break
      case 'reviewEvalPoints':
        updateConfig({ reviewEvalPoints: points })
        break
      case 'paperEvalPoints':
        updateConfig({ paperEvalPoints: points })
        break
      case 'questionBankEvalPoints':
        updateConfig({ questionBankEvalPoints: points })
        break
      case 'outcomeEvalPoints':
        updateConfig({ outcomeEvalPoints: points })
        break
      case 'homeworkEvalPoints':
        updateConfig({ homeworkEvalPoints: points })
        break
      case 'quizEvalPoints':
        updateConfig({ quizEvalPoints: points })
        break
    }
  }

  const addEvalPoint = (field: EvalPointField, preset?: Partial<EvalPoint>) => {
    const name = preset ? (preset.name ?? newPointName.trim()) : newPointName.trim()
    if (!name && !preset) return
    const newPoint: EvalPoint = {
      id: uid('ep'),
      name: name || '未命名评价点',
      desc: preset?.desc || '',
      subType: preset?.subType,
      types: preset?.types,
      knowledgePointIds: preset?.knowledgePointIds,
      abilityPointIds: preset?.abilityPointIds,
      scoringMethod: preset?.scoringMethod || 'level',
      gradeMapping:
        preset?.gradeMapping !== undefined
          ? preset.gradeMapping
          : preset?.name === ''
            ? []
            : JSON.parse(JSON.stringify(defaultGradeMapping)),
    }
    setEvalPoints(field, [...getEvalPoints(field), newPoint])
    setNewPointName('')
  }

  const removeEvalPoint = (field: EvalPointField, id: string) => {
    setEvalPoints(
      field,
      getEvalPoints(field).filter((p) => p.id !== id),
    )
  }

  const updateEvalPoint = (field: EvalPointField, id: string, updates: Partial<EvalPoint>) => {
    setEvalPoints(
      field,
      getEvalPoints(field).map((p) => (p.id === id ? { ...p, ...updates } : p)),
    )
  }

  const toggleQuestion = (
    qid: string,
    field: 'randomDrawQuestions' | 'questionBankQuestions' | 'quizQuestions',
  ) => {
    const arr =
      field === 'randomDrawQuestions'
        ? config.randomDrawQuestions
        : field === 'quizQuestions'
          ? config.quizQuestions
          : config.questionBankQuestions
    const exists = arr.includes(qid)
    const newArr = exists ? arr.filter((x) => x !== qid) : [...arr, qid]
    if (field === 'randomDrawQuestions') updateConfig({ randomDrawQuestions: newArr })
    else if (field === 'quizQuestions') updateConfig({ quizQuestions: newArr })
    else updateConfig({ questionBankQuestions: newArr })
  }

  const openDialog = (type: 'object' | 'subject' | 'resource' | 'method', methodKey: string) => {
    setErDialogMethod(methodKey)
    setErDialogOpen(type)
    if (type === 'method') {
      const nameField =
        methodKey === 'random_draw'
          ? 'randomDrawStandardName'
          : methodKey === 'review'
            ? 'reviewStandardName'
            : methodKey === 'outcome'
              ? 'outcomeStandardName'
              : 'homeworkStandardName'
      const modeField =
        methodKey === 'random_draw'
          ? 'randomDrawStandardMode'
          : methodKey === 'review'
            ? 'reviewStandardMode'
            : methodKey === 'outcome'
              ? 'outcomeStandardMode'
              : 'homeworkStandardMode'
      setStdDraft({
        name: ((config as any)[nameField] as string) || '',
        mode: ((config as any)[modeField] as 'rubric' | 'score_rule') || 'rubric',
      })
    }
  }

  const methodWeightTotal = config.evaluationMethods.reduce(
    (sum, m) => sum + (config.methodWeights[m] || 0),
    0,
  )

  const updateMethodWeight = (methodKey: string, value: number) => {
    updateConfig({
      methodWeights: { ...config.methodWeights, [methodKey]: Math.max(0, Math.min(100, value)) },
    })
  }

  const distributeMethodWeights = () => {
    const count = config.evaluationMethods.length
    if (count === 0) return
    const base = Math.floor(100 / count)
    const remainder = 100 % count
    const newWeights: Record<string, number> = {}
    config.evaluationMethods.forEach((m, i) => {
      newWeights[m] = base + (i < remainder ? 1 : 0)
    })
    updateConfig({ methodWeights: newWeights })
  }

  const moveMethodUp = (index: number) => {
    if (index <= 0) return
    const newMethods = [...config.evaluationMethods]
    const temp = newMethods[index]
    newMethods[index] = newMethods[index - 1]
    newMethods[index - 1] = temp
    updateConfig({ evaluationMethods: newMethods })
  }

  const moveMethodDown = (index: number) => {
    if (index >= config.evaluationMethods.length - 1) return
    const newMethods = [...config.evaluationMethods]
    const temp = newMethods[index]
    newMethods[index] = newMethods[index + 1]
    newMethods[index + 1] = temp
    updateConfig({ evaluationMethods: newMethods })
  }

  // ============ Sub components ============

  const openRubricKpDialog = (pointId: string, field: EvalPointField) => {
    setRubricKpTargetPointId(pointId)
    setRubricKpTargetField(field)
    setRubricKpSearch('')
    setRubricKpDialogOpen(true)
  }

  const openRubricAbDialog = (pointId: string, field: EvalPointField) => {
    setRubricAbTargetPointId(pointId)
    setRubricAbTargetField(field)
    setRubricAbSearch('')
    setRubricAbDialogOpen(true)
  }

  const evalResourceOnlyPanel = erDialogMethod
    ? (() => {
        if (erDialogMethod === 'random_draw') {
          const filteredRdq = rdqApiQuestions.filter((q) => {
            const matchMajor = rdqMajorTab === '全部' || q.majorId === rdqMajorTab
            const matchSearch =
              !rdqSearch ||
              (q.name || '').includes(rdqSearch) ||
              (q.description || '').includes(rdqSearch) ||
              (q.majorName || '').includes(rdqSearch)
            return matchMajor && matchSearch
          })
          const handleAddRdqLocal = () => {
            setNewRdqForm({ name: '', description: '', answer: '', majorId: '' })
            setRdqActionMode('add')
            setRdqActionTarget(null)
            setRdqActionOpen(true)
          }
          const handleEditRdqLocal = (q: any) => {
            setNewRdqForm({
              name: q.name,
              description: q.description || '',
              answer: q.answer || '',
              majorId: q.majorId || '',
            })
            setRdqActionMode('edit')
            setRdqActionTarget({
              id: q.id,
              name: q.name,
              description: q.description || '',
              answer: q.answer || '',
              majorId: q.majorId || '',
            })
            setRdqActionOpen(true)
          }
          const handleToggleSelect = (id: string) => {
            const isSelected = config.randomDrawSelectedIds.includes(id)
            updateConfig({
              randomDrawSelectedIds: isSelected
                ? config.randomDrawSelectedIds.filter((sid) => sid !== id)
                : [...config.randomDrawSelectedIds, id],
            })
          }
          const selectedRdqList = config.randomDrawSelectedIds
            .map((id) => rdqApiQuestions.find((q) => q.id === id))
            .filter(Boolean)
          const submitFormatDesc =
            (getResourceConfig('random_draw', {}) as any).submitFormatDesc || ''
          const venueResources = (getResourceConfig('random_draw', {}) as any).venueResources || ''

          return (
            <div className="flex flex-col">
              <div className="flex items-center gap-3 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    value={rdqSearch}
                    onChange={(e) => setRdqSearch(e.target.value)}
                    placeholder="搜索现场问答题名称、描述或适用专业..."
                    className="pl-9"
                  />
                </div>
                <Button onClick={handleAddRdqLocal}>
                  <Plus className="h-4 w-4 mr-1" />
                  新增现场问答题
                </Button>
              </div>
              <div className="flex gap-4 max-lg:flex-col">
                <div className="w-full lg:w-3/5 flex flex-col border rounded-xl p-3">
                  <div className="flex items-center gap-1 mb-2 flex-wrap">
                    {majorOptions.map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => setRdqMajorTab(opt.id)}
                        className={cn(
                          'px-2.5 py-1 rounded-md text-[11px] transition-all',
                          rdqMajorTab === opt.id
                            ? 'bg-primary/10 text-primary font-medium'
                            : 'text-gray-500 hover:bg-gray-100',
                        )}
                      >
                        {opt.name}
                      </button>
                    ))}
                  </div>
                  <p className="text-sm font-medium mb-2 text-gray-700">
                    {rdqSearch
                      ? `搜索结果 (${filteredRdq.length})`
                      : rdqMajorTab === '全部'
                        ? '全部现场问答题'
                        : `${majorNameMap[rdqMajorTab] || rdqMajorTab}相关现场问答题`}
                  </p>
                  <div className="min-h-[200px] max-h-[400px] overflow-y-auto pr-1">
                    {loadingRdq ? (
                      <div className="text-center text-gray-400 py-8">
                        <p className="text-sm">加载中...</p>
                      </div>
                    ) : filteredRdq.length === 0 ? (
                      <div className="text-center text-gray-400 py-8">
                        <FileQuestion className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">
                          {rdqSearch
                            ? '未找到匹配的现场问答题'
                            : '暂无现场问答题，请点击上方按钮新增'}
                        </p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm min-w-[560px]">
                          <thead className="bg-gray-50 sticky top-0 z-10">
                            <tr>
                              <th className="text-left text-xs font-medium text-gray-500 px-3 py-2 w-[26%]">
                                题目名称
                              </th>
                              <th className="text-left text-xs font-medium text-gray-500 px-3 py-2 w-[30%]">
                                题目描述
                              </th>
                              <th className="text-left text-xs font-medium text-gray-500 px-3 py-2 w-[14%]">
                                适用专业
                              </th>
                              <th className="text-right text-xs font-medium text-gray-500 px-3 py-2 w-[30%]">
                                操作
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {filteredRdq.map((q) => {
                              const isSelected = config.randomDrawSelectedIds.includes(q.id)
                              return (
                                <tr
                                  key={q.id}
                                  className={cn(
                                    'hover:bg-gray-50 transition-colors',
                                    isSelected ? 'bg-primary/[0.03]' : '',
                                  )}
                                >
                                  <td className="px-3 py-2">
                                    <span className="text-sm font-medium text-gray-800">
                                      {q.name}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2">
                                    <p
                                      className="text-xs text-gray-500 line-clamp-1"
                                      title={q.description}
                                    >
                                      {q.description || '-'}
                                    </p>
                                  </td>
                                  <td className="px-3 py-2">
                                    <Badge variant="secondary" className="text-[10px]">
                                      {q.majorName || '-'}
                                    </Badge>
                                  </td>
                                  <td className="px-3 py-2">
                                    <div className="flex items-center justify-end gap-1">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 text-[11px] px-1.5 text-gray-500 hover:text-primary"
                                        onClick={() => {
                                          setSelectedRdqForDetail(q.id)
                                          setRdqDetailOpen(true)
                                        }}
                                      >
                                        详情
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 text-[11px] px-1.5 text-gray-500 hover:text-primary"
                                        onClick={() => handleEditRdqLocal(q)}
                                      >
                                        编辑
                                      </Button>
                                      {isSelected ? (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-6 text-[11px] px-2"
                                          onClick={() => handleToggleSelect(q.id)}
                                        >
                                          取消
                                        </Button>
                                      ) : (
                                        <Button
                                          size="sm"
                                          className="h-6 text-[11px] px-2"
                                          onClick={() => handleToggleSelect(q.id)}
                                        >
                                          选择
                                        </Button>
                                      )}
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 text-[11px] px-1.5 text-red-400 hover:text-red-600"
                                        onClick={() => handleDeleteRdq(q.id)}
                                      >
                                        删除
                                      </Button>
                                    </div>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
                <div className="w-full lg:w-2/5 border rounded-xl p-3 flex flex-col">
                  <p className="text-sm font-medium mb-3 text-gray-700">
                    已配置现场问答题 ({selectedRdqList.length})
                  </p>
                  <div className="min-h-[200px] max-h-[400px] overflow-y-auto">
                    {selectedRdqList.length === 0 ? (
                      <div className="text-center text-gray-400 py-8">
                        <FileQuestion className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-xs">请从左侧选择现场问答题</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {selectedRdqList.map((q) => (
                          <div
                            key={q.id}
                            className="p-2.5 rounded-lg border border-primary/20 bg-primary/5 relative"
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-medium flex-1 truncate">{q.name}</span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 text-gray-400 -mr-1 -mt-1"
                                onClick={() => handleToggleSelect(q.id)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                            <p className="text-[11px] text-gray-500 line-clamp-1">
                              {q.description || '暂无描述'}
                            </p>
                            <Badge
                              variant="outline"
                              className="text-[9px] mt-1 font-normal px-1 py-0 h-4"
                            >
                              {q.majorName || '通用'}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="border rounded-xl p-4 mt-4">
                <p className="text-sm font-medium mb-3">抽题规则</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FormFieldRow label="抽题方式" labelClassName="text-xs text-gray-500">
                    <Select
                      value={(getResourceConfig('random_draw', {}) as any).drawMode ?? 'random'}
                      onValueChange={(v) => updateResourceConfig('random_draw', { drawMode: v })}
                    >
                      <SelectTrigger className="text-sm h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="random">系统随机分配</SelectItem>
                        <SelectItem value="manual">老师手动选择</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormFieldRow>
                  <FormFieldRow label="抽题数量" labelClassName="text-xs text-gray-500">
                    <Input
                      type="number"
                      value={(getResourceConfig('random_draw', {}) as any).drawCount ?? 5}
                      onChange={(e) =>
                        updateResourceConfig('random_draw', {
                          drawCount: Math.max(1, parseInt(e.target.value) || 1),
                        })
                      }
                      className="text-sm"
                      min={1}
                    />
                  </FormFieldRow>
                </div>
              </div>
              <div className="border rounded-xl p-4 mt-4">
                <p className="text-sm font-medium mb-3">现场要求</p>
                <div className="space-y-3">
                  <FormFieldRow label="提交材料要求" labelClassName="text-xs text-gray-500">
                    <Textarea
                      value={submitFormatDesc}
                      onChange={(e) =>
                        updateResourceConfig('random_draw', { submitFormatDesc: e.target.value })
                      }
                      placeholder="请用一句话说明学生需要准备的材料要求..."
                      rows={4}
                      className="text-sm"
                    />
                  </FormFieldRow>
                  <FormFieldRow
                    label="现场场地/环境资源准备"
                    labelClassName="text-xs text-gray-500"
                  >
                    <Textarea
                      value={venueResources}
                      onChange={(e) =>
                        updateResourceConfig('random_draw', { venueResources: e.target.value })
                      }
                      placeholder="请描述现场问答所需的场地、设备及环境资源准备要求..."
                      rows={4}
                      className="text-sm"
                    />
                  </FormFieldRow>
                </div>
              </div>
              <Dialog open={rdqActionOpen} onOpenChange={setRdqActionOpen}>
                <DialogContent className="sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle>
                      {rdqActionMode === 'add' ? '新增现场问答题' : '编辑现场问答题'}
                    </DialogTitle>
                    <DialogDescription>
                      {rdqActionMode === 'add' ? '创建一个新的现场问答题' : '修改现场问答题信息'}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <FormFieldRow label="题目名称">
                      <Input
                        value={newRdqForm.name}
                        onChange={(e) => setNewRdqForm({ ...newRdqForm, name: e.target.value })}
                        placeholder="输入题目名称"
                      />
                    </FormFieldRow>
                    <FormFieldRow label="适用专业">
                      <Select
                        value={newRdqForm.majorId}
                        onValueChange={(v) => setNewRdqForm({ ...newRdqForm, majorId: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="选择适用专业" />
                        </SelectTrigger>
                        <SelectContent>
                          {majors.map((m: any) => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormFieldRow>
                    <FormFieldRow label="题目描述">
                      <Textarea
                        value={newRdqForm.description}
                        onChange={(e) =>
                          setNewRdqForm({ ...newRdqForm, description: e.target.value })
                        }
                        placeholder="输入题目描述"
                        rows={3}
                      />
                    </FormFieldRow>
                    <FormFieldRow label="题目答案">
                      <Textarea
                        value={newRdqForm.answer}
                        onChange={(e) => setNewRdqForm({ ...newRdqForm, answer: e.target.value })}
                        placeholder="输入题目答案"
                        rows={3}
                      />
                    </FormFieldRow>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setRdqActionOpen(false)}>
                      取消
                    </Button>
                    <Button onClick={handleCreateRdq} disabled={!newRdqForm.name.trim()}>
                      {rdqActionMode === 'add' ? '新增' : '保存修改'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Dialog open={rdqDetailOpen} onOpenChange={setRdqDetailOpen}>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>现场问答题详情</DialogTitle>
                  </DialogHeader>
                  {(() => {
                    const q = rdqApiQuestions.find((x) => x.id === selectedRdqForDetail)
                    if (!q) return null
                    return (
                      <div className="space-y-4 py-2">
                        <div>
                          <Label className="text-xs text-gray-500">题目名称</Label>
                          <p className="text-sm font-medium mt-1">{q.name}</p>
                        </div>
                        <div>
                          <Label className="text-xs text-gray-500">适用专业</Label>
                          <Badge variant="secondary" className="text-[10px] mt-1">
                            {q.majorName || '通用'}
                          </Badge>
                        </div>
                        <div>
                          <Label className="text-xs text-gray-500">题目描述</Label>
                          <p className="text-sm mt-1 text-gray-700 whitespace-pre-wrap">
                            {q.description || '-'}
                          </p>
                        </div>
                        <div>
                          <Label className="text-xs text-gray-500">题目答案</Label>
                          <p className="text-sm mt-1 text-gray-700 whitespace-pre-wrap">
                            {q.answer || '-'}
                          </p>
                        </div>
                      </div>
                    )
                  })()}
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setRdqDetailOpen(false)}>
                      关闭
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          )
        }
        if (erDialogMethod === 'review') {
          return (
            <div className="space-y-4">
              <div className="p-4 bg-amber-50 rounded-lg border border-amber-100 text-sm text-amber-700">
                <div className="flex items-center gap-2 mb-2">
                  <Info className="h-4 w-4" />
                  <span className="font-medium">评审说明</span>
                </div>
                <p>
                  评审时教师根据学生现场表现或提交的材料进行打分。评价点配置请在「评价标准配置」卡片中设置。
                </p>
              </div>
              <div className="border rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium">评审材料要求</p>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={mockResReview.requiresMaterial}
                      onCheckedChange={(v) =>
                        setMockResReview({ ...mockResReview, requiresMaterial: v })
                      }
                    />
                    <span className="text-xs text-gray-600">是否需要提交评审材料</span>
                  </div>
                </div>
                {mockResReview.requiresMaterial && (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <FormFieldRow label="预估提交天数" labelClassName="text-xs text-gray-500">
                        <Input
                          type="number"
                          value={mockResReview.deadlineDays}
                          onChange={(e) =>
                            setMockResReview({
                              ...mockResReview,
                              deadlineDays: Math.max(1, parseInt(e.target.value) || 1),
                            })
                          }
                          className="text-sm"
                          min={1}
                        />
                      </FormFieldRow>
                    </div>
                    <FormFieldRow
                      label="提交材料要求"
                      labelClassName="text-xs text-gray-500"
                      className="mt-3"
                    >
                      <Textarea
                        value={mockResReview.submitFormatDesc}
                        onChange={(e) =>
                          setMockResReview({ ...mockResReview, submitFormatDesc: e.target.value })
                        }
                        placeholder="请用一句话说明学生需要提交的材料要求..."
                        rows={2}
                        className="text-sm"
                      />
                    </FormFieldRow>
                  </>
                )}
                <FormFieldRow
                  label="评审场地/环境资源准备"
                  labelClassName="text-xs text-gray-500"
                  className="mt-3"
                >
                  <Textarea
                    value={mockResReview.venueResources}
                    onChange={(e) =>
                      setMockResReview({ ...mockResReview, venueResources: e.target.value })
                    }
                    placeholder="请描述评审所需的场地、设备及环境资源准备要求..."
                    rows={2}
                    className="text-sm"
                  />
                </FormFieldRow>
                <div className="mt-3">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={mockResReview.allowResubmit}
                      onCheckedChange={(v) =>
                        setMockResReview({ ...mockResReview, allowResubmit: v })
                      }
                    />
                    <span className="text-xs text-gray-600">允许重新提交</span>
                  </div>
                </div>
              </div>
              <div className="border rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-medium">评审流程设置</p>
                    {(() => {
                      const enabledSteps = reviewSteps.filter((s) => s.enabled)
                      const totalWeight = enabledSteps.reduce((sum, s) => sum + (s.weight || 0), 0)
                      return (
                        enabledSteps.length > 0 && (
                          <div
                            className={cn(
                              'flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full font-medium',
                              totalWeight === 100
                                ? 'bg-green-50 text-green-600'
                                : 'bg-red-50 text-red-600',
                            )}
                          >
                            <span>权重合计 {totalWeight}%</span>
                            {totalWeight !== 100 && (
                              <span className="text-[10px]">(需等于100%)</span>
                            )}
                          </div>
                        )
                      )
                    })()}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-8"
                      onClick={() => {
                        const enabled = reviewSteps.filter((s) => s.enabled)
                        const count = enabled.length
                        if (count === 0) return
                        const base = Math.floor(100 / count)
                        const remainder = 100 % count
                        const newSteps = reviewSteps.map((s) =>
                          !s.enabled
                            ? s
                            : {
                                ...s,
                                weight:
                                  base +
                                  (enabled.findIndex((e) => e.id === s.id) < remainder ? 1 : 0),
                              },
                        )
                        setReviewStepsAndSync(newSteps)
                      }}
                    >
                      <RotateCcw className="h-3.5 w-3.5 mr-1" />
                      一键平均权重
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-8"
                      onClick={() => {
                        setShowAddStep(true)
                        setNewStepLabel('')
                        setNewStepDesc('')
                      }}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      新增步骤
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  {reviewSteps.map((step) => (
                    <div key={step.id} className="p-3 rounded-lg border">
                      {editingReviewStepId === step.id ? (
                        <div className="space-y-2">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <Input
                              value={editingStepLabel}
                              onChange={(e) => setEditingStepLabel(e.target.value)}
                              placeholder="步骤名称"
                              className="text-sm h-8"
                            />
                            <Select
                              value={step.subjectType || ''}
                              onValueChange={(v) =>
                                setReviewStepsAndSync(
                                  reviewSteps.map((s) =>
                                    s.id === step.id ? { ...s, subjectType: v } : s,
                                  ),
                                )
                              }
                            >
                              <SelectTrigger className="text-sm h-8">
                                <SelectValue placeholder="请选择评价主体" />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(subjectLabels).map(([k, label]) => (
                                  <SelectItem key={k} value={k}>
                                    {label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <Input
                            value={editingStepDesc}
                            onChange={(e) => setEditingStepDesc(e.target.value)}
                            placeholder="步骤描述"
                            className="text-sm h-8"
                          />
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => {
                                setReviewStepsAndSync(
                                  reviewSteps.map((s) =>
                                    s.id === step.id
                                      ? {
                                          ...s,
                                          label: editingStepLabel || s.label,
                                          desc: editingStepDesc || s.desc,
                                        }
                                      : s,
                                  ),
                                )
                                setEditingReviewStepId(null)
                              }}
                            >
                              保存
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => setEditingReviewStepId(null)}
                            >
                              取消
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={step.enabled}
                                onCheckedChange={(v) => {
                                  if (v && !step.subjectType)
                                    setReviewStepsAndSync(
                                      reviewSteps.map((s) =>
                                        s.id === step.id
                                          ? { ...s, enabled: v, subjectType: 'teacher' }
                                          : s,
                                      ),
                                    )
                                  else
                                    setReviewStepsAndSync(
                                      reviewSteps.map((s) =>
                                        s.id === step.id ? { ...s, enabled: v } : s,
                                      ),
                                    )
                                }}
                              />
                              <div>
                                <p className="text-sm font-medium">{step.label}</p>
                                <p className="text-xs text-gray-400">{step.desc}</p>
                              </div>
                            </div>
                            <Badge
                              variant={step.subjectType ? 'secondary' : 'outline'}
                              className="text-[10px]"
                            >
                              {step.subjectType
                                ? subjectLabels[step.subjectType] || step.subjectType
                                : '未绑定'}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            {step.enabled && (
                              <div className="flex items-center gap-1">
                                <Input
                                  type="number"
                                  value={step.weight || 0}
                                  onChange={(e) =>
                                    setReviewStepsAndSync(
                                      reviewSteps.map((s) =>
                                        s.id === step.id
                                          ? {
                                              ...s,
                                              weight: Math.max(
                                                0,
                                                Math.min(100, parseInt(e.target.value) || 0),
                                              ),
                                            }
                                          : s,
                                      ),
                                    )
                                  }
                                  className="h-7 text-xs w-14 text-center"
                                  min={0}
                                  max={100}
                                />
                                <span className="text-xs text-gray-400">%</span>
                              </div>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-[11px] px-1.5 text-gray-400 hover:text-primary"
                              onClick={() => {
                                setEditingReviewStepId(step.id)
                                setEditingStepLabel(step.label)
                                setEditingStepDesc(step.desc)
                              }}
                            >
                              <PenTool className="h-3 w-3" />
                            </Button>
                            {reviewSteps.length > 1 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 text-[11px] px-1.5 text-gray-400 hover:text-red-500"
                                onClick={() =>
                                  setReviewStepsAndSync(reviewSteps.filter((s) => s.id !== step.id))
                                }
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {showAddStep && (
                  <div className="mt-2 p-3 rounded-lg border border-dashed border-primary/30 bg-primary/[0.02] space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Input
                        value={newStepLabel}
                        onChange={(e) => setNewStepLabel(e.target.value)}
                        placeholder="步骤名称"
                        className="text-sm h-8"
                      />
                      <Select
                        value={newStepSubjectType}
                        onValueChange={(v) => setNewStepSubjectType(v)}
                      >
                        <SelectTrigger className="text-sm h-8">
                          <SelectValue placeholder="请选择评价主体" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(subjectLabels).map(([k, label]) => (
                            <SelectItem key={k} value={k}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Input
                      value={newStepDesc}
                      onChange={(e) => setNewStepDesc(e.target.value)}
                      placeholder="步骤描述"
                      className="text-sm h-8"
                    />
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => {
                          if (!newStepLabel.trim() || !newStepSubjectType) return
                          setReviewStepsAndSync([
                            ...reviewSteps,
                            {
                              id: uid('rs'),
                              label: newStepLabel,
                              desc: newStepDesc,
                              enabled: true,
                              subjectType: newStepSubjectType,
                              weight: 0,
                            },
                          ])
                          setShowAddStep(false)
                          setNewStepLabel('')
                          setNewStepDesc('')
                          setNewStepSubjectType('')
                        }}
                      >
                        添加
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => {
                          setShowAddStep(false)
                          setNewStepLabel('')
                          setNewStepDesc('')
                          setNewStepSubjectType('')
                        }}
                      >
                        取消
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        }
        if (erDialogMethod === 'paper') {
          const selectPaper = (paperId: string) => {
            updateConfig({ paperIds: [paperId], paperWeights: { [paperId]: 100 } })
          }
          const paperCfg = getResourceConfig('paper', {
            duration: 60,
            allowRetake: false,
            retakeCount: 1,
            shuffleQuestions: true,
            showResult: true,
            activationMode: 'manual' as string,
            scheduledTime: '',
            scheduledEndTime: '',
          })
          const setPaperCfg = (patch: Record<string, any>) => updateResourceConfig('paper', patch)
          return (
            <div className="space-y-4">
              <div className="border rounded-xl p-4">
                <p className="text-sm font-medium mb-3">选择已有试卷</p>
                <div className="flex items-center gap-3 mb-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      value={paperSearch}
                      onChange={(e) => setPaperSearch(e.target.value)}
                      placeholder="搜索试卷..."
                      className="pl-9"
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 text-xs"
                    onClick={() => {
                      setShowCreatePaperLocal(true)
                    }}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    新建试卷
                  </Button>
                </div>
                {loadingPapers ? (
                  <div className="text-center py-8 text-gray-400">加载中...</div>
                ) : (
                  <div className="space-y-2">
                    {getLoadedExams()
                      .filter((p) => !paperSearch || p.name.includes(paperSearch))
                      .map((paper) => {
                        const selected = config.paperIds.includes(paper.id)
                        const questionCount = paper.questions?.length ?? paper.questionCount ?? 0
                        const totalScore = paper.totalScore ?? 100
                        return (
                          <div
                            key={paper.id}
                            onClick={() => selectPaper(paper.id)}
                            className={cn(
                              'px-3 py-2 rounded-lg border cursor-pointer flex items-center gap-3',
                              selected ? 'border-primary bg-primary/5' : 'hover:border-gray-300',
                            )}
                          >
                            <div
                              className={cn(
                                'w-4 h-4 rounded-full border flex items-center justify-center shrink-0',
                                selected ? 'bg-primary border-primary' : 'border-gray-300',
                              )}
                            >
                              {selected && <div className="w-2 h-2 rounded-full bg-white" />}
                            </div>
                            <p className="text-sm font-medium flex-1 min-w-0 truncate">
                              {paper.name}
                            </p>
                            <Badge className="text-[10px] bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-50 shrink-0">
                              {questionCount} 题
                            </Badge>
                            <Badge className="text-[10px] bg-green-50 text-green-600 border-green-200 hover:bg-green-50 shrink-0">
                              总分 {totalScore}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-[11px] px-2 text-gray-400 hover:text-primary shrink-0"
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedPaperForDetailLocal(paper.id)
                                setPaperDetailOpenLocal(true)
                              }}
                            >
                              查看详情
                            </Button>
                          </div>
                        )
                      })}
                    {getLoadedExams().filter((p) => !paperSearch || p.name.includes(paperSearch))
                      .length === 0 &&
                      !paperSearch && (
                        <div className="text-center py-8 text-gray-400">
                          <Info className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">暂无可选试卷</p>
                          <p className="text-xs mt-1">请点击「新建试卷」创建试卷</p>
                        </div>
                      )}
                    {getLoadedExams().length > 0 &&
                      getLoadedExams().filter((p) => !paperSearch || p.name.includes(paperSearch))
                        .length === 0 && (
                        <div className="text-center py-8 text-gray-400">
                          <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">未找到匹配的试卷</p>
                        </div>
                      )}
                  </div>
                )}
              </div>
              <div className="border rounded-xl p-4">
                <p className="text-sm font-medium mb-3">考卷设置</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FormFieldRow label="考试时长（分钟）" labelClassName="text-xs text-gray-500">
                    <Input
                      type="number"
                      value={paperCfg.duration ?? 60}
                      onChange={(e) =>
                        setPaperCfg({ duration: Math.max(0, parseInt(e.target.value) || 0) })
                      }
                      className="text-sm"
                      min={0}
                    />
                  </FormFieldRow>
                  <div>
                    <Label className="text-xs text-gray-500">允许重考</Label>
                    <div className="mt-2 flex items-center gap-2">
                      <Switch
                        checked={paperCfg.allowRetake ?? false}
                        onCheckedChange={(v) => setPaperCfg({ allowRetake: v })}
                      />
                      <span className="text-xs text-gray-600">
                        {(paperCfg.allowRetake ?? false) ? '是' : '否'}
                      </span>
                    </div>
                  </div>
                  {(paperCfg.allowRetake ?? false) && (
                    <FormFieldRow label="最多重考次数" labelClassName="text-xs text-gray-500">
                      <Input
                        type="number"
                        value={paperCfg.retakeCount ?? 1}
                        onChange={(e) =>
                          setPaperCfg({ retakeCount: Math.max(1, parseInt(e.target.value) || 1) })
                        }
                        className="text-sm"
                        min={1}
                      />
                    </FormFieldRow>
                  )}
                </div>
                <div className="mt-3 flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={paperCfg.shuffleQuestions ?? true}
                      onCheckedChange={(v) => setPaperCfg({ shuffleQuestions: v })}
                    />
                    <span className="text-xs text-gray-600">题目乱序</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={paperCfg.showResult ?? true}
                      onCheckedChange={(v) => setPaperCfg({ showResult: v })}
                    />
                    <span className="text-xs text-gray-600">交卷后显示成绩</span>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t">
                  <ExamActivationConfig
                    value={paperCfg}
                    onChange={(updates) => setPaperCfg(updates)}
                  />
                </div>
              </div>
              <ExamFormDialog
                open={showCreatePaperLocal}
                onOpenChange={setShowCreatePaperLocal}
                onSubmit={handleCreatePaper}
              />
              <Dialog open={paperDetailOpenLocal} onOpenChange={setPaperDetailOpenLocal}>
                <DialogContent className="sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle>试卷详情</DialogTitle>
                  </DialogHeader>
                  {(() => {
                    const paper = getLoadedExams().find((e) => e.id === selectedPaperForDetailLocal)
                    if (!paper) return null
                    return (
                      <div className="space-y-3 py-2">
                        <div>
                          <Label className="text-xs text-gray-500">试卷名称</Label>
                          <p className="text-sm font-medium mt-1">{paper.name}</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <div>
                            <Label className="text-xs text-gray-500">题目数量</Label>
                            <p className="text-sm mt-1">
                              {paper.questions?.length ?? paper.questionCount ?? 0} 题
                            </p>
                          </div>
                          <div>
                            <Label className="text-xs text-gray-500">总分</Label>
                            <p className="text-sm mt-1">{paper.totalScore ?? 100} 分</p>
                          </div>
                        </div>
                      </div>
                    )
                  })()}
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setPaperDetailOpen(false)}>
                      关闭
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          )
        }
        if (erDialogMethod === 'question_bank') {
          return (
            <div className="space-y-4">
              <BankQuestionSelectorPanel
                field="questionBankQuestions"
                selectedIds={config.questionBankQuestions}
                onToggleQuestion={(qid) => toggleQuestion(qid, 'questionBankQuestions')}
                questionScores={
                  (getResourceConfig('question_bank', {}) as any).questionScores || {}
                }
                onUpdateQuestionScore={(qid, score) =>
                  updateResourceConfig('question_bank', {
                    questionScores: {
                      ...((getResourceConfig('question_bank', {}) as any).questionScores || {}),
                      [qid]: score,
                    },
                  })
                }
                onUpdateQuestionScores={(scores) =>
                  updateResourceConfig('question_bank', {
                    questionScores: {
                      ...((getResourceConfig('question_bank', {}) as any).questionScores || {}),
                      ...scores,
                    },
                  })
                }
              />
              <div className="border rounded-xl p-4">
                <p className="text-sm font-medium mb-3">答题规则</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FormFieldRow label="答题方式" labelClassName="text-xs text-gray-500">
                    <Select
                      value={qbDrawMode}
                      onValueChange={(v) => setQbDrawMode(v as 'all' | 'practice')}
                    >
                      <SelectTrigger className="text-sm h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">全部作答</SelectItem>
                        <SelectItem value="practice">自由刷题</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormFieldRow>
                  {qbDrawMode === 'practice' && (
                    <FormFieldRow
                      label="正确率（%）"
                      labelClassName="text-xs text-gray-500"
                      hint="超过正确率则得分 100，低于正确率得分 0"
                    >
                      <Input
                        type="number"
                        value={qbPassRate}
                        onChange={(e) =>
                          setQbPassRate(Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))
                        }
                        className="text-sm"
                        min={0}
                        max={100}
                      />
                    </FormFieldRow>
                  )}
                  <FormFieldRow label="时间限制（分钟）" labelClassName="text-xs text-gray-500">
                    <Input
                      type="number"
                      value={mockResQuestionBank.timeLimit}
                      onChange={(e) =>
                        setMockResQuestionBank({
                          ...mockResQuestionBank,
                          timeLimit: Math.max(5, parseInt(e.target.value) || 5),
                        })
                      }
                      className="text-sm"
                      min={5}
                    />
                  </FormFieldRow>
                </div>
                <div className="mt-3 flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={mockResQuestionBank.allowRetake}
                      onCheckedChange={(v) =>
                        setMockResQuestionBank({ ...mockResQuestionBank, allowRetake: v })
                      }
                    />
                    <span className="text-xs text-gray-600">允许重复测评</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={mockResQuestionBank.shuffleQuestions}
                      onCheckedChange={(v) =>
                        setMockResQuestionBank({ ...mockResQuestionBank, shuffleQuestions: v })
                      }
                    />
                    <span className="text-xs text-gray-600">题目乱序</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={mockResQuestionBank.showResult}
                      onCheckedChange={(v) =>
                        setMockResQuestionBank({ ...mockResQuestionBank, showResult: v })
                      }
                    />
                    <span className="text-xs text-gray-600">提交后展示成绩</span>
                  </div>
                </div>
                {mockResQuestionBank.allowRetake && (
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <FormFieldRow label="最多重考次数" labelClassName="text-xs text-gray-500">
                      <Input
                        type="number"
                        value={mockResQuestionBank.retakeCount}
                        onChange={(e) =>
                          setMockResQuestionBank({
                            ...mockResQuestionBank,
                            retakeCount: Math.max(1, parseInt(e.target.value) || 1),
                          })
                        }
                        className="text-sm"
                        min={1}
                      />
                    </FormFieldRow>
                  </div>
                )}
                <ExamActivationConfig
                  value={mockResQuestionBank}
                  onChange={(updates) => setMockResQuestionBank({ ...mockResQuestionBank, ...updates })}
                />
              </div>
            </div>
          )
        }
        if (erDialogMethod === 'outcome') {
          return (
            <div className="space-y-4">
              <div className="p-4 bg-cyan-50 rounded-lg border border-cyan-100 text-sm text-cyan-700">
                <div className="flex items-center gap-2 mb-2">
                  <Info className="h-4 w-4" />
                  <span className="font-medium">成果评价说明</span>
                </div>
                <p>
                  成果评价时教师根据学生提交的成果材料进行打分。评价点配置请在「评价标准配置」卡片中设置。
                </p>
              </div>
              <div className="border rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium">成果材料要求</p>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={mockResOutcome.requiresMaterial}
                      onCheckedChange={(v) =>
                        setMockResOutcome({ ...mockResOutcome, requiresMaterial: v })
                      }
                    />
                    <span className="text-xs text-gray-600">是否需要提交成果材料</span>
                  </div>
                </div>
                {mockResOutcome.requiresMaterial && (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <FormFieldRow label="预估提交天数" labelClassName="text-xs text-gray-500">
                        <Input
                          type="number"
                          value={mockResOutcome.deadlineDays}
                          onChange={(e) =>
                            setMockResOutcome({
                              ...mockResOutcome,
                              deadlineDays: Math.max(1, parseInt(e.target.value) || 1),
                            })
                          }
                          className="text-sm"
                          min={1}
                        />
                      </FormFieldRow>
                    </div>
                    <FormFieldRow
                      label="提交材料要求"
                      labelClassName="text-xs text-gray-500"
                      className="mt-3"
                    >
                      <Textarea
                        value={mockResOutcome.submitFormatDesc}
                        onChange={(e) =>
                          setMockResOutcome({ ...mockResOutcome, submitFormatDesc: e.target.value })
                        }
                        placeholder="请用一句话说明学生需要提交的成果材料要求..."
                        rows={2}
                        className="text-sm"
                      />
                    </FormFieldRow>
                  </>
                )}
                <FormFieldRow
                  label="评价场地/环境资源准备"
                  labelClassName="text-xs text-gray-500"
                  className="mt-3"
                >
                  <Textarea
                    value={mockResOutcome.venueResources}
                    onChange={(e) =>
                      setMockResOutcome({ ...mockResOutcome, venueResources: e.target.value })
                    }
                    placeholder="请描述评价所需的场地、设备及环境资源准备要求..."
                    rows={2}
                    className="text-sm"
                  />
                </FormFieldRow>
                <div className="mt-3">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={mockResOutcome.allowResubmit}
                      onCheckedChange={(v) =>
                        setMockResOutcome({ ...mockResOutcome, allowResubmit: v })
                      }
                    />
                    <span className="text-xs text-gray-600">允许重新提交</span>
                  </div>
                </div>
              </div>
            </div>
          )
        }
        if (erDialogMethod === 'homework') {
          return (
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-100 text-sm text-blue-700">
                <div className="flex items-center gap-2 mb-2">
                  <Info className="h-4 w-4" />
                  <span className="font-medium">作业说明</span>
                </div>
                <p>
                  学生提交作业后，教师按评分规则进行打分。评价点配置请在「评价标准配置」卡片中设置。
                </p>
              </div>
              <div className="border rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium">作业提交要求</p>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={mockResHomework.requiresMaterial}
                      onCheckedChange={(v) =>
                        setMockResHomework({ ...mockResHomework, requiresMaterial: v })
                      }
                    />
                    <span className="text-xs text-gray-600">是否需要提交作业材料</span>
                  </div>
                </div>
                {mockResHomework.requiresMaterial && (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <FormFieldRow label="预估提交天数" labelClassName="text-xs text-gray-500">
                        <Input
                          type="number"
                          value={mockResHomework.deadlineDays}
                          onChange={(e) =>
                            setMockResHomework({
                              ...mockResHomework,
                              deadlineDays: Math.max(1, parseInt(e.target.value) || 1),
                            })
                          }
                          className="text-sm"
                          min={1}
                        />
                      </FormFieldRow>
                    </div>
                    <FormFieldRow
                      label="作业格式要求"
                      labelClassName="text-xs text-gray-500"
                      className="mt-3"
                    >
                      <Textarea
                        value={mockResHomework.submitFormatDesc}
                        onChange={(e) =>
                          setMockResHomework({
                            ...mockResHomework,
                            submitFormatDesc: e.target.value,
                          })
                        }
                        placeholder="请用一句话说明学生需要提交的作业格式要求..."
                        rows={2}
                        className="text-sm"
                      />
                    </FormFieldRow>
                  </>
                )}
                <div className="mt-3">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={mockResHomework.allowResubmit}
                      onCheckedChange={(v) =>
                        setMockResHomework({ ...mockResHomework, allowResubmit: v })
                      }
                    />
                    <span className="text-xs text-gray-600">允许重新提交</span>
                  </div>
                </div>
              </div>
            </div>
          )
        }
        if (erDialogMethod === 'quiz') {
          const quizPresetTimes = [5, 10, 15, 20, 30]
          const quizIsPreset = quizPresetTimes.includes(mockResQuiz.timeLimit)
          return (
            <div className="space-y-4">
              <BankQuestionSelectorPanel
                field="quizQuestions"
                selectedIds={config.quizQuestions}
                maxCount={30}
                onToggleQuestion={(qid) => toggleQuestion(qid, 'quizQuestions')}
                questionScores={(getResourceConfig('quiz', {}) as any).questionScores || {}}
                onUpdateQuestionScore={(qid, score) =>
                  updateResourceConfig('quiz', {
                    questionScores: {
                      ...((getResourceConfig('quiz', {}) as any).questionScores || {}),
                      [qid]: score,
                    },
                  })
                }
                onUpdateQuestionScores={(scores) =>
                  updateResourceConfig('quiz', {
                    questionScores: {
                      ...((getResourceConfig('quiz', {}) as any).questionScores || {}),
                      ...scores,
                    },
                  })
                }
              />
              <div className="border rounded-xl p-4">
                <p className="text-sm font-medium mb-3">答题规则</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-gray-500">时间限制</Label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {quizPresetTimes.map((min) => (
                        <button
                          key={min}
                          onClick={() => setMockResQuiz({ ...mockResQuiz, timeLimit: min })}
                          className={cn(
                            'px-3 py-1.5 rounded-lg text-xs border transition-all',
                            mockResQuiz.timeLimit === min && quizIsPreset
                              ? 'border-primary bg-primary/5 text-primary'
                              : 'border-gray-200 text-gray-600 hover:border-gray-300',
                          )}
                        >
                          {min} 分钟
                        </button>
                      ))}
                      <button
                        onClick={() =>
                          setMockResQuiz({
                            ...mockResQuiz,
                            timeLimit: quizIsPreset ? 1 : mockResQuiz.timeLimit,
                          })
                        }
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-xs border transition-all',
                          !quizIsPreset && mockResQuiz.timeLimit > 0
                            ? 'border-primary bg-primary/5 text-primary'
                            : 'border-gray-200 text-gray-600 hover:border-gray-300',
                        )}
                      >
                        自定义
                      </button>
                    </div>
                    {!quizIsPreset && (
                      <div className="mt-2">
                        <Input
                          type="number"
                          value={mockResQuiz.timeLimit}
                          onChange={(e) =>
                            setMockResQuiz({
                              ...mockResQuiz,
                              timeLimit: Math.max(1, parseInt(e.target.value) || 1),
                            })
                          }
                          className="w-32 text-sm"
                          min={1}
                          placeholder="输入分钟数"
                        />
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={mockResQuiz.allowRetake}
                      onCheckedChange={(v) => setMockResQuiz({ ...mockResQuiz, allowRetake: v })}
                    />
                    <span className="text-xs text-gray-600">允许重复测评</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={mockResQuiz.shuffleQuestions}
                      onCheckedChange={(v) =>
                        setMockResQuiz({ ...mockResQuiz, shuffleQuestions: v })
                      }
                    />
                    <span className="text-xs text-gray-600">题目乱序</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={mockResQuiz.showResult}
                      onCheckedChange={(v) => setMockResQuiz({ ...mockResQuiz, showResult: v })}
                    />
                    <span className="text-xs text-gray-600">提交后展示成绩</span>
                  </div>
                </div>
                <ExamActivationConfig
                  value={mockResQuiz}
                  onChange={(updates) => setMockResQuiz({ ...mockResQuiz, ...updates })}
                />
              </div>
            </div>
          )
        }
        return null
      })()
    : null

  const getMethodEvalInfo = (methodKey: string) => {
    switch (methodKey) {
      case 'random_draw':
        return { points: config.randomDrawEvalPoints, field: 'randomDrawEvalPoints' as const }
      case 'review':
        return { points: config.reviewEvalPoints, field: 'reviewEvalPoints' as const }
      case 'paper':
        return { points: config.paperEvalPoints, field: 'paperEvalPoints' as const }
      case 'question_bank':
        return { points: config.questionBankEvalPoints, field: 'questionBankEvalPoints' as const }
      case 'outcome':
        return { points: config.outcomeEvalPoints, field: 'outcomeEvalPoints' as const }
      case 'homework':
        return { points: config.homeworkEvalPoints, field: 'homeworkEvalPoints' as const }
      case 'quiz':
        return { points: config.quizEvalPoints, field: 'quizEvalPoints' as const }
      default:
        return { points: [] as EvalPoint[], field: 'randomDrawEvalPoints' as const }
    }
  }

  const methodDialogContent = erDialogMethod
    ? (() => {
        const info = getMethodEvalInfo(erDialogMethod)
        const standardNameField =
          erDialogMethod === 'random_draw'
            ? 'randomDrawStandardName'
            : erDialogMethod === 'review'
              ? 'reviewStandardName'
              : erDialogMethod === 'outcome'
                ? 'outcomeStandardName'
                : 'homeworkStandardName'
        const standardModeField =
          erDialogMethod === 'random_draw'
            ? 'randomDrawStandardMode'
            : erDialogMethod === 'review'
              ? 'reviewStandardMode'
              : erDialogMethod === 'outcome'
                ? 'outcomeStandardMode'
                : 'homeworkStandardMode'
        const scoreRulesField =
          erDialogMethod === 'random_draw'
            ? 'randomDrawScoreRules'
            : erDialogMethod === 'review'
              ? 'reviewScoreRules'
              : erDialogMethod === 'outcome'
                ? 'outcomeScoreRules'
                : 'homeworkScoreRules'
        const taskScoreRules = ((config as any)[scoreRulesField] as EvalRuleScoreRule[]) || []
        const view = methodDialogViews[erDialogMethod] || 'edit'
        const setView = (v: 'list' | 'edit' | 'template') =>
          setMethodDialogViews((prev) => ({ ...prev, [erDialogMethod]: v }))

        const setTaskScoreRules = (items: EvalRuleScoreRule[]) =>
          updateConfig({ [scoreRulesField]: items } as any)

        // 使用模板 = 把模板内容完整复制到当前任务的评价标准表单（量规/评分规则），不保留任何引用
        const applyScheme = (schemeId: string) => {
          const scheme = rubricLibrary.find((s) => s.id === schemeId)
          if (!scheme) return
          setStdDraft({ name: scheme.name, mode: scheme.mode })
          updateConfig({
            [standardNameField]: scheme.name,
            [standardModeField]: scheme.mode,
          } as any)
          if (scheme.mode === 'rubric') {
            setEvalPoints(
              info.field,
              scheme.points.map((p) => ({ ...p, id: uid('ep') })),
            )
            setTaskScoreRules([])
          } else {
            setEvalPoints(info.field, [])
            setTaskScoreRules((scheme.scoreRuleItems || []).map((it) => ({ ...it, id: uid('sr') })))
          }
        }

        const buildTemplatePayload = (mode: 'rubric' | 'score_rule') => ({
          name: stdDraft.name || '新建评价标准',
          mode,
          types: [] as string[],
          description: '',
          data:
            mode === 'score_rule'
              ? {
                  scoreRuleItems: taskScoreRules.map((sr) => ({
                    id: sr.id,
                    name: sr.name,
                    desc: sr.desc,
                    rule: sr.rule || '',
                    weight: sr.weight || 0,
                  })),
                }
              : {
                  points: info.points.map((p) => ({
                    id: p.id,
                    name: p.name,
                    description: p.desc || '',
                    types: p.types || (p.subType ? [p.subType] : []),
                    weight: p.weight || 0,
                    scoringMethod: p.scoringMethod || 'level',
                    gradeMapping: p.gradeMapping || [],
                    knowledgePointIds: p.knowledgePointIds || [],
                    abilityPointIds: p.abilityPointIds || [],
                  })),
                },
        })

        // 「保存」：把评价标准（名称/类型/量规或评分规则）立即关联到当前任务×当前测评方式
        const handleSaveStandard = async () => {
          if (isSavingStandard) return
          setIsSavingStandard(true)
          try {
            updateConfig({
              [standardNameField]: stdDraft.name,
              [standardModeField]: stdDraft.mode,
            } as any)
            await onPersistStandard?.(erDialogMethod, {
              ...config,
              [standardNameField]: stdDraft.name,
              [standardModeField]: stdDraft.mode,
            } as EvalRuleConfig)
            toast({ title: '评价标准已保存' })
          } catch (err: any) {
            toast({ variant: 'destructive', title: '保存失败', description: err.message })
          } finally {
            setIsSavingStandard(false)
          }
        }

        const handleSaveTemplate = async () => {
          try {
            const payload = buildTemplatePayload(stdDraft.mode)
            if (saveTemplateMode === 'new') {
              const created = await taskEvaluationApi.createTemplate(payload)
              const newScheme: RubricScheme = {
                id: created.id,
                name: payload.name,
                types: [],
                desc: '',
                points: info.points.map((p) => ({ ...p })),
                mode: payload.mode,
                scoreRuleItems: payload.data.scoreRuleItems,
              }
              setRubricLibrary((prev) => [...prev, newScheme])
            } else if (selectedReplaceTemplateId) {
              await taskEvaluationApi.updateTemplate(selectedReplaceTemplateId, payload)
              setRubricLibrary((prev) =>
                prev.map((s) =>
                  s.id === selectedReplaceTemplateId
                    ? {
                        ...s,
                        name: payload.name,
                        types: [],
                        desc: '',
                        points: info.points.map((p) => ({ ...p })),
                        mode: payload.mode,
                        scoreRuleItems: payload.data.scoreRuleItems,
                      }
                    : s,
                ),
              )
            }
            toast({ title: '模板已保存' })
            setSaveTemplateDialogOpen(false)
          } catch (err: any) {
            toast({ variant: 'destructive', title: '模板保存失败', description: err.message })
          }
        }

        if (view === 'edit') {
          return (
            <div className="space-y-4">
              <div className="flex items-center justify-end gap-2 mb-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-8"
                  onClick={() => {
                    setView('template')
                  }}
                >
                  <BookOpen className="h-3.5 w-3.5 mr-1" />
                  从模板库选择
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-8 text-red-500 hover:text-red-600"
                  onClick={() => {
                    setStdDraft({ name: '', mode: 'rubric' })
                    updateConfig({
                      [standardNameField]: undefined,
                      [standardModeField]: undefined,
                      [scoreRulesField]: [],
                    } as any)
                    setEvalPoints(info.field, [])
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  清除评价标准
                </Button>
              </div>
              <div className="border rounded-xl p-4 bg-gray-50/50">
                <p className="text-sm font-medium mb-3">评价标准信息</p>
                <div className="space-y-3">
                  <FormFieldRow label="评价标准名称" labelClassName="text-xs text-gray-500">
                    <Input
                      value={stdDraft.name}
                      onChange={(e) => setStdDraft((prev) => ({ ...prev, name: e.target.value }))}
                      className="text-sm"
                      placeholder="输入评价标准名称"
                    />
                  </FormFieldRow>
                  <div>
                    <Label className="text-xs text-gray-500">评价标准类型</Label>
                    <div className="flex gap-3 mt-1">
                      <button
                        onClick={() => setStdDraft((prev) => ({ ...prev, mode: 'rubric' }))}
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-xs border transition-all flex items-center gap-1.5',
                          stdDraft.mode === 'rubric'
                            ? 'bg-primary/10 text-primary border-primary'
                            : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300',
                        )}
                      >
                        <div
                          className={cn(
                            'w-3.5 h-3.5 rounded-full border flex items-center justify-center',
                            stdDraft.mode === 'rubric' ? 'border-primary' : 'border-gray-300',
                          )}
                        >
                          {stdDraft.mode === 'rubric' && (
                            <div className="w-2 h-2 rounded-full bg-primary" />
                          )}
                        </div>
                        评价量规
                      </button>
                      <button
                        onClick={() => {
                          setStdDraft((prev) => ({ ...prev, mode: 'score_rule' }))
                          if (taskScoreRules.length === 0)
                            setTaskScoreRules([
                              { id: uid('sr'), name: '', desc: '', rule: '', weight: 0 },
                            ])
                        }}
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-xs border transition-all flex items-center gap-1.5',
                          stdDraft.mode === 'score_rule'
                            ? 'bg-primary/10 text-primary border-primary'
                            : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300',
                        )}
                      >
                        <div
                          className={cn(
                            'w-3.5 h-3.5 rounded-full border flex items-center justify-center',
                            stdDraft.mode === 'score_rule' ? 'border-primary' : 'border-gray-300',
                          )}
                        >
                          {stdDraft.mode === 'score_rule' && (
                            <div className="w-2 h-2 rounded-full bg-primary" />
                          )}
                        </div>
                        评分规则
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              {stdDraft.mode === 'rubric' ? (
                <div className="border rounded-xl p-4 overflow-hidden">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-medium">评价量规配置表</p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-8"
                        onClick={() => {
                          const count = info.points.length
                          if (count === 0) return
                          const base = Math.floor(100 / count)
                          const remainder = 100 % count
                          const newPoints = info.points.map((p, i) => ({
                            ...p,
                            weight: base + (i < remainder ? 1 : 0),
                          }))
                          setEvalPoints(info.field, newPoints)
                        }}
                      >
                        <RotateCcw className="h-3.5 w-3.5 mr-1" />
                        一键均分
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-8"
                        onClick={() =>
                          addEvalPoint(info.field, {
                            name: '',
                            types: undefined,
                          })
                        }
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        添加评价维度
                      </Button>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse min-w-[720px]">
                      <thead>
                        <tr className="border-b bg-gray-50 text-gray-500 text-xs">
                          <th className="py-2.5 px-2 text-left w-12">序号</th>
                          <th className="py-2.5 px-2 text-left min-w-[280px]">
                            评价维度名称/关联知识点/能力点
                          </th>
                          <th className="py-2.5 px-2 text-left min-w-[320px]">评价等级</th>
                          <th className="py-2.5 px-2 text-center w-20">权重(%)</th>
                          <th className="py-2.5 px-2 text-center w-14">操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {info.points.map((ep, idx) => (
                          <tr
                            key={ep.id}
                            className="border-b hover:bg-gray-50/50 transition-colors"
                          >
                            <td className="py-3 px-2">
                              <span className="text-gray-600 align-middle">{idx + 1}</span>
                            </td>
                            <td className="py-3 px-2">
                              <MixedTagEditor
                                text={ep.name}
                                knowledgePointIds={ep.knowledgePointIds || []}
                                abilityPointIds={ep.abilityPointIds || []}
                                knowledgePoints={knowledgePoints}
                                abilityPoints={abilityPoints}
                                onChange={(updates) => updateEvalPoint(info.field, ep.id, updates)}
                                onOpenKpDialog={() => openRubricKpDialog(ep.id, info.field)}
                                onOpenAbDialog={() => openRubricAbDialog(ep.id, info.field)}
                              />
                            </td>
                            <td className="py-3 px-2">
                              <button
                                onClick={() => {
                                  setEditingGradeMappingPointId(ep.id)
                                  setGradeMappingDialogOpen(true)
                                }}
                                className="text-xs text-left text-primary hover:underline w-full block"
                              >
                                {ep.gradeMapping?.map((gm) => (
                                  <div
                                    key={gm.id}
                                    className="truncate leading-relaxed"
                                    title={`${gm.grade} (${gm.minScore}-${gm.maxScore}分) ${gm.remark}`}
                                  >
                                    {gm.grade} ({gm.minScore}-{gm.maxScore}分) {gm.remark}
                                  </div>
                                ))}
                                {!ep.gradeMapping?.length && '点击配置评价等级'}
                              </button>
                            </td>
                            <td className="py-3 px-2">
                              <Input
                                type="number"
                                value={ep.weight || 0}
                                onChange={(e) =>
                                  updateEvalPoint(info.field, ep.id, {
                                    weight: Math.max(
                                      0,
                                      Math.min(100, parseInt(e.target.value) || 0),
                                    ),
                                  })
                                }
                                className="h-8 text-sm text-center"
                              />
                            </td>
                            <td className="py-3 px-2 text-center">
                              <button
                                className="text-red-500 hover:text-red-600 text-xs"
                                onClick={() => removeEvalPoint(info.field, ep.id)}
                              >
                                删除
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-3 space-y-2">
                    <button
                      onClick={() =>
                        addEvalPoint(info.field, {
                          name: '',
                          types: undefined,
                        })
                      }
                      className="w-full py-3 border-2 border-dashed border-gray-200 rounded-lg text-sm text-gray-500 hover:border-primary/40 hover:text-primary transition-colors flex items-center justify-center gap-1"
                    >
                      <Plus className="h-4 w-4" />
                      添加评价维度
                    </button>
                    {info.points.length > 0 && (
                      <div className="flex justify-end text-xs items-center gap-1">
                        <span className="text-gray-500">维度权重合计：</span>
                        <span
                          className={cn(
                            'font-semibold',
                            info.points.reduce((sum, p) => sum + (p.weight || 0), 0) === 100
                              ? 'text-green-600'
                              : 'text-red-500',
                          )}
                        >
                          {info.points.reduce((sum, p) => sum + (p.weight || 0), 0)}%
                        </span>
                        {info.points.reduce((sum, p) => sum + (p.weight || 0), 0) !== 100 && (
                          <span className="text-red-500">⚠️（需等于100%）</span>
                        )}
                      </div>
                    )}
                  </div>
                  {info.points.length === 0 && (
                    <div className="text-center text-gray-400 py-8">
                      <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">尚未添加评价点</p>
                      <p className="text-xs mt-1">点击上方按钮添加第一个评价点</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="border rounded-xl p-4 overflow-hidden">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-medium">评分规则配置表</p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-8"
                        onClick={() => {
                          const items = taskScoreRules
                          const count = items.length
                          if (count === 0) return
                          const base = Math.floor(100 / count)
                          const remainder = 100 % count
                          const newItems = items.map((it, i) => ({
                            ...it,
                            weight: base + (i < remainder ? 1 : 0),
                          }))
                          setTaskScoreRules(newItems)
                        }}
                      >
                        <RotateCcw className="h-3.5 w-3.5 mr-1" />
                        一键均分
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-8"
                        onClick={() => {
                          const newItem: EvalRuleScoreRule = {
                            id: uid('sr'),
                            name: '',
                            desc: '',
                            rule: '',
                            weight: 0,
                          }
                          setTaskScoreRules([...taskScoreRules, newItem])
                        }}
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        添加评价项
                      </Button>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse min-w-[560px]">
                      <thead>
                        <tr className="border-b bg-gray-50 text-gray-500 text-xs">
                          <th className="py-2.5 px-2 text-left w-16">序号</th>
                          <th className="py-2.5 px-2 text-left min-w-[240px]">
                            评价项/评分标准描述
                          </th>
                          <th className="py-2.5 px-2 text-left min-w-[160px]">加减分规则</th>
                          <th className="py-2.5 px-2 text-center w-20">分值</th>
                          <th className="py-2.5 px-2 text-center w-16">操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {taskScoreRules.map((item, idx) => (
                          <tr
                            key={item.id}
                            className="border-b hover:bg-gray-50/50 transition-colors"
                          >
                            <td className="py-3 px-2">
                              <span className="text-gray-600 align-middle">{idx + 1}</span>
                            </td>
                            <td className="py-3 px-2">
                              <Textarea
                                value={item.name + (item.desc ? `\n${item.desc}` : '')}
                                onChange={(e) => {
                                  const lines = e.target.value.split('\n')
                                  const newName = lines[0] || ''
                                  const newDesc = lines.slice(1).join('\n')
                                  setTaskScoreRules(
                                    taskScoreRules.map((it) =>
                                      it.id === item.id
                                        ? { ...it, name: newName, desc: newDesc }
                                        : it,
                                    ),
                                  )
                                }}
                                className="text-sm min-h-[60px]"
                                placeholder="请输入评分描述"
                                rows={2}
                              />
                            </td>
                            <td className="py-3 px-2">
                              <Textarea
                                value={item.rule || ''}
                                onChange={(e) =>
                                  setTaskScoreRules(
                                    taskScoreRules.map((it) =>
                                      it.id === item.id ? { ...it, rule: e.target.value } : it,
                                    ),
                                  )
                                }
                                className="text-sm min-h-[60px]"
                                placeholder="输入加减分规则"
                                rows={2}
                              />
                            </td>
                            <td className="py-3 px-2">
                              <Input
                                type="number"
                                value={item.weight || 0}
                                onChange={(e) => {
                                  const val = Math.max(
                                    0,
                                    Math.min(100, parseInt(e.target.value) || 0),
                                  )
                                  setTaskScoreRules(
                                    taskScoreRules.map((it) =>
                                      it.id === item.id ? { ...it, weight: val } : it,
                                    ),
                                  )
                                }}
                                className="h-8 text-sm text-center"
                              />
                            </td>
                            <td className="py-3 px-2 text-center">
                              <button
                                className="text-red-500 hover:text-red-600 text-xs"
                                onClick={() =>
                                  setTaskScoreRules(
                                    taskScoreRules.filter((it) => it.id !== item.id),
                                  )
                                }
                              >
                                删除
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-3 space-y-2">
                    <button
                      onClick={() => {
                        const newItem: EvalRuleScoreRule = {
                          id: uid('sr'),
                          name: '',
                          desc: '',
                          rule: '',
                          weight: 0,
                        }
                        setTaskScoreRules([...taskScoreRules, newItem])
                      }}
                      className="w-full py-3 border-2 border-dashed border-gray-200 rounded-lg text-sm text-gray-500 hover:border-primary/40 hover:text-primary transition-colors flex items-center justify-center gap-1"
                    >
                      <Plus className="h-4 w-4" />
                      添加评价项
                    </button>
                    {taskScoreRules.length > 0 && (
                      <div className="flex justify-end text-xs items-center gap-1">
                        <span className="text-gray-500">分值合计：</span>
                        <span
                          className={cn(
                            'font-semibold',
                            taskScoreRules.reduce((sum, it) => sum + (it.weight || 0), 0) === 100
                              ? 'text-green-600'
                              : 'text-red-500',
                          )}
                        >
                          {taskScoreRules.reduce((sum, it) => sum + (it.weight || 0), 0)}%
                        </span>
                        {taskScoreRules.reduce((sum, it) => sum + (it.weight || 0), 0) !== 100 && (
                          <span className="text-red-500">⚠️（需等于100%）</span>
                        )}
                      </div>
                    )}
                  </div>
                  {taskScoreRules.length === 0 && (
                    <div className="text-center text-gray-400 py-8">
                      <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">尚未添加评价项</p>
                      <p className="text-xs mt-1">点击上方按钮添加第一个评价项</p>
                    </div>
                  )}
                </div>
              )}
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  className="text-xs h-8"
                  onClick={() => void handleSaveStandard()}
                  disabled={isSavingStandard}
                >
                  {isSavingStandard ? '保存中…' : '保存'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-8"
                  onClick={() => {
                    setSaveTemplateDialogOpen(true)
                    setSaveTemplateMode('new')
                    setSelectedReplaceTemplateId(null)
                  }}
                >
                  保存到模板
                </Button>
              </div>
              <Dialog open={saveTemplateDialogOpen} onOpenChange={setSaveTemplateDialogOpen}>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>保存到模板</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSaveTemplateMode('new')}
                        className={cn(
                          'flex-1 px-3 py-2 rounded-lg text-xs border transition-all',
                          saveTemplateMode === 'new'
                            ? 'border-primary bg-primary/5 text-primary'
                            : 'border-gray-200 text-gray-500 hover:border-gray-300',
                        )}
                      >
                        新增模板
                      </button>
                      <button
                        onClick={() => setSaveTemplateMode('replace')}
                        className={cn(
                          'flex-1 px-3 py-2 rounded-lg text-xs border transition-all',
                          saveTemplateMode === 'replace'
                            ? 'border-primary bg-primary/5 text-primary'
                            : 'border-gray-200 text-gray-500 hover:border-gray-300',
                        )}
                      >
                        替换现有模板
                      </button>
                    </div>
                    {saveTemplateMode === 'new' ? (
                      <FormFieldRow label="模板名称" labelClassName="text-xs text-gray-500">
                        <Input
                          value={stdDraft.name}
                          onChange={(e) =>
                            setStdDraft((prev) => ({ ...prev, name: e.target.value }))
                          }
                          className="text-sm"
                          placeholder="输入模板名称"
                        />
                      </FormFieldRow>
                    ) : (
                      <div className="space-y-2">
                        <Label className="text-xs text-gray-500">选择要替换的模板</Label>
                        <div className="space-y-2 max-h-[200px] overflow-y-auto">
                          {rubricLibrary.map((scheme) => (
                            <div
                              key={scheme.id}
                              onClick={() => setSelectedReplaceTemplateId(scheme.id)}
                              className={cn(
                                'p-3 rounded-lg border cursor-pointer transition-all',
                                selectedReplaceTemplateId === scheme.id
                                  ? 'border-primary bg-primary/5'
                                  : 'border-gray-200 hover:border-gray-300',
                              )}
                            >
                              <p className="text-sm font-medium">{scheme.name}</p>
                              <p className="text-xs text-gray-400 mt-0.5">
                                {scheme.mode === 'rubric' ? '评价量规' : '评分规则'}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => setSaveTemplateDialogOpen(false)}
                    >
                      取消
                    </Button>
                    <Button
                      size="sm"
                      className="text-xs"
                      onClick={() => void handleSaveTemplate()}
                      disabled={saveTemplateMode === 'replace' && !selectedReplaceTemplateId}
                    >
                      确认保存
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Dialog
                open={gradeMappingDialogOpen}
                onOpenChange={(v) => !v && setGradeMappingDialogOpen(false)}
              >
                <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>编辑评分等级</DialogTitle>
                  </DialogHeader>
                  {(() => {
                    const ep = info.points.find((p) => p.id === editingGradeMappingPointId)
                    if (!ep || !ep.gradeMapping) return null
                    const gm = ep.gradeMapping
                    return (
                      <div className="space-y-3 py-2">
                        {gm.map((g) => (
                          <div
                            key={g.id}
                            className="flex items-start gap-2 p-3 rounded-lg border bg-gray-50/50"
                          >
                            <div className="flex-1 space-y-2">
                              <div className="flex items-center gap-2">
                                <Input
                                  value={g.grade}
                                  onChange={(e) => {
                                    const newGm = gm.map((x) =>
                                      x.id === g.id ? { ...x, grade: e.target.value } : x,
                                    )
                                    updateEvalPoint(info.field, ep.id, { gradeMapping: newGm })
                                  }}
                                  className="w-14 h-7 text-center text-xs font-semibold"
                                  placeholder="等级"
                                />
                                <Input
                                  type="number"
                                  value={g.minScore}
                                  onChange={(e) => {
                                    const newGm = gm.map((x) =>
                                      x.id === g.id
                                        ? { ...x, minScore: parseInt(e.target.value) || 0 }
                                        : x,
                                    )
                                    updateEvalPoint(info.field, ep.id, { gradeMapping: newGm })
                                  }}
                                  className="w-16 h-7 text-center text-xs"
                                  min={0}
                                  max={100}
                                />
                                <span className="text-gray-500 text-xs">-</span>
                                <Input
                                  type="number"
                                  value={g.maxScore}
                                  onChange={(e) => {
                                    const newGm = gm.map((x) =>
                                      x.id === g.id
                                        ? { ...x, maxScore: parseInt(e.target.value) || 0 }
                                        : x,
                                    )
                                    updateEvalPoint(info.field, ep.id, { gradeMapping: newGm })
                                  }}
                                  className="w-16 h-7 text-center text-xs"
                                  min={0}
                                  max={100}
                                />
                                <span className="text-xs text-gray-500">分</span>
                              </div>
                              <Input
                                value={g.remark || ''}
                                onChange={(e) => {
                                  const newGm = gm.map((x) =>
                                    x.id === g.id ? { ...x, remark: e.target.value } : x,
                                  )
                                  updateEvalPoint(info.field, ep.id, { gradeMapping: newGm })
                                }}
                                className="h-7 text-xs"
                                placeholder="等级描述"
                              />
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-gray-400 hover:text-red-500"
                              onClick={() => {
                                const newGm = gm.filter((x) => x.id !== g.id)
                                updateEvalPoint(info.field, ep.id, { gradeMapping: newGm })
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full text-xs"
                          onClick={() => {
                            const colors = [
                              'bg-green-500',
                              'bg-blue-500',
                              'bg-yellow-500',
                              'bg-red-500',
                              'bg-purple-500',
                              'bg-orange-500',
                            ]
                            const newGm = [
                              ...gm,
                              {
                                id: uid('grade'),
                                grade: '新等级',
                                minScore: 0,
                                maxScore: 100,
                                color: colors[gm.length % colors.length],
                                remark: '',
                              },
                            ]
                            updateEvalPoint(info.field, ep.id, { gradeMapping: newGm })
                          }}
                        >
                          <Plus className="h-3.5 w-3.5 mr-1" />
                          新增等级
                        </Button>
                      </div>
                    )
                  })()}
                  <DialogFooter>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setGradeMappingDialogOpen(false)}
                    >
                      关闭
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          )
        }

        if (view === 'template') {
          return (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-8"
                  onClick={() => setView('edit')}
                >
                  <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                  返回评价标准编辑
                </Button>
              </div>
              <p className="text-sm font-medium">选择评价标准模板进行覆盖</p>
              <div className="grid grid-cols-1 gap-3">
                {rubricLibrary.map((scheme) => (
                  <div
                    key={scheme.id}
                    className="p-4 rounded-xl border border-gray-200 bg-white hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer"
                    onClick={() => {
                      applyScheme(scheme.id)
                      setView('edit')
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <p className="text-sm font-semibold">{scheme.name}</p>
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-[10px]',
                              scheme.mode === 'rubric'
                                ? 'bg-purple-50 text-purple-600 border-purple-200'
                                : 'bg-blue-50 text-blue-600 border-blue-200',
                            )}
                          >
                            {scheme.mode === 'rubric' ? '评价量规' : '评分规则'}
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-400 mb-2">{scheme.desc}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {scheme.types.map((type) => (
                            <Badge
                              key={type}
                              variant="outline"
                              className={cn('text-[10px]', evalSubTypeColors[type])}
                            >
                              {evalSubTypeLabels[type]}
                            </Badge>
                          ))}
                        </div>
                        <p className="text-xs text-gray-400 mt-1.5">
                          {scheme.mode === 'rubric'
                            ? `${scheme.points.length} 个评价点`
                            : `${scheme.scoreRuleItems?.length || 0} 个评价项`}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        className="h-7 text-[11px] px-2.5 shrink-0 mt-0.5"
                        onClick={(e) => {
                          e.stopPropagation()
                          applyScheme(scheme.id)
                          setView('edit')
                        }}
                      >
                        使用此模板
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        }

        return null
      })()
    : null

  const StepCard = ({
    step,
    title,
    icon,
    summary,
    description,
    badge,
    configured,
    tone = 'default',
    onClick,
  }: {
    step: number
    title: string
    icon: ReactNode
    summary: string
    description: string
    badge?: string
    configured?: boolean
    tone?: 'default' | 'success'
    onClick?: () => void
  }) => {
    const isSuccess = tone === 'success'
    const className = cn(
      'relative p-4 rounded-xl border bg-white text-left transition-all w-full h-full',
      onClick && 'group',
      onClick &&
        (isSuccess
          ? 'hover:border-green-300 hover:bg-green-50/50'
          : 'hover:border-primary/50 hover:bg-primary/[0.02]'),
    )
    const content = (
      <>
        <div
          className={cn(
            'absolute top-3 right-3 w-5 h-5 rounded-full text-[10px] flex items-center justify-center font-medium border',
            isSuccess
              ? 'bg-green-50 text-green-600 border-green-100'
              : 'bg-primary/10 text-primary border-primary/20',
          )}
        >
          {step}
        </div>
        <div className="flex items-center gap-2 mb-3">
          <div
            className={cn(
              'p-1.5 rounded-md',
              isSuccess ? 'bg-green-50 text-green-600' : 'bg-primary/10 text-primary',
            )}
          >
            {icon}
          </div>
          <span className="text-xs font-medium text-gray-600">{title}</span>
          {badge ? (
            <Badge variant="outline" className="text-[10px] ml-auto">
              {badge}
            </Badge>
          ) : (
            configured && (
              <CheckCircle2
                className={cn('h-3.5 w-3.5 ml-auto', isSuccess ? 'text-green-500' : 'text-primary')}
              />
            )
          )}
        </div>
        <p className="text-sm font-semibold truncate pr-6">{summary}</p>
        <p className="text-xs text-gray-400 mt-1">{description}</p>
      </>
    )
    return onClick ? (
      <button type="button" onClick={onClick} className={className}>
        {content}
      </button>
    ) : (
      <div className={className}>{content}</div>
    )
  }

  const ObjectCard = ({ methodKey, onClick }: { methodKey: string; onClick: () => void }) => {
    const currentObject = config.methodEvalObjects[methodKey] || config.evalObject
    const labels: Record<string, string> = { individual: '个人', group: '小组' }
    const descs: Record<string, string> = { individual: '以个人为单位', group: '以小组为单位' }
    return (
      <StepCard
        step={1}
        title="测评对象"
        icon={<Users className="h-4 w-4" />}
        summary={labels[currentObject] || '未选择'}
        description={descs[currentObject] || '点击配置'}
        configured={!!labels[currentObject]}
        onClick={onClick}
      />
    )
  }

  const SubjectCard = ({ methodKey, onClick }: { methodKey: string; onClick: () => void }) => {
    const currentSubjects = getMethodSubjects(methodKey)
    const enabledSubjects = currentSubjects.filter((s) => s.enabled)
    const totalWeight = enabledSubjects.reduce((s, sub) => s + (sub.params?.weightPercent || 0), 0)
    return (
      <StepCard
        step={2}
        title="评价主体"
        icon={<UserCheck className="h-4 w-4" />}
        summary={
          enabledSubjects.length === 0
            ? '未配置'
            : enabledSubjects.map((s) => subjectLabels[s.type]).join('、')
        }
        description={enabledSubjects.length === 0 ? '点击配置' : `总权重 ${totalWeight}%`}
        badge={enabledSubjects.length > 0 ? `${enabledSubjects.length} 类` : undefined}
        onClick={onClick}
      />
    )
  }

  const ResourceCard = ({ methodKey, onClick }: { methodKey: string; onClick: () => void }) => {
    const summary = getMethodConfigSummary(methodKey)
    return (
      <StepCard
        step={3}
        title="测评资源"
        icon={<Database className="h-4 w-4" />}
        summary={summary.summary || '未配置'}
        description={summary.configured ? '点击修改测评资源' : '点击配置测评资源'}
        configured={summary.configured}
        onClick={onClick}
      />
    )
  }

  const MethodCard = ({ methodKey, onClick }: { methodKey: string; onClick: () => void }) => {
    const info = getMethodEvalInfo(methodKey)
    const nameField =
      methodKey === 'random_draw'
        ? 'randomDrawStandardName'
        : methodKey === 'review'
          ? 'reviewStandardName'
          : methodKey === 'outcome'
            ? 'outcomeStandardName'
            : 'homeworkStandardName'
    const modeField =
      methodKey === 'random_draw'
        ? 'randomDrawStandardMode'
        : methodKey === 'review'
          ? 'reviewStandardMode'
          : methodKey === 'outcome'
            ? 'outcomeStandardMode'
            : 'homeworkStandardMode'
    const rulesField =
      methodKey === 'random_draw'
        ? 'randomDrawScoreRules'
        : methodKey === 'review'
          ? 'reviewScoreRules'
          : methodKey === 'outcome'
            ? 'outcomeScoreRules'
            : 'homeworkScoreRules'
    const standardMode = (config as any)[modeField] as 'rubric' | 'score_rule' | undefined
    const standardName = (config as any)[nameField] as string | undefined
    const scoreRules = ((config as any)[rulesField] as EvalRuleScoreRule[]) || []

    let summary: string
    let description: string
    let badge: string | undefined
    let configured: boolean

    if (standardMode === 'score_rule') {
      summary = scoreRules.length === 0 ? '未配置评分项' : `${scoreRules.length} 个评分项`
      description = standardName ? `${standardName} · 评分规则` : '评分规则'
      badge = scoreRules.length > 0 ? `${scoreRules.length} 项` : undefined
      configured = scoreRules.length > 0
    } else {
      const subTypeCount = Object.entries(
        info.points.reduce(
          (acc, p) => {
            if (p.subType) acc[p.subType] = (acc[p.subType] || 0) + 1
            return acc
          },
          {} as Record<string, number>,
        ),
      ).map(([k, v]) => `${evalSubTypeLabels[k as EvalSubType]}${v}`)
      summary = info.points.length === 0 ? '未配置评价点' : `${info.points.length} 个评价点`
      description = standardName
        ? standardName
        : subTypeCount.length === 0
          ? '点击配置评价标准'
          : subTypeCount.join(' · ')
      badge = info.points.length > 0 ? `${info.points.length} 点` : undefined
      configured = info.points.length > 0
    }

    return (
      <StepCard
        step={4}
        title="评价标准配置"
        icon={<Target className="h-4 w-4" />}
        summary={summary}
        description={description}
        badge={badge}
        configured={configured}
        onClick={onClick}
      />
    )
  }

  const renderObjectDialogContent = (methodKey: string) => {
    const currentObject = config.methodEvalObjects[methodKey] || config.evalObject
    return (
      <div className="space-y-4">
        <p className="text-sm text-gray-500 mb-4">选择本评价方式的测评对象类型</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            {
              key: 'individual',
              label: '个人',
              desc: '以学生个人为单位进行测评',
              icon: <User className="h-6 w-6" />,
            },
            {
              key: 'group',
              label: '小组',
              desc: '以小组为单位进行测评',
              icon: <Users className="h-6 w-6" />,
            },
          ].map((opt) => (
            <button
              key={opt.key}
              onClick={() =>
                updateConfig({
                  methodEvalObjects: {
                    ...config.methodEvalObjects,
                    [methodKey]: opt.key as EvalObjectType,
                  },
                })
              }
              className={cn(
                'p-5 rounded-xl border text-left transition-all flex items-center gap-4',
                currentObject === opt.key
                  ? 'border-primary bg-primary/[0.03] ring-1 ring-primary/20'
                  : 'border-gray-200 hover:border-gray-300 bg-white',
              )}
            >
              <div
                className={cn(
                  'p-3 rounded-lg',
                  currentObject === opt.key
                    ? 'bg-primary/10 text-primary'
                    : 'bg-gray-100 text-gray-400',
                )}
              >
                {opt.icon}
              </div>
              <div>
                <p className="text-sm font-semibold mb-1">{opt.label}</p>
                <p className="text-xs text-gray-400">{opt.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    )
  }

  const renderSubjectDialogContent = (methodKey: string) => {
    const currentSubjects = getMethodSubjects(methodKey)
    const displayTypes = ['teacher', 'enterprise_mentor', 'self', 'peer'] as const

    const handleDistributeWeights = () => {
      const enabled = currentSubjects.filter(
        (s) => s.enabled && displayTypes.includes(s.type as (typeof displayTypes)[number]),
      )
      const count = enabled.length
      if (count === 0) return
      const base = Math.floor(100 / count)
      const remainder = 100 % count
      const enabledIdxMap = new Map(enabled.map((s, i) => [s.type, i]))
      const newSubjects = currentSubjects.map((s) => {
        if (!s.enabled || !displayTypes.includes(s.type as (typeof displayTypes)[number])) return s
        const idx = enabledIdxMap.get(s.type) ?? 0
        return { ...s, params: { ...s.params, weightPercent: base + (idx < remainder ? 1 : 0) } }
      })
      updateConfig({
        methodEvalSubjects: { ...config.methodEvalSubjects, [methodKey]: newSubjects },
      })
    }

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">配置参与评价的主体及其参数</p>
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-8"
            onClick={handleDistributeWeights}
          >
            <Scale className="h-3.5 w-3.5 mr-1" />
            一键平均权重
          </Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {currentSubjects
            .filter((s) => displayTypes.includes(s.type as (typeof displayTypes)[number]))
            .map((subject) => {
              const originalIdx = currentSubjects.findIndex((s) => s.type === subject.type)
              return (
                <div
                  key={subject.type}
                  className={cn(
                    'p-3 rounded-lg border transition-all',
                    subject.enabled
                      ? 'border-primary bg-primary/[0.03]'
                      : 'border-gray-200 bg-white',
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={subject.enabled}
                        onCheckedChange={(v) =>
                          updateMethodEvalSubject(methodKey, originalIdx, { enabled: v })
                        }
                      />
                      <span className="text-xs font-medium">{subjectLabels[subject.type]}</span>
                    </div>
                    {subject.enabled && subject.params?.weightPercent !== undefined && (
                      <Badge variant="outline" className="text-[10px]">
                        权重 {subject.params.weightPercent}%
                      </Badge>
                    )}
                  </div>
                  {subject.enabled && (
                    <div className="pl-8 space-y-2">
                      {subject.type === 'teacher' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <FormFieldRow
                            label="专业背景要求"
                            labelClassName="text-[11px] text-gray-500"
                          >
                            <Input
                              value={subject.params?.teacherBackground || ''}
                              onChange={(e) =>
                                updateMethodEvalSubject(methodKey, originalIdx, {
                                  params: { ...subject.params, teacherBackground: e.target.value },
                                })
                              }
                              placeholder="计算机/软件工程相关专业"
                              className="text-xs h-8"
                            />
                          </FormFieldRow>
                          <FormFieldRow label="评分人数" labelClassName="text-[11px] text-gray-500">
                            <Input
                              type="number"
                              value={subject.params?.scorerCount || 1}
                              onChange={(e) =>
                                updateMethodEvalSubject(methodKey, originalIdx, {
                                  params: {
                                    ...subject.params,
                                    scorerCount: Math.max(1, parseInt(e.target.value) || 1),
                                  },
                                })
                              }
                              className="text-xs h-8"
                              min={1}
                            />
                            {(subject.params?.scorerCount || 1) > 1 && (
                              <FormFieldRow
                                label="统计规则"
                                labelClassName="text-[11px] text-gray-500"
                                className="mt-1"
                              >
                                <Select
                                  value={subject.params?.aggregationRule || 'average'}
                                  onValueChange={(v) =>
                                    updateMethodEvalSubject(methodKey, originalIdx, {
                                      params: {
                                        ...subject.params,
                                        aggregationRule: v as 'average' | 'median' | 'max' | 'min',
                                      },
                                    })
                                  }
                                >
                                  <SelectTrigger className="text-xs h-8">
                                    <SelectValue placeholder="选择统计规则" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="average">平均值</SelectItem>
                                    <SelectItem value="median">中位数</SelectItem>
                                    <SelectItem value="max">最高分</SelectItem>
                                    <SelectItem value="min">最低分</SelectItem>
                                  </SelectContent>
                                </Select>
                              </FormFieldRow>
                            )}
                          </FormFieldRow>
                          <FormFieldRow
                            label="评分权重 (%)"
                            labelClassName="text-[11px] text-gray-500"
                          >
                            <Input
                              type="number"
                              value={subject.params?.weightPercent || 0}
                              onChange={(e) =>
                                updateMethodEvalSubject(methodKey, originalIdx, {
                                  params: {
                                    ...subject.params,
                                    weightPercent: Math.max(
                                      0,
                                      Math.min(100, parseInt(e.target.value) || 0),
                                    ),
                                  },
                                })
                              }
                              className="text-xs h-8"
                              min={0}
                              max={100}
                            />
                          </FormFieldRow>
                          <FormFieldRow
                            label="最低教龄 (年)"
                            labelClassName="text-[11px] text-gray-500"
                          >
                            <Input
                              type="number"
                              value={subject.params?.minTeachingYears || 0}
                              onChange={(e) =>
                                updateMethodEvalSubject(methodKey, originalIdx, {
                                  params: {
                                    ...subject.params,
                                    minTeachingYears: Math.max(0, parseInt(e.target.value) || 0),
                                  },
                                })
                              }
                              className="text-xs h-8"
                              min={0}
                            />
                          </FormFieldRow>
                        </div>
                      )}
                      {subject.type === 'enterprise_mentor' && (
                        <>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <FormFieldRow
                              label="专业领域"
                              labelClassName="text-[11px] text-gray-500"
                            >
                              <Input
                                value={subject.params?.expertise || ''}
                                onChange={(e) =>
                                  updateMethodEvalSubject(methodKey, originalIdx, {
                                    params: { ...subject.params, expertise: e.target.value },
                                  })
                                }
                                placeholder="网络安全 / 渗透测试"
                                className="text-xs h-8"
                              />
                            </FormFieldRow>
                            <FormFieldRow
                              label="工作年限要求 (年)"
                              labelClassName="text-[11px] text-gray-500"
                            >
                              <Input
                                type="number"
                                value={subject.params?.minYears || 0}
                                onChange={(e) =>
                                  updateMethodEvalSubject(methodKey, originalIdx, {
                                    params: {
                                      ...subject.params,
                                      minYears: Math.max(0, parseInt(e.target.value) || 0),
                                    },
                                  })
                                }
                                className="text-xs h-8"
                                min={0}
                              />
                            </FormFieldRow>
                            <FormFieldRow
                              label="评分人数"
                              labelClassName="text-[11px] text-gray-500"
                            >
                              <Input
                                type="number"
                                value={subject.params?.scorerCount || 1}
                                onChange={(e) =>
                                  updateMethodEvalSubject(methodKey, originalIdx, {
                                    params: {
                                      ...subject.params,
                                      scorerCount: Math.max(1, parseInt(e.target.value) || 1),
                                    },
                                  })
                                }
                                className="text-xs h-8"
                                min={1}
                              />
                              {(subject.params?.scorerCount || 1) > 1 && (
                                <FormFieldRow
                                  label="统计规则"
                                  labelClassName="text-[11px] text-gray-500"
                                  className="mt-1"
                                >
                                  <Select
                                    value={subject.params?.aggregationRule || 'average'}
                                    onValueChange={(v) =>
                                      updateMethodEvalSubject(methodKey, originalIdx, {
                                        params: {
                                          ...subject.params,
                                          aggregationRule: v as
                                            'average' | 'median' | 'max' | 'min',
                                        },
                                      })
                                    }
                                  >
                                    <SelectTrigger className="text-xs h-8">
                                      <SelectValue placeholder="选择统计规则" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="average">平均值</SelectItem>
                                      <SelectItem value="median">中位数</SelectItem>
                                      <SelectItem value="max">最高分</SelectItem>
                                      <SelectItem value="min">最低分</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </FormFieldRow>
                              )}
                            </FormFieldRow>
                            <FormFieldRow
                              label="评分权重 (%)"
                              labelClassName="text-[11px] text-gray-500"
                            >
                              <Input
                                type="number"
                                value={subject.params?.weightPercent || 0}
                                onChange={(e) =>
                                  updateMethodEvalSubject(methodKey, originalIdx, {
                                    params: {
                                      ...subject.params,
                                      weightPercent: Math.max(
                                        0,
                                        Math.min(100, parseInt(e.target.value) || 0),
                                      ),
                                    },
                                  })
                                }
                                className="text-xs h-8"
                                min={0}
                                max={100}
                              />
                            </FormFieldRow>
                          </div>
                          <FormFieldRow
                            label="岗位工作经历"
                            labelClassName="text-[11px] text-gray-500"
                          >
                            <Input
                              value={subject.params?.jobExperience || ''}
                              onChange={(e) =>
                                updateMethodEvalSubject(methodKey, originalIdx, {
                                  params: { ...subject.params, jobExperience: e.target.value },
                                })
                              }
                              placeholder="请填写岗位工作经历要求"
                              className="text-xs h-8"
                            />
                          </FormFieldRow>
                        </>
                      )}
                      {subject.type === 'peer' && (
                        <>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <FormFieldRow
                              label="互评人数"
                              labelClassName="text-[11px] text-gray-500"
                            >
                              <Input
                                type="number"
                                value={subject.params?.peerCount || 3}
                                onChange={(e) =>
                                  updateMethodEvalSubject(methodKey, originalIdx, {
                                    params: {
                                      ...subject.params,
                                      peerCount: Math.max(1, parseInt(e.target.value) || 1),
                                    },
                                  })
                                }
                                className="text-xs h-8"
                                min={1}
                              />
                              {(subject.params?.peerCount || 3) > 1 && (
                                <FormFieldRow
                                  label="统计规则"
                                  labelClassName="text-[11px] text-gray-500"
                                  className="mt-1"
                                >
                                  <Select
                                    value={subject.params?.aggregationRule || 'average'}
                                    onValueChange={(v) =>
                                      updateMethodEvalSubject(methodKey, originalIdx, {
                                        params: {
                                          ...subject.params,
                                          aggregationRule: v as
                                            'average' | 'median' | 'max' | 'min',
                                        },
                                      })
                                    }
                                  >
                                    <SelectTrigger className="text-xs h-8">
                                      <SelectValue placeholder="选择统计规则" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="average">平均值</SelectItem>
                                      <SelectItem value="median">中位数</SelectItem>
                                      <SelectItem value="max">最高分</SelectItem>
                                      <SelectItem value="min">最低分</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </FormFieldRow>
                              )}
                            </FormFieldRow>
                            <FormFieldRow
                              label="评分权重 (%)"
                              labelClassName="text-[11px] text-gray-500"
                            >
                              <Input
                                type="number"
                                value={subject.params?.weightPercent || 0}
                                onChange={(e) =>
                                  updateMethodEvalSubject(methodKey, originalIdx, {
                                    params: {
                                      ...subject.params,
                                      weightPercent: Math.max(
                                        0,
                                        Math.min(100, parseInt(e.target.value) || 0),
                                      ),
                                    },
                                  })
                                }
                                className="text-xs h-8"
                                min={0}
                                max={100}
                              />
                            </FormFieldRow>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <FormFieldRow
                              label="互评规则"
                              labelClassName="text-[11px] text-gray-500"
                            >
                              <Select
                                value={subject.params?.peerRule || ''}
                                onValueChange={(v) =>
                                  updateMethodEvalSubject(methodKey, originalIdx, {
                                    params: { ...subject.params, peerRule: v },
                                  })
                                }
                              >
                                <SelectTrigger className="text-xs h-8">
                                  <SelectValue placeholder="选择互评规则" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="随机分配">随机分配</SelectItem>
                                  <SelectItem value="相邻座位">相邻座位</SelectItem>
                                  <SelectItem value="自由组合">自由组合</SelectItem>
                                  <SelectItem value="指定分组">指定分组</SelectItem>
                                </SelectContent>
                              </Select>
                            </FormFieldRow>
                            <div className="flex items-end pb-1">
                              <div className="flex items-center gap-1.5">
                                <Switch
                                  checked={subject.params?.anonymous || false}
                                  onCheckedChange={(v) =>
                                    updateMethodEvalSubject(methodKey, originalIdx, {
                                      params: { ...subject.params, anonymous: v },
                                    })
                                  }
                                />
                                <span className="text-[11px] text-gray-600">匿名评价</span>
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                      {subject.type === 'self' && (
                        <>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <FormFieldRow
                              label="评分权重 (%)"
                              labelClassName="text-[11px] text-gray-500"
                            >
                              <Input
                                type="number"
                                value={subject.params?.weightPercent || 0}
                                onChange={(e) =>
                                  updateMethodEvalSubject(methodKey, originalIdx, {
                                    params: {
                                      ...subject.params,
                                      weightPercent: Math.max(
                                        0,
                                        Math.min(100, parseInt(e.target.value) || 0),
                                      ),
                                    },
                                  })
                                }
                                className="text-xs h-8"
                                min={0}
                                max={100}
                              />
                            </FormFieldRow>
                            <div className="flex items-end pb-1">
                              <div className="flex items-center gap-1.5">
                                <Switch
                                  checked={subject.params?.requiresReflection || false}
                                  onCheckedChange={(v) =>
                                    updateMethodEvalSubject(methodKey, originalIdx, {
                                      params: { ...subject.params, requiresReflection: v },
                                    })
                                  }
                                />
                                <span className="text-[11px] text-gray-600">需要提交反思报告</span>
                              </div>
                            </div>
                          </div>
                          {subject.params?.requiresReflection && (
                            <FormFieldRow
                              label="反思报告最少字数"
                              labelClassName="text-[11px] text-gray-500"
                            >
                              <Input
                                type="number"
                                value={subject.params?.reflectionMinLength || 300}
                                onChange={(e) =>
                                  updateMethodEvalSubject(methodKey, originalIdx, {
                                    params: {
                                      ...subject.params,
                                      reflectionMinLength: Math.max(
                                        100,
                                        parseInt(e.target.value) || 100,
                                      ),
                                    },
                                  })
                                }
                                className="text-xs h-8 w-28"
                                min={100}
                              />
                            </FormFieldRow>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
        </div>
      </div>
    )
  }

  const bodyContent = (
    <>
      {config.evaluationMethods.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-gray-400 py-12">
          <Target className="h-12 w-12 mb-3 opacity-50" />
          <p className="text-sm">尚未配置评价方式</p>
          <p className="text-xs mt-1">请先在「配置课程测评方式」中选择评价类型</p>
        </div>
      ) : (
        <div className="space-y-5 p-1">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-9"
              onClick={() => setIsOrderConfigOpen(true)}
            >
              <ListOrdered className="h-3.5 w-3.5 mr-1.5" />
              配置评价顺序
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-9"
              onClick={() => setIsWeightConfigOpen(true)}
            >
              <Scale className="h-3.5 w-3.5 mr-1.5" />
              配置评价权重
              <span
                className={cn(
                  'ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium',
                  methodWeightTotal === 100
                    ? 'bg-green-50 text-green-600'
                    : 'bg-red-50 text-red-600',
                )}
              >
                {methodWeightTotal}%
              </span>
            </Button>
          </div>

          <Dialog open={isOrderConfigOpen} onOpenChange={setIsOrderConfigOpen}>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>评价方式顺序配置</DialogTitle>
                <DialogDescription>点击箭头调整评价方式的执行顺序</DialogDescription>
              </DialogHeader>
              <div className="space-y-1.5 py-4">
                {getMethodInstances().map(({ methodKey, instanceIndex }, index) => {
                  const method = evaluationMethodOptions.find((o) => o.key === methodKey)
                  if (!method) return null
                  const instanceCount = methodInstanceCounts[methodKey] || 1
                  const displayLabel =
                    instanceCount > 1 ? `${method.label} ${instanceIndex + 1}` : method.label
                  return (
                    <div
                      key={`${methodKey}-${instanceIndex}`}
                      className="flex items-center gap-3 p-2.5 rounded-lg border border-gray-100 bg-gray-50/50"
                    >
                      <span className="w-5 h-5 rounded-full bg-gray-200 text-gray-500 text-[10px] flex items-center justify-center font-medium">
                        {index + 1}
                      </span>
                      <div className={cn('p-1.5 rounded-md', method.color)}>{method.icon}</div>
                      <span className="text-sm font-medium flex-1">{displayLabel}</span>
                      <div className="flex items-center gap-0.5">
                        <button
                          onClick={() => moveMethodUp(index)}
                          disabled={index === 0}
                          className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-200/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          <ChevronUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => moveMethodDown(index)}
                          disabled={index === getMethodInstances().length - 1}
                          className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-200/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
              <DialogFooter>
                <Button onClick={() => setIsOrderConfigOpen(false)}>完成</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isWeightConfigOpen} onOpenChange={setIsWeightConfigOpen}>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>评价方式权重配置</DialogTitle>
                <DialogDescription>配置各评价方式的权重占比，合计需等于 100%</DialogDescription>
              </DialogHeader>
              <div className="py-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div
                    className={cn(
                      'flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium',
                      methodWeightTotal === 100
                        ? 'bg-green-50 text-green-600'
                        : 'bg-red-50 text-red-600',
                    )}
                  >
                    <span>合计</span>
                    <span>{methodWeightTotal}%</span>
                    {methodWeightTotal !== 100 && <span className="text-[10px]">(需等于100%)</span>}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-8"
                    onClick={distributeMethodWeights}
                  >
                    <RotateCcw className="h-3.5 w-3.5 mr-1" />
                    一键平均
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {getMethodInstances().map(({ methodKey, instanceIndex }) => {
                    const method = evaluationMethodOptions.find((o) => o.key === methodKey)
                    if (!method) return null
                    const instanceCount = methodInstanceCounts[methodKey] || 1
                    const displayLabel =
                      instanceCount > 1 ? `${method.label} ${instanceIndex + 1}` : method.label
                    const weight = config.methodWeights[methodKey] || 0
                    return (
                      <div
                        key={`${methodKey}-${instanceIndex}`}
                        className="flex items-center gap-2.5 p-3 rounded-lg border border-gray-100 bg-gray-50/50"
                      >
                        <div className={cn('p-1.5 rounded-md shrink-0', method.color)}>
                          {method.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-700 truncate">
                            {displayLabel}
                          </p>
                          <div className="flex items-center gap-1 mt-1">
                            <Input
                              type="number"
                              value={weight}
                              onChange={(e) =>
                                updateMethodWeight(methodKey, parseInt(e.target.value) || 0)
                              }
                              className="h-7 text-xs w-16 text-center"
                              min={0}
                              max={100}
                            />
                            <span className="text-xs text-gray-400">%</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => setIsWeightConfigOpen(false)}>完成</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {getMethodInstances().map(({ methodKey, instanceIndex }) => {
            const method = evaluationMethodOptions.find((o) => o.key === methodKey)
            if (!method) return null
            const instanceCount = methodInstanceCounts[methodKey] || 1
            const displayLabel =
              instanceCount > 1 ? `${method.label} ${instanceIndex + 1}` : method.label
            return (
              <div
                key={`${methodKey}-${instanceIndex}`}
                className="border rounded-xl overflow-hidden bg-white"
              >
                <div className={cn('flex items-center gap-3 px-4 py-3 border-b bg-gray-50/80')}>
                  <div className={cn('p-1.5 rounded-md', method.color)}>{method.icon}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{displayLabel}</p>
                    <p className="text-xs text-gray-400">{method.desc}</p>
                  </div>
                </div>
                <div className="p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                    <ObjectCard
                      methodKey={methodKey}
                      onClick={() => openDialog('object', methodKey)}
                    />
                    <SubjectCard
                      methodKey={methodKey}
                      onClick={() => openDialog('subject', methodKey)}
                    />
                    <ResourceCard
                      methodKey={methodKey}
                      onClick={() => openDialog('resource', methodKey)}
                    />
                    {methodKey === 'question_bank' ||
                    methodKey === 'paper' ||
                    methodKey === 'quiz' ? (
                      <StepCard
                        tone="success"
                        step={4}
                        title="评价标准配置"
                        icon={<Target className="h-4 w-4" />}
                        summary="自动读取得分"
                        description="系统将自动读取测评资源的得分"
                        configured
                      />
                    ) : (
                      <MethodCard
                        methodKey={methodKey}
                        onClick={() => openDialog('method', methodKey)}
                      />
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )

  const subDialogs = (
    <>
      <Dialog open={erDialogOpen === 'object'} onOpenChange={(v) => !v && setErDialogOpen(null)}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>测评对象配置</DialogTitle>
            <DialogDescription>
              配置{' '}
              {erDialogMethod
                ? evaluationMethodOptions.find((o) => o.key === erDialogMethod)?.label
                : ''}{' '}
              的测评对象
            </DialogDescription>
          </DialogHeader>
          {erDialogMethod && renderObjectDialogContent(erDialogMethod)}
        </DialogContent>
      </Dialog>

      <Dialog open={erDialogOpen === 'subject'} onOpenChange={(v) => !v && setErDialogOpen(null)}>
        <DialogContent size="xl">
          <DialogHeader>
            <DialogTitle>评价主体配置</DialogTitle>
            <DialogDescription>
              配置{' '}
              {erDialogMethod
                ? evaluationMethodOptions.find((o) => o.key === erDialogMethod)?.label
                : ''}{' '}
              的评价主体
            </DialogDescription>
          </DialogHeader>
          {erDialogMethod && renderSubjectDialogContent(erDialogMethod)}
        </DialogContent>
      </Dialog>

      <Dialog open={erDialogOpen === 'resource'} onOpenChange={(v) => !v && setErDialogOpen(null)}>
        <DialogContent className="sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>测评资源配置</DialogTitle>
            <DialogDescription>
              配置{' '}
              {erDialogMethod
                ? evaluationMethodOptions.find((o) => o.key === erDialogMethod)?.label
                : ''}{' '}
              的测评资源
            </DialogDescription>
          </DialogHeader>
          {evalResourceOnlyPanel}
        </DialogContent>
      </Dialog>

      <Dialog open={erDialogOpen === 'method'} onOpenChange={(v) => !v && setErDialogOpen(null)}>
        <DialogContent className="sm:max-w-6xl">
          <DialogHeader>
            <DialogTitle>评价标准配置</DialogTitle>
            <DialogDescription>
              配置{' '}
              {erDialogMethod
                ? evaluationMethodOptions.find((o) => o.key === erDialogMethod)?.label
                : ''}{' '}
              的评价点与评分规则
            </DialogDescription>
          </DialogHeader>
          {methodDialogContent}
        </DialogContent>
      </Dialog>

      <Dialog open={questionDetailOpen} onOpenChange={setQuestionDetailOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>题目详情</DialogTitle>
          </DialogHeader>
          {null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuestionDetailOpen(false)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddQuestion} onOpenChange={setShowAddQuestion}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>新增题目</DialogTitle>
          </DialogHeader>
          <div className="py-8 text-center text-gray-500">请前往题库管理添加题目</div>
          <DialogFooter>
            <Button onClick={() => setShowAddQuestion(false)}>知道了</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={rubricKpDialogOpen}
        onOpenChange={(v) => {
          if (!v) setRubricKpDialogOpen(false)
        }}
      >
        <DialogContent
          className="sm:max-w-3xl max-h-[90vh] flex flex-col"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>关联考查知识点</DialogTitle>
            <DialogDescription>
              此处仅可选择任务关联的知识点/能力点，请先在任务中配置后选择。
            </DialogDescription>
          </DialogHeader>
          {(() => {
            const field = rubricKpTargetField as EvalPointField | null
            const pointId = rubricKpTargetPointId
            const ep = field && pointId ? getEvalPoints(field).find((p) => p.id === pointId) : null
            const selectedIds = ep?.knowledgePointIds || []
            const filteredKp = knowledgePoints.filter(
              (k) =>
                !rubricKpSearch ||
                k.name.includes(rubricKpSearch) ||
                k.description?.includes(rubricKpSearch) ||
                (k.code && k.code.includes(rubricKpSearch)),
            )
            const toggleKp = (kpId: string) => {
              if (!field || !pointId) return
              const newIds = selectedIds.includes(kpId)
                ? selectedIds.filter((id) => id !== kpId)
                : [...selectedIds, kpId]
              updateEvalPoint(field, pointId, { knowledgePointIds: newIds })
            }
            return (
              <div className="flex gap-4 flex-1 min-h-0 py-2 max-lg:flex-col">
                <div className="w-full lg:w-3/5 flex flex-col min-h-0 border rounded-xl p-3">
                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      value={rubricKpSearch}
                      onChange={(e) => setRubricKpSearch(e.target.value)}
                      placeholder="搜索知识点名称、描述或编码..."
                      className="pl-9"
                    />
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm min-w-[560px]">
                        <thead className="bg-gray-50 sticky top-0 z-10">
                          <tr>
                            <th className="text-left text-xs font-medium text-gray-500 px-3 py-2 w-[30%]">
                              知识点名称
                            </th>
                            <th className="text-left text-xs font-medium text-gray-500 px-3 py-2 w-[20%]">
                              编码
                            </th>
                            <th className="text-left text-xs font-medium text-gray-500 px-3 py-2 w-[35%]">
                              描述
                            </th>
                            <th className="text-right text-xs font-medium text-gray-500 px-3 py-2 w-[15%]">
                              操作
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {filteredKp.map((kp) => {
                            const isSelected = selectedIds.includes(kp.id)
                            return (
                              <tr
                                key={kp.id}
                                className={cn(
                                  'hover:bg-gray-50 cursor-pointer',
                                  isSelected ? 'bg-primary/[0.03]' : '',
                                )}
                                onClick={() => toggleKp(kp.id)}
                              >
                                <td className="px-3 py-2">
                                  <div className="flex items-center gap-2">
                                    <div
                                      className={cn(
                                        'w-4 h-4 rounded border flex items-center justify-center shrink-0',
                                        isSelected
                                          ? 'bg-primary border-primary'
                                          : 'border-gray-300',
                                      )}
                                    >
                                      {isSelected && <Check className="h-3 w-3 text-white" />}
                                    </div>
                                    <span className="text-sm font-medium text-gray-800">
                                      {kp.name}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-3 py-2">
                                  {kp.code ? (
                                    <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                                      {kp.code}
                                    </Badge>
                                  ) : (
                                    <span className="text-xs text-gray-400">-</span>
                                  )}
                                </td>
                                <td className="px-3 py-2">
                                  <p className="text-xs text-gray-500 line-clamp-1">
                                    {kp.description}
                                  </p>
                                </td>
                                <td className="px-3 py-2 text-right">
                                  {isSelected ? (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-6 text-[11px] px-2"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        toggleKp(kp.id)
                                      }}
                                    >
                                      取消
                                    </Button>
                                  ) : (
                                    <Button
                                      size="sm"
                                      className="h-6 text-[11px] px-2"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        toggleKp(kp.id)
                                      }}
                                    >
                                      选择
                                    </Button>
                                  )}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
                <div className="w-full lg:w-2/5 border rounded-xl p-3 flex flex-col min-h-0">
                  <p className="text-sm font-medium mb-3 text-gray-700">
                    已选择知识点 ({selectedIds.length})
                  </p>
                  <div className="flex-1 overflow-y-auto space-y-2">
                    {selectedIds.length === 0 && (
                      <div className="text-center text-gray-400 py-8">
                        <Lightbulb className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-xs">从左侧选择知识点</p>
                      </div>
                    )}
                    {selectedIds.map((kpId) => {
                      const kp = knowledgePoints.find((k) => k.id === kpId)
                      if (!kp) return null
                      return (
                        <div
                          key={kpId}
                          className="p-2 rounded-lg border border-primary/20 bg-primary/5"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium flex-1 truncate">{kp.name}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5 text-gray-400"
                              onClick={() => toggleKp(kpId)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                          <p className="text-[10px] text-gray-500 line-clamp-1">{kp.description}</p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )
          })()}
          <DialogFooter>
            <Button onClick={() => setRubricKpDialogOpen(false)}>完成</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={rubricAbDialogOpen}
        onOpenChange={(v) => {
          if (!v) setRubricAbDialogOpen(false)
        }}
      >
        <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>关联考查能力点</DialogTitle>
            <DialogDescription>
              此处仅可选择任务关联的知识点/能力点，请先在任务中配置后选择。
            </DialogDescription>
          </DialogHeader>
          {(() => {
            const field = rubricAbTargetField as EvalPointField | null
            const pointId = rubricAbTargetPointId
            const ep = field && pointId ? getEvalPoints(field).find((p) => p.id === pointId) : null
            const selectedIds = ep?.abilityPointIds || []
            const filteredAb = abilityPoints.filter(
              (a) =>
                !rubricAbSearch ||
                a.name.includes(rubricAbSearch) ||
                a.description?.includes(rubricAbSearch) ||
                (a.code && a.code.includes(rubricAbSearch)),
            )
            const toggleAb = (abId: string) => {
              if (!field || !pointId) return
              const newIds = selectedIds.includes(abId)
                ? selectedIds.filter((id) => id !== abId)
                : [...selectedIds, abId]
              updateEvalPoint(field, pointId, { abilityPointIds: newIds })
            }
            return (
              <div className="flex gap-4 flex-1 min-h-0 py-2 max-lg:flex-col">
                <div className="w-full lg:w-3/5 flex flex-col min-h-0 border rounded-xl p-3">
                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      value={rubricAbSearch}
                      onChange={(e) => setRubricAbSearch(e.target.value)}
                      placeholder="搜索能力点名称、描述或编码..."
                      className="pl-9"
                    />
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm min-w-[560px]">
                        <thead className="bg-gray-50 sticky top-0 z-10">
                          <tr>
                            <th className="text-left text-xs font-medium text-gray-500 px-3 py-2 w-[30%]">
                              能力点名称
                            </th>
                            <th className="text-left text-xs font-medium text-gray-500 px-3 py-2 w-[20%]">
                              编码
                            </th>
                            <th className="text-left text-xs font-medium text-gray-500 px-3 py-2 w-[35%]">
                              描述
                            </th>
                            <th className="text-right text-xs font-medium text-gray-500 px-3 py-2 w-[15%]">
                              操作
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {filteredAb.map((ab) => {
                            const isSelected = selectedIds.includes(ab.id)
                            return (
                              <tr
                                key={ab.id}
                                className={cn(
                                  'hover:bg-gray-50 cursor-pointer',
                                  isSelected ? 'bg-primary/[0.03]' : '',
                                )}
                                onClick={() => toggleAb(ab.id)}
                              >
                                <td className="px-3 py-2">
                                  <div className="flex items-center gap-2">
                                    <div
                                      className={cn(
                                        'w-4 h-4 rounded border flex items-center justify-center shrink-0',
                                        isSelected
                                          ? 'bg-primary border-primary'
                                          : 'border-gray-300',
                                      )}
                                    >
                                      {isSelected && <Check className="h-3 w-3 text-white" />}
                                    </div>
                                    <span className="text-sm font-medium text-gray-800">
                                      {ab.name}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-3 py-2">
                                  {ab.code ? (
                                    <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                                      {ab.code}
                                    </Badge>
                                  ) : (
                                    <span className="text-xs text-gray-400">-</span>
                                  )}
                                </td>
                                <td className="px-3 py-2">
                                  <p className="text-xs text-gray-500 line-clamp-1">
                                    {ab.description}
                                  </p>
                                </td>
                                <td className="px-3 py-2 text-right">
                                  {isSelected ? (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-6 text-[11px] px-2"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        toggleAb(ab.id)
                                      }}
                                    >
                                      取消
                                    </Button>
                                  ) : (
                                    <Button
                                      size="sm"
                                      className="h-6 text-[11px] px-2"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        toggleAb(ab.id)
                                      }}
                                    >
                                      选择
                                    </Button>
                                  )}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
                <div className="w-full lg:w-2/5 border rounded-xl p-3 flex flex-col min-h-0">
                  <p className="text-sm font-medium mb-3 text-gray-700">
                    已选择能力点 ({selectedIds.length})
                  </p>
                  <div className="flex-1 overflow-y-auto space-y-2">
                    {selectedIds.length === 0 && (
                      <div className="text-center text-gray-400 py-8">
                        <Award className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-xs">从左侧选择能力点</p>
                      </div>
                    )}
                    {selectedIds.map((abId) => {
                      const ab = abilityPoints.find((a) => a.id === abId)
                      if (!ab) return null
                      return (
                        <div
                          key={abId}
                          className="p-2 rounded-lg border border-primary/20 bg-primary/5"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium flex-1 truncate">{ab.name}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5 text-gray-400"
                              onClick={() => toggleAb(abId)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                          <p className="text-[10px] text-gray-500 line-clamp-1">{ab.description}</p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )
          })()}
          <DialogFooter>
            <Button onClick={() => setRubricAbDialogOpen(false)}>完成</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )

  if (inline) {
    return (
      <div className={cn('space-y-4', className)}>
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-primary/10 rounded">
            <Award className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-base font-semibold">{title}</h3>
            <p className="text-xs text-gray-500">
              配置各评价方式的测评对象、评价主体、测评资源与评价标准
            </p>
          </div>
        </div>
        <div className="border rounded-xl p-4 bg-white">{bodyContent}</div>
        {subDialogs}
      </div>
    )
  }

  return (
    <>
      {bodyContent}
      {subDialogs}
    </>
  )
}

export default EvaluationRulesEditor
