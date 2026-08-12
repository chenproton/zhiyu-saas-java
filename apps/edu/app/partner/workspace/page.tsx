'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ChartContainer, ChartConfig } from '@/components/ui/chart'
import {
  Building2,
  Users,
  School,
  ArrowRight,
  ClipboardList,
  FileText,
  Handshake,
  UserCog,
  Globe,
  TrendingUp,
} from 'lucide-react'
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import { partnerWorkspaceApi, partnerSchoolApi, partnerMentorTaskApi } from '@/lib/api'
import { useAsync, LoadingView, ErrorState } from '@zhiyu/ui'
import { usePartnerAuth } from '@/components/partner-auth-provider'
import { useT } from '@/lib/i18n/locale-provider'
import { getEnterpriseMissingFields } from '@/lib/partner-enterprise-completeness'

const colorMap = {
  blue: 'bg-blue-50 text-blue-600',
  green: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-600',
  purple: 'bg-purple-50 text-purple-600',
  cyan: 'bg-cyan-50 text-cyan-600',
  rose: 'bg-rose-50 text-rose-600',
  indigo: 'bg-indigo-50 text-indigo-600',
} as const

type StatColor = keyof typeof colorMap

function StatCard({
  title,
  value,
  icon: Icon,
  color = 'blue',
  trend,
  href,
}: {
  title: string
  value: string | number
  icon: React.ElementType
  color?: StatColor
  trend?: string
  href: string
}) {
  return (
    <Link href={href}>
      <Card className="bg-white border border-gray-100 shadow-sm hover:shadow-md transition-shadow rounded-xl">
        <CardContent className="p-5">
          <div className="flex items-center gap-4">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${colorMap[color]}`}
            >
              <Icon className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-gray-500 font-medium truncate">{title}</p>
              <p className="text-2xl font-bold text-gray-900 mt-0.5">{value}</p>
              {trend && <p className="text-xs mt-1 font-medium text-gray-400">{trend}</p>}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

function SectionCard({
  title,
  icon: Icon,
  iconColor = 'blue',
  children,
  action,
}: {
  title?: string
  icon?: React.ElementType
  iconColor?: StatColor
  children: React.ReactNode
  action?: { label: string; href: string }
}) {
  return (
    <Card className="bg-white border border-gray-100 shadow-sm rounded-xl overflow-hidden">
      {title && (
        <CardHeader className="pb-2 pt-3 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold text-gray-900 flex items-center gap-2.5">
              {Icon && (
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center ${colorMap[iconColor]}`}
                >
                  <Icon className="w-4 h-4" />
                </div>
              )}
              {title}
            </CardTitle>
            {action && (
              <Link
                href={action.href}
                className="text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 h-auto py-1.5 px-2 rounded-md font-medium"
              >
                {action.label}
              </Link>
            )}
          </div>
        </CardHeader>
      )}
      <CardContent className={title ? 'px-4 pb-4 pt-0' : 'px-4 pb-4 pt-3'}>{children}</CardContent>
    </Card>
  )
}

const SCHOOL_STATUS_COLORS: Record<string, string> = {
  negotiating: '#f59e0b',
  active: '#10b981',
  paused: '#f97316',
  terminated: '#94a3b8',
}

const SCHOOL_STATUS_LABEL: Record<string, string> = {
  negotiating: '洽谈中',
  active: '合作中',
  paused: '已暂停',
  terminated: '已终止',
}

