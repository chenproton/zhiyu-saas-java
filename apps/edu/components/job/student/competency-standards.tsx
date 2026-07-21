"use client"

import { useMemo, useRef, useState, useEffect } from "react"
import { Target } from "lucide-react"
import type { PositionResponsibility, PositionAbilityBinding, AbilityPoint } from "@/lib/types/job"

interface CompetencyStandardsProps {
  responsibilities: PositionResponsibility[]
  bindings: PositionAbilityBinding[]
  abilityPoints: AbilityPoint[]
}

const LEVELS = [
  { label: "了解", value: "了解", en: "understand" },
  { label: "理解", value: "理解", en: "comprehend" },
  { label: "掌握", value: "掌握", en: "master" },
  { label: "熟练", value: "熟练", en: "proficient" },
  { label: "精通", value: "精通", en: "expert" },
]

function resolveLevelIndex(level?: string) {
  if (!level) return 2
  const normalized = level.trim().toLowerCase()
  const idx = LEVELS.findIndex((l) => l.value === level || l.en === normalized)
  return idx >= 0 ? idx : 2
}

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
                  const targetIdx = resolveLevelIndex(item.requiredLevel)
                  const targetLabel = LEVELS[targetIdx]?.label || item.requiredLevel
                  return (
                    <div key={item.id} className="bg-white border border-[#f5f5f4] rounded-xl p-4 hover:border-blue-200 hover:shadow-sm transition-all">
                      <div className="text-sm font-semibold text-[#1f2937] mb-3">{item.name}</div>

                      <div className="relative mb-6 mx-1" style={{ height: 38 }}>
                        <div className="absolute top-2 left-0 right-0 h-2 bg-[#f5f5f4] rounded-full" style={{ margin: "0 5px" }} />
                        <div
                          className="absolute top-2 left-0 h-2 rounded-full transition-all duration-300"
                          style={{
                            width: `calc(${(Math.max(0, targetIdx) / (LEVELS.length - 1)) * 100}% - 10px)`,
                            background: "linear-gradient(90deg, #6366f1, #a78bfa)",
                            marginLeft: 5,
                          }}
                        />
                        <div className="absolute top-[4px] left-0 right-0 flex justify-between" style={{ padding: "0 5px" }}>
                          {LEVELS.map((level, idx) => {
                            const isTarget = idx === targetIdx
                            const isReached = idx <= targetIdx
                            return (
                              <div
                                key={level.value}
                                className={`w-3.5 h-3.5 rounded-full border-2 transition-all ${
                                  isTarget
                                    ? "border-indigo-500 bg-white ring-2 ring-indigo-200 scale-110"
                                    : isReached
                                      ? "border-indigo-300 bg-indigo-200"
                                      : "border-[#e2e8f0] bg-white"
                                }`}
                              />
                            )
                          })}
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 flex justify-between" style={{ padding: "0 5px" }}>
                          {LEVELS.map((level, idx) => (
                            <span
                              key={level.value}
                              className={`text-[10px] font-medium transition-colors ${
                                idx === targetIdx ? "text-indigo-600" : idx <= targetIdx ? "text-indigo-400" : "text-[#cbd5e1]"
                              }`}
                            >
                              {level.label}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-[#64748b] mb-2">
                        <Target className="w-3 h-3" />
                        目标等级：
                        <span className="px-2 py-0.5 rounded bg-[#eff6ff] text-blue-600 font-medium">
                          {targetLabel}
                        </span>
                      </div>

                      {item.rubricDescription && (
                        <div className="text-xs text-[#64748b] leading-relaxed p-2.5 bg-[#fafafa] rounded-md border-l-[3px] border-blue-500 mt-3">
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
