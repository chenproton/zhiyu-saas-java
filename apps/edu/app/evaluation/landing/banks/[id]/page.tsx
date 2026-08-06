'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
  Library,
  FileText,
  Clock,
  Layers,
  Search,
  HelpCircle,
  ListChecks,
  PenTool,
  AlertCircle,
  CheckSquare,
  Type,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { questionBankApi, questionApi, knowledgeApi } from '@/lib/api'
import { reportError } from '@/lib/error-handling'
import type { QuestionBank, Question, KnowledgePoint } from '@/lib/types'
import { DIFFICULTY_LABELS, DIFFICULTY_COLORS } from '@/lib/types'
import { Footer } from '@/components/portal/footer'
import { FavoriteButton } from '@/components/shared/favorite-button'
import { QUESTION_TYPE_LABELS } from '@zhiyu/shared-types'
import { formatDate } from '@/lib/format-utils'
import { coverGradientFor } from '@/lib/cover-gradients'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

const questionTypeLabels = QUESTION_TYPE_LABELS

const questionTypeChartColors: Record<string, string> = {
  single: '#3b82f6',
  multiple: '#a855f7',
  judge: '#f59e0b',
  fill: '#10b981',
  essay: '#f43f5e',
  short_answer: '#06b6d4',
}

const questionTypeIcons: Record<string, React.ComponentType<any>> = {
  single: ListChecks,
  multiple: CheckSquare,
  judge: AlertCircle,
  fill: PenTool,
  essay: FileText,
  short_answer: Type,
}

const questionTypeColors: Record<string, string> = {
  single: 'bg-blue-50 text-blue-600 border-blue-100',
  multiple: 'bg-purple-50 text-purple-600 border-purple-100',
  judge: 'bg-amber-50 text-amber-600 border-amber-100',
  fill: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  essay: 'bg-rose-50 text-rose-600 border-rose-100',
  short_answer: 'bg-cyan-50 text-cyan-600 border-cyan-100',
}

