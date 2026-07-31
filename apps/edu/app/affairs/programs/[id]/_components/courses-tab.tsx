"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
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
import { ComboboxSelect } from "@/components/shared/combobox-select"

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
}

function emptyRow(key: string, position?: boolean): CourseRow {
  return { key, name: "", code: "", credits: 0, hours: 0, nature: "必修", linkType: position ? "position" : "none", scenarioId: "", courseId: "", positionId: "" }
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
      const loadedRows: CourseRow[] = res.items.map((c) => ({
        key: c.id, name: c.name, code: c.code || "", credits: c.credits, hours: c.hours,
        nature: c.nature || "必修",
        linkType: c.scenarioId ? "position" : c.courseId ? "course" : "none",
        scenarioId: c.scenarioId || "", courseId: c.courseId || "", positionId: "",
      }))
      const scenarioIds = loadedRows.filter((r) => r.scenarioId).map((r) => r.scenarioId) as string[]
      if (scenarioIds.length > 0) {
        try {
          const scenarioRes = await scenarioApi.list({ status: "published", limit: 1000 })
          const posMap: Record<string, string> = {}
          ;(scenarioRes.items || []).forEach((s) => {
            if (s.careerPositionId && scenarioIds.includes(s.id)) posMap[s.id] = s.careerPositionId
          })
          loadedRows.forEach((r) => {
            if (r.scenarioId && posMap[r.scenarioId]) r.positionId = posMap[r.scenarioId]
          })
        } catch { /* ignore */ }
      }
      const grouped = new Map<string, { posId: string; scenarios: CourseRow[] }>()
      const regular: CourseRow[] = []
      loadedRows.forEach((r) => {
        if (r.linkType === "position" && r.positionId) {
          const key = r.positionId
          const entry = grouped.get(key)
          if (entry) { entry.scenarios.push(r) } else { grouped.set(key, { posId: key, scenarios: [r] }) }
        } else {
          regular.push(r)
        }
      })
      const displayRows: CourseRow[] = []
      grouped.forEach((g) => {
        const first = g.scenarios[0]
        displayRows.push({ ...first, key: `pos-${g.posId}-${Date.now()}`, linkType: "position", positionId: g.posId })
      })
      displayRows.push(...regular)
      setRows(displayRows)
      for (const [posId, g] of grouped) {
        const scenarioIds = g.scenarios.map((s) => s.scenarioId)
        if (scenarioIds.length > 0) {
          try {
            const sn = await scenarioApi.list({ status: "published", limit: 1000 })
            const filtered = (sn.items || []).filter((s) => scenarioIds.includes(s.id))
            setPositionScenariosMap((prev) => ({ ...prev, [posId]: filtered }))
          } catch { /* ignore */ }
        }
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "加载失败", description: err.message || "查询课程设置失败" })
    } finally { setLoading(false) }
  }, [programId, toast])

  useEffect(() => { ;(async () => { await loadCourses() })() }, [loadCourses])

  useEffect(() => {
    let c = false
    ;(async () => { try { const r = await positionApi.list({ status: "published", limit: 200 }); if (!c) setPositions(r.items) } catch { /* ignore */ } })()
    return () => { c = true }
  }, [])

  useEffect(() => {
    let c = false
    ;(async () => { try { const r = await courseApi.list({ type: "system", status: "published", limit: 200 }); if (!c) setSystemCourses(r.items) } catch { /* ignore */ } })()
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
    setRows((prev) => [emptyRow(`new-${Date.now()}-${prev.length}`, true), ...prev])
  }

  const positionOpts = useMemo(() => positions.map((p) => ({ value: p.id, label: p.name })), [positions])
  const courseOpts = useMemo(() => systemCourses.map((c) => ({ value: c.id, label: c.name })), [systemCourses])

  const removeRow = (key: string) => {
    setRows((prev) => prev.filter((r) => r.key !== key))
  }

  const handlePositionChange = async (rowKey: string, newPositionId: string) => {
    if (!newPositionId || newPositionId === "none") {
      updateRow(rowKey, { positionId: "", scenarioId: "" })
      return
    }
    updateRow(rowKey, { positionId: newPositionId })
    fetchPositionScenarios(newPositionId)
  }

  const handleSave = async () => {
    const invalid = rows.find((r) => {
      if (r.linkType === "position" && r.positionId && (positionScenariosMap[r.positionId] || []).length > 0) return false
      return r.name.trim() === ""
    })
    if (invalid) {
      toast({ variant: "destructive", title: "无法保存", description: "每项岗位/课程需填写名称" })
      return
    }
    setSaving(true)
    try {
      const payloads: any[] = []
      rows.forEach((r, i) => {
        if (r.linkType === "position" && r.positionId) {
          const scenarios = positionScenariosMap[r.positionId] || []
          scenarios.forEach((s, si) => {
            payloads.push({
              name: s.name, code: s.code || undefined,
              credits: r.credits || 0, hours: r.hours || 0,
              theoryHours: 0, practiceHours: 0, semester: 1,
              nature: r.nature,
              assessment: undefined,
              scenarioId: s.id,
              courseId: undefined,
              sortOrder: i * 1000 + si,
            })
          })
        } else {
          payloads.push({
            name: r.name.trim(), code: r.code.trim() || undefined,
            credits: r.credits || 0, hours: r.hours || 0,
            theoryHours: 0, practiceHours: 0, semester: 1,
            nature: r.nature,
            assessment: undefined,
            scenarioId: undefined,
            courseId: r.linkType === "course" ? r.courseId || undefined : undefined,
            sortOrder: i * 1000,
          })
        }
      })
      await programApi.saveCourses(programId, payloads)
      toast({ title: "课程设置已保存" })
      await loadCourses()
    } catch (err: any) {
      toast({ variant: "destructive", title: "保存失败", description: err.message || "保存课程设置失败" })
    } finally { setSaving(false) }
  }

  const expandedPosIds = useMemo(() => {
    const ids = new Set<string>()
    rows.filter((r) => r.linkType === "position" && r.positionId).forEach((r) => ids.add(r.positionId))
    return ids
  }, [rows])

  const courseCount = useMemo(() => {
    let count = 0
    rows.forEach((r) => {
      if (r.linkType === "position" && r.positionId) {
        count += (positionScenariosMap[r.positionId] || []).length
      } else {
        count++
      }
    })
    return count
  }, [rows, positionScenariosMap])

  const totalCredits = useMemo(() => {
    let sum = 0
    rows.forEach((r) => {
      if (r.linkType === "position" && r.positionId) {
        sum += r.credits * (positionScenariosMap[r.positionId] || []).length
      } else {
        sum += r.credits || 0
      }
    })
    return sum
  }, [rows, positionScenariosMap])

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
                const isPos = r.linkType === "position" && r.positionId !== ""
                const posScenarios = r.positionId ? (positionScenariosMap[r.positionId] || []) : []

                return (
                  <TableRow key={r.key}>
                    <TableCell>
                      <Input className="h-8" value={r.name} onChange={(e) => updateRow(r.key, { name: e.target.value })} placeholder="岗位/课程名称" disabled={isPos} />
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">{r.code || "-"}</span>
                    </TableCell>
                    <TableCell>
                      <Input className="h-8" type="number" min={0} step="0.5" value={r.credits} onChange={(e) => updateRow(r.key, { credits: Number(e.target.value) })} disabled={isPos} />
                    </TableCell>
                    <TableCell>
                      <Input className="h-8" type="number" min={0} value={r.hours} onChange={(e) => updateRow(r.key, { hours: Number(e.target.value) })} disabled={isPos} />
                    </TableCell>
                    <TableCell>
                      <Select value={r.nature} onValueChange={(v) => updateRow(r.key, { nature: v })} disabled={isPos}>
                        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>{NATURE_OPTIONS.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {r.linkType === "position" ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1">
                            <Select value={r.linkType} onValueChange={(v) => {
                              const lt = v as LinkType
                              if (lt !== "position") updateRow(r.key, { linkType: "none", positionId: "", scenarioId: "" })
                              else updateRow(r.key, { linkType: lt, scenarioId: "", courseId: "" })
                            }}>
                              <SelectTrigger className="h-8 w-[80px]"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">未关联</SelectItem>
                                <SelectItem value="position">岗位</SelectItem>
                                <SelectItem value="course">体系课</SelectItem>
                              </SelectContent>
                            </Select>
                            <ComboboxSelect
                              value={r.positionId}
                              onChange={(v) => handlePositionChange(r.key, v || "")}
                              options={positionOpts}
                              placeholder="搜索岗位..."
                              emptyText="未找到岗位"
                              className="flex-1"
                            />
                          </div>
                          {r.positionId && (
                            <div className="text-xs text-muted-foreground pl-1">
                              {loadingPosScen[r.positionId] ? "加载中..." :
                                posScenarios.length > 0
                                  ? `包含 ${posScenarios.length} 个场景：${posScenarios.map((s) => s.name).join("、")}`
                                  : "该岗位下暂无已发布场景"}
                            </div>
                          )}
                        </div>
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
                          <ComboboxSelect
                            value={r.courseId}
                            onChange={(v) => {
                              const courseId = v || ""
                              const course = systemCourses.find((c) => c.id === courseId)
                              updateRow(r.key, { courseId, name: course ? course.name : r.name, code: course ? (course.code || "") : r.code, hours: course ? (course.onlineHours || 0) : r.hours })
                            }}
                            options={courseOpts}
                            placeholder="搜索体系课..."
                            emptyText="未找到体系课"
                            className="flex-1"
                          />
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
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-red-500 hover:text-red-600" onClick={() => removeRow(r.key)}>
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
