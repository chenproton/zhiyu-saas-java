'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { portalRequest } from '@/lib/api'
import { allianceLabel } from '@zhiyu/shared-types'
import type { AllianceAchievement } from '@/lib/types'
import { reportError } from '@/lib/error-handling'
import { LoadingView } from '@zhiyu/ui'
import { usePortalAuth } from '@/contexts/portal-auth-context'

import { useT } from '@/lib/i18n/locale-provider'
export default function AlliancePublicAchievementDetailPage() {
  const t = useT()
  const { id } = useParams<{ id: string }>()
  const { tenantId } = usePortalAuth()
  const [achievement, setAchievement] = useState<AllianceAchievement | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    portalRequest<AllianceAchievement>(
      `/alliance/public/achievements/${id}${tenantId ? `?tenantId=${tenantId}` : ''}`,
    )
      .then(setAchievement)
      .catch((err) => {
        reportError(err, { source: '加载成果详情' })
      })
      .finally(() => setLoading(false))
  }, [id, tenantId])

  if (loading) return <LoadingView />
  if (!achievement)
    return <div className="text-center py-12 text-muted-foreground">{t('成果不存在')}</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/portal/alliance/achievements"
          className="text-sm text-primary hover:underline inline-flex items-center gap-1"
        >
          <ArrowLeft className="h-4 w-4" /> {t('返回列表')}
        </Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold break-words">{achievement.title}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {allianceLabel('achievementType', achievement.type)}
            {achievement.achievementDate ? ` · ${achievement.achievementDate}` : ''}
          </p>
        </div>
        <div className="flex gap-2 items-center shrink-0">
          <Badge variant="outline">{allianceLabel('achievementStatus', achievement.status)}</Badge>
          <span className="text-sm text-muted-foreground">
            {t('{count} 次浏览', { count: achievement.viewCount })}
          </span>
        </div>
      </div>

      {achievement.coverImage && (
        <Image
          src={achievement.coverImage}
          alt={achievement.title}
          width={1200}
          height={675}
          className="w-full max-h-64 object-cover rounded-xl"
        />
      )}

      {achievement.description && (
        <Card>
          <CardHeader>
            <CardTitle>{t('成果描述')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{achievement.description}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
