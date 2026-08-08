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
import type { AllianceBrand } from '@/lib/types'
import { reportError } from '@/lib/error-handling'
import { LoadingView } from '@zhiyu/ui'

import { useT } from '@/lib/i18n/locale-provider'

export default function AlliancePublicBrandDetailPage() {
  const t = useT()
  const { id } = useParams<{ id: string }>()
  const [brand, setBrand] = useState<AllianceBrand | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    portalRequest<AllianceBrand>(`/alliance/public/brands/${id}`)
      .then(setBrand)
      .catch((err) => {
        reportError(err, { source: '加载品牌详情' })
      })
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <LoadingView />
  if (!brand)
    return <div className="text-center py-12 text-muted-foreground">{t('品牌不存在')}</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/portal/alliance/brands"
          className="text-sm text-primary hover:underline inline-flex items-center gap-1"
        >
          <ArrowLeft className="h-4 w-4" /> {t('返回列表')}
        </Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold break-words">{brand.name}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {allianceLabel('brandType', brand.brandType)}
          </p>
        </div>
        <div className="flex gap-2 items-center shrink-0">
          <Badge variant="outline">{allianceLabel('brandStatus', brand.status)}</Badge>
          <span className="text-sm text-muted-foreground">
            {t('{count} 次浏览', { count: brand.viewCount })}
          </span>
        </div>
      </div>

      {brand.coverImage && (
        <Image
          src={brand.coverImage}
          alt={brand.name}
          width={1200}
          height={675}
          className="w-full max-h-64 object-cover rounded-xl"
        />
      )}

      {brand.description && (
        <Card>
          <CardHeader>
            <CardTitle>{t('品牌介绍')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{brand.description}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
