'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  RotateCcw,
  Search,
  ArrowLeft,
  Pencil,
  FolderOpen,
  Eye,
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
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { positionApi, batchApi, learnRoadApi, scenarioApi, taskApi } from '@/lib/api'

import { convertCareerPositionToPosition, convertJobBatchToBatch } from '@/lib/stores/job-converters'
import { useToast } from '@/hooks/use-toast'
import type { Position, PositionStatus, Batch } from '@/lib/types/job-source'
import type { LearnRoad, LearnRoadStep } from '@/lib/types/job'
import type { Scenario, ScenarioTask } from '@/lib/types/scene'

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

function stepsToScenes(
  steps: LearnRoadStep[],
  scenarios: Scenario[],
  allTasks: ScenarioTask[]
): Scene[] {
  const scenarioMap = new Map(scenarios.map((s) => [s.id, s]))
  const result: Scene[] = []
  const usedScenarioIds = new Set<string>()

  for (const step of steps) {
    if (step.scenarioId && scenarioMap.has(step.scenarioId)) {
      const sc = scenarioMap.get(step.scenarioId)!
      result.push(scenarioToScene(sc, allTasks))
      usedScenarioIds.add(sc.id)
      continue
    }
    // 兼容旧数据：按名称匹配场景
    const matched = scenarios.find((s) => s.name === step.name && !usedScenarioIds.has(s.id))
    if (matched) {
      result.push(scenarioToScene(matched, allTasks))
      usedScenarioIds.add(matched.id)
      continue
    }
    // 未匹配到真实场景的步骤，保留名称和缓存的任务
    const orphanTasks = Array.isArray(step.tasks)
      ? step.tasks.map((t) => ({ id: String(t.id), name: String(t.name) }))
      : []
    result.push({
      id: `orphan-${step.name}-${Math.random().toString(36).slice(2, 8)}`,
      name: step.name,
      hours: 0,
      tasks: orphanTasks,
    })
  }

  // 追加尚未纳入学习路径的新场景
  for (const sc of scenarios) {
    if (!usedScenarioIds.has(sc.id)) {
      result.push(scenarioToScene(sc, allTasks))
    }
  }

  return result
}

function scenesToSteps(scenes: Scene[]): LearnRoadStep[] {
  return scenes.map((scene) => ({
    name: scene.name,
    scenarioId: scene.id.startsWith('orphan-') ? undefined : scene.id,
    tasks: scene.tasks,
  }))
}

function countScenesAndTasks(road?: LearnRoad): { sceneCount: number; taskCount: number } {
  const steps = road?.steps || []
  return {
    sceneCount: steps.length,
    taskCount: steps.reduce(
      (sum, step) => sum + (Array.isArray(step.tasks) ? step.tasks.length : 0),
      0
    ),
  }
}

