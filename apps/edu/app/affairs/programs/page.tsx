"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Plus, Search, BookCopy, FileEdit, Send, Undo2, Trash2 } from "lucide-react"
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
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { StatusBadge } from "@/components/shared/status-badge"
import { TableRowActions } from "@/components/shared/table-row-actions"
import { programApi } from "@/lib/api"
import type { TrainingProgram } from "@/lib/types"

type FilterStatus = "all" | "draft" | "published"

export default function ProgramsPage() {
  const router = useRouter()
  const { toast } = useToast()

  const [items, setItems] = useState<TrainingProgram[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all")

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState<TrainingProgram | null>(null)

  const loadItems = useCallback(async () => {
    try {
      const res = await programApi.list({ limit: 500 })
      setItems(res.items)
    } catch (err: any) {
      toast({ variant: "destructive", title: "加载失败", description: err.message || "查询人培方案列表失败" })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    // 首屏加载：async IIFE 包裹，避免在 effect 体内同步触发 setState
    ;(async () => {
      await loadItems()
    })()
  }, [loadItems])

  const filteredItems = useMemo(() => {
    return items.filter((p) => {
      const matchSearch =
        !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.code || "").toLowerCase().includes(search.toLowerCase())
      const matchStatus = statusFilter === "all" || p.status === statusFilter
      return matchSearch && matchStatus
    })
  }, [items, search, statusFilter])

  const stats = useMemo(() => {
    return {
      total: items.length,
      draft: items.filter((p) => p.status === "draft").length,
      published: items.filter((p) => p.status === "published").length,
    }
  }, [items])

  const handleTogglePublish = async (p: TrainingProgram) => {
    const next = p.status === "published" ? "draft" : "published"
    try {
      await programApi.publish(p.id, next)
      toast({ title: next === "published" ? "方案已发布" : "方案已撤回" })
      await loadItems()
    } catch (err: any) {
      toast({ variant: "destructive", title: "操作失败", description: err.message || "更新方案状态失败" })
    }
  }

  const openDeleteDialog = (p: TrainingProgram) => {
    setDeleting(p)
    setConfirmDeleteOpen(true)
  }

  const handleDelete = async () => {
    if (!deleting) return
    try {
      await programApi.delete(deleting.id)
      toast({ title: "方案已删除" })
    } catch (err: any) {
      toast({ variant: "destructive", title: "删除失败", description: err.message || "删除失败" })
    } finally {
      setConfirmDeleteOpen(false)
      setDeleting(null)
      await loadItems()
    }
  }

  return (
    <div className="space-y-6">
      <PageHeaderCard
        title="人才培养方案"
        description="维护专业人才培养方案及课程设置，发布后可生成学期教学计划"
        actions={
          <Button onClick={() => router.push("/affairs/programs/new")}>
            <Plus className="mr-2 size-4" />
            新建方案
          </Button>
        }
        stats={[
          {
            label: "方案总数",
            value: stats.total,
            icon: <BookCopy className="size-4 text-blue-500" />,
            iconClassName: "bg-blue-50",
          },
          {
            label: "草稿",
            value: stats.draft,
            icon: <FileEdit className="size-4 text-gray-500" />,
            iconClassName: "bg-gray-50",
          },
          {
            label: "已发布",
            value: stats.published,
            icon: <Send className="size-4 text-green-500" />,
            iconClassName: "bg-green-50",
          },
        ]}
      />

      {/* 筛选栏 */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜索方案名称或编码..."
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
            <SelectItem value="published">已发布</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 方案列表 */}
      <div className="rounded-lg border bg-white px-4 py-3">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[220px]">方案名称</TableHead>
                <TableHead className="w-[110px]">编码</TableHead>
                <TableHead className="w-[140px]">专业</TableHead>
                <TableHead className="w-[80px]">年级</TableHead>
                <TableHead className="w-[80px]">学制</TableHead>
                <TableHead className="w-[80px]">课程数</TableHead>
                <TableHead className="w-[80px]">总学分</TableHead>
                <TableHead className="w-[100px]">状态</TableHead>
                <TableHead className="sticky right-0 w-[200px] bg-white text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                    加载中...
                  </TableCell>
                </TableRow>
              ) : filteredItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                    暂无人培方案
                  </TableCell>
                </TableRow>
              ) : (
                filteredItems.map((p) => (
                  <TableRow key={p.id} className="group">
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">{p.code || "-"}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{p.majorName || "-"}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{p.entryYear} 级</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{p.duration ? `${p.duration} 年` : "-"}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{p.courseCount}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{p.totalCredits ?? "-"}</span>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={p.status} />
                    </TableCell>
                    <TableRowActions className="sticky right-0 bg-white">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => router.push(`/affairs/programs/${p.id}`)}
                      >
                        <FileEdit className="mr-1 h-3 w-3" />
                        编辑
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={`h-7 px-2 text-xs ${p.status === "published" ? "text-amber-600 hover:text-amber-700" : "text-green-600 hover:text-green-700"}`}
                        onClick={() => handleTogglePublish(p)}
                      >
                        {p.status === "published" ? (
                          <>
                            <Undo2 className="mr-1 h-3 w-3" />
                            撤回
                          </>
                        ) : (
                          <>
                            <Send className="mr-1 h-3 w-3" />
                            发布
                          </>
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-red-500 hover:text-red-600"
                        onClick={() => openDeleteDialog(p)}
                      >
                        <Trash2 className="mr-1 h-3 w-3" />
                        删除
                      </Button>
                    </TableRowActions>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* 删除确认弹窗 */}
      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title="删除人培方案"
        description={`删除后其课程设置将一并删除且无法恢复，确定要删除「${deleting?.name || ""}」吗？`}
        onConfirm={handleDelete}
      />
    </div>
  )
}
