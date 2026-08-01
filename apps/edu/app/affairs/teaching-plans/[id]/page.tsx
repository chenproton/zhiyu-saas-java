'use client'

import { useState, useMemo, useEffect, useCallback, Fragment } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, CalendarRange, CheckCircle2, FileEdit, Save, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { useToast } from '@zhiyu/ui'
import { PageHeaderCard } from '@/components/shared/page-header-card'
import { StatusBadge } from '@/components/shared/status-badge'
import { UserSelector } from '@/components/shared/user-selector'
import { MultiOrgNodePicker } from '@/components/shared/multi-org-node-picker'
import { teachingPlanApi } from '@/lib/api'
import type { TeachingPlanDetail, TeachingPlanEntry } from '@/lib/types'
import { EntryTypeBadge } from './_components/entry-type-badge'
import { usePortalAuth } from '@/contexts/portal-auth-context'
import { formatDate, formatDateTime } from '@/lib/format-utils'

const VENUE_TYPES = ['教室', '机房', '实训室', '实验室', '校外基地']

interface EditState {
  startWeek: string
  endWeek: string
  credits: string
  totalHours: string
  venueType: string
  classNodeIds: string[]
  teacherId?: string
}

export default function TeachingPlanDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { toast } = useToast()
  const { tenantId } = usePortalAuth()
  const id = params.id

  const [plan, setPlan] = useState<TeachingPlanDetail | null>(null)
  const [entries, setEntries] = useState<TeachingPlanEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editMap, setEditMap] = useState<Record<string, EditState>>({})

  const loadPlan = useCallback(async () => {
    try {
      const detail = await teachingPlanApi.get(id)
      setPlan(detail)
      setEntries(detail.entries)
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: '加载失败',
        description: err.message || '查询教学计划失败',
      })
    } finally {
      setLoading(false)
    }
  }, [id, toast])

  useEffect(() => {
    ;(async () => {
      await loadPlan()
    })()
  }, [loadPlan])

  const groups = useMemo(() => {
    const map = new Map<number, TeachingPlanEntry[]>()
    for (const e of entries) {
      const list = map.get(e.startWeek) || []
      list.push(e)
      map.set(e.startWeek, list)
    }
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0])
  }, [entries])

  const startEdit = () => {
    const map: Record<string, EditState> = {}
    entries.forEach((e) => {
      map[e.id] = {
        startWeek: String(e.startWeek),
        endWeek: String(e.endWeek),
        credits: String(e.credits || 0),
        totalHours: String(e.totalHours || 0),
        venueType: e.venueType || '',
        classNodeIds: e.classNodeIds || (e.classNodeId ? [e.classNodeId] : []),
        teacherId: e.teacherId || undefined,
      }
    })
    setEditMap(map)
    setIsEditing(true)
  }

  const cancelEdit = () => {
    setIsEditing(false)
    setEditMap({})
  }

  const updateEditField = (entryId: string, patch: Partial<EditState>) => {
    setEditMap((prev) => ({ ...prev, [entryId]: { ...prev[entryId], ...patch } }))
  }

  const updateTeacherId = async (entryId: string, tid: string) => {
    try {
      const updated = await teachingPlanApi.updateEntry(entryId, { teacherId: tid })
      setEntries((prev) => prev.map((e) => (e.id === updated.id ? updated : e)))
    } catch {
      /* ignore */
    }
  }

  const handleSaveAll = async () => {
    setSaving(true)
    const toSave = entries.filter((e) => editMap[e.id])
    let success = 0
    for (const e of toSave) {
      const s = editMap[e.id]
      try {
        const updated = await teachingPlanApi.updateEntry(e.id, {
          startWeek: Number(s.startWeek) || 1,
          endWeek: Number(s.endWeek) || 1,
          credits: s.credits !== '' ? Number(s.credits) : undefined,
          totalHours: s.totalHours !== '' ? Number(s.totalHours) : undefined,
          venueType: s.venueType,
          classNodeIds: s.classNodeIds,
        })
        setEntries((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))
        success++
      } catch {
        /* skip failed, already saved ones stay */
      }
    }
    setIsEditing(false)
    setEditMap({})
    setSaving(false)
    toast({ title: `保存完成：${success}/${toSave.length} 项` })
  }

  const handleConfirm = async () => {
    try {
      await teachingPlanApi.confirm(id)
      toast({ title: '教学计划已确认' })
      await loadPlan()
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: '确认失败',
        description: err.message || '确认教学计划失败',
      })
    }
  }

  return (
    <div className="space-y-6">
      <PageHeaderCard
        title={plan?.programName || '教学计划详情'}
        description={
          plan
            ? `${plan.termName || '-'} · ${plan.majorName || '-'} · ${plan.entryYear} 级 · 生成于 ${formatDateTime(plan.generatedAt)}`
            : '教学计划条目与授课安排'
        }
        actions={
          <div className="flex items-center gap-2">
            {plan && <StatusBadge status={plan.status} />}
            {plan?.status === 'draft' && !isEditing && (
              <>
                <Button variant="outline" onClick={startEdit}>
                  <FileEdit className="mr-2 size-4" />
                  编辑
                </Button>
                <Button variant="outline" onClick={handleConfirm}>
                  <CheckCircle2 className="mr-2 size-4" />
                  确认计划
                </Button>
              </>
            )}
            {isEditing && (
              <>
                <Button variant="outline" onClick={cancelEdit} disabled={saving}>
                  <X className="mr-2 size-4" />
                  取消
                </Button>
                <Button onClick={handleSaveAll} disabled={saving}>
                  <Save className="mr-2 size-4" />
                  {saving ? '保存中...' : '保存'}
                </Button>
              </>
            )}
            <Button variant="outline" onClick={() => router.push('/affairs/teaching-plans')}>
              <ArrowLeft className="mr-2 size-4" />
              返回列表
            </Button>
          </div>
        }
      />

      <div className="rounded-lg border bg-white px-4 py-3">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">课程</TableHead>
                <TableHead className="w-[70px]">类型</TableHead>
                <TableHead className="w-[70px]">学分</TableHead>
                <TableHead className="w-[80px]">总学时</TableHead>
                <TableHead className="w-[130px]">起止周</TableHead>
                <TableHead className="w-[110px]">班级</TableHead>
                <TableHead className="w-[130px]">教师</TableHead>
                <TableHead className="w-[110px]">场地类型</TableHead>
                <TableHead className="w-[70px]">状态</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                    加载中...
                  </TableCell>
                </TableRow>
              ) : groups.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                    暂无教学条目
                  </TableCell>
                </TableRow>
              ) : (
                groups.map(([startWeek, groupEntries]) => (
                  <Fragment key={`group-${startWeek}`}>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableCell
                        colSpan={9}
                        className="py-1.5 text-xs font-medium text-muted-foreground"
                      >
                        第 {startWeek} 周起（{groupEntries.length} 门）
                      </TableCell>
                    </TableRow>
                    {groupEntries.map((e) => {
                      const es = editMap[e.id]
                      const editing = isEditing && !!es
                      return (
                        <TableRow key={e.id} className="group">
                          <TableCell>
                            <div className="font-medium">{e.courseName}</div>
                            {e.courseCode && (
                              <div className="text-xs text-muted-foreground">{e.courseCode}</div>
                            )}
                            {e.type === 'scene' && e.positionName && (
                              <div className="text-xs text-orange-600">{e.positionName}</div>
                            )}
                          </TableCell>
                          <TableCell>
                            <EntryTypeBadge type={e.type} />
                          </TableCell>
                          <TableCell>
                            {editing ? (
                              <Input
                                className="h-8 w-[60px]"
                                type="number"
                                min={0}
                                step="0.5"
                                value={es.credits}
                                onChange={(ev) =>
                                  updateEditField(e.id, { credits: ev.target.value })
                                }
                              />
                            ) : (
                              <span className="text-sm">{e.credits}</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {editing ? (
                              <Input
                                className="h-8 w-[60px]"
                                type="number"
                                min={0}
                                value={es.totalHours}
                                onChange={(ev) =>
                                  updateEditField(e.id, { totalHours: ev.target.value })
                                }
                              />
                            ) : (
                              <span className="text-sm">{e.totalHours}</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {editing ? (
                              <div className="flex items-center gap-1">
                                <Input
                                  className="h-8 w-[50px]"
                                  type="number"
                                  min={1}
                                  value={es.startWeek}
                                  onChange={(ev) =>
                                    updateEditField(e.id, { startWeek: ev.target.value })
                                  }
                                />
                                <span className="text-xs text-muted-foreground">-</span>
                                <Input
                                  className="h-8 w-[50px]"
                                  type="number"
                                  min={1}
                                  value={es.endWeek}
                                  onChange={(ev) =>
                                    updateEditField(e.id, { endWeek: ev.target.value })
                                  }
                                />
                              </div>
                            ) : (
                              <span className="text-sm">
                                {e.startWeek}-{e.endWeek}周
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            {editing ? (
                              <MultiOrgNodePicker
                                tenantId={tenantId}
                                value={es.classNodeIds}
                                onChange={(v) => updateEditField(e.id, { classNodeIds: v })}
                                selectableTypes={['班级']}
                                placeholder="选择班级"
                                title="选择授课班级"
                                maxVisible={2}
                              />
                            ) : (
                              <span className="text-sm">
                                {(e.classNames || []).length > 0
                                  ? (e.classNames || []).slice(0, 2).join('、') +
                                    ((e.classNames || []).length > 2
                                      ? ` 等${(e.classNames || []).length}个`
                                      : '')
                                  : e.className || '-'}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="w-[130px]">
                            {editing ? (
                              <UserSelector
                                value={es.teacherId ? [es.teacherId] : []}
                                onChange={(ids) => {
                                  const tid = ids[0] || ''
                                  updateEditField(e.id, { teacherId: tid })
                                  updateTeacherId(e.id, tid)
                                }}
                                multiple={false}
                                placeholder={e.teacherName || '选择教师'}
                              />
                            ) : (
                              <span className="text-sm">{e.teacherName || '-'}</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {editing ? (
                              <Select
                                value={es.venueType || 'none'}
                                onValueChange={(v) =>
                                  updateEditField(e.id, { venueType: v === 'none' ? '' : v })
                                }
                              >
                                <SelectTrigger className="h-8">
                                  <SelectValue placeholder="选择" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">未设置</SelectItem>
                                  {VENUE_TYPES.map((t) => (
                                    <SelectItem key={t} value={t}>
                                      {t}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <span className="text-sm">{e.venueType || '-'}</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={e.status} />
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </Fragment>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={() => router.push(`/affairs/scheduling?planId=${id}`)}>
          <CalendarRange className="mr-2 size-4" />
          前往排课
        </Button>
      </div>
    </div>
  )
}
