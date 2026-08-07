'use client'

import { Scale } from 'lucide-react'
import { useT } from '@/lib/i18n/locale-provider'

export function TaskWeightCard() {
  const t = useT()
  return (
    <div className="flex flex-col items-center justify-center h-full text-gray-400">
      <Scale className="h-12 w-12 mb-3 opacity-50" />
      <p className="text-sm">{t('任务权重已在全局配置')}</p>
      <p className="text-xs mt-1">{t('请点击顶部「配置任务权重」按钮进行设置')}</p>
    </div>
  )
}
