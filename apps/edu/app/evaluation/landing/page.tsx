'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronRight, Library, ClipboardList, FileText, Clock, PlayCircle, BarChart3 } from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { Button } from '@/components/ui/button'
import { questionBankApi, examApi, evaluationBatchApi, examUsageApi } from '@/lib/api'
import { formatDate } from '@/lib/format-utils'
import type { QuestionBank, Exam, ExamCenterItem } from '@/lib/types'
import { LandingFilterRow } from '@/components/shared/landing-filter-row'
import { LandingPagination } from '@/components/shared/landing-pagination'
import { LandingShell, LandingSkeleton, LandingEmpty } from '@/components/shared/landing-shell'
import { ExamCenterCard } from '@/components/evaluation/exam-center-card'
import { coverGradientFor } from '@/lib/cover-gradients'
import { useT } from '@/lib/i18n/locale-provider'

const CARDS_PER_PAGE = 12
const SORT_OPTIONS = [
  { value: 'default', label: '默认排序' },
  { value: 'recent', label: '最近收录' },
  { value: 'update', label: '最近更新' },
]

function BankCard({ bank }: { bank: QuestionBank; index: number }) {
  const t = useT()
  return (
    <Link
      href={`/evaluation/landing/banks/${bank.id}`}
      className="group block no-underline text-inherit"
    >
      <div className="bg-white rounded-2xl border border-[#e7e5e4] overflow-hidden transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_20px_48px_rgba(0,0,0,0.1)] hover:border-primary/30 cursor-pointer h-full flex flex-col shadow-[0_2px_6px_rgba(0,0,0,0.04)]">
        <div
          className="h-[110px] flex items-center justify-center shrink-0 relative"
          style={
            bank.coverImage
              ? {
                  backgroundImage: `url('${bank.coverImage}')`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }
              : { background: coverGradientFor(bank.id) }
          }
        >
          {!bank.coverImage && <Library className="w-12 h-12 text-white/80" />}
          <span className="absolute top-3 right-3 bg-white/20 backdrop-blur-sm text-white px-2.5 py-1 rounded-full text-[11px] font-medium border border-white/10">
            v{bank.version}
          </span>
        </div>
        <div className="p-5 flex-1 flex flex-col">
          <h3 className="text-[15px] font-semibold text-slate-800 mb-1.5 truncate">{bank.name}</h3>
          <p className="text-xs text-slate-400 leading-relaxed mb-3 line-clamp-2 flex-1">
            {bank.description || t('暂无描述')}
          </p>
          <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-50 pt-3">
            <span className="flex items-center gap-1">
              <FileText className="w-3 h-3" /> {t('{n} 题', { n: bank.questionCount })}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" /> {formatDate(bank.createdAt)}
            </span>
            <span className="text-primary group-hover:text-primary font-medium">
              {t('查看详情 →')}
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}

function ExamCard({ exam }: { exam: Exam; index: number }) {
  const t = useT()
  return (
    <Link
      href={`/evaluation/landing/exams/${exam.id}`}
      className="group block no-underline text-inherit"
    >
      <div className="bg-white rounded-2xl border border-[#e7e5e4] overflow-hidden transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_20px_48px_rgba(0,0,0,0.1)] hover:border-primary/30 cursor-pointer h-full flex flex-col shadow-[0_2px_6px_rgba(0,0,0,0.04)]">
        <div
          className="h-[110px] flex items-center justify-center shrink-0 relative"
          style={
            exam.coverImage
              ? {
                  backgroundImage: `url('${exam.coverImage}')`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }
              : { background: coverGradientFor(exam.id) }
          }
        >
          {!exam.coverImage && <ClipboardList className="w-12 h-12 text-white/80" />}
          <span className="absolute top-3 right-3 bg-white/20 backdrop-blur-sm text-white px-2.5 py-1 rounded-full text-[11px] font-medium border border-white/10">
            {t('{n} 分钟', { n: exam.duration })}
          </span>
        </div>
        <div className="p-5 flex-1 flex flex-col">
          <h3 className="text-[15px] font-semibold text-slate-800 mb-1.5 truncate">{exam.name}</h3>
          <p className="text-xs text-slate-400 leading-relaxed mb-3 line-clamp-2 flex-1">
            {exam.description || t('暂无描述')}
          </p>
          <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-50 pt-3 mb-3">
            <span className="flex items-center gap-1">
              <FileText className="w-3 h-3" /> {t('{n} 题', { n: (exam.questions || []).length })}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" /> {t('{n} 分钟', { n: exam.duration })}
            </span>
          </div>
          <Button className="w-full rounded-[10px] h-9 text-xs bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 hover:-translate-y-0.5 transition-all">
            <PlayCircle className="w-3.5 h-3.5 mr-1" /> {t('去考试')}
          </Button>
        </div>
      </div>
    </Link>
  )
}

export default function LandingHomePage() {
  const t = useT()
  const listRef = useRef<HTMLDivElement>(null)
  const [banks, setBanks] = useState<QuestionBank[]>([])
  const [exams, setExams] = useState<Exam[]>([])
  const [centerItems, setCenterItems] = useState<ExamCenterItem[]>([])
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
        const [banksRes, examsRes, batchesRes, centerRes] = await Promise.all([
          questionBankApi.list({ status: 'published', limit: 1000 } as any),
          examApi.list({ status: 'published', limit: 1000 } as any),
          evaluationBatchApi.list({ limit: 1000 }),
          examUsageApi.center().catch(() => []),
        ])
        setBanks(banksRes.items || [])
        setExams(examsRes.items || [])
        setCenterItems(centerRes || [])
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

  const centerStats = useMemo(() => {
    const total = centerItems.length
    const pending = centerItems.filter((i) => i.status === 'published').length
    const inProgress = centerItems.filter((i) => i.status === 'in_progress' && !i.submitted).length
    const finished = centerItems.filter((i) => i.status === 'finished' && !i.submitted).length
    const submitted = centerItems.filter((i) => i.submitted).length
    return {
      total,
      pending,
      inProgress,
      finished,
      submitted,
    }
  }, [centerItems])

  const statusPieData = useMemo(
    () =>
      [
        { name: t('待考'), value: centerStats.pending, color: '#d97706' },
        { name: t('进行中'), value: centerStats.inProgress, color: '#16a34a' },
        { name: t('已交卷'), value: centerStats.submitted, color: '#2563eb' },
        { name: t('已结束'), value: centerStats.finished, color: '#94a3b8' },
      ].filter((d) => d.value > 0),
    [centerStats, t],
  )

  const examCoverMap = useMemo(() => {
    const map = new Map<string, string>()
    exams.forEach((e) => {
      if (e.coverImage) map.set(e.id, e.coverImage)
    })
    return map
  }, [exams])

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

  const removeFilter = (type: string) => {
    if (type === 'keyword') setKeyword('')
    if (type === 'batch') setSelectedBatch('全部')
    setCurrentPage(1)
  }

  const activeFilters = useMemo(() => {
    const filters: { type: string; label: string }[] = []
    if (keyword.trim())
      filters.push({ type: 'keyword', label: t('关键词：{kw}', { kw: keyword.trim() }) })
    if (selectedBatch !== '全部')
      filters.push({
        type: 'batch',
        label: t('批次：{batch}', { batch: selectedBatch }),
      })
    return filters
  }, [keyword, selectedBatch, t])

  return (
    <LandingShell
      hero={{
        badge: t('海量题库 · 智能组卷 · 在线考试'),
        title: (
          <>
            {t('测评资源平台')}
            <br />
            <span className="text-white/80">{t('海量题库与试卷，助力教学测评')}</span>
          </>
        ),
        description: t('丰富题库资源与智能组卷工具，支持在线考试与自动评分，让教学测评更高效'),
        ctaLabel: t('浏览资源'),
      }}
      stats={[
        {
          icon: Library,
          value: banks.length,
          label: t('题库总数'),
          gradient: 'from-primary to-primary/80',
        },
        {
          icon: ClipboardList,
          value: exams.length,
          label: t('试卷总数'),
          gradient: 'from-primary/90 to-primary/70',
        },
        {
          icon: FileText,
          value: totalQuestions,
          label: t('题目总数'),
          gradient: 'from-primary/80 to-primary/60',
        },
        {
          icon: PlayCircle,
          value: exams.length,
          label: t('可参与考试'),
          gradient: 'from-primary/90 to-primary/70',
        },
      ]}
      beforeList={
        loading ? (
          <div className="bg-white rounded-2xl border border-[#e7e5e4] h-[360px] animate-pulse shadow-[0_4px_20px_rgba(0,0,0,0.04)] mb-6" />
        ) : centerItems.length > 0 ? (
          <div className="bg-white rounded-2xl border border-[#e7e5e4] shadow-[0_4px_20px_rgba(0,0,0,0.04)] mb-6 overflow-hidden">
            <div className="px-6 pt-6 pb-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/10 flex items-center justify-center shrink-0">
                  <ClipboardList className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[#0f172a]">{t('考试中心')}</h2>
                  <p className="text-sm text-slate-500 mt-1 max-w-xl">
                    {t('查看全部考试与你可参加的考试，按班级开放，进入后完成在线考试')}
                  </p>
                </div>
              </div>
              <Button
                asChild
                className="bg-primary text-white hover:bg-primary/90 hover:-translate-y-0.5 rounded-full px-6 h-10 text-sm font-semibold shadow-lg shadow-primary/20 transition-all shrink-0"
              >
                <Link href="/evaluation/landing/exam-center">
                  {t('进入考试中心')} <ChevronRight className="w-4 h-4" />
                </Link>
              </Button>
            </div>
            <div className="p-5">
              <div className="flex flex-col lg:flex-row gap-5">
                <div className="lg:w-[250px] shrink-0">
                  <div className="bg-[#f8fafc] border border-[#eef2f7] rounded-2xl p-4 h-full">
                    <div className="text-sm font-bold text-[#0f172a] flex items-center gap-2 mb-3">
                      <BarChart3 className="w-4 h-4 text-primary" /> {t('状态分布')}
                    </div>
                    <div className="relative">
                      <ResponsiveContainer width="100%" height={140}>
                        <PieChart>
                          <Pie
                            data={statusPieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={40}
                            outerRadius={58}
                            paddingAngle={3}
                            dataKey="value"
                            strokeWidth={0}
                          >
                            {statusPieData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value: number, name: string) => [
                              t('{n} 场', { n: value }),
                              name,
                            ]}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <div className="text-[20px] font-bold text-[#0f172a] leading-none">
                          {centerStats.total}
                        </div>
                        <div className="text-[11px] text-[#64748b] mt-1">{t('全部考试')}</div>
                      </div>
                    </div>
                    <div className="space-y-2 mt-4">
                      {statusPieData.map((d) => (
                        <div key={d.name} className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-2 text-[#475569]">
                            <span
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ background: d.color }}
                            />
                            {d.name}
                          </span>
                          <span className="font-semibold text-[#0f172a]">{d.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                  {centerItems.slice(0, 3).map((item) => (
                    <ExamCenterCard
                      key={item.id}
                      item={item}
                      coverImage={examCoverMap.get(item.examId)}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-gradient-to-r from-primary via-primary to-primary/80 rounded-2xl p-6 mb-6 shadow-[0_8px_24px_rgba(22,119,255,0.25)] relative overflow-hidden">
            <div
              className="absolute inset-0 opacity-[0.1] pointer-events-none"
              style={{
                backgroundImage: `linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)`,
                backgroundSize: '36px 36px',
              }}
            />
            <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center shrink-0">
                  <ClipboardList className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">{t('考试中心')}</h2>
                  <p className="text-sm text-white/80 mt-1 max-w-xl">
                    {t('查看全部考试与你可参加的考试，按班级开放，进入后完成在线考试')}
                  </p>
                </div>
              </div>
              <Button
                asChild
                className="bg-white text-primary hover:bg-primary/5 hover:-translate-y-0.5 rounded-full px-6 h-10 text-sm font-semibold shadow-lg transition-all shrink-0"
              >
                <Link href="/evaluation/landing/exam-center">
                  {t('进入考试中心')} <ChevronRight className="w-4 h-4" />
                </Link>
              </Button>
            </div>
          </div>
        )
      }
      filterTitle={t('资源筛选')}
      filterRows={
        <LandingFilterRow
          label={t('批次')}
          items={batches.map((b) => (b === '全部' ? t('全部') : b))}
          selected={selectedBatch === '全部' ? t('全部') : selectedBatch}
          onSelect={(v) => handleBatchChange(v === t('全部') ? '全部' : v)}
          showBorder={false}
          accentColor="primary"
        />
      }
      activeFilters={activeFilters}
      onRemoveFilter={removeFilter}
      onClearFilters={clearFilters}
      sortOptions={SORT_OPTIONS.map((o) => ({ ...o, label: t(o.label) }))}
      sort={sort}
      onSortChange={handleSortChange}
      keyword={keyword}
      onKeywordChange={handleKeywordChange}
      onSearch={executeSearch}
      searchPlaceholder={t('搜索题库、试卷名称')}
      totalCount={filteredBanks.length + filteredExams.length}
      countLabel={t('个资源')}
      listRef={listRef}
    >
      {loading ? (
        <LandingSkeleton count={8} height="h-[280px] sm:h-[340px]" />
      ) : filteredBanks.length === 0 && filteredExams.length === 0 ? (
        <LandingEmpty title={t('暂无匹配的资源')} hint={t('试试调整搜索关键词')} />
      ) : (
        <>
          {filteredBanks.length > 0 && (
            <div className="mb-10">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xl font-bold text-[#0f172a] flex items-center gap-2">
                  <div className="w-1 h-5 rounded-full bg-gradient-to-b from-primary/80 to-primary/70" />
                  {t('题库')}
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
                accentColor="primary"
              />
            </div>
          )}
          {filteredExams.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xl font-bold text-[#0f172a] flex items-center gap-2">
                  <div className="w-1 h-5 rounded-full bg-gradient-to-b from-primary/80 to-primary/70" />
                  {t('试卷')}
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
    </LandingShell>
  )
}
