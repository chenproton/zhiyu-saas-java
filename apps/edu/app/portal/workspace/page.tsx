'use client'

import { useEffect, useState } from 'react'
import {
  Bell,
  Calendar,
  CalendarDays,
  CheckSquare,
  Shield,
  Users,
  TrendingUp,
  BarChart3,
  PieChart,
  BookOpen,
  GraduationCap,
  Briefcase,
  Building2,
  LayoutDashboard,
  Layers,
  Compass,
  Award,
  MessageSquare,
  User,
  Loader2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Bar,
  BarChart,
  Pie,
  PieChart as RePieChart,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Area,
  AreaChart,
} from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { usePortalAuth } from '@/contexts/portal-auth-context'
import { portalApi } from '@/lib/api'
import type { WorkspaceDashboard } from '@/lib/types'

import { DashboardTab } from './_components/dashboard-tab'
import { LearningTab } from './_components/learning-tab'
import { CareerTab } from './_components/career-tab'
import { AssessmentTab } from './_components/assessment-tab'
import { PortraitTab } from './_components/portrait-tab'
import { CommunityTab } from './_components/community-tab'
import { ProfileTab } from './_components/profile-tab'
import { MyScheduleTab } from './_components/my-schedule-tab'

// 演示数据：以下 import 来自占位 mock 文件，后续应替换为真实 API（详见该文件头部说明）
import type { PrepAssociationRecord } from './_data/workspace-teacher-types'
import { TeacherDashboardTab } from './_components/teacher-dashboard-tab'
import { TeacherCoursesTab } from './_components/teacher-courses-tab'
import { TeacherPortraitsTab } from './_components/teacher-portraits-tab'
import { TeacherProfileTab } from './_components/teacher-profile-tab'
import { SchoolAdminOverviewTab } from './_components/school-admin-overview-tab'
import { SchoolAdminResourcesTab } from './_components/school-admin-resources-tab'
import { SchoolAdminApprovalsTab } from './_components/school-admin-approvals-tab'
import { SchoolAdminPersonnelTab } from './_components/school-admin-personnel-tab'

// 不同身份的服务台内容（非学生角色保留原展示；公告/待办/日历事件均由后端接口提供）
const roleConfigs = {
  teacher: {
    welcomeText: '欢迎回来，张老师。',
    stats: { label1: '授课课程', value1: 8, label2: '学生人数', value2: 256 },
  },
  enterprise: {
    welcomeText: '欢迎回来，企业用户。',
    stats: { label1: '合作项目', value1: 5, label2: '实习学生', value2: 23 },
  },
  admin: {
    welcomeText: '欢迎回来，管理员。',
    stats: { label1: '在线用户', value1: 1256, label2: '总用户数', value2: 8500 },
  },
}

// 这些模块数据需从后端接口获取，当前先置空，避免展示写死的 Mock 数据
const securityItems: { label: string; status: string; statusText: string; action: string }[] = []

const weeklyData: { day: string; value: number }[] = []

const monthlyTrend: { month: string; students: number; courses: number }[] = []

const resourceUsage: { name: string; value: number; color: string }[] = []

const contacts: { id: number; name: string; phone: string; avatar: string }[] = []

function generateCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const daysInMonth = lastDay.getDate()
  const startDayOfWeek = firstDay.getDay()
  const days: (number | null)[] = []
  for (let i = 0; i < startDayOfWeek; i++) days.push(null)
  for (let i = 1; i <= daysInMonth; i++) days.push(i)
  return days
}

const roleIcons = {
  teacher: GraduationCap,
  student: BookOpen,
  enterprise: Building2,
  admin: Briefcase,
}

// 教师工作台 Tab 配置
const teacherTabs = [
  { id: 'dashboard', label: '工作台首页', icon: LayoutDashboard },
  { id: 'courses', label: '我的场景/课程', icon: BookOpen },
  { id: 'schedule', label: '我的课表', icon: CalendarDays },
  { id: 'portraits', label: '我的学生', icon: BarChart3 },
  { id: 'profile', label: '个人中心', icon: User },
]

