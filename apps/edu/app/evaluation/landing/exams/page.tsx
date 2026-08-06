'use client'

import Link from 'next/link'
import { useState, useEffect, useMemo } from 'react'
import {
  ArrowLeft,
  ClipboardList,
  Clock,
  FileText,
  PlayCircle,
  Search,
  BarChart3,
  CheckCircle2,
  Calendar,
  Users,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { landingApi } from '@/lib/api'
import { StatusBadge } from '@/components/shared/status-badge'
import type { LandingExamItem } from '@/lib/api'

export default function ExamListPage() {
  const [exams, setExams] = useState<LandingExamItem[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'my' | 'all'>('all')
  const [search, setSearch] = useState('')
  const [collegeFilter, setCollegeFilter] = useState('全部')
  const [majorFilter, setMajorFilter] = useState('全部')

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const res = await landingApi.listExams()
        setExams(res.items || [])
      } catch {
        // ignore
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const collegeOptions = useMemo(() => {
    const cols = new Set(exams.map((e) => e.college).filter(Boolean))
    return ['全部', ...Array.from(cols)]
  }, [exams])

  const majorOptions = useMemo(() => {
    const majors = new Set(exams.map((e) => e.major).filter(Boolean))
    return ['全部', ...Array.from(majors)]
  }, [exams])

  const baseList = tab === 'my' ? exams.filter((e) => e.status === '进行中') : exams

  const examsList = useMemo(
    () =>
      baseList.filter((e) => {
        const matchSearch =
          e.name.toLowerCase().includes(search.toLowerCase()) ||
          e.id.toLowerCase().includes(search.toLowerCase()) ||
          e.college?.toLowerCase().includes(search.toLowerCase())
        const matchCollege = collegeFilter === '全部' || e.college === collegeFilter
        const matchMajor = majorFilter === '全部' || e.major === majorFilter
        return matchSearch && matchCollege && matchMajor
      }),
    [baseList, search, collegeFilter, majorFilter],
  )

  const stats = [
    { label: '全部考试', value: exams.length, icon: BarChart3, color: 'var(--primary)' },
    {
      label: '进行中',
      value: exams.filter((e) => e.status === '进行中').length,
      icon: PlayCircle,
      color: 'var(--primary)',
    },
    {
      label: '未开始',
      value: exams.filter((e) => e.status === '未开始').length,
      icon: Clock,
      color: '#f59e0b',
    },
    {
      label: '已结束',
      value: exams.filter((e) => e.status === '已结束').length,
      icon: CheckCircle2,
      color: '#10b981',
    },
  ]

  return (
    <div className="min-h-screen bg-[#f5f7fa]">
      {/* Hero */}
      <div
        className="relative overflow-hidden px-6 py-10 text-white"
        style={{ background: 'linear-gradient(135deg, var(--primary), color-mix(in srgb, var(--primary) 75%, white), color-mix(in srgb, var(--primary) 85%, white))' }}
      >
        <div className="mx-auto max-w-7xl">
          <div className="mb-4 flex items-center gap-3">
            <Link href="/evaluation/landing">
              <Button variant="ghost" size="sm" className="gap-1 text-white hover:bg-white/20">
                <ArrowLeft className="h-4 w-4" />
                返回首页
              </Button>
            </Link>
          </div>
          <h1 className="text-2xl font-bold">考试中心</h1>
          <p className="mt-1 text-sm text-white/80">查看和管理你的所有考试，随时开始答题</p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-6">
        {/* Stats */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((s) => (
            <div
              key={s.label}
              className="flex items-center gap-3 rounded-xl bg-white p-4"
              style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
            >
              <div
                className="flex h-10 w-10 items-center justify-center rounded-lg"
                style={{ background: s.color + '15', color: s.color }}
              >
                <s.icon className="h-5 w-5" />
              </div>
              <div>
                <div className="text-lg font-bold" style={{ color: s.color }}>
                  {s.value}
                </div>
                <div className="text-xs text-gray-500">{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs + Search */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            {(['my', 'all'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="rounded-full px-4 py-1.5 text-sm font-medium transition-colors"
                style={
                  tab === t
                    ? { background: 'var(--primary)', color: '#fff' }
                    : { background: '#fff', color: '#666', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }
                }
              >
                {t === 'my' ? '我的考试' : '全部考试'}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="搜索考试名称、编码与班级名称"
                className="h-9 rounded-full border-0 bg-white pl-9 text-sm shadow-sm"
                style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {collegeOptions.length > 1 && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-500 whitespace-nowrap">二级院系</span>
                <select
                  value={collegeFilter}
                  onChange={(e) => setCollegeFilter(e.target.value)}
                  className="h-9 rounded-full border-0 bg-white px-3 text-sm text-gray-700 shadow-sm outline-none"
                  style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
                >
                  {collegeOptions.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {majorOptions.length > 1 && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-500 whitespace-nowrap">适用专业</span>
                <select
                  value={majorFilter}
                  onChange={(e) => setMajorFilter(e.target.value)}
                  className="h-9 rounded-full border-0 bg-white px-3 text-sm text-gray-700 shadow-sm outline-none"
                  style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
                >
                  {majorOptions.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {examsList.map((exam) => (
              <Link key={exam.id} href={`/evaluation/landing/exams/${exam.id}`} className="block">
                <div
                  className="h-full cursor-pointer rounded-xl bg-white p-5 transition-all duration-300"
                  style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
                  onMouseEnter={(e) => {
                    const el = e.currentTarget
                    el.style.transform = 'translateY(-4px)'
                    el.style.boxShadow = '0 8px 24px rgba(0,0,0,0.1)'
                  }}
                  onMouseLeave={(e) => {
                    const el = e.currentTarget
                    el.style.transform = 'translateY(0)'
                    el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'
                  }}
                >
                  <div className="mb-3 flex items-start justify-between">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-lg"
                      style={{ background: 'color-mix(in srgb, var(--primary) 8%, white)', color: 'var(--primary)' }}
                    >
                      <ClipboardList className="h-5 w-5" />
                    </div>
                    <StatusBadge status={exam.status} />
                  </div>
                  <h3 className="mb-1 text-base font-semibold text-gray-900">{exam.name}</h3>
                  <p className="mb-3 text-sm text-gray-500 line-clamp-2">{exam.description}</p>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {exam.duration} 分钟
                    </span>
                    <span className="flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      {exam.questionCount} 题
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {exam.time}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-1 text-xs text-gray-500">
                    <Users className="h-3 w-3" />
                    考试对象：{exam.targetAudience || exam.major || exam.college}
                  </div>
                  {exam.status === '进行中' && (
                    <div className="mt-4">
                      <Button
                        size="sm"
                        className="w-full gap-1 rounded-lg"
                        style={{ background: 'var(--primary)' }}
                      >
                        <PlayCircle className="h-4 w-4" />
                        开始考试
                      </Button>
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}

        {!loading && examsList.length === 0 && (
          <div
            className="rounded-xl bg-white py-20 text-center text-sm text-gray-400"
            style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
          >
            <ClipboardList className="mx-auto mb-3 h-12 w-12 opacity-30" />
            <p>暂无考试</p>
          </div>
        )}
      </div>
    </div>
  )
}
