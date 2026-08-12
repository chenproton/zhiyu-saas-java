'use client'

// 复制自 portal 场景任务链编辑页 apps/edu/app/scene/scenarios/[id]/edit/tasks/page.tsx（方案A：复制胶水页 + 组件层复用）。
// 纯函数/卡片组件直接 import portal 原文件复用：tasks-logic、task-info-card、task-description-card（见下方 import）。
// 裁剪点（共通 bug 修复时需双向检查）：
// - useAuth/useTaskDatasets 删除：其耦合 portal useAuth 与 12 个 portal api；
//   替换为文件内 useCoBuildDatasets（只加载 evaluation 需要的学校能力点 + 量规模板，走 partnerCobuildSchoolApi）
// - 删除卡片：knowledge/ability/resources/weight（含 WeightConfigDialog/persistWeights）、克隆/引用（my/collab/public 三 tab）；
//   保留 info/description/evaluation/evaluationRules 四种卡片 + 新增/编辑/删除/拖拽排序
// - api 全部换成 partnerCobuild*：taskApi→partnerCobuildScenarioApi.createTask/partnerCobuildTaskApi，
//   taskEvaluationApi→partnerCobuildTaskApi.listEvaluationMethods/saveEvaluationMethods
// - 删除 portal 专属：预览、publish/archive；按 status 控制（draft/rejected+提交审核，pending+撤回，其余只读）
// - 未落库临时 id（task- 前缀）处理逻辑沿用 portal
import {
  FileText,
  GripVertical,
  Plus,
  Star,
  Trash2,
  Copy,
  Scale,
  CheckCircle2,
  Search,
  PieChart as PieChartIcon,
  Check,
  Award,
  Lock,
  Unlock,
} from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
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
  partnerCobuildScenarioApi,
  partnerCobuildPositionApi,
  partnerCobuildTaskApi,
  partnerCobuildWeightApi,
  partnerCobuildSchoolApi,
} from '@/lib/api'
import type { CoBuildScenario } from '@/lib/api'
import type { ScenarioTask as ApiScenarioTask } from '@/lib/types/scene'
import { EvaluationRulesEditor } from '@/components/evaluation-rules'
import type { RubricScheme } from '@/components/evaluation-rules/types'
import { uid } from '@/components/evaluation-rules/utils'
import { useToast } from '@zhiyu/ui'
import { StatusBadge } from '@/components/shared/status-badge'
import { EditorShell } from '@/components/shared/editor-shell'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { EvalMethodSelector } from '@/components/shared/eval-method-selector'
import { reportError } from '@/lib/error-handling'
import { useT } from '@/lib/i18n/locale-provider'
import type { Task } from '@/lib/types/scene-mock'
// 直接复用 portal 任务链页的纯逻辑与卡片组件（不复制）
import { TaskInfoCard } from '../../../../../../scene/scenarios/[id]/edit/tasks/_components/task-info-card'
import { TaskDescriptionCard } from '../../../../../../scene/scenarios/[id]/edit/tasks/_components/task-description-card'
import { TaskWeightCard } from '../../../../../../scene/scenarios/[id]/edit/tasks/_components/task-weight-card'
import { KnowledgeSelector } from '@/components/shared/knowledge-selector'
import type { KnowledgePointItem } from '@/lib/types/lesson'
import { ResourceSelector, type ResourceItem } from '@/components/shared/resource-selector'
import type { Course } from '@/lib/types/lesson'
import type {
  TaskKnowledgePointItem,
  TaskResourceItem,
} from '../../../../../../scene/scenarios/[id]/edit/tasks/_components/hooks/use-task-datasets'
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
} from '../../../../../../scene/scenarios/[id]/edit/tasks/_components/tasks-logic'


// 全量卡片（与 portal 场景任务链编辑页一致：知识/能力/资源/权重卡片齐备）
const PARTNER_CARD_TYPES: CardType[] = [
  'info',
  'description',
  'knowledge',
  'ability',
  'resources',
  'evaluation',
  'evaluationRules',
  'weight',
]
const partnerCardConfigs = cardConfigs.filter((c) => PARTNER_CARD_TYPES.includes(c.type))

// get 端点当前只返回场景主表字段（tenantId 为学校租户）
type CoBuildScenarioDetail = CoBuildScenario & { tenantId?: string }