function AnswerPreview({ question }: { question: Question }) {
  const [show, setShow] = useState(false)
  return (
    <div className="mt-2 pt-2 border-t border-slate-100">
      <button
        onClick={() => setShow(!show)}
        className="text-[11px] text-slate-400 hover:text-blue-500 flex items-center gap-1 transition-colors"
      >
        <HelpCircle className="w-3 h-3" />
        {show ? '隐藏答案' : '查看答案'}
      </button>
      {show && (
        <div className="mt-1.5 text-xs">
          <span className="text-slate-400">答案：</span>
          <span className="text-slate-700 font-medium">
            {Array.isArray(question.answer) ? question.answer.join('；') : question.answer}
          </span>
          {question.analysis && (
            <div className="mt-1 text-slate-400">
              <span>解析：</span>
              <span className="text-slate-500">{question.analysis}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function BankDetailPage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()

  const [bank, setBank] = useState<QuestionBank | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(!!id)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('全部')
  const [showAllAnswers, setShowAllAnswers] = useState(false)
  const [knowledgePointMap, setKnowledgePointMap] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!id) return
    const fetchData = async () => {
      setLoading(true)
      try {
        await Promise.all([
          questionBankApi
            .get(id)
            .then(setBank)
            .catch(() => setBank(null)),
          questionApi
            .list({ bankId: id, limit: 10000 } as any)
            .then((res) => setQuestions(res.items || []))
            .catch(() => setQuestions([])),
          knowledgeApi
            .list({ limit: 1000 })
            .then((res: { items: KnowledgePoint[] }) => {
              const map: Record<string, string> = {}
              res.items.forEach((kp) => {
                map[kp.id] = kp.name
              })
              setKnowledgePointMap(map)
            })
            .catch((err) => reportError(err, '加载知识点字典')),
        ])
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [id])

  const questionTypes = useMemo(() => {
    const types = new Set(questions.map((q) => q.type))
    return ['全部', ...Array.from(types)]
  }, [questions])

  const filteredQuestions = useMemo(() => {
    let list = questions
    if (typeFilter !== '全部') list = list.filter((q) => q.type === typeFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (item) =>
          item.content.toLowerCase().includes(q) ||
          (item.knowledgePoints || []).some((kp) => kp.toLowerCase().includes(q)),
      )
    }
    return list
  }, [questions, typeFilter, search])

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    questions.forEach((q) => {
      counts[q.type] = (counts[q.type] || 0) + 1
    })
    return counts
  }, [questions])

  const pieData = useMemo(() => {
    return Object.entries(typeCounts).map(([type, count]) => ({
      name: questionTypeLabels[type] || type,
      value: count,
      color: questionTypeChartColors[type] || '#94a3b8',
    }))
  }, [typeCounts])

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-[#f8fafc]">
        <Skeleton className="h-[280px] w-full" />
        <div className="max-w-[1400px] mx-auto px-6 py-6 w-full flex-1">
          <Skeleton className="h-[500px] w-full rounded-xl" />
        </div>
        <Footer className="mt-auto" />
      </div>
    )
  }

  if (!bank) {
    return (
      <div className="min-h-screen flex flex-col bg-[#f8fafc]">
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
          <div className="w-20 h-20 mb-5 rounded-3xl bg-slate-100 flex items-center justify-center">
            <Library className="w-10 h-10 opacity-40" />
          </div>
          <div className="text-lg font-semibold text-slate-600">题库不存在或暂未公开</div>
          <Link
            href="/evaluation/landing"
            className="text-blue-600 hover:text-blue-700 mt-3 text-sm font-medium"
          >
            返回测评首页
          </Link>
        </div>
        <Footer className="mt-auto" />
      </div>
    )
  }

  const coverStyle = bank.coverImage
    ? { backgroundImage: `url('${bank.coverImage}')` }
    : { background: coverGradientFor(bank.id) }

  return (
    <div
      className="min-h-screen flex flex-col bg-[#f8fafc]"
      style={{
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
      }}
    >
      <div className="bg-white border-b border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
        <div className="max-w-[1400px] mx-auto px-6 py-5">
          <div className="flex items-center gap-2 mb-5 text-sm text-slate-500">
            <button
              onClick={() => router.back()}
              className="hover:text-blue-600 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <span className="w-5 h-5 rounded-md bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-blue-50 hover:text-blue-600 transition-colors">
                ←
              </span>{' '}
              返回上一页
            </button>
            <span className="text-slate-300">/</span>
            <Link href="/evaluation/landing" className="hover:text-blue-600 transition-colors">
              测评首页
            </Link>
            <span className="text-slate-300">/</span>
            <span className="text-slate-800 font-medium truncate">{bank.name}</span>
          </div>

          <div className="flex flex-col lg:flex-row gap-6 items-stretch">
            <div className="flex-1 flex">
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.04)] w-full">
                <div className="flex flex-col sm:flex-row gap-6 p-6">
                  <div
                    className="w-full sm:w-[280px] h-[190px] rounded-2xl bg-cover bg-center flex items-center justify-center shrink-0 self-stretch shadow-[0_12px_40px_rgba(0,0,0,0.15)] relative overflow-hidden"
                    style={coverStyle}
                  >
                    {!bank.coverImage && (
                      <Library
                        className="w-16 h-16 text-white/85 drop-shadow-md relative z-10"
                        strokeWidth={1.5}
                      />
                    )}
                    <span className="absolute bottom-3 right-3 z-10 bg-[#0f172a]/40 backdrop-blur-sm text-white px-2.5 py-1 rounded-lg text-[11px] border border-white/20">
                      v{bank.version}
                    </span>
                  </div>

                  <div className="flex-1 flex flex-col min-w-0">
                    <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                      <div className="flex items-center gap-2.5 flex-wrap min-w-0">
                        <h1 className="text-[26px] font-bold text-slate-900 truncate">
                          {bank.name}
                        </h1>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-slate-400 mb-3">
                      {bank.creatorName && (
                        <span className="flex items-center gap-1.5">
                          创建人：{bank.creatorName}
                        </span>
                      )}
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" /> 更新于 {formatDate(bank.updatedAt)}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5" /> {bank.questionCount} 题
                      </span>
                    </div>

                    {bank.description && (
                      <p className="text-sm text-slate-600 leading-relaxed mb-4 line-clamp-3">
                        {bank.description}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-3 text-xs mt-auto pt-5">
                      <FavoriteButton targetType="question_bank" targetId={id} label="收藏题库" />
                      {Object.entries(typeCounts).length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {Object.entries(typeCounts).map(([t, count]) => (
                            <span
                              key={t}
                              className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${questionTypeColors[t] || 'bg-slate-50 text-slate-500 border-slate-100'}`}
                            >
                              {questionTypeLabels[t] || t} ×{count}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:w-[320px] shrink-0 flex">
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.04)] w-full">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
                    <Library className="w-4 h-4 text-blue-500" />
                  </div>
                  <span className="text-sm font-bold text-slate-800">题库统计</span>
                </div>
                <div className="p-5">
                  {pieData.length === 0 ? (
                    <div className="text-center py-10 text-slate-400 text-sm">暂无题目</div>
                  ) : (
                    <>
                      <div className="relative h-[180px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={pieData}
                              cx="50%"
                              cy="50%"
                              innerRadius={48}
                              outerRadius={72}
                              paddingAngle={3}
                              dataKey="value"
                              strokeWidth={0}
                            >
                              {pieData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip
                              formatter={(value: number, name: string) => [`${value} 题`, name]}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                          <div className="text-[20px] font-bold text-slate-800 leading-none">
                            {questions.length}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-1">总题量</div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <main className="flex-1 max-w-[1400px] mx-auto px-6 py-6 w-full">
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
          <div className="px-6 py-4 border-b border-slate-100">
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-blue-500" />
                <span className="text-sm font-semibold text-slate-800">
                  题目列表（{filteredQuestions.length} / {questions.length} 题）
                </span>
                <button
                  onClick={() => setShowAllAnswers(!showAllAnswers)}
                  className="text-[11px] text-slate-400 hover:text-blue-500 transition-colors"
                >
                  {showAllAnswers ? '隐藏全部答案' : '显示全部答案'}
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative w-64">
                  <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder="搜索题目内容或知识点"
                    className="h-9 rounded-lg border-slate-200 bg-slate-50 pl-9 text-sm"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                {questionTypes.length > 1 && (
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none cursor-pointer"
                  >
                    {questionTypes.map((t) => (
                      <option key={t} value={t}>
                        {t === '全部' ? '全部题型' : questionTypeLabels[t] || t}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          </div>

          <div className="p-6 min-h-[400px]">
            {questions.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-50 flex items-center justify-center">
                  <FileText className="w-8 h-8 opacity-40" />
                </div>
                <div className="text-[15px] font-medium text-slate-600">暂无题目</div>
                <div className="text-[13px] mt-1">该题库暂未收录题目</div>
              </div>
            ) : filteredQuestions.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <div className="text-[15px] font-medium text-slate-600">没有匹配的题目</div>
                <div className="text-[13px] mt-1">请调整搜索条件或筛选</div>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredQuestions.map((q, idx) => {
                  const diff = {
                    label: DIFFICULTY_LABELS[q.difficulty || 'medium'],
                    color: DIFFICULTY_COLORS[q.difficulty || 'medium'],
                  }
                  const IconComp = questionTypeIcons[q.type] || HelpCircle
                  return (
                    <div
                      key={q.id}
                      className="group bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:border-blue-200 transition-all"
                    >
                      <div className="p-5">
                        <div className="flex items-start gap-4">
                          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-blue-400 text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-md shadow-blue-500/20">
                            {idx + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-2">
                              <span
                                className={`text-[11px] px-2 py-0.5 rounded-full font-medium border ${questionTypeColors[q.type] || 'bg-slate-50 text-slate-500 border-slate-100'}`}
                              >
                                <IconComp className="w-3 h-3 inline mr-0.5" />
                                {questionTypeLabels[q.type] || q.type}
                              </span>
                              {q.difficulty && (
                                <span
                                  className="text-[11px] px-2 py-0.5 rounded-full font-medium border"
                                  style={{
                                    backgroundColor: diff.color + '15',
                                    color: diff.color,
                                    borderColor: diff.color + '30',
                                  }}
                                >
                                  {diff.label}
                                </span>
                              )}
                              <span className="text-[11px] text-slate-400">{q.score} 分</span>
                            </div>
                            <p className="text-sm text-slate-700 leading-relaxed mb-2">
                              {q.content}
                            </p>
                            {q.options && q.options.length > 0 && (
                              <div className="space-y-1 mb-2">
                                {q.options.map((opt, oi) => (
                                  <div
                                    key={oi}
                                    className="text-xs text-slate-500 flex items-center gap-2 pl-1"
                                  >
                                    <span className="w-5 h-5 rounded-full border border-slate-200 flex items-center justify-center text-[10px] text-slate-400 shrink-0">
                                      {String.fromCharCode(65 + oi)}
                                    </span>
                                    {opt}
                                  </div>
                                ))}
                              </div>
                            )}
                            {q.knowledgePoints && q.knowledgePoints.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {q.knowledgePoints.slice(0, 4).map((kp) => (
                                  <span
                                    key={kp}
                                    className="text-[10px] px-1.5 py-0.5 rounded bg-slate-50 text-slate-400 border border-slate-100"
                                  >
                                    {knowledgePointMap[kp] || kp}
                                  </span>
                                ))}
                              </div>
                            )}
                            {(showAllAnswers || q.type !== 'essay') && (
                              <AnswerPreview question={q} />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer className="mt-auto" />
    </div>
  )
}
