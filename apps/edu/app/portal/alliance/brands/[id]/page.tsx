'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import {
  AllianceDetailShell,
  DetailEmpty,
  DetailInfoBlock,
  DetailSectionCard,
  type DetailStat,
} from '@/components/alliance/alliance-detail-shell'
import { ContactRow, PhotoGrid } from '@/components/alliance/enterprise-detail-view'
import {
  RelatedObjectCard,
  normalizeRelatedRefs,
} from '@/components/alliance/related-object-card'
import { employerBrandOf } from '@/components/alliance/public-cards'
import { CertCards } from '@/components/job/student/cert-cards'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Building2,
  Briefcase,
  Users,
  Calendar,
  Image as ImageIcon,
  FileText,
  Trophy,
  BookOpen,
  Award,
  Target,
  ListChecks,
  TrendingUp,
  UserCircle,
  Star,
} from 'lucide-react'
import { portalRequest } from '@/lib/api'
import { allianceLabel } from '@zhiyu/shared-types'
import type { AlliancePublicBrand, AllianceEnterprise } from '@/lib/types'
import { reportError } from '@/lib/error-handling'
import { LoadingView, EmptyState } from '@zhiyu/ui'
import { usePortalAuth } from '@/contexts/portal-auth-context'

import { useT } from '@/lib/i18n/locale-provider'

interface PositionSnapshot {
  id: string
  name: string
  positionType?: string
  salaryMin?: number
  salaryMax?: number
  majorNames?: string[]
}

interface HiredStudent {
  studentId: string
  name: string
  studentNo?: string
  jobId: string
  jobName?: string
  majorName?: string
}

function salaryText(p: { salaryMin?: number; salaryMax?: number }) {
  if (p.salaryMin == null && p.salaryMax == null) return '-'
  if (p.salaryMin == null) return `${p.salaryMax}K`
  if (p.salaryMax == null) return `${p.salaryMin}K`
  return `${p.salaryMin}-${p.salaryMax}K`
}

