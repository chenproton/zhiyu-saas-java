"use client"

import { useMemo } from "react"
import { Layers, Sparkles, Target } from "lucide-react"
import type { PositionResponsibility, PositionAbilityBinding } from "@/lib/types"

interface AbilityTreeProps {
  responsibilities: PositionResponsibility[]
  bindings: PositionAbilityBinding[]
}

const categoryLabels: Record<string, string> = {
  knowledge: "知识",
  skill: "技能",
  quality: "素养",
}

const levelColors: Record<string, string> = {
  了解: "bg-slate-100 text-slate-600",
  理解: "bg-blue-50 text-blue-600",
  掌握: "bg-green-50 text-green-600",
  熟练: "bg-amber-50 text-amber-600",
  精通: "bg-red-50 text-red-600",
}

export function AbilityTree({ responsibilities, bindings }: AbilityTreeProps) {
  const grouped = useMemo(() => {
    const map = new Map<string, PositionAbilityBinding[]>()
    responsibilities.forEach((r) => map.set(r.id, []))
    bindings.forEach((b) => {
      const list = map.get(b.responsibilityId) || []
      list.push(b)
      map.set(b.responsibilityId, list)
    })
    return responsibilities.map((r) => ({
      responsibility: r,
      abilities: map.get(r.id) || [],
    }))
  }, [responsibilities, bindings])

  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-5 border border-blue-100">
        <div className="flex items-center gap-2 text-blue-800 font-bold mb-2">
          <Sparkles className="w-5 h-5" />
          能力模型说明
        </div>
        <p className="text-sm text-[#475569]">
          本岗位基于真实企业岗位标准，拆解为若干工作职责，每个职责下关联对应的能力点与胜任等级，帮助学生明确学习目标。
        </p>
      </div>

      {grouped.length === 0 && (
        <div className="text-center py-12 text-[#94a3b8] bg-white rounded-2xl border border-[#e7e5e4]">
          <Layers className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <div>暂无能力模型数据</div>
        </div>
      )}

      {grouped.map(({ responsibility, abilities }) => (
        <div key={responsibility.id} className="bg-white rounded-2xl border border-[#e7e5e4] p-5">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center text-white shrink-0">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#0f172a]">{responsibility.name}</h3>
              {responsibility.description && (
                <p className="text-sm text-[#64748b] mt-1">{responsibility.description}</p>
              )}
            </div>
          </div>

          {abilities.length === 0 ? (
            <div className="text-sm text-[#94a3b8] py-2">该职责暂无关联能力点</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {abilities.map((ab) => (
                <div
                  key={ab.id}
                  className="flex items-start justify-between gap-3 p-3 rounded-xl bg-[#f8fafc] border border-[#f1f5f9]"
                >
                  <div>
                    <div className="text-sm font-semibold text-[#0f172a]">{ab.name}</div>
                    {ab.rubricDescription && (
                      <div className="text-xs text-[#64748b] mt-1 line-clamp-2">{ab.rubricDescription}</div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`text-[11px] px-2 py-0.5 rounded-full ${levelColors[ab.requiredLevel] || "bg-slate-100 text-slate-600"}`}>
                      {ab.requiredLevel}
                    </span>
                    {ab.domain && (
                      <span className="text-[10px] text-[#94a3b8]">{ab.domain}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
