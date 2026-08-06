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

export default function AlliancePublicMajorBrandDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [brand, setBrand] = useState<AllianceBrand | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    portalRequest<AllianceBrand>(`/alliance/public/brands/${id}`)
      .then(setBrand)
      .catch((err) => {
        reportError(err, { source: '加载专业品牌详情' })
      })
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <LoadingView />
  if (!brand) return <div className="text-center py-12 text-muted-foreground">品牌不存在</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/portal/alliance/brands?type=major"
          className="text-sm text-primary hover:underline inline-flex items-center gap-1"
        >
          <ArrowLeft className="h-4 w-4" /> 返回
        </Link>
      </div>

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold break-words">{brand.name}</h1>
          <p className="text-muted-foreground text-sm mt-1">专业品牌</p>
        </div>
        <Badge variant="outline" className="shrink-0">
          {allianceLabel('brandStatus', brand.status)}
        </Badge>
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
            <CardTitle>品牌介绍</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{brand.description}</p>
          </CardContent>
        </Card>
      )}

      {brand.data && Object.keys(brand.data).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>详细数据</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2 text-sm">
              {Object.entries(brand.data).map(([key, value]) => (
                <div key={key} className="flex gap-2 flex-col sm:flex-row sm:items-start">
                  <dt className="text-muted-foreground w-full sm:w-32 sm:shrink-0 break-words">
                    {key}:
                  </dt>
                  <dd className="break-words min-w-0">{String(value)}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
