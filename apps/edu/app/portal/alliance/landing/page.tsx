'use client'

import { useEffect, useMemo, useState } from 'react'
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
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { portalRequest } from '@/lib/api'
import type {
  AllianceSchoolInfo,
  AlliancePublicStats,
  AllianceBrand,
  AllianceEnterprise,
  AllianceProject,
  AllianceExpert,
  AllianceAchievement,
} from '@/lib/types'
import { reportError } from '@/lib/error-handling'
import { LoadingView } from '@zhiyu/ui'
import { usePortalAuth } from '@/contexts/portal-auth-context'
import { LandingShell, LandingEmpty } from '@/components/shared/landing-shell'
import { MobileTabDropdown } from '@/components/shared/mobile-tab-dropdown'
import {
  GradientPlaceholder,
  EnterpriseCard,
  ProjectCard,
  AchievementCard,
  ExpertCard,
  BrandCard,
} from '@/components/alliance/public-cards'
import { useT } from '@/lib/i18n/locale-provider'

interface LandingData {
  schoolInfo: AllianceSchoolInfo | null
  stats: AlliancePublicStats | null
  enterprises: AllianceEnterprise[]
  projects: AllianceProject[]
  experts: AllianceExpert[]
  achievements: AllianceAchievement[]
  brands: AllianceBrand[]
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

function SectionHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="text-center mb-8 sm:mb-14">
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/5 border border-primary/10 text-primary text-xs font-medium mb-4">
        <Sparkles className="w-3.5 h-3.5" />
        {title}
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

function HeroSchoolCard({ schoolInfo }: { schoolInfo: AllianceSchoolInfo | null }) {
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

  return (
    <Card className="border border-white/10 shadow-2xl shadow-black/20 rounded-2xl overflow-hidden bg-white/10 backdrop-blur-xl">
      <CardContent className="p-7">
        <div className="flex items-start gap-4">
          {schoolInfo.logoUrl ? (
            <img
              src={schoolInfo.logoUrl}
              alt={schoolInfo.name}
              className="w-16 h-16 rounded-xl object-cover border border-white/20 shadow-md bg-white"
            />
          ) : (
            <GradientPlaceholder
              seed={schoolInfo.name}
              className="w-16 h-16 rounded-xl border border-white/20 shadow-md"
            />
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg text-white">{schoolInfo.name}</h3>
            {schoolInfo.website && (
              <a
                href={schoolInfo.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-white/70 hover:text-white mt-1 inline-flex items-center gap-1"
              >
                {t('前往官网')} <ArrowUpRight className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-4 mt-7 py-6 border-y border-white/10">
            <div className="text-center min-w-0">
              <p className="text-xl sm:text-3xl font-bold text-white/90 truncate">
                {scale.studentCount?.toLocaleString?.() ?? '—'}
              </p>
              <p className="text-[11px] sm:text-xs text-slate-400 mt-1">{t('在校生')}</p>
            </div>
            <div className="text-center min-w-0">
              <p className="text-xl sm:text-3xl font-bold text-white/90 truncate">
                {scale.teacherCount ?? '—'}
              </p>
              <p className="text-[11px] sm:text-xs text-slate-400 mt-1">{t('教师')}</p>
            </div>
            <div className="text-center min-w-0">
              <p className="text-xl sm:text-3xl font-bold text-slate-300 truncate">
                {scale.majorCount ?? collegeCount}
              </p>
              <p className="text-[11px] sm:text-xs text-slate-400 mt-1">
                {scale.majorCount ? t('专业') : t('二级学院')}
              </p>
            </div>
          </div>
        {schoolInfo.description && (
          <p className="text-sm text-slate-300 mt-5 leading-relaxed line-clamp-3">
            {schoolInfo.description}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

export default function AllianceLandingPage() {
  const { tenantId } = usePortalAuth()
  const [brandTab, setBrandTab] = useState(BRAND_CATEGORIES[0].id)
  const [data, setData] = useState<LandingData>({
    schoolInfo: null,
    stats: null,
    enterprises: [],
    projects: [],
    experts: [],
    achievements: [],
    brands: [],
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const requests: [
      Promise<AlliancePublicStats | null>,
      Promise<{ items: AllianceEnterprise[] } | null>,
      Promise<{ items: AllianceProject[] } | null>,
      Promise<{ items: AllianceExpert[] } | null>,
      Promise<{ items: AllianceAchievement[] } | null>,
      Promise<{ items: AllianceBrand[] } | null>,
    ] = [
      portalRequest<AlliancePublicStats>('/alliance/public/stats').catch(() => null),
      portalRequest<{ items: AllianceEnterprise[] }>('/alliance/public/enterprises').catch(() => ({
        items: [],
      })),
      portalRequest<{ items: AllianceProject[] }>('/alliance/public/projects').catch(() => ({
        items: [],
      })),
      portalRequest<{ items: AllianceExpert[] }>('/alliance/public/experts').catch(() => ({
        items: [],
      })),
      portalRequest<{ items: AllianceAchievement[] }>(
        '/alliance/public/achievements?sort=latest',
      ).catch(() => ({
        items: [],
      })),
      portalRequest<{ items: AllianceBrand[] }>('/alliance/public/brands').catch(() => ({
        items: [],
      })),
    ]

    const schoolInfoRequest = tenantId
      ? portalRequest<AllianceSchoolInfo>(
          `/alliance/public/school-info?tenantId=${tenantId}`,
        ).catch(() => null)
      : Promise.resolve(null)

    Promise.all([schoolInfoRequest, ...requests])
      .then(([schoolInfo, stats, enterprises, projects, experts, achievements, brands]) => {
        setData({
          schoolInfo,
          stats,
          enterprises: enterprises?.items?.slice(0, 6) ?? [],
          projects: projects?.items?.slice(0, 8) ?? [],
          experts: experts?.items?.slice(0, 6) ?? [],
          achievements: achievements?.items?.slice(0, 8) ?? [],
          brands: brands?.items ?? [],
        })
      })
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

  const featuredBrandsByType = useMemo(() => {
    const featured = data.brands.filter((b) => b.isFeatured || b.isPublic).slice(0, 12)
    const byType: Record<string, AllianceBrand[]> = {}
    BRAND_CATEGORIES.forEach((cat) => {
      byType[cat.id] = featured.filter((b) => b.brandType === cat.id).slice(0, 4)
    })
    return byType
  }, [data.brands])

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
          title={t('产教融合成果库')}
          subtitle={t(
            '多元主体协同，以产业需求为牵引，以学生能力为中心，以场景实践为载体，以跨专业融合为特征',
          )}
        />

        <SectionSubHeading
          title={t('合作企业')}
          action={<ViewAllLink href="/portal/alliance/enterprises" />}
        />
        {data.enterprises.length === 0 ? (
          <div className="mb-20">
            <LandingEmpty title={t('暂无合作企业')} />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-20">
            {data.enterprises.map((enterprise) => (
              <EnterpriseCard key={enterprise.id} enterprise={enterprise} />
            ))}
          </div>
        )}

        <SectionSubHeading
          title={t('合作项目')}
          action={<ViewAllLink href="/portal/alliance/projects" />}
        />
        {data.projects.length === 0 ? (
          <div className="mb-20">
            <LandingEmpty title={t('暂无合作项目')} />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-20">
            {data.projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}

        <SectionSubHeading
          title={t('合作成果')}
          action={<ViewAllLink href="/portal/alliance/achievements" />}
        />
        {data.achievements.length === 0 ? (
          <div className="mb-20">
            <LandingEmpty title={t('暂无合作成果')} />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-20">
            {data.achievements.map((achievement) => (
              <AchievementCard key={achievement.id} achievement={achievement} />
            ))}
          </div>
        )}

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
      </section>

      {/* 产教品牌库 */}
      <section className="relative py-14">
        <SectionHeading
          title={t('产教品牌库')}
          subtitle={t('人才培养、校企合作、专业建设等各领域品牌成果')}
        />

        {/* 六大分类 */}
        <div className="flex flex-wrap justify-center gap-3 md:gap-4 mb-16">
          {BRAND_CATEGORIES.map((cat) => {
            const Icon = cat.icon
            return (
              <Link key={cat.id} href={cat.href}>
                <div className="group flex items-center gap-3 px-5 py-3 rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-lg hover:shadow-primary/10 hover:border-primary/30 hover:bg-primary/5 transition-all duration-300 hover:-translate-y-0.5">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center group-hover:from-primary/15 group-hover:to-primary/10 transition-colors">
                    <Icon className="h-[18px] w-[18px] text-primary" />
                  </div>
                  <span className="font-medium text-slate-700 group-hover:text-primary transition-colors">
                    {t(cat.title)}
                  </span>
                </div>
              </Link>
            )
          })}
        </div>

        {/* Featured brands grouped by type */}
        {data.brands.length > 0 && (
          <Tabs value={brandTab} onValueChange={setBrandTab} className="w-full">
            <div className="flex flex-wrap items-center justify-between mb-6 gap-3">
              <div className="flex items-center gap-3">
                <div className="h-6 w-1 rounded-full bg-gradient-to-b from-primary/80 to-primary/60" />
                <h3 className="text-lg font-semibold text-slate-800">{t('推荐品牌')}</h3>
              </div>
              <MobileTabDropdown
                items={BRAND_CATEGORIES.map((cat) => ({ value: cat.id, label: cat.title }))}
                value={brandTab}
                onValueChange={setBrandTab}
                className="md:hidden w-full"
              />
              <TabsList className="hidden md:inline-flex rounded-xl">
                {BRAND_CATEGORIES.map((cat) => (
                  <TabsTrigger key={cat.id} value={cat.id} className="rounded-lg text-xs">
                    {t(cat.title)}
                  </TabsTrigger>
                ))}
              </TabsList>
              <ViewAllLink href="/portal/alliance/brands" />
            </div>
            {BRAND_CATEGORIES.map((cat) => {
              const items = featuredBrandsByType[cat.id] ?? []
              return (
                <TabsContent key={cat.id} value={cat.id}>
                  {items.length === 0 ? (
                    <LandingEmpty title={`暂无${t(cat.title)}`} />
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                      {items.map((brand) => (
                        <BrandCard key={brand.id} brand={brand} />
                      ))}
                    </div>
                  )}
                </TabsContent>
              )
            })}
          </Tabs>
        )}
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
