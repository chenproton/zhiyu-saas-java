'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  GraduationCap,
  Save,
  Star,
} from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { reportError } from '@/lib/error-handling'
import { examApi, examResultApi, examUsageApi } from '@/lib/api'
import type { ExamResult } from '@/lib/types'
import {
  QuestionGradingCard,
  getAutoScore,
  isAutoQuestion,
} from '@/components/shared/exam-grading/question-grading-card'
import { useT } from '@/lib/i18n/locale-provider'

function getInitials(name: string): string {
  if (!name || name === '未知') return '?'
  return name.slice(0, 2).toUpperCase()
}

export default function DailyExamGradingPage() {
  const params = useParams()
  const t = useT()
  const resultId = params.resultId as string

  const [result, setResult] = useState<ExamResult | null>(null)
  const [exam, setExam] = useState<any>(null)
  const [usageName, setUsageName] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)
  const [comment, setComment] = useState('')
  const [pointScores, setPointScores] = useState<Record<string, number>>({})
  const [gradedIds, setGradedIds] = useState<Set<string>>(new Set())
  const [questionFilter, setQuestionFilter] = useState<'all' | 'pending'>('all')

  useEffect(() => {
    if (!resultId) return
    const load = async () => {
      try {
        const res = await examResultApi.get(resultId)
        setResult(res)
        setComment(res.gradingComment || '')
        if (res.gradingStatus === 'evaluated') setSaved(true)

        const gs = (res.gradingScores || {}) as Record<string, any>
        const scores: Record<string, number> = {}
        Object.entries(gs).forEach(([k, v]) => {
          if (typeof v === 'number') scores[k] = v
          else if (v && typeof v === 'object') scores[k] = typeof v.score === 'number' ? v.score : 0
        })
        setPointScores(scores)
        if (Object.keys(gs).length > 0) setGradedIds(new Set(Object.keys(gs)))

        const usage = await examUsageApi.get(res.examUsageId).catch(() => null)
        setUsageName(usage?.name || '')
        if (usage) {
          const examData = await examApi.get(usage.examId).catch(() => null)
          setExam(examData)
        }
      } catch (e) {
        reportError(e, '加载评分详情')
        setLoadError(e instanceof Error ? e.message : t('加载失败'))
      }
      setLoading(false)
    }
    load()
  }, [resultId, t])

  const examQuestions = useMemo(() => exam?.questions || [], [exam])
  const objectiveAnswers = useMemo(
    () => (result?.answers || {}) as Record<string, any>,
    [result],
  )

  const examAutoTotal = useMemo(() => {
    return examQuestions.reduce(
      (sum: number, q: any) => sum + getAutoScore(q, objectiveAnswers[q.id]),
      0,
    )
  }, [examQuestions, objectiveAnswers])

  const examSubjectiveTotal = useMemo(() => {
    return examQuestions.reduce((sum: number, q: any) => {
      if (isAutoQuestion(q)) return sum
      return sum + (pointScores[q.id] ?? 0)
    }, 0)
  }, [examQuestions, pointScores])

  const examTotal = examAutoTotal + examSubjectiveTotal
  const examMaxScore =
    result?.totalScore ??
    exam?.totalScore ??
    examQuestions.reduce((sum: number, q: any) => sum + (q.score || 0), 0)

  const pendingQuestions = useMemo(() => {
    return examQuestions.filter(
      (q: any) => !isAutoQuestion(q) && !gradedIds.has(q.id) && (pointScores[q.id] ?? 0) === 0,
    )
  }, [examQuestions, pointScores, gradedIds])

  const displayedQuestions = useMemo(() => {
    return questionFilter === 'all' ? examQuestions : pendingQuestions
  }, [questionFilter, examQuestions, pendingQuestions])

  const allScored =
    examQuestions.length === 0 ||
    examQuestions
      .filter((q: any) => !isAutoQuestion(q))
      .every((q: any) => gradedIds.has(q.id) || q.score === 0)

  const handleScoreChange = (id: string, score: number) => {
    setPointScores((prev) => ({ ...prev, [id]: score }))
    setGradedIds((prev) => new Set(prev).add(id))
  }

  const handleSave = async () => {
    if (!result) return
    setSaving(true)
    try {
      const scores: Record<string, any> = {}
      Object.entries(pointScores).forEach(([k, v]) => {
        scores[k] = { score: v }
      })
      await examResultApi.grade(result.id, { scores, comment: comment || undefined })
      setSaved(true)
    } catch (e) {
      reportError(e, '保存评分')
      setSaveFailed(true)
    }
    setSaving(false)
  }

  if (loading)
    return (
      <div className="h-screen flex items-center justify-center text-gray-400">{t('加载中...')}</div>
    )
  if (!result)
    return (
      <div className="h-screen flex flex-col items-center justify-center text-gray-400">
        {loadError ? (
          <>
            <p className="mb-2">{t('加载失败')}</p>
            <p className="text-xs text-red-400">{loadError}</p>
          </>
        ) : (
          <p>{t('记录不存在')}</p>
        )}
      </div>
    )

  const studentName = result.studentName || t('未知')
  const classInfo = [result.grade, result.className].filter(Boolean).join(' · ')

  return (
    <>
      <div className="h-[calc(100vh-3.5rem-3rem)] flex flex-col bg-gray-50">
        {/* 顶部导航 */}
        <div className="bg-white border-b px-4 py-2 flex items-center gap-3 shrink-0">
          <Button variant="ghost" size="sm" asChild className="h-8">
            <Link href="/evaluation/lesson-results/daily-exams">
              <ArrowLeft className="mr-1 h-4 w-4" />
              {t('返回')}
            </Link>
          </Button>
          <Separator orientation="vertical" className="h-4" />
          <span className="text-sm text-gray-500 truncate">
            {t('{name} · 评分详情', { name: usageName || t('日常考试') })}
          </span>
        </div>

        {/* 学生信息头部 */}
        <div className="bg-white border-b px-4 py-3 shrink-0">
          <div className="flex items-center gap-4">
            <Avatar className="h-12 w-12 border-2 border-white shadow-sm">
              <AvatarFallback
                className={cn(
                  'text-sm font-medium',
                  saved ? 'bg-green-100 text-green-700' : 'bg-primary/10 text-primary',
                )}
              >
                {getInitials(studentName)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base font-semibold text-gray-900">{studentName}</h1>
                {classInfo && (
                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    <GraduationCap className="h-3 w-3" />
                    {classInfo}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-sm text-gray-600 truncate max-w-[260px]">
                  {usageName || t('日常考试')}
                </span>
                {saved ? (
                  <Badge
                    variant="outline"
                    className="text-[10px] h-5 px-1.5 bg-green-50 text-green-600 border-green-200 gap-1"
                  >
                    <CheckCircle2 className="h-3 w-3" />
                    {t('已评分')}
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="text-[10px] h-5 px-1.5 bg-amber-50 text-amber-600 border-amber-200 gap-1"
                  >
                    <Star className="h-3 w-3" />
                    {t('待评分')}
                  </Badge>
                )}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-xs text-gray-500 mb-0.5">{t('当前总分')}</div>
              <div className="flex items-baseline justify-end gap-1">
                <span
                  className={cn(
                    'text-2xl font-bold',
                    saved || examTotal > 0 ? 'text-green-600' : 'text-gray-400',
                  )}
                >
                  {saved || examTotal > 0 ? examTotal : '-'}
                </span>
                <span className="text-sm text-gray-400">/ {examMaxScore}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 题目列表 */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="px-4 py-3 bg-white border-b shrink-0">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/5 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-gray-800">{t('试卷评分')}</h2>
                  <p className="text-xs text-gray-500">
                    {t('共 {total} 题（客观 {auto} / 主观 {subj}）', {
                      total: examQuestions.length,
                      auto: examQuestions.filter((q: any) => isAutoQuestion(q)).length,
                      subj: examQuestions.filter((q: any) => !isAutoQuestion(q)).length,
                    })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-1.5 border border-slate-100">
                <span className="text-sm text-gray-500">{t('最终总分')}</span>
                <Input
                  type="number"
                  min={0}
                  max={examMaxScore}
                  value={examTotal}
                  disabled
                  className="w-20 text-right h-9 text-lg font-bold text-primary border-transparent bg-transparent focus-visible:ring-0 px-0"
                />
                <span className="text-lg text-gray-400 font-medium">/ {examMaxScore}</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5 bg-green-50 rounded-md px-2.5 py-1 border border-green-100">
                <span className="text-gray-600">{t('客观题自动得分')}</span>
                <span className="font-semibold text-green-700">
                  {examAutoTotal} /{' '}
                  {examQuestions.reduce(
                    (s: number, q: any) => s + (isAutoQuestion(q) ? q.score || 0 : 0),
                    0,
                  )}
                </span>
              </div>
              <div className="flex items-center gap-1.5 bg-amber-50 rounded-md px-2.5 py-1 border border-amber-100">
                <span className="text-gray-600">{t('主观题得分')}</span>
                <span
                  className={cn(
                    'font-semibold',
                    examSubjectiveTotal > 0 ? 'text-amber-700' : 'text-amber-600',
                  )}
                >
                  {examSubjectiveTotal} /{' '}
                  {examQuestions.reduce(
                    (s: number, q: any) => s + (!isAutoQuestion(q) ? q.score || 0 : 0),
                    0,
                  )}
                </span>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 pb-24">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <button
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                    questionFilter === 'all'
                      ? 'bg-primary text-white'
                      : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50',
                  )}
                  onClick={() => setQuestionFilter('all')}
                >
                  {t('全部题目 ({n})', { n: examQuestions.length })}
                </button>
                <button
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                    questionFilter === 'pending'
                      ? 'bg-amber-500 text-white'
                      : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50',
                  )}
                  onClick={() => setQuestionFilter('pending')}
                >
                  {t('待评分题目 ({n})', { n: pendingQuestions.length })}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              {displayedQuestions.map((q: any, idx: number) => (
                <QuestionGradingCard
                  key={q.id}
                  question={q}
                  index={questionFilter === 'all' ? idx : examQuestions.indexOf(q)}
                  answer={objectiveAnswers[q.id]}
                  score={pointScores[q.id] ?? 0}
                  isGraded={saved}
                  onScoreChange={handleScoreChange}
                />
              ))}
              {displayedQuestions.length === 0 && (
                <div className="py-12 text-center text-gray-400 text-sm bg-white rounded-lg border border-dashed border-gray-200">
                  {t('暂无待评分题目')}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 底部操作栏 */}
      <div className="fixed bottom-0 left-0 right-0 lg:left-56 bg-white border-t shadow-[0_-2px_10px_rgba(0,0,0,0.05)] px-4 py-3 z-50">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 shrink-0 min-w-[140px]">
            <span className="text-sm text-gray-500">{t('最终得分')}</span>
            <span
              className={cn(
                'text-3xl font-bold',
                saved || examTotal > 0 ? 'text-green-600' : 'text-gray-300',
              )}
            >
              {saved || examTotal > 0 ? examTotal : '-'}
            </span>
            <span className="text-sm text-gray-400">/ {examMaxScore}</span>
          </div>
          <Separator orientation="vertical" className="h-8" />
          <div className="flex-1 min-w-0">
            <Textarea
              placeholder={t('教师评语...')}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              disabled={saved}
              rows={1}
              className="resize-none text-sm min-h-[40px] py-2.5 border-slate-300 focus-visible:ring-primary"
            />
          </div>
          <Button variant="outline" size="sm" asChild className="shrink-0 h-9">
            <Link href="/evaluation/lesson-results/daily-exams">{t('取消')}</Link>
          </Button>
          {!saved && (
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving || !allScored}
              className="shrink-0 h-9 gap-1 px-4"
            >
              <Save className="h-3.5 w-3.5" />
              {saving ? t('保存中...') : t('提交评分')}
            </Button>
          )}
          {saveFailed && <span className="text-xs text-red-500">{t('保存失败，请重试')}</span>}
          {saved && (
            <Button
              size="sm"
              disabled
              className="bg-green-600 hover:bg-green-600 shrink-0 h-9 gap-1 px-4"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {t('已提交')}
            </Button>
          )}
        </div>
      </div>
    </>
  )
}
