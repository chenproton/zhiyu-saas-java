"use client"

import { useMemo, useState } from "react"
import { ListChecks, ChevronLeft, ChevronRight, X, Star } from "lucide-react"
import type { PositionResponsibility, PositionAbilityBinding, AbilityPoint } from "@/lib/types/job"
import { Button } from "@/components/ui/button"
import { AbilityPointCard } from "./ability-point-card"

interface DutyTableProps {
  responsibilities: PositionResponsibility[]
  bindings: PositionAbilityBinding[]
  abilityPoints: AbilityPoint[]
  requirements: string[]
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

  const abilityMap = useMemo(() => {
    const map: Record<string, AbilityPoint> = {}
    abilityPoints.forEach((a) => { map[a.id] = a })
    return map
  }, [abilityPoints])

  const modalAbilities = useMemo(() => {
    if (!modalDuty) return []
    return grouped.find((g) => g.responsibility.id === modalDuty.id)?.abilities || []
  }, [modalDuty, grouped])

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
                    {pageItems.map((ab, idx) => (
                      <AbilityPointCard
                        key={ab.id}
                        binding={ab}
                        abilityPoint={abilityMap[ab.abilityPointId]}
                        index={page * perPage + idx}
                      />
                    ))}
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


