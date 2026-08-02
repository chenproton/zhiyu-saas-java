'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'

import {
  BookOpen,
  FileText,
  Clock,
  Lightbulb,
  FolderOpen,
  ClipboardList,
  Target,
  BrainCircuit,
  BarChart3,
  ListChecks,
  Sparkles,
  ArrowLeft,
  Eye,
  Layers,
  PanelLeftClose,
  PanelLeftOpen,
  Play,
  Upload,
  CheckCircle2,
  Send,
} from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

import {
  scenarioApi,
  taskApi,
  resourceLibraryApi,
  knowledgeApi,
  abilityApi,
  taskEvaluationApi,
  evaluationResultApi,
  fileApi,
} from '@/lib/api'
import type {
  Scenario,
  ScenarioTask,
  TaskResource,
  KnowledgePoint,
  AbilityPoint,
  TaskEvaluationMethod,
  SceneEvaluationResult,
} from '@/lib/types'
import { cn } from '@/lib/utils'
import { useAuth } from '@/components/auth-provider'
import { PlatformFooter } from '@/components/job/student/platform-footer'
import {
  ResourcePreviewModal,
  usePreviewResources,
} from '@/components/shared/resource-preview-modal'

/* ---------- constants ---------- */

const difficultyMap: Record<number, { color: string; label: string; bg: string }> = {
  1: { color: '#16a34a', label: '入门', bg: '#f0fdf4' },
  2: { color: '#ca8a04', label: '初级', bg: '#fefce8' },
  3: { color: '#ea580c', label: '中级', bg: '#fff7ed' },
  4: { color: '#dc2626', label: '高级', bg: '#fef2f2' },
  5: { color: '#7c3aed', label: '专家', bg: '#f5f3ff' },
}

const resourceTypeLabels: Record<string, string> = {
  document: '文档',
  video: '视频',
  link: '链接',
  file: '文件',
  spreadsheet: '表格',
  presentation: '演示',
  image: '图片',
  audio: '音频',
  pdf: 'PDF',
}

const resourceTypeIcons: Record<string, string> = {
  document: 'text-[#3b82f6] bg-blue-50',
  video: 'text-[#f59e0b] bg-amber-50',
  link: 'text-[#8b5cf6] bg-purple-50',
  file: 'text-[#10b981] bg-emerald-50',
  spreadsheet: 'text-[#16a34a] bg-green-50',
  presentation: 'text-[#f97316] bg-orange-50',
  image: 'text-[#ec4899] bg-pink-50',
  audio: 'text-[#06b6d4] bg-cyan-50',
  pdf: 'text-[#ef4444] bg-red-50',
}

const evalMethodLabels: Record<string, string> = {
  random_draw: '随机抽题',
  review: '评审',
  paper: '试卷',
  question_bank: '题库',
  outcome: '成果',
  homework: '作业',
  quiz: '测验',
}

const methodColorMap: Record<string, string> = {
  random_draw: '#6366f1',
  review: '#f43f5e',
  paper: '#0ea5e9',
  question_bank: '#8b5cf6',
  outcome: '#10b981',
  homework: '#f59e0b',
  quiz: '#06b6d4',
}

const methodIconMap: Record<string, React.ElementType> = {
  paper: FileText,
  question_bank: Layers,
  quiz: ListChecks,
  random_draw: Sparkles,
  review: Eye,
  outcome: FolderOpen,
  homework: Lightbulb,
}

const methodActionText: Record<string, string> = {
  paper: '开始答题',
  question_bank: '开始答题',
  quiz: '开始答题',
  random_draw: '开始答题',
  review: '上传材料',
  outcome: '上传成果',
  homework: '上传作业',
}

const methodDescMap: Record<string, string> = {
  paper: '在线试卷答题',
  question_bank: '题库抽题作答',
  quiz: '随堂测验',
  random_draw: '随机抽题测评',
  review: '提交材料进行评审',
  outcome: '上传成果材料',
  homework: '上传作业材料',
}

const methodBgMap: Record<string, string> = {
  paper: '#f0f9ff',
  question_bank: '#faf5ff',
  quiz: '#f0fdfa',
  random_draw: '#eef2ff',
  review: '#fff1f2',
  outcome: '#f0fdf4',
  homework: '#fffbeb',
}

const methodBorderMap: Record<string, string> = {
  paper: '#bae6fd',
  question_bank: '#ddd6fe',
  quiz: '#99f6e4',
  random_draw: '#c7d2fe',
  review: '#fecdd3',
  outcome: '#bbf7d0',
  homework: '#fde68a',
}

/* ---------- page ---------- */

