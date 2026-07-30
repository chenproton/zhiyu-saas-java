"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { CalendarPlus, Search, ClipboardList, FileEdit, CheckCircle2, Eye } from "lucide-react"
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
import { TableRowActions } from "@/components/shared/table-row-actions"
import { teachingPlanApi } from "@/lib/api"
import type { TeachingPlan } from "@/lib/types"
import { GeneratePlanDialog } from "./_components/generate-plan-dialog"

type FilterStatus = "all" | "draft" | "confirmed"

function formatDateTime(iso?: string) {
  if (!iso) return "-"
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso))
}

export default function TeachingPlansPage() {
  const router = useRouter()
  const { toast } = useToast()

  const [items, setItems] = useState<TeachingPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all")
  const [generateOpen, setGenerateOpen] = useState(false)

  const loadItems = useCallback(async () => {
    try {
      const res = await teachingPlanApi.list({ limit: 500 })
      setItems(res.items)
    } catch (err: any) {
      toast({ variant: "destructive", title: "加载失败", description: err.message || "查询教学计划列表失败" })
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
        (p.programName || "").toLowerCase().includes(search.toLowerCase()) ||
        (p.termName || "").toLowerCase().includes(search.toLowerCase()) ||
        (p.majorName || "").toLowerCase().includes(search.toLowerCase())
      const matchStatus = statusFilter === "all" || p.status === statusFilter
      return matchSearch && matchStatus
    })
  }, [items, search, statusFilter])

  const stats = useMemo(() => {
    return {
      total: items.length,
      draft: items.filter((p) => p.status === "draft").length,
      confirmed: items.filter((p) => p.status === "confirmed").length,
    }
  }, [items])

  const handleConfirm = async (p: TeachingPlan) => {
    try {
      await teachingPlanApi.confirm(p.id)
      toast({ title: "教学计划已确认" })
      await loadItems()
    } catch (err: any) {
      toast({ variant: "destructive", title: "确认失败", description: err.message || "确认教学计划失败" })
    }
  }

  return (
    <div className="space-y-6">
      <PageHeaderCard
        title="教学计划"
        description="从已发布的人培方案按学期生成教学计划，确认后进入排课"
        actions={
          <Button onClick={() => setGenerateOpen(true)}>
            <CalendarPlus className="mr-2 size-4" />
            从人培方案生成
          </Button>
        }
        stats={[
          {
            label: "计划总数",
            value: stats.total,
            icon: <ClipboardList className="size-4 text-blue-500" />,
            iconClassName: "bg-blue-50",
          },
          {
            label: "草稿",
            value: stats.draft,
            icon: <FileEdit className="size-4 text-gray-500" />,
            iconClassName: "bg-gray-50",
          },
          {
            label: "已确认",
            value: stats.confirmed,
            icon: <CheckCircle2 className="size-4 text-green-500" />,
            iconClassName: "bg-green-50",
          },
        ]}
      />

      {/* 筛选栏 */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜索方案、学期或专业..."
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
            <SelectItem value="confirmed">已确认</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 计划列表 */}
      <div className="rounded-lg border bg-white px-4 py-3">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[240px]">人培方案</TableHead>
                <TableHead className="w-[130px]">学期</TableHead>
                <TableHead className="w-[140px]">专业</TableHead>
                <TableHead className="w-[80px]">年级</TableHead>
                <TableHead className="w-[80px]">条目数</TableHead>
                <TableHead className="w-[100px]">状态</TableHead>
                <TableHead className="w-[160px]">生成时间</TableHead>
                <TableHead className="sticky right-0 w-[160px] bg-white text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                    加载中...
                  </TableCell>
                </TableRow>
              ) : filteredItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                    暂无教学计划，点击「从人培方案生成」创建
                  </TableCell>
                </TableRow>
              ) : (
                filteredItems.map((p) => (
                  <TableRow key={p.id} className="group">
                    <TableCell className="font-medium">{p.programName || "-"}</TableCell>
                    <TableCell>
                      <span className="text-sm">{p.termName || "-"}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{p.majorName || "-"}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{p.entryYear} 级</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{p.entryCount}</span>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={p.status} />
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">{formatDateTime(p.generatedAt)}</span>
                    </TableCell>
                    <TableRowActions className="sticky right-0 bg-white">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => router.push(`/affairs/teaching-plans/${p.id}`)}
                      >
                        <Eye className="mr-1 h-3 w-3" />
                        详情
                      </Button>
                      {p.status === "draft" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-green-600 hover:text-green-700"
                          onClick={() => handleConfirm(p)}
                        >
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          确认
                        </Button>
                      )}
                    </TableRowActions>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* 生成教学计划弹窗 */}
      <GeneratePlanDialog
        open={generateOpen}
        onOpenChange={setGenerateOpen}
        onGenerated={(plan) => {
          loadItems()
          router.push(`/affairs/teaching-plans/${plan.id}`)
        }}
      />
    </div>
  )
}
