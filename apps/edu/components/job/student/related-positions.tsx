"use client"

import Link from "next/link"
import { Briefcase, ArrowRight } from "lucide-react"
import type { CareerPosition } from "@/lib/types"

interface RelatedPositionsProps {
  positions: CareerPosition[]
  currentId: string
}

export function RelatedPositions({ positions, currentId }: RelatedPositionsProps) {
  const related = positions.filter((p) => p.id !== currentId).slice(0, 4)

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {related.length === 0 && (
        <div className="col-span-full text-center py-10 text-[#94a3b8] bg-white rounded-2xl border border-[#e7e5e9]">
          <Briefcase className="w-10 h-10 mx-auto mb-2 opacity-40" />
          暂无相关岗位推荐
        </div>
      )}
      {related.map((pos) => (
        <Link key={pos.id} href={`/job/student/${pos.id}`}>
          <div className="bg-white rounded-xl border border-[#e7e5e4] p-4 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer h-full">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center text-white mb-3">
              <Briefcase className="w-5 h-5" />
            </div>
            <div className="text-sm font-bold text-[#0f172a] mb-1 line-clamp-2">{pos.name}</div>
            <div className="text-xs text-[#94a3b8] mb-3">{pos.positionType === "enterprise" ? "企业岗位" : "教学岗位"}</div>
            <div className="flex items-center text-xs text-blue-600 font-medium">
              查看详情 <ArrowRight className="w-3 h-3 ml-1" />
            </div>
          </div>
        </Link>
      ))}
    </div>
  )
}
