"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import {
  ArrowLeft, PlayCircle, ListChecks, FolderOpen,
  Lightbulb, Target, GitBranch, Layers, Clock,
  BarChart3, Calendar, ChevronDown, BookOpen,
  Users, Eye, Share2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  scenarioApi,
  taskApi,
  taskResourceApi,
  taskEvaluationApi,
  knowledgeApi,
  abilityApi,
} from "@/lib/api"
import type {
  Scenario,
  ScenarioTask,
  TaskResource,
  TaskEvaluationConfig,
  TaskEvalPoint,
  TaskReviewStep,
  KnowledgePoint,
  AbilityPoint,
} from "@/lib/types"
import { PlatformFooter } from "@/components/job/student/platform-footer"

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
  const [taskResources, setTaskResources] = useState<Map<string, TaskResource[]>>(new Map())
  const [taskEvalConfigs, setTaskEvalConfigs] = useState<Map<string, TaskEvaluationConfig[]>>(new Map())
  const [evalPoints, setEvalPoints] = useState<Map<string, TaskEvalPoint[]>>(new Map())
  const [reviewSteps, setReviewSteps] = useState<Map<string, TaskReviewStep[]>>(new Map())
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

        Promise.all(taskList.map((t) =>
          taskResourceApi.listResources({ taskId: t.id, limit: 100 })
            .then((r) => ({ taskId: t.id, items: r.items || [] }))
            .catch(() => ({ taskId: t.id, items: [] }))
        )).then((results) => {
          const rMap = new Map<string, TaskResource[]>()
          results.forEach((r) => rMap.set(r.taskId, r.items))
          setTaskResources(rMap)
        }).catch(() => {})

        Promise.all(taskList.map((t) =>
          taskEvaluationApi.listConfigs({ taskId: t.id })
            .then(async (r) => {
              const configs = r.items || []
              const pointsMap = new Map<string, TaskEvalPoint[]>()
              const stepsMap = new Map<string, TaskReviewStep[]>()
              await Promise.all(configs.map(async (c) => {
                try {
                  const pts = await taskEvaluationApi.listEvalPoints(c.id)
                  pointsMap.set(c.id, pts.items || [])
                } catch { pointsMap.set(c.id, []) }
                try {
                  const stps = await taskEvaluationApi.listReviewSteps(c.id)
                  stepsMap.set(c.id, stps.items || [])
                } catch { stepsMap.set(c.id, []) }
              }))
              return { taskId: t.id, configs, pointsMap, stepsMap }
            })
            .catch(() => ({ taskId: t.id, configs: [], pointsMap: new Map(), stepsMap: new Map() }))
        )).then((results) => {
          const cMap = new Map<string, TaskEvaluationConfig[]>()
          const pMap = new Map<string, TaskEvalPoint[]>()
          const sMap = new Map<string, TaskReviewStep[]>()
          results.forEach((r) => {
            cMap.set(r.taskId, r.configs)
            r.pointsMap.forEach((v, k) => pMap.set(k, v))
            r.stepsMap.forEach((v, k) => sMap.set(k, v))
          })
          setTaskEvalConfigs(cMap)
          setEvalPoints(pMap)
          setReviewSteps(sMap)
        }).catch(() => {})
      })
      .catch(() => setTasks([]))

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
    taskResources.forEach((r) => { count += r.length })
    return count
  }, [taskResources])
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
    taskEvalConfigs.forEach((c) => { count += c.length })
    return count
  }, [taskEvalConfigs])

  const diff = difficultyMap[scenario?.difficulty ?? 3] || difficultyMap[3]
  const industryName = scenario?.industryNames?.[0] || (scenario?.industryIds?.length ? "已关联" : "未分类")

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-[#f5f5f5]">
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
      <div className="min-h-screen flex flex-col bg-[#f5f5f5]">
        <div className="flex-1 flex flex-col items-center justify-center text-[#94a3b8]">
          <Layers className="w-16 h-16 mb-4 opacity-40" />
          <div className="text-lg font-semibold text-[#475569]">场景不存在或暂未公开</div>
          <Link href="/scene/landing" className="text-blue-600 hover:underline mt-2">返回场景列表</Link>
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
              <div className="text-center py-12 text-[#94a3b8]">
                <ListChecks className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <div>暂无任务</div>
              </div>
            ) : (
              <div className="space-y-3">
                {tasks.map((task, idx) => {
                  const taskRes = taskResources.get(task.id) || []
                  const taskAbs = task.abilityPointIds?.length || 0
                  const taskKs = task.knowledgePointIds?.length || 0
                  return (
                    <div key={task.id} className="bg-white rounded-xl border border-[#f0f0f0] overflow-hidden hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] transition-shadow">
                      <div className="flex items-center gap-4 p-5">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-400 text-white flex items-center justify-center text-sm font-bold shrink-0 shadow-[0_2px_8px_rgba(59,130,246,0.3)]">
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="text-[15px] font-semibold text-[#1f2937] truncate">{task.name}</div>
                            <span className="text-[11px] px-2 py-0.5 rounded text-xs shrink-0"
                              style={{ backgroundColor: task.taskType === "assessment" ? "#fef2f2" : "#eff6ff", color: task.taskType === "assessment" ? "#dc2626" : "#2563eb" }}
                            >
                              {taskTypeLabels[task.taskType] || task.taskType}
                            </span>
                            {task.code && <span className="text-[11px] text-[#94a3b8] shrink-0">{task.code}</span>}
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-[#94a3b8]">
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{task.estimatedHours || 0} 课时</span>
                            <span className="flex items-center gap-1"><BarChart3 className="w-3 h-3" />Lv.{task.difficulty}</span>
                            {taskRes.length > 0 && <span className="flex items-center gap-1"><FolderOpen className="w-3 h-3" />{taskRes.length} 个资源</span>}
                            {taskAbs > 0 && <span className="flex items-center gap-1"><Lightbulb className="w-3 h-3" />{taskAbs} 个能力点</span>}
                            {taskKs > 0 && <span className="flex items-center gap-1"><GitBranch className="w-3 h-3" />{taskKs} 个知识点</span>}
                          </div>
                          {(task.description || task.detailedDescription) && (
                            <p className="text-xs text-[#94a3b8] mt-2 line-clamp-2 leading-relaxed">
                              {task.detailedDescription || task.description}
                            </p>
                          )}
                        </div>
                        <Link href={`/scene/landing/${id}/learn?task=${task.id}`} className="shrink-0">
                          <Button size="sm" className="rounded-md h-8 px-4 text-xs bg-gradient-to-r from-blue-500 to-blue-400 hover:from-blue-600 hover:to-blue-500 text-white">
                            <PlayCircle className="w-3 h-3 mr-1" /> 开始任务
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
            <div className="text-sm text-[#64748b] mb-4">
              共 <strong className="text-blue-500">{totalResources}</strong> 个资源
            </div>
            {totalResources === 0 ? (
              <div className="text-center py-12 text-[#94a3b8]">
                <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <div>暂无关联资源</div>
              </div>
            ) : (
              <div className="space-y-4">
                {tasks.map((task) => {
                  const resources = taskResources.get(task.id) || []
                  if (resources.length === 0) return null
                  return (
                    <div key={task.id}>
                      <div className="text-sm font-medium text-[#0f172a] mb-2 flex items-center gap-2">
                        <BookOpen className="w-3.5 h-3.5 text-blue-500" />
                        {task.name}
                        <span className="text-xs text-[#94a3b8] font-normal">({resources.length})</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {resources.map((r) => {
                          const typeColors: Record<string, string> = { document: "bg-[#eff6ff] text-blue-600", video: "bg-[#fef3c7] text-amber-600", link: "bg-[#f3e8ff] text-purple-600", file: "bg-[#f0fdf4] text-emerald-600" }
                          return (
                            <div key={r.id} className="bg-[#fafaf9] rounded-lg p-3 border border-[#f0f0f0] hover:border-blue-200 transition-colors">
                              <div className="text-sm font-medium text-[#0f172a] mb-1 truncate">{r.name}</div>
                              <div className="flex items-center gap-2 text-xs text-[#94a3b8]">
                                <span className={`px-1.5 py-0.5 rounded ${typeColors[r.type] || "bg-[#f1f5f9] text-[#64748b]"}`}>{r.type}</span>
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
            <div className="text-sm text-[#64748b] mb-4">
              共 <strong className="text-blue-500">{uniqueAbilityIds.size}</strong> 个能力点
            </div>
            {uniqueAbilityIds.size === 0 ? (
              <div className="text-center py-12 text-[#94a3b8]">
                <Lightbulb className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <div>暂无考查能力点</div>
              </div>
            ) : (
              <div className="space-y-5">
                {tasks.filter((t) => t.abilityPointIds?.length > 0).map((task) => (
                  <div key={task.id}>
                    <div className="text-sm font-semibold text-[#1f2937] mb-3 flex items-center gap-2">
                      <Target className="w-3.5 h-3.5 text-violet-500" />
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
                        const cfg = catConfig[ap?.category || ""] || { label: "", classes: "text-[#64748b] bg-gray-50", border: "border-gray-100" }
                        return (
                          <div key={aid} className={`bg-white border ${cfg.border} rounded-lg p-3.5 hover:shadow-sm transition-shadow`}>
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-[#0f172a] mb-1">{ap?.name || "能力点"}</div>
                                {ap?.description && <div className="text-[11px] text-[#94a3b8] line-clamp-1">{ap.description}</div>}
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
            <div className="text-sm text-[#64748b] mb-4">
              共 <strong className="text-blue-500">{totalEvalConfigs}</strong> 个评价配置
            </div>
            {totalEvalConfigs === 0 ? (
              <div className="text-center py-12 text-[#94a3b8]">
                <Target className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <div>暂未配置评价标准</div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#e5e7eb]">
                      <th className="text-left py-3 px-3 font-medium text-[#64748b] text-xs w-[40px]">#</th>
                      <th className="text-left py-3 px-3 font-medium text-[#64748b] text-xs">任务名称</th>
                      <th className="text-left py-3 px-3 font-medium text-[#64748b] text-xs">评价方式</th>
                      <th className="text-left py-3 px-3 font-medium text-[#64748b] text-xs">场景权重</th>
                      <th className="text-left py-3 px-3 font-medium text-[#64748b] text-xs">评分点</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.filter((t) => (taskEvalConfigs.get(t.id) || []).length > 0).map((task, idx) => {
                      const configs = taskEvalConfigs.get(task.id) || []
                      return (
                        <tr key={task.id} className="border-b border-[#f5f5f4] hover:bg-[#f8faff] transition-colors">
                          <td className="py-3 px-3 text-[#64748b]">{idx + 1}</td>
                          <td className="py-3 px-3">
                            <div className="font-medium text-[#0f172a]">{task.name}</div>
                            <div className="text-[11px] text-[#94a3b8]">{taskTypeLabels[task.taskType]}</div>
                          </td>
                          <td className="py-3 px-3 text-[#475569]">
                            {configs.map((c) => c.methodKey).join("、") || "-"}
                          </td>
                          <td className="py-3 px-3">
                            {configs.map((c, ci) => (
                              <div key={ci} className="text-[#2563eb] font-medium">{Math.round(c.weight * 100)}%</div>
                            ))}
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex flex-wrap gap-1">
                              {(evalPoints.get(configs[0]?.id) || []).map((pt) => (
                                <span key={pt.id} className="inline-block text-[10px] px-2 py-0.5 rounded bg-[#f1f5f9] text-[#475569]">
                                  {pt.name}({pt.maxScore}分)
                                </span>
                              ))}
                              {configs.every((c) => (evalPoints.get(c.id) || []).length === 0) && (
                                <span className="text-xs text-[#94a3b8]">-</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )

      case "knowledge":
        return (
          <div>
            <div className="text-sm text-[#64748b] mb-4">
              共 <strong className="text-blue-500">{uniqueKnowledgeIds.size}</strong> 个知识点
            </div>
            {uniqueKnowledgeIds.size === 0 ? (
              <div className="text-center py-12 text-[#94a3b8]">
                <GitBranch className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <div>暂无关联知识点</div>
              </div>
            ) : (
              <div className="space-y-4">
                {tasks.filter((t) => t.knowledgePointIds?.length > 0).map((task) => (
                  <div key={task.id}>
                    <div className="text-sm font-semibold text-[#1f2937] mb-2 flex items-center gap-2">
                      <BookOpen className="w-3.5 h-3.5 text-teal-500" />
                      {task.name}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {task.knowledgePointIds?.map((kid) => {
                        const kp = knowledgeMap.get(kid)
                        return (
                          <div key={kid} className="bg-white border border-[#f0f0f0] rounded-lg px-3.5 py-2.5 hover:border-blue-200 transition-colors">
                            <div className="text-sm font-medium text-[#0f172a]">{kp?.name || "知识点"}</div>
                            {kp?.code && <div className="text-[10px] text-[#94a3b8] mt-0.5">编码：{kp.code}</div>}
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

      default:
        return null
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#f5f5f5]" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" }}>
      {/* Header */}
      <div className="bg-white border-b border-[#f0f0f0]">
        <div className="max-w-[1400px] mx-auto px-6 py-4">
          <div className="flex items-center gap-2 mb-4 text-sm text-[#64748b]">
            <Link href="/scene/landing" className="hover:text-blue-600 transition-colors">首页</Link>
            <span>/</span>
            <span className="text-[#1f2937] font-medium truncate">{scenario.name}</span>
          </div>

          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left: Cover + Info */}
            <div className="flex-1">
              <div className="bg-white rounded-xl border border-[#f0f0f0] overflow-hidden">
                <div className="flex flex-col sm:flex-row gap-6 p-6">
                  <div
                    className="w-full sm:w-[260px] h-[170px] rounded-xl bg-cover bg-center flex items-center justify-center shrink-0 self-stretch shadow-[0_4px_16px_rgba(102,126,234,0.25)]"
                    style={coverStyle}
                  >
                    {!scenario.coverImage && (
                      <svg className="w-14 h-14 text-white/85" viewBox="0 0 24 24" fill="currentColor" style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.1))" }}>
                        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                      </svg>
                    )}
                    <span className="absolute bottom-2 right-0 bg-black/40 text-white px-3 py-1 rounded-l text-xs">{scenario.id.slice(0, 8)}</span>
                  </div>

                  <div className="flex-1 flex flex-col min-w-0">
                    <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                      <div className="flex items-center gap-2.5 flex-wrap min-w-0">
                        <h1 className="text-2xl font-semibold text-[#1f2937] truncate">{scenario.name}</h1>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs border border-[#d9d9d9] bg-[#f5f5f5] text-[#64748b] font-medium shrink-0">
                          {scenario.version}
                        </span>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button variant="ghost" size="sm" className="h-9 px-3 text-xs text-[#64748b] hover:text-blue-600 border border-[#d9d9d9] rounded-md">
                          <Share2 className="w-3.5 h-3.5 mr-1" /> 分享
                        </Button>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-[#94a3b8] mb-3">
                      <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> 创建人：{scenario.creatorId.slice(0, 8)}</span>
                      <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> 更新于 {formatDate(scenario.updatedAt)}</span>
                      <span className="flex items-center gap-1.5"><Eye className="w-3.5 h-3.5" /> 浏览 0 次</span>
                    </div>

                    {scenario.background && (
                      <p className="text-sm text-[#64748b] leading-relaxed mb-4 line-clamp-3">
                        {scenario.background}
                      </p>
                    )}

                    <div className="flex flex-col gap-2 text-xs">
                      {scenario.industryNames && scenario.industryNames.length > 0 && (
                        <div className="flex items-center gap-2">
                          <span className="text-[#94a3b8] shrink-0">面向行业：</span>
                          <div className="flex flex-wrap gap-1.5">
                            {scenario.industryNames.slice(0, 3).map((n) => (
                              <span key={n} className="px-2.5 py-0.5 rounded text-[11px] bg-[#fff7ed] text-[#c2410c] border border-[#ffedd5]">{n}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <span className="text-[#94a3b8] shrink-0">难度等级：</span>
                        <span
                          className="px-2.5 py-0.5 rounded text-[11px] border"
                          style={{ backgroundColor: diff.color + "15", color: diff.color, borderColor: diff.color + "30" }}
                        >
                          {diff.label}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3 mt-auto pt-4">
                      <Link href={`/scene/landing/${id}/learn`}>
                        <Button className="rounded-md px-6 h-10 bg-gradient-to-r from-blue-500 to-blue-400 hover:from-blue-600 hover:to-blue-500 text-white font-medium text-sm">
                          <PlayCircle className="w-4 h-4 mr-1.5" /> 开始学习
                        </Button>
                      </Link>
                      <Button variant="ghost" className="rounded-md px-5 h-10 text-[#64748b] border border-[#d9d9d9] hover:text-blue-600 hover:border-blue-300 text-sm" onClick={() => tabsRef.current?.scrollIntoView({ behavior: "smooth" })}>
                        查看任务列表 <ChevronDown className="w-4 h-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Stats Sidebar */}
            <div className="lg:w-[300px] shrink-0">
              <div className="bg-white rounded-xl border border-[#f0f0f0] overflow-hidden">
                <div className="px-5 py-4 border-b border-[#f0f0f0] flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-semibold text-[#1f2937]">课时统计</span>
                </div>
                <div className="p-5">
                  <div className="flex items-center justify-center mb-5">
                    <div className="relative w-[120px] h-[120px]">
                      <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                        <circle cx="60" cy="60" r="50" fill="none" stroke="#f0f0f0" strokeWidth="10" />
                        {totalHours > 0 && (
                          <circle
                            cx="60" cy="60" r="50" fill="none" stroke="#2563eb"
                            strokeWidth="10" strokeLinecap="round"
                            strokeDasharray={`${(assessmentHours / totalHours) * Math.PI * 100 || 0} ${Math.PI * 100}`}
                          />
                        )}
                        {totalHours > 0 && trainingHours > 0 && (
                          <circle
                            cx="60" cy="60" r="50" fill="none" stroke="#22c55e"
                            strokeWidth="10" strokeLinecap="round"
                            strokeDasharray={`${(trainingHours / totalHours) * Math.PI * 100 || 0} ${Math.PI * 100}`}
                            strokeDashoffset={-1 * (assessmentHours / totalHours) * Math.PI * 100}
                          />
                        )}
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <div className="text-[28px] font-bold text-[#1f2937]">{totalHours}</div>
                        <div className="text-xs text-[#94a3b8]">总课时</div>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-center gap-6 text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                      <span>考核 {assessmentHours} 课时</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                      <span>训练 {trainingHours} 课时</span>
                    </div>
                  </div>
                  <div className="mt-5 pt-4 border-t border-[#f0f0f0] grid grid-cols-2 gap-3">
                    <div className="text-center">
                      <div className="text-xl font-bold text-[#1f2937]">{tasks.length}</div>
                      <div className="text-[11px] text-[#94a3b8]">任务总数</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-[#1f2937]">{uniqueAbilityIds.size}</div>
                      <div className="text-[11px] text-[#94a3b8]">能力点数</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-[#1f2937]">{totalResources}</div>
                      <div className="text-[11px] text-[#94a3b8]">资源数</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-[#1f2937]">{diff.label}</div>
                      <div className="text-[11px] text-[#94a3b8]">难度</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <main className="flex-1 max-w-[1400px] mx-auto px-6 py-6 w-full">
        <div ref={tabsRef} className="bg-white rounded-xl border border-[#f0f0f0] overflow-hidden">
          <div className="flex border-b border-[#f0f0f0] px-6 overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t.value}
                onClick={() => setActiveTab(t.value)}
                className={`
                  py-4 px-5 text-[14px] whitespace-nowrap relative transition-colors cursor-pointer flex items-center gap-1.5
                  ${activeTab === t.value ? "text-[#1677ff] font-medium" : "text-[#64748b] hover:text-[#1677ff] hover:bg-[#1677ff08]"}
                `}
              >
                <t.icon className="w-4 h-4" />
                {t.label}
                {t.value === "tasks" && tasks.length > 0 && (
                  <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[11px] leading-none ${activeTab === t.value ? "bg-[#e6f4ff] text-[#1677ff]" : "bg-[#f0f0f0] text-[#64748b]"}`}>
                    {tasks.length}
                  </span>
                )}
                {t.value === "resources" && totalResources > 0 && (
                  <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[11px] leading-none ${activeTab === t.value ? "bg-[#e6f4ff] text-[#1677ff]" : "bg-[#f0f0f0] text-[#64748b]"}`}>
                    {totalResources}
                  </span>
                )}
                {t.value === "abilities" && uniqueAbilityIds.size > 0 && (
                  <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[11px] leading-none ${activeTab === t.value ? "bg-[#e6f4ff] text-[#1677ff]" : "bg-[#f0f0f0] text-[#64748b]"}`}>
                    {uniqueAbilityIds.size}
                  </span>
                )}
                {t.value === "evaluation" && totalEvalConfigs > 0 && (
                  <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[11px] leading-none ${activeTab === t.value ? "bg-[#e6f4ff] text-[#1677ff]" : "bg-[#f0f0f0] text-[#64748b]"}`}>
                    {totalEvalConfigs}
                  </span>
                )}
                {activeTab === t.value && (
                  <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-[#1677ff] rounded-t" />
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
