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
        { icon: Layers, label: "实践场景", value: total, gradient: "from-blue-500 to-blue-400", light: "from-blue-500/20 to-blue-400/5" },
        { icon: ClipboardList, label: "任务总数", value: majorCount, gradient: "from-violet-500 to-violet-400", light: "from-violet-500/20 to-violet-400/5" },
        { icon: Factory, label: "涉及行业", value: industryCount, gradient: "from-emerald-500 to-emerald-400", light: "from-emerald-500/20 to-emerald-400/5" },
      ]
    : [
        { icon: Briefcase, label: "收录岗位", value: total, gradient: "from-blue-500 to-blue-400", light: "from-blue-500/20 to-blue-400/5" },
        { icon: GraduationCap, label: "覆盖专业", value: majorCount, gradient: "from-violet-500 to-violet-400", light: "from-violet-500/20 to-violet-400/5" },
        { icon: Factory, label: "涉及行业", value: industryCount, gradient: "from-emerald-500 to-emerald-400", light: "from-emerald-500/20 to-emerald-400/5" },
      ]

  return (
    <div className="w-full lg:w-[460px] shrink-0 bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-5 text-white shadow-[0_8px_32px_rgba(0,0,0,0.18)]">
      <div className="flex items-center gap-2 text-[14px] font-bold mb-4">
        <div className="w-7 h-7 rounded-xl bg-white/15 border border-white/10 flex items-center justify-center">
          <BarChart3 className="w-4 h-4 text-white/90" />
        </div>
        平台数据概览
      </div>
      <div className="flex gap-3">
        {stats.map((s, i) => (
          <div
            key={i}
            className="flex-1 bg-white/10 hover:bg-white/15 transition-colors rounded-xl p-3 text-center border border-white/10"
          >
            <div
              className={`relative w-11 h-11 rounded-xl flex items-center justify-center text-white shadow-lg bg-gradient-to-br ${s.gradient} mx-auto mb-2 overflow-hidden`}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${s.light} opacity-0 group-hover:opacity-100 transition-opacity`} />
              <s.icon className="w-5 h-5 relative z-10" strokeWidth={2} />
            </div>
            <div className="text-[24px] font-bold leading-none tracking-tight">
              {s.value.toLocaleString()}
            </div>
            <div className="text-[12px] text-white/75 mt-1">{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
