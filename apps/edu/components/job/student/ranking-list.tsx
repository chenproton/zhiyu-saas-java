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

const ROWS_PER_PAGE = 5

const cardPalette = { bg: "bg-blue-50/70", hover: "hover:bg-blue-100/60", border: "border-blue-100" }

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

  const totalPages = Math.max(1, Math.ceil(ranked.length / (ROWS_PER_PAGE * 2)))
  const pageItems = useMemo(() => {
    const start = page * ROWS_PER_PAGE * 2
    return ranked.slice(start, start + ROWS_PER_PAGE * 2)
  }, [ranked, page])

  const col1 = pageItems.filter((_, i) => i % 2 === 0)
  const col2 = pageItems.filter((_, i) => i % 2 === 1)

  const getRankStyle = (rank: number) => {
    if (rank === 1) return "bg-gradient-to-br from-amber-400 to-yellow-300 text-white shadow-lg shadow-amber-400/30"
    if (rank === 2) return "bg-gradient-to-br from-slate-400 to-slate-300 text-white shadow-lg shadow-slate-400/30"
    if (rank === 3) return "bg-gradient-to-br from-amber-600 to-amber-500 text-white shadow-lg shadow-amber-500/30"
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

  const majorLabel = (pos: CareerPosition) => {
    const majors = pos.majorNames?.filter(Boolean) || []
    if (majors.length === 0) return "未分类"
    if (majors.length === 1) return majors[0]
    return `${majors[0]} +${majors.length - 1}`
  }

  const renderItem = (pos: CareerPosition, idx: number) => {
    const globalRank = page * ROWS_PER_PAGE * 2 + idx + 1
    const display = pos.shortName || pos.name
    const count = pos.favoriteCount ?? 0
    const palette = cardPalette
    return (
      <Link key={pos.id} href={`/job/student/${pos.id}`}>
        <div className={`flex items-start gap-3 px-3 py-2.5 rounded-xl border ${palette.bg} ${palette.hover} cursor-pointer transition-all group`}>
          <span
            className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${getRankStyle(globalRank)}`}
          >
            {globalRank}
          </span>
          <div className="flex-1 min-w-0 flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="flex-1 text-[13px] font-semibold text-slate-800 truncate group-hover:text-blue-600 transition-colors">
                {display}
              </span>
              <span className="text-[11px] text-rose-500 flex items-center gap-0.5 whitespace-nowrap font-medium">
                <Heart className={`w-3 h-3 ${count > 0 ? "fill-current" : ""}`} /> {formatCount(count)}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px]">
              <span className="px-1.5 py-0.5 rounded-md bg-white/70 text-blue-600 truncate max-w-[80px] font-medium border border-blue-100">
                {categoryFor(pos)}
              </span>
              <span
                className="px-1.5 py-0.5 rounded-md bg-white/70 text-emerald-600 truncate max-w-[120px] font-medium border border-emerald-100"
                title={pos.majorNames?.filter(Boolean).join("、") || "未分类"}
              >
                {majorLabel(pos)}
              </span>
            </div>
          </div>
        </div>
      </Link>
    )
  }

  if (ranked.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-5">
        <div className="flex items-center gap-2 text-[15px] font-bold text-slate-800 mb-3">
          <div className="w-1 h-5 rounded-full bg-gradient-to-b from-amber-400 to-orange-500" />
          <Trophy className="w-4 h-4 text-amber-500" />
          心仪岗位排行榜
        </div>
        <div className="text-center py-6 text-slate-400 text-sm">暂无岗位数据</div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-[0_4px_20px_rgba(0,0,0,0.04)] px-5 py-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5 text-[15px] font-bold text-slate-800">
          <div className="w-1 h-5 rounded-full bg-gradient-to-b from-amber-400 to-orange-500" />
          <Trophy className="w-4 h-4 text-amber-500" />
          心仪岗位排行榜
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7 rounded-lg border-slate-200 bg-white text-slate-500 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50/50 disabled:opacity-30 transition-all"
            disabled={page <= 0}
            onClick={() => setPage(page - 1)}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </Button>
          <span className="text-xs text-slate-400 min-w-[40px] text-center font-medium">{page + 1} / {totalPages}</span>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7 rounded-lg border-slate-200 bg-white text-slate-500 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50/50 disabled:opacity-30 transition-all"
            disabled={page >= totalPages - 1}
            onClick={() => setPage(page + 1)}
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex gap-4">
        <div className="flex-1 flex flex-col gap-1">{col1.map((pos, i) => renderItem(pos, i * 2))}</div>
        <div className="flex-1 flex flex-col gap-1">{col2.map((pos, i) => renderItem(pos, i * 2 + 1))}</div>
      </div>
    </div>
  )
}
