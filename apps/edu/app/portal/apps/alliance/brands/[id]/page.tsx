'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { usePortalAuth } from '@/contexts/portal-auth-context'
import { allianceBrandApi } from '@/lib/api'
import { useToast } from '@zhiyu/ui'
import { allianceLabel } from '@zhiyu/shared-types'
import { AllianceDetailShell } from '@/components/shared/alliance-detail-shell'
import { EmployerBrandDetail } from '@/components/alliance/employer-brand-detail'
import { MajorBrandDetail } from '@/components/alliance/major-brand-detail'
import { useT } from '@/lib/i18n/locale-provider'
import type { AllianceBrand } from '@/lib/types'

export default function AllianceBrandDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { tenantId } = usePortalAuth()
  const { toast } = useToast()
  const t = useT()
  const [brand, setBrand] = useState<AllianceBrand | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!tenantId || !id) return
    allianceBrandApi
      .get(id)
      .then((b) => setBrand(b))
      .catch((e) => toast({ title: t('加载失败'), description: e.message, variant: 'destructive' }))
      .finally(() => setLoading(false))
  }, [tenantId, id, toast, t])

  if (brand?.brandType === 'employer' && id) {
    return <EmployerBrandDetail id={id} />
  }

  if (brand?.brandType === 'major' && id) {
    return <MajorBrandDetail id={id} />
  }

  if (!brand && !loading) {
    return (
      <AllianceDetailShell title="" tabs={[]} notFound backHref="/portal/apps/alliance/brands" />
    )
  }

  const related: { label: string; value?: string | null }[] = [
    { label: t('关联学生'), value: brand?.studentId },
    { label: t('关联企业'), value: brand?.enterpriseId },
    { label: t('关联岗位'), value: brand?.positionId },
    { label: t('关联专业'), value: brand?.majorId },
    { label: t('关联教师'), value: brand?.teacherId },
    { label: t('关联专家'), value: brand?.expertId },
  ].filter((x) => x.value)

  const tabs = [
    {
      key: 'info',
      label: t('基本信息'),
      content: (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('品牌信息')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">{t('品牌类型：')}</span>
                {allianceLabel('brandType', brand?.brandType)}
              </p>
              <p>
                <span className="text-muted-foreground">{t('推荐：')}</span>
                {brand?.isFeatured ? t('是') : t('否')}
              </p>
              <p>
                <span className="text-muted-foreground">{t('前台展示：')}</span>
                {brand?.isPublic ? t('是') : t('否')}
              </p>
              <p>
                <span className="text-muted-foreground">{t('排序：')}</span>
                {brand?.sortOrder ?? 0}
              </p>
            </CardContent>
          </Card>
          {related.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{t('关联对象')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {related.map((r) => (
                  <p key={r.label}>
                    <span className="text-muted-foreground">{r.label}：</span>
                    <Badge variant="secondary">{r.value}</Badge>
                  </p>
                ))}
              </CardContent>
            </Card>
          )}
          {brand?.description && (
            <Card className="col-span-2">
              <CardHeader>
                <CardTitle>{t('品牌描述')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{brand.description}</p>
              </CardContent>
            </Card>
          )}
          {brand?.data && JSON.stringify(brand.data) !== '{}' && (
            <Card className="col-span-2">
              <CardHeader>
                <CardTitle>{t('数据详情')}</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs text-muted-foreground whitespace-pre-wrap">
                  {JSON.stringify(brand.data, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}
        </div>
      ),
    },
  ]

  return (
    <AllianceDetailShell
      title={brand?.name || ''}
      subtitle={allianceLabel('brandType', brand?.brandType)}
      backHref="/portal/apps/alliance/brands"
      tabs={tabs}
      defaultTab="info"
      loading={loading}
    />
  )
}
