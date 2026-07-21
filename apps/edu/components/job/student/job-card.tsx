"use client"

import Link from "next/link"
import { MapPin, Eye, Layers, ClipboardList } from "lucide-react"
import type { CareerPosition } from "@/lib/types"

interface JobCardProps {
  position: CareerPosition
  index?: number
  hideHot?: boolean
  scenarioCount?: number
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

function formatDate(dateStr?: string) {
  if (!dateStr) return "2024-01-01"
  try {
    return dateStr.split("T")[0] || dateStr.split(" ")[0] || dateStr
  } catch {
    return dateStr
  }
}

export function JobCard({ position, index = 0, hideHot, scenarioCount = 0 }: JobCardProps) {
  const displayTitle = position.shortName || position.name
  const coverStyle = position.coverImage
    ? { backgroundImage: `url('${position.coverImage}')` }
    : { background: coverGradients[index % coverGradients.length] }

  const industryName = position.positionType === "enterprise" ? "企业" : "教学"
  const majorName = position.majorNames?.[0] || "未分类"
  const viewCount = 120 + ((position.id.charCodeAt(position.id.length - 1) || 0) % 880)
  const relatedScenes = Math.max(1, (position.majorNames?.length || 0) + 1)

  return (
    <Link href={`/job/student/${position.id}`}>
      <div className="bg-white rounded-2xl overflow-hidden border border-[#e7e5e4] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_40px_rgba(69,26,3,0.1)] cursor-pointer h-full flex flex-col">
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
          <div className="absolute top-3 left-3 right-3 z-10 flex justify-between">
            <div className="flex gap-1.5">
              <span className="bg-white/20 backdrop-blur-sm px-2.5 py-1 rounded-md text-[11px] text-white">
                {position.version || "v1.0"}
              </span>
              <span className="bg-white/20 backdrop-blur-sm px-2.5 py-1 rounded-md text-[11px] text-white">
                {formatDate(position.createdAt)} 收录
              </span>
            </div>
          </div>
          <div className="relative z-10">
            <div className="text-base font-bold leading-snug mb-1">{displayTitle}</div>
            <div className="text-xs opacity-90">岗位编码：{position.id.slice(0, 8)} · {formatDate(position.updatedAt)}</div>
          </div>
        </div>
        <div className="p-[18px] flex-1 flex flex-col">
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="bg-[#fafaf9] rounded-[10px] p-2.5 text-center">
              <div className="text-lg font-extrabold text-[#0f172a]">{viewCount}</div>
              <div className="text-xs text-[#94a3b8]">浏览次数</div>
            </div>
            <div className="bg-[#fafaf9] rounded-[10px] p-2.5 text-center">
              <div className="text-lg font-extrabold text-[#0f172a]">{relatedScenes}</div>
              <div className="text-xs text-[#94a3b8]">关联场景</div>
            </div>
            <div className="bg-[#fafaf9] rounded-[10px] p-2.5 text-center">
              <div className="text-lg font-extrabold text-[#0f172a]">{scenarioCount || "-"}</div>
              <div className="text-xs text-[#94a3b8]">场景任务</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mb-3">
            <span className="text-xs px-2.5 py-1 rounded-md bg-[#ffedd5] text-[#c2410c]">
              面向行业：{industryName}
            </span>
            <span className="text-xs px-2.5 py-1 rounded-md bg-[#dbeafe] text-[#1d4ed8] flex items-center gap-1">
              <MapPin className="w-3 h-3" /> 适用专业：{majorName}
            </span>
          </div>
          <div className="mt-auto grid grid-cols-[1fr_auto] gap-x-8 gap-y-2">
            <span className="text-xs text-[#64748b] flex items-center gap-1">
              <Eye className="w-3 h-3" /> 浏览量：{viewCount}
            </span>
            <span className="text-xs text-[#64748b] flex items-center gap-1">
              <Layers className="w-3 h-3" /> 版本：{position.version || "v1.0"}
            </span>
            <span className="text-xs text-[#64748b] flex items-center gap-1">
              <ClipboardList className="w-3 h-3" /> 要求：{position.requirements?.length || 0} 项
            </span>
            <span className="text-xs text-[#64748b]">更新：{formatDate(position.updatedAt)}</span>
          </div>
        </div>
      </div>
    </Link>
  )
}
