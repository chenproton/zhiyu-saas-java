'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Eye,
  PenLine,
  Search,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { examUsageApi, examResultApi } from '@/lib/api'
import type { ExamResult, ExamUsage } from '@/lib/types'
import { formatDateTime } from '@/lib/format-utils'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface UsageStats {
  submitted: number
  pending: number
  graded: number
}

export default function DailyExamsPage() {
  const [usages, setUsages] = useState<ExamUsage[]>([])
  const [usageStats, setUsageStats] = useState<Record<string, UsageStats>>({})
  const [selectedUsageId, setSelectedUsageId] = useState<string | null>(null)
  const [results, setResults] = useState<ExamResult[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const res = await examUsageApi.list({ limit: 500 })
        const items = res.items || []
        setUsages(items)
        setSelectedUsageId((prev) => prev ?? items[0]?.id ?? null)
        const stats: Record<string, UsageStats> = {}
        await Promise.all(
          items.map(async (u) => {
            try {
              const r = await examResultApi.list({ usageId: u.id, limit: 500 })
              const list = r.items || []
              stats[u.id] = {
                submitted: list.length,
                pending: list.filter((x) => x.gradingStatus !== 'evaluated').length,
                graded: list.filter((x) => x.gradingStatus === 'evaluated').length,
              }
            } catch {
              stats[u.id] = { submitted: 0, pending: 0, graded: 0 }
            }
          }),
        )
        setUsageStats(stats)
      } catch {
        /* ignore */
      }
      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    if (!selectedUsageId) return
    examResultApi
      .list({ usageId: selectedUsageId, limit: 500 })
      .then((res) => setResults(res.items || []))
      .catch(() => setResults([]))
  }, [selectedUsageId])

  const filteredUsages = useMemo(() => {
    if (!search.trim()) return usages
    const q = search.trim().toLowerCase()
    return usages.filter((u) => u.name.toLowerCase().includes(q))
  }, [usages, search])

  const selectedUsage = usages.find((u) => u.id === selectedUsageId) || null
  const selectedStats = selectedUsageId ? usageStats[selectedUsageId] : undefined

  if (loading)
    return <div className="h-screen flex items-center justify-center text-gray-400">加载中...</div>

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <div className="bg-white border-b border-gray-200 shrink-0">
        <div className="max-w-[1600px] mx-auto px-6 py-4">
          <h1 className="text-xl font-semibold text-foreground">日常考试评价</h1>
          <p className="text-sm text-gray-500 mt-0.5">选择考试安排，查看学生提交并进行评分</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden max-w-[1600px] mx-auto w-full">
        <div className="w-full md:w-80 shrink-0 bg-white border-r border-gray-200 flex flex-col max-h-[50vh] md:max-h-none">
          <div className="p-4 border-b border-gray-100">
            <div className="relative w-full">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                placeholder="搜索考试名称..."
                className="pl-9 text-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
            {filteredUsages.map((u) => {
              const st = usageStats[u.id]
              const pending = st?.pending || 0
              return (
                <button
                  key={u.id}
                  onClick={() => setSelectedUsageId(u.id)}
                  className={cn(
                    'w-full text-left rounded-xl p-3 transition-all border',
                    selectedUsageId === u.id
                      ? 'bg-primary/[0.06] border-primary/30 shadow-sm ring-1 ring-primary/10'
                      : 'bg-white border-gray-100 hover:border-gray-300 hover:shadow-sm',
                  )}
                >
                  <p
                    className={cn(
                      'text-sm font-semibold truncate',
                      selectedUsageId === u.id ? 'text-primary' : 'text-gray-800',
                    )}
                  >
                    {u.name}
                  </p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[11px] text-gray-400 truncate">
                      已提交 {st?.submitted || 0} 人
                    </span>
                    {pending > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 font-medium border border-amber-100">
                        待评 {pending}
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
            {filteredUsages.length === 0 && (
              <p className="text-center text-xs text-gray-400 py-8">暂无考试安排</p>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {selectedUsage ? (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-800">{selectedUsage.name}</h2>
                  <div className="flex items-center gap-2 mt-1.5">
                    <Badge variant="outline" className="text-xs font-normal text-gray-500">
                      {selectedUsage.status === 'finished'
                        ? '已结束'
                        : selectedUsage.status === 'in_progress'
                          ? '进行中'
                          : '待开始'}
                    </Badge>
                    <span className="text-xs text-gray-400">
                      {selectedStats?.submitted || 0} 份提交 · 待评 {selectedStats?.pending || 0} ·
                      已评 {selectedStats?.graded || 0}
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 overflow-hidden bg-white">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="text-xs">学生</TableHead>
                      <TableHead className="text-xs">班级</TableHead>
                      <TableHead className="text-xs">年级</TableHead>
                      <TableHead className="text-xs">得分</TableHead>
                      <TableHead className="text-xs">评分状态</TableHead>
                      <TableHead className="text-xs">提交时间</TableHead>
                      <TableHead className="text-xs text-right w-40">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="text-sm font-medium">{r.studentName}</TableCell>
                        <TableCell className="text-xs text-gray-500">{r.className}</TableCell>
                        <TableCell className="text-xs text-gray-500">{r.grade}</TableCell>
                        <TableCell className="text-sm font-semibold">
                          {r.score}/{r.totalScore}
                        </TableCell>
                        <TableCell>
                          {r.gradingStatus === 'evaluated' ? (
                            <Badge
                              variant="outline"
                              className="text-[10px] bg-green-50 text-green-600 border-green-200 gap-1"
                            >
                              <CheckCircle2 className="h-3 w-3" />
                              已评分
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-[10px] bg-amber-50 text-amber-600 border-amber-200"
                            >
                              待评分
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-gray-500">
                          {formatDateTime(r.submitTime)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="outline" size="sm" className="h-7 text-xs px-2" asChild>
                            <Link href={`/evaluation/lesson-results/daily-exams/${r.id}`}>
                              <Eye className="mr-1 h-3 w-3" />
                              查看
                            </Link>
                          </Button>
                          {r.gradingStatus === 'evaluated' ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-green-600 px-2"
                              disabled
                            >
                              <CheckCircle2 className="mr-1 h-3 w-3" />
                              已评分
                            </Button>
                          ) : (
                            <Button size="sm" className="h-7 text-xs px-2" asChild>
                              <Link href={`/evaluation/lesson-results/daily-exams/${r.id}`}>
                                <PenLine className="mr-1 h-3 w-3" />
                                评分
                              </Link>
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {results.length === 0 && (
                  <div className="py-12 text-center text-gray-400">
                    <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-40" />
                    <p className="text-sm">暂无学生提交记录</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-400">
              <BookOpen className="h-12 w-12 mb-3 opacity-50" />
              <p className="text-sm">请在左侧选择一个考试安排</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
