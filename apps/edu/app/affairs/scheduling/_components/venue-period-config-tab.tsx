'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus, FileEdit, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
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
import { TableRowActions } from '@/components/shared/table-row-actions'
import { termApi, venueApi, periodSlotApi } from '@/lib/api'
import type { AffairsTerm, Venue, PeriodSlot } from '@/lib/types'

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
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [weeksCount, setWeeksCount] = useState('16')
  const [isCurrent, setIsCurrent] = useState(false)

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
    setStartDate('')
    setEndDate('')
    setWeeksCount('16')
    setIsCurrent(false)
    setDialogOpen(true)
  }

  const openEdit = (t: AffairsTerm) => {
    setEditing(t)
    setName(t.name)
    setStartDate(t.startDate)
    setEndDate(t.endDate)
    setWeeksCount(String(t.weeksCount))
    setIsCurrent(t.isCurrent)
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!name || !startDate || !endDate) return
    setSaving(true)
    try {
      const payload = { name, startDate, endDate, weeksCount: Number(weeksCount) || 16, isCurrent }
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
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel>开始日期 *</FieldLabel>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel>结束日期 *</FieldLabel>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </Field>
            </div>
            <Field>
              <FieldLabel>周数</FieldLabel>
              <Input
                type="number"
                min={1}
                value={weeksCount}
                onChange={(e) => setWeeksCount(e.target.value)}
              />
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
            <Button onClick={handleSave} disabled={!name || !startDate || !endDate || saving}>
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

function PeriodSlotsSection() {
  const { toast } = useToast()
  const [items, setItems] = useState<PeriodSlot[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<PeriodSlot | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<PeriodSlot | null>(null)
  const [saving, setSaving] = useState(false)

  const [name, setName] = useState('')
  const [sortOrder, setSortOrder] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')

  const loadItems = useCallback(async () => {
    try {
      const res = await periodSlotApi.list({ limit: 100 })
      setItems(res.items)
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

  const openCreate = () => {
    setEditing(null)
    setName('')
    setSortOrder(String((items[items.length - 1]?.sortOrder || 0) + 1))
    setStartTime('')
    setEndTime('')
    setDialogOpen(true)
  }

  const openEdit = (s: PeriodSlot) => {
    setEditing(s)
    setName(s.name)
    setSortOrder(String(s.sortOrder))
    setStartTime(s.startTime ? s.startTime.slice(0, 5) : '')
    setEndTime(s.endTime ? s.endTime.slice(0, 5) : '')
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!name) return
    setSaving(true)
    try {
      const payload = {
        name,
        sortOrder: Number(sortOrder) || 0,
        startTime: startTime || undefined,
        endTime: endTime || undefined,
      }
      if (editing) {
        await periodSlotApi.update(editing.id, payload)
      } else {
        await periodSlotApi.create(payload)
      }
      toast({ title: editing ? '节次已更新' : '节次已创建' })
      setDialogOpen(false)
      await loadItems()
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

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await periodSlotApi.delete(deleteTarget.id)
      toast({ title: '节次已删除' })
      setDeleteTarget(null)
      await loadItems()
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: '删除失败',
        description: err.message || '删除节次失败',
      })
    }
  }

  return (
    <section className="rounded-lg border bg-white px-4 py-3">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">节次管理</h3>
          <p className="text-xs text-muted-foreground">
            节次作为课表网格的行，排课与导入均按节次名称匹配
          </p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-1 size-4" />
          新建节次
        </Button>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[180px]">名称</TableHead>
              <TableHead className="w-[120px]">开始时间</TableHead>
              <TableHead className="w-[120px]">结束时间</TableHead>
              <TableHead className="w-[80px]">排序</TableHead>
              <TableHead className="sticky right-0 w-[140px] bg-white text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-20 text-center text-muted-foreground">
                  加载中...
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-20 text-center text-muted-foreground">
                  暂无节次，点击「新建节次」创建
                </TableCell>
              </TableRow>
            ) : (
              items.map((s) => (
                <TableRow key={s.id} className="group">
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>
                    <span className="text-sm">{s.startTime ? s.startTime.slice(0, 5) : '-'}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{s.endTime ? s.endTime.slice(0, 5) : '-'}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{s.sortOrder}</span>
                  </TableCell>
                  <TableRowActions className="sticky right-0 bg-white">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => openEdit(s)}
                    >
                      <FileEdit className="mr-1 h-3 w-3" />
                      编辑
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(s)}
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
            <DialogTitle>{editing ? '编辑节次' : '新建节次'}</DialogTitle>
            <DialogDescription>
              节次名称需与排课/导入时填写的名称一致（如 上午1-2）
            </DialogDescription>
          </DialogHeader>
          <FieldGroup className="py-4">
            <Field>
              <FieldLabel>节次名称 *</FieldLabel>
              <Input
                placeholder="如 上午1-2"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <div className="grid grid-cols-3 gap-4">
              <Field>
                <FieldLabel>开始时间</FieldLabel>
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel>结束时间</FieldLabel>
                <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              </Field>
              <Field>
                <FieldLabel>排序</FieldLabel>
                <Input
                  type="number"
                  min={0}
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                />
              </Field>
            </div>
          </FieldGroup>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={!name || saving}>
              {saving ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="删除节次"
        description={`确定删除节次「${deleteTarget?.name || ''}」吗？`}
        variant="destructive"
        confirmText="删除"
        onConfirm={handleDelete}
      />
    </section>
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
