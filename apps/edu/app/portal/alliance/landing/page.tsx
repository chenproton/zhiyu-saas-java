'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Building2,
  FolderKanban,
  Users,
  Trophy,
  Briefcase,
  GraduationCap,
  UserCircle,
  Heart,
  Sparkles,
  ArrowUpRight,
  MapPin,
  Globe,
  School,
  Medal,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { portalRequest } from '@/lib/api'
import type {
  AlliancePublicStats,
  AlliancePublicBrand,
  AllianceEnterprise,
  AllianceProject,
  AllianceExpert,
  AllianceAchievement,
  TalentRankMajorGroup,
} from '@/lib/types'
import type { Tenant as BackendTenant } from '@/lib/types/backend'
import { reportError } from '@/lib/error-handling'
import { LoadingView } from '@zhiyu/ui'
import { usePortalAuth } from '@/contexts/portal-auth-context'
import { LandingShell, LandingEmpty } from '@/components/shared/landing-shell'
import {
  GradientPlaceholder,
  EnterpriseCard,
  ProjectCard,
  AchievementCard,
  ExpertCard,
  TalentBrandCard,
  EmployerBrandRow,
  JobBrandRow,
  MajorBrandCard,
  TeacherBrandCard,
  CultureBrandCard,
} from '@/components/alliance/public-cards'
import { useT } from '@/lib/i18n/locale-provider'

interface LandingData {
  schoolInfo: HeroSchool | null
  stats: AlliancePublicStats | null
  enterprises: AllianceEnterprise[]
  projects: AllianceProject[]
  experts: AllianceExpert[]
  achievements: AllianceAchievement[]
  brands: AlliancePublicBrand[]
  talentRanking: TalentRankMajorGroup[]
}

const BRAND_CATEGORIES = [
  { id: 'talent', title: '人才品牌', icon: Users, href: '/portal/alliance/brands?type=talent' },
  {
    id: 'employer',
    title: '雇主品牌',
    icon: Building2,
    href: '/portal/alliance/brands?type=employer',
  },
  { id: 'job', title: '岗位品牌', icon: Briefcase, href: '/portal/alliance/brands?type=job' },
  {
    id: 'major',
    title: '专业品牌',
    icon: GraduationCap,
    href: '/portal/alliance/brands?type=major',
  },
  {
    id: 'teacher',
    title: '师资品牌',
    icon: UserCircle,
    href: '/portal/alliance/brands?type=teacher',
  },
  { id: 'culture', title: '文化品牌', icon: Heart, href: '/portal/alliance/brands?type=culture' },
]

const STAT_GRADIENTS = [
  'from-primary to-primary/80',
  'from-primary/90 to-primary/70',
  'from-primary/80 to-primary/60',
  'from-primary/90 to-primary/70',
]

/** hero 学校卡数据：取 /portal/apps/alliance/school（tenants）全部展示信息 */
interface HeroSchool {
  name: string
  shortName?: string
  logoUrl?: string
  website?: string
  address?: string
  province?: string
  city?: string
  educationLevel?: string
  educationNature?: string
  description?: string
  scaleData: Record<string, any>
  secondaryColleges: Array<{ name: string; description?: string }>
}

/** 租户（学校信息页数据源）→ hero 学校卡数据 */
function mapTenantToSchoolInfo(t: BackendTenant): HeroSchool {
  return {
    name: t.name,
    shortName: t.shortName,
    logoUrl: t.logoUrl,
    website: t.website,
    address: t.address,
    province: t.province,
    city: t.city,
    educationLevel: t.educationLevel,
    educationNature: t.educationNature,
    description: t.description,
    scaleData: (t.scaleData || {}) as Record<string, any>,
    secondaryColleges: (t.secondaryColleges || []) as Array<{ name: string; description?: string }>,
  }
}

