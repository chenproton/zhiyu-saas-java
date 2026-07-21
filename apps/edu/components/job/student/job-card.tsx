"use client"

import Link from "next/link"
import { MapPin, Target } from "lucide-react"
import type { CareerPosition } from "@/lib/types"

interface JobCardProps {
  position: CareerPosition
  index?: number
  hideHot?: boolean
}

const coverGradients = [
  "linear-gradient(135deg,#1e3a8a,#3b7cff)",
  "linear-gradient(135deg,#7c2d12,#dc2626)",
  "linear-gradient(135deg,#064e3b,#0891b2)",
  "linear-gradient(135deg,#334155,#64748b)",
  "linear-gradient(135deg,#581c87,#a855f7)",
  "linear-gradient(135deg,#1e40af,#3b82f6)",
  "linear-gradient(135deg,#be123c,#f43f5e)",
  "linear-gradient(135deg,#0f766e,#14b8a6)",
]

export function JobCard({ position, index = 0, hideHot }: JobCardProps) {
  const displayTitle = position.shortName || position.name
  const coverStyle = position.coverImage
    ? { backgroundImage: `url('${position.coverImage}')` }
    : { background: coverGradients[index % coverGradients.length] }

  return (
    <Link href={`/job/student/${position.id}`}>
      <div className="bg-white rounded-2xl overflow-hidden border border-[#e7e5e4] transition-all duration-300 hover:-translate-y-1 hover:shadow-xl cursor-pointer h-full flex flex-col">
        <div
          className="h-40 relative bg-cover bg-center flex flex-col justify-end p-4 text-white"
          style={coverStyle}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-[rgba(69,26,3,0.85)] via-[rgba(69,26,3,0.2)] to-transparent" />
          {!hideHot && (
            <div className="absolute top-3 right-3 z-10 bg-gradient-to-br from-red-500 to-red-400 text-white text-xs font-semibold px-2.5 py-1 rounded-md flex items-center gap-1">
              热门
            </div>
          )}
          <div className="relative z-10">
            <div className="text-xs opacity-90 mb-1">岗位编码：{position.id.slice(0, 8)}</div>
            <div className="text-base font-bold leading-snug">{displayTitle}</div>
          </div>
        </div>
        <div className="p-5 flex-1 flex flex-col">
          <h3 className="text-[15px] font-bold text-[#0f172a] mb-3 line-clamp-2">{position.name}</h3>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="bg-[#fafaf9] rounded-[10px] p-2.5 text-center">
              <div className="text-lg font-extrabold text-[#0f172a]">{(position.salaryMin ?? 0) > 0 ? `${position.salaryMin}` : "-"}</div>
              <div className="text-xs text-[#94a3b8]">薪资下限</div>
            </div>
            <div className="bg-[#fafaf9] rounded-[10px] p-2.5 text-center">
              <div className="text-lg font-extrabold text-[#0f172a]">{(position.salaryMax ?? 0) > 0 ? `${position.salaryMax}` : "-"}</div>
              <div className="text-xs text-[#94a3b8]">薪资上限</div>
            </div>
            <div className="bg-[#fafaf9] rounded-[10px] p-2.5 text-center">
              <div className="text-lg font-extrabold text-[#0f172a]">{position.requirements?.length || 0}</div>
              <div className="text-xs text-[#94a3b8]">要求</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mb-3">
            <span className="text-xs px-2.5 py-1 rounded-md bg-[#ffedd5] text-[#c2410c]">
              {position.positionType === "enterprise" ? "企业" : "教学"}
            </span>
            {position.majorNames?.[0] && (
              <span className="text-xs px-2.5 py-1 rounded-md bg-[#dbeafe] text-[#1d4ed8] flex items-center gap-1">
                <MapPin className="w-3 h-3" /> {position.majorNames[0]}
              </span>
            )}
          </div>
          <div className="mt-auto flex items-center justify-between text-xs text-[#94a3b8]">
            <span className="flex items-center gap-1"><Target className="w-3 h-3" /> {position.requirements?.length || 0} 项要求</span>
            <span>版本：{position.version}</span>
          </div>
        </div>
      </div>
    </Link>
  )
}
