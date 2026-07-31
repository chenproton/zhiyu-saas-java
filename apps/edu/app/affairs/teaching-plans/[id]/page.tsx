"use client"

import { useState, useMemo, useEffect, useCallback, Fragment } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, CalendarRange, CheckCircle2, FileEdit } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useToast } from "@zhiyu/ui"
import { PageHeaderCard } from "@/components/shared/page-header-card"
import { StatusBadge } from "@/components/shared/status-badge"
import { UserSelector } from "@/components/shared/user-selector"
import { OrgNodePicker } from "@/components/shared/org-node-picker"
import { usePortalAuth } from "@/contexts/portal-auth-context"
import { teachingPlanApi } from "@/lib/api"
import type { TeachingPlanDetail, TeachingPlanEntry } from "@/lib/types"
import { EntryTypeBadge } from "./_components/entry-type-badge"

const VENUE_TYPES = ["教室", "机房", "实训室", "实验室", "校外基地"]

function formatDateTime(iso?: string) {
  if (!iso) return "-"
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso))
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

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editStartWeek, setEditStartWeek] = useState("")
  const [editEndWeek, setEditEndWeek] = useState("")
  const [editCredits, setEditCredits] = useState("")
  const [editTotalHours, setEditTotalHours] = useState("")
  const [editVenueType, setEditVenueType] = useState("")
  const [editClassNodeId, setEditClassNodeId] = useState<string | undefined>(undefined)
  const [savingEntry, setSavingEntry] = useState(false)

  const loadPlan = useCallback(async () => {
    try {
      const detail = await teachingPlanApi.get(id)
      setPlan(detail)
      setEntries(detail.entries)
    } catch (err: any) {
      toast({ variant: "destructive", title: "加载失败", description: err.message || "查询教学计划失败" })
    } finally { setLoading(false) }
  }, [id, toast])

  useEffect(() => { ;(async () => { await loadPlan() })() }, [loadPlan])

  const groups = useMemo(() => {
    const map = new Map<number, TeachingPlanEntry[]>()
    for (const e of entries) {
      const list = map.get(e.startWeek) || []
      list.push(e)
      map.set(e.startWeek, list)
    }
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0])
  }, [entries])

  const replaceEntry = (updated: TeachingPlanEntry) => {
    setEntries((prev) => prev.map((e) => (e.id === updated.id ? updated : e)))
  }

  const startEdit = (e: TeachingPlanEntry) => {
    setEditingId(e.id)
    setEditStartWeek(String(e.startWeek))
    setEditEndWeek(String(e.endWeek))
    setEditCredits(String(e.credits || 0))
    setEditTotalHours(String(e.totalHours || 0))
    setEditVenueType(e.venueType || "")
    setEditClassNodeId(e.classNodeId)
  }

  const handleSaveEntry = async (entryId: string) => {
    setSavingEntry(true)
    try {
      const updated = await teachingPlanApi.updateEntry(entryId, {
        startWeek: Number(editStartWeek) || 1,
        endWeek: Number(editEndWeek) || 1,
        credits: Number(editCredits) || undefined,
        totalHours: Number(editTotalHours) || undefined,
        venueType: editVenueType,
        classNodeId: editClassNodeId,
      })
      replaceEntry(updated)
      setEditingId(null)
      toast({ title: "条目已保存" })
    } catch (err: any) {
      toast({ variant: "destructive", title: "保存失败", description: err.message || "保存条目失败" })
    } finally { setSavingEntry(false) }
  }

  const handleConfirm = async () => {
    try {
      await teachingPlanApi.confirm(id)
      toast({ title: "教学计划已确认" })
      await loadPlan()
    } catch (err: any) {
      toast({ variant: "destructive", title: "确认失败", description: err.message || "确认教学计划失败" })
    }
  }

  return (
    <div className="space-y-6">
      <PageHeaderCard
        title={plan?.programName || "教学计划详情"}
        description={plan ? `${plan.termName || "-"} · ${plan.majorName || "-"} · ${plan.entryYear} 级 · 生成于 ${formatDateTime(plan.generatedAt)}` : "教学计划条目与授课安排"}
        actions={
          <div className="flex items-center gap-2">
            {plan && <StatusBadge status={plan.status} />}
            {plan?.status === "draft" && (
              <Button variant="outline" onClick={handleConfirm}>
                <CheckCircle2 className="mr-2 size-4" />确认计划
              </Button>
            )}
            <Button variant="outline" onClick={() => router.push("/affairs/teaching-plans")}>
              <ArrowLeft className="mr-2 size-4" />返回列表
            </Button>
          </div>
        }
      />

      <div className="rounded-lg border bg-white px-4 py-3">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">课程</TableHead>
                <TableHead className="w-[80px]">类型</TableHead>
                <TableHead className="w-[70px]">学分</TableHead>
                <TableHead className="w-[80px]">总学时</TableHead>
                <TableHead className="w-[150px]">起止周</TableHead>
                <TableHead className="w-[160px]">班级</TableHead>
                <TableHead className="w-[160px]">教师</TableHead>
                <TableHead className="w-[120px]">场地类型</TableHead>
                <TableHead className="w-[90px]">状态</TableHead>
                <TableHead className="sticky right-0 w-[100px] bg-white text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={10} className="h-24 text-center text-muted-foreground">加载中...</TableCell></TableRow>
              ) : groups.length === 0 ? (
                <TableRow><TableCell colSpan={10} className="h-24 text-center text-muted-foreground">暂无教学条目</TableCell></TableRow>
              ) : (
                groups.map(([startWeek, groupEntries]) => (
                  <Fragment key={`group-${startWeek}`}>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableCell colSpan={10} className="py-1.5 text-xs font-medium text-muted-foreground">
                        第 {startWeek} 周起（{groupEntries.length} 门）
                      </TableCell>
                    </TableRow>
                    {groupEntries.map((e) => {
                      const editing = editingId === e.id
                      return (
                        <TableRow key={e.id} className="group">
                          <TableCell>
                            <div className="font-medium">{e.courseName}</div>
                            {e.courseCode && <div className="text-xs text-muted-foreground">{e.courseCode}</div>}
                            {e.type === "scene" && e.scenarioName && <div className="text-xs text-orange-600">{e.scenarioName}</div>}
                          </TableCell>
                          <TableCell><EntryTypeBadge type={e.type} /></TableCell>
                          <TableCell>
                            {editing ? (
                              <Input className="h-8 w-[60px]" type="number" min={0} step="0.5" value={editCredits} onChange={(ev) => setEditCredits(ev.target.value)} />
                            ) : (
                              <span className="text-sm">{e.credits}</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {editing ? (
                              <Input className="h-8 w-[60px]" type="number" min={0} value={editTotalHours} onChange={(ev) => setEditTotalHours(ev.target.value)} />
                            ) : (
                              <span className="text-sm">{e.totalHours}</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {editing ? (
                              <div className="flex items-center gap-1">
                                <Input className="h-8 w-[60px]" type="number" min={1} value={editStartWeek} onChange={(ev) => setEditStartWeek(ev.target.value)} />
                                <span className="text-xs text-muted-foreground">至</span>
                                <Input className="h-8 w-[60px]" type="number" min={1} value={editEndWeek} onChange={(ev) => setEditEndWeek(ev.target.value)} />
                              </div>
                            ) : (
                              <span className="text-sm">第 {e.startWeek}-{e.endWeek} 周</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {editing ? (
                              <OrgNodePicker
                                tenantId={tenantId}
                                value={editClassNodeId}
                                onChange={setEditClassNodeId}
                                selectableTypes={["班级"]}
                                placeholder="选择班级"
                                title="选择授课班级"
                              />
                            ) : (
                              <span className="text-sm">{e.className || "-"}</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {editing ? (
                              <UserSelector
                                value={e.teacherId ? [e.teacherId] : []}
                                onChange={(ids) => {
                                  const tid = ids[0] || ""
                                  teachingPlanApi.updateEntry(e.id, { teacherId: tid }).then((updated) => replaceEntry(updated)).catch(() => {})
                                }}
                                multiple={false}
                                placeholder={e.teacherName || "选择教师"}
                              />
                            ) : (
                              <span className="text-sm">{e.teacherName || "未指定"}</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {editing ? (
                              <Select value={editVenueType || "none"} onValueChange={(v) => setEditVenueType(v === "none" ? "" : v)}>
                                <SelectTrigger className="h-8"><SelectValue placeholder="选择场地类型" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">未设置</SelectItem>
                                  {VENUE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            ) : (
                              <span className="text-sm">{e.venueType || "-"}</span>
                            )}
                          </TableCell>
                          <TableCell><StatusBadge status={e.status} /></TableCell>
                          <TableCell className="text-right">
                            {editing ? (
                              <div className="flex items-center gap-1">
                                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-green-600 hover:text-green-700" disabled={savingEntry} onClick={() => handleSaveEntry(e.id)}>保存</Button>
                                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" disabled={savingEntry} onClick={() => setEditingId(null)}>取消</Button>
                              </div>
                            ) : (
                              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => startEdit(e)}>
                                <FileEdit className="mr-1 h-3 w-3" />编辑
                              </Button>
                            )}
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
          <CalendarRange className="mr-2 size-4" />前往排课
        </Button>
      </div>
    </div>
  )
}
