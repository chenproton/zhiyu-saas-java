'use client'

import Image from 'next/image'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import type {
  AllianceExpert,
  AllianceProject,
  AllianceAchievement,
  AlliancePublicAgreement,
} from '@/lib/types'
import { allianceLabel } from '@zhiyu/shared-types'
import { useT } from '@/lib/i18n/locale-provider'
import {
  ExpertCard,
  ProjectCard,
  AchievementCard,
  GradientPlaceholder,
  getInitials,
} from './public-cards'

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

export interface EnterpriseShowcaseProps {
  enterprise: ShowcaseEnterprise
  experts?: AllianceExpert[]
  projects?: AllianceProject[]
  achievements?: AllianceAchievement[]
  agreements?: AlliancePublicAgreement[]
  /** 预览模式提示语：在合作项目/成果/协议版块位置展示（该内容由合作学校维护） */
  schoolSectionsNote?: string
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-900 border-l-4 border-primary pl-3">
        {title}
      </h2>
      {children}
    </section>
  )
}

function PhotoGrid({ photos, alt }: { photos: string[]; alt: string }) {
  const t = useT()
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {photos.map((photo, idx) => (
        <div
          key={idx}
          className="relative w-full aspect-[4/3] rounded-lg overflow-hidden border border-slate-100"
        >
          <Image
            src={photo}
            alt={t('{name} 照片 {idx}', { name: alt, idx: idx + 1 })}
            fill
            className="object-cover"
          />
        </div>
      ))}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  const t = useT()
  return (
    <p>
      <span className="text-muted-foreground">{t('{label}：', { label })}</span>
      {value ?? '-'}
    </p>
  )
}

/** BOSS 直聘公司主页式企业展示页（纯展示，props 驱动；公开详情页与企业端预览共用） */
export function EnterpriseShowcase({
  enterprise,
  experts,
  projects,
  achievements,
  agreements,
  schoolSectionsNote,
}: EnterpriseShowcaseProps) {
  const t = useT()
  const badges: string[] = []
  if (enterprise.industry) badges.push(enterprise.industry)
  if (enterprise.region) badges.push(enterprise.region)
  if (enterprise.establishedYear)
    badges.push(t('{year} 年成立', { year: enterprise.establishedYear }))
  if (enterprise.employeeCount) badges.push(t('{count} 人', { count: enterprise.employeeCount }))

  const honorPhotos = [
    ...(enterprise.qualificationPhotos ?? []),
    ...(enterprise.intellectualPropertyPhotos ?? []),
  ]

  return (
    <div className="space-y-8">
      {/* 1. Hero：横幅 + logo + 企业名 + 徽标行 */}
      <div className="rounded-2xl overflow-hidden border border-[#e7e5e4] bg-white shadow-sm">
        <div className="relative h-48 sm:h-64">
          {enterprise.coverImage ? (
            <Image
              src={enterprise.coverImage}
              alt={enterprise.name}
              fill
              className="object-cover"
            />
          ) : (
            <GradientPlaceholder seed={enterprise.industry} className="absolute inset-0" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          <div className="absolute bottom-4 left-4 right-4 sm:bottom-6 sm:left-6 sm:right-6">
            <div className="flex items-end gap-4">
              <Avatar className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl border-2 border-white/80 shadow-lg bg-white shrink-0">
                {enterprise.logoUrl && (
                  <AvatarImage src={enterprise.logoUrl} className="object-cover" />
                )}
                <AvatarFallback className="rounded-2xl bg-white text-slate-800 font-bold text-lg">
                  {getInitials(enterprise.name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1 pb-1">
                <h1 className="text-xl sm:text-2xl font-bold text-white drop-shadow-md truncate">
                  {enterprise.name}
                </h1>
                {badges.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {badges.map((b) => (
                      <Badge
                        key={b}
                        className="bg-white/90 text-slate-800 border-0 shadow-sm text-[11px] font-medium backdrop-blur-sm"
                      >
                        {b}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. 企业简介 */}
      {enterprise.description && (
        <Section title={t('企业简介')}>
          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
            {enterprise.description}
          </p>
        </Section>
      )}

      {/* 3. 企业风采 */}
      {enterprise.coverPhotos && enterprise.coverPhotos.length > 0 && (
        <Section title={t('企业风采')}>
          <PhotoGrid photos={enterprise.coverPhotos} alt={enterprise.name} />
        </Section>
      )}

      {/* 4. 专家团队 */}
      {experts && experts.length > 0 && (
        <Section title={t('专家团队')}>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {experts.map((expert) => (
              <ExpertCard key={expert.id} expert={expert} />
            ))}
          </div>
        </Section>
      )}

      {/* 5. 合作项目 / 合作成果 */}
      {projects && projects.length > 0 && (
        <Section title={t('合作项目')}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        </Section>
      )}
      {achievements && achievements.length > 0 && (
        <Section title={t('合作成果')}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {achievements.map((achievement) => (
              <AchievementCard key={achievement.id} achievement={achievement} />
            ))}
          </div>
        </Section>
      )}
      {agreements && agreements.length > 0 && (
        <Section title={t('合作协议')}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {agreements.map((agreement) => (
              <Card key={agreement.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{agreement.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    {agreement.type && <Badge variant="outline">{agreement.type}</Badge>}
                    <Badge variant="secondary">
                      {allianceLabel('agreementStatus', agreement.status)}
                    </Badge>
                  </div>
                  {(agreement.startDate || agreement.endDate) && (
                    <p className="text-muted-foreground">
                      {agreement.startDate ?? '-'} ~ {agreement.endDate ?? '-'}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </Section>
      )}
      {schoolSectionsNote && (
        <p className="text-sm text-muted-foreground">{schoolSectionsNote}</p>
      )}

      {/* 6. 资质荣誉 */}
      {honorPhotos.length > 0 && (
        <Section title={t('资质荣誉')}>
          <PhotoGrid photos={honorPhotos} alt={enterprise.name} />
        </Section>
      )}

      {/* 7. 工商信息 + 8. 联系方式（恒渲染） */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('工商信息')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <InfoRow label={t('统一社会信用代码')} value={enterprise.unifiedSocialCreditCode} />
            <InfoRow label={t('成立年份')} value={enterprise.establishedYear} />
            <InfoRow
              label={t('企业规模（人数）')}
              value={enterprise.employeeCount}
            />
            <InfoRow label={t('所在地区')} value={enterprise.region} />
            <InfoRow label={t('详细地址')} value={enterprise.address} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t('联系方式')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <InfoRow label={t('联系人')} value={enterprise.contactPerson} />
            <InfoRow label={t('电话')} value={enterprise.contactPhone} />
            <InfoRow label={t('邮箱')} value={enterprise.contactEmail} />
            <InfoRow label={t('地址')} value={enterprise.address} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
