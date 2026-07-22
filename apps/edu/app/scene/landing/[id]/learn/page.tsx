"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import { useParams, useSearchParams } from "next/navigation"
import Link from "next/link"

import {
  BookOpen,
  FileText,
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
  Download,
  Eye,
  Layers,
  PanelLeftClose,
  PanelLeftOpen,
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
import { ResourcePreviewModal } from "@/components/shared/resource-preview-modal"

/* ---------- constants ---------- */

const difficultyMap: Record<number, { color: string; label: string; bg: string }> = {
  1: { color: "#16a34a", label: "入门", bg: "#f0fdf4" },
  2: { color: "#ca8a04", label: "初级", bg: "#fefce8" },
  3: { color: "#ea580c", label: "中级", bg: "#fff7ed" },
  4: { color: "#dc2626", label: "高级", bg: "#fef2f2" },
  5: { color: "#7c3aed", label: "专家", bg: "#f5f3ff" },
}

const resourceTypeLabels: Record<string, string> = {
  document: "文档", video: "视频", link: "链接", file: "文件",
  spreadsheet: "表格", presentation: "演示", image: "图片", audio: "音频", pdf: "PDF",
}

const resourceTypeIcons: Record<string, string> = {
  document: "text-[#3b82f6] bg-blue-50", video: "text-[#f59e0b] bg-amber-50",
  link: "text-[#8b5cf6] bg-purple-50", file: "text-[#10b981] bg-emerald-50",
  spreadsheet: "text-[#16a34a] bg-green-50", presentation: "text-[#f97316] bg-orange-50",
  image: "text-[#ec4899] bg-pink-50", audio: "text-[#06b6d4] bg-cyan-50",
  pdf: "text-[#ef4444] bg-red-50",
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [previewTab, setPreviewTab] = useState<"preview" | "manual" | "resources">("preview")

  const [resourceMap, setResourceMap] = useState<Map<string, TaskResource>>(new Map())
  const [knowledgeMap, setKnowledgeMap] = useState<Map<string, KnowledgePoint>>(new Map())
  const [abilityMap, setAbilityMap] = useState<Map<string, AbilityPoint>>(new Map())
  const [showResources, setShowResources] = useState(false)
  const [previewResource, setPreviewResource] = useState<TaskResource | null>(null)

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
        <header className="bg-white border-b border-gray-200 shrink-0 h-16 flex items-center px-6">
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
          <div className="relative w-24 h-24 mb-6">
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-blue-100 to-indigo-100 opacity-60" />
            <div className="absolute inset-0 flex items-center justify-center">
              <BookOpen className="w-12 h-12 text-blue-300/60" />
            </div>
          </div>
          <div className="text-lg font-semibold text-gray-600">场景不存在</div>
          <Link href="/scene/landing" className="text-blue-600 hover:text-blue-700 mt-2 text-sm font-medium transition-colors">返回场景列表</Link>
        </div>
        <PlatformFooter />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)" }}>
      {/* ---------- header ---------- */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-200/60 shrink-0 sticky top-0 z-30">
        <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href={`/scene/landing/${id}`}
              className="group flex items-center gap-2.5 text-sm text-gray-500 hover:text-blue-600 transition-all duration-200"
            >
              <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-gray-100 to-gray-50 border border-gray-200/60 flex items-center justify-center group-hover:from-blue-50 group-hover:to-blue-100/50 group-hover:border-blue-200 group-hover:shadow-sm transition-all duration-200">
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform duration-200" />
              </span>
              <span className="font-semibold truncate max-w-[360px] lg:max-w-[520px] text-gray-700 group-hover:text-blue-600 transition-colors">{scenario.name}</span>
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-xs font-medium text-gray-500 bg-white px-3 py-1.5 rounded-full border border-gray-200/80 shadow-sm">
              <ListChecks className="w-3.5 h-3.5 text-blue-500" /> {tasks.length} 个任务
            </span>
            <span className="flex items-center gap-1.5 text-xs font-medium text-gray-500 bg-white px-3 py-1.5 rounded-full border border-gray-200/80 shadow-sm">
              <Clock className="w-3.5 h-3.5 text-blue-500" /> {totalHours} 课时
            </span>
          </div>
        </div>
      </header>

      {/* ---------- body ---------- */}
      <div className="flex-1 flex max-w-[1400px] mx-auto w-full overflow-hidden">
        {/* ---------- left sidebar: task list ---------- */}
        <aside className={cn(
          "flex flex-shrink-0 flex-col border-r border-gray-200/60 bg-white/80 backdrop-blur-sm transition-all duration-300",
          sidebarCollapsed ? "w-[60px]" : "w-[300px]"
        )}>
          {/* sidebar header */}
          <div className="relative border-b border-gray-100 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />
            <div className={cn("flex items-center", sidebarCollapsed ? "flex-col gap-2 px-2 py-3" : "px-5 py-3")}>
              {sidebarCollapsed ? (
                <>
                  <span className="text-[10px] text-gray-400"><Layers className="w-3 h-3 inline" />{tasks.length}</span>
                  <span className="text-[10px] text-gray-400"><Clock className="w-3 h-3 inline" />{totalHours}</span>
                </>
              ) : (
                <div className="flex-1 flex items-center gap-3">
                  <span className="flex items-center gap-1 text-xs text-gray-400"><Layers className="w-3 h-3" />{tasks.length} 个任务</span>
                  <span className="flex items-center gap-1 text-xs text-gray-400"><Clock className="w-3 h-3" />{totalHours} 课时</span>
                </div>
              )}
              <button
                onClick={() => setSidebarCollapsed((v) => !v)}
                className={cn(
                  "flex items-center justify-center rounded-lg hover:bg-gray-100 transition-all duration-200",
                  sidebarCollapsed ? "w-9 h-9 text-gray-500 hover:text-blue-600" : "w-8 h-8 ml-auto"
                )}
                title={sidebarCollapsed ? "展开任务列表" : "折叠任务列表"}
              >
                {sidebarCollapsed
                  ? <PanelLeftOpen className="h-5 w-5" />
                  : <PanelLeftClose className="h-4 w-4" />
                }
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
                          "flex h-9 w-9 items-center justify-center rounded-lg text-[11px] font-bold transition-all duration-200",
                          isActive
                            ? "bg-gradient-to-br from-blue-500 to-indigo-500 text-white shadow-md shadow-blue-500/20"
                            : "bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-600"
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
                      "relative flex w-full items-center gap-3 px-4 py-3 text-left transition-all duration-200 group",
                      isActive
                        ? "bg-gradient-to-r from-blue-50 via-blue-50/80 to-transparent"
                        : "hover:bg-gray-50/80"
                    )}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-2 bottom-2 w-[3px] bg-gradient-to-b from-blue-500 to-indigo-500 rounded-r-full" />
                    )}
                    <div
                      className={cn(
                        "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-[11px] font-bold transition-all duration-200",
                        isActive
                          ? "bg-gradient-to-br from-blue-500 to-indigo-500 text-white shadow-md shadow-blue-500/20"
                          : "bg-gray-100 text-gray-500 group-hover:bg-gray-200 group-hover:text-gray-600"
                      )}
                    >
                      {idx + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className={cn(
                        "text-[13px] font-semibold truncate transition-colors duration-200",
                        isActive ? "text-blue-700" : "text-gray-700 group-hover:text-gray-900"
                      )}>
                        {task.name}
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[10px] text-gray-400 flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5" />{task.estimatedHours || 0}h
                        </span>
                        <span className="text-[10px] flex items-center gap-1" style={{ color: diff.color }}>
                          <BarChart3 className="h-2.5 w-2.5" />{diff.label}
                        </span>
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                          style={{
                            backgroundColor: task.taskType === "assessment" ? "#fef2f2" : "#eff6ff",
                            color: task.taskType === "assessment" ? "#dc2626" : "#2563eb",
                          }}
                        >
                          {task.taskType === "assessment" ? "考核" : "训练"}
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
        <main className="flex flex-1 flex-col overflow-y-auto" style={{ background: "linear-gradient(180deg, #f9fafb 0%, #f3f4f6 100%)" }}>
          {!activeTask ? (
            <div className="flex flex-col items-center justify-center flex-1">
              <div className="relative w-24 h-24 mb-5">
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-blue-100 to-indigo-100 opacity-50 animate-pulse" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <BookOpen className="w-12 h-12 text-blue-300/50" />
                </div>
              </div>
              <p className="text-sm font-medium text-gray-400">选择一个任务开始学习</p>
              <p className="text-xs text-gray-300 mt-1">从左侧任务列表中点击任务</p>
            </div>
          ) : (
            <>
              {/* collapsed layout: left 3 cards + right sticky tab card */}
              <div className="flex flex-1 gap-4 p-4 overflow-hidden">
                {/* left column: 3 cards */}
                <div className="flex-1 overflow-y-auto space-y-4">
                  {/* 任务背景 */}
                  <Card className="shadow-sm border-gray-200/60 rounded-2xl overflow-hidden">
                    <CardHeader className="bg-gradient-to-r from-gray-50 to-white border-b border-gray-100">
                      <CardTitle className="text-base flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
                          <BookOpen className="h-4 w-4 text-blue-600" />
                        </div>
                        任务背景
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                        <StatCard icon={<ListChecks className="h-4 w-4" />} label="任务类型" value={activeTask.taskType === "assessment" ? "考核" : "训练"} color={activeTask.taskType === "assessment" ? "#ef4444" : "#3b82f6"} />
                        <StatCard icon={<Clock className="h-4 w-4" />} label="预计课时" value={`${activeTask.estimatedHours || 0} 课时`} color="#3b82f6" />
                        <StatCard icon={<BarChart3 className="h-4 w-4" />} label="难度等级" value={difficultyMap[activeTask.difficulty]?.label || `Lv.${activeTask.difficulty}`} color={difficultyMap[activeTask.difficulty]?.color || "#3b82f6"} />
                        <StatCard icon={<Layers className="h-4 w-4" />} label="排序序号" value={`第 ${activeTask.sortOrder} 位`} color="#8b5cf6" />
                      </div>
                      {activeTask.background && (
                        <div className="prose prose-sm max-w-none text-gray-600 whitespace-pre-line leading-relaxed">
                          {activeTask.background}
                        </div>
                      )}
                      {!activeTask.background && <p className="text-xs text-gray-400">暂无背景说明</p>}
                    </CardContent>
                  </Card>

                  {/* 任务说明书 */}
                  <Card className="shadow-sm border-gray-200/60 rounded-2xl overflow-hidden">
                    <CardHeader className="bg-gradient-to-r from-violet-50/80 to-white border-b border-violet-100/60">
                      <CardTitle className="text-base flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center shadow-sm">
                          <FileText className="h-4 w-4 text-white" />
                        </div>
                        任务说明书
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                      {(activeTask.detailedDescription || activeTask.description || activeTask.descriptionPdf) ? (
                        <div className="space-y-3">
                          {(activeTask.detailedDescription || activeTask.description) && (
                            <div className="prose prose-sm max-w-none text-gray-600 whitespace-pre-line leading-relaxed">
                              {activeTask.detailedDescription || activeTask.description}
                            </div>
                          )}
                          {activeTask.descriptionPdf && (
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" asChild>
                                <a href={activeTask.descriptionPdf} target="_blank" rel="noopener noreferrer">
                                  <Eye className="h-4 w-4 mr-1" />预览 PDF
                                </a>
                              </Button>
                              <Button size="sm" asChild>
                                <a href={activeTask.descriptionPdf} download target="_blank" rel="noreferrer">
                                  <Download className="h-4 w-4 mr-1" />下载 PDF
                                </a>
                              </Button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400">暂无任务说明书</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* 任务测评形式 */}
                  <Card className="shadow-sm border-gray-200/60 rounded-2xl overflow-hidden">
                    <CardHeader className="bg-gradient-to-r from-blue-50/80 to-white border-b border-blue-100/60">
                      <CardTitle className="text-base flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
                          <ClipboardList className="h-4 w-4 text-blue-600" />
                        </div>
                        任务测评形式
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                      {taskEvalMethods.methods.length > 0 ? (
                        <div className="space-y-3">
                          {taskEvalMethods.methods.map((m) => {
                            const w = taskEvalMethods.weights[m] || 0
                            const color = methodColorMap[m] || "#94a3b8"
                            return (
                              <div key={m} className="flex items-center gap-3">
                                <span className="text-xs font-medium px-2 py-1 rounded-lg shrink-0 min-w-[64px] text-center" style={{ backgroundColor: color + "15", color, border: `1px solid ${color}30` }}>
                                  {evalMethodLabels[m] || m}
                                </span>
                                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                  <div className="h-full rounded-full" style={{ width: `${Math.max(Math.round(w), 2)}%`, background: `linear-gradient(90deg, ${color}dd, ${color})` }} />
                                </div>
                                <span className="text-xs font-bold w-10 text-right" style={{ color }}>{Math.round(w)}%</span>
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400">该任务暂未设置评价方式</p>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* right column: sticky knowledge/ability/resource card */}
                {sidebarCollapsed && (
                <div className="w-[360px] shrink-0">
                  <Card className="shadow-sm border-gray-200/60 rounded-2xl overflow-hidden sticky top-4">
                    <Tabs defaultValue="collapsed-knowledge" className="w-full">
                      <CardHeader className="border-b border-gray-100 p-2">
                        <TabsList className="bg-transparent p-0 h-auto gap-1 w-full">
                          <TabsTrigger value="collapsed-knowledge" className="flex-1 rounded-lg px-3 py-1.5 text-xs data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-50 data-[state=active]:to-indigo-50 data-[state=active]:text-blue-600">
                            <BrainCircuit className="mr-1 h-3.5 w-3.5" />知识点
                          </TabsTrigger>
                          <TabsTrigger value="collapsed-ability" className="flex-1 rounded-lg px-3 py-1.5 text-xs data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-50 data-[state=active]:to-indigo-50 data-[state=active]:text-blue-600">
                            <Target className="mr-1 h-3.5 w-3.5" />能力点
                          </TabsTrigger>
                          <TabsTrigger value="collapsed-resource" className="flex-1 rounded-lg px-3 py-1.5 text-xs data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-50 data-[state=active]:to-indigo-50 data-[state=active]:text-blue-600">
                            <FolderOpen className="mr-1 h-3.5 w-3.5" />资源
                          </TabsTrigger>
                        </TabsList>
                      </CardHeader>
                      <CardContent className="max-h-[calc(100vh-16rem)] overflow-y-auto p-3">
                        <TabsContent value="collapsed-knowledge" className="mt-0 space-y-2">
                          {taskKnowledgePoints.length > 0 ? taskKnowledgePoints.map((kp, i) => (
                            <div key={kp.id} className="flex items-start gap-3 p-2.5 rounded-xl border border-gray-100 hover:border-blue-200 hover:bg-blue-50/30 transition-all cursor-pointer">
                              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-[10px] font-bold text-white shrink-0">{i + 1}</div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-700">{kp.name}</p>
                                {kp.description && <p className="text-xs text-gray-400 line-clamp-2 mt-0.5">{kp.description}</p>}
                              </div>
                            </div>
                          )) : <p className="text-xs text-gray-400 text-center py-8">暂无知识点</p>}
                        </TabsContent>
                        <TabsContent value="collapsed-ability" className="mt-0 space-y-2">
                          {taskAbilityPoints.length > 0 ? taskAbilityPoints.map((ap, i) => {
                            const cat = ({ knowledge: { label: "知识", color: "#2563eb" }, skill: { label: "技能", color: "#16a34a" }, quality: { label: "素养", color: "#7c3aed" } } as any)[ap.category] || { label: ap.category, color: "#94a3b8" }
                            return (
                              <div key={ap.id} className="flex items-start gap-3 p-2.5 rounded-xl border border-gray-100 hover:border-blue-200 hover:bg-blue-50/30 transition-all cursor-pointer">
                                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-[10px] font-bold text-white shrink-0">{i + 1}</div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-700">{ap.name}</p>
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full mt-0.5" style={{ backgroundColor: cat.color + "15", color: cat.color }}>{cat.label}</span>
                                </div>
                              </div>
                            )
                          }) : <p className="text-xs text-gray-400 text-center py-8">暂无能力点</p>}
                        </TabsContent>
                        <TabsContent value="collapsed-resource" className="mt-0 space-y-2">
                          {taskResources.length > 0 ? taskResources.map((r) => (
                            <div key={r.id} className="flex items-start gap-3 p-2.5 rounded-xl border border-gray-100 hover:border-blue-200 hover:bg-blue-50/30 transition-all cursor-pointer" onClick={() => setPreviewResource(r)}>
                              <div className={`w-7 h-7 rounded-lg shrink-0 flex items-center justify-center ${resourceTypeIcons[r.type] || "text-gray-400 bg-gray-50"}`}>
                                <FileText className="h-3.5 w-3.5" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-700 truncate">{r.name}</p>
                                <p className="text-[11px] text-gray-400">{resourceTypeLabels[r.type] || r.type}{r.size ? ` · ${r.size}` : ""}</p>
                              </div>
                            </div>
                          )) : <p className="text-xs text-gray-400 text-center py-8">暂无资源</p>}
                        </TabsContent>
                      </CardContent>
                    </Tabs>
                  </Card>
                </div>
                )}
              </div>
            </>
          )}
        </main>
      </div>

      <ResourcePreviewModal
        resource={previewResource}
        open={!!previewResource}
        onOpenChange={(open) => { if (!open) setPreviewResource(null) }}
      />

      <PlatformFooter />
    </div>
  )
}

/* ---------- sub components ---------- */

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-50 opacity-60" />
        <div className="absolute inset-0 flex items-center justify-center text-gray-300">
          {icon}
        </div>
      </div>
      <p className="text-sm text-gray-400 font-medium">{text}</p>
    </div>
  )
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="relative p-4 rounded-xl border border-gray-100 bg-white hover:border-gray-200 hover:shadow-md transition-all duration-200 group">
      <div className="absolute top-0 left-0 right-0 h-[2px] rounded-t-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200" style={{ backgroundColor: color }} />
      <div className="flex items-center gap-2 mb-2" style={{ color }}>
        {icon}
      </div>
      <p className="text-[11px] text-gray-400 font-medium mb-0.5">{label}</p>
      <p className="text-sm font-bold text-gray-800">{value}</p>
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

  const categoryLabels: Record<string, { color: string; label: string; bg: string }> = {
    knowledge: { color: "#2563eb", label: "知识", bg: "#eff6ff" },
    skill: { color: "#16a34a", label: "技能", bg: "#f0fdf4" },
    quality: { color: "#7c3aed", label: "素养", bg: "#f5f3ff" },
  }

  return (
    <div className="space-y-5">
      <Card className="shadow-sm border-gray-200/60 rounded-2xl overflow-hidden">
        <CardContent className="p-5">
          <div
            className="rounded-xl p-5 relative overflow-hidden"
            style={{ background: "linear-gradient(135deg, #eff6ff 0%, #eef2ff 50%, #faf5ff 100%)" }}
          >
            <div className="absolute top-0 right-0 w-32 h-32 opacity-[0.06]">
              <Sparkles className="w-full h-full" />
            </div>
            <div className="flex items-center gap-2 text-blue-800 font-bold mb-2 text-sm relative z-10">
              <Sparkles className="w-4 h-4" />
              能力模型
            </div>
            <p className="text-xs text-gray-600 leading-relaxed relative z-10">
              本任务按能力属性拆解，共
              <strong className="text-blue-600 mx-0.5">{groupedByAttribute.length}</strong>
              个能力属性、
              <strong className="text-blue-600 mx-0.5">{abilityPoints.length}</strong>
              个能力点
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {groupedByAttribute.map(({ attr, items }) => (
          <Card key={attr} className="shadow-sm border-gray-200/60 rounded-2xl overflow-hidden hover:shadow-md transition-all duration-200">
            <div
              className="px-4 py-3.5 font-semibold text-sm flex items-center gap-2 border-b"
              style={{
                background: "linear-gradient(135deg, #eff6ff, #eef2ff)",
                color: "#2563eb",
                borderColor: "#bfdbfe",
              }}
            >
              <Target className="w-4 h-4" />
              {attr}
              <span className="ml-auto text-[11px] font-normal opacity-60">{items.length} 项</span>
            </div>
            <CardContent className="p-2 max-h-[280px] overflow-y-auto">
              {items.map((ap) => {
                const cat = categoryLabels[ap.category] || { color: "#94a3b8", label: ap.category, bg: "#f8fafc" }
                return (
                  <button
                    key={ap.id}
                    onClick={() => setSelectedAbility(ap)}
                    className="flex items-center justify-between w-full text-left p-2.5 rounded-lg hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-transparent transition-all duration-200 gap-2 group"
                  >
                    <div className="flex flex-col min-w-0 gap-1">
                      <span className="text-[13px] font-semibold text-gray-700 group-hover:text-blue-600 transition-colors">{ap.name}</span>
                      <span
                        className="text-[10px] px-2 py-0.5 rounded-full w-fit font-medium border"
                        style={{
                          backgroundColor: cat.bg,
                          color: cat.color,
                          borderColor: cat.color + "30",
                        }}
                      >
                        {cat.label}
                      </span>
                    </div>
                    <span className="shrink-0 text-gray-300 group-hover:text-blue-400 transition-colors">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </span>
                  </button>
                )
              })}
            </CardContent>
          </Card>
        ))}
      </div>

      {selectedAbility && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(15,23,42,0.5)", backdropFilter: "blur(4px)" }}
          onClick={() => setSelectedAbility(null)}
        >
          <div
            className="bg-white rounded-2xl w-[540px] max-w-[92vw] shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shadow-sm">
                  <Target className="w-4 h-4 text-white" />
                </div>
                <span className="font-semibold text-gray-800">能力点详情</span>
              </div>
              <button
                className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-all duration-200"
                onClick={() => setSelectedAbility(null)}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6">
              <div className="relative rounded-xl p-5 overflow-hidden border border-gray-100" style={{ background: "linear-gradient(135deg, #f8fafc, #fff)" }}>
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />
                <h3 className="text-base font-bold text-gray-800 mb-4">{selectedAbility.name}</h3>
                <div className="space-y-3 text-sm">
                  {selectedAbility.code && (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 shrink-0 w-16">编码</span>
                      <span className="font-mono text-xs text-gray-500 bg-gray-50 rounded-lg px-2 py-0.5">{selectedAbility.code}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 shrink-0 w-16">属性</span>
                    <span className="text-gray-700 font-medium">
                      {selectedAbility.attributes?.length ? selectedAbility.attributes.join("、") : "未配置"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 shrink-0 w-16">类别</span>
                    <span
                      className="px-2 py-0.5 rounded-full text-xs font-medium"
                      style={{
                        backgroundColor: (categoryLabels[selectedAbility.category] || categoryLabels.knowledge).bg,
                        color: (categoryLabels[selectedAbility.category] || categoryLabels.knowledge).color,
                      }}
                    >
                      {(categoryLabels[selectedAbility.category] || categoryLabels.knowledge).label}
                    </span>
                  </div>
                  {selectedAbility.description && (
                    <div className="flex gap-2">
                      <span className="text-gray-400 shrink-0 w-16">描述</span>
                      <span className="text-gray-600 leading-relaxed">{selectedAbility.description}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
