"use client"

import { Briefcase, GraduationCap, Factory, BarChart3, Layers, ClipboardList } from "lucide-react"

interface StatsBarProps {
  total: number
  majorCount: number
  industryCount: number
  favoriteTotal?: number
  mode?: "job" | "scene"
}

export function StatsBar({ total, majorCount, industryCount, mode = "job" }: StatsBarProps) {
  const isScene = mode === "scene"
  const stats = isScene
    ? [
        { icon: Layers, label: "实践场景", value: total, gradient: "from-blue-400 to-blue-600" },
        { icon: ClipboardList, label: "任务总数", value: majorCount, gradient: "from-violet-400 to-violet-600" },
        { icon: Factory, label: "涉及行业", value: industryCount, gradient: "from-emerald-400 to-emerald-600" },
      ]
    : [
        { icon: Briefcase, label: "收录岗位", value: total, gradient: "from-blue-400 to-blue-600" },
        { icon: GraduationCap, label: "覆盖专业", value: majorCount, gradient: "from-violet-400 to-violet-600" },
        { icon: Factory, label: "涉及行业", value: industryCount, gradient: "from-emerald-400 to-emerald-600" },
      ]

  return (
    <div className="w-full lg:w-[420px] shrink-0 bg-white/12 backdrop-blur-[16px] border border-white/20 rounded-2xl p-5 text-white shadow-[0_8px_32px_rgba(0,0,0,0.2)]">
      <div className="flex items-center gap-2 text-[14px] font-bold mb-4">
        <BarChart3 className="w-4 h-4 text-white/80" />
        平台数据概览
      </div>
      <div className="flex gap-3">
        {stats.map((s, i) => (
          <div
            key={i}
            className="flex-1 bg-white/10 hover:bg-white/15 transition-colors rounded-xl p-3 text-center"
          >
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg bg-gradient-to-br ${s.gradient} mx-auto mb-2`}
            >
              <s.icon className="w-5 h-5" strokeWidth={2} />
            </div>
            <div className="text-[22px] font-extrabold leading-none">
              {s.value.toLocaleString()}
            </div>
            <div className="text-[12px] text-white/70 mt-1">{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
