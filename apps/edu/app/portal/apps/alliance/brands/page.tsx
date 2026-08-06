'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { GraduationCap, Building, Briefcase, BookOpen, Users, Palette } from 'lucide-react'
import { usePortalAuth } from '@/contexts/portal-auth-context'
import { allianceBrandApi } from '@/lib/api'
import { reportError } from '@/lib/error-handling'
import { useT } from '@/lib/i18n/locale-provider'

export default function AllianceBrandsPage() {
  const { tenantId } = usePortalAuth()
  const t = useT()
  const [counts, setCounts] = useState<Record<string, number>>({})

  const brandCards = [
    {
      type: 'talent',
      label: t('人才品牌'),
      desc: t('展示学生能力画像与典型就业案例'),
      icon: GraduationCap,
      color: 'text-blue-600 bg-blue-50',
    },
    {
      type: 'employer',
      label: t('雇主品牌'),
      desc: t('展示合作企业/机构的品牌形象'),
      icon: Building,
      color: 'text-green-600 bg-green-50',
    },
    {
      type: 'job',
      label: t('岗位品牌'),
      desc: t('展示优质岗位的品牌级运营'),
      icon: Briefcase,
      color: 'text-orange-600 bg-orange-50',
    },
    {
      type: 'major',
      label: t('专业品牌'),
      desc: t('展示专业建设水平与培养特色'),
      icon: BookOpen,
      color: 'text-purple-600 bg-purple-50',
    },
    {
      type: 'teacher',
      label: t('师资品牌'),
      desc: t('展示校本师资与产业导师'),
      icon: Users,
      color: 'text-red-600 bg-red-50',
    },
    {
      type: 'culture',
      label: t('文化思政品牌'),
      desc: t('展示典型案例、思政资源与文化活动'),
      icon: Palette,
      color: 'text-cyan-600 bg-cyan-50',
    },
  ]

  useEffect(() => {
    if (!tenantId) return
    const loadCounts = async () => {
      try {
        const data = await allianceBrandApi.list()
        const c: Record<string, number> = {}
        for (const b of data.items || []) {
          c[b.brandType] = (c[b.brandType] || 0) + 1
        }
        setCounts(c)
      } catch (err) {
        reportError(err, '加载品牌计数')
      }
    }
    loadCounts()
  }, [tenantId])

  const pageMap: Record<string, string> = {
    talent: '/portal/apps/alliance/brands/talent',
    employer: '/portal/apps/alliance/brands/employer',
    job: '/portal/apps/alliance/brands/job',
    major: '/portal/apps/alliance/brands/major',
    teacher: '/portal/apps/alliance/brands/teacher',
    culture: '/portal/apps/alliance/brands/culture',
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">{t('品牌运营管理')}</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {t('管理六大品牌模块内容，配置前台展示')}
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {brandCards.map((card) => {
          const Icon = card.icon
          const count = counts[card.type] || 0
          return (
            <Link key={card.type} href={pageMap[card.type]}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardHeader className="flex flex-row items-center gap-3 pb-2">
                  <div className={`p-2 rounded-lg ${card.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-base">{card.label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-xs">{card.desc}</CardDescription>
                  <p className="text-sm font-semibold mt-2">{t('{count} 条内容', { count })}</p>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
