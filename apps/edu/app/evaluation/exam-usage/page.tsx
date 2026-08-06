'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Search, Clock, PlayCircle, CheckCircle2, Trash2, Eye, Send, PencilLine } from 'lucide-react'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

import { Textarea } from '@/components/ui/textarea'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { useData } from '@/components/providers/data-provider'
import { PageHeaderCard } from '@/components/shared/page-header-card'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { StatusBadge } from '@/components/shared/status-badge'
import { MultiOrgNodePicker } from '@/components/shared/multi-org-node-picker'
import { ExamActivationConfig } from '@/components/evaluation-rules/exam-activation-config'
import { useAuth } from '@/components/auth-provider'
import { examUsageApi } from '@/lib/api'
import type { ExamUsage } from '@/lib/types'
import { TableRowActions } from '@/components/shared/table-row-actions'
import { formatDate } from '@/lib/format-utils'
import { reportError } from '@/lib/error-handling'

const TARGET_TYPE_LABELS: Record<NonNullable<ExamUsage['targetType']>, string> = {
  class: '手动创建',
  major: '手动创建',
  department: '手动创建',
  public: '手动创建',
  task: '场景任务',
  node: '课程节点',
  course: '课程',
}

const STATUS_LABELS: Record<string, string> = {
  draft: '未开启',
  pending: '未开启',
  published: '已开启',
  in_progress: '已开启',
  finished: '已结束',
}

// 手动创建的考试安排目标类型（自动创建的不允许编辑/删除）
const MANUAL_TARGET_TYPES = ['class', 'major', 'department', 'public']

type FilterStatus = ExamUsage['status'] | 'all'

