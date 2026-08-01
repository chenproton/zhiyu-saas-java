'use client'

import { useState, useMemo, type ReactNode } from 'react'
import {
  MapPin,
  User,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  ExternalLink,
  FileCheck,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { COURSE_LEARN_URL, SCENE_PLATFORM_URL } from '@/lib/external-links'
// 演示数据：以下 import 来自占位 mock 文件，后续应替换为真实 API（详见该文件头部说明）
import { allPeriods, days, type ScheduleEvent } from '../_data/mock-student-data'
import { formatDate, formatDateTime } from '@/lib/format-utils'

interface ScheduleGridProps {
  events: ScheduleEvent[]
}

type ViewType = 'year' | 'month' | 'week'

const typeStyles: Record<
  ScheduleEvent['type'],
  { bg: string; border: string; badge: string; label: string; actionColor: string }
> = {
  course: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    badge: 'border-blue-300 text-blue-600',
    label: '课程',
    actionColor: 'blue',
  },
  scene: {
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    badge: 'border-orange-300 text-orange-600',
    label: '岗位场景',
    actionColor: 'orange',
  },
  exam: {
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    badge: 'border-purple-300 text-purple-600',
    label: '考试/测评',
    actionColor: 'purple',
  },
  todo: {
    bg: 'bg-gray-50',
    border: 'border-gray-200',
    badge: 'border-gray-300 text-gray-600',
    label: '待办',
    actionColor: 'gray',
  },
}

function getStudentActionUrls(event: ScheduleEvent) {
  if (event.type === 'scene') {
    return {
      learnUrl: `${SCENE_PLATFORM_URL}/student.html?task=task-1-1`,
      isActionable: true,
    }
  }
  if (event.type === 'course') {
    return {
      learnUrl: `${COURSE_LEARN_URL}/learn/courses/system/1/learn`,
      isActionable: true,
    }
  }
  return { isActionable: false }
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
  const firstDay = new Date(year, month - 1, 1)
  const lastDay = new Date(year, month, 0)
  const startDay = firstDay.getDay() || 7
  const totalDays = lastDay.getDate()
  return Math.ceil((totalDays + startDay - 1) / 7)
}

