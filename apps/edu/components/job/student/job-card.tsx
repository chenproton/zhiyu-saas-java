"use client"

import Link from "next/link"
import { MapPin, Eye, Layers, ClipboardList, Flame } from "lucide-react"
import type { CareerPosition } from "@/lib/types"

interface JobCardProps {
  position: CareerPosition
  index?: number
  isHot?: boolean
  scenarioCount?: number
  taskCount?: number
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

export function JobCard({ position, index = 0, isHot, scenarioCount = 0, taskCount = 0 }: JobCardProps) {
  const displayTitle = position.shortName || position.name
  const coverStyle = position.coverImage
    ? { backgroundImage: `url('${position.coverImage}')` }
    : { background: coverGradients[index % coverGradients.length] }

  const industryName = position.positionType === "enterprise" ? "企业" : "教学"
  const majorName = position.majorNames?.[0] || "未分类"
  const viewCount = position.viewCount ?? 0
  const relatedScenes = scenarioCount

  return (
    <Link href={`/job/student/${position.id}`}>
      <div className="group bg-white rounded-2xl overflow-hidden border border-slate-200 transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_20px_48px_rgba(0,0,0,0.1)] hover:border-blue-200 cursor-pointer h-full flex flex-col">
        <div
          className="h-44 relative bg-cover bg-center flex flex-col justify-end p-4 text-white"
          style={coverStyle}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-[rgba(15,23,42,0.88)] via-[rgba(15,23,42,0.35)] to-transparent" />
          {isHot && (
            <div className="absolute top-3 right-3 z-10 bg-gradient-to-br from-red-500 to-rose-500 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-lg shadow-red-500/25">
              <Flame className="w-3 h-3 fill-current" /> 热门
            </div>
          )}
          <div className="absolute top-3 left-3 right-3 z-10 flex justify-between">
            <div className="flex gap-1.5">
              <span className="bg-white/25 backdrop-blur-md px-2.5 py-1 rounded-md text-[11px] text-white font-medium border border-white/10">
                {position.version || "v1.0"}
              </span>
              <span className="bg-white/25 backdrop-blur-md px-2.5 py-1 rounded-md text-[11px] text-white font-medium border border-white/10">
                {formatDate(position.createdAt)} 收录
              </span>
            </div>
          </div>
          <div className="relative z-10">
            <div className="text-base font-bold leading-snug mb-1 line-clamp-2 group-hover:text-blue-100 transition-colors">{displayTitle}</div>
            <div className="text-xs text-white/80">岗位编码：{position.id.slice(0, 8)} · {formatDate(position.updatedAt)}</div>
          </div>
        </div>
        <div className="p-5 flex-1 flex flex-col">
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="bg-slate-50 rounded-xl p-2.5 text-center border border-slate-100">
              <div className="text-lg font-bold text-slate-800">{viewCount}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">浏览次数</div>
            </div>
            <div className="bg-slate-50 rounded-xl p-2.5 text-center border border-slate-100">
              <div className="text-lg font-bold text-slate-800">{relatedScenes}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">关联场景</div>
            </div>
            <div className="bg-slate-50 rounded-xl p-2.5 text-center border border-slate-100">
              <div className="text-lg font-bold text-slate-800">{taskCount || "-"}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">场景任务</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            <span className="text-[11px] px-2.5 py-1 rounded-full bg-orange-50 text-orange-700 border border-orange-100 font-medium">
              面向行业：{industryName}
            </span>
            <span className="text-[11px] px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100 font-medium flex items-center gap-1">
              <MapPin className="w-3 h-3" /> 适用专业：{majorName}
            </span>
          </div>
          <div className="mt-auto grid grid-cols-[1fr_auto] gap-x-6 gap-y-2.5">
            <span className="text-xs text-slate-500 flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-slate-400" /> 浏览量：{viewCount}
            </span>
            <span className="text-xs text-slate-500 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-slate-400" /> 版本：{position.version || "v1.0"}
            </span>
            <span className="text-xs text-slate-500 flex items-center gap-1.5">
              <ClipboardList className="w-3.5 h-3.5 text-slate-400" /> 要求：{position.requirements?.length || 0} 项
            </span>
            <span className="text-xs text-slate-500">更新：{formatDate(position.updatedAt)}</span>
          </div>
        </div>
      </div>
    </Link>
  )
}
