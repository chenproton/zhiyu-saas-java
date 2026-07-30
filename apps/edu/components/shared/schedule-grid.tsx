"use client"

import { useMemo } from "react"
import Link from "next/link"
import { MapPin, User } from "lucide-react"
import { cn } from "@/lib/utils"
import type { PeriodSlot, ScheduleEntry } from "@/lib/types"

const DAY_LABELS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]

const WEEK_PATTERN_SUFFIX: Record<string, string> = {
  all: "",
  odd: "（单周）",
  even: "（双周）",
}

/** 按周次过滤：startWeek <= week <= endWeek 且周次模式匹配 */
export function filterEntriesByWeek(entries: ScheduleEntry[], week?: number): ScheduleEntry[] {
  if (!week) return entries
  return entries.filter((e) => {
    if (e.startWeek > week || e.endWeek < week) return false
    if (e.weekPattern === "odd") return week % 2 === 1
    if (e.weekPattern === "even") return week % 2 === 0
    return true
  })
}

interface ScheduleGridProps {
  entries: ScheduleEntry[]
  /** 节次行（按 sortOrder 排序）；缺省时从 entries 的 periods 推导 */
  periodSlots?: PeriodSlot[]
  /** 选中周次过滤（缺省显示全部周次的并集） */
  week?: number
  loading?: boolean
  emptyText?: string
  /** 点击单元格卡片（排课页编辑场景） */
  onEntryClick?: (entry: ScheduleEntry) => void
  /** 场景课跳转链接（工作台场景）；返回 undefined 表示不可跳转 */
  getEntryHref?: (entry: ScheduleEntry) => string | undefined
}

interface GridRow {
  key: string
  label: string
  time?: string
}

/** 周课表网格（7 列星期 × 节次行），排课页与学生/教师工作台共用 */
export function ScheduleGrid({
  entries,
  periodSlots,
  week,
  loading,
  emptyText = "暂无课表数据",
  onEntryClick,
  getEntryHref,
}: ScheduleGridProps) {
  const visibleEntries = useMemo(() => filterEntriesByWeek(entries, week), [entries, week])

  const rows = useMemo<GridRow[]>(() => {
    if (periodSlots && periodSlots.length > 0) {
      return [...periodSlots]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((s) => ({
          key: s.name,
          label: s.name,
          time: s.startTime ? `${s.startTime.slice(0, 5)}${s.endTime ? `-${s.endTime.slice(0, 5)}` : ""}` : undefined,
        }))
    }
    const names = new Set<string>()
    for (const e of visibleEntries) {
      for (const p of e.periods || []) names.add(p)
    }
    return Array.from(names)
      .sort((a, b) => a.localeCompare(b, "zh-CN", { numeric: true }))
      .map((name) => ({ key: name, label: name }))
  }, [periodSlots, visibleEntries])

  const cellMap = useMemo(() => {
    const map = new Map<string, ScheduleEntry[]>()
    for (const e of visibleEntries) {
      for (const p of e.periods || []) {
        const key = `${e.dayOfWeek}:${p}`
        const list = map.get(key) || []
        list.push(e)
        map.set(key, list)
      }
    }
    return map
  }, [visibleEntries])

  const renderCard = (entry: ScheduleEntry) => {
    const isScene = entry.type === "scene"
    const href = getEntryHref?.(entry)
    const clickable = !!href || !!onEntryClick
    const card = (
      <div
        className={cn(
          "w-full rounded-md border p-1.5 text-left text-xs leading-4",
          isScene ? "border-orange-200 bg-orange-50" : "border-blue-200 bg-blue-50",
          clickable && "cursor-pointer transition-shadow hover:shadow-md"
        )}
      >
        <div className="flex items-center gap-1">
          <span className="truncate font-medium text-gray-900">{entry.courseName}</span>
          {isScene && (
            <span className="shrink-0 rounded-full bg-orange-100 px-1.5 py-px text-[10px] font-medium text-orange-600">
              场景
            </span>
          )}
        </div>
        {entry.teacherName && (
          <div className="mt-0.5 flex items-center gap-0.5 text-muted-foreground">
            <User className="h-3 w-3 shrink-0" />
            <span className="truncate">{entry.teacherName}</span>
          </div>
        )}
        {entry.venueName && (
          <div className="flex items-center gap-0.5 text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{entry.venueName}</span>
          </div>
        )}
        <div className="mt-0.5 text-muted-foreground">
          第{entry.startWeek}-{entry.endWeek}周{WEEK_PATTERN_SUFFIX[entry.weekPattern] || ""}
        </div>
      </div>
    )
    if (href) {
      return (
        <Link key={entry.id} href={href} className="block">
          {card}
        </Link>
      )
    }
    if (onEntryClick) {
      return (
        <button key={entry.id} type="button" className="block w-full" onClick={() => onEntryClick(entry)}>
          {card}
        </button>
      )
    }
    return <div key={entry.id}>{card}</div>
  }

  if (loading) {
    return <div className="py-16 text-center text-sm text-muted-foreground">加载中...</div>
  }

  if (rows.length === 0 || visibleEntries.length === 0) {
    return <div className="py-16 text-center text-sm text-muted-foreground">{emptyText}</div>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[840px] border-collapse">
        <thead>
          <tr>
            <th className="w-[110px] border bg-muted/40 px-2 py-2 text-xs font-medium text-muted-foreground">节次</th>
            {DAY_LABELS.map((d) => (
              <th key={d} className="border bg-muted/40 px-2 py-2 text-xs font-medium text-muted-foreground">
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <td className="border bg-muted/20 px-2 py-1.5 align-top">
                <div className="text-xs font-medium text-gray-700">{row.label}</div>
                {row.time && <div className="text-[10px] text-muted-foreground">{row.time}</div>}
              </td>
              {DAY_LABELS.map((_, dayIdx) => {
                const dayEntries = cellMap.get(`${dayIdx + 1}:${row.key}`) || []
                return (
                  <td key={dayIdx} className="border px-1 py-1 align-top">
                    <div className="space-y-1">{dayEntries.map(renderCard)}</div>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
