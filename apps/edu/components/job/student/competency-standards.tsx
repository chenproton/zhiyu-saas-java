"use client"

import { useMemo, useRef, useState, useEffect } from "react"
import { Target, CheckCircle, TrendingUp, AlertCircle, Flag } from "lucide-react"
import type { PositionResponsibility, PositionAbilityBinding, AbilityPoint } from "@/lib/types/job"

interface CompetencyStandardsProps {
  responsibilities: PositionResponsibility[]
  bindings: PositionAbilityBinding[]
  abilityPoints: AbilityPoint[]
}

const LEVELS = ["了解", "理解", "掌握", "熟练", "精通"]

export function CompetencyStandards({ responsibilities, bindings, abilityPoints }: CompetencyStandardsProps) {
  const contentRef = useRef<HTMLDivElement>(null)
  const [activeId, setActiveId] = useState<string>("")

  const abilityNameMap = useMemo(() => {
    const map: Record<string, string> = {}
    abilityPoints.forEach((a) => { map[a.id] = a.name })
    return map
  }, [abilityPoints])

  const groups = useMemo(() => {
    const map = new Map<string, (PositionAbilityBinding & { name: string })[]>()
    responsibilities.forEach((r) => map.set(r.name, []))
    bindings.forEach((b) => {
      const resp = responsibilities.find((r) => r.id === b.responsibilityId)
      const key = resp?.name || b.domain || "其他"
      const list = map.get(key) || []
      list.push({ ...b, name: abilityNameMap[b.abilityPointId] || "未命名能力" })
      map.set(key, list)
    })
    return Array.from(map.entries())
      .map(([duty, items]) => ({ duty, items }))
      .filter((g) => g.items.length > 0)
  }, [responsibilities, bindings, abilityNameMap])

  useEffect(() => {
    if (groups.length > 0 && !activeId) setActiveId(groups[0].duty)
  }, [groups, activeId])

  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    const onScroll = () => {
      let current = ""
      groups.forEach((g) => {
        const sec = document.getElementById(`comp-sec-${g.duty}`)
        if (sec) {
          const top = sec.offsetTop - el.offsetTop
          if (el.scrollTop >= top - 50) current = g.duty
        }
      })
      if (current) setActiveId(current)
    }
    el.addEventListener("scroll", onScroll)
    return () => el.removeEventListener("scroll", onScroll)
  }, [groups])

  const scrollTo = (duty: string) => {
    const sec = document.getElementById(`comp-sec-${duty}`)
    const container = contentRef.current
    if (sec && container) {
      container.scrollTo({ top: sec.offsetTop - container.offsetTop, behavior: "smooth" })
    }
  }

  if (groups.length === 0) {
    return (
      <div className="text-center py-12 text-[#94a3b8]">
        <Target className="w-12 h-12 mx-auto mb-3 opacity-40" />
        <div>暂无胜任标准数据</div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-[#64748b]">
          全览岗位 <strong className="text-blue-500">{bindings.length}</strong> 个关键能力点胜任标准
        </span>
        <div className="flex items-center gap-4 text-xs text-[#64748b]">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-500" />已达成等级</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#9ca3af]" />目标等级</span>
        </div>
      </div>

      <div className="flex gap-6 h-[600px]">
        {/* Sidebar */}
        <div className="w-60 shrink-0 bg-[#fafafa] rounded-xl p-2 border border-[#f5f5f4] h-full overflow-y-auto">
          {groups.map((g) => (
            <button
              key={g.duty}
              onClick={() => scrollTo(g.duty)}
              className={`w-full text-left px-4 py-3 rounded-md text-sm transition-colors mb-1 ${
                activeId === g.duty ? "bg-[#eff6ff] text-blue-600 font-medium" : "text-[#64748b] hover:bg-[#eff6ff] hover:text-blue-600"
              }`}
            >
              {g.duty}
            </button>
          ))}
        </div>

        {/* Content */}
        <div ref={contentRef} className="flex-1 h-full overflow-y-auto pr-4">
          {groups.map((g) => (
            <div key={g.duty} id={`comp-sec-${g.duty}`} className="mb-10 pt-2">
              <div className="text-base font-semibold text-[#1f2937] mb-4 pb-3 border-b border-[#f5f5f4] flex items-center gap-2">
                <Target className="w-4 h-4 text-blue-500" />
                {g.duty}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {g.items.map((item) => {
                  const target = Math.max(1, Math.min(5, LEVELS.indexOf(item.requiredLevel) + 1 || 3))
                  const current = Math.max(1, Math.min(target, Math.floor(Math.random() * target) + 1))
                  const fillPct = ((current - 1) / 4) * 100
                  const gap = target - current
                  const status = gap > 0 ? "not-achieved" : gap < 0 ? "exceeded" : "achieved"
                  const statusColor = status === "achieved" || status === "exceeded" ? "#52c41a" : "#f59e0b"

                  return (
                    <div key={item.id} className="bg-white border border-[#f5f5f4] rounded-xl p-4 hover:border-blue-200 hover:shadow-sm transition-all">
                      <div className="text-sm font-semibold text-[#1f2937] mb-3">{item.name}</div>
                      <div className="flex items-center justify-between text-xs text-[#64748b] mb-2">
                        <span className="flex items-center gap-1"><Target className="w-3 h-3" /> 目标：<strong>{LEVELS[target - 1]}</strong> · 当前：<span style={{ color: statusColor }}>{LEVELS[current - 1]}</span></span>
                        <span style={{ color: statusColor }} className="flex items-center gap-1">
                          {status === "achieved" && <><CheckCircle className="w-3 h-3" /> 已达成</>}
                          {status === "exceeded" && <><TrendingUp className="w-3 h-3" /> 已超越</>}
                          {status === "not-achieved" && <><AlertCircle className="w-3 h-3" /> 差 {gap} 级</>}
                        </span>
                      </div>
                      <div className="relative h-1.5 bg-[#f5f5f4] rounded-full mb-3">
                        <div
                          className="absolute top-0 left-0 h-full rounded-full"
                          style={{ width: `${fillPct}%`, background: `linear-gradient(90deg, #3b82f6, #60a5fa)` }}
                        />
                        {LEVELS.map((lvl, i) => {
                          const idx = i + 1
                          const reached = idx <= current
                          const isTarget = idx === target
                          return (
                            <div key={lvl} className="absolute top-1/2 -translate-y-1/2" style={{ left: `${(i / 4) * 100}%` }}>
                              {isTarget && (
                                <div className="absolute -top-5 -translate-x-1/2">
                                  <div className="w-4 h-4 rounded-full bg-[#9ca3af] flex items-center justify-center text-white text-[8px]">
                                    <Flag className="w-2.5 h-2.5" />
                                  </div>
                                </div>
                              )}
                              <div
                                className={`w-3.5 h-3.5 rounded-full border-2 -translate-x-1/2 ${
                                  reached ? "border-blue-500 bg-blue-500" : isTarget ? "border-[#9ca3af] bg-white" : "border-[#d9d9d9] bg-white"
                                }`}
                              />
                              <div className={`absolute top-4 -translate-x-1/2 text-[11px] whitespace-nowrap ${reached ? "text-blue-500 font-medium" : "text-[#94a3b8]"}`}>
                                {lvl}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                      {item.rubricDescription && (
                        <div className="text-xs text-[#64748b] leading-relaxed p-2.5 bg-[#fafafa] rounded-md border-l-[3px] border-blue-500 mt-5">
                          {item.rubricDescription}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
