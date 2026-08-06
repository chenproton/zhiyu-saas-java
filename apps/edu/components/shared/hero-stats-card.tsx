'use client'

import { BarChart3 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface HeroStat {
  icon: LucideIcon
  label: string
  value: number
}

const STAT_GRADIENTS = [
  'from-primary to-primary/80',
  'from-primary/90 to-primary/70',
  'from-primary/80 to-primary/60',
  'from-primary/90 to-primary/70',
]

/**
 * Hero 右侧统计卡片：磨砂玻璃容器 + 2×2 数据格子（图标 tile + 数字 + 标签 + 迷你进度条）。
 * evaluation/lesson/library 三个 landing 页共用。
 */
export function HeroStatsCard({ title, stats }: { title: string; stats: HeroStat[] }) {
  const max = Math.max(...stats.map((s) => s.value), 1)

  return (
    <div className="bg-white/10 backdrop-blur-xl border border-white/15 rounded-2xl p-7 text-white shadow-[0_12px_40px_rgba(0,0,0,0.25)]">
      <div className="text-[15px] font-bold text-white/90 mb-5 flex items-center gap-2">
        <span className="w-5 h-5 rounded-md bg-white/20 flex items-center justify-center">
          <BarChart3 className="w-3 h-3" />
        </span>
        {title}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {stats.map((s, i) => (
          <div
            key={i}
            className="bg-white/[0.08] border border-white/10 rounded-xl p-4 transition-all hover:bg-white/[0.14] hover:-translate-y-0.5"
          >
            <div
              className={`w-9 h-9 rounded-lg flex items-center justify-center text-white shadow-md bg-gradient-to-br ${
                STAT_GRADIENTS[i % STAT_GRADIENTS.length]
              } mb-3`}
            >
              <s.icon className="w-4.5 h-4.5" strokeWidth={1.8} />
            </div>
            <div className="text-[24px] font-bold leading-none tracking-tight tabular-nums">
              {s.value.toLocaleString()}
            </div>
            <div className="text-[12px] text-white/60 mt-1.5 font-medium">{s.label}</div>
            <div className="h-1 rounded-full bg-white/10 mt-3 overflow-hidden">
              <div
                className="h-full rounded-full bg-white/70 transition-all"
                style={{ width: `${(s.value / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
