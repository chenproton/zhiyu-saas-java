'use client'

import { useState } from 'react'
import { CalendarX2 } from 'lucide-react'
import { useAsync } from '@zhiyu/ui'
import { ScheduleGrid } from '@/components/shared/schedule-grid'
import { myScheduleApi, periodSlotApi } from '@/lib/api'
import type { AffairsTerm, PeriodSlot, ScheduleEntry } from '@/lib/types'
import { lessonLandingHref, sceneLandingHref } from '@/lib/learn-links'
import { useT } from '@/lib/i18n/locale-provider'

interface MyScheduleTabProps {
  /** student：场景课跳场景学习；teacher：场景课跳场景测评 */
  role: 'student' | 'teacher'
}

/** 我的课表 Tab（学生/教师工作台共用，当前学期已发布课表） */
export function MyScheduleTab({ role }: MyScheduleTabProps) {
  const t = useT()
  const [noTerm, setNoTerm] = useState(false)

  const { data, loading } = useAsync(async () => {
    try {
      const [scheduleRes, slotRes] = await Promise.all([
        myScheduleApi.get(),
        periodSlotApi.list({ limit: 100 }).catch(() => ({ items: [] as PeriodSlot[], total: 0 })),
      ])
      return { term: scheduleRes.term, entries: scheduleRes.items, periodSlots: slotRes.items }
    } catch (err: any) {
      // 后端 404：尚未配置学期，按空态处理；其余错误重抛交由 hook 统一提示
      if (err.message && (err.message.includes('学期') || err.message.includes('404'))) {
        setNoTerm(true)
        return { term: null as AffairsTerm | null, entries: [], periodSlots: [] }
      }
      throw err
    }
  })

  const { term, entries, periodSlots } = data ?? {}

  const getEntryHref = (entry: ScheduleEntry) => {
    if (entry.type === 'scene' && entry.scenarioId) {
      // 学生入口带排课 stamp 的 resourceVersion（?v=），按班级绑定版本读快照
      return role === 'student'
        ? sceneLandingHref(entry.scenarioId, entry.resourceVersion)
        : '/evaluation/scene-results'
    }
    if (entry.type === 'traditional' && entry.courseId) {
      return role === 'student'
        ? lessonLandingHref(entry.courseId, entry.resourceVersion)
        : `/evaluation/lesson-results?courseId=${entry.courseId}`
    }
    return undefined
  }

  const empty = !loading && (noTerm || (entries ?? []).length === 0)

  return (
    <div className="space-y-3">
      {/* 学期信息 */}
      <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">
            {term ? t('{name}课表', { name: term.name }) : t('我的课表')}
          </h3>
          <p className="text-xs text-gray-500">
            {term
              ? t('{start} 至 {end} · 共 {count} 周 · 仅显示已发布课表', {
                  start: term.startDate,
                  end: term.endDate,
                  count: term.weeksCount,
                })
              : t('仅显示当前学期已发布的课表')}
          </p>
        </div>
        {role === 'student' ? (
          <span className="text-xs text-gray-400">
            {t('带「场景」徽标的课程可点击进入场景学习')}
          </span>
        ) : (
          <span className="text-xs text-gray-400">
            {t('带「场景」徽标的课程可点击进入场景测评')}
          </span>
        )}
      </div>

      {/* 课表网格 */}
      <div className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
        {empty ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-sm text-gray-400">
            <CalendarX2 className="h-10 w-10 text-gray-300" />
            {noTerm
              ? t('学校尚未配置学期，课表发布后这里会展示你的课表')
              : t('当前学期暂无已发布的课表，发布后即可查看')}
          </div>
        ) : (
          <ScheduleGrid
            entries={entries ?? []}
            periodSlots={periodSlots ?? []}
            loading={loading}
            emptyText={t('当前学期暂无已发布的课表')}
            getEntryHref={getEntryHref}
          />
        )}
      </div>
    </div>
  )
}
