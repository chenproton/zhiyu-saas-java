"use client"

import { useState, useMemo, useEffect } from "react"
import type { LucideIcon } from "lucide-react"
import {
  Bell, BookOpen, Calendar, CheckSquare, ChevronLeft, ChevronRight,
  Clock, GraduationCap, ClipboardList,
  ExternalLink, PlayCircle, TrendingUp, FileCheck,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SectionCard } from "./section-card"
import { CourseDetailDialog } from "./teacher-courses-tab"
import { PrepAssociateDialog } from "./prep-associate-dialog"
import { GradingIframeDialog } from "./grading-iframe-dialog"
import { HybridGradingDialog } from "./hybrid-grading-dialog"
import { portalApi } from "@/lib/api"
import { COURSE_LEARN_URL, SCENE_PLATFORM_URL } from "@/lib/external-links"
import type { WorkspaceDashboard, WorkspaceScheduleEvent } from "@/lib/types"
import type { WorkspaceClassPlan, WorkspaceClassSession } from "@/lib/types"
// 演示数据：以下 import 来自占位 mock 文件，后续应替换为真实 API（详见该文件头部说明）
import {
  type TeacherScheduleEvent,
  type PrepAssociationRecord,
} from "../_data/mock-teacher-data"

const typeIconMap: Record<string, LucideIcon> = {
  grade: GraduationCap,
  approve: ClipboardList,
  homework: BookOpen,
  review: CheckSquare,
}

const typeLabelMap: Record<string, string> = {
  grade: "成绩",
  approve: "审批",
  homework: "作业",
  review: "审核",
}

interface TeacherDashboardTabProps {
  onTabChange: (tab: string) => void
  prepAssociations?: Record<string, PrepAssociationRecord>
  onAssociate?: (fn: (prev: Record<string, PrepAssociationRecord>) => Record<string, PrepAssociationRecord>) => void
}

