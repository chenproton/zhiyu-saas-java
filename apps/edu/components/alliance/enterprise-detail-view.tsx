'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  AllianceDetailShell,
  DetailEmpty,
  DetailInfoBlock,
  DetailSectionCard,
  type DetailStat,
} from './alliance-detail-shell'
import {
  Building2,
  FileText,
  Award,
  Star,
  Calendar,
  Users,
  Phone,
  Mail,
  MapPin,
  Image as ImageIcon,
  ArrowUpRight,
} from 'lucide-react'
import type {
  AllianceExpert,
  AllianceProject,
  AllianceAchievement,
  AlliancePublicAgreement,
} from '@/lib/types'
import { allianceLabel } from '@zhiyu/shared-types'
import { useT } from '@/lib/i18n/locale-provider'


export interface ShowcaseEnterprise {
  name: string
  logoUrl?: string
  coverImage?: string
  industry?: string
  region?: string
  establishedYear?: number
  employeeCount?: number
  unifiedSocialCreditCode?: string
  description?: string
  coverPhotos?: string[]
  qualificationPhotos?: string[]
  intellectualPropertyPhotos?: string[]
  contactPerson?: string
  contactPhone?: string
  contactEmail?: string
  address?: string
}

export interface EnterpriseDetailViewProps {
  enterprise: ShowcaseEnterprise
  experts?: AllianceExpert[]
  projects?: AllianceProject[]
  achievements?: AllianceAchievement[]
  agreements?: AlliancePublicAgreement[]
  /** 企业端预览模式提示语：合作项目/成果/协议由合作学校维护 */
  schoolSectionsNote?: string
}

function PhotoGrid({ photos, alt }: { photos: string[]; alt: string }) {
  const t = useT()
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {photos.map((photo, idx) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={idx}
          src={photo}
          alt={t('{name} 照片 {idx}', { name: alt, idx: idx + 1 })}
          className="w-full aspect-[4/3] object-cover rounded-2xl border border-slate-100 shadow-sm"
        />
      ))}
    </div>
  )
}

function ContactRow({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50">
      <Icon className="h-4 w-4 text-slate-500 shrink-0" />
      <span className="text-sm text-slate-700 break-all">{text}</span>
    </div>
  )
}

