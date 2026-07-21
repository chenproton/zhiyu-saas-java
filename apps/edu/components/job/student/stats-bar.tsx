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
    { icon: Briefcase, label: "收录岗位数", value: total, gradient: "from-blue-500 to-blue-700" },
    { icon: GraduationCap, label: "覆盖专业数", value: majorCount, gradient: "from-violet-500 to-violet-700" },
    { icon: Factory, label: "涉及行业", value: industryCount, gradient: "from-emerald-500 to-emerald-700" },
    { icon: Heart, label: "累计收藏", value: favoriteTotal, gradient: "from-orange-500 to-orange-700" },
  ]

  return (
    <div className="max-w-[1400px] mx-auto px-8 relative z-10 -mt-16">
      <div className="bg-white rounded-t-[20px] px-12 py-8 shadow-[0_-8px_30px_rgba(0,0,0,0.08)]">
        <div className="flex justify-around items-center">
          {stats.map((s, i) => (
            <div key={i} className="flex flex-col items-center text-center gap-2.5">
              <div
                className={`w-[52px] h-[52px] rounded-[14px] flex items-center justify-center text-white text-2xl shadow-lg bg-gradient-to-br ${s.gradient}`}
              >
                <s.icon className="w-6 h-6" strokeWidth={2} />
              </div>
              <div>
                <div className="text-[28px] font-extrabold text-[#0f172a] leading-none">
                  {s.value.toLocaleString()}
                </div>
                <div className="text-sm text-[#64748b] mt-2">{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
