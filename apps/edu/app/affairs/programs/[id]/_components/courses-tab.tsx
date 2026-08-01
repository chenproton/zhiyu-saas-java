'use client'

import { useState, useEffect, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@zhiyu/ui'
import { programApi, scenarioApi, courseApi, positionApi } from '@/lib/api'
import type { Scenario, CareerPosition } from '@/lib/types'
import type { Course } from '@/lib/types/lesson'
import { ComboboxSelect } from '@/components/shared/combobox-select'
import { ProgramCourseImportDialog } from './program-course-import-dialog'

const NATURE_OPTIONS = ['必修', '选修', '实践', '场景']

type LinkType = 'none' | 'position' | 'course'

interface CourseRow {
  key: string
  name: string
  code: string
  credits: number
  hours: number
  nature: string
  linkType: LinkType
  courseId: string
  positionId: string
}

function emptyRow(key: string, position?: boolean): CourseRow {
  return {
    key,
    name: '',
    code: '',
    credits: 0,
    hours: 0,
    nature: '必修',
    linkType: position ? 'position' : 'none',
    courseId: '',
    positionId: '',
  }
}

export const ProgramCoursesTab = forwardRef(function ProgramCoursesTab(
  {
    programId,
    onBusyChange,
  }: { programId: string; onBusyChange?: (s: { saving: boolean; loading: boolean }) => void },
  ref: any,
) {
  const { toast } = useToast()
  const [rows, setRows] = useState<CourseRow[]>([])
  const [systemCourses, setSystemCourses] = useState<Course[]>([])
  const [positions, setPositions] = useState<CareerPosition[]>([])
  const [positionScenariosMap, setPositionScenariosMap] = useState<Record<string, Scenario[]>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadingPosScen, setLoadingPosScen] = useState<Record<string, boolean>>({})
  const [importOpen, setImportOpen] = useState(false)

  useEffect(() => {
    onBusyChange?.({ saving, loading })
  }, [saving, loading, onBusyChange])

  const loadCourses = useCallback(async () => {
    try {
      const res = await programApi.listCourses(programId)
      const loadedRows: CourseRow[] = res.items.map((c) => ({
        key: c.id,
        name: c.name,
        code: c.code || '',
        credits: c.credits,
        hours: c.hours,
        nature: c.nature || '必修',
        linkType: c.positionId ? 'position' : c.courseId ? 'course' : 'none',
        courseId: c.courseId || '',
        positionId: c.positionId || '',
      }))
      const posIds = [...new Set(loadedRows.filter((r) => r.positionId).map((r) => r.positionId))]
      for (const pid of posIds) {
        try {
          const s = await scenarioApi.list({
            careerPositionId: pid,
            status: 'published',
            limit: 200,
          })
          setPositionScenariosMap((prev) => ({ ...prev, [pid]: s.items }))
        } catch {
          /* ignore */
        }
      }
      const grouped = new Map<string, CourseRow[]>()
      const regular: CourseRow[] = []
      loadedRows.forEach((r) => {
        if (r.linkType === 'position' && r.positionId) {
          const g = grouped.get(r.positionId) || []
          g.push(r)
          grouped.set(r.positionId, g)
        } else {
          regular.push(r)
        }
      })
      const displayRows: CourseRow[] = []
      grouped.forEach((v, pid) => {
        displayRows.push({
          ...v[0],
          key: `pos-${pid}-${Date.now()}`,
          linkType: 'position',
          positionId: pid,
        })
      })
      displayRows.push(...regular)
      setRows(displayRows)
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: '加载失败',
        description: err.message || '查询课程设置失败',
      })
    } finally {
      setLoading(false)
    }
  }, [programId, toast])

  useEffect(() => {
    ;(async () => {
      await loadCourses()
    })()
  }, [loadCourses])

  useEffect(() => {
    let c = false
    ;(async () => {
      try {
        const r = await positionApi.list({ status: 'published', limit: 200 })
        if (!c) setPositions(r.items)
      } catch {
        /* ignore */
      }
    })()
    return () => {
      c = true
    }
  }, [])
  useEffect(() => {
    let c = false
    ;(async () => {
      try {
        const r = await courseApi.list({ type: 'system', status: 'published', limit: 200 })
        if (!c) setSystemCourses(r.items)
      } catch {
        /* ignore */
      }
    })()
    return () => {
      c = true
    }
  }, [])

  const fetchPositionScenarios = useCallback(
    async (positionId: string) => {
      if (positionScenariosMap[positionId]) return positionScenariosMap[positionId]
      setLoadingPosScen((p) => ({ ...p, [positionId]: true }))
      try {
        const res = await scenarioApi.list({
          careerPositionId: positionId,
          status: 'published',
          limit: 200,
        })
        setPositionScenariosMap((p) => ({ ...p, [positionId]: res.items || [] }))
        return res.items || []
      } catch {
        return []
      } finally {
        setLoadingPosScen((p) => ({ ...p, [positionId]: false }))
      }
    },
    [positionScenariosMap],
  )

  const updateRow = (key: string, patch: Partial<CourseRow>) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }
  const addRow = useCallback(() => {
    setRows((prev) => [emptyRow(`new-${Date.now()}-${prev.length}`, true), ...prev])
  }, [])
  const removeRow = (key: string) => {
    setRows((prev) => prev.filter((r) => r.key !== key))
  }

  const handlePositionChange = async (rowKey: string, newPositionId: string) => {
    if (!newPositionId || newPositionId === 'none') {
      updateRow(rowKey, { positionId: '' })
      return
    }
    updateRow(rowKey, { positionId: newPositionId })
    fetchPositionScenarios(newPositionId)
  }

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      const payloads: any[] = []
      rows.forEach((r, i) => {
        if (r.linkType === 'position' && r.positionId) {
          payloads.push({
            credits: r.credits || 0,
            hours: r.hours || 0,
            semester: 1,
            nature: r.nature,
            assessment: undefined,
            positionId: r.positionId,
            courseId: undefined,
            sortOrder: i * 1000,
          })
        } else if (r.linkType === 'course' && r.courseId) {
          payloads.push({
            code: r.code.trim() || undefined,
            credits: r.credits || 0,
            hours: r.hours || 0,
            semester: 1,
            nature: r.nature,
            assessment: undefined,
            positionId: undefined,
            courseId: r.courseId,
            sortOrder: i * 1000,
          })
        }
      })
      await programApi.saveCourses(programId, payloads)
      toast({ title: '已保存' })
      await loadCourses()
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: '保存失败',
        description: err.message || '保存课程设置失败',
      })
    } finally {
      setSaving(false)
    }
  }, [rows, programId, toast, loadCourses])

  useImperativeHandle(
    ref,
    () => ({ handleSave, saving, loading, addRow, openImport: () => setImportOpen(true) }),
    [handleSave, saving, loading, addRow],
  )

  const courseCount = useMemo(() => {
    let n = 0
    rows.forEach((r) => {
      if (r.linkType === 'position' && r.positionId)
        n += (positionScenariosMap[r.positionId] || []).length
      else if (r.linkType !== 'none' && (r.courseId || r.positionId)) n++
    })
    return n
  }, [rows, positionScenariosMap])
  const totalCredits = useMemo(() => {
    let s = 0
    rows.forEach((r) => {
      s +=
        (r.credits || 0) *
        (r.linkType === 'position' && r.positionId
          ? (positionScenariosMap[r.positionId] || []).length || 1
          : 1)
    })
    return s
  }, [rows, positionScenariosMap])

  const positionOpts = useMemo(
    () => positions.map((p) => ({ value: p.id, label: p.name })),
    [positions],
  )
  const courseOpts = useMemo(
    () => systemCourses.map((c) => ({ value: c.id, label: c.name })),
    [systemCourses],
  )

  return (
    <div className="rounded-lg border bg-white px-4 py-3 space-y-3">
      <p className="text-sm text-muted-foreground">
        共 {courseCount} 项，合计 {totalCredits} 学分
      </p>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[460px]">关联对象</TableHead>
              <TableHead className="w-[120px]">编码</TableHead>
              <TableHead className="w-[80px]">学分</TableHead>
              <TableHead className="w-[80px]">总学时</TableHead>
              <TableHead className="w-[100px]">性质</TableHead>
              <TableHead className="w-[60px] text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  加载中...
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  暂无，点击「添加岗位/课程」开始设置
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => {
                const posScenarios = r.positionId ? positionScenariosMap[r.positionId] || [] : []
                return (
                  <TableRow key={r.key}>
                    <TableCell>
                      {r.linkType === 'position' ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1">
                            <Select
                              value={r.linkType}
                              onValueChange={(v) => {
                                updateRow(r.key, {
                                  linkType: v as LinkType,
                                  positionId: '',
                                  courseId: '',
                                })
                              }}
                            >
                              <SelectTrigger className="h-8 w-[80px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">未关联</SelectItem>
                                <SelectItem value="position">岗位</SelectItem>
                                <SelectItem value="course">体系课</SelectItem>
                              </SelectContent>
                            </Select>
                            <ComboboxSelect
                              value={r.positionId}
                              onChange={(v) => handlePositionChange(r.key, v || '')}
                              options={positionOpts}
                              placeholder="搜索岗位..."
                              emptyText="未找到岗位"
                              className="flex-1"
                            />
                          </div>
                          {r.positionId && (
                            <div className="text-xs text-muted-foreground pl-1">
                              {loadingPosScen[r.positionId]
                                ? '加载中...'
                                : posScenarios.length > 0
                                  ? `包含 ${posScenarios.length} 个场景：${posScenarios.map((s) => s.name).join('、')}`
                                  : '该岗位下暂无已发布场景'}
                            </div>
                          )}
                        </div>
                      ) : r.linkType === 'course' ? (
                        <div className="flex items-center gap-1">
                          <Select
                            value={r.linkType}
                            onValueChange={(v) =>
                              updateRow(r.key, {
                                linkType: v as LinkType,
                                courseId: '',
                                positionId: '',
                              })
                            }
                          >
                            <SelectTrigger className="h-8 w-[80px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">未关联</SelectItem>
                              <SelectItem value="position">岗位</SelectItem>
                              <SelectItem value="course">体系课</SelectItem>
                            </SelectContent>
                          </Select>
                          <ComboboxSelect
                            value={r.courseId}
                            onChange={(v) => {
                              const cid = v || ''
                              const course = systemCourses.find((c) => c.id === cid)
                              updateRow(r.key, {
                                courseId: cid,
                                name: course ? course.name : r.name,
                                code: course ? course.code || '' : r.code,
                                hours: course ? course.onlineHours || 0 : r.hours,
                              })
                            }}
                            options={courseOpts}
                            placeholder="搜索体系课..."
                            emptyText="未找到体系课"
                            className="flex-1"
                          />
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <Select
                            value={r.linkType}
                            onValueChange={(v) =>
                              updateRow(r.key, {
                                linkType: v as LinkType,
                                positionId: '',
                                courseId: '',
                              })
                            }
                          >
                            <SelectTrigger className="h-8 w-[80px]">
                              <SelectValue placeholder="类型" />
                            </SelectTrigger>
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
                    <TableCell>
                      <span className="text-sm text-muted-foreground">{r.code || '-'}</span>
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
                      <Select
                        value={r.nature}
                        onValueChange={(v) => updateRow(r.key, { nature: v })}
                      >
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
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <ProgramCourseImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        programId={programId}
        onImported={loadCourses}
      />
    </div>
  )
})
