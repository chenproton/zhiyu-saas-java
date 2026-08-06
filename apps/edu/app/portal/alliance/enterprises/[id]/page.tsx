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
import type { AllianceEnterprise } from '@/lib/types'
import { reportError } from '@/lib/error-handling'
import { LoadingView } from '@zhiyu/ui'

export default function AlliancePublicEnterpriseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [enterprise, setEnterprise] = useState<AllianceEnterprise | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    portalRequest<AllianceEnterprise>(`/alliance/public/enterprises/${id}`)
      .then(setEnterprise)
      .catch((err) => {
        reportError(err, { source: '加载合作企业详情' })
      })
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <LoadingView />
  if (!enterprise) return <div className="text-center py-12 text-muted-foreground">企业不存在</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/portal/alliance/enterprises"
          className="text-sm text-primary hover:underline inline-flex items-center gap-1"
        >
          <ArrowLeft className="h-4 w-4" /> 返回列表
        </Link>
      </div>

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold break-words">{enterprise.name}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {allianceLabel('enterpriseType', enterprise.enterpriseType)}
            {enterprise.industry ? ` · ${enterprise.industry}` : ''}
          </p>
        </div>
        <Badge variant="outline" className="shrink-0">
          {allianceLabel('enterpriseStatus', enterprise.status)}
        </Badge>
      </div>

      {enterprise.logoUrl && (
        <Image
          src={enterprise.logoUrl}
          alt={enterprise.name}
          width={64}
          height={64}
          className="h-16 object-contain"
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>基本信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">所属行业：</span>
              {enterprise.industry || '-'}
            </p>
            <p>
              <span className="text-muted-foreground">所在地区：</span>
              {enterprise.region || '-'}
            </p>
            <p>
              <span className="text-muted-foreground">合作评级：</span>
              {allianceLabel('enterpriseRating', enterprise.rating)}
            </p>
            <p>
              <span className="text-muted-foreground">地址：</span>
              {enterprise.address || '-'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>联系信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">联系人：</span>
              {enterprise.contactPerson || '-'}
            </p>
            <p>
              <span className="text-muted-foreground">电话：</span>
              {enterprise.contactPhone || '-'}
            </p>
            <p>
              <span className="text-muted-foreground">邮箱：</span>
              {enterprise.contactEmail || '-'}
            </p>
          </CardContent>
        </Card>
      </div>

      {enterprise.description && (
        <Card>
          <CardHeader>
            <CardTitle>企业介绍</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{enterprise.description}</p>
          </CardContent>
        </Card>
      )}

      {enterprise.coverPhotos && enterprise.coverPhotos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>企业风采</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {enterprise.coverPhotos.map((photo, idx) => (
                <div key={idx} className="relative w-full h-40 rounded-lg overflow-hidden">
                  <Image
                    src={photo}
                    alt={`${enterprise.name} 照片 ${idx + 1}`}
                    fill
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
