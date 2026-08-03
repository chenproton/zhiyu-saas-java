'use client'

import { useEffect, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Bell,
  BookOpen,
  Briefcase,
  Calendar,
  CheckSquare,
  ChevronRight,
  Clock,
  ClipboardList,
  Database,
  FileText,
  Layers,
  LayoutGrid,
  Library,
  Users,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { SectionCard } from './section-card'
import { portalApi } from '@/lib/api'
import type { WorkspaceDashboard, WorkspaceResourceStat } from '@/lib/types'

const iconMap: Record<string, LucideIcon> = {
  'book-open': BookOpen,
  layers: Layers,
  briefcase: Briefcase,
  'file-text': FileText,
  'check-circle': CheckSquare,
}

const extraResourceEntries = [
  {
    label: '教学资源共享库',
    icon: Library,
    href: '/library/knowledge',
    desc: '知识点、能力点与教学资源',
  },
  {
    label: '教务管理',
    icon: Calendar,
    href: '/affairs/programs',
    desc: '培养方案、教学计划、排课',
  },
  {
    label: '产教融合',
    icon: Users,
    href: '/portal/apps/alliance/enterprises',
    desc: '合作企业、项目与成果',
  },
  { label: '应用中心', icon: LayoutGrid, href: '/portal/apps', desc: '全部平台应用入口' },
]

interface SchoolAdminOverviewTabProps {
  onTabChange?: (tab: string) => void
}

export function SchoolAdminOverviewTab({ onTabChange }: SchoolAdminOverviewTabProps) {
  const [dashboard, setDashboard] = useState<WorkspaceDashboard | null>(null)

  useEffect(() => {
    portalApi
      .workspaceDashboard({ role: 'school_admin' })
      .then(setDashboard)
      .catch(() => setDashboard(null))
  }, [])

  const announcements = dashboard?.announcements || []
  const todos = dashboard?.todos || []
  const resourceStats = dashboard?.resourceStats || []
  const personnelStats = dashboard?.personnelStats || []

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3 space-y-4">
          {/* 资源管理入口 */}
          <SectionCard title="资源管理入口" icon={LayoutGrid} iconColor="blue">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {resourceStats.map((item) => (
                <ResourceCard key={item.label} item={item} />
              ))}
              {extraResourceEntries.map((entry) => (
                <a
                  key={entry.label}
                  href={entry.href}
                  className="group flex items-start gap-4 p-4 rounded-xl border border-gray-100 bg-gray-50/50 hover:bg-white hover:border-blue-200 hover:shadow-sm transition-all"
                >
                  <div className="w-12 h-12 rounded-xl bg-white border border-gray-100 flex items-center justify-center text-blue-600 group-hover:bg-blue-50 group-hover:border-blue-200 transition-colors">
                    <entry.icon className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-gray-900">{entry.label}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{entry.desc}</div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-gray-300 group-hover:text-blue-600 group-hover:bg-blue-50"
                    aria-label="查看详情"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </a>
              ))}
            </div>
          </SectionCard>

          {/* 人员概览小卡片 */}
          <SectionCard title="学校人员概览" icon={Users} iconColor="green">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {personnelStats.map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl border border-gray-100 bg-gray-50/50 p-3 text-center"
                >
                  <div className="text-2xl font-bold text-gray-900">{item.value}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{item.label}</div>
                </div>
              ))}
              {personnelStats.length === 0 && (
                <div className="col-span-full py-6 text-center text-xs text-gray-400">
                  暂无人员数据
                </div>
              )}
            </div>
          </SectionCard>
        </div>

        <div className="space-y-3">
          {/* 待办事项 */}
          <SectionCard
            title="待办事项"
            icon={CheckSquare}
            iconColor="rose"
            action={{ label: '全部待办', onClick: () => onTabChange?.('approvals') }}
          >
            <ScrollArea className="h-[260px]">
              <div className="space-y-2 pr-2">
                {todos.length === 0 && (
                  <div className="py-8 text-center text-xs text-gray-400">暂无待办事项</div>
                )}
                {todos.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-2.5 rounded-xl border border-gray-100 bg-gray-50/50 hover:bg-gray-50 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-white border border-gray-100 flex items-center justify-center text-gray-500 group-hover:text-blue-600 transition-colors">
                        <ClipboardList className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
                        {item.deadline && (
                          <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                            <Clock className="w-3 h-3" />
                            截止 {item.deadline}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="destructive" className="text-xs bg-white border-gray-100">
                        {item.count}
                      </Badge>
                      <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500" />
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </SectionCard>

          {/* 通知公告 */}
          <SectionCard title="通知公告" icon={Bell} iconColor="blue" action={{ label: '全部通知' }}>
            <ScrollArea className="h-[240px]">
              <div className="space-y-2 pr-2">
                {announcements.length === 0 && (
                  <div className="py-8 text-center text-xs text-gray-400">暂无通知公告</div>
                )}
                {announcements.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer group"
                  >
                    <Badge
                      variant={item.type === '重要' ? 'destructive' : 'secondary'}
                      className="shrink-0 text-xs px-1.5 py-0 h-5 mt-0.5 bg-white border-gray-100"
                    >
                      {item.type}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                        {item.title}
                      </p>
                      <p className="text-xs text-gray-500">{item.date}</p>
                    </div>
                    {item.isNew && (
                      <span className="w-2 h-2 rounded-full bg-red-500 shrink-0 mt-1.5" />
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </SectionCard>
        </div>
      </div>
    </div>
  )
}

function ResourceCard({ item }: { item: WorkspaceResourceStat }) {
  const Icon = iconMap[item.icon || ''] || Database
  return (
    <a
      href={item.href || '#'}
      className="group flex items-center gap-4 p-4 rounded-xl border border-gray-100 bg-gray-50/50 hover:bg-white hover:border-blue-200 hover:shadow-sm transition-all"
    >
      <div className="w-12 h-12 rounded-xl bg-white border border-gray-100 flex items-center justify-center text-blue-600 group-hover:bg-blue-50 group-hover:border-blue-200 transition-colors">
        <Icon className="w-6 h-6" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-lg font-bold text-gray-900">{item.value}</div>
        <div className="text-sm text-gray-500 truncate">{item.label}</div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-gray-300 group-hover:text-blue-600 group-hover:bg-blue-50"
        aria-label="查看详情"
      >
        <ChevronRight className="w-4 h-4" />
      </Button>
    </a>
  )
}