export function TeacherDashboardTab({ onTabChange, prepAssociations = {}, onAssociate }: TeacherDashboardTabProps) {
  const [dashboard, setDashboard] = useState<WorkspaceDashboard | null>(null)

  useEffect(() => {
    portalApi.workspaceDashboard({ role: "teacher" }).then((res) => setDashboard(res)).catch(() => setDashboard(null))
  }, [])

  const announcements = dashboard?.announcements || []
  const todos = dashboard?.todos || []
  const schedule = dashboard?.schedule || []
  const classPlans = dashboard?.classPlans || []
  const classSessions = dashboard?.classSessions || []

  const [prepDialogOpen, setPrepDialogOpen] = useState(false)
  const [prepPlanId, setPrepPlanId] = useState("")
  const [prepSessionId, setPrepSessionId] = useState("")
  const [prepPlanName, setPrepPlanName] = useState("")
  const [prepIsHybrid, setPrepIsHybrid] = useState(true)
  const [prepUrl, setPrepUrl] = useState("")

  const [gradeDialogOpen, setGradeDialogOpen] = useState(false)
  const [gradeSessionTitle, setGradeSessionTitle] = useState("")
  const [gradeClassName, setGradeClassName] = useState("")
  const [hybridGradeDialogOpen, setHybridGradeDialogOpen] = useState(false)
  const [hybridGradeSessionTitle, setHybridGradeSessionTitle] = useState("")
  const [hybridGradeClassName, setHybridGradeClassName] = useState("")
  const [prepSessionLabels, setPrepSessionLabels] = useState<Record<string, string>>({})

  return (
    <div className="space-y-3">
      {/* 主体：课程表 + 右侧边栏 */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* 课程日历 */}
        <div className="lg:col-span-3">
          <SectionCard>
            <CourseScheduleTable
              events={schedule as WorkspaceScheduleEvent[]}
              classPlans={classPlans}
              classSessions={classSessions}
              prepAssociations={prepAssociations}
              onAssociate={onAssociate}
              onPrepRequest={(planId, sessionId, planName, isHybrid, url, sessionLabel) => {
                setPrepPlanId(planId); setPrepSessionId(sessionId)
                setPrepPlanName(planName)
                setPrepIsHybrid(isHybrid); setPrepUrl(url); setPrepDialogOpen(true)
                if (sessionLabel) setPrepSessionLabels(prev => ({ ...prev, [sessionId]: sessionLabel }))
              }}
              onGradeRequest={(title, className, isHybrid) => {
                if (isHybrid) {
                  setHybridGradeSessionTitle(title)
                  setHybridGradeClassName(className || "")
                  setHybridGradeDialogOpen(true)
                } else {
                  setGradeSessionTitle(title); setGradeClassName(className || "")
                  setGradeDialogOpen(true)
                }
              }}
            />
          </SectionCard>
        </div>

    <div className="space-y-3">
          {/* 今日待办 */}
          <SectionCard
            title="待办事项"
            icon={CheckSquare}
            iconColor="rose"
            action={{ label: "全部待办", onClick: () => onTabChange("courses") }}
          >
            <ScrollArea className="h-[260px]">
              <div className="space-y-2 pr-2">
                {todos.length === 0 && (
                  <div className="py-8 text-center text-xs text-gray-400">暂无待办事项</div>
                )}
                {todos.map((item) => {
                  const Icon = typeIconMap[item.type]
                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-2.5 rounded-xl border border-gray-100 bg-gray-50/50 hover:bg-gray-50 transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-white border border-gray-100 flex items-center justify-center text-gray-500 group-hover:text-blue-600 transition-colors">
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
                          {item.deadline && (
                            <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                              <Clock className="w-3 h-3" />
                              截止 {item.deadline} · {typeLabelMap[item.type]}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={item.urgent ? "destructive" : "secondary"}
                          className="text-xs bg-white border-gray-100"
                        >
                          {item.count}
                        </Badge>
                        <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500" />
                      </div>
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          </SectionCard>

          {/* 通知公告 */}
          <SectionCard title="通知公告" icon={Bell} iconColor="blue" action={{ label: "全部通知" }}>
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
                      variant={item.type === "重要" ? "destructive" : "secondary"}
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
                    {item.isNew && <span className="w-2 h-2 rounded-full bg-red-500 shrink-0 mt-1.5" />}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </SectionCard>
        </div>
      </div>
      <PrepAssociateDialog
        open={prepDialogOpen}
        onOpenChange={setPrepDialogOpen}
        planId={prepPlanId}
        planName={prepPlanName}
        isHybrid={prepIsHybrid}
        currentSubItemIds={prepAssociations[prepSessionId]?.subItems.map(s => s.id)}
        prepUrl={prepUrl}
        onConfirm={(subItems) => {
          if (onAssociate) {
            onAssociate((prev) => ({
              ...prev,
              [prepSessionId]: { planId: prepPlanId, subItems: subItems.map(s => ({ id: s.id, name: s.name })) },
            }))
          }
        }}
      />
      <GradingIframeDialog
        open={gradeDialogOpen}
        onOpenChange={setGradeDialogOpen}
        sessionTitle={gradeSessionTitle}
        className={gradeClassName}
      />
      <HybridGradingDialog
        open={hybridGradeDialogOpen}
        onOpenChange={setHybridGradeDialogOpen}
        sessionTitle={hybridGradeSessionTitle}
        className={hybridGradeClassName}
      />
    </div>
  )
}

const allPeriods = ["上午 1", "上午 2", "上午 3", "上午 4", "下午 1", "下午 2", "下午 3", "下午 4", "晚自习 1"]
const days = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]

const scheduleTypeConfig: Record<string, { bg: string; border: string; badge: string; label: string }> = {
  course: { bg: "bg-blue-50", border: "border-blue-200", badge: "border-blue-300 text-blue-600", label: "课程" },
  scene: { bg: "bg-emerald-50", border: "border-emerald-200", badge: "border-emerald-300 text-emerald-600", label: "实践场景" },
  meeting: { bg: "bg-amber-50", border: "border-amber-200", badge: "border-amber-300 text-amber-600", label: "会议" },
  training: { bg: "bg-cyan-50", border: "border-cyan-200", badge: "border-cyan-300 text-cyan-600", label: "培训" },
  exam: { bg: "bg-purple-50", border: "border-purple-200", badge: "border-purple-300 text-purple-600", label: "检查" },
  todo: { bg: "bg-gray-50", border: "border-gray-200", badge: "border-gray-300 text-gray-600", label: "待办" },
}

interface DashboardSelectedCourse {
  id: string
  name: string
  className: string
  students: number
}

function getWeekStart(date: Date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(d.setDate(diff))
}
function getWeekEnd(weekStart: Date) {
  const end = new Date(weekStart)
  end.setDate(end.getDate() + 6)
  return end
}
function getWeeksInMonth(year: number, month: number) {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startDay = firstDay.getDay() || 7
  const totalDays = lastDay.getDate()
  return Math.ceil((totalDays + startDay - 1) / 7)
}
function formatDate(date: Date) {
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

function getCourseUrls(event: TeacherScheduleEvent) {
  const isHybrid = event.type !== "scene"
  if (isHybrid) {
    return {
      isHybrid: true,
      prepUrl: "/lesson/admin/hybrid/add?id=hybrid-1",
      learnUrl: `${COURSE_LEARN_URL}/learn/courses/hybrid/hybrid-1/teacherlearn`,
    }
  }
  return {
    isHybrid: false,
    prepUrl: `${SCENE_PLATFORM_URL}/student_teacher.html?task=task-1-1`,
    learnUrl: `${SCENE_PLATFORM_URL}/student_teacher.html?task=task-1-1`,
  }
}

interface CourseScheduleTableProps {
  events?: WorkspaceScheduleEvent[]
  classPlans?: WorkspaceClassPlan[]
  classSessions?: WorkspaceClassSession[]
  prepAssociations?: Record<string, PrepAssociationRecord>
  onAssociate?: (fn: (prev: Record<string, PrepAssociationRecord>) => Record<string, PrepAssociationRecord>) => void
  onPrepRequest?: (planId: string, sessionId: string, planName: string, isHybrid: boolean, url: string, sessionLabel?: string) => void
  onGradeRequest?: (title: string, className: string, isHybrid: boolean) => void
}

function CourseScheduleTable({ events = [], classPlans = [], classSessions = [], prepAssociations = {}, onAssociate, onPrepRequest, onGradeRequest }: CourseScheduleTableProps = {}) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedCourse, setSelectedCourse] = useState<DashboardSelectedCourse | null>(null)
  const [dialogTab, setDialogTab] = useState("tracking")
  const [currentDate, setCurrentDate] = useState(() => new Date())

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth() + 1
  const weekStart = useMemo(() => getWeekStart(currentDate), [currentDate])
  const weekEnd = useMemo(() => getWeekEnd(weekStart), [weekStart])
  const weekIndex = useMemo(() => {
    const firstDayOfMonth = new Date(year, month - 1, 1)
    const startDay = firstDayOfMonth.getDay() || 7
    const offset = weekStart.getDate() + startDay - 2
    return Math.floor(offset / 7) + 1
  }, [year, month, weekStart])
  const weeksInMonth = getWeeksInMonth(year, month - 1)

  const goPrevWeek = () => { const d = new Date(currentDate); d.setDate(d.getDate() - 7); setCurrentDate(d) }
  const goNextWeek = () => { const d = new Date(currentDate); d.setDate(d.getDate() + 7); setCurrentDate(d) }
  const goToday = () => setCurrentDate(new Date())
  const handleYearChange = (v: string) => { const d = new Date(currentDate); d.setFullYear(Number(v)); setCurrentDate(d) }
  const handleMonthChange = (v: string) => { const d = new Date(currentDate); d.setMonth(Number(v) - 1); setCurrentDate(d) }
  const handleWeekChange = (v: string) => {
    const targetWeek = Number(v)
    const firstDay = new Date(year, month - 1, 1)
    const startDay = firstDay.getDay() || 7
    const targetDate = new Date(year, month - 1, 1 + (targetWeek - 1) * 7 - (startDay - 1))
    setCurrentDate(targetDate)
  }

  const openActionDialog = (event: TeacherScheduleEvent, tab: string) => {
    const matchingPlan = classPlans.find(
      (p) => p.course === event.title && (event.className ? p.name === event.className : true)
    )
    setSelectedCourse({
      id: matchingPlan?.id || event.id,
      name: event.title,
      className: event.className || event.tag || "",
      students: matchingPlan?.students || 0,
    })
    setDialogTab(tab)
    setDialogOpen(true)
  }

  return (
    <>
      <div className="border border-gray-200 rounded-xl overflow-x-auto bg-white shadow-sm">
        <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-semibold text-gray-900">
                {year}年{month}月 · 第{weekIndex}周
              </span>
              <span className="text-xs text-gray-500">
                {formatDate(weekStart)} - {formatDate(weekEnd)}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={String(year)} onValueChange={handleYearChange}>
                <SelectTrigger className="w-[76px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2025, 2026, 2027].map((y) => (
                    <SelectItem key={y} value={String(y)} className="text-xs">{y}年</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={String(month)} onValueChange={handleMonthChange}>
                <SelectTrigger className="w-[68px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <SelectItem key={m} value={String(m)} className="text-xs">{m}月</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={String(weekIndex)} onValueChange={handleWeekChange}>
                <SelectTrigger className="w-[84px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: weeksInMonth }, (_, i) => i + 1).map((w) => (
                    <SelectItem key={w} value={String(w)} className="text-xs">第{w}周</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center">
                <Button variant="outline" size="icon" className="h-8 w-8 rounded-r-none border-r-0" onClick={goPrevWeek}>
                  <ChevronLeft className="w-3.5 h-3.5" />
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8 rounded-l-none" onClick={goNextWeek}>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
              <Button variant="outline" size="sm" className="h-8 text-[11px] px-2" onClick={goToday}>
                今天
              </Button>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-8 min-w-[760px] bg-gray-50 border-b border-gray-200">
          <div className="p-3 text-sm font-semibold text-gray-700 border-r border-gray-200 flex items-center justify-center">
            节次 / 星期
          </div>
          {days.map((d) => (
            <div key={d} className="p-3 text-sm font-semibold text-gray-700 text-center border-r border-gray-200 last:border-r-0">
              {d}
            </div>
          ))}
        </div>
        {allPeriods.map((period) => (
          <div key={period} className="grid grid-cols-8 min-w-[760px] border-t border-gray-200">
            <div className="p-3 text-xs text-gray-500 border-r border-gray-200 bg-gray-50/50 flex items-center justify-center font-medium">
              {period}
            </div>
            {[1, 2, 3, 4, 5, 6, 7].map((dayOfWeek) => {
              const event = events.find((e) => e.dayOfWeek === dayOfWeek && e.period === period)
              const config = event ? scheduleTypeConfig[event.type] : null
              const isCourseLike = event?.type === "course" || event?.type === "scene"
                if (event && config && isCourseLike) {
                const urls = getCourseUrls(event)
                const matchingPlan = classPlans.find(
                  (p) => p.course === event.title && (event.className ? p.name === event.className : true)
                )
                const pid = matchingPlan?.id || event.id
                const session = matchingPlan
                  ? classSessions.find(
                      (s) => s.courseId === matchingPlan.id && s.weekday === days[event.dayOfWeek - 1] && s.period === event.period
                    )
                  : null
                const sessionKey = session?.id || `${pid}-${event.dayOfWeek}-${event.period}`
                const existingAssoc = prepAssociations[sessionKey]
                return (
                  <Popover key={dayOfWeek}>
                    <PopoverTrigger asChild>
                      <div className="p-1.5 border-r border-gray-200 last:border-r-0 min-h-[80px]">
                        <div
                          className={`w-full h-full rounded-lg p-2 text-xs space-y-1 transition-all hover:shadow-md hover:scale-[1.02] cursor-pointer ring-1 ring-transparent ${urls.isHybrid ? "hover:ring-blue-300/50" : "hover:ring-emerald-300/50"} ${config.bg} border ${config.border}`}
                        >
                          <div className="flex items-center gap-1">
                            <Badge variant="outline" className={`text-[10px] h-4 px-1 font-medium ${config.badge}`}>
                              {config.label}
                            </Badge>
                            {event.tag && <span className="text-[10px] text-gray-500 truncate">{event.tag}</span>}
                          </div>
                          <div className="font-semibold text-gray-900 truncate">{event.title}</div>
                          {event.description && <div className="text-[10px] text-gray-500 truncate">{event.description}</div>}
                          {event.location && (
                            <div className="text-[10px] text-gray-500 flex items-center gap-1">
                              <span>📍</span>
                              {event.location}
                            </div>
                          )}
                          <div className={`text-[10px] font-medium mt-0.5 ${urls.isHybrid ? "text-blue-500" : "text-emerald-600"}`}>点击查看操作</div>
                        </div>
                      </div>
                    </PopoverTrigger>
                    <PopoverContent
                      side="right"
                      align="start"
                      sideOffset={6}
                      className="w-80 p-4 bg-white shadow-xl border-gray-200 rounded-xl"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center gap-1.5 pb-2 border-b border-gray-100">
                          <span className="text-sm font-semibold text-gray-800 truncate flex-1">{event.title}</span>
                          {event.className && (
                            <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{event.className}</Badge>
                          )}
                        </div>
                        {(() => {
                          if (existingAssoc && existingAssoc.subItems.length > 0) {
                            return (
                              <div className={`rounded-lg border p-2 space-y-1 ${urls.isHybrid ? "border-blue-100 bg-blue-50/50" : "border-emerald-100 bg-emerald-50/50"}`}>
                                <span className={`text-[10px] font-medium block ${urls.isHybrid ? "text-blue-500" : "text-emerald-600"}`}>
                                  {urls.isHybrid ? "已关联节次" : "已关联任务"}（{existingAssoc.subItems.length}）
                                </span>
                                <div className="space-y-0.5 max-h-[100px] overflow-y-auto">
                                  {existingAssoc.subItems.map((si) => (
                                    <div key={si.id} className={`text-xs text-gray-700 pl-2 border-l-2 ${urls.isHybrid ? "border-blue-200" : "border-emerald-200"}`}>
                                      {si.name}
                                    </div>
                                  ))}
                                </div>
                                <Button size="sm" variant="link"
                                  className={`text-[10px] h-5 p-0 ${urls.isHybrid ? "text-blue-600" : "text-emerald-600"}`}
                                  onClick={() => {
                                    if (onPrepRequest) onPrepRequest(pid, sessionKey, event.title, urls.isHybrid, urls.prepUrl, `${days[event.dayOfWeek - 1]} ${event.period}`)
                                  }}>
                                   修改关联
                                </Button>
                              </div>
                            )
                          }
                          return null
                        })()}
                        <span className="text-[10px] text-gray-400 block">操作</span>
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline"
                            className={`flex-1 justify-center text-[11px] h-7 px-2 ${urls.isHybrid ? "border-blue-200 text-blue-600 hover:bg-blue-50" : "border-emerald-200 text-emerald-600 hover:bg-emerald-50"}`}
                              onClick={() => {
                                if (onPrepRequest) onPrepRequest(pid, sessionKey, event.title, urls.isHybrid, urls.prepUrl, `${days[event.dayOfWeek - 1]} ${event.period}`)
                              }}>
                            <ExternalLink className="h-3.5 w-3.5 mr-1" />
                            {urls.isHybrid ? "前往备课" : "导学准备"}
                          </Button>
                          <Button size="sm" variant="outline"
                            className={`flex-1 justify-center text-[11px] h-7 px-2 ${urls.isHybrid ? "border-blue-200 text-blue-600 hover:bg-blue-50" : "border-emerald-200 text-emerald-600 hover:bg-emerald-50"}`}
                            onClick={() => window.open(urls.learnUrl, "_blank")}>
                            <PlayCircle className="h-3.5 w-3.5 mr-1" />
                             {urls.isHybrid ? "前往上课" : "前往导学"}
                          </Button>
                          <Button size="sm" variant="outline"
                            className="flex-1 justify-center text-[11px] h-7 px-2 border-amber-200 text-amber-600 hover:bg-amber-50"
                            onClick={() => {
                              if (onGradeRequest) onGradeRequest(`${event.title} · ${event.period}`, event.className || event.tag || "", urls.isHybrid)
                            }}>
                            <GraduationCap className="h-3.5 w-3.5 mr-1" />
                            前往评分
                          </Button>
                        </div>
                        <div className="pt-2 mt-1 border-t border-dashed border-gray-200">
                          <span className="text-[10px] text-gray-400 block mb-1.5">数据查看</span>
                          <div className="flex items-center gap-2">
                            <Button size="sm" variant="ghost"
                              className={`flex-1 justify-center text-[11px] h-7 px-2 ${urls.isHybrid ? "text-blue-600 hover:bg-blue-50" : "text-emerald-600 hover:bg-emerald-50"}`}
                              onClick={() => openActionDialog(event, "tracking")}>
                              <TrendingUp className="h-3.5 w-3.5 mr-1" />
                              教学进展
                            </Button>
                            <Button size="sm" variant="ghost"
                              className="flex-1 justify-center text-[11px] h-7 px-2 text-purple-600 hover:bg-purple-50"
                              onClick={() => openActionDialog(event, "assessment")}>
                              <FileCheck className="h-3.5 w-3.5 mr-1" />
                              测评进展
                            </Button>
                          </div>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                )
              }
              return (
                <div
                  key={dayOfWeek}
                  className={`p-1.5 border-r border-gray-200 last:border-r-0 min-h-[80px] ${!event ? "bg-gray-50/30" : ""}`}
                >
                  {event && config ? (
                    <div className={`w-full h-full rounded-lg p-2 text-xs space-y-1 transition-all hover:shadow-sm hover:scale-[1.02] cursor-pointer ${config.bg} border ${config.border}`}>
                      <div className="flex items-center gap-1">
                        <Badge variant="outline" className={`text-[10px] h-4 px-1 font-medium ${config.badge}`}>
                          {config.label}
                        </Badge>
                        {event.tag && <span className="text-[10px] text-gray-500 truncate">{event.tag}</span>}
                      </div>
                      <div className="font-semibold text-gray-900 truncate">{event.title}</div>
                      {event.description && <div className="text-[10px] text-gray-500 truncate">{event.description}</div>}
                      {event.location && (
                        <div className="text-[10px] text-gray-500 flex items-center gap-1">
                          <span>📍</span>
                          {event.location}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="w-full h-full min-h-[65px] rounded-lg border border-dashed border-gray-200 flex items-center justify-center text-gray-300">
                      <span className="text-[10px]">-</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
      <CourseDetailDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        course={selectedCourse}
        initialTab={dialogTab}
      />
    </>
  )
}