// 任务链编辑器数据集：全部走合作学校只读接口（partner token 调不通 portal 数据接口），
// 与 portal useTaskDatasets 形状对齐（knowledge/ability/resources/evaluation/users/clone）。
function useCoBuildDatasets(schoolTenantId: string, positionId?: string) {
  const t = useT()
  const [knowledgePoints, setKnowledgePoints] = useState<TaskKnowledgePointItem[]>([])
  const [learningResources, setLearningResources] = useState<TaskResourceItem[]>([])
  const [abilityPoints, setAbilityPoints] = useState<unknown[]>([])
  const [granularLessons, setGranularLessons] = useState<Course[]>([])
  const [users, setUsers] = useState<unknown[]>([])
  const [rubricLibrary, setRubricLibrary] = useState<RubricScheme[]>([])
  const [positionAbilityBindings, setPositionAbilityBindings] = useState<unknown[]>([])
  const [scenarios, setScenarios] = useState<unknown[]>([])
  const [cloneDataVersion, setCloneDataVersion] = useState(0)
  const [customKnowledgePointIds, setCustomKnowledgePointIds] = useState<Set<string>>(new Set())
  const [customResourceIds, setCustomResourceIds] = useState<Set<string>>(new Set())
  const persistedCustomKnowledgePointIds = useRef<Set<string>>(new Set())
  const customAbilityPointIds = useRef<Set<string>>(new Set())
  const loadedDatasetsRef = useRef<Set<string>>(new Set())

  const loadDatasets = useCallback(
    async (keys: string[]) => {
      if (!schoolTenantId) return
      const pending = keys.filter((k) => !loadedDatasetsRef.current.has(k))
      if (pending.length === 0) return
      pending.forEach((k) => loadedDatasetsRef.current.add(k))
      const jobs = pending.map(async (key) => {
        try {
          if (key === 'knowledge') {
            const [kpRes, glRes] = await Promise.all([
              partnerCobuildSchoolApi.knowledgePoints(schoolTenantId, { limit: 1000 }),
              partnerCobuildSchoolApi.courses(schoolTenantId, { type: 'granular', limit: 1000 }),
            ])
            const nextKp: TaskKnowledgePointItem[] = []
            ;(kpRes.items || []).forEach((kp: any) => {
              nextKp.push({
                ...kp,
                granularLessons: kp.granularLessonIds || kp.granularLessons || [],
              })
            })
            setKnowledgePoints(nextKp)
            setGranularLessons((glRes.items || []) as Course[])
          } else if (key === 'ability') {
            const apRes = await partnerCobuildSchoolApi.abilities(schoolTenantId, { limit: 1000 })
            setAbilityPoints(apRes.items || [])
            if (positionId) {
              try {
                const bindingsRes = await partnerCobuildSchoolApi.abilityBindings(schoolTenantId, {
                  careerPositionId: positionId,
                  limit: 1000,
                })
                setPositionAbilityBindings(bindingsRes.items || [])
              } catch {
                setPositionAbilityBindings([])
              }
            }
          } else if (key === 'resources') {
            const resRes = await partnerCobuildSchoolApi.resources(schoolTenantId, { limit: 1000 })
            setLearningResources(
              (resRes.items || []).map((res: any) => ({
                ...res,
                type: res.resourceType || res.type,
                size: res.fileSize !== undefined ? String(res.fileSize) : res.size,
              })),
            )
          } else if (key === 'evaluation') {
            const res = await partnerCobuildSchoolApi.evaluationMethods(schoolTenantId)
            const mapTemplate = (rt: any): RubricScheme => ({
              id: rt.id,
              name: rt.name,
              types: rt.types || [],
              desc: rt.description || '',
              points: rt.mode === 'rubric' ? rt.data?.points || [] : [],
              mode: (rt.mode || 'rubric') as RubricScheme['mode'],
              scoreRuleItems: rt.mode === 'score_rule' ? rt.data?.scoreRuleItems : undefined,
              isDeleted: rt.isDeleted || false,
            })
            setRubricLibrary((res.items || []).map(mapTemplate))
          } else if (key === 'users') {
            const res = await partnerCobuildSchoolApi.coBuilders(schoolTenantId)
            setUsers(res.items || [])
          } else if (key === 'clone') {
            const [allScenariosRes, allTasksRes] = await Promise.all([
              partnerCobuildSchoolApi.scenarios(schoolTenantId, { limit: 1000 }),
              partnerCobuildSchoolApi.tasks(schoolTenantId, { limit: 1000 }),
            ])
            const scenarioNameMap = new Map<string, string>()
            const scenarioMetaMap = new Map<
              string,
              { creatorId: string; coBuilderIds: string[]; status: string }
            >()
            for (const s of allScenariosRes.items) {
              scenarioNameMap.set(s.id, s.name)
              scenarioMetaMap.set(s.id, {
                creatorId: s.creatorId,
                coBuilderIds: s.coBuilderIds || [],
                status: s.status,
              })
            }
            const tasksByScenarioId = new Map<string, unknown[]>()
            for (const item of allTasksRes.items) {
              const sName = scenarioNameMap.get(item.scenarioId) || t('未知场景')
              const sMeta = scenarioMetaMap.get(item.scenarioId) || {
                creatorId: '',
                coBuilderIds: [],
                status: '',
              }
              const enhanced = {
                ...item,
                scenarioName: sName,
                scenarioCreatorId: sMeta.creatorId,
                scenarioCoBuilderIds: sMeta.coBuilderIds,
                scenarioStatus: sMeta.status,
              }
              if (!tasksByScenarioId.has(item.scenarioId)) tasksByScenarioId.set(item.scenarioId, [])
              tasksByScenarioId.get(item.scenarioId)!.push(enhanced)
            }
            const nextScenarios: unknown[] = []
            for (const s of allScenariosRes.items) {
              const tasksForScenario = tasksByScenarioId.get(s.id) || []
              if (tasksForScenario.length > 0) {
                nextScenarios.push({ ...s, tasks: tasksForScenario })
              }
            }
            setScenarios(nextScenarios)
            setCloneDataVersion((v) => v + 1)
          }
        } catch (err) {
          reportError(err, `加载数据集 ${key}`)
        }
      })
      await Promise.all(jobs)
    },
    [schoolTenantId, positionId, t],
  )

  // 量规模板：学校只读列表 → 编辑器内部 RubricScheme 结构
  const loadRubricTemplates = useCallback(async (): Promise<RubricScheme[]> => {
    if (!schoolTenantId) return []
    const res = await partnerCobuildSchoolApi.evaluationMethods(schoolTenantId)
    return (res.items || []).map((tpl) => ({
      id: tpl.id,
      name: tpl.name,
      types: (tpl.types || []) as RubricScheme['types'],
      desc: tpl.description || '',
      points:
        tpl.mode === 'score_rule'
          ? []
          : ((tpl.data?.points || []) as any[]).map((p) => ({
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
      mode: tpl.mode || 'rubric',
      scoreRuleItems: tpl.mode === 'score_rule' ? tpl.data?.scoreRuleItems : undefined,
      isDeleted: tpl.isDeleted || false,
    }))
  }, [schoolTenantId])

  // EvaluationRulesEditor 数据源注入：学校只读列表 + 只读模式（隐藏写操作）
  const evalDataSource = useMemo(
    () =>
      schoolTenantId
        ? {
            readOnly: true,
            skipPortalPreload: true,
            loadRubricTemplates,
            loadKnowledgePoints: async (search: string) => {
              const res = await partnerCobuildSchoolApi.knowledgePoints(schoolTenantId, {
                search,
                limit: 200,
              })
              return (res.items || []) as any[]
            },
            loadAbilityPoints: async (search: string) => {
              const res = await partnerCobuildSchoolApi.abilities(schoolTenantId, {
                search,
                limit: 200,
              })
              return (res.items || []) as any[]
            },
            loadRandomDrawQuestions: async () => {
              const res = await partnerCobuildSchoolApi.randomDrawQuestions(schoolTenantId, {
                limit: 1000,
              })
              return (res.items || []) as any[]
            },
            loadMajors: async () => {
              const res = await partnerCobuildSchoolApi.majors(schoolTenantId, { limit: 1000 })
              return (res.items || []).map((m: any) => ({ id: m.id, name: m.name }))
            },
            loadExams: async () => {
              const res = await partnerCobuildSchoolApi.exams(schoolTenantId, { limit: 1000 })
              return (res.items || []) as any[]
            },
            loadQuestionBanks: async () => {
              const res = await partnerCobuildSchoolApi.questionBanks(schoolTenantId, {
                limit: 1000,
              })
              return (res.items || []) as any[]
            },
            loadQuestions: async (bankId: string) => {
              const res = await partnerCobuildSchoolApi.questions(schoolTenantId, {
                bankId,
                limit: 1000,
              })
              return (res.items || []) as any[]
            },
            getQuestion: async (id: string) => {
              const res = await partnerCobuildSchoolApi.questions(schoolTenantId, {
                search: id,
                limit: 1,
              })
              return (res.items || [])[0] as any
            },
          }
        : undefined,
    [schoolTenantId, loadRubricTemplates],
  )

  // KnowledgeSelector 数据源注入：学校只读（岗位/场景/任务/知识点/微课程）
  const knowledgeDataSource = useMemo(
    () =>
      schoolTenantId
        ? {
            readOnly: true,
            loadGranularCourses: async () => {
              const res = await partnerCobuildSchoolApi.courses(schoolTenantId, {
                type: 'granular',
                limit: 1000,
              })
              return (res.items || []) as Course[]
            },
            loadPositions: async () => {
              const res = await partnerCobuildPositionApi.list({ schoolTenantId, limit: 200 })
              return (res.items || []) as any[]
            },
            loadScenarios: async () => {
              const res = await partnerCobuildSchoolApi.scenarios(schoolTenantId, { limit: 1000 })
              return (res.items || []) as any[]
            },
            loadTasks: async (sid: string) => {
              const res = await partnerCobuildScenarioApi.listTasks(sid)
              return (res.items || []) as any[]
            },
            listKnowledgePoints: async (params: { limit: number; offset: number }) =>
              partnerCobuildSchoolApi.knowledgePoints(schoolTenantId, params),
            searchKnowledgePoints: async (search: string) => {
              const res = await partnerCobuildSchoolApi.knowledgePoints(schoolTenantId, {
                search,
                limit: 200,
              })
              return (res.items || []) as any[]
            },
          }
        : undefined,
    [schoolTenantId],
  )

  return {
    knowledgePoints,
    setKnowledgePoints,
    learningResources,
    setLearningResources,
    abilityPoints,
    setAbilityPoints,
    granularLessons,
    setGranularLessons,
    users,
    setUsers,
    rubricLibrary,
    setRubricLibrary,
    positionAbilityBindings,
    setPositionAbilityBindings,
    scenarios,
    setScenarios,
    cloneDataVersion,
    bumpCloneDataVersion: () => setCloneDataVersion((v) => v + 1),
    knowledgeDataSource,
    customKnowledgePointIds,
    setCustomKnowledgePointIds,
    markKnowledgePointCustom: (id: string, persisted = false) => {
      setCustomKnowledgePointIds((prev) => {
        if (prev.has(id)) return prev
        const next = new Set(prev)
        next.add(id)
        return next
      })
      if (persisted) {
        persistedCustomKnowledgePointIds.current.add(id)
      }
    },
    customResourceIds,
    setCustomResourceIds,
    markResourceCustom: (id: string) => {
      setCustomResourceIds((prev) => {
        if (prev.has(id)) return prev
        const next = new Set(prev)
        next.add(id)
        return next
      })
    },
    persistedCustomKnowledgePointIds,
    customAbilityPointIds,
    loadDatasets,
    loadRubricTemplates,
    evalDataSource,
  }
}

// ============ Main Page ============

export default function PartnerTasksEditPage() {
  const params = useParams()
  const router = useRouter()
  const scenarioId = params.id as string
  const { toast } = useToast()
  const t = useT()

  const [existingScenario, setExistingScenario] = useState<CoBuildScenarioDetail | null>(null)
  const [positionName, setPositionName] = useState('')
  const [loadFailed, setLoadFailed] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const [tasks, setTasks] = useState<Task[]>([])
  const [taskStates, setTaskStates] = useState<Record<string, TaskState>>({})

  const taskStatesRef = useRef(taskStates)
  useEffect(() => {
    taskStatesRef.current = taskStates
  }, [taskStates])

  const schoolTenantId = existingScenario?.schoolTenantId || existingScenario?.tenantId || ''
  const datasets = useCoBuildDatasets(schoolTenantId, existingScenario?.careerPositionId)

  // 首屏加载 effect 仅以 scenarioId 触发一次；易变依赖（locale/t）用 ref 持有，避免整页重载重建 taskStates（未保存编辑丢失）
  const toastRef = useRef(toast)
  const tRef = useRef(t)
  useEffect(() => {
    toastRef.current = toast
    tRef.current = t
  })

  // Load core data on mount
  useEffect(() => {
    const load = async () => {
      try {
        const scenarioData = (await partnerCobuildScenarioApi.get(
          scenarioId,
        )) as CoBuildScenarioDetail
        const tenantId = scenarioData.schoolTenantId || scenarioData.tenantId || ''
        const [tasksRes, posRes] = await Promise.all([
          partnerCobuildScenarioApi.listTasks(scenarioId),
          tenantId
            ? partnerCobuildPositionApi.list({ schoolTenantId: tenantId, limit: 200 })
            : Promise.resolve({ items: [] as { id: string; name: string }[], total: 0 }),
        ])
        setExistingScenario(scenarioData)
        setPositionName(
          posRes.items.find((p) => p.id === scenarioData.careerPositionId)?.name || '',
        )

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
          mockTasks.map((t) =>
            partnerCobuildTaskApi.listEvaluationMethods(t.id).catch(() => ({ methods: [] })),
          ),
        )

        // Initialize taskStates from API method data
        const count = mockTasks.length
        const states: Record<string, TaskState> = {}
        mockTasks.forEach((t, i) => {
          const methods = allMethods[i]?.methods || []
          const ts = taskStateFromMethods(methods)
          // 知识/能力/资源已绑定的 id 保留在 state 中随保存原样回传，避免数据丢失
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
          const wres = await partnerCobuildWeightApi.list(scenarioId)
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
    // 仅场景变化时触发一次；locale 变化不再整页重载
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenarioId])

  const [editingCard, setEditingCard] = useState<{ taskId: string; type: CardType } | null>(null)
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false)
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null)
  const [deleteConfirmTask, setDeleteConfirmTask] = useState<{ id: string; name: string } | null>(
    null,
  )

  // 克隆/引用与权重配置（与 portal 任务链页一致）
  const [isCloneOpen, setIsCloneOpen] = useState(false)
  const [cloneMode, setCloneMode] = useState<'clone' | 'reference'>('clone')
  const [cloneSearch, setCloneSearch] = useState('')
  const [cloneTab, setCloneTab] = useState<'my' | 'collab' | 'public'>('my')
  const [selectedClone, setSelectedClone] = useState<string[]>([])
  const [isCloning, setIsCloning] = useState(false)
  const [isWeightConfigOpen, setIsWeightConfigOpen] = useState(false)

  // 打开克隆对话框时预取学校场景/任务候选
  useEffect(() => {
    if (isCloneOpen && schoolTenantId) {
      datasets.loadDatasets(['clone'])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCloneOpen, schoolTenantId])

  const allTasks = useMemo(() => {
    void datasets.cloneDataVersion
    return (datasets.scenarios as any[]).flatMap((s) =>
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

  const handleClone = async () => {
    setIsCloning(true)
    try {
      const selected = allTasks.filter((t) => selectedClone.includes(t.id))
      const count = tasks.length + selected.length

      const newTasks = selected.map((t, i) => ({
        ...t,
        id: `task-${cloneMode}-${Date.now()}-${i}`,
        order: tasks.length + i + 1,
        isReferenced: cloneMode === 'reference',
        sourceScenarioId: t.scenarioId,
        sourceScenarioName: cloneMode === 'reference' ? t.scenarioName : undefined,
      }))

      const methodsResults = await Promise.all(
        selected.map((t) =>
          partnerCobuildTaskApi.listEvaluationMethods(t.id).catch(() => ({ methods: [] })),
        ),
      )

      const newStates: Record<string, TaskState> = {}
      selected.forEach((t, i) => {
        const methods = methodsResults[i]?.methods || []
        const ts = taskStateFromMethods(methods)
        if (t.knowledgePointIds) ts.knowledgePoints = [...t.knowledgePointIds]
        if (t.abilityPointIds) ts.abilityPoints = [...t.abilityPointIds]
        if (t.resourceIds) ts.resources = [...t.resourceIds]
        if (t.detailedDescription) ts.description = t.detailedDescription
        if (t.descriptionPdf) ts.descriptionPdf = t.descriptionPdf
        ts.weight =
          count > 0 ? Math.floor(100 / count) + (tasks.length + i < 100 % count ? 1 : 0) : 0
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

  // 持久化任务权重（仅对已落库任务；后端 ON CONFLICT (scenario_id, task_id) 幂等 upsert）
  const persistWeights = async (taskList: Task[], states: Record<string, TaskState>) => {
    const weights: { taskId: string; weight: number }[] = []
    for (const t of taskList) {
      if (t.id.startsWith('task-')) continue
      const st = states[t.id]
      if (!st) continue
      weights.push({ taskId: t.id, weight: st.weight ?? 0 })
    }
    if (weights.length === 0) return 0
    try {
      await partnerCobuildWeightApi.save(scenarioId, weights)
      return 0
    } catch (err) {
      reportError(err, { source: '保存任务权重' })
      return weights.length
    }
  }

  // 场景加载完成后预取数据集（知识/能力/资源/评价/用户），供卡片回显名称
  useEffect(() => {
    if (!schoolTenantId) return
    datasets.loadDatasets(['knowledge', 'ability', 'resources', 'evaluation', 'users'])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolTenantId])

  const [newTask, setNewTask] = useState({
    name: '',
    hours: 4,
    type: 'training' as 'assessment' | 'training',
    difficulty: 3,
    background: '',
  })

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
        // 优先使用服务端随任务返回的名称，再回退全量知识点列表
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
      const payload: Partial<ApiScenarioTask> = {
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
      const created = await partnerCobuildScenarioApi.createTask(scenarioId, payload)
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
      newStates[created.id] = makeDefaultTaskState(newTasks.length, newTasks.length - 1)
      setTaskStates(newStates)
      setIsAddTaskOpen(false)
      setNewTask({ name: '', hours: 4, type: 'training', difficulty: 3, background: '' })
      toast({ title: t('已添加任务') })
    } catch (err: any) {
      toast({ variant: 'destructive', title: t('添加失败'), description: err.message })
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
      await partnerCobuildTaskApi.delete(id)
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

  const saveTasksToBackend = async () => {
    const updatedTaskStates: Record<string, TaskState> = { ...taskStates }
    const newTasks: Task[] = []
    for (let i = 0; i < tasks.length; i++) {
      const t = tasks[i]
      const ts = updatedTaskStates[t.id] || makeDefaultTaskState(0, 0)
      const payload: Partial<ApiScenarioTask> = {
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
        const created = await partnerCobuildScenarioApi.createTask(scenarioId, payload)
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
        await partnerCobuildTaskApi.update(t.id, payload)
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
    // 持久化任务权重（新建/更新任务后统一写入）
    await persistWeights(newTasks, updatedTaskStates)
  }

  const handleSaveDraft = async () => {
    setIsSaving(true)
    try {
      await saveTasksToBackend()
      toast({ title: t('已保存') })
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
      toast({ title: t('配置已保存') })
      router.push('/partner/co-build/scenes')
    } catch (err: any) {
      toast({ variant: 'destructive', title: t('保存失败'), description: err.message })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <EditorShell
      mode="inline"
      backText={t('返回')}
      onBack={() => router.push('/partner/co-build/scenes')}
      step={2}
      stepLabel={t('任务链配置')}
      onSaveDraft={handleSaveDraft}
      isSaving={isSaving}
      saveText={t('保存')}
      onPrev={() => router.push(`/partner/co-build/scenes/${scenarioId}/edit`)}
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
                <Badge variant="secondary" className="text-[10px]">
                  {t('企业共建')}
                </Badge>
                {existingScenario && <StatusBadge status={existingScenario.status} />}
              </div>
              <CardDescription className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="truncate">
                  {positionName || existingScenario?.careerPositionId || t('未选择岗位')}
                  {' | '}
                  {(existingScenario?.industryNames || []).join('、') || t('未选择行业')}
                  {' | '}
                  {(existingScenario?.professionNames || []).join('、') || t('未选择专业')}
                </span>
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
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setCloneMode('clone')
              setIsCloneOpen(true)
            }}
          >
            <Copy className="mr-2 h-4 w-4" />
            {t('克隆/引用任务')}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              if (!isWeightConfigOpen) void persistWeights(tasks, taskStates)
              setIsWeightConfigOpen(true)
            }}
          >
            <Scale className="mr-2 h-4 w-4" />
            {t('配置权重')}
          </Button>
          <Badge
            variant={totalWeight === 100 ? 'secondary' : 'destructive'}
            className="text-[11px]"
          >
            {t('总权重 {n}%', { n: totalWeight })}
          </Badge>
          <Button size="sm" onClick={() => setIsAddTaskOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t('添加任务')}
          </Button>
        </div>
      </div>

      <fieldset className="contents">
        {/* Task List with unified horizontal scroll */}
        <div className="overflow-x-auto pb-2 -mx-2 px-2">
          {/* Column Headers — mirror row structure for precise alignment */}
          <div className="flex items-start gap-3 min-w-max pr-2">
            <div className="w-8 shrink-0" />
            {partnerCardConfigs.map((c) => (
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
                  partnerCobuildScenarioApi
                    .reorderTasks(
                      scenarioId,
                      reordered.map((t) => t.id),
                    )
                    .catch((err) => reportError(err, { source: '保存任务排序' }))
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
                  {partnerCardConfigs.map((config) => {
                    const configured = isConfigured(task.id, config.type)
                    const summary = getSummary(task.id, config.type)
                    const isRef = !!task.isReferenced

                    return (
                      <button
                        key={config.type}
                        onClick={() => !isRef && setEditingCard({ taskId: task.id, type: config.type })}
                        disabled={isRef}
                        className={cn(
                          'w-52 h-40 shrink-0 rounded-lg border p-3.5 text-left transition-all flex flex-col',
                          isRef
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
              <div className="py-16 text-center">
                <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 mb-4">{t('暂无任务，点击添加第一个任务')}</p>
                <Button onClick={() => setIsAddTaskOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  {t('添加任务')}
                </Button>
              </div>
            )}
          </div>
        </div>
      </fieldset>

      {/* Add Task Dialog */}
      <Dialog open={isAddTaskOpen} onOpenChange={setIsAddTaskOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('添加任务')}</DialogTitle>
          </DialogHeader>
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddTaskOpen(false)}>
              {t('取消')}
            </Button>
            <Button onClick={handleAddTask} disabled={!newTask.name}>
              {t('添加')}
            </Button>
          </DialogFooter>
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
          toast={toast}
          datasets={datasets}
          evalDataSource={datasets.evalDataSource}
          positionId={existingScenario?.careerPositionId || ''}
        />
      )}

      {/* Clone Dialog */}
      <Dialog open={isCloneOpen} onOpenChange={setIsCloneOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{t('克隆/引用任务')}</DialogTitle>
            <DialogDescription>{t('从合作学校的其他场景选择任务进行克隆或引用')}</DialogDescription>
          </DialogHeader>
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
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  value={cloneSearch}
                  onChange={(e) => setCloneSearch(e.target.value)}
                  placeholder={t('搜索任务名称、编码...')}
                  className="pl-9"
                />
              </div>
            </div>
            <Tabs value={cloneTab} onValueChange={(v) => setCloneTab(v as 'my' | 'collab' | 'public')}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="my">{t('我的')}</TabsTrigger>
                <TabsTrigger value="collab">{t('共建')}</TabsTrigger>
                <TabsTrigger value="public">{t('公共库')}</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="flex-1 overflow-y-auto border rounded-lg">
              <div className="overflow-x-auto">
                <div className="grid grid-cols-[48px_1fr_120px_140px_120px] gap-3 px-4 py-2 bg-gray-50 text-xs font-medium text-gray-500 border-b sticky top-0 min-w-[540px]">
                  <div></div>
                  <div>{t('任务名称')}</div>
                  <div>{t('任务编码')}</div>
                  <div>{t('关联场景')}</div>
                  <div>{t('关联岗位')}</div>
                </div>
                {allTasks
                  .filter((t) => {
                    if (cloneTab === 'public') return t.scenarioStatus === 'published'
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
                        <div className="text-gray-500 text-xs">{positionName || '-'}</div>
                      </div>
                    )
                  })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCloneOpen(false)}>
              {t('取消')}
            </Button>
            <Button onClick={handleClone} disabled={selectedClone.length === 0 || isCloning}>
              {isCloning ? t('处理中...') : cloneMode === 'clone' ? t('克隆') : t('引用')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Weight Config Dialog */}
      <WeightConfigDialog
        open={isWeightConfigOpen}
        onOpenChange={(v) => {
          if (!v) persistWeights(tasks, taskStates)
          setIsWeightConfigOpen(v)
        }}
        tasks={tasks}
        taskStates={taskStates}
        updateAnyState={(id, u) => updateState(id, u)}
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
// （partner 版：taskEvaluationApi → partnerCobuildTaskApi）
async function saveMethodsWithRetry(tid: string, version: number, methods: any[]): Promise<number> {
  if (methods.length === 0) return version
  const doSave = async (v: number) => {
    const savedRes = await partnerCobuildTaskApi.saveEvaluationMethods(tid, {
      version: v,
      methods,
    })
    return (savedRes.methods || []).reduce((max, m) => Math.max(max, m.version || 0), 0)
  }
  try {
    return await doSave(version)
  } catch (err: any) {
    if (err.message === '评价规则已被其他会话修改') {
      const freshRes = await partnerCobuildTaskApi.listEvaluationMethods(tid).catch(() => null)
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
  toast,
  datasets,
  evalDataSource,
  positionId,
}: {
  taskId: string
  cardType: CardType
  task: Task
  state: TaskState
  updateState: (u: Partial<TaskState>) => void
  updateTask: (u: Partial<Task>) => void
  onClose: () => void
  toast: (opts: {
    title?: string
    description?: string
    variant?: 'default' | 'destructive'
  }) => void
  datasets: ReturnType<typeof useCoBuildDatasets>
  evalDataSource: ReturnType<typeof useCoBuildDatasets>['evalDataSource']
  positionId: string
}) {
  const t = useT()
  const config = partnerCardConfigs.find((c) => c.type === cardType)!
  const [abilitySearch, setAbilitySearch] = useState('')
  const [localTask, setLocalTask] = useState({
    name: task.name,
    type: task.taskType,
    difficulty: task.difficulty,
    hours: task.estimatedHours,
    background: task.background,
  })

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
            knowledgePoints={datasets.knowledgePoints as unknown as KnowledgePointItem[]}
            abilityPoints={datasets.abilityPoints as { id: string; name: string; description?: string }[]}
            onPersistStandard={handlePersistStandard}
            dataSource={evalDataSource}
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
            dataSource={datasets.knowledgeDataSource}
            onChange={(items) => {
              const ids = items.map((i) => i.id)
              datasets.setKnowledgePoints((prev) => {
                const next = [...prev]
                for (const item of items) {
                  const idx = next.findIndex((k) => k.id === item.id)
                  if (idx >= 0) {
                    next[idx] = {
                      ...next[idx],
                      name: item.name,
                      description: item.description || '',
                      code: item.code || '',
                      granularLessons: item.granularLessons || next[idx].granularLessons || [],
                    }
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
        if (!positionId) {
          return (
            <div className="h-full flex flex-col items-center justify-center text-center text-gray-400 py-16">
              <Award className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm font-medium text-gray-600">
                {t('请先在场景基础信息中关联岗位，再选择考察能力点')}
              </p>
            </div>
          )
        }
        const bindings = (datasets.positionAbilityBindings as any[]).filter(
          (b: any) => b.careerPositionId === positionId,
        )
        const abilityById = new Map(datasets.abilityPoints.map((ab: any) => [ab.id, ab]))
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
        return (
          <div className="h-full flex flex-col">
            <div className="flex items-center gap-4 mb-4 shrink-0">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  value={abilitySearch}
                  onChange={(e) => setAbilitySearch(e.target.value)}
                  placeholder={t('搜索能力点名称、编码或描述...')}
                  className="pl-9"
                />
              </div>
              <div className="text-sm text-gray-500 shrink-0">
                {t('共 {n} 个关联能力点，已选 {m} 个', {
                  n: relatedAbilities.length,
                  m: state.abilityPoints.length,
                })}
              </div>
            </div>
            <div className="flex-1 min-h-0 border rounded-xl overflow-hidden">
              <div className="h-full overflow-y-auto p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 content-start">
                {relatedAbilities.length === 0 && (
                  <div className="col-span-full text-center text-gray-400 py-16">
                    <Award className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">{t('目标岗位暂无关联能力点')}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {t('请先在学校端为岗位配置能力建模')}
                    </p>
                  </div>
                )}
                {relatedAbilities
                  .filter(
                    (ab: any) =>
                      !abilitySearch ||
                      (ab.name || '').includes(abilitySearch) ||
                      (ab.description || '').includes(abilitySearch) ||
                      (ab.code || '').includes(abilitySearch),
                  )
                  .map((ab: any) => {
                    const selected = state.abilityPoints.includes(ab.id)
                    return (
                      <div
                        key={ab.id}
                        onClick={() => {
                          const cur = state.abilityPoints
                          updateState({
                            abilityPoints: selected
                              ? cur.filter((id) => id !== ab.id)
                              : [...cur, ab.id],
                          })
                        }}
                        className={cn(
                          'border rounded-xl p-3.5 cursor-pointer transition-colors',
                          selected
                            ? 'bg-primary/[0.03] border-primary/40'
                            : 'hover:bg-gray-50 border-gray-200',
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className={cn(
                              'w-4 h-4 rounded border flex items-center justify-center shrink-0',
                              selected
                                ? 'bg-primary border-primary'
                                : 'border-gray-300',
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
                        </div>
                        <p className="text-xs text-gray-500 line-clamp-2 mt-1.5 ml-6">
                          {ab.description}
                        </p>
                      </div>
                    )
                  })}
              </div>
            </div>
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
          />
        )
      }

      case 'weight':
        return <TaskWeightCard />

      default:
        return null
    }
  }

  const dialogSizeClass =
    cardType === 'evaluationRules' ||
    cardType === 'weight' ||
    cardType === 'knowledge' ||
    cardType === 'ability' ||
    cardType === 'resources'
      ? 'sm:max-w-[95vw] max-h-[95vh] h-[95vh]'
      : cardType === 'evaluation'
        ? 'sm:max-w-[720px] max-h-[85vh]'
        : cardType === 'description'
          ? 'sm:max-w-[900px] max-h-[90vh]'
          : 'sm:max-w-[650px] max-h-[85vh]'

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
        <div className={cn('flex-1 py-4 overflow-y-auto')}>{renderContent()}</div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('取消')}
          </Button>
          <Button onClick={handleSave} disabled={isSavingCard}>
            {isSavingCard ? t('保存中...') : t('保存')}
          </Button>
        </DialogFooter>
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

          <div className="h-3 bg-gray-100 rounded-full overflow-hidden flex">
            {tasks.map((t, i) => (
              <div
                key={t.id}
                className={cn('transition-all duration-300', colors[i % colors.length])}
                style={{ width: `${taskStates[t.id]?.weight || 0}%` }}
              />
            ))}
          </div>

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
