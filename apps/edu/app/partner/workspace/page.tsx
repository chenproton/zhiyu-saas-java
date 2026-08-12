'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChartContainer, ChartConfig } from '@/components/ui/chart'
import {
  Building2,
  Users,
  School,
  ClipboardList,
  FileText,
  Handshake,
  TrendingUp,
  Briefcase,
  Layers,
} from 'lucide-react'
import {
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  Legend,
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
              {trend && <p className="text-xs mt-1 font-medium text-gray-400 truncate">{trend}</p>}
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

/** 空态缺省图：共建资源为空时的柔和插画 */
function CoBuildEmptyState() {
  const t = useT()
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="relative w-28 h-28 mb-4">
        <div className="absolute inset-0 rounded-full border-2 border-dashed border-indigo-200 animate-[spin_24s_linear_infinite]" />
        <div className="absolute inset-4 rounded-full bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center">
          <Layers className="w-9 h-9 text-indigo-300" />
        </div>
        <div className="absolute -top-1 -right-1 w-8 h-8 rounded-full bg-white shadow-md border border-gray-100 flex items-center justify-center">
          <Briefcase className="w-4 h-4 text-amber-400" />
        </div>
        <div className="absolute -bottom-1 -left-1 w-8 h-8 rounded-full bg-white shadow-md border border-gray-100 flex items-center justify-center">
          <Layers className="w-4 h-4 text-emerald-400" />
        </div>
      </div>
      <p className="text-sm text-gray-500">{t('暂无共建资源')}</p>
      <p className="text-xs text-gray-400 mt-1 mb-4">
        {t('与学校共建岗位与场景，展示合作成果')}
      </p>
      <Link href="/partner/co-build/positions">
        <Button size="sm" variant="outline" className="text-indigo-600 border-indigo-200 hover:bg-indigo-50">
          {t('前往共建资源')}
        </Button>
      </Link>
    </div>
  )
}

const CONTENT_LINE_COLORS = {
  projects: '#6366f1',
  agreements: '#10b981',
  achievements: '#f59e0b',
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
  const monthlyNew = dash?.monthlyNewCounts ?? []
  const sumOf = (key: 'experts' | 'positions' | 'scenarios') =>
    monthlyNew.reduce((s, m) => s + (m[key] || 0), 0)
  const schoolNewTotal = (dash?.monthlySchoolCounts ?? []).reduce((s, m) => s + m.count, 0)

  const stats = [
    {
      title: t('专家数量'),
      value: dash?.expertCount ?? 0,
      trend: t('近 6 个月新增 {count} 个', { count: sumOf('experts') }),
      href: '/partner/experts',
      icon: Users,
      color: 'blue' as const,
    },
    {
      title: t('合作学校'),
      value: dash?.schoolCount ?? 0,
      trend: t('近 6 个月新增 {count} 所', { count: schoolNewTotal }),
      href: '/partner/schools',
      icon: School,
      color: 'green' as const,
    },
    {
      title: t('共建岗位'),
      value: dash?.coBuildPositionCount ?? 0,
      trend: t('近 6 个月新增 {count} 个', { count: sumOf('positions') }),
      href: '/partner/co-build/positions',
      icon: Briefcase,
      color: 'indigo' as const,
    },
    {
      title: t('共建场景'),
      value: dash?.coBuildScenarioCount ?? 0,
      trend: t('近 6 个月新增 {count} 个', { count: sumOf('scenarios') }),
      href: '/partner/co-build/scenes',
      icon: Layers,
      color: 'purple' as const,
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

  // 共建资源分布（饼图）：岗位共建 / 场景共建
  const positionCount = dash?.coBuildPositionCount ?? 0
  const scenarioCount = dash?.coBuildScenarioCount ?? 0
  const resourceTotal = positionCount + scenarioCount
  const resourcePieData = [
    { name: t('岗位共建'), value: positionCount, color: '#6366f1' },
    { name: t('场景共建'), value: scenarioCount, color: '#a78bfa' },
  ]
  const chartConfig: ChartConfig = { count: { label: t('数量') } }

  // 合作内容月度统计（折线图）：项目/协议/成果
  const contentMonthly = (dash?.contentMonthlyCounts ?? []).map((m) => ({
    month: m.month,
    projects: m.projects ?? 0,
    agreements: m.agreements ?? 0,
    achievements: m.achievements ?? 0,
  }))

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
          title={t('共建资源分布')}
          icon={Layers}
          iconColor="indigo"
          action={{ label: t('前往共建资源'), href: '/partner/co-build/positions' }}
        >
          {resourceTotal > 0 ? (
            <div className="flex items-center gap-6 py-2">
              <div className="w-36 h-36 relative shrink-0">
                <ChartContainer config={chartConfig} className="w-full h-full">
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={resourcePieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={62}
                        dataKey="value"
                        strokeWidth={0}
                      >
                        {resourcePieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(v: number, _name: string, item: any) => [
                          t('{count} 个', { count: v }),
                          item.payload?.name,
                        ]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartContainer>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">{resourceTotal}</div>
                    <div className="text-xs text-gray-500">{t('共建资源')}</div>
                  </div>
                </div>
              </div>
              <div className="flex-1 space-y-2.5 min-w-0">
                {resourcePieData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-gray-600 text-xs truncate">{item.name}</span>
                    </div>
                    <Badge variant="secondary" className="text-xs h-5 shrink-0">
                      {item.value}
                    </Badge>
                  </div>
                ))}
                {resourceTotal === 0 && (
                  <p className="text-sm text-gray-400 py-6 text-center">{t('暂无数据')}</p>
                )}
              </div>
            </div>
          ) : (
            <CoBuildEmptyState />
          )}
        </SectionCard>

        <SectionCard
          title={t('合作内容统计')}
          icon={TrendingUp}
          iconColor="indigo"
          action={{ label: t('查看全部'), href: '/partner/cooperation' }}
        >
          <div className="h-56 py-2">
            <ChartContainer config={chartConfig} className="w-full h-full">
              <ResponsiveContainer>
                <LineChart data={contentMonthly} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="month"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                  />
                  <YAxis
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                  />
                  <Tooltip
                    cursor={{ stroke: '#cbd5e1', strokeDasharray: '3 3' }}
                    formatter={(v: number, name: string) => [v, t(name)]}
                  />
                  <Legend
                    formatter={(value: string) => (
                      <span className="text-xs text-gray-500">{t(value)}</span>
                    )}
                  />
                  <Line
                    type="monotone"
                    dataKey="projects"
                    name={t('合作项目')}
                    stroke={CONTENT_LINE_COLORS.projects}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="agreements"
                    name={t('合作协议')}
                    stroke={CONTENT_LINE_COLORS.agreements}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="achievements"
                    name={t('合作成果')}
                    stroke={CONTENT_LINE_COLORS.achievements}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
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
    </div>
  )
}
