'use client'

import { useState } from 'react'
import { CheckCircle2, ChevronDown, ChevronUp, Trophy, User, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { QUESTION_TYPE_LABELS_SHORT } from '@zhiyu/shared-types'
import { useT } from '@/lib/i18n/locale-provider'

export const questionTypeLabels = QUESTION_TYPE_LABELS_SHORT

export function toStringArray(v: any): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x).toLowerCase())
  if (typeof v === 'string') return [v.toLowerCase()]
  return []
}

export function isAnswerCorrect(q: any, ans: any): boolean {
  const correct = toStringArray(q.answer)
  const type = q.type
  if (type === 'single') {
    const s = typeof ans === 'string' ? ans.toLowerCase() : ''
    return correct.length > 0 && s === correct[0]
  }
  if (type === 'multiple') {
    const given = toStringArray(ans)
    if (given.length !== correct.length) return false
    const m = new Map<string, number>()
    correct.forEach((c) => m.set(c, (m.get(c) || 0) + 1))
    for (const g of given) {
      const next = (m.get(g) || 0) - 1
      if (next < 0) return false
      m.set(g, next)
    }
    return true
  }
  if (type === 'judge' || type === 'judgment') {
    // 判断题答案归一：兼容 '正确/错误/对/错/T/F/true/false/1/0' 等变体
    const normalize = (v: string): boolean | null => {
      const t = v.trim().toLowerCase()
      if (['正确', '对', 't', 'true', '1', '是'].includes(t)) return true
      if (['错误', '错', 'f', 'false', '0', '否'].includes(t)) return false
      return null
    }
    const s = typeof ans === 'string' ? normalize(ans) : null
    if (correct.length === 0 || s === null) return false
    return s === normalize(String(correct[0]))
  }
  return false
}

export function getAutoScore(q: any, ans: any): number {
  const type = q.type
  if (type === 'single' || type === 'multiple') return isAnswerCorrect(q, ans) ? q.score || 0 : 0
  if (type === 'judge' || type === 'judgment') return isAnswerCorrect(q, ans) ? q.score || 0 : 0
  return 0
}

export function isAutoQuestion(q: any): boolean {
  const type = q.type
  return type === 'single' || type === 'multiple' || type === 'judge' || type === 'judgment'
}

export function getAnswerLabel(ans: any): string {
  if (Array.isArray(ans)) return ans.join('、')
  if (typeof ans === 'string') return ans
  return '未作答'
}

// ============================================================================
// 统一评分输入
// ============================================================================

