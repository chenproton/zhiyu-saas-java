'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus, FileEdit, Trash2, Lightbulb } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { useToast } from '@zhiyu/ui'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { DateRangePicker } from '@/components/shared/date-range-picker'
import { TableRowActions } from '@/components/shared/table-row-actions'
import { termApi, venueApi, periodSlotApi } from '@/lib/api'
import type { DateRange } from 'react-day-picker'
import type { AffairsTerm, Venue, PeriodSlot } from '@/lib/types'

const DAY_MS = 24 * 60 * 60 * 1000

function parseYMD(s: string): Date | undefined {
  const [y, m, d] = s.split('-').map(Number)
  if (!y || !m || !d) return undefined
  return new Date(y, m - 1, d)
}

function formatYMD(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function calcWeeks(from: Date, to: Date): number {
  const days = Math.round((to.getTime() - from.getTime()) / DAY_MS) + 1
  return Math.max(1, Math.ceil(days / 7))
}

const VENUE_TYPES = ['教室', '机房', '实训室', '实验室', '校外基地']

// ==================== 学期管理 ====================

function TermsSection({ onTermsChanged }: { onTermsChanged?: () => void }) {
  const { toast } = useToast()
  const [items, setItems] = useState<AffairsTerm[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<AffairsTerm | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AffairsTerm | null>(null)
  const [saving, setSaving] = useState(false)

  // 表单
  const [name, setName] = useState('')
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined)
  const [isCurrent, setIsCurrent] = useState(false)

  const weeksCount =
    dateRange?.from && dateRange?.to ? calcWeeks(dateRange.from, dateRange.to) : 0

  const loadItems = useCallback(async () => {
    try {
      const res = await termApi.list({ limit: 100 })
      setItems(res.items)
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: '加载失败',
        description: err.message || '查询学期列表失败',
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    // 首屏加载：async IIFE 包裹，避免在 effect 体内同步触发 setState
    ;(async () => {
      await loadItems()
    })()
  }, [loadItems])

  const openCreate = () => {
    setEditing(null)
    setName('')
    setDateRange(undefined)
    setIsCurrent(false)
    setDialogOpen(true)
  }

  const openEdit = (t: AffairsTerm) => {
    setEditing(t)
    setName(t.name)
    setDateRange({ from: parseYMD(t.startDate), to: parseYMD(t.endDate) })
    setIsCurrent(t.isCurrent)
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!name || !dateRange?.from || !dateRange?.to) return
    setSaving(true)
    try {
      const startDate = formatYMD(dateRange.from)
      const endDate = formatYMD(dateRange.to)
      const payload = { name, startDate, endDate, weeksCount: weeksCount || 16, isCurrent }
      if (editing) {
        await termApi.update(editing.id, payload)
      } else {
        await termApi.create(payload)
      }
      toast({ title: editing ? '学期已更新' : '学期已创建' })
      setDialogOpen(false)
      await loadItems()
      onTermsChanged?.()
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: '保存失败',
        description: err.message || '保存学期失败',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await termApi.delete(deleteTarget.id)
      toast({ title: '学期已删除' })
      setDeleteTarget(null)
      await loadItems()
      onTermsChanged?.()
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: '删除失败',
        description: err.message || '删除学期失败',
      })
    }
  }

  return (
    <section className="rounded-lg border bg-white px-4 py-3">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">学期管理</h3>
          <p className="text-xs text-muted-foreground">
            教学计划与排课均依赖学期，请先维护学期信息
          </p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-1 size-4" />
          新建学期
        </Button>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">名称</TableHead>
              <TableHead className="w-[120px]">开始日期</TableHead>
              <TableHead className="w-[120px]">结束日期</TableHead>
              <TableHead className="w-[80px]">周数</TableHead>
              <TableHead className="w-[100px]">当前学期</TableHead>
              <TableHead className="sticky right-0 w-[140px] bg-white text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-20 text-center text-muted-foreground">
                  加载中...
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-20 text-center text-muted-foreground">
                  暂无学期，点击「新建学期」创建
                </TableCell>
              </TableRow>
            ) : (
              items.map((t) => (
                <TableRow key={t.id} className="group">
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell>
                    <span className="text-sm">{t.startDate}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{t.endDate}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{t.weeksCount}</span>
                  </TableCell>
                  <TableCell>
                    {t.isCurrent ? (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                        当前学期
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableRowActions className="sticky right-0 bg-white">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => openEdit(t)}
                    >
                      <FileEdit className="mr-1 h-3 w-3" />
                      编辑
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(t)}
                    >
                      <Trash2 className="mr-1 h-3 w-3" />
                      删除
                    </Button>
                  </TableRowActions>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? '编辑学期' : '新建学期'}</DialogTitle>
            <DialogDescription>设为当前学期后，其他学期将自动取消当前标记</DialogDescription>
          </DialogHeader>
          <FieldGroup className="py-4">
            <Field>
              <FieldLabel>学期名称 *</FieldLabel>
              <Input
                placeholder="如 2025-2026-1"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel>起止日期 *</FieldLabel>
              <DateRangePicker value={dateRange} onChange={setDateRange} />
            </Field>
            <Field>
              <FieldLabel>周数</FieldLabel>
              <Input value={weeksCount ? String(weeksCount) : ''} disabled placeholder="选择起止日期后自动计算" />
              <p className="text-xs text-muted-foreground">根据起止日期自动计算，不可修改</p>
            </Field>
            <Field>
              <div className="flex items-center justify-between">
                <FieldLabel>设为当前学期</FieldLabel>
                <Switch checked={isCurrent} onCheckedChange={setIsCurrent} />
              </div>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              取消
            </Button>
            <Button
              onClick={handleSave}
              disabled={!name || !dateRange?.from || !dateRange?.to || saving}
            >
              {saving ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="删除学期"
        description={`确定删除学期「${deleteTarget?.name || ''}」吗？已被教学计划或排课引用的学期无法删除。`}
        variant="destructive"
        confirmText="删除"
        onConfirm={handleDelete}
      />
    </section>
  )
}

// ==================== 场地管理 ====================

function VenuesSection() {
  const { toast } = useToast()
  const [items, setItems] = useState<Venue[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Venue | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Venue | null>(null)
  const [saving, setSaving] = useState(false)

  const [name, setName] = useState('')
  const [type, setType] = useState('')
  const [capacity, setCapacity] = useState('')

  const loadItems = useCallback(async () => {
    try {
      const res = await venueApi.list({ limit: 500 })
      setItems(res.items)
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: '加载失败',
        description: err.message || '查询场地列表失败',
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    ;(async () => {
      await loadItems()
    })()
  }, [loadItems])

  const openCreate = () => {
    setEditing(null)
    setName('')
    setType('')
    setCapacity('')
    setDialogOpen(true)
  }

  const openEdit = (v: Venue) => {
    setEditing(v)
    setName(v.name)
    setType(v.type)
    setCapacity(v.capacity != null ? String(v.capacity) : '')
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!name || !type) return
    setSaving(true)
    try {
      const payload = { name, type, capacity: capacity ? Number(capacity) : undefined }
      if (editing) {
        await venueApi.update(editing.id, payload)
      } else {
        await venueApi.create(payload)
      }
      toast({ title: editing ? '场地已更新' : '场地已创建' })
      setDialogOpen(false)
      await loadItems()
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: '保存失败',
        description: err.message || '保存场地失败',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await venueApi.delete(deleteTarget.id)
      toast({ title: '场地已删除' })
      setDeleteTarget(null)
      await loadItems()
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: '删除失败',
        description: err.message || '删除场地失败',
      })
    }
  }

  return (
    <section className="rounded-lg border bg-white px-4 py-3">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">场地管理</h3>
          <p className="text-xs text-muted-foreground">
            排课时可选择场地，删除被引用的场地会被拒绝
          </p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-1 size-4" />
          新建场地
        </Button>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[220px]">名称</TableHead>
              <TableHead className="w-[120px]">类型</TableHead>
              <TableHead className="w-[100px]">容量</TableHead>
              <TableHead className="sticky right-0 w-[140px] bg-white text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="h-20 text-center text-muted-foreground">
                  加载中...
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-20 text-center text-muted-foreground">
                  暂无场地，点击「新建场地」创建
                </TableCell>
              </TableRow>
            ) : (
              items.map((v) => (
                <TableRow key={v.id} className="group">
                  <TableCell className="font-medium">{v.name}</TableCell>
                  <TableCell>
                    <span className="text-sm">{v.type}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{v.capacity != null ? `${v.capacity} 人` : '-'}</span>
                  </TableCell>
                  <TableRowActions className="sticky right-0 bg-white">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => openEdit(v)}
                    >
                      <FileEdit className="mr-1 h-3 w-3" />
                      编辑
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(v)}
                    >
                      <Trash2 className="mr-1 h-3 w-3" />
                      删除
                    </Button>
                  </TableRowActions>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? '编辑场地' : '新建场地'}</DialogTitle>
            <DialogDescription>场地类型用于教学计划条目的场地类型匹配</DialogDescription>
          </DialogHeader>
          <FieldGroup className="py-4">
            <Field>
              <FieldLabel>场地名称 *</FieldLabel>
              <Input
                placeholder="如 A栋-301"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel>场地类型 *</FieldLabel>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue placeholder="请选择场地类型" />
                </SelectTrigger>
                <SelectContent>
                  {VENUE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>容量（人）</FieldLabel>
              <Input
                type="number"
                min={0}
                placeholder="选填"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={!name || !type || saving}>
              {saving ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="删除场地"
        description={`确定删除场地「${deleteTarget?.name || ''}」吗？已被排课引用的场地无法删除。`}
        variant="destructive"
        confirmText="删除"
        onConfirm={handleDelete}
      />
    </section>
  )
}

// ==================== 节次管理 ====================

const DAY_LABELS = ['星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日']

const PERIOD_TYPE_META: Record<string, { label: string; bg: string; text: string; border: string; dot: string }> = {
  morning_self: { label: '早自习', bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200', dot: 'bg-sky-400' },
  morning: { label: '上午', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-400' },
  afternoon: { label: '下午', bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', dot: 'bg-green-400' },
  evening: { label: '晚自习', bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', dot: 'bg-indigo-400' },
}

const PERIOD_TYPES = ['morning_self', 'morning', 'afternoon', 'evening']

function periodTypeOf(t?: string): string {
  return PERIOD_TYPES.includes(t || '') ? (t as string) : 'morning'
}

function parseTime(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function formatTime(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** 预览行（工作副本，保存时才落库） */
interface PeriodRow {
  name: string
  type: string
  startTime: string
  endTime: string
}

interface PeriodSettings {
  morningSelfCount: number
  morningClassCount: number
  afternoonClassCount: number
  eveningClassCount: number
  morningSelfDuration: number
  morningSelfBreak: number
  morningClassDuration: number
  morningBreakDuration: number
  afternoonClassDuration: number
  afternoonBreakDuration: number
  eveningDuration: number
  eveningBreak: number
}

const defaultSettings: PeriodSettings = {
  morningSelfCount: 1,
  morningClassCount: 4,
  afternoonClassCount: 4,
  eveningClassCount: 1,
  morningSelfDuration: 20,
  morningSelfBreak: 10,
  morningClassDuration: 45,
  morningBreakDuration: 10,
  afternoonClassDuration: 45,
  afternoonBreakDuration: 10,
  eveningDuration: 45,
  eveningBreak: 10,
}

// 各时段起始时刻（与排课页课表网格的时段约定一致）
const GROUP_START: Record<string, string> = {
  morning_self: '07:30',
  morning: '08:00',
  afternoon: '14:00',
  evening: '18:30',
}

// 参数化生成全部节次：按时段顺序排列，sortOrder 即数组下标
function generateRows(settings: PeriodSettings): PeriodRow[] {
  const rows: PeriodRow[] = []
  const add = (type: string, name: string, start: number, end: number) => {
    rows.push({ name, type, startTime: formatTime(start), endTime: formatTime(end) })
  }
  const group = (
    type: string,
    count: number,
    duration: number,
    breakMins: number,
    label: (i: number) => string,
  ) => {
    if (count <= 0) return
    let current = parseTime(GROUP_START[type] || '08:00')
    for (let i = 0; i < count; i++) {
      add(type, label(i + 1), current, current + duration)
      current += duration
      if (i < count - 1) current += breakMins
    }
  }

  group('morning_self', settings.morningSelfCount, settings.morningSelfDuration, settings.morningSelfBreak, (i) => `早自习 ${i}`)
  group('morning', settings.morningClassCount, settings.morningClassDuration, settings.morningBreakDuration, (i) => `上午 ${i}`)
  group('afternoon', settings.afternoonClassCount, settings.afternoonClassDuration, settings.afternoonBreakDuration, (i) => `下午 ${i}`)
  group('evening', settings.eveningClassCount, settings.eveningDuration, settings.eveningBreak, (i) => `晚自习 ${i}`)
  return rows
}

function slotToRow(s: PeriodSlot): PeriodRow {
  return {
    name: s.name,
    type: periodTypeOf(s.type),
    startTime: s.startTime ? s.startTime.slice(0, 5) : '',
    endTime: s.endTime ? s.endTime.slice(0, 5) : '',
  }
}

function durationOf(row: PeriodRow): number | null {
  if (!row.startTime || !row.endTime) return null
  return parseTime(row.endTime) - parseTime(row.startTime)
}

// 从已有节次反推设置参数（时长取各组首条，课间无法反推用默认值）
function deriveSettings(items: PeriodSlot[]): PeriodSettings {
  const s = { ...defaultSettings }
  const counts: Record<string, number> = { morning_self: 0, morning: 0, afternoon: 0, evening: 0 }
  const first: Record<string, PeriodRow> = {}
  for (const it of [...items].sort((a, b) => a.sortOrder - b.sortOrder)) {
    const t = periodTypeOf(it.type)
    counts[t]++
    if (!first[t]) first[t] = slotToRow(it)
  }
  s.morningSelfCount = counts.morning_self
  s.morningClassCount = counts.morning
  s.afternoonClassCount = counts.afternoon
  s.eveningClassCount = counts.evening
  const groups: [keyof PeriodSettings, string][] = [
    ['morningSelfDuration', 'morning_self'],
    ['morningClassDuration', 'morning'],
    ['afternoonClassDuration', 'afternoon'],
    ['eveningDuration', 'evening'],
  ]
  for (const [durKey, type] of groups) {
    if (counts[type] > 0) {
      const dur = first[type] ? durationOf(first[type]) : null
      if (dur && dur > 0) s[durKey] = dur
    }
  }
  return s
}

function PeriodSlotsSection() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<PeriodRow[]>([])
  const [settings, setSettings] = useState<PeriodSettings>(defaultSettings)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showHelp, setShowHelp] = useState(false)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [form, setForm] = useState<PeriodRow>({ name: '', type: 'morning', startTime: '', endTime: '' })

  const loadItems = useCallback(async () => {
    try {
      const res = await periodSlotApi.list({ limit: 100 })
      setRows(res.items.map(slotToRow))
      setSettings(deriveSettings(res.items))
      setDirty(false)
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: '加载失败',
        description: err.message || '查询节次列表失败',
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    ;(async () => {
      await loadItems()
    })()
  }, [loadItems])

  const updateSetting = <K extends keyof PeriodSettings>(key: K, value: PeriodSettings[K]) => {
    const next = { ...settings, [key]: value }
    setSettings(next)
    setRows(generateRows(next))
    setDirty(true)
  }

  const handleReset = () => {
    setSettings(defaultSettings)
    setRows(generateRows(defaultSettings))
    setDirty(true)
  }

  const openEdit = (idx: number) => {
    setEditingIndex(idx)
    setForm({ ...rows[idx] })
    setDialogOpen(true)
  }

  const handleFormSave = () => {
    if (!form.name.trim() || editingIndex == null) return
    setRows((prev) => prev.map((r, i) => (i === editingIndex ? { ...form, name: form.name.trim() } : r)))
    setDialogOpen(false)
    setDirty(true)
  }

  const handleDeleteRow = (idx: number) => {
    setRows((prev) => prev.filter((_, i) => i !== idx))
    setDirty(true)
  }

  const handleSave = async () => {
    if (rows.length === 0) {
      toast({ variant: 'destructive', title: '保存失败', description: '至少保留一个节次' })
      return
    }
    const names = rows.map((r) => r.name.trim())
    if (new Set(names).size !== names.length) {
      toast({ variant: 'destructive', title: '保存失败', description: '节次名称不能重复' })
      return
    }
    setSaving(true)
    try {
      const payload = rows.map((r, i) => ({
        name: r.name.trim(),
        type: r.type,
        sortOrder: i,
        startTime: r.startTime || undefined,
        endTime: r.endTime || undefined,
      }))
      const res = await periodSlotApi.replace(payload)
      setRows(res.items.map(slotToRow))
      setDirty(false)
      toast({ title: '节次配置已保存' })
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: '保存失败',
        description: err.message || '保存节次失败',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="rounded-lg border bg-white px-4 py-3">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">节次管理</h3>
          <p className="text-xs text-muted-foreground">
            节次作为课表网格的行，排课与导入均按节次名称匹配；右侧配置参数自动生成，预览确认后保存
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        {/* 左侧：周课表预览网格 */}
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1 text-xs"
              onClick={() => setShowHelp(true)}
            >
              <Lightbulb className="h-3.5 w-3.5" />
              使用说明
            </Button>
            <div className="flex flex-wrap items-center gap-3">
              {PERIOD_TYPES.map((key) => (
                <div key={key} className="flex items-center gap-1.5">
                  <span className={cn('h-2.5 w-2.5 rounded-full', PERIOD_TYPE_META[key].dot)} />
                  <span className="text-xs text-muted-foreground">{PERIOD_TYPE_META[key].label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[860px] border-collapse">
              <thead>
                <tr>
                  <th className="w-[150px] border bg-muted/40 px-1 py-2 text-xs font-medium text-muted-foreground">
                    节次
                  </th>
                  {DAY_LABELS.map((d) => (
                    <th
                      key={d}
                      className="w-[120px] border bg-muted/40 px-1 py-2 text-center text-xs font-medium text-muted-foreground"
                    >
                      {d}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="h-24 border text-center text-sm text-muted-foreground">
                      加载中...
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="h-24 border text-center text-sm text-muted-foreground">
                      暂无节次，在右侧配置各时段参数自动生成
                    </td>
                  </tr>
                ) : (
                  rows.map((row, idx) => {
                    const meta = PERIOD_TYPE_META[row.type] || PERIOD_TYPE_META.morning
                    return (
                      <tr key={idx}>
                        <td className="border px-2 py-1.5 align-top">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-medium">{row.name}</span>
                            <div className="flex items-center gap-0.5">
                              <button
                                type="button"
                                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                                onClick={() => openEdit(idx)}
                                title="编辑"
                              >
                                <FileEdit className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                                onClick={() => handleDeleteRow(idx)}
                                title="删除"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                          <span className="mt-1 inline-block rounded bg-muted/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            第 {idx + 1} 行
                          </span>
                        </td>
                        {DAY_LABELS.map((d) => (
                          <td key={d} className="border p-1.5">
                            <div
                              className={cn(
                                'flex flex-col items-center gap-1 rounded-md border px-2 py-2.5',
                                meta.bg,
                                meta.border
                              )}
                            >
                              <span className={cn('text-[10px] font-medium', meta.text)}>{meta.label}</span>
                              <span className="font-mono text-[10px] text-muted-foreground">
                                {row.startTime
                                  ? `${row.startTime}-${row.endTime || '--:--'}`
                                  : '未设置时间'}
                              </span>
                            </div>
                          </td>
                        ))}
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 右侧：参数设置面板 */}
        <div className="w-full shrink-0 space-y-4 rounded-lg border bg-muted/20 p-4 lg:w-[260px]">
          <div>
            <h4 className="mb-3 text-sm font-semibold text-gray-900">排课节次设置</h4>
            <div className="space-y-2">
              <NumberField
                label="早自习"
                value={settings.morningSelfCount}
                onChange={(v) => updateSetting('morningSelfCount', v)}
              />
              <NumberField
                label="上午"
                value={settings.morningClassCount}
                onChange={(v) => updateSetting('morningClassCount', v)}
              />
              <NumberField
                label="下午"
                value={settings.afternoonClassCount}
                onChange={(v) => updateSetting('afternoonClassCount', v)}
              />
              <NumberField
                label="晚自习"
                value={settings.eveningClassCount}
                onChange={(v) => updateSetting('eveningClassCount', v)}
              />
            </div>
          </div>

          <div className="h-px bg-border" />

          <div>
            <h4 className="mb-2 text-sm font-semibold text-gray-900">课程时间设置</h4>
            <div className="space-y-3">
              <div>
                <p className="mb-1 text-xs text-muted-foreground">早自习</p>
                <DurationRow
                  label="节次时长"
                  value={settings.morningSelfDuration}
                  onChange={(v) => updateSetting('morningSelfDuration', v)}
                />
                <DurationRow
                  label="课间时长"
                  value={settings.morningSelfBreak}
                  onChange={(v) => updateSetting('morningSelfBreak', v)}
                />
              </div>
              <div>
                <p className="mb-1 text-xs text-muted-foreground">上午</p>
                <DurationRow
                  label="节次时长"
                  value={settings.morningClassDuration}
                  onChange={(v) => updateSetting('morningClassDuration', v)}
                />
                <DurationRow
                  label="课间时长"
                  value={settings.morningBreakDuration}
                  onChange={(v) => updateSetting('morningBreakDuration', v)}
                />
              </div>
              <div>
                <p className="mb-1 text-xs text-muted-foreground">下午</p>
                <DurationRow
                  label="节次时长"
                  value={settings.afternoonClassDuration}
                  onChange={(v) => updateSetting('afternoonClassDuration', v)}
                />
                <DurationRow
                  label="课间时长"
                  value={settings.afternoonBreakDuration}
                  onChange={(v) => updateSetting('afternoonBreakDuration', v)}
                />
              </div>
              <div>
                <p className="mb-1 text-xs text-muted-foreground">晚自习</p>
                <DurationRow
                  label="节次时长"
                  value={settings.eveningDuration}
                  onChange={(v) => updateSetting('eveningDuration', v)}
                />
                <DurationRow
                  label="课间时长"
                  value={settings.eveningBreak}
                  onChange={(v) => updateSetting('eveningBreak', v)}
                />
              </div>
            </div>
          </div>

          <div className="h-px bg-border" />

          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              修改参数将重新生成全部节次；可对单行编辑/删除微调，点「保存配置」一次性落库
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={handleReset}>
                恢复默认
              </Button>
              <Button
                size="sm"
                className="flex-1"
                onClick={handleSave}
                disabled={saving || rows.length === 0 || !dirty}
              >
                {saving ? '保存中...' : '保存配置'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* 编辑节次弹窗 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑节次</DialogTitle>
            <DialogDescription>
              节次名称需与排课/导入时填写的名称一致（如 上午1-2）
            </DialogDescription>
          </DialogHeader>
          <FieldGroup className="py-4">
            <Field>
              <FieldLabel>节次名称 *</FieldLabel>
              <Input
                placeholder="如 上午1-2"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </Field>
            <Field>
              <FieldLabel>时段类型</FieldLabel>
              <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERIOD_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {PERIOD_TYPE_META[t].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field>
                <FieldLabel>开始时间</FieldLabel>
                <Input
                  type="time"
                  value={form.startTime}
                  onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                />
              </Field>
              <Field>
                <FieldLabel>结束时间</FieldLabel>
                <Input
                  type="time"
                  value={form.endTime}
                  onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
                />
              </Field>
            </div>
          </FieldGroup>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleFormSave} disabled={!form.name.trim()}>
              确定
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 使用说明 */}
      <Dialog open={showHelp} onOpenChange={setShowHelp}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>使用说明</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-sm text-muted-foreground">
            <p>1. 在右侧面板配置各时段的节次数量，左侧课表网格会自动生成并预览。</p>
            <p>2. 可设置各时段节次时长、课间时长，系统自动推算每个节次的起止时间。</p>
            <p>3. 生成后可对单个节次编辑名称/时间/类型或删除微调。</p>
            <p>4. 点击「保存配置」一次性落库；节次按名称被排课与 Excel 导入引用，改名需同步调整排课数据。</p>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowHelp(false)}>知道了</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-14 text-xs text-muted-foreground">{label}</span>
      <Input
        type="number"
        min={0}
        max={10}
        value={value}
        onChange={(e) => onChange(Math.max(0, Math.min(10, Number(e.target.value) || 0)))}
        className="h-8 w-16 text-center text-sm"
      />
    </div>
  )
}

function DurationRow({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1">
        <Input
          type="number"
          min={1}
          value={value}
          onChange={(e) => onChange(Math.max(1, Number(e.target.value) || 1))}
          className="h-8 w-16 text-center text-sm"
        />
        <span className="w-4 text-xs text-muted-foreground">分</span>
      </div>
    </div>
  )
}

/** Tab1 教务基础配置：学期 / 场地 / 节次 三组 CRUD */
export function VenuePeriodConfigTab({ onTermsChanged }: { onTermsChanged?: () => void }) {
  return (
    <div className="space-y-6">
      <TermsSection onTermsChanged={onTermsChanged} />
      <VenuesSection />
      <PeriodSlotsSection />
    </div>
  )
}
