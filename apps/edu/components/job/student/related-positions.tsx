"use client"

import Link from "next/link"
import { Briefcase, ArrowRight } from "lucide-react"
import type { CareerPosition } from "@/lib/types"

interface RelatedPositionsProps {
  positions: CareerPosition[]
  currentId: string
}

const GRADIENTS = [
  "linear-gradient(135deg, #3b82f6, #60a5fa)",
  "linear-gradient(135deg, #52c41a, #73d13d)",
  "linear-gradient(135deg, #f59e0b, #ffc53d)",
  "linear-gradient(135deg, #722ed1, #b37feb)",
]

export function RelatedPositions({ positions, currentId }: RelatedPositionsProps) {
  const related = positions.filter((p) => p.id !== currentId).slice(0, 4)

  if (related.length === 0) {
    return (
      <div className="text-center py-12 text-[#94a3b8] bg-white rounded-2xl border border-[#e7e5e4]">
        <Briefcase className="w-12 h-12 mx-auto mb-3 opacity-40" />
        <div>暂无相关岗位推荐</div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {related.map((pos, i) => (
        <Link key={pos.id} href={`/job/student/${pos.id}`}>
          <div className="bg-white rounded-xl border border-[#f5f5f4] p-4 hover:border-blue-200 hover:bg-[#eff6ff] transition-all cursor-pointer h-full group">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-lg font-bold mb-3"
              style={{ background: GRADIENTS[i % GRADIENTS.length] }}
            >
              {pos.name.charAt(0)}
            </div>
            <div className="text-sm font-semibold text-[#1f2937] mb-1 line-clamp-2 group-hover:text-blue-600">{pos.name}</div>
            <div className="text-xs text-[#64748b] mb-3">{pos.positionType === "enterprise" ? "企业岗位" : "教学岗位"}</div>
            <div className="flex items-center text-xs text-blue-500 font-medium">
              查看详情 <ArrowRight className="w-3 h-3 ml-1" />
            </div>
          </div>
        </Link>
      ))}
    </div>
  )
}