export function ScoreInput({
  value,
  max,
  step = 0.5,
  disabled,
  onChange,
  onBlur,
  className,
}: {
  value: string
  max: number
  step?: number
  disabled?: boolean
  onChange: (val: string) => void
  onBlur: () => void
  className?: string
}) {
  const t = useT()
  return (
    <TooltipProvider delayDuration={200}>
      <div className={cn('flex items-center gap-1.5', className)}>
        <Input
          type="number"
          min={0}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          disabled={disabled}
          className="w-16 h-8 text-right text-sm font-semibold border-slate-300 focus-visible:ring-primary"
        />
        <span className="text-xs text-gray-400">/ {max}</span>
        {!disabled && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-primary hover:text-primary hover:bg-primary/10"
                onClick={() => {
                  onChange(max.toString())
                }}
              >
                <Trophy className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              <p>{t('一键满分')}</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  )
}

// ============================================================================
// 客观题/主观题评分卡片
// ============================================================================

export function QuestionGradingCard({
  question,
  index,
  answer,
  score,
  isGraded,
  onScoreChange,
}: {
  question: any
  index: number
  answer: any
  score: number
  isGraded: boolean
  onScoreChange: (questionId: string, newScore: number) => void
}) {
  const t = useT()
  const [localScore, setLocalScore] = useState(score.toString())
  const [expanded, setExpanded] = useState(!isAutoQuestion(question))
  const [prevScore, setPrevScore] = useState(score)

  // 父组件外部更新该题分数（批量给满分/自动评分回填）时同步本地输入框（渲染期同步派生状态）
  if (score !== prevScore) {
    setPrevScore(score)
    setLocalScore(score.toString())
  }

  const commitIfValid = (val: string) => {
    const num = parseFloat(val)
    const max = question.score || 0
    if (!isNaN(num) && num >= 0 && num <= max) {
      onScoreChange(question.id, num)
      return true
    }
    return false
  }

  const handleScoreInput = (val: string) => {
    setLocalScore(val)
    // 仅当达到满分（含"一键满分"按钮）时同步提交，其余输入在失焦时提交
    if (val === String(question.score || 0)) {
      commitIfValid(val)
    }
  }

  const handleBlur = () => {
    if (!commitIfValid(localScore)) {
      setLocalScore(score.toString())
    }
  }

  const auto = isAutoQuestion(question)
  const correct = isAnswerCorrect(question, answer)
  const autoScore = auto ? getAutoScore(question, answer) : 0

  return (
    <Card
      className={cn(
        'border-slate-200 overflow-hidden transition-shadow',
        !auto && 'border-amber-200',
      )}
    >
      <CardContent className="p-0">
        <div
          className={cn(
            'flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors',
            !auto ? 'bg-amber-50/50 hover:bg-amber-50/70' : 'bg-white hover:bg-gray-50/60',
          )}
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-center gap-2 shrink-0">
            <Badge
              variant="outline"
              className={cn(
                'text-[10px] h-5 px-1.5 shrink-0',
                !auto && 'border-amber-300 text-amber-700',
              )}
            >
              {questionTypeLabels[question.type] || question.type}
            </Badge>
            <span className="text-xs text-gray-400 shrink-0">
              {t('第 {index} 题', { index: index + 1 })}
            </span>
          </div>
          <span className="text-sm font-medium text-gray-800 flex-1 truncate">
            {question.content}
          </span>
          <div className="flex items-center gap-2 shrink-0">
            {!auto ? (
              <ScoreInput
                value={localScore}
                max={question.score || 0}
                disabled={isGraded}
                onChange={handleScoreInput}
                onBlur={handleBlur}
              />
            ) : (
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold text-gray-700">{autoScore}</span>
                <span className="text-xs text-gray-400">/ {question.score || 0}</span>
                {correct ? (
                  <Badge
                    variant="outline"
                    className="bg-green-50 text-green-600 border-green-200 text-[10px] px-1.5 py-0 h-5 gap-1"
                  >
                    <CheckCircle2 className="h-3 w-3" />
                    {t('正确')}
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="bg-red-50 text-red-600 border-red-200 text-[10px] px-1.5 py-0 h-5 gap-1"
                  >
                    <XCircle className="h-3 w-3" />
                    {t('错误')}
                  </Badge>
                )}
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 ml-1"
              onClick={(e) => {
                e.stopPropagation()
                setExpanded(!expanded)
              }}
            >
              {expanded ? (
                <ChevronUp className="h-4 w-4 text-gray-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-gray-400" />
              )}
            </Button>
          </div>
        </div>

        {expanded && (
          <div className="px-4 pb-4 pt-3 border-t border-gray-100 space-y-4 bg-white">
            <p className="text-sm text-gray-800 leading-relaxed font-medium">{question.content}</p>

            {question.options && question.options.length > 0 && (
              <div className="space-y-2">
                {question.options.map((opt: string, idx: number) => {
                  const optLabel = String.fromCharCode(65 + idx)
                  const isSelected = Array.isArray(answer) ? answer.includes(opt) : answer === opt
                  const isCorrect = Array.isArray(question.answer)
                    ? question.answer.includes(opt)
                    : question.answer === opt
                  return (
                    <div
                      key={idx}
                      className={cn(
                        'flex items-center gap-3 text-sm px-3 py-2.5 rounded-lg border transition-colors',
                        isCorrect
                          ? 'bg-green-50 text-green-700 border-green-200'
                          : isSelected && !isCorrect
                            ? 'bg-red-50 text-red-700 border-red-200'
                            : 'bg-gray-50/50 text-gray-600 border-gray-100',
                      )}
                    >
                      <span
                        className={cn(
                          'w-6 h-6 flex items-center justify-center rounded-md text-xs font-semibold',
                          isCorrect
                            ? 'bg-green-500 text-white'
                            : isSelected && !isCorrect
                              ? 'bg-red-500 text-white'
                              : 'bg-white text-gray-500 border border-gray-200',
                        )}
                      >
                        {optLabel}
                      </span>
                      <span className="flex-1">{opt}</span>
                      {isCorrect && <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />}
                      {isSelected && !isCorrect && (
                        <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {!auto && (
              <div className="space-y-3">
                <div className="bg-amber-50/40 rounded-lg border border-amber-100 p-3">
                  <div className="text-xs text-amber-700 font-medium mb-1.5 flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {t('学生答案')}
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {getAnswerLabel(answer)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 shrink-0">{t('教师评分')}</span>
                  <ScoreInput
                    value={localScore}
                    max={question.score || 0}
                    disabled={isGraded}
                    onChange={setLocalScore}
                    onBlur={handleBlur}
                  />
                </div>
              </div>
            )}

            {auto && (
              <div className="flex flex-wrap items-center gap-4 bg-gray-50 rounded-lg px-3 py-2.5">
                <div className="text-sm">
                  <span className="text-gray-500">{t('学生答案：')}</span>
                  <span
                    className={correct ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}
                  >
                    {getAnswerLabel(answer)}
                  </span>
                </div>
                <div className="text-sm">
                  <span className="text-gray-500">{t('正确答案：')}</span>
                  <span className="text-green-600 font-medium">
                    {getAnswerLabel(question.answer)}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
