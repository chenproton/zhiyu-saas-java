"use client"

import { Briefcase, GraduationCap, Factory, Heart } from "lucide-react"

interface StatsBarProps {
  total: number
  majorCount: number
  industryCount: number
  favoriteTotal?: number
}

export function StatsBar({ total, majorCount, industryCount, favoriteTotal = 0 }: StatsBarProps) {
  const stats = [
    { icon: Briefcase, label: "收录岗位数", value: total },
    { icon: GraduationCap, label: "覆盖专业数", value: majorCount },
    { icon: Factory, label: "涉及行业", value: industryCount },
    { icon: Heart, label: "累计收藏", value: favoriteTotal },
  ]

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-8 relative z-10 -mt-16">
      <div className="bg-white/95 backdrop-blur rounded-2xl px-6 sm:px-12 py-7 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] border border-white/50">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
          {stats.map((s, i) => (
            <div key={i} className="flex flex-col items-center text-center gap-2.5">
              <div className={`
                w-12 h-12 sm:w-[52px] sm:h-[52px] rounded-[14px] flex items-center justify-center text-white shadow-lg
                ${i === 0 ? "bg-gradient-to-br from-blue-500 to-blue-600" : ""}
                ${i === 1 ? "bg-gradient-to-br from-violet-500 to-violet-600" : ""}
                ${i === 2 ? "bg-gradient-to-br from-emerald-500 to-emerald-600" : ""}
                ${i === 3 ? "bg-gradient-to-br from-rose-500 to-rose-600" : ""}
              `}>
                <s.icon className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div className="text-2xl sm:text-[28px] font-extrabold text-[#0f172a] leading-none">{s.value.toLocaleString()}</div>
              <div className="text-xs sm:text-sm text-[#64748b]">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
