'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  GraduationCap,
  User,
  Award,
  CheckCircle2,
  XCircle,
  Eye,
  Download,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { examUsageApi, examResultApi } from '@/lib/api'
import { useMajorMap } from '@/lib/use-resource-maps'
import type { ExamUsage, ExamResult } from '@/lib/types'
import { formatDateTime } from '@/lib/format-utils'
import { SearchInput } from '@/components/shared/search-input'
import { PaginationBar } from '@/components/shared/pagination-bar'
import { EmptyState, TableEmptyRow, ErrorState } from '@zhiyu/ui'
import { useT } from '@/lib/i18n/locale-provider'
import { DetailPageHeader } from '@/components/shared/detail-page-header'
import { fetchAllPages } from '@zhiyu/api-client'

interface ExamStudentResult {
  id: string
  studentName: string
  studentId: string
  className: string
  grade: string
  majorId: string
  score: number
  totalScore: number
  submitTime: Date
  isPass: boolean
  gradingStatus?: string
  rank: number
}

// 列表分页大小：统计基于完整数据，列表展示分页
const PAGE_SIZE = 20

function ExamResultsContent() {
  const t = useT()
  const router = useRouter()
  const searchParams = useSearchParams()
  const usageId = searchParams.get('usageId') || ''
  const [usage, setUsage] = useState<ExamUsage | null>(null)
  const [results, setResults] = useState<ExamStudentResult[]>([])
  const [loading, setLoading] = useState(!!usageId)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [passFilter, setPassFilter] = useState<string>('all')
  const [page, setPage] = useState(1)
  const majorMap = useMajorMap()
  // 供错误态「重试」复用首载逻辑
  const fetchResultsRef = useRef<() => Promise<void>>(async () => {})

  useEffect(() => {
    if (!usageId) return
    let cancelled = false
    const fetchData = async () => {
      setLoading(true)
      setLoadError(null)
      // 切换考试安排时回到第一页（组件复用，避免停留在越界页）
      setPage(1)
      try {
        // 列表接口显式带 limit 分页全量拉取：后端默认仅返回 50 条（封顶 200），
        // 不做分页合并会导致统计（参考人数/平均分等）与列表基于截断数据
        const [usageRes, allItems] = await Promise.all([
          examUsageApi.get(usageId).catch((err: any) => {
            // 区分 404（确实不存在）与网络/其他错误（展示错误态与重试入口）
            if (err?.status !== 404 && !cancelled) {
              setLoadError(err instanceof Error ? err.message : t('加载失败'))
            }
            return null
          }),
          fetchAllPages((p, ps) =>
            examResultApi.list({ usageId, limit: ps, offset: p * ps }),
          ).catch(() => [] as ExamResult[]),
        ])
        if (cancelled) return
        setUsage(usageRes)
        setResults(
          allItems.map((r, idx) => ({
            id: r.id,
            studentName: r.studentName || t('匿名'),
            studentId: r.userId,
            className: r.className || '-',
            grade: r.grade || '-',
            majorId: r.majorName || '-',
            score: r.score,
            totalScore: r.totalScore,
            submitTime: new Date(r.submitTime),
            isPass: r.isPass,
            gradingStatus: r.gradingStatus,
            rank: idx + 1,
          })),
        )
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchResultsRef.current = fetchData
    fetchData()
    return () => {
      cancelled = true
    }
  }, [usageId, t])

  const filteredResults = results.filter((r) => {
    if (passFilter !== 'all') {
      if (passFilter === 'pass' ? !r.isPass : r.isPass) return false
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      return r.studentName.toLowerCase().includes(q)
    }
    return true
  })

  const totalPages = Math.max(1, Math.ceil(filteredResults.length / PAGE_SIZE))
  const pagedResults = filteredResults.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const stats = {
    total: results.length,
    pass: results.filter((r) => r.isPass).length,
    fail: results.length - results.filter((r) => r.isPass).length,
    avgScore:
      results.length > 0
        ? Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length)
        : 0,
    maxScore: results.length > 0 ? Math.max(...results.map((r) => r.score)) : 0,
    minScore: results.length > 0 ? Math.min(...results.map((r) => r.score)) : 0,
  }

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center text-muted-foreground">
        {t('加载中...')}
      </div>
    )
  }

  if (!usage) {
    if (loadError) {
      return (
        <div className="flex h-[50vh] items-center justify-center">
          <ErrorState
            title={t('加载失败')}
            description={loadError}
            onRetry={() => {
              setLoadError(null)
              setLoading(true)
              // 复用首载逻辑重新拉取
              fetchResultsRef.current?.()
            }}
          />
        </div>
      )
    }
    return (
      <EmptyState
        className="h-[50vh]"
        title={t('考试记录不存在')}
        titleClassName="text-lg font-semibold text-foreground"
        description={t('该考试记录可能已被删除')}
        action={
          <Button asChild>
            <Link href="/evaluation/exam-usage">{t('返回考试管理')}</Link>
          </Button>
        }
      />
    )
  }

  return (
    <div className="space-y-6">
      <DetailPageHeader
        title={usage.name}
        backHref="/evaluation/exam-usage"
        backLabel={t('返回考试管理')}
        statusBadge={
          <Badge variant="outline" className="gap-1">
            <GraduationCap className="size-4" />
            {t('在线考试')}
          </Badge>
        }
        actions={
          <Button variant="outline" disabled>
            <Download className="mr-2 size-4" />
            {t('导出数据')}
          </Button>
        }
      />

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        <Card className="bg-gradient-to-br from-slate-50 to-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">{t('参考人数')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-50 to-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">{t('平均分')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{stats.avgScore}</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-primary/5 to-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">{t('最高分')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{stats.maxScore}</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-50 to-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">{t('最低分')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{stats.minScore}</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">{t('及格人数')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.pass}</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-red-50 to-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">{t('不及格人数')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.fail}</div>
          </CardContent>
        </Card>
      </div>

      {/* 筛选栏 */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <SearchInput
          wrapperClassName="flex-1 sm:max-w-xs"
          placeholder={t('搜索学生姓名...')}
          value={search}
          onChange={(v) => {
            setSearch(v)
            setPage(1)
          }}
        />
        <div className="flex gap-2">
          <Button
            variant={passFilter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setPassFilter('all')
              setPage(1)
            }}
          >
            {t('全部')}
          </Button>
          <Button
            variant={passFilter === 'pass' ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setPassFilter('pass')
              setPage(1)
            }}
          >
            <CheckCircle2 className="mr-1 size-3.5 text-emerald-500" />
            {t('及格')}
          </Button>
          <Button
            variant={passFilter === 'fail' ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setPassFilter('fail')
              setPage(1)
            }}
          >
            <XCircle className="mr-1 size-3.5 text-red-500" />
            {t('不及格')}
          </Button>
        </div>
      </div>

      {/* 结果列表 */}
      <div className="rounded-lg border bg-white px-4 py-3">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">
                  <div className="flex items-center gap-1">
                    <User className="size-3.5" />
                    {t('学生名称')}
                  </div>
                </TableHead>
                <TableHead className="w-[120px]">{t('学号')}</TableHead>
                <TableHead className="w-[120px]">{t('班级')}</TableHead>
                <TableHead className="w-[100px]">{t('年级')}</TableHead>
                <TableHead className="w-[140px]">{t('专业')}</TableHead>
                <TableHead className="w-[160px]">{t('考试时间')}</TableHead>
                <TableHead className="w-[100px]">
                  <div className="flex items-center gap-1">
                    <Award className="size-3.5" />
                    {t('考试得分')}
                  </div>
                </TableHead>
                <TableHead className="w-[100px]">{t('评分状态')}</TableHead>
                <TableHead className="w-[100px]">{t('是否及格')}</TableHead>
                <TableHead className="sticky right-0 w-[100px] bg-white text-right">{t('操作')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredResults.length === 0 ? (
                <TableEmptyRow colSpan={10}>
                  {results.length === 0 ? t('暂无考试结果') : t('没有找到匹配的结果')}
                </TableEmptyRow>
              ) : (
                pagedResults.map((result) => (
                  <TableRow key={result.id}>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex w-6 items-center justify-center text-xs font-semibold text-muted-foreground">
                          {result.rank}
                        </span>
                        <User className="size-3.5 text-primary" />
                        <span className="text-sm">{result.studentName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {result.studentId}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {result.className}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{result.grade}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {majorMap.get(result.majorId) || result.majorId || '-'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDateTime(result.submitTime)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold">{result.score}</span>
                        <span className="text-xs text-muted-foreground">/ {result.totalScore}</span>
                      </div>
                      <div className="mt-1 h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full rounded-full ${
                            result.isPass ? 'bg-emerald-500' : 'bg-red-500'
                          }`}
                          style={{
                            width: `${result.totalScore > 0 ? (result.score / result.totalScore) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      {result.gradingStatus === 'evaluated' ? (
                        <Badge variant="outline" className="gap-1 text-emerald-600 border-emerald-200 bg-emerald-50">
                          <CheckCircle2 className="size-3" />
                          {t('已评分')}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1 text-amber-600 border-amber-200 bg-amber-50">
                          {t('待评分')}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {result.isPass ? (
                        <Badge variant="default" className="gap-1 bg-emerald-500">
                          <CheckCircle2 className="size-3" />
                          {t('及格')}
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="gap-1">
                          <XCircle className="size-3" />
                          {t('不及格')}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="sticky right-0 bg-white text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1 text-xs"
                        onClick={() =>
                          router.push(`/evaluation/lesson-results/daily-exams/${result.id}`)
                        }
                      >
                        <Eye className="size-3.5" />
                        {t('查看详情')}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* 分页 */}
      {filteredResults.length > PAGE_SIZE && (
        <div className="flex justify-end">
          <PaginationBar
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  )
}

export default function ExamResultsPage() {
  const t = useT()
  return (
    <Suspense fallback={<div className="p-6 text-center text-muted-foreground">{t('加载中...')}</div>}>
      <ExamResultsContent />
    </Suspense>
  )
}
