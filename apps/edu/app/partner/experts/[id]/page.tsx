'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { partnerExpertApi, type PartnerExpert } from '@/lib/api'
import { useToast } from '@zhiyu/ui'
import { allianceLabel } from '@zhiyu/shared-types'
import { AllianceDetailShell } from '@/components/shared/alliance-detail-shell'
import { usePartnerAuth } from '@/components/partner-auth-provider'
import { useT } from '@/lib/i18n/locale-provider'

export default function PartnerExpertDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user, isAdmin, loading: authLoading } = usePartnerAuth()
  const { toast } = useToast()
  const t = useT()
  const [expert, setExpert] = useState<PartnerExpert | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading || !user || !id) return
    partnerExpertApi
      .get(id)
      .then(setExpert)
      .catch((err) =>
        toast({ title: t('加载失败'), description: err.message, variant: 'destructive' }),
      )
      .finally(() => setLoading(false))
  }, [authLoading, user, id, toast, t])

  if (!expert && !loading) {
    return <AllianceDetailShell title="" tabs={[]} notFound backHref="/partner/experts" />
  }

  const tabs = [
    {
      key: 'info',
      label: t('基本信息'),
      content: (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('基础信息')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">{t('性别：')}</span>
                {expert?.gender === 'male' ? t('男') : expert?.gender === 'female' ? t('女') : '-'}
              </p>
              <p>
                <span className="text-muted-foreground">{t('年龄：')}</span>
                {expert?.age ? t('{age}岁', { age: expert.age }) : '-'}
              </p>
              <p>
                <span className="text-muted-foreground">{t('所在城市：')}</span>
                {expert?.city || '-'}
              </p>
              <p>
                <span className="text-muted-foreground">{t('从业年限：')}</span>
                {expert?.experienceYears ? t('{years}年', { years: expert.experienceYears }) : '-'}
              </p>
              <p>
                <span className="text-muted-foreground">{t('教育背景：')}</span>
                {expert?.education || '-'}
              </p>
              <p>
                <span className="text-muted-foreground">{t('行业方向：')}</span>
                {expert?.industry || '-'}
              </p>
            </CardContent>
          </Card>
          {expert?.avatarUrl && (
            <Card>
              <CardHeader>
                <CardTitle>{t('头像')}</CardTitle>
              </CardHeader>
              <CardContent>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={expert.avatarUrl}
                  alt={expert.name}
                  className="w-24 h-32 object-cover rounded-lg"
                />
              </CardContent>
            </Card>
          )}
          {(expert?.specialties?.length ?? 0) > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{t('擅长领域')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {(expert?.specialties || []).map((s) => (
                    <Badge key={s} variant="secondary">
                      {s}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          {expert?.introduction && (
            <Card>
              <CardHeader>
                <CardTitle>{t('专家简介')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{expert.introduction}</p>
              </CardContent>
            </Card>
          )}
          {expert?.workExperience && (
            <Card>
              <CardHeader>
                <CardTitle>{t('从业经历')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{expert.workExperience}</p>
              </CardContent>
            </Card>
          )}
          {(expert?.attachments?.length ?? 0) > 0 && (
            <Card className="col-span-2">
              <CardHeader>
                <CardTitle>{t('资质荣誉')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {(expert?.attachments || []).map((a, i) => (
                    <a key={i} href={a} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={a}
                        alt={t('资质荣誉 {idx}', { idx: i + 1 })}
                        className="w-full aspect-[4/3] object-cover rounded-lg border border-slate-100 shadow-sm hover:opacity-80 transition-opacity"
                      />
                    </a>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      ),
    },
  ]

  return (
    <AllianceDetailShell
      title={expert?.name || ''}
      subtitle={[expert?.title, expert?.position].filter(Boolean).join(' · ')}
      statusBadge={
        expert ? (
          <span className="text-xs px-2 py-0.5 rounded-full bg-primary/5 text-primary">
            {allianceLabel('expertStatus', expert.status)}
          </span>
        ) : undefined
      }
      backHref="/partner/experts"
      editHref={isAdmin ? `/partner/experts/${id}/edit` : undefined}
      tabs={tabs}
      defaultTab="info"
      loading={loading || authLoading}
    />
  )
}