export function WorkspaceScheduleGrid({ events }: ScheduleGridProps) {
  const [view, setView] = useState<ViewType>('week')
  const [currentDate, setCurrentDate] = useState(() => new Date())

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth() + 1

  const weekStart = useMemo(() => getWeekStart(currentDate), [currentDate])
  const weekEnd = useMemo(() => getWeekEnd(weekStart), [weekStart])
  const weekIndex = useMemo(() => {
    const firstDay = new Date(year, month - 1, 1)
    const startDay = firstDay.getDay() || 7
    const offset = weekStart.getDate() + startDay - 2
    return Math.floor(offset / 7) + 1
  }, [year, month, weekStart])

  const handleYearChange = (val: string) => {
    const d = new Date(currentDate)
    d.setFullYear(Number(val))
    setCurrentDate(d)
  }

  const handleMonthChange = (val: string) => {
    const d = new Date(currentDate)
    d.setMonth(Number(val) - 1)
    setCurrentDate(d)
  }

  const handleWeekChange = (val: string) => {
    const targetWeek = Number(val)
    const firstDay = new Date(year, month - 1, 1)
    const startDay = firstDay.getDay() || 7
    const targetDate = new Date(year, month - 1, 1 + (targetWeek - 1) * 7 - (startDay - 1))
    setCurrentDate(targetDate)
  }

  const prevPeriod = () => {
    const d = new Date(currentDate)
    if (view === 'week') d.setDate(d.getDate() - 7)
    if (view === 'month') d.setMonth(d.getMonth() - 1)
    if (view === 'year') d.setFullYear(d.getFullYear() - 1)
    setCurrentDate(d)
  }

  const nextPeriod = () => {
    const d = new Date(currentDate)
    if (view === 'week') d.setDate(d.getDate() + 7)
    if (view === 'month') d.setMonth(d.getMonth() + 1)
    if (view === 'year') d.setFullYear(d.getFullYear() + 1)
    setCurrentDate(d)
  }

  const goToday = () => setCurrentDate(new Date())

  const weeksInMonth = getWeeksInMonth(year, month)

  return (
    <div className="space-y-4">
      {/* 工具栏 */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-50 text-blue-600">
            <CalendarDays className="w-5 h-5" />
          </div>
          <div>
            <div className="text-base font-semibold text-gray-900">
              {year}年{month}月{view === 'week' && ` · 第${weekIndex}周`}
            </div>
            {view === 'week' && (
              <div className="text-xs text-gray-500">
                {formatDate(weekStart)} - {formatDate(weekEnd)}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* 年/月/周选择器 */}
          {view !== 'year' && (
            <>
              <Select value={String(year)} onValueChange={handleYearChange}>
                <SelectTrigger className="w-[88px] h-9 text-xs">
                  <SelectValue placeholder="年份" />
                </SelectTrigger>
                <SelectContent>
                  {[2025, 2026, 2027].map((y) => (
                    <SelectItem key={y} value={String(y)} className="text-xs">
                      {y}年
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={String(month)} onValueChange={handleMonthChange}>
                <SelectTrigger className="w-[80px] h-9 text-xs">
                  <SelectValue placeholder="月份" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <SelectItem key={m} value={String(m)} className="text-xs">
                      {m}月
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}

          {view === 'week' && (
            <Select value={String(weekIndex)} onValueChange={handleWeekChange}>
              <SelectTrigger className="w-[92px] h-9 text-xs">
                <SelectValue placeholder="周次" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: weeksInMonth }, (_, i) => i + 1).map((w) => (
                  <SelectItem key={w} value={String(w)} className="text-xs">
                    第{w}周
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <div className="flex items-center">
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-r-none border-r-0"
              onClick={prevPeriod}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-l-none"
              onClick={nextPeriod}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          <Button variant="outline" size="sm" className="h-9 text-xs" onClick={goToday}>
            今天
          </Button>

          <Tabs value={view} onValueChange={(v) => setView(v as ViewType)}>
            <TabsList className="h-9">
              <TabsTrigger value="year" className="text-xs px-3">
                年
              </TabsTrigger>
              <TabsTrigger value="month" className="text-xs px-3">
                月
              </TabsTrigger>
              <TabsTrigger value="week" className="text-xs px-3">
                周
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* 视图内容 */}
      {view === 'week' && <WeekView events={events} />}
      {view === 'month' && <MonthView year={year} month={month} events={events} />}
      {view === 'year' && <YearView year={year} events={events} />}
    </div>
  )
}

function ScheduleEventPopover({ event, children }: { event: ScheduleEvent; children: ReactNode }) {
  const action = getStudentActionUrls(event)

  if (!action.isActionable) {
    return <>{children}</>
  }

  const isCourse = event.type === 'course'
  const accentClass = isCourse ? 'blue' : 'orange'
  const borderColor = isCourse ? 'border-blue-200' : 'border-orange-200'
  const textColor = isCourse ? 'text-blue-600' : 'text-orange-600'
  const hoverBg = isCourse ? 'hover:bg-blue-50' : 'hover:bg-orange-50'
  const lightBg = isCourse ? 'bg-blue-50/50' : 'bg-orange-50/50'
  const lightBorder = isCourse ? 'border-blue-100' : 'border-orange-100'

  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        side="right"
        align="start"
        sideOffset={6}
        className="w-72 p-4 bg-white shadow-xl border-gray-200 rounded-xl"
      >
        <div className="space-y-3">
          <div className="flex items-center gap-1.5 pb-2 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-800 truncate flex-1">
              {event.title}
            </span>
            {event.tag && (
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                {event.tag}
              </Badge>
            )}
          </div>
          <div className="space-y-1 text-xs text-gray-500">
            {event.teacher && (
              <div className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {event.teacher}
              </div>
            )}
            {event.location && (
              <div className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {event.location}
              </div>
            )}
            {event.description && <div className="truncate">{event.description}</div>}
          </div>
          <div className={`rounded-lg border p-2 ${lightBg} ${lightBorder}`}>
            <span className="text-[10px] text-gray-400 block mb-1.5">操作</span>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className={`flex-1 justify-center text-[11px] h-7 px-2 ${borderColor} ${textColor} ${hoverBg}`}
                onClick={() => window.open(action.learnUrl, '_blank')}
              >
                <ExternalLink className="h-3.5 w-3.5 mr-1" />
                前往学习
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 justify-center text-[11px] h-7 px-2 border-gray-200 text-gray-400 cursor-not-allowed"
                disabled
              >
                <FileCheck className="h-3.5 w-3.5 mr-1" />
                查看测评结果
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function WeekView({ events }: { events: ScheduleEvent[] }) {
  return (
    <div className="border border-gray-200 rounded-xl overflow-x-auto bg-white shadow-sm">
      <div className="grid grid-cols-8 min-w-[760px] bg-gray-50">
        <div className="p-3 text-sm font-semibold text-gray-700 border-r border-gray-200 flex items-center justify-center">
          节次 / 星期
        </div>
        {days.map((d) => (
          <div
            key={d}
            className="p-3 text-sm font-semibold text-gray-700 text-center border-r border-gray-200 last:border-r-0"
          >
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
            const card = event ? (
              <div
                className={cn(
                  'w-full h-full rounded-lg p-2 text-xs space-y-1 transition-all hover:shadow-sm hover:scale-[1.02] cursor-pointer',
                  typeStyles[event.type].bg,
                  'border',
                  typeStyles[event.type].border,
                )}
              >
                <div className="flex items-center gap-1">
                  <Badge
                    variant="outline"
                    className={cn('text-[10px] h-4 px-1 font-medium', typeStyles[event.type].badge)}
                  >
                    {typeStyles[event.type].label}
                  </Badge>
                  {event.tag && (
                    <span className="text-[10px] text-gray-500 truncate">{event.tag}</span>
                  )}
                </div>
                <div className="font-semibold text-gray-900 truncate">{event.title}</div>
                {event.description && (
                  <div className="text-[10px] text-gray-500 truncate">{event.description}</div>
                )}
                {event.teacher && (
                  <div className="text-[10px] text-gray-500 flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {event.teacher}
                  </div>
                )}
                {event.location && (
                  <div className="text-[10px] text-gray-500 flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {event.location}
                  </div>
                )}
              </div>
            ) : null
            return (
              <div
                key={dayOfWeek}
                className={cn(
                  'p-1.5 border-r border-gray-200 last:border-r-0 min-h-[90px]',
                  !event && 'bg-gray-50/30',
                )}
              >
                {event ? (
                  <ScheduleEventPopover event={event}>{card}</ScheduleEventPopover>
                ) : (
                  <div className="w-full h-full min-h-[70px] rounded-lg border border-dashed border-gray-200 flex items-center justify-center text-gray-300">
                    <span className="text-[10px]">-</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

function MonthView({
  year,
  month,
  events,
}: {
  year: number
  month: number
  events: ScheduleEvent[]
}) {
  const firstDay = new Date(year, month - 1, 1)
  const lastDay = new Date(year, month, 0)
  const daysInMonth = lastDay.getDate()
  const startDayOfWeek = firstDay.getDay()
  const calendarDays: (number | null)[] = []
  for (let i = 0; i < startDayOfWeek; i++) calendarDays.push(null)
  for (let i = 1; i <= daysInMonth; i++) calendarDays.push(i)

  const weekDays = ['日', '一', '二', '三', '四', '五', '六']

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm p-5">
      <div className="grid grid-cols-7 gap-1 mb-2">
        {weekDays.map((d) => (
          <div key={d} className="text-center text-xs text-gray-500 py-2 font-medium">
            周{d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-2">
        {calendarDays.map((day, index) => {
          const dayEvents = day ? events.filter((e) => e.dayOfWeek === (index % 7 || 7)) : []
          return (
            <div
              key={index}
              className={cn(
                'min-h-[100px] rounded-lg border p-2 transition-colors',
                day ? 'border-gray-100 hover:bg-gray-50 cursor-pointer' : 'border-transparent',
              )}
            >
              {day && (
                <>
                  <div className="text-sm font-medium text-gray-700 mb-1">{day}</div>
                  <div className="space-y-1">
                    {dayEvents.slice(0, 3).map((e) => {
                      const eventCard = (
                        <div
                          className={cn(
                            'text-[10px] px-1.5 py-0.5 rounded truncate border',
                            typeStyles[e.type].bg,
                            typeStyles[e.type].border,
                            typeStyles[e.type].badge,
                          )}
                        >
                          {e.title}
                        </div>
                      )
                      return (
                        <ScheduleEventPopover key={e.id} event={e}>
                          {eventCard}
                        </ScheduleEventPopover>
                      )
                    })}
                    {dayEvents.length > 3 && (
                      <div className="text-[10px] text-gray-400 pl-1">
                        +{dayEvents.length - 3} 项
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function YearView({ year, events }: { year: number; events: ScheduleEvent[] }) {
  const months = Array.from({ length: 12 }, (_, i) => i + 1)
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {months.map((m) => {
        const monthEvents = events.filter((e) => e.dayOfWeek % 4 === m % 4).slice(0, 4)
        return (
          <div
            key={m}
            className="border border-gray-200 rounded-xl bg-white p-4 hover:shadow-sm transition-shadow cursor-pointer"
          >
            <div className="text-sm font-semibold text-gray-900 mb-3">{m}月</div>
            <div className="space-y-1.5">
              {monthEvents.map((e) => {
                const eventCard = (
                  <div
                    className={cn(
                      'text-[10px] px-2 py-1 rounded truncate border',
                      typeStyles[e.type].bg,
                      typeStyles[e.type].border,
                      typeStyles[e.type].badge,
                    )}
                  >
                    {e.title}
                  </div>
                )
                return (
                  <ScheduleEventPopover key={e.id} event={e}>
                    {eventCard}
                  </ScheduleEventPopover>
                )
              })}
              {monthEvents.length === 0 && (
                <div className="text-[10px] text-gray-400">暂无安排</div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
