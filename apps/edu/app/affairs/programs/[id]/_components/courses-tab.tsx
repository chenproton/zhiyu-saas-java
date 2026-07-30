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
import { programApi, scenarioApi, courseApi } from "@/lib/api"
import type { Scenario } from "@/lib/types"
import type { Course } from "@/lib/types/lesson"

const NATURE_OPTIONS = ["必修", "选修", "实践", "场景"]
const ASSESSMENT_OPTIONS = ["考试", "考查", "场景测评"]

type LinkType = "none" | "scenario" | "course"

interface CourseRow {
  key: string
  name: string
  code: string
  credits: number
  hours: number
  theoryHours: number
  practiceHours: number
  semester: number
  nature: string
  assessment: string
  linkType: LinkType
  scenarioId: string
  courseId: string
}

function emptyRow(key: string, semester: number): CourseRow {
  return {
    key,
    name: "",
    code: "",
    credits: 0,
    hours: 0,
    theoryHours: 0,
    practiceHours: 0,
    semester,
    nature: "必修",
    assessment: "",
    linkType: "none",
    scenarioId: "",
    courseId: "",
  }
}

export function ProgramCoursesTab({ programId }: { programId: string }) {
  const { toast } = useToast()
  const [rows, setRows] = useState<CourseRow[]>([])
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [systemCourses, setSystemCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const loadCourses = useCallback(async () => {
    try {
      const res = await programApi.listCourses(programId)
      setRows(
        res.items.map((c) => ({
          key: c.id,
          name: c.name,
          code: c.code || "",
          credits: c.credits,
          hours: c.hours,
          theoryHours: c.theoryHours,
          practiceHours: c.practiceHours,
          semester: c.semester,
          nature: c.nature || "必修",
          assessment: c.assessment || "",
          linkType: c.scenarioId ? "scenario" : c.courseId ? "course" : "none",
          scenarioId: c.scenarioId || "",
          courseId: c.courseId || "",
        })),
      )
    } catch (err: any) {
      toast({ variant: "destructive", title: "加载失败", description: err.message || "查询课程设置失败" })
    } finally {
      setLoading(false)
    }
  }, [programId, toast])

  useEffect(() => {
    // 首屏加载：async IIFE 包裹，避免在 effect 体内同步触发 setState
    ;(async () => {
      await loadCourses()
    })()
  }, [loadCourses])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await scenarioApi.list({ status: "published", limit: 200 })
        if (!cancelled) setScenarios(res.items)
      } catch {
        // 场景列表加载失败不阻断课程设置，仅无法选择关联场景
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await courseApi.list({ type: "system", status: "published", limit: 200 })
        if (!cancelled) setSystemCourses(res.items)
      } catch {
        // 体系课列表加载失败不阻断课程设置
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const updateRow = (key: string, patch: Partial<CourseRow>) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }

  const addRow = () => {
    const maxSemester = rows.reduce((m, r) => Math.max(m, r.semester), 1)
    setRows((prev) => [...prev, emptyRow(`new-${Date.now()}-${prev.length}`, maxSemester)])
  }

  const removeRow = (key: string) => {
    setRows((prev) => prev.filter((r) => r.key !== key))
  }

  const handleSave = async () => {
    const invalid = rows.find((r) => r.name.trim() === "" || r.semester <= 0)
    if (invalid) {
      toast({ variant: "destructive", title: "无法保存", description: "每门课程需填写名称且学期大于 0" })
      return
    }
    setSaving(true)
    try {
      await programApi.saveCourses(
        programId,
        rows.map((r, i) => ({
          name: r.name.trim(),
          code: r.code.trim() || undefined,
          credits: r.credits || 0,
          hours: r.hours || 0,
          theoryHours: r.theoryHours || 0,
          practiceHours: r.practiceHours || 0,
          semester: r.semester,
          nature: r.nature,
          assessment: r.assessment || undefined,
          scenarioId: r.linkType === "scenario" ? r.scenarioId || undefined : undefined,
          courseId: r.linkType === "course" ? r.courseId || undefined : undefined,
          sortOrder: i,
        })),
      )
      toast({ title: "课程设置已保存" })
      await loadCourses()
    } catch (err: any) {
      toast({ variant: "destructive", title: "保存失败", description: err.message || "保存课程设置失败" })
    } finally {
      setSaving(false)
    }
  }

  const totalCredits = rows.reduce((sum, r) => sum + (r.credits || 0), 0)

  return (
    <div className="rounded-lg border bg-white px-4 py-3 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          共 {rows.length} 门课程，合计 {totalCredits} 学分；通过「关联对象」可将课程关联至已发布场景或体系课
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={addRow}>
            <Plus className="mr-1 size-4" />
            添加课程
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving || loading}>
            <Save className="mr-1 size-4" />
            {saving ? "保存中..." : "保存课程设置"}
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[180px]">课程名称 *</TableHead>
              <TableHead className="w-[100px]">编码</TableHead>
              <TableHead className="w-[70px]">学分</TableHead>
              <TableHead className="w-[70px]">总学时</TableHead>
              <TableHead className="w-[70px]">理论</TableHead>
              <TableHead className="w-[70px]">实践</TableHead>
              <TableHead className="w-[70px]">学期 *</TableHead>
              <TableHead className="w-[100px]">性质</TableHead>
              <TableHead className="w-[110px]">考核方式</TableHead>
              <TableHead className="w-[160px]">关联对象</TableHead>
              <TableHead className="w-[60px] text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={11} className="h-24 text-center text-muted-foreground">
                  加载中...
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="h-24 text-center text-muted-foreground">
                  暂无课程，点击「添加课程」开始设置
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.key}>
                  <TableCell>
                    <Input
                      className="h-8"
                      value={r.name}
                      onChange={(e) => updateRow(r.key, { name: e.target.value })}
                      placeholder="课程名称"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      className="h-8"
                      value={r.code}
                      onChange={(e) => updateRow(r.key, { code: e.target.value })}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      className="h-8"
                      type="number"
                      min={0}
                      step="0.5"
                      value={r.credits}
                      onChange={(e) => updateRow(r.key, { credits: Number(e.target.value) })}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      className="h-8"
                      type="number"
                      min={0}
                      value={r.hours}
                      onChange={(e) => updateRow(r.key, { hours: Number(e.target.value) })}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      className="h-8"
                      type="number"
                      min={0}
                      value={r.theoryHours}
                      onChange={(e) => updateRow(r.key, { theoryHours: Number(e.target.value) })}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      className="h-8"
                      type="number"
                      min={0}
                      value={r.practiceHours}
                      onChange={(e) => updateRow(r.key, { practiceHours: Number(e.target.value) })}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      className="h-8"
                      type="number"
                      min={1}
                      value={r.semester}
                      onChange={(e) => updateRow(r.key, { semester: Number(e.target.value) })}
                    />
                  </TableCell>
                  <TableCell>
                    <Select value={r.nature} onValueChange={(v) => updateRow(r.key, { nature: v })}>
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {NATURE_OPTIONS.map((n) => (
                          <SelectItem key={n} value={n}>
                            {n}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={r.assessment || "none"}
                      onValueChange={(v) => updateRow(r.key, { assessment: v === "none" ? "" : v })}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="-" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">未设置</SelectItem>
                        {ASSESSMENT_OPTIONS.map((a) => (
                          <SelectItem key={a} value={a}>
                            {a}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Select
                        value={r.linkType}
                        onValueChange={(v) => {
                          const lt = v as LinkType
                          updateRow(r.key, { linkType: lt, scenarioId: lt === "scenario" ? r.scenarioId : "", courseId: lt === "course" ? r.courseId : "" })
                        }}
                      >
                        <SelectTrigger className="h-8 w-[80px]">
                          <SelectValue placeholder="类型" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">未关联</SelectItem>
                          <SelectItem value="scenario">场景</SelectItem>
                          <SelectItem value="course">体系课</SelectItem>
                        </SelectContent>
                      </Select>
                      {r.linkType === "scenario" ? (
                        <Select
                          value={r.scenarioId || "none"}
                          onValueChange={(v) => {
                            const scenarioId = v === "none" ? "" : v
                            const scenario = scenarios.find((s) => s.id === scenarioId)
                            updateRow(r.key, {
                              scenarioId,
                              name: scenario ? scenario.name : r.name,
                              code: scenario ? (scenario.code || "") : r.code,
                            })
                          }}
                        >
                          <SelectTrigger className="h-8 flex-1">
                            <SelectValue placeholder="选择场景" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">未选择</SelectItem>
                            {scenarios.map((s) => (
                              <SelectItem key={s.id} value={s.id}>
                                {s.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : r.linkType === "course" ? (
                        <Select
                          value={r.courseId || "none"}
                          onValueChange={(v) => {
                            const courseId = v === "none" ? "" : v
                            const course = systemCourses.find((c) => c.id === courseId)
                            updateRow(r.key, {
                              courseId,
                              name: course ? course.name : r.name,
                              code: course ? (course.code || "") : r.code,
                              hours: course ? (course.onlineHours || 0) : r.hours,
                            })
                          }}
                        >
                          <SelectTrigger className="h-8 flex-1">
                            <SelectValue placeholder="选择体系课" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">未选择</SelectItem>
                            {systemCourses.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-red-500 hover:text-red-600"
                      onClick={() => removeRow(r.key)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
