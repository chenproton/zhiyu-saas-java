"use client"

import { Briefcase, GraduationCap, Factory, Heart, BarChart3 } from "lucide-react"

interface StatsBarProps {
  total: number
  majorCount: number
  industryCount: number
  favoriteTotal?: number
}

export function StatsBar({ total, majorCount, industryCount, favoriteTotal = 0 }: StatsBarProps) {
  const stats = [
    { icon: Briefcase, label: "收录岗位数", value: total, gradient: "from-blue-400 to-blue-600" },
    { icon: GraduationCap, label: "覆盖专业数", value: majorCount, gradient: "from-violet-400 to-violet-600" },
    { icon: Factory, label: "涉及行业", value: industryCount, gradient: "from-emerald-400 to-emerald-600" },
    { icon: Heart, label: "累计收藏", value: favoriteTotal, gradient: "from-orange-400 to-orange-600" },
  ]

  return (
    <div className="w-full lg:w-[360px] shrink-0 bg-white/12 backdrop-blur-[16px] border border-white/20 rounded-2xl p-6 text-white shadow-[0_8px_32px_rgba(0,0,0,0.2)]">
      <div className="flex items-center gap-2 text-[15px] font-bold mb-5">
        <BarChart3 className="w-4 h-4 text-white/80" />
        平台数据概览
      </div>
      <div className="grid grid-cols-2 gap-4">
        {stats.map((s, i) => (
          <div
            key={i}
            className="bg-white/10 hover:bg-white/15 transition-colors rounded-xl p-4 flex items-center gap-3"
          >
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center text-white shadow-lg bg-gradient-to-br ${s.gradient}`}
            >
              <s.icon className="w-5 h-5" strokeWidth={2} />
            </div>
            <div>
              <div className="text-[24px] font-extrabold leading-none">
                {s.value.toLocaleString()}
              </div>
              <div className="text-[12px] text-white/70 mt-1">{s.label}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
