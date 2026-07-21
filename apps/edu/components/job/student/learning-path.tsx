"use client"

import { useMemo, useRef, useState, useEffect } from "react"
import { Route, ChevronLeft, ChevronRight, Flag, ShoppingCart, Smartphone, LineChart, GitBranch, Users, Trophy } from "lucide-react"
import type { LearnRoad } from "@/lib/types"

interface LearningPathProps {
  roads: LearnRoad[]
}

const DEFAULT_STEPS = [
  { name: "基础认知", description: "了解岗位核心职责与行业背景" },
  { name: "工具掌握", description: "掌握岗位必备的专业工具与技术栈" },
  { name: "场景实战", description: "在真实业务场景中完成项目任务" },
  { name: "综合进阶", description: "独立承担复杂任务并输出成果" },
  { name: "岗位认证", description: "通过能力评估获得岗位能力认证" },
]

const ICONS = [Flag, ShoppingCart, Smartphone, LineChart, GitBranch, Users, Trophy]
const COLORS = [
  "linear-gradient(135deg, #3b82f6, #60a5fa)",
  "linear-gradient(135deg, #52c41a, #73d13d)",
  "linear-gradient(135deg, #f59e0b, #ffc53d)",
  "linear-gradient(135deg, #eb2f96, #f759ab)",
  "linear-gradient(135deg, #722ed1, #b37feb)",
  "linear-gradient(135deg, #fa541c, #ff7a45)",
  "linear-gradient(135deg, #fadb14, #ffec3d)",
]

export function LearningPath({ roads }: LearningPathProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const trackRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const road = roads[0]
  const steps = useMemo(() => {
    if (!road || !road.steps || road.steps.length === 0) return DEFAULT_STEPS
    return road.steps.map((s) => ({ name: s.name, description: s.description || "" }))
  }, [road])

  useEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) return
    const onScroll = () => {
      const thumb = wrapper.querySelector("[data-thumb]") as HTMLElement | null
      if (!thumb) return
      const maxScroll = wrapper.scrollWidth - wrapper.clientWidth
      const pct = maxScroll > 0 ? wrapper.scrollLeft / maxScroll : 0
      const maxTranslate = 40 - 20
      thumb.style.transform = `translateX(${pct * maxTranslate}px)`
    }
    wrapper.addEventListener("scroll", onScroll)
    return () => wrapper.removeEventListener("scroll", onScroll)
  }, [])

  const navigate = (dir: number) => {
    const next = activeIndex + dir
    if (next >= 0 && next < steps.length) {
      setActiveIndex(next)
      const item = trackRef.current?.children[next]
      if (item) item.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" })
    }
  }

  return (
    <div>
      <div className="text-center mb-6">
        <h2 className="text-xl font-semibold text-[#1f2937] mb-2 flex items-center justify-center gap-2">
          <Route className="w-5 h-5 text-blue-500" />
          {road ? road.name : "岗位学习路径"}
        </h2>
        <p className="text-[13px] text-[#64748b]">
          {road?.description || "沿着学习路线，从起点站出发，逐步通关实践场景，抵达能力认证终点站"}
        </p>
      </div>

      <div className="relative px-10 pb-6 overflow-hidden">
        <button
          onClick={() => navigate(-1)}
          disabled={activeIndex === 0}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white border border-[#e0e0e0] flex items-center justify-center text-[#64748b] hover:border-blue-500 hover:text-blue-500 disabled:opacity-30 shadow-sm"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          onClick={() => navigate(1)}
          disabled={activeIndex === steps.length - 1}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white border border-[#e0e0e0] flex items-center justify-center text-[#64748b] hover:border-blue-500 hover:text-blue-500 disabled:opacity-30 shadow-sm"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        <div ref={wrapperRef} className="overflow-x-auto pb-6 hide-scrollbar">
          <div ref={trackRef} className="flex items-start min-w-max px-4 py-5 relative">
            <div
              className="absolute top-[56px] left-20 right-20 h-[3px] rounded"
              style={{ background: "linear-gradient(90deg, #3b82f6, #52c41a, #f59e0b, #eb2f96, #722ed1, #fa541c, #fadb14)" }}
            />

            {steps.map((step, i) => {
              const isStart = i === 0
              const isEnd = i === steps.length - 1
              const isActive = i === activeIndex
              const Icon = ICONS[i % ICONS.length]
              const label = isStart ? "START · 起点" : isEnd ? "GOAL · 终点" : `第${i}站`
              const meta = isEnd ? "达成认证" : `${(step.description?.length || 0) % 6 + 3}任务 · ${(step.name.length % 4) + 6}课时`

              return (
                <div
                  key={i}
                  onClick={() => { setActiveIndex(i) }}
                  className={`flex flex-col items-center min-w-[180px] px-6 pb-5 relative z-10 cursor-pointer ${isActive ? "active" : ""}`}
                >
                  {(isStart || isEnd) && (
                    <div className="absolute -top-7 text-xs text-[#94a3b8] font-medium whitespace-nowrap">
                      {label}
                    </div>
                  )}
                  <div
                    className={`w-[72px] h-[72px] rounded-full flex items-center justify-center text-white text-[28px] mb-4 transition-all shadow-lg ${
                      isActive ? "scale-110" : ""
                    }`}
                    style={{ background: COLORS[i % COLORS.length], boxShadow: isActive ? "0 6px 24px rgba(245,158,11,0.35)" : "0 4px 16px rgba(0,0,0,0.2)" }}
                  >
                    <Icon className="w-7 h-7" />
                  </div>
                  <div className={`text-[15px] font-semibold text-center whitespace-nowrap mb-1 ${isActive ? "text-blue-500" : "text-[#1f2937]"}`}>
                    {step.name}
                  </div>
                  <div className="text-[13px] text-[#94a3b8] text-center whitespace-nowrap">{meta}</div>
                </div>
              )
            })}
          </div>

          {/* Scroll thumb */}
          <div className="w-10 h-1 bg-[#e0e0e0] rounded mx-auto overflow-hidden">
            <div data-thumb className="w-5 h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded transition-transform" />
          </div>
        </div>
      </div>

      <div className="mt-4 p-5 rounded-xl bg-[#f8fafc] border border-[#f1f5f9]">
        <div className="text-sm font-semibold text-[#1f2937] mb-1">
          {steps[activeIndex]?.name} {activeIndex === 0 ? "（起点）" : activeIndex === steps.length - 1 ? "（终点）" : ""}
        </div>
        <p className="text-sm text-[#64748b]">{steps[activeIndex]?.description || "暂无步骤说明"}</p>
      </div>

      <style jsx>{`
        .hide-scrollbar::-webkit-scrollbar {
          height: 6px;
        }
        .hide-scrollbar::-webkit-scrollbar-thumb {
          background: #d9d9d9;
          border-radius: 3px;
        }
        .hide-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
      `}</style>
    </div>
  )
}
