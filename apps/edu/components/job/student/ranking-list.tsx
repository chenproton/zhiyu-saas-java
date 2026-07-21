"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Trophy, ChevronLeft, ChevronRight, Heart } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { CareerPosition } from "@/lib/types"

interface RankingListProps {
  positions?: CareerPosition[]
  industryMap?: Map<string, string>
}

const ROWS_PER_PAGE = 8

export function RankingList({ positions = [], industryMap }: RankingListProps) {
  const [page, setPage] = useState(0)

  const ranked = useMemo(() => {
    return [...positions]
      .filter((p) => p.status === "published")
      .sort((a, b) => {
        const countA = a.favoriteCount ?? 0
        const countB = b.favoriteCount ?? 0
        if (countB !== countA) return countB - countA
        return a.name.localeCompare(b.name, "zh-CN")
      })
  }, [positions])

  const totalPages = Math.max(1, Math.ceil(ranked.length / ROWS_PER_PAGE))
  const pageItems = useMemo(() => {
    const start = page * ROWS_PER_PAGE
    return ranked.slice(start, start + ROWS_PER_PAGE)
  }, [ranked, page])

  const getRankStyle = (rank: number) => {
    if (rank === 1) return "bg-gradient-to-br from-amber-400 to-yellow-300 text-white"
    if (rank === 2) return "bg-gradient-to-br from-slate-400 to-slate-300 text-white"
    if (rank === 3) return "bg-gradient-to-br from-amber-600 to-amber-500 text-white"
    return "bg-slate-100 text-slate-400"
  }

  const formatCount = (n?: number) => {
    if (!n || n <= 0) return "0"
    if (n >= 10000) return `${(n / 10000).toFixed(1)}w`
    return n.toLocaleString()
  }

  const categoryFor = (pos: CareerPosition) => {
    if (pos.industryId && industryMap?.get(pos.industryId)) return industryMap.get(pos.industryId)!
    return pos.positionType === "enterprise" ? "企业" : "教学"
  }

  if (ranked.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-[#e7e5e4] p-4">
        <div className="flex items-center gap-2 text-sm font-bold text-[#0f172a] mb-3">
          <Trophy className="w-4 h-4 text-amber-500" />
          心仪岗位排行榜
        </div>
        <div className="text-center py-6 text-[#94a3b8] text-sm">暂无岗位数据</div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-[#e7e5e4] p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-500" />
          <div>
            <div className="text-[15px] font-bold text-[#0f172a]">心仪岗位排行榜</div>
            <div className="text-xs text-[#94a3b8]">按全站收藏数排序</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-6 w-6 rounded-md border-[#e2e8f0] bg-white text-[#64748b] hover:border-blue-500 hover:text-blue-500 disabled:opacity-40"
            disabled={page <= 0}
            onClick={() => setPage(page - 1)}
          >
            <ChevronLeft className="w-3 h-3" />
          </Button>
          <span className="text-xs text-[#64748b] min-w-[36px] text-center font-medium">{page + 1}/{totalPages}</span>
          <Button
            variant="outline"
            size="icon"
            className="h-6 w-6 rounded-md border-[#e2e8f0] bg-white text-[#64748b] hover:border-blue-500 hover:text-blue-500 disabled:opacity-40"
            disabled={page >= totalPages - 1}
            onClick={() => setPage(page + 1)}
          >
            <ChevronRight className="w-3 h-3" />
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        {pageItems.map((pos, idx) => {
          const globalRank = page * ROWS_PER_PAGE + idx + 1
          const display = pos.shortName || pos.name
          const initial = display.charAt(0)
          const count = pos.favoriteCount ?? 0
          return (
            <Link key={pos.id} href={`/job/student/${pos.id}`}>
              <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-[#f8fafc] cursor-pointer transition-colors group">
                <span className={`w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-bold shrink-0 ${getRankStyle(globalRank)}`}>
                  {globalRank}
                </span>
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-50 to-indigo-50 text-blue-600 flex items-center justify-center text-xs font-bold shrink-0 border border-blue-100">
                  {initial}
                </div>
                <span className="flex-1 text-[13px] font-semibold text-[#0f172a] truncate group-hover:text-blue-600 transition-colors">
                  {display}
                </span>
                <span className="hidden xl:inline-flex text-[10px] px-1.5 py-0.5 rounded bg-[#eff6ff] text-blue-600 whitespace-nowrap">
                  {categoryFor(pos)}
                </span>
                <span className="text-xs text-rose-500 flex items-center gap-0.5 whitespace-nowrap min-w-[40px] justify-end font-medium">
                  <Heart className={`w-3 h-3 ${count > 0 ? "fill-current" : ""}`} /> {formatCount(count)}
                </span>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
