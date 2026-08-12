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
} from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import { useState, useRef, useCallback, useEffect } from 'react'
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
import { cn } from '@/lib/utils'
import {
  partnerCobuildScenarioApi,
  partnerCobuildPositionApi,
  partnerCobuildTaskApi,
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


// 企业端只开放四种卡片（knowledge/ability/resources/weight 为 portal 专属，已裁剪）
const PARTNER_CARD_TYPES: CardType[] = ['info', 'description', 'evaluation', 'evaluationRules']
const partnerCardConfigs = cardConfigs.filter((c) => PARTNER_CARD_TYPES.includes(c.type))

// get 端点当前只返回场景主表字段（tenantId 为学校租户）
type CoBuildScenarioDetail = CoBuildScenario & { tenantId?: string }

// evaluation 卡片所需数据集：学校能力点（只读）+ 学校量规模板（注入 EvaluationRulesEditor）
function useCoBuildDatasets(schoolTenantId: string) {
  const [abilityPoints, setAbilityPoints] = useState<
    { id: string; name: string; description?: string }[]
  >([])

  useEffect(() => {
    if (!schoolTenantId) return
    let cancelled = false
    partnerCobuildSchoolApi
      .abilities(schoolTenantId)
      .then((res) => {
        if (!cancelled) setAbilityPoints(res.items || [])
      })
      .catch((err) => reportError(err, '加载学校能力点'))
    return () => {
      cancelled = true
    }
  }, [schoolTenantId])

  // 量规模板：partner token 调不通 portal 模板接口，改走学校只读列表；映射为编辑器内部 RubricScheme 结构
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

  return { abilityPoints, loadRubricTemplates }
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
  const datasets = useCoBuildDatasets(schoolTenantId)

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
          // 知识/能力/资源卡片已裁剪，但已绑定的 id 保留在 state 中随保存原样回传，避免数据丢失
          if (t.knowledgePoints) ts.knowledgePoints = t.knowledgePoints
          if (t.abilityPoints) ts.abilityPoints = t.abilityPoints
          if (t.resources) ts.resources = t.resources
          if (t.detailedDescription) ts.description = t.detailedDescription
          if (t.descriptionPdf) ts.descriptionPdf = t.descriptionPdf
          ts.weight = count > 0 ? Math.floor(100 / count) + (i < 100 % count ? 1 : 0) : 0
          ts.gradeMapping = JSON.parse(JSON.stringify(defaultGradeMapping))
          states[t.id] = ts
        })
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
      default:
        return ''
    }
  }

  const isConfigured = (taskId: string, type: CardType): boolean => {
    const state = getState(taskId)
    switch (type) {
      case 'info':
        return true
      case 'description':
        return !!state.description || !!state.descriptionPdf
      case 'evaluation':
        return state.evaluationMethods.length > 0
      case 'evaluationRules':
        return state.evaluationMethods.length > 0
      default:
        return false
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
          abilityPoints={datasets.abilityPoints}
          loadRubricTemplates={datasets.loadRubricTemplates}
        />
      )}

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
  abilityPoints,
  loadRubricTemplates,
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
  abilityPoints: { id: string; name: string; description?: string }[]
  loadRubricTemplates: () => Promise<RubricScheme[]>
}) {
  const t = useT()
  const config = partnerCardConfigs.find((c) => c.type === cardType)!
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
            knowledgePoints={[]}
            abilityPoints={abilityPoints}
            onPersistStandard={handlePersistStandard}
            dataSource={{ loadRubricTemplates, skipPortalPreload: true }}
          />
        )
      default:
        return null
    }
  }

  const dialogSizeClass =
    cardType === 'evaluationRules'
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
