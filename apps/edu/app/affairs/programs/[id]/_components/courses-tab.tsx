'use client'

import { useRef, useState, useEffect, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react'
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
import { useToast, TableEmptyRow } from '@zhiyu/ui'
import { programApi, scenarioApi, courseApi, positionApi } from '@/lib/api'
import type { Scenario, CareerPosition } from '@/lib/types'
import type { Course } from '@/lib/types/lesson'
import { ComboboxSelect } from '@/components/shared/combobox-select'
import { ProgramCourseImportDialog } from './program-course-import-dialog'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { useT } from '@/lib/i18n/locale-provider'
import { reportError } from '@/lib/error-handling'

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
  const t = useT()
  const [rows, setRows] = useState<CourseRow[]>([])
  const [systemCourses, setSystemCourses] = useState<Course[]>([])
  const [positions, setPositions] = useState<CareerPosition[]>([])
  const [positionScenariosMap, setPositionScenariosMap] = useState<Record<string, Scenario[]>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadingPosScen, setLoadingPosScen] = useState<Record<string, boolean>>({})
  const [importOpen, setImportOpen] = useState(false)
  // 加载时同岗位多条关联被合并为一行：记录各岗位合并前的条数，保存前提示折叠风险
  const [positionMergedCounts, setPositionMergedCounts] = useState<Record<string, number>>({})
  const [collapseConfirmOpen, setCollapseConfirmOpen] = useState(false)
  const [collapseConfirmInfo, setCollapseConfirmInfo] = useState<
    { pid: string; name: string; count: number }[]
  >([])

  useEffect(() => {
    onBusyChange?.({ saving, loading })
  }, [saving, loading, onBusyChange])

  // 请求序号：programId 快速切换时丢弃过期响应
  const loadSeqRef = useRef(0)

  const loadCourses = useCallback(async () => {
    const seq = ++loadSeqRef.current
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
        } catch (err) {
          reportError(err, '加载岗位场景')
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
      // 记录各岗位合并前的原始条数（>1 表示保存会折叠多条关联，需在保存前提示）
      const mergedCounts: Record<string, number> = {}
      grouped.forEach((v, pid) => {
        displayRows.push({
          ...v[0],
          key: `pos-${pid}-${Date.now()}`,
          linkType: 'position',
          positionId: pid,
        })
        if (v.length > 1) mergedCounts[pid] = v.length
      })
      if (seq !== loadSeqRef.current) return
      displayRows.push(...regular)
      setRows(displayRows)
      setPositionMergedCounts(mergedCounts)
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: t('加载失败'),
        description: err.message || t('查询课程设置失败'),
      })
    } finally {
      setLoading(false)
    }
  }, [programId, toast, t])

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

  const performSave = useCallback(async () => {
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
      toast({ title: t('已保存') })
      await loadCourses()
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: t('保存失败'),
        description: err.message || t('保存课程设置失败'),
      })
    } finally {
      setSaving(false)
    }
  }, [rows, programId, toast, loadCourses, t])

  const handleSave = useCallback(async () => {
    // 保存前区分原有分组行与新分组行：加载时同岗位多条关联被合并为一行，
    // 直接保存会把多条折叠为一条，其余记录的学分/学时等配置丢失 —— 先提示确认
    const affected = rows.filter(
      (r) =>
        r.linkType === 'position' &&
        r.positionId &&
        (positionMergedCounts[r.positionId] || 0) > 1,
    )
    const unique = [...new Map(affected.map((r) => [r.positionId as string, r])).values()]
    if (unique.length > 0) {
      setCollapseConfirmInfo(
        unique.map((r) => ({
          pid: r.positionId as string,
          name: positions.find((p) => p.id === r.positionId)?.name || r.name,
          count: positionMergedCounts[r.positionId as string] || 0,
        })),
      )
      setCollapseConfirmOpen(true)
      return
    }
    await performSave()
  }, [rows, positionMergedCounts, positions, performSave])

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
        {t('共 {n} 项，合计 {m} 学分', { n: courseCount, m: totalCredits })}
      </p>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[460px]">{t('关联对象')}</TableHead>
              <TableHead className="w-[120px]">{t('编码')}</TableHead>
              <TableHead className="w-[80px]">{t('学分')}</TableHead>
              <TableHead className="w-[80px]">{t('总学时')}</TableHead>
              <TableHead className="w-[100px]">{t('性质')}</TableHead>
              <TableHead className="w-[60px] text-right">{t('操作')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  {t('加载中...')}
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableEmptyRow colSpan={6}>{t('暂无，点击「添加岗位/课程」开始设置')}</TableEmptyRow>
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
                                <SelectItem value="none">{t('未关联')}</SelectItem>
                                <SelectItem value="position">{t('岗位')}</SelectItem>
                                <SelectItem value="course">{t('体系课')}</SelectItem>
                              </SelectContent>
                            </Select>
                            <ComboboxSelect
                              value={r.positionId}
                              onChange={(v) => handlePositionChange(r.key, v || '')}
                              options={positionOpts}
                              placeholder={t('搜索岗位...')}
                              emptyText={t('未找到岗位')}
                              className="flex-1"
                            />
                          </div>
                          {r.positionId && (
                            <div className="text-xs text-muted-foreground pl-1">
                              {loadingPosScen[r.positionId]
                                ? t('加载中...')
                                : posScenarios.length > 0
                                  ? t('包含 {n} 个场景：{names}', {
                                      n: posScenarios.length,
                                      names: posScenarios.map((s) => s.name).join('、'),
                                    })
                                  : t('该岗位下暂无已发布场景')}
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
                              <SelectItem value="none">{t('未关联')}</SelectItem>
                              <SelectItem value="position">{t('岗位')}</SelectItem>
                              <SelectItem value="course">{t('体系课')}</SelectItem>
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
                            placeholder={t('搜索体系课...')}
                            emptyText={t('未找到体系课')}
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
                                <SelectValue placeholder={t('类型')} />
                              </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">{t('未关联')}</SelectItem>
                              <SelectItem value="position">{t('岗位')}</SelectItem>
                              <SelectItem value="course">{t('体系课')}</SelectItem>
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
                              {t(n)}
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

      <ConfirmDialog
        open={collapseConfirmOpen}
        onOpenChange={setCollapseConfirmOpen}
        title={t('保存将合并岗位课程关联')}
        description={
          <div className="space-y-1">
            <p>{t('检测到以下岗位存在多条课程关联（可能由批量导入产生）：')}</p>
            <ul className="list-disc pl-4">
              {collapseConfirmInfo.map((c) => (
                <li key={c.pid}>
                  {c.name || c.pid}：{c.count} 条
                </li>
              ))}
            </ul>
            <p>{t('保存后每个岗位的多条关联将合并为一条，其余记录的学分/学时等配置将丢失。是否继续保存？')}</p>
          </div>
        }
        confirmText={t('仍要保存')}
        variant="destructive"
        onConfirm={async () => {
          setCollapseConfirmOpen(false)
          await performSave()
        }}
      />
    </div>
  )
})
