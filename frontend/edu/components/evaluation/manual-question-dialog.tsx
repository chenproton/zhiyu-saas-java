'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { Search, Plus, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Checkbox } from '@/components/ui/checkbox'
import { useData } from '@/components/providers/data-provider'
import type { Question, QuestionType, EvalKnowledgePoint } from '@/lib/types'
import { QUESTION_TYPES, QUESTION_TYPE_LABELS, DIFFICULTY_LABELS, QUESTION_TYPE_BADGE_CLASSES } from '@/lib/types'
import { knowledgeApi } from '@/lib/api'
import { reportError } from '@/lib/error-handling'
import { fetchAllPages } from '@zhiyu/api-client'
import { cn } from '@/lib/utils'
import { EmptyState } from '@zhiyu/ui'
import { useT } from '@/lib/i18n/locale-provider'
import { SearchInput } from '@/components/shared/search-input'

const TYPE_COLORS = QUESTION_TYPE_BADGE_CLASSES

interface ManualQuestionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedQuestionIds: string[]
  onAddQuestions: (questions: Question[]) => void
}

export function ManualQuestionDialog({
  open,
  onOpenChange,
  selectedQuestionIds,
  onAddQuestions,
}: ManualQuestionDialogProps) {
  const { questionBanks, getQuestionsByBank, loadBankQuestions } = useData()
  const t = useT()

  const scrollRef = useRef<HTMLDivElement>(null)
  const [selectedBankId, setSelectedBankId] = useState<string>('')
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<QuestionType | 'all'>('all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [knowledgePoints, setKnowledgePoints] = useState<EvalKnowledgePoint[]>([])
  const [loadingQuestions, setLoadingQuestions] = useState(false)

  const publishedBanks = useMemo(() => {
    return questionBanks.filter((bank) => bank.status === 'published')
  }, [questionBanks])

  useEffect(() => {
    ;(async () => {
      if (open && publishedBanks.length > 0 && !selectedBankId) {
        const firstBankId = publishedBanks[0].id
        setSelectedBankId(firstBankId)
      }
    })()
  }, [open, publishedBanks, selectedBankId])

  useEffect(() => {
    ;(async () => {
      if (selectedBankId) {
        setLoadingQuestions(true)
        try {
          await loadBankQuestions?.(selectedBankId)
        } catch (err) {
          reportError(err, '加载题库题目')
        } finally {
          setLoadingQuestions(false)
        }
      }
    })()
  }, [selectedBankId, loadBankQuestions])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    fetchAllPages((page, pageSize) => knowledgeApi.list({ limit: pageSize, offset: page * pageSize }))
      .then((items) => {
        if (!cancelled) setKnowledgePoints(items.map((kp) => ({ id: kp.id, name: kp.name })))
      })
      .catch((err) => reportError(err, '加载知识点列表'))
    return () => {
      cancelled = true
    }
  }, [open])

  const selectedBank = useMemo(() => {
    return questionBanks.find((b) => b.id === selectedBankId)
  }, [questionBanks, selectedBankId])

  const questions = useMemo(() => {
    if (!selectedBankId) return []
    return getQuestionsByBank(selectedBankId)
  }, [selectedBankId, getQuestionsByBank])

  const filteredQuestions = useMemo(() => {
    return questions.filter((q) => {
      const matchSearch = q.content.toLowerCase().includes(search.toLowerCase())
      const matchType = typeFilter === 'all' || q.type === typeFilter
      const notAlreadyAdded = !selectedQuestionIds.includes(q.id)
      return matchSearch && matchType && notAlreadyAdded
    })
  }, [questions, search, typeFilter, selectedQuestionIds])

  const handleToggle = (questionId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(questionId)) {
        next.delete(questionId)
      } else {
        next.add(questionId)
      }
      return next
    })
  }

  const handleAddSelected = () => {
    const questionsToAdd = questions.filter((q) => selectedIds.has(q.id))
    onAddQuestions(questionsToAdd)
    setSelectedIds(new Set())
    onOpenChange(false)
  }

  const handleSelectAll = () => {
    if (selectedIds.size === filteredQuestions.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredQuestions.map((q) => q.id)))
    }
  }

  const handleClose = () => {
    setSelectedIds(new Set())
    setSearch('')
    setTypeFilter('all')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent size="xl" className="flex h-[85vh] flex-col overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b px-6 py-4">
          <DialogTitle>{t('手动抽题')}</DialogTitle>
          <DialogDescription>{t('从已发布的题库中选择题目添加到试卷')}</DialogDescription>
        </DialogHeader>

        <div className="shrink-0 border-b px-6 py-3">
          <div className="flex items-center gap-3">
            <Select
              value={selectedBankId}
              onValueChange={(v) => {
                setSelectedBankId(v)
                setSelectedIds(new Set())
              }}
            >
              <SelectTrigger className="w-64">
                <SelectValue placeholder={t('选择题库')} />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {publishedBanks.length === 0 ? (
                    <SelectItem value="none" disabled>
                      {t('暂无已发布的题库')}
                    </SelectItem>
                  ) : (
                    publishedBanks.map((bank) => (
                      <SelectItem key={bank.id} value={bank.id}>
                        {t('{name} ({n} 题)', { name: bank.name, n: bank.questionCount })}
                      </SelectItem>
                    ))
                  )}
                </SelectGroup>
              </SelectContent>
            </Select>

            {selectedBankId && (
              <>
                <SearchInput
                  wrapperClassName="flex-1"
                  placeholder={t('搜索题目内容...')}
                  value={search}
                  onChange={setSearch}
                />
                <Select
                  value={typeFilter}
                  onValueChange={(v) => setTypeFilter(v as QuestionType | 'all')}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder={t('全部类型')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="all">{t('全部类型')}</SelectItem>
                      {QUESTION_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {t(QUESTION_TYPE_LABELS[type])}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </>
            )}
          </div>
        </div>

        {selectedBankId ? (
          <>
            <div className="shrink-0 flex items-center justify-between border-b px-6 py-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={
                    filteredQuestions.length > 0 && selectedIds.size === filteredQuestions.length
                  }
                  onCheckedChange={handleSelectAll}
                />
                <span className="text-sm text-muted-foreground">
                  {t('已选')}{' '}
                  <span className="font-medium text-foreground">{selectedIds.size}</span> /{' '}
                  {filteredQuestions.length} {t('题')}
                  {selectedBank && <span className="mx-1">·</span>}
                  {selectedBank && <span>{selectedBank.name}</span>}
                </span>
              </div>
              <Button size="sm" disabled={selectedIds.size === 0} onClick={handleAddSelected}>
                <Plus className="mr-1 size-4" />
                {t('添加选中题目 ({n})', { n: selectedIds.size })}
              </Button>
            </div>
            <ScrollArea className="flex-1">
              <div ref={scrollRef} className="p-4 space-y-2">
                {filteredQuestions.length === 0 ? (
                  loadingQuestions ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <div className="size-8 mb-3 animate-spin rounded-full border-2 border-slate-300 border-t-primary" />
                      <p className="text-sm text-muted-foreground">{t('加载题目中...')}</p>
                    </div>
                  ) : (
                    <EmptyState
                      icon={<Search className="size-10 text-muted-foreground/30" />}
                      title={questions.length === 0 ? t('该题库暂无题目') : t('没有找到匹配的题目')}
                      className="py-16"
                    />
                  )
                ) : (
                  filteredQuestions.map((question) => {
                    const kpNames = (question.knowledgePoints || [])
                      .map((id) => knowledgePoints.find((k) => k.id === id)?.name)
                      .filter(Boolean) as string[]
                    const isSelected = selectedIds.has(question.id)
                    return (
                      <div
                        key={question.id}
                        className={cn(
                          'flex items-start gap-3 rounded-lg border p-3.5 transition-all cursor-pointer',
                          isSelected
                            ? 'border-primary/60 bg-primary/5 shadow-sm'
                            : 'hover:bg-muted/50 hover:border-slate-300',
                        )}
                        onClick={() => handleToggle(question.id)}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => handleToggle(question.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm line-clamp-2 font-medium">{question.content}</p>
                          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                            <Badge
                              className={`text-xs text-white hover:opacity-90 ${TYPE_COLORS[question.type]}`}
                            >
                              {t(QUESTION_TYPE_LABELS[question.type])}
                            </Badge>
                            {question.difficulty && (
                              <Badge variant="outline" className="text-xs">
                                {t(DIFFICULTY_LABELS[question.difficulty])}
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {t('{n} 分', { n: question.score })}
                            </span>
                            {kpNames.length > 0 && (
                              <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                                {kpNames.join('、')}
                              </span>
                            )}
                          </div>
                        </div>
                        {isSelected && <Check className="size-5 text-primary shrink-0 mt-0.5" />}
                      </div>
                    )
                  })
                )}
              </div>
            </ScrollArea>
          </>
        ) : (
          <EmptyState className="flex-1 py-0" title={t('请先选择一个题库')} />
        )}
      </DialogContent>
    </Dialog>
  )
}
