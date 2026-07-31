"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { FileUp, Clock3, CalendarDays, CheckCircle2, X, MapPin, Users, Download, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@zhiyu/ui"
import { ScheduleGrid } from "@/components/shared/schedule-grid"
import { OrgNodePicker } from "@/components/shared/org-node-picker"
import { usePortalAuth } from "@/contexts/portal-auth-context"
import { periodSlotApi, scheduleApi, teachingPlanApi, venueApi } from "@/lib/api"
import type { PeriodSlot, ScheduleEntry, TeachingPlan, TeachingPlanEntry, Venue } from "@/lib/types"
import { cn } from "@/lib/utils"
import { ScheduleFormDialog } from "./schedule-form-dialog"
import { ScheduleImportDialog } from "./schedule-import-dialog"

interface ScheduleGridTabProps {
  plan: TeachingPlan
  planEntries: TeachingPlanEntry[]
  onPlanChanged: () => void
}

export function ScheduleGridTab({ plan, planEntries, onPlanChanged }: ScheduleGridTabProps) {
  const { toast } = useToast()
  const { tenantId } = usePortalAuth()

  const [scheduleEntries, setScheduleEntries] = useState<ScheduleEntry[]>([])
  const [gridLoading, setGridLoading] = useState(false)
  const [periodSlots, setPeriodSlots] = useState<PeriodSlot[]>([])
  const [venues, setVenues] = useState<Venue[]>([])

  const [formOpen, setFormOpen] = useState(false)
  const [activePlanEntry, setActivePlanEntry] = useState<TeachingPlanEntry | null>(null)
  const [activeScheduleEntry, setActiveScheduleEntry] = useState<ScheduleEntry | null>(null)
  const [importOpen, setImportOpen] = useState(false)

  const [selectedPendingId, setSelectedPendingId] = useState<string | null>(null)

  const [savingQuick, setSavingQuick] = useState(false)

  const [venueFilter, setVenueFilter] = useState<string>("__all")

  const [movingEntry, setMovingEntry] = useState<ScheduleEntry | null>(null)

  const [missingClassEntry, setMissingClassEntry] = useState<TeachingPlanEntry | null>(null)
  const [pendingClassNodeId, setPendingClassNodeId] = useState<string | undefined>(undefined)
  const [savingClass, setSavingClass] = useState(false)

  const pendingEntries = useMemo(() => planEntries.filter((e) => e.status === "planned"), [planEntries])
  const scheduledCount = useMemo(() => planEntries.filter((e) => e.status === "scheduled").length, [planEntries])

  const filteredEntries = useMemo(() => {
    if (venueFilter === "__all") return scheduleEntries
    if (venueFilter === "__none") return scheduleEntries.filter((e) => !e.venueId)
    return scheduleEntries.filter((e) => e.venueId === venueFilter)
  }, [scheduleEntries, venueFilter])

  const periodSlotNames = useMemo(() => [...periodSlots].sort((a, b) => a.sortOrder - b.sortOrder).map((s) => s.name), [periodSlots])
  const selectedEntry = useMemo(() => pendingEntries.find((e) => e.id === selectedPendingId) || null, [pendingEntries, selectedPendingId])

  const venueEntryCounts = useMemo(() => {
    const counts: Record<string, number> = { __all: scheduleEntries.length, __none: 0 }
    venues.forEach((v) => { counts[v.id] = 0 })
    let none = 0
    scheduleEntries.forEach((e) => {
      if (e.venueId) { counts[e.venueId] = (counts[e.venueId] || 0) + 1 }
      else { none++ }
    })
    counts.__none = none
    return counts
  }, [scheduleEntries, venues])

  const loadScheduleEntries = useCallback(async () => {
    if (!plan.termId) { setScheduleEntries([]); return }
    setGridLoading(true)
    try {
      const res = await scheduleApi.list({ termId: plan.termId, limit: 500 })
      setScheduleEntries(res.items)
    } catch (err: any) {
      toast({ variant: "destructive", title: "加载失败", description: err.message || "查询排课失败" })
    } finally { setGridLoading(false) }
  }, [plan.termId, toast])

  const loadBaseData = useCallback(async () => {
    try {
      const [slotRes, venueRes] = await Promise.all([periodSlotApi.list({ limit: 100 }), venueApi.list({ limit: 500 })])
      setPeriodSlots(slotRes.items)
      setVenues(venueRes.items)
    } catch (err: any) {
      toast({ variant: "destructive", title: "加载失败", description: err.message || "查询节次/场地失败" })
    }
  }, [toast])

  useEffect(() => { ;(async () => { await loadBaseData() })() }, [loadBaseData])
  useEffect(() => { ;(async () => { await loadScheduleEntries() })() }, [loadScheduleEntries])

  const reloadAll = useCallback(async () => {
    await loadScheduleEntries()
    onPlanChanged()
  }, [loadScheduleEntries, onPlanChanged])

  const handleEntryMove = useCallback(async (entry: ScheduleEntry, dayOfWeek: number, periodKey: string) => {
    setSavingQuick(true)
    try {
      await scheduleApi.update(entry.id, {
        termId: entry.termId,
        planEntryId: entry.planEntryId,
        courseName: entry.courseName,
        courseCode: entry.courseCode || undefined,
        courseId: entry.courseId || undefined,
        type: entry.type,
        classNodeId: entry.classNodeId,
        teacherId: entry.teacherId || undefined,
        dayOfWeek,
        periods: [periodKey],
        startWeek: entry.startWeek,
        endWeek: entry.endWeek,
        weekPattern: entry.weekPattern,
        venueId: entry.venueId || undefined,
        scenarioId: entry.scenarioId || undefined,
      })
      toast({ title: "排课已调整", description: `${entry.courseName} 已移动到周${dayOfWeek} ${periodKey}` })
      reloadAll()
    } catch (err: any) {
      const c = err?.conflicts
      if (c && c.length > 0) {
        const msgs = c.map((x: any) => `${x.kind === "teacher" ? "教师" : x.kind === "class" ? "班级" : "场地"}冲突：${x.courseName}`).join("；")
        toast({ variant: "destructive", title: "排课冲突", description: msgs })
      } else {
        toast({ variant: "destructive", title: "调整失败", description: err.message || "请稍后重试" })
      }
    } finally { setSavingQuick(false) }
  }, [toast, reloadAll])

  const handleCellClick = useCallback(async (dayOfWeek: number, periodKey: string) => {
    if (savingQuick) return
    if (movingEntry) {
      await handleEntryMove(movingEntry, dayOfWeek, periodKey)
      setMovingEntry(null)
      return
    }
    if (!selectedEntry) return
    if (!selectedEntry.classNodeId) {
      setMissingClassEntry(selectedEntry)
      setPendingClassNodeId(undefined)
      return
    }
    setSavingQuick(true)
    try {
      await scheduleApi.create({
        termId: plan.termId,
        planEntryId: selectedEntry.id,
        courseName: selectedEntry.courseName,
        courseCode: selectedEntry.courseCode || undefined,
        courseId: selectedEntry.courseId || undefined,
        type: selectedEntry.type || "traditional",
        classNodeId: selectedEntry.classNodeId,
        teacherId: selectedEntry.teacherId || undefined,
        dayOfWeek,
        periods: [periodKey],
        startWeek: selectedEntry.startWeek || 1,
        endWeek: selectedEntry.endWeek || 1,
        weekPattern: selectedEntry.weekPattern || "all",
        scenarioId: selectedEntry.scenarioId || undefined,
      })
      toast({ title: "排课成功", description: `${selectedEntry.courseName} 已排入周${dayOfWeek} ${periodKey}` })
      setSelectedPendingId(null)
      reloadAll()
    } catch (err: any) {
      const c = err?.conflicts
      if (c && c.length > 0) {
        const msgs = c.map((x: any) => `${x.kind === "teacher" ? "教师" : x.kind === "class" ? "班级" : "场地"}冲突：${x.courseName}`).join("；")
        toast({ variant: "destructive", title: "排课冲突", description: msgs })
      } else {
        toast({ variant: "destructive", title: "排课失败", description: err.message || "请稍后重试" })
      }
    } finally { setSavingQuick(false) }
  }, [selectedEntry, savingQuick, plan.termId, toast, reloadAll, movingEntry, handleEntryMove])

  const handleEditClick = (entry: ScheduleEntry) => {
    setActiveScheduleEntry(entry)
    setActivePlanEntry(null)
    setFormOpen(true)
  }

  const handleEntryMoveStart = useCallback((entry: ScheduleEntry) => {
    setMovingEntry((prev) => (prev?.id === entry.id ? null : entry))
  }, [])

  const getAssignedVenues = (e: TeachingPlanEntry) => {
    return scheduleEntries.filter((se) => se.planEntryId === e.id).map((se) => se.venueName).filter(Boolean)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            已排 <span className="font-medium text-gray-900">{scheduledCount}</span>/{planEntries.length} 门
            {planEntries.length > 0 && (
              <span className="ml-2">· 待排 {pendingEntries.length} 门</span>
            )}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => scheduleApi.exportExcel(plan.termId)}>
            <Download className="mr-1 size-4" />导出
          </Button>
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <FileUp className="mr-1 size-4" />导入
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              setSavingQuick(true)
              try {
                const res = await scheduleApi.autoSchedule({ termId: plan.termId, planId: plan.id })
                if (res.failed > 0) {
                  toast({
                    variant: "default",
                    title: `自动排课完成：成功 ${res.success} 门，失败 ${res.failed} 门`,
                    description: res.failures.slice(0, 5).join("；") + (res.failures.length > 5 ? "…" : ""),
                  })
                } else {
                  toast({ title: "自动排课完成", description: `成功为 ${res.success} 门课程分配了时间与场地` })
                }
                reloadAll()
              } catch (err: any) {
                toast({ variant: "destructive", title: "自动排课失败", description: err.message || "请检查节次、场地是否已配置" })
              } finally { setSavingQuick(false) }
            }}
            disabled={savingQuick || pendingEntries.length === 0}
          >
            <Sparkles className="mr-1 size-4" />自动排课
          </Button>
        </div>
      </div>

      {/* 场地筛选栏 */}
      <div className="flex flex-wrap items-center gap-1.5">
        <Button variant={venueFilter === "__all" ? "default" : "outline"} size="sm" className="h-7 px-2.5 text-xs" onClick={() => setVenueFilter("__all")}>
          全部场地 ({venueEntryCounts.__all || 0})
        </Button>
        <Button variant={venueFilter === "__none" ? "default" : "outline"} size="sm" className="h-7 px-2.5 text-xs" onClick={() => setVenueFilter("__none")}>
          未分配 ({venueEntryCounts.__none || 0})
        </Button>
        {venues.map((v) => (
          <Button key={v.id} variant={venueFilter === v.id ? "default" : "outline"} size="sm" className="h-7 px-2.5 text-xs" onClick={() => setVenueFilter(v.id)}>
            <MapPin className="mr-1 h-3 w-3" />{v.name} ({venueEntryCounts[v.id] || 0})
          </Button>
        ))}
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        {/* 左侧：待排课程 */}
        <div className="w-full shrink-0 rounded-lg border bg-white lg:w-[300px]">
          <div className="border-b px-3 py-2.5">
            <h3 className="text-sm font-semibold text-gray-900">待排课程 ({pendingEntries.length})</h3>
            <p className="text-xs text-muted-foreground">{selectedEntry ? "已选：" + selectedEntry.courseName : "点击选中·再点右侧空格排课"}</p>
          </div>
          <ScrollArea className="h-[500px]">
            <div className="space-y-1.5 p-2">
              {pendingEntries.length === 0 ? (
                <div className="py-16 text-center text-sm text-muted-foreground">
                  <CheckCircle2 className="mx-auto h-8 w-8 mb-2 text-green-400" />全部排完
                </div>
              ) : (
                pendingEntries.map((e) => {
                  const isSelected = e.id === selectedPendingId
                  const assignedVenues = getAssignedVenues(e)
                  return (
                    <button key={e.id} type="button" onClick={() => setSelectedPendingId(isSelected ? null : e.id)}
                      className={cn("w-full rounded-md border p-2.5 text-left transition-all",
                        isSelected ? "border-blue-400 bg-blue-50 ring-1 ring-blue-400" : "hover:border-blue-200 hover:bg-blue-50/30")}>
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-medium text-gray-900">{e.courseName}</span>
                        {e.type === "scene" && <Badge variant="outline" className="h-4 px-1 text-[10px] border-orange-200 text-orange-600 bg-orange-50">场景</Badge>}
                      </div>
                      <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1"><Clock3 className="size-3" />第 {e.startWeek}-{e.endWeek} 周</div>
                        {e.teacherName && <div className="flex items-center gap-1"><Users className="size-3" />{e.teacherName}</div>}
                        {assignedVenues.length > 0 && (
                          <div className="flex items-center gap-1 text-blue-600"><MapPin className="size-3" />{assignedVenues.join("、")}</div>
                        )}
                      </div>
                      <div className="mt-1.5 text-xs font-medium text-blue-600">
                        {isSelected ? "已选中·点右侧空格排课" : "点击选中"}
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </ScrollArea>
        </div>

        {/* 右侧：日历网格 */}
        <div className="min-w-0 flex-1 rounded-lg border bg-white p-3">
          {gridLoading ? (
            <div className="py-16 text-center text-sm text-muted-foreground">加载中...</div>
          ) : (
            <div className="space-y-2">
              {selectedEntry && (
                <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs text-blue-700">
                  <span className="font-medium">已选中：{selectedEntry.courseName}</span>
                  <span>→ 点击下方空格完成排课</span>
                  <Button variant="ghost" size="sm" className="ml-auto h-5 px-1.5 text-[10px]" onClick={() => setSelectedPendingId(null)}><X className="mr-0.5 h-3 w-3" />取消</Button>
                </div>
              )}
              {movingEntry && (
                <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-700">
                  <span className="font-medium">调整位置：{movingEntry.courseName}</span>
                  <span>→ 点击目标空格切换时间/场地，或拖拽卡片到新格子</span>
                  <Button variant="ghost" size="sm" className="ml-auto h-5 px-1.5 text-[10px]" onClick={() => setMovingEntry(null)}><X className="mr-0.5 h-3 w-3" />取消</Button>
                </div>
              )}
              <ScheduleGrid
                entries={filteredEntries}
                periodSlots={periodSlots}
                loading={gridLoading}
                alwaysShow
                emptyText="暂无排课，选择左侧课程后点击此处空格"
                onEntryClick={handleEditClick}
                onCellClick={selectedEntry ? handleCellClick : undefined}
                onEntryMove={handleEntryMove}
                onEntryMoveStart={handleEntryMoveStart}
                movingEntry={movingEntry}
              />
            </div>
          )}
        </div>
      </div>

      <ScheduleFormDialog open={formOpen} onOpenChange={setFormOpen}
        term={{ id: plan.termId, name: plan.termName || "", startDate: "", endDate: "", weeksCount: 0, isCurrent: false, createdAt: "" } as any}
        planEntry={activePlanEntry} scheduleEntry={activeScheduleEntry}
        classNodeId={undefined} venues={venues} periodSlots={periodSlots}
        onSaved={reloadAll} onDeleted={reloadAll} />

      <ScheduleImportDialog open={importOpen} onOpenChange={setImportOpen} onImported={reloadAll} />

      <Dialog open={!!missingClassEntry} onOpenChange={(open) => { if (!open) setMissingClassEntry(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>补全授课班级</DialogTitle>
            <DialogDescription>
              「{missingClassEntry?.courseName}」尚未设置班级，请先在教学计划中设置，或在此处临时指定。
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <OrgNodePicker
              tenantId={tenantId}
              value={pendingClassNodeId}
              onChange={setPendingClassNodeId}
              selectableTypes={["班级"]}
              placeholder="选择授课班级"
              title="选择授课班级"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMissingClassEntry(null)} disabled={savingClass}>取消</Button>
            <Button
              disabled={!pendingClassNodeId || savingClass}
              onClick={async () => {
                if (!missingClassEntry || !pendingClassNodeId) return
                setSavingClass(true)
                try {
                  await teachingPlanApi.updateEntry(missingClassEntry.id, { classNodeId: pendingClassNodeId })
                  toast({ title: "班级已保存", description: "请重新点击目标时间格完成排课" })
                  setMissingClassEntry(null)
                  await onPlanChanged()
                } catch (err: any) {
                  toast({ variant: "destructive", title: "保存失败", description: err.message || "保存班级失败" })
                } finally {
                  setSavingClass(false)
                }
              }}
            >
              {savingClass ? "保存中..." : "保存并继续排课"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
