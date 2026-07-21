"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import {
  ArrowLeft, PlayCircle, FileText, ListChecks, FolderOpen,
  Lightbulb, Target, GitBranch, Layers, Clock, MapPin,
  BarChart3, Calendar, ChevronDown,
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
  { value: "overview", label: "场景概述", icon: FileText },
  { value: "tasks", label: "任务列表", icon: ListChecks },
  { value: "resources", label: "关联资源", icon: FolderOpen },
  { value: "abilities", label: "考查能力点", icon: Lightbulb },
  { value: "evaluation", label: "评分量规", icon: Target },
  { value: "knowledge", label: "知识图谱", icon: GitBranch },
]

const coverGradients = [
  "linear-gradient(135deg,#1e3a8a,#3b7cff)",
  "linear-gradient(135deg,#7c2d12,#dc2626)",
  "linear-gradient(135deg,#064e3b,#0891b2)",
  "linear-gradient(135deg,#334155,#64748b)",
  "linear-gradient(135deg,#581c87,#a855f7)",
]

const difficultyMap: Record<number, { color: string; label: string }> = {
  1: { color: "#22c55e", label: "入门" },
  2: { color: "#eab308", label: "初级" },
  3: { color: "#f97316", label: "中级" },
  4: { color: "#ef4444", label: "高级" },
  5: { color: "#8b5cf6", label: "专家" },
}

