'use client'

import { Badge } from '@/components/ui/badge'
import { useT } from '@/lib/i18n/locale-provider'
import type { AIContentStatus } from '@/lib/api'

/** AI 中心内容状态徽章：private=私有(灰) pending=审核中(黄) published=已发布(绿) rejected=已驳回(红) */
export function AIStatusBadge({ status }: { status: AIContentStatus }) {
  const t = useT()
  const map: Record<AIContentStatus, { label: string; className: string }> = {
    private: { label: t('私有'), className: 'bg-gray-100 text-gray-600 border-gray-200' },
    pending: { label: t('审核中'), className: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
    published: { label: t('已发布'), className: 'bg-green-100 text-green-700 border-green-200' },
    rejected: { label: t('已驳回'), className: 'bg-red-100 text-red-700 border-red-200' },
  }
  const item = map[status] ?? map.private
  return (
    <Badge variant="outline" className={item.className}>
      {item.label}
    </Badge>
  )
}
