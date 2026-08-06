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
  AllianceAchievement,
} from '@/lib/types'
import { reportError } from '@/lib/error-handling'
import { LoadingView } from '@zhiyu/ui'

import { useT } from '@/lib/i18n/locale-provider'
interface HomeData {
  stats: AlliancePublicStats | null
  featuredBrands: AllianceBrand[]
  featuredEnterprises: AllianceEnterprise[]
  latestAchievements: AllianceAchievement[]
}

export default function AlliancePublicHomePage() {
  const t = useT()
  const [data, setData] = useState<HomeData>({
    stats: null,
    featuredBrands: [],
    featuredEnterprises: [],
    latestAchievements: [],
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      portalRequest<AlliancePublicStats>('/alliance/public/stats').catch(() => null),
      portalRequest<{ items: AllianceBrand[] }>('/alliance/public/brands?isFeatured=true').catch(
        () => ({ items: [] }),
      ),
      portalRequest<{ items: AllianceEnterprise[] }>('/alliance/public/enterprises').catch(() => ({
        items: [],
      })),
      portalRequest<{ items: AllianceAchievement[] }>(
        '/alliance/public/achievements?sort=latest',
      ).catch(() => ({ items: [] })),
    ])
      .then(([stats, brands, enterprises, achievements]) => {
        setData({
          stats,
          featuredBrands: brands.items?.slice(0, 6) || [],
          featuredEnterprises: enterprises.items?.slice(0, 4) || [],
          latestAchievements: achievements.items?.slice(0, 4) || [],
        })
      })
      .catch((err) => {
        reportError(err, { source: '加载校企合作首页数据' })
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingView />

  return (
    <div className="space-y-10">
      <section className="text-center space-y-2">
        <h1 className="text-3xl font-bold">{t('校企合作联盟')}</h1>
        <p className="text-muted-foreground text-lg">{t('产教融合 · 协同育人 · 互利共赢')}</p>
      </section>

      {data.stats && (
        <section className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: t('合作企业'), value: data.stats.enterpriseCount, icon: Building },
            { label: t('合作项目'), value: data.stats.projectCount, icon: Briefcase },
            { label: t('企业专家'), value: data.stats.expertCount, icon: Users },
            { label: t('合作成果'), value: data.stats.achievementCount, icon: Trophy },
            { label: t('品牌展示'), value: data.stats.brandCount, icon: Sparkles },
          ].map((item) => {
            const Icon = item.icon
            return (
              <Card key={item.label} className="text-center">
                <CardContent className="pt-6 pb-4">
                  <Icon className="h-8 w-8 mx-auto text-primary mb-2" />
                  <p className="text-2xl font-bold">{item.value}</p>
                  <p className="text-sm text-muted-foreground">{item.label}</p>
                </CardContent>
              </Card>
            )
          })}
        </section>
      )}

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">{t('品牌展示')}</h2>
          <Link
            href="/portal/alliance/brands"
            className="text-sm text-primary hover:underline inline-flex items-center gap-1"
          >
            {t('查看更多')} <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {data.featuredBrands.length === 0 ? (
          <p className="text-muted-foreground">{t('暂无品牌内容')}</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.featuredBrands.map((brand) => (
              <Card key={brand.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg">{brand.name}</CardTitle>
                    <div className="flex items-center gap-1.5">
                      {brand.isFeatured && <Badge variant="secondary">{t('推荐')}</Badge>}
                      <Badge variant="outline">{allianceLabel('brandType', brand.brandType)}</Badge>
                    </div>
                  </div>
                  {brand.description && (
                    <CardDescription className="line-clamp-2">{brand.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-1">
                  {brand.data?.major && (
                    <p className="text-xs text-muted-foreground">
                      {t('专业: {major}', { major: brand.data.major })}
                    </p>
                  )}
                  {brand.data?.abilityScore != null && (
                    <p className="text-xs text-muted-foreground">
                      {t('能力评分: {score}', { score: brand.data.abilityScore })}
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
        )}
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">{t('合作企业')}</h2>
          <Link
            href="/portal/alliance/enterprises"
            className="text-sm text-primary hover:underline inline-flex items-center gap-1"
          >
            {t('查看更多')} <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {data.featuredEnterprises.length === 0 ? (
          <p className="text-muted-foreground">{t('暂无合作企业')}</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.featuredEnterprises.map((enterprise) => (
              <Link key={enterprise.id} href={`/portal/alliance/enterprises/${enterprise.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                  <CardHeader>
                    <CardTitle className="text-lg">{enterprise.name}</CardTitle>
                    {enterprise.industry && (
                      <CardDescription>{enterprise.industry}</CardDescription>
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
          <h2 className="text-xl font-bold">{t('最新成果')}</h2>
          <Link
            href="/portal/alliance/achievements"
            className="text-sm text-primary hover:underline inline-flex items-center gap-1"
          >
            {t('查看更多')} <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {data.latestAchievements.length === 0 ? (
          <p className="text-muted-foreground">{t('暂无成果')}</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.latestAchievements.map((achievement) => (
              <Link key={achievement.id} href={`/portal/alliance/achievements/${achievement.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-lg">{achievement.title}</CardTitle>
                      <Badge variant="outline">
                        {allianceLabel('achievementType', achievement.type)}
                      </Badge>
                    </div>
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
  )
}
