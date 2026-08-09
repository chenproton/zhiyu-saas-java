'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Building2, Users, School, UserCog, ArrowRight, ClipboardList, FileText, Handshake } from 'lucide-react'
import { partnerWorkspaceApi, partnerSchoolApi, partnerMentorTaskApi } from '@/lib/api'
import { useAsync, LoadingView, ErrorState } from '@zhiyu/ui'
import { usePartnerAuth } from '@/components/partner-auth-provider'
import { useT } from '@/lib/i18n/locale-provider'
import { getEnterpriseMissingFields } from '@/lib/partner-enterprise-completeness'

export default function PartnerWorkspacePage() {
  const t = useT()
  const { user, enterprise, isAdmin, loading: authLoading } = usePartnerAuth()
  const { data, loading, error, refresh } = useAsync(
    async () => {
      if (authLoading || !user) return null
      const [dashboard, schools, tasks] = await Promise.all([
        partnerWorkspaceApi.dashboard(),
        partnerSchoolApi.list({ limit: 200 }),
        partnerMentorTaskApi.list(),
      ])
      return { dashboard, schools: schools.items || [], tasks: tasks.items || [] }
    },
    { deps: [authLoading, user?.id], onError: () => true },
  )

  if (authLoading || loading) return <LoadingView />
  if (error) return <ErrorState description={error.message} onRetry={refresh} />

  const stats = [
    { label: t('专家资源'), value: data?.dashboard.expertCount ?? 0, href: '/partner/experts' },
    { label: t('合作学校'), value: data?.dashboard.schoolCount ?? 0, href: '/partner/schools' },
    { label: t('成员账号'), value: data?.dashboard.memberCount ?? 0, href: '/partner/members' },
  ]

  // 待办：待确认合作学校（negotiating）
  const negotiatingCount = (data?.schools ?? []).filter((s) => s.status === 'negotiating').length
  // 待办：未完成测评任务（未分配评分对象或评分未齐）
  const unfinishedTaskCount = (data?.tasks ?? []).filter(
    (task) => (task.assignedCount ?? 0) === 0 || (task.gradedCount ?? 0) < (task.assignedCount ?? 0),
  ).length
  // 待办：企业资料缺失项
  const missingFields = getEnterpriseMissingFields(enterprise ?? {})

  const todos = [
    {
      title: t('待确认合作'),
      count: negotiatingCount,
      hint: t('有 {count} 所学校等待确认合作', { count: negotiatingCount }),
      okHint: t('暂无待确认的合作学校'),
      href: '/partner/schools',
      icon: Handshake,
      active: negotiatingCount > 0,
    },
    {
      title: t('测评任务'),
      count: unfinishedTaskCount,
      hint: t('有 {count} 项测评任务待评分', { count: unfinishedTaskCount }),
      okHint: t('测评任务均已完成'),
      href: '/partner/tasks',
      icon: ClipboardList,
      active: unfinishedTaskCount > 0,
    },
    {
      title: t('资料完整度'),
      count: missingFields.length,
      hint: t('企业资料缺 {count} 项：{fields}', {
        count: missingFields.length,
        fields: missingFields.map((f) => t(f)).join('、'),
      }),
      okHint: t('企业资料已完善'),
      href: '/partner/enterprise',
      icon: FileText,
      active: missingFields.length > 0,
    },
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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {todos.map((todo) => (
          <Link key={todo.href} href={todo.href}>
            <Card
              className={`h-full transition-shadow hover:shadow-md ${
                todo.active ? 'border-amber-200 bg-amber-50/50' : ''
              }`}
            >
              <CardContent className="pt-6">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                      todo.active ? 'bg-amber-100 text-amber-600' : 'bg-primary/5 text-primary'
                    }`}
                  >
                    <todo.icon className="h-4 w-4" />
                  </div>
                  <div className="text-sm text-muted-foreground">{todo.title}</div>
                </div>
                <div
                  className={`mt-2 text-sm ${todo.active ? 'font-medium text-amber-700' : 'text-muted-foreground'}`}
                >
                  {todo.active ? todo.hint : todo.okHint}
                </div>
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
