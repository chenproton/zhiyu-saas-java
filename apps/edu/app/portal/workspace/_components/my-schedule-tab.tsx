"use client"

import { useCallback, useEffect, useState } from "react"
import { CalendarX2 } from "lucide-react"
import { useToast } from "@zhiyu/ui"
import { ScheduleGrid } from "@/components/shared/schedule-grid"
import { myScheduleApi, periodSlotApi } from "@/lib/api"
import type { AffairsTerm, PeriodSlot, ScheduleEntry } from "@/lib/types"

interface MyScheduleTabProps {
  /** student：场景课跳场景学习；teacher：场景课跳场景测评 */
  role: "student" | "teacher"
}

/** 我的课表 Tab（学生/教师工作台共用，当前学期已发布课表） */
export function MyScheduleTab({ role }: MyScheduleTabProps) {
  const { toast } = useToast()
  const [term, setTerm] = useState<AffairsTerm | null>(null)
  const [entries, setEntries] = useState<ScheduleEntry[]>([])
  const [periodSlots, setPeriodSlots] = useState<PeriodSlot[]>([])
  const [loading, setLoading] = useState(true)
  const [noTerm, setNoTerm] = useState(false)

  const loadData = useCallback(async () => {
    try {
      const [scheduleRes, slotRes] = await Promise.all([
        myScheduleApi.get(),
        periodSlotApi.list({ limit: 100 }).catch(() => ({ items: [] as PeriodSlot[], total: 0 })),
      ])
      setTerm(scheduleRes.term)
      setEntries(scheduleRes.items)
      setPeriodSlots(slotRes.items)
    } catch (err: any) {
      // 后端 404：尚未配置学期，按空态处理；其余错误提示
      if (err.message && (err.message.includes("学期") || err.message.includes("404"))) {
        setNoTerm(true)
      } else {
        toast({ variant: "destructive", title: "加载失败", description: err.message || "查询我的课表失败" })
      }
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    // 首屏加载：async IIFE 包裹，避免在 effect 体内同步触发 setState
    ;(async () => {
      await loadData()
    })()
  }, [loadData])

  const getEntryHref = (entry: ScheduleEntry) => {
    if (entry.type !== "scene" || !entry.scenarioId) return undefined
    return role === "student" ? `/scene/landing/${entry.scenarioId}` : "/evaluation/scene-results"
  }

  const empty = !loading && (noTerm || entries.length === 0)

  return (
    <div className="space-y-3">
      {/* 学期信息 */}
      <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">
            {term ? `${term.name}课表` : "我的课表"}
          </h3>
          <p className="text-xs text-gray-500">
            {term
              ? `${term.startDate} 至 ${term.endDate} · 共 ${term.weeksCount} 周 · 仅显示已发布课表`
              : "仅显示当前学期已发布的课表"}
          </p>
        </div>
        {role === "student" ? (
          <span className="text-xs text-gray-400">带「场景」徽标的课程可点击进入场景学习</span>
        ) : (
          <span className="text-xs text-gray-400">带「场景」徽标的课程可点击进入场景测评</span>
        )}
      </div>

      {/* 课表网格 */}
      <div className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
        {empty ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-sm text-gray-400">
            <CalendarX2 className="h-10 w-10 text-gray-300" />
            {noTerm ? "学校尚未配置学期，课表发布后这里会展示你的课表" : "当前学期暂无已发布的课表，发布后即可查看"}
          </div>
        ) : (
          <ScheduleGrid
            entries={entries}
            periodSlots={periodSlots}
            loading={loading}
            emptyText="当前学期暂无已发布的课表"
            getEntryHref={getEntryHref}
          />
        )}
      </div>
    </div>
  )
}
