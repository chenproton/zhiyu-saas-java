"use client"

import { useEffect, useState, useMemo } from "react"
import type { LucideIcon } from "lucide-react"
import {
  Bell,
  BookOpen,
  Briefcase,
  CheckSquare,
  ChevronRight,
  Clock,
  ClipboardList,
  GraduationCap,
  Layers,
  TrendingUp,
  Users,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { SectionCard } from "./section-card"
import { portalApi } from "@/lib/api"
import type { WorkspaceDashboard, WorkspaceResourceGrowth } from "@/lib/types"
import {
  Line,
  LineChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"

const chartConfig = {
  courses: { label: "课程", color: "#3b82f6" },
  scenarios: { label: "场景", color: "#10b981" },
  careerPositions: { label: "岗位", color: "#8b5cf6" },
  questionBanks: { label: "题库", color: "#06b6d4" },
  exams: { label: "试卷", color: "#f97316" },
  examUsages: { label: "考试", color: "#ef4444" },
}

interface SchoolAdminOverviewTabProps {
  onTabChange?: (tab: string) => void
}

export function SchoolAdminOverviewTab({ onTabChange }: SchoolAdminOverviewTabProps) {
  const [dashboard, setDashboard] = useState<WorkspaceDashboard | null>(null)

  useEffect(() => {
    portalApi.workspaceDashboard({ role: "school_admin" }).then(setDashboard).catch(() => setDashboard(null))
  }, [])

  const announcements = dashboard?.announcements || []
  const todos = dashboard?.todos || []
  const stats = dashboard?.stats
  const resourceStats = dashboard?.resourceStats || []
  const personnelStats = dashboard?.personnelStats || []
  const growth = dashboard?.resourceGrowth || []

  const totalStudents = personnelStats.find((p) => p.label === "学生")?.value || 0
  const totalTeachers = personnelStats.find((p) => p.label === "教职工")?.value || 0

  return (
    <div className="space-y-3">
      {/* 顶部关键指标 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="课程资源" value={resourceStats.find((r) => r.label === "课程资源")?.value || 0} icon={BookOpen} color="blue" />
        <StatCard label="实践场景" value={resourceStats.find((r) => r.label === "实践场景")?.value || 0} icon={Layers} color="green" />
        <StatCard label="待审批" value={stats?.value2 || 0} icon={ClipboardList} color="amber" />
        <StatCard label="师生总数" value={totalStudents + totalTeachers} icon={Users} color="indigo" />
      </div>

      {/* 主体：资源增长折线图 + 右侧边栏 */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3 space-y-4">
          <SectionCard title="资源增长趋势" icon={TrendingUp} iconColor="blue">
            <div className="h-[360px] w-full">
              {growth.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-gray-400">暂无增长数据</div>
              ) : (
                <ChartContainer config={chartConfig} className="h-full w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={growth} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                      <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Line type="monotone" dataKey="courses" name={chartConfig.courses.label} stroke={chartConfig.courses.color} strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="scenarios" name={chartConfig.scenarios.label} stroke={chartConfig.scenarios.color} strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="careerPositions" name={chartConfig.careerPositions.label} stroke={chartConfig.careerPositions.color} strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="questionBanks" name={chartConfig.questionBanks.label} stroke={chartConfig.questionBanks.color} strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="exams" name={chartConfig.exams.label} stroke={chartConfig.exams.color} strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="examUsages" name={chartConfig.examUsages.label} stroke={chartConfig.examUsages.color} strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartContainer>
              )}
            </div>
          </SectionCard>

          {/* 人员概览小卡片 */}
          <SectionCard title="学校人员概览" icon={Users} iconColor="green">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {personnelStats.map((item) => (
                <div key={item.label} className="rounded-xl border border-gray-100 bg-gray-50/50 p-3 text-center">
                  <div className="text-2xl font-bold text-gray-900">{item.value}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{item.label}</div>
                </div>
              ))}
              {personnelStats.length === 0 && (
                <div className="col-span-full py-6 text-center text-xs text-gray-400">暂无人员数据</div>
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
            action={{ label: "全部待办", onClick: () => onTabChange?.("approvals") }}
          >
            <ScrollArea className="h-[260px]">
              <div className="space-y-2 pr-2">
                {todos.length === 0 && <div className="py-8 text-center text-xs text-gray-400">暂无待办事项</div>}
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
          <SectionCard title="通知公告" icon={Bell} iconColor="blue" action={{ label: "全部通知" }}>
            <ScrollArea className="h-[240px]">
              <div className="space-y-2 pr-2">
                {announcements.length === 0 && <div className="py-8 text-center text-xs text-gray-400">暂无通知公告</div>}
                {announcements.map((item) => (
                  <div key={item.id} className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer group">
                    <Badge
                      variant={item.type === "重要" ? "destructive" : "secondary"}
                      className="shrink-0 text-xs px-1.5 py-0 h-5 mt-0.5 bg-white border-gray-100"
                    >
                      {item.type}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 truncate group-hover:text-blue-600 transition-colors">{item.title}</p>
                      <p className="text-xs text-gray-500">{item.date}</p>
                    </div>
                    {item.isNew && <span className="w-2 h-2 rounded-full bg-red-500 shrink-0 mt-1.5" />}
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

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string
  value: number
  icon: LucideIcon
  color: "blue" | "green" | "amber" | "indigo" | "purple" | "rose"
}) {
  const colorClass = {
    blue: "from-blue-500 to-blue-600",
    green: "from-emerald-500 to-emerald-600",
    amber: "from-amber-500 to-amber-600",
    indigo: "from-indigo-500 to-indigo-600",
    purple: "from-purple-500 to-purple-600",
    rose: "from-rose-500 to-rose-600",
  }[color]

  return (
    <Card className={`bg-gradient-to-r ${colorClass} text-white border-0`}>
      <CardContent className="p-4 flex items-center justify-between">
        <div>
          <p className="text-white/80 text-sm">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
        <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
          <Icon className="w-6 h-6" />
        </div>
      </CardContent>
    </Card>
  )
}
