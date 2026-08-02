'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  ChevronLeft,
  Search,
  FileQuestion,
  Loader2,
  Check,
  X,
  Database,
  ChevronRight,
  SlidersHorizontal,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { ScoreConfigDialog } from '@/components/evaluation/score-config-dialog'
import { questionBankApi, questionApi } from '@/lib/api'
import { reportError } from '@/lib/error-handling'
import type { QuestionType } from '@/lib/types'
import {
  getAllQuestions,
  getCachedQuestion,
  hasCachedQuestion,
  setCachedQuestion,
  setCachedQuestions,
  typeColorMap,
  questionTypeLabels,
  difficultyLabels,
  type CachedQuestion,
} from './shared-defs'

interface BankQuestionSelectorPanelProps {
  field: 'questionBankQuestions' | 'quizQuestions'
  selectedIds: string[]
  maxCount?: number
  onToggleQuestion: (qid: string) => void
  questionScores?: Record<string, number>
  onUpdateQuestionScore?: (qid: string, score: number) => void
  onUpdateQuestionScores?: (scores: Record<string, number>) => void
}

export function BankQuestionSelectorPanel({
  field,
  selectedIds,
  maxCount,
  onToggleQuestion,
  questionScores,
  onUpdateQuestionScore,
  onUpdateQuestionScores,
}: BankQuestionSelectorPanelProps) {
  const [banks, setBanks] = useState<any[]>([])
  const [bankQuestions, setBankQuestions] = useState<any[]>([])
  const [selectedBankId, setSelectedBankId] = useState<string | null>(null)
  const [selectedBankName, setSelectedBankName] = useState('')
  const [loadingBanks, setLoadingBanks] = useState(false)
  const [loadingQuestions, setLoadingQuestions] = useState(false)
  const [bankTab, setBankTab] = useState<'my' | 'collab' | 'public'>('my')
  const [bankSearch, setBankSearch] = useState('')
  const [questionSearch, setQuestionSearch] = useState('')
  const [scoreDialogOpen, setScoreDialogOpen] = useState(false)
  const [preloadedQuestions, setPreloadedQuestions] = useState<any[]>([])

  const loadBanks = useCallback(async () => {
    setLoadingBanks(true)
    try {
      const res = (await questionBankApi.list({ limit: 1000 })) as unknown as { items: any[] }
      setBanks(res.items)
    } catch (err) {
      reportError(err, { source: '加载题库列表' })
    } finally {
      setLoadingBanks(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!cancelled) await loadBanks()
    })()
    return () => {
      cancelled = true
    }
  }, [loadBanks])

  useEffect(() => {
    const missingIds = selectedIds.filter(
      (qid) => !hasCachedQuestion(qid) && !preloadedQuestions.some((q) => q.id === qid),
    )
    if (missingIds.length === 0) return
    Promise.all(
      missingIds.map(async (qid) => {
        try {
          return (await questionApi.get(qid)) as unknown as any
        } catch (err) {
          reportError(err, { source: '预加载题目详情', extras: { questionId: qid } })
          return null
        }
      }),
    ).then((results) => {
      const loaded = results.filter(Boolean)
      loaded.forEach((q) => setCachedQuestion(q as CachedQuestion))
      setPreloadedQuestions((prev) => [...prev, ...loaded])
    })
  }, [selectedIds, preloadedQuestions])

  const loadQuestions = useCallback(async (bankId: string) => {
    setLoadingQuestions(true)
    try {
      const res = (await questionApi.list({ bankId, limit: 1000 })) as unknown as {
        items: CachedQuestion[]
      }
      setCachedQuestions(res.items)
      setBankQuestions(res.items)
    } catch (err) {
      reportError(err, { source: '加载题库题目', extras: { bankId } })
    } finally {
      setLoadingQuestions(false)
    }
  }, [])

  const handleSelectBank = (bankId: string, bankName: string) => {
    setSelectedBankId(bankId)
    setSelectedBankName(bankName)
    loadQuestions(bankId)
  }

  const handleBackToBanks = () => {
    setSelectedBankId(null)
    setSelectedBankName('')
    setBankQuestions([])
    setQuestionSearch('')
  }

  const tabBanks = useMemo(() => {
    switch (bankTab) {
      case 'my':
        return banks.filter((b: any) => b.ownerType === 'mine' || !b.ownerType)
      case 'collab':
        return banks.filter((b: any) => (b.collaboratorIds || []).length > 0)
      case 'public':
        return banks.filter((b: any) => b.status === 'published')
    }
  }, [banks, bankTab])

  const filteredBanks = useMemo(() => {
    const q = bankSearch.trim().toLowerCase()
    if (!q) return tabBanks
    return tabBanks.filter(
      (b: any) =>
        b.name.toLowerCase().includes(q) || (b.description || '').toLowerCase().includes(q),
    )
  }, [tabBanks, bankSearch])

  const filteredQuestions = useMemo(() => {
    const q = questionSearch.trim().toLowerCase()
    if (!q) return bankQuestions
    return bankQuestions.filter(
      (qu: any) =>
        (qu.content || '').toLowerCase().includes(q) || (qu.name || '').toLowerCase().includes(q),
    )
  }, [bankQuestions, questionSearch])

  const handleEvenDistribution = () => {
    if (selectedIds.length === 0) return
    const n = selectedIds.length
    const base = Math.floor(100 / n)
    const remainder = 100 - base * n
    const scores: Record<string, number> = {}
    selectedIds.forEach((qid, idx) => {
      scores[qid] = base + (idx < remainder ? 1 : 0)
    })
    if (onUpdateQuestionScores) {
      onUpdateQuestionScores(scores)
    } else if (onUpdateQuestionScore) {
      selectedIds.forEach((qid) => {
        onUpdateQuestionScore(qid, scores[qid])
      })
    }
  }

  const handleTypeDistribution = (scores: Record<string, number>) => {
    if (onUpdateQuestionScores) {
      onUpdateQuestionScores(scores)
    } else if (onUpdateQuestionScore) {
      Object.entries(scores).forEach(([qid, score]) => {
        onUpdateQuestionScore(qid, score)
      })
    }
  }

  const resolveQuestion = useCallback(
    (qid: string): CachedQuestion | undefined => {
      return (
        bankQuestions.find((bq: any) => bq.id === qid) ||
        preloadedQuestions.find((q: any) => q.id === qid) ||
        getCachedQuestion(qid) ||
        getAllQuestions().find((aq) => aq.id === qid)
      )
    },
    [bankQuestions, preloadedQuestions],
  )

  const selectedQuestionItems = useMemo(() => {
    return selectedIds.map((qid) => {
      const q = resolveQuestion(qid)
      return {
        id: qid,
        questionId: qid,
        type: (q?.type ?? 'single') as QuestionType,
        content: q?.content ?? '',
        answer: '',
        score: questionScores?.[qid] ?? q?.score ?? 0,
        order: 0,
      }
    })
  }, [selectedIds, questionScores, resolveQuestion])

  return (
    <>
      <div className="flex gap-4 flex-1 min-h-0">
        <div className="w-3/5 flex flex-col min-h-0 min-w-0 border rounded-xl p-3 overflow-hidden">
          {selectedBankId ? (
            <>
              <div className="flex items-center gap-2 mb-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handleBackToBanks}
                >
                  <ChevronLeft className="h-3.5 w-3.5 mr-0.5" />
                  返回题库列表
                </Button>
                <span className="text-sm font-medium text-gray-700">{selectedBankName}</span>
              </div>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  value={questionSearch}
                  onChange={(e) => setQuestionSearch(e.target.value)}
                  placeholder="搜索题目内容..."
                  className="pl-9"
                />
              </div>
              <div className="flex-1 overflow-y-auto">
                {loadingQuestions ? (
                  <div className="text-center text-gray-400 py-8">
                    <Loader2 className="h-6 w-6 mx-auto animate-spin" />
                    <p className="text-sm mt-2">加载中...</p>
                  </div>
                ) : filteredQuestions.length === 0 ? (
                  <div className="text-center text-gray-400 py-8">
                    <FileQuestion className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">
                      {bankQuestions.length === 0 ? '该题库暂无题目' : '没有找到匹配的题目'}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm table-fixed min-w-[560px]">
                      <thead className="bg-gray-50 sticky top-0 z-10">
                        <tr>
                          <th className="text-left text-xs font-medium text-gray-500 px-3 py-2 w-[40%]">
                            题目内容
                          </th>
                          <th className="text-left text-xs font-medium text-gray-500 px-3 py-2 w-[12%]">
                            题型
                          </th>
                          <th className="text-left text-xs font-medium text-gray-500 px-3 py-2 w-[12%]">
                            难度
                          </th>
                          <th className="text-right text-xs font-medium text-gray-500 px-3 py-2 w-[36%]">
                            操作
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {filteredQuestions.map((q: any) => {
                          const isSelected = selectedIds.includes(q.id)
                          return (
                            <tr
                              key={q.id}
                              className={cn(
                                'hover:bg-gray-50 transition-colors cursor-pointer',
                                isSelected ? 'bg-primary/[0.03]' : '',
                              )}
                              onClick={() => onToggleQuestion(q.id)}
                            >
                              <td className="px-3 py-2">
                                <div className="flex items-center gap-2">
                                  <div
                                    className={cn(
                                      'w-4 h-4 rounded border flex items-center justify-center shrink-0',
                                      isSelected ? 'bg-primary border-primary' : 'border-gray-300',
                                    )}
                                  >
                                    {isSelected && <Check className="h-3 w-3 text-white" />}
                                  </div>
                                  <span className="text-sm text-gray-800 line-clamp-1">
                                    {q.content || q.name || '未命名题目'}
                                  </span>
                                </div>
                              </td>
                              <td className="px-3 py-2">
                                <Badge
                                  className={`text-xs text-white hover:opacity-90 ${typeColorMap[q.type ?? ''] || ''}`}
                                >
                                  {questionTypeLabels[q.type ?? ''] || q.type}
                                </Badge>
                              </td>
                              <td className="px-3 py-2">
                                <span className="text-xs text-gray-500">
                                  {difficultyLabels[q.difficulty ?? ''] || q.difficulty}
                                </span>
                              </td>
                              <td className="px-3 py-2">
                                <div className="flex items-center justify-end gap-1">
                                  {isSelected ? (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-6 text-[11px] px-2"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        onToggleQuestion(q.id)
                                      }}
                                    >
                                      取消
                                    </Button>
                                  ) : (
                                    <Button
                                      size="sm"
                                      className="h-6 text-[11px] px-2"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        onToggleQuestion(q.id)
                                      }}
                                    >
                                      使用
                                    </Button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Tabs
                value={bankTab}
                onValueChange={(v) => setBankTab(v as 'my' | 'collab' | 'public')}
                className="mb-3"
              >
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="my">我的</TabsTrigger>
                  <TabsTrigger value="collab">共建</TabsTrigger>
                  <TabsTrigger value="public">公共题库</TabsTrigger>
                </TabsList>
              </Tabs>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  value={bankSearch}
                  onChange={(e) => setBankSearch(e.target.value)}
                  placeholder="搜索题库名称..."
                  className="pl-9"
                />
              </div>
              <div className="flex-1 overflow-y-auto">
                {loadingBanks ? (
                  <div className="text-center text-gray-400 py-8">
                    <Loader2 className="h-6 w-6 mx-auto animate-spin" />
                    <p className="text-sm mt-2">加载中...</p>
                  </div>
                ) : filteredBanks.length === 0 ? (
                  <div className="text-center text-gray-400 py-8">
                    <Database className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">暂无题库</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredBanks.map((bank: any) => (
                      <div
                        key={bank.id}
                        onClick={() => handleSelectBank(bank.id, bank.name)}
                        className="p-3 rounded-lg border cursor-pointer hover:border-primary/50 hover:bg-primary/[0.02] transition-all"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Database className="h-4 w-4 text-gray-400" />
                            <span className="text-sm font-medium">{bank.name}</span>
                            <Badge variant="outline" className="text-[10px]">
                              {bank.questionCount ?? 0} 题
                            </Badge>
                          </div>
                          <ChevronRight className="h-4 w-4 text-gray-400" />
                        </div>
                        {bank.description && (
                          <p className="text-xs text-gray-400 mt-1.5 line-clamp-1">
                            {bank.description}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
        <div className="w-2/5 border rounded-xl p-3 flex flex-col min-h-0 min-w-0 overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-gray-700">
              已选择题目 ({selectedIds.length}
              {maxCount ? `/${maxCount}` : ''})
            </p>
            {(field === 'questionBankQuestions' || field === 'quizQuestions') &&
              selectedIds.length > 0 &&
              onUpdateQuestionScore && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-7 text-[11px] px-2">
                      <SlidersHorizontal className="h-3 w-3 mr-1" />
                      分数配置
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64">
                    <DropdownMenuItem onClick={handleEvenDistribution}>
                      均匀分配 — 将 100 分均匀分给每道题，余数从第一题起加 1 分
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setScoreDialogOpen(true)}>
                      题型分配 — 为每种题型分配总分（合计 100），各题型内均匀分配
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
          </div>
          <div className="flex-1 overflow-y-auto">
            {selectedIds.length === 0 ? (
              <div className="text-center text-gray-400 py-8">
                <FileQuestion className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-xs">从左侧搜索并选择题目</p>
              </div>
            ) : (
              <div className="space-y-2">
                {selectedIds.map((qid) => {
                  const q = resolveQuestion(qid)
                  if (!q) return null
                  return (
                    <div
                      key={qid}
                      className="p-2.5 rounded-lg border border-primary/20 bg-primary/5 relative"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium flex-1 truncate">
                          {q.content || q.name || '未命名题目'}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 text-gray-400 -mr-1 -mt-1"
                          onClick={() => onToggleQuestion(qid)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Badge
                          className={`text-[10px] text-white hover:opacity-90 ${typeColorMap[q.type ?? ''] || ''}`}
                        >
                          {questionTypeLabels[q.type ?? ''] || q.type}
                        </Badge>
                        <span className="text-[10px] text-gray-400">
                          {difficultyLabels[q.difficulty ?? ''] || q.difficulty}
                        </span>
                        {(field === 'questionBankQuestions' || field === 'quizQuestions') &&
                        onUpdateQuestionScore ? (
                          <div className="flex items-center gap-1 ml-auto">
                            <span className="text-[10px] text-gray-400">分值</span>
                            <Input
                              type="number"
                              value={questionScores?.[qid] ?? q.score ?? 0}
                              onChange={(e) => {
                                const val = Math.max(
                                  0,
                                  Math.min(100, parseInt(e.target.value) || 0),
                                )
                                onUpdateQuestionScore(qid, val)
                              }}
                              className="w-14 h-5 text-[10px] px-1 py-0"
                              min={0}
                              max={100}
                            />
                          </div>
                        ) : (
                          <span className="text-[10px] text-gray-400">{q.score ?? 0}分</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
      {(field === 'questionBankQuestions' || field === 'quizQuestions') &&
        onUpdateQuestionScore && (
          <ScoreConfigDialog
            open={scoreDialogOpen}
            onOpenChange={setScoreDialogOpen}
            questions={selectedQuestionItems}
            onApply={handleTypeDistribution}
          />
        )}
    </>
  )
}