const taskTypeLabels: Record<string, string> = {
  assessment: "测评任务",
  training: "训练任务",
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
  const [activeTab, setActiveTab] = useState("overview")

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

  const totalHours = useMemo(() => tasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0), [tasks])
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

  const diff = difficultyMap[scenario?.difficulty ?? 3] || difficultyMap[3]
  const industryName = scenario?.industryNames?.[0] || (scenario?.industryIds?.length ? "已关联" : "未分类")

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-[#F9FAFC]">
        <Skeleton className="h-[280px] w-full" />
        <div className="max-w-[1400px] mx-auto px-8 py-8 w-full flex-1">
          <Skeleton className="h-[400px] w-full rounded-2xl" />
        </div>
        <PlatformFooter />
      </div>
    )
  }

  if (!scenario) {
    return (
      <div className="min-h-screen flex flex-col bg-[#F9FAFC]">
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
      case "overview":
        return (
          <div className="space-y-6">
            {scenario.background && (
              <div>
                <h3 className="text-[15px] font-semibold text-[#0f172a] mb-3">场景背景</h3>
                <p className="text-sm text-[#475569] leading-relaxed whitespace-pre-wrap">{scenario.background}</p>
              </div>
            )}
            {scenario.deliveryGoal && (
              <div>
                <h3 className="text-[15px] font-semibold text-[#0f172a] mb-3">教学目标</h3>
                <p className="text-sm text-[#475569] leading-relaxed whitespace-pre-wrap">{scenario.deliveryGoal}</p>
              </div>
            )}
            {!scenario.background && !scenario.deliveryGoal && (
              <div className="text-center py-12 text-[#94a3b8]">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <div>暂无场景概述信息</div>
              </div>
            )}
            <div>
              <h3 className="text-[15px] font-semibold text-[#0f172a] mb-3">基本信息</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-[#fafaf9] rounded-lg p-3">
                  <div className="text-xs text-[#94a3b8] mb-1">场景编码</div>
                  <div className="text-sm font-medium text-[#0f172a]">{scenario.code || scenario.id.slice(0, 8)}</div>
                </div>
                <div className="bg-[#fafaf9] rounded-lg p-3">
                  <div className="text-xs text-[#94a3b8] mb-1">版本号</div>
                  <div className="text-sm font-medium text-[#0f172a]">{scenario.version}</div>
                </div>
                <div className="bg-[#fafaf9] rounded-lg p-3">
                  <div className="text-xs text-[#94a3b8] mb-1">创建时间</div>
                  <div className="text-sm font-medium text-[#0f172a]">{formatDate(scenario.createdAt)}</div>
                </div>
                <div className="bg-[#fafaf9] rounded-lg p-3">
                  <div className="text-xs text-[#94a3b8] mb-1">更新时间</div>
                  <div className="text-sm font-medium text-[#0f172a]">{formatDate(scenario.updatedAt)}</div>
                </div>
              </div>
            </div>
          </div>
        )

      case "tasks":
        return (
          <div>
            <div className="text-sm text-[#64748b] mb-4">
              共 <strong className="text-blue-500">{tasks.length}</strong> 个任务，
              合计 <strong className="text-blue-500">{totalHours}</strong> 课时
            </div>
            {tasks.length === 0 ? (
              <div className="text-center py-12 text-[#94a3b8]">
                <ListChecks className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <div>暂无任务</div>
              </div>
            ) : (
              <div className="space-y-2">
                {tasks.map((task, idx) => (
                  <div key={task.id} className="bg-white rounded-xl border border-[#f5f5f4] overflow-hidden">
                    <div className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#eff6ff] text-blue-600 flex items-center justify-center text-sm font-bold">
                          {idx + 1}
                        </div>
                        <div>
                          <div className="text-[14px] font-medium text-[#1f2937]">{task.name}</div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[11px] px-1.5 py-0.5 rounded bg-[#f1f5f9] text-[#64748b]">
                              {taskTypeLabels[task.taskType] || task.taskType}
                            </span>
                            {task.code && (
                              <span className="text-[11px] text-[#94a3b8]">{task.code}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-[#94a3b8]">
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{task.estimatedHours || 0}h</span>
                        <span className="flex items-center gap-1"><BarChart3 className="w-3 h-3" />Lv.{task.difficulty}</span>
                      </div>
                    </div>
                    {(task.description || task.detailedDescription) && (
                      <div className="px-4 pb-4 border-t border-[#f5f5f4] pt-3">
                        <p className="text-sm text-[#475569] leading-relaxed">{task.detailedDescription || task.description}</p>
                      </div>
                    )}
                  </div>
                ))}
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
                        <ListChecks className="w-3.5 h-3.5 text-blue-500" />
                        {task.name}
                        <span className="text-xs text-[#94a3b8] font-normal">({resources.length} 个资源)</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {resources.map((r) => (
                          <div key={r.id} className="bg-[#fafaf9] rounded-lg p-3 border border-[#f5f5f4]">
                            <div className="text-sm font-medium text-[#0f172a] mb-1 truncate">{r.name}</div>
                            <div className="flex items-center gap-2 text-xs text-[#94a3b8]">
                              <span className="px-1.5 py-0.5 rounded bg-[#f1f5f9]">{r.type}</span>
                              {r.size && <span>{r.size}</span>}
                            </div>
                            {r.description && (
                              <p className="text-xs text-[#94a3b8] mt-1 line-clamp-2">{r.description}</p>
                            )}
                          </div>
                        ))}
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
              <div className="space-y-4">
                {tasks.filter((t) => t.abilityPointIds?.length > 0).map((task) => (
                  <div key={task.id}>
                    <div className="text-sm font-medium text-[#0f172a] mb-2 flex items-center gap-2">
                      <ListChecks className="w-3.5 h-3.5 text-violet-500" />
                      {task.name}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {task.abilityPointIds?.map((aid) => {
                        const ap = abilityMap.get(aid)
                        const catColors: Record<string, string> = {
                          knowledge: "bg-[#eff6ff] text-blue-600",
                          skill: "bg-[#fef3c7] text-amber-600",
                          quality: "bg-[#f3e8ff] text-purple-600",
                        }
                        return (
                          <div key={aid} className="bg-white border border-[#f5f5f4] rounded-lg px-3 py-2">
                            <div className="text-sm font-medium text-[#0f172a]">
                              {ap?.name || "能力点"}
                            </div>
                            {ap?.category && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded ${catColors[ap.category] || "bg-[#f1f5f9] text-[#64748b]"}`}>
                                {ap.category === "knowledge" ? "知识" : ap.category === "skill" ? "技能" : "素养"}
                              </span>
                            )}
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
            {tasks.filter((t) => (taskEvalConfigs.get(t.id) || []).length > 0).length === 0 ? (
              <div className="text-center py-12 text-[#94a3b8]">
                <Target className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <div>暂无评分量规</div>
              </div>
            ) : (
              <div className="space-y-6">
                {tasks.filter((t) => (taskEvalConfigs.get(t.id) || []).length > 0).map((task) => {
                  const configs = taskEvalConfigs.get(task.id) || []
                  return (
                    <div key={task.id}>
                      <div className="text-sm font-medium text-[#0f172a] mb-3 flex items-center gap-2">
                        <Target className="w-3.5 h-3.5 text-orange-500" />
                        {task.name}
                      </div>
                      {configs.map((config) => {
                        const pts = evalPoints.get(config.id) || []
                        const stps = reviewSteps.get(config.id) || []
                        return (
                          <div key={config.id} className="bg-[#fafaf9] rounded-lg p-4 mb-3 border border-[#f5f5f4]">
                            <div className="flex items-center justify-between mb-3">
                              <div className="text-sm font-medium text-[#0f172a]">
                                评价方式：{config.methodKey}
                              </div>
                              <span className="text-xs text-[#94a3b8]">权重：{config.weight * 100}%</span>
                            </div>
                            {pts.length > 0 && (
                              <div className="mb-3">
                                <div className="text-xs text-[#94a3b8] mb-2 font-medium">评分点</div>
                                <div className="overflow-x-auto">
                                  <table className="w-full text-sm">
                                    <thead>
                                      <tr className="border-b border-[#e5e7eb]">
                                        <th className="text-left py-2 px-2 font-medium text-[#64748b] text-xs">评分点</th>
                                        <th className="text-left py-2 px-2 font-medium text-[#64748b] text-xs">满分</th>
                                        <th className="text-left py-2 px-2 font-medium text-[#64748b] text-xs">方式</th>
                                        <th className="text-left py-2 px-2 font-medium text-[#64748b] text-xs">权重</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {pts.map((pt) => (
                                        <tr key={pt.id} className="border-b border-[#f5f5f4]">
                                          <td className="py-2 px-2 text-[#1f2937]">{pt.name}</td>
                                          <td className="py-2 px-2 text-[#0f172a] font-medium">{pt.maxScore}</td>
                                          <td className="py-2 px-2 text-[#64748b]">{pt.scoringMethod}</td>
                                          <td className="py-2 px-2 text-[#64748b]">{pt.weight * 100}%</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}
                            {stps.length > 0 && (
                              <div>
                                <div className="text-xs text-[#94a3b8] mb-2 font-medium">评审步骤</div>
                                <div className="space-y-1">
                                  {stps.map((st) => (
                                    <div key={st.id} className="flex items-center gap-2 text-sm text-[#475569]">
                                      <span className="w-5 h-5 rounded-full bg-[#eff6ff] text-blue-600 flex items-center justify-center text-[10px] font-bold">
                                        {st.sortOrder}
                                      </span>
                                      <span>{st.label}</span>
                                      {!st.enabled && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#f1f5f9] text-[#94a3b8]">已禁用</span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
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
                    <div className="text-sm font-medium text-[#0f172a] mb-2 flex items-center gap-2">
                      <ListChecks className="w-3.5 h-3.5 text-teal-500" />
                      {task.name}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {task.knowledgePointIds?.map((kid) => {
                        const kp = knowledgeMap.get(kid)
                        return (
                          <div key={kid} className="bg-white border border-[#f5f5f4] rounded-lg px-3 py-2">
                            <div className="text-sm font-medium text-[#0f172a]">
                              {kp?.name || "知识点"}
                            </div>
                            {kp?.code && (
                              <div className="text-[10px] text-[#94a3b8]">{kp.code}</div>
                            )}
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
    <div className="min-h-screen flex flex-col bg-[#F9FAFC]">
      {/* Scene Header */}
      <div className="bg-white border-b border-[#e7e5e4]">
        <div className="max-w-[1400px] mx-auto px-8 py-6">
          <div className="flex items-center gap-2 mb-5">
            <Link href="/scene/landing">
              <Button variant="ghost" size="sm" className="text-[#64748b] hover:text-blue-600 pl-0">
                <ArrowLeft className="w-4 h-4 mr-1" /> 返回场景列表
              </Button>
            </Link>
          </div>

          <div className="bg-white rounded-2xl border border-[#e7e5e4] p-6 shadow-[0_4px_20px_rgba(69,26,3,0.06)]">
            <div className="flex flex-col lg:flex-row gap-6">
              <div
                className="w-full lg:w-[280px] h-[180px] rounded-xl bg-cover bg-center flex items-center justify-center shrink-0 relative overflow-hidden self-stretch"
                style={coverStyle}
              >
                {!scenario.coverImage && (
                  <span className="text-white text-[48px] font-bold opacity-25 select-none">
                    {scenario.name.charAt(0)}
                  </span>
                )}
                <span className="absolute top-3 left-3 bg-white/25 text-white px-3 py-1 rounded text-sm font-semibold backdrop-blur-sm">
                  {scenario.version}
                </span>
                <span className="absolute bottom-3 right-0 translate-x-0 bg-black/40 text-white px-3 py-1 rounded-l text-xs">
                  {scenario.id.slice(0, 8)}
                </span>
              </div>

              <div className="flex-1 flex flex-col">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-3">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h1 className="text-2xl font-bold text-[#0f172a]">{scenario.name}</h1>
                    </div>

                    <div className="flex flex-wrap gap-2 mb-3">
                      <span
                        className="px-3 py-1 rounded-md text-xs border flex items-center gap-1"
                        style={{ backgroundColor: diff.color + "15", color: diff.color, borderColor: diff.color + "30" }}
                      >
                        <BarChart3 className="w-3 h-3" /> {diff.label}
                      </span>
                      <span className="px-3 py-1 rounded-md text-xs border bg-[#fff7ed] border-[#ffedd5] text-[#c2410c] flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> 行业：{industryName}
                      </span>
                      {scenario.industryNames && scenario.industryNames.length > 1 && (
                        <span className="px-3 py-1 rounded-md text-xs border bg-[#f1f5f9] text-[#475569]">
                          +{scenario.industryNames.length - 1} 个
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2.5 mb-4">
                  <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-[#64748b]">
                    <span className="flex items-center gap-2"><Calendar className="w-4 h-4 text-[#94a3b8]" /> 创建时间：{formatDate(scenario.createdAt)}</span>
                    <span className="flex items-center gap-2"><Calendar className="w-4 h-4 text-[#94a3b8]" /> 更新时间：{formatDate(scenario.updatedAt)}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 mt-auto">
                  <Button className="rounded-md px-6 h-10 bg-gradient-to-r from-blue-500 to-blue-400 hover:from-blue-600 hover:to-blue-500 text-white font-medium">
                    <PlayCircle className="w-4 h-4 mr-1.5" /> 开始学习
                  </Button>
                  <Button variant="outline" className="rounded-md px-5 h-10 text-[#475569]" onClick={() => tabsRef.current?.scrollIntoView({ behavior: "smooth" })}>
                    查看任务列表 <ChevronDown className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <main className="flex-1 max-w-[1400px] mx-auto px-8 py-6 w-full">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          {[
            { icon: ListChecks, value: tasks.length, label: "任务数量" },
            { icon: Clock, value: totalHours, label: "总课时(h)", locale: false },
            { icon: Lightbulb, value: uniqueAbilityIds.size, label: "能力点数" },
            { icon: FolderOpen, value: totalResources, label: "资源数" },
            { icon: BarChart3, value: diff.label, label: "难度等级", locale: false },
          ].map((s, i) => (
            <div
              key={i}
              className="bg-white rounded-xl border border-[#e2e8f0] shadow-[0_1px_3px_rgba(0,0,0,0.04)] px-3 py-5 text-center transition-all hover:border-blue-200 hover:shadow-[0_4px_12px_rgba(37,99,235,0.08)]"
            >
              <div className="text-[28px] font-bold text-[#1e293b] leading-tight mb-1.5">
                {typeof s.value === "number" ? s.value.toLocaleString() : s.value}
              </div>
              <div className="text-[13px] text-[#64748b] flex items-center justify-center gap-1.5">
                <s.icon className="w-3.5 h-3.5" />
                {s.label}
              </div>
            </div>
          ))}
        </div>

        <div ref={tabsRef} className="bg-white rounded-2xl border border-[#e7e5e4] shadow-[0_4px_20px_rgba(69,26,3,0.06)] overflow-hidden">
          {/* Tabs */}
          <div className="flex gap-8 border-b border-[#f5f5f4] px-6 overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t.value}
                onClick={() => setActiveTab(t.value)}
                className={`
                  py-4 text-[15px] whitespace-nowrap relative transition-colors cursor-pointer
                  ${activeTab === t.value ? "text-blue-500 font-semibold" : "text-[#64748b] hover:text-blue-600"}
                `}
              >
                <t.icon className="w-4 h-4 inline-block mr-1.5 -mt-0.5" />
                {t.label}
                {activeTab === t.value && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-t" />
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
