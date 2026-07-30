"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { FileUp, Clock3, CalendarDays, CheckCircle2, X, MapPin, Users, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@zhiyu/ui"
import { ScheduleGrid } from "@/components/shared/schedule-grid"
import { periodSlotApi, scheduleApi, venueApi } from "@/lib/api"
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

  const handleCellClick = useCallback(async (dayOfWeek: number, periodKey: string) => {
    if (!selectedEntry || savingQuick) return
    setSavingQuick(true)
    try {
      await scheduleApi.create({
        termId: plan.termId,
        planEntryId: selectedEntry.id,
        courseName: selectedEntry.courseName,
        courseCode: selectedEntry.courseCode || undefined,
        courseId: selectedEntry.courseId || undefined,
        type: selectedEntry.type || "traditional",
        classNodeId: selectedEntry.classNodeId || "",
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
  }, [selectedEntry, savingQuick, plan.termId, toast, reloadAll])

  const handleEditClick = (entry: ScheduleEntry) => {
    setActiveScheduleEntry(entry)
    setActivePlanEntry(null)
    setFormOpen(true)
  }

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
              <ScheduleGrid
                entries={filteredEntries}
                periodSlots={periodSlots}
                loading={gridLoading}
                alwaysShow
                emptyText="暂无排课，选择左侧课程后点击此处空格"
                onEntryClick={handleEditClick}
                onCellClick={selectedEntry ? handleCellClick : undefined}
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
    </div>
  )
}
