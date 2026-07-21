"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams, useSearchParams } from "next/navigation"
import {
  ArrowLeft, Clock, BarChart3,
  FileText, ListChecks, BookOpen,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { scenarioApi, taskApi } from "@/lib/api"
import type { Scenario, ScenarioTask } from "@/lib/types"
import { PlatformFooter } from "@/components/job/student/platform-footer"

const difficultyMap: Record<number, { color: string; label: string; bg: string; border: string }> = {
  1: { color: "#16a34a", label: "入门", bg: "#f0fdf4", border: "#bbf7d0" },
  2: { color: "#ca8a04", label: "初级", bg: "#fefce8", border: "#fde047" },
  3: { color: "#ea580c", label: "中级", bg: "#fff7ed", border: "#fed7aa" },
  4: { color: "#dc2626", label: "高级", bg: "#fef2f2", border: "#fecaca" },
  5: { color: "#7c3aed", label: "专家", bg: "#f5f3ff", border: "#ddd6fe" },
}

export default function SceneLearnPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const id = params.id as string
  const targetTaskId = searchParams.get("task")

  const [scenario, setScenario] = useState<Scenario | null>(null)
  const [tasks, setTasks] = useState<ScenarioTask[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTaskId, setActiveTaskId] = useState<string | null>(targetTaskId || null)

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

  const activeTask = useMemo(() => tasks.find((t) => t.id === activeTaskId), [tasks, activeTaskId])
  const totalHours = useMemo(() => tasks.reduce((s, t) => s + (t.estimatedHours || 0), 0), [tasks])

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-[#f8fafc]">
        <div className="flex-1 max-w-[1400px] mx-auto px-6 py-6 w-full">
          <Skeleton className="h-14 w-40 mb-6" />
          <div className="flex gap-6">
            <Skeleton className="w-[280px] h-[400px] rounded-xl shrink-0" />
            <Skeleton className="flex-1 h-[400px] rounded-xl" />
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
            <Link href={`/scene/landing/${id}`} className="group flex items-center gap-2 text-sm text-slate-500 hover:text-blue-600 transition-colors">
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

      <div className="flex-1 flex max-w-[1400px] mx-auto w-full px-6 py-6 gap-6">
        <aside className="w-[280px] shrink-0 flex flex-col gap-3">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-800 px-1 mb-1">
            <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
              <ListChecks className="w-4 h-4 text-blue-500" />
            </div>
            任务列表
          </div>
          <div className="flex flex-col gap-2">
            {tasks.map((task, idx) => {
              const isActive = activeTaskId === task.id
              return (
                <button
                  key={task.id}
                  onClick={() => setActiveTaskId(task.id)}
                  className={`
                    relative text-left p-3.5 rounded-xl border transition-all cursor-pointer overflow-hidden
                    ${isActive
                      ? "border-blue-200 bg-blue-50/60 shadow-md shadow-blue-500/10"
                      : "border-slate-200 bg-white hover:border-blue-200 hover:bg-slate-50"
                    }
                  `}
                >
                  {isActive && <span className="absolute left-0 top-3 bottom-3 w-1 bg-blue-500 rounded-r-full" />}
                  <div className="flex items-center gap-2.5 mb-1.5">
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-bold shrink-0 ${
                      isActive ? "bg-gradient-to-br from-blue-500 to-blue-400 text-white shadow-sm" : "bg-slate-100 text-slate-500"
                    }`}>
                      {idx + 1}
                    </div>
                    <div className={`text-[13px] font-semibold truncate flex-1 ${isActive ? "text-blue-700" : "text-slate-700"}`}>{task.name}</div>
                  </div>
                  <div className="flex items-center gap-3 ml-8 text-[11px] text-slate-400">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{task.estimatedHours || 0}h</span>
                    <span className="flex items-center gap-1"><BarChart3 className="w-3 h-3" />Lv.{task.difficulty}</span>
                  </div>
                </button>
              )
            })}
          </div>
        </aside>

        <main className="flex-1 bg-white rounded-2xl border border-slate-200 p-6 min-h-[500px] shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
          {!activeTask ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 py-20">
              <div className="w-20 h-20 mb-5 rounded-3xl bg-slate-50 flex items-center justify-center">
                <BookOpen className="w-10 h-10 opacity-40" />
              </div>
              <div className="text-base font-semibold text-slate-600">选择一个任务开始学习</div>
              <div className="text-sm mt-1.5">从左侧任务列表中选择一个任务</div>
            </div>
          ) : (
            <div>
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

              <div className="flex flex-wrap items-center gap-6 mb-8 text-sm text-slate-500">
                <span className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100"><Clock className="w-4 h-4 text-blue-500" /> {activeTask.estimatedHours || 0} 课时</span>
                <span className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100"><BarChart3 className="w-4 h-4 text-violet-500" />
                  {difficultyMap[activeTask.difficulty]?.label || `Lv.${activeTask.difficulty}`}
                </span>
              </div>

              {(activeTask.background || activeTask.description || activeTask.detailedDescription) && (
                <div className="space-y-6 mb-8">
                  {activeTask.background && (
                    <div className="bg-slate-50 rounded-xl p-5 border border-slate-100">
                      <h3 className="text-[15px] font-bold text-slate-800 mb-3 flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-blue-100 flex items-center justify-center">
                          <FileText className="w-3.5 h-3.5 text-blue-600" />
                        </div>
                        任务背景
                      </h3>
                      <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{activeTask.background}</p>
                    </div>
                  )}
                  {(activeTask.detailedDescription || activeTask.description) && (
                    <div className="bg-slate-50 rounded-xl p-5 border border-slate-100">
                      <h3 className="text-[15px] font-bold text-slate-800 mb-3 flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-violet-100 flex items-center justify-center">
                          <FileText className="w-3.5 h-3.5 text-violet-600" />
                        </div>
                        任务描述
                      </h3>
                      <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                        {activeTask.detailedDescription || activeTask.description}
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center gap-4 pt-6 border-t border-slate-100">
                {activeTask?.dependencyIds?.length > 0 && (
                  <div className="text-sm text-slate-400 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                    前置依赖任务：{activeTask.dependencyIds.length} 个
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      <PlatformFooter />
    </div>
  )
}
