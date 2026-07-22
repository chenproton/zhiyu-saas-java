"use client"

import Link from "next/link"
import { MapPin } from "lucide-react"
import type { Scenario } from "@/lib/types"

interface SceneCardProps {
  scenario: Scenario
  index?: number
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

const difficultyMap: Record<number, { color: string; label: string; bg: string; border: string }> = {
  1: { color: "#16a34a", label: "入门", bg: "#f0fdf4", border: "#bbf7d0" },
  2: { color: "#ca8a04", label: "初级", bg: "#fefce8", border: "#fde047" },
  3: { color: "#ea580c", label: "中级", bg: "#fff7ed", border: "#fed7aa" },
  4: { color: "#dc2626", label: "高级", bg: "#fef2f2", border: "#fecaca" },
  5: { color: "#7c3aed", label: "专家", bg: "#f5f3ff", border: "#ddd6fe" },
}

const professionTagMap: Record<string, { bg: string; text: string; border: string }> = {
  default: { bg: "#f5f3ff", text: "#6d28d9", border: "#ddd6fe" },
}

const industryTagMap: Record<string, { bg: string; text: string; border: string }> = {
  default: { bg: "#fff7ed", text: "#c2410c", border: "#ffedd5" },
}

function formatDate(dateStr?: string) {
  if (!dateStr) return "2024-01-01"
  try {
    return dateStr.split("T")[0] || dateStr.split(" ")[0] || dateStr
  } catch {
    return dateStr
  }
}

export function SceneCard({ scenario, index = 0, taskCount = 0 }: SceneCardProps) {
  const displayTitle = scenario.name
  const coverStyle = scenario.coverImage
    ? { backgroundImage: `url('${scenario.coverImage}')` }
    : { background: coverGradients[index % coverGradients.length] }

  const diff = difficultyMap[scenario.difficulty] || difficultyMap[3]
  const industryName = scenario.industryNames?.[0] || (scenario.industryIds?.length ? "已关联" : "未分类")
  const industryTag = industryTagMap.default
  const professionName = scenario.professionNames?.[0] || (scenario.professionIds?.length ? "已关联" : "未分类")
  const professionTag = professionTagMap.default
  const viewCount = scenario.viewCount ?? 0

  return (
    <Link href={`/scene/landing/${scenario.id}`}>
      <div className="group bg-white rounded-2xl overflow-hidden border border-[#e7e5e4] transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_20px_48px_rgba(0,0,0,0.1)] hover:border-blue-200 cursor-pointer h-full flex flex-col">
        <div
          className="h-44 relative bg-cover bg-center flex flex-col justify-end p-4 text-white"
          style={coverStyle}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-[rgba(15,23,42,0.88)] via-[rgba(15,23,42,0.35)] to-transparent" />
          <div className="absolute top-3 left-3 right-3 z-10 flex justify-between">
            <div className="flex gap-1.5">
              <span className="bg-white/25 backdrop-blur-md px-2.5 py-1 rounded-md text-[11px] text-white font-medium border border-white/10">
                {scenario.version || "v1.0"}
              </span>
              <span className="bg-white/25 backdrop-blur-md px-2.5 py-1 rounded-md text-[11px] text-white font-medium border border-white/10">
                {formatDate(scenario.updatedAt)} 收录
              </span>
            </div>
          </div>
          <div className="relative z-10">
            <div className="text-base font-bold leading-snug mb-1 line-clamp-2 group-hover:text-blue-100 transition-colors">{displayTitle}</div>
            <div className="text-xs text-white/80">场景编码：{scenario.code || scenario.id.slice(0, 8)}</div>
          </div>
        </div>
        <div className="p-5 flex-1 flex flex-col">
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="bg-slate-50 rounded-xl p-2.5 text-center border border-slate-100">
              <div className="text-lg font-bold text-slate-800">{taskCount || "-"}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">任务数量</div>
            </div>
            <div className="bg-slate-50 rounded-xl p-2.5 text-center border border-slate-100">
              <div className="text-lg font-bold text-slate-800">{diff.label}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">难度等级</div>
            </div>
            <div className="bg-slate-50 rounded-xl p-2.5 text-center border border-slate-100">
              <div className="text-lg font-bold text-slate-800">{viewCount}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">浏览次数</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            <span
              className="text-[11px] px-2.5 py-1 rounded-full flex items-center gap-1 font-medium border"
              style={{ backgroundColor: industryTag.bg, color: industryTag.text, borderColor: industryTag.border }}
            >
              <MapPin className="w-3 h-3" /> {industryName}
            </span>
            <span
              className="text-[11px] px-2.5 py-1 rounded-full flex items-center gap-1 font-medium border"
              style={{ backgroundColor: professionTag.bg, color: professionTag.text, borderColor: professionTag.border }}
            >
              <MapPin className="w-3 h-3" /> 适用专业：{professionName}
            </span>
          </div>
          <div className="mt-auto grid grid-cols-2 gap-x-6 gap-y-2.5">
            <span className="text-xs text-slate-500">收录：{formatDate(scenario.createdAt)}</span>
            <span className="text-xs text-slate-500">更新：{formatDate(scenario.updatedAt)}</span>
          </div>
        </div>
      </div>
    </Link>
  )
}
