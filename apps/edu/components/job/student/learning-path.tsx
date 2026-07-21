"use client"

import { useMemo, useState } from "react"
import { Route, ChevronLeft, ChevronRight, BookOpen } from "lucide-react"
import type { LearnRoad } from "@/lib/types"

interface LearningPathProps {
  roads: LearnRoad[]
}

const DEFAULT_STEPS = [
  { name: "基础认知", icon: "fa-route", description: "了解岗位核心职责与行业背景" },
  { name: "工具掌握", icon: "fa-route", description: "掌握岗位必备的专业工具与技术栈" },
  { name: "场景实战", icon: "fa-route", description: "在真实业务场景中完成项目任务" },
  { name: "综合进阶", icon: "fa-route", description: "独立承担复杂任务并输出成果" },
  { name: "岗位认证", icon: "fa-route", description: "通过能力评估获得岗位能力认证" },
]

export function LearningPath({ roads }: LearningPathProps) {
  const [activeIndex, setActiveIndex] = useState(0)

  const road = roads[0]
  const steps = useMemo(() => {
    if (!road || !road.steps || road.steps.length === 0) return DEFAULT_STEPS
    return road.steps.map((s) => ({ name: s.name, description: s.description || "", icon: "fa-route" }))
  }, [road])

  const navigate = (dir: number) => {
    const next = activeIndex + dir
    if (next >= 0 && next < steps.length) setActiveIndex(next)
  }

  return (
    <div className="bg-white rounded-2xl border border-[#e7e5e4] p-6">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-blue-600 font-bold text-lg mb-2">
          <Route className="w-5 h-5" />
          {road ? road.name : "岗位学习路径"}
        </div>
        <p className="text-sm text-[#64748b]">
          {road?.description || "沿着学习路线，从起点站出发，逐步通关实践场景，抵达能力认证终点站"}
        </p>
      </div>

      <div className="relative">
        <button
          onClick={() => navigate(-1)}
          disabled={activeIndex === 0}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white border border-[#e7e5e4] flex items-center justify-center text-[#64748b] hover:border-blue-500 hover:text-blue-500 disabled:opacity-30"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          onClick={() => navigate(1)}
          disabled={activeIndex === steps.length - 1}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white border border-[#e7e5e4] flex items-center justify-center text-[#64748b] hover:border-blue-500 hover:text-blue-500 disabled:opacity-30"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        <div className="overflow-hidden px-10">
          <div
            className="flex gap-4 transition-transform duration-300"
            style={{ transform: `translateX(-${activeIndex * 160}px)` }}
          >
            {steps.map((step, i) => {
              const isStart = i === 0
              const isEnd = i === steps.length - 1
              const isActive = i === activeIndex
              return (
                <div
                  key={i}
                  onClick={() => setActiveIndex(i)}
                  className={`
                    shrink-0 w-[140px] p-4 rounded-xl border-2 cursor-pointer transition-all text-center
                    ${isActive ? "border-blue-500 bg-blue-50" : "border-[#e7e5e4] bg-white hover:border-blue-300"}
                  `}
                >
                  <div className={`
                    w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2 text-white
                    ${isActive ? "bg-blue-500" : isStart ? "bg-green-500" : isEnd ? "bg-violet-500" : "bg-slate-400"}
                  `}>
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div className="text-xs font-bold text-[#0f172a] mb-1 truncate">{step.name}</div>
                  <div className="text-[10px] text-[#94a3b8]">
                    {isStart ? "START · 起点" : isEnd ? "GOAL · 终点" : `第${i}站`}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="mt-6 p-4 rounded-xl bg-[#f8fafc] border border-[#f1f5f9]">
        <div className="text-sm font-bold text-[#0f172a] mb-1">
          {steps[activeIndex]?.name} {activeIndex === 0 ? "（起点）" : activeIndex === steps.length - 1 ? "（终点）" : ""}
        </div>
        <p className="text-sm text-[#64748b]">{steps[activeIndex]?.description || "暂无步骤说明"}</p>
      </div>
    </div>
  )
}