export default function ExamUsagePage() {
  const router = useRouter()
  const { exams } = useData()
  const { user } = useAuth()

  const [usages, setUsages] = useState<ExamUsage[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all')
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [createSubmitting, setCreateSubmitting] = useState(false)
  const [editingUsage, setEditingUsage] = useState<ExamUsage | null>(null)

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [deletingUsageId, setDeletingUsageId] = useState<string | null>(null)

  // 创建考试使用表单
  const [formExamId, setFormExamId] = useState('')
  const [formName, setFormName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formDuration, setFormDuration] = useState('')
  const [formStartTime, setFormStartTime] = useState('')
  const [formEndTime, setFormEndTime] = useState('')
  const [formClassIds, setFormClassIds] = useState<string[]>([])
  const [formActivationMode, setFormActivationMode] = useState<
    'manual' | 'scheduled' | 'always'
  >('manual')

  const loadUsages = async () => {
    setLoading(true)
    try {
      const res = await examUsageApi.list()
      setUsages(res.items)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // 初始加载：loading 初始值已为 true，无需在此同步设置
    const load = async () => {
      try {
        const res = await examUsageApi.list()
        setUsages(res.items)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const examMap = useMemo(() => {
    const map = new Map(exams.map((e) => [e.id, e]))
    return map
  }, [exams])

  const filteredUsages = useMemo(() => {
    return usages.filter((usage) => {
      const exam = examMap.get(usage.examId)
      const matchSearch =
        usage.name.toLowerCase().includes(search.toLowerCase()) ||
        (exam?.name || '').toLowerCase().includes(search.toLowerCase())
      const matchStatus =
        statusFilter === 'all' ||
        usage.status === statusFilter ||
        // 兼容旧数据：pending 归入未开启，in_progress 归入已开启
        (statusFilter === 'draft' && usage.status === 'pending') ||
        (statusFilter === 'published' && usage.status === 'in_progress')
      return matchSearch && matchStatus
    })
  }, [search, statusFilter, usages, examMap])

  const stats = useMemo(() => {
    return {
      total: usages.length,
      draft: usages.filter((u) => u.status === 'draft' || u.status === 'pending').length,
      published: usages.filter(
        (u) => u.status === 'published' || u.status === 'in_progress',
      ).length,
      finished: usages.filter((u) => u.status === 'finished').length,
    }
  }, [usages])

  const resetForm = () => {
    setFormExamId('')
    setFormName('')
    setFormDescription('')
    setFormDuration('')
    setFormStartTime('')
    setFormEndTime('')
    setFormClassIds([])
    setFormActivationMode('manual')
  }

  const openCreateDialog = () => {
    setEditingUsage(null)
    resetForm()
    setCreateDialogOpen(true)
  }

  // RFC3339 → datetime-local 值（UTC，与创建时提交格式一致）
  const toDatetimeLocal = (iso?: string) => {
    if (!iso) return ''
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ''
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
  }

  const openEditDialog = (usage: ExamUsage) => {
    setEditingUsage(usage)
    setFormExamId(usage.examId)
    setFormName(usage.name)
    setFormDescription(usage.description || '')
    setFormDuration(usage.duration != null ? String(usage.duration) : '')
    setFormStartTime(toDatetimeLocal(usage.startTime))
    setFormEndTime(toDatetimeLocal(usage.endTime))
    setFormClassIds(usage.targetIds || [])
    setFormActivationMode(
      (usage.activationMode as 'manual' | 'scheduled' | 'always') || 'manual',
    )
    setCreateDialogOpen(true)
  }

  const handleCreate = async () => {
    if (!formName || (!editingUsage && !formExamId)) return
    setCreateSubmitting(true)
    try {
      const payload = {
        name: formName,
        description: formDescription || undefined,
        duration: formDuration ? Number(formDuration) : undefined,
        startTime: formActivationMode === 'scheduled' ? formStartTime || undefined : undefined,
        endTime: formActivationMode === 'scheduled' ? formEndTime || undefined : undefined,
        targetType: 'class' as const,
        targetIds: formClassIds,
        activationMode: formActivationMode,
      }
      if (editingUsage) {
        await examUsageApi.update(editingUsage.id, payload)
      } else {
        await examUsageApi.create({
          ...payload,
          examId: formExamId,
          status: formActivationMode === 'always' ? 'published' : 'draft',
        })
      }
      setCreateDialogOpen(false)
      resetForm()
      setEditingUsage(null)
      await loadUsages()
    } catch (err) {
      reportError(err, editingUsage ? '编辑考试安排' : '创建考试安排')
    } finally {
      setCreateSubmitting(false)
    }
  }

  const handlePublish = async (id: string) => {
    try {
      await examUsageApi.publish(id)
    } catch (err) {
      reportError(err, '开启考试')
      return
    }
    await loadUsages()
  }

  const handleFinish = async (id: string) => {
    try {
      await examUsageApi.finish(id)
    } catch (err) {
      reportError(err, '停止考试')
      return
    }
    await loadUsages()
  }

  const openDeleteDialog = (id: string) => {
    setDeletingUsageId(id)
    setConfirmDeleteOpen(true)
  }

  const handleDelete = async () => {
    if (!deletingUsageId) return
    try {
      await examUsageApi.delete(deletingUsageId)
      setConfirmDeleteOpen(false)
      setDeletingUsageId(null)
      await loadUsages()
    } catch (err) {
      reportError(err, '删除考试安排')
    }
  }

  const canPublish = (status: ExamUsage['status']) => status === 'draft' || status === 'pending'
  const canFinish = (status: ExamUsage['status']) =>
    status === 'published' || status === 'in_progress'
  const canDelete = (usage: ExamUsage) =>
    (usage.status === 'draft' || usage.status === 'finished') &&
    (!usage.targetType || MANUAL_TARGET_TYPES.includes(usage.targetType))
  // 仅未开启的手动创建考试允许编辑（场景任务/课程节点跟随测评方式配置，不允许修改）
  const canEdit = (usage: ExamUsage) =>
    (usage.status === 'draft' || usage.status === 'pending') &&
    (!usage.targetType || MANUAL_TARGET_TYPES.includes(usage.targetType))

  const isFormValid = (editingUsage ? formName : formExamId && formName) && formClassIds.length > 0

  return (
    <div className="space-y-6">
      <PageHeaderCard
        title="考试管理"
        description="查看试卷在各模块的使用情况"
        actions={
          <Button onClick={openCreateDialog}>
            <Plus className="mr-2 size-4" />
            创建考试使用
          </Button>
        }
        stats={[
          {
            label: '考试总数',
            value: stats.total,
            icon: <Clock className="size-4 text-blue-500" />,
            iconClassName: 'bg-blue-50',
          },
          {
            label: '未开启',
            value: stats.draft,
            icon: <Clock className="size-4 text-gray-500" />,
            iconClassName: 'bg-gray-50',
          },
          {
            label: '已开启',
            value: stats.published,
            icon: <PlayCircle className="size-4 text-green-500" />,
            iconClassName: 'bg-green-50',
          },
          {
            label: '已结束',
            value: stats.finished,
            icon: <CheckCircle2 className="size-4 text-gray-500" />,
            iconClassName: 'bg-gray-50',
          },
        ]}
      />

      {/* 筛选栏 */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜索考试名称或关联试卷..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as FilterStatus)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="全部状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="draft">未开启</SelectItem>
            <SelectItem value="published">已开启</SelectItem>
            <SelectItem value="finished">已结束</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 使用记录列表 */}
      <div className="rounded-lg border bg-white px-4 py-3">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">考试名称</TableHead>
                <TableHead className="w-[180px]">关联试卷</TableHead>
                <TableHead className="w-[180px]">开放时间</TableHead>
                <TableHead className="w-[100px]">状态</TableHead>
                <TableHead className="w-[120px]">目标类型</TableHead>
                <TableHead className="sticky right-0 w-[140px] bg-white text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    加载中...
                  </TableCell>
                </TableRow>
              ) : filteredUsages.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    暂无使用记录
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsages.map((usage) => {
                  const exam = examMap.get(usage.examId)
                  return (
                    <TableRow key={usage.id} className="group">
                      <TableCell className="font-medium">{usage.name}</TableCell>
                      <TableCell>{exam?.name || '-'}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {usage.startTime || usage.endTime ? (
                          <div className="text-xs">
                            <div>{usage.startTime ? formatDate(usage.startTime) : '-'}</div>
                            <div>至 {usage.endTime ? formatDate(usage.endTime) : '-'}</div>
                          </div>
                        ) : (
                          <span className="text-xs">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={usage.status} label={STATUS_LABELS[usage.status]} />
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {usage.targetType ? TARGET_TYPE_LABELS[usage.targetType] : '-'}
                        </span>
                      </TableCell>
                      <TableRowActions className="sticky right-0 bg-white">
                        {canEdit(usage) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-gray-600 hover:text-gray-800"
                            onClick={() => openEditDialog(usage)}
                          >
                            <PencilLine className="mr-1 h-3 w-3" />
                            编辑
                          </Button>
                        )}
                        {canPublish(usage.status) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-primary hover:text-primary/90"
                            onClick={() => handlePublish(usage.id)}
                          >
                            <Send className="mr-1 h-3 w-3" />
                            开启
                          </Button>
                        )}
                        {canFinish(usage.status) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-amber-600 hover:text-amber-700"
                            onClick={() => handleFinish(usage.id)}
                          >
                            <CheckCircle2 className="mr-1 h-3 w-3" />
                            停止
                          </Button>
                        )}
                        {usage.status === 'finished' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() =>
                              router.push(`/evaluation/exam-usage/results?usageId=${usage.id}`)
                            }
                          >
                            <Eye className="mr-1 h-3 w-3" />
                            查看考试结果
                          </Button>
                        )}
                        {canDelete(usage) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-red-500 hover:text-red-600"
                            onClick={() => openDeleteDialog(usage.id)}
                          >
                            <Trash2 className="mr-1 h-3 w-3" />
                            删除
                          </Button>
                        )}
                      </TableRowActions>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* 创建/编辑考试使用弹窗 */}
      <Dialog
        open={createDialogOpen}
        onOpenChange={(open) => {
          setCreateDialogOpen(open)
          if (!open) setEditingUsage(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingUsage ? '编辑考试' : '创建考试使用'}</DialogTitle>
            <DialogDescription>
              {editingUsage ? '修改考试信息，保存后立即生效' : '选择试卷并配置考试使用信息'}
            </DialogDescription>
          </DialogHeader>
          <FieldGroup className="py-4">
            {!editingUsage && (
              <Field>
                <FieldLabel>选择试卷 *</FieldLabel>
                <Select value={formExamId} onValueChange={setFormExamId}>
                  <SelectTrigger>
                    <SelectValue placeholder="请选择一份试卷" />
                  </SelectTrigger>
                  <SelectContent>
                    {exams
                      .filter((exam) => exam.status === 'published')
                      .map((exam) => (
                        <SelectItem key={exam.id} value={exam.id}>
                          {exam.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </Field>
            )}

            <Field>
              <FieldLabel>考试名称 *</FieldLabel>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="请输入考试名称"
              />
            </Field>

            <Field>
              <FieldLabel>描述</FieldLabel>
              <Textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="请输入描述（可选）"
                rows={2}
              />
            </Field>

            <Field>
              <FieldLabel>时长/分钟</FieldLabel>
              <Input
                type="number"
                value={formDuration}
                onChange={(e) => setFormDuration(e.target.value)}
                placeholder="请输入考试时长"
                min={0}
              />
            </Field>

            <Field>
              <FieldLabel>启用条件</FieldLabel>
              <ExamActivationConfig
                value={{
                  activationMode: formActivationMode,
                  scheduledTime: formStartTime,
                  scheduledEndTime: formEndTime,
                }}
                onChange={(updates) => {
                  if (updates.activationMode)
                    setFormActivationMode(updates.activationMode as 'manual' | 'scheduled' | 'always')
                  if (updates.scheduledTime !== undefined) setFormStartTime(updates.scheduledTime)
                  if (updates.scheduledEndTime !== undefined)
                    setFormEndTime(updates.scheduledEndTime)
                }}
              />
              <p className="text-xs text-muted-foreground mt-1">
                随时作答创建后立即开放；定时/手动启停创建为未开启，到时间或手动开启后开放
              </p>
            </Field>

            <Field>
              <FieldLabel>参与班级 *</FieldLabel>
              <MultiOrgNodePicker
                tenantId={user?.tenantId}
                value={formClassIds}
                onChange={setFormClassIds}
                selectableTypes={['班级']}
                title="选择参与班级"
                maxVisible={3}
              />
              <p className="text-xs text-muted-foreground mt-1">
                仅所选班级的学生可见并可参加该考试
              </p>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateDialogOpen(false)}
              disabled={createSubmitting}
            >
              取消
            </Button>
            <Button onClick={handleCreate} disabled={!isFormValid || createSubmitting}>
              {createSubmitting ? '提交中...' : editingUsage ? '保存' : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认弹窗 */}
      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title="删除考试使用"
        description="删除后无法恢复，确定要删除吗？"
        onConfirm={handleDelete}
      />
    </div>
  )
}
