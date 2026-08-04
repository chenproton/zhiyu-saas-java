'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Building, Briefcase, Users, Trophy, Sparkles, ArrowRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { portalRequest } from '@/lib/api'
import { allianceLabel } from '@zhiyu/shared-types'
import type {
  AlliancePublicStats,
  AllianceBrand,
  AllianceEnterprise,
  AllianceProject,
  AllianceExpert,
  AllianceAchievement,
} from '@/lib/types'
import { reportError } from '@/lib/error-handling'
import { LoadingView } from '@zhiyu/ui'

interface LandingData {
  stats: AlliancePublicStats | null
  enterprises: AllianceEnterprise[]
  projects: AllianceProject[]
  experts: AllianceExpert[]
  achievements: AllianceAchievement[]
  featuredBrands: AllianceBrand[]
}

const quickLinks = [
  {
    href: '/portal/alliance/enterprises',
    label: '合作企业',
    desc: '查看全部校企合作企业',
    icon: Building,
    color: 'bg-blue-50 text-blue-600',
  },
  {
    href: '/portal/alliance/projects',
    label: '合作项目',
    desc: '浏览校企合作项目',
    icon: Briefcase,
    color: 'bg-emerald-50 text-emerald-600',
  },
  {
    href: '/portal/alliance/experts',
    label: '企业专家',
    desc: '产业专家资源库',
    icon: Users,
    color: 'bg-amber-50 text-amber-600',
  },
  {
    href: '/portal/alliance/achievements',
    label: '合作成果',
    desc: '最新合作产出成果',
    icon: Trophy,
    color: 'bg-rose-50 text-rose-600',
  },
  {
    href: '/portal/alliance/brands',
    label: '品牌展示',
    desc: '六大品牌模块展示',
    icon: Sparkles,
    color: 'bg-purple-50 text-purple-600',
  },
]

