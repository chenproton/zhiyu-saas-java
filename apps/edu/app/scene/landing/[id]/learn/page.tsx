"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams, useSearchParams } from "next/navigation"
import {
  ArrowLeft, Clock, BarChart3,
  FileText, ListChecks, BookOpen,
  Info, BrainCircuit, Target, FolderOpen, ClipboardList,
  ExternalLink, Sparkles, X, Lightbulb,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { scenarioApi, taskApi, taskResourceApi, knowledgeApi, abilityApi } from "@/lib/api"
import type {
  Scenario, ScenarioTask, TaskResource,
  KnowledgePoint, AbilityPoint,
} from "@/lib/types"
import { cn } from "@/lib/utils"
import { PlatformFooter } from "@/components/job/student/platform-footer"

const difficultyMap: Record<number, { color: string; label: string; bg: string; border: string }> = {
  1: { color: "#16a34a", label: "入门", bg: "#f0fdf4", border: "#bbf7d0" },
  2: { color: "#ca8a04", label: "初级", bg: "#fefce8", border: "#fde047" },
  3: { color: "#ea580c", label: "中级", bg: "#fff7ed", border: "#fed7aa" },
  4: { color: "#dc2626", label: "高级", bg: "#fef2f2", border: "#fecaca" },
  5: { color: "#7c3aed", label: "专家", bg: "#f5f3ff", border: "#ddd6fe" },
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

const TABS = [
  { value: "basic", label: "任务基础信息", icon: Info },
  { value: "description", label: "任务说明", icon: FileText },
  { value: "knowledge", label: "考查知识点", icon: BrainCircuit },
  { value: "ability", label: "考查能力点", icon: Target },
  { value: "resource", label: "任务资源", icon: FolderOpen },
  { value: "evaluation", label: "任务测评形式", icon: ClipboardList },
]

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

  useEffect(() => {
    if (!id) return
    setLoading(true)
    scenarioApi
      .get(id)
      .then(setScenario)
      .catch(() => setScenario(null))
      .finally(() => setLoading(false))
  }, [id])

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
    if (!activeTask?.evalData) return { methods: [] as string[], weights: {} as Record<string, number> }
    const methods: string[] = activeTask.evalData.evaluationMethods || []
    const weights: Record<string, number> = activeTask.evalData.methodWeights || {}
    return { methods, weights }
  }, [activeTask])

  const dependencyTasks = useMemo(() => {
    if (!activeTask?.dependencyIds?.length) return []
    return activeTask.dependencyIds
      .map((did) => tasks.find((t) => t.id === did))
      .filter(Boolean) as ScenarioTask[]
  }, [activeTask, tasks])

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-[#f8fafc]">
        <header className="bg-white border-b border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.03)] shrink-0 h-16 flex items-center px-6">
          <Skeleton className="h-5 w-48" />
        </header>
        <div className="flex-1 max-w-[1400px] mx-auto px-6 py-6 w-full">
          <div className="flex gap-6">
            <Skeleton className="w-[300px] h-[70vh] rounded-xl shrink-0" />
            <Skeleton className="flex-1 h-[70vh] rounded-xl" />
          </div>
        </div>
        <PlatformFooter />
      </div>
    )
  }

  if (!scenario) {
    return (
      <div className="min-h-screen flex flex-col bg-[#f8fafc]">
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
          <div className="w-20 h-20 mb-5 rounded-3xl bg-slate-50 flex items-center justify-center">
            <BookOpen className="w-10 h-10 opacity-40" />
          </div>
          <div className="text-lg font-semibold text-slate-600">场景不存在</div>
          <Link href="/scene/landing" className="text-blue-600 hover:text-blue-700 mt-2 text-sm font-medium">返回场景列表</Link>
        </div>
        <PlatformFooter />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc]">
      <header className="bg-white border-b border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.03)] shrink-0">
        <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href={`/scene/landing/${id}`}
              className="group flex items-center gap-2 text-sm text-slate-500 hover:text-blue-600 transition-colors"
            >
              <span className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center group-hover:bg-blue-50 transition-colors">
                <ArrowLeft className="w-4 h-4" />
              </span>
              <span className="font-medium truncate max-w-[300px] sm:max-w-[400px] lg:max-w-[500px]">{scenario.name}</span>
            </Link>
          </div>
          <div className="flex items-center gap-4 text-sm text-slate-500 bg-slate-50 px-4 py-1.5 rounded-full border border-slate-100">
            <span className="flex items-center gap-1.5"><ListChecks className="w-3.5 h-3.5 text-blue-500" /> {tasks.length} 个任务</span>
            <span className="w-px h-3 bg-slate-300" />
            <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-blue-500" /> {totalHours} 课时</span>
          </div>
        </div>
      </header>

      <div className="flex-1 flex max-w-[1400px] mx-auto w-full">
        <aside className="flex w-[300px] flex-shrink-0 flex-col border-r border-slate-100 bg-white">
          <div className="border-b border-slate-100 px-5 py-4">
            <div className="flex items-start gap-2">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-blue-500 to-blue-700 text-xs font-bold text-white">
                场
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-sm font-bold text-slate-800">{scenario.name}</h2>
                <span className="mt-1 inline-block rounded text-[11px] px-1.5 py-0.5 bg-blue-50 text-blue-600 font-medium">
                  场景学习
                </span>
              </div>
            </div>
            <div className="mt-2 flex items-center text-xs text-slate-400">
              <span>共 {tasks.length} 个任务 · {totalHours} 课时</span>
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="py-2">
              {tasks.map((task, idx) => {
                const isActive = activeTaskId === task.id
                const taskDiff = difficultyMap[task.difficulty] || difficultyMap[3]

                return (
                  <button
                    key={task.id}
                    onClick={() => setActiveTaskId(task.id)}
                    className={cn(
                      "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors",
                      isActive
                        ? "bg-blue-50/80 text-blue-700"
                        : "text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-[11px] font-bold",
                        isActive
                          ? "bg-gradient-to-br from-blue-500 to-blue-400 text-white shadow-sm"
                          : "bg-slate-100 text-slate-500"
                      )}
                    >
                      {idx + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className={cn("text-[13px] font-semibold truncate", isActive && "text-blue-700")}>
                        {task.name}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-400">
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{task.estimatedHours || 0}h</span>
                        <span
                          className="flex items-center gap-1"
                          style={{ color: taskDiff.color }}
                        >
                          <BarChart3 className="w-3 h-3" />{taskDiff.label}
                        </span>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </ScrollArea>
        </aside>

        <main className="flex flex-1 flex-col overflow-y-auto bg-slate-50/50">
          {!activeTask ? (
            <div className="flex flex-col items-center justify-center flex-1 text-slate-400">
              <div className="w-20 h-20 mb-5 rounded-3xl bg-slate-50 flex items-center justify-center">
                <BookOpen className="w-10 h-10 opacity-40" />
              </div>
              <div className="text-base font-semibold text-slate-600">选择一个任务开始学习</div>
              <div className="text-sm mt-1.5">从左侧任务列表中选择一个任务</div>
            </div>
          ) : (
            <div className="p-6">
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="text-[11px] px-2.5 py-0.5 rounded-full font-medium border"
                  style={{
                    backgroundColor: activeTask.taskType === "assessment" ? "#fef2f2" : "#eff6ff",
                    color: activeTask.taskType === "assessment" ? "#dc2626" : "#2563eb",
                    borderColor: activeTask.taskType === "assessment" ? "#fecaca" : "#bfdbfe",
                  }}
                >
                  {activeTask.taskType === "assessment" ? "考核任务" : "训练任务"}
                </span>
                {activeTask.code && <span className="text-xs text-slate-400">{activeTask.code}</span>}
              </div>
              <h1 className="text-[26px] font-bold text-slate-900 mb-5">{activeTask.name}</h1>

              <div className="flex flex-wrap items-center gap-4 mb-6 text-sm text-slate-500">
                <span className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg border border-slate-200">
                  <Clock className="w-4 h-4 text-blue-500" /> {activeTask.estimatedHours || 0} 课时
                </span>
                <span
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border"
                  style={{
                    backgroundColor: difficultyMap[activeTask.difficulty]?.bg,
                    borderColor: difficultyMap[activeTask.difficulty]?.border,
                    color: difficultyMap[activeTask.difficulty]?.color,
                  }}
                >
                  <BarChart3 className="w-4 h-4" />
                  {difficultyMap[activeTask.difficulty]?.label || `Lv.${activeTask.difficulty}`}
                </span>
                {activeTask.dependencyIds?.length > 0 && (
                  <span className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg border border-slate-200">
                    <ListChecks className="w-4 h-4 text-amber-500" /> 前置依赖 {activeTask.dependencyIds.length} 个任务
                  </span>
                )}
              </div>

              <Tabs defaultValue="basic" className="w-full">
                <TabsList className="mb-6 bg-white border border-slate-200 p-1 rounded-xl shadow-sm">
                  {TABS.map((t) => (
                    <TabsTrigger
                      key={t.value}
                      value={t.value}
                      className="rounded-lg px-4 py-2 text-[13px] data-[state=active]:bg-blue-50 data-[state=active]:text-blue-600 data-[state=active]:shadow-none"
                    >
                      <t.icon className="mr-1.5 h-4 w-4" />
                      {t.label}
                    </TabsTrigger>
                  ))}
                </TabsList>

                <TabsContent value="basic" className="mt-0">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Info className="w-4 h-4 text-[#3b82f6]" />
                        任务基础信息
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <InfoField label="任务类型" value={activeTask.taskType === "assessment" ? "考核" : "训练"} />
                        {activeTask.code && <InfoField label="任务编码" value={activeTask.code} />}
                        <InfoField label="预计课时" value={`${activeTask.estimatedHours || 0} 课时`} />
                        <InfoField label="难度等级" value={`Lv.${activeTask.difficulty} ${difficultyMap[activeTask.difficulty]?.label || ""}`} />
                        <InfoField label="排序序号" value={String(activeTask.sortOrder)} />
                        <InfoField label="关联知识点" value={`${activeTask.knowledgePointIds?.length || 0} 个`} />
                        <InfoField label="关联能力点" value={`${activeTask.abilityPointIds?.length || 0} 个`} />
                        <InfoField label="关联资源" value={`${activeTask.resourceIds?.length || 0} 个`} />
                      </div>

                      {dependencyTasks.length > 0 && (
                        <>
                          <Separator className="my-5" />
                          <div className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
                            <Lightbulb className="w-4 h-4 text-amber-500" />
                            前置依赖任务
                          </div>
                          <div className="space-y-2">
                            {dependencyTasks.map((dt, i) => (
                              <button
                                key={dt.id}
                                onClick={() => setActiveTaskId(dt.id)}
                                className="flex items-center gap-3 w-full text-left p-3 rounded-lg border border-slate-200 bg-slate-50 hover:border-blue-200 hover:bg-blue-50/30 transition-colors"
                              >
                                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-200 text-xs font-bold text-slate-600">
                                  {i + 1}
                                </span>
                                <span className="text-sm font-medium text-slate-700">{dt.name}</span>
                                <span className="text-[11px] text-slate-400 ml-auto">
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

                <TabsContent value="description" className="mt-0">
                  {activeTask.background || activeTask.description || activeTask.detailedDescription ? (
                    <div className="space-y-4">
                      {activeTask.background && (
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                              <FileText className="w-4 h-4 text-blue-500" />
                              任务背景
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="prose prose-sm max-w-none text-slate-600 whitespace-pre-wrap leading-relaxed">
                              {activeTask.background}
                            </div>
                          </CardContent>
                        </Card>
                      )}
                      {(activeTask.detailedDescription || activeTask.description) && (
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                              <FileText className="w-4 h-4 text-violet-500" />
                              任务描述
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="prose prose-sm max-w-none text-slate-600 whitespace-pre-wrap leading-relaxed">
                              {activeTask.detailedDescription || activeTask.description}
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  ) : (
                    <Card>
                      <CardContent className="py-16">
                        <div className="text-center text-slate-400">
                          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-50 flex items-center justify-center">
                            <FileText className="w-8 h-8 opacity-40" />
                          </div>
                          <div className="text-[15px] font-medium text-slate-600">暂无任务说明</div>
                          <div className="text-[13px] mt-1">该任务暂未填写说明信息</div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                <TabsContent value="knowledge" className="mt-0">
                  {taskKnowledgePoints.length > 0 ? (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <BrainCircuit className="w-4 h-4 text-[#3b82f6]" />
                          考查知识点
                          <span className="text-xs font-normal text-slate-400">({taskKnowledgePoints.length} 项)</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {taskKnowledgePoints.map((kp) => (
                            <div
                              key={kp.id}
                              className="flex items-start gap-3 p-3 rounded-lg border border-slate-100 hover:border-blue-200 hover:bg-blue-50/30 transition-all"
                            >
                              <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                                <BrainCircuit className="w-4 h-4 text-blue-500" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <p className="text-sm font-medium text-slate-700">{kp.name}</p>
                                  {kp.code && <span className="text-[10px] font-mono text-slate-400">{kp.code}</span>}
                                </div>
                                {kp.description && (
                                  <p className="text-xs text-slate-500 leading-relaxed">{kp.description}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card>
                      <CardContent className="py-16">
                        <div className="text-center text-slate-400">
                          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-50 flex items-center justify-center">
                            <BrainCircuit className="w-8 h-8 opacity-40" />
                          </div>
                          <div className="text-[15px] font-medium text-slate-600">暂无考查知识点</div>
                          <div className="text-[13px] mt-1">该任务未关联知识点</div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                <TabsContent value="ability" className="mt-0">
                  {taskAbilityPoints.length > 0 ? (
                    <AbilityTab abilityPoints={taskAbilityPoints} />
                  ) : (
                    <Card>
                      <CardContent className="py-16">
                        <div className="text-center text-slate-400">
                          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-50 flex items-center justify-center">
                            <Target className="w-8 h-8 opacity-40" />
                          </div>
                          <div className="text-[15px] font-medium text-slate-600">暂无考查能力点</div>
                          <div className="text-[13px] mt-1">该任务未关联能力点</div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                <TabsContent value="resource" className="mt-0">
                  {taskResources.length > 0 ? (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <FolderOpen className="w-4 h-4 text-[#3b82f6]" />
                          任务资源
                          <span className="text-xs font-normal text-slate-400">({taskResources.length} 项)</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
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
                                className="flex items-start justify-between gap-2 p-3 rounded-lg border border-slate-100 bg-slate-50 hover:border-blue-200 hover:shadow-sm transition-all"
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-semibold text-slate-800 mb-1.5 truncate">{r.name}</div>
                                  <div className="flex items-center gap-2 text-xs">
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${typeColors[r.type] || "bg-slate-100 text-slate-500 border-slate-200"}`}>
                                      {resourceTypeLabels[r.type] || r.type}
                                    </span>
                                    {r.size && <span className="text-slate-400">{r.size}</span>}
                                  </div>
                                </div>
                                {r.url && (
                                  <a
                                    href={r.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="shrink-0 w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-blue-500 hover:border-blue-200 flex items-center justify-center transition-colors"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </a>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card>
                      <CardContent className="py-16">
                        <div className="text-center text-slate-400">
                          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-50 flex items-center justify-center">
                            <FolderOpen className="w-8 h-8 opacity-40" />
                          </div>
                          <div className="text-[15px] font-medium text-slate-600">暂无任务资源</div>
                          <div className="text-[13px] mt-1">该任务暂未关联学习资源</div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                <TabsContent value="evaluation" className="mt-0">
                  {taskEvalMethods.methods.length > 0 ? (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <ClipboardList className="w-4 h-4 text-[#3b82f6]" />
                          任务测评形式
                          <span className="text-xs font-normal text-slate-400">({taskEvalMethods.methods.length} 种)</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div className="flex flex-wrap gap-1.5 mb-4">
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
                                <span className="text-[13px] text-slate-600 w-20 shrink-0">{evalMethodLabels[m] || m}</span>
                                <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div
                                    className="h-full rounded-full transition-all"
                                    style={{
                                      width: `${Math.round(w)}%`,
                                      backgroundColor: methodColorMap[m] || "#94a3b8",
                                    }}
                                  />
                                </div>
                                <span className="text-[13px] font-semibold text-slate-600 w-10 text-right">{Math.round(w)}%</span>
                              </div>
                            )
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card>
                      <CardContent className="py-16">
                        <div className="text-center text-slate-400">
                          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-50 flex items-center justify-center">
                            <ClipboardList className="w-8 h-8 opacity-40" />
                          </div>
                          <div className="text-[15px] font-medium text-slate-600">暂未配置测评形式</div>
                          <div className="text-[13px] mt-1">该任务暂未设置评价方式</div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          )}
        </main>
      </div>

      <PlatformFooter />
    </div>
  )
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 rounded-lg border border-slate-100 bg-slate-50">
      <div className="text-[11px] text-slate-400 mb-1 font-medium">{label}</div>
      <div className="text-sm font-medium text-slate-700">{value}</div>
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
    <div className="space-y-5">
      <Card>
        <CardContent className="p-4">
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-100">
            <div className="flex items-center gap-2 text-blue-800 font-bold mb-2 text-sm">
              <Sparkles className="w-4 h-4" />
              能力模型说明
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              本任务按能力属性拆解，每个属性下关联对应的能力点，帮助学生明确学习目标。
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-4 text-sm text-slate-500">
        <span>共 <strong className="text-blue-600">{groupedByAttribute.length}</strong> 个能力属性</span>
        <span>共 <strong className="text-blue-600">{abilityPoints.length}</strong> 个能力点</span>
      </div>

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
                    className="flex items-start justify-between w-full text-left py-2 px-2 border-b border-slate-50 last:border-b-0 rounded hover:bg-blue-50/30 transition-colors gap-2"
                  >
                    <div className="flex flex-col min-w-0 gap-1">
                      <span className="text-sm text-slate-700 font-medium">{ap.name}</span>
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
              <div className="text-base font-semibold text-slate-800">能力点详情</div>
              <button className="text-slate-400 hover:text-slate-600" onClick={() => setSelectedAbility(null)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-blue-500 to-emerald-500" />
              <div className="text-sm font-semibold text-slate-800 mb-3">{selectedAbility.name}</div>
              {selectedAbility.code && (
                <div className="text-xs text-slate-400 mb-2 font-mono">ID：{selectedAbility.code}</div>
              )}
              <div className="space-y-2 text-xs">
                <div>
                  <span className="font-medium text-slate-400">能力属性：</span>
                  <span className="text-slate-600">
                    {selectedAbility.attributes?.length ? selectedAbility.attributes.join("、") : "未配置"}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-slate-400">能力类别：</span>
                  <span className="text-slate-600">
                    {categoryLabels[selectedAbility.category]?.label || selectedAbility.category}
                  </span>
                </div>
                {selectedAbility.description && (
                  <div>
                    <span className="font-medium text-slate-400">描述：</span>
                    <span className="text-slate-600">{selectedAbility.description}</span>
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
