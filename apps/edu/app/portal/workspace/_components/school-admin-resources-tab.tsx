"use client"

import { useEffect, useState } from "react"
import type { LucideIcon } from "lucide-react"
import {
  BookOpen,
  Briefcase,
  Calendar,
  CheckSquare,
  ChevronRight,
  ClipboardList,
  Database,
  FileText,
  GraduationCap,
  Layers,
  LayoutGrid,
  Library,
  Users,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { SectionCard } from "./section-card"
import { portalApi } from "@/lib/api"
import type { WorkspaceDashboard, WorkspaceResourceStat } from "@/lib/types"

const iconMap: Record<string, LucideIcon> = {
  "book-open": BookOpen,
  layers: Layers,
  briefcase: Briefcase,
  "file-text": FileText,
  "check-circle": CheckSquare,
}

const extraResourceEntries = [
  { label: "教学资源共享库", icon: Library, href: "/library/knowledge", desc: "知识点、能力点与教学资源" },
  { label: "教务管理", icon: Calendar, href: "/affairs/programs", desc: "培养方案、教学计划、排课" },
  { label: "产教融合", icon: Users, href: "/portal/apps/alliance/enterprises", desc: "合作企业、项目与成果" },
  { label: "应用中心", icon: LayoutGrid, href: "/portal/apps", desc: "全部平台应用入口" },
]

export function SchoolAdminResourcesTab() {
  const [dashboard, setDashboard] = useState<WorkspaceDashboard | null>(null)

  useEffect(() => {
    portalApi.workspaceDashboard({ role: "school_admin" }).then(setDashboard).catch(() => setDashboard(null))
  }, [])

  const resourceStats = dashboard?.resourceStats || []
  const todos = dashboard?.todos || []
  const pendingCount = todos.reduce((acc, item) => acc + item.count, 0)

  return (
    <div className="space-y-3">
      {/* 资源存量指标 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {resourceStats.map((item) => {
          const Icon = iconMap[item.icon || ""] || Database
          return (
            <Card key={item.label} className="border-0 shadow-sm bg-gradient-to-br from-white to-gray-50/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
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
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </a>
              ))}
            </div>
          </SectionCard>
        </div>

        <div>
          <SectionCard title="待审批资源" icon={ClipboardList} iconColor="amber">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">待审批总数</span>
                <Badge variant="destructive" className="text-xs">{pendingCount}</Badge>
              </div>
              {todos.length === 0 && <div className="py-4 text-center text-xs text-gray-400">暂无待审批</div>}
              {todos.map((item) => (
                <div key={item.id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">{item.title}</span>
                  <Badge variant="secondary" className="text-xs">{item.count}</Badge>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  )
}

function ResourceCard({ item }: { item: WorkspaceResourceStat }) {
  const Icon = iconMap[item.icon || ""] || Database
  return (
    <a
      href={item.href || "#"}
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
      >
        <ChevronRight className="w-4 h-4" />
      </Button>
    </a>
  )
}
