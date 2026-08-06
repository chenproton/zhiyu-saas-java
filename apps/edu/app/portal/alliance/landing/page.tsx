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
  Calendar,
  Sparkles,
  ArrowUpRight,
  Eye,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { portalRequest } from '@/lib/api'
import { allianceLabel } from '@zhiyu/shared-types'
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
  { id: 'talent', title: '人才品牌', icon: Users, href: '/portal/alliance/brands/talent' },
  { id: 'employer', title: '雇主品牌', icon: Building2, href: '/portal/alliance/brands/employer' },
  { id: 'job', title: '岗位品牌', icon: Briefcase, href: '/portal/alliance/brands/job' },
  { id: 'major', title: '专业品牌', icon: GraduationCap, href: '/portal/alliance/brands/major' },
  { id: 'teacher', title: '师资品牌', icon: UserCircle, href: '/portal/alliance/brands/teacher' },
  { id: 'culture', title: '文化品牌', icon: Heart, href: '/portal/alliance/brands/culture' },
]

const STAT_GRADIENTS = [
  'from-primary to-primary/80',
  'from-primary/90 to-primary/70',
  'from-primary/80 to-primary/60',
  'from-primary/90 to-primary/70',
]

function GradientPlaceholder({ className, seed }: { className?: string; seed?: string }) {
  const gradients = [
    'from-primary to-primary/80',
    'from-primary/80 to-primary/60',
    'from-slate-500 to-slate-700',
    'from-primary/90 to-primary/70',
    'from-primary to-primary/70',
    'from-primary/80 to-primary/70',
  ]
  const grad = gradients[(seed?.length ?? 0) % gradients.length]
  return <div className={`bg-gradient-to-br ${grad} ${className ?? ''}`} />
}

function getInitials(name?: string | null) {
  if (!name) return '-'
  return name.slice(0, 2)
}

function getProjectProgress(project: AllianceProject) {
  if (!project.phase) return 0
  const phaseMap: Record<string, number> = {
    initiation: 20,
    execution: 55,
    acceptance: 85,
    closure: 100,
    archived: 100,
    terminated: 0,
  }
  return phaseMap[project.phase] ?? 0
}

function SectionHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="text-center mb-14">
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/5 border border-primary/10 text-primary text-xs font-medium mb-4">
        <Sparkles className="w-3.5 h-3.5" />
        {title}
      </div>
      <h2 className="text-3xl md:text-4xl font-semibold text-slate-900 mb-3 tracking-tight">
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
  return (
    <Link
      href={href}
      className="group inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
    >
      查看全部
      <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
    </Link>
  )
}

