"use client"

import { Suspense, useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { ChevronLeft, ChevronRight, Eye, RefreshCw, Search } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { TableRowActions } from "@/components/shared/table-row-actions"
import { jobAbilityResultApi } from "@/lib/api"
import type { JobAbilityResult, JobAbilitySummaryItem } from "@/lib/types"
import { cn } from "@/lib/utils"

const PAGE_SIZE = 20

const AGGREGATE_POLL_INTERVAL_MS = 3000
const AGGREGATE_POLL_MAX_ATTEMPTS = 15

const GRADE_OPTIONS = ["了解", "理解", "掌握", "熟练", "精通"] as const

function gradeBadgeClass(grade?: string): string {
  switch (grade) {
    case "精通":
      return "bg-purple-50 text-purple-600 border-purple-200"
    case "熟练":
      return "bg-green-50 text-green-600 border-green-200"
    case "掌握":
      return "bg-blue-50 text-blue-600 border-blue-200"
    case "理解":
      return "bg-amber-50 text-amber-600 border-amber-200"
    case "了解":
      return "bg-gray-50 text-gray-500 border-gray-200"
    default:
      return "bg-gray-50 text-gray-500 border-gray-200"
  }
}

function formatDateTime(value?: string | Date): string {
  if (!value) return "-"
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

function JobAbilityResultsContent() {
  const searchParams = useSearchParams()
  const positionIdParam = searchParams.get("positionId")
  const { toast } = useToast()

  const [summary, setSummary] = useState<JobAbilitySummaryItem[]>([])
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [selectedPositionId, setSelectedPositionId] = useState<string>(positionIdParam || "")

  const [results, setResults] = useState<JobAbilityResult[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(!!positionIdParam)

  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [gradeFilter, setGradeFilter] = useState<string>("all")

  const [aggregating, setAggregating] = useState(false)
  const aggregateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [listReloadKey, setListReloadKey] = useState(0)

  // 组件卸载时清理汇聚轮询定时器
  useEffect(() => {
    return () => {
      if (aggregateTimerRef.current) clearTimeout(aggregateTimerRef.current)
    }
  }, [])

  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detail, setDetail] = useState<JobAbilityResult | null>(null)

  // 搜索输入防抖
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  // 筛选条件变化时重置分页并进入加载态（在事件回调中同步执行）
  const applyFilters = (updates: { positionId?: string; search?: string; grade?: string; page?: number }) => {
    setLoading(true)
    if (updates.page !== undefined) setPage(updates.page)
    else setPage(1)
    if (updates.positionId !== undefined) setSelectedPositionId(updates.positionId)
    if (updates.search !== undefined) setSearch(updates.search)
    if (updates.grade !== undefined) setGradeFilter(updates.grade)
  }

  // 左侧岗位汇总
  useEffect(() => {
    const load = async () => {
      try {
        const items = await jobAbilityResultApi.summary()
        setSummary(items || [])
        if (!positionIdParam && items && items.length > 0) {
          setLoading(true)
          setSelectedPositionId(items[0].positionId)
        }
      } catch (err) {
        toast({
          title: "加载失败",
          description: err instanceof Error ? err.message : "获取岗位汇总失败",
          variant: "destructive",
        })
      } finally {
        setSummaryLoading(false)
      }
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 右侧结果列表
  useEffect(() => {
    if (!selectedPositionId) return
    let cancelled = false
    const load = async () => {
      try {
        const res = await jobAbilityResultApi.list({
          careerPositionId: selectedPositionId,
          search: debouncedSearch || undefined,
          grade: gradeFilter === "all" ? undefined : gradeFilter,
          page,
          limit: PAGE_SIZE,
        })
        if (cancelled) return
        setResults(res.items || [])
        setTotal(res.total || 0)
      } catch (err) {
        if (cancelled) return
        toast({
          title: "加载失败",
          description: err instanceof Error ? err.message : "获取认定结果失败",
          variant: "destructive",
        })
        setResults([])
        setTotal(0)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [selectedPositionId, debouncedSearch, gradeFilter, page, listReloadKey, toast])

  const selectedPosition = useMemo(
    () => summary.find((s) => s.positionId === selectedPositionId),
    [summary, selectedPositionId],
  )

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  // 汇聚成功后刷新左侧岗位汇总（首次加载逻辑保留在挂载 effect 中）
  const refreshSummary = async () => {
    try {
      const items = await jobAbilityResultApi.summary()
      setSummary(items || [])
    } catch {
      // 汇总刷新失败不影响主流程
    }
  }

  const handleAggregate = async () => {
    if (!selectedPositionId) return
    const careerPositionId = selectedPositionId
    setAggregating(true)
    try {
      await jobAbilityResultApi.aggregate({ careerPositionId })
    } catch (err) {
      toast({
        title: "触发失败",
        description: err instanceof Error ? err.message : "汇聚任务提交失败",
        variant: "destructive",
      })
      setAggregating(false)
      return
    }

    let attempts = 0
    const poll = async () => {
      attempts += 1
      try {
        const status = await jobAbilityResultApi.aggregateStatus(careerPositionId)
        if (status?.status === "success") {
          setAggregating(false)
          const updatedCount = status.updatedCount ?? 0
          toast({
            title: "汇聚完成",
            description:
              updatedCount > 0
                ? `汇聚完成，更新 ${updatedCount} 名学生`
                : "更新 0 条，请确认规则已发布且学生已有评分",
          })
          setLoading(true)
          setListReloadKey((k) => k + 1)
          refreshSummary()
          return
        }
        if (status?.status === "failed") {
          setAggregating(false)
          toast({
            title: "汇聚失败",
            description: status.errorMessage || "汇聚任务执行失败",
            variant: "destructive",
          })
          return
        }
        if (attempts >= AGGREGATE_POLL_MAX_ATTEMPTS) {
          setAggregating(false)
          toast({
            title: "汇聚仍在进行",
            description: "汇聚仍在进行，稍后请手动刷新",
          })
          return
        }
        aggregateTimerRef.current = setTimeout(poll, AGGREGATE_POLL_INTERVAL_MS)
      } catch (err) {
        setAggregating(false)
        toast({
          title: "查询汇聚状态失败",
          description: err instanceof Error ? err.message : "获取汇聚状态失败",
          variant: "destructive",
        })
      }
    }
    aggregateTimerRef.current = setTimeout(poll, AGGREGATE_POLL_INTERVAL_MS)
  }

  const openDetail = async (id: string) => {
    setDetailOpen(true)
    setDetailLoading(true)
    setDetail(null)
    try {
      setDetail(await jobAbilityResultApi.get(id))
    } catch (err) {
      toast({
        title: "加载失败",
        description: err instanceof Error ? err.message : "获取结果明细失败",
        variant: "destructive",
      })
    } finally {
      setDetailLoading(false)
    }
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* 左侧岗位导航 */}
      <div className="flex w-[260px] shrink-0 flex-col border-r bg-white">
        <div className="border-b p-4">
          <h2 className="text-sm font-semibold">岗位列表</h2>
          <p className="text-xs text-muted-foreground">点击岗位查看认定结果</p>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {summaryLoading ? (
            <div className="py-8 text-center text-xs text-muted-foreground">加载中...</div>
          ) : summary.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">暂无认定结果</div>
          ) : (
            summary.map((item) => (
              <button
                key={item.positionId}
                onClick={() => applyFilters({ positionId: item.positionId })}
                className={cn(
                  "flex w-full flex-col rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                  selectedPositionId === item.positionId
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-gray-700 hover:bg-gray-50",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="truncate">{item.positionName}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{item.studentCount} 人</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  平均达标率 {(item.avgRate ?? 0).toFixed(1)}%
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* 右侧结果区 */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        <PageHeaderCard
          title="岗位能力认定结果"
          description={
            selectedPosition
              ? `查看「${selectedPosition.positionName}」的能力认定结果`
              : "查看各岗位的能力认定结果"
          }
          className="mb-4"
          actions={
            <Button
              variant="outline"
              size="sm"
              onClick={handleAggregate}
              disabled={!selectedPositionId || aggregating}
            >
              <RefreshCw className={cn("mr-1.5 h-4 w-4", aggregating && "animate-spin")} />
              手动汇聚
            </Button>
          }
        />

        {/* 筛选栏 */}
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="搜索姓名或学号..."
              value={search}
              onChange={(e) => applyFilters({ search: e.target.value })}
              className="pl-9"
            />
          </div>
          <Select value={gradeFilter} onValueChange={(value) => applyFilters({ grade: value })}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="等级筛选" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部等级</SelectItem>
              {GRADE_OPTIONS.map((grade) => (
                <SelectItem key={grade} value={grade}>
                  {grade}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 结果表格 */}
        <div className="rounded-lg border bg-white px-4 py-3">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[110px]">姓名</TableHead>
                  <TableHead className="w-[110px]">学号</TableHead>
                  <TableHead className="w-[130px]">班级</TableHead>
                  <TableHead className="w-[130px]">专业</TableHead>
                  <TableHead className="w-[130px]">能力点达成</TableHead>
                  <TableHead className="w-[90px]">达标率</TableHead>
                  <TableHead className="w-[90px]">等级</TableHead>
                  <TableHead className="sticky right-0 w-[120px] bg-white text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                      加载中...
                    </TableCell>
                  </TableRow>
                ) : results.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                      {selectedPositionId ? "暂无符合条件的认定结果" : "请在左侧选择岗位"}
                    </TableCell>
                  </TableRow>
                ) : (
                  results.map((result) => (
                    <TableRow key={result.id} className="group">
                      <TableCell className="font-medium">{result.studentName}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{result.studentId}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{result.className || "-"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{result.majorName || "-"}</TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {result.achievedAbilityPoints}/{result.totalAbilityPoints} 能力点
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-medium">{(result.achievementRate ?? 0).toFixed(1)}%</span>
                      </TableCell>
                      <TableCell>
                        {result.grade ? (
                          <Badge variant="outline" className={cn("text-xs", gradeBadgeClass(result.grade))}>
                            {result.grade}
                          </Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableRowActions className="sticky right-0 bg-white">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => openDetail(result.id)}
                        >
                          <Eye className="mr-1 h-3 w-3" />
                          查看明细
                        </Button>
                      </TableRowActions>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {total > 0 && (
            <div className="mt-4 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">共 {total} 条记录</span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => applyFilters({ page: page - 1 })}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => applyFilters({ page: page + 1 })}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 能力点明细弹窗 */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>能力点认定明细</DialogTitle>
            <DialogDescription>
              {detail
                ? `${detail.studentName}（${detail.studentId}）· ${detail.positionName}`
                : "加载中..."}
            </DialogDescription>
          </DialogHeader>
          {detailLoading ? (
            <div className="py-10 text-center text-sm text-muted-foreground">加载中...</div>
          ) : detail ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4 text-sm">
                <span className="text-muted-foreground">
                  能力点达成 {detail.achievedAbilityPoints}/{detail.totalAbilityPoints}
                </span>
                <span className="text-muted-foreground">
                  达标率 {(detail.achievementRate ?? 0).toFixed(1)}%
                </span>
                {detail.grade && (
                  <Badge variant="outline" className={cn("text-xs", gradeBadgeClass(detail.grade))}>
                    {detail.grade}
                  </Badge>
                )}
                <span className="text-muted-foreground">
                  认定时间 {formatDateTime(detail.evaluationTime)}
                </span>
              </div>
              {detail.abilityPointDetails && detail.abilityPointDetails.length > 0 ? (
                <div className="max-h-[50vh] overflow-y-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>能力点</TableHead>
                        <TableHead className="w-[100px]">得分</TableHead>
                        <TableHead className="w-[100px]">权重</TableHead>
                        <TableHead className="w-[100px]">是否达成</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detail.abilityPointDetails.map((point, index) => (
                        <TableRow key={point.abilityPointId || index}>
                          <TableCell className="text-sm">{point.abilityPointName}</TableCell>
                          <TableCell className="text-sm">
                            {point.maxScore != null ? `${point.score}/${point.maxScore}` : point.score}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {point.weight != null ? `${point.weight}%` : "-"}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-xs",
                                point.achieved
                                  ? "bg-green-50 text-green-600 border-green-200"
                                  : "bg-red-50 text-red-600 border-red-200",
                              )}
                            >
                              {point.achieved ? "已达成" : "未达成"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="py-8 text-center text-sm text-muted-foreground">暂无能力点明细</div>
              )}
            </div>
          ) : (
            <div className="py-10 text-center text-sm text-muted-foreground">未找到结果明细</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function JobAbilityResultsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center text-sm text-gray-400">
          加载中...
        </div>
      }
    >
      <JobAbilityResultsContent />
    </Suspense>
  )
}
