"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { FileUp, Clock3, CalendarDays, CheckCircle2, X, MapPin, Users, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { useToast } from "@zhiyu/ui"
import { ScheduleGrid } from "@/components/shared/schedule-grid"
import { MultiOrgNodePicker } from "@/components/shared/multi-org-node-picker"
import { UserSelector } from "@/components/shared/user-selector"
import { usePortalAuth } from "@/contexts/portal-auth-context"
import { periodSlotApi, scheduleApi, teachingPlanApi, venueApi } from "@/lib/api"
import type { PeriodSlot, ScheduleEntry, TeachingPlan, TeachingPlanEntry, Venue } from "@/lib/types"
import { cn } from "@/lib/utils"
import { ScheduleEditDialog } from "./schedule-edit-dialog"
import { ScheduleImportDialog } from "./schedule-import-dialog"

interface ScheduleGridTabProps { plan: TeachingPlan; planEntries: TeachingPlanEntry[]; onPlanChanged: () => void }

export function ScheduleGridTab({ plan, planEntries, onPlanChanged }: ScheduleGridTabProps) {
  const { toast } = useToast()
  const { tenantId } = usePortalAuth()
  const [scheduleEntries, setScheduleEntries] = useState<ScheduleEntry[]>([])
  const [gridLoading, setGridLoading] = useState(false)
  const [periodSlots, setPeriodSlots] = useState<PeriodSlot[]>([])
  const [venues, setVenues] = useState<Venue[]>([])
  const [editOpen, setEditOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<ScheduleEntry | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [selectedPendingId, setSelectedPendingId] = useState<string | null>(null)
  const [savingQuick, setSavingQuick] = useState(false)
  const [venueFilter, setVenueFilter] = useState<string>("__all")
  const [movingEntry, setMovingEntry] = useState<ScheduleEntry | null>(null)
  const [preConfigEntry, setPreConfigEntry] = useState<TeachingPlanEntry | null>(null)
  const [preConfigDay, setPreConfigDay] = useState(0)
  const [preConfigPeriod, setPreConfigPeriod] = useState("")
  const [preClassIds, setPreClassIds] = useState<string[]>([])
  const [preTeacherId, setPreTeacherId] = useState("")
  const [preVenueId, setPreVenueId] = useState("")
  const [preConfigSaving, setPreConfigSaving] = useState(false)

  const pendingEntries = useMemo(() => planEntries.filter((e) => e.status === "planned"), [planEntries])
  const scheduledCount = useMemo(() => planEntries.filter((e) => e.status === "scheduled").length, [planEntries])
  const selectedEntry = useMemo(() => pendingEntries.find((e) => e.id === selectedPendingId) || null, [pendingEntries, selectedPendingId])

  const loadScheduleEntries = useCallback(async () => {
    if (!plan.termId) { setScheduleEntries([]); return }
    setGridLoading(true)
    try { setScheduleEntries((await scheduleApi.list({ termId: plan.termId, limit: 500 })).items) } catch {} finally { setGridLoading(false) }
  }, [plan.termId])

  const loadBaseData = useCallback(async () => {
    try { const [s, v] = await Promise.all([periodSlotApi.list({ limit: 100 }), venueApi.list({ limit: 500 })]); setPeriodSlots(s.items); setVenues(v.items) } catch {}
  }, [])

  useEffect(() => { ;(async () => { await loadBaseData() })() }, [loadBaseData])
  useEffect(() => { ;(async () => { await loadScheduleEntries() })() }, [loadScheduleEntries])

  const reloadAll = useCallback(async () => { await loadScheduleEntries(); onPlanChanged() }, [loadScheduleEntries, onPlanChanged])

  const doCreateSchedule = async (entry: TeachingPlanEntry, day: number, period: string, classIds: string[], teacherId: string, venueId: string) => {
    let created = 0
    let lastErr = ""
    for (const cid of classIds) {
      try {
        await scheduleApi.create({
          termId: plan.termId, planEntryId: entry.id, courseName: entry.courseName, courseCode: entry.courseCode || undefined,
          courseId: entry.courseId || undefined, type: entry.type || "traditional", classNodeId: cid,
          teacherId: teacherId || undefined, dayOfWeek: day, periods: [period],
          startWeek: entry.startWeek || 1, endWeek: entry.endWeek || 1, weekPattern: entry.weekPattern || "all",
          venueId: venueId || undefined, scenarioId: entry.scenarioId || undefined,
        })
        created++
      } catch (err: any) { lastErr = err.message || "" }
    }
    return { created, lastErr }
  }

  const handleCellClick = useCallback(async (dayOfWeek: number, periodKey: string) => {
    if (savingQuick) return
    if (movingEntry) {
      try {
        await scheduleApi.update(movingEntry.id, {
          termId: movingEntry.termId, planEntryId: movingEntry.planEntryId, courseName: movingEntry.courseName,
          courseCode: movingEntry.courseCode || undefined, courseId: movingEntry.courseId || undefined, type: movingEntry.type,
          classNodeId: movingEntry.classNodeId, teacherId: movingEntry.teacherId || undefined,
          dayOfWeek, periods: [periodKey], startWeek: movingEntry.startWeek, endWeek: movingEntry.endWeek,
          weekPattern: movingEntry.weekPattern, venueId: movingEntry.venueId || undefined, scenarioId: movingEntry.scenarioId || undefined,
        })
        toast({ title: "排课已调整" })
        setMovingEntry(null)
        reloadAll()
      } catch (err: any) { toast({ variant: "destructive", title: "调整失败", description: err.message || "" }) }
      return
    }
    if (!selectedEntry) return
    const classIds = selectedEntry.classNodeIds || (selectedEntry.classNodeId ? [selectedEntry.classNodeId] : [])
    const hasTeacher = !!selectedEntry.teacherId
    const hasAll = classIds.length > 0 && hasTeacher
    if (!hasAll) {
      setPreConfigEntry(selectedEntry); setPreConfigDay(dayOfWeek); setPreConfigPeriod(periodKey)
      setPreClassIds(classIds); setPreTeacherId(selectedEntry.teacherId || ""); setPreVenueId("")
      return
    }
    setSavingQuick(true)
    try {
      const { created, lastErr } = await doCreateSchedule(selectedEntry, dayOfWeek, periodKey, classIds, selectedEntry.teacherId || "", "")
      if (created > 0) {
        toast({ title: "排课成功", description: `${selectedEntry.courseName} → 周${dayOfWeek} ${periodKey}（${created}/${classIds.length} 班）` })
        setSelectedPendingId(null); reloadAll()
      } else if (lastErr) {
        toast({ variant: "destructive", title: "排课失败", description: lastErr })
      }
    } catch (err: any) { toast({ variant: "destructive", title: "排课失败", description: err.message || "" }) }
    finally { setSavingQuick(false) }
  }, [selectedEntry, savingQuick, plan.termId, toast, reloadAll, movingEntry])

  const handlePreConfigSave = async () => {
    if (!preConfigEntry) return
    setPreConfigSaving(true)
    try {
      if (preClassIds.length > 0) await teachingPlanApi.updateEntry(preConfigEntry.id, { classNodeIds: preClassIds, teacherId: preTeacherId || undefined }).catch(() => {})
      const { created, lastErr } = await doCreateSchedule(preConfigEntry, preConfigDay, preConfigPeriod, preClassIds, preTeacherId, preVenueId)
      if (created > 0) {
        toast({ title: "排课成功", description: `${created}/${preClassIds.length} 班已排` })
        setSelectedPendingId(null); setPreConfigEntry(null); reloadAll()
      } else if (lastErr) {
        toast({ variant: "destructive", title: "排课失败", description: lastErr })
      }
    } catch (err: any) { toast({ variant: "destructive", title: "排课失败", description: err.message || "" }) }
    finally { setPreConfigSaving(false) }
  }

  const handleEditClick = useCallback((entry: ScheduleEntry) => {
    setEditTarget(entry); setEditOpen(true)
  }, [])

  const handleEditSaved = () => { setEditOpen(false); reloadAll() }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">已排 {scheduledCount}/{planEntries.length} 门 · 待排 {pendingEntries.length} 门</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => scheduleApi.exportExcel(plan.termId)}><Download className="mr-1 size-4" />导出</Button>
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}><FileUp className="mr-1 size-4" />导入</Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Button variant={venueFilter === "__all" ? "default" : "outline"} size="sm" className="h-7 px-2.5 text-xs" onClick={() => setVenueFilter("__all")}>全部</Button>
        {venues.map((v) => (
          <Button key={v.id} variant={venueFilter === v.id ? "default" : "outline"} size="sm" className="h-7 px-2.5 text-xs" onClick={() => setVenueFilter(v.id)}>
            <MapPin className="mr-1 h-3 w-3" />{v.name}
          </Button>
        ))}
      </div>

      {selectedEntry && (
        <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-700">
          <span className="font-medium">已选中：{selectedEntry.courseName}</span><span>→ 点击右侧空格排课</span>
          <Button variant="ghost" size="sm" className="ml-auto h-6 px-2 text-xs" onClick={() => setSelectedPendingId(null)}><X className="mr-1 h-3 w-3" />取消</Button>
        </div>
      )}

      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="w-full shrink-0 rounded-lg border bg-white lg:w-[300px]">
          <div className="border-b px-3 py-2.5">
            <h3 className="text-sm font-semibold text-gray-900">待排课程 ({pendingEntries.length})</h3>
            <p className="text-xs text-muted-foreground">点击选中·再点空格排课</p>
          </div>
          <ScrollArea className="h-[500px]">
            <div className="space-y-1.5 p-2">
              {pendingEntries.length === 0 ? (
                <div className="py-16 text-center text-sm text-muted-foreground"><CheckCircle2 className="mx-auto h-8 w-8 mb-2 text-green-400" />全部排完</div>
              ) : pendingEntries.map((e) => {
                const isSel = e.id === selectedPendingId
                return (
                  <button key={e.id} type="button" onClick={() => setSelectedPendingId(isSel ? null : e.id)}
                    className={cn("w-full rounded-md border p-2.5 text-left transition-all", isSel ? "border-blue-400 bg-blue-50 ring-1 ring-blue-400" : "hover:border-blue-200 hover:bg-blue-50/30")}>
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-medium text-gray-900">{e.courseName}</span>
                      {e.type === "scene" && <Badge variant="outline" className="h-4 px-1 text-[10px] border-orange-200 text-orange-600">场景</Badge>}
                    </div>
                    <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1"><Clock3 className="size-3" />第 {e.startWeek}-{e.endWeek} 周</div>
                      {e.teacherName && <div className="flex items-center gap-1"><Users className="size-3" />{e.teacherName}</div>}
                      {(e.classNodeIds || []).length > 0 && <div className="flex items-center gap-1">{e.classNames?.slice(0,2).join("、")}等{(e.classNodeIds||[]).length}班</div>}
                    </div>
                    <div className="mt-1.5 text-xs font-medium text-blue-600">{isSel ? "已选中·点空格排课" : "点击选中"}</div>
                  </button>
                )
              })}
            </div>
          </ScrollArea>
        </div>

        <div className="min-w-0 flex-1 rounded-lg border bg-white p-3">
          <ScheduleGrid entries={scheduleEntries} periodSlots={periodSlots} loading={gridLoading} alwaysShow
            emptyText="点击左侧课程后点此处空格" onEntryClick={handleEditClick} onCellClick={selectedEntry ? handleCellClick : undefined} />
        </div>
      </div>

      <ScheduleEditDialog open={editOpen} onOpenChange={setEditOpen} entry={editTarget} venues={venues} onSaved={handleEditSaved} />

      <Dialog open={!!preConfigEntry} onOpenChange={(v) => { if (!v) setPreConfigEntry(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>完善排课信息</DialogTitle>
            <DialogDescription>「{preConfigEntry?.courseName}」缺少班级/教师/场地，请补充后直接排课</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium mb-1 block">授课班级 *</label>
              <MultiOrgNodePicker tenantId={tenantId} value={preClassIds} onChange={setPreClassIds}
                selectableTypes={["班级"]} placeholder="选择班级" title="选择授课班级" maxVisible={3} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">授课教师 *</label>
              <UserSelector value={preTeacherId ? [preTeacherId] : []}
                onChange={(ids) => setPreTeacherId(ids[0] || "")}
                multiple={false} placeholder="选择教师" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">场地</label>
              <Select value={preVenueId || "none"} onValueChange={(v) => setPreVenueId(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="选择场地" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">不指定</SelectItem>
                  {venues.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}（{v.type}）</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreConfigEntry(null)} disabled={preConfigSaving}>取消</Button>
            <Button onClick={handlePreConfigSave} disabled={preClassIds.length === 0 || !preTeacherId || preConfigSaving}>
              {preConfigSaving ? "保存中..." : "保存并排课"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ScheduleImportDialog open={importOpen} onOpenChange={setImportOpen} onImported={reloadAll} />
    </div>
  )
}
