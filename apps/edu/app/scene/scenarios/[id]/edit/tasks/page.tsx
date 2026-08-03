'use client'

import {
  ArrowRight,
  CheckCircle2,
  Copy,
  FileText,
  GripVertical,
  Plus,
  Scale,
  Search,
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
  examApi,
  examUsageApi,
} from '@/lib/api'
import type { ScenarioTask as ApiScenarioTask } from '@/lib/types/scene'
import { EvaluationRulesEditor } from '@/components/evaluation-rules'
import { useToast } from '@zhiyu/ui'
import { EditorShell } from '@/components/shared/editor-shell'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { EvalMethodSelector } from '@/components/shared/eval-method-selector'
import { KnowledgeSelector } from '@/components/shared/knowledge-selector'
import type { KnowledgePointItem } from '@/lib/types/lesson'
import { ResourceSelector, type ResourceItem } from '@/components/shared/resource-selector'
import {
  useTaskDatasets,
  type TaskResourceItem,
  type UseTaskDatasetsResult,
} from './_components/hooks/use-task-datasets'
import { TaskInfoCard } from './_components/task-info-card'
import { TaskDescriptionCard } from './_components/task-description-card'
import { TaskWeightCard } from './_components/task-weight-card'
import { clearAllCaches } from './_components/shared-defs'
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
import type { Task } from '@/lib/types/scene-mock'
import { COMPETENCY_LEVEL_LABELS } from '@/lib/types/job-source'

// ============ Main Page ============