function SectionHeading({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string
  title: string
  subtitle: string
}) {
  return (
    <div className="text-center mb-8 sm:mb-14">
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/5 border border-primary/10 text-primary text-xs font-medium mb-4 tracking-wide">
        <Sparkles className="w-3.5 h-3.5" />
        {eyebrow}
      </div>
      <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold text-slate-900 mb-3 tracking-tight">
        {title}
      </h2>
      <p className="text-slate-500 text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
        {subtitle}
      </p>
    </div>
  )
}

function SectionSubHeading({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
      <div className="flex items-center gap-3">
        <div className="h-6 w-1.5 rounded-full bg-gradient-to-b from-primary/80 to-primary/60" />
        <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
      </div>
      {action}
    </div>
  )
}

function ViewAllLink({ href }: { href: string }) {
  const t = useT()
  return (
    <Link
      href={href}
      className="group inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
    >
      {t('查看全部')}
      <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
    </Link>
  )
}

function HeroSchoolCard({ schoolInfo }: { schoolInfo: HeroSchool | null }) {
  const t = useT()
  if (!schoolInfo) {
    return (
      <Card className="border border-white/10 shadow-2xl shadow-black/20 rounded-2xl overflow-hidden bg-white/10 backdrop-blur-xl">
        <CardContent className="p-7">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-xl border border-white/20 shadow-md bg-gradient-to-br from-primary to-primary/70" />
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-lg text-white">{t('校企合作联盟')}</h3>
              <p className="text-sm text-slate-300 mt-1">{t('产教融合 · 协同育人 · 互利共赢')}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-4 mt-7 py-6 border-y border-white/10">
            <div className="text-center min-w-0">
              <p className="text-xl sm:text-3xl font-bold text-white/90 truncate">—</p>
              <p className="text-[11px] sm:text-xs text-slate-400 mt-1">{t('在校生')}</p>
            </div>
            <div className="text-center min-w-0">
              <p className="text-xl sm:text-3xl font-bold text-white/90 truncate">—</p>
              <p className="text-[11px] sm:text-xs text-slate-400 mt-1">{t('教师')}</p>
            </div>
            <div className="text-center min-w-0">
              <p className="text-xl sm:text-3xl font-bold text-slate-300 truncate">—</p>
              <p className="text-[11px] sm:text-xs text-slate-400 mt-1">{t('专业')}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const scale = schoolInfo.scaleData || {}
  const collegeCount = schoolInfo.secondaryColleges?.length ?? 0
  const hasScaleData =
    scale.studentCount != null ||
    scale.teacherCount != null ||
    scale.majorCount != null ||
    collegeCount > 0

  // 徽章：办学层次 / 办学性质 / 省市
  const badges = [
    schoolInfo.educationLevel,
    schoolInfo.educationNature,
    [schoolInfo.province, schoolInfo.city].filter(Boolean).join(' '),
  ].filter(Boolean) as string[]

  return (
    <Card className="relative rounded-2xl border border-white/15 bg-white/10 backdrop-blur-xl shadow-2xl shadow-black/20 overflow-hidden">
      <CardContent className="px-6 pt-3 pb-6">
        <div className="flex items-center gap-3.5">
          {schoolInfo.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={schoolInfo.logoUrl}
              alt={schoolInfo.name}
              className="w-12 h-12 rounded-xl object-cover border border-white/25 shadow-lg bg-white shrink-0"
            />
          ) : (
            <GradientPlaceholder
              seed={schoolInfo.name}
              label={schoolInfo.name}
              className="w-12 h-12 rounded-xl border border-white/25 shadow-lg shrink-0 text-lg"
            />
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-base text-white leading-snug truncate">
              {schoolInfo.name}
            </h3>
            <p className="text-xs text-white/60 mt-0.5 truncate">
              {schoolInfo.shortName || t('校企合作联盟')}
            </p>
          </div>
        </div>

        {badges.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-4">
            {badges.map((b) => (
              <span
                key={b}
                className="text-[11px] font-medium text-white/90 bg-white/15 border border-white/20 rounded-full px-2.5 py-1"
              >
                {b}
              </span>
            ))}
          </div>
        )}

        <div className="space-y-2 mt-4">
          {schoolInfo.website && (
            <a
              href={schoolInfo.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-white/80 hover:text-white flex items-center gap-2 transition-colors"
            >
              <Globe className="h-3.5 w-3.5 shrink-0 text-white/50" />
              <span className="truncate">{schoolInfo.website.replace(/^https?:\/\//, '')}</span>
              <ArrowUpRight className="h-3 w-3 shrink-0" />
            </a>
          )}
          {schoolInfo.address && (
            <p className="text-sm text-white/80 flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-white/50" />
              <span className="truncate">{schoolInfo.address}</span>
            </p>
          )}
          {collegeCount > 0 && (
            <p className="text-sm text-white/80 flex items-center gap-2">
              <School className="h-3.5 w-3.5 shrink-0 text-white/50" />
              <span>{t('{count} 个二级学院', { count: collegeCount })}</span>
            </p>
          )}
        </div>

        {hasScaleData && (
          <div className="grid grid-cols-3 gap-2 mt-5 py-4 border-y border-white/10">
            <div className="text-center min-w-0">
              <p className="text-lg sm:text-xl font-bold text-white/90 truncate">
                {scale.studentCount?.toLocaleString?.() ?? '—'}
              </p>
              <p className="text-[11px] text-white/50 mt-0.5">{t('在校生')}</p>
            </div>
            <div className="text-center min-w-0">
              <p className="text-lg sm:text-xl font-bold text-white/90 truncate">
                {scale.teacherCount ?? '—'}
              </p>
              <p className="text-[11px] text-white/50 mt-0.5">{t('教师')}</p>
            </div>
            <div className="text-center min-w-0">
              <p className="text-lg sm:text-xl font-bold text-white/90 truncate">
                {scale.majorCount ?? collegeCount}
              </p>
              <p className="text-[11px] text-white/50 mt-0.5">
                {scale.majorCount ? t('专业') : t('二级学院')}
              </p>
            </div>
          </div>
        )}

        {schoolInfo.description && (
          <p className="text-[13px] text-white/70 mt-4 leading-relaxed line-clamp-3">
            {schoolInfo.description}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

export default function AllianceLandingPage() {
  const { tenantId } = usePortalAuth()
  const [data, setData] = useState<LandingData>({
    schoolInfo: null,
    stats: null,
    enterprises: [],
    projects: [],
    experts: [],
    achievements: [],
    brands: [],
    talentRanking: [],
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // auth 就绪前不发起访客请求：portal 页面均需登录，未就绪时发起会拉取
    // 全量公开数据并在登录视角渲染跨租户图片（图片 403/排行接口 400）
    if (!tenantId) return
    // 前台展示与后台管理页同租户数据一致：全部带 tenantId 按本校链接过滤（其他租户/已解除合作的企业不展示）
    const q = `?tenantId=${tenantId}`
    const requests: [
      Promise<AlliancePublicStats | null>,
      Promise<{ items: AllianceEnterprise[] } | null>,
      Promise<{ items: AllianceProject[] } | null>,
      Promise<{ items: AllianceExpert[] } | null>,
      Promise<{ items: AllianceAchievement[] } | null>,
      Promise<{ items: AlliancePublicBrand[] } | null>,
      Promise<{ items: TalentRankMajorGroup[] } | null>,
    ] = [
      portalRequest<AlliancePublicStats>(`/alliance/public/stats${q}`).catch(() => null),
      portalRequest<{ items: AllianceEnterprise[] }>(`/alliance/public/enterprises${q}`).catch(
        () => ({ items: [] }),
      ),
      portalRequest<{ items: AllianceProject[] }>(`/alliance/public/projects${q}`).catch(() => ({
        items: [],
      })),
      portalRequest<{ items: AllianceExpert[] }>(`/alliance/public/experts${q}`).catch(() => ({
        items: [],
      })),
      portalRequest<{ items: AllianceAchievement[] }>(
        `/alliance/public/achievements?sort=latest${tenantId ? `&tenantId=${tenantId}` : ''}`,
      ).catch(() => ({
        items: [],
      })),
      portalRequest<{ items: AlliancePublicBrand[] }>('/alliance/public/brands').catch(() => ({
        items: [],
      })),
      portalRequest<{ items: TalentRankMajorGroup[] }>(
        `/alliance/public/brands/talent-ranking${tenantId ? `?tenantId=${tenantId}` : ''}`,
      ).catch(() => ({
        items: [],
      })),
    ]

    const schoolInfoRequest = tenantId
      ? portalRequest<BackendTenant>(`/tenants/${tenantId}`)
          .then(mapTenantToSchoolInfo)
          .catch(() => null)
      : Promise.resolve(null)

    Promise.all([schoolInfoRequest, ...requests])
      .then(
        ([
          schoolInfo,
          stats,
          enterprises,
          projects,
          experts,
          achievements,
          brands,
          talentRanking,
        ]) => {
          setData({
            schoolInfo,
            stats,
            enterprises: enterprises?.items?.slice(0, 6) ?? [],
            projects: projects?.items?.slice(0, 8) ?? [],
            experts: experts?.items?.slice(0, 6) ?? [],
            achievements: achievements?.items?.slice(0, 8) ?? [],
            brands: brands?.items ?? [],
            talentRanking: talentRanking?.items ?? [],
          })
        },
      )
      .catch((err) => {
        reportError(err, { source: '加载校企合作联盟首页' })
      })
      .finally(() => setLoading(false))
  }, [tenantId])

  const t = useT()
  const statsList = useMemo(() => {
    if (!data.stats) return []
    return [
      { label: t('合作企业'), value: data.stats.enterpriseCount, icon: Building2 },
      { label: t('合作项目'), value: data.stats.projectCount, icon: FolderKanban },
      { label: t('企业专家'), value: data.stats.expertCount, icon: Users },
      { label: t('合作成果'), value: data.stats.achievementCount, icon: Trophy },
    ]
  }, [data.stats, t])

  /** 各类型品牌独立限量展示（不做全局截断，保证六类同时铺开时都有露出） */
  const featuredBrandsByType = useMemo(() => {
    const featured = data.brands.filter((b) => b.isFeatured || b.isPublic)
    const limit: Record<string, number> = {
      talent: 5,
      employer: 3,
      job: 4,
      major: 3,
      teacher: 6,
      culture: 3,
    }
    const byType: Record<string, AlliancePublicBrand[]> = {}
    BRAND_CATEGORIES.forEach((cat) => {
      byType[cat.id] = featured.filter((b) => b.brandType === cat.id).slice(0, limit[cat.id] ?? 3)
    })
    return byType
  }, [data.brands])

  const brandCountByType = useMemo(() => {
    const counts: Record<string, number> = {}
    data.brands.forEach((b) => {
      counts[b.brandType] = (counts[b.brandType] ?? 0) + 1
    })
    return counts
  }, [data.brands])

  /** 六类品牌分区（有内容才渲染），每类一种卡片样式；区间内由渐变分隔线衔接 */
  const brandSections = useMemo(() => {
    const talentBrands = featuredBrandsByType['talent'] ?? []
    const employerBrands = featuredBrandsByType['employer'] ?? []
    const jobBrands = featuredBrandsByType['job'] ?? []
    const majorBrands = featuredBrandsByType['major'] ?? []
    const teacherBrands = featuredBrandsByType['teacher'] ?? []
    const cultureBrands = featuredBrandsByType['culture'] ?? []

    const sections: React.ReactNode[] = []

    // 人才品牌：横版旗舰卡 + 人才画像排行榜
    if (talentBrands.length > 0 || data.talentRanking.length > 0) {
      sections.push(
        <div key="talent">
          <SectionSubHeading
            title={t('人才品牌')}
            action={<ViewAllLink href="/portal/alliance/brands?type=talent" />}
          />
          {data.talentRanking.length > 0 && (
            <div className={talentBrands.length > 0 ? 'mb-8' : ''}>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                {data.talentRanking.map((g) => (
                  <div
                    key={g.majorId}
                    className="rounded-2xl border border-[#e7e5e4] bg-white shadow-sm overflow-hidden"
                  >
                    <div className="flex items-center gap-2.5 border-b border-slate-100 bg-gradient-to-r from-primary/5 to-transparent px-5 py-3.5">
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shrink-0 shadow-sm">
                        <Medal className="h-4 w-4 text-white" />
                      </div>
                      <span className="text-sm font-semibold text-slate-800 truncate">
                        {g.majorName}
                      </span>
                      <span className="ml-auto shrink-0 text-[11px] font-medium tracking-wide text-slate-400">
                        TOP {Math.min(g.students.length, 5)}
                      </span>
                    </div>
                    <div className="divide-y divide-slate-50">
                      {g.students.slice(0, 5).map((s, idx) => (
                        <div
                          key={s.studentId}
                          className={`flex items-center gap-3 px-5 py-3 ${idx === 0 ? 'bg-amber-50/50' : ''}`}
                        >
                          <span
                            className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                              idx === 0
                                ? 'bg-gradient-to-br from-amber-400 to-amber-500 text-white shadow-sm'
                                : idx === 1
                                  ? 'bg-gradient-to-br from-slate-300 to-slate-400 text-white'
                                  : idx === 2
                                    ? 'bg-gradient-to-br from-orange-300 to-orange-400 text-white'
                                    : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {idx + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-slate-800">{s.name}</p>
                            <p className="truncate text-[11px] text-slate-400 mt-0.5">
                              {s.className || '-'}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-sm font-bold text-primary">
                              {s.avgAbilityCognitionScore == null
                                ? '-'
                                : `${s.avgAbilityCognitionScore.toFixed(1)}`}
                            </p>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              {t('能力认证得分')}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {talentBrands.length > 0 && (
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="h-4 w-1 rounded-full bg-gradient-to-b from-primary/80 to-primary/60" />
                <h4 className="text-sm font-semibold text-slate-700">{t('就业案例')}</h4>
                <span className="text-xs text-slate-400">
                  {t('左右滑动查看更多')}
                </span>
              </div>
              <div className="flex gap-5 overflow-x-auto pb-3 snap-x snap-mandatory scroll-smooth [-ms-overflow-style:none] [scrollbar-width:thin]">
                {talentBrands.map((brand) => (
                  <div
                    key={brand.id}
                    className="min-w-[300px] sm:min-w-[380px] lg:min-w-[440px] max-w-[440px] snap-start"
                  >
                    <TalentBrandCard brand={brand} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>,
      )
    }

    // 雇主品牌（企业目录行）+ 岗位品牌（单行记录）：双栏并置，行置于容器卡内以分隔线隔开
    if (employerBrands.length > 0 || jobBrands.length > 0) {
      sections.push(
        <div
          key="employer-job"
          className={`grid gap-10 ${employerBrands.length > 0 && jobBrands.length > 0 ? 'lg:grid-cols-2' : ''}`}
        >
          {employerBrands.length > 0 && (
            <div>
              <SectionSubHeading
                title={t('雇主品牌')}
                action={<ViewAllLink href="/portal/alliance/brands?type=employer" />}
              />
              <div className="rounded-2xl border border-[#e7e5e4] bg-white shadow-sm overflow-hidden divide-y divide-slate-100">
                {employerBrands.map((brand) => (
                  <EmployerBrandRow key={brand.id} brand={brand} />
                ))}
              </div>
            </div>
          )}
          {jobBrands.length > 0 && (
            <div>
              <SectionSubHeading
                title={t('岗位品牌')}
                action={<ViewAllLink href="/portal/alliance/brands?type=job" />}
              />
              <div className="rounded-2xl border border-[#e7e5e4] bg-white shadow-sm overflow-hidden divide-y divide-slate-100">
                {jobBrands.map((brand) => (
                  <JobBrandRow key={brand.id} brand={brand} />
                ))}
              </div>
            </div>
          )}
        </div>,
      )
    }

    // 专业品牌：封面覆盖卡
    if (majorBrands.length > 0) {
      sections.push(
        <div key="major">
          <SectionSubHeading
            title={t('专业品牌')}
            action={<ViewAllLink href="/portal/alliance/brands?type=major" />}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {majorBrands.map((brand) => (
              <MajorBrandCard key={brand.id} brand={brand} />
            ))}
          </div>
        </div>,
      )
    }

    // 师资品牌：与「专家资源」同款紧凑卡片（多列小卡，可展示更多人员）
    if (teacherBrands.length > 0) {
      sections.push(
        <div key="teacher">
          <SectionSubHeading
            title={t('师资品牌')}
            action={<ViewAllLink href="/portal/alliance/brands?type=teacher" />}
          />
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
            {teacherBrands.map((brand) => (
              <TeacherBrandCard key={brand.id} brand={brand} />
            ))}
          </div>
        </div>,
      )
    }

    // 文化品牌：杂志卡
    if (cultureBrands.length > 0) {
      sections.push(
        <div key="culture">
          <SectionSubHeading
            title={t('文化品牌')}
            action={<ViewAllLink href="/portal/alliance/brands?type=culture" />}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {cultureBrands.map((brand) => (
              <CultureBrandCard key={brand.id} brand={brand} />
            ))}
          </div>
        </div>,
      )
    }

    return sections
  }, [featuredBrandsByType, data.talentRanking, t])

  if (loading) return <LoadingView />

  return (
    <LandingShell
      hero={{
        badge: t('产教融合 · 协同育人 · 互利共赢'),
        title: (
          <>
            {t('搭建产教融合桥梁')}
            <br />
            <span className="text-white/80">{t('共育产业英才')}</span>
          </>
        ),
        description: t(
          '坚持以产业需求为牵引，面向职业岗位能力要求，依托真实实践场景，推动企业用人标准、教学培养目标与人才测评体系协同贯通。',
        ),
        ctaLabel: t('探索合作企业'),
        right: <HeroSchoolCard schoolInfo={data.schoolInfo} />,
      }}
      stats={statsList.map((stat, idx) => ({
        icon: stat.icon,
        value: `${stat.value}+`,
        label: stat.label,
        gradient: STAT_GRADIENTS[idx % STAT_GRADIENTS.length],
      }))}
    >
      {/* 产教融合成果库 */}
      <section className="relative py-10">
        <SectionHeading
          eyebrow={t('精选 · FEATURED')}
          title={t('产教融合成果库')}
          subtitle={t(
            '多元主体协同，以产业需求为牵引，以学生能力为中心，以场景实践为载体，以跨专业融合为特征',
          )}
        />

        {/* 合作企业 */}
        <div className="mb-20">
          <SectionSubHeading
            title={t('合作企业')}
            action={<ViewAllLink href="/portal/alliance/enterprises" />}
          />
          {data.enterprises.length === 0 ? (
            <LandingEmpty title={t('暂无合作企业')} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {data.enterprises.map((enterprise) => (
                <EnterpriseCard key={enterprise.id} enterprise={enterprise} />
              ))}
            </div>
          )}
        </div>

        {/* 合作项目 */}
        <div className="mb-20">
          <SectionSubHeading
            title={t('合作项目')}
            action={<ViewAllLink href="/portal/alliance/projects" />}
          />
          {data.projects.length === 0 ? (
            <LandingEmpty title={t('暂无合作项目')} />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {data.projects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          )}
        </div>

        {/* 合作成果 */}
        <div className="mb-20">
          <SectionSubHeading
            title={t('合作成果')}
            action={<ViewAllLink href="/portal/alliance/achievements" />}
          />
          {data.achievements.length === 0 ? (
            <LandingEmpty title={t('暂无合作成果')} />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {data.achievements.map((achievement) => (
                <AchievementCard key={achievement.id} achievement={achievement} />
              ))}
            </div>
          )}
        </div>

        {/* 专家资源 */}
        <div>
          <SectionSubHeading
            title={t('专家资源')}
            action={<ViewAllLink href="/portal/alliance/experts" />}
          />
          {data.experts.length === 0 ? (
            <LandingEmpty title={t('暂无专家资源')} />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
              {data.experts.map((expert) => (
                <ExpertCard key={expert.id} expert={expert} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 产教品牌库 */}
      <section className="relative py-14">
        <SectionHeading
          eyebrow={t('品牌 · BRANDS')}
          title={t('产教品牌库')}
          subtitle={t('人才培养、校企合作、专业建设等各领域品牌成果')}
        />

        {/* 六大分类 */}
        <div className="flex flex-wrap justify-center gap-3 md:gap-4 mb-16">
          {BRAND_CATEGORIES.map((cat) => {
            const Icon = cat.icon
            const count = brandCountByType[cat.id] ?? 0
            return (
              <Link key={cat.id} href={cat.href}>
                <div className="group flex items-center gap-3 px-5 py-3 rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-lg hover:shadow-primary/10 hover:border-primary/30 hover:bg-primary/5 transition-all duration-300 hover:-translate-y-0.5">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center group-hover:from-primary/15 group-hover:to-primary/10 transition-colors">
                    <Icon className="h-[18px] w-[18px] text-primary" />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-medium text-slate-700 group-hover:text-primary transition-colors leading-tight">
                      {t(cat.title)}
                    </span>
                    <span className="text-xs text-slate-400 group-hover:text-primary/60 transition-colors mt-0.5">
                      {t('{count} 个品牌', { count })}
                    </span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>

        {/* 六类品牌同时铺开：每类一种展示样式，体现系统多样性 */}
        {brandSections.map((node, i) => (
          <Fragment key={i}>
            {i > 0 && (
              <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent my-12 sm:my-16" />
            )}
            {node}
          </Fragment>
        ))}
      </section>

      {/* CTA */}
      <section className="relative py-16 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-primary/5 to-primary/10" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-primary/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 left-1/4 w-[400px] h-[200px] bg-primary/10 rounded-full blur-[100px]" />

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-primary/10 text-primary text-xs font-medium mb-5 shadow-sm">
            <Sparkles className="w-3.5 h-3.5" />
            {t('共建生态')}
          </div>
          <h2 className="text-3xl md:text-4xl font-semibold text-slate-900 mb-4 tracking-tight">
            {t('加入产教融合生态')}
          </h2>
          <p className="text-slate-500 text-base md:text-lg mb-10 max-w-2xl mx-auto leading-relaxed">
            {t(
              '无论您是企业、学校还是行业专家，都可以在这里找到合作机会，共同推动人才培养与产业升级。',
            )}
          </p>
          <Button
            asChild
            className="rounded-full px-8 py-5 text-sm font-semibold bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white shadow-lg shadow-primary/20 transition-all hover:shadow-xl hover:shadow-primary/15 hover:-translate-y-0.5 w-full sm:w-auto"
          >
            <Link href="/portal/alliance/brands">{t('探索更多品牌')}</Link>
          </Button>
        </div>
      </section>
    </LandingShell>
  )
}