export default function LearnRoadsPage() {
  const { toast } = useToast()

  const [positions, setPositions] = useState<Position[]>([])
  const [batches, setBatches] = useState<Batch[]>([])
  const [dataLoading, setDataLoading] = useState(false)

  const [view, setView] = useState<'list' | 'edit'>('list')
  const [editingPosition, setEditingPosition] = useState<Position | null>(null)

  const [scenes, setScenes] = useState<Scene[]>([])
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [learnRoadId, setLearnRoadId] = useState<string | null>(null)
  const [learnRoads, setLearnRoads] = useState<LearnRoad[]>([])
  const [positionScenarios, setPositionScenarios] = useState<Scenario[]>([])
  const [positionTasks, setPositionTasks] = useState<ScenarioTask[]>([])

  const [listLoading, setListLoading] = useState(false)
  const [editLoading, setEditLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | PositionStatus>('all')

  const loadJobData = useCallback(async () => {
    setDataLoading(true)
    try {
      const [posRes, batchRes] = await Promise.all([
        positionApi.list({ limit: 1000 }),
        batchApi.list({ limit: 1000 }),
      ])
      setPositions(posRes.items.map(convertCareerPositionToPosition))
      setBatches(batchRes.items.map(convertJobBatchToBatch))
    } catch (err: any) {
      toast({ variant: 'destructive', title: '加载失败', description: err?.message || '请稍后重试' })
    } finally {
      setDataLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadJobData()
  }, [loadJobData])

  useEffect(() => {
    let cancelled = false
    setListLoading(true)
    learnRoadApi
      .list({ limit: 1000 })
      .then((res) => {
        if (!cancelled) setLearnRoads(res.items || [])
      })
      .catch((err) => {
        toast({
          title: '加载失败',
          description: err instanceof Error ? err.message : '无法获取学习路径数据',
          variant: 'destructive',
        })
      })
      .finally(() => {
        if (!cancelled) setListLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [toast])

  const getRoadForPosition = (positionId: string) =>
    learnRoads.find((r) => r.positionIds?.includes(positionId))

  const filteredPositions = useMemo(() => {
    let result = positions
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.shortName.toLowerCase().includes(q)
      )
    }
    if (filterStatus !== 'all') {
      result = result.filter((p) => p.status === filterStatus)
    }
    return result
  }, [positions, searchQuery, filterStatus])

  const loadPositionScenes = useCallback(async (positionId: string) => {
    try {
      const scenarioRes = await scenarioApi.list({
        careerPositionId: positionId,
        limit: 1000,
      })
      const scens = (scenarioRes.items || []).filter(
        (s) => s.status && s.status !== 'archived'
      )
      const taskResults = scens.length
        ? await Promise.all(scens.map((s) => taskApi.list({ scenarioId: s.id, limit: 1000 })))
        : []
      const allTasks = taskResults.flatMap((r) => r.items || [])
      setPositionScenarios(scens)
      setPositionTasks(allTasks)
      console.log('[learn-roads] loaded scenes for', positionId, 'scenes', scens.length, 'tasks', allTasks.length, scens.map((s) => ({ id: s.id, name: s.name, status: s.status })))
      return { scenarios: scens, tasks: allTasks }
    } catch (err) {
      console.error('[learn-roads] load scenes failed', err)
      toast({
        title: '加载场景失败',
        description: err instanceof Error ? err.message : '请稍后重试',
        variant: 'destructive',
      })
      setPositionScenarios([])
      setPositionTasks([])
      return { scenarios: [] as Scenario[], tasks: [] as ScenarioTask[] }
    }
  }, [toast])

  const handleEdit = useCallback(
    async (position: Position) => {
      setEditingPosition(position)
      setView('edit')
      setSaved(false)
      setEditLoading(true)

      try {
        const [{ items: roads = [] }, { scenarios, tasks }] = await Promise.all([
          learnRoadApi.list({ limit: 1000 }),
          loadPositionScenes(position.id),
        ])
        setLearnRoads(roads)

        const existing = roads.find((r) => r.positionIds?.includes(position.id))
        console.log('[learn-roads] existing road', existing?.id, 'positionIds', existing?.positionIds, 'steps', existing?.steps?.length)
        let loadedScenes: Scene[] = []
        if (existing?.id) {
          setLearnRoadId(existing.id)
          loadedScenes = stepsToScenes(existing.steps || [], scenarios, tasks)
          console.log('[learn-roads] loaded scenes from existing road', loadedScenes.length, loadedScenes.map((s) => ({ id: s.id, name: s.name })))
        } else if (scenarios.length) {
          const steps = scenesToSteps(scenarios.map((s) => scenarioToScene(s, tasks)))
          console.log('[learn-roads] creating road with steps', steps.length)
          const created = await learnRoadApi.create({
            name: `${position.name}学习路径`,
            positionIds: [position.id],
            steps,
          })
          setLearnRoads((prev) => [created, ...prev])
          setLearnRoadId(created.id)
          loadedScenes = stepsToScenes(created.steps || [], scenarios, tasks)
        } else {
          console.log('[learn-roads] creating empty road')
          const created = await learnRoadApi.create({
            name: `${position.name}学习路径`,
            positionIds: [position.id],
            steps: [],
          })
          setLearnRoads((prev) => [created, ...prev])
          setLearnRoadId(created.id)
          loadedScenes = []
        }
        setScenes(loadedScenes)
        setSelectedSceneId(loadedScenes[0]?.id || null)
      } catch (err) {
        toast({
          title: '加载失败',
          description: err instanceof Error ? err.message : '请稍后重试',
          variant: 'destructive',
        })
        setLearnRoadId(null)
        setScenes([])
        setSelectedSceneId(null)
        setPositionScenarios([])
        setPositionTasks([])
      } finally {
        setEditLoading(false)
      }
    },
    [loadPositionScenes, toast]
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
    if (!learnRoadId || !editingPosition) return
    setSaving(true)
    try {
      const updated = await learnRoadApi.update(learnRoadId, {
        name: `${editingPosition.name}学习路径`,
        positionIds: [editingPosition.id],
        steps: scenesToSteps(scenes),
      })
      setLearnRoads((prev) =>
        prev.map((r) => (r.id === updated.id ? updated : r))
      )
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      toast({ title: '保存成功', description: '学习路径顺序已更新' })
    } catch (err) {
      toast({
        title: '保存失败',
        description: err instanceof Error ? err.message : '请稍后重试',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    const road = learnRoads.find((r) => r.id === learnRoadId)
    const loaded = road
      ? stepsToScenes(road.steps || [], positionScenarios, positionTasks)
      : positionScenarios.map((s) => scenarioToScene(s, positionTasks))
    setScenes(loaded)
    setSelectedSceneId(loaded[0]?.id || null)
    setSaved(false)
  }

  const ListView = () => (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">岗位学习路径管理</h1>
        <p className="text-muted-foreground mt-1">按岗位管理学习路径中场景与任务的展示顺序</p>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="搜索岗位名称、简称..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select
              value={filterStatus}
              onValueChange={(v) => setFilterStatus(v as typeof filterStatus)}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="draft">草稿</SelectItem>
                <SelectItem value="pending">审批中</SelectItem>
                <SelectItem value="approved">已通过</SelectItem>
                <SelectItem value="rejected">已驳回</SelectItem>
                <SelectItem value="published">已发布</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle>岗位列表</CardTitle>
            {(listLoading || dataLoading) && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
          <CardDescription>共 {filteredPositions.length} 个岗位</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>岗位名称</TableHead>
                <TableHead>场景数</TableHead>
                <TableHead>任务数</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPositions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-32 text-center">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <FolderOpen className="h-10 w-10 mb-2" />
                      <p>暂无岗位数据</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredPositions.map((position) => {
                  const { sceneCount, taskCount } = countScenesAndTasks(
                    getRoadForPosition(position.id)
                  )

                  return (
                    <TableRow key={position.id} className="group">
                      <TableCell>
                        <span className="font-medium text-foreground">{position.name}</span>
                        <p className="text-xs text-muted-foreground mt-0.5">{position.shortName}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="bg-blue-50 text-blue-600 hover:bg-blue-50">
                          {sceneCount}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="bg-purple-50 text-purple-600 hover:bg-purple-50">
                          {taskCount}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right relative">
                        <div className="flex items-center justify-end gap-1 absolute right-2 top-1/2 -translate-y-1/2 bg-white/95 backdrop-blur-sm z-10 px-2 py-1 rounded-lg shadow-sm border opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => handleEdit(position)}
                            disabled={editLoading}
                          >
                            <Pencil className="mr-1 h-3 w-3" />
                            编辑学习路径
                          </Button>
                        </div>
                      </TableCell>
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

  const EditView = () => {
    if (!editingPosition) return null
    const batch = batches.find((b) => b.id === editingPosition.batchId)
    const timelineRef = useRef<HTMLDivElement>(null)
    const [draggingIndex, setDraggingIndex] = useState<number | null>(null)
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

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
            <Button variant="outline" size="sm" onClick={handleBack} disabled={editLoading}>
              <ArrowLeft className="mr-1 h-4 w-4" />
              返回岗位列表
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{editingPosition.name}</h1>
              <p className="text-muted-foreground mt-1">
                {batch ? batch.name : '未关联批次'} · {editingPosition.shortName}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                已加载 {positionScenarios.length} 个场景，{positionTasks.length} 个任务
                {scenes.length === 0 && positionScenarios.length > 0 && ' · 点击下方“保存顺序”生成学习路径'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleReset} disabled={editLoading || saving}>
              <RotateCcw className="mr-2 h-4 w-4" />
              重置
            </Button>
            <Link href={`/job/student/${editingPosition.id}`} target="_blank">
              <Button variant="outline" disabled={editLoading || saving}>
                <Eye className="mr-2 h-4 w-4" />
                预览学生端
              </Button>
            </Link>
            <Button onClick={handleSave} disabled={editLoading || saving || !learnRoadId}>
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {saved ? '已保存' : '保存顺序'}
            </Button>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl bg-[#f8f5f0] p-6 sm:p-8 relative overflow-hidden">
            <h2 className="text-center text-xl sm:text-2xl font-bold text-slate-800">
              {editingPosition.name}学习路径
            </h2>
            <p className="text-center text-sm text-slate-500 mt-2">
              点击上方阶段图标，查看该阶段的学习任务
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
              <div
                ref={timelineRef}
                className="overflow-x-auto pb-4 px-8"
              >
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
                          {idx === 0 ? 'START · 第1站' : `第${idx + 1}站`}
                        </div>
                        {scene.coverImage ? (
                          <div
                            className={cn(
                              'mt-2 flex h-14 w-14 items-center justify-center rounded-full overflow-hidden shadow-lg transition-transform bg-white',
                              isSelected && 'ring-4 ring-white scale-110'
                            )}
                          >
                            <img
                              src={scene.coverImage}
                              alt={scene.name}
                              className="h-full w-full object-cover"
                            />
                          </div>
                        ) : (
                          <div
                            className={cn(
                              'mt-2 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg transition-transform',
                              color.bg,
                              isSelected && 'ring-4 ring-white scale-110'
                            )}
                          >
                            <Icon className="h-6 w-6" />
                          </div>
                        )}
                        <div
                          className={cn(
                            'mt-3 text-sm font-bold text-center max-w-[140px]',
                            isSelected ? 'text-blue-600' : 'text-slate-800'
                          )}
                        >
                          {scene.name}
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          {scene.tasks.length} 任务 · {scene.hours} 课时
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
            {scenes.length === 0 && !editLoading && (
              <div className="text-center py-10 text-slate-500">
                <Layers className="h-10 w-10 mx-auto mb-2 opacity-40" />
                <p>该岗位下暂无已发布场景，请先创建并发布场景</p>
              </div>
            )}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">场景顺序</CardTitle>
              <CardDescription>拖拽场景卡片可调整顺序，点击场景查看任务</CardDescription>
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
                      dragOverIndex === index && dragOverIndex !== draggingIndex && 'border-blue-400 bg-blue-50/60'
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
                          className="h-8 w-8 rounded-full object-cover border border-slate-200"
                        />
                      ) : (
                        <span
                          className={cn(
                            'flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors',
                            isSelected
                              ? 'bg-blue-500 text-white'
                              : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200'
                          )}
                        >
                          {index + 1}
                        </span>
                      )}
                      <div>
                        <div
                          className={cn(
                            'font-medium transition-colors',
                            isSelected ? 'text-blue-700' : 'text-slate-900'
                          )}
                        >
                          {scene.name}
                        </div>
                        <div className="text-xs text-slate-500">
                          {scene.tasks.length} 任务 · {scene.hours} 课时
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
                <div className="text-center py-8 text-slate-500">
                  <FolderOpen className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p>暂无可排序的场景</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {view === 'list' ? <ListView /> : <EditView />}
    </div>
  )
}
