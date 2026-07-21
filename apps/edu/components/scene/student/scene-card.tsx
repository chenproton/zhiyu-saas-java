"use client"

import Link from "next/link"
import { Clock, Layers, BarChart3, MapPin } from "lucide-react"
import type { Scenario } from "@/lib/types"

interface SceneCardProps {
  scenario: Scenario
  index?: number
  hideHot?: boolean
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

const difficultyMap: Record<number, { color: string; label: string }> = {
  1: { color: "#22c55e", label: "入门" },
  2: { color: "#eab308", label: "初级" },
  3: { color: "#f97316", label: "中级" },
  4: { color: "#ef4444", label: "高级" },
  5: { color: "#8b5cf6", label: "专家" },
}

function formatDate(dateStr?: string) {
  if (!dateStr) return "2024-01-01"
  try {
    return dateStr.split("T")[0] || dateStr.split(" ")[0] || dateStr
  } catch {
    return dateStr
  }
}

export function SceneCard({ scenario, index = 0, hideHot, taskCount = 0 }: SceneCardProps) {
  const displayTitle = scenario.name
  const coverStyle = scenario.coverImage
    ? { backgroundImage: `url('${scenario.coverImage}')` }
    : { background: coverGradients[index % coverGradients.length] }

  const diff = difficultyMap[scenario.difficulty] || difficultyMap[3]
  const industryName = scenario.industryNames?.[0] || (scenario.industryIds?.length ? "已关联" : "未分类")

  return (
    <Link href={`/scene/landing/${scenario.id}`}>
      <div className="bg-white rounded-2xl overflow-hidden border border-[#e7e5e4] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_40px_rgba(69,26,3,0.1)] cursor-pointer h-full flex flex-col">
        <div
          className="h-40 relative bg-cover bg-center flex flex-col justify-end p-4 text-white"
          style={coverStyle}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-[rgba(69,26,3,0.85)] via-[rgba(69,26,3,0.2)] to-transparent" />
          {!hideHot && (
            <div className="absolute top-3 right-3 z-10 bg-gradient-to-br from-blue-500 to-blue-400 text-white text-xs font-semibold px-2.5 py-1 rounded-md flex items-center gap-1">
              推荐
            </div>
          )}
          <div className="absolute top-3 left-3 right-3 z-10 flex justify-between">
            <div className="flex gap-1.5">
              <span className="bg-white/20 backdrop-blur-sm px-2.5 py-1 rounded-md text-[11px] text-white">
                {scenario.version || "v1.0"}
              </span>
              <span className="bg-white/20 backdrop-blur-sm px-2.5 py-1 rounded-md text-[11px] text-white">
                {formatDate(scenario.createdAt)} 收录
              </span>
            </div>
          </div>
          <div className="relative z-10">
            <div className="text-base font-bold leading-snug mb-1">{displayTitle}</div>
            <div className="text-xs opacity-90">场景编码：{scenario.code || scenario.id.slice(0, 8)} · {formatDate(scenario.updatedAt)}</div>
          </div>
        </div>
        <div className="p-[18px] flex-1 flex flex-col">
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="bg-[#fafaf9] rounded-[10px] p-2.5 text-center">
              <div className="text-lg font-extrabold text-[#0f172a]">{taskCount || "-"}</div>
              <div className="text-xs text-[#94a3b8]">任务数量</div>
            </div>
            <div className="bg-[#fafaf9] rounded-[10px] p-2.5 text-center">
              <div className="text-lg font-extrabold text-[#0f172a]">{scenario.difficulty || "-"}</div>
              <div className="text-xs text-[#94a3b8]">难度等级</div>
            </div>
            <div className="bg-[#fafaf9] rounded-[10px] p-2.5 text-center">
              <div className="text-lg font-extrabold text-[#0f172a]">{scenario.version || "v1.0"}</div>
              <div className="text-xs text-[#94a3b8]">版本号</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mb-3">
            <span className="text-xs px-2.5 py-1 rounded-md bg-[#ffedd5] text-[#c2410c] flex items-center gap-1">
              <MapPin className="w-3 h-3" /> 行业：{industryName}
            </span>
            <span
              className="text-xs px-2.5 py-1 rounded-md flex items-center gap-1"
              style={{ backgroundColor: diff.color + "15", color: diff.color }}
            >
              <BarChart3 className="w-3 h-3" /> {diff.label}
            </span>
          </div>
          <div className="mt-auto grid grid-cols-[1fr_auto] gap-x-8 gap-y-2">
            <span className="text-xs text-[#64748b] flex items-center gap-1">
              <Layers className="w-3 h-3" /> 版本：{scenario.version || "v1.0"}
            </span>
            <span className="text-xs text-[#64748b]">收录：{formatDate(scenario.createdAt)}</span>
            <span className="text-xs text-[#64748b] flex items-center gap-1">
              <Clock className="w-3 h-3" /> 任务：{taskCount || 0} 项
            </span>
            <span className="text-xs text-[#64748b]">更新：{formatDate(scenario.updatedAt)}</span>
          </div>
        </div>
      </div>
    </Link>
  )
}
