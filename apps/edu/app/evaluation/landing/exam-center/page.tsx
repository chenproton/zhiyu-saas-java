'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Clock,
  ClipboardList,
  FileText,
  Lock,
  PlayCircle,
  Search,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { examUsageApi } from '@/lib/api'
import type { ExamCenterItem } from '@/lib/types'
import { formatDateTime } from '@/lib/format-utils'
import { PlatformFooter } from '@/components/job/student/platform-footer'
import { cn } from '@/lib/utils'

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  published: { label: '待考', className: 'bg-amber-50 text-amber-600 border-amber-200' },
  in_progress: { label: '进行中', className: 'bg-green-50 text-green-600 border-green-200' },
  finished: { label: '已结束', className: 'bg-gray-100 text-gray-500 border-gray-200' },
}

export default function ExamCenterPage() {
  const [items, setItems] = useState<ExamCenterItem[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'all' | 'mine'>('all')
  const [keyword, setKeyword] = useState('')

  useEffect(() => {
    examUsageApi
      .center()
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [])

  const isStudent = items.length > 0 ? items[0]?.studentView : true

  const filtered = useMemo(() => {
    let list = items
    if (tab === 'mine') list = list.filter((i) => i.participatable)
    if (keyword.trim()) {
      const q = keyword.trim().toLowerCase()
      list = list.filter(
        (i) =>
          i.usageName.toLowerCase().includes(q) || i.examName.toLowerCase().includes(q),
      )
    }
    return list
  }, [items, tab, keyword])

  return (
    <div className="min-h-screen flex flex-col bg-[#faf5ff]">
      {/* 页头 */}
      <div className="bg-gradient-to-br from-[#4c1d95] via-[#7c3aed] to-[#a78bfa]">
        <div className="max-w-[1400px] mx-auto px-8 py-8">
          <Link
            href="/evaluation/landing"
            className="inline-flex items-center gap-1.5 text-white/80 hover:text-white text-sm mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            返回测评资源平台
          </Link>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center">
              <ClipboardList className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">考试中心</h1>
              <p className="text-sm text-white/80 mt-1">
                查看全部考试与你可参加的考试，按班级开放
              </p>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-[1400px] mx-auto px-8 py-6 w-full flex-1">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <Tabs value={tab} onValueChange={(v) => setTab(v as 'all' | 'mine')}>
            <TabsList className="bg-white p-1 rounded-xl border border-[#e7e5e4] shadow-sm h-11">
              <TabsTrigger
                value="all"
                className="px-5 rounded-[10px] text-[13px] data-[state=active]:bg-purple-500 data-[state=active]:text-white"
              >
                全部考试 ({items.length})
              </TabsTrigger>
              {isStudent && (
                <TabsTrigger
                  value="mine"
                  className="px-5 rounded-[10px] text-[13px] data-[state=active]:bg-purple-500 data-[state=active]:text-white"
                >
                  我可参加 (
                  {items.filter((i) => i.participatable).length})
                </TabsTrigger>
              )}
            </TabsList>
          </Tabs>
          <div className="relative w-full sm:w-[320px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" />
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="搜索考试名称..."
              className="pl-10 h-11 bg-white border-[#e7e5e4] rounded-xl text-sm shadow-sm focus:border-purple-300 focus:ring-2 focus:ring-purple-100 transition-all"
            />
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl border border-[#e7e5e4] h-[220px] animate-pulse shadow-sm"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-[#94a3b8] bg-white rounded-2xl border border-[#e7e5e4] shadow-sm">
            <ClipboardList className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <div className="text-[15px] font-medium text-[#475569]">暂无考试</div>
            <div className="text-[13px] mt-1">发布后的考试安排会展示在这里</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((item) => {
              const status = STATUS_LABELS[item.status] || {
                label: item.status,
                className: 'bg-gray-100 text-gray-500 border-gray-200',
              }
              const finished = item.status === 'finished'
              const canEnter = item.participatable && !item.submitted && !finished
              const entryHref = `/evaluation/landing/exams/${item.examId}?usage=${item.id}`
              return (
                <div
                  key={item.id}
                  className="bg-white rounded-2xl border border-[#e7e5e4] overflow-hidden hover:shadow-[0_8px_28px_rgba(0,0,0,0.1)] hover:-translate-y-1 transition-all flex flex-col shadow-[0_2px_6px_rgba(0,0,0,0.04)]"
                >
                  <div className="px-5 pt-5">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-[15px] font-semibold text-slate-800 truncate">
                        {item.usageName}
                      </h3>
                      <Badge
                        variant="outline"
                        className={cn('text-[11px] h-5 px-2 shrink-0', status.className)}
                      >
                        {status.label}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-400 mt-1 truncate">试卷：{item.examName}</p>
                  </div>
                  <div className="px-5 py-3 flex items-center gap-4 text-[11px] text-slate-400 border-b border-slate-50">
                    <span className="flex items-center gap-1">
                      <FileText className="w-3 h-3" /> {item.questionCount} 题
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {item.duration ? `${item.duration} 分钟` : '不限时'}
                    </span>
                    <span className="flex items-center gap-1">
                      <CalendarClock className="w-3 h-3" />
                      {item.startTime ? formatDateTime(item.startTime) : '不限时间'}
                    </span>
                  </div>
                  <div className="px-5 pb-5 pt-3 flex-1 flex flex-col justify-between gap-3">
                    {item.submitted && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-slate-500">已交卷</span>
                        {item.score != null && (
                          <span className="font-semibold text-green-600">
                            {item.score}/{item.totalScore} 分
                          </span>
                        )}
                      </div>
                    )}
                    {!item.participatable && isStudent && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-400">
                        <Lock className="w-3 h-3" />
                        仅限指定班级参加
                      </div>
                    )}
                    {!item.participatable && !isStudent && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-400">
                        <Lock className="w-3 h-3" />
                        仅学生可参加
                      </div>
                    )}
                    <div>
                      {canEnter ? (
                        <Button
                          asChild
                          className="w-full rounded-[10px] h-9 text-xs bg-gradient-to-r from-purple-500 to-purple-400 hover:from-purple-600 hover:to-purple-500 text-white shadow-md shadow-purple-500/20"
                        >
                          <Link href={entryHref}>
                            <PlayCircle className="w-3.5 h-3.5 mr-1" /> 开始考试
                          </Link>
                        </Button>
                      ) : item.submitted ? (
                        <Button
                          asChild
                          variant="outline"
                          className="w-full rounded-[10px] h-9 text-xs text-green-600 border-green-200 hover:bg-green-50"
                        >
                          <Link href={entryHref}>
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> 查看结果
                          </Link>
                        </Button>
                      ) : (
                        <Button
                          disabled
                          className="w-full rounded-[10px] h-9 text-xs bg-slate-100 text-slate-400 cursor-not-allowed"
                        >
                          {finished ? '考试已结束' : '不可参加'}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
      <PlatformFooter />
    </div>
  )
}
