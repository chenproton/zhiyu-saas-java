'use client'

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Eye, RefreshCw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@zhiyu/ui'
import { SearchInput } from '@/components/shared/search-input'
import { PageHeaderCard } from '@/components/shared/page-header-card'
import { TableRowActions } from '@/components/shared/table-row-actions'
import { PaginationBar } from '@/components/shared/pagination-bar'
import { jobAbilityResultApi } from '@/lib/api'
import type { JobAbilityResult, JobAbilitySummaryItem } from '@/lib/types'
import { cn } from '@/lib/utils'
import { formatDateTime } from '@/lib/format-utils'
import { useT } from '@/lib/i18n/locale-provider'

const PAGE_SIZE = 20

const AGGREGATE_POLL_INTERVAL_MS = 3000
const AGGREGATE_POLL_MAX_ATTEMPTS = 15

function JobAbilityResultsContent() {
  const t = useT()
  const searchParams = useSearchParams()
  const positionIdParam = searchParams.get('positionId')
  const { toast } = useToast()

  const [summary, setSummary] = useState<JobAbilitySummaryItem[]>([])
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [selectedPositionId, setSelectedPositionId] = useState<string>(positionIdParam || '')

  const [results, setResults] = useState<JobAbilityResult[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(!!positionIdParam)

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  const [aggregating, setAggregating] = useState(false)
  const aggregateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const aggregatePollGenerationRef = useRef(0)
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
  const applyFilters = (updates: { positionId?: string; search?: string; page?: number }) => {
    setLoading(true)
    if (updates.page !== undefined) setPage(updates.page)
    else setPage(1)
    if (updates.positionId !== undefined) setSelectedPositionId(updates.positionId)
    if (updates.search !== undefined) setSearch(updates.search)
  }

  // 左侧岗位汇总
  useEffect(() => {
    let cancelled = false
    jobAbilityResultApi
      .summary()
      .then((items) => {
        if (cancelled) return
        setSummary(items || [])
        if (!positionIdParam && items && items.length > 0) {
          setLoading(true)
          setSelectedPositionId(items[0].positionId)
        }
      })
      .catch((err) => {
        if (cancelled) return
        toast({
          title: t('加载失败'),
          description: err instanceof Error ? err.message : t('获取岗位汇总失败'),
          variant: 'destructive',
        })
      })
      .finally(() => {
        if (!cancelled) setSummaryLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [positionIdParam, toast, t])

  // 右侧结果列表
  useEffect(() => {
    if (!selectedPositionId) return
    let cancelled = false
    const load = async () => {
      try {
        const res = await jobAbilityResultApi.list({
          careerPositionId: selectedPositionId,
          search: debouncedSearch || undefined,
          page,
          limit: PAGE_SIZE,
        })
        if (cancelled) return
        setResults(res.items || [])
        setTotal(res.total || 0)
      } catch (err) {
        if (cancelled) return
        toast({
          title: t('加载失败'),
          description: err instanceof Error ? err.message : t('获取认定结果失败'),
          variant: 'destructive',
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
  }, [selectedPositionId, debouncedSearch, page, listReloadKey, toast, t])

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
    // 清除上一轮轮询，避免不同岗位的汇聚轮询链交叉覆盖
    if (aggregateTimerRef.current) {
      clearTimeout(aggregateTimerRef.current)
      aggregateTimerRef.current = null
    }
    const pollGeneration = ++aggregatePollGenerationRef.current
    setAggregating(true)
    let triggerLogId: string | undefined
    try {
      const triggered = await jobAbilityResultApi.aggregate({ careerPositionId })
      triggerLogId = triggered.logId
    } catch (err) {
      toast({
        title: t('触发失败'),
        description: err instanceof Error ? err.message : t('汇聚任务提交失败'),
        variant: 'destructive',
      })
      setAggregating(false)
      return
    }

    let attempts = 0
    const poll = async () => {
      if (pollGeneration !== aggregatePollGenerationRef.current) return
      attempts += 1
      try {
        const status = await jobAbilityResultApi.aggregateStatus(careerPositionId, triggerLogId)
        if (status?.status === 'success') {
          setAggregating(false)
          const updatedCount = status.updatedCount ?? 0
          toast({
            title: t('汇聚完成'),
            description:
              updatedCount > 0
                ? t('汇聚完成，更新 {n} 名学生', { n: updatedCount })
                : t('更新 0 条，请确认规则已发布且学生已有评分'),
          })
          setLoading(true)
          setListReloadKey((k) => k + 1)
          refreshSummary()
          return
        }
        if (status?.status === 'failed') {
          setAggregating(false)
          toast({
            title: t('汇聚失败'),
            description: status.errorMessage || t('汇聚任务执行失败'),
            variant: 'destructive',
          })
          return
        }
        if (attempts >= AGGREGATE_POLL_MAX_ATTEMPTS) {
          setAggregating(false)
          toast({
            title: t('汇聚仍在进行'),
            description: t('汇聚仍在进行，稍后请手动刷新'),
          })
          return
        }
        aggregateTimerRef.current = setTimeout(poll, AGGREGATE_POLL_INTERVAL_MS)
      } catch (err) {
        setAggregating(false)
        toast({
          title: t('查询汇聚状态失败'),
          description: err instanceof Error ? err.message : t('获取汇聚状态失败'),
          variant: 'destructive',
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
        title: t('加载失败'),
        description: err instanceof Error ? err.message : t('获取结果明细失败'),
        variant: 'destructive',
      })
    } finally {
      setDetailLoading(false)
    }
  }

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-3.5rem)]">
      {/* 左侧岗位导航 */}
      <div className="flex w-full md:w-[260px] shrink-0 flex-col border-r bg-white max-h-[50vh] md:max-h-none">
        <div className="border-b p-4">
          <h2 className="text-sm font-semibold">{t('岗位列表')}</h2>
          <p className="text-xs text-muted-foreground">{t('点击岗位查看认定结果')}</p>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {summaryLoading ? (
            <div className="py-8 text-center text-xs text-muted-foreground">{t('加载中...')}</div>
          ) : summary.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">{t('暂无认定结果')}</div>
          ) : (
            summary.map((item) => (
              <button
                key={item.positionId}
                onClick={() => applyFilters({ positionId: item.positionId })}
                className={cn(
                  'flex w-full flex-col rounded-lg px-3 py-2.5 text-left text-sm transition-colors',
                  selectedPositionId === item.positionId
                    ? 'bg-primary/10 font-medium text-primary'
                    : 'text-gray-700 hover:bg-gray-50',
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="truncate">{item.positionName}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {t('{n} 人', { n: item.studentCount })}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {t('平均达标率 {rate}%', { rate: (item.avgRate ?? 0).toFixed(1) })}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* 右侧结果区 */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        <PageHeaderCard
          title={t('岗位能力认定结果')}
          description={
            selectedPosition
              ? t('查看「{name}」的能力认定结果', { name: selectedPosition.positionName })
              : t('查看各岗位的能力认定结果')
          }
          className="mb-4"
          actions={
            <Button
              variant="outline"
              size="sm"
              onClick={handleAggregate}
              disabled={!selectedPositionId || aggregating}
            >
              <RefreshCw className={cn('mr-1.5 h-4 w-4', aggregating && 'animate-spin')} />
              {t('手动汇聚')}
            </Button>
          }
        />

        {/* 筛选栏 */}
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center">
          <SearchInput
            wrapperClassName="flex-1 sm:max-w-xs"
            placeholder={t('搜索姓名或学号...')}
            value={search}
            onChange={(v) => applyFilters({ search: v })}
          />
        </div>

        {/* 结果表格 */}
        <div className="rounded-lg border bg-white px-4 py-3">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">{t('姓名')}</TableHead>
                  <TableHead className="w-[110px]">{t('学号')}</TableHead>
                  <TableHead className="w-[130px]">{t('所属院系')}</TableHead>
                  <TableHead className="w-[120px]">{t('班级')}</TableHead>
                  <TableHead className="w-[120px]">{t('岗位能力达成率')}</TableHead>
                  <TableHead className="w-[100px]">{t('岗位胜任度')}</TableHead>
                  <TableHead className="w-[110px]">{t('岗位胜任度（新）')}</TableHead>
                  <TableHead className="w-[110px]">{t('能力认证得分')}</TableHead>
                  <TableHead className="sticky right-0 w-[110px] bg-white text-right">
                    {t('操作')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                      {t('加载中...')}
                    </TableCell>
                  </TableRow>
                ) : results.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                      {selectedPositionId ? t('暂无符合条件的认定结果') : t('请在左侧选择岗位')}
                    </TableCell>
                  </TableRow>
                ) : (
                  results.map((result) => (
                    <TableRow key={result.id} className="group">
                      <TableCell className="font-medium">{result.studentName}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {result.studentId}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {result.department || '-'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {result.className || '-'}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-medium">
                          {result.totalAbilityPoints > 0
                            ? `${((result.achievedAbilityPoints / result.totalAbilityPoints) * 100).toFixed(0)}%`
                            : '-'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {result.positionCompetency != null
                            ? `${result.positionCompetency.toFixed(1)}%`
                            : '-'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {result.positionCompetencyV2 != null
                            ? `${result.positionCompetencyV2.toFixed(1)}%`
                            : '-'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {result.abilityCognitionScore != null
                            ? result.abilityCognitionScore.toFixed(1)
                            : '-'}
                        </span>
                      </TableCell>
                      <TableRowActions className="sticky right-0 bg-white">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => openDetail(result.id)}
                        >
                          <Eye className="mr-1 h-3 w-3" />
                          {t('查看明细')}
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
              <span className="text-sm text-muted-foreground">
                {t('共 {n} 条记录', { n: total })}
              </span>
              <PaginationBar
                page={page}
                totalPages={totalPages}
                onPageChange={(p) => applyFilters({ page: p })}
              />
            </div>
          )}
        </div>
      </div>

      {/* 能力点明细弹窗 */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('能力点认定明细')}</DialogTitle>
            <DialogDescription>
              {detail
                ? t('{name}（{id}）· {position}', {
                    name: detail.studentName,
                    id: detail.studentId,
                    position: detail.positionName,
                  })
                : t('加载中...')}
            </DialogDescription>
          </DialogHeader>
          {detailLoading ? (
            <div className="py-10 text-center text-sm text-muted-foreground">{t('加载中...')}</div>
          ) : detail ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4 text-sm">
                <span className="text-muted-foreground">
                  {t('能力点达成 {a}/{b}', {
                    a: detail.achievedAbilityPoints,
                    b: detail.totalAbilityPoints,
                  })}
                </span>
                <span className="text-muted-foreground">
                  {t('达标率 {rate}%', { rate: (detail.achievementRate ?? 0).toFixed(1) })}
                </span>
                <span className="text-muted-foreground">
                  {t('岗位胜任度（新） {value}', {
                    value:
                      detail.positionCompetencyV2 != null
                        ? `${detail.positionCompetencyV2.toFixed(1)}%`
                        : '-',
                  })}
                </span>
                <span className="text-muted-foreground">
                  {t('认定时间 {time}', { time: formatDateTime(detail.evaluationTime) })}
                </span>
              </div>
              {detail.abilityPointDetails && detail.abilityPointDetails.length > 0 ? (
                <div className="max-h-[50vh] overflow-y-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('能力点')}</TableHead>
                        <TableHead className="w-[100px]">{t('得分')}</TableHead>
                        <TableHead className="w-[110px]">{t('档位')}</TableHead>
                        <TableHead className="w-[100px]">{t('权重')}</TableHead>
                        <TableHead className="w-[100px]">{t('是否达成')}</TableHead>
                        <TableHead className="w-[110px]">{t('胜任度（新）')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detail.abilityPointDetails.map((point, index) => (
                        <TableRow key={point.abilityPointId || index}>
                          <TableCell className="text-sm">{point.abilityPointName}</TableCell>
                          <TableCell className="text-sm">
                            {point.maxScore != null
                              ? `${point.score}/${point.maxScore}`
                              : point.score}
                          </TableCell>
                          <TableCell className="text-sm">
                            {point.levelLabel ? (
                              <Badge
                                variant="outline"
                                className={cn(
                                  'text-xs',
                                  point.levelLabel === '未达标'
                                    ? 'bg-red-50 text-red-600 border-red-200'
                                    : 'bg-primary/5 text-primary border-primary/15',
                                )}
                              >
                                {point.levelLabel}
                              </Badge>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {point.weight != null ? `${point.weight}%` : '-'}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={cn(
                                'text-xs',
                                point.achieved
                                  ? 'bg-green-50 text-green-600 border-green-200'
                                  : 'bg-red-50 text-red-600 border-red-200',
                              )}
                            >
                              {point.achieved ? t('已达成') : t('未达成')}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {point.competencyV2 != null ? `${point.competencyV2.toFixed(1)}%` : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  {t('暂无能力点明细')}
                </div>
              )}
            </div>
          ) : (
            <div className="py-10 text-center text-sm text-muted-foreground">
              {t('未找到结果明细')}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function JobAbilityResultsPage() {
  const t = useT()
  return (
    <Suspense
      fallback={
        <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center text-sm text-gray-400">
          {t('加载中...')}
        </div>
      }
    >
      <JobAbilityResultsContent />
    </Suspense>
  )
}
