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
    { icon: Briefcase, label: "收录岗位数", value: total, gradient: "from-blue-500 to-blue-600" },
    { icon: GraduationCap, label: "覆盖专业数", value: majorCount, gradient: "from-violet-500 to-violet-600" },
    { icon: Factory, label: "涉及行业", value: industryCount, gradient: "from-emerald-500 to-emerald-600" },
    { icon: Heart, label: "累计收藏", value: favoriteTotal, gradient: "from-rose-500 to-rose-600" },
  ]

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-8 relative z-10 -mt-16">
      <div className="bg-white/95 backdrop-blur rounded-2xl p-4 sm:p-6 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] border border-white/50">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {stats.map((s, i) => (
            <div
              key={i}
              className="flex items-center gap-3 sm:gap-4 w-full rounded-xl bg-gradient-to-br from-slate-50 to-white border border-slate-100 px-4 sm:px-5 py-4 sm:py-5"
            >
              <div className={`
                w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center text-white shadow-lg shrink-0
                bg-gradient-to-br ${s.gradient}
              `}>
                <s.icon className="w-6 h-6 sm:w-7 sm:h-7" />
              </div>
              <div className="min-w-0">
                <div className="text-2xl sm:text-3xl font-extrabold text-[#0f172a] leading-none">{s.value.toLocaleString()}</div>
                <div className="text-xs sm:text-sm text-[#64748b] mt-1.5">{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
