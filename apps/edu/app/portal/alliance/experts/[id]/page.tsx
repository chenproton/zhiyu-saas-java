'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  AllianceDetailShell,
  DetailInfoBlock,
  DetailSectionCard,
} from '@/components/alliance/alliance-detail-shell'
import {
  UserCircle,
  Building2,
  ArrowUpRight,
  Star,
  Award,
} from 'lucide-react'
import { portalRequest } from '@/lib/api'
import { allianceLabel } from '@zhiyu/shared-types'
import type { AllianceEnterprise, AllianceExpert } from '@/lib/types'
import { reportError } from '@/lib/error-handling'
import { LoadingView, EmptyState } from '@zhiyu/ui'
import { usePortalAuth } from '@/contexts/portal-auth-context'
import { useT } from '@/lib/i18n/locale-provider'

export default function AlliancePublicExpertDetailPage() {
  const t = useT()
  const { id } = useParams<{ id: string }>()
  const { tenantId } = usePortalAuth()
  const [expert, setExpert] = useState<AllianceExpert | null>(null)
  const [loading, setLoading] = useState(true)
  // 归属企业公开性校验（企业未对外展示时"归属企业"不渲染链接，避免死链）
  const [enterpriseVisible, setEnterpriseVisible] = useState(true)

  useEffect(() => {
    if (!id || !tenantId) return
    portalRequest<AllianceExpert>(`/alliance/public/experts/${id}?tenantId=${tenantId}`)
      .then((e) => {
        setExpert(e)
        if (e.enterpriseId) {
          portalRequest<AllianceEnterprise>(
            `/alliance/public/enterprises/${e.enterpriseId}?tenantId=${tenantId}`,
          )
            .then(() => setEnterpriseVisible(true))
            .catch(() => setEnterpriseVisible(false))
        }
      })
      .catch((err) => {
        reportError(err, { source: '加载企业专家详情' })
      })
      .finally(() => setLoading(false))
  }, [id, tenantId])

  if (loading) return <LoadingView />
  if (!expert) return <EmptyState title={t('专家不存在')} />

  const enterpriseName = expert.enterpriseName || expert.organization
  const professionalFields = expert.professionalFields ?? []
  const specialties = expert.specialties ?? []
  const honors = expert.attachments ?? []

  return (
    <AllianceDetailShell
      breadcrumbs={[
        { label: t('校企合作联盟首页'), href: '/portal/alliance/landing' },
        { label: t('企业专家列表'), href: '/portal/alliance/experts' },
        { label: expert.name },
      ]}
      backHref="/portal/alliance/experts"
      icon={UserCircle}
      iconImage={
        expert.avatarUrl ? { src: expert.avatarUrl, alt: expert.name } : undefined
      }
      iconGradient="from-blue-500 to-violet-600"
      pageGradient="from-slate-50 via-white to-blue-50/40"
      title={expert.name}
      subtitle={[expert.title, expert.position].filter(Boolean).join(' · ') || undefined}
      badges={[
        expert.rating && (
          <Badge key="rating" variant="outline" className="bg-white/70 border-slate-200 text-slate-600">
            <Star className="h-3 w-3 mr-1 text-amber-500" />
            {allianceLabel('expertRating', expert.rating)}
          </Badge>
        ),
        <Badge key="status" variant="outline" className="bg-white/70 border-slate-200 text-slate-600">
          {allianceLabel('expertStatus', expert.status)}
        </Badge>,
      ].filter(Boolean)}
      tabs={[
        {
          value: 'info',
          label: t('基本信息'),
          content: (
            <div className="grid lg:grid-cols-3 gap-6">
              <DetailSectionCard title={t('基本信息')} className="lg:col-span-2">
                <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-5">
                  <DetailInfoBlock label={t('行业')} value={expert.industry} />
                  <DetailInfoBlock label={t('城市')} value={expert.city} />
                  <DetailInfoBlock
                    label={t('从业年限')}
                    value={
                      expert.experienceYears
                        ? t('{years}年', { years: expert.experienceYears })
                        : undefined
                    }
                  />
                  <DetailInfoBlock label={t('学历')} value={expert.education} />
                  <DetailInfoBlock label={t('专家类型')} value={expert.expertType} />
                </div>
                {enterpriseName && (
                  <div className="mt-5">
                    <p className="text-sm text-slate-500 mb-2.5">{t('归属企业')}</p>
                    {expert.enterpriseId && enterpriseVisible ? (
                      <Link
                        href={`/portal/alliance/enterprises/${expert.enterpriseId}`}
                        className="inline-flex items-center gap-1 font-medium text-slate-900 hover:text-blue-600 transition-colors"
                      >
                        <Building2 className="h-4 w-4" />
                        {enterpriseName} <ArrowUpRight className="h-3.5 w-3.5" />
                      </Link>
                    ) : expert.enterpriseId ? (
                      <span className="inline-flex items-center gap-1 font-medium text-slate-400">
                        <Building2 className="h-4 w-4" />
                        {enterpriseName}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-medium text-slate-900">
                        <Building2 className="h-4 w-4" />
                        {enterpriseName}
                      </span>
                    )}
                  </div>
                )}
              </DetailSectionCard>

              {(professionalFields.length > 0 || specialties.length > 0) && (
                <DetailSectionCard title={t('专业领域与专长')} className="h-fit self-start">
                  <div className="space-y-4">
                    {professionalFields.length > 0 && (
                      <div>
                        <p className="text-sm text-slate-500 mb-2">{t('专业领域')}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {professionalFields.map((field) => (
                            <Badge key={field} variant="secondary" className="font-normal">
                              {field}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {specialties.length > 0 && (
                      <div>
                        <p className="text-sm text-slate-500 mb-2">{t('专长')}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {specialties.map((s) => (
                            <Badge key={s} variant="secondary" className="font-normal">
                              {s}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </DetailSectionCard>
              )}
            </div>
          ),
        },
        {
          value: 'introduction',
          label: t('个人简介'),
          content: (
            <DetailSectionCard icon={Award} title={t('个人简介')}>
              {expert.introduction ? (
                <p className="text-slate-700 leading-7 text-[15px] whitespace-pre-wrap">
                  {expert.introduction}
                </p>
              ) : (
                <EmptyState
                  icon={<UserCircle className="h-10 w-10 opacity-50" />}
                  title={t('暂无简介')}
                  titleClassName="text-slate-500"
                  className="py-16"
                />
              )}
              {expert.workExperience && (
                <div className="border-t pt-6 mt-6">
                  <h4 className="text-sm font-semibold text-slate-900 mb-3">{t('工作经历')}</h4>
                  <p className="text-slate-700 leading-7 text-[15px] whitespace-pre-wrap">
                    {expert.workExperience}
                  </p>
                </div>
              )}
            </DetailSectionCard>
          ),
        },
        {
          value: 'honors',
          label: t('资质荣誉'),
          count: honors.length,
          content: (
            <Card className="border-0 shadow-sm rounded-3xl">
              <CardContent className="p-6">
                {honors.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {honors.map((honor, idx) => (
                      <a key={idx} href={honor} target="_blank" rel="noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={honor}
                          alt={t('资质荣誉 {idx}', { idx: idx + 1 })}
                          className="w-full aspect-[4/3] object-cover rounded-2xl border border-slate-100 shadow-sm hover:opacity-80 transition-opacity"
                        />
                      </a>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={<Award className="h-10 w-10 opacity-50" />}
                    title={t('暂无资质荣誉')}
                    titleClassName="text-slate-500"
                    className="py-16"
                  />
                )}
              </CardContent>
            </Card>
          ),
        },
      ]}
    />
  )
}
