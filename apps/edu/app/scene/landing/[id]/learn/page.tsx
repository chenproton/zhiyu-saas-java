"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import { useParams, useSearchParams } from "next/navigation"
import Link from "next/link"

import {
  BookOpen,
  PlayCircle,
  FileText,
  CheckCircle2,
  StickyNote,
  Clock,
  MonitorPlay,
  Lightbulb,
  FolderOpen,
  ClipboardList,
  Target,
  Info,
  BrainCircuit,
  BarChart3,
  ListChecks,
  ExternalLink,
  Sparkles,
  X,
  ArrowLeft,
} from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"

import { scenarioApi, taskApi, taskResourceApi, knowledgeApi, abilityApi } from "@/lib/api"
import type { Scenario, ScenarioTask, TaskResource, KnowledgePoint, AbilityPoint } from "@/lib/types"
import { cn } from "@/lib/utils"
import { PlatformFooter } from "@/components/job/student/platform-footer"

/* ---------- constants ---------- */

const difficultyMap: Record<number, { color: string; label: string }> = {
  1: { color: "#16a34a", label: "入门" },
  2: { color: "#ca8a04", label: "初级" },
  3: { color: "#ea580c", label: "中级" },
  4: { color: "#dc2626", label: "高级" },
  5: { color: "#7c3aed", label: "专家" },
}

const resourceTypeLabels: Record<string, string> = {
  document: "文档", video: "视频", link: "链接", file: "文件",
  spreadsheet: "表格", presentation: "演示", image: "图片", audio: "音频", pdf: "PDF",
}

const evalMethodLabels: Record<string, string> = {
  random_draw: "随机抽题", review: "评审", paper: "试卷",
  question_bank: "题库", outcome: "成果", homework: "作业", quiz: "测验",
}

const methodColorMap: Record<string, string> = {
  random_draw: "#6366f1", review: "#f43f5e", paper: "#0ea5e9",
  question_bank: "#8b5cf6", outcome: "#10b981", homework: "#f59e0b", quiz: "#06b6d4",
}

/* ---------- page ---------- */

