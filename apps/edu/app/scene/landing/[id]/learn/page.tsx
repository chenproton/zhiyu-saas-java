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

const difficultyMap: Record<number, { color: string; label: string }> = {
  1: { color: "#22c55e", label: "入门" },
  2: { color: "#eab308", label: "初级" },
  3: { color: "#f97316", label: "中级" },
  4: { color: "#ef4444", label: "高级" },
  5: { color: "#8b5cf6", label: "专家" },
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

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-[#f5f5f5]">
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
      <div className="min-h-screen flex flex-col bg-[#f5f5f5]">
        <div className="flex-1 flex flex-col items-center justify-center text-[#94a3b8]">
          <div className="text-lg font-semibold text-[#475569]">场景不存在</div>
          <Link href="/scene/landing" className="text-blue-600 hover:underline mt-2">返回场景列表</Link>
        </div>
        <PlatformFooter />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#f5f5f5]">
      <header className="bg-white border-b border-[#f0f0f0] shrink-0">
        <div className="max-w-[1400px] mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href={`/scene/landing/${id}`} className="flex items-center gap-1.5 text-sm text-[#64748b] hover:text-blue-600 transition-colors">
              <ArrowLeft className="w-4 h-4" />
              {scenario.name}
            </Link>
          </div>
          <div className="flex items-center gap-3 text-sm text-[#64748b]">
            <span>{tasks.length} 个任务</span>
            <span>·</span>
            <span>{tasks.reduce((s, t) => s + (t.estimatedHours || 0), 0)} 课时</span>
          </div>
        </div>
      </header>

      <div className="flex-1 flex max-w-[1400px] mx-auto w-full px-6 py-6 gap-6">
        <aside className="w-[280px] shrink-0 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#1f2937] px-1 mb-1">
            <ListChecks className="w-4 h-4 text-blue-500" />
            任务列表
          </div>
          {tasks.map((task, idx) => (
            <button
              key={task.id}
              onClick={() => setActiveTaskId(task.id)}
              className={`
                text-left p-3.5 rounded-lg border transition-all cursor-pointer
                ${activeTaskId === task.id
                  ? "border-blue-300 bg-[#eff6ff] shadow-sm"
                  : "border-[#f0f0f0] bg-white hover:border-blue-200 hover:bg-[#fafafa]"
                }
              `}
            >
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  activeTaskId === task.id ? "bg-blue-500 text-white" : "bg-[#f1f5f9] text-[#64748b]"
                }`}>
                  {idx + 1}
                </div>
                <div className="text-[13px] font-medium text-[#1f2937] truncate flex-1">{task.name}</div>
              </div>
              <div className="flex items-center gap-3 ml-8 text-[11px] text-[#94a3b8]">
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{task.estimatedHours || 0}h</span>
                <span className="flex items-center gap-1"><BarChart3 className="w-3 h-3" />Lv.{task.difficulty}</span>
              </div>
            </button>
          ))}
        </aside>

        <main className="flex-1 bg-white rounded-xl border border-[#f0f0f0] p-6 min-h-[500px]">
          {!activeTask ? (
            <div className="flex flex-col items-center justify-center h-full text-[#94a3b8] py-20">
              <BookOpen className="w-16 h-16 mb-4 opacity-30" />
              <div className="text-base font-medium text-[#475569]">选择一个任务开始学习</div>
              <div className="text-sm mt-1">从左侧任务列表中选择一个任务</div>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] px-2 py-0.5 rounded text-xs"
                  style={{
                    backgroundColor: activeTask.taskType === "assessment" ? "#fef2f2" : "#eff6ff",
                    color: activeTask.taskType === "assessment" ? "#dc2626" : "#2563eb",
                  }}
                >
                  {activeTask.taskType === "assessment" ? "考核任务" : "训练任务"}
                </span>
                {activeTask.code && <span className="text-xs text-[#94a3b8]">{activeTask.code}</span>}
              </div>
              <h1 className="text-2xl font-bold text-[#1f2937] mb-4">{activeTask.name}</h1>

              <div className="flex items-center gap-6 mb-6 text-sm text-[#64748b]">
                <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" /> {activeTask.estimatedHours || 0} 课时</span>
                <span className="flex items-center gap-1.5"><BarChart3 className="w-4 h-4" />
                  {difficultyMap[activeTask.difficulty]?.label || `Lv.${activeTask.difficulty}`}
                </span>
              </div>

              {(activeTask.background || activeTask.description || activeTask.detailedDescription) && (
                <div className="space-y-4 mb-8">
                  {activeTask.background && (
                    <div>
                      <h3 className="text-[15px] font-semibold text-[#1f2937] mb-2 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-blue-500" /> 任务背景
                      </h3>
                      <p className="text-sm text-[#475569] leading-relaxed whitespace-pre-wrap">{activeTask.background}</p>
                    </div>
                  )}
                  {(activeTask.detailedDescription || activeTask.description) && (
                    <div>
                      <h3 className="text-[15px] font-semibold text-[#1f2937] mb-2 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-blue-500" /> 任务描述
                      </h3>
                      <p className="text-sm text-[#475569] leading-relaxed whitespace-pre-wrap">
                        {activeTask.detailedDescription || activeTask.description}
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center gap-4 pt-6 border-t border-[#f0f0f0]">
                {activeTask?.dependencyIds?.length > 0 && (
                  <div className="text-sm text-[#94a3b8]">
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
