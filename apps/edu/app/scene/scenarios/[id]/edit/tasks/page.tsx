'use client'

import {
  ArrowRight,
  CheckCircle2,
  Copy,
  FileText,
  GripVertical,
  Plus,
  Scale,
  Star,
  Trash2,
  Check,
  Award,
  Code,
  Database,
  Users,
  Wrench,
  Lock,
  Unlock,
  ChevronDown,
  AlertCircle,
  ChevronRight,
  PieChart as PieChartIcon,
  Shield,
  Server,
  BookOpen,
  Sparkles,
  Undo2,
  Loader2,
} from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import {
  scenarioApi,
  taskApi,
  knowledgeApi,
  abilityApi,
  positionApi,
  industryApi,
  majorApi,
  taskResourceApi,
  taskEvaluationApi,
  scenarioWeightApi,
  resourceLibraryApi,
} from '@/lib/api'
import type { ScenarioTask as ApiScenarioTask } from '@/lib/types/scene'
import { EvaluationRulesEditor } from '@/components/evaluation-rules'
import { useToast, EmptyState, FormDialogFooter } from '@zhiyu/ui'
import { EditorShell } from '@/components/shared/editor-shell'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { EvalMethodSelector } from '@/components/shared/eval-method-selector'
import { SearchInput } from '@/components/shared/search-input'
import { KnowledgeSelector } from '@/components/shared/knowledge-selector'
import type { KnowledgePointItem } from '@/lib/types/lesson'
import { ResourceSelector, type ResourceItem } from '@/components/shared/resource-selector'
import {
  useTaskDatasets,
  type TaskResourceItem,
  type UseTaskDatasetsResult,
  type TaskKnowledgePointItem,
} from './_components/hooks/use-task-datasets'
import { TaskInfoCard } from './_components/task-info-card'
import { TaskDescriptionCard } from './_components/task-description-card'
import { TaskWeightCard } from './_components/task-weight-card'
import {
  cardConfigs,
  defaultGradeMapping,
  evaluationMethodOptions,
  makeDefaultTaskState,
  taskStateFromMethods,
  taskStateToEvalRuleConfig,
  taskStateToMethodsInput,
  evalRuleConfigToTaskStateUpdates,
  type CardType,
  type EvalPoint,
  type TaskState,
} from './_components/tasks-logic'
import { useAuth } from '@/components/auth-provider'
import { reportError } from '@/lib/error-handling'
import { useT } from '@/lib/i18n/locale-provider'
import type { Task } from '@/lib/types/scene-mock'
import type { Scenario } from '@/lib/types/scene'
import type { CareerPosition } from '@/lib/types/job'
import { COMPETENCY_LEVEL_LABELS } from '@/lib/types/job-source'
import type { ResourceKind } from '@/lib/types'
import { scenarioAiAssist } from '@/lib/api'
import type {
  AIScenarioAssistField,
  AIScenarioAssistResponse,
  AIScenarioSuggestion,
  AIScenarioTaskChainTask,
} from '@/lib/api'
import { ToastAction } from '@/components/ui/toast'
import { AiAssistProgressDialog } from '@/components/job/position-builder/ai-assist-progress-dialog'
import { AiNotConfiguredDialog } from '@/components/shared/ai-not-configured-dialog'
import { useAiNotConfigured, useAiFieldWriter, useAiPipeline } from '@/lib/ai/use-ai-assist'
import { AiTaskChainSuggestion, type TaskChainMode } from './_components/ai-task-chain-suggestion'

// 详情头部展示用场景增强模型（附加已解析的名称/共建人）
interface EnrichedScenario extends Scenario {
  positionId?: string
  positionName?: string
  industryName?: string
  professionName?: string
  industryId?: string
  professionId?: string
  coBuilders: { id: string; name: string }[]
}

// 克隆候选场景：附带任务与元信息
interface ClonedScenario extends Scenario {
  tasks?: Array<
    ApiScenarioTask & {
      scenarioName?: string
      scenarioCreatorId?: string
      scenarioCoBuilderIds?: string[]
      scenarioStatus?: string
    }
  >
}

// 岗位列表项可能携带 industryName（后端返回，类型未收录）
type PositionWithIndustryName = CareerPosition & { industryName?: string }

// ===== 任务卡片 AI 辅助编写（交互与岗位样板一致：直接写入 + 恢复上版 + 进度弹窗 + 412 引导） =====

/** AI 可直接写入的任务字段键（1 级撤销历史） */
type TaskAiFieldKey = 'name' | 'background' | 'difficulty' | 'description' | 'knowledge' | 'ability' | 'resources'

/** 各卡片 → AI field 映射（后端 /ai/scenario-assist） */
const AI_FIELD_BY_CARD: Partial<Record<CardType, AIScenarioAssistField>> = {
  info: 'taskPolish',
  description: 'taskDescription',
  knowledge: 'taskKnowledge',
  ability: 'taskAbility',
  resources: 'taskResource',
}

/** 各卡片可写字段键（模块常量保证 hooks keys 引用稳定） */
const AI_KEYS_BY_CARD: Partial<Record<CardType, TaskAiFieldKey[]>> = {
  info: ['name', 'background', 'difficulty'],
  description: ['description'],
  knowledge: ['knowledge'],
  ability: ['ability'],
  resources: ['resources'],
}

const AI_KEYS_NONE: TaskAiFieldKey[] = []

/** 各卡片 AI 进度弹窗步骤 */
const AI_STEPS_BY_CARD: Partial<Record<CardType, string[]>> = {
  info: ['阅读任务信息', '生成任务基础信息'],
  description: ['阅读任务信息', '生成任务说明'],
  knowledge: ['阅读任务信息', '推荐考查知识点'],
  ability: ['阅读任务信息', '推荐考查能力点'],
  resources: ['阅读任务信息', '推荐任务资源'],
}

const AI_STEPS_DEFAULT = ['阅读任务信息', 'AI 生成中']

/** 字段中文名（恢复上版按钮/未生成提示用） */
const AI_FIELD_LABELS: Record<TaskAiFieldKey, string> = {
  name: '任务名称',
  background: '任务背景',
  difficulty: '难度等级',
  description: '任务说明',
  knowledge: '考查知识点',
  ability: '考查能力点',
  resources: '任务资源',
}

// ============ Main Page ============

