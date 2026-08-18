'use client'

import { Layers, ClipboardList, Lightbulb, Eye, Heart } from 'lucide-react'
import type { CareerPosition } from '@/lib/types'
import { useT } from '@/lib/i18n/locale-provider'

interface StatsBoxProps {
  position: CareerPosition
  scenarioCount?: number
  taskCount?: number
  abilityPointCount?: number
}

export function StatsBox({
  position,
  scenarioCount = 0,
  taskCount = 0,
  abilityPointCount = 0,
}: StatsBoxProps) {
  const t = useT()
  const stats = [
    { icon: Layers, value: scenarioCount, label: t('关联场景数') },
    { icon: ClipboardList, value: taskCount, label: t('涉及任务数') },
    { icon: Lightbulb, value: abilityPointCount, label: t('能力点数') },
    { icon: Eye, value: position.viewCount ?? 0, label: t('岗位浏览量') },
    { icon: Heart, value: position.favoriteCount ?? 0, label: t('岗位收藏量') },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
      {stats.map((s, i) => (
        <div
          key={i}
          className="bg-white rounded-xl border border-[#e2e8f0] shadow-[0_1px_3px_rgba(0,0,0,0.04)] px-3 py-5 text-center transition-all hover:border-primary/25 hover:shadow-[0_4px_12px] hover:shadow-primary/10"
        >
          <div className="text-[28px] font-bold text-[#1e293b] leading-tight mb-1.5">
            {typeof s.value === 'number' ? s.value.toLocaleString() : s.value}
          </div>
          <div className="text-[13px] text-[#64748b] flex items-center justify-center gap-1.5">
            <s.icon className="w-3.5 h-3.5" />
            {s.label}
          </div>
        </div>
      ))}
    </div>
  )
}
