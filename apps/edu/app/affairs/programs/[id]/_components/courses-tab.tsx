"use client"

import { useState, useEffect, useCallback } from "react"
import { Plus, Save, Trash2 } from "lucide-react"
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
import { programApi, scenarioApi, courseApi, positionApi } from "@/lib/api"
import type { Scenario, CareerPosition } from "@/lib/types"
import type { Course } from "@/lib/types/lesson"

const NATURE_OPTIONS = ["必修", "选修", "实践", "场景"]

type LinkType = "none" | "position" | "course"

interface CourseRow {
  key: string
  name: string
  code: string
  credits: number
  hours: number
  nature: string
  linkType: LinkType
  scenarioId: string
  courseId: string
  positionId: string
  isPositionChild: boolean
}

function emptyRow(key: string): CourseRow {
  return {
    key, name: "", code: "", credits: 0, hours: 0,
    nature: "必修",
    linkType: "none", scenarioId: "", courseId: "", positionId: "", isPositionChild: false,
  }
}

function scenarioRow(key: string, scenario: Scenario, positionId: string): CourseRow {
  return {
    key, name: scenario.name, code: scenario.code || "", credits: 0, hours: 0,
    nature: "必修",
    linkType: "position", scenarioId: scenario.id, courseId: "", positionId: positionId, isPositionChild: true,
  }
}

