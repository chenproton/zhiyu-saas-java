'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { useToast } from '@zhiyu/ui'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { scheduleApi, ScheduleConflictError } from '@/lib/api'
import type {
  AffairsTerm,
  PeriodSlot,
  ScheduleConflict,
  ScheduleEntry,
  ScheduleEntryPayload,
  TeachingPlanEntry,
  Venue,
} from '@/lib/types'

const DAY_OPTIONS = [
  { value: '1', label: '周一' },
  { value: '2', label: '周二' },
  { value: '3', label: '周三' },
  { value: '4', label: '周四' },
  { value: '5', label: '周五' },
  { value: '6', label: '周六' },
  { value: '7', label: '周日' },
]

const CONFLICT_KIND_LABELS: Record<string, string> = {
  teacher: '教师冲突',
  class: '班级冲突',
  venue: '场地冲突',
}

interface ScheduleFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  term: AffairsTerm
  /** 创建模式：来自待排课程区的教学计划条目 */
  planEntry: TeachingPlanEntry | null
  /** 编辑模式：网格中已排条目 */
  scheduleEntry: ScheduleEntry | null
  /** 当前网格视角的班级（创建时兜底） */
  classNodeId?: string
  venues: Venue[]
  periodSlots: PeriodSlot[]
  onSaved: () => void
  onDeleted: () => void
}