export default function SceneLearnPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const id = params.id as string
  const targetTaskId = searchParams.get("task")

  const [scenario, setScenario] = useState<Scenario | null>(null)
  const [tasks, setTasks] = useState<ScenarioTask[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTaskId, setActiveTaskId] = useState<string | null>(targetTaskId || null)

  const [resourceMap, setResourceMap] = useState<Map<string, TaskResource>>(new Map())
  const [knowledgeMap, setKnowledgeMap] = useState<Map<string, KnowledgePoint>>(new Map())
  const [abilityMap, setAbilityMap] = useState<Map<string, AbilityPoint>>(new Map())
  const [showResources, setShowResources] = useState(true)

  // fetch scenario
  useEffect(() => {
    if (!id) return
    setLoading(true)
    scenarioApi
      .get(id)
      .then(setScenario)
      .catch(() => setScenario(null))
      .finally(() => setLoading(false))
  }, [id])

  // fetch tasks
  useEffect(() => {
    if (!id || !scenario) return
    taskApi
      .list({ scenarioId: id, limit: 1000 })
      .then((res) => {
        const tList = res.items || []
        setTasks(tList)
        if (targetTaskId && tList.find((t) => t.id === targetTaskId)) {
          setActiveTaskId(targetTaskId)
        } else if (tList.length > 0 && !activeTaskId) {
          setActiveTaskId(tList[0].id)
        }
      })
      .catch(() => setTasks([]))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, scenario])

  // fetch resources / knowledge / abilities
  useEffect(() => {
    if (!id || !scenario) return
    taskResourceApi
      .listResources({ limit: 10000 })
      .then((res) => {
        const rMap = new Map<string, TaskResource>()
        ;(res.items || []).forEach((r) => rMap.set(r.id, r))
        setResourceMap(rMap)
      })
      .catch(() => setResourceMap(new Map()))

    Promise.all([
      knowledgeApi.list({ limit: 1000 }).catch(() => ({ items: [] as KnowledgePoint[], total: 0 })),
      abilityApi.list({ limit: 1000 }).catch(() => ({ items: [] as AbilityPoint[], total: 0 })),
    ]).then(([kRes, aRes]) => {
      const kMap = new Map<string, KnowledgePoint>()
      ;(kRes.items || []).forEach((k) => kMap.set(k.id, k))
      setKnowledgeMap(kMap)
      const aMap = new Map<string, AbilityPoint>()
      ;(aRes.items || []).forEach((a) => aMap.set(a.id, a))
      setAbilityMap(aMap)
    }).catch(() => {})
  }, [id, scenario])

  const activeTask = useMemo(() => tasks.find((t) => t.id === activeTaskId), [tasks, activeTaskId])
  const totalHours = useMemo(() => tasks.reduce((s, t) => s + (t.estimatedHours || 0), 0), [tasks])

  const taskKnowledgePoints = useMemo(() => {
    if (!activeTask) return []
    return (activeTask.knowledgePointIds || []).map((kid) => knowledgeMap.get(kid)).filter(Boolean) as KnowledgePoint[]
  }, [activeTask, knowledgeMap])

  const taskAbilityPoints = useMemo(() => {
    if (!activeTask) return []
    return (activeTask.abilityPointIds || []).map((aid) => abilityMap.get(aid)).filter(Boolean) as AbilityPoint[]
  }, [activeTask, abilityMap])

  const taskResources = useMemo(() => {
    if (!activeTask) return []
    return (activeTask.resourceIds || []).map((rid) => resourceMap.get(rid)).filter(Boolean) as TaskResource[]
  }, [activeTask, resourceMap])

  const taskEvalMethods = useMemo(() => {
    if (!activeTask?.evalData) return { methods: [] as string[], weights: {} as Record<string, number> }
    return {
      methods: (activeTask.evalData.evaluationMethods || []) as string[],
      weights: (activeTask.evalData.methodWeights || {}) as Record<string, number>,
    }
  }, [activeTask])

  const dependencyTasks = useMemo(() => {
    if (!activeTask?.dependencyIds?.length) return []
    return activeTask.dependencyIds.map((did) => tasks.find((t) => t.id === did)).filter(Boolean) as ScenarioTask[]
  }, [activeTask, tasks])

  const selectTask = useCallback((taskId: string) => {
    setActiveTaskId(taskId)
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-[#f8fafc]">
        <header className="bg-white border-b border-gray-200 shadow-[0_1px_3px_rgba(0,0,0,0.03)] shrink-0 h-16 flex items-center px-6">
          <Skeleton className="h-5 w-48" />
        </header>
        <div className="flex-1 flex">
          <div className="w-[300px] shrink-0 border-r border-gray-100 bg-white p-5">
            <Skeleton className="h-[200px] w-full rounded-lg" />
          </div>
          <div className="flex-1 bg-gray-50/50 p-6">
            <Skeleton className="h-[400px] w-full rounded-lg" />
          </div>
        </div>
        <PlatformFooter />
      </div>
    )
  }

  if (!scenario) {
    return (
      <div className="min-h-screen flex flex-col bg-[#f8fafc]">
        <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
          <div className="w-20 h-20 mb-5 rounded-3xl bg-gray-50 flex items-center justify-center">
            <BookOpen className="w-10 h-10 opacity-40" />
          </div>
          <div className="text-lg font-semibold text-gray-600">场景不存在</div>
          <Link href="/scene/landing" className="text-blue-600 hover:text-blue-700 mt-2 text-sm font-medium">返回场景列表</Link>
        </div>
        <PlatformFooter />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc]">
      {/* ---------- header ---------- */}
      <header className="bg-white border-b border-gray-200 shadow-[0_1px_3px_rgba(0,0,0,0.03)] shrink-0">
        <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href={`/scene/landing/${id}`}
              className="group flex items-center gap-2 text-sm text-gray-500 hover:text-blue-600 transition-colors"
            >
              <span className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center group-hover:bg-blue-50 transition-colors">
                <ArrowLeft className="w-4 h-4" />
              </span>
              <span className="font-medium truncate max-w-[300px] sm:max-w-[400px] lg:max-w-[500px]">{scenario.name}</span>
            </Link>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-500 bg-gray-50 px-4 py-1.5 rounded-full border border-gray-100">
            <span className="flex items-center gap-1.5"><ListChecks className="w-3.5 h-3.5 text-blue-500" /> {tasks.length} 个任务</span>
            <span className="w-px h-3 bg-gray-300" />
            <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-blue-500" /> {totalHours} 课时</span>
          </div>
        </div>
      </header>

      {/* ---------- body ---------- */}
      <div className="flex-1 flex max-w-[1400px] mx-auto w-full overflow-hidden bg-white">
        {/* ---------- left sidebar: task list ---------- */}
        <aside className="flex w-[300px] flex-shrink-0 flex-col border-r border-gray-100 bg-white">
          {/* scenario header */}
          <div className="border-b border-gray-100 px-5 py-4">
            <div className="flex items-start gap-2">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-blue-500 to-blue-700 text-xs font-bold text-white">
                场
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-sm font-bold text-gray-800">《{scenario.name}》</h2>
                <Badge variant="secondary" className="mt-1 bg-blue-50 text-blue-600 hover:bg-blue-50">
                  场景学习
                </Badge>
              </div>
            </div>
            <div className="mt-2 flex items-center text-xs text-gray-400">
              <span>
                共 {tasks.length} 个任务 · {totalHours} 课时
              </span>
            </div>
          </div>

          {/* task list */}
          <ScrollArea className="flex-1">
            <div className="py-2">
              {tasks.map((task, idx) => {
                const isActive = activeTaskId === task.id
                const diff = difficultyMap[task.difficulty] || difficultyMap[3]

                return (
                  <div
                    key={task.id}
                    className={cn(
                      "border-b border-gray-50 last:border-b-0",
                      isActive && "bg-blue-50/50"
                    )}
                  >
                    <button
                      onClick={() => selectTask(task.id)}
                      className={cn(
                        "flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-gray-50",
                        isActive && "hover:bg-blue-50/80"
                      )}
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <div
                          className={cn(
                            "flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-[10px] font-bold",
                            isActive ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-400"
                          )}
                        >
                          {idx + 1}
                        </div>
                        <span
                          className={cn(
                            "truncate text-sm",
                            isActive ? "font-semibold text-blue-600" : "text-gray-700"
                          )}
                        >
                          {task.name}
                        </span>
                      </div>
                    </button>

                    {/* task info bar */}
                    <div className="px-4 pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 text-[10px] text-gray-400">
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{task.estimatedHours || 0}h</span>
                          <span className="flex items-center gap-1" style={{ color: diff.color }}>
                            <BarChart3 className="h-3 w-3" />
                            {diff.label}
                          </span>
                        </div>
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded-full border font-medium"
                          style={{
                            backgroundColor: task.taskType === "assessment" ? "#fef2f2" : "#eff6ff",
                            color: task.taskType === "assessment" ? "#dc2626" : "#2563eb",
                            borderColor: task.taskType === "assessment" ? "#fecaca" : "#bfdbfe",
                          }}
                        >
                          {task.taskType === "assessment" ? "考核" : "训练"}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        </aside>

        {/* ---------- right main area ---------- */}
        <main className="flex flex-1 flex-col overflow-y-auto bg-gray-50/50">
          {!activeTask ? (
            <div className="flex flex-col items-center justify-center flex-1 text-gray-400">
              <div className="w-16 h-16 mb-4 rounded-2xl bg-gray-50 flex items-center justify-center">
                <BookOpen className="w-8 h-8 opacity-40" />
              </div>
              <p className="text-sm text-gray-500">从左侧任务列表中选择一个任务</p>
            </div>
          ) : (
            <>
              {/* content area: resource preview */}
              <div className="relative mx-4 mt-4 rounded-lg bg-slate-900 overflow-hidden flex-shrink-0">
                <div className="flex w-full max-h-[50vh] aspect-video items-center justify-center">
                  <div className="text-center">
                    {taskResources.length > 0 ? (
                      <>
                        <div className="mx-auto h-16 w-16 rounded-2xl bg-slate-800 flex items-center justify-center">
                          <FileText className="h-8 w-8 text-slate-500" />
                        </div>
                        <p className="mt-4 text-sm text-slate-300">{taskResources[0].name}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {resourceTypeLabels[taskResources[0].type] || taskResources[0].type}
                          {taskResources[0].size && ` · ${taskResources[0].size}`}
                        </p>
                      </>
                    ) : (
                      <>
                        <MonitorPlay className="mx-auto h-16 w-16 text-slate-600" />
                        <p className="mt-4 text-sm text-slate-400">任务资源预览区域</p>
                        <p className="mt-1 text-xs text-slate-600">{activeTask.name}</p>
                      </>
                    )}
                  </div>
                </div>
                <div className="absolute bottom-4 left-4 flex items-center gap-2">
                  <Badge variant="outline" className="border-slate-600 bg-slate-800/80 text-slate-300">
                    {activeTask.taskType === "assessment" ? "考核" : "训练"}
                  </Badge>
                  <span className="text-xs text-slate-400">{activeTask.estimatedHours || 0} 课时</span>
                </div>

                {/* 任务资源浮动入口 */}
                {taskResources.length > 0 && (
                  <>
                    <button
                      onClick={() => setShowResources((v) => !v)}
                      className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-slate-800/80 border border-slate-600 text-slate-300 text-xs hover:bg-slate-700 hover:text-white transition-colors z-10"
                    >
                      <FolderOpen className="h-3.5 w-3.5" />
                      任务资源
                    </button>

                    {showResources && (
                      <div className="absolute top-12 left-3 w-[320px] max-h-[360px] overflow-y-auto rounded-lg bg-slate-800/95 backdrop-blur-sm border border-slate-600 shadow-lg z-20">
                        <div className="px-3 py-2.5 border-b border-slate-700 flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                            <FolderOpen className="h-3.5 w-3.5" />
                            任务资源
                          </span>
                          <button onClick={() => setShowResources(false)} className="text-slate-500 hover:text-slate-300">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <div className="p-2 space-y-1.5">
                          {taskResources.map((r) => (
                            <div
                              key={r.id}
                              className="flex items-center gap-3 rounded-md px-2.5 py-2 hover:bg-slate-700/50 transition-colors cursor-pointer group"
                            >
                              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-700 text-slate-400 group-hover:bg-blue-600/50 group-hover:text-blue-300 shrink-0">
                                <FileText className="h-4 w-4" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs text-slate-200 truncate group-hover:text-white transition-colors">
                                  {r.name}
                                </p>
                                <p className="text-[10px] text-slate-500">
                                  {resourceTypeLabels[r.type] || r.type}{r.size ? ` · ${r.size}` : ""}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* tabs content */}
              <div className="p-6">
                <Tabs defaultValue="basic" className="w-full">
                  <TabsList className="mb-4">
                    <TabsTrigger value="basic">
                      <Info className="mr-1.5 h-4 w-4" />
                      任务基础信息
                    </TabsTrigger>
                    <TabsTrigger value="description">
                      <FileText className="mr-1.5 h-4 w-4" />
                      任务说明
                    </TabsTrigger>
                    <TabsTrigger value="knowledge">
                      <BrainCircuit className="mr-1.5 h-4 w-4" />
                      考查知识点
                    </TabsTrigger>
                    <TabsTrigger value="ability">
                      <Target className="mr-1.5 h-4 w-4" />
                      考查能力点
                    </TabsTrigger>
                    <TabsTrigger value="resource">
                      <FolderOpen className="mr-1.5 h-4 w-4" />
                      任务资源
                    </TabsTrigger>
                    <TabsTrigger value="evaluation">
                      <ClipboardList className="mr-1.5 h-4 w-4" />
                      任务测评形式
                    </TabsTrigger>
                  </TabsList>

                  {/* 任务基础信息 */}
                  <TabsContent value="basic" className="mt-0">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <Info className="h-4 w-4 text-[#3b82f6]" />
                          任务基础信息
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-3">
                          <InfoRow label="任务类型" value={activeTask.taskType === "assessment" ? "考核" : "训练"} />
                          {activeTask.code && <InfoRow label="任务编码" value={activeTask.code} />}
                          <InfoRow label="预计课时" value={`${activeTask.estimatedHours || 0} 课时`} />
                          <InfoRow label="难度等级" value={`Lv.${activeTask.difficulty} ${difficultyMap[activeTask.difficulty]?.label || ""}`} />
                          <InfoRow label="排序序号" value={String(activeTask.sortOrder)} />
                          <InfoRow label="关联知识点" value={`${activeTask.knowledgePointIds?.length || 0} 个`} />
                          <InfoRow label="关联能力点" value={`${activeTask.abilityPointIds?.length || 0} 个`} />
                          <InfoRow label="关联资源" value={`${activeTask.resourceIds?.length || 0} 个`} />
                        </div>

                        {dependencyTasks.length > 0 && (
                          <>
                            <Separator className="my-5" />
                            <div className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                              <Lightbulb className="w-4 h-4 text-amber-500" />
                              前置依赖任务
                            </div>
                            <div className="space-y-2">
                              {dependencyTasks.map((dt, i) => (
                                <button
                                  key={dt.id}
                                  onClick={() => selectTask(dt.id)}
                                  className="flex items-center gap-3 w-full text-left p-3 rounded-lg border border-gray-100 bg-gray-50/50 hover:border-blue-200 hover:bg-blue-50/30 transition-colors"
                                >
                                  <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 text-[10px] font-bold">
                                    {i + 1}
                                  </span>
                                  <span className="text-sm font-medium text-gray-700">{dt.name}</span>
                                  <span className="text-xs text-gray-400 ml-auto">
                                    {dt.estimatedHours || 0}h · Lv.{dt.difficulty}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* 任务说明 */}
                  <TabsContent value="description" className="mt-0">
                    {(activeTask.background || activeTask.description || activeTask.detailedDescription) ? (
                      <div className="space-y-4">
                        {activeTask.background && (
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-base flex items-center gap-2">
                                <FileText className="h-4 w-4 text-[#3b82f6]" />
                                任务背景
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="prose prose-sm max-w-none text-gray-600 whitespace-pre-line leading-relaxed">
                                {activeTask.background}
                              </div>
                            </CardContent>
                          </Card>
                        )}
                        {(activeTask.detailedDescription || activeTask.description) && (
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-base flex items-center gap-2">
                                <FileText className="h-4 w-4 text-[#8b5cf6]" />
                                任务描述
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="prose prose-sm max-w-none text-gray-600 whitespace-pre-line leading-relaxed">
                                {activeTask.detailedDescription || activeTask.description}
                              </div>
                            </CardContent>
                          </Card>
                        )}
                      </div>
                    ) : (
                      <Card>
                        <CardContent className="py-16">
                          <p className="text-xs text-gray-400 text-center">暂无任务说明</p>
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>

                  {/* 考查知识点 */}
                  <TabsContent value="knowledge" className="mt-0">
                    {taskKnowledgePoints.length > 0 ? (
                      <div>
                        <h3 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
                          <BrainCircuit className="w-4 h-4 text-[#3b82f6]" />
                          考查知识点
                          <span className="text-xs font-normal text-gray-400">({taskKnowledgePoints.length} 项)</span>
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {taskKnowledgePoints.map((kp) => (
                            <div
                              key={kp.id}
                              className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 hover:border-blue-200 hover:bg-blue-50/30 transition-all cursor-pointer group"
                            >
                              <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 group-hover:bg-blue-100 transition-colors">
                                <BrainCircuit className="w-4 h-4 text-blue-500" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <p className="text-sm font-medium text-gray-700">{kp.name}</p>
                                  {kp.code && <span className="text-[10px] font-mono text-gray-400">{kp.code}</span>}
                                </div>
                                {kp.description && (
                                  <p className="text-xs text-gray-500 leading-relaxed">{kp.description}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <Card>
                        <CardContent className="py-16">
                          <p className="text-xs text-gray-400 text-center">该任务暂未关联知识点</p>
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>

                  {/* 考查能力点 */}
                  <TabsContent value="ability" className="mt-0">
                    {taskAbilityPoints.length > 0 ? (
                      <AbilityTab abilityPoints={taskAbilityPoints} />
                    ) : (
                      <Card>
                        <CardContent className="py-16">
                          <p className="text-xs text-gray-400 text-center">该任务暂未关联能力点</p>
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>

                  {/* 任务资源 */}
                  <TabsContent value="resource" className="mt-0">
                    {taskResources.length > 0 ? (
                      <div>
                        <h3 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
                          <FolderOpen className="w-4 h-4 text-[#3b82f6]" />
                          任务资源
                          <span className="text-xs font-normal text-gray-400">({taskResources.length} 项)</span>
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {taskResources.map((r) => {
                            const typeColors: Record<string, string> = {
                              document: "bg-blue-50 text-blue-600 border-blue-100",
                              video: "bg-amber-50 text-amber-600 border-amber-100",
                              link: "bg-purple-50 text-purple-600 border-purple-100",
                              file: "bg-emerald-50 text-emerald-600 border-emerald-100",
                            }
                            return (
                              <div
                                key={r.id}
                                className="flex items-start justify-between gap-2 p-3 rounded-lg border border-gray-100 bg-gray-50/50 hover:border-blue-200 hover:shadow-sm transition-all"
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-semibold text-gray-800 mb-1.5 truncate">{r.name}</div>
                                  <div className="flex items-center gap-2 text-xs">
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${typeColors[r.type] || "bg-gray-100 text-gray-500 border-gray-200"}`}>
                                      {resourceTypeLabels[r.type] || r.type}
                                    </span>
                                    {r.size && <span className="text-gray-400">{r.size}</span>}
                                  </div>
                                </div>
                                {r.url && (
                                  <a
                                    href={r.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="shrink-0 w-7 h-7 rounded-lg bg-white border border-gray-200 text-gray-400 hover:text-blue-500 hover:border-blue-200 flex items-center justify-center transition-colors"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </a>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ) : (
                      <Card>
                        <CardContent className="py-16">
                          <p className="text-xs text-gray-400 text-center">该任务暂未关联学习资源</p>
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>

                  {/* 任务测评形式 */}
                  <TabsContent value="evaluation" className="mt-0">
                    {taskEvalMethods.methods.length > 0 ? (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base flex items-center gap-2">
                            <ClipboardList className="h-4 w-4 text-[#3b82f6]" />
                            任务测评形式
                            <span className="text-xs font-normal text-gray-400">({taskEvalMethods.methods.length} 种)</span>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="flex flex-wrap gap-1.5 mb-2">
                            {taskEvalMethods.methods.map((m) => (
                              <span
                                key={m}
                                className="text-[11px] px-2.5 py-1 rounded-full font-medium text-white"
                                style={{ backgroundColor: methodColorMap[m] || "#94a3b8" }}
                              >
                                {evalMethodLabels[m] || m}
                              </span>
                            ))}
                          </div>
                          {taskEvalMethods.methods.map((m) => {
                            const w = taskEvalMethods.weights[m] || 0
                            return (
                              <div key={m} className="flex items-center gap-3">
                                <span className="text-xs text-gray-600 w-20 shrink-0">{evalMethodLabels[m] || m}</span>
                                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                  <div
                                    className="h-full rounded-full transition-all"
                                    style={{
                                      width: `${Math.round(w)}%`,
                                      backgroundColor: methodColorMap[m] || "#94a3b8",
                                    }}
                                  />
                                </div>
                                <span className="text-xs font-semibold text-gray-600 w-10 text-right">{Math.round(w)}%</span>
                              </div>
                            )
                          })}
                        </CardContent>
                      </Card>
                    ) : (
                      <Card>
                        <CardContent className="py-16">
                          <p className="text-xs text-gray-400 text-center">该任务暂未设置评价方式</p>
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            </>
          )}
        </main>
      </div>

      <PlatformFooter />
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 rounded-lg border border-gray-100 bg-gray-50/50">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-gray-700">{value}</p>
    </div>
  )
}

function AbilityTab({ abilityPoints }: { abilityPoints: AbilityPoint[] }) {
  const [selectedAbility, setSelectedAbility] = useState<AbilityPoint | null>(null)

  const groupedByAttribute = useMemo(() => {
    const groups = new Map<string, AbilityPoint[]>()
    abilityPoints.forEach((ap) => {
      const attrs = ap.attributes?.length ? ap.attributes : ["未分类"]
      attrs.forEach((attr) => {
        const list = groups.get(attr) || []
        list.push(ap)
        groups.set(attr, list)
      })
    })
    return Array.from(groups.entries())
      .map(([attr, items]) => ({ attr, items }))
      .filter((g) => g.items.length > 0)
  }, [abilityPoints])

  const categoryLabels: Record<string, { color: string; label: string }> = {
    knowledge: { color: "#2563eb", label: "知识" },
    skill: { color: "#16a34a", label: "技能" },
    quality: { color: "#7c3aed", label: "素养" },
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="rounded-lg p-4" style={{ background: "linear-gradient(135deg, #eff6ff, #eef2ff)" }}>
            <div className="flex items-center gap-2 text-blue-800 font-bold mb-2 text-sm">
              <Sparkles className="w-4 h-4" />
              能力模型
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              共 <strong className="text-blue-600">{groupedByAttribute.length}</strong> 个能力属性，
              <strong className="text-blue-600"> {abilityPoints.length}</strong> 个能力点
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {groupedByAttribute.map(({ attr, items }) => (
          <Card key={attr} className="overflow-hidden">
            <div className="bg-blue-50 px-4 py-3 font-medium text-blue-600 flex items-center gap-2 text-sm border-b border-blue-100">
              <Target className="w-4 h-4" />
              {attr}
            </div>
            <CardContent className="p-3 max-h-[260px] overflow-y-auto">
              {items.map((ap) => {
                const cat = categoryLabels[ap.category] || { color: "#94a3b8", label: ap.category }
                return (
                  <button
                    key={ap.id}
                    onClick={() => setSelectedAbility(ap)}
                    className="flex items-start justify-between w-full text-left py-2 px-2 border-b border-gray-50 last:border-b-0 rounded hover:bg-blue-50/30 transition-colors gap-2"
                  >
                    <div className="flex flex-col min-w-0 gap-1">
                      <span className="text-sm text-gray-700 font-medium">{ap.name}</span>
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-full w-fit border"
                        style={{
                          backgroundColor: cat.color + "12",
                          color: cat.color,
                          borderColor: cat.color + "30",
                        }}
                      >
                        {cat.label}
                      </span>
                    </div>
                  </button>
                )
              })}
            </CardContent>
          </Card>
        ))}
      </div>

      {selectedAbility && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setSelectedAbility(null)}>
          <div className="bg-white rounded-2xl w-[520px] max-w-[95vw] p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div className="text-base font-semibold text-gray-800">能力点详情</div>
              <button className="text-gray-400 hover:text-gray-600" onClick={() => setSelectedAbility(null)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-blue-500 to-emerald-500" />
              <div className="text-sm font-semibold text-gray-800 mb-3">{selectedAbility.name}</div>
              {selectedAbility.code && (
                <div className="text-xs text-gray-400 mb-2 font-mono">ID：{selectedAbility.code}</div>
              )}
              <div className="space-y-2 text-xs">
                <div>
                  <span className="font-medium text-gray-400">能力属性：</span>
                  <span className="text-gray-600">
                    {selectedAbility.attributes?.length ? selectedAbility.attributes.join("、") : "未配置"}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-gray-400">能力类别：</span>
                  <span className="text-gray-600">
                    {categoryLabels[selectedAbility.category]?.label || selectedAbility.category}
                  </span>
                </div>
                {selectedAbility.description && (
                  <div>
                    <span className="font-medium text-gray-400">描述：</span>
                    <span className="text-gray-600">{selectedAbility.description}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