export default function TasksEditPage() {
  const params = useParams()
  const router = useRouter()
  const scenarioId = params.id as string
  const { toast } = useToast()
  const { user } = useAuth()

  const datasets = useTaskDatasets()

  const [existingScenario, setExistingScenario] = useState<any>(null)
  const [, setDataLoaded] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const [tasks, setTasks] = useState<Task[]>([])
  const [taskStates, setTaskStates] = useState<Record<string, TaskState>>({})
  const [, setPositions] = useState<any[]>([])
  const [, setIndustries] = useState<any[]>([])
  const [, setMajors] = useState<any[]>([])
  const [professions, setProfessions] = useState<any[]>([])

  const scenarioDataRef = useRef<any>(null)
  const taskStatesRef = useRef(taskStates)
  useEffect(() => {
    taskStatesRef.current = taskStates
  }, [taskStates])

  const { loadDatasets } = datasets
  const ensureDatasets = useCallback(
    async (keys: string[]) => {
      await loadDatasets(keys, {
        taskStatesRef,
        setExistingScenario,
        scenarioDataRef,
      })
    },
    [loadDatasets],
  )

  // 离开编辑页时清理模块级缓存，避免跨场景污染
  useEffect(() => {
    return () => {
      clearAllCaches()
    }
  }, [])

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

        setPositions(posRes.items)
        setIndustries(indRes.items)
        setMajors(majRes.items)

        const positionName =
          posRes.items.find((p: any) => p.id === scenarioData.careerPositionId)?.name ||
          scenarioData.careerPositionId
        const industryName =
          (scenarioData.industryNames || []).join('、') ||
          (scenarioData.industryIds || [])
            .map((id: string) => indRes.items.find((i: any) => i.id === id)?.name)
            .filter(Boolean)
            .join('、') ||
          (scenarioData.industryIds || []).join('、')
        const professionName =
          (scenarioData.professionNames || []).join('、') ||
          (scenarioData.professionIds || [])
            .map((id: string) => majRes.items.find((m: any) => m.id === id)?.name)
            .filter(Boolean)
            .join('、') ||
          (scenarioData.professionIds || []).join('、')
        setExistingScenario((prev: any) => {
          // 保留已解析的共建人姓名（避免 user?.id 变化导致 effect 重跑时覆盖掉已补齐的名称）
          const prevNameMap: Record<string, string> = {}
          if (prev?.coBuilders) {
            prev.coBuilders.forEach((cb: any) => {
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

        const nextProfessions: any[] = []
        posRes.items.forEach((p: any) => {
          const prof = nextProfessions.find((pr: any) => pr.name === (p.industryName || '其他'))
          if (prof) {
            prof.positions.push({ id: p.id, name: p.name, professionId: prof.id })
          } else {
            nextProfessions.push({
              id: `prof-${nextProfessions.length + 1}`,
              name: p.industryName || '其他',
              positions: [
                { id: p.id, name: p.name, professionId: `prof-${nextProfessions.length + 1}` },
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
          abilityPoints: at.abilityPointIds || [],
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
        setTaskStates(states)

        // Preload datasets so card previews show names immediately
        await ensureDatasets(['knowledge', 'ability', 'resources', 'evaluation', 'users'])

        setDataLoaded(true)
      } catch (err: any) {
        setLoadFailed(true)
        toast({
          variant: 'destructive',
          title: '任务数据加载失败',
          description: err?.message || '请刷新页面重试',
        })
      }
    }
    load()
  }, [scenarioId, user?.id, ensureDatasets, toast])

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
    return (datasets.scenarios as any[]).flatMap((s: any) =>
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
        return `任务名称：${task.name}\n编码：${task.code || '-'}\n任务类型：${task.taskType === 'assessment' ? '考核' : '训练'}\n难度：${task.difficulty}星\n预估学时：${task.estimatedHours}小时`
      case 'description': {
        if (state.description) return `${state.description.replace(/<[^>]*>/g, '').slice(0, 50)}...`
        if (state.descriptionPdf) return '已上传附件'
        return '未填写'
      }
      case 'knowledge':
        if (state.knowledgePoints.length === 0) return '未配置'
        const kpNames = state.knowledgePoints
          .map((id) => datasets.knowledgePoints.find((k) => k.id === id)?.name)
          .filter(Boolean)
        return (
          kpNames.slice(0, 3).join('、') +
          (kpNames.length > 3 ? ` 等${state.knowledgePoints.length}个` : '')
        )
      case 'ability':
        if (state.abilityPoints.length === 0) return '未配置'
        const abNames = state.abilityPoints
          .map(
            (id) =>
              (
                datasets.abilityPoints.find((a) => (a as { id: string }).id === id) as
                  { name?: string } | undefined
              )?.name,
          )
          .filter(Boolean)
        return (
          abNames.slice(0, 3).join('、') +
          (abNames.length > 3 ? ` 等${state.abilityPoints.length}个` : '')
        )
      case 'resources':
        if (state.resources.length === 0) return '未配置'
        const resNames = state.resources
          .map((id) => datasets.learningResources.find((r) => r.id === id)?.name)
          .filter(Boolean)
        return (
          resNames.slice(0, 3).join('、') +
          (resNames.length > 3 ? ` 等${state.resources.length}个` : '')
        )
      case 'evaluation':
        if (state.evaluationMethods.length === 0) return '未配置'
        return state.evaluationMethods
          .map((m) => evaluationMethodOptions.find((o) => o.key === m)?.label)
          .filter(Boolean)
          .join('、')
      case 'evaluationRules':
        if (state.evaluationMethods.length === 0) return '未配置评价方式'
        const configuredMethods = state.evaluationMethods.filter((m) => {
          if (m === 'random_draw')
            return state.randomDrawSelectedIds.length > 0 || state.randomDrawEvalPoints.length > 0
          if (m === 'review') return state.reviewEvalPoints.length > 0
          if (m === 'paper') return state.paperIds.length > 0
          if (m === 'question_bank') return state.questionBankQuestions.length > 0
          if (m === 'outcome') return state.outcomeEvalPoints.length > 0
          if (m === 'homework') return state.homeworkEvalPoints.length > 0
          if (m === 'quiz') return state.quizQuestions.length > 0
          return false
        })
        const methodWeightTotal2 = state.evaluationMethods.reduce(
          (sum, m) => sum + (state.methodWeights[m] || 0),
          0,
        )
        if (configuredMethods.length === 0) return '待配置'
        const weightSummary = state.evaluationMethods
          .map((m) => {
            const label = evaluationMethodOptions.find((o) => o.key === m)?.label || m
            return `${label}${state.methodWeights[m] || 0}%`
          })
          .join('、')
        return `${weightSummary}\n权重合计 ${methodWeightTotal2}%${methodWeightTotal2 !== 100 ? ' (需等于100%)' : ''}`
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
      const payload: any = {
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
      const count = newTasks.length
      const weight = Math.floor(100 / count)
      const newStates = { ...taskStates }
      Object.keys(newStates).forEach((id) => {
        newStates[id] = { ...newStates[id], weight }
      })
      newStates[created.id] = makeDefaultTaskState(count, count - 1)
      newStates[created.id].weight = 100 - weight * (count - 1)
      setTaskStates(newStates)
      setIsAddTaskOpen(false)
      setNewTask({ name: '', hours: 4, type: 'training', difficulty: 3, background: '' })
      toast({ title: '已添加任务' })
    } catch (err: any) {
      toast({ variant: 'destructive', title: '添加失败', description: err.message })
    }
  }

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
        selected.map((t) => taskEvaluationApi.listMethods(t.id).catch(() => ({ methods: [] }))),
      )

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
          count > 0 ? Math.floor(100 / count) + (tasks.length + i < 100 % count ? 1 : 0) : 0
        newStates[newTasks[i].id] = ts
      })

      setTasks([...tasks, ...newTasks])
      setTaskStates((prev) => ({ ...prev, ...newStates }))
      setIsCloneOpen(false)
      setSelectedClone([])
    } catch (err: any) {
      toast({ variant: 'destructive', title: '克隆失败', description: err.message })
    } finally {
      setIsCloning(false)
    }
  }

  const handleDeleteTask = async (id: string) => {
    try {
      await taskApi.delete(id)
      setTasks(tasks.filter((t) => t.id !== id))
      const newStates = { ...taskStates }
      delete newStates[id]
      setTaskStates(newStates)
      setDeleteConfirmTask(null)
      toast({ title: '已删除任务' })
    } catch (err: any) {
      toast({ variant: 'destructive', title: '删除失败', description: err.message })
    }
  }

  const saveTasksToBackend = async () => {
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
          } as any)
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
          const nameCollision = nextKnowledgePoints.find(
            (k) => k.id !== kpId && k.name === kp.name,
          )
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
              } as any)
              targetId = created.id
            } catch (err: any) {
              // 兜底：并发等场景下仍可能撞名，按后端提示合并到已有知识点
              const existing = nextKnowledgePoints.find(
                (k) => k.id !== kpId && k.name === kp.name,
              )
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
        title: '部分自定义知识点保存失败',
        description: `${failedCreateIds.length} 个知识点未能创建，将从任务中移除`,
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
        (a) => (a as { id: string }).id !== abId && (a as { name: string }).name === (ap as { name: string }).name,
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
          const existing = nextAbilityPoints.find(
            (a) => (a as { id: string }).id !== abId && (a as { name: string }).name === (ap as { name: string }).name,
          )
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
        title: '部分自定义能力点保存失败',
        description: `${failedAbilityIds.length} 个能力点未能创建，将从任务中移除`,
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
        resourceIdMapping[resId] = created.id
        const idx = nextLearningResources.findIndex((r) => r.id === resId)
        if (idx >= 0) nextLearningResources[idx] = { ...nextLearningResources[idx], id: created.id }
        nextCustomResourceIds.delete(resId)
      } catch (err: any) {
        failedResourceIds.push(resId)
      }
    }
    datasets.setLearningResources(nextLearningResources)
    datasets.setCustomResourceIds(nextCustomResourceIds)
    if (failedResourceIds.length > 0) {
      toast({
        variant: 'destructive',
        title: '部分自定义资源保存失败',
        description: `${failedResourceIds.length} 个资源未能创建，将从任务中移除`,
      })
    }

    // Replace temporary custom IDs with persisted IDs across all task states
    const replaceIds = (ids: string[]) =>
      ids
        .map((id) => kpIdMapping[id] || abIdMapping[id] || resourceIdMapping[id] || id)
        .filter((id) => !id.startsWith('kp-custom-') && !id.startsWith('ab-custom-'))
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
      const payload: any = {
        scenarioId,
        name: t.name,
        code: t.code,
        sortOrder: i,
        description: t.description,
        detailedDescription: ts.description || t.detailedDescription,
        descriptionPdf: ts.descriptionPdf || t.descriptionPdf || null,
        estimatedHours: t.estimatedHours,
        taskType: t.taskType,
        difficulty: t.difficulty,
        background: t.background,
        dependencyIds: t.dependencies || [],
        isReferenced: !!t.isReferenced,
        sourceScenarioId: t.sourceScenarioId || null,
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
        const savedRes = await taskEvaluationApi.saveMethods(newTask.id, {
          version: ts.evalMethodVersion,
          methods: taskStateToMethodsInput(ts),
        })
        const newVersion = (savedRes.methods || []).reduce(
          (max, m) => Math.max(max, m.version || 0),
          0,
        )
        updatedTaskStates[newTask.id] = {
          ...updatedTaskStates[newTask.id],
          evalMethodVersion: newVersion,
        }
      } else {
        await taskApi.update(t.id, payload)
        newTasks.push(t)
        const methodsInput = taskStateToMethodsInput(ts)
        const savedRes = await taskEvaluationApi.saveMethods(t.id, {
          version: ts.evalMethodVersion,
          methods: methodsInput,
        })
        const newVersion = (savedRes.methods || []).reduce(
          (max, m) => Math.max(max, m.version || 0),
          0,
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
      if (existingScenario?.status !== 'draft') {
        await scenarioApi.saveDraft(scenarioId)
        setExistingScenario((prev: any) => (prev ? { ...prev, status: 'draft' } : prev))
        toast({ title: '草稿已保存', description: '场景已退回草稿状态' })
      } else {
        toast({ title: '草稿已保存' })
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: '保存失败', description: err.message })
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
        setExistingScenario((prev: any) => (prev ? { ...prev, status: 'draft' } : prev))
        toast({ title: '配置已保存', description: '场景已退回草稿状态' })
      } else {
        toast({ title: '配置已保存' })
      }
      router.push('/scene')
    } catch (err: any) {
      toast({ variant: 'destructive', title: '保存失败', description: err.message })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <EditorShell
      mode="fullscreen"
      backText="取消"
      onBack={() => router.push('/scene')}
      step={2}
      stepLabel="任务链配置"
      onSaveDraft={handleSaveDraft}
      isSaving={isSaving}
      onPrev={() => router.push(`/scene/scenarios/${scenarioId}/edit`)}
      onSubmit={handleFinish}
      submitText="完成配置"
      contentMaxWidth="max-w-[1400px]"
    >
      {loadFailed && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3">
          <span className="text-sm text-destructive">任务数据加载失败，请重试</span>
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
            刷新重试
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
                  {existingScenario?.name || '新建场景'}
                </CardTitle>
                {existingScenario && existingScenario.coBuilders.length > 0 && (
                  <Badge variant="secondary" className="text-[10px]">
                    共建
                  </Badge>
                )}
              </div>
              <CardDescription className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="truncate">
                  {existingScenario?.positionName || existingScenario?.positionId || '未选择岗位'}
                  {' | '}
                  {existingScenario?.industryName || existingScenario?.industryId || '未选择行业'}
                  {' | '}
                  {existingScenario?.professionName ||
                    existingScenario?.professionId ||
                    '未选择专业'}
                </span>
                {existingScenario && existingScenario.coBuilders.length > 0 && (
                  <span className="flex flex-wrap items-center gap-1">
                    <span className="text-gray-400">|</span>
                    <span>共建人：</span>
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
          <p className="text-sm text-gray-600 pt-3">{existingScenario?.background || '暂无介绍'}</p>
        </CardContent>
      </Card>

      {/* Tasks Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mt-6">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-semibold text-lg">任务列表</h2>
          <Badge variant="secondary">{tasks.length} 个任务</Badge>
          <div
            className={cn(
              'flex items-center gap-1 text-sm px-2 py-1 rounded',
              totalWeight === 100 ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600',
            )}
          >
            <Scale className="h-3.5 w-3.5" />
            权重: {totalWeight}%
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => setIsAddTaskOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            添加任务
          </Button>
          <Button variant="outline" size="sm" onClick={() => setIsCloneOpen(true)}>
            <Copy className="mr-2 h-4 w-4" />
            克隆/引用
          </Button>
          <Button variant="outline" size="sm" onClick={() => setIsWeightConfigOpen(true)}>
            <PieChartIcon className="mr-2 h-4 w-4" />
            配置任务权重
          </Button>
        </div>
      </div>

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
              {c.title}
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
                        <span className="text-xs font-medium truncate flex-1">{config.title}</span>
                        {isRef && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0">
                            引用
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
              <p className="text-gray-500 mb-4">暂无任务，点击添加第一个任务</p>
              <Button onClick={() => setIsAddTaskOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                添加任务
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Add Task Dialog */}
      <Dialog open={isAddTaskOpen} onOpenChange={setIsAddTaskOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>添加任务</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>任务名称</Label>
              <Input
                value={newTask.name}
                onChange={(e) => setNewTask({ ...newTask, name: e.target.value })}
                placeholder="输入任务名称"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>任务类型</Label>
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
                  <SelectItem value="training">训练任务</SelectItem>
                  <SelectItem value="assessment">考核任务</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Label>预估学时</Label>
                <span className="text-xs text-gray-400">学生完成任务的预估时长</span>
              </div>
              <Input
                type="number"
                value={newTask.hours}
                onChange={(e) => setNewTask({ ...newTask, hours: +e.target.value })}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>难度</Label>
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
              <Label>背景介绍</Label>
              <Textarea
                value={newTask.background}
                onChange={(e) => setNewTask({ ...newTask, background: e.target.value })}
                placeholder="简述任务背景"
                className="mt-1.5"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddTaskOpen(false)}>
              取消
            </Button>
            <Button onClick={handleAddTask} disabled={!newTask.name}>
              添加
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clone Dialog */}
      <Dialog open={isCloneOpen} onOpenChange={setIsCloneOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>克隆/引用任务</DialogTitle>
            <DialogDescription>从其他场景选择任务进行克隆或引用</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 flex-1 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <Button
                  variant={cloneMode === 'clone' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCloneMode('clone')}
                >
                  克隆（可编辑）
                </Button>
                <Button
                  variant={cloneMode === 'reference' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCloneMode('reference')}
                >
                  引用（只读）
                </Button>
              </div>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  value={cloneSearch}
                  onChange={(e) => setCloneSearch(e.target.value)}
                  placeholder="搜索任务名称、编码..."
                  className="pl-9"
                />
              </div>
            </div>
            <Tabs
              value={cloneTab}
              onValueChange={(v) => setCloneTab(v as 'my' | 'collab' | 'public')}
            >
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="my">我的</TabsTrigger>
                <TabsTrigger value="collab">共建</TabsTrigger>
                <TabsTrigger value="public">公共库</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="flex-1 overflow-y-auto border rounded-lg">
              <div className="overflow-x-auto">
                {/* Table Header */}
                <div className="grid grid-cols-[48px_1fr_120px_140px_120px] gap-3 px-4 py-2 bg-gray-50 text-xs font-medium text-gray-500 border-b sticky top-0 min-w-[540px]">
                  <div></div>
                  <div>任务名称</div>
                  <div>任务编码</div>
                  <div>关联场景</div>
                  <div>关联岗位</div>
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCloneOpen(false)}>
              取消
            </Button>
            <Button onClick={handleClone} disabled={selectedClone.length === 0 || isCloning}>
              {isCloning ? '克隆中...' : `确定 (${selectedClone.length})`}
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
          positionId={existingScenario?.positionId}
          toast={toast}
          positionAbilityBindings={datasets.positionAbilityBindings}
          datasets={datasets}
          professions={professions}
        />
      )}

      {/* Weight Config Dialog */}
      <WeightConfigDialog
        open={isWeightConfigOpen}
        onOpenChange={setIsWeightConfigOpen}
        tasks={tasks}
        taskStates={taskStates}
        updateAnyState={(id, updates) => updateState(id, updates)}
      />

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        open={!!deleteConfirmTask}
        onOpenChange={(open) => !open && setDeleteConfirmTask(null)}
        title="确认删除"
        description={`确定要删除任务「${deleteConfirmTask?.name}」吗？删除后不可恢复。`}
        variant="destructive"
        confirmText="确认删除"
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
}) {
  const config = cardConfigs.find((c) => c.type === cardType)!
  const [localTask, setLocalTask] = useState({
    name: task.name,
    type: task.taskType,
    difficulty: task.difficulty,
    hours: task.estimatedHours,
    background: task.background,
  })

  const [abilitySearch, setAbilitySearch] = useState('')
  const [abilityDetailOpen, setAbilityDetailOpen] = useState(false)
  const [selectedAbilityForDetail] = useState<string | null>(null)
  const [expandedDomains, setExpandedDomains] = useState<Record<string, boolean>>({})

  // For random draw custom questions (现场问答题)

  // For resources search & upload

  // For question bank config

  // For assessment config

  const ensureTempExam = async (
    mk: 'question_bank' | 'quiz',
    currentCfg: any,
  ): Promise<string | null> => {
    const questionIds = mk === 'question_bank' ? state.questionBankQuestions : state.quizQuestions
    const existingExamId = currentCfg?.examId
    const questionScores = currentCfg?.questionScores || {}
    const existingQuestionIds = currentCfg?.examQuestionIds || []
    if (!questionIds || questionIds.length === 0) {
      if (existingExamId) {
        try {
          const usages = await examUsageApi.list({ examId: existingExamId })
          for (const u of usages.items || []) await examUsageApi.delete(u.id)
          await examApi.delete(existingExamId)
        } catch {
          /* ignore */
        }
      }
      return null
    }
    const sortedNew = [...questionIds].sort().join(',')
    const sortedOld = [...existingQuestionIds].sort().join(',')
    if (existingExamId && sortedNew === sortedOld) return existingExamId
    if (existingExamId) {
      try {
        const usages = await examUsageApi.list({ examId: existingExamId })
        for (const u of usages.items || []) await examUsageApi.delete(u.id)
        await examApi.delete(existingExamId)
      } catch {
        /* ignore */
      }
    }
    const label = mk === 'question_bank' ? '题库' : '随堂测'
    // 自动生成的临时试卷名称带随机后缀，避免与历史残留考试重名触发 409
    const examName = `${task.name}-${label}临时试卷-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
    const exam = await examApi.create({
      name: examName,
      duration: currentCfg?.timeLimit || 90,
      isTemp: true,
    } as any)
    for (const qid of questionIds) {
      await examApi.addQuestion(exam.id, qid, questionScores[qid] || 10)
    }
    await examUsageApi.create({
      examId: exam.id,
      name: `${exam.name} 默认安排`,
      targetType: 'public',
      targetIds: [taskId],
    } as any)
    return exam.id
  }

  const handleSave = async () => {
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
        if (mk === 'review') updatedRC[mk] = { ...DEFAULT_REVIEW_RESOURCE_CONFIG, ...updatedRC[mk] }
        if (mk === 'outcome')
          updatedRC[mk] = { ...DEFAULT_OUTCOME_RESOURCE_CONFIG, ...updatedRC[mk] }
        if (mk === 'homework')
          updatedRC[mk] = { ...DEFAULT_HOMEWORK_RESOURCE_CONFIG, ...updatedRC[mk] }
      })
      updateState({ methodResourceConfigs: updatedRC, reviewSteps: enabledReviewSteps })
      // Persist evaluation methods (including resource config) to backend immediately
      let currentVersion = state.evalMethodVersion
      let methodsInput = taskStateToMethodsInput({ ...state, methodResourceConfigs: updatedRC })
      if (methodsInput.length > 0) {
        try {
          const savedRes = await taskEvaluationApi.saveMethods(taskId, {
            version: currentVersion,
            methods: methodsInput,
          })
          currentVersion = savedRes.methods.reduce((max, m) => Math.max(max, m.version || 0), 0)
          updateState({ evalMethodVersion: currentVersion })
        } catch (err: any) {
          toast({ variant: 'destructive', title: '评价规则保存失败', description: err.message })
          return
        }
      }
      // Generate temp exams for enabled question_bank / quiz and persist examId back
      const tempExamMethods = methodsInput.filter(
        (m) =>
          m.isEnabled && (m.methodKey === 'question_bank' || m.methodKey === 'quiz'),
      )
      if (tempExamMethods.length > 0) {
        for (const m of tempExamMethods) {
          try {
            const mk = m.methodKey as 'question_bank' | 'quiz'
            const examId = await ensureTempExam(mk, updatedRC[mk])
            if (examId) {
              updatedRC[mk] = {
                ...updatedRC[mk],
                examId,
                examQuestionIds:
                  mk === 'question_bank' ? state.questionBankQuestions : state.quizQuestions,
              }
            }
          } catch {
            /* temp exam creation failed, skip */
          }
        }
        updateState({ methodResourceConfigs: updatedRC })
        methodsInput = taskStateToMethodsInput({ ...state, methodResourceConfigs: updatedRC })
        try {
          const savedRes = await taskEvaluationApi.saveMethods(taskId, {
            version: currentVersion,
            methods: methodsInput,
          })
          currentVersion = savedRes.methods.reduce((max, m) => Math.max(max, m.version || 0), 0)
          updateState({ evalMethodVersion: currentVersion })
        } catch (err) {
          reportError(err, '评价规则二次保存失败')
        }
      }
      // Ensure exam usage exists for paper so students can access it from the landing page
      if (state.evaluationMethods.includes('paper') && state.paperIds.length > 0) {
        const paperId = state.paperIds[0]
        try {
          const usages = await examUsageApi.list({ examId: paperId })
          if ((usages.items || []).length === 0) {
            const paperCfg = updatedRC.paper || {}
            await examUsageApi.create({
              examId: paperId,
              name: `${task.name}-试卷默认安排`,
              targetType: 'public',
              targetIds: [taskId],
              duration: paperCfg.duration || 90,
            } as any)
          }
        } catch {
          /* ignore */
        }
      }
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

      case 'knowledge': {
        const pool: KnowledgePointItem[] = datasets.knowledgePoints.map((kp) => ({
          id: kp.id,
          name: kp.name,
          code: kp.code,
          description: kp.description,
          linked: !datasets.customKnowledgePointIds.has(kp.id),
          granularLessons: kp.granularLessons || [],
        }))
        const selected: KnowledgePointItem[] = (state.knowledgePoints || []).map((id: string) => {
          const found = pool.find((p) => p.id === id)
          return found || { id, name: id, linked: false }
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
            <div className="h-full flex flex-col items-center justify-center text-center text-gray-400 py-16">
              <AlertCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm font-medium text-gray-600">请先关联岗位后，再选择考察能力点</p>
            </div>
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
        const bindingMap = new Map(bindings.map((b: any) => [b.abilityPointId, b]))
        const relatedAbilities = datasets.abilityPoints
          .filter((ab: any) => bindingMap.has(ab.id))
          .map((ab: any) => {
            const binding = bindingMap.get(ab.id)
            return {
              ...ab,
              positionIds: [positionId],
              domain: binding?.domain || ab.domain || '其他',
              requiredLevel: binding?.requiredLevel || ab.requiredLevel,
              proficiencyDesc: binding?.rubricDescription || ab.proficiencyDesc,
            }
          })

        if (relatedAbilities.length === 0) {
          return (
            <div className="h-full flex flex-col items-center justify-center text-center text-gray-400 py-16">
              <Award className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm font-medium text-gray-600 mb-1">目标岗位暂无关联能力点</p>
              <p className="text-xs text-gray-400 mb-4">
                请先去岗位配置页关联能力点后，再回到本页面选择
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  positionId && window.open(`/job/positions/${positionId}/edit`, '_blank')
                }
              >
                去岗位配置页关联
                <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
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
            const domain = ab.domain || '其他'
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
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  value={abilitySearch}
                  onChange={(e) => setAbilitySearch(e.target.value)}
                  placeholder="搜索能力点名称、编码或描述..."
                  className="pl-9"
                />
              </div>
              <div className="text-sm text-gray-500 shrink-0">
                共 <span className="font-medium text-gray-800">{relatedAbilities.length}</span>{' '}
                个关联能力点，已选{' '}
                <span className="font-medium text-primary">{state.abilityPoints.length}</span> 个
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
                          {filtered.length} 个能力点
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
                                        胜任标准：{levelLabel}
                                      </Badge>
                                    )}
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
                                    {ab.proficiencyDesc || '岗位胜任标准描述'}
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
                  <div className="col-span-full text-center text-gray-400 py-16">
                    <Award className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">未找到匹配的能力点</p>
                  </div>
                )}
              </div>
            </div>

            {/* Ability Detail Dialog */}
            <Dialog open={abilityDetailOpen} onOpenChange={setAbilityDetailOpen}>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>能力点详情</DialogTitle>
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
                      <Label className="text-xs text-gray-500">能力点描述</Label>
                      <p className="text-sm text-gray-700 mt-1">{detailAb.description}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">所属能力领域</Label>
                      <p className="text-sm text-gray-700 mt-1">{detailAb.domain || '-'}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">关联岗位</Label>
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
                      <Label className="text-xs text-gray-500">胜任标准</Label>
                      <p className="text-sm text-gray-700 mt-1">
                        {detailAb.requiredLevel
                          ? COMPETENCY_LEVEL_LABELS[
                              detailAb.requiredLevel as keyof typeof COMPETENCY_LEVEL_LABELS
                            ] || detailAb.requiredLevel
                          : '-'}
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">岗位胜任标准描述</Label>
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
              const newDisabled = (state.disabledEvaluationMethods || []).filter((d: string) =>
                newMethods.includes(d),
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
            {config.title}
          </DialogTitle>
          <DialogDescription>任务：{task.name}</DialogDescription>
        </DialogHeader>
        <div className={cn('flex-1 py-4 overflow-y-auto')}>{renderContent()}</div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button onClick={handleSave}>保存</Button>
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
            配置任务权重
          </DialogTitle>
          <DialogDescription>调整所有任务的权重分配，总权重应为 100%</DialogDescription>
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
                总权重: {totalW}%
              </span>
              {totalW !== 100 && (
                <span className="text-sm text-amber-600">
                  {totalW > 100 ? `超出 ${totalW - 100}%` : `还需分配 ${100 - totalW}%`}
                </span>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={distributeGlobal}>
              <Scale className="mr-2 h-4 w-4" />
              一键平均分配
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
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