/** 企业详情视图：portal 前台企业详情页与企业端「预览展示页」共用（两端统一样式） */
export function EnterpriseDetailView({
  enterprise,
  projects,
  achievements,
  agreements,
  schoolSectionsNote,
}: EnterpriseDetailViewProps) {
  const t = useT()

  const badges: string[] = []
  if (enterprise.industry) badges.push(enterprise.industry)
  if (enterprise.region) badges.push(enterprise.region)
  if (enterprise.establishedYear)
    badges.push(t('{year} 年成立', { year: enterprise.establishedYear }))
  if (enterprise.employeeCount) badges.push(t('{count} 人', { count: enterprise.employeeCount }))

  const stats: DetailStat[] = [
    {
      label: t('合作协议'),
      value: agreements?.length ?? 0,
      icon: FileText,
      gradient: 'from-blue-500 to-blue-600',
    },
    {
      label: t('合作项目'),
      value: projects?.length ?? 0,
      icon: Award,
      gradient: 'from-violet-500 to-violet-600',
    },
    {
      label: t('合作成果'),
      value: achievements?.length ?? 0,
      icon: Star,
      gradient: 'from-emerald-500 to-emerald-600',
    },
    {
      label: t('成立年份'),
      value: enterprise.establishedYear || '-',
      icon: Calendar,
      gradient: 'from-amber-500 to-amber-600',
    },
  ]

  const schoolNote = schoolSectionsNote ? (
    <div className="rounded-2xl bg-blue-50/60 border border-blue-100 p-5 text-sm text-slate-500">
      {schoolSectionsNote}
    </div>
  ) : null

  const agreementItems = agreements ?? []
  const projectItems = projects ?? []
  const achievementItems = achievements ?? []

  return (
    <AllianceDetailShell
      backHref="/portal/alliance/enterprises"
      backLabel={t('返回列表')}
      icon={Building2}
      iconImage={
        enterprise.logoUrl ? { src: enterprise.logoUrl, alt: enterprise.name } : undefined
      }
      iconGradient="from-blue-500 to-blue-600"
      title={enterprise.name}
      subtitle={
        enterprise.industry
          ? [enterprise.industry, enterprise.region].filter(Boolean).join(' · ')
          : undefined
      }
      badges={badges.map((b) => (
        <Badge
          key={b}
          variant="outline"
          className="bg-white/70 border-slate-200 text-slate-600"
        >
          {b}
        </Badge>
      ))}
      stats={stats}
      tabs={[
        {
          value: 'info',
          label: t('基本信息'),
          content: (
            <div className="grid lg:grid-cols-3 gap-6">
              <DetailSectionCard
                title={t('企业简介')}
                className="lg:col-span-2"
              >
                <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">
                  {enterprise.description || '-'}
                </p>
                <div className="border-t pt-6 mt-6">
                  <h4 className="text-sm font-semibold text-slate-900 mb-4">{t('其他信息')}</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
                    <DetailInfoBlock label={t('统一社会信用代码')} value={enterprise.unifiedSocialCreditCode} />
                    <DetailInfoBlock label={t('成立年份')} value={enterprise.establishedYear} />
                    <DetailInfoBlock
                      label={t('企业规模（人数）')}
                      value={enterprise.employeeCount ? `${enterprise.employeeCount.toLocaleString()} 人` : undefined}
                    />
                    <DetailInfoBlock label={t('所在地区')} value={enterprise.region} />
                    <DetailInfoBlock label={t('详细地址')} value={enterprise.address} />
                  </div>
                </div>
              </DetailSectionCard>

              <DetailSectionCard title={t('联系信息')} className="h-fit self-start">
                <div className="space-y-3">
                  {enterprise.contactPerson && (
                    <ContactRow icon={Users} text={`${t('联系人')}：${enterprise.contactPerson}`} />
                  )}
                  {enterprise.contactPhone && <ContactRow icon={Phone} text={enterprise.contactPhone} />}
                  {enterprise.contactEmail && <ContactRow icon={Mail} text={enterprise.contactEmail} />}
                  {enterprise.address && <ContactRow icon={MapPin} text={enterprise.address} />}
                  {!enterprise.contactPerson && !enterprise.contactPhone && !enterprise.contactEmail && !enterprise.address && (
                    <p className="text-sm text-slate-400">{t('暂无联系信息')}</p>
                  )}
                </div>
              </DetailSectionCard>

              {enterprise.intellectualPropertyPhotos &&
                enterprise.intellectualPropertyPhotos.length > 0 && (
                  <DetailSectionCard
                    icon={ImageIcon}
                    title={t('知识产权')}
                    className="lg:col-span-3"
                  >
                    <PhotoGrid photos={enterprise.intellectualPropertyPhotos} alt={enterprise.name} />
                  </DetailSectionCard>
                )}

              {enterprise.qualificationPhotos &&
                enterprise.qualificationPhotos.length > 0 && (
                  <DetailSectionCard
                    icon={ImageIcon}
                    title={t('企业荣誉资质')}
                    className="lg:col-span-3"
                  >
                    <PhotoGrid photos={enterprise.qualificationPhotos} alt={enterprise.name} />
                  </DetailSectionCard>
                )}

              {enterprise.coverPhotos && enterprise.coverPhotos.length > 0 && (
                <DetailSectionCard
                  icon={ImageIcon}
                  title={t('企业展示封面')}
                  className="lg:col-span-3"
                >
                  <PhotoGrid photos={enterprise.coverPhotos} alt={enterprise.name} />
                </DetailSectionCard>
              )}
            </div>
          ),
        },
        {
          value: 'agreements',
          label: t('合作协议'),
          count: agreementItems.length,
          content: (
            <Card className="border-0 shadow-sm rounded-3xl">
              <CardContent className="p-6">
                {schoolNote}
                {agreementItems.length > 0 ? (
                  <div className="space-y-4 mt-4">
                    {agreementItems.map((agreement) => (
                      <div
                        key={agreement.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between p-5 bg-slate-50 rounded-2xl gap-3"
                      >
                        <div>
                          <p className="font-semibold text-slate-900">{agreement.name}</p>
                          <p className="text-sm text-slate-500">
                            {agreement.type} ·{' '}
                            {t('有效期至 {date}', { date: agreement.endDate || '-' })}
                          </p>
                        </div>
                        <Badge variant="secondary">
                          {allianceLabel('agreementStatus', agreement.status)}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  !schoolNote && (
                    <DetailEmpty icon={FileText} title={t('暂无合作协议')} />
                  )
                )}
              </CardContent>
            </Card>
          ),
        },
        {
          value: 'projects',
          label: t('合作项目'),
          count: projectItems.length,
          content: (
            <Card className="border-0 shadow-sm rounded-3xl">
              <CardContent className="p-6">
                {schoolNote}
                {projectItems.length > 0 ? (
                  <div className="space-y-4 mt-4">
                    {projectItems.map((project) => (
                      <div
                        key={project.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between p-5 bg-slate-50 rounded-2xl gap-3"
                      >
                        <div>
                          <Link
                            href={`/portal/alliance/projects/${project.id}`}
                            className="font-semibold text-slate-900 hover:text-blue-600 transition-colors inline-flex items-center gap-1"
                          >
                            {project.name} <ArrowUpRight className="h-3.5 w-3.5" />
                          </Link>
                          <p className="text-sm text-slate-500">
                            {project.type} · {project.startDate || '-'} - {project.endDate || '-'}
                          </p>
                        </div>
                        <Badge variant="secondary">
                          {allianceLabel('projectPhase', project.phase)}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  !schoolNote && (
                    <DetailEmpty icon={Award} title={t('暂无合作项目')} />
                  )
                )}
              </CardContent>
            </Card>
          ),
        },
        {
          value: 'achievements',
          label: t('合作成果'),
          count: achievementItems.length,
          content: (
            <Card className="border-0 shadow-sm rounded-3xl">
              <CardContent className="p-6">
                {schoolNote}
                {achievementItems.length > 0 ? (
                  <div className="space-y-4 mt-4">
                    {achievementItems.map((achievement) => (
                      <div
                        key={achievement.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between p-5 bg-slate-50 rounded-2xl gap-3"
                      >
                        <div>
                          <Link
                            href={`/portal/alliance/achievements/${achievement.id}`}
                            className="font-semibold text-slate-900 hover:text-blue-600 transition-colors inline-flex items-center gap-1"
                          >
                            {achievement.title} <ArrowUpRight className="h-3.5 w-3.5" />
                          </Link>
                          <p className="text-sm text-slate-500">
                            {t('{date} 发布', { date: achievement.achievementDate || achievement.createdAt?.slice(0, 10) || '-' })}
                          </p>
                        </div>
                        <Badge variant="secondary">
                          {allianceLabel('achievementType', achievement.type)}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  !schoolNote && (
                    <DetailEmpty icon={Star} title={t('暂无合作成果')} />
                  )
                )}
              </CardContent>
            </Card>
          ),
        },
      ]}
    />
  )
}