export default function TasksEditPage() {
  const params = useParams()
  const router = useRouter()
  const scenarioId = params.id as string
  const { toast } = useToast()
  const { user } = useAuth()
  const t = useT()

  const datasets = useTaskDatasets()

  const [existingScenario, setExistingScenario] = useState<EnrichedScenario | null>(null)
    const [loadFailed, setLoadFailed] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const [tasks, setTasks] = useState<Task[]>([])
  const [taskStates, setTaskStates] = useState<Record<string, TaskState>>({})

  const [professions, setProfessions] = useState<any[]>([])

  const scenarioDataRef = useRef<Scenario | null>(null)
  const taskStatesRef = useRef(taskStates)
  // AI 任务链建议面板的挂载容器（portal 目标，脱离按钮行整行全宽展示）
  const aiTaskChainPanelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    taskStatesRef.current = taskStates
  }, [taskStates])

  const { loadDatasets } = datasets
  const ensureDatasets = useCallback(
    async (keys: string[]) => {
      await loadDatasets(keys, {
        taskStatesRef,
        setExistingScenario: (updater) =>
          setExistingScenario(updater as React.SetStateAction<EnrichedScenario | null>),
        scenarioDataRef,
      })
    },
    [loadDatasets],
  )
  // 首屏加载 effect 仅以 scenarioId 触发一次；易变依赖（locale/t/数据集加载）
  // 用 ref 持有，避免切换语言/用户解析晚到时整页重载重建 taskStates（未保存编辑丢失）
  const ensureDatasetsRef = useRef(ensureDatasets)
  const toastRef = useRef(toast)
  const tRef = useRef(t)
  useEffect(() => {
    ensureDatasetsRef.current = ensureDatasets
    toastRef.current = toast
    tRef.current = t
  })



  // Load core data on mount (其余数据集按卡片/对话框首次激活时懒加载)
  useEffect(() => {
    const load = async () => {
      try {
        const [scenarioData, tasksRes, posRes, indRes, majRes] = await Promise.all([
          scenarioApi.get(scenarioId),
          taskApi.list({ scenarioId, limit: 1000 }),
          positionApi.list({ limit: 1000 }),
          industryApi.list({ limit: 1000 }),
          majorApi.list({ limit: 1000 }),
        ])
        scenarioDataRef.current = scenarioData

        const positionName =
          posRes.items.find((p) => p.id === scenarioData.careerPositionId)?.name ||
          scenarioData.careerPositionId
        const industryName =
          (scenarioData.industryNames || []).join('、') ||
          (scenarioData.industryIds || [])
            .map((id: string) => indRes.items.find((i) => i.id === id)?.name)
            .filter(Boolean)
            .join('、') ||
          (scenarioData.industryIds || []).join('、')
        const professionName =
          (scenarioData.professionNames || []).join('、') ||
          (scenarioData.professionIds || [])
            .map((id: string) => majRes.items.find((m) => m.id === id)?.name)
            .filter(Boolean)
            .join('、') ||
          (scenarioData.professionIds || []).join('、')
        setExistingScenario((prev: EnrichedScenario | null) => {
          // 保留已解析的共建人姓名（避免 user?.id 变化导致 effect 重跑时覆盖掉已补齐的名称）
          const prevNameMap: Record<string, string> = {}
          if (prev?.coBuilders) {
            prev.coBuilders.forEach((cb) => {
              if (cb.name && cb.name !== cb.id) prevNameMap[cb.id] = cb.name
            })
          }
          return {
            ...scenarioData,
            positionId: scenarioData.careerPositionId,
            positionName,
            industryName,
            professionName,
            coBuilders: (scenarioData.coBuilderIds || []).map((id: string) => ({
              id,
              name: prevNameMap[id] || id,
            })),
          }
        })

        const nextProfessions: Array<{
          id: string
          name: string
          positions: Array<{ id: string; name: string; professionId: string }>
        }> = []
        posRes.items.forEach((p) => {
        const pos = p as PositionWithIndustryName
        const prof = nextProfessions.find((pr) => pr.name === (pos.industryName || tRef.current('其他')))
        if (prof) {
          prof.positions.push({ id: pos.id, name: pos.name, professionId: prof.id })
        } else {
          nextProfessions.push({
            id: `prof-${nextProfessions.length + 1}`,
            name: pos.industryName || tRef.current('其他'),
              positions: [
                { id: pos.id, name: pos.name, professionId: `prof-${nextProfessions.length + 1}` },
              ],
            })
          }
        })
        setProfessions(nextProfessions)

        // Convert API tasks to mock Task format
        const apiTasks = tasksRes.items
        const mockTasks: Task[] = apiTasks.map((at: ApiScenarioTask) => ({
          id: at.id,
          name: at.name,
          code: at.code,
          order: at.sortOrder,
          description: at.description || '',
          detailedDescription: at.detailedDescription || undefined,
          descriptionPdf: at.descriptionPdf || undefined,
          estimatedHours: at.estimatedHours,
          taskType: at.taskType as 'assessment' | 'training',
          difficulty: (at.difficulty || 3) as 1 | 2 | 3 | 4 | 5,
          background: at.background || '',
          dependencies: at.dependencyIds || [],
          resources: at.resourceIds || [],
          deliverables: [],
          knowledgePoints: at.knowledgePointIds || [],
          knowledgePointNames: at.knowledgePointNames || [],
          abilityPoints: at.abilityPointIds || [],
          abilityPointNames: at.abilityPointNames || [],
          assessment: null,
          isReferenced: at.isReferenced || false,
          sourceScenarioId: at.sourceScenarioId || undefined,
          sourceScenarioName: undefined,
        }))

        setTasks(mockTasks)

        // Fetch evaluation methods for all tasks
        const allMethods = await Promise.all(
          mockTasks.map((t) => taskEvaluationApi.listMethods(t.id).catch(() => ({ methods: [] }))),
        )

        // Initialize taskStates from API method data
        const count = mockTasks.length
        const states: Record<string, TaskState> = {}
        mockTasks.forEach((t, i) => {
          const methods = allMethods[i]?.methods || []
          let ts = taskStateFromMethods(methods)
          if (t.knowledgePoints) ts.knowledgePoints = t.knowledgePoints
          if (t.abilityPoints) ts.abilityPoints = t.abilityPoints
          if (t.resources) ts.resources = t.resources
          if (t.detailedDescription) ts.description = t.detailedDescription
          if (t.descriptionPdf) ts.descriptionPdf = t.descriptionPdf
          ts.weight = count > 0 ? Math.floor(100 / count) + (i < 100 % count ? 1 : 0) : 0
          ts.gradeMapping = JSON.parse(JSON.stringify(defaultGradeMapping))
          states[t.id] = ts
        })
        // 已保存的权重优先：从后端读取覆盖均分默认值（含锁定标记）
        try {
          const wres = await scenarioWeightApi.list({ scenarioId })
          const weightById = new Map(wres.items?.map((w) => [w.taskId, w.weight]) || [])
          Object.keys(states).forEach((tid) => {
            if (weightById.has(tid)) {
              states[tid].weight = weightById.get(tid)!
              states[tid].locked = true
            }
          })
        } catch (err) {
          // 权重拉取失败：中止加载——后续保存会把均分默认值覆盖后端真实权重，宁可明确报错
          reportError(err, '加载任务权重')
          throw err
        }
        setTaskStates(states)

        // Preload datasets so card previews show names immediately
        await ensureDatasetsRef.current(['knowledge', 'ability', 'resources', 'evaluation', 'users'])

      } catch (err: any) {
        setLoadFailed(true)
        toast({
          variant: 'destructive',
          title: tRef.current('任务数据加载失败'),
          description: err?.message || tRef.current('请刷新页面重试'),
        })
      }
    }
    load()
    // 仅场景变化时触发一次；locale/用户态变化不再整页重载
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenarioId])

  const [editingCard, setEditingCard] = useState<{ taskId: string; type: CardType } | null>(null)
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false)
  const [isCloneOpen, setIsCloneOpen] = useState(false)

  // 编辑卡片/克隆对话框首次激活时按需懒加载对应数据集
  useEffect(() => {
    if (!editingCard) return
    const datasetByCard: Partial<Record<CardType, string[]>> = {
      knowledge: ['knowledge'],
      ability: ['ability'],
      resources: ['resources'],
      evaluation: ['evaluation', 'users'],
      evaluationRules: ['evaluation', 'users'],
    }
    const keys = datasetByCard[editingCard.type]
    if (keys) void ensureDatasets(keys)
  }, [editingCard, ensureDatasets])

  useEffect(() => {
    if (isCloneOpen) void ensureDatasets(['clone'])
  }, [isCloneOpen, ensureDatasets])

  const [newTask, setNewTask] = useState({
    name: '',
    hours: 4,
    type: 'training' as 'assessment' | 'training',
    difficulty: 3,
    background: '',
  })

  const [cloneSearch, setCloneSearch] = useState('')
  const [cloneMode, setCloneMode] = useState<'clone' | 'reference'>('clone')
  const [cloneTab, setCloneTab] = useState<'my' | 'collab' | 'public'>('my')
  const [selectedClone, setSelectedClone] = useState<string[]>([])
  const [isCloning, setIsCloning] = useState(false)
  const [isWeightConfigOpen, setIsWeightConfigOpen] = useState(false)
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null)
  const [deleteConfirmTask, setDeleteConfirmTask] = useState<{ id: string; name: string } | null>(
    null,
  )

  const allTasks = useMemo(() => {
    void datasets.cloneDataVersion
    return (datasets.scenarios as ClonedScenario[]).flatMap((s) =>
      (s.tasks || []).map((t: any) => ({
        ...t,
        scenarioName: s.name,
        scenarioCreatorId: t.scenarioCreatorId || s.creatorId || '',
        scenarioCoBuilderIds: t.scenarioCoBuilderIds || s.coBuilderIds || [],
        scenarioStatus: t.scenarioStatus || s.status || '',
      })),
    )
  }, [datasets.scenarios, datasets.cloneDataVersion])

  const totalWeight = Object.values(taskStates).reduce((sum, s) => sum + s.weight, 0)

  const getState = (id: string): TaskState => taskStates[id] || makeDefaultTaskState(0, 0)

  const updateState = (id: string, updates: Partial<TaskState>) => {
    setTaskStates((prev) => {
      const base = prev[id] || makeDefaultTaskState(0, 0)
      return { ...prev, [id]: { ...base, ...updates } }
    })
  }

  const getSummary = (taskId: string, type: CardType): string => {
    const task = tasks.find((t) => t.id === taskId)
    const state = getState(taskId)
    if (!task) return ''

    switch (type) {
      case 'info':
        return t('任务名称：{name}\n编码：{code}\n任务类型：{type}\n难度：{difficulty}星\n预估学时：{hours}小时', {
          name: task.name,
          code: task.code || '-',
          type: task.taskType === 'assessment' ? t('考核') : t('训练'),
          difficulty: task.difficulty,
          hours: task.estimatedHours,
        })
      case 'description': {
        if (state.description) return `${state.description.replace(/<[^>]*>/g, '').slice(0, 50)}...`
        if (state.descriptionPdf) return t('已上传附件')
        return t('未填写')
      }
      case 'knowledge': {
        if (state.knowledgePoints.length === 0) return t('未配置')
        // 优先使用服务端随任务返回的名称（与 knowledgePoints 对齐），
        // 再回退全量知识点列表（全量列表接口 maxPageSize=200 会截断）
        const apiNameById = new Map<string, string>()
        ;(task.knowledgePointNames || []).forEach((n, i) => {
          if (task.knowledgePoints[i] && n) apiNameById.set(task.knowledgePoints[i], n)
        })
        const kpNames = state.knowledgePoints
          .map((id) => apiNameById.get(id) || datasets.knowledgePoints.find((k) => k.id === id)?.name)
          .filter(Boolean)
        return (
          kpNames.slice(0, 3).join('、') +
          (kpNames.length > 3 ? t(' 等{n}个', { n: state.knowledgePoints.length }) : '')
        )
      }
      case 'ability': {
        if (state.abilityPoints.length === 0) return t('未配置')
        // 优先使用服务端随任务返回的名称（与 abilityPointIds 对齐），
        // 再回退全量能力点列表与岗位绑定名称（全量列表接口 maxPageSize=200 会截断）
        const apiNameById = new Map<string, string>()
        ;(task.abilityPointNames || []).forEach((n, i) => {
          if (task.abilityPoints[i] && n) apiNameById.set(task.abilityPoints[i], n)
        })
        const bindingNameById = new Map<string, string>()
        datasets.positionAbilityBindings.forEach((b) => {
          const binding = b as { abilityPointId?: string; abilityName?: string }
          if (binding.abilityPointId && binding.abilityName) {
            bindingNameById.set(binding.abilityPointId, binding.abilityName)
          }
        })
        const abNames = state.abilityPoints
          .map(
            (id) =>
              apiNameById.get(id) ||
              (
                datasets.abilityPoints.find((a) => (a as { id: string }).id === id) as
                  { name?: string } | undefined
              )?.name ||
              bindingNameById.get(id),
          )
          .filter(Boolean)
        return (
          abNames.slice(0, 3).join('、') +
          (abNames.length > 3 ? t(' 等{n}个', { n: state.abilityPoints.length }) : '')
        )
      }
      case 'resources':
        if (state.resources.length === 0) return t('未配置')
        const resNames = state.resources
          .map((id) => datasets.learningResources.find((r) => r.id === id)?.name)
          .filter(Boolean)
        return (
          resNames.slice(0, 3).join('、') +
          (resNames.length > 3 ? t(' 等{n}个', { n: state.resources.length }) : '')
        )
      case 'evaluation':
        if (state.evaluationMethods.length === 0) return t('未配置')
        return state.evaluationMethods
          .map((m) => evaluationMethodOptions.find((o) => o.key === m)?.label)
          .filter(Boolean)
          .join('、')
      case 'evaluationRules':
        if (state.evaluationMethods.length === 0) return t('未配置评价方式')
        const configuredMethods = state.evaluationMethods.filter((m) => {
          if (m === 'random_draw')
            return (
              state.randomDrawSelectedIds.length > 0 ||
              state.randomDrawEvalPoints.length > 0 ||
              !!state.randomDrawRubricId
            )
          if (m === 'review') return state.reviewEvalPoints.length > 0 || !!state.reviewRubricId
          if (m === 'paper') return state.paperIds.length > 0
          if (m === 'question_bank') return state.questionBankQuestions.length > 0
          if (m === 'outcome') return state.outcomeEvalPoints.length > 0 || !!state.outcomeRubricId
          if (m === 'homework')
            return state.homeworkEvalPoints.length > 0 || !!state.homeworkRubricId
          if (m === 'quiz') return state.quizQuestions.length > 0
          return false
        })
        const methodWeightTotal2 = state.evaluationMethods.reduce(
          (sum, m) => sum + (state.methodWeights[m] || 0),
          0,
        )
        if (configuredMethods.length === 0) return t('待配置')
        const weightSummary = state.evaluationMethods
          .map((m) => {
            const label = evaluationMethodOptions.find((o) => o.key === m)?.label || m
            return `${label}${state.methodWeights[m] || 0}%`
          })
          .join('、')
        return `${weightSummary}\n${t('权重合计 {n}%', { n: methodWeightTotal2 })}${methodWeightTotal2 !== 100 ? t(' (需等于100%)') : ''}`
      case 'weight':
        return `${state.weight}%`
    }
  }

  const isConfigured = (taskId: string, type: CardType): boolean => {
    const state = getState(taskId)
    switch (type) {
      case 'info':
        return true
      case 'description':
        return !!state.description || !!state.descriptionPdf
      case 'knowledge':
        return state.knowledgePoints.length > 0
      case 'ability':
        return state.abilityPoints.length > 0
      case 'resources':
        return state.resources.length > 0
      case 'evaluation':
        return state.evaluationMethods.length > 0
      case 'evaluationRules':
        return state.evaluationMethods.length > 0
      case 'weight':
        return state.weight > 0
    }
  }

  const handleAddTask = async () => {
    if (!newTask.name.trim()) return
    try {
      const payload: Omit<ApiScenarioTask, 'id'> = {
        scenarioId,
        name: newTask.name.trim(),
        code: `TK-${Date.now().toString().slice(-6)}`,
        sortOrder: tasks.length + 1,
        estimatedHours: newTask.hours,
        taskType: newTask.type,
        difficulty: newTask.difficulty,
        background: newTask.background,
        dependencyIds: [],
        isReferenced: false,
        knowledgePointIds: [],
        abilityPointIds: [],
        resourceIds: [],
      }
      const created = await taskApi.create(payload)
      const mkTask: Task = {
        ...(created as any),
        order: created.sortOrder,
        deliverables: [],
        knowledgePoints: [],
        abilityPoints: [],
        resources: [],
        dependencies: [],
        assessment: null,
      }
      const newTasks = [...tasks, mkTask]
      setTasks(newTasks)
      const newStates = { ...taskStates }
      // 保留既有任务已配置的权重，仅给新任务分配剩余权重（不覆盖既有配置）
      const used = Object.values(newStates).reduce((sum, s) => sum + (s.weight || 0), 0)
      const remaining = Math.max(0, 100 - used)
      newStates[created.id] = makeDefaultTaskState(newTasks.length, newTasks.length - 1)
      newStates[created.id].weight = newTasks.length === 1 ? 100 : Math.min(remaining, 100)
      setTaskStates(newStates)
      setIsAddTaskOpen(false)
      setNewTask({ name: '', hours: 4, type: 'training', difficulty: 3, background: '' })
      toast({ title: t('已添加任务') })
    } catch (err: any) {
      toast({ variant: 'destructive', title: t('添加失败'), description: err.message })
    }
  }

  /** 视图任务 → 创建 payload（覆盖模式回滚/撤销时重建被删除的旧任务用） */
  const taskToCreatePayload = (tk: Task): Omit<ApiScenarioTask, 'id'> => ({
    scenarioId,
    name: tk.name,
    code: tk.code,
    sortOrder: tk.order,
    description: tk.description,
    detailedDescription: tk.detailedDescription,
    descriptionPdf: tk.descriptionPdf,
    estimatedHours: tk.estimatedHours,
    taskType: tk.taskType,
    difficulty: tk.difficulty,
    background: tk.background,
    dependencyIds: [],
    isReferenced: !!tk.isReferenced,
    sourceScenarioId: tk.sourceScenarioId,
    knowledgePointIds: tk.knowledgePoints,
    abilityPointIds: tk.abilityPoints,
    resourceIds: tk.resources,
  })

  /** 重建被删除的旧任务（覆盖模式回滚/撤销）：依赖关系经新 ID 映射回填，任务状态一并恢复 */
  const restoreRemovedTasks = async (removed: Task[], removedStates: Record<string, TaskState>) => {
    const idMap = new Map<string, string>()
    const recreated: Task[] = []
    for (const rt of removed) {
      try {
        const created = await taskApi.create(taskToCreatePayload(rt))
        idMap.set(rt.id, created.id)
        recreated.push({
          ...(created as any),
          order: created.sortOrder,
          deliverables: rt.deliverables,
          knowledgePoints: rt.knowledgePoints,
          abilityPoints: rt.abilityPoints,
          resources: rt.resources,
          dependencies: rt.dependencies,
          assessment: rt.assessment,
        })
      } catch {
        // 小概率失败容忍：能恢复多少恢复多少，不阻断整体回滚
      }
    }
    for (const rt of removed) {
      const newId = idMap.get(rt.id)
      const mapped = (rt.dependencies || [])
        .map((d) => idMap.get(d))
        .filter((x): x is string => !!x)
      if (newId && mapped.length > 0) {
        await taskApi
          .update(newId, { dependencyIds: mapped } as Partial<Omit<ApiScenarioTask, 'id'>>)
          .catch(() => {})
      }
    }
    if (recreated.length > 0) {
      setTasks((prev) => [...prev, ...recreated])
      setTaskStates((prev) => ({ ...prev, ...removedStates }))
    }
  }

  /**
   * AI 任务链采纳：
   * - append：逐个创建任务追加在现有任务之后（部分失败保留已创建），权重不覆盖既有配置；
   * - overwrite：先删除现有全部任务，再按新链创建（任一步失败回滚重建旧任务），权重在新任务间平分；
   * 两种模式均 10 秒内可撤销。
   */
  const handleAdoptTaskChain = async (payload: {
    tasks: AIScenarioTaskChainTask[]
    mode: TaskChainMode
  }) => {
    const { tasks: suggested, mode } = payload
    let removedSnapshot:
      | { removed: Task[]; removedStates: Record<string, TaskState> }
      | undefined

    if (mode === 'overwrite' && tasks.length > 0) {
      // 覆盖模式：删除现有全部任务，任一删除失败则重建已删除部分并中止
      const removedStates = { ...taskStates }
      const removed: Task[] = []
      for (const old of tasks) {
        try {
          await taskApi.delete(old.id)
          removed.push(old)
        } catch (err: any) {
          if (removed.length > 0) await restoreRemovedTasks(removed, removedStates)
          toast({
            variant: 'destructive',
            title: t('覆盖失败'),
            description: t('无法删除任务「{name}」：{msg}', { name: old.name, msg: err.message }),
          })
          return
        }
      }
      removedSnapshot = { removed, removedStates }
    }

    const baseOrder = mode === 'overwrite' ? 0 : tasks.length
    const createdTasks: Task[] = []
    let lastErr: any = null
    for (let i = 0; i < suggested.length; i++) {
      const s = suggested[i]
      try {
        const payload: Omit<ApiScenarioTask, 'id'> = {
          scenarioId,
          name: s.name,
          code: `TK-${crypto.randomUUID().slice(0, 6)}-${i}`,
          sortOrder: baseOrder + i + 1,
          estimatedHours: s.estimatedHours,
          taskType: s.type as 'assessment' | 'training',
          difficulty: s.difficulty as 1 | 2 | 3 | 4 | 5,
          background: s.description,
          dependencyIds: [],
          isReferenced: false,
          knowledgePointIds: [],
          abilityPointIds: [],
          resourceIds: [],
        }
        const created = await taskApi.create(payload)
        createdTasks.push({
          ...(created as any),
          order: created.sortOrder,
          deliverables: [],
          knowledgePoints: [],
          abilityPoints: [],
          resources: [],
          dependencies: [],
          assessment: null,
        })
      } catch (err: any) {
        lastErr = err
        break
      }
    }

    if (mode === 'overwrite' && lastErr) {
      // 新链创建失败：清理已建新任务并回滚重建旧任务
      for (const ct of createdTasks) {
        await taskApi.delete(ct.id).catch(() => {})
      }
      if (removedSnapshot) {
        setTasks([])
        setTaskStates({})
        await restoreRemovedTasks(removedSnapshot.removed, removedSnapshot.removedStates)
      }
      toast({ variant: 'destructive', title: t('覆盖失败'), description: lastErr.message })
      return
    }

    if (createdTasks.length > 0) {
      const appendMode = mode === 'append'
      setTasks((prev) => (appendMode ? [...prev, ...createdTasks] : [...createdTasks]))
      setTaskStates((prev) => {
        const next = appendMode ? { ...prev } : {}
        createdTasks.forEach((ct, i) => {
          next[ct.id] = makeDefaultTaskState(baseOrder + createdTasks.length, baseOrder + i)
        })
        // 新任务分配剩余权重（append 不覆盖既有任务配置；overwrite 旧任务已清空，即平分 100）
        const used = Object.values(next).reduce((sum, st) => sum + (st.weight || 0), 0)
        const remaining = Math.max(0, 100 - used)
        const n = createdTasks.length
        createdTasks.forEach((ct, i) => {
          next[ct.id] = {
            ...next[ct.id],
            weight: Math.floor(remaining / n) + (i < remaining % n ? 1 : 0),
          }
        })
        return next
      })
      toast({
        title:
          mode === 'overwrite'
            ? t('AI 任务链已覆盖为 {n} 个任务', { n: createdTasks.length })
            : t('AI 任务链已采纳 {n} 个任务', { n: createdTasks.length }),
        description: t('10 秒内可撤销'),
        duration: 10000,
        action: (
          <ToastAction
            altText={t('撤销')}
            className="h-7 px-2.5 text-xs bg-white border-gray-200 hover:bg-gray-50"
            onClick={() => {
              void handleUndoAdoptChain({ created: createdTasks, mode, removedSnapshot })
            }}
          >
            {t('撤销')}
          </ToastAction>
        ),
      })
    }
    if (lastErr) {
      toast({ variant: 'destructive', title: t('部分任务采纳失败'), description: lastErr.message })
    }
  }

  /** 撤销 AI 任务链采纳：删除刚创建的任务并清理状态；覆盖模式同时重建被删除的旧任务 */
  const handleUndoAdoptChain = async (payload: {
    created: Task[]
    mode: TaskChainMode
    removedSnapshot?: { removed: Task[]; removedStates: Record<string, TaskState> }
  }) => {
    const { created: createdTasks, mode, removedSnapshot } = payload
    for (const ct of createdTasks) {
      await taskApi.delete(ct.id).catch(() => {})
    }
    setTasks((prev) => prev.filter((t) => !createdTasks.some((ct) => ct.id === t.id)))
    setTaskStates((prev) => {
      const next = { ...prev }
      createdTasks.forEach((ct) => delete next[ct.id])
      return next
    })
    if (mode === 'overwrite' && removedSnapshot) {
      await restoreRemovedTasks(removedSnapshot.removed, removedSnapshot.removedStates)
    }
    toast({ title: t('已撤销') })
  }

  const handleClone = async () => {
    setIsCloning(true)
    try {
      const selected = allTasks.filter((t) => selectedClone.includes(t.id))

      const newTasks = selected.map((t, i) => ({
        ...t,
        id: `task-${cloneMode}-${Date.now()}-${i}`,
        order: tasks.length + i + 1,
        isReferenced: cloneMode === 'reference',
        sourceScenarioId: t.scenarioId,
        sourceScenarioName: cloneMode === 'reference' ? t.scenarioName : undefined,
      }))

      const methodsResults = await Promise.all(
        selected.map((t) => taskEvaluationApi.listMethods(t.id).catch(() => ({ methods: [] }))),
      )

      // 权重：保留既有任务已配置的权重，仅在新克隆任务间均分剩余权重（对齐 handleAddTask 口径，总权重不超 100）
      const usedWeight = Object.values(taskStates).reduce((sum, s) => sum + (s.weight || 0), 0)
      const remainingWeight = Math.max(0, 100 - usedWeight)

      const newStates: Record<string, TaskState> = {}
      selected.forEach((t, i) => {
        const methods = methodsResults[i]?.methods || []
        let ts = taskStateFromMethods(methods)
        if (t.knowledgePointIds) ts.knowledgePoints = [...t.knowledgePointIds]
        if (t.abilityPointIds) ts.abilityPoints = [...t.abilityPointIds]
        if (t.resourceIds) ts.resources = [...t.resourceIds]
        if (t.detailedDescription) ts.description = t.detailedDescription
        if (t.descriptionPdf) ts.descriptionPdf = t.descriptionPdf
        ts.weight =
          selected.length > 0
            ? Math.floor(remainingWeight / selected.length) +
              (i < remainingWeight % selected.length ? 1 : 0)
            : 0
        newStates[newTasks[i].id] = ts
      })

      setTasks([...tasks, ...newTasks])
      setTaskStates((prev) => ({ ...prev, ...newStates }))
      setIsCloneOpen(false)
      setSelectedClone([])
    } catch (err: any) {
      toast({ variant: 'destructive', title: t('克隆失败'), description: err.message })
    } finally {
      setIsCloning(false)
    }
  }

  const handleDeleteTask = async (id: string) => {
    // 临时 id（新建/克隆尚未落库）任务直接本地移除，避免对不存在的 id 调接口必 404
    if (id.startsWith('task-')) {
      setTasks(tasks.filter((t) => t.id !== id))
      setTaskStates((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      setDeleteConfirmTask(null)
      toast({ title: t('已删除任务') })
      return
    }
    try {
      await taskApi.delete(id)
      setTasks(tasks.filter((t) => t.id !== id))
      const newStates = { ...taskStates }
      delete newStates[id]
      setTaskStates(newStates)
      setDeleteConfirmTask(null)
      toast({ title: t('已删除任务') })
    } catch (err: any) {
      toast({ variant: 'destructive', title: t('删除失败'), description: err.message })
    }
  }

  // 持久化任务权重（仅对已落库任务；ON CONFLICT (scenario_id, task_id) 幂等 upsert）
  // 由调用方传入最新任务列表与状态，避免闭包陈旧导致新建任务权重丢失
  const persistWeights = async (taskList: Task[], states: Record<string, TaskState>) => {
    let failedCount = 0
    for (const t of taskList) {
      if (t.id.startsWith('task-')) continue
      const st = states[t.id]
      if (!st) continue
      try {
        await scenarioWeightApi.upsert({
          scenarioId,
          taskId: t.id,
          weight: st.weight ?? 0,
        })
      } catch (err) {
        failedCount++
        reportError(err, { source: '保存任务权重', extras: { taskId: t.id } })
      }
    }
    return failedCount
  }

  const saveTasksToBackend = async () => {
    // 兜底：409 且本地无同名记录时，按名称查后端并复用已有记录
    const findExistingKnowledgePointByName = async (
      name: string,
    ): Promise<TaskKnowledgePointItem | undefined> => {
      try {
        const res = await knowledgeApi.list({ search: name, limit: 10 })
        const found = (res.items || []).find((k) => k.name === name)
        if (found) {
          return {
            id: found.id,
            name: found.name,
            code: found.code ?? undefined,
            description: found.description ?? undefined,
            linked: found.linked ?? false,
            granularLessons: (found.granularLessonIds as string[]) || [],
          } as TaskKnowledgePointItem
        }
      } catch {
        /* ignore */
      }
      return undefined
    }
    const findExistingAbilityByName = async (name: string) => {
      try {
        const res = await abilityApi.list({ search: name, limit: 10 })
        return (res.items || []).find((a) => (a as { name: string }).name === name) as
          { id: string; name: string } | undefined
      } catch {
        return undefined
      }
    }
    const findExistingResourceByName = async (name: string) => {
      try {
        const res = await resourceLibraryApi.list({ search: name, limit: 10 })
        return (res.items || []).find((r) => r.name === name) as TaskResourceItem | undefined
      } catch {
        return undefined
      }
    }

    // Persist custom knowledge points added in this session and map their IDs
    const kpIdMapping: Record<string, string> = {}
    const failedCreateIds: string[] = []
    let nextKnowledgePoints = [...datasets.knowledgePoints]
    const nextCustomKnowledgePointIds = new Set(datasets.customKnowledgePointIds)
    for (const kpId of Array.from(datasets.customKnowledgePointIds)) {
      const kp = nextKnowledgePoints.find((k) => k.id === kpId)
      if (!kp) continue
      try {
        if (datasets.persistedCustomKnowledgePointIds.current.has(kpId)) {
          // Already persisted in a previous save: update instead of re-create
          const updated = await knowledgeApi.update(kpId, {
            name: kp.name,
            code: kp.code,
            description: kp.description,
            linked: kp.linked ?? false,
            granularLessonIds: kp.granularLessons || [],
          })
          const idx = nextKnowledgePoints.findIndex((k) => k.id === kpId)
          if (idx >= 0) {
            nextKnowledgePoints[idx] = {
              ...nextKnowledgePoints[idx],
              granularLessons:
                updated.granularLessonIds || nextKnowledgePoints[idx].granularLessons || [],
            }
          }
        } else {
          // 租户内知识点名称唯一：同名已存在时直接复用，避免创建 409 导致任务丢失知识点
          let targetId = ''
          const nameCollision = nextKnowledgePoints.find((k) => k.id !== kpId && k.name === kp.name)
          if (nameCollision) {
            targetId = nameCollision.id
          } else {
            try {
              const created = await knowledgeApi.create({
                name: kp.name,
                code: kp.code,
                description: kp.description,
                linked: false,
                granularLessonIds: kp.granularLessons || [],
                sourceType: 'scenario_task',
                sourceId: scenarioId,
              })
              targetId = created.id
            } catch (err: any) {
              // 兜底：并发等场景下仍可能撞名，按后端提示合并到已有知识点
              let existing = nextKnowledgePoints.find((k) => k.id !== kpId && k.name === kp.name)
              if (!existing && String(err?.message || '').includes('已存在')) {
                existing = await findExistingKnowledgePointByName(kp.name)
                if (existing) {
                  nextKnowledgePoints.push(existing)
                }
              }
              if (existing && String(err?.message || '').includes('已存在')) {
                targetId = existing.id
              }
            }
          }
          if (!targetId) {
            failedCreateIds.push(kpId)
            continue
          }
          kpIdMapping[kpId] = targetId
          const idx = nextKnowledgePoints.findIndex((k) => k.id === kpId)
          if (idx >= 0) {
            nextKnowledgePoints[idx] = {
              ...nextKnowledgePoints[idx],
              id: targetId,
              granularLessons: nextKnowledgePoints[idx].granularLessons || [],
            }
          }
          nextCustomKnowledgePointIds.delete(kpId)
          nextCustomKnowledgePointIds.add(targetId)
          datasets.persistedCustomKnowledgePointIds.current.add(targetId)
        }
      } catch (err: any) {
        failedCreateIds.push(kpId)
      }
    }
    datasets.setKnowledgePoints(nextKnowledgePoints)
    datasets.setCustomKnowledgePointIds(nextCustomKnowledgePointIds)
    if (failedCreateIds.length > 0) {
      toast({
        variant: 'destructive',
        title: t('部分自定义知识点保存失败'),
        description: t('{n} 个知识点未能创建，将从任务中移除', { n: failedCreateIds.length }),
      })
    }

    // Persist custom ability points added in this session and map their IDs
    const abIdMapping: Record<string, string> = {}
    const failedAbilityIds: string[] = []
    let nextAbilityPoints = [...datasets.abilityPoints]
    for (const abId of Array.from(datasets.customAbilityPointIds.current)) {
      const ap = nextAbilityPoints.find((a) => (a as { id: string }).id === abId)
      if (!ap) continue
      // 租户内能力点名称唯一：同名已存在时直接复用，避免创建 409 导致任务丢失能力点
      let targetId = ''
      const nameCollision = nextAbilityPoints.find(
        (a) =>
          (a as { id: string }).id !== abId &&
          (a as { name: string }).name === (ap as { name: string }).name,
      )
      if (nameCollision) {
        targetId = (nameCollision as { id: string }).id
      } else {
        try {
          const created = await abilityApi.create({
            name: (ap as { name: string }).name,
            description: (ap as { description?: string }).description,
            category: (ap as { category?: string }).category,
            attributes: [],
            isPublic: false,
          } as any)
          targetId = created.id
        } catch (err: any) {
          let existing = nextAbilityPoints.find(
            (a) =>
              (a as { id: string }).id !== abId &&
              (a as { name: string }).name === (ap as { name: string }).name,
          )
          if (!existing && String(err?.message || '').includes('已存在')) {
            existing = await findExistingAbilityByName((ap as { name: string }).name)
            if (existing) {
              nextAbilityPoints.push(existing)
            }
          }
          if (existing && String(err?.message || '').includes('已存在')) {
            targetId = (existing as { id: string }).id
          }
        }
      }
      if (!targetId) {
        failedAbilityIds.push(abId)
        continue
      }
      abIdMapping[abId] = targetId
      const idx = nextAbilityPoints.findIndex((a) => (a as { id: string }).id === abId)
      if (idx >= 0) nextAbilityPoints[idx] = { ...(nextAbilityPoints[idx] as object), id: targetId }
      datasets.customAbilityPointIds.current.delete(abId)
    }
    datasets.setAbilityPoints(nextAbilityPoints)
    if (failedAbilityIds.length > 0) {
      toast({
        variant: 'destructive',
        title: t('部分自定义能力点保存失败'),
        description: t('{n} 个能力点未能创建，将从任务中移除', { n: failedAbilityIds.length }),
      })
    }

    // Persist custom resources added in this session and map their IDs
    const resourceIdMapping: Record<string, string> = {}
    const failedResourceIds: string[] = []
    let nextLearningResources = [...datasets.learningResources]
    const nextCustomResourceIds = new Set(datasets.customResourceIds)
    for (const resId of Array.from(datasets.customResourceIds)) {
      const res = nextLearningResources.find((r) => r.id === resId)
      if (!res) continue
      let targetId = ''
      try {
        const created = await taskResourceApi.create({
          name: res.name,
          type: res.type,
          url: res.url,
          description: res.description,
          thumbnail: res.thumbnail,
          size: res.size != null ? String(res.size) : undefined,
          knowledgePointIds: res.knowledgePoints || res.knowledgePointIds || [],
          extraData: res.extraData,
          uploadedBy: res.uploadedBy,
        } as any)
        targetId = created.id
      } catch (err: any) {
        // 兜底：资源名冲突时复用已有资源
        if (String(err?.message || '').includes('已存在')) {
          const existing =
            nextLearningResources.find((r) => r.id !== resId && r.name === res.name) ||
            (await findExistingResourceByName(res.name))
          if (existing) {
            targetId = existing.id
            nextLearningResources.push(existing)
          }
        }
      }
      if (!targetId) {
        failedResourceIds.push(resId)
        continue
      }
      resourceIdMapping[resId] = targetId
      const idx = nextLearningResources.findIndex((r) => r.id === resId)
      if (idx >= 0) nextLearningResources[idx] = { ...nextLearningResources[idx], id: targetId }
      nextCustomResourceIds.delete(resId)
    }
    datasets.setLearningResources(nextLearningResources)
    datasets.setCustomResourceIds(nextCustomResourceIds)
    if (failedResourceIds.length > 0) {
      toast({
        variant: 'destructive',
        title: t('部分自定义资源保存失败'),
        description: t('{n} 个资源未能创建，将从任务中移除', { n: failedResourceIds.length }),
      })
    }

    // Replace temporary custom IDs with persisted IDs across all task states
    const replaceIds = (ids: string[]) =>
      ids
        .map((id) => kpIdMapping[id] || abIdMapping[id] || resourceIdMapping[id] || id)
        .filter(
          (id) =>
            !id.startsWith('kp-custom-') &&
            !id.startsWith('ab-custom-') &&
            !failedResourceIds.includes(id),
        )
    const replaceEvalPoints = (points: EvalPoint[]) =>
      points.map((p) => ({
        ...p,
        knowledgePointIds: p.knowledgePointIds
          ? replaceIds(p.knowledgePointIds)
          : p.knowledgePointIds,
        abilityPointIds: p.abilityPointIds ? replaceIds(p.abilityPointIds) : p.abilityPointIds,
      }))

    const updatedTaskStates: Record<string, TaskState> = { ...taskStates }
    Object.keys(updatedTaskStates).forEach((tid) => {
      const s = updatedTaskStates[tid]
      updatedTaskStates[tid] = {
        ...s,
        knowledgePoints: replaceIds(s.knowledgePoints),
        abilityPoints: replaceIds(s.abilityPoints),
        resources: replaceIds(s.resources),
        randomDrawEvalPoints: replaceEvalPoints(s.randomDrawEvalPoints),
        reviewEvalPoints: replaceEvalPoints(s.reviewEvalPoints),
        paperEvalPoints: replaceEvalPoints(s.paperEvalPoints),
        questionBankEvalPoints: replaceEvalPoints(s.questionBankEvalPoints),
        outcomeEvalPoints: replaceEvalPoints(s.outcomeEvalPoints),
        homeworkEvalPoints: replaceEvalPoints(s.homeworkEvalPoints),
        quizEvalPoints: replaceEvalPoints(s.quizEvalPoints),
      }
    })
    setTaskStates(updatedTaskStates)

    const newTasks: Task[] = []
    for (let i = 0; i < tasks.length; i++) {
      const t = tasks[i]
      const ts = updatedTaskStates[t.id] || makeDefaultTaskState(0, 0)
      const payload: Omit<ApiScenarioTask, 'id'> = {
        scenarioId,
        name: t.name,
        code: t.code,
        sortOrder: i,
        description: t.description,
        detailedDescription: ts.description || t.detailedDescription,
        descriptionPdf: ts.descriptionPdf || t.descriptionPdf || undefined,
        estimatedHours: t.estimatedHours,
        taskType: t.taskType,
        difficulty: t.difficulty,
        background: t.background,
        dependencyIds: t.dependencies || [],
        isReferenced: !!t.isReferenced,
        sourceScenarioId: t.sourceScenarioId || undefined,
        knowledgePointIds: ts.knowledgePoints || [],
        abilityPointIds: ts.abilityPoints || [],
        resourceIds: ts.resources || [],
      }
      if (t.id.startsWith('task-')) {
        const created = await taskApi.create(payload)
        const oldId = t.id
        const newTask = { ...t, id: created.id }
        newTasks.push(newTask)
        // 临时 ID 创建的 task 需要把 state key 迁移到真实 ID，否则后续状态丢失
        updatedTaskStates[newTask.id] = { ...ts, evalMethodVersion: ts.evalMethodVersion }
        delete updatedTaskStates[oldId]
        const newVersion = await saveMethodsWithRetry(
          newTask.id,
          ts.evalMethodVersion,
          taskStateToMethodsInput(ts),
        )
        updatedTaskStates[newTask.id] = {
          ...updatedTaskStates[newTask.id],
          evalMethodVersion: newVersion,
        }
      } else {
        await taskApi.update(t.id, payload)
        newTasks.push(t)
        const newVersion = await saveMethodsWithRetry(
          t.id,
          ts.evalMethodVersion,
          taskStateToMethodsInput(ts),
        )
        updatedTaskStates[t.id] = { ...updatedTaskStates[t.id], evalMethodVersion: newVersion }
      }
    }
    setTasks(newTasks)
    setTaskStates(updatedTaskStates)
    const weightFailures = await persistWeights(newTasks, updatedTaskStates)
    if (weightFailures > 0) {
      toast({
        variant: 'destructive',
        title: t('部分任务权重保存失败'),
        description: t('{n} 个任务权重未保存，请重试', { n: String(weightFailures) }),
      })
    }
    return weightFailures
  }

  const handleSaveDraft = async () => {
    setIsSaving(true)
    try {
      await saveTasksToBackend()
      if (existingScenario?.status !== 'draft') {
        await scenarioApi.saveDraft(scenarioId)
        setExistingScenario((prev) => (prev ? { ...prev, status: 'draft' } : prev))
        toast({ title: t('草稿已保存'), description: t('场景已退回草稿状态') })
      } else {
        toast({ title: t('草稿已保存') })
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: t('保存失败'), description: err.message })
    } finally {
      setIsSaving(false)
    }
  }

  const handleFinish = async () => {
    setIsSaving(true)
    try {
      await saveTasksToBackend()
      if (existingScenario?.status !== 'draft') {
        await scenarioApi.saveDraft(scenarioId)
        setExistingScenario((prev) => (prev ? { ...prev, status: 'draft' } : prev))
        toast({ title: t('配置已保存'), description: t('场景已退回草稿状态') })
      } else {
        toast({ title: t('配置已保存') })
      }
      router.push('/scene')
    } catch (err: any) {
      toast({ variant: 'destructive', title: t('保存失败'), description: err.message })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <EditorShell
      mode="fullscreen"
      backText={t('取消')}
      onBack={() => router.push('/scene')}
      step={2}
      stepLabel={t('任务链配置')}
      onSaveDraft={handleSaveDraft}
      isSaving={isSaving}
      onPrev={() => router.push(`/scene/scenarios/${scenarioId}/edit`)}
      onSubmit={handleFinish}
      submitText={t('完成配置')}
      contentMaxWidth="max-w-[1400px]"
    >
      {loadFailed && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3">
          <span className="text-sm text-destructive">{t('任务数据加载失败，请重试')}</span>
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
            {t('刷新重试')}
          </Button>
        </div>
      )}
      {/* Scenario Info */}
      <Card className="block">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <CardTitle className="text-lg truncate">
                  {existingScenario?.name || t('新建场景')}
                </CardTitle>
                {existingScenario && existingScenario.coBuilders.length > 0 && (
                  <Badge variant="secondary" className="text-[10px]">
                    {t('共建')}
                  </Badge>
                )}
              </div>
              <CardDescription className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="truncate">
                  {existingScenario?.positionName || existingScenario?.positionId || t('未选择岗位')}
                  {' | '}
                  {existingScenario?.industryName || existingScenario?.industryId || t('未选择行业')}
                  {' | '}
                  {existingScenario?.professionName ||
                    existingScenario?.professionId ||
                    t('未选择专业')}
                </span>
                {existingScenario && existingScenario.coBuilders.length > 0 && (
                  <span className="flex flex-wrap items-center gap-1">
                    <span className="text-gray-400">|</span>
                    <span>{t('共建人：')}</span>
                    {existingScenario.coBuilders.map((cb: { id: string; name: string }) => (
                      <Badge key={cb.id} variant="outline" className="text-[10px]">
                        {cb.name}
                      </Badge>
                    ))}
                  </span>
                )}
              </CardDescription>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className="flex items-center gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={cn(
                      'h-4 w-4',
                      i < (existingScenario?.difficulty || 3)
                        ? 'fill-amber-400 text-amber-400'
                        : 'text-gray-200',
                    )}
                  />
                ))}
              </div>
              <Badge variant="outline">{existingScenario?.version}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0 border-t">
          <p className="text-sm text-gray-600 pt-3">{existingScenario?.background || t('暂无介绍')}</p>
        </CardContent>
      </Card>

      {/* Tasks Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mt-6">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-semibold text-lg">{t('任务列表')}</h2>
          <Badge variant="secondary">{t('{n} 个任务', { n: tasks.length })}</Badge>
          <div
            className={cn(
              'flex items-center gap-1 text-sm px-2 py-1 rounded',
              totalWeight === 100 ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600',
            )}
          >
            <Scale className="h-3.5 w-3.5" />
            {t('权重: {n}%', { n: totalWeight })}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => setIsAddTaskOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t('添加任务')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setIsCloneOpen(true)}>
            <Copy className="mr-2 h-4 w-4" />
            {t('克隆/引用')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setIsWeightConfigOpen(true)}>
            <PieChartIcon className="mr-2 h-4 w-4" />
            {t('配置任务权重')}
          </Button>
          <AiTaskChainSuggestion
            scenario={{
              name: existingScenario?.name || '',
              background: existingScenario?.background || '',
              positionName: existingScenario?.positionName || '',
              industryNames: existingScenario?.industryName
                ? existingScenario.industryName.split('、')
                : [],
              professionNames: existingScenario?.professionName
                ? existingScenario.professionName.split('、')
                : [],
              positionId: existingScenario?.positionId || '',
            }}
            existingTasks={tasks.map((tk) => ({
              name: tk.name,
              type: tk.taskType as 'training' | 'assessment',
              difficulty: (tk.difficulty as number) || 3,
            }))}
            onAdopt={handleAdoptTaskChain}
            panelSlot={aiTaskChainPanelRef}
          />
        </div>
      </div>

      {/* AI 任务链建议面板挂载点（portal 目标，位于标题行下方、整行全宽） */}
      <div ref={aiTaskChainPanelRef} />

      {/* Task List with unified horizontal scroll */}
      <div className="overflow-x-auto pb-2 -mx-2 px-2">
        {/* Column Headers — mirror row structure for precise alignment */}
        <div className="flex items-start gap-3 min-w-max pr-2">
          <div className="w-8 shrink-0" />
          {cardConfigs.map((c) => (
            <div
              className="w-52 shrink-0 text-xs text-gray-500 text-center whitespace-pre-line leading-tight py-2"
              key={c.type}
            >
              {t(c.title)}
            </div>
          ))}
          <div className="w-8 shrink-0" />
        </div>

        {/* Task Rows */}
        <div className="space-y-4 min-w-max pr-2">
          {tasks.map((task, idx) => (
            <div
              key={task.id}
              draggable
              onDragStart={() => setDraggedIdx(idx)}
              onDragOver={(e) => {
                e.preventDefault()
              }}
              onDrop={(e) => {
                e.preventDefault()
                if (draggedIdx === null || draggedIdx === idx) {
                  setDraggedIdx(null)
                  return
                }
                const newTasks = [...tasks]
                const [removed] = newTasks.splice(draggedIdx, 1)
                newTasks.splice(idx, 0, removed)
                const reordered = newTasks.map((t, i) => ({ ...t, order: i + 1 }))
                setTasks(reordered)
                setDraggedIdx(null)
                taskApi
                  .reorder(
                    scenarioId,
                    reordered.map((t) => t.id),
                  )
                  .catch((err) => {
                    reportError(err, { source: '保存任务排序' })
                    // 排序保存失败时提示用户，避免 UI 顺序与后端不一致时无感知
                    toast({
                      variant: 'destructive',
                      title: t('排序保存失败'),
                      description: err instanceof Error ? err.message : undefined,
                    })
                  })
              }}
              className={cn(
                'flex items-center gap-3 p-4 bg-white rounded-xl border shadow-sm hover:shadow-md hover:border-primary/30 transition-all group',
                draggedIdx === idx && 'opacity-50 border-dashed border-primary',
              )}
            >
              {/* Order */}
              <div className="flex items-center justify-center gap-1 shrink-0 w-8 cursor-grab rounded-md hover:bg-gray-100 py-4">
                <GripVertical className="h-4 w-4 text-gray-400" />
                <span className="text-xs text-gray-400 font-medium">{idx + 1}</span>
              </div>

              {/* Cards */}
              <div className="flex items-center gap-3 flex-1">
                {cardConfigs.map((config) => {
                  const configured = isConfigured(task.id, config.type)
                  const summary = getSummary(task.id, config.type)
                  const isRef = task.isReferenced && config.type !== 'weight'
                  const isWeightReadonly = config.type === 'weight'

                  return (
                    <button
                      key={config.type}
                      onClick={() =>
                        !isRef &&
                        !isWeightReadonly &&
                        setEditingCard({ taskId: task.id, type: config.type })
                      }
                      disabled={isRef || isWeightReadonly}
                      className={cn(
                        'w-52 h-40 shrink-0 rounded-lg border p-3.5 text-left transition-all flex flex-col',
                        isRef || isWeightReadonly
                          ? 'bg-gray-100 border-gray-200 cursor-not-allowed opacity-60'
                          : configured
                            ? 'bg-white border-gray-200 hover:border-primary hover:shadow-sm'
                            : 'bg-gray-50/70 border-dashed border-gray-300 hover:border-primary hover:bg-gray-50',
                      )}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <div
                          className={cn(
                            'p-1.5 rounded-md',
                            configured ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-400',
                          )}
                        >
                          {config.icon}
                        </div>
                        <span className="text-xs font-medium truncate flex-1">{t(config.title)}</span>
                        {isRef && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0">
                            {t('引用')}
                          </Badge>
                        )}
                      </div>
                      <p
                        className={cn(
                          'text-xs line-clamp-5 flex-1 leading-relaxed whitespace-pre-line',
                          configured ? 'text-gray-600' : 'text-gray-400',
                        )}
                      >
                        {summary}
                      </p>
                    </button>
                  )
                })}
              </div>

              {/* Delete */}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-gray-400 hover:text-red-500"
                onClick={() => setDeleteConfirmTask({ id: task.id, name: task.name })}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}

          {tasks.length === 0 && (
            <EmptyState
              className="py-16"
              icon={<FileText className="h-12 w-12 text-gray-300" />}
              title={t('暂无任务，点击添加第一个任务')}
              titleClassName="text-gray-500"
              action={
                <Button onClick={() => setIsAddTaskOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  {t('添加任务')}
                </Button>
              }
            />
          )}
        </div>
      </div>

      {/* Add Task Dialog */}
      <Dialog open={isAddTaskOpen} onOpenChange={setIsAddTaskOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('添加任务')}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleAddTask()
            }}
            className="grid gap-4"
          >
            <div className="space-y-4 py-4">
              <div>
                <Label>{t('任务名称')}</Label>
                <Input
                  value={newTask.name}
                  onChange={(e) => setNewTask({ ...newTask, name: e.target.value })}
                  placeholder={t('输入任务名称')}
                  className="mt-1.5"
                />
              </div>
            <div>
              <Label>{t('任务类型')}</Label>
              <Select
                value={newTask.type}
                onValueChange={(v) =>
                  setNewTask({ ...newTask, type: v as 'assessment' | 'training' })
                }
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="training">{t('训练任务')}</SelectItem>
                  <SelectItem value="assessment">{t('考核任务')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Label>{t('预估学时')}</Label>
                <span className="text-xs text-gray-400">{t('学生完成任务的预估时长')}</span>
              </div>
              <Input
                type="number"
                value={newTask.hours}
                onChange={(e) => setNewTask({ ...newTask, hours: +e.target.value })}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>{t('难度')}</Label>
              <div className="flex gap-1 mt-1.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} onClick={() => setNewTask({ ...newTask, difficulty: n })}>
                    <Star
                      className={cn(
                        'h-6 w-6',
                        n <= newTask.difficulty ? 'fill-amber-400 text-amber-400' : 'text-gray-200',
                      )}
                    />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>{t('背景介绍')}</Label>
              <Textarea
                value={newTask.background}
                onChange={(e) => setNewTask({ ...newTask, background: e.target.value })}
                placeholder={t('简述任务背景')}
                className="mt-1.5"
                rows={3}
              />
            </div>
          </div>
          <FormDialogFooter
            onCancel={() => setIsAddTaskOpen(false)}
            confirmText={t('添加')}
            cancelText={t('取消')}
            confirmDisabled={!newTask.name}
          />
          </form>
        </DialogContent>
      </Dialog>

      {/* Clone Dialog */}
      <Dialog open={isCloneOpen} onOpenChange={setIsCloneOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{t('克隆/引用任务')}</DialogTitle>
            <DialogDescription>{t('从其他场景选择任务进行克隆或引用')}</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleClone()
            }}
            className="flex flex-col flex-1 min-h-0 gap-4"
          >
            <div className="space-y-4 py-4 flex-1 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <Button
                  variant={cloneMode === 'clone' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCloneMode('clone')}
                >
                  {t('克隆（可编辑）')}
                </Button>
                <Button
                  variant={cloneMode === 'reference' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCloneMode('reference')}
                >
                  {t('引用（只读）')}
                </Button>
              </div>
              <SearchInput
                wrapperClassName="w-64"
                iconClassName="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
                value={cloneSearch}
                onChange={setCloneSearch}
                placeholder={t('搜索任务名称、编码...')}
              />
            </div>
            <Tabs
              value={cloneTab}
              onValueChange={(v) => setCloneTab(v as 'my' | 'collab' | 'public')}
            >
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="my">{t('我的')}</TabsTrigger>
                <TabsTrigger value="collab">{t('共建')}</TabsTrigger>
                <TabsTrigger value="public">{t('公共库')}</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="flex-1 overflow-y-auto border rounded-lg">
              <div className="overflow-x-auto">
                {/* Table Header */}
                <div className="grid grid-cols-[48px_1fr_120px_140px_120px] gap-3 px-4 py-2 bg-gray-50 text-xs font-medium text-gray-500 border-b sticky top-0 min-w-[540px]">
                  <div></div>
                  <div>{t('任务名称')}</div>
                  <div>{t('任务编码')}</div>
                  <div>{t('关联场景')}</div>
                  <div>{t('关联岗位')}</div>
                </div>
                {allTasks
                  .filter((t) => {
                    if (cloneTab === 'my') return t.scenarioCreatorId === (user?.id || '')
                    if (cloneTab === 'collab')
                      return (
                        Array.isArray(t.scenarioCoBuilderIds) &&
                        t.scenarioCoBuilderIds.includes(user?.id || '')
                      )
                    if (cloneTab === 'public')
                      return (
                        t.scenarioStatus === 'published' && t.scenarioCreatorId !== (user?.id || '')
                      )
                    return true
                  })
                  .filter(
                    (t) =>
                      !cloneSearch ||
                      t.name.includes(cloneSearch) ||
                      t.code?.includes(cloneSearch) ||
                      t.scenarioName?.includes(cloneSearch),
                  )
                  .map((t) => {
                    const selected = selectedClone.includes(t.id)
                    return (
                      <div
                        key={t.id}
                        onClick={() =>
                          setSelectedClone((prev) =>
                            prev.includes(t.id) ? prev.filter((x) => x !== t.id) : [...prev, t.id],
                          )
                        }
                        className={cn(
                          'grid grid-cols-[48px_1fr_120px_140px_120px] gap-3 px-4 py-3 border-b cursor-pointer items-center text-sm hover:bg-gray-50 min-w-[540px]',
                          selected ? 'bg-primary/5' : '',
                        )}
                      >
                        <div className="flex justify-center">
                          <div
                            className={cn(
                              'w-4 h-4 rounded border flex items-center justify-center',
                              selected ? 'bg-primary border-primary' : 'border-gray-300',
                            )}
                          >
                            {selected && <CheckCircle2 className="h-3 w-3 text-white" />}
                          </div>
                        </div>
                        <div className="font-medium">{t.name}</div>
                        <div className="text-gray-500 text-xs">{t.code}</div>
                        <div className="text-gray-500 text-xs truncate">{t.scenarioName}</div>
                        <div className="text-gray-500 text-xs">
                          {existingScenario?.positionName || '-'}
                        </div>
                      </div>
                    )
                  })}
              </div>
            </div>
          </div>
          <FormDialogFooter
            onCancel={() => setIsCloneOpen(false)}
            confirmText={t('确定 ({n})', { n: selectedClone.length })}
            cancelText={t('取消')}
            confirmDisabled={selectedClone.length === 0}
            loading={isCloning}
          />
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Card Dialog */}
      {editingCard && (
        <EditCardDialog
          taskId={editingCard.taskId}
          cardType={editingCard.type}
          task={tasks.find((t) => t.id === editingCard.taskId)!}
          state={getState(editingCard.taskId)}
          updateState={(updates) => updateState(editingCard.taskId, updates)}
          updateTask={(updates) =>
            setTasks(tasks.map((t) => (t.id === editingCard.taskId ? { ...t, ...updates } : t)))
          }
          onClose={() => setEditingCard(null)}
          positionId={existingScenario?.positionId}
          toast={toast}
          positionAbilityBindings={datasets.positionAbilityBindings}
          datasets={datasets}
          professions={professions}
          scenario={existingScenario}
        />
      )}

      {/* Weight Config Dialog */}
      <WeightConfigDialog
        open={isWeightConfigOpen}
        onOpenChange={(v) => {
          if (!v) {
            // await 持久化结果，失败数 >0 时提示用户重试
            void persistWeights(tasks, taskStates).then((failed) => {
              if (failed > 0) {
                toast({
                  variant: 'destructive',
                  title: t('权重保存失败'),
                  description: t('{count} 个任务权重保存失败，请重试', { count: failed }),
                })
              }
            })
          }
          setIsWeightConfigOpen(v)
        }}
        tasks={tasks}
        taskStates={taskStates}
        updateAnyState={(id, updates) => updateState(id, updates)}
      />

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        open={!!deleteConfirmTask}
        onOpenChange={(open) => !open && setDeleteConfirmTask(null)}
        title={t('确认删除')}
        description={t('确定要删除任务「{name}」吗？删除后不可恢复。', {
          name: deleteConfirmTask?.name || '',
        })}
        variant="destructive"
        confirmText={t('确认删除')}
        onConfirm={() => deleteConfirmTask && handleDeleteTask(deleteConfirmTask.id)}
      />
    </EditorShell>
  )
}