export default function SceneLearnPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const id = params.id as string
  const targetTaskId = searchParams.get('task')
  const { user } = useAuth()

  const [scenario, setScenario] = useState<Scenario | null>(null)
  const [tasks, setTasks] = useState<ScenarioTask[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTaskId, setActiveTaskId] = useState<string | null>(targetTaskId || null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true)

  const [resourceMap, setResourceMap] = useState<Map<string, TaskResource>>(new Map())
  const [knowledgeMap, setKnowledgeMap] = useState<Map<string, KnowledgePoint>>(new Map())
  const [abilityMap, setAbilityMap] = useState<Map<string, AbilityPoint>>(new Map())
  const [previewResources, addPreviewResource, removePreviewResource] = usePreviewResources()
  const [evalMethods, setEvalMethods] = useState<TaskEvaluationMethod[]>([])
  const [myResults, setMyResults] = useState<SceneEvaluationResult[]>([])

  useEffect(() => {
    ;(async () => {
      if (!id) return
      setLoading(true)
      try {
        const s = await scenarioApi.get(id)
        setScenario(s)
      } catch {
        setScenario(null)
      } finally {
        setLoading(false)
      }
    })()
  }, [id])

  useEffect(() => {
    if (!id || !scenario) return
    taskApi
      .list({ scenarioId: id, limit: 1000 })
      .then((res) => {
        const tList = res.items || []
        setTasks(tList)
        setActiveTaskId((prev) => {
          if (targetTaskId && tList.find((t) => t.id === targetTaskId)) {
            return targetTaskId
          }
          if (tList.length > 0 && !prev) {
            return tList[0].id
          }
          return prev
        })
      })
      .catch(() => setTasks([]))
  }, [id, scenario, targetTaskId])

  useEffect(() => {
    if (!id || !scenario) return
    resourceLibraryApi
      .list({ limit: 10000 })
      .then((res) => {
        const rMap = new Map<string, TaskResource>()
        ;(res.items || []).forEach((r: any) => {
          rMap.set(r.id, {
            ...r,
            type: r.resourceType || r.type,
            size: r.fileSize !== undefined ? String(r.fileSize) : r.size,
          } as TaskResource)
        })
        setResourceMap(rMap)
      })
      .catch(() => setResourceMap(new Map()))

    Promise.all([
      knowledgeApi.list({ limit: 1000 }).catch(() => ({ items: [] as KnowledgePoint[], total: 0 })),
      abilityApi.list({ limit: 1000 }).catch(() => ({ items: [] as AbilityPoint[], total: 0 })),
    ])
      .then(([kRes, aRes]) => {
        const kMap = new Map<string, KnowledgePoint>()
        ;(kRes.items || []).forEach((k) => kMap.set(k.id, k))
        setKnowledgeMap(kMap)
        const aMap = new Map<string, AbilityPoint>()
        ;(aRes.items || []).forEach((a) => aMap.set(a.id, a))
        setAbilityMap(aMap)
      })
      .catch(() => {})
  }, [id, scenario])

  useEffect(() => {
    ;(async () => {
      if (!activeTaskId) return
      setEvalMethods([])
      try {
        const res = await taskEvaluationApi.listMethods(activeTaskId)
        setEvalMethods(
          (res.methods || []).filter((m: TaskEvaluationMethod) => m.isEnabled !== false),
        )
      } catch {
        setEvalMethods([])
      }
    })()
  }, [activeTaskId])

  useEffect(() => {
    if (!activeTaskId) return
    evaluationResultApi
      .list({ taskId: activeTaskId, evaluateeId: user?.id, limit: 50 })
      .then((res) => setMyResults(res.items || []))
      .catch(() => {})
  }, [activeTaskId, user?.id])

  const activeTask = useMemo(() => tasks.find((t) => t.id === activeTaskId), [tasks, activeTaskId])
  const totalHours = useMemo(() => tasks.reduce((s, t) => s + (t.estimatedHours || 0), 0), [tasks])

  const taskKnowledgePoints = useMemo(() => {
    if (!activeTask) return []
    return (activeTask.knowledgePointIds || [])
      .map((kid) => knowledgeMap.get(kid))
      .filter(Boolean) as KnowledgePoint[]
  }, [activeTask, knowledgeMap])

  const taskAbilityPoints = useMemo(() => {
    if (!activeTask) return []
    return (activeTask.abilityPointIds || [])
      .map((aid) => abilityMap.get(aid))
      .filter(Boolean) as AbilityPoint[]
  }, [activeTask, abilityMap])

  const taskResources = useMemo(() => {
    if (!activeTask) return []
    return (activeTask.resourceIds || [])
      .map((rid) => resourceMap.get(rid))
      .filter(Boolean) as TaskResource[]
  }, [activeTask, resourceMap])

  const taskEvalMethods = useMemo(() => {
    return {
      methods: evalMethods.map((m) => m.methodKey),
      weights: Object.fromEntries(evalMethods.map((m) => [m.methodKey, m.weight])),
    }
  }, [evalMethods])

  const taskAggregate = useMemo(() => {
    let totalScore = 0
    let totalWeight = 0
    let evaluatedCount = 0
    let pendingCount = 0
    for (const m of evalMethods) {
      const weight = m.weight || 0
      totalWeight += weight
      const r = myResults.find((x) => x.methodKey === m.methodKey)
      if (r?.status === 'evaluated' && r.maxScore > 0) {
        totalScore += ((r.totalScore || 0) / r.maxScore) * weight
        evaluatedCount++
      } else if (r) {
        pendingCount++
      }
    }
    return {
      score: totalWeight > 0 ? Math.round(totalScore * 100) / 100 : 0,
      maxScore: totalWeight,
      evaluatedCount,
      pendingCount,
      totalMethods: evalMethods.length,
    }
  }, [evalMethods, myResults])

  const selectTask = useCallback((taskId: string) => {
    setActiveTaskId(taskId)
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col relative" style={{ background: '#F1FAFF' }}>
        <div className="fixed inset-0 pointer-events-none z-0">
          <div className="absolute top-[-120px] right-[5%] w-[480px] h-[480px] rounded-full bg-blue-400/10 blur-[120px]" />
          <div className="absolute bottom-[-80px] left-[5%] w-[360px] h-[360px] rounded-full bg-indigo-400/10 blur-[100px]" />
        </div>
        <header className="relative z-10 bg-white border-b border-gray-200/60 shrink-0 h-16 flex items-center px-6">
          <Skeleton className="h-5 w-48" />
        </header>
        <div className="relative z-10 flex-1 flex p-4">
          <div className="w-[300px] shrink-0 rounded-2xl border border-[#e7e5e4] bg-white p-5 shadow-[0_8px_32px_rgba(0,0,0,0.06)]">
            <Skeleton className="h-[200px] w-full rounded-xl" />
          </div>
          <div className="flex-1 p-4">
            <Skeleton className="h-[400px] w-full rounded-2xl" />
          </div>
        </div>
        <PlatformFooter />
      </div>
    )
  }

  if (!scenario) {
    return (
      <div className="min-h-screen flex flex-col relative" style={{ background: '#F1FAFF' }}>
        <div className="fixed inset-0 pointer-events-none z-0">
          <div className="absolute top-[-120px] right-[5%] w-[480px] h-[480px] rounded-full bg-blue-400/10 blur-[120px]" />
          <div className="absolute bottom-[-80px] left-[5%] w-[360px] h-[360px] rounded-full bg-indigo-400/10 blur-[100px]" />
        </div>
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-gray-400 p-8">
          <div className="relative w-24 h-24 mb-6">
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-blue-200 to-indigo-200 opacity-40 blur-xl" />
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-blue-100 to-indigo-100 opacity-60" />
            <div className="absolute inset-0 flex items-center justify-center">
              <BookOpen className="w-12 h-12 text-blue-400/70" />
            </div>
          </div>
          <div className="text-lg font-semibold text-gray-600">场景不存在</div>
          <Link
            href="/scene/landing"
            className="text-blue-600 hover:text-blue-700 mt-2 text-sm font-medium transition-colors"
          >
            返回场景列表
          </Link>
        </div>
        <PlatformFooter />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col relative" style={{ background: '#F1FAFF' }}>
      {/* ---------- ambient background ---------- */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-120px] right-[5%] w-[480px] h-[480px] rounded-full bg-blue-400/10 blur-[120px]" />
        <div className="absolute bottom-[-80px] left-[5%] w-[360px] h-[360px] rounded-full bg-indigo-400/10 blur-[100px]" />
        <div
          className="absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage: `linear-gradient(rgba(59,130,246,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.04) 1px, transparent 1px)`,
            backgroundSize: '48px 48px',
          }}
        />
      </div>

      {/* ---------- header ---------- */}
      <header className="bg-white border-b border-gray-200/60 shrink-0 sticky top-0 z-30">
        <div className="max-w-[1400px] mx-auto px-6 py-3 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                replace
                href={`/scene/landing/${id}`}
                className="group flex items-center gap-2.5 text-sm text-gray-500 hover:text-blue-600 transition-all duration-200"
              >
                <span className="w-8 h-8 rounded-xl bg-gray-100 border border-gray-200/60 flex items-center justify-center group-hover:bg-blue-50 group-hover:border-blue-200 group-hover:text-blue-600 transition-all duration-200">
                  <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform duration-200" />
                </span>
                <span className="font-semibold truncate max-w-[360px] lg:max-w-[520px] text-gray-800 group-hover:text-blue-600 transition-colors">
                  {scenario.name}
                </span>
              </Link>
            </div>
            <div className="flex items-center gap-2">
              {activeTask && (
                <>
                  <span className="flex items-center gap-1.5 text-xs font-medium text-gray-500 bg-blue-50 px-3 py-1.5 rounded-full border border-blue-100">
                    <Target className="w-3.5 h-3.5 text-blue-500" />{' '}
                    {activeTask.taskType === 'assessment' ? '考核' : '训练'}
                  </span>
                  <span className="flex items-center gap-1.5 text-xs font-medium text-gray-500 bg-blue-50 px-3 py-1.5 rounded-full border border-blue-100">
                    <BarChart3 className="w-3.5 h-3.5 text-blue-500" />{' '}
                    {difficultyMap[activeTask.difficulty]?.label || `Lv.${activeTask.difficulty}`}
                  </span>
                  <span className="flex items-center gap-1.5 text-xs font-medium text-gray-500 bg-blue-50 px-3 py-1.5 rounded-full border border-blue-100">
                    <Clock className="w-3.5 h-3.5 text-blue-500" /> {activeTask.estimatedHours || 0}{' '}
                    课时
                  </span>
                </>
              )}
              <span className="flex items-center gap-1.5 text-xs font-medium text-gray-500 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-200/80">
                <ListChecks className="w-3.5 h-3.5 text-blue-500" /> {tasks.length} 个任务
              </span>
              <span className="flex items-center gap-1.5 text-xs font-medium text-gray-500 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-200/80">
                <Clock className="w-3.5 h-3.5 text-blue-500" /> {totalHours} 课时
              </span>
            </div>
          </div>
          {activeTask?.background && (
            <div className="text-sm text-gray-600 leading-relaxed line-clamp-2 whitespace-pre-line">
              {activeTask.background}
            </div>
          )}
        </div>
      </header>

      {/* ---------- body ---------- */}
      <div className="relative z-10 flex-1 flex max-w-[1400px] mx-auto w-full">
        {/* ---------- left sidebar: task list ---------- */}
        <aside
          className={cn(
            'flex flex-shrink-0 flex-col rounded-2xl border border-[#e7e5e4] bg-white shadow-[0_8px_32px_rgba(0,0,0,0.06)] transition-all duration-300 sticky self-start mx-4 mt-4 overflow-hidden',
            sidebarCollapsed ? 'w-[68px]' : 'w-[300px]',
          )}
          style={{ top: '7rem', height: 'calc(100vh - 8rem)' }}
        >
          {/* sidebar header */}
          <div className="relative border-b border-gray-100 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 shadow-sm" />
            <div
              className={cn(
                'flex items-center',
                sidebarCollapsed ? 'px-2 py-3 justify-center' : 'px-5 py-3',
              )}
            >
              {!sidebarCollapsed && (
                <div className="flex-1 flex items-center gap-3">
                  <span className="flex items-center gap-1 text-xs text-gray-400">
                    <Layers className="w-3 h-3" />
                    {tasks.length} 个任务
                  </span>
                  <span className="flex items-center gap-1 text-xs text-gray-400">
                    <Clock className="w-3 h-3" />
                    {totalHours} 课时
                  </span>
                </div>
              )}
              <button
                onClick={() => setSidebarCollapsed((v) => !v)}
                className={cn(
                  'flex items-center justify-center rounded-lg hover:bg-gray-100 transition-all duration-200',
                  sidebarCollapsed
                    ? 'w-9 h-9 text-gray-500 hover:text-blue-600'
                    : 'w-8 h-8 ml-auto',
                )}
                title={sidebarCollapsed ? '展开任务列表' : '折叠任务列表'}
              >
                {sidebarCollapsed ? (
                  <PanelLeftOpen className="h-5 w-5" />
                ) : (
                  <PanelLeftClose className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {/* task list */}
          <ScrollArea className="flex-1">
            <div className="py-1">
              {tasks.map((task, idx) => {
                const isActive = activeTaskId === task.id
                const diff = difficultyMap[task.difficulty] || difficultyMap[3]

                if (sidebarCollapsed) {
                  return (
                    <div key={task.id} className="flex justify-center py-1.5">
                      <button
                        onClick={() => selectTask(task.id)}
                        className={cn(
                          'flex h-9 w-9 items-center justify-center rounded-xl text-[11px] font-bold transition-all duration-200',
                          isActive
                            ? 'bg-gradient-to-br from-blue-500 to-indigo-500 text-white shadow-lg shadow-blue-500/30'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-600 hover:-translate-y-0.5',
                        )}
                        title={`${idx + 1}. ${task.name} (${diff.label}, ${task.estimatedHours || 0}h)`}
                      >
                        {idx + 1}
                      </button>
                    </div>
                  )
                }

                return (
                  <button
                    key={task.id}
                    onClick={() => selectTask(task.id)}
                    className={cn(
                      'relative flex w-full items-center gap-3 px-4 py-3 text-left transition-all duration-200 group',
                      isActive
                        ? 'bg-gradient-to-r from-blue-50 via-blue-50/80 to-transparent'
                        : 'hover:bg-gray-50/80 hover:pl-5',
                    )}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-2 bottom-2 w-[3px] bg-gradient-to-b from-blue-500 to-indigo-500 rounded-r-full shadow-[0_0_8px_rgba(59,130,246,0.4)]" />
                    )}
                    <div
                      className={cn(
                        'flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-[11px] font-bold transition-all duration-200',
                        isActive
                          ? 'bg-gradient-to-br from-blue-500 to-indigo-500 text-white shadow-md shadow-blue-500/25'
                          : 'bg-gray-100 text-gray-500 group-hover:bg-gray-200 group-hover:text-gray-600 group-hover:-translate-y-0.5',
                      )}
                    >
                      {idx + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div
                        className={cn(
                          'text-[13px] font-semibold truncate transition-colors duration-200',
                          isActive ? 'text-blue-700' : 'text-gray-700 group-hover:text-gray-900',
                        )}
                      >
                        {task.name}
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[10px] text-gray-400 flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5" />
                          {task.estimatedHours || 0}h
                        </span>
                        <span
                          className="text-[10px] flex items-center gap-1"
                          style={{ color: diff.color }}
                        >
                          <BarChart3 className="h-2.5 w-2.5" />
                          {diff.label}
                        </span>
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                          style={{
                            backgroundColor: task.taskType === 'assessment' ? '#fef2f2' : '#eff6ff',
                            color: task.taskType === 'assessment' ? '#dc2626' : '#2563eb',
                          }}
                        >
                          {task.taskType === 'assessment' ? '考核' : '训练'}
                        </span>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </ScrollArea>
        </aside>

        {/* ---------- right main area ---------- */}
        <main className="flex flex-1 flex-col overflow-y-auto relative">
          {!activeTask ? (
            <div className="flex flex-col items-center justify-center flex-1 p-8">
              <div className="relative w-28 h-28 mb-6">
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-blue-200 to-indigo-200 opacity-40 blur-xl animate-pulse" />
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-blue-100 to-indigo-100 opacity-60" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <BookOpen className="w-12 h-12 text-blue-400/70" />
                </div>
              </div>
              <p className="text-base font-semibold text-gray-600">选择一个任务开始学习</p>
              <p className="text-sm text-gray-400 mt-1.5">从左侧任务列表中点击任务</p>
            </div>
          ) : (
            <>
              {/* collapsed layout: left 2 cards + right sticky tab card */}
              <div className="flex flex-1 gap-4 p-4">
                {/* left column: 2 cards */}
                <div className="flex-1 space-y-4">
                  {/* 任务说明书 */}
                  <Card className="rounded-2xl border border-gray-200 shadow-[0_4px_20px_rgba(0,0,0,0.04)] overflow-hidden hover:shadow-[0_8px_28px_rgba(0,0,0,0.08)] transition-all duration-300 py-0 gap-0 flex flex-col bg-white">
                    <CardHeader className="border-b border-gray-100 px-6 py-5 shrink-0 bg-white">
                      <CardTitle className="text-base flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-500">
                          <FileText className="h-4 w-4" />
                        </div>
                        <span className="text-gray-800 font-semibold text-lg">任务说明书</span>
                        {activeTask.descriptionPdf && (
                          <button
                            onClick={() =>
                              addPreviewResource({
                                id: `pdf-${Date.now()}`,
                                url: activeTask.descriptionPdf,
                                name: '任务说明书 PDF',
                                type: 'pdf',
                              } as TaskResource)
                            }
                            className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 px-3.5 py-2 rounded-xl bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800 shadow-sm transition-all"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            查看 PDF
                          </button>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-8 flex-1 bg-white">
                      <ScrollArea className="h-full">
                        {activeTask.detailedDescription || activeTask.description ? (
                          <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-line leading-loose">
                            {activeTask.detailedDescription || activeTask.description}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-400">暂无任务说明书</p>
                        )}
                      </ScrollArea>
                    </CardContent>
                  </Card>

                  {/* 任务测评 */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 px-1">
                      <div className="w-9 h-9 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-600">
                        <ClipboardList className="h-4 w-4" />
                      </div>
                      <h3 className="text-base font-semibold text-gray-800">任务测评</h3>
                      {taskAggregate.totalMethods > 0 && (
                        <div className="ml-auto flex items-center gap-3">
                          <span className="text-xs text-gray-500">
                            已评分 {taskAggregate.evaluatedCount}/{taskAggregate.totalMethods}
                          </span>
                          {taskAggregate.evaluatedCount > 0 && (
                            <span className="text-sm font-semibold text-blue-600">
                              综合 {taskAggregate.score}/{taskAggregate.maxScore}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {taskEvalMethods.methods.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {taskEvalMethods.methods.map((mk) => {
                          const method = evalMethods.find((m) => m.methodKey === mk)
                          if (!method) return null
                          const r = myResults.find((x) => x.methodKey === mk)
                          return (
                            <EvalMethodCard
                              key={mk}
                              method={method}
                              result={r}
                              sceneId={id}
                              taskId={activeTaskId}
                            />
                          )
                        })}
                      </div>
                    ) : (
                      <Card className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/60 p-8 flex flex-col items-center justify-center text-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-white border border-gray-200 flex items-center justify-center text-gray-400">
                          <ClipboardList className="h-6 w-6" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-700">
                            该任务暂未设置评价方式
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            教师配置后，测评入口将显示在此处
                          </p>
                        </div>
                      </Card>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </main>

        {/* right panel: sticky tabs - outside main, same level as sidebar */}
        {sidebarCollapsed && activeTask && (
          <div
            className="flex w-[360px] flex-shrink-0 sticky self-start mx-4 mt-4"
            style={{ top: '7rem', maxHeight: 'calc(100vh - 8rem)' }}
          >
            <Card className="rounded-2xl border border-[#e7e5e4] shadow-[0_8px_32px_rgba(0,0,0,0.06)] overflow-hidden flex flex-col w-full">
              <Tabs defaultValue="collapsed-knowledge" className="w-full flex flex-col h-full">
                <CardHeader className="border-b border-gray-100 p-2 shrink-0">
                  <TabsList className="bg-transparent p-0 h-auto gap-1 w-full">
                    <TabsTrigger
                      value="collapsed-knowledge"
                      className="flex-1 rounded-lg px-3 py-1.5 text-xs data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-50 data-[state=active]:to-indigo-50 data-[state=active]:text-blue-600 data-[state=active]:shadow-sm transition-all"
                    >
                      <BrainCircuit className="mr-1 h-3.5 w-3.5" />
                      知识点
                    </TabsTrigger>
                    <TabsTrigger
                      value="collapsed-ability"
                      className="flex-1 rounded-lg px-3 py-1.5 text-xs data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-50 data-[state=active]:to-indigo-50 data-[state=active]:text-blue-600 data-[state=active]:shadow-sm transition-all"
                    >
                      <Target className="mr-1 h-3.5 w-3.5" />
                      能力点
                    </TabsTrigger>
                    <TabsTrigger
                      value="collapsed-resource"
                      className="flex-1 rounded-lg px-3 py-1.5 text-xs data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-50 data-[state=active]:to-indigo-50 data-[state=active]:text-blue-600 data-[state=active]:shadow-sm transition-all"
                    >
                      <FolderOpen className="mr-1 h-3.5 w-3.5" />
                      资源
                    </TabsTrigger>
                  </TabsList>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto p-3">
                  <TabsContent value="collapsed-knowledge" className="mt-0 space-y-2">
                    {taskKnowledgePoints.length > 0 ? (
                      taskKnowledgePoints.map((kp, i) => (
                        <div
                          key={kp.id}
                          className="flex items-start gap-3 p-2.5 rounded-xl border border-gray-100 hover:border-blue-200 hover:bg-blue-50/30 transition-all cursor-pointer"
                        >
                          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                            {i + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-700">{kp.name}</p>
                            {kp.description && (
                              <p className="text-xs text-gray-400 line-clamp-2 mt-0.5">
                                {kp.description}
                              </p>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-gray-400 text-center py-8">暂无知识点</p>
                    )}
                  </TabsContent>
                  <TabsContent value="collapsed-ability" className="mt-0 space-y-2">
                    {taskAbilityPoints.length > 0 ? (
                      taskAbilityPoints.map((ap, i) => {
                        const cat = (
                          {
                            knowledge: { label: '知识', color: '#2563eb' },
                            skill: { label: '技能', color: '#16a34a' },
                            quality: { label: '素养', color: '#7c3aed' },
                          } as any
                        )[ap.category] || { label: ap.category, color: '#94a3b8' }
                        return (
                          <div
                            key={ap.id}
                            className="flex items-start gap-3 p-2.5 rounded-xl border border-gray-100 hover:border-blue-200 hover:bg-blue-50/30 transition-all cursor-pointer"
                          >
                            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                              {i + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-700">{ap.name}</p>
                              <span
                                className="text-[10px] px-1.5 py-0.5 rounded-full mt-0.5"
                                style={{ backgroundColor: cat.color + '15', color: cat.color }}
                              >
                                {cat.label}
                              </span>
                            </div>
                          </div>
                        )
                      })
                    ) : (
                      <p className="text-xs text-gray-400 text-center py-8">暂无能力点</p>
                    )}
                  </TabsContent>
                  <TabsContent value="collapsed-resource" className="mt-0 space-y-2">
                    {taskResources.length > 0 ? (
                      taskResources.map((r) => (
                        <div
                          key={r.id}
                          className="flex items-start gap-3 p-2.5 rounded-xl border border-gray-100 hover:border-blue-200 hover:bg-blue-50/30 transition-all cursor-pointer"
                          onClick={() => addPreviewResource(r)}
                        >
                          <div
                            className={`w-7 h-7 rounded-lg shrink-0 flex items-center justify-center ${resourceTypeIcons[r.type] || 'text-gray-400 bg-gray-50'}`}
                          >
                            <FileText className="h-3.5 w-3.5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-700 truncate">{r.name}</p>
                            <p className="text-[11px] text-gray-400">
                              {resourceTypeLabels[r.type] || r.type}
                              {r.size ? ` · ${r.size}` : ''}
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-gray-400 text-center py-8">暂无资源</p>
                    )}
                  </TabsContent>
                </CardContent>
              </Tabs>
            </Card>
          </div>
        )}
      </div>

      {previewResources.map((r, i) => (
        <ResourcePreviewModal
          key={r.id}
          resource={r}
          open
          index={i}
          onOpenChange={() => removePreviewResource(r.id)}
        />
      ))}

      <PlatformFooter />
    </div>
  )
}

/* ---------- sub components ---------- */

interface EvalMethodCardProps {
  method: TaskEvaluationMethod
  result?: SceneEvaluationResult
  sceneId: string
  taskId: string | null
}

function EvalMethodCard({ method, result, sceneId, taskId }: EvalMethodCardProps) {
  const { user } = useAuth()
  const color = methodColorMap[method.methodKey] || '#94a3b8'
  const bg = methodBgMap[method.methodKey] || '#f8fafc'
  const border = methodBorderMap[method.methodKey] || '#e2e8f0'
  const label = evalMethodLabels[method.methodKey] || method.methodKey
  const Icon = methodIconMap[method.methodKey] || ClipboardList
  const weight = method.weight || 0
  const actionText = methodActionText[method.methodKey] || '开始测评'
  const description = methodDescMap[method.methodKey] || '进入测评'
  const isExamMethod = ['paper', 'question_bank', 'quiz'].includes(method.methodKey)
  const isManualSubmit = ['outcome', 'homework'].includes(method.methodKey)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const examId = isExamMethod
    ? method.methodKey === 'paper'
      ? method.resourceConfig?.paperId
      : method.resourceConfig?.examId
    : null
  const usageId = method.resourceConfig?.usageId
  const examHref = examId
    ? `/evaluation/landing/exams/${examId}?task=${taskId}&scene=${sceneId}&method=${method.methodKey}&usage=${usageId || ''}`
    : '#'

  return (
    <Card
      className="rounded-2xl overflow-hidden hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 transition-all duration-300 py-0 gap-0 flex flex-col relative"
      style={{ backgroundColor: bg, border: `1px solid ${border}` }}
    >
      <CardContent className="p-5 flex-1 flex flex-col relative z-10">
        <div className="flex items-start gap-3">
          <div
            className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shrink-0 shadow-sm"
            style={{ color, border: `1px solid ${border}` }}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-sm font-semibold text-gray-800">{label}</h4>
              <span
                className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/80 border text-gray-600"
                style={{ borderColor: border }}
              >
                权重 {Math.round(weight)}%
              </span>
            </div>
            <p className="text-xs text-gray-600 mt-1">{description}</p>
          </div>
        </div>
        <div className="mt-auto pt-5 flex items-center justify-end">
          {result ? (
            <span
              className={cn(
                'text-xs font-medium px-2 py-0.5 rounded-full border',
                result.status === 'evaluated'
                  ? 'text-green-600 bg-green-50 border-green-200'
                  : 'text-amber-600 bg-amber-50 border-amber-200',
              )}
            >
              {result.status === 'evaluated'
                ? `得分 ${result.totalScore}/${result.maxScore}`
                : '待评分'}
            </span>
          ) : submitted ? (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full border text-amber-600 bg-amber-50 border-amber-200">
              待评分
            </span>
          ) : isExamMethod ? (
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs gap-1 bg-white/80 hover:bg-white border-gray-300 text-gray-700 hover:text-gray-900"
              asChild
              disabled={!examId}
            >
              <Link href={examHref}>
                <Play className="w-3.5 h-3.5 fill-current" />
                {examId ? actionText : '未配置考试'}
              </Link>
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs gap-1 bg-white/80 hover:bg-white border-gray-300 text-gray-700 hover:text-gray-900"
              onClick={() => setDialogOpen(true)}
            >
              {isManualSubmit ? (
                <Upload className="w-3.5 h-3.5" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-current" />
              )}
              {actionText}
            </Button>
          )}
        </div>
      </CardContent>

      {!result && !isExamMethod && (
        <EvalMethodSubmitDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          method={method}
          sceneId={sceneId}
          taskId={taskId}
          userId={user?.id}
          onSubmitted={() => setSubmitted(true)}
        />
      )}
    </Card>
  )
}

interface EvalMethodSubmitDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  method: TaskEvaluationMethod
  sceneId: string
  taskId: string | null
  userId?: string
  onSubmitted?: () => void
}

function EvalMethodSubmitDialog({
  open,
  onOpenChange,
  method,
  sceneId,
  taskId,
  userId,
  onSubmitted,
}: EvalMethodSubmitDialogProps) {
  const color = methodColorMap[method.methodKey] || '#94a3b8'
  const label = evalMethodLabels[method.methodKey] || method.methodKey
  const Icon = methodIconMap[method.methodKey] || ClipboardList
  const resourceConfig = method.resourceConfig || {}
  const reviewSteps = method.reviewSteps || []
  const isTeacherLed = ['random_draw', 'review'].includes(method.methodKey)
  const isManualSubmit = ['outcome', 'homework'].includes(method.methodKey)
  const requiresMaterial = resourceConfig.requiresMaterial !== false

  const [text, setText] = useState('')
  const [files, setFiles] = useState<{ name: string; url: string; size: number }[]>([])
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    ;(async () => {
      if (open) {
        setText('')
        setFiles([])
        setSubmitted(false)
      }
    })()
  }, [open])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const res = await fileApi.upload(file)
      setFiles((prev) => [...prev, { name: file.name, url: res.url, size: res.size || file.size }])
    } catch {
      /* ignore */
    }
    setUploading(false)
    e.target.value = ''
  }

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    if (!userId || !taskId) return
    setSubmitting(true)
    try {
      const payload: any = {
        taskId,
        sceneId,
        methodKey: method.methodKey,
        evaluateeId: userId,
        maxScore: 100,
      }
      if (isManualSubmit) {
        payload.subjectiveContent = { text, files, attempts: 1 }
      } else if (isTeacherLed) {
        payload.subjectiveContent = { attended: true, attempts: 1 }
      } else {
        payload.subjectiveContent = {}
      }
      await evaluationResultApi.submit(payload)
      setSubmitted(true)
      onSubmitted?.()
    } catch {
      /* ignore */
    }
    setSubmitting(false)
  }

  const headerGradient = isManualSubmit
    ? 'from-amber-50 via-orange-50 to-white'
    : isTeacherLed
      ? 'from-purple-50 via-indigo-50 to-white'
      : 'from-blue-50 via-indigo-50 to-white'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-[92vw] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-2xl">
        <div className={cn('relative px-6 py-5 border-b', headerGradient)}>
          <div
            className="absolute top-0 left-0 right-0 h-1"
            style={{ background: `linear-gradient(90deg, ${color}, ${color}88)` }}
          />
          <DialogHeader className="space-y-0">
            <div className="flex items-center gap-3">
              <div
                className="w-11 h-11 rounded-xl bg-white flex items-center justify-center shadow-sm"
                style={{ color, border: `1px solid ${color}30` }}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold text-gray-900">{label}</DialogTitle>
                <DialogDescription className="text-xs text-gray-500 mt-0.5">
                  {isTeacherLed
                    ? '确认参加本次测评，后续由教师进行现场评价'
                    : '按测评要求提交材料后等待教师评分'}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {submitted ? (
            <div className="py-8 text-center">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <h4 className="text-base font-semibold text-gray-900">提交成功</h4>
              <p className="text-sm text-gray-500 mt-1">等待教师评分后可在学习页查看成绩</p>
            </div>
          ) : (
            <>
              {/* 测评要求 */}
              <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-4 space-y-2.5">
                <h5 className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  测评要求
                </h5>
                {!requiresMaterial ? (
                  <p className="text-sm text-gray-600">本测评无需在线提交材料。</p>
                ) : (
                  <>
                    {resourceConfig.submitFormatDesc ? (
                      <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">
                        {resourceConfig.submitFormatDesc}
                      </p>
                    ) : (
                      <p className="text-sm text-gray-500">请按照教师要求准备材料</p>
                    )}
                  </>
                )}
                {resourceConfig.venueResources && (
                  <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">
                    <span className="font-medium text-gray-700">场地/环境：</span>
                    {resourceConfig.venueResources}
                  </p>
                )}
                {resourceConfig.deadlineDays != null && (
                  <p className="text-sm text-gray-600">
                    <span className="font-medium text-gray-700">预计提交天数：</span>
                    {resourceConfig.deadlineDays} 天
                  </p>
                )}
                {resourceConfig.allowResubmit !== undefined && (
                  <p className="text-sm text-gray-600">
                    <span className="font-medium text-gray-700">允许重新提交：</span>
                    {resourceConfig.allowResubmit ? '是' : '否'}
                  </p>
                )}
              </div>

              {/* 评审流程 */}
              {method.methodKey === 'review' &&
                reviewSteps.filter((s: any) => s.enabled).length > 0 && (
                  <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-4 space-y-2.5">
                    <h5 className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                      <ClipboardList className="h-3.5 w-3.5" />
                      评审流程
                    </h5>
                    <div className="space-y-2">
                      {reviewSteps
                        .filter((s: any) => s.enabled)
                        .map((s: any, idx: number) => (
                          <div key={s.id || idx} className="flex items-start gap-3 text-sm">
                            <div
                              className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold text-white shrink-0 mt-0.5"
                              style={{ backgroundColor: color }}
                            >
                              {idx + 1}
                            </div>
                            <div>
                              <p className="font-medium text-gray-800">{s.label}</p>
                              {s.description && (
                                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                                  {s.description}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

              {/* 提交内容 */}
              {isManualSubmit && requiresMaterial && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-gray-700">文字说明</Label>
                    <Textarea
                      placeholder="描述你的成果/作业内容..."
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      rows={4}
                      className="text-sm resize-none border-gray-200 focus-visible:ring-primary"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-gray-700">上传文件</Label>
                    {files.length > 0 && (
                      <div className="space-y-1.5 mb-2">
                        {files.map((f, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 border border-gray-100 px-3 py-2 rounded-lg"
                          >
                            <FileText className="h-4 w-4 text-gray-400" />
                            <span className="flex-1 truncate">{f.name}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 px-2"
                              onClick={() => removeFile(i)}
                            >
                              删除
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-3">
                      <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 bg-white text-xs font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors cursor-pointer">
                        <Upload className="h-3.5 w-3.5" />
                        选择文件
                        <input
                          type="file"
                          onChange={handleFileUpload}
                          disabled={uploading}
                          className="hidden"
                        />
                      </label>
                      {uploading && <span className="text-xs text-gray-400">上传中...</span>}
                    </div>
                  </div>
                </div>
              )}

              {isTeacherLed && (
                <div className="rounded-lg bg-blue-50/60 border border-blue-100 p-3">
                  <p className="text-sm text-blue-700 leading-relaxed">
                    {method.methodKey === 'random_draw'
                      ? '请确认参加本次现场问答，具体题目由教师在评分时抽取。'
                      : '请确认参加本次现场评审，具体评价步骤由教师选择执行。'}
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {!submitted && (
          <div className="px-6 py-4 border-t bg-gray-50/50 flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-9 px-4"
              onClick={() => onOpenChange(false)}
            >
              取消
            </Button>
            <Button
              size="sm"
              className="h-9 px-4 gap-1"
              style={{ backgroundColor: color }}
              onClick={handleSubmit}
              disabled={
                submitting || (isManualSubmit && requiresMaterial && !text && files.length === 0)
              }
            >
              {submitting ? (
                <Clock className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              {submitting ? '提交中...' : isTeacherLed ? '确认参加' : '提交测评'}
            </Button>
          </div>
        )}
        {submitted && (
          <div className="px-6 py-4 border-t bg-gray-50/50 flex items-center justify-end">
            <Button
              size="sm"
              className="h-9 px-4"
              style={{ backgroundColor: color }}
              onClick={() => onOpenChange(false)}
            >
              知道了
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

