'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { portalRequest } from '@/lib/api'
import type {
  AllianceEnterprise,
  AllianceExpert,
  AllianceProject,
  AllianceAchievement,
  AlliancePublicAgreement,
} from '@/lib/types'
import { reportError } from '@/lib/error-handling'
import { LoadingView } from '@zhiyu/ui'
import { usePortalAuth } from '@/contexts/portal-auth-context'
import {
  EnterpriseDetailView,
  type ShowcaseEnterprise,
} from '@/components/alliance/enterprise-detail-view'

import { useT } from '@/lib/i18n/locale-provider'

/** 公开 API 字段 optional/omitempty，数组可能为 null，归一化为 ShowcaseEnterprise */
function toShowcase(e: AllianceEnterprise): ShowcaseEnterprise {
  return {
    name: e.name,
    logoUrl: e.logoUrl ?? undefined,
    coverImage: e.coverImage ?? undefined,
    industry: e.industry ?? undefined,
    region: e.region ?? undefined,
    establishedYear: e.establishedYear ?? undefined,
    employeeCount: e.employeeCount ?? undefined,
    unifiedSocialCreditCode: e.unifiedSocialCreditCode ?? undefined,
    description: e.description ?? undefined,
    coverPhotos: e.coverPhotos ?? [],
    qualificationPhotos: e.qualificationPhotos ?? [],
    intellectualPropertyPhotos: e.intellectualPropertyPhotos ?? [],
    contactPerson: e.contactPerson ?? undefined,
    contactPhone: e.contactPhone ?? undefined,
    contactEmail: e.contactEmail ?? undefined,
    address: e.address ?? undefined,
  }
}

export default function AlliancePublicEnterpriseDetailPage() {
  const t = useT()
  const { id } = useParams<{ id: string }>()
  const { tenantId } = usePortalAuth()
  const [enterprise, setEnterprise] = useState<ShowcaseEnterprise | null>(null)
  const [projects, setProjects] = useState<AllianceProject[]>([])
  const [achievements, setAchievements] = useState<AllianceAchievement[]>([])
  const [agreements, setAgreements] = useState<AlliancePublicAgreement[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    // 与后台一致：详情与关联内容均限定本校链接范围，其他租户/已解除合作的企业不可见
    const q = tenantId ? `?tenantId=${tenantId}` : ''
    Promise.all([
      portalRequest<AllianceEnterprise>(`/alliance/public/enterprises/${id}${q}`),
      portalRequest<{ items: AllianceExpert[] }>(`/alliance/public/experts${q}`),
      portalRequest<{ items: AllianceProject[] }>(`/alliance/public/projects${q}`),
      portalRequest<{ items: AllianceAchievement[] }>(`/alliance/public/achievements${q}`),
      portalRequest<{ items: AlliancePublicAgreement[] }>(`/alliance/public/agreements${q}`),
    ])
      .then(([ent, , projectsRes, achievementsRes, agreementsRes]) => {
        setEnterprise(toShowcase(ent))
        // 本企业直接关联的项目（企业项目集，供协议/成果二次关联过滤）
        const enterpriseProjects = (projectsRes.items ?? []).filter((p) =>
          (p.enterpriseIds ?? []).includes(id),
        )
        const projectIds = enterpriseProjects.map((p) => p.id)
        setProjects(enterpriseProjects)
        setAchievements(
          (achievementsRes.items ?? []).filter(
            (a) =>
              (a.enterpriseIds ?? []).includes(id) ||
              (a.projectIds ?? []).some((pid) => projectIds.includes(pid)),
          ),
        )
        setAgreements(
          (agreementsRes.items ?? []).filter(
            (a) =>
              (a.enterpriseIds ?? []).includes(id) ||
              (a.projectIds ?? []).some((pid) => projectIds.includes(pid)),
          ),
        )
      })
      .catch((err) => {
        reportError(err, { source: '加载合作企业详情' })
      })
      .finally(() => setLoading(false))
  }, [id, tenantId])

  if (loading) return <LoadingView />
  if (!enterprise)
    return <div className="text-center py-12 text-muted-foreground">{t('企业不存在')}</div>

  return (
    <EnterpriseDetailView
      enterprise={enterprise}
      projects={projects}
      achievements={achievements}
      agreements={agreements}
    />
  )
}
