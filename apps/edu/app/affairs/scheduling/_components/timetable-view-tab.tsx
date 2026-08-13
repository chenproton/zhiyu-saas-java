'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast, EmptyState } from '@zhiyu/ui'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { OrgNodePicker } from '@/components/shared/org-node-picker'
import { ScheduleGrid } from '@/components/shared/schedule-grid'
import { usePortalAuth } from '@/contexts/portal-auth-context'
import { usePortalUsers } from '@/hooks/use-portal-users'
import { useOrgTree } from '@/hooks/use-org-tree'
import { periodSlotApi, scheduleApi } from '@/lib/api'
import type { AffairsTerm, PeriodSlot, ScheduleEntry } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n/locale-provider'

type ViewMode = 'class' | 'teacher'

interface TimetableViewTabProps {
  term: AffairsTerm | null
}

/** Tab3 课表视图与发布：班级/教师双视角 + 周次筛选 + 发布 */
export function TimetableViewTab({ term }: TimetableViewTabProps) {
  const { toast } = useToast()
  const t = useT()
  const { tenantId } = usePortalAuth()
  const { users: teachers, loading: teachersLoading } = usePortalUsers({
    roleCode: 'teacher',
    pageSize: 100,
  })
  const { orgTree, orgTypeMap } = useOrgTree(tenantId)

  const [viewMode, setViewMode] = useState<ViewMode>('class')
  const [viewStatus, setViewStatus] = useState<'draft' | 'published'>('draft')
  const [classNodeId, setClassNodeId] = useState<string | undefined>(undefined)
  const [teacherId, setTeacherId] = useState('')
  const [week, setWeek] = useState('')
  const [entries, setEntries] = useState<ScheduleEntry[]>([])
  const [version, setVersion] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [periodSlots, setPeriodSlots] = useState<PeriodSlot[]>([])
  const [publishOpen, setPublishOpen] = useState(false)
  const [publishing, setPublishing] = useState(false)

  // 默认填充：未选择班级/教师时自动选中第一个班级节点或第一位教师，保证课表有数据可看
  const firstClassNodeId = useMemo(() => {
    const walk = (nodes: typeof orgTree): string | undefined => {
      for (const node of nodes) {
        if (orgTypeMap.get(node.typeId)?.name === '班级') return node.id
        const found = node.children ? walk(node.children) : undefined
        if (found) return found
      }
      return undefined
    }
    return walk(orgTree)
  }, [orgTree, orgTypeMap])

  useEffect(() => {
    if (!term) return
    if (viewMode === 'class' && !classNodeId && firstClassNodeId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setClassNodeId(firstClassNodeId)
    }
    if (viewMode === 'teacher' && !teacherId && teachers.length > 0) {
      setTeacherId(teachers[0].id)
    }
  }, [term, viewMode, classNodeId, teacherId, firstClassNodeId, teachers])

  const loadTimetable = useCallback(async () => {
    if (!term) return
    const params =
      viewMode === 'class'
        ? classNodeId
          ? { termId: term.id, classNodeId, status: viewStatus }
          : null
        : teacherId
          ? { termId: term.id, teacherId, status: viewStatus }
          : null
    if (!params) {
      setEntries([])
      setVersion(null)
      return
    }
    setLoading(true)
    try {
      const res = await scheduleApi.timetable(params)
      setEntries(res.items ?? [])
      setVersion(res.version)
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: t('加载失败'),
        description: err.message || t('查询课表失败'),
      })
    } finally {
      setLoading(false)
    }
  }, [term, viewMode, classNodeId, teacherId, viewStatus, toast, t])

  useEffect(() => {
    // 数据加载：async IIFE 包裹，避免在 effect 体内同步触发 setState
    ;(async () => {
      await loadTimetable()
    })()
  }, [loadTimetable])

  useEffect(() => {
    ;(async () => {
      try {
        const res = await periodSlotApi.list({ limit: 100 })
        setPeriodSlots(res.items)
      } catch {
        // 节次缺失时网格自动从排课数据推导行，无需提示
      }
    })()
  }, [])

  const handlePublish = async () => {
    if (!term) return
    setPublishing(true)
    try {
      const res = await scheduleApi.publish(term.id)
      toast({
        title: t('课表已发布'),
        description: t('本次发布 {n} 条，当前版本 v{v}，学生/教师工作台已可见', {
          n: res.published,
          v: res.version,
        }),
      })
      setPublishOpen(false)
      await loadTimetable()
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: t('发布失败'),
        description: err.message || t('发布课表失败'),
      })
    } finally {
      setPublishing(false)
    }
  }

  if (!term) {
    return (
      <EmptyState
        title={t('请先在顶部选择学期（无学期时请先在「教务基础配置」中创建）')}
        className="rounded-lg border bg-white py-16"
      />
    )
  }

  return (
    <div className="space-y-4">
      {/* 工具行 */}
      <div className="flex flex-col gap-3 rounded-lg border bg-white p-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          {/* 视角切换 */}
          <div className="flex items-center rounded-lg border p-0.5">
            {(['class', 'teacher'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm font-medium transition-all',
                  viewMode === mode
                    ? 'bg-primary text-white'
                    : 'text-gray-500 hover:text-gray-900',
                )}
              >
                {mode === 'class' ? t('班级视图') : t('教师视图')}
              </button>
            ))}
          </div>

          {/* 状态切换：草稿/已发布 */}
          <div className="flex items-center rounded-lg border p-0.5">
            {(['draft', 'published'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setViewStatus(s)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm font-medium transition-all',
                  viewStatus === s ? 'bg-primary text-white' : 'text-gray-500 hover:text-gray-900',
                )}
              >
                {s === 'draft' ? t('草稿') : t('已发布')}
              </button>
            ))}
          </div>

          {viewMode === 'class' ? (
            <div className="w-[240px]">
              <OrgNodePicker
                tenantId={tenantId}
                value={classNodeId}
                onChange={setClassNodeId}
                selectableTypes={['班级']}
                placeholder={t('选择班级')}
                title={t('选择班级')}
              />
            </div>
          ) : (
            <Select value={teacherId} onValueChange={setTeacherId}>
              <SelectTrigger className="w-[240px]">
                <SelectValue placeholder={teachersLoading ? t('加载中...') : t('选择教师')} />
              </SelectTrigger>
              <SelectContent>
                {teachers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                    {u.workId ? `（${u.workId}）` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* 周次筛选 */}
          <Select value={week || 'all'} onValueChange={(v) => setWeek(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('全部周次')}</SelectItem>
              {Array.from({ length: term.weeksCount || 16 }, (_, i) => i + 1).map((w) => (
                <SelectItem key={w} value={String(w)}>
                  {t('第 {n} 周', { n: w })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {version != null && (
            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-600">
              {t('已发布版本 v{v}', { v: version })}
            </span>
          )}
        </div>

        <Button onClick={() => setPublishOpen(true)}>
          <Send className="mr-2 size-4" />
          {t('发布课表')}
        </Button>
      </div>

      {/* 课表网格（只读，默认已发布数据） */}
      <div className="rounded-lg border bg-white p-3">
        <ScheduleGrid
          entries={entries}
          periodSlots={periodSlots}
          week={week ? Number(week) : undefined}
          loading={loading}
          emptyText={
            viewMode === 'class'
              ? classNodeId
                ? t('该班级当前学期暂无已发布课表')
                : t('请选择班级查看课表')
              : teacherId
                ? t('该教师当前学期暂无已发布课表')
                : t('请选择教师查看课表')
          }
        />
      </div>

      <ConfirmDialog
        open={publishOpen}
        onOpenChange={setPublishOpen}
        title={t('发布课表')}
        description={t('确定发布「{name}」的全部草稿排课吗？发布后版本号 +1，学生/教师工作台即可查看。', {
          name: term.name,
        })}
        confirmText={publishing ? t('发布中...') : t('确认发布')}
        onConfirm={handlePublish}
      />
    </div>
  )
}
