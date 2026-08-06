'use client'

import { useEffect, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  BookOpen,
  Briefcase,
  CheckSquare,
  ClipboardList,
  Database,
  FileText,
  Layers,
  TrendingUp,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { SectionCard } from './section-card'
import { portalApi } from '@/lib/api'
import type { WorkspaceDashboard } from '@/lib/types'
import { Line, LineChart, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'

const iconMap: Record<string, LucideIcon> = {
  'book-open': BookOpen,
  layers: Layers,
  briefcase: Briefcase,
  'file-text': FileText,
  'check-circle': CheckSquare,
}

const resourceTrendItems = [
  { key: 'careerPositions', label: '岗位', icon: Briefcase, color: '#8b5cf6' },
  { key: 'scenarios', label: '场景', icon: Layers, color: '#10b981' },
  { key: 'courses', label: '课程', icon: BookOpen, color: '#3b82f6' },
  { key: 'questionBanks', label: '题库', icon: Database, color: '#06b6d4' },
  { key: 'exams', label: '试卷', icon: FileText, color: '#f97316' },
  { key: 'examUsages', label: '考试', icon: CheckSquare, color: '#ef4444' },
]

export function SchoolAdminResourcesTab() {
  const [dashboard, setDashboard] = useState<WorkspaceDashboard | null>(null)

  useEffect(() => {
    portalApi
      .workspaceDashboard({ role: 'school_admin' })
      .then(setDashboard)
      .catch(() => setDashboard(null))
  }, [])

  const resourceStats = dashboard?.resourceStats || []
  const todos = dashboard?.todos || []
  const pendingCount = todos.reduce((acc, item) => acc + item.count, 0)
  const growth = dashboard?.resourceGrowth || []

  return (
    <div className="space-y-3">
      {/* 资源存量指标 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {resourceStats.map((item) => {
          const Icon = iconMap[item.icon || ''] || Database
          return (
            <Card
              key={item.label}
              className="border-0 shadow-sm bg-gradient-to-br from-white to-gray-50/50"
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/5 flex items-center justify-center text-primary">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xl font-bold text-gray-900">{item.value}</p>
                    <p className="text-xs text-gray-500">{item.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3 space-y-4">
          {/* 资源增长趋势（每种资源一张卡片） */}
          <SectionCard title="资源增长趋势" icon={TrendingUp} iconColor="blue">
            {growth.length === 0 ? (
              <div className="py-10 text-center text-sm text-gray-400">暂无增长数据</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {resourceTrendItems.map((item) => (
                  <ResourceTrendCard
                    key={item.key}
                    item={item}
                    data={growth.map((g) => ({
                      date: g.date,
                      value: g[item.key as keyof typeof g] as number,
                    }))}
                  />
                ))}
              </div>
            )}
          </SectionCard>
        </div>

        <div>
          <SectionCard title="待审批资源" icon={ClipboardList} iconColor="amber">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">待审批总数</span>
                <Badge variant="destructive" className="text-xs">
                  {pendingCount}
                </Badge>
              </div>
              {todos.length === 0 && (
                <div className="py-4 text-center text-xs text-gray-400">暂无待审批</div>
              )}
              {todos.map((item) => (
                <div key={item.id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">{item.title}</span>
                  <Badge variant="secondary" className="text-xs">
                    {item.count}
                  </Badge>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  )
}

function ResourceTrendCard({
  item,
  data,
}: {
  item: (typeof resourceTrendItems)[number]
  data: { date: string; value: number }[]
}) {
  const Icon = item.icon
  const latest = data[data.length - 1]?.value ?? 0
  return (
    <Card className="border border-gray-100 shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${item.color}1a`, color: item.color }}
            >
              <Icon className="w-4 h-4" />
            </div>
            <span className="text-sm font-semibold text-gray-900">{item.label}资源增长</span>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold" style={{ color: item.color }}>
              {latest}
            </p>
            <p className="text-xs text-gray-400">今日新增</p>
          </div>
        </div>
        <div className="h-20 w-full">
          <ChartContainer config={{}} className="h-full w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10 }}
                  stroke="#94a3b8"
                  tickLine={false}
                  axisLine={false}
                  minTickGap={16}
                />
                <YAxis hide />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line
                  type="monotone"
                  dataKey="value"
                  name={item.label}
                  stroke={item.color}
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartContainer>
        </div>
      </CardContent>
    </Card>
  )
}
