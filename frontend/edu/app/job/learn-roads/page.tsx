'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  ArrowUp,
  ArrowDown,
  Save,
  ArrowLeft,
  Pencil,
  FolderOpen,
  ChevronRight,
  Flag,
  ShoppingCart,
  Smartphone,
  BarChart3,
  GitBranch,
  Users,
  Layers,
  ChevronLeft,
  GripVertical,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { positionApi, batchApi, learnRoadApi, scenarioApi, taskApi } from '@/lib/api'
import { fetchAllPages } from '@zhiyu/api-client'

import {
  convertCareerPositionToPosition,
  convertJobBatchToBatch,
} from '@/lib/converters/job-converters'
import { useToast, EmptyState, TableEmptyRow } from '@zhiyu/ui'
import type { Position, PositionStatus, Batch } from '@/lib/types/job-source'
import type { LearnRoad, LearnRoadStep } from '@/lib/types/job'
import type { Scenario, ScenarioTask } from '@/lib/types/scene'
import { buildPositionSceneStats } from '@/lib/position-scene-stats'
import { orderScenariosByLearnRoad } from '@/lib/learn-road-order'
import { TableRowActions } from '@/components/shared/table-row-actions'
import { SearchInput } from '@/components/shared/search-input'
import { reportError } from '@/lib/error-handling'
import { useT } from '@/lib/i18n/locale-provider'

interface Task {
  id: string
  name: string
  estimatedHours?: number
}

interface Scene {
  id: string
  name: string
  coverImage?: string
  hours: number
  tasks: Task[]
}

const NODE_ICONS = [Flag, ShoppingCart, Smartphone, BarChart3, GitBranch, Users, Layers]
const NODE_COLORS = [
  { bg: 'bg-blue-500' },
  { bg: 'bg-green-500' },
  { bg: 'bg-amber-400' },
  { bg: 'bg-pink-500' },
  { bg: 'bg-purple-500' },
  { bg: 'bg-indigo-500' },
  { bg: 'bg-rose-500' },
]

function tasksForScenario(scenarioId: string, allTasks: ScenarioTask[]): Task[] {
  return allTasks
    .filter((t) => t.scenarioId === scenarioId)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((t) => ({ id: t.id, name: t.name, estimatedHours: t.estimatedHours }))
}

function scenarioToScene(scenario: Scenario, allTasks: ScenarioTask[]): Scene {
  const tasks = tasksForScenario(scenario.id, allTasks)
  return {
    id: scenario.id,
    name: scenario.name,
    coverImage: scenario.coverImage,
    hours: tasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0),
    tasks,
  }
}

function scenesToSteps(scenes: Scene[]): LearnRoadStep[] {
  return scenes.map((scene) => ({
    name: scene.name,
    scenarioId: scene.id,
    tasks: scene.tasks,
  }))
}

interface EditViewProps {
  editingPosition: Position
  batches: Batch[]
  scenes: Scene[]
  setScenes: React.Dispatch<React.SetStateAction<Scene[]>>
  selectedSceneId: string | null
  setSelectedSceneId: React.Dispatch<React.SetStateAction<string | null>>
  positionScenarios: Scenario[]
  positionTasks: ScenarioTask[]
  editLoading: boolean
  saving: boolean
  saved: boolean
  onBack: () => void
  onSave: () => void
  setSaved: React.Dispatch<React.SetStateAction<boolean>>
  moveScene: (index: number, direction: -1 | 1) => void
}