export default function PartnerWorkspacePage() {
  const t = useT()
  const { user, enterprise, loading: authLoading } = usePartnerAuth()
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

  const dash = data?.dashboard
  const stats = [
    {
      title: t('专家资源'),
      value: dash?.expertCount ?? 0,
      trend: t('公开 {count} 位', { count: dash?.publicExpertCount ?? 0 }),
      href: '/partner/experts',
      icon: Users,
      color: 'blue' as const,
    },
    {
      title: t('合作学校'),
      value: dash?.schoolCount ?? 0,
      trend: t('近 6 个月新增 {count} 所', {
        count: (dash?.monthlySchoolCounts ?? []).reduce((s, m) => s + m.count, 0),
      }),
      href: '/partner/schools',
      icon: School,
      color: 'green' as const,
    },
    {
      title: t('专家账号'),
      value: dash?.memberCount ?? 0,
      href: '/partner/experts',
      icon: UserCog,
      color: 'purple' as const,
    },
    {
      title: t('对外展示专家'),
      value: dash?.publicExpertCount ?? 0,
      href: '/partner/experts',
      icon: Globe,
      color: 'cyan' as const,
    },
  ]

  // 待办：待确认合作学校（negotiating）
  const negotiatingCount = (data?.schools ?? []).filter((s) => s.status === 'negotiating').length
  // 待办：未完成测评任务（未分配评分对象或评分未齐）
  const unfinishedTaskCount = (data?.tasks ?? []).filter(
    (task) =>
      (task.assignedCount ?? 0) === 0 || (task.gradedCount ?? 0) < (task.assignedCount ?? 0),
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
      color: 'amber' as const,
    },
    {
      title: t('测评任务'),
      count: unfinishedTaskCount,
      hint: t('有 {count} 项测评任务待评分', { count: unfinishedTaskCount }),
      okHint: t('测评任务均已完成'),
      href: '/partner/tasks',
      icon: ClipboardList,
      active: unfinishedTaskCount > 0,
      color: 'rose' as const,
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
      color: 'blue' as const,
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
  ]

  // 图表数据：合作学校状态分布（缺项补 0，保证环形图完整）
  const statusCounts = (dash?.schoolStatusCounts ?? []).map((c) => ({
    ...c,
    name: t(SCHOOL_STATUS_LABEL[c.status] || c.status),
    color: SCHOOL_STATUS_COLORS[c.status] || '#94a3b8',
  }))
  const statusTotal = statusCounts.reduce((s, c) => s + c.count, 0)
  const chartConfig: ChartConfig = {
    count: { label: t('学校数') },
  }

  // 图表数据：近 6 个月新增合作学校（补齐空月份）
  const monthData = (() => {
    const map = new Map((dash?.monthlySchoolCounts ?? []).map((m) => [m.month, m.count]))
    const out: { month: string; count: number }[] = []
    const now = new Date()
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      out.push({ month: key, count: map.get(key) ?? 0 })
    }
    return out
  })()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
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
        {enterprise?.name && (
          <div className="hidden sm:flex items-center gap-3 rounded-xl bg-white border border-gray-100 shadow-sm px-4 py-2.5">
            {enterprise.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={enterprise.logoUrl}
                alt={enterprise.name}
                className="w-8 h-8 rounded-lg object-cover border border-gray-100"
              />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Building2 className="w-4 h-4 text-primary" />
              </div>
            )}
            <span className="text-sm font-medium text-gray-700">{enterprise.name}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((s) => (
          <StatCard key={s.title} {...s} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard
          title={t('合作学校状态分布')}
          icon={School}
          iconColor="green"
          action={{ label: t('查看全部'), href: '/partner/schools' }}
        >
          {statusTotal > 0 ? (
            <div className="flex items-center gap-6 py-2">
              <div className="w-36 h-36 relative shrink-0">
                <ChartContainer config={chartConfig} className="w-full h-full">
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={statusCounts}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={62}
                        dataKey="count"
                        strokeWidth={0}
                      >
                        {statusCounts.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(v: number, _name: string, item: any) => [
                          t('{count} 所', { count: v }),
                          item.payload?.name,
                        ]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartContainer>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">{statusTotal}</div>
                    <div className="text-xs text-gray-500">{t('合作学校')}</div>
                  </div>
                </div>
              </div>
              <div className="flex-1 space-y-2.5 min-w-0">
                {statusCounts.map((item) => (
                  <div key={item.status} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-gray-600 text-xs truncate">{item.name}</span>
                    </div>
                    <Badge variant="secondary" className="text-xs h-5 shrink-0">
                      {item.count}
                    </Badge>
                  </div>
                ))}
                {statusCounts.length === 0 && (
                  <p className="text-sm text-gray-400 py-6 text-center">{t('暂无数据')}</p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400 py-10 text-center">{t('暂无合作学校，快去引入企业吧')}</p>
          )}
        </SectionCard>

        <SectionCard
          title={t('近 6 个月新增合作学校')}
          icon={TrendingUp}
          iconColor="indigo"
          action={{ label: t('查看全部'), href: '/partner/schools' }}
        >
          <div className="h-48 py-2">
            <ChartContainer config={chartConfig} className="w-full h-full">
              <ResponsiveContainer>
                <BarChart data={monthData} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="month"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                  />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <Tooltip
                    formatter={(v: number) => [t('{count} 所', { count: v }), t('新增')]}
                    cursor={{ fill: 'rgba(99, 102, 241, 0.06)' }}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]} fill="#6366f1" maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </div>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {todos.map((todo) => (
          <Link key={todo.href} href={todo.href}>
            <Card
              className={`h-full bg-white border border-gray-100 shadow-sm hover:shadow-md transition-shadow rounded-xl ${
                todo.active ? 'border-amber-200' : ''
              }`}
            >
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center ${colorMap[todo.color]}`}
                    >
                      <todo.icon className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-medium text-gray-700">{todo.title}</span>
                  </div>
                  {todo.active ? (
                    <Badge className="bg-rose-500 text-white border-0">{todo.count}</Badge>
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <svg
                        className="w-4 h-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                  )}
                </div>
                <p
                  className={`mt-3 text-sm leading-relaxed ${
                    todo.active ? 'font-medium text-amber-700' : 'text-gray-500'
                  }`}
                >
                  {todo.active ? todo.hint : todo.okHint}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {entries.map((e) => (
          <Link key={e.href} href={e.href}>
            <Card className="h-full bg-white border border-gray-100 shadow-sm hover:shadow-md transition-shadow rounded-xl">
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-2 pt-4 px-5">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-primary/5 text-primary flex items-center justify-center">
                    <e.icon className="w-4 h-4" />
                  </div>
                  <CardTitle className="text-base text-gray-900">{e.title}</CardTitle>
                </div>
                <ArrowRight className="h-4 w-4 text-gray-400" />
              </CardHeader>
              <CardContent className="px-5 pb-5">
                <p className="text-sm text-gray-500">{e.desc}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
