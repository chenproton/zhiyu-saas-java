"use client"

import { useMemo, useState } from "react"
import { ListChecks, ChevronLeft, ChevronRight, X, Star } from "lucide-react"
import type { PositionResponsibility, PositionAbilityBinding, AbilityPoint } from "@/lib/types/job"
import { Button } from "@/components/ui/button"

interface DutyTableProps {
  responsibilities: PositionResponsibility[]
  bindings: PositionAbilityBinding[]
  abilityPoints: AbilityPoint[]
  requirements: string[]
}

const LEVELS = ["了解", "理解", "掌握", "熟练", "精通"]
const DOMAIN_COLORS: Record<string, [string, string]> = {
  "专业工具": ["#3b82f6", "#60a5fa"],
  "团队协作": ["#10b981", "#34d399"],
  "通用素质": ["#f59e0b", "#fbbf24"],
  "业务洞察": ["#8b5cf6", "#a78bfa"],
  "创新思维": ["#ec4899", "#f472b6"],
}
const LEVEL_COLORS: Record<string, string> = {
  "了解": "#94a3b8",
  "理解": "#60a5fa",
  "掌握": "#34d399",
  "熟练": "#fbbf24",
  "精通": "#f87171",
}

export function DutyTable({ responsibilities, bindings, abilityPoints, requirements }: DutyTableProps) {
  const [modalDuty, setModalDuty] = useState<PositionResponsibility | null>(null)
  const [page, setPage] = useState(0)

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

  const abilityNameMap = useMemo(() => {
    const map: Record<string, string> = {}
    abilityPoints.forEach((a) => { map[a.id] = a.name })
    return map
  }, [abilityPoints])

  const modalAbilities = useMemo(() => {
    if (!modalDuty) return []
    const items = grouped.find((g) => g.responsibility.id === modalDuty.id)?.abilities || []
    return items.map((ab) => ({
      ...ab,
      name: abilityNameMap[ab.abilityPointId] || ab.domain || "未命名能力",
    }))
  }, [modalDuty, grouped, abilityNameMap])

  const perPage = 6
  const totalPages = Math.max(1, Math.ceil(modalAbilities.length / perPage))
  const pageItems = modalAbilities.slice(page * perPage, (page + 1) * perPage)

  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-base font-medium text-[#1f2937] mb-4 flex items-center gap-2">
          <ListChecks className="w-5 h-5 text-blue-500" />
          岗位职责(<strong className="text-blue-500 mx-1">{responsibilities.length || requirements.length}</strong>项)
        </h4>

        {responsibilities.length > 0 ? (
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#fafafa]">
                <th className="text-left p-4 text-sm font-medium text-[#64748b] w-24">编号</th>
                <th className="text-left p-4 text-sm font-medium text-[#64748b]">职责描述</th>
                <th className="text-left p-4 text-sm font-medium text-[#64748b] w-40">关联能力点</th>
              </tr>
            </thead>
            <tbody>
              {responsibilities.map((resp, i) => {
                const items = grouped.find((g) => g.responsibility.id === resp.id)?.abilities || []
                return (
                  <tr key={resp.id} className="border-b border-[#f5f5f4] hover:bg-[#fafafa]">
                    <td className="p-4"><span className="text-xs text-[#94a3b8] font-medium">T-{String(i + 1).padStart(3, "0")}</span></td>
                    <td className="p-4 text-sm text-[#475569]">{resp.name}</td>
                    <td className="p-4">
                      <span className="text-sm font-medium text-blue-500">{items.length} 个</span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="ml-2 h-7 px-2 text-xs rounded"
                        onClick={() => { setModalDuty(resp); setPage(0) }}
                      >
                        查看详情
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <div className="text-sm text-[#94a3b8] py-4">暂无岗位职责数据</div>
        )}
      </div>

      <div>
        <h4 className="text-base font-medium text-[#1f2937] mb-4 flex items-center gap-2">
          <ListChecks className="w-5 h-5 text-blue-500" />
          任职要求(<strong className="text-blue-500 mx-1">{requirements.length}</strong>项)
        </h4>
        <div className="bg-white border border-[#f5f5f4] rounded-2xl p-6">
          <ul className="list-none p-0 m-0">
            {requirements.map((req, i) => (
              <li
                key={i}
                className="text-sm text-[#64748b] leading-[1.8] py-2.5 pl-7 border-b border-[#f5f5f4] relative last:border-b-0"
              >
                <span className="absolute left-0 top-2.5 w-[18px] h-[18px] rounded-full bg-[#f5f5f4] text-[#999] text-[11px] flex items-center justify-center font-medium">
                  {i + 1}
                </span>
                {req}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {modalDuty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setModalDuty(null)}>
          <div className="bg-white rounded-2xl w-[1000px] max-w-[95vw] max-h-[86vh] overflow-hidden shadow-xl flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#f1f5f9]">
              <div>
                <div className="text-lg font-semibold text-[#1f2937]">职责关联能力点</div>
                <div className="text-xs text-[#64748b] mt-1">正在查看：{modalDuty.name}</div>
              </div>
              <button className="text-[#94a3b8] hover:text-[#1f2937] p-1" onClick={() => setModalDuty(null)}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 bg-[#f8fafc]">
              {modalAbilities.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-[#64748b]">
                  <svg className="w-12 h-12 mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m6 4.125l2.25 2.25m0 0l2.25-2.25m-2.25 2.25V4.5m-6 0h12" /></svg>
                  该职责暂无关联能力点
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {pageItems.map((ab, idx) => {
                      const globalIdx = page * perPage + idx
                      const colors = DOMAIN_COLORS[ab.domain || "专业工具"] || DOMAIN_COLORS["专业工具"]
                      const levelColor = LEVEL_COLORS[ab.requiredLevel] || "#94a3b8"
                      return (
                        <div key={ab.id} className="bg-white border border-[#e2e8f0] rounded-xl p-4 relative overflow-hidden shadow-sm hover:shadow-md transition-all">
                          <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-blue-500 to-emerald-500" />
                          <div className="flex gap-3 mb-3">
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0"
                              style={{ background: `linear-gradient(135deg, ${colors[0]}, ${colors[1]})` }}
                            >
                              {globalIdx + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold text-[#1f2937] leading-snug">{ab.name}</div>
                              <div className="flex flex-wrap gap-1.5 mt-1.5">
                                <span className="text-[11px] px-1.5 py-0.5 rounded bg-[#f1f5f9] text-[#475569] border border-[#e2e8f0]">{ab.domain || "专业工具"}</span>
                                <span
                                  className="text-[11px] px-1.5 py-0.5 rounded border"
                                  style={{ color: levelColor, background: `rgba(${hexToRgb(levelColor)},0.12)`, borderColor: `rgba(${hexToRgb(levelColor)},0.25)` }}
                                >
                                  {ab.requiredLevel}
                                </span>
                              </div>
                            </div>
                          </div>
                          {ab.rubricDescription && (
                            <div className="text-xs text-[#64748b] leading-relaxed line-clamp-3">{ab.rubricDescription}</div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-6">
                      <button
                        className="w-8 h-8 rounded-full border border-[#e2e8f0] bg-white text-[#64748b] flex items-center justify-center disabled:opacity-40 hover:border-blue-500 hover:text-blue-500"
                        disabled={page <= 0}
                        onClick={() => setPage(page - 1)}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      {Array.from({ length: totalPages }, (_, i) => (
                        <button
                          key={i}
                          onClick={() => setPage(i)}
                          className={`w-2 h-2 rounded-full transition-all ${page === i ? "bg-blue-500 w-5" : "bg-[#e2e8f0]"}`}
                        />
                      ))}
                      <button
                        className="w-8 h-8 rounded-full border border-[#e2e8f0] bg-white text-[#64748b] flex items-center justify-center disabled:opacity-40 hover:border-blue-500 hover:text-blue-500"
                        disabled={page >= totalPages - 1}
                        onClick={() => setPage(page + 1)}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  <p className="text-xs text-[#94a3b8] text-center mt-3">
                    <Star className="w-3 h-3 inline mr-1" />
                    共 {modalAbilities.length} 个能力点
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
    : "148, 163, 184"
}