export function ProgramCoursesTab({ programId }: { programId: string }) {
  const { toast } = useToast()
  const [rows, setRows] = useState<CourseRow[]>([])
  const [systemCourses, setSystemCourses] = useState<Course[]>([])
  const [positions, setPositions] = useState<CareerPosition[]>([])
  const [positionScenariosMap, setPositionScenariosMap] = useState<Record<string, Scenario[]>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadingPosScen, setLoadingPosScen] = useState<Record<string, boolean>>({})

  const loadCourses = useCallback(async () => {
    try {
      const res = await programApi.listCourses(programId)
      setRows(res.items.map((c) => ({
        key: c.id,
        name: c.name,
        code: c.code || "",
        credits: c.credits,
        hours: c.hours,
        nature: c.nature || "必修",
        linkType: c.scenarioId ? "position" : c.courseId ? "course" : "none",
        scenarioId: c.scenarioId || "",
        courseId: c.courseId || "",
        positionId: "",
        isPositionChild: false,
      })))
    } catch (err: any) {
      toast({ variant: "destructive", title: "加载失败", description: err.message || "查询课程设置失败" })
    } finally {
      setLoading(false)
    }
  }, [programId, toast])

  useEffect(() => { ;(async () => { await loadCourses() })() }, [loadCourses])

  useEffect(() => {
    let c = false
    ;(async () => {
      try { const r = await positionApi.list({ status: "published", limit: 200 }); if (!c) setPositions(r.items) } catch { /* ignore */ }
    })()
    return () => { c = true }
  }, [])

  useEffect(() => {
    let c = false
    ;(async () => {
      try { const r = await courseApi.list({ type: "system", status: "published", limit: 200 }); if (!c) setSystemCourses(r.items) } catch { /* ignore */ }
    })()
    return () => { c = true }
  }, [])

  const fetchPositionScenarios = useCallback(async (positionId: string) => {
    if (positionScenariosMap[positionId]) return positionScenariosMap[positionId]
    setLoadingPosScen((p) => ({ ...p, [positionId]: true }))
    try {
      const res = await scenarioApi.list({ careerPositionId: positionId, status: "published", limit: 200 })
      const items = res.items || []
      setPositionScenariosMap((p) => ({ ...p, [positionId]: items }))
      return items
    } catch { return [] }
    finally { setLoadingPosScen((p) => ({ ...p, [positionId]: false })) }
  }, [positionScenariosMap])

  const updateRow = (key: string, patch: Partial<CourseRow>) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }

  const addRow = () => {
    setRows((prev) => [...prev, emptyRow(`new-${Date.now()}-${prev.length}`)])
  }

  const removeRow = (key: string) => {
    setRows((prev) => {
      const target = prev.find((r) => r.key === key)
      if (!target) return prev
      if (target.linkType === "position" && target.positionId) {
        return prev.filter((r) => r.key !== key && !(r.isPositionChild && r.positionId === target.positionId))
      }
      return prev.filter((r) => r.key !== key)
    })
  }

  const handlePositionChange = async (rowKey: string, newPositionId: string) => {
    if (!newPositionId || newPositionId === "none") {
      setRows((prev) => {
        const target = prev.find((r) => r.key === rowKey)
        if (target?.positionId) {
          return prev.filter((r) => !(r.isPositionChild && r.positionId === target.positionId)).map((r) => r.key === rowKey ? { ...r, positionId: "" } : r)
        }
        return prev.map((r) => r.key === rowKey ? { ...r, scenarioId: "", positionId: "" } : r)
      })
      return
    }
    updateRow(rowKey, { positionId: newPositionId })
    const scenarios = await fetchPositionScenarios(newPositionId)
    setRows((prev) => {
      const target = prev.find((r) => r.key === rowKey)
      const filtered = target?.positionId
        ? prev.filter((r) => !(r.isPositionChild && r.positionId === target.positionId))
        : prev
      const childRows = scenarios.map((s, i) => scenarioRow(`pos-child-${Date.now()}-${newPositionId}-${i}`, s, newPositionId))
      return filtered.flatMap((r) => {
        if (r.key === rowKey) return [r, ...childRows]
        return [r]
      })
    })
  }

  const handleSave = async () => {
    const invalid = rows.filter((r) => !(r.linkType === "position" && r.positionId && !r.isPositionChild)).find((r) => r.name.trim() === "")
    if (invalid) {
      toast({ variant: "destructive", title: "无法保存", description: "每项岗位/课程需填写名称" })
      return
    }
    setSaving(true)
    try {
      const saveRows = rows.filter((r) => !(r.linkType === "position" && r.positionId && !r.isPositionChild))
      const payloads = saveRows.map((r, i) => ({
        name: r.name.trim(),
        code: r.code.trim() || undefined,
        credits: r.credits || 0,
        hours: r.hours || 0,
        theoryHours: 0,
        practiceHours: 0,
        semester: 1,
        nature: r.nature,
        assessment: undefined,
        scenarioId: r.scenarioId || undefined,
        courseId: r.linkType === "course" ? r.courseId || undefined : undefined,
        sortOrder: i,
      }))
      await programApi.saveCourses(programId, payloads)
      toast({ title: "课程设置已保存" })
      await loadCourses()
    } catch (err: any) {
      toast({ variant: "destructive", title: "保存失败", description: err.message || "保存课程设置失败" })
    } finally {
      setSaving(false)
    }
  }

  const courseCount = rows.filter((r) => !(r.linkType === "position" && r.positionId && !r.isPositionChild)).length
  const totalCredits = rows.reduce((sum, r) => sum + (r.credits || 0), 0)

  return (
    <div className="rounded-lg border bg-white px-4 py-3 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          共 {courseCount} 项岗位/课程，合计 {totalCredits} 学分；通过「关联对象」可关联至已发布岗位/体系课
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={addRow}>
            <Plus className="mr-1 size-4" />添加岗位/课程
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving || loading}>
            <Save className="mr-1 size-4" />{saving ? "保存中..." : "保存岗位/课程设置"}
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[220px]">名称 *</TableHead>
              <TableHead className="w-[140px]">编码</TableHead>
              <TableHead className="w-[80px]">学分</TableHead>
              <TableHead className="w-[80px]">总学时</TableHead>
              <TableHead className="w-[110px]">性质</TableHead>
              <TableHead className="w-[300px]">关联对象</TableHead>
              <TableHead className="w-[60px] text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">加载中...</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">暂无岗位/课程，点击「添加岗位/课程」开始设置</TableCell></TableRow>
            ) : (
              rows.map((r) => {
                const isParent = r.linkType === "position" && r.positionId !== ""
                const isReadOnly = isParent
                const posLabel = positions.find((p) => p.id === r.positionId)?.name || ""
                const posScenarios = r.positionId ? (positionScenariosMap[r.positionId] || []) : []

                return (
                  <TableRow key={r.key} className={isParent ? "bg-blue-50/50 border-l-2 border-l-blue-400" : r.isPositionChild ? "bg-blue-50/20" : ""}>
                    <TableCell>
                      <Input className="h-8" value={r.name} onChange={(e) => updateRow(r.key, { name: e.target.value })} placeholder={r.isPositionChild ? "从场景自动填充" : "岗位/课程名称"} disabled={isReadOnly} />
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">{r.code || "-"}</span>
                    </TableCell>
                    <TableCell>
                      <Input className="h-8" type="number" min={0} step="0.5" value={r.credits} onChange={(e) => updateRow(r.key, { credits: Number(e.target.value) })} disabled={isReadOnly} />
                    </TableCell>
                    <TableCell>
                      <Input className="h-8" type="number" min={0} value={r.hours} onChange={(e) => updateRow(r.key, { hours: Number(e.target.value) })} disabled={isReadOnly} />
                    </TableCell>
                    <TableCell>
                      <Select value={r.nature} onValueChange={(v) => updateRow(r.key, { nature: v })} disabled={isReadOnly}>
                        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>{NATURE_OPTIONS.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {isParent ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1">
                            <Select value={r.linkType} onValueChange={(v) => {
                              const lt = v as LinkType
                              if (lt !== "position" && r.positionId) {
                                setRows((prev) => prev.filter((row) => !(row.isPositionChild && row.positionId === r.positionId)).map((row) => row.key === r.key ? { ...row, linkType: "none", positionId: "", scenarioId: "" } : row))
                              } else {
                                updateRow(r.key, { linkType: lt, scenarioId: "", courseId: "" })
                              }
                            }}>
                              <SelectTrigger className="h-8 w-[80px]"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">未关联</SelectItem>
                                <SelectItem value="position">岗位</SelectItem>
                                <SelectItem value="course">体系课</SelectItem>
                              </SelectContent>
                            </Select>
                            <Select value={r.positionId || "none"} onValueChange={(v) => handlePositionChange(r.key, v === "none" ? "" : v)}>
                              <SelectTrigger className="h-8 flex-1"><SelectValue placeholder="选择岗位" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">未选择</SelectItem>
                                {positions.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          {r.positionId && (
                            <div className="text-xs text-muted-foreground pl-1">
                              {loadingPosScen[r.positionId] ? "加载场景中..." : posScenarios.length > 0 ? `${posScenarios.length} 个场景已加载到下方` : "该岗位下暂无已发布场景"}
                            </div>
                          )}
                        </div>
                      ) : r.isPositionChild ? (
                        <span className="text-xs text-blue-600">{posLabel} → {r.name}</span>
                      ) : r.linkType === "course" ? (
                        <div className="flex items-center gap-1">
                          <Select value={r.linkType} onValueChange={(v) => updateRow(r.key, { linkType: v as LinkType, courseId: "", scenarioId: "" })}>
                            <SelectTrigger className="h-8 w-[80px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">未关联</SelectItem>
                              <SelectItem value="position">岗位</SelectItem>
                              <SelectItem value="course">体系课</SelectItem>
                            </SelectContent>
                          </Select>
                          <Select value={r.courseId || "none"} onValueChange={(v) => {
                            const courseId = v === "none" ? "" : v
                            const course = systemCourses.find((c) => c.id === courseId)
                            updateRow(r.key, { courseId, name: course ? course.name : r.name, code: course ? (course.code || "") : r.code, hours: course ? (course.onlineHours || 0) : r.hours })
                          }}>
                            <SelectTrigger className="h-8 flex-1"><SelectValue placeholder="选择体系课" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">未选择</SelectItem>
                              {systemCourses.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <Select value={r.linkType} onValueChange={(v) => updateRow(r.key, { linkType: v as LinkType, scenarioId: "", courseId: "" })}>
                            <SelectTrigger className="h-8 w-[80px]"><SelectValue placeholder="类型" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">未关联</SelectItem>
                              <SelectItem value="position">岗位</SelectItem>
                              <SelectItem value="course">体系课</SelectItem>
                            </SelectContent>
                          </Select>
                          <span className="text-xs text-muted-foreground">-</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-red-500 hover:text-red-600"
                        onClick={() => removeRow(r.key)}
                        title={isParent ? "删除此岗位及所有关联场景行" : ""}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
