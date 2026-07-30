"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { CalendarPlus, FileUp, Clock3, CalendarDays } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@zhiyu/ui"
import { OrgNodePicker } from "@/components/shared/org-node-picker"
import { ScheduleGrid } from "@/components/shared/schedule-grid"
import { usePortalAuth } from "@/contexts/portal-auth-context"
import { periodSlotApi, scheduleApi, teachingPlanApi, venueApi } from "@/lib/api"
import type { AffairsTerm, PeriodSlot, ScheduleEntry, TeachingPlanEntry, Venue } from "@/lib/types"
import { ScheduleFormDialog } from "./schedule-form-dialog"
import { ScheduleImportDialog } from "./schedule-import-dialog"

const WEEK_PATTERN_LABELS: Record<string, string> = {
  all: "每周",
  odd: "单周",
  even: "双周",
}

interface ScheduleGridTabProps {
  term: AffairsTerm | null
  planId?: string
}

/** Tab2 自定义排课工作台：左侧待排课程区 + 右侧班级周课表网格 */
export function ScheduleGridTab({ term, planId }: ScheduleGridTabProps) {
  const { toast } = useToast()
  const { tenantId } = usePortalAuth()

  const [classNodeId, setClassNodeId] = useState<string | undefined>(undefined)
  const [pendingEntries, setPendingEntries] = useState<TeachingPlanEntry[]>([])
  const [pendingLoading, setPendingLoading] = useState(false)
  const [scheduleEntries, setScheduleEntries] = useState<ScheduleEntry[]>([])
  const [gridLoading, setGridLoading] = useState(false)
  const [periodSlots, setPeriodSlots] = useState<PeriodSlot[]>([])
  const [venues, setVenues] = useState<Venue[]>([])

  const [formOpen, setFormOpen] = useState(false)
  const [activePlanEntry, setActivePlanEntry] = useState<TeachingPlanEntry | null>(null)
  const [activeScheduleEntry, setActiveScheduleEntry] = useState<ScheduleEntry | null>(null)
  const [importOpen, setImportOpen] = useState(false)

  // 待排课程区：当前学期已确认教学计划中 status=planned 的条目（planId 存在时仅看该计划）
  const loadPendingEntries = useCallback(async () => {
    if (!term) {
      setPendingEntries([])
      return
    }
    setPendingLoading(true)
    try {
      const res = await teachingPlanApi.list({ termId: term.id, status: "confirmed", limit: 200 })
      const plans = planId ? res.items.filter((p) => p.id === planId) : res.items
      const details = await Promise.all(plans.map((p) => teachingPlanApi.get(p.id)))
      const entries = details.flatMap((d) => d.entries).filter((e) => e.status === "planned")
      setPendingEntries(entries)
    } catch (err: any) {
      toast({ variant: "destructive", title: "加载失败", description: err.message || "查询待排课程失败" })
    } finally {
      setPendingLoading(false)
    }
  }, [term, planId, toast])

  const loadScheduleEntries = useCallback(async () => {
    if (!term || !classNodeId) {
      setScheduleEntries([])
      return
    }
    setGridLoading(true)
    try {
      const res = await scheduleApi.list({ termId: term.id, classNodeId, limit: 500 })
      setScheduleEntries(res.items)
    } catch (err: any) {
      toast({ variant: "destructive", title: "加载失败", description: err.message || "查询班级课表失败" })
    } finally {
      setGridLoading(false)
    }
  }, [term, classNodeId, toast])

  const loadBaseData = useCallback(async () => {
    try {
      const [slotRes, venueRes] = await Promise.all([
        periodSlotApi.list({ limit: 100 }),
        venueApi.list({ limit: 500 }),
      ])
      setPeriodSlots(slotRes.items)
      setVenues(venueRes.items)
    } catch (err: any) {
      toast({ variant: "destructive", title: "加载失败", description: err.message || "查询节次/场地失败" })
    }
  }, [toast])

  useEffect(() => {
    // 首屏加载：async IIFE 包裹，避免在 effect 体内同步触发 setState
    ;(async () => {
      await loadBaseData()
    })()
  }, [loadBaseData])

  useEffect(() => {
    ;(async () => {
      await loadPendingEntries()
    })()
  }, [loadPendingEntries])

  useEffect(() => {
    ;(async () => {
      await loadScheduleEntries()
    })()
  }, [loadScheduleEntries])

  const reloadAll = useCallback(async () => {
    await Promise.all([loadPendingEntries(), loadScheduleEntries()])
  }, [loadPendingEntries, loadScheduleEntries])

  const openCreateForm = (entry: TeachingPlanEntry) => {
    setActivePlanEntry(entry)
    setActiveScheduleEntry(null)
    setFormOpen(true)
  }

  const openEditForm = (entry: ScheduleEntry) => {
    setActiveScheduleEntry(entry)
    setActivePlanEntry(null)
    setFormOpen(true)
  }

  const draftCount = useMemo(() => scheduleEntries.filter((e) => e.status === "draft").length, [scheduleEntries])

  if (!term) {
    return (
      <div className="rounded-lg border bg-white py-16 text-center text-sm text-muted-foreground">
        请先在顶部选择学期（无学期时请先在「教务基础配置」中创建）
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* 工具行：班级选择 + 导入 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="w-[260px]">
            <OrgNodePicker
              tenantId={tenantId}
              value={classNodeId}
              onChange={setClassNodeId}
              selectableTypes={["班级"]}
              placeholder="选择班级查看课表网格"
              title="选择班级"
            />
          </div>
          {classNodeId && draftCount > 0 && (
            <span className="text-xs text-muted-foreground">当前班级有 {draftCount} 条草稿待发布</span>
          )}
        </div>
        <Button variant="outline" onClick={() => setImportOpen(true)}>
          <FileUp className="mr-2 size-4" />
          Excel 导入
        </Button>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        {/* 左侧待排课程区 */}
        <div className="w-full shrink-0 rounded-lg border bg-white lg:w-[320px]">
          <div className="border-b px-4 py-3">
            <h3 className="text-sm font-semibold text-gray-900">待排课程（{pendingEntries.length}）</h3>
            <p className="text-xs text-muted-foreground">
              {planId ? "当前教学计划" : "当前学期已确认教学计划"}中待排课的条目，点击开始排课
            </p>
          </div>
          <ScrollArea className="h-[560px]">
            <div className="space-y-2 p-3">
              {pendingLoading ? (
                <div className="py-12 text-center text-sm text-muted-foreground">加载中...</div>
              ) : pendingEntries.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  暂无待排课程
                  <br />
                  <span className="text-xs">请先在「教学计划」中生成并确认教学计划</span>
                </div>
              ) : (
                pendingEntries.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => openCreateForm(e)}
                    className="w-full rounded-md border p-3 text-left transition-shadow hover:shadow-md"
                  >
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-gray-900">{e.courseName}</span>
                      {e.type === "scene" && (
                        <span className="shrink-0 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-600">
                          场景
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock3 className="size-3" />
                        周学时 {e.weekHours} · 第 {e.startWeek}-{e.endWeek} 周 · {WEEK_PATTERN_LABELS[e.weekPattern] || e.weekPattern}
                      </div>
                      <div className="flex items-center gap-1">
                        <CalendarDays className="size-3" />
                        {e.className || "未指定班级"} · {e.teacherName || "未指定教师"}
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-1 text-xs font-medium text-blue-600">
                      <CalendarPlus className="size-3" />
                      点击排课
                    </div>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        {/* 右侧周课表网格 */}
        <div className="min-w-0 flex-1 rounded-lg border bg-white p-3">
          {classNodeId ? (
            <ScheduleGrid
              entries={scheduleEntries}
              periodSlots={periodSlots}
              loading={gridLoading}
              emptyText="该班级当前学期暂无排课，点击左侧待排课程开始排课"
              onEntryClick={openEditForm}
            />
          ) : (
            <div className="py-16 text-center text-sm text-muted-foreground">
              请先选择班级，网格将显示该班级在当前学期的排课结果
            </div>
          )}
        </div>
      </div>

      {/* 排课表单弹窗 */}
      {term && (
        <ScheduleFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          term={term}
          planEntry={activePlanEntry}
          scheduleEntry={activeScheduleEntry}
          classNodeId={classNodeId}
          venues={venues}
          periodSlots={periodSlots}
          onSaved={reloadAll}
          onDeleted={reloadAll}
        />
      )}

      {/* Excel 导入弹窗 */}
      <ScheduleImportDialog open={importOpen} onOpenChange={setImportOpen} onImported={reloadAll} />
    </div>
  )
}