function EnterpriseCard({ enterprise }: { enterprise: AllianceEnterprise }) {
  const img = enterprise.coverImage
  return (
    <Link href={`/portal/alliance/enterprises/${enterprise.id}`}>
      <Card className="group border border-[#e7e5e4] shadow-sm transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_20px_48px_rgba(0,0,0,0.1)] hover:border-primary/30 rounded-2xl overflow-hidden bg-white h-full flex flex-col p-0 gap-0">
        <div className="relative h-44 overflow-hidden bg-slate-800">
          {img ? (
            <img
              src={img}
              alt={enterprise.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <GradientPlaceholder
              seed={enterprise.industry}
              className="w-full h-full group-hover:scale-105 transition-transform duration-500"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          <div className="absolute bottom-4 left-4 right-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12 rounded-xl border-2 border-white/80 shadow-md bg-white shrink-0">
                {enterprise.logoUrl && (
                  <AvatarImage src={enterprise.logoUrl} className="object-cover" />
                )}
                <AvatarFallback className="rounded-xl bg-white text-slate-800 font-bold text-sm">
                  {getInitials(enterprise.name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <h4 className="font-semibold text-white text-base leading-tight drop-shadow-md truncate">
                  {enterprise.name}
                </h4>
                <p className="text-white/85 text-xs truncate">
                  {[enterprise.industry, enterprise.region].filter(Boolean).join(' · ') ||
                    '合作企业'}
                </p>
              </div>
            </div>
          </div>
        </div>
        <CardContent className="p-5 flex-1 flex flex-col">
          <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed mb-4 min-h-[2.6em]">
            {enterprise.description || '暂无企业简介'}
          </p>
          {enterprise.rating ? (
            <Badge
              variant="outline"
              className="self-start text-xs px-3 py-1 rounded-full border-slate-200 text-slate-600"
            >
              {allianceLabel('enterpriseRating', enterprise.rating)}
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="self-start text-xs px-3 py-1 rounded-full border-slate-200 text-slate-600"
            >
              {allianceLabel('enterpriseStatus', enterprise.status)}
            </Badge>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}

function ProjectCard({ project }: { project: AllianceProject }) {
  const progress = getProjectProgress(project)
  return (
    <Link href={`/portal/alliance/projects/${project.id}`}>
      <Card className="group border border-[#e7e5e4] shadow-sm transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_20px_48px_rgba(0,0,0,0.1)] hover:border-primary/30 rounded-2xl overflow-hidden bg-white h-full flex flex-col p-0 gap-0">
        <div className="relative h-36 overflow-hidden">
          {project.coverImage ? (
            <img
              src={project.coverImage}
              alt={project.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <GradientPlaceholder
              seed={project.name}
              className="w-full h-full group-hover:scale-105 transition-transform duration-500"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
            <Badge className="bg-white/92 text-slate-800 border-0 shadow-sm text-[11px] font-medium backdrop-blur-sm">
              {allianceLabel('projectPhase', project.phase)}
            </Badge>
            <Badge className="bg-white/92 text-slate-800 border-0 shadow-sm text-[11px] font-medium backdrop-blur-sm">
              {allianceLabel('publishStatus', project.publishStatus)}
            </Badge>
          </div>
        </div>
        <CardContent className="p-4 flex-1 flex flex-col">
          <h4 className="font-semibold text-slate-900 text-sm mb-1.5 group-hover:text-primary transition-colors line-clamp-1">
            {project.name}
          </h4>
          <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed mb-3 min-h-[2.6em]">
            {project.description || '暂无项目描述'}
          </p>
          <div className="mt-auto space-y-2.5">
            {project.startDate && (
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Calendar className="h-3.5 w-3.5" />
                <span className="truncate">
                  {project.startDate}
                  {project.endDate ? ` 至 ${project.endDate}` : ''}
                </span>
              </div>
            )}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] text-slate-600">
                <span>项目进度</span>
                <span className="font-medium">{progress}%</span>
              </div>
              <Progress value={progress} className="h-1.5" />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

function AchievementCard({ achievement }: { achievement: AllianceAchievement }) {
  return (
    <Link href={`/portal/alliance/achievements/${achievement.id}`}>
      <Card className="group border border-[#e7e5e4] shadow-sm transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_20px_48px_rgba(0,0,0,0.1)] hover:border-primary/30 rounded-2xl overflow-hidden bg-white h-full flex flex-col p-0 gap-0">
        <div className="relative h-36 overflow-hidden">
          {achievement.coverImage ? (
            <img
              src={achievement.coverImage}
              alt={achievement.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <GradientPlaceholder
              seed={achievement.title}
              className="w-full h-full group-hover:scale-105 transition-transform duration-500"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-tr from-slate-900/50 via-transparent to-transparent" />
          <div className="absolute top-3 left-3">
            <Badge className="bg-white/92 text-slate-800 border-0 shadow-sm text-[11px] font-medium backdrop-blur-sm">
              {allianceLabel('achievementType', achievement.type)}
            </Badge>
          </div>
        </div>
        <CardContent className="p-4 flex-1 flex flex-col">
          <h4 className="font-semibold text-slate-900 text-sm mb-1.5 group-hover:text-primary transition-colors line-clamp-1">
            {achievement.title}
          </h4>
          <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed mb-3 min-h-[2.6em]">
            {achievement.description || '暂无成果描述'}
          </p>
          <div className="mt-auto flex items-center justify-between text-xs text-slate-500 pt-2.5 border-t border-slate-100">
            <span className="flex items-center gap-1">
              <Eye className="h-3.5 w-3.5" />
              {achievement.viewCount ?? 0}
            </span>
            <span>{achievement.achievementDate ?? ''}</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

function ExpertCard({ expert }: { expert: AllianceExpert }) {
  return (
    <Link href={`/portal/alliance/experts/${expert.id}`}>
      <Card className="group border border-[#e7e5e4] shadow-sm transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_20px_48px_rgba(0,0,0,0.1)] hover:border-primary/30 rounded-2xl overflow-hidden bg-white text-center h-full flex flex-col p-0 gap-0">
        <div className="h-16 relative">
          <GradientPlaceholder seed={expert.industry} className="absolute inset-0 w-full h-full" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          <div className="absolute -bottom-7 left-1/2 -translate-x-1/2">
            <Avatar className="h-14 w-14 ring-[3px] ring-white shadow-md">
              {expert.avatarUrl && <AvatarImage src={expert.avatarUrl} />}
              <AvatarFallback className="text-base font-semibold bg-slate-100 text-slate-800">
                {getInitials(expert.name)}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>
        <CardContent className="pt-9 pb-4 px-3.5 flex-1 flex flex-col text-left">
          <h4 className="font-semibold text-slate-900 text-center text-sm truncate">
            {expert.name}
          </h4>
          <p className="text-xs text-slate-500 text-center truncate mt-0.5">
            {[expert.title, expert.position].filter(Boolean).join(' · ') || '企业专家'}
          </p>
          <div className="mt-3 space-y-1.5 text-xs text-slate-600">
            <div className="flex justify-between gap-2">
              <span className="text-slate-400 shrink-0">企业</span>
              <span className="text-right truncate">
                {expert.organization || expert.enterpriseId || '—'}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-400 shrink-0">行业</span>
              <span className="text-right truncate">{expert.industry || '—'}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-400 shrink-0">经验</span>
              <span className="text-right">
                {expert.experienceYears ? `${expert.experienceYears} 年` : '—'}
              </span>
            </div>
          </div>
          {expert.specialties && expert.specialties.length > 0 && (
            <div className="mt-3">
              <div className="flex flex-wrap gap-1 justify-center">
                {expert.specialties.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}

function BrandCard({ brand }: { brand: AllianceBrand }) {
  return (
    <Link href={`/portal/alliance/brands/${brand.id}`}>
      <Card className="group border border-[#e7e5e4] shadow-sm transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_20px_48px_rgba(0,0,0,0.1)] hover:border-primary/30 rounded-2xl overflow-hidden bg-white h-full flex flex-col p-0 gap-0">
        <div className="relative h-36 overflow-hidden">
          {brand.coverImage ? (
            <img
              src={brand.coverImage}
              alt={brand.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <GradientPlaceholder seed={brand.name} className="w-full h-full" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          <div className="absolute top-3 left-3">
            <Badge className="bg-white/92 text-slate-800 border-0 shadow-sm text-[11px] font-medium backdrop-blur-sm">
              {allianceLabel('brandType', brand.brandType)}
            </Badge>
          </div>
        </div>
        <CardContent className="p-4 flex-1 flex flex-col">
          <h4 className="font-semibold text-slate-900 text-sm mb-1 group-hover:text-primary transition-colors line-clamp-1">
            {brand.name}
          </h4>
          <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed mb-2.5 min-h-[2.6em]">
            {brand.description || '暂无品牌描述'}
          </p>
          {brand.data?.tags && Array.isArray(brand.data.tags) && brand.data.tags.length > 0 && (
            <div className="mt-auto flex flex-wrap gap-1">
              {(brand.data.tags as string[]).slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}

function HeroSchoolCard({ schoolInfo }: { schoolInfo: AllianceSchoolInfo | null }) {
  if (!schoolInfo) {
    return (
      <Card className="border border-white/10 shadow-2xl shadow-black/20 rounded-2xl overflow-hidden bg-white/10 backdrop-blur-xl">
        <CardContent className="p-7">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-xl border border-white/20 shadow-md bg-gradient-to-br from-primary to-primary/70" />
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-lg text-white">校企合作联盟</h3>
              <p className="text-sm text-slate-300 mt-1">产教融合 · 协同育人 · 互利共赢</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 mt-7 py-6 border-y border-white/10">
            <div className="text-center">
              <p className="text-3xl font-bold text-white/90">—</p>
              <p className="text-xs text-slate-400 mt-1">在校生</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-white/90">—</p>
              <p className="text-xs text-slate-400 mt-1">教师</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-slate-300">—</p>
              <p className="text-xs text-slate-400 mt-1">专业</p>
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
                前往官网 <ArrowUpRight className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 mt-7 py-6 border-y border-white/10">
          <div className="text-center">
            <p className="text-3xl font-bold text-white/90">
              {scale.studentCount?.toLocaleString?.() ?? '—'}
            </p>
            <p className="text-xs text-slate-400 mt-1">在校生</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-white/90">{scale.teacherCount ?? '—'}</p>
            <p className="text-xs text-slate-400 mt-1">教师</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-slate-300">{scale.majorCount ?? collegeCount}</p>
            <p className="text-xs text-slate-400 mt-1">{scale.majorCount ? '专业' : '二级学院'}</p>
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

  const statsList = useMemo(() => {
    if (!data.stats) return []
    return [
      { label: '合作企业', value: data.stats.enterpriseCount, icon: Building2 },
      { label: '合作项目', value: data.stats.projectCount, icon: FolderKanban },
      { label: '企业专家', value: data.stats.expertCount, icon: Users },
      { label: '合作成果', value: data.stats.achievementCount, icon: Trophy },
    ]
  }, [data.stats])

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
        badge: '产教融合 · 协同育人 · 互利共赢',
        title: (
          <>
            搭建产教融合桥梁
            <br />
            <span className="text-white/80">共育产业英才</span>
          </>
        ),
        description:
          '坚持以产业需求为牵引，面向职业岗位能力要求，依托真实实践场景，推动企业用人标准、教学培养目标与人才测评体系协同贯通。',
        ctaLabel: '探索合作企业',
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
          title="产教融合成果库"
          subtitle="多元主体协同，以产业需求为牵引，以学生能力为中心，以场景实践为载体，以跨专业融合为特征"
        />

        <SectionSubHeading
          title="合作企业"
          action={<ViewAllLink href="/portal/alliance/enterprises" />}
        />
        {data.enterprises.length === 0 ? (
          <div className="mb-20">
            <LandingEmpty title="暂无合作企业" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-20">
            {data.enterprises.map((enterprise) => (
              <EnterpriseCard key={enterprise.id} enterprise={enterprise} />
            ))}
          </div>
        )}

        <SectionSubHeading
          title="合作项目"
          action={<ViewAllLink href="/portal/alliance/projects" />}
        />
        {data.projects.length === 0 ? (
          <div className="mb-20">
            <LandingEmpty title="暂无合作项目" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-20">
            {data.projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}

        <SectionSubHeading
          title="合作成果"
          action={<ViewAllLink href="/portal/alliance/achievements" />}
        />
        {data.achievements.length === 0 ? (
          <div className="mb-20">
            <LandingEmpty title="暂无合作成果" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-20">
            {data.achievements.map((achievement) => (
              <AchievementCard key={achievement.id} achievement={achievement} />
            ))}
          </div>
        )}

        <SectionSubHeading title="专家资源" action={<ViewAllLink href="/portal/alliance/experts" />} />
        {data.experts.length === 0 ? (
          <LandingEmpty title="暂无专家资源" />
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
            {data.experts.map((expert) => (
              <ExpertCard key={expert.id} expert={expert} />
            ))}
          </div>
        )}
      </section>

      {/* 产教品牌库 */}
      <section className="relative py-14">
        <SectionHeading
          title="产教品牌库"
          subtitle="人才培养、校企合作、专业建设等各领域品牌成果"
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
                    {cat.title}
                  </span>
                </div>
              </Link>
            )
          })}
        </div>

        {/* Featured brands grouped by type */}
        {data.brands.length > 0 && (
          <Tabs defaultValue={BRAND_CATEGORIES[0].id} className="w-full">
            <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="h-6 w-1 rounded-full bg-gradient-to-b from-primary/80 to-primary/60" />
                <h3 className="text-lg font-semibold text-slate-800">推荐品牌</h3>
              </div>
              <TabsList className="rounded-xl">
                {BRAND_CATEGORIES.map((cat) => (
                  <TabsTrigger key={cat.id} value={cat.id} className="rounded-lg text-xs">
                    {cat.title}
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
                    <LandingEmpty title={`暂无${cat.title}`} />
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
            共建生态
          </div>
          <h2 className="text-3xl md:text-4xl font-semibold text-slate-900 mb-4 tracking-tight">
            加入产教融合生态
          </h2>
          <p className="text-slate-500 text-base md:text-lg mb-10 max-w-2xl mx-auto leading-relaxed">
            无论您是企业、学校还是行业专家，都可以在这里找到合作机会，共同推动人才培养与产业升级。
          </p>
          <Button
            asChild
            className="rounded-full px-8 py-5 text-sm font-semibold bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white shadow-lg shadow-primary/20 transition-all hover:shadow-xl hover:shadow-primary/15 hover:-translate-y-0.5"
          >
            <Link href="/portal/alliance/brands">探索更多品牌</Link>
          </Button>
        </div>
      </section>
    </LandingShell>
  )
}
