'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { MapPin, User, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n/locale-provider'
import type { PeriodSlot, ScheduleEntry } from '@/lib/types'

/** 按周次过滤：startWeek <= week <= endWeek 且周次模式匹配 */
function filterEntriesByWeek(entries: ScheduleEntry[], week?: number): ScheduleEntry[] {
  if (!week) return entries
  return entries.filter((e) => {
    if (e.startWeek > week || e.endWeek < week) return false
    if (e.weekPattern === 'odd') return week % 2 === 1
    if (e.weekPattern === 'even') return week % 2 === 0
    return true
  })
}

interface ScheduleGridProps {
  entries: ScheduleEntry[]
  periodSlots?: PeriodSlot[]
  week?: number
  loading?: boolean
  emptyText?: string
  onEntryClick?: (entry: ScheduleEntry) => void
  getEntryHref?: (entry: ScheduleEntry) => string | undefined
  onCellClick?: (dayOfWeek: number, periodSlotKey: string) => void
  /** 即使无条目也渲染空表格（排课页始终显示网格） */
  alwaysShow?: boolean
  /** 拖拽/快速切换：将条目移动到新格子 */
  onEntryMove?: (entry: ScheduleEntry, dayOfWeek: number, periodSlotKey: string) => void
  /** 点击已排课程卡片主体进入移动模式（与 onEntryClick 的编辑按钮共存） */
  onEntryMoveStart?: (entry: ScheduleEntry) => void
  /** 当前正在调整位置的目标条目（高亮显示） */
  movingEntry?: ScheduleEntry | null
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
  emptyText = '暂无课表数据',
  onEntryClick,
  getEntryHref,
  onCellClick,
  alwaysShow,
  onEntryMove,
  onEntryMoveStart,
  movingEntry,
}: ScheduleGridProps) {
  const t = useT()
  const dayLabels = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'].map((d) => t(d))
  const weekPatternSuffix: Record<string, string> = {
    all: '',
    odd: t('（单周）'),
    even: t('（双周）'),
  }
  const visibleEntries = useMemo(() => filterEntriesByWeek(entries, week), [entries, week])

  const rows = useMemo<GridRow[]>(() => {
    if (periodSlots && periodSlots.length > 0) {
      return [...periodSlots]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((s) => ({
          key: s.name,
          label: s.name,
          time: s.startTime
            ? `${s.startTime.slice(0, 5)}${s.endTime ? `-${s.endTime.slice(0, 5)}` : ''}`
            : undefined,
        }))
    }
    const names = new Set<string>()
    for (const e of visibleEntries) {
      for (const p of e.periods || []) names.add(p)
    }
    return Array.from(names)
      .sort((a, b) => a.localeCompare(b, 'zh-CN', { numeric: true }))
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
    const isScene = entry.type === 'scene'
    const href = getEntryHref?.(entry)
    const canEdit = !!onEntryClick
    const canMoveStart = !!onEntryMoveStart
    const draggable = !!onEntryMove
    const isMoving = movingEntry?.id === entry.id
    const card = (
      <div
        draggable={draggable}
        onDragStart={(e) => {
          e.dataTransfer.setData('scheduleEntryId', entry.id)
          e.dataTransfer.effectAllowed = 'move'
        }}
        onClick={(e) => {
          e.stopPropagation()
          if (canMoveStart) {
            onEntryMoveStart(entry)
          } else {
            onEntryClick?.(entry)
          }
        }}
        className={cn(
          'w-full rounded-md border p-1 text-left text-[11px] leading-tight select-none max-w-[130px]',
          isScene ? 'border-orange-200 bg-orange-50' : 'border-blue-200 bg-blue-50',
          (canEdit || canMoveStart) && 'cursor-pointer transition-shadow hover:shadow-md',
          draggable && 'cursor-move',
          isMoving && 'ring-2 ring-blue-500 shadow-md',
        )}
      >
        <div className="flex items-center gap-1">
          <span className="truncate font-medium text-gray-900">{entry.courseName}</span>
          {isScene && (
            <span className="shrink-0 rounded-full bg-orange-100 px-1.5 py-px text-[10px] font-medium text-orange-600">
              {t('场景')}
            </span>
          )}
          {canEdit && canMoveStart && (
            <button
              type="button"
              title={t('编辑排课')}
              onClick={(e) => {
                e.stopPropagation()
                onEntryClick?.(entry)
              }}
              className="ml-auto shrink-0 rounded p-0.5 text-muted-foreground hover:bg-black/5 hover:text-foreground"
            >
              <Pencil className="h-3 w-3" />
            </button>
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
          {t('第{startWeek}-{endWeek}周{suffix}', {
            startWeek: entry.startWeek,
            endWeek: entry.endWeek,
            suffix: weekPatternSuffix[entry.weekPattern] || '',
          })}
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
        <button
          key={entry.id}
          type="button"
          className="block w-full"
          onClick={() => onEntryClick(entry)}
        >
          {card}
        </button>
      )
    }
    return <div key={entry.id}>{card}</div>
  }

  if (loading) {
    return <div className="py-16 text-center text-sm text-muted-foreground">{t('加载中...')}</div>
  }

  const hasData = rows.length > 0
  if (!hasData && !alwaysShow) {
    return <div className="py-16 text-center text-sm text-muted-foreground">{t(emptyText)}</div>
  }

  // 始终渲染时用节次数据兜底，fallback 为空数组
  const displayRows = hasData
    ? rows
    : periodSlots && periodSlots.length > 0
      ? [...periodSlots]
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((s) => ({ key: s.name, label: s.name }) as GridRow)
      : [{ key: '__empty', label: t('暂无节次') } as GridRow]

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[840px] border-collapse">
        <thead>
          <tr>
            <th className="w-[80px] border bg-muted/40 px-1 py-2 text-xs font-medium text-muted-foreground">
              {t('节次')}
            </th>
            {dayLabels.map((d) => (
              <th
                key={d}
                className="w-[130px] border bg-muted/40 px-1 py-2 text-xs font-medium text-muted-foreground"
              >
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {displayRows.map((row) => (
            <tr key={row.key}>
              <td className="border bg-muted/20 px-2 py-1.5 align-top">
                <div className="text-xs font-medium text-gray-700">{row.label}</div>
                {row.time && <div className="text-[10px] text-muted-foreground">{row.time}</div>}
              </td>
              {dayLabels.map((_, dayIdx) => {
                const dayEntries = cellMap.get(`${dayIdx + 1}:${row.key}`) || []
                const canDrop = !!onEntryMove && dayEntries.length === 0
                return (
                  <td
                    key={dayIdx}
                    className={cn(
                      'border px-1 py-1 align-top',
                      (onCellClick || canDrop) &&
                        'cursor-pointer hover:bg-blue-50/40 transition-colors',
                      canDrop && 'hover:bg-blue-50/60',
                    )}
                    onClick={() => {
                      if (movingEntry && onEntryMove && dayEntries.length === 0) {
                        onEntryMove(movingEntry, dayIdx + 1, row.key)
                      } else if (onCellClick && dayEntries.length === 0) {
                        onCellClick(dayIdx + 1, row.key)
                      }
                    }}
                    onDragOver={(e) => {
                      if (canDrop) {
                        e.preventDefault()
                        e.dataTransfer.dropEffect = 'move'
                      }
                    }}
                    onDrop={(e) => {
                      if (!canDrop || !onEntryMove) return
                      e.preventDefault()
                      const entryId = e.dataTransfer.getData('scheduleEntryId')
                      const entry = visibleEntries.find((en) => en.id === entryId)
                      if (entry) onEntryMove(entry, dayIdx + 1, row.key)
                    }}
                  >
                    <div className="space-y-1 min-h-[2rem]">{dayEntries.map(renderCard)}</div>
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