const DEFAULT_RANDOM_DRAW_RESOURCE_CONFIG = {
  questionCount: 5,
  difficulty: 'mixed',
  types: { single: true, multiple: true, judge: true },
  autoDraw: true,
  submitFormatDesc: '',
  venueResources: '',
}
const DEFAULT_REVIEW_RESOURCE_CONFIG = {
  materialType: 'project_report',
  submitFormatDesc: '请提交 PDF 格式的项目报告，包含完整的项目背景、实现方案、测试结果和总结反思。',
  deadlineDays: 7,
  allowResubmit: false,
  venueResources:
    '多媒体教室（容纳30人）、投影仪、白板、评委席桌椅、计时器、签到表、评分表及文具。',
  requiresMaterial: true,
}
const DEFAULT_OUTCOME_RESOURCE_CONFIG = {
  materialType: 'project_report',
  submitFormatDesc: '请提交 PDF 格式的成果材料，包含完整的项目背景、实现方案、测试结果和总结反思。',
  deadlineDays: 7,
  allowResubmit: false,
  venueResources:
    '多媒体教室（容纳30人）、投影仪、白板、评委席桌椅、计时器、签到表、评分表及文具。',
  requiresMaterial: true,
}
const DEFAULT_HOMEWORK_RESOURCE_CONFIG = {
  materialType: 'homework_file',
  submitFormatDesc: '请提交 PDF 或 DOCX 格式的作业文件。',
  deadlineDays: 7,
  allowResubmit: false,
  venueResources: '',
  requiresMaterial: true,
}