export default function AllianceLandingPage() {
  const [data, setData] = useState<LandingData>({
    stats: null,
    enterprises: [],
    projects: [],
    experts: [],
    achievements: [],
    featuredBrands: [],
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
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
      ).catch(() => ({ items: [] })),
      portalRequest<{ items: AllianceBrand[] }>('/alliance/public/brands?isFeatured=true').catch(
        () => ({ items: [] }),
      ),
    ])
      .then(([stats, enterprises, projects, experts, achievements, brands]) => {
        setData({
          stats,
          enterprises: enterprises.items?.slice(0, 4) || [],
          projects: projects.items?.slice(0, 4) || [],
          experts: experts.items?.slice(0, 4) || [],
          achievements: achievements.items?.slice(0, 4) || [],
          featuredBrands: brands.items?.slice(0, 6) || [],
        })
      })
      .catch((err) => {
        reportError(err, { source: '加载校企合作联盟首页' })
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingView />

  const statsList = data.stats
    ? [
        { label: '合作企业', value: data.stats.enterpriseCount, icon: Building },
        { label: '合作项目', value: data.stats.projectCount, icon: Briefcase },
        { label: '企业专家', value: data.stats.expertCount, icon: Users },
        { label: '合作成果', value: data.stats.achievementCount, icon: Trophy },
        { label: '品牌展示', value: data.stats.brandCount, icon: Sparkles },
      ]
    : []

  return (
    <div className="space-y-10">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white px-8 py-12">
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.2) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
          <div>
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md text-white px-3 py-1 rounded-full text-xs border border-white/20 mb-4">
              <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
              产教融合 · 协同育人 · 互利共赢
            </div>
            <h1 className="text-3xl lg:text-5xl font-bold mb-4">校企合作联盟</h1>
            <p className="text-white/80 max-w-xl text-base lg:text-lg">
              汇聚优质企业、项目、专家与成果，打造校企协同育人共同体。
            </p>
          </div>
          {statsList.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 min-w-[280px]">
              {statsList.map((s) => {
                const Icon = s.icon
                return (
                  <div
                    key={s.label}
                    className="bg-white/10 backdrop-blur-md border border-white/10 rounded-xl p-4 text-center"
                  >
                    <Icon className="w-6 h-6 mx-auto mb-2 text-white/80" />
                    <div className="text-2xl font-bold">{s.value}</div>
                    <div className="text-xs text-white/70">{s.label}</div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>

      {/* Quick links */}
      <section>
        <h2 className="text-xl font-bold mb-4">快速入口</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {quickLinks.map((link) => {
            const Icon = link.icon
            return (
              <Link key={link.href} href={link.href}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                  <CardHeader className="flex flex-row items-center gap-3 pb-2">
                    <div className={`p-2 rounded-lg ${link.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <CardTitle className="text-base">{link.label}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-xs">{link.desc}</CardDescription>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      </section>

      {/* Featured brands */}
      {data.featuredBrands.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">推荐品牌</h2>
            <Link
              href="/portal/alliance/brands"
              className="text-sm text-primary hover:underline inline-flex items-center gap-1"
            >
              查看更多 <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.featuredBrands.map((brand) => (
              <Card key={brand.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg">{brand.name}</CardTitle>
                    <div className="flex items-center gap-1.5">
                      {brand.isFeatured && <Badge variant="secondary">推荐</Badge>}
                      <Badge variant="outline">{allianceLabel('brandType', brand.brandType)}</Badge>
                    </div>
                  </div>
                  {brand.description && (
                    <CardDescription className="line-clamp-2">{brand.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-1">
                  {brand.data?.major && (
                    <p className="text-xs text-muted-foreground">专业: {brand.data.major}</p>
                  )}
                  {brand.data?.abilityScore != null && (
                    <p className="text-xs text-muted-foreground">
                      能力评分: {brand.data.abilityScore}
                    </p>
                  )}
                  {brand.data?.tags && brand.data.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {brand.data.tags.slice(0, 3).map((tag: string, i: number) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Enterprises & Projects */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">合作企业</h2>
            <Link
              href="/portal/alliance/enterprises"
              className="text-sm text-primary hover:underline inline-flex items-center gap-1"
            >
              查看更多 <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {data.enterprises.length === 0 ? (
            <p className="text-muted-foreground">暂无合作企业</p>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {data.enterprises.map((enterprise) => (
                <Link key={enterprise.id} href={`/portal/alliance/enterprises/${enterprise.id}`}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                    <CardHeader>
                      <CardTitle className="text-lg">{enterprise.name}</CardTitle>
                      {enterprise.industry && (
                        <CardDescription>
                          {enterprise.industry}
                          {enterprise.region ? ` · ${enterprise.region}` : ''}
                        </CardDescription>
                      )}
                    </CardHeader>
                    {enterprise.description && (
                      <CardContent>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {enterprise.description}
                        </p>
                      </CardContent>
                    )}
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">合作项目</h2>
            <Link
              href="/portal/alliance/projects"
              className="text-sm text-primary hover:underline inline-flex items-center gap-1"
            >
              查看更多 <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {data.projects.length === 0 ? (
            <p className="text-muted-foreground">暂无合作项目</p>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {data.projects.map((project) => (
                <Link key={project.id} href={`/portal/alliance/projects/${project.id}`}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-lg">{project.name}</CardTitle>
                        <Badge variant="outline">
                          {allianceLabel('projectPhase', project.phase)}
                        </Badge>
                      </div>
                      {project.startDate && (
                        <CardDescription>开始: {project.startDate}</CardDescription>
                      )}
                    </CardHeader>
                    {project.description && (
                      <CardContent>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {project.description}
                        </p>
                      </CardContent>
                    )}
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Experts & Achievements */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">企业专家</h2>
            <Link
              href="/portal/alliance/experts"
              className="text-sm text-primary hover:underline inline-flex items-center gap-1"
            >
              查看更多 <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {data.experts.length === 0 ? (
            <p className="text-muted-foreground">暂无专家</p>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {data.experts.map((expert) => (
                <Link key={expert.id} href={`/portal/alliance/experts/${expert.id}`}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-lg">{expert.name}</CardTitle>
                        <Badge variant="outline">
                          {expert.rating
                            ? allianceLabel('expertRating', expert.rating)
                            : allianceLabel('expertStatus', expert.status)}
                        </Badge>
                      </div>
                      <CardDescription>
                        {[expert.title, expert.position, expert.industry]
                          .filter(Boolean)
                          .join(' · ') || '专家'}
                      </CardDescription>
                    </CardHeader>
                    {expert.introduction && (
                      <CardContent>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {expert.introduction}
                        </p>
                      </CardContent>
                    )}
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">最新成果</h2>
            <Link
              href="/portal/alliance/achievements"
              className="text-sm text-primary hover:underline inline-flex items-center gap-1"
            >
              查看更多 <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {data.achievements.length === 0 ? (
            <p className="text-muted-foreground">暂无成果</p>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {data.achievements.map((achievement) => (
                <Link key={achievement.id} href={`/portal/alliance/achievements/${achievement.id}`}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-lg">{achievement.title}</CardTitle>
                        <Badge variant="outline">
                          {allianceLabel('achievementType', achievement.type)}
                        </Badge>
                      </div>
                      {achievement.achievementDate && (
                        <CardDescription>{achievement.achievementDate}</CardDescription>
                      )}
                    </CardHeader>
                    {achievement.description && (
                      <CardContent>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {achievement.description}
                        </p>
                      </CardContent>
                    )}
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
