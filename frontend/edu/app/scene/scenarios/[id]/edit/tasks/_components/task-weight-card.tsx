'use client'

import { Scale } from 'lucide-react'
import { EmptyState } from '@zhiyu/ui'
import { useT } from '@/lib/i18n/locale-provider'

export function TaskWeightCard() {
  const t = useT()
  return (
    <EmptyState
      className="h-full py-0 text-gray-400"
      icon={<Scale className="h-12 w-12 opacity-50" />}
      iconClassName="text-gray-400"
      title={t('任务权重已在全局配置')}
      titleClassName="text-gray-400"
      description={t('请点击顶部「配置任务权重」按钮进行设置')}
    />
  )
}
