"use client"

import { useMemo, useState } from "react"
import { Layers, Sparkles, Target, ChevronDown, ChevronUp, X } from "lucide-react"
import type { PositionResponsibility, PositionAbilityBinding, AbilityPoint, AbilityDomain } from "@/lib/types/job"

interface AbilityTreeProps {
  responsibilities: PositionResponsibility[]
  bindings: PositionAbilityBinding[]
  abilityPoints: AbilityPoint[]
  abilityDomains?: AbilityDomain[]
}

export function AbilityTree({ responsibilities, bindings, abilityPoints, abilityDomains }: AbilityTreeProps) {
  const [selectedAbility, setSelectedAbility] = useState<{ abilityPointId: string; name: string; desc?: string; attributes?: string[] } | null>(null)

  const abilityInfoMap = useMemo(() => {
    const map: Record<string, { name: string; desc: string; attributes: string[] }> = {}
    abilityPoints.forEach((a) => {
      map[a.id] = {
        name: a.name,
        desc: a.description || "",
        attributes: a.attributes || [],
      }
    })
    return map
  }, [abilityPoints])

  const groupedByDomain = useMemo(() => {
    const groups = new Map<string, (PositionAbilityBinding & { name: string })[]>()

    if (abilityDomains && abilityDomains.length > 0) {
      abilityDomains.forEach((d) => groups.set(d.name, []))
      bindings.forEach((b) => {
        const domain = abilityDomains.find((d) => d.bindingIds.includes(b.id))?.name || b.domain || "其他"
        const info = abilityInfoMap[b.abilityPointId]
        const name = info?.name || b.domain || "未命名能力"
        const list = groups.get(domain) || []
        list.push({ ...b, name })
        groups.set(domain, list)
      })
    } else {
      bindings.forEach((b) => {
        const domain = b.domain || "综合能力"
        const info = abilityInfoMap[b.abilityPointId]
        const name = info?.name || "未命名能力"
        const list = groups.get(domain) || []
        list.push({ ...b, name })
        groups.set(domain, list)
      })
    }

    return Array.from(groups.entries())
      .map(([domain, items]) => ({ domain, items }))
      .filter((g) => g.items.length > 0)
  }, [bindings, abilityDomains, abilityInfoMap])

  if (groupedByDomain.length === 0) {
    return (
      <div className="text-center py-12 text-[#94a3b8] bg-white rounded-2xl border border-[#e7e5e4]">
        <Layers className="w-12 h-12 mx-auto mb-3 opacity-40" />
        <div>暂无能力模型数据</div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-5 border border-blue-100">
        <div className="flex items-center gap-2 text-blue-800 font-bold mb-2">
          <Sparkles className="w-5 h-5" />
          能力模型说明
        </div>
        <p className="text-sm text-[#475569]">
          本岗位基于真实企业岗位标准，拆解为若干能力领域，每个领域下关联对应的能力点与胜任等级，帮助学生明确学习目标。
        </p>
      </div>

      <div className="text-sm text-[#64748b] mb-2">
        共 <strong className="text-blue-500">{groupedByDomain.length}</strong> 个能力领域，
        <strong className="text-blue-500">{bindings.length}</strong> 个能力点
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {groupedByDomain.map(({ domain, items }) => (
          <div key={domain} className="border border-[#f5f5f4] rounded-xl overflow-hidden bg-white">
            <div className="bg-[#eff6ff] px-4 py-3 font-medium text-blue-600 flex items-center gap-2 text-sm">
              <Target className="w-4 h-4" />
              {domain}
            </div>
            <div className="p-3">
              {items.map((ab) => {
                const info = abilityInfoMap[ab.abilityPointId]
                return (
                  <div
                    key={ab.id}
                    className="flex items-start justify-between py-2 px-2 border-b border-[#f5f5f5] last:border-b-0 rounded hover:bg-[#eff6ff] cursor-pointer transition-colors gap-2"
                    onClick={() => setSelectedAbility({ abilityPointId: ab.abilityPointId, name: ab.name, desc: info?.desc || "", attributes: info?.attributes || [] })}
                  >
                    <div className="flex flex-col min-w-0 gap-1">
                      <span className="text-sm text-[#1f2937] truncate">{ab.name}</span>
                      <span className="text-[10px] text-[#94a3b8] truncate font-mono">ID：{ab.abilityPointId}</span>
                      {(info?.attributes?.length ?? 0) > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {info.attributes.map((attr) => (
                            <span key={attr} className="text-[10px] px-1.5 py-0.5 rounded bg-[#f1f5f9] text-[#64748b]">
                              {attr}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {selectedAbility && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setSelectedAbility(null)}>
          <div className="bg-white rounded-2xl w-[440px] max-w-[95vw] p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="text-base font-semibold text-[#1f2937] flex items-center gap-2">
                  {selectedAbility.name}
                </div>
                <div className="text-xs text-[#94a3b8] mt-1 font-mono">ID：{selectedAbility.abilityPointId}</div>
              </div>
              <button className="text-[#94a3b8] hover:text-[#1f2937]" onClick={() => setSelectedAbility(null)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-[#64748b] leading-relaxed mb-3">{selectedAbility.desc || "暂无能力点说明"}</p>
            {(selectedAbility.attributes?.length ?? 0) > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedAbility.attributes?.map((attr) => (
                  <span key={attr} className="text-xs px-2 py-1 rounded bg-[#f1f5f9] text-[#64748b]">
                    {attr}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
