"use client"

import { Briefcase, GraduationCap, Factory, Eye } from "lucide-react"

interface StatsBarProps {
  total: number
  majorCount: number
  industryCount: number
  viewCount?: number
}

export function StatsBar({ total, majorCount, industryCount, viewCount = 1286 }: StatsBarProps) {
  const stats = [
    { icon: Briefcase, label: "收录岗位数", value: total },
    { icon: GraduationCap, label: "覆盖专业数", value: majorCount },
    { icon: Factory, label: "涉及行业", value: industryCount },
    { icon: Eye, label: "浏览人次", value: viewCount },
  ]

  return (
    <div className="max-w-[1400px] mx-auto px-8 relative z-10 -mt-16">
      <div className="bg-white rounded-t-[20px] px-12 py-8 shadow-[0_-8px_30px_rgba(0,0,0,0.08)]">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((s, i) => (
            <div key={i} className="flex flex-col items-center text-center gap-3">
              <div className={`
                w-[52px] h-[52px] rounded-[14px] flex items-center justify-center text-white text-2xl shadow-lg
                ${i === 0 ? "bg-gradient-to-br from-blue-500 to-blue-600" : ""}
                ${i === 1 ? "bg-gradient-to-br from-violet-500 to-violet-600" : ""}
                ${i === 2 ? "bg-gradient-to-br from-green-500 to-green-600" : ""}
                ${i === 3 ? "bg-gradient-to-br from-orange-500 to-orange-600" : ""}
              `}>
                <s.icon className="w-6 h-6" />
              </div>
              <div className="text-[28px] font-extrabold text-[#0f172a] leading-none">{s.value}+</div>
              <div className="text-sm text-[#64748b]">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
