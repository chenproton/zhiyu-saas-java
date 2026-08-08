'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Building2, Users, School, UserCog, ArrowRight } from 'lucide-react'
import { partnerWorkspaceApi } from '@/lib/api'
import { useAsync, LoadingView, ErrorState } from '@zhiyu/ui'
import { usePartnerAuth } from '@/components/partner-auth-provider'
import { useT } from '@/lib/i18n/locale-provider'

export default function PartnerWorkspacePage() {
  const t = useT()
  const { user, enterprise, isAdmin, loading: authLoading } = usePartnerAuth()
  const { data, loading, error, refresh } = useAsync(
    async () => {
      if (authLoading || !user) return null
      return partnerWorkspaceApi.dashboard()
    },
    { deps: [authLoading, user?.id], onError: () => true },
  )

  if (authLoading || loading) return <LoadingView />
  if (error) return <ErrorState description={error.message} onRetry={refresh} />

  const stats = [
    { label: t('专家资源'), value: data?.expertCount ?? 0, href: '/partner/experts' },
    { label: t('合作学校'), value: data?.schoolCount ?? 0, href: '/partner/schools' },
    { label: t('成员账号'), value: data?.memberCount ?? 0, href: '/partner/members' },
  ]

  const entries = [
    {
      title: t('企业信息'),
      desc: t('维护企业主体信息、形象与对外展示开关'),
      href: '/partner/enterprise',
      icon: Building2,
    },
    {
      title: t('专家资源'),
      desc: t('维护企业专家档案，共享给合作学校'),
      href: '/partner/experts',
      icon: Users,
    },
    {
      title: t('合作学校'),
      desc: t('查看已引入本企业的学校及合作状态'),
      href: '/partner/schools',
      icon: School,
    },
    ...(isAdmin
      ? [
          {
            title: t('成员账号'),
            desc: t('管理企业成员登录账号与角色'),
            href: '/partner/members',
            icon: UserCog,
          },
        ]
      : []),
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">
          {t('你好，{name}', { name: user?.name || user?.username || '' })}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {enterprise?.name
            ? t('欢迎回到 {name} 企业服务台', { name: enterprise.name })
            : t('欢迎回到企业服务台')}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href}>
            <Card className="transition-shadow hover:shadow-md">
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground">{s.label}</div>
                <div className="mt-1 text-2xl font-semibold text-foreground">{s.value}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {entries.map((e) => (
          <Link key={e.href} href={e.href}>
            <Card className="h-full transition-shadow hover:shadow-md">
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/5 text-primary">
                    <e.icon className="h-4 w-4" />
                  </div>
                  <CardTitle className="text-base">{e.title}</CardTitle>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{e.desc}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
