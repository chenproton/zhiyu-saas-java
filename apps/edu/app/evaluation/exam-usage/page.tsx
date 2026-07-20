"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Plus, Search, Clock, PlayCircle, CheckCircle2, Trash2, Eye, MoreHorizontal } from "lucide-react"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { useData } from "@/components/providers/data-provider"
import { PageHeaderCard } from "@/components/shared/page-header-card"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { examUsageApi } from "@/lib/api"
import type { ExamUsage } from "@/lib/types"

const STATUS_LABELS: Record<ExamUsage["status"], string> = {
  draft: "草稿",
  pending: "待开始",
  in_progress: "进行中",
  finished: "已结束",
}

const TARGET_TYPE_LABELS: Record<NonNullable<ExamUsage["targetType"]>, string> = {
  class: "班级",
  major: "专业",
  department: "部门",
  public: "公开",
}

type FilterStatus = ExamUsage["status"] | "all"

export default function ExamUsagePage() {
  const router = useRouter()
  const { exams } = useData()

  const [usages, setUsages] = useState<ExamUsage[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all")
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [createSubmitting, setCreateSubmitting] = useState(false)

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [deletingUsageId, setDeletingUsageId] = useState<string | null>(null)

  // 创建考试使用表单
  const [formExamId, setFormExamId] = useState("")
  const [formName, setFormName] = useState("")
  const [formDescription, setFormDescription] = useState("")
  const [formDuration, setFormDuration] = useState("")
  const [formStartTime, setFormStartTime] = useState("")
  const [formEndTime, setFormEndTime] = useState("")
  const [formTargetType, setFormTargetType] = useState<ExamUsage["targetType"]>("class")
  const [formTargetIds, setFormTargetIds] = useState("")

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
    loadUsages()
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
        (exam?.name || "").toLowerCase().includes(search.toLowerCase())
      const matchStatus = statusFilter === "all" || usage.status === statusFilter
      return matchSearch && matchStatus
    })
  }, [search, statusFilter, usages, examMap])

  const stats = useMemo(() => {
    return {
      total: usages.length,
      draft: usages.filter((u) => u.status === "draft").length,
      pending: usages.filter((u) => u.status === "pending").length,
      inProgress: usages.filter((u) => u.status === "in_progress").length,
      finished: usages.filter((u) => u.status === "finished").length,
    }
  }, [usages])

  const resetForm = () => {
    setFormExamId("")
    setFormName("")
    setFormDescription("")
    setFormDuration("")
    setFormStartTime("")
    setFormEndTime("")
    setFormTargetType("class")
    setFormTargetIds("")
  }

  const openCreateDialog = () => {
    resetForm()
    setCreateDialogOpen(true)
  }

  const handleCreate = async () => {
    if (!formExamId || !formName) return
    setCreateSubmitting(true)
    try {
      await examUsageApi.create({
        examId: formExamId,
        name: formName,
        description: formDescription || undefined,
        duration: formDuration ? Number(formDuration) : undefined,
        startTime: formStartTime || undefined,
        endTime: formEndTime || undefined,
        targetType: formTargetType,
        targetIds: formTargetIds
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean),
        status: "draft",
      })
      setCreateDialogOpen(false)
      resetForm()
      await loadUsages()
    } finally {
      setCreateSubmitting(false)
    }
  }

  const handleStart = async (id: string) => {
    await examUsageApi.start(id)
    await loadUsages()
  }

  const handleFinish = async (id: string) => {
    await examUsageApi.finish(id)
    await loadUsages()
  }

  const openDeleteDialog = (id: string) => {
    setDeletingUsageId(id)
    setConfirmDeleteOpen(true)
  }

  const handleDelete = async () => {
    if (!deletingUsageId) return
    await examUsageApi.delete(deletingUsageId)
    setConfirmDeleteOpen(false)
    setDeletingUsageId(null)
    await loadUsages()
  }

  const formatDate = (iso?: string) => {
    if (!iso) return "-"
    return new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso))
  }

  const getStatusBadge = (status: ExamUsage["status"]) => {
    switch (status) {
      case "draft":
        return <Badge variant="secondary">{STATUS_LABELS[status]}</Badge>
      case "pending":
        return (
          <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">
            {STATUS_LABELS[status]}
          </Badge>
        )
      case "in_progress":
        return <Badge className="bg-green-500 hover:bg-green-600">{STATUS_LABELS[status]}</Badge>
      case "finished":
        return <Badge variant="outline">{STATUS_LABELS[status]}</Badge>
    }
  }

  const canStart = (status: ExamUsage["status"]) => status === "draft" || status === "pending"
  const canFinish = (status: ExamUsage["status"]) => status === "in_progress"
  const canDelete = (status: ExamUsage["status"]) => status === "draft" || status === "finished"

  const isFormValid = formExamId && formName

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
            label: "考试总数",
            value: stats.total,
            icon: <Clock className="size-4 text-blue-500" />,
            iconClassName: "bg-blue-50",
          },
          {
            label: "草稿",
            value: stats.draft,
            icon: <Clock className="size-4 text-gray-500" />,
            iconClassName: "bg-gray-50",
          },
          {
            label: "待开始",
            value: stats.pending,
            icon: <PlayCircle className="size-4 text-amber-500" />,
            iconClassName: "bg-amber-50",
          },
          {
            label: "进行中",
            value: stats.inProgress,
            icon: <PlayCircle className="size-4 text-green-500" />,
            iconClassName: "bg-green-50",
          },
          {
            label: "已结束",
            value: stats.finished,
            icon: <CheckCircle2 className="size-4 text-gray-500" />,
            iconClassName: "bg-gray-50",
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
            <SelectItem value="draft">草稿</SelectItem>
            <SelectItem value="pending">待开始</SelectItem>
            <SelectItem value="in_progress">进行中</SelectItem>
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
                <TableHead className="w-[200px]">描述</TableHead>
                <TableHead className="w-[90px]">时长</TableHead>
                <TableHead className="w-[180px]">开放时间</TableHead>
                <TableHead className="w-[100px]">状态</TableHead>
                <TableHead className="w-[120px]">目标类型</TableHead>
                <TableHead className="sticky right-0 w-[140px] bg-white text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                    加载中...
                  </TableCell>
                </TableRow>
              ) : filteredUsages.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                    暂无使用记录
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsages.map((usage) => {
                  const exam = examMap.get(usage.examId)
                  return (
                    <TableRow key={usage.id}>
                      <TableCell className="font-medium">{usage.name}</TableCell>
                      <TableCell>{exam?.name || "-"}</TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground line-clamp-2">
                          {usage.description || "-"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{usage.duration ? `${usage.duration} 分钟` : "-"}</span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {usage.startTime || usage.endTime ? (
                          <div className="text-xs">
                            <div>{usage.startTime ? formatDate(usage.startTime) : "-"}</div>
                            <div>至 {usage.endTime ? formatDate(usage.endTime) : "-"}</div>
                          </div>
                        ) : (
                          <span className="text-xs">-</span>
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(usage.status)}</TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {usage.targetType ? TARGET_TYPE_LABELS[usage.targetType] : "-"}
                        </span>
                      </TableCell>
                      <TableCell className="sticky right-0 bg-white text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-8">
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {canStart(usage.status) && (
                              <DropdownMenuItem onClick={() => handleStart(usage.id)}>
                                开始考试
                              </DropdownMenuItem>
                            )}
                            {canFinish(usage.status) && (
                              <DropdownMenuItem onClick={() => handleFinish(usage.id)}>
                                结束考试
                              </DropdownMenuItem>
                            )}
                            {usage.status === "finished" && (
                              <DropdownMenuItem
                                onClick={() =>
                                  router.push(`/evaluation/exam-usage/results?usageId=${usage.id}`)
                                }
                              >
                                查看考试结果
                              </DropdownMenuItem>
                            )}
                            {canDelete(usage.status) && (
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => openDeleteDialog(usage.id)}
                              >
                                删除
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* 创建考试使用弹窗 */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>创建考试使用</DialogTitle>
            <DialogDescription>选择试卷并配置考试使用信息</DialogDescription>
          </DialogHeader>
          <FieldGroup className="py-4">
            <Field>
              <FieldLabel>选择试卷 *</FieldLabel>
              <Select value={formExamId} onValueChange={setFormExamId}>
                <SelectTrigger>
                  <SelectValue placeholder="请选择一份试卷" />
                </SelectTrigger>
                <SelectContent>
                  {exams.map((exam) => (
                    <SelectItem key={exam.id} value={exam.id}>
                      {exam.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

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

            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel>开始时间</FieldLabel>
                <Input
                  type="datetime-local"
                  value={formStartTime}
                  onChange={(e) => setFormStartTime(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel>结束时间</FieldLabel>
                <Input
                  type="datetime-local"
                  value={formEndTime}
                  onChange={(e) => setFormEndTime(e.target.value)}
                />
              </Field>
            </div>

            <Field>
              <FieldLabel>目标类型</FieldLabel>
              <Select
                value={formTargetType}
                onValueChange={(v) => setFormTargetType(v as ExamUsage["targetType"])}
              >
                <SelectTrigger>
                  <SelectValue placeholder="请选择目标类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="class">班级</SelectItem>
                  <SelectItem value="major">专业</SelectItem>
                  <SelectItem value="department">部门</SelectItem>
                  <SelectItem value="public">公开</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel>目标ID列表</FieldLabel>
              <Input
                value={formTargetIds}
                onChange={(e) => setFormTargetIds(e.target.value)}
                placeholder="多个ID请用英文逗号分隔"
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)} disabled={createSubmitting}>
              取消
            </Button>
            <Button onClick={handleCreate} disabled={!isFormValid || createSubmitting}>
              {createSubmitting ? "提交中..." : "创建"}
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