// 学生工作台 Tab 配置
const studentTabs = [
  { id: 'dashboard', label: '工作台首页', icon: LayoutDashboard },
  { id: 'learning', label: '我的学习', icon: Layers },
  { id: 'schedule', label: '我的课表', icon: CalendarDays },
  { id: 'career', label: '我的收藏', icon: Compass },
  { id: 'assessment', label: '测评认证', icon: Award },
  { id: 'portrait', label: '学生画像', icon: BarChart3 },
  { id: 'community', label: '学习社区', icon: MessageSquare },
  { id: 'profile', label: '个人中心', icon: User },
]

// 学校管理员工作台 Tab 配置
const schoolAdminTabs = [
  { id: 'dashboard', label: '工作台首页', icon: LayoutDashboard },
  { id: 'resources', label: '资源运营', icon: BookOpen },
  { id: 'approvals', label: '审批中心', icon: CheckSquare },
  { id: 'personnel', label: '教师学生情况', icon: Users },
  { id: 'profile', label: '个人中心', icon: User },
]

function StudentWorkspace({ userId }: { userId?: string }) {
  const [activeTab, setActiveTab] = useState('dashboard')

  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardTab onTabChange={setActiveTab} />
      case 'learning':
        return <LearningTab />
      case 'schedule':
        return <MyScheduleTab role="student" />
      case 'career':
        return <CareerTab />
      case 'assessment':
        return <AssessmentTab />
      case 'portrait':
        return <PortraitTab userId={userId} />
      case 'community':
        return <CommunityTab />
      case 'profile':
        return <ProfileTab />
      default:
        return <DashboardTab onTabChange={setActiveTab} />
    }
  }

  return (
    <div className="space-y-3">
      {/* Tab 导航 */}
      <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-1 sticky top-14 z-30">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {studentTabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Tab 内容 */}
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
        {renderTabContent()}
      </div>
    </div>
  )
}

function TeacherWorkspace() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [prepAssociations, setPrepAssociations] = useState<Record<string, PrepAssociationRecord>>(
    {},
  )

  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <TeacherDashboardTab
            onTabChange={setActiveTab}
            prepAssociations={prepAssociations}
            onAssociate={setPrepAssociations}
          />
        )
      case 'courses':
        return (
          <TeacherCoursesTab
            prepAssociations={prepAssociations}
            onAssociate={setPrepAssociations}
          />
        )
      case 'schedule':
        return <MyScheduleTab role="teacher" />
      case 'portraits':
        return <TeacherPortraitsTab />
      case 'profile':
        return <TeacherProfileTab />
      default:
        return (
          <TeacherDashboardTab
            onTabChange={setActiveTab}
            prepAssociations={prepAssociations}
            onAssociate={setPrepAssociations}
          />
        )
    }
  }

  return (
    <div className="space-y-3">
      {/* Tab 导航 */}
      <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-1 sticky top-14 z-30">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {teacherTabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Tab 内容 */}
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
        {renderTabContent()}
      </div>
    </div>
  )
}

function SchoolAdminWorkspace() {
  const [activeTab, setActiveTab] = useState('dashboard')

  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <SchoolAdminOverviewTab onTabChange={setActiveTab} />
      case 'resources':
        return <SchoolAdminResourcesTab />
      case 'approvals':
        return <SchoolAdminApprovalsTab />
      case 'personnel':
        return <SchoolAdminPersonnelTab />
      case 'profile':
        return <ProfileTab />
      default:
        return <SchoolAdminOverviewTab onTabChange={setActiveTab} />
    }
  }

  return (
    <div className="space-y-3">
      {/* Tab 导航 */}
      <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-1 sticky top-14 z-30">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {schoolAdminTabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Tab 内容 */}
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
        {renderTabContent()}
      </div>
    </div>
  )
}

