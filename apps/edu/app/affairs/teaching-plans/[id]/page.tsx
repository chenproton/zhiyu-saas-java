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
import { useToast, TableEmptyRow } from '@zhiyu/ui'
import { PageHeaderCard } from '@/components/shared/page-header-card'
import { StatusBadge } from '@/components/shared/status-badge'
import { UserSelector } from '@/components/shared/user-selector'
import { MultiOrgNodePicker } from '@/components/shared/multi-org-node-picker'
import { teachingPlanApi, approvalApi, affairsBatchApi } from '@/lib/api'
import type { TeachingPlanDetail, TeachingPlanEntry } from '@/lib/types'
import { EntryTypeBadge } from './_components/entry-type-badge'
import { usePortalAuth } from '@/contexts/portal-auth-context'
import { formatDateTime } from '@/lib/format-utils'
import { useT } from '@/lib/i18n/locale-provider'

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
  const t = useT()
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
        title: t('加载失败'),
        description: err.message || t('查询教学计划失败'),
      })
    } finally {
      setLoading(false)
    }
  }, [id, toast, t])

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

  const updateTeacherId = (entryId: string, tid: string) => {
    // 仅更新编辑态，由「保存修改」统一提交（含失败重试路径，取消时自然回滚）
    updateEditField(entryId, { teacherId: tid || undefined })
  }

  const handleSaveAll = async () => {
    setSaving(true)
    const toSave = entries.filter((e) => editMap[e.id])
    // 并行保存全部条目并汇总成败，避免条目多时串行往返线性放大
    const results = await Promise.allSettled(
      toSave.map((e) => {
        const s = editMap[e.id]
        return teachingPlanApi.updateEntry(e.id, {
          startWeek: Number(s.startWeek) || 1,
          endWeek: Number(s.endWeek) || 1,
          credits: s.credits !== '' ? Number(s.credits) : undefined,
          totalHours: s.totalHours !== '' ? Number(s.totalHours) : undefined,
          venueType: s.venueType,
          classNodeIds: s.classNodeIds,
          teacherId: s.teacherId ?? '',
        })
      }),
    )
    let success = 0
    const failedIds: string[] = []
    const updatedById = new Map<string, TeachingPlanEntry>()
    toSave.forEach((e, i) => {
      const r = results[i]
      if (r.status === 'fulfilled') {
        success++
        updatedById.set(e.id, r.value)
      } else {
        failedIds.push(e.id)
      }
    })
    setEntries((prev) => prev.map((x) => (updatedById.has(x.id) ? updatedById.get(x.id)! : x)))
    if (failedIds.length > 0) {
      // 保留失败条目的编辑态供重试，并明确提示失败项
      const next = { ...editMap }
      for (const e of toSave) {
        if (failedIds.includes(e.id)) continue
        delete next[e.id]
      }
      setEditMap(next)
      toast({
        variant: 'destructive',
        title: t('保存完成：{done}/{total} 项', { done: success, total: toSave.length }),
        description: t('以下条目保存失败，请重试：{ids}', {
          ids: failedIds.map((fid) => entries.find((x) => x.id === fid)?.courseName || fid).join('、'),
        }),
      })
    } else {
      setIsEditing(false)
      setEditMap({})
      toast({ title: t('保存完成：{done}/{total} 项', { done: success, total: toSave.length }) })
    }
    setSaving(false)
  }

  const handleSubmitApproval = async () => {
    if (!plan) return
    try {
      if (!plan.batchId) {
        toast({
          variant: 'destructive',
          title: t('提示'),
          description: t('该教学计划未关联批次分组，请在列表页绑定批次后提交审批'),
        })
        return
      }
      const batch = await affairsBatchApi.get(plan.batchId)
      await teachingPlanApi.submit(plan.id)
      await approvalApi.create({
        targetType: 'teaching_plan',
        targetId: plan.id,
        workflowId: batch.workflowId,
      })
      toast({ title: t('已提交审批') })
      await loadPlan()
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: t('提交失败'),
        description: err.message || t('提交审批失败，请稍后重试'),
      })
    }
  }

  const handleWithdrawApproval = async () => {
    try {
      await teachingPlanApi.withdraw(id)
      toast({ title: t('已撤回审批') })
      await loadPlan()
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: t('撤回失败'),
        description: err.message || t('撤回审批失败，请稍后重试'),
      })
    }
  }

  const handlePublish = async () => {
    try {
      await teachingPlanApi.publish(id)
      toast({ title: t('教学计划已发布') })
      await loadPlan()
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: t('发布失败'),
        description: err.message || t('发布教学计划失败'),
      })
    }
  }

  return (
    <div className="space-y-6">
      <PageHeaderCard
        title={plan?.programName || t('教学计划详情')}
        description={
          plan
            ? t('{term} · {major} · {n}级 · 生成于 {time}', {
                term: plan.termName || '-',
                major: plan.majorName || '-',
                n: plan.entryYear,
                time: formatDateTime(plan.generatedAt),
              })
            : t('教学计划条目与授课安排')
        }
        actions={
          <div className="flex items-center gap-2">
            {plan && <StatusBadge status={plan.status} />}
            {plan && ['draft', 'rejected'].includes(plan.status) && !isEditing && (
              <>
                <Button variant="outline" onClick={startEdit}>
                  <FileEdit className="mr-2 size-4" />
                  {t('编辑')}
                </Button>
                <Button variant="outline" onClick={handleSubmitApproval}>
                  <CheckCircle2 className="mr-2 size-4" />
                  {t('提交审批')}
                </Button>
              </>
            )}
            {plan?.status === 'pending' && !isEditing && (
              <Button variant="outline" onClick={handleWithdrawApproval}>
                <X className="mr-2 size-4" />
                {t('撤回审批')}
              </Button>
            )}
            {plan?.status === 'approved' && !isEditing && (
              <Button variant="outline" onClick={handlePublish}>
                <CheckCircle2 className="mr-2 size-4" />
                {t('发布')}
              </Button>
            )}
            {isEditing && (
              <>
                <Button variant="outline" onClick={cancelEdit} disabled={saving}>
                  <X className="mr-2 size-4" />
                  {t('取消')}
                </Button>
                <Button onClick={handleSaveAll} disabled={saving}>
                  <Save className="mr-2 size-4" />
                  {saving ? t('保存中...') : t('保存')}
                </Button>
              </>
            )}
            <Button variant="outline" onClick={() => router.push('/affairs/teaching-plans')}>
              <ArrowLeft className="mr-2 size-4" />
              {t('返回列表')}
            </Button>
          </div>
        }
      />

      <div className="rounded-lg border bg-white px-4 py-3">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">{t('课程')}</TableHead>
                <TableHead className="w-[70px]">{t('类型')}</TableHead>
                <TableHead className="w-[70px]">{t('学分')}</TableHead>
                <TableHead className="w-[80px]">{t('总学时')}</TableHead>
                <TableHead className="w-[130px]">{t('起止周')}</TableHead>
                <TableHead className="w-[110px]">{t('班级')}</TableHead>
                <TableHead className="w-[130px]">{t('教师')}</TableHead>
                <TableHead className="w-[110px]">{t('场地类型')}</TableHead>
                <TableHead className="w-[70px]">{t('状态')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                    {t('加载中...')}
                  </TableCell>
                </TableRow>
              ) : groups.length === 0 ? (
                <TableEmptyRow colSpan={9}>{t('暂无教学条目')}</TableEmptyRow>
              ) : (
                groups.map(([startWeek, groupEntries]) => (
                  <Fragment key={`group-${startWeek}`}>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableCell
                        colSpan={9}
                        className="py-1.5 text-xs font-medium text-muted-foreground"
                      >
                        {t('第 {n} 周起（{m} 门）', { n: startWeek, m: groupEntries.length })}
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
                                {t('{n}-{m}周', { n: e.startWeek, m: e.endWeek })}
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
                                title={t('选择授课班级')}
                                maxVisible={2}
                              />
                            ) : (
                              <span className="text-sm">
                                {(e.classNames || []).length > 0
                                  ? (e.classNames || []).slice(0, 2).join('、') +
                                    ((e.classNames || []).length > 2
                                      ? t(' 等{n}个', { n: (e.classNames || []).length })
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
                                  updateTeacherId(e.id, tid)
                                }}
                                multiple={false}
                                placeholder={e.teacherName || t('选择教师')}
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
                                  <SelectValue placeholder={t('选择')} />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">{t('未设置')}</SelectItem>
                                  {VENUE_TYPES.map((v) => (
                                    <SelectItem key={v} value={v}>
                                      {t(v)}
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
          {t('前往排课')}
        </Button>
      </div>
    </div>
  )
}