export default function AlliancePublicBrandDetailPage() {
  const t = useT()
  const { id } = useParams<{ id: string }>()
  const { tenantId } = usePortalAuth()
  const [brand, setBrand] = useState<AlliancePublicBrand | null>(null)
  const [loading, setLoading] = useState(true)
  // 岗位品牌列表：雇主品牌「关联岗位」卡片跳转对应的岗位品牌详情页
  const [jobBrands, setJobBrands] = useState<AlliancePublicBrand[]>([])
  // 专业品牌「专业合作企业」：独立雇主企业跳品牌详情，合作企业跳企业详情
  const [employerBrands, setEmployerBrands] = useState<AlliancePublicBrand[]>([])
  const [publicEnterprises, setPublicEnterprises] = useState<AllianceEnterprise[]>([])

  useEffect(() => {
    if (!id) return
    portalRequest<AlliancePublicBrand>(`/alliance/public/brands/${id}`)
      .then((b) => {
        setBrand(b)
        if (b.brandType === 'employer') {
          return portalRequest<{ items: AlliancePublicBrand[] }>(
            '/alliance/public/brands?brandType=job',
          )
            .then((res) => setJobBrands(res.items || []))
            .catch(() => setJobBrands([]))
        }
        if (b.brandType === 'major') {
          return Promise.all([
            portalRequest<{ items: AlliancePublicBrand[] }>(
              '/alliance/public/brands?brandType=employer',
            ),
            tenantId
              ? portalRequest<{ items: AllianceEnterprise[] }>(
                  `/alliance/public/enterprises?tenantId=${tenantId}`,
                )
              : Promise.resolve({ items: [] as AllianceEnterprise[] }),
          ])
            .then(([brandsRes, entsRes]) => {
              setEmployerBrands(brandsRes.items || [])
              setPublicEnterprises(entsRes.items || [])
            })
            .catch(() => {
              setEmployerBrands([])
              setPublicEnterprises([])
            })
        }
      })
      .catch((err) => {
        reportError(err, { source: '加载品牌详情' })
      })
      .finally(() => setLoading(false))
  }, [id, tenantId])

  const isEmployer = brand?.brandType === 'employer'
  const isIndependent = isEmployer && !brand?.enterpriseId
  const isJob = brand?.brandType === 'job'
  const isMajor = brand?.brandType === 'major'
  const isTeacher = brand?.brandType === 'teacher'

  /** 企业资料归一化（引用企业与独立雇主企业统一：与企业详情展示字段一致） */
  const enterprise = useMemo(() => {
    if (!brand || !isEmployer) return null
    return employerBrandOf(brand)
  }, [brand, isEmployer])

  // ── 岗位品牌：岗位资料 ────────────────────────────────────────
  const responsibilities = isJob ? (brand?.responsibilities ?? []) : []
  const certificates = isJob ? (brand?.certificates ?? []) : []
  const jobRequirements = isJob ? (brand?.positionRequirements ?? []) : []
  const jobMajors = isJob ? (brand?.majorNames ?? []) : []

  // ── 师资品牌：教师/企业专家资料 ────────────────────────────────
  const person = useMemo(() => {
    if (!brand || !isTeacher) return null
    return {
      name: brand.personName || brand.name,
      avatarUrl: brand.personAvatar,
      title: brand.personTitle,
      position: brand.personPosition,
      organization: brand.personOrganization,
      industry: brand.personIndustry,
      experienceYears: brand.personExperienceYears,
      education: brand.personEducation,
      introduction: brand.personIntroduction,
      workExperience: brand.personWorkExperience,
      city: brand.personCity,
      expertType: brand.personExpertType,
      rating: brand.personRating,
      status: brand.personStatus,
      gender: brand.personGender,
      age: brand.personAge,
      specialties: Array.isArray(brand.personSpecialties) ? brand.personSpecialties : [],
      professionalFields: Array.isArray(brand.personProfessionalFields)
        ? brand.personProfessionalFields
        : [],
      attachments: Array.isArray(brand.personAttachments) ? brand.personAttachments : [],
    }
  }, [brand, isTeacher])

  // 专业品牌：关联内容（专业就业方向/合作企业/合作成果/特色课程）存于 data
  const majorData = (() => {
    if (!isMajor || !brand?.data) return null
    const d = brand.data
    return {
      directions: normalizeRelatedRefs(d?.employmentDirections),
      enterprises: normalizeRelatedRefs(d?.cooperationEnterprises),
      achievements: normalizeRelatedRefs(d?.cooperationAchievements),
      courses: normalizeRelatedRefs(d?.featuredCourses),
    }
  })()

  /** 独立雇主企业品牌 id 集合（专业合作企业关联对象命中时跳品牌详情页） */
  const employerBrandIds = useMemo(() => {
    const ids = new Set<string>()
    for (const eb of employerBrands) if (!eb.enterpriseId) ids.add(eb.id)
    return ids
  }, [employerBrands])

  /** 可访问合作企业 id 集合（link active 且对外展示；未命中时降级为不可访问卡片） */
  const publicEnterpriseIds = useMemo(() => {
    const ids = new Set<string>()
    for (const e of publicEnterprises) ids.add(e.id)
    return ids
  }, [publicEnterprises])

  const majorTabs = useMemo(() => {
    if (!isMajor || !majorData) return []
    return [
      {
        value: 'directions',
        label: t('专业就业方向'),
        count: majorData.directions.length,
        content: (
          <Card className="border-0 shadow-sm rounded-3xl">
            <CardContent className="p-6">
              {majorData.directions.length === 0 ? (
                <EmptyState
                  icon={<Briefcase className="h-10 w-10 opacity-50" />}
                  title={t('暂未配置就业方向')}
                  titleClassName="text-slate-500"
                  className="py-16"
                />
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {majorData.directions.map((d) => (
                    <RelatedObjectCard key={d.id} item={d} kind="brands" />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ),
      },
      {
        value: 'enterprises',
        label: t('专业合作企业'),
        count: majorData.enterprises.length,
        content: (
          <Card className="border-0 shadow-sm rounded-3xl">
            <CardContent className="p-6">
              {majorData.enterprises.length === 0 ? (
                <EmptyState
                  icon={<Building2 className="h-10 w-10 opacity-50" />}
                  title={t('暂未关联合作企业')}
                  titleClassName="text-slate-500"
                  className="py-16"
                />
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {majorData.enterprises.map((e) => {
                    const kind = employerBrandIds.has(e.id)
                      ? ('brands' as const)
                      : publicEnterpriseIds.has(e.id)
                        ? ('enterprises' as const)
                        : null
                    if (!kind) {
                      // 关联对象暂未对外展示（合作状态/展示开关未开）：置灰卡片提示
                      return (
                        <div
                          key={e.id}
                          className="group relative bg-slate-50 rounded-2xl overflow-hidden border border-dashed border-slate-200 flex flex-col"
                        >
                          <div className="h-28 relative flex items-center justify-center">
                            <Building2 className="w-8 h-8 text-slate-300" strokeWidth={1.5} />
                          </div>
                          <div className="px-3.5 pb-3.5">
                            <div className="text-sm font-bold leading-snug line-clamp-2 text-slate-400">
                              {e.name}
                            </div>
                            <div className="mt-1.5 inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-100 font-medium">
                              {t('企业暂未对外展示')}
                            </div>
                          </div>
                        </div>
                      )
                    }
                    return <RelatedObjectCard key={e.id} item={e} kind={kind} />
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        ),
      },
      {
        value: 'achievements',
        label: t('专业合作成果'),
        count: majorData.achievements.length,
        content: (
          <Card className="border-0 shadow-sm rounded-3xl">
            <CardContent className="p-6">
              {majorData.achievements.length === 0 ? (
                <EmptyState
                  icon={<Trophy className="h-10 w-10 opacity-50" />}
                  title={t('暂未关联合作成果')}
                  titleClassName="text-slate-500"
                  className="py-16"
                />
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {majorData.achievements.map((a) => (
                    <RelatedObjectCard key={a.id} item={a} kind="achievements" />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ),
      },
      {
        value: 'courses',
        label: t('专业特色课程'),
        count: majorData.courses.length,
        content: (
          <Card className="border-0 shadow-sm rounded-3xl">
            <CardContent className="p-6">
              {majorData.courses.length === 0 ? (
                <EmptyState
                  icon={<BookOpen className="h-10 w-10 opacity-50" />}
                  title={t('暂未关联特色课程')}
                  titleClassName="text-slate-500"
                  className="py-16"
                />
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {majorData.courses.map((c) => (
                    <RelatedObjectCard key={c.id} item={c} kind="courses" />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ),
      },
    ]
  }, [isMajor, majorData, employerBrandIds, publicEnterpriseIds, t])

  /** 岗位 positionId → 岗位品牌（关联岗位卡片跳转岗位品牌详情页） */
  const jobBrandByPosition = useMemo(() => {
    const map = new Map<string, AlliancePublicBrand>()
    for (const jb of jobBrands) if (jb.positionId) map.set(jb.positionId, jb)
    return map
  }, [jobBrands])

  if (loading) return <LoadingView />
  if (!brand) return <EmptyState title={t('品牌不存在')} />

  const positions: PositionSnapshot[] = isEmployer ? (brand.data?.positions ?? []) : []
  const hiredStudents: HiredStudent[] = isEmployer ? (brand.data?.hiredStudents ?? []) : []

  const studentsByJob = new Map<string, HiredStudent[]>()
  for (const s of hiredStudents) {
    const key = s.jobId
    if (!studentsByJob.has(key)) studentsByJob.set(key, [])
    studentsByJob.get(key)!.push(s)
  }

  /* ------------------------------ 岗位品牌 ------------------------------ */
  if (isJob) {
    const jobName = brand.positionName || brand.name
    const jobTypeLabel =
      brand.positionType === 'teaching'
        ? t('教学岗位')
        : brand.positionType === 'enterprise'
          ? t('企业岗位')
          : undefined
    const stats: DetailStat[] = [
      {
        label: t('薪资范围'),
        value: salaryText(brand),
        icon: TrendingUp,
        gradient: 'from-amber-500 to-orange-500',
      },
      {
        label: t('适用专业'),
        value: jobMajors.length,
        icon: BookOpen,
        gradient: 'from-blue-500 to-indigo-500',
      },
      {
        label: t('工作职责'),
        value: responsibilities.length,
        icon: ListChecks,
        gradient: 'from-emerald-500 to-teal-500',
      },
      {
        label: t('相关证书'),
        value: certificates.length,
        icon: Award,
        gradient: 'from-violet-500 to-purple-500',
      },
    ]
    return (
      <AllianceDetailShell
        breadcrumbs={[
          { label: t('校企合作联盟首页'), href: '/portal/alliance/landing' },
          { label: t('品牌列表'), href: '/portal/alliance/brands?type=job' },
          { label: jobName },
        ]}
        backHref="/portal/alliance/brands?type=job"
        icon={Briefcase}
        iconImage={
          brand.positionCoverImage
            ? { src: brand.positionCoverImage, alt: jobName }
            : undefined
        }
        iconGradient="from-emerald-500 to-teal-600"
        pageGradient="from-slate-50 via-white to-emerald-50/40"
        title={jobName}
        subtitle={t('岗位品牌')}
        badges={[
          jobTypeLabel && (
            <Badge
              key="type"
              variant="outline"
              className="bg-white/70 border-slate-200 text-slate-600"
            >
              {jobTypeLabel}
            </Badge>
          ),
          brand.industryName && (
            <Badge
              key="industry"
              variant="outline"
              className="bg-white/70 border-slate-200 text-slate-600"
            >
              {brand.industryName}
            </Badge>
          ),
        ].filter(Boolean)}
        stats={stats}
        tabs={[
          {
            value: 'info',
            label: t('基本信息'),
            content: (
              <div className="grid lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  <DetailSectionCard icon={FileText} title={t('岗位简介')}>
                    {brand.positionCoverImage && (
                      <div className="aspect-video bg-slate-100 rounded-xl overflow-hidden border border-slate-100 mb-5">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={brand.positionCoverImage}
                          alt={jobName}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    {brand.positionDescription || brand.description ? (
                      <p className="text-slate-700 leading-7 text-[15px] whitespace-pre-wrap">
                        {brand.positionDescription || brand.description}
                      </p>
                    ) : (
                      <DetailEmpty icon={FileText} title={t('暂无岗位简介')} />
                    )}
                  </DetailSectionCard>
                </div>
                <div className="space-y-6">
                  <DetailSectionCard icon={Briefcase} title={t('岗位信息')}>
                    <div className="space-y-3">
                      <DetailInfoBlock label={t('岗位类型')} value={jobTypeLabel} />
                      <DetailInfoBlock
                        label={t('薪资范围')}
                        value={
                          brand.salaryMin == null && brand.salaryMax == null
                            ? undefined
                            : salaryText(brand)
                        }
                      />
                      <DetailInfoBlock label={t('面向行业')} value={brand.industryName} />
                      <div>
                        <p className="text-xs text-slate-400 mb-2">{t('适用专业')}</p>
                        {jobMajors.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {jobMajors.map((m) => (
                              <Badge key={m} variant="secondary" className="font-normal">
                                {m}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-slate-400">-</p>
                        )}
                      </div>
                    </div>
                  </DetailSectionCard>
                </div>
              </div>
            ),
          },
          {
            value: 'duties',
            label: t('工作职责'),
            count: responsibilities.length,
            content: (
              <DetailSectionCard icon={ListChecks} title={t('工作职责')}>
                {responsibilities.length === 0 ? (
                  <DetailEmpty icon={ListChecks} title={t('暂无工作职责')} />
                ) : (
                  <div className="space-y-4">
                    {responsibilities.map((r, idx) => (
                      <div
                        key={r.id}
                        className="flex gap-4 rounded-2xl bg-slate-50 p-5"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/70 text-white text-sm font-bold">
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900">{r.name}</p>
                          {r.description && (
                            <p className="text-slate-600 text-sm leading-6 mt-1.5 whitespace-pre-wrap">
                              {r.description}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </DetailSectionCard>
            ),
          },
          {
            value: 'requirements',
            label: t('任职要求'),
            count: jobRequirements.length,
            content: (
              <DetailSectionCard icon={Target} title={t('任职要求')}>
                {jobRequirements.length === 0 ? (
                  <DetailEmpty icon={Target} title={t('暂无任职要求')} />
                ) : (
                  <div className="space-y-3">
                    {jobRequirements.map((req, idx) => (
                      <div key={idx} className="flex items-start gap-3">
                        <span className="mt-[7px] h-2 w-2 shrink-0 rounded-full bg-primary/60" />
                        <p className="text-slate-700 leading-7 text-[15px]">{req}</p>
                      </div>
                    ))}
                  </div>
                )}
              </DetailSectionCard>
            ),
          },
          {
            value: 'careerPath',
            label: t('发展路径'),
            content: (
              <DetailSectionCard icon={TrendingUp} title={t('发展路径')}>
                {brand.positionCareerPath ? (
                  <p className="text-slate-700 leading-7 text-[15px] whitespace-pre-wrap">
                    {brand.positionCareerPath}
                  </p>
                ) : (
                  <DetailEmpty icon={TrendingUp} title={t('暂无发展路径')} />
                )}
              </DetailSectionCard>
            ),
          },
          {
            value: 'certs',
            label: t('相关证书'),
            count: certificates.length,
            content: (
              <Card className="border-0 shadow-sm rounded-3xl">
                <CardContent className="p-6">
                  <CertCards certificates={certificates} />
                </CardContent>
              </Card>
            ),
          },
        ]}
      />
    )
  }

  /* ------------------------------ 师资品牌 ------------------------------ */
  if (isTeacher && person) {
    const subtitle = [person.title, person.position].filter(Boolean).join(' · ') || undefined
    const honors = person.attachments
    const personTypeLabel = brand.expertId ? t('企业专家') : t('校本教师')
    return (
      <AllianceDetailShell
        breadcrumbs={[
          { label: t('校企合作联盟首页'), href: '/portal/alliance/landing' },
          { label: t('品牌列表'), href: '/portal/alliance/brands?type=teacher' },
          { label: person.name },
        ]}
        backHref="/portal/alliance/brands?type=teacher"
        icon={UserCircle}
        iconImage={
          person.avatarUrl ? { src: person.avatarUrl, alt: person.name } : undefined
        }
        iconGradient="from-blue-500 to-violet-600"
        pageGradient="from-slate-50 via-white to-blue-50/40"
        title={person.name}
        subtitle={subtitle}
        badges={[
          person.rating && (
            <Badge
              key="rating"
              variant="outline"
              className="bg-white/70 border-slate-200 text-slate-600"
            >
              <Star className="h-3 w-3 mr-1 text-amber-500" />
              {allianceLabel('expertRating', person.rating)}
            </Badge>
          ),
          <Badge
            key="type"
            variant="outline"
            className="bg-white/70 border-slate-200 text-slate-600"
          >
            {personTypeLabel}
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
                    <DetailInfoBlock label={t('行业')} value={person.industry} />
                    <DetailInfoBlock label={t('城市')} value={person.city} />
                    <DetailInfoBlock
                      label={t('从业年限')}
                      value={
                        person.experienceYears
                          ? t('{years}年', { years: person.experienceYears })
                          : undefined
                      }
                    />
                    <DetailInfoBlock label={t('学历')} value={person.education} />
                    <DetailInfoBlock label={t('性别')} value={person.gender ? (person.gender === 'male' ? t('男') : t('女')) : undefined} />
                    <DetailInfoBlock label={t('类型')} value={personTypeLabel} />
                  </div>
                  {person.organization && (
                    <div className="mt-5">
                      <p className="text-sm text-slate-500 mb-2.5">
                        {brand.expertId ? t('归属机构') : t('归属院系')}
                      </p>
                      <span className="inline-flex items-center gap-1 font-medium text-slate-900">
                        <Building2 className="h-4 w-4" />
                        {person.organization}
                      </span>
                    </div>
                  )}
                </DetailSectionCard>

                {(person.professionalFields.length > 0 || person.specialties.length > 0) && (
                  <DetailSectionCard title={t('专业领域与专长')} className="h-fit self-start">
                    <div className="space-y-4">
                      {person.professionalFields.length > 0 && (
                        <div>
                          <p className="text-sm text-slate-500 mb-2">{t('专业领域')}</p>
                          <div className="flex flex-wrap gap-1.5">
                            {person.professionalFields.map((field) => (
                              <Badge key={field} variant="secondary" className="font-normal">
                                {field}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {person.specialties.length > 0 && (
                        <div>
                          <p className="text-sm text-slate-500 mb-2">{t('专长')}</p>
                          <div className="flex flex-wrap gap-1.5">
                            {person.specialties.map((s) => (
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
                {person.introduction ? (
                  <p className="text-slate-700 leading-7 text-[15px] whitespace-pre-wrap">
                    {person.introduction}
                  </p>
                ) : (
                  <DetailEmpty icon={UserCircle} title={t('暂无简介')} />
                )}
                {person.workExperience && (
                  <div className="border-t pt-6 mt-6">
                    <h4 className="text-sm font-semibold text-slate-900 mb-3">{t('工作经历')}</h4>
                    <p className="text-slate-700 leading-7 text-[15px] whitespace-pre-wrap">
                      {person.workExperience}
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
                    <DetailEmpty icon={Award} title={t('暂无资质荣誉')} />
                  )}
                </CardContent>
              </Card>
            ),
          },
        ]}
      />
    )
  }

  /* ------------------------------ 雇主品牌 / 其他 ------------------------------ */

  const badges: string[] = []
  if (isIndependent) {
    const entType = (brand.data?.enterpriseInfo as any)?.enterpriseType
    if (entType) badges.push(allianceLabel('enterpriseType', entType))
  }
  if (enterprise?.industry) badges.push(enterprise.industry)
  if (enterprise?.region) badges.push(enterprise.region)
  if (enterprise?.establishedYear)
    badges.push(t('{year} 年成立', { year: enterprise.establishedYear }))
  if (enterprise?.employeeCount)
    badges.push(t('{count} 人', { count: enterprise.employeeCount }))

  const stats: DetailStat[] = isEmployer
    ? [
        {
          label: t('关联岗位'),
          value: positions.length,
          icon: Briefcase,
          gradient: 'from-primary to-primary/80',
        },
        {
          label: t('已招聘学生'),
          value: hiredStudents.length,
          icon: Users,
          gradient: 'from-primary/90 to-primary/70',
        },
        {
          label: t('成立年份'),
          value: enterprise?.establishedYear || '-',
          icon: Calendar,
          gradient: 'from-primary/90 to-primary/70',
        },
      ]
    : []

  const infoTab = isMajor ? (
    <div className="grid lg:grid-cols-3 gap-6">
      <DetailSectionCard title={t('品牌介绍')} className="lg:col-span-3">
        {brand.coverImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={brand.coverImage}
            alt={brand.name}
            className="w-full max-h-64 object-cover rounded-2xl mb-6"
          />
        )}
        {brand.description ? (
          <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">{brand.description}</p>
        ) : (
          <EmptyState
            icon={<FileText className="h-10 w-10 opacity-50" />}
            title={t('暂无品牌介绍')}
            titleClassName="text-slate-500"
            className="py-16"
          />
        )}
      </DetailSectionCard>
    </div>
  ) : isEmployer ? (
    <div className="grid lg:grid-cols-3 gap-6">
      <DetailSectionCard title={t('企业简介')} className="lg:col-span-2">
        <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">
          {enterprise?.description || '-'}
        </p>
        <div className="border-t pt-6 mt-6">
          <h4 className="text-sm font-semibold text-slate-900 mb-4">{t('其他信息')}</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
            <DetailInfoBlock
              label={t('统一社会信用代码')}
              value={enterprise?.creditCode}
            />
            {isIndependent && (
              <DetailInfoBlock
                label={t('企业类型')}
                value={allianceLabel(
                  'enterpriseType',
                  (brand.data?.enterpriseInfo as any)?.enterpriseType,
                )}
              />
            )}
            <DetailInfoBlock label={t('成立年份')} value={enterprise?.establishedYear} />
            <DetailInfoBlock
              label={t('企业规模（人数）')}
              value={
                enterprise?.employeeCount
                  ? `${enterprise.employeeCount.toLocaleString()} 人`
                  : undefined
              }
            />
            <DetailInfoBlock label={t('所在地区')} value={enterprise?.region} />
            <DetailInfoBlock label={t('详细地址')} value={enterprise?.address} />
          </div>
        </div>
      </DetailSectionCard>

      <DetailSectionCard title={t('联系信息')} className="h-fit self-start">
        <div className="space-y-3">
          {enterprise?.contactPerson && (
            <ContactRow icon={Users} text={`${t('联系人')}：${enterprise.contactPerson}`} />
          )}
          {enterprise?.contactPhone && (
            <ContactRow icon={Building2} text={enterprise.contactPhone} />
          )}
          {enterprise?.contactEmail && (
            <ContactRow icon={Building2} text={enterprise.contactEmail} />
          )}
          {enterprise?.address && <ContactRow icon={Building2} text={enterprise.address} />}
          {!enterprise?.contactPerson &&
            !enterprise?.contactPhone &&
            !enterprise?.contactEmail &&
            !enterprise?.address && <p className="text-sm text-slate-400">{t('暂无联系信息')}</p>}
        </div>
      </DetailSectionCard>

      {brand.description && (
        <DetailSectionCard
          icon={FileText}
          title={t('品牌介绍')}
          className="lg:col-span-3"
        >
          <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">{brand.description}</p>
        </DetailSectionCard>
      )}

      {enterprise?.businessLicensePhotos && enterprise.businessLicensePhotos.length > 0 && (
        <DetailSectionCard icon={ImageIcon} title={t('营业执照')} className="lg:col-span-3">
          <PhotoGrid photos={enterprise.businessLicensePhotos} alt={brand.name} />
        </DetailSectionCard>
      )}

      {enterprise?.intellectualPropertyPhotos &&
        enterprise.intellectualPropertyPhotos.length > 0 && (
          <DetailSectionCard icon={ImageIcon} title={t('知识产权')} className="lg:col-span-3">
            <PhotoGrid photos={enterprise.intellectualPropertyPhotos} alt={brand.name} />
          </DetailSectionCard>
        )}

      {enterprise?.qualificationPhotos && enterprise.qualificationPhotos.length > 0 && (
        <DetailSectionCard icon={ImageIcon} title={t('企业荣誉资质')} className="lg:col-span-3">
          <PhotoGrid photos={enterprise.qualificationPhotos} alt={brand.name} />
        </DetailSectionCard>
      )}

      {enterprise?.coverPhotos && enterprise.coverPhotos.length > 0 && (
        <DetailSectionCard icon={ImageIcon} title={t('企业展示封面')} className="lg:col-span-3">
          <PhotoGrid photos={enterprise.coverPhotos} alt={brand.name} />
        </DetailSectionCard>
      )}
    </div>
  ) : (
    <div className="grid lg:grid-cols-3 gap-6">
      <DetailSectionCard title={t('品牌介绍')} className="lg:col-span-3">
        {brand.coverImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={brand.coverImage}
            alt={brand.name}
            className="w-full max-h-64 object-cover rounded-2xl mb-6"
          />
        )}
        {brand.description ? (
          <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">{brand.description}</p>
        ) : (
          <EmptyState
            icon={<FileText className="h-10 w-10 opacity-50" />}
            title={t('暂无品牌介绍')}
            titleClassName="text-slate-500"
            className="py-16"
          />
        )}
      </DetailSectionCard>
    </div>
  )

  return (
    <AllianceDetailShell
      breadcrumbs={[
        { label: t('校企合作联盟首页'), href: '/portal/alliance/landing' },
        { label: t('品牌列表'), href: '/portal/alliance/brands' },
        { label: brand.name },
      ]}
      backHref="/portal/alliance/brands"
      icon={Building2}
      iconImage={
        enterprise?.logoUrl ? { src: enterprise.logoUrl, alt: brand.name } : undefined
      }
      iconGradient="from-blue-500 to-blue-600"
      coverImage={enterprise?.coverImage}
      title={brand.name}
      subtitle={
        isEmployer
          ? `${allianceLabel('brandType', brand.brandType)} · ${
              isIndependent ? t('独立雇主企业') : t('合作企业')
            }`
          : allianceLabel('brandType', brand.brandType)
      }
      badges={badges.map((b) => (
        <Badge key={b} variant="outline" className="bg-white/70 border-slate-200 text-slate-600">
          {b}
        </Badge>
      ))}
      stats={stats}
      tabs={[
        { value: 'info', label: t('基本信息'), content: infoTab },
        ...(isEmployer
          ? [
              {
                value: 'positions',
                label: t('关联岗位'),
                count: positions.length,
                content: (
                  <Card className="border-0 shadow-sm rounded-3xl">
                    <CardContent className="p-6">
                      {positions.length === 0 ? (
                        <EmptyState
                          icon={<Briefcase className="h-10 w-10 opacity-50" />}
                          title={t('暂未关联岗位')}
                          titleClassName="text-slate-500"
                          className="py-16"
                        />
                      ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                          {positions.map((p) => {
                            const jobBrand = jobBrandByPosition.get(p.id)
                            return (
                              <RelatedObjectCard
                                key={p.id}
                                item={{
                                  id: jobBrand?.id || p.id,
                                  name: p.name,
                                }}
                                kind={jobBrand ? 'brands' : 'positions'}
                              >
                                <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 border-t border-slate-50">
                                  <span className="text-sm font-bold text-primary">
                                    {salaryText(p)}
                                  </span>
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium truncate max-w-[45%]">
                                    {p.positionType === 'teaching'
                                      ? t('教学岗位')
                                      : p.positionType === 'enterprise'
                                        ? t('企业岗位')
                                        : '-'}
                                  </span>
                                </div>
                                {(p.majorNames ?? []).length > 0 && (
                                  <div className="flex flex-wrap gap-1 px-3.5 pb-3">
                                    {(p.majorNames ?? []).slice(0, 3).map((m) => (
                                      <span
                                        key={m}
                                        className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100 font-medium"
                                      >
                                        {m}
                                      </span>
                                    ))}
                                    {(p.majorNames ?? []).length > 3 && (
                                      <span className="text-[10px] text-slate-400">
                                        +{(p.majorNames ?? []).length - 3}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </RelatedObjectCard>
                            )
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ),
              },
              {
                value: 'students',
                label: t('已招聘学生'),
                count: hiredStudents.length,
                content: (
                  <Card className="border-0 shadow-sm rounded-3xl">
                    <CardContent className="p-6">
                      {hiredStudents.length === 0 ? (
                        <EmptyState
                          icon={<Users className="h-10 w-10 opacity-50" />}
                          title={t('暂未关联学生')}
                          titleClassName="text-slate-500"
                          className="py-16"
                        />
                      ) : (
                        <div className="space-y-4">
                          {[...studentsByJob.entries()].map(([jobId, students]) => {
                            const job = positions.find((p) => p.id === jobId)
                            return (
                              <div key={jobId}>
                                <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-900 mb-3">
                                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                                  {job?.name || t('未分配岗位')}
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                  {students.map((s) => (
                                    <span
                                      key={s.studentId}
                                      className="inline-flex items-center gap-2 rounded-full border border-slate-100 bg-slate-50 px-3 py-1.5 text-sm"
                                    >
                                      <span className="font-medium">{s.name}</span>
                                      <span className="text-xs text-muted-foreground">
                                        {s.majorName || t('未设置专业')}
                                      </span>
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ),
              },
            ]
          : []),
        ...majorTabs,
      ]}
    />
  )
}