export default function WorkspacePage() {
  const { user, activeRole, loading: isLoading } = usePortalAuth()
  const [dashboard, setDashboard] = useState<WorkspaceDashboard | null>(null)

  useEffect(() => {
    // 学生/教师/学校管理员工作台由各自 Tab 自行拉取数据，此处仅兜底视图（企业导师）需要
    if (activeRole?.code !== 'enterprise_mentor') return
    portalApi
      .workspaceDashboard({ role: activeRole.code })
      .then(setDashboard)
      .catch(() => setDashboard(null))
  }, [activeRole?.code])

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] flex-col items-center justify-center gap-4 text-sm text-muted-foreground">
        <p>请先登录后查看服务台</p>
        <a href="/portal/login" className="text-primary hover:underline">
          去登录
        </a>
      </div>
    )
  }

  const currentRole = activeRole?.code || 'teacher'

  const today = new Date()
  const todayLabel = today.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  })

  // 学生角色展示全新的学生工作台
  if (currentRole === 'student') {
    return (
      <div className="px-4 pt-6 pb-2 bg-gray-50 min-h-[calc(100vh-3.5rem)]">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">学生工作台</h1>
            <p className="text-sm text-gray-500 mt-1">
              欢迎回来，同学。今天是{todayLabel}。管理你的学习、岗位、测评与成长。
            </p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl border border-gray-100 shadow-sm">
            <BookOpen className="w-5 h-5 text-blue-600" />
            <span className="text-sm font-medium text-gray-700">
              当前角色：{activeRole?.name || '学生'}
            </span>
          </div>
        </div>
        <StudentWorkspace userId={user?.id} />
      </div>
    )
  }

  // 教职工角色展示教师工作台
  if (currentRole === 'teacher') {
    return (
      <div className="px-4 pt-6 pb-2 bg-gray-50 min-h-[calc(100vh-3.5rem)]">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">教师工作台</h1>
            <p className="text-sm text-gray-500 mt-1">
              欢迎回来，张老师。今天是{todayLabel}。管理你的课程、教学跟踪与测评。
            </p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl border border-gray-100 shadow-sm">
            <GraduationCap className="w-5 h-5 text-blue-600" />
            <span className="text-sm font-medium text-gray-700">
              当前角色：{activeRole?.name || '教职工'}
            </span>
          </div>
        </div>
        <TeacherWorkspace />
      </div>
    )
  }

  // 学校管理员角色展示资源运营管理驾驶舱
  if (currentRole === 'school_admin') {
    return (
      <div className="px-4 pt-6 pb-2 bg-gray-50 min-h-[calc(100vh-3.5rem)]">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">学校管理员工作台</h1>
            <p className="text-sm text-gray-500 mt-1">
              欢迎回来，管理员。管理全校教学资源、审批与人员。
            </p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl border border-gray-100 shadow-sm">
            <Building2 className="w-5 h-5 text-blue-600" />
            <span className="text-sm font-medium text-gray-700">
              当前角色：{activeRole?.name || '学校管理员'}
            </span>
          </div>
        </div>
        <SchoolAdminWorkspace />
      </div>
    )
  }

  // 非学生角色保持原有通用工作台（企业导师等共用企业配置）
  const config = roleConfigs.enterprise

  // 从后端仪表盘接口取真实数据，原静态假数据仅作为兜底空值
  const announcements = dashboard?.announcements || []
  const todos = dashboard?.todos || []
  const stats = dashboard?.stats || config.stats
  const todoColors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6']
  const todosWithColor = todos.map((item, idx) => ({
    ...item,
    color: todoColors[idx % todoColors.length],
  }))
  const todoPieData = todosWithColor.map((item) => ({
    name: item.title,
    value: item.count,
    color: item.color,
  }))
  const totalTodo = todosWithColor.reduce((acc, item) => acc + item.count, 0)

  const calendarDays = generateCalendarDays(today.getFullYear(), today.getMonth())
  const weekDays = ['日', '一', '二', '三', '四', '五', '六']
  const calendarEvents: { id: number; title: string; time: string; date: number; color: string }[] =
    []
  const RoleIcon = roleIcons.enterprise

  return (
    <div className="px-4 pt-6 pb-2 bg-gray-50 min-h-[calc(100vh-3.5rem)]">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">我的服务台</h1>
          <p className="text-sm text-gray-500 mt-1">
            {config.welcomeText}今天是{todayLabel}。
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl border border-gray-100 shadow-sm">
          <RoleIcon className="w-5 h-5 text-blue-600" />
          <span className="text-sm font-medium text-gray-700">
            当前角色：{activeRole?.name || '教职工'}
          </span>
        </div>
      </div>

      {/* 快捷统计 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-5">
        <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white border-0">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm">{stats.label1}</p>
              <p className="text-2xl font-bold">{stats.value1}</p>
            </div>
            <div className="w-12 h-12 bg-card/20 rounded-lg flex items-center justify-center">
              <BookOpen className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white border-0">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-emerald-100 text-sm">{stats.label2}</p>
              <p className="text-2xl font-bold">{stats.value2}</p>
            </div>
            <div className="w-12 h-12 bg-card/20 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-r from-amber-500 to-amber-600 text-white border-0">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-amber-100 text-sm">待办事项</p>
              <p className="text-2xl font-bold">{totalTodo}</p>
            </div>
            <div className="w-12 h-12 bg-card/20 rounded-lg flex items-center justify-center">
              <CheckSquare className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white border-0">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm">消息通知</p>
              <p className="text-2xl font-bold">{announcements.filter((a) => a.isNew).length}</p>
            </div>
            <div className="w-12 h-12 bg-card/20 rounded-lg flex items-center justify-center">
              <Bell className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        {/* 通知公告 */}
        <Card className="bg-card/80 backdrop-blur border-0 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium flex items-center gap-2 text-foreground">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Bell className="w-4 h-4 text-primary" />
                </div>
                通知公告
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              <div className="space-y-3">
                {announcements.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start gap-2 group cursor-pointer p-2 -mx-2 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    <Badge
                      variant={item.type === '重要' ? 'destructive' : 'secondary'}
                      className="shrink-0 text-xs px-1.5 py-0"
                    >
                      {item.type}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate group-hover:text-primary transition-colors">
                        {item.title}
                      </p>
                      <p className="text-xs text-muted-foreground">{item.date}</p>
                    </div>
                    {item.isNew && (
                      <span className="w-2 h-2 rounded-full bg-destructive shrink-0 mt-1.5" />
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* 校园日历 */}
        <Card className="bg-card/80 backdrop-blur border-0 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium flex items-center gap-2 text-foreground">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <Calendar className="w-4 h-4 text-amber-500" />
                </div>
                校园日历
              </CardTitle>
              <span className="text-sm font-medium text-foreground">
                {today.getFullYear()}年{today.getMonth() + 1}月
              </span>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="grid grid-cols-7 gap-1 mb-3">
              {weekDays.map((day) => (
                <div key={day} className="text-center text-xs text-muted-foreground py-1">
                  {day}
                </div>
              ))}
              {calendarDays.map((day, index) => {
                const hasEvent = day && calendarEvents.some((e) => e.date === day)
                const isToday = day === today.getDate()
                return (
                  <div
                    key={index}
                    className={`text-center text-xs py-1.5 rounded-md cursor-pointer transition-colors relative
                      ${day ? 'hover:bg-primary/10' : ''}
                      ${isToday ? 'bg-primary text-white font-medium' : 'text-muted-foreground'}
                    `}
                  >
                    {day}
                    {hasEvent && !isToday && (
                      <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
                    )}
                  </div>
                )
              })}
            </div>
            <div className="border-t border-border pt-2">
              <div className="text-xs text-muted-foreground mb-2">今日日程</div>
              <div className="space-y-1.5">
                {calendarEvents
                  .filter((e) => e.date === today.getDate())
                  .map((event) => (
                    <div key={event.id} className="flex items-center gap-2 text-xs">
                      <span className={`w-1.5 h-1.5 rounded-full ${event.color}`} />
                      <span className="text-muted-foreground">{event.time}</span>
                      <span className="text-foreground">{event.title}</span>
                    </div>
                  ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 待办事项 - 带饼图 */}
        <Card className="bg-card/80 backdrop-blur border-0 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium flex items-center gap-2 text-foreground">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <CheckSquare className="w-4 h-4 text-emerald-500" />
                </div>
                待办事项
                <Badge className="ml-1 text-xs px-1.5 py-0 bg-rose-500">{totalTodo}</Badge>
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="w-24 h-24 relative">
                <ChartContainer config={{}} className="w-full h-full">
                  <RePieChart>
                    <Pie
                      data={todoPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={25}
                      outerRadius={40}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {todoPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </RePieChart>
                </ChartContainer>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-lg font-bold text-foreground">{totalTodo}</div>
                    <div className="text-xs text-muted-foreground">待办</div>
                  </div>
                </div>
              </div>
              <div className="flex-1 space-y-2">
                {todosWithColor.map((item) => (
                  <div key={item.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-muted-foreground text-xs">{item.title}</span>
                    </div>
                    <Badge variant="secondary" className="text-xs h-5">
                      {item.count}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 账号安全中心 */}
        <Card className="bg-card/80 backdrop-blur border-0 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium flex items-center gap-2 text-foreground">
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Shield className="w-4 h-4 text-purple-500" />
                </div>
                账号安全中心
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {securityItems.map((item, index) => (
                <div key={index} className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{item.label}</span>
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-sm ${
                        item.status === 'strong' ||
                        item.status === 'bound' ||
                        item.status === 'normal'
                          ? 'text-emerald-500'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {item.statusText}
                    </span>
                    <Button variant="link" size="sm" className="text-xs text-primary h-auto p-0">
                      {item.action}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 本周活跃度 - 折线图 */}
        <Card className="bg-card/80 backdrop-blur border-0 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium flex items-center gap-2 text-foreground">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-blue-500" />
                </div>
                本周活跃度
              </CardTitle>
              <Badge variant="secondary" className="text-xs">
                +12.5%
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <ChartContainer config={{}} className="h-[180px] w-full">
              <AreaChart data={weeklyData}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fill="url(#colorValue)"
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* 学习数据统计 - 柱形图 */}
        <Card className="bg-card/80 backdrop-blur border-0 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium flex items-center gap-2 text-foreground">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                  <BarChart3 className="w-4 h-4 text-indigo-500" />
                </div>
                学习数据统计
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <ChartContainer config={{}} className="h-[180px] w-full">
              <BarChart data={monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="students" fill="#6366f1" radius={[4, 4, 0, 0]} name="学生数" />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* 资源使用占比 */}
        <Card className="bg-card/80 backdrop-blur border-0 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium flex items-center gap-2 text-foreground">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                  <PieChart className="w-4 h-4 text-cyan-500" />
                </div>
                资源使用占比
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="w-28 h-28">
                <ChartContainer config={{}} className="w-full h-full">
                  <RePieChart>
                    <Pie
                      data={resourceUsage}
                      cx="50%"
                      cy="50%"
                      innerRadius={30}
                      outerRadius={50}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {resourceUsage.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </RePieChart>
                </ChartContainer>
              </div>
              <div className="flex-1 space-y-2">
                {resourceUsage.map((item) => (
                  <div key={item.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-muted-foreground">{item.name}</span>
                    </div>
                    <span className="text-foreground font-medium">{item.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 校园通讯录 */}
        <Card className="bg-card/80 backdrop-blur border-0 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium flex items-center gap-2 text-foreground">
                <div className="w-8 h-8 rounded-lg bg-teal-500/10 flex items-center justify-center">
                  <Users className="w-4 h-4 text-teal-500" />
                </div>
                校园通讯录
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {contacts.map((contact) => (
                <div
                  key={contact.id}
                  className="flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <div className="w-9 h-9 bg-primary/10 rounded-full flex items-center justify-center text-primary text-sm font-medium">
                    {contact.avatar}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-foreground">{contact.name}</div>
                    <div className="text-xs text-muted-foreground">{contact.phone}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
