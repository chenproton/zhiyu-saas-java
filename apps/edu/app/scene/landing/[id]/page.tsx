"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import {
  ArrowLeft, PlayCircle, ListChecks, FolderOpen,
  Lightbulb, Target, GitBranch, Layers, Clock,
  BarChart3, Calendar, BookOpen,
  Users, Eye, Share2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  scenarioApi,
  taskApi,
  taskResourceApi,
  knowledgeApi,
  abilityApi,
} from "@/lib/api"
import type {
  Scenario,
  ScenarioTask,
  TaskResource,
  KnowledgePoint,
  AbilityPoint,
} from "@/lib/types"
import { PlatformFooter } from "@/components/job/student/platform-footer"
import { SceneKnowledgeGraph } from "@/components/scene/student/knowledge-graph"

const TABS = [
  { value: "tasks", label: "任务概览", icon: ListChecks },
  { value: "resources", label: "资源中心", icon: FolderOpen },
  { value: "abilities", label: "能力模型", icon: Lightbulb },
  { value: "evaluation", label: "评价标准", icon: Target },
  { value: "knowledge", label: "知识图谱", icon: GitBranch },
]

const coverGradients = [
  "linear-gradient(135deg,#667eea,#764ba2)",
  "linear-gradient(135deg,#f093fb,#f5576c)",
  "linear-gradient(135deg,#4facfe,#00f2fe)",
  "linear-gradient(135deg,#fa709a,#fee140)",
  "linear-gradient(135deg,#30cfd0,#330867)",
]

const difficultyMap: Record<number, { color: string; label: string }> = {
  1: { color: "#22c55e", label: "入门" },
  2: { color: "#eab308", label: "初级" },
  3: { color: "#f97316", label: "中级" },
  4: { color: "#ef4444", label: "高级" },
  5: { color: "#8b5cf6", label: "专家" },
}

const taskTypeLabels: Record<string, string> = {
  assessment: "考核",
  training: "训练",
}

function formatDate(dateStr?: string) {
  if (!dateStr) return "-"
  return dateStr.split("T")[0] || dateStr.split(" ")[0] || dateStr
}

