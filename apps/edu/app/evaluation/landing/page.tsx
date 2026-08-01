'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Search,
  Filter,
  X,
  ChevronRight,
  Library,
  ClipboardList,
  FileText,
  Clock,
  Sparkles,
  PlayCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { questionBankApi, examApi, evaluationBatchApi } from '@/lib/api'
import type { QuestionBank, Exam } from '@/lib/types'
import { PlatformFooter } from '@/components/job/student/platform-footer'
import { LandingFilterRow } from '@/components/shared/landing-filter-row'
import { LandingPagination } from '@/components/shared/landing-pagination'

const CARDS_PER_PAGE = 12
const SORT_OPTIONS = [
  { value: 'default', label: '默认排序' },
  { value: 'recent', label: '最近收录' },
  { value: 'update', label: '最近更新' },
]

const coverGradients = [
  'linear-gradient(135deg,#7c3aed,#8b5cf6)',
  'linear-gradient(135deg,#a855f7,#c084fc)',
  'linear-gradient(135deg,#6366f1,#818cf8)',
  'linear-gradient(135deg,#ec4899,#f472b6)',
  'linear-gradient(135deg,#f43f5e,#fb7185)',
  'linear-gradient(135deg,#8b5cf6,#a78bfa)',
]

function BankCard({ bank, index }: { bank: QuestionBank; index: number }) {
  return (
    <Link
      href={`/evaluation/landing/banks/${bank.id}`}
      className="group block no-underline text-inherit"
    >
      <div className="bg-white rounded-2xl border border-[#e7e5e4] overflow-hidden hover:shadow-[0_8px_28px_rgba(0,0,0,0.1)] hover:border-purple-200 hover:-translate-y-1 transition-all h-full flex flex-col shadow-[0_2px_6px_rgba(0,0,0,0.04)]">
        <div
          className="h-[110px] flex items-center justify-center shrink-0 relative"
          style={{ background: coverGradients[index % coverGradients.length] }}
        >
          <Library className="w-12 h-12 text-white/80" />
          <span className="absolute top-3 right-3 bg-white/20 backdrop-blur-sm text-white px-2.5 py-1 rounded-full text-[11px] font-medium border border-white/10">
            v{bank.version}
          </span>
        </div>
        <div className="p-5 flex-1 flex flex-col">
          <h3 className="text-[15px] font-semibold text-slate-800 mb-1.5 truncate">{bank.name}</h3>
          <p className="text-xs text-slate-400 leading-relaxed mb-3 line-clamp-2 flex-1">
            {bank.description || '暂无描述'}
          </p>
          <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-50 pt-3">
            <span className="flex items-center gap-1">
              <FileText className="w-3 h-3" /> {bank.questionCount} 题
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" /> {new Date(bank.createdAt).toLocaleDateString('zh-CN')}
            </span>
            <span className="text-purple-500 group-hover:text-purple-600 font-medium">
              查看详情 →
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}

function ExamCard({ exam, index }: { exam: Exam; index: number }) {
  return (
    <Link
      href={`/evaluation/landing/exams/${exam.id}`}
      className="group block no-underline text-inherit"
    >
      <div className="bg-white rounded-2xl border border-[#e7e5e4] overflow-hidden hover:shadow-[0_8px_28px_rgba(0,0,0,0.1)] hover:border-purple-200 hover:-translate-y-1 transition-all h-full flex flex-col shadow-[0_2px_6px_rgba(0,0,0,0.04)]">
        <div
          className="h-[110px] flex items-center justify-center shrink-0 relative"
          style={{ background: coverGradients[(index + 3) % coverGradients.length] }}
        >
          <ClipboardList className="w-12 h-12 text-white/80" />
          <span className="absolute top-3 right-3 bg-white/20 backdrop-blur-sm text-white px-2.5 py-1 rounded-full text-[11px] font-medium border border-white/10">
            {exam.duration} 分钟
          </span>
        </div>
        <div className="p-5 flex-1 flex flex-col">
          <h3 className="text-[15px] font-semibold text-slate-800 mb-1.5 truncate">{exam.name}</h3>
          <p className="text-xs text-slate-400 leading-relaxed mb-3 line-clamp-2 flex-1">
            {exam.description || '暂无描述'}
          </p>
          <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-50 pt-3 mb-3">
            <span className="flex items-center gap-1">
              <FileText className="w-3 h-3" /> {(exam.questions || []).length} 题
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" /> {exam.duration} 分钟
            </span>
          </div>
          <Button className="w-full rounded-[10px] h-9 text-xs bg-gradient-to-r from-purple-500 to-purple-400 hover:from-purple-600 hover:to-purple-500 text-white shadow-md shadow-purple-500/20 hover:shadow-lg hover:shadow-purple-500/30 hover:-translate-y-0.5 transition-all">
            <PlayCircle className="w-3.5 h-3.5 mr-1" /> 去考试
          </Button>
        </div>
      </div>
    </Link>
  )
}

export default function LandingHomePage() {
  const listRef = useRef<HTMLDivElement>(null)
  const [banks, setBanks] = useState<QuestionBank[]>([])
  const [exams, setExams] = useState<Exam[]>([])
  const [batchNames, setBatchNames] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [sort, setSort] = useState('default')
  const [keyword, setKeyword] = useState('')
  const [selectedBatch, setSelectedBatch] = useState('全部')

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const [banksRes, examsRes, batchesRes] = await Promise.all([
          questionBankApi.list({ status: 'published', limit: 1000 } as any),
          examApi.list({ status: 'published', limit: 1000 } as any),
          evaluationBatchApi.list({ limit: 1000 }),
        ])
        setBanks(banksRes.items || [])
        setExams(examsRes.items || [])
        const map = new Map<string, string>()
        ;(batchesRes.items || []).forEach((b: any) => {
          if (b.id && b.name) map.set(b.id, b.name)
        })
        setBatchNames(map)
      } catch {
        // ignore
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const batches = useMemo(() => {
    const set = new Set<string>()
    const lookup = (id: string) => batchNames.get(id) || id
    banks.forEach((b) => {
      if (b.batchId) set.add(lookup(b.batchId))
    })
    exams.forEach((e) => {
      if (e.batchId) set.add(lookup(e.batchId))
    })
    return ['全部', ...Array.from(set).sort()]
  }, [banks, exams, batchNames])

  const filteredBanks = useMemo(() => {
    let list = [...banks]
    if (keyword.trim()) {
      const k = keyword.trim().toLowerCase()
      list = list.filter(
        (b) => b.name.toLowerCase().includes(k) || (b.description || '').toLowerCase().includes(k),
      )
    }
    if (selectedBatch !== '全部')
      list = list.filter(
        (b) => b.batchId && (batchNames.get(b.batchId) || b.batchId) === selectedBatch,
      )
    switch (sort) {
      case 'recent':
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        break
      case 'update':
        list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        break
      default:
        list.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
        break
    }
    return list
  }, [banks, keyword, sort, selectedBatch, batchNames])

  const filteredExams = useMemo(() => {
    let list = [...exams]
    if (keyword.trim()) {
      const k = keyword.trim().toLowerCase()
      list = list.filter(
        (e) => e.name.toLowerCase().includes(k) || (e.description || '').toLowerCase().includes(k),
      )
    }
    if (selectedBatch !== '全部')
      list = list.filter(
        (e) => e.batchId && (batchNames.get(e.batchId) || e.batchId) === selectedBatch,
      )
    switch (sort) {
      case 'recent':
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        break
      case 'update':
        list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        break
      default:
        list.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
        break
    }
    return list
  }, [exams, keyword, sort, selectedBatch, batchNames])

  const totalPages = Math.max(1, Math.ceil(filteredBanks.length / CARDS_PER_PAGE))
  const pageBanks = useMemo(() => {
    const start = (currentPage - 1) * CARDS_PER_PAGE
    return filteredBanks.slice(start, start + CARDS_PER_PAGE)
  }, [filteredBanks, currentPage])
  const totalQuestions = banks.reduce((sum, b) => sum + (b.questionCount || 0), 0)
  const executeSearch = () => {
    setCurrentPage(1)
    setTimeout(() => listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  const handleKeywordChange = (value: string) => {
    setKeyword(value)
    setCurrentPage(1)
  }
  const handleSortChange = (value: string) => {
    setSort(value)
    setCurrentPage(1)
  }
  const handleBatchChange = (value: string) => {
    setSelectedBatch(value)
    setCurrentPage(1)
  }
  const clearFilters = () => {
    setKeyword('')
    setSelectedBatch('全部')
    setCurrentPage(1)
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#faf5ff]">
      {/* Hero Banner */}
      <div className="relative w-full pt-16 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#4c1d95] via-[#7c3aed] to-[#a78bfa]" />
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.2) 1px, transparent 1px)`,
            backgroundSize: '52px 52px',
          }}
        />
        <div className="absolute top-[-120px] right-[-5%] w-[500px] h-[500px] rounded-full bg-purple-300/20 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-80px] left-[8%] w-[400px] h-[400px] rounded-full bg-violet-400/15 blur-[100px] pointer-events-none" />
        <div className="absolute top-[20%] left-[30%] w-[300px] h-[300px] rounded-full bg-fuchsia-400/10 blur-[80px] pointer-events-none" />

        <div className="relative z-10 max-w-[1400px] mx-auto px-8 pb-14 pt-2 flex flex-col lg:flex-row justify-between items-start gap-8">
          <div className="flex-1 pt-4">
            <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-md text-white px-3.5 py-1.5 rounded-full text-[13px] border border-white/25 mb-5 shadow-[0_2px_12px_rgba(0,0,0,0.1)]">
              <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
              海量题库 · 智能组卷 · 在线考试
            </div>
            <h1 className="text-[42px] sm:text-[48px] lg:text-[52px] font-bold text-white leading-[1.15] mb-5 drop-shadow-sm">
              测评资源平台
              <br />
              <span className="text-purple-200">海量题库与试卷，助力教学测评</span>
            </h1>
            <p className="text-[17px] text-white/85 mb-7 max-w-2xl leading-relaxed">
              丰富题库资源与智能组卷工具，支持在线考试与自动评分，让教学测评更高效
            </p>
            <Button
              className="inline-flex items-center gap-2 bg-white text-purple-600 hover:bg-purple-50 hover:-translate-y-0.5 px-7 h-12 rounded-full text-sm font-semibold shadow-lg transition-all"
              onClick={() =>
                listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }
            >
              浏览资源 <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          <div className="w-full lg:w-[420px] shrink-0 flex flex-col gap-4 pt-4">
            <div className="bg-white/10 backdrop-blur-xl border border-white/15 rounded-2xl p-7 text-white shadow-[0_12px_40px_rgba(0,0,0,0.25)]">
              <div className="text-[15px] font-bold text-white/90 mb-5 flex items-center gap-2">
                <span className="w-5 h-5 rounded-md bg-white/20 flex items-center justify-center">
                  📊
                </span>
                平台统计
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-[14px] text-white/65">题库总数</span>
                  <span className="text-[26px] font-bold">{banks.length.toLocaleString()}</span>
                </div>
                <hr className="border-white/8" />
                <div className="flex justify-between items-center">
                  <span className="text-[14px] text-white/65">试卷总数</span>
                  <span className="text-[26px] font-bold">{exams.length.toLocaleString()}</span>
                </div>
                <hr className="border-white/8" />
                <div className="flex justify-between items-center">
                  <span className="text-[14px] text-white/65">题目总数</span>
                  <span className="text-[26px] font-bold">{totalQuestions.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="max-w-[1400px] mx-auto px-8 -mt-10 relative z-20 w-full">
        <div className="bg-white rounded-2xl border border-[#e7e5e4] shadow-[0_12px_40px_rgba(0,0,0,0.08)] p-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              icon: Library,
              value: banks.length,
              label: '题库总数',
              gradient: 'from-purple-500 to-purple-400',
            },
            {
              icon: ClipboardList,
              value: exams.length,
              label: '试卷总数',
              gradient: 'from-violet-500 to-violet-400',
            },
            {
              icon: FileText,
              value: totalQuestions,
              label: '题目总数',
              gradient: 'from-fuchsia-500 to-fuchsia-400',
            },
            {
              icon: PlayCircle,
              value: exams.length,
              label: '可参与考试',
              gradient: 'from-pink-500 to-pink-400',
            },
          ].map((s, i) => (
            <div
              key={i}
              className="flex items-center gap-4 p-4 rounded-xl transition-all hover:-translate-y-0.5 hover:shadow-lg hover:bg-[#faf5ff] cursor-default group"
            >
              <div
                className={`relative w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg bg-gradient-to-br ${s.gradient} shrink-0 overflow-hidden`}
              >
                <s.icon className="w-7 h-7 relative z-10" strokeWidth={1.8} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[28px] font-bold text-[#0f172a] leading-none tracking-tight">
                  {s.value.toLocaleString()}
                </div>
                <div className="text-[13px] text-[#64748b] mt-1 font-medium">{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <main ref={listRef} className="max-w-[1400px] mx-auto px-8 py-8 w-full flex-1">
        {/* Filter */}
        <div className="bg-white rounded-2xl border border-[#e7e5e4] shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-6 mb-6">
          <div className="flex items-center gap-2.5 text-[16px] font-bold text-[#0f172a] mb-5">
            <div className="w-1 h-5 rounded-full bg-gradient-to-b from-purple-400 to-purple-600" />
            <Filter className="w-4 h-4 text-purple-500" />
            资源筛选
          </div>
          <div className="space-y-0">
            {batches.length > 1 && (
              <LandingFilterRow
                label="批次"
                items={batches}
                selected={selectedBatch}
                onSelect={handleBatchChange}
                showBorder={false}
                accentColor="purple"
              />
            )}
          </div>
          {(keyword.trim() || selectedBatch !== '全部') && (
            <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-dashed border-[#cbd5e1]">
              <span className="text-[13px] text-[#64748b]">已选条件：</span>
              {keyword.trim() && (
                <span className="inline-flex items-center gap-1.5 bg-[#faf5ff] text-purple-600 text-xs px-2.5 py-1 rounded-full border border-purple-100">
                  关键词：{keyword.trim()}
                  <X
                    className="w-3 h-3 cursor-pointer hover:text-red-500 transition-colors"
                    onClick={() => handleKeywordChange('')}
                  />
                </span>
              )}
              {selectedBatch !== '全部' && (
                <span className="inline-flex items-center gap-1.5 bg-[#faf5ff] text-purple-600 text-xs px-2.5 py-1 rounded-full border border-purple-100">
                  批次：{selectedBatch}
                  <X
                    className="w-3 h-3 cursor-pointer hover:text-red-500 transition-colors"
                    onClick={() => handleBatchChange('全部')}
                  />
                </span>
              )}
              <button
                onClick={clearFilters}
                className="text-[13px] text-purple-600 hover:text-purple-700 font-medium"
              >
                清空筛选
              </button>
            </div>
          )}
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-0.5 bg-white p-1 rounded-xl border border-[#e7e5e4] shadow-sm">
            {SORT_OPTIONS.map((s) => (
              <button
                key={s.value}
                onClick={() => handleSortChange(s.value)}
                className={`px-5 py-2 rounded-[10px] text-[13px] transition-all font-medium ${sort === s.value ? 'bg-purple-500 text-white shadow-md' : 'text-[#475569] hover:text-purple-600 hover:bg-[#faf5ff]'}`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="relative w-full sm:w-[360px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" />
            <Input
              value={keyword}
              onChange={(e) => handleKeywordChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') executeSearch()
              }}
              placeholder="搜索题库、试卷名称"
              className="pl-10 pr-[72px] h-11 bg-[#f8fafc] border-[#e7e5e4] rounded-xl text-sm shadow-sm focus:border-purple-300 focus:ring-2 focus:ring-purple-100 focus:bg-white transition-all"
            />
            <Button
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-[10px] px-5 h-8 bg-gradient-to-r from-purple-500 to-purple-400 hover:from-purple-600 hover:to-purple-500 text-white text-xs font-medium shadow-sm hover:shadow-md transition-all"
              onClick={executeSearch}
            >
              搜索
            </Button>
          </div>
        </div>

        <div className="text-[13px] text-[#64748b] mb-6">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
            当前共展示{' '}
            <b className="text-purple-600">{filteredBanks.length + filteredExams.length}</b> 个资源
          </span>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl border border-[#e7e5e4] h-[340px] animate-pulse shadow-sm"
              />
            ))}
          </div>
        ) : filteredBanks.length === 0 && filteredExams.length === 0 ? (
          <div className="text-center py-20 text-[#94a3b8] bg-white rounded-2xl border border-[#e7e5e4] shadow-sm">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#f8fafc] flex items-center justify-center">
              <Search className="w-8 h-8 opacity-30" />
            </div>
            <div className="text-[15px] font-medium text-[#475569]">暂无匹配的资源</div>
            <div className="text-[13px] mt-1">试试调整搜索关键词</div>
          </div>
        ) : (
          <>
            {filteredBanks.length > 0 && (
              <div className="mb-10">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-xl font-bold text-[#0f172a] flex items-center gap-2">
                    <div className="w-1 h-5 rounded-full bg-gradient-to-b from-purple-400 to-purple-600" />
                    题库
                    <span className="text-[13px] text-[#64748b] font-normal ml-1">
                      ({filteredBanks.length})
                    </span>
                  </h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                  {pageBanks.map((bank, i) => (
                    <BankCard key={bank.id} bank={bank} index={i} />
                  ))}
                </div>
                <LandingPagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={(p) => {
                    setCurrentPage(p)
                    listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }}
                  accentColor="purple"
                />
              </div>
            )}
            {filteredExams.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-xl font-bold text-[#0f172a] flex items-center gap-2">
                    <div className="w-1 h-5 rounded-full bg-gradient-to-b from-violet-400 to-violet-600" />
                    试卷
                    <span className="text-[13px] text-[#64748b] font-normal ml-1">
                      ({filteredExams.length})
                    </span>
                  </h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                  {filteredExams.map((exam, i) => (
                    <ExamCard key={exam.id} exam={exam} index={i} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>
      <PlatformFooter />
    </div>
  )
}
