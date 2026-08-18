'use client'

import { useState, useMemo, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
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
// 演示数据：以下 import 来自占位 mock 文件，后续应替换为真实 API（详见该文件头部说明）
import { allPeriods, days, type ScheduleEvent } from '../_data/workspace-student-types'
import { formatDate, formatYMD } from '@/lib/format-utils'
import { lessonLandingHref, sceneLandingHref } from '@/lib/learn-links'
import { useT } from '@/lib/i18n/locale-provider'
import { getWeekStart, getWeekEnd, getWeeksInMonth, getWeekIndex, getWeekTargetDate } from '@/lib/schedule-utils'

/** 工作台 dashboard 事件已下发 resourceVersion（排课 stamp）；本地 mock 类型尚无该字段，此处扩展 */
type ScheduleEventWithVersion = ScheduleEvent & { resourceVersion?: string }

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

function getStudentActionUrls(
  event: ScheduleEvent,
): { learnUrl: string; isActionable: true } | { isActionable: false } {
  const version = (event as ScheduleEventWithVersion).resourceVersion
  if (event.type === 'scene' && event.scenarioId) {
    return {
      // 学生入口带排课 stamp 的 resourceVersion（?v=），按班级绑定版本读快照
      learnUrl: sceneLandingHref(event.scenarioId, version),
      isActionable: true,
    }
  }
  if (event.type === 'course' && event.courseId) {
    return {
      learnUrl: lessonLandingHref(event.courseId, version),
      isActionable: true,
    }
  }
  return { isActionable: false }
}

function dateKey(d: Date): string {
  return formatYMD(d)
}

// 事件可带可选的 date（单次安排）；未带 date 的事件视为每周重复安排，始终显示
function isEventInWeek(event: ScheduleEvent, weekStart: Date, weekEnd: Date): boolean {
  const date = (event as ScheduleEvent & { date?: string }).date
  if (!date) return true
  const key = date.slice(0, 10)
  return key >= dateKey(weekStart) && key <= dateKey(weekEnd)
}

export function WorkspaceScheduleGrid({ events }: ScheduleGridProps) {
  const t = useT()
  const [view, setView] = useState<ViewType>('week')
  const [currentDate, setCurrentDate] = useState(() => new Date())

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth() + 1

  const weekStart = useMemo(() => getWeekStart(currentDate), [currentDate])
  const weekEnd = useMemo(() => getWeekEnd(weekStart), [weekStart])
  // 基于绝对日期差计算周次（第 1 周为包含当月 1 号的那一周），避免跨月错算/周下拉重复值
  const weekIndex = useMemo(
    () => getWeekIndex(weekStart, year, month),
    [year, month, weekStart],
  )

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
    setCurrentDate(getWeekTargetDate(year, month, Number(val)))
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
              {t('{year}年{month}月', { year, month })}
              {view === 'week' && t(' · 第{week}周', { week: weekIndex })}
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
                <SelectTrigger className="w-[108px] h-9 text-xs">
                  <SelectValue placeholder={t('年份')} />
                </SelectTrigger>
                <SelectContent>
                  {[2025, 2026, 2027].map((y) => (
                    <SelectItem key={y} value={String(y)} className="text-xs">
                      {t('{year}年', { year: y })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={String(month)} onValueChange={handleMonthChange}>
                <SelectTrigger className="w-[100px] h-9 text-xs">
                  <SelectValue placeholder={t('月份')} />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <SelectItem key={m} value={String(m)} className="text-xs">
                      {t('{month}月', { month: m })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}

          {view === 'week' && (
            <Select value={String(weekIndex)} onValueChange={handleWeekChange}>
              <SelectTrigger className="w-[112px] h-9 text-xs">
                <SelectValue placeholder={t('周次')} />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: weeksInMonth }, (_, i) => i + 1).map((w) => (
                  <SelectItem key={w} value={String(w)} className="text-xs">
                    {t('第{week}周', { week: w })}
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
              aria-label={t('上一周')}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-l-none"
              onClick={nextPeriod}
              aria-label={t('下一周')}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          <Button variant="outline" size="sm" className="h-9 text-xs" onClick={goToday}>
            {t('今天')}
          </Button>

          <Tabs value={view} onValueChange={(v) => setView(v as ViewType)}>
            <TabsList className="h-9">
              <TabsTrigger value="year" className="text-xs px-3">
                {t('年')}
              </TabsTrigger>
              <TabsTrigger value="month" className="text-xs px-3">
                {t('月')}
              </TabsTrigger>
              <TabsTrigger value="week" className="text-xs px-3">
                {t('周')}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* 视图内容 */}
      {view === 'week' && <WeekView events={events} weekStart={weekStart} weekEnd={weekEnd} />}
      {view === 'month' && <MonthView year={year} month={month} events={events} />}
      {view === 'year' && <YearView year={year} events={events} />}
    </div>
  )
}

function ScheduleEventPopover({ event, children }: { event: ScheduleEvent; children: ReactNode }) {
  const action = getStudentActionUrls(event)
  const router = useRouter()
  const t = useT()

  if (!action.isActionable) {
    return <>{children}</>
  }

  const isCourse = event.type === 'course'
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
            <span className="text-[10px] text-gray-400 block mb-1.5">{t('操作')}</span>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className={`flex-1 justify-center text-[11px] h-7 px-2 ${borderColor} ${textColor} ${hoverBg}`}
                onClick={() => router.push(action.learnUrl)}
              >
                <ExternalLink className="h-3.5 w-3.5 mr-1" />
                {t('前往学习')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 justify-center text-[11px] h-7 px-2 border-gray-200 text-gray-400 cursor-not-allowed"
                disabled
              >
                <FileCheck className="h-3.5 w-3.5 mr-1" />
                {t('查看测评结果')}
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function WeekView({
  events,
  weekStart,
  weekEnd,
}: {
  events: ScheduleEvent[]
  weekStart: Date
  weekEnd: Date
}) {
  // 事件需属于当前周（weekStart ~ weekEnd）才显示，避免其他周的安排出现在本周视图
  const t = useT()
  const weekEvents = events.filter((e) => isEventInWeek(e, weekStart, weekEnd))
  return (
    <div className="border border-gray-200 rounded-xl overflow-x-auto bg-white shadow-sm">
      <div className="grid grid-cols-8 min-w-[760px] bg-gray-50">
        <div className="p-3 text-sm font-semibold text-gray-700 border-r border-gray-200 flex items-center justify-center">
          {t('节次 / 星期')}
        </div>
        {days.map((d) => (
          <div
            key={d}
            className="p-3 text-sm font-semibold text-gray-700 text-center border-r border-gray-200 last:border-r-0"
          >
            {t(d)}
          </div>
        ))}
      </div>

      {allPeriods.map((period) => (
        <div key={period} className="grid grid-cols-8 min-w-[760px] border-t border-gray-200">
          <div className="p-3 text-xs text-gray-500 border-r border-gray-200 bg-gray-50/50 flex items-center justify-center font-medium">
            {t(period)}
          </div>
          {[1, 2, 3, 4, 5, 6, 7].map((dayOfWeek) => {
            const event = weekEvents.find((e) => e.dayOfWeek === dayOfWeek && e.period === period)
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
                    {t(typeStyles[event.type].label)}
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

  const t = useT()
  const weekDays = [t('日'), t('一'), t('二'), t('三'), t('四'), t('五'), t('六')]

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm p-5">
      <div className="grid grid-cols-7 gap-1 mb-2">
        {weekDays.map((d) => (
          <div key={d} className="text-center text-xs text-gray-500 py-2 font-medium">
            {t('周{day}', { day: d })}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-2">
        {calendarDays.map((day, index) => {
          // 单次事件（带 date）按日期精确匹配，避免在当月所有同星期格重复出现；
          // 未带 date 的事件视为每周重复安排，按星期匹配
          const dayEvents = day
            ? events.filter((e) => {
                const eventDate = (e as ScheduleEvent & { date?: string }).date
                if (eventDate) {
                  return eventDate.slice(0, 10) === `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                }
                return e.dayOfWeek === (index % 7 || 7)
              })
            : []
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
                        {t('+{count} 项', { count: dayEvents.length - 3 })}
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
  const t = useT()
  const months = Array.from({ length: 12 }, (_, i) => i + 1)
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {months.map((m) => {
        // 与 MonthView 一致：仅带 date 的单次事件按日期归月；
        // 不带 date 的每周重复排课不属于特定月份，年视图不按月乱塞（原 dayOfWeek 取模为占位伪逻辑）。
        const monthKey = `${year}-${String(m).padStart(2, '0')}`
        const monthEvents = events
          .filter((e) => {
            const eventDate = (e as ScheduleEvent & { date?: string }).date
            return eventDate ? eventDate.slice(0, 7) === monthKey : false
          })
          .slice(0, 4)
        return (
          <div
            key={m}
            className="border border-gray-200 rounded-xl bg-white p-4 hover:shadow-sm transition-shadow cursor-pointer"
          >
            <div className="text-sm font-semibold text-gray-900 mb-3">
              {t('{month}月', { month: m })}
            </div>
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
                <div className="text-[10px] text-gray-400">{t('暂无安排')}</div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
