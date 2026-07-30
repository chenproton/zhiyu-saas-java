"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { CalendarPlus, FileUp, Clock3, CalendarDays, CheckCircle2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@zhiyu/ui"
import { OrgNodePicker } from "@/components/shared/org-node-picker"
import { ScheduleGrid } from "@/components/shared/schedule-grid"
import { usePortalAuth } from "@/contexts/portal-auth-context"
import { periodSlotApi, scheduleApi, venueApi } from "@/lib/api"
import type { PeriodSlot, ScheduleEntry, TeachingPlan, TeachingPlanEntry, Venue } from "@/lib/types"
import { cn } from "@/lib/utils"
import { ScheduleFormDialog } from "./schedule-form-dialog"
import { ScheduleImportDialog } from "./schedule-import-dialog"
import { QuickAssignDialog } from "./quick-assign-dialog"

interface ScheduleGridTabProps {
  plan: TeachingPlan
  planEntries: TeachingPlanEntry[]
  onPlanChanged: () => void
}

export function ScheduleGridTab({ plan, planEntries, onPlanChanged }: ScheduleGridTabProps) {
  const { toast } = useToast()
  const { tenantId } = usePortalAuth()

  const [classNodeId, setClassNodeId] = useState<string | undefined>(undefined)
  const [scheduleEntries, setScheduleEntries] = useState<ScheduleEntry[]>([])
  const [gridLoading, setGridLoading] = useState(false)
  const [periodSlots, setPeriodSlots] = useState<PeriodSlot[]>([])
  const [venues, setVenues] = useState<Venue[]>([])

  const [formOpen, setFormOpen] = useState(false)
  const [activePlanEntry, setActivePlanEntry] = useState<TeachingPlanEntry | null>(null)
  const [activeScheduleEntry, setActiveScheduleEntry] = useState<ScheduleEntry | null>(null)
  const [importOpen, setImportOpen] = useState(false)

  const [selectedPendingId, setSelectedPendingId] = useState<string | null>(null)
  const [quickOpen, setQuickOpen] = useState(false)
  const [quickPrefillDay, setQuickPrefillDay] = useState(1)

  const pendingEntries = useMemo(() => planEntries.filter((e) => e.status === "planned"), [planEntries])
  const scheduledCount = useMemo(() => planEntries.filter((e) => e.status === "scheduled").length, [planEntries])
  const draftCount = useMemo(() => scheduleEntries.filter((e) => e.status === "draft").length, [scheduleEntries])
  const periodSlotNames = useMemo(() => [...periodSlots].sort((a, b) => a.sortOrder - b.sortOrder).map((s) => s.name), [periodSlots])
  const selectedEntry = useMemo(() => pendingEntries.find((e) => e.id === selectedPendingId) || null, [pendingEntries, selectedPendingId])

  const loadScheduleEntries = useCallback(async () => {
    if (!plan.termId || !classNodeId) { setScheduleEntries([]); return }
    setGridLoading(true)
    try {
      const res = await scheduleApi.list({ termId: plan.termId, classNodeId, limit: 500 })
      setScheduleEntries(res.items)
    } catch (err: any) {
      toast({ variant: "destructive", title: "加载失败", description: err.message || "查询班级课表失败" })
    } finally { setGridLoading(false) }
  }, [plan.termId, classNodeId, toast])

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

  const handleCellClick = (dayOfWeek: number, periodKey: string) => {
    if (!selectedEntry) return
    setQuickPrefillDay(dayOfWeek)
    setQuickOpen(true)
  }

  const handleQuickSaved = () => {
    setSelectedPendingId(null)
    reloadAll()
  }

  const handleEntryClick = (entry: ScheduleEntry) => {
    setActiveScheduleEntry(entry)
    setActivePlanEntry(null)
    setFormOpen(true)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="w-[260px]">
            <OrgNodePicker tenantId={tenantId} value={classNodeId} onChange={setClassNodeId}
              selectableTypes={["班级"]} placeholder="选择班级查看课表网格" title="选择班级" />
          </div>
          {classNodeId && draftCount > 0 && <span className="text-xs text-muted-foreground">草稿 {draftCount} 条</span>}
          <span className="text-xs text-muted-foreground">已排 {scheduledCount}/{planEntries.length} 门</span>
        </div>
        <Button variant="outline" onClick={() => setImportOpen(true)}>
          <FileUp className="mr-2 size-4" />Excel 导入
        </Button>
      </div>

      {selectedEntry && (
        <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-700">
          <span className="font-medium">已选中：{selectedEntry.courseName}</span>
          <span className="text-blue-500">→ 点击右侧课表空白格完成排课</span>
          <Button variant="ghost" size="sm" className="ml-auto h-6 px-2 text-xs" onClick={() => setSelectedPendingId(null)}>
            <X className="mr-1 h-3 w-3" />取消选择
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="w-full shrink-0 rounded-lg border bg-white lg:w-[320px]">
          <div className="border-b px-4 py-3">
            <h3 className="text-sm font-semibold text-gray-900">待排课程 · {plan.programName}</h3>
            <p className="text-xs text-muted-foreground">共 {pendingEntries.length} 门待排，{selectedEntry ? "已选一门，点右侧课表" : "点击选中后点课表空白格"}</p>
          </div>
          <ScrollArea className="h-[560px]">
            <div className="space-y-2 p-3">
              {pendingEntries.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  <CheckCircle2 className="mx-auto h-8 w-8 mb-2 text-green-400" />所有课程已排课完成
                </div>
              ) : (
                pendingEntries.map((e) => {
                  const isSelected = e.id === selectedPendingId
                  return (
                    <button key={e.id} type="button"
                      onClick={() => { setSelectedPendingId(isSelected ? null : e.id) }}
                      className={cn("w-full rounded-md border p-3 text-left transition-all",
                        isSelected ? "border-blue-400 bg-blue-50 ring-1 ring-blue-400 shadow-md" : "hover:border-blue-300 hover:shadow-md")}>
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-gray-900">{e.courseName}</span>
                        {e.type === "scene" && <span className="shrink-0 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-600">场景</span>}
                      </div>
                      <div className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1"><Clock3 className="size-3" />第 {e.startWeek}-{e.endWeek} 周</div>
                        <div className="flex items-center gap-1"><CalendarDays className="size-3" />{e.className || "未指定班级"} · {e.teacherName || "未指定教师"}</div>
                      </div>
                      <div className="mt-2 flex items-center gap-1 text-xs font-medium text-blue-600">
                        <CalendarPlus className="size-3" />{isSelected ? "已选中，点右侧课表空白格" : "点击选中"}
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </ScrollArea>
        </div>

        <div className="min-w-0 flex-1 rounded-lg border bg-white p-3">
          {classNodeId ? (
            selectedEntry ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">点击下方课表中任意空格，将「{selectedEntry.courseName}」排入该时段</p>
                <ScheduleGrid entries={scheduleEntries} periodSlots={periodSlots} loading={gridLoading}
                  emptyText="点击左侧课程后，再点击此处的空格" onEntryClick={handleEntryClick} onCellClick={handleCellClick} />
              </div>
            ) : (
              <ScheduleGrid entries={scheduleEntries} periodSlots={periodSlots} loading={gridLoading}
                emptyText="请先选择左侧待排课程，再点击此处空格排课" onEntryClick={handleEntryClick} />
            )
          ) : (
            <div className="py-16 text-center text-sm text-muted-foreground">请先选择班级，网格将显示该班级在当前学期的排课结果</div>
          )}
        </div>
      </div>

      <ScheduleFormDialog open={formOpen} onOpenChange={setFormOpen}
        term={{ id: plan.termId, name: plan.termName || "", startDate: "", endDate: "", weeksCount: 0, isCurrent: false, createdAt: "" } as any}
        planEntry={activePlanEntry} scheduleEntry={activeScheduleEntry}
        classNodeId={classNodeId} venues={venues} periodSlots={periodSlots}
        onSaved={reloadAll} onDeleted={reloadAll} />

      <QuickAssignDialog open={quickOpen} onOpenChange={setQuickOpen}
        entry={selectedEntry} termId={plan.termId} venues={venues}
        prefillDay={quickPrefillDay} periodSlotNames={periodSlotNames} onSaved={handleQuickSaved} />

      <ScheduleImportDialog open={importOpen} onOpenChange={setImportOpen} onImported={reloadAll} />
    </div>
  )
}
