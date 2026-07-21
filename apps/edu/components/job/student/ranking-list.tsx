"use client"

import { useState, useMemo } from "react"
import { Trophy, ChevronLeft, ChevronRight, Heart } from "lucide-react"
import { Button } from "@/components/ui/button"

interface RankingJob {
  title: string
  category: string
  icon: string
  fav: string
}

const DEFAULT_RANKING: RankingJob[] = [
  { title: "游戏特效设计师", category: "文化创意", icon: "🎮", fav: "8,500" },
  { title: "供应链管理专员", category: "财经商贸", icon: "📦", fav: "8,100" },
  { title: "健康管理师", category: "医药健康", icon: "🏥", fav: "7,800" },
  { title: "无人机应用技术员", category: "交通运输", icon: "🚁", fav: "7,400" },
  { title: "数字营养配餐师", category: "现代服务", icon: "🍎", fav: "7,000" },
  { title: "工业机器人操作员", category: "智能制造", icon: "🤖", fav: "6,800" },
  { title: "云计算运维工程师", category: "信息技术", icon: "☁️", fav: "6,500" },
  { title: "跨境电商主播", category: "电子商务", icon: "🎥", fav: "6,200" },
  { title: "财务数据分析师", category: "财经商贸", icon: "📊", fav: "5,900" },
  { title: "新能源汽车技师", category: "智能制造", icon: "🚗", fav: "5,600" },
  { title: "用户体验研究员", category: "文化创意", icon: "🔍", fav: "5,300" },
  { title: "智慧养老护理员", category: "现代服务", icon: "👴", fav: "5,000" },
  { title: "网络安全工程师", category: "信息技术", icon: "🔒", fav: "4,800" },
  { title: "茶艺师", category: "现代服务", icon: "🍵", fav: "4,500" },
  { title: "无人机测绘员", category: "交通运输", icon: "🗺️", fav: "4,200" },
]

interface RankingListProps {
  items?: RankingJob[]
}

export function RankingList({ items = DEFAULT_RANKING }: RankingListProps) {
  const [page, setPage] = useState(0)
  const rowsPerPage = 10
  const totalPages = Math.ceil(items.length / rowsPerPage)

  const cols = useMemo(() => {
    const start = page * rowsPerPage
    const pageItems = items.slice(start, start + rowsPerPage)
    const left: RankingJob[] = []
    const right: RankingJob[] = []
    pageItems.forEach((job, idx) => {
      if (idx % 2 === 0) left.push(job)
      else right.push(job)
    })
    return [left, right]
  }, [items, page])

  const getRankClass = (rank: number) => {
    if (rank === 1) return "bg-gradient-to-br from-amber-400 to-yellow-300 text-white"
    if (rank === 2) return "bg-gradient-to-br from-slate-400 to-slate-300 text-white"
    if (rank === 3) return "bg-gradient-to-br from-amber-600 to-amber-500 text-white"
    return "bg-[#f1f5f9] text-[#94a3b8]"
  }

  return (
    <div className="bg-white rounded-2xl border border-[#e7e5e4] p-5 mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-bold text-[#0f172a] flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-500" />
          心仪岗位排行榜
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-6 w-6 rounded-md border-[#e2e8f0] bg-white text-[#64748b] hover:border-blue-500 hover:text-blue-500 disabled:opacity-40"
            disabled={page <= 0}
            onClick={() => setPage(page - 1)}
          >
            <ChevronLeft className="w-3 h-3" />
          </Button>
          <span className="text-xs text-[#94a3b8] min-w-[36px] text-center">{page + 1} / {totalPages}</span>
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {cols.map((col, colIdx) => (
          <div key={colIdx} className="flex flex-col gap-1">
            {col.map((job, idx) => {
              const globalRank = page * rowsPerPage + colIdx * Math.ceil(col.length) + idx + 1
              return (
                <div
                  key={idx}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[#f8fafc] cursor-pointer transition-colors even:bg-[#fafafa]"
                >
                  <span className={`w-[22px] h-[22px] rounded-md flex items-center justify-center text-xs font-bold ${getRankClass(globalRank)}`}>
                    {globalRank}
                  </span>
                  <span className="text-base">{job.icon}</span>
                  <span className="flex-1 text-[13px] font-semibold text-[#0f172a] truncate">{job.title}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-[#eff6ff] text-blue-600 whitespace-nowrap">{job.category}</span>
                  <span className="text-[11px] text-red-500 flex items-center gap-1 whitespace-nowrap min-w-[60px] justify-end">
                    <Heart className="w-3 h-3" /> {job.fav}
                  </span>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
