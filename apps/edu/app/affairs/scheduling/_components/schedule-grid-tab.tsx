'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Clock3, CheckCircle2, X, MapPin, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { useToast, EmptyState, FormDialogFooter } from '@zhiyu/ui'
import { ScheduleGrid } from '@/components/shared/schedule-grid'
import { MultiOrgNodePicker } from '@/components/shared/multi-org-node-picker'
import { UserSelector } from '@/components/shared/user-selector'
import { usePortalAuth } from '@/contexts/portal-auth-context'
import { periodSlotApi, scheduleApi, venueApi } from '@/lib/api'
import type { PeriodSlot, ScheduleEntry, TeachingPlan, TeachingPlanEntry, Venue } from '@/lib/types'
import { cn } from '@/lib/utils'
import { ScheduleEditDialog } from './schedule-edit-dialog'
import { ScheduleImportBar } from './schedule-import-bar'
import { reportError } from '@/lib/error-handling'
import { useT } from '@/lib/i18n/locale-provider'

interface ScheduleGridTabProps {
  plan: TeachingPlan
  planEntries: TeachingPlanEntry[]
  onPlanChanged: () => void
}

export function ScheduleGridTab({ plan, planEntries, onPlanChanged }: ScheduleGridTabProps) {
  const { toast } = useToast()
  const t = useT()
  const { tenantId } = usePortalAuth()
  const [scheduleEntries, setScheduleEntries] = useState<ScheduleEntry[]>([])
  const [gridLoading, setGridLoading] = useState(false)
  const [periodSlots, setPeriodSlots] = useState<PeriodSlot[]>([])
  const [venues, setVenues] = useState<Venue[]>([])
  const [editOpen, setEditOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<ScheduleEntry | null>(null)
  const [selectedPendingId, setSelectedPendingId] = useState<string | null>(null)
  const [venueFilter, setVenueFilter] = useState<string>('__all')
  const [movingEntry, setMovingEntry] = useState<ScheduleEntry | null>(null)
  const [preConfigEntry, setPreConfigEntry] = useState<TeachingPlanEntry | null>(null)
  const [preConfigDay, setPreConfigDay] = useState(0)
  const [preConfigPeriod, setPreConfigPeriod] = useState('')
  const [preClassIds, setPreClassIds] = useState<string[]>([])
  const [preTeacherId, setPreTeacherId] = useState('')
  const [preVenueId, setPreVenueId] = useState('')
  const [preConfigSaving, setPreConfigSaving] = useState(false)

  const pendingEntries = useMemo(
    () => planEntries.filter((e) => e.status === 'planned'),
    [planEntries],
  )
  const scheduledCount = useMemo(
    () => planEntries.filter((e) => e.status === 'scheduled').length,
    [planEntries],
  )
  const selectedEntry = useMemo(
    () => pendingEntries.find((e) => e.id === selectedPendingId) || null,
    [pendingEntries, selectedPendingId],
  )
  const filteredEntries = useMemo(() => {
    if (venueFilter === '__all') return scheduleEntries
    return scheduleEntries.filter((e) => e.venueId === venueFilter)
  }, [scheduleEntries, venueFilter])

  const loadScheduleEntries = useCallback(async () => {
    if (!plan.termId) {
      setScheduleEntries([])
      return
    }
    setGridLoading(true)
    try {
      // TODO: 场地筛选在前端进行，超过 200 条时筛选结果不完整，需改为服务端筛选/分页
      // 网格为草稿编辑区，只展示草稿（已发布是发布时的快照，在课表视图中查看）
      setScheduleEntries((await scheduleApi.list({ termId: plan.termId, status: 'draft', limit: 200 })).items)
    } catch (err) {
      reportError(err, '加载排课数据')
    } finally {
      setGridLoading(false)
    }
  }, [plan.termId])

  const loadBaseData = useCallback(async () => {
    try {
      const [s, v] = await Promise.all([
        periodSlotApi.list({ limit: 100 }),
        venueApi.list({ limit: 200 }),
      ])
      setPeriodSlots(s.items)
      setVenues(v.items)
    } catch (err) {
      reportError(err, '加载节次与场地')
    }
  }, [])

  useEffect(() => {
    ;(async () => {
      await loadBaseData()
    })()
  }, [loadBaseData])
  useEffect(() => {
    ;(async () => {
      await loadScheduleEntries()
    })()
  }, [loadScheduleEntries])

  const reloadAll = useCallback(async () => {
    await loadScheduleEntries()
    onPlanChanged()
  }, [loadScheduleEntries, onPlanChanged])

  const doCreateSchedule = async (
    entry: TeachingPlanEntry,
    day: number,
    period: string,
    classIds: string[],
    teacherId: string,
    venueId: string,
  ) => {
    try {
      await scheduleApi.create({
        termId: plan.termId,
        planEntryId: entry.id,
        courseName: entry.courseName,
        courseCode: entry.courseCode || undefined,
        courseId: entry.courseId || undefined,
        type: entry.type || 'traditional',
        classNodeId: classIds[0] || '',
        classNodeIds: classIds,
        teacherId: teacherId || undefined,
        dayOfWeek: day,
        periods: [period],
        startWeek: entry.startWeek || 1,
        endWeek: entry.endWeek || 1,
        weekPattern: entry.weekPattern || 'all',
        venueId: venueId || undefined,
        scenarioId: entry.scenarioId || undefined,
      })
      return { created: 1, lastErr: '' }
    } catch (err: any) {
      return { created: 0, lastErr: err.message || '' }
    }
  }

  const handleCellClick = useCallback(
    async (dayOfWeek: number, periodKey: string) => {
      if (movingEntry) {
        try {
          await scheduleApi.update(movingEntry.id, {
            termId: movingEntry.termId,
            planEntryId: movingEntry.planEntryId,
            courseName: movingEntry.courseName,
            courseCode: movingEntry.courseCode || undefined,
            courseId: movingEntry.courseId || undefined,
            type: movingEntry.type,
            classNodeId: movingEntry.classNodeId,
            // 多班级条目必须回传完整班级列表，否则后端回退仅主班级、其余班级丢失
            classNodeIds:
              movingEntry.classNodeIds || (movingEntry.classNodeId ? [movingEntry.classNodeId] : []),
            teacherId: movingEntry.teacherId || undefined,
            dayOfWeek,
            periods: [periodKey],
            startWeek: movingEntry.startWeek,
            endWeek: movingEntry.endWeek,
            weekPattern: movingEntry.weekPattern,
            venueId: movingEntry.venueId || undefined,
            scenarioId: movingEntry.scenarioId || undefined,
          })
          toast({ title: t('排课已调整') })
          setMovingEntry(null)
          reloadAll()
        } catch (err: any) {
          toast({ variant: 'destructive', title: t('调整失败'), description: err.message || '' })
        }
        return
      }
      if (!selectedEntry) return
      const classIds =
        selectedEntry.classNodeIds || (selectedEntry.classNodeId ? [selectedEntry.classNodeId] : [])
      // 场地必须在排课时指定（教学计划条目不含场地），因此始终要求弹窗配置班级/教师/场地
      // 若顶部场地筛选已切换到具体场地，则自动带入弹窗场地字段
      setPreConfigEntry(selectedEntry)
      setPreConfigDay(dayOfWeek)
      setPreConfigPeriod(periodKey)
      setPreClassIds(classIds)
      setPreTeacherId(selectedEntry.teacherId || '')
      setPreVenueId(venueFilter === '__all' ? '' : venueFilter)
    },
    [selectedEntry, movingEntry, reloadAll, toast, venueFilter, t],
  )

  const handlePreConfigSave = async () => {
    if (!preConfigEntry) return
    setPreConfigSaving(true)
    try {
      const { created, lastErr } = await doCreateSchedule(
        preConfigEntry,
        preConfigDay,
        preConfigPeriod,
        preClassIds,
        preTeacherId,
        preVenueId,
      )
      if (created > 0) {
        toast({
          title: t('排课成功'),
          description: t('{name} 已排入周{day} {period}', {
            name: preConfigEntry.courseName,
            day: preConfigDay,
            period: preConfigPeriod,
          }),
        })
        setSelectedPendingId(null)
        setPreConfigEntry(null)
        reloadAll()
      } else if (lastErr) {
        toast({ variant: 'destructive', title: t('排课失败'), description: lastErr })
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: t('排课失败'), description: err.message || '' })
    } finally {
      setPreConfigSaving(false)
    }
  }

  const handleReschedule = useCallback((entry: ScheduleEntry) => {
    setSelectedPendingId(null)
    setMovingEntry(entry)
  }, [])

  const handleEditClick = useCallback((entry: ScheduleEntry) => {
    setMovingEntry(null)
    setEditTarget(entry)
    setEditOpen(true)
  }, [])

  const handleEditSaved = () => {
    setEditOpen(false)
    reloadAll()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {t('已排 {s}/{t} 门 · 待排 {p} 门', {
              s: scheduledCount,
              t: planEntries.length,
              p: pendingEntries.length,
            })}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <ScheduleImportBar termId={plan.termId} onImported={reloadAll} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          variant={venueFilter === '__all' ? 'default' : 'outline'}
          size="sm"
          className="h-7 px-2.5 text-xs"
          onClick={() => setVenueFilter('__all')}
        >
          {t('全部')}
        </Button>
        {venues.map((v) => (
          <Button
            key={v.id}
            variant={venueFilter === v.id ? 'default' : 'outline'}
            size="sm"
            className="h-7 px-2.5 text-xs"
            onClick={() => setVenueFilter(v.id)}
          >
            <MapPin className="mr-1 h-3 w-3" />
            {v.name}
          </Button>
        ))}
      </div>

      {selectedEntry && (
        <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-700">
          <span className="font-medium">{t('已选中：{name}', { name: selectedEntry.courseName })}</span>
          <span>{t('→ 点击右侧空格排课')}</span>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-6 px-2 text-xs"
            onClick={() => setSelectedPendingId(null)}
          >
            <X className="mr-1 h-3 w-3" />
            {t('取消')}
          </Button>
        </div>
      )}

      {movingEntry && (
        <div className="flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-4 py-2 text-sm text-orange-700">
          <span className="font-medium">
            {t('正在重新排课：{name}', { name: movingEntry.courseName })}
          </span>
          <span>{t('→ 点击右侧空格切换时间')}</span>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-6 px-2 text-xs"
            onClick={() => setMovingEntry(null)}
          >
            <X className="mr-1 h-3 w-3" />
            {t('取消')}
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="w-full shrink-0 rounded-lg border bg-white lg:w-[300px]">
          <div className="border-b px-3 py-2.5">
            <h3 className="text-sm font-semibold text-gray-900">
              {t('待排课程 ({n})', { n: pendingEntries.length })}
            </h3>
            <p className="text-xs text-muted-foreground">{t('点击选中·再点空格排课')}</p>
          </div>
          <ScrollArea className="h-[500px]">
            <div className="space-y-1.5 p-2">
              {pendingEntries.length === 0 ? (
                <EmptyState
                  icon={<CheckCircle2 className="h-8 w-8 text-green-400" />}
                  title={t('全部排完')}
                  className="py-16"
                />
              ) : (
                pendingEntries.map((e) => {
                  const isSel = e.id === selectedPendingId
                  return (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => setSelectedPendingId(isSel ? null : e.id)}
                      className={cn(
                        'w-full rounded-md border p-2.5 text-left transition-all',
                        isSel
                          ? 'border-blue-400 bg-blue-50 ring-1 ring-blue-400'
                          : 'hover:border-blue-200 hover:bg-blue-50/30',
                      )}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-medium text-gray-900">
                          {e.courseName}
                        </span>
                        {e.type === 'scene' && (
                          <Badge
                            variant="outline"
                            className="h-4 px-1 text-[10px] border-orange-200 text-orange-600"
                          >
                            {t('场景')}
                          </Badge>
                        )}
                      </div>
                      <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock3 className="size-3" />
                          {t('第 {a}-{b} 周', { a: e.startWeek, b: e.endWeek })}
                        </div>
                        {e.teacherName && (
                          <div className="flex items-center gap-1">
                            <Users className="size-3" />
                            {e.teacherName}
                          </div>
                        )}
                        {(e.classNodeIds || []).length > 0 && (
                          <div className="flex items-center gap-1">
                            {t('{names}等{n}班', {
                              names: e.classNames?.slice(0, 2).join('、') || '',
                              n: (e.classNodeIds || []).length,
                            })}
                          </div>
                        )}
                      </div>
                      <div className="mt-1.5 text-xs font-medium text-blue-600">
                        {isSel ? t('已选中·点空格排课') : t('点击选中')}
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </ScrollArea>
        </div>

        <div className="min-w-0 flex-1 rounded-lg border bg-white p-3">
          <ScheduleGrid
            entries={filteredEntries}
            periodSlots={periodSlots}
            loading={gridLoading}
            alwaysShow
            emptyText={t('点击左侧课程后点此处空格')}
            onEntryClick={handleEditClick}
            onCellClick={selectedEntry || movingEntry ? handleCellClick : undefined}
            movingEntry={movingEntry}
          />
        </div>
      </div>

      <ScheduleEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        entry={editTarget}
        venues={venues}
        onSaved={handleEditSaved}
        onReschedule={handleReschedule}
      />

      <Dialog
        open={!!preConfigEntry}
        onOpenChange={(v) => {
          if (!v) setPreConfigEntry(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('完善排课信息')}</DialogTitle>
            <DialogDescription>
              {t('「{name}」排课前需配置完整：班级、教师、场地均为必填', {
                name: preConfigEntry?.courseName || '',
              })}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handlePreConfigSave()
            }}
            className="grid gap-4"
          >
            <div className="space-y-4 py-2">
              <div>
                <label className="text-sm font-medium mb-1 block">{t('授课班级 *')}</label>
                <MultiOrgNodePicker
                  tenantId={tenantId}
                  value={preClassIds}
                  onChange={setPreClassIds}
                  selectableTypes={['班级']}
                  title={t('选择授课班级')}
                  maxVisible={3}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">{t('授课教师 *')}</label>
                <UserSelector
                  value={preTeacherId ? [preTeacherId] : []}
                  onChange={(ids) => setPreTeacherId(ids[0] || '')}
                  multiple={false}
                  placeholder={t('选择教师')}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">{t('场地 *')}</label>
                <Select
                  value={preVenueId || 'none'}
                  onValueChange={(v) => setPreVenueId(v === 'none' ? '' : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('选择场地')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('请选择')}</SelectItem>
                    {venues.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name}（{v.type}）
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <FormDialogFooter
              onCancel={() => setPreConfigEntry(null)}
              confirmText={t('保存并排课')}
              loading={preConfigSaving}
              confirmDisabled={preClassIds.length === 0 || !preTeacherId || !preVenueId}
            />
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