export function ScheduleFormDialog({
  open,
  onOpenChange,
  term,
  planEntry,
  scheduleEntry,
  classNodeId,
  venues,
  periodSlots,
  onSaved,
  onDeleted,
}: ScheduleFormDialogProps) {
  const { toast } = useToast()
  const editing = !!scheduleEntry

  const [courseName, setCourseName] = useState('')
  const [dayOfWeek, setDayOfWeek] = useState('1')
  const [periods, setPeriods] = useState<string[]>([])
  const [startWeek, setStartWeek] = useState('1')
  const [endWeek, setEndWeek] = useState('16')
  const [weekPattern, setWeekPattern] = useState('all')
  const [venueId, setVenueId] = useState('')
  const [conflicts, setConflicts] = useState<ScheduleConflict[]>([])
  const [saving, setSaving] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // 弹窗重新打开时在渲染期间回填表单（adjust-state-during-render 模式）
  const [prevOpen, setPrevOpen] = useState(false)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setConflicts([])
      if (scheduleEntry) {
        setCourseName(scheduleEntry.courseName)
        setDayOfWeek(String(scheduleEntry.dayOfWeek))
        setPeriods(scheduleEntry.periods || [])
        setStartWeek(String(scheduleEntry.startWeek))
        setEndWeek(String(scheduleEntry.endWeek))
        setWeekPattern(scheduleEntry.weekPattern || 'all')
        setVenueId(scheduleEntry.venueId || '')
      } else if (planEntry) {
        setCourseName(planEntry.courseName)
        setDayOfWeek('1')
        setPeriods([])
        setStartWeek(String(planEntry.startWeek || 1))
        setEndWeek(String(planEntry.endWeek || 16))
        setWeekPattern(planEntry.weekPattern || 'all')
        setVenueId('')
      }
    }
  }

  const togglePeriod = (name: string) => {
    setPeriods((prev) => (prev.includes(name) ? prev.filter((p) => p !== name) : [...prev, name]))
  }

  const handleSubmit = async () => {
    const start = Number(startWeek)
    const end = Number(endWeek)
    if (!courseName || periods.length === 0 || !start || !end || start > end) {
      toast({
        variant: 'destructive',
        title: '请完善表单',
        description: '课程名称、节次、起止周为必填，且起始周不能大于结束周',
      })
      return
    }
    setSaving(true)
    setConflicts([])
    try {
      const payload: ScheduleEntryPayload = {
        termId: term.id,
        planEntryId: scheduleEntry?.planEntryId || planEntry?.id || undefined,
        courseName,
        courseCode: scheduleEntry?.courseCode || planEntry?.courseCode || undefined,
        courseId: scheduleEntry?.courseId || planEntry?.courseId || undefined,
        type: scheduleEntry?.type || (planEntry?.type === 'scene' ? 'scene' : 'traditional'),
        classNodeId: scheduleEntry?.classNodeId || planEntry?.classNodeId || classNodeId || '',
        teacherId: scheduleEntry?.teacherId || planEntry?.teacherId || undefined,
        dayOfWeek: Number(dayOfWeek),
        periods,
        startWeek: start,
        endWeek: end,
        weekPattern,
        venueId: venueId || undefined,
        scenarioId: scheduleEntry?.scenarioId || planEntry?.scenarioId || undefined,
      }
      if (scheduleEntry) {
        await scheduleApi.update(scheduleEntry.id, payload)
        toast({ title: '排课已更新' })
      } else {
        await scheduleApi.create(payload)
        toast({ title: '排课成功' })
      }
      onOpenChange(false)
      onSaved()
    } catch (err: any) {
      if (err instanceof ScheduleConflictError) {
        setConflicts(err.conflicts)
      } else {
        toast({
          variant: 'destructive',
          title: '保存失败',
          description: err.message || '保存排课失败',
        })
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!scheduleEntry) return
    setDeleting(true)
    try {
      await scheduleApi.delete(scheduleEntry.id)
      toast({ title: '排课已删除' })
      setDeleteConfirmOpen(false)
      onOpenChange(false)
      onDeleted()
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: '删除失败',
        description: err.message || '删除排课失败',
      })
    } finally {
      setDeleting(false)
    }
  }

  const teacherName = scheduleEntry?.teacherName || planEntry?.teacherName
  const isScene = (scheduleEntry?.type || planEntry?.type) === 'scene'

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? '编辑排课' : '课程排课'}</DialogTitle>
            <DialogDescription>
              {term.name} · 选择星期、节次与周次，提交时自动校验教师/班级/场地冲突
            </DialogDescription>
          </DialogHeader>
          <FieldGroup className="py-2">
            <Field>
              <FieldLabel>课程名称 *</FieldLabel>
              <div className="flex items-center gap-2">
                <Input value={courseName} onChange={(e) => setCourseName(e.target.value)} />
                {isScene && (
                  <span className="shrink-0 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-600">
                    场景
                  </span>
                )}
              </div>
            </Field>
            {teacherName && (
              <Field>
                <FieldLabel>授课教师</FieldLabel>
                <Input value={teacherName} disabled />
              </Field>
            )}
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel>星期 *</FieldLabel>
                <Select value={dayOfWeek} onValueChange={setDayOfWeek}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAY_OPTIONS.map((d) => (
                      <SelectItem key={d.value} value={d.value}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>周次模式</FieldLabel>
                <Select value={weekPattern} onValueChange={setWeekPattern}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">每周</SelectItem>
                    <SelectItem value="odd">单周</SelectItem>
                    <SelectItem value="even">双周</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field>
              <FieldLabel>节次（可多选）*</FieldLabel>
              {periodSlots.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  暂无节次，请先在「教务基础配置」中创建
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2 rounded-md border p-3">
                  {[...periodSlots]
                    .sort((a, b) => a.sortOrder - b.sortOrder)
                    .map((s) => (
                      <label key={s.id} className="flex cursor-pointer items-center gap-2 text-sm">
                        <Checkbox
                          checked={periods.includes(s.name)}
                          onCheckedChange={() => togglePeriod(s.name)}
                        />
                        {s.name}
                      </label>
                    ))}
                </div>
              )}
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel>起始周 *</FieldLabel>
                <Input
                  type="number"
                  min={1}
                  value={startWeek}
                  onChange={(e) => setStartWeek(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel>结束周 *</FieldLabel>
                <Input
                  type="number"
                  min={1}
                  value={endWeek}
                  onChange={(e) => setEndWeek(e.target.value)}
                />
              </Field>
            </div>
            <Field>
              <FieldLabel>场地</FieldLabel>
              <Select
                value={venueId || 'none'}
                onValueChange={(v) => setVenueId(v === 'none' ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="请选择场地（选填）" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">不安排场地</SelectItem>
                  {venues.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name}（{v.type}）
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {conflicts.length > 0 && (
              <div className="space-y-1.5 rounded-md border border-red-200 bg-red-50 p-3">
                <div className="text-sm font-medium text-red-700">
                  排课冲突（{conflicts.length} 项），请调整后重试
                </div>
                {conflicts.map((c, idx) => (
                  <div
                    key={`${c.entryId}-${c.kind}-${idx}`}
                    className="text-xs leading-5 text-red-600"
                  >
                    <span className="font-medium">
                      【{CONFLICT_KIND_LABELS[c.kind] || '冲突'}】
                    </span>
                    与「{c.courseName}」{c.teacherName ? `（${c.teacherName}）` : ''}
                    {c.className ? ` ${c.className}` : ''}
                    {c.venueName ? ` @${c.venueName}` : ''}在
                    {DAY_OPTIONS[c.dayOfWeek - 1]?.label || `周${c.dayOfWeek}`}「
                    {c.periods.join('、')}」第{c.startWeek}-{c.endWeek}周时间重叠
                  </div>
                ))}
              </div>
            )}
          </FieldGroup>
          <DialogFooter className="gap-2 sm:justify-between">
            <div>
              {editing && (
                <Button
                  variant="destructive"
                  onClick={() => setDeleteConfirmOpen(true)}
                  disabled={saving || deleting}
                >
                  删除排课
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                取消
              </Button>
              <Button onClick={handleSubmit} disabled={saving || deleting}>
                {saving ? '提交中...' : editing ? '保存' : '确认排课'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="删除排课"
        description={`确定删除「${scheduleEntry?.courseName || ''}」的这条排课吗？来源教学计划条目将恢复为待排状态。`}
        variant="destructive"
        confirmText="删除"
        onConfirm={handleDelete}
      />
    </>
  )
}
