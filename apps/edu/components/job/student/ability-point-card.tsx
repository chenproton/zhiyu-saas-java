"use client"

import type { PositionAbilityBinding, AbilityPoint } from "@/lib/types/job"

interface AbilityPointCardProps {
  binding: PositionAbilityBinding
  abilityPoint?: AbilityPoint
  index?: number
}

const ATTRIBUTE_COLORS: Record<string, [string, string]> = {
  "知识": ["#3b82f6", "#60a5fa"],
  "素养": ["#f59e0b", "#fbbf24"],
  "技能": ["#10b981", "#34d399"],
}

const DOMAIN_COLORS: Record<string, [string, string]> = {
  "专业工具": ["#3b82f6", "#60a5fa"],
  "团队协作": ["#10b981", "#34d399"],
  "通用素质": ["#f59e0b", "#fbbf24"],
  "业务洞察": ["#8b5cf6", "#a78bfa"],
  "创新思维": ["#ec4899", "#f472b6"],
}

const LEVEL_LABELS: Record<string, string> = {
  understand: "了解",
  comprehend: "理解",
  master: "掌握",
  proficient: "熟练",
  expert: "精通",
}

const LEVEL_COLORS: Record<string, string> = {
  "了解": "#94a3b8",
  "理解": "#60a5fa",
  "掌握": "#34d399",
  "熟练": "#fbbf24",
  "精通": "#f87171",
}

export function AbilityPointCard({ binding, abilityPoint, index }: AbilityPointCardProps) {
  const attributes = abilityPoint?.attributes?.length ? abilityPoint.attributes : binding.attributes
  const domainColors = DOMAIN_COLORS[binding.domain || "专业工具"] || DOMAIN_COLORS["专业工具"]
  const levelLabel = LEVEL_LABELS[binding.requiredLevel] || binding.requiredLevel
  const levelColor = LEVEL_COLORS[levelLabel] || "#94a3b8"

  return (
    <div className="bg-white border border-[#e2e8f0] rounded-xl p-4 relative overflow-hidden shadow-sm hover:shadow-md transition-all h-full flex flex-col">
      <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-blue-500 to-emerald-500" />

      <div className="flex gap-3 mb-3">
        {typeof index === "number" && (
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0"
            style={{ background: `linear-gradient(135deg, ${domainColors[0]}, ${domainColors[1]})` }}
          >
            {index + 1}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-[#1f2937] leading-snug">
            {abilityPoint?.name || binding.domain || "未命名能力"}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {attributes.map((attr) => {
          const colors = ATTRIBUTE_COLORS[attr] || ["#64748b", "#94a3b8"]
          return (
            <span
              key={attr}
              className="text-[11px] px-1.5 py-0.5 rounded border text-white"
              style={{ background: `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`, borderColor: colors[0] }}
            >
              {attr}
            </span>
          )
        })}
        {attributes.length === 0 && (
          <span className="text-[11px] px-1.5 py-0.5 rounded bg-[#f1f5f9] text-[#475569] border border-[#e2e8f0]">
            未配置属性
          </span>
        )}
        <span className="text-[11px] px-1.5 py-0.5 rounded bg-[#f1f5f9] text-[#475569] border border-[#e2e8f0]">
          {binding.domain || "专业工具"}
        </span>
        <span
          className="text-[11px] px-1.5 py-0.5 rounded border"
          style={{ color: levelColor, background: `rgba(${hexToRgb(levelColor)},0.12)`, borderColor: `rgba(${hexToRgb(levelColor)},0.25)` }}
        >
          胜任标准：{levelLabel}
        </span>
      </div>

      <div className="mt-auto">
        <div className="text-[11px] font-medium text-[#94a3b8] mb-1">胜任标准描述</div>
        <div className="text-xs text-[#64748b] leading-relaxed line-clamp-4">
          {binding.rubricDescription || "暂无胜任标准描述"}
        </div>
      </div>
    </div>
  )
}

function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
    : "148, 163, 184"
}