function EditView({
  editingPosition,
  batches,
  scenes,
  setScenes,
  selectedSceneId,
  setSelectedSceneId,
  positionScenarios,
  positionTasks,
  editLoading,
  saving,
  saved,
  onBack,
  onSave,
  setSaved,
  moveScene,
}: EditViewProps) {
  const t = useT()
  const timelineRef = useRef<HTMLDivElement>(null)
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  const batch = batches.find((b) => b.id === editingPosition.batchId)

  const scrollTimeline = (direction: -1 | 1) => {
    timelineRef.current?.scrollBy({ left: direction * 200, behavior: 'smooth' })
  }

  const handleDragStart = (index: number) => {
    setDraggingIndex(index)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    setDragOverIndex(index)
  }

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault()
    if (draggingIndex === null || draggingIndex === targetIndex) {
      setDraggingIndex(null)
      setDragOverIndex(null)
      return
    }
    const newScenes = [...scenes]
    const [moved] = newScenes.splice(draggingIndex, 1)
    newScenes.splice(targetIndex, 0, moved)
    setScenes(newScenes)
    setSaved(false)
    setDraggingIndex(null)
    setDragOverIndex(null)
  }

  const handleDragEnd = () => {
    setDraggingIndex(null)
    setDragOverIndex(null)
  }

  return (
    <div className="space-y-6 relative">
      {editLoading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/70 backdrop-blur-sm rounded-lg">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={onBack} disabled={editLoading}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            {t('返回岗位列表')}
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{editingPosition.name}</h1>
            <p className="text-muted-foreground mt-1">
              {batch ? batch.name : t('未关联批次')} · {editingPosition.shortName}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {t('已加载 {s} 个场景，{task} 个任务', { s: positionScenarios.length, task: positionTasks.length })}
              {scenes.length === 0 &&
                positionScenarios.length > 0 &&
                t(' · 点击下方“保存顺序”生成学习路径')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={onSave} disabled={editLoading || saving}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {saved ? t('已保存') : t('保存顺序')}
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        <div className="rounded-2xl bg-[#f8f5f0] p-6 sm:p-8 relative overflow-hidden">
          <h2 className="text-center text-xl sm:text-2xl font-bold text-slate-800">
            {t('{name}学习路径', { name: editingPosition.name })}
          </h2>
          <p className="text-center text-sm text-slate-500 mt-2">
            {t('点击上方阶段图标，查看该阶段的学习任务')}
          </p>
          <div className="relative mt-8">
            <button
              onClick={() => scrollTimeline(-1)}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-slate-500 shadow-sm hover:bg-white"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={() => scrollTimeline(1)}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-slate-500 shadow-sm hover:bg-white"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            <div ref={timelineRef} className="overflow-x-auto pb-4 px-8">
              <div className="relative flex items-start justify-between min-w-max">
                <div className="absolute top-14 left-0 right-0 h-1.5 rounded-full bg-gradient-to-r from-blue-400 via-green-400 via-amber-400 via-pink-400 via-purple-500 to-rose-500" />
                {scenes.map((scene, idx) => {
                  const Icon = NODE_ICONS[idx % NODE_ICONS.length]
                  const color = NODE_COLORS[idx % NODE_COLORS.length]
                  const isSelected = selectedSceneId === scene.id
                  return (
                    <button
                      key={scene.id}
                      onClick={() => setSelectedSceneId(scene.id)}
                      className="relative z-10 flex flex-col items-center min-w-[150px] mx-3 first:ml-4 last:mr-4"
                    >
                      <div className="h-5 text-xs text-slate-400">
                        {idx === 0 ? t('START · 第1站') : t('第{n}站', { n: idx + 1 })}
                      </div>
                      {scene.coverImage ? (
                        <div
                          className={cn(
                            'relative mt-2 flex h-14 w-14 items-center justify-center rounded-full overflow-hidden shadow-lg transition-transform bg-white',
                            isSelected && 'ring-4 ring-white scale-110',
                          )}
                        >
                          <img
                            src={scene.coverImage}
                            alt={scene.name}
                            className="absolute inset-0 h-full w-full object-cover"
                          />
                        </div>
                      ) : (
                        <div
                          className={cn(
                            'mt-2 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg transition-transform',
                            color.bg,
                            isSelected && 'ring-4 ring-white scale-110',
                          )}
                        >
                          <Icon className="h-6 w-6" />
                        </div>
                      )}
                      <div
                        className={cn(
                          'mt-3 text-sm font-bold text-center max-w-[140px]',
                          isSelected ? 'text-blue-600' : 'text-slate-800',
                        )}
                      >
                        {scene.name}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        {t('{n} 任务 · {h} 课时', { n: scene.tasks.length, h: scene.hours })}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
          {scenes.length === 0 && !editLoading && (
            <EmptyState
              icon={<Layers className="h-10 w-10 opacity-40" />}
              title={t('该岗位下暂无已发布场景，请先创建并发布场景')}
              titleClassName="text-slate-500"
              className="py-10"
            />
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('场景顺序')}</CardTitle>
            <CardDescription>{t('拖拽场景卡片可调整顺序，点击场景查看任务')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {scenes.map((scene, index) => {
              const isSelected = selectedSceneId === scene.id
              return (
                <div
                  key={scene.id}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDrop={(e) => handleDrop(e, index)}
                  onDragLeave={() => setDragOverIndex(null)}
                  onDragEnd={handleDragEnd}
                  onClick={() => setSelectedSceneId(scene.id)}
                  className={cn(
                    'group flex cursor-pointer items-center justify-between rounded-lg border p-4 transition-all',
                    isSelected
                      ? 'border-blue-500 bg-blue-50 shadow-sm'
                      : 'border-slate-200 bg-white hover:bg-slate-50',
                    draggingIndex === index && 'opacity-40',
                    dragOverIndex === index &&
                      dragOverIndex !== draggingIndex &&
                      'border-blue-400 bg-blue-50/60',
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="cursor-grab text-slate-400 hover:text-slate-600 active:cursor-grabbing"
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      <GripVertical className="h-5 w-5" />
                    </span>
                    {scene.coverImage ? (
                      <img
                        src={scene.coverImage}
                        alt={scene.name}
                        width={32}
                        height={32}
                        className="rounded-full object-cover border border-slate-200"
                      />
                    ) : (
                      <span
                        className={cn(
                          'flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors',
                          isSelected
                            ? 'bg-blue-500 text-white'
                            : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200',
                        )}
                      >
                        {index + 1}
                      </span>
                    )}
                    <div>
                      <div
                        className={cn(
                          'font-medium transition-colors',
                          isSelected ? 'text-blue-700' : 'text-slate-900',
                        )}
                      >
                        {scene.name}
                      </div>
                      <div className="text-xs text-slate-500">
                        {t('{n} 任务 · {h} 课时', { n: scene.tasks.length, h: scene.hours })}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {isSelected && (
                      <ChevronRight className="h-5 w-5 text-blue-500 animate-in fade-in duration-200" />
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={index === 0}
                      onClick={(e) => {
                        e.stopPropagation()
                        moveScene(index, -1)
                      }}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={index === scenes.length - 1}
                      onClick={(e) => {
                        e.stopPropagation()
                        moveScene(index, 1)
                      }}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )
            })}
            {scenes.length === 0 && !editLoading && (
              <EmptyState
                icon={<FolderOpen className="h-8 w-8 opacity-40" />}
                title={t('暂无可排序的场景')}
                titleClassName="text-slate-500"
                className="py-8"
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function LearnRoadsPage() {
  const t = useT()
  const { toast } = useToast()
  // 编辑加载请求序号：快速切换岗位时丢弃过期响应
  const editSeqRef = useRef(0)

  const [positions, setPositions] = useState<Position[]>([])
  const [batches, setBatches] = useState<Batch[]>([])
  const [dataLoading, setDataLoading] = useState(false)

  const [view, setView] = useState<'list' | 'edit'>('list')
  const [editingPosition, setEditingPosition] = useState<Position | null>(null)

  const [scenes, setScenes] = useState<Scene[]>([])
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [learnRoadId, setLearnRoadId] = useState<string | null>(null)
  // 缓存已拉取的学习路径列表，编辑时复用，避免重复全量请求
  const learnRoadsRef = useRef<LearnRoad[] | null>(null)
  // 保存成功提示 2s 自动消失的定时器句柄（卸载时清理）
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [positionScenarios, setPositionScenarios] = useState<Scenario[]>([])
  const [positionTasks, setPositionTasks] = useState<ScenarioTask[]>([])
  // 全量场景（挂载时一次拉取）：列表页「场景数/任务数」按 careerPositionId 实时分组统计，
  // 不再使用学习路径 steps 快照（steps 是保存时缓存，场景/任务增删后不更新，
  // 且无学习路径的岗位会错误显示 0/0）
  const [allScenarios, setAllScenarios] = useState<Scenario[]>([])

  const [listLoading, setListLoading] = useState(false)
  const [editLoading, setEditLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | PositionStatus>('all')

  const loadJobData = useCallback(async () => {
    setDataLoading(true)
    try {
      const [posRes, batchRes] = await Promise.all([
        fetchAllPages((page, pageSize) => positionApi.list({ limit: pageSize, offset: page * pageSize })),
        fetchAllPages((page, pageSize) => batchApi.list({ limit: pageSize, offset: page * pageSize })),
      ])
      setPositions(posRes.map(convertCareerPositionToPosition))
      setBatches(batchRes.map(convertJobBatchToBatch))
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: t('加载失败'),
        description: err?.message || t('请稍后重试'),
      })
    } finally {
      setDataLoading(false)
    }
  }, [toast, t])

  useEffect(() => {
    ;(async () => {
      await loadJobData()
    })()
  }, [loadJobData])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setListLoading(true)
      try {
        // 学习路径 + 全量场景并行加载：列表统计与编辑视图复用同一份数据，
        // 避免为统计逐岗位发请求（N+1）
        const [roadRes, scenarioRes] = await Promise.all([
          learnRoadApi.list({ limit: 1000 }),
          scenarioApi.list({ limit: 1000 }),
        ])
        learnRoadsRef.current = roadRes.items || []
        if (!cancelled) {
          setAllScenarios(scenarioRes.items || [])
        }
      } catch (err) {
        toast({
          title: t('加载失败'),
          description: err instanceof Error ? err.message : t('无法获取学习路径数据'),
          variant: 'destructive',
        })
      } finally {
        if (!cancelled) setListLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [toast, t])

  // 列表页「场景数/任务数」：按岗位实时统计（场景数 + 场景 taskCount 之和）
  const positionSceneStats = useMemo(
    () => buildPositionSceneStats(allScenarios),
    [allScenarios],
  )

  // 卸载时清理保存提示定时器，避免对已卸载组件 setState
  useEffect(
    () => () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
    },
    [],
  )

  const filteredPositions = useMemo(() => {
    let result = positions
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (p) => p.name.toLowerCase().includes(q) || p.shortName.toLowerCase().includes(q),
      )
    }
    if (filterStatus !== 'all') {
      result = result.filter((p) => p.status === filterStatus)
    }
    return result
  }, [positions, searchQuery, filterStatus])

  const loadPositionScenes = useCallback(
    async (positionId: string) => {
      try {
        const scenarioRes = await scenarioApi.list({
          careerPositionId: positionId,
          limit: 1000,
        })
        const scens = (scenarioRes.items || []).filter((s) => s.status && s.status !== 'archived')
        const taskResults = scens.length
          ? await Promise.all(scens.map((s) => taskApi.list({ scenarioId: s.id, limit: 1000 })))
          : []
        const allTasks = taskResults.flatMap((r) => r.items || [])
        return { scenarios: scens, tasks: allTasks }
      } catch (err) {
        reportError(err, '加载岗位学习路径场景')
        toast({
          title: t('加载场景失败'),
          description: err instanceof Error ? err.message : t('请稍后重试'),
          variant: 'destructive',
        })
        return { scenarios: [] as Scenario[], tasks: [] as ScenarioTask[] }
      }
    },
    [toast, t],
  )

  const handleEdit = useCallback(
    async (position: Position) => {
      const seq = ++editSeqRef.current
      setEditingPosition(position)
      setView('edit')
      setSaved(false)
      setEditLoading(true)

      try {
        // 复用挂载时已拉取的学习路径列表，避免每次进入编辑重复全量请求
        const roadsPromise = learnRoadsRef.current
          ? Promise.resolve({ items: learnRoadsRef.current })
          : learnRoadApi.list({ limit: 1000 }).then((res) => {
              learnRoadsRef.current = res.items || []
              return res
            })
        const [{ items: roads = [] }, { scenarios, tasks }] = await Promise.all([
          roadsPromise,
          loadPositionScenes(position.id),
        ])
        // 快速连续点击不同岗位时丢弃过期响应，防止先发后至覆盖当前岗位数据
        if (seq !== editSeqRef.current) return
        // 场景/任务计数在序号守卫后统一落状态，过期响应不再覆盖头部计数
        setPositionScenarios(scenarios)
        setPositionTasks(tasks)

        const existing = roads.find((r) => r.positionIds?.includes(position.id))
        let loadedScenes: Scene[] = []
        if (existing?.id) {
          setLearnRoadId(existing.id)
          // 编辑列表 = 岗位关联场景按学习路径步骤顺序（与 landing/learn 页同一套
          // orderScenariosByLearnRoad 排序规则，见 docs/spec/05-prototype-interaction.md §2.6）；
          // 任务实时加载自 scenario_tasks，不用 steps 里缓存的快照，避免统计/展示过期
          loadedScenes = orderScenariosByLearnRoad([existing], scenarios).map((s) =>
            scenarioToScene(s, tasks),
          )
        } else {
          // 无已有路径时不立即写库，进入本地编辑态，保存时才创建
          setLearnRoadId(null)
          loadedScenes = scenarios.length ? scenarios.map((s) => scenarioToScene(s, tasks)) : []
        }
        setScenes(loadedScenes)
        setSelectedSceneId(loadedScenes[0]?.id || null)
      } catch (err) {
        if (seq !== editSeqRef.current) return
        toast({
          title: t('加载失败'),
          description: err instanceof Error ? err.message : t('请稍后重试'),
          variant: 'destructive',
        })
        setLearnRoadId(null)
        setScenes([])
        setSelectedSceneId(null)
        setPositionScenarios([])
        setPositionTasks([])
      } finally {
        if (seq === editSeqRef.current) setEditLoading(false)
      }
    },
    [loadPositionScenes, toast, t],
  )

  const handleBack = () => {
    setView('list')
    setEditingPosition(null)
    setSaved(false)
    setLearnRoadId(null)
    setScenes([])
    setSelectedSceneId(null)
    setPositionScenarios([])
    setPositionTasks([])
  }

  const moveScene = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction
    if (newIndex < 0 || newIndex >= scenes.length) return
    const newScenes = [...scenes]
    const [moved] = newScenes.splice(index, 1)
    newScenes.splice(newIndex, 0, moved)
    setScenes(newScenes)
    setSaved(false)
  }

  const handleSave = async () => {
    if (!editingPosition) return
    setSaving(true)
    try {
      const steps = scenesToSteps(scenes)
      let id = learnRoadId
      // 本地编辑态下尚无路径记录，先创建再更新
      if (!id) {
        const created = await learnRoadApi.create({
          name: t('{name}学习路径', { name: editingPosition.name }),
          positionIds: [editingPosition.id],
          steps,
        })
        id = created.id
        learnRoadsRef.current = [created, ...(learnRoadsRef.current ?? [])]
        setLearnRoadId(id)
      }
      const updated = await learnRoadApi.update(id, {
        name: t('{name}学习路径', { name: editingPosition.name }),
        positionIds: [editingPosition.id],
        steps,
      })
      learnRoadsRef.current = (learnRoadsRef.current ?? []).map((r) =>
        r.id === updated.id ? updated : r,
      )
      setSaved(true)
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
      savedTimerRef.current = setTimeout(() => setSaved(false), 2000)
      toast({ title: t('保存成功'), description: t('学习路径顺序已更新') })
    } catch (err) {
      toast({
        title: t('保存失败'),
        description: err instanceof Error ? err.message : t('请稍后重试'),
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const ListView = () => (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">{t('岗位学习路径管理')}</h1>
        <p className="text-muted-foreground mt-1">{t('按岗位管理学习路径中场景与任务的展示顺序')}</p>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <SearchInput
              wrapperClassName="flex-1"
              placeholder={t('搜索岗位名称、简称...')}
              value={searchQuery}
              onChange={setSearchQuery}
            />
            <Select
              value={filterStatus}
              onValueChange={(v) => setFilterStatus(v as typeof filterStatus)}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('全部状态')}</SelectItem>
                <SelectItem value="draft">{t('草稿')}</SelectItem>
                <SelectItem value="pending">{t('审批中')}</SelectItem>
                <SelectItem value="approved">{t('已通过')}</SelectItem>
                <SelectItem value="rejected">{t('已驳回')}</SelectItem>
                <SelectItem value="published">{t('已发布')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle>{t('岗位列表')}</CardTitle>
            {(listLoading || dataLoading) && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
          <CardDescription>{t('共 {n} 个岗位', { n: filteredPositions.length })}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('岗位名称')}</TableHead>
                <TableHead>{t('场景数')}</TableHead>
                <TableHead>{t('任务数')}</TableHead>
                <TableHead className="text-right">{t('操作')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPositions.length === 0 ? (
                <TableEmptyRow colSpan={4} className="h-32">
                  <EmptyState
                    icon={<FolderOpen className="h-10 w-10" />}
                    title={t('暂无岗位数据')}
                    className="py-0"
                  />
                </TableEmptyRow>
              ) : (
                filteredPositions.map((position) => {
                  const stats = positionSceneStats.get(position.id)
                  const sceneCount = stats?.sceneCount ?? 0
                  const taskCount = stats?.taskCount ?? 0

                  return (
                    <TableRow key={position.id} className="group">
                      <TableCell>
                        <span className="font-medium text-foreground">{position.name}</span>
                        <p className="text-xs text-muted-foreground mt-0.5">{position.shortName}</p>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className="bg-blue-50 text-blue-600 hover:bg-blue-50"
                        >
                          {sceneCount}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className="bg-blue-50 text-blue-600 hover:bg-blue-50"
                        >
                          {taskCount}
                        </Badge>
                      </TableCell>
                      <TableRowActions>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => handleEdit(position)}
                          disabled={editLoading}
                        >
                          <Pencil className="mr-1 h-3 w-3" />
                          {t('编辑学习路径')}
                        </Button>
                      </TableRowActions>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )

  return (
    <div className="space-y-6">
      {view === 'list' ? (
        ListView()
      ) : editingPosition ? (
        <EditView
          editingPosition={editingPosition}
          batches={batches}
          scenes={scenes}
          setScenes={setScenes}
          selectedSceneId={selectedSceneId}
          setSelectedSceneId={setSelectedSceneId}
          positionScenarios={positionScenarios}
          positionTasks={positionTasks}
          editLoading={editLoading}
          saving={saving}
          saved={saved}
          onBack={handleBack}
          onSave={handleSave}
          setSaved={setSaved}
          moveScene={moveScene}
        />
      ) : null}
    </div>
  )
}