export default function SceneDetailPage() {
  const params = useParams()
  const id = params.id as string
  const tabsRef = useRef<HTMLDivElement>(null)

  const [scenario, setScenario] = useState<Scenario | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("tasks")

  const [tasks, setTasks] = useState<ScenarioTask[]>([])
  const [allResourceMap, setAllResourceMap] = useState<Map<string, TaskResource>>(new Map())
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
        const taskList = res.items || []
        setTasks(taskList)
      })
      .catch(() => setTasks([]))

    taskResourceApi
      .listResources({ limit: 10000 })
      .then((res) => {
        const rMap = new Map<string, TaskResource>()
        ;(res.items || []).forEach((r) => rMap.set(r.id, r))
        setAllResourceMap(rMap)
      })
      .catch(() => setAllResourceMap(new Map()))

    Promise.all([
      knowledgeApi.list({ limit: 1000 }).catch(() => ({ items: [], total: 0 })),
      abilityApi.list({ limit: 1000 }).catch(() => ({ items: [], total: 0 })),
    ]).then(([kRes, aRes]) => {
      const kMap = new Map<string, KnowledgePoint>()
      ;(kRes.items || []).forEach((k) => kMap.set(k.id, k))
      setKnowledgeMap(kMap)
      const aMap = new Map<string, AbilityPoint>()
      ;(aRes.items || []).forEach((a) => aMap.set(a.id, a))
      setAbilityMap(aMap)
    }).catch(() => {})
  }, [id, scenario])

  const assessmentHours = useMemo(() => tasks.filter((t) => t.taskType === "assessment").reduce((s, t) => s + (t.estimatedHours || 0), 0), [tasks])
  const trainingHours = useMemo(() => tasks.filter((t) => t.taskType === "training").reduce((s, t) => s + (t.estimatedHours || 0), 0), [tasks])
  const totalHours = assessmentHours + trainingHours
  const totalResources = useMemo(() => {
    let count = 0
    tasks.forEach((t) => { count += (t.resourceIds || []).length })
    return count
  }, [tasks])
  const uniqueAbilityIds = useMemo(() => {
    const ids = new Set<string>()
    tasks.forEach((t) => t.abilityPointIds?.forEach((aid) => ids.add(aid)))
    return ids
  }, [tasks])
  const uniqueKnowledgeIds = useMemo(() => {
    const ids = new Set<string>()
    tasks.forEach((t) => t.knowledgePointIds?.forEach((kid) => ids.add(kid)))
    return ids
  }, [tasks])
  const totalEvalConfigs = useMemo(() => {
    let count = 0
    tasks.forEach((t) => {
      if (t.evalData?.evaluationMethods) {
        count += (t.evalData.evaluationMethods as string[]).length
      }
    })
    return count
  }, [tasks])

  function getTaskResources(task: ScenarioTask): TaskResource[] {
    return (task.resourceIds || []).map((id) => allResourceMap.get(id)).filter(Boolean) as TaskResource[]
  }

  const diff = difficultyMap[scenario?.difficulty ?? 3] || difficultyMap[3]
  const industryName = scenario?.industryNames?.[0] || (scenario?.industryIds?.length ? "已关联" : "未分类")

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-[#f8fafc]">
        <Skeleton className="h-[320px] w-full" />
        <div className="max-w-[1400px] mx-auto px-6 py-6 w-full flex-1">
          <Skeleton className="h-[500px] w-full rounded-xl" />
        </div>
        <PlatformFooter />
      </div>
    )
  }

  if (!scenario) {
    return (
      <div className="min-h-screen flex flex-col bg-[#f8fafc]">
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
          <div className="w-20 h-20 mb-5 rounded-3xl bg-slate-100 flex items-center justify-center">
            <Layers className="w-10 h-10 opacity-40" />
          </div>
          <div className="text-lg font-semibold text-slate-600">场景不存在或暂未公开</div>
          <Link href="/scene/landing" className="text-blue-600 hover:text-blue-700 mt-3 text-sm font-medium">返回场景列表</Link>
        </div>
        <PlatformFooter />
      </div>
    )
  }

  const coverStyle = scenario.coverImage
    ? { backgroundImage: `url('${scenario.coverImage}')` }
    : { background: coverGradients[0] }

  const renderTabContent = () => {
    switch (activeTab) {
      case "tasks":
        return (
          <div>
            {tasks.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-50 flex items-center justify-center">
                  <ListChecks className="w-8 h-8 opacity-40" />
                </div>
                <div className="text-[15px] font-medium text-slate-600">暂无任务</div>
                <div className="text-[13px] mt-1">该场景暂未配置任务</div>
              </div>
            ) : (
              <div className="space-y-3">
                {tasks.map((task, idx) => {
                  const taskRes = getTaskResources(task)
                  const taskAbs = task.abilityPointIds?.length || 0
                  const taskKs = task.knowledgePointIds?.length || 0
                  return (
                    <div key={task.id} className="group bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:border-blue-200 transition-all">
                      <div className="flex items-center gap-4 p-5">
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-blue-400 text-white flex items-center justify-center text-sm font-bold shrink-0 shadow-lg shadow-blue-500/25">
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5">
                            <div className="text-[15px] font-semibold text-slate-800 truncate">{task.name}</div>
                            <span className="text-[11px] px-2.5 py-0.5 rounded-full font-medium shrink-0 border"
                              style={{
                                backgroundColor: task.taskType === "assessment" ? "#fef2f2" : "#eff6ff",
                                color: task.taskType === "assessment" ? "#dc2626" : "#2563eb",
                                borderColor: task.taskType === "assessment" ? "#fecaca" : "#bfdbfe",
                              }}
                            >
                              {taskTypeLabels[task.taskType] || task.taskType}
                            </span>
                            {task.code && <span className="text-[11px] text-slate-400 shrink-0">{task.code}</span>}
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                            <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{task.estimatedHours || 0} 课时</span>
                            <span className="flex items-center gap-1"><BarChart3 className="w-3.5 h-3.5" />Lv.{task.difficulty}</span>
                            {taskRes.length > 0 && <span className="flex items-center gap-1"><FolderOpen className="w-3.5 h-3.5" />{taskRes.length} 个资源</span>}
                            {taskAbs > 0 && <span className="flex items-center gap-1"><Lightbulb className="w-3.5 h-3.5" />{taskAbs} 个能力点</span>}
                            {taskKs > 0 && <span className="flex items-center gap-1"><GitBranch className="w-3.5 h-3.5" />{taskKs} 个知识点</span>}
                          </div>
                          {(task.description || task.detailedDescription) && (
                            <p className="text-xs text-slate-400 mt-2 line-clamp-2 leading-relaxed">
                              {task.detailedDescription || task.description}
                            </p>
                          )}
                        </div>
                        <Link href={`/scene/landing/${id}/learn?task=${task.id}`} className="shrink-0">
                          <Button size="sm" className="rounded-lg h-9 px-4 text-xs bg-gradient-to-r from-blue-500 to-blue-400 hover:from-blue-600 hover:to-blue-500 text-white shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30 hover:-translate-y-0.5 transition-all">
                            <PlayCircle className="w-3.5 h-3.5 mr-1" /> 开始任务
                          </Button>
                        </Link>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )

      case "resources":
        return (
          <div>
            <div className="text-sm text-slate-500 mb-4">
              共 <strong className="text-blue-600">{totalResources}</strong> 个资源
            </div>
            {totalResources === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-50 flex items-center justify-center">
                  <FolderOpen className="w-8 h-8 opacity-40" />
                </div>
                <div className="text-[15px] font-medium text-slate-600">暂无关联资源</div>
                <div className="text-[13px] mt-1">该场景暂未配置学习资源</div>
              </div>
            ) : (
              <div className="space-y-5">
                {tasks.map((task) => {
                  const resources = getTaskResources(task)
                  if (resources.length === 0) return null
                  return (
                    <div key={task.id}>
                      <div className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-blue-500" />
                        {task.name}
                        <span className="text-xs text-slate-400 font-normal">({resources.length})</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {resources.map((r) => {
                          const typeColors: Record<string, string> = {
                            document: "bg-blue-50 text-blue-600 border-blue-100",
                            video: "bg-amber-50 text-amber-600 border-amber-100",
                            link: "bg-purple-50 text-purple-600 border-purple-100",
                            file: "bg-emerald-50 text-emerald-600 border-emerald-100",
                          }
                          return (
                            <div key={r.id} className="group bg-slate-50 rounded-xl p-3.5 border border-slate-100 hover:border-blue-200 hover:shadow-md hover:-translate-y-0.5 transition-all">
                              <div className="text-sm font-semibold text-slate-800 mb-1.5 truncate">{r.name}</div>
                              <div className="flex items-center gap-2 text-xs text-slate-400">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${typeColors[r.type] || "bg-slate-100 text-slate-500 border-slate-200"}`}>{r.type}</span>
                                {r.size && <span>{r.size}</span>}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )

      case "abilities":
        return (
          <div>
            <div className="text-sm text-slate-500 mb-4">
              共 <strong className="text-blue-600">{uniqueAbilityIds.size}</strong> 个能力点
            </div>
            {uniqueAbilityIds.size === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-50 flex items-center justify-center">
                  <Lightbulb className="w-8 h-8 opacity-40" />
                </div>
                <div className="text-[15px] font-medium text-slate-600">暂无考查能力点</div>
                <div className="text-[13px] mt-1">该场景暂未关联能力点</div>
              </div>
            ) : (
              <div className="space-y-6">
                {tasks.filter((t) => t.abilityPointIds?.length > 0).map((task) => (
                  <div key={task.id}>
                    <div className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                      <Target className="w-4 h-4 text-violet-500" />
                      {task.name}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {task.abilityPointIds?.map((aid) => {
                        const ap = abilityMap.get(aid)
                        const catConfig: Record<string, { label: string; classes: string; border: string }> = {
                          knowledge: { label: "知识", classes: "text-blue-600 bg-blue-50", border: "border-blue-100" },
                          skill: { label: "技能", classes: "text-amber-600 bg-amber-50", border: "border-amber-100" },
                          quality: { label: "素养", classes: "text-purple-600 bg-purple-50", border: "border-purple-100" },
                        }
                        const cfg = catConfig[ap?.category || ""] || { label: "", classes: "text-slate-500 bg-slate-50", border: "border-slate-100" }
                        return (
                          <div key={aid} className={`bg-white border ${cfg.border} rounded-xl p-3.5 hover:shadow-md hover:-translate-y-0.5 transition-all`}>
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-semibold text-slate-800 mb-1">{ap?.name || "能力点"}</div>
                                {ap?.description && <div className="text-[11px] text-slate-400 line-clamp-1">{ap.description}</div>}
                              </div>
                              {cfg.label && (
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${cfg.classes}`}>
                                  {cfg.label}
                                </span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )

      case "evaluation":
        return (
          <div>
            <div className="text-sm text-slate-500 mb-4">
              共 <strong className="text-blue-600">{totalEvalConfigs}</strong> 个评价配置
            </div>
            {totalEvalConfigs === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-50 flex items-center justify-center">
                  <Target className="w-8 h-8 opacity-40" />
                </div>
                <div className="text-[15px] font-medium text-slate-600">暂未配置评价标准</div>
                <div className="text-[13px] mt-1">该场景暂未设置评价方式</div>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-3 px-3 font-semibold text-slate-500 text-xs w-[40px]">#</th>
                      <th className="text-left py-3 px-3 font-semibold text-slate-500 text-xs">任务名称</th>
                      <th className="text-left py-3 px-3 font-semibold text-slate-500 text-xs">评价方式</th>
                      <th className="text-left py-3 px-3 font-semibold text-slate-500 text-xs">场景权重</th>
                      <th className="text-left py-3 px-3 font-semibold text-slate-500 text-xs">评分点</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const tasksWithEval = tasks.filter((t) => t.evalData?.evaluationMethods?.length > 0)
                      return tasksWithEval.map((task, idx) => {
                        const ed = task.evalData!
                        const methods: string[] = ed.evaluationMethods || []
                        const weights: Record<string, number> = ed.methodWeights || {}
                        const methodPointsMap: Record<string, { name: string; scoreInfo: string }[]> = {
                          random_draw: ed.randomDrawEvalPoints || [],
                          review: ed.reviewEvalPoints || [],
                          paper: ed.paperEvalPoints || [],
                          question_bank: ed.questionBankEvalPoints || [],
                          outcome: ed.outcomeEvalPoints || [],
                          homework: ed.homeworkEvalPoints || [],
                          quiz: ed.quizEvalPoints || [],
                        }
                        const allPoints: { name: string; scoreInfo: string }[] = []
                        for (const m of methods) {
                          ;(methodPointsMap[m] || []).forEach((pt: any) => {
                            let scoreInfo = ""
                            if (pt.gradeMapping?.length > 0) {
                              scoreInfo = `${pt.gradeMapping[pt.gradeMapping.length - 1].maxScore}分`
                            }
                            allPoints.push({ name: pt.name, scoreInfo })
                          })
                        }
                        return (
                          <tr key={task.id} className="border-b border-slate-100 hover:bg-blue-50/40 transition-colors">
                            <td className="py-3 px-3 text-slate-400">{idx + 1}</td>
                            <td className="py-3 px-3">
                              <div className="font-semibold text-slate-800">{task.name}</div>
                              <div className="text-[11px] text-slate-400">{taskTypeLabels[task.taskType]}</div>
                            </td>
                            <td className="py-3 px-3 text-slate-600">
                              {methods.join("、") || "-"}
                            </td>
                            <td className="py-3 px-3">
                              {methods.map((m, mi) => (
                                <div key={mi} className="text-blue-600 font-semibold">{Math.round(weights[m] || 0)}%</div>
                              ))}
                            </td>
                            <td className="py-3 px-3">
                              <div className="flex flex-wrap gap-1.5">
                                {allPoints.length > 0 ? allPoints.map((pt, pi) => (
                                  <span key={pi} className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                                    {pt.name}{pt.scoreInfo ? `(${pt.scoreInfo})` : ""}
                                  </span>
                                )) : (
                                  <span className="text-xs text-slate-400">-</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })
                    })()}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )

      case "knowledge":
        return <SceneKnowledgeGraph scenario={scenario} tasks={tasks} knowledgeMap={knowledgeMap} abilityMap={abilityMap} />

      default:
        return null
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc]" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" }}>
      {/* Header */}
      <div className="bg-white border-b border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
        <div className="max-w-[1400px] mx-auto px-6 py-5">
          <div className="flex items-center gap-2 mb-5 text-sm text-slate-500">
            <Link href="/scene/landing" className="hover:text-blue-600 transition-colors flex items-center gap-1">
              <span className="w-5 h-5 rounded-md bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-blue-50 hover:text-blue-600 transition-colors">←</span> 首页
            </Link>
            <span className="text-slate-300">/</span>
            <span className="text-slate-800 font-medium truncate">{scenario.name}</span>
          </div>

          <div className="flex flex-col lg:flex-row gap-6 items-stretch">
            {/* Left: Cover + Info */}
            <div className="flex-1 flex">
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.04)] w-full">
                <div className="flex flex-col sm:flex-row gap-6 p-6">
                  <div
                    className="w-full sm:w-[280px] h-[190px] rounded-2xl bg-cover bg-center flex items-center justify-center shrink-0 self-stretch shadow-[0_12px_40px_rgba(0,0,0,0.15)] relative overflow-hidden"
                    style={coverStyle}
                  >
                    <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                    {!scenario.coverImage && (
                      <svg className="w-16 h-16 text-white/90 relative z-10" viewBox="0 0 24 24" fill="currentColor" style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.2))" }}>
                        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                      </svg>
                    )}
                    <span className="absolute bottom-3 right-3 z-10 bg-black/40 backdrop-blur-sm text-white px-2.5 py-1 rounded-lg text-[11px] border border-white/10">{scenario.id.slice(0, 8)}</span>
                  </div>

                  <div className="flex-1 flex flex-col min-w-0">
                    <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                      <div className="flex items-center gap-2.5 flex-wrap min-w-0">
                        <h1 className="text-[26px] font-bold text-slate-900 truncate">{scenario.name}</h1>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600 font-medium shrink-0 border border-slate-200">
                          v{scenario.version}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-slate-400 mb-3">
                      <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> 创建人：{scenario.creatorId.slice(0, 8)}</span>
                      <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> 更新于 {formatDate(scenario.updatedAt)}</span>
                      <span className="flex items-center gap-1.5"><Eye className="w-3.5 h-3.5" /> 浏览 0 次</span>
                    </div>

                    {scenario.background && (
                      <p className="text-sm text-slate-600 leading-relaxed mb-4 line-clamp-3">
                        {scenario.background}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs">
                      {scenario.industryNames && scenario.industryNames.length > 0 && (
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 shrink-0">面向行业：</span>
                          <div className="flex flex-wrap gap-1.5">
                            {scenario.industryNames.slice(0, 3).map((n) => (
                              <span key={n} className="px-2.5 py-0.5 rounded-full text-[11px] bg-orange-50 text-orange-700 border border-orange-100 font-medium">{n}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 shrink-0">难度等级：</span>
                        <span
                          className="px-2.5 py-0.5 rounded-full text-[11px] border font-medium"
                          style={{ backgroundColor: diff.color + "15", color: diff.color, borderColor: diff.color + "30" }}
                        >
                          {diff.label}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3 mt-auto pt-5">
                      <Link href={`/scene/landing/${id}/learn`}>
                        <Button className="rounded-xl px-7 h-11 bg-gradient-to-r from-blue-500 to-blue-400 hover:from-blue-600 hover:to-blue-500 text-white font-semibold text-sm shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-0.5 transition-all">
                          <PlayCircle className="w-4 h-4 mr-1.5" /> 开始学习
                        </Button>
                      </Link>
                      <Button variant="ghost" className="rounded-xl h-11 w-11 p-0 text-slate-500 hover:text-blue-600 border border-slate-200 hover:bg-blue-50 hover:border-blue-200 transition-all">
                        <Share2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Stats Sidebar */}
            <div className="lg:w-[320px] shrink-0 flex">
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.04)] w-full">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
                    <BarChart3 className="w-4 h-4 text-blue-500" />
                  </div>
                  <span className="text-sm font-bold text-slate-800">课时统计</span>
                </div>
                <div className="p-5">
                  <div className="flex items-center justify-center mb-5">
                    <div className="relative w-[140px] h-[140px]">
                      <svg className="w-full h-full -rotate-90" viewBox="0 0 140 140">
                        <circle cx="70" cy="70" r="58" fill="none" stroke="#f1f5f9" strokeWidth="10" />
                        {totalHours > 0 && (
                          <circle
                            cx="70" cy="70" r="58" fill="none" stroke="#3b82f6"
                            strokeWidth="10" strokeLinecap="round"
                            strokeDasharray={`${(assessmentHours / totalHours) * Math.PI * 116 || 0} ${Math.PI * 116}`}
                          />
                        )}
                        {totalHours > 0 && trainingHours > 0 && (
                          <circle
                            cx="70" cy="70" r="58" fill="none" stroke="#22c55e"
                            strokeWidth="10" strokeLinecap="round"
                            strokeDasharray={`${(trainingHours / totalHours) * Math.PI * 116 || 0} ${Math.PI * 116}`}
                            strokeDashoffset={-1 * (assessmentHours / totalHours) * Math.PI * 116}
                          />
                        )}
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <div className="text-[32px] font-bold text-slate-800 leading-none">{totalHours}</div>
                        <div className="text-xs text-slate-400 mt-1">总课时</div>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-center gap-6 text-xs">
                    <div className="flex items-center gap-2 text-slate-600">
                      <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                      <span>考核 {assessmentHours} 课时</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600">
                      <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                      <span>训练 {trainingHours} 课时</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <main className="flex-1 max-w-[1400px] mx-auto px-6 py-6 w-full">
        <div ref={tabsRef} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
          <div className="flex border-b border-slate-100 px-6 overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t.value}
                onClick={() => setActiveTab(t.value)}
                className={`
                  py-4 px-5 text-[14px] whitespace-nowrap relative transition-all cursor-pointer flex items-center gap-1.5
                  ${activeTab === t.value ? "text-blue-600 font-semibold" : "text-slate-500 hover:text-blue-600 hover:bg-blue-50/40"}
                `}
              >
                <t.icon className={`w-4 h-4 ${activeTab === t.value ? "text-blue-500" : "text-slate-400"}`} />
                {t.label}
                {t.value === "tasks" && tasks.length > 0 && (
                  <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[11px] leading-none ${activeTab === t.value ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-500"}`}>
                    {tasks.length}
                  </span>
                )}
                {t.value === "resources" && totalResources > 0 && (
                  <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[11px] leading-none ${activeTab === t.value ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-500"}`}>
                    {totalResources}
                  </span>
                )}
                {t.value === "abilities" && uniqueAbilityIds.size > 0 && (
                  <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[11px] leading-none ${activeTab === t.value ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-500"}`}>
                    {uniqueAbilityIds.size}
                  </span>
                )}
                {t.value === "evaluation" && totalEvalConfigs > 0 && (
                  <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[11px] leading-none ${activeTab === t.value ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-500"}`}>
                    {totalEvalConfigs}
                  </span>
                )}
                {activeTab === t.value && (
                  <span className="absolute bottom-0 left-4 right-4 h-[2px] bg-blue-500 rounded-t-full" />
                )}
              </button>
            ))}
          </div>

          <div className="p-6 min-h-[500px]">
            {renderTabContent()}
          </div>
        </div>
      </main>

      <PlatformFooter />
    </div>
  )
}