// ============ Edit Card Dialog ============

// 保存任务测评方式：遇 409（评价规则已被其他会话修改）时拉取最新版本重试一次，避免并发保存整体失败
async function saveMethodsWithRetry(tid: string, version: number, methods: any[]): Promise<number> {
  if (methods.length === 0) return version
  const doSave = async (v: number) => {
    const savedRes = await taskEvaluationApi.saveMethods(tid, { version: v, methods })
    return (savedRes.methods || []).reduce((max, m) => Math.max(max, m.version || 0), 0)
  }
  try {
    return await doSave(version)
  } catch (err: any) {
    if (err.message === '评价规则已被其他会话修改') {
      const freshRes = await taskEvaluationApi.listMethods(tid).catch(() => null)
      if (!freshRes) throw err
      const freshVersion = (freshRes.methods || []).reduce(
        (max, m) => Math.max(max, m.version || 0),
        0,
      )
      return await doSave(freshVersion)
    }
    throw err
  }
}

function EditCardDialog({
  taskId,
  cardType,
  task,
  state,
  updateState,
  updateTask,
  onClose,
  positionId,
  toast,
  positionAbilityBindings,
  datasets,
  professions,
  scenario,
}: {
  taskId: string
  cardType: CardType
  task: Task
  state: TaskState
  updateState: (u: Partial<TaskState>) => void
  updateTask: (u: Partial<Task>) => void
  onClose: () => void
  positionId?: string
  toast: (opts: {
    title?: string
    description?: string
    variant?: 'default' | 'destructive'
  }) => void
  positionAbilityBindings: any[]
  datasets: UseTaskDatasetsResult
  professions: any[]
  /** 场景上下文（AI 辅助编写提示词用） */
  scenario: EnrichedScenario | null
}) {
  const t = useT()
  const config = cardConfigs.find((c) => c.type === cardType)!
  const [localTask, setLocalTask] = useState({
    name: task.name,
    type: task.taskType,
    difficulty: task.difficulty,
    hours: task.estimatedHours,
    background: task.background,
  })

  // ===== AI 辅助编写（交互与岗位样板一致；仅 info/description/knowledge/ability/resources 卡接入） =====
  const aiField = AI_FIELD_BY_CARD[cardType]
  const aiKeys = AI_KEYS_BY_CARD[cardType] || AI_KEYS_NONE
  const aiSteps = AI_STEPS_BY_CARD[cardType] || AI_STEPS_DEFAULT

  // 最新值快照（AI 回调读取，避免闭包过期）
  const localTaskRef = useRef(localTask)
  useEffect(() => {
    localTaskRef.current = localTask
  }, [localTask])
  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  }, [state])
  const scenarioRef = useRef(scenario)
  useEffect(() => {
    scenarioRef.current = scenario
  }, [scenario])

  /** 某字段被 AI 覆盖前的快照（1 级历史用） */
  const snapshotAiField = (key: TaskAiFieldKey): Record<string, unknown> => {
    switch (key) {
      case 'name':
        return { name: localTaskRef.current.name }
      case 'background':
        return { background: localTaskRef.current.background }
      case 'difficulty':
        return { difficulty: localTaskRef.current.difficulty }
      case 'description':
        return { description: stateRef.current.description }
      case 'knowledge':
        return { knowledge: stateRef.current.knowledgePoints }
      case 'ability':
        return { ability: stateRef.current.abilityPoints }
      case 'resources':
        return { resources: stateRef.current.resources }
    }
  }

  /** AI 写入分发（快照恢复同样走这里） */
  const applyAiWrite = (data: Record<string, unknown>) => {
    if (data.name !== undefined || data.background !== undefined || data.difficulty !== undefined) {
      setLocalTask((prev) => ({ ...prev, ...data }))
    }
    if (data.description !== undefined) updateState({ description: data.description as string })
    if (data.knowledge !== undefined) updateState({ knowledgePoints: data.knowledge as string[] })
    if (data.ability !== undefined) updateState({ abilityPoints: data.ability as string[] })
    if (data.resources !== undefined) updateState({ resources: data.resources as string[] })
  }

  const ai = useAiNotConfigured()
  const writer = useAiFieldWriter<TaskAiFieldKey, Record<string, unknown>>(
    aiKeys,
    applyAiWrite,
    snapshotAiField,
  )
  const pipeline = useAiPipeline<unknown, AIScenarioAssistResponse>({
    steps: aiSteps,
    request: (_task, signal) =>
      scenarioAiAssist(
        {
          field: aiField!,
          scenario: {
            name: scenarioRef.current?.name || '',
            background: scenarioRef.current?.background || '',
            difficulty: scenarioRef.current?.difficulty || 0,
            industryNames: scenarioRef.current?.industryName
              ? scenarioRef.current.industryName.split('、')
              : [],
            professionNames: scenarioRef.current?.professionName
              ? scenarioRef.current.professionName.split('、')
              : [],
            positionId: positionId || '',
            positionName: scenarioRef.current?.positionName || '',
            taskName: localTaskRef.current.name || task.name,
            taskBackground: localTaskRef.current.background,
            taskDescription: stateRef.current.description || task.description || '',
            taskDifficulty: localTaskRef.current.difficulty,
            existingTasks: [],
            intention: '',
          },
        },
        signal,
      ),
    onError: (err) => {
      if (ai.markNotConfigured(err)) return true
      toast({
        variant: 'destructive',
        title: t('AI 生成失败'),
        description: err instanceof Error ? err.message : undefined,
      })
      return true
    },
  })
  const { aiHistories, flashKey, writeField, restoreField, restoreAll, updatedCount } = writer
  // 未匹配的实体建议（knowledge/resources 卡：引导新建；ability 卡：提示去岗位页）
  const [unmatchedSuggestions, setUnmatchedSuggestions] = useState<AIScenarioSuggestion[]>([])

  /** 应用 AI 结果：按卡片类型分发写入 */
  const applyAiResult = (res: AIScenarioAssistResponse) => {
    switch (cardType) {
      case 'info': {
        const p = res.task
        if (!p) return
        const skipped: string[] = []
        // AI 返回缺字段时用空串兜底，避免 .trim() 抛 TypeError 中断写入管线
        if ((p.name || '').trim()) writeField('name', { name: (p.name || '').trim() })
        else skipped.push(AI_FIELD_LABELS.name)
        if ((p.background || '').trim())
          writeField('background', { background: (p.background || '').trim() })
        else skipped.push(AI_FIELD_LABELS.background)
        if (p.difficulty >= 1 && p.difficulty <= 5) writeField('difficulty', { difficulty: p.difficulty })
        else skipped.push(AI_FIELD_LABELS.difficulty)
        if (skipped.length > 0) {
          toast({ title: t('AI 未生成：{fields}，已保留原内容', { fields: skipped.join('、') }) })
        }
        return
      }
      case 'description':
        if (res.taskDescription) writeField('description', { description: res.taskDescription })
        return
      case 'knowledge':
      case 'ability':
      case 'resources': {
        const items = res.suggestions || []
        const matched = items.filter((s) => s.matchedId)
        const unmatched = items.filter((s) => !s.matchedId)
        if (matched.length > 0) {
          const key = cardType === 'knowledge' ? 'knowledge' : cardType === 'ability' ? 'ability' : 'resources'
          const cur = snapshotAiField(key)[key] as string[]
          const next = [...cur]
          for (const s of matched) {
            if (!next.includes(s.matchedId!)) next.push(s.matchedId!)
          }
          writeField(key, { [key]: next })
        }
        if (unmatched.length > 0) {
          if (cardType === 'ability') {
            toast({
              title: t('以下能力点未找到，请先到岗位能力建模中添加'),
              description: unmatched.map((s) => s.name).join('、'),
            })
            setUnmatchedSuggestions([])
          } else {
            setUnmatchedSuggestions(unmatched)
          }
        } else {
          setUnmatchedSuggestions([])
        }
        return
      }
      default:
        return
    }
  }

  /** 新建建议（引用优先：未命中项引导走既有新建流程） */
  const handleCreateSuggestion = async (s: AIScenarioSuggestion) => {
    try {
      if (cardType === 'knowledge') {
        const created = await knowledgeApi.create({
          name: s.name,
          description: s.description || undefined,
        } as any)
        datasets.markKnowledgePointCustom(created.id, true)
        datasets.setKnowledgePoints((prev) => [
          ...prev,
          { ...created, granularLessons: [] } as any,
        ])
        const cur = stateRef.current.knowledgePoints
        writeField('knowledge', { knowledge: [...cur, created.id] })
      } else {
        const created = await resourceLibraryApi.create({
          name: s.name,
          resourceType: (s.type || 'other') as ResourceKind,
          description: s.description || undefined,
        })
        datasets.markResourceCustom(created.id)
        datasets.setLearningResources((prev) => [...prev, created as any])
        const cur = stateRef.current.resources
        writeField('resources', { resources: [...cur, created.id] })
      }
      setUnmatchedSuggestions((prev) => prev.filter((u) => u.name !== s.name))
      toast({ title: t('已新建并关联「{name}」', { name: s.name }) })
    } catch (err: any) {
      toast({ variant: 'destructive', title: t('新建失败'), description: err?.message })
    }
  }

  /** 单字段生成（info 卡：名称/背景/难度 label 旁 Sparkles） */
  const runSingleField = (target: 'name' | 'background' | 'difficulty') => {
    pipeline.run(
      [
        {
          id: 'taskPolish',
          meta: undefined,
          apply: (res) => {
            const p = res.task
            if (!p) return
            // AI 返回缺字段时用空串兜底，避免 .trim() 抛 TypeError 中断写入管线
            if (target === 'name' && (p.name || '').trim()) {
              writeField('name', { name: (p.name || '').trim() })
              return
            }
            if (target === 'background' && (p.background || '').trim()) {
              writeField('background', { background: (p.background || '').trim() })
              return
            }
            if (target === 'difficulty' && p.difficulty >= 1 && p.difficulty <= 5) {
              writeField('difficulty', { difficulty: p.difficulty })
              return
            }
            toast({ title: t('AI 未生成{field}，已保留原内容', { field: AI_FIELD_LABELS[target] }) })
          },
        },
      ],
      { showDialog: false },
    )
  }

  /** 区块级 AI 控件：生成/重新生成 + 已更新标记 + 逐字段恢复上版 + 全部撤销 */
  const renderAiToolbar = () => {
    if (!aiField) return null
    const updatedKeys = aiKeys.filter((k) => aiHistories[k] !== undefined)
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 rounded-lg border border-purple-200 bg-purple-50/50 px-3 py-2">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <Sparkles className="h-4 w-4 text-purple-600 shrink-0" />
            {updatedCount > 0 ? (
              <>
                <Badge
                  variant="outline"
                  className="h-5 px-1.5 text-[10px] leading-none border-purple-200 text-purple-700 bg-white shrink-0"
                >
                  {t('AI 已更新 {n} 项', { n: updatedCount })}
                </Badge>
                {updatedKeys.map((k) => (
                  <Button
                    key={k}
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-6 px-1.5 text-[11px] text-purple-700 hover:bg-purple-50"
                    onClick={() => restoreField(k)}
                  >
                    <Undo2 className="h-3 w-3 mr-0.5" />
                    {t('恢复上版')}：{AI_FIELD_LABELS[k]}
                  </Button>
                ))}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-6 px-1.5 text-[11px] text-purple-700 hover:bg-purple-50"
                  onClick={() =>
                    restoreAll(() => toast({ title: t('已全部恢复 AI 覆盖前的内容') }))
                  }
                >
                  <Undo2 className="h-3 w-3 mr-0.5" />
                  {t('全部撤销')}
                </Button>
              </>
            ) : (
              <span className="text-xs text-purple-800 truncate">
                {cardType === 'knowledge' || cardType === 'ability' || cardType === 'resources'
                  ? t('AI 将基于任务内容推荐并自动选中命中的现有对象')
                  : t('AI 将基于场景与任务内容生成并直接写入')}
              </span>
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs shrink-0 border-purple-200 text-purple-700 hover:bg-purple-50 hover:text-purple-800"
            onClick={() => pipeline.run([{ id: aiField, meta: undefined, apply: applyAiResult }])}
            disabled={pipeline.isRunning}
          >
            {pipeline.isRunning ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="mr-1 h-3.5 w-3.5" />
            )}
            {updatedCount > 0 ? t('重新生成') : t('AI 生成')}
          </Button>
        </div>
        {unmatchedSuggestions.length > 0 && (
          <div className="rounded-lg border border-purple-200 bg-purple-50/30 px-3 py-2 space-y-2">
            <p className="text-xs text-purple-800 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-purple-500 shrink-0" />
              {t('以下建议未找到现有对象，可新建后自动关联')}
            </p>
            {unmatchedSuggestions.map((s) => (
              <div key={s.name} className="flex items-center justify-between gap-2">
                <div className="min-w-0 text-sm text-gray-700">
                  <span className="font-medium">{s.name}</span>
                  {s.description && (
                    <span className="text-xs text-gray-500 ml-2 truncate">{s.description}</span>
                  )}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs shrink-0 border-purple-200 text-purple-700 hover:bg-purple-50"
                  onClick={() => handleCreateSuggestion(s)}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  {t('新建')}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  /** info 卡单字段 AI 控件（label 旁 Sparkles + 已更新/恢复上版） */
  const renderFieldAiControl = (key: 'name' | 'background' | 'difficulty') => (
    <span className="flex items-center gap-1.5">
      {aiHistories[key] !== undefined && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-6 px-1.5 text-[11px] text-purple-700 hover:bg-purple-50"
          onClick={() => restoreField(key)}
        >
          <Undo2 className="h-3 w-3 mr-0.5" />
          {t('恢复上版')}
        </Button>
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-6 w-6 text-purple-600 hover:bg-purple-50 hover:text-purple-800"
        onClick={() => runSingleField(key)}
        disabled={pipeline.isRunning}
        title={t('AI 生成')}
      >
        {pipeline.isRunning && pipeline.runningId === 'taskPolish' ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Sparkles className="h-3.5 w-3.5" />
        )}
      </Button>
    </span>
  )

  const [abilitySearch, setAbilitySearch] = useState('')
  const [abilityDetailOpen, setAbilityDetailOpen] = useState(false)
  const [selectedAbilityForDetail, setSelectedAbilityForDetail] = useState<string | null>(null)
  const [expandedDomains, setExpandedDomains] = useState<Record<string, boolean>>({})
  const [isSavingCard, setIsSavingCard] = useState(false)

  // 评价标准表单「保存」：把当前方法的评价标准立即落库到当前任务×当前测评方式
  const handlePersistStandard = async (
    _methodKey: string,
    next: import('@/lib/types/evaluation').EvalRuleConfig,
  ) => {
    const nextState = { ...state, ...evalRuleConfigToTaskStateUpdates(next) }
    const methodsInput = taskStateToMethodsInput(nextState)
    if (methodsInput.length === 0) return
    const newVersion = await saveMethodsWithRetry(taskId, state.evalMethodVersion, methodsInput)
    updateState({ ...evalRuleConfigToTaskStateUpdates(next), evalMethodVersion: newVersion })
  }

  const handleSave = async () => {
    if (isSavingCard) return
    setIsSavingCard(true)
    try {
      if (cardType === 'info') {
        updateTask({
          name: localTask.name,
          taskType: localTask.type as 'assessment' | 'training',
          difficulty: localTask.difficulty as 1 | 2 | 3 | 4 | 5,
          estimatedHours: localTask.hours,
          background: localTask.background,
        })
      } else if (cardType === 'evaluationRules') {
        const toTaskEvalPoint = (ep: EvalPoint): import('@/lib/types/scene-mock').TaskEvalPoint => {
          const gmMax =
            ep.gradeMapping && ep.gradeMapping.length > 0
              ? Math.max(...ep.gradeMapping.map((g) => g.maxScore))
              : 100
          return {
            id: ep.id,
            name: ep.name,
            desc: ep.desc,
            weight: ep.weight || 0,
            maxScore: ep.weight || gmMax,
            scoringMethod: ep.scoringMethod,
            gradeMapping: ep.gradeMapping,
            subType: ep.subType,
            types: ep.types,
            knowledgePointIds: ep.knowledgePointIds,
            abilityPointIds: ep.abilityPointIds,
          }
        }
        const enabledReviewSteps = (state.reviewSteps || [])
          .filter((s: any) => s.enabled)
          .map((s: any) => ({
            id: s.id,
            label: s.label,
            desc: s.desc,
            enabled: s.enabled,
            subjectType: s.subjectType,
            weight: s.weight,
          }))
        updateTask({
          evalPoints: {
            randomDraw: state.randomDrawEvalPoints.map(toTaskEvalPoint),
            review: state.reviewEvalPoints.map(toTaskEvalPoint),
            paper: state.paperEvalPoints.map(toTaskEvalPoint),
            questionBank: state.questionBankEvalPoints.map(toTaskEvalPoint),
          },
          reviewSteps: enabledReviewSteps,
        })
        // Ensure newly-enabled methods have default resource configs and sync review steps to task state
        const updatedRC = { ...state.methodResourceConfigs }
        state.evaluationMethods.forEach((mk) => {
          if (mk === 'random_draw')
            updatedRC[mk] = { ...DEFAULT_RANDOM_DRAW_RESOURCE_CONFIG, ...updatedRC[mk] }
          if (mk === 'review')
            updatedRC[mk] = { ...DEFAULT_REVIEW_RESOURCE_CONFIG, ...updatedRC[mk] }
          if (mk === 'outcome')
            updatedRC[mk] = { ...DEFAULT_OUTCOME_RESOURCE_CONFIG, ...updatedRC[mk] }
          if (mk === 'homework')
            updatedRC[mk] = { ...DEFAULT_HOMEWORK_RESOURCE_CONFIG, ...updatedRC[mk] }
        })
        updateState({ methodResourceConfigs: updatedRC, reviewSteps: enabledReviewSteps })
        // 临时考试/考试安排由后端 EnsureExamUsageForMethod 在保存测评方式时统一幂等创建
        const methodsInput = taskStateToMethodsInput({ ...state, methodResourceConfigs: updatedRC })
        // Persist evaluation methods (including resource config) to backend
        if (methodsInput.length > 0) {
          try {
            const newVersion = await saveMethodsWithRetry(
              taskId,
              state.evalMethodVersion,
              methodsInput,
            )
            updateState({ evalMethodVersion: newVersion })
          } catch (err: any) {
            toast({ variant: 'destructive', title: t('评价规则保存失败'), description: err.message })
            return
          }
        }
      }
    } finally {
      setIsSavingCard(false)
    }
    onClose()
  }

  const renderContent = () => {
    switch (cardType) {
      case 'info':
        return (
          <TaskInfoCard
            name={localTask.name}
            onNameChange={(v) => setLocalTask({ ...localTask, name: v })}
            type={localTask.type}
            onTypeChange={(v) =>
              setLocalTask({ ...localTask, type: v as 'assessment' | 'training' })
            }
            difficulty={localTask.difficulty as 1 | 2 | 3 | 4 | 5}
            onDifficultyChange={(v) =>
              setLocalTask({ ...localTask, difficulty: v as 1 | 2 | 3 | 4 | 5 })
            }
            hours={localTask.hours}
            onHoursChange={(v) => setLocalTask({ ...localTask, hours: v })}
            background={localTask.background}
            onBackgroundChange={(v) => setLocalTask({ ...localTask, background: v })}
            nameAiControl={renderFieldAiControl('name')}
            backgroundAiControl={renderFieldAiControl('background')}
            difficultyAiControl={renderFieldAiControl('difficulty')}
          />
        )

      case 'description':
        return (
          <TaskDescriptionCard
            description={state.description}
            onDescriptionChange={(v) => updateState({ description: v })}
            descriptionPdf={state.descriptionPdf}
            onDescriptionPdfChange={(v) => updateState({ descriptionPdf: v })}
            toast={toast}
          />
        )

      case 'knowledge': {
        const pool: KnowledgePointItem[] = datasets.knowledgePoints.map((kp) => ({
          id: kp.id,
          name: kp.name,
          code: kp.code,
          description: kp.description,
          linked: !datasets.customKnowledgePointIds.has(kp.id),
          granularLessons: kp.granularLessons || [],
        }))
        const kpNameById = new Map<string, string>()
        ;(task.knowledgePoints || []).forEach((id, i) => {
          const name = (task.knowledgePointNames || [])[i]
          if (name) kpNameById.set(id, name)
        })
        const selected: KnowledgePointItem[] = (state.knowledgePoints || []).map((id: string) => {
          const found = pool.find((p) => p.id === id)
          return found || { id, name: kpNameById.get(id) || id, linked: false }
        })
        return (
          <KnowledgeSelector
            standalone={false}
            selected={selected}
            pool={pool}
            onChange={(items) => {
              const ids = items.map((i) => i.id)
              datasets.setKnowledgePoints((prev) => {
                const next = [...prev]
                for (const item of items) {
                  if (
                    item.id.startsWith('kp-custom-') &&
                    !datasets.customKnowledgePointIds.has(item.id)
                  ) {
                    datasets.markKnowledgePointCustom(item.id)
                  }
                  const idx = next.findIndex((k) => k.id === item.id)
                  if (idx >= 0) {
                    next[idx] = {
                      ...next[idx],
                      name: item.name,
                      description: item.description || '',
                      code: item.code || '',
                      granularLessons: item.granularLessons || next[idx].granularLessons || [],
                    }
                  } else {
                    next.push({
                      id: item.id,
                      name: item.name,
                      description: item.description || '',
                      code: item.code || '',
                      linked: item.linked,
                      granularLessons: item.granularLessons || [],
                    })
                  }
                }
                return next
              })
              updateState({ knowledgePoints: ids })
            }}
            onAddCustom={() => {}}
          />
        )
      }

      case 'ability': {
        // abilityDetailOpen, selectedAbilityForDetail, expandedDomains, abilitySearch are defined at component top level

        // If no position is associated, show warning instead of ability list
        if (!positionId) {
          return (
            <EmptyState
              className="h-full py-16 text-gray-400"
              icon={<AlertCircle className="h-12 w-12 opacity-50" />}
              iconClassName="text-gray-400"
              title={t('请先关联岗位后，再选择考察能力点')}
              titleClassName="text-gray-600"
            />
          )
        }

        // Build position name map
        const positionNameMap: Record<string, string> = {}
        professions.forEach((p: any) =>
          p.positions.forEach((pos: any) => {
            positionNameMap[pos.id] = pos.name
          }),
        )

        // Build abilities related to current position from bindings
        const bindings = positionAbilityBindings.filter(
          (b: any) => b.careerPositionId === positionId,
        )
        const abilityById = new Map(
          datasets.abilityPoints.map((ab: any) => [ab.id, ab]),
        )
        const relatedAbilities = bindings.map((b: any) => {
          const ab = abilityById.get(b.abilityPointId) || {}
          return {
            ...ab,
            id: b.abilityPointId,
            name: b.abilityName || ab.name || t('未命名能力'),
            positionIds: [positionId],
            domain: b?.domain || ab.domain || t('其他'),
            requiredLevel: b?.requiredLevel || ab.requiredLevel,
            proficiencyDesc: b?.rubricDescription || ab.proficiencyDesc,
          }
        })

        if (relatedAbilities.length === 0) {
          return (
            <EmptyState
              className="h-full py-16 text-gray-400"
              icon={<Award className="h-12 w-12 opacity-50" />}
              iconClassName="text-gray-400"
              title={t('目标岗位暂无关联能力点')}
              titleClassName="text-gray-600"
              description={t('请先去岗位配置页关联能力点后，再回到本页面选择')}
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    positionId && window.open(`/job/positions/${positionId}/edit`, '_blank')
                  }
                >
                  {t('去岗位配置页关联')}
                  <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              }
            />
          )
        }

        const toggleAbility = (abId: string) => {
          const selected = state.abilityPoints.includes(abId)
          updateState({
            abilityPoints: selected
              ? state.abilityPoints.filter((x) => x !== abId)
              : [...state.abilityPoints, abId],
          })
        }

        // Group by domain
        const domainGroups = relatedAbilities.reduce(
          (acc, ab) => {
            const domain = ab.domain || t('其他')
            if (!acc[domain]) acc[domain] = []
            acc[domain].push(ab)
            return acc
          },
          {} as Record<string, typeof relatedAbilities>,
        )

        const detailAb = selectedAbilityForDetail
          ? (datasets.abilityPoints.find(
              (a) => (a as { id: string }).id === selectedAbilityForDetail,
            ) as
              | {
                  name: string
                  code?: string
                  description?: string
                  domain?: string
                  positionIds?: string[]
                  requiredLevel?: string
                  proficiencyDesc?: string
                }
              | undefined)
          : null

        const requiredLevelColors: Record<string, string> = {
          了解: 'bg-gray-100 text-gray-600 border-gray-200',
          理解: 'bg-blue-50 text-blue-600 border-blue-200',
          掌握: 'bg-green-50 text-green-600 border-green-200',
          熟练: 'bg-orange-50 text-orange-600 border-orange-200',
          精通: 'bg-purple-50 text-purple-600 border-purple-200',
        }

        const domainIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
          前端工程化: Code,
          系统设计: Database,
          质量保障: Shield,
          职业素养: Users,
          服务端开发: Server,
          运维部署: Wrench,
          数据分析: BookOpen,
        }

        return (
          <div className="h-full flex flex-col">
            {/* Header bar */}
            <div className="flex items-center gap-4 mb-4 shrink-0">
              <SearchInput
                wrapperClassName="flex-1"
                iconClassName="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
                value={abilitySearch}
                onChange={setAbilitySearch}
                placeholder={t('搜索能力点名称、编码或描述...')}
              />
              <div className="text-sm text-gray-500 shrink-0">
                {t('共 {n} 个关联能力点，已选 {m} 个', {
                  n: relatedAbilities.length,
                  m: state.abilityPoints.length,
                })}
              </div>
            </div>

            <div className="flex-1 min-h-0 border rounded-xl overflow-hidden">
              <div className="h-full overflow-y-auto p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 content-start">
                {Object.entries(domainGroups).map(([domain, abilities]: [string, any]) => {
                  const filtered = abilities.filter(
                    (a: any) =>
                      !abilitySearch ||
                      (a.name || '').includes(abilitySearch) ||
                      (a.description || '').includes(abilitySearch) ||
                      (a.code || '').includes(abilitySearch),
                  )
                  if (filtered.length === 0) return null
                  const expanded = expandedDomains[domain] !== false
                  const DomainIcon = domainIconMap[domain] || Award
                  return (
                    <div
                      key={domain}
                      className="border rounded-xl overflow-hidden bg-white flex flex-col"
                    >
                      <button
                        className="w-full flex items-center gap-2 px-4 py-2.5 bg-sky-50 text-sm font-semibold text-sky-700 hover:bg-sky-100 transition-colors shrink-0"
                        onClick={() =>
                          setExpandedDomains((prev) => ({ ...prev, [domain]: !expanded }))
                        }
                      >
                        {expanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                        <DomainIcon className="h-4 w-4" />
                        <span className="flex-1 text-left truncate">{domain}</span>
                        <Badge className="text-[10px] bg-white text-sky-600 border-sky-200 shrink-0">
                          {t('{n} 个能力点', { n: filtered.length })}
                        </Badge>
                      </button>
                      {expanded && (
                        <div className="divide-y divide-gray-100 max-h-[180px] overflow-y-auto">
                          {filtered.map((ab: any) => {
                            const selected = state.abilityPoints.includes(ab.id)
                            const levelLabel = ab.requiredLevel
                              ? COMPETENCY_LEVEL_LABELS[
                                  ab.requiredLevel as keyof typeof COMPETENCY_LEVEL_LABELS
                                ] || ab.requiredLevel
                              : undefined
                            return (
                              <div
                                key={ab.id}
                                onClick={() => toggleAbility(ab.id)}
                                className={cn(
                                  'px-4 py-2.5 cursor-pointer transition-colors group',
                                  selected
                                    ? 'bg-primary/[0.03] border-l-2 border-l-primary'
                                    : 'hover:bg-gray-50 border-l-2 border-l-transparent',
                                )}
                              >
                                {/* Row 1: checkbox + name + code + badges */}
                                <div className="flex items-center gap-2">
                                  <div
                                    className={cn(
                                      'w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors',
                                      selected
                                        ? 'bg-primary border-primary'
                                        : 'border-gray-300 group-hover:border-gray-400',
                                    )}
                                  >
                                    {selected && <Check className="h-3 w-3 text-white" />}
                                  </div>
                                  <span className="text-sm font-medium text-gray-800 truncate">
                                    {ab.name}
                                  </span>
                                  {ab.code && (
                                    <span className="text-[11px] text-gray-400 font-mono shrink-0">
                                      {ab.code}
                                    </span>
                                  )}
                                  <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                                    {levelLabel && (
                                      <Badge
                                        variant="outline"
                                        className={cn(
                                          'text-[10px] font-medium h-5 px-1',
                                          requiredLevelColors[levelLabel] || '',
                                        )}
                                      >
                                        {t('胜任标准：{level}', { level: levelLabel })}
                                      </Badge>
                                    )}
                                    <span
                                      role="button"
                                      tabIndex={0}
                                      className="text-[10px] text-sky-600 hover:underline shrink-0"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setSelectedAbilityForDetail(ab.id)
                                        setAbilityDetailOpen(true)
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                          e.stopPropagation()
                                          setSelectedAbilityForDetail(ab.id)
                                          setAbilityDetailOpen(true)
                                        }
                                      }}
                                    >
                                      {t('详情')}
                                    </span>
                                  </div>
                                </div>
                                {/* Row 2: description + standard description */}
                                <div className="flex items-center gap-2 mt-1 ml-6">
                                  <p className="text-xs text-gray-500 line-clamp-1 flex-1">
                                    {ab.description}
                                  </p>
                                  <span
                                    className="text-[10px] text-gray-500 shrink-0 line-clamp-1 max-w-[50%] text-right"
                                    title={ab.proficiencyDesc || undefined}
                                  >
                                    {ab.proficiencyDesc || t('岗位胜任标准描述')}
                                  </span>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
                {Object.entries(domainGroups).filter(([_, abilities]: [string, any]) =>
                  abilities.some(
                    (a: any) =>
                      !abilitySearch ||
                      (a.name || '').includes(abilitySearch) ||
                      (a.description || '').includes(abilitySearch) ||
                      (a.code || '').includes(abilitySearch),
                  ),
                ).length === 0 && (
                  <EmptyState
                    className="col-span-full py-16"
                    icon={<Award className="h-12 w-12 opacity-50" />}
                    iconClassName="text-gray-400"
                    title={t('未找到匹配的能力点')}
                    titleClassName="text-gray-400"
                  />
                )}
              </div>
            </div>

            {/* Ability Detail Dialog */}
            <Dialog open={abilityDetailOpen} onOpenChange={setAbilityDetailOpen}>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>{t('能力点详情')}</DialogTitle>
                </DialogHeader>
                {detailAb && (
                  <div className="space-y-4 py-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-base font-semibold">{detailAb.name}</p>
                      {detailAb.code && (
                        <Badge variant="outline" className="font-mono">
                          {detailAb.code}
                        </Badge>
                      )}
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">{t('能力点描述')}</Label>
                      <p className="text-sm text-gray-700 mt-1">{detailAb.description}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">{t('所属能力领域')}</Label>
                      <p className="text-sm text-gray-700 mt-1">{detailAb.domain || '-'}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">{t('关联岗位')}</Label>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {(
                          detailAb.positionIds
                            ?.map((pid: any) => positionNameMap[pid])
                            .filter(Boolean) || []
                        ).map((name: any, i: number) => (
                          <Badge key={i} variant="secondary">
                            {name}
                          </Badge>
                        ))}
                        {(!detailAb.positionIds || detailAb.positionIds.length === 0) && (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">{t('胜任标准')}</Label>
                      <p className="text-sm text-gray-700 mt-1">
                        {detailAb.requiredLevel
                          ? COMPETENCY_LEVEL_LABELS[
                              detailAb.requiredLevel as keyof typeof COMPETENCY_LEVEL_LABELS
                            ] || detailAb.requiredLevel
                          : '-'}
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">{t('岗位胜任标准描述')}</Label>
                      <p className="text-sm text-gray-700 mt-1 whitespace-pre-line">
                        {detailAb.proficiencyDesc || '-'}
                      </p>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </div>
        )
      }

      case 'resources': {
        const rPool: ResourceItem[] = datasets.learningResources.map((r) => ({
          id: r.id,
          name: r.name,
          type: r.type,
          url: r.url,
          description: r.description,
          size: r.size,
        }))
        return (
          <ResourceSelector
            standalone={false}
            pool={rPool}
            selectedIds={state.resources || []}
            onChange={(ids: string[]) => updateState({ resources: ids })}
            onUpload={(r: ResourceItem) => {
              datasets.markResourceCustom(r.id)
              datasets.setLearningResources((prev) => [...prev, r as TaskResourceItem])
            }}
          />
        )
      }

      case 'evaluation': {
        return (
          <EvalMethodSelector
            value={state.evaluationMethods}
            onChange={(newMethods) => {
              const newDisabled = (state.disabledEvaluationMethods || []).filter(
                (d: string) => !newMethods.includes(d),
              )
              // 取消勾选的方法保留在 disabled 列表，确保保存 payload 始终包含全量方法，
              // 后端只更新 payload 内的方法，缺省不会误禁用其他方法
              const removed = state.evaluationMethods.filter((m) => !newMethods.includes(m))
              const newWeights = { ...state.methodWeights }
              for (const m of newMethods) {
                if (!state.evaluationMethods.includes(m)) newWeights[m] = 0
              }
              for (const m of state.evaluationMethods.filter(
                (sm: string) => !newMethods.includes(sm),
              )) {
                newWeights[m] = 0
              }
              updateState({
                evaluationMethods: newMethods,
                methodWeights: newWeights,
                disabledEvaluationMethods: [...newDisabled, ...removed],
              })
            }}
          />
        )
      }

      case 'evaluationRules':
        return (
          <EvaluationRulesEditor
            inline
            evaluationMethods={state.evaluationMethods}
            config={taskStateToEvalRuleConfig(state)}
            onChange={(config) => updateState(evalRuleConfigToTaskStateUpdates(config))}
            knowledgePoints={datasets.knowledgePoints}
            abilityPoints={
              datasets.abilityPoints as { id: string; name: string; description?: string }[]
            }
            onPersistStandard={handlePersistStandard}
          />
        )
      case 'weight':
        return <TaskWeightCard />
    }
  }

  const isFullScreen =
    cardType === 'evaluationRules' ||
    cardType === 'weight' ||
    cardType === 'knowledge' ||
    cardType === 'ability' ||
    cardType === 'resources'
  const dialogSizeClass = isFullScreen
    ? 'sm:max-w-[95vw] max-h-[95vh] h-[95vh]'
    : cardType === 'evaluation'
      ? 'sm:max-w-[720px] max-h-[85vh]'
      : cardType === 'description'
        ? 'sm:max-w-[900px] max-h-[90vh]'
        : cardType === 'info'
          ? 'sm:max-w-[650px] max-h-[85vh]'
          : 'sm:max-w-[550px] max-h-[85vh]'

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className={cn('flex flex-col overflow-hidden', dialogSizeClass)}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="p-1.5 bg-primary/10 rounded">{config.icon}</div>
            {t(config.title)}
          </DialogTitle>
          <DialogDescription>{t('任务：{name}', { name: task.name })}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSave()
          }}
          className="flex flex-col flex-1 min-h-0 gap-4"
        >
          <div className="shrink-0 px-0">{renderAiToolbar()}</div>
          <div className={cn('flex-1 py-4 overflow-y-auto', flashKey ? 'ai-write-flash' : undefined)}>
            {renderContent()}
          </div>
          <FormDialogFooter
            onCancel={onClose}
            confirmText={t('保存')}
            cancelText={t('取消')}
            loading={isSavingCard}
          />
        </form>

        {/* AI 进度弹窗；运行中关闭视为取消 */}
        <AiAssistProgressDialog
          open={pipeline.open}
          onOpenChange={pipeline.handleOpenChange}
          title={t('AI 辅助编写')}
          description={t('大模型正在根据场景与任务内容生成建议')}
          steps={aiSteps}
          currentStep={pipeline.phase}
          progress={pipeline.progress}
        />

        {/* AI 未配置引导弹窗 */}
        <AiNotConfiguredDialog open={ai.notConfiguredOpen} onOpenChange={ai.setNotConfiguredOpen} />
      </DialogContent>
    </Dialog>
  )
}

// ============ Weight Config Dialog ============

function WeightConfigDialog({
  open,
  onOpenChange,
  tasks,
  taskStates,
  updateAnyState,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  tasks: Task[]
  taskStates: Record<string, TaskState>
  updateAnyState: (id: string, u: Partial<TaskState>) => void
}) {
  const t = useT()
  const colors = [
    'bg-blue-500',
    'bg-green-500',
    'bg-purple-500',
    'bg-orange-500',
    'bg-cyan-500',
    'bg-pink-500',
  ]
  const pieColors = ['#3b82f6', '#22c55e', '#a855f7', '#f97316', '#06b6d4', '#ec4899']

  const handleGlobalWeightChange = (tid: string, val: number) => {
    updateAnyState(tid, { weight: Math.max(0, Math.min(100, val)) })
  }

  const toggleGlobalLock = (tid: string) => {
    const s = taskStates[tid]
    updateAnyState(tid, { locked: !s?.locked })
  }

  const distributeGlobal = () => {
    const unlocked = tasks.filter((t) => !taskStates[t.id]?.locked)
    const lockedWeight = tasks
      .filter((t) => taskStates[t.id]?.locked)
      .reduce((s, t) => s + (taskStates[t.id]?.weight || 0), 0)
    const remaining = 100 - lockedWeight
    const each = Math.floor(remaining / unlocked.length)
    unlocked.forEach((t, i) => {
      updateAnyState(t.id, { weight: each + (i < remaining % unlocked.length ? 1 : 0) })
    })
  }

  const totalW = tasks.reduce((sum, t) => sum + (taskStates[t.id]?.weight || 0), 0)

  const pieData = tasks
    .map((t, i) => ({
      name: t.name,
      value: taskStates[t.id]?.weight || 0,
      color: pieColors[i % pieColors.length],
    }))
    .filter((d) => d.value > 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-3xl max-h-[90vh] flex flex-col"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PieChartIcon className="h-5 w-5" />
            {t('配置任务权重')}
          </DialogTitle>
          <DialogDescription>{t('调整所有任务的权重分配，总权重应为 100%')}</DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto py-4 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span
                className={cn(
                  'text-lg font-semibold',
                  totalW === 100 ? 'text-green-600' : 'text-amber-600',
                )}
              >
                {t('总权重: {n}%', { n: totalW })}
              </span>
              {totalW !== 100 && (
                <span className="text-sm text-amber-600">
                  {totalW > 100
                    ? t('超出 {n}%', { n: totalW - 100 })
                    : t('还需分配 {n}%', { n: 100 - totalW })}
                </span>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={distributeGlobal}>
              <Scale className="mr-2 h-4 w-4" />
              {t('一键平均分配')}
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Pie Chart */}
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `${value}%`} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Legend */}
            <div className="h-64 overflow-y-auto space-y-2">
              {tasks.map((t, i) => (
                <div key={t.id} className="flex items-center gap-2 text-sm">
                  <div className={cn('w-3 h-3 rounded-full shrink-0', colors[i % colors.length])} />
                  <span className="truncate flex-1">{t.name}</span>
                  <span className="text-gray-500 font-medium">
                    {taskStates[t.id]?.weight || 0}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Progress Bar */}
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden flex">
            {tasks.map((t, i) => (
              <div
                key={t.id}
                className={cn('transition-all duration-300', colors[i % colors.length])}
                style={{ width: `${taskStates[t.id]?.weight || 0}%` }}
              />
            ))}
          </div>

          {/* Task List */}
          <div className="space-y-2">
            {tasks.map((t, i) => {
              const s = taskStates[t.id]
              return (
                <div
                  key={t.id}
                  className="flex items-center gap-4 p-3 rounded-lg border border-gray-100 bg-white hover:border-gray-200 transition-colors"
                >
                  <div className={cn('w-3 h-8 rounded-full shrink-0', colors[i % colors.length])} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-xs font-medium text-gray-600">
                        {i + 1}
                      </span>
                      <span className="font-medium text-gray-700 truncate text-sm">{t.name}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Input
                      type="number"
                      value={s?.weight || 0}
                      onChange={(e) =>
                        handleGlobalWeightChange(t.id, parseInt(e.target.value) || 0)
                      }
                      disabled={s?.locked}
                      className={cn('w-20 text-center', s?.locked && 'bg-gray-50')}
                      min={0}
                      max={100}
                    />
                    <span className="text-gray-500 w-4">%</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => toggleGlobalLock(t.id)}
                    className={cn('h-8 w-8', s?.locked ? 'text-amber-500' : 'text-gray-400')}
                  >
                    {s?.locked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                  </Button>
                </div>
              )
            })}
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button disabled={totalW !== 100} onClick={() => onOpenChange(false)}>
            {t('保存')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
