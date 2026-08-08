'use client'

import Link from 'next/link'
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import {
  ArrowLeft,
  Clock,
  FileText,
  CheckCircle2,
  AlertCircle,
  Send,
  ListOrdered,
  PlayCircle,
  BarChart3,
  BookOpen,
  Users,
  Info,
  Share2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { useData } from '@/components/providers/data-provider'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import type { Exam, ExamUsage } from '@/lib/types'
import { examApi, examUsageApi, examResultApi } from '@/lib/api'
import { reportError } from '@/lib/error-handling'
import { formatDateTime } from '@/lib/format-utils'
import { useToast } from '@zhiyu/ui'
import { FavoriteButton } from '@/components/shared/favorite-button'
import { MobileAccessDialog } from '@/components/portal/mobile-access-dialog'
import { useT } from '@/lib/i18n/locale-provider'
/* ─── 题型标签映射 ─── */
const typeLabelMap: Record<string, string> = {
  single: '单选题',
  multiple: '多选题',
  judge: '判断题',
  fill: '填空题',
  essay: '问答题',
  short_answer: '简答题',
}

const pieColors = ['#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#dbeafe']

function getTargetAudience(t: (key: string) => string): { type: string; detail: string } {
  // 考试对象名单由考试安排接口决定，当前不展示模拟学生
  return { type: t('学生'), detail: t('由考试安排指定') }
}

export default function ExamDetailPage() {
  const t = useT()
  const params = useParams()
  const searchParams = useSearchParams()
  const examId = params.id as string
  const taskId = searchParams.get('task') || ''
  const sceneId = searchParams.get('scene') || ''
  const courseId = searchParams.get('course') || ''
  const nodeId = searchParams.get('node') || ''
  const methodKey = searchParams.get('method') || ''
  const usageIdFromQuery = searchParams.get('usage') || ''
  const { exams, getExam } = useData()
  const { toast } = useToast()

  const cachedExam = getExam ? getExam(examId) : (exams || []).find((e) => e.id === examId)
  const [fetchedExam, setFetchedExam] = useState<Exam | null>(null)
  const exam = cachedExam || fetchedExam
  const questions = exam?.questions || []
  const [examLoading, setExamLoading] = useState(!cachedExam)

  const [started, setStarted] = useState(false)
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({})
  const [submitted, setSubmitted] = useState(false)
  const [timeLeft, setTimeLeft] = useState(0)
  const [showAudienceDialog, setShowAudienceDialog] = useState(false)
  const [currentUsage, setCurrentUsage] = useState<ExamUsage | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [mobileAccessOpen, setMobileAccessOpen] = useState(false)

  const questionTypeStats = useMemo(() => {
    if (!exam) return []
    const examQuestions = exam.questions || []
    const stats: Record<string, { count: number; score: number }> = {}
    examQuestions.forEach((q) => {
      const label = t(typeLabelMap[q.type] || q.type)
      if (!stats[label]) stats[label] = { count: 0, score: 0 }
      stats[label].count += 1
      stats[label].score += q.score
    })
    return Object.entries(stats).map(([name, { count, score }], index) => ({
      name,
      count,
      score,
      value: count,
      color: pieColors[index % pieColors.length],
    }))
  }, [exam, t])

  const isSceneTask = !!taskId && !!methodKey
  const isCourseTask = !!courseId && !!nodeId

  // 窗口状态：未到开始时间 / 已过结束时间 / 开放中。
  const getUsageWindowState = useCallback(
    (u: ExamUsage | null): 'open' | 'not_started' | 'ended' => {
      if (!u) return 'open'
      const now = Date.now()
      if (u.startTime && now < new Date(u.startTime).getTime()) return 'not_started'
      if (u.endTime && now > new Date(u.endTime).getTime()) return 'ended'
      return 'open'
    },
    [],
  )
  const usageWindowState = getUsageWindowState(currentUsage)

  // 考试时长优先取安排配置（任务规则里配的时长），未配置回退试卷自身时长。
  const examDuration = useMemo(
    () => currentUsage?.duration ?? exam?.duration ?? 0,
    [currentUsage, exam],
  )

  useEffect(() => {
    if (!examId || cachedExam) return
    const fetchExam = async () => {
      setExamLoading(true)
      try {
        const data = await examApi.get(examId)
        setFetchedExam(data)
      } catch {
        setFetchedExam(null)
      } finally {
        setExamLoading(false)
      }
    }
    fetchExam()
  }, [examId, cachedExam])

  useEffect(() => {
    if (!examId) return
    examUsageApi
      .list({ examId })
      .then((res) => {
        const items = res.items || []
        const usage = items.find((u) => u.id === usageIdFromQuery) || items[0] || null
        if (usage && !currentUsage) {
          setCurrentUsage(usage)
        }
      })
      .catch((err) => {
        reportError(err, '加载考试记录')
        toast({ title: t('考试记录加载失败'), variant: 'destructive' })
      })
  }, [examId, currentUsage, usageIdFromQuery, toast, t])

  const handleSubmit = useCallback(async () => {
    if (!currentUsage) return
    setSubmitting(true)
    try {
      await examResultApi.submit({ examUsageId: currentUsage.id, answers, methodKey })
      setSubmitted(true)
    } catch (err: any) {
      const msg = err?.message || t('请重试')
      toast({ variant: 'destructive', title: t('提交失败'), description: msg })
    } finally {
      setSubmitting(false)
    }
  }, [currentUsage, answers, methodKey, toast, t])

  const handleSubmitRef = useRef(handleSubmit)
  useEffect(() => {
    handleSubmitRef.current = handleSubmit
  }, [handleSubmit])

  const submittedRef = useRef(false)

  const handleStart = () => {
    setStarted(true)
    // 时长为 0/未配置视为不限时（-1 表示不限时，不触发自动交卷）
    setTimeLeft(examDuration > 0 ? examDuration * 60 : -1)
  }

  useEffect(() => {
    if (started && exam && !submitted) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => (prev > 0 ? prev - 1 : prev))
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [started, exam, submitted])

  // 倒计时归零时自动提交（通过 ref 防止重复提交）
  useEffect(() => {
    if (started && exam && !submitted && !submittedRef.current && timeLeft === 0) {
      submittedRef.current = true
      handleSubmitRef.current()
    }
  }, [started, exam, submitted, timeLeft])

  if (examLoading) {
    return (
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: 24 }}>
        <div style={{ textAlign: 'center', padding: '80px 0', color: '#8f959e' }}>
          <Clock style={{ width: 48, height: 48, margin: '0 auto 12px', opacity: 0.3 }} />
          <p>{t('加载中...')}</p>
        </div>
      </div>
    )
  }

  if (!exam) {
    return (
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: 24 }}>
        <div style={{ textAlign: 'center', padding: '80px 0', color: '#8f959e' }}>
          <AlertCircle style={{ width: 48, height: 48, margin: '0 auto 12px', opacity: 0.3 }} />
          <p>{t('考试不存在或已删除')}</p>
          <Link href="/evaluation/landing/exam-center">
            <Button variant="outline" size="sm" style={{ marginTop: 16 }}>
              {t('返回考试中心')}
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  const totalScore = questions.reduce((s, q) => s + (q.score || 0), 0)
  const answeredCount = Object.keys(answers).length
  const targetAudience = getTargetAudience(t)
  // canStart 由服务端真实数据校验：考试已开启（published）、存在考试安排且在开放时间窗内。
  // 定时启停考试懒更新后 published 必在窗口内；随时/手动模式无时间窗（open）。
  const canStart =
    (isSceneTask || exam.status === 'published') &&
    currentUsage &&
    (currentUsage.status === 'published' || currentUsage.status === 'in_progress') &&
    usageWindowState === 'open'

  const handleSingle = (qid: string, val: string) => setAnswers((p) => ({ ...p, [qid]: val }))
  const handleMultiple = (qid: string, opt: string, checked: boolean) => {
    setAnswers((p) => {
      const cur = (p[qid] as string[]) || []
      return { ...p, [qid]: checked ? [...cur, opt] : cur.filter((o) => o !== opt) }
    })
  }
  const handleEssay = (qid: string, val: string) => setAnswers((p) => ({ ...p, [qid]: val }))
  const handleFill = (qid: string, blankIndex: number, val: string) => {
    setAnswers((p) => {
      const cur = (p[qid] as string[]) || []
      const next = [...cur]
      next[blankIndex] = val
      return { ...p, [qid]: next }
    })
  }

  const fmtTime = (sec: number) => {
    const m = Math.floor(sec / 60),
      s = sec % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  /* ─── 提交成功 ─── */
  if (submitted) {
    return (
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: 24 }}>
        <div style={{ marginBottom: 24 }}>
          <Link href="/evaluation/landing/exam-center">
            <Button variant="ghost" size="sm" style={{ gap: 6 }}>
              <ArrowLeft style={{ width: 16, height: 16 }} /> {t('返回考试中心')}
            </Button>
          </Link>
        </div>
        <div
          style={{
            background: '#fff',
            borderRadius: 12,
            border: '1px solid #e5e6eb',
            padding: 32,
            textAlign: 'center',
          }}
        >
          <CheckCircle2
            style={{ width: 64, height: 64, color: '#34c759', margin: '0 auto 16px' }}
          />
          <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>{t('试卷已提交')}</h2>
          <p style={{ color: '#8f959e' }}>
            {t('感谢您的参与，考试结果将在阅卷完成后公布。')}
          </p>
          <div
            style={{
              marginTop: 24,
              display: 'flex',
              flexWrap: 'wrap',
              gap: 12,
              justifyContent: 'center',
            }}
          >
            {isSceneTask && sceneId && (
              <Link href={`/scene/landing/${sceneId}/learn?task=${taskId}`}>
                <Button variant="outline">{t('返回学习页')}</Button>
              </Link>
            )}
            {isCourseTask && courseId && (
              <Link href={`/lesson/landing/${courseId}?node=${nodeId}`}>
                <Button variant="outline">{t('返回课程学习页')}</Button>
              </Link>
            )}
            <Link href="/evaluation/landing/exam-center">
              <Button variant="outline">{t('返回考试中心')}</Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  /* ─── 答题中 ─── */
  if (started) {
    return (
      <div className="max-w-[1400px] mx-auto p-4 sm:p-6">
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 24,
          }}
        >
          <h1 style={{ fontSize: 18, fontWeight: 700, minWidth: 0 }}>{exam.name}</h1>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16, fontSize: 14 }}>
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                color: timeLeft >= 0 && timeLeft < 300 ? '#dc2626' : '#8f959e',
              }}
            >
              <Clock style={{ width: 16, height: 16 }} />{' '}
              {t('剩余 {time}', { time: timeLeft < 0 ? t('不限时') : fmtTime(timeLeft) })}
            </span>
            <span style={{ color: '#8f959e' }}>
              {t('已答 {a} / {b} 题', { a: answeredCount, b: questions.length })}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {questions.map((q, idx) => (
              <div
                key={q.id}
                style={{
                  background: '#fff',
                  borderRadius: 12,
                  border: '1px solid #e5e6eb',
                  padding: 24,
                }}
              >
                <div style={{ marginBottom: 16 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#8f959e' }}>
                    {idx + 1}.{' '}
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{q.content}</span>
                  <span style={{ marginLeft: 8, fontSize: 12, color: '#8f959e' }}>
                    {t('（{score} 分）', { score: q.score })}
                  </span>
                </div>
                {q.type === 'single' && q.options && (
                  <RadioGroup
                    value={(answers[q.id] as string) || ''}
                    onValueChange={(v) => handleSingle(q.id, v)}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {q.options.map((opt) => (
                        <label
                          key={opt}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            padding: 12,
                            borderRadius: 8,
                            border: '1px solid #e5e6eb',
                            cursor: 'pointer',
                            transition: 'background 0.2s',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#f5f6f7'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent'
                          }}
                        >
                          <RadioGroupItem value={opt} />
                          <span style={{ fontSize: 14 }}>{opt}</span>
                        </label>
                      ))}
                    </div>
                  </RadioGroup>
                )}
                {q.type === 'multiple' && q.options && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {q.options.map((opt) => (
                      <label
                        key={opt}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          padding: 12,
                          borderRadius: 8,
                          border: '1px solid #e5e6eb',
                          cursor: 'pointer',
                          transition: 'background 0.2s',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#f5f6f7'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent'
                        }}
                      >
                        <Checkbox
                          checked={((answers[q.id] as string[]) || []).includes(opt)}
                          onCheckedChange={(c) => handleMultiple(q.id, opt, c as boolean)}
                        />
                        <span style={{ fontSize: 14 }}>{opt}</span>
                      </label>
                    ))}
                  </div>
                )}
                {q.type === 'fill' ? (
                  <div
                    style={{
                      fontSize: 14,
                      lineHeight: 2.2,
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      gap: '4px 8px',
                    }}
                  >
                    {(() => {
                      let blankIndex = -1
                      return q.content.split(/(\{\d+\})/).map((part, idx) => {
                        if (/\{\d+\}/.test(part)) {
                          blankIndex++
                          const currentBlankIndex = blankIndex
                          const val = ((answers[q.id] as string[]) || [])[currentBlankIndex] || ''
                          return (
                            <input
                              key={idx}
                              type="text"
                              value={val}
                              onChange={(e) => handleFill(q.id, currentBlankIndex, e.target.value)}
                              placeholder={t('空{n}', { n: currentBlankIndex + 1 })}
                              style={{
                                width: Math.max(60, val.length * 14 + 20),
                                minWidth: 60,
                                padding: '4px 8px',
                                border: '1px solid #e5e6eb',
                                borderRadius: 6,
                                fontSize: 14,
                                textAlign: 'center',
                              }}
                            />
                          )
                        }
                        return <span key={idx}>{part}</span>
                      })
                    })()}
                  </div>
                ) : q.type === 'judge' ? (
                  <div style={{ display: 'flex', gap: 12, paddingTop: 4 }}>
                    {[
                      { value: 'true', label: t('正确') },
                      { value: 'false', label: t('错误') },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => handleEssay(q.id, opt.value)}
                        style={{
                          padding: '8px 24px',
                          border: `1px solid ${
                            answers[q.id] === opt.value ? '#2563eb' : '#e5e6eb'
                          }`,
                          borderRadius: 8,
                          background: answers[q.id] === opt.value ? '#eff6ff' : '#fff',
                          color: answers[q.id] === opt.value ? '#2563eb' : '#333',
                          fontSize: 14,
                          cursor: 'pointer',
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                ) : (
                  (q.type === 'essay' || q.type === 'short_answer') && (
                    <Textarea
                      placeholder={t('请输入您的答案...')}
                      rows={4}
                      value={(answers[q.id] as string) || ''}
                      onChange={(e) => handleEssay(q.id, e.target.value)}
                    />
                  )
                )}
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
              <Button
                size="lg"
                style={{ gap: 8 }}
                onClick={handleSubmit}
                disabled={!currentUsage || submitting}
              >
                <Send style={{ width: 20, height: 20 }} />{' '}
                {submitting ? t('提交中...') : t('提交试卷')}
              </Button>
            </div>
          </div>

          {/* 答题卡 */}
          <div
            style={{
              position: 'sticky',
              top: 80,
              alignSelf: 'flex-start',
              background: '#fff',
              borderRadius: 12,
              border: '1px solid #e5e6eb',
              padding: 20,
            }}
          >
            <h4 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>{t('答题卡')}</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
              {questions.map((q, i) => (
                <div
                  key={q.id}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: 'pointer',
                    background: answers[q.id] ? '#3370ff' : '#f5f6f7',
                    color: answers[q.id] ? 'white' : '#646a73',
                    border: 'none',
                  }}
                >
                  {i + 1}
                </div>
              ))}
            </div>
            <div
              style={{
                marginTop: 16,
                paddingTop: 16,
                borderTop: '1px solid #e5e6eb',
                fontSize: 13,
                color: '#8f959e',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ width: 12, height: 12, borderRadius: 4, background: '#3370ff' }} />
                {t('已答 {n} 题', { n: answeredCount })}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 4,
                    background: '#f5f6f7',
                    border: '1px solid #e5e6eb',
                  }}
                />
                {t('未答 {n} 题', { n: questions.length - answeredCount })}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  /* ─── 概览页 ─── */
  return (
    <div className="max-w-[1400px] mx-auto p-4 sm:p-6">
      <div style={{ marginBottom: 24 }}>
        <Link href="/evaluation/landing/exam-center">
          <Button variant="ghost" size="sm" style={{ gap: 6 }}>
            <ArrowLeft style={{ width: 16, height: 16 }} /> {t('返回考试中心')}
          </Button>
        </Link>
      </div>

      {/* 主信息 */}
      <div
        style={{
          background: '#fff',
          borderRadius: 12,
          border: '1px solid #e5e6eb',
          overflow: 'hidden',
          marginBottom: 24,
        }}
      >
        <div
          style={{
            padding: '20px 16px',
            background: 'linear-gradient(135deg, color-mix(in srgb, var(--primary) 75%, white), var(--primary))',
            color: 'white',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>{exam.name}</h1>
            <p style={{ fontSize: 14, opacity: 0.9 }}>{exam.description}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
            <FavoriteButton
              targetType="exam"
              targetId={exam.id}
              label={t('收藏试卷')}
              activeLabel={t('已收藏试卷')}
              light
            />
            <Button
              variant="ghost"
              size="icon"
              style={{ color: 'white', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.35)' }}
              aria-label={t('分享')}
              onClick={() => setMobileAccessOpen(true)}
            >
              <Share2 style={{ width: 18, height: 18 }} />
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 px-4 sm:px-8 py-5 sm:py-6">
          {[
            {
              icon: <Clock style={{ width: 18, height: 18 }} />,
              label: t('考试时长'),
              value: t('{n} 分钟', { n: examDuration }),
            },
            {
              icon: <ListOrdered style={{ width: 18, height: 18 }} />,
              label: t('题目数量'),
              value: t('{n} 题', { n: questions.length }),
            },
            {
              icon: <BarChart3 style={{ width: 18, height: 18 }} />,
              label: t('总分'),
              value: t('{n} 分', { n: totalScore }),
            },
            {
              icon: <Users style={{ width: 18, height: 18 }} />,
              label: t('考试对象'),
              value: t('{type}（{detail}）', {
                type: targetAudience.type,
                detail: targetAudience.detail,
              }),
              clickable: false,
              key: 'audience',
            },
          ].map((item, i) => (
            <div
              style={{
                textAlign: 'center',
                padding: '16px 0',
                background: item.clickable ? '#fff7ed' : '#f5f6f7',
                borderRadius: 8,
                cursor: item.clickable ? 'pointer' : 'default',
                border: item.clickable ? '1px dashed #f97316' : '1px solid transparent',
                transition: 'all 0.2s',
              }}
              onClick={() => item.clickable && setShowAudienceDialog(true)}
              onMouseEnter={(e) => {
                if (item.clickable) {
                  e.currentTarget.style.background = '#ffedd5'
                }
              }}
              onMouseLeave={(e) => {
                if (item.clickable) {
                  e.currentTarget.style.background = '#fff7ed'
                }
              }}
              key={i}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  color: item.clickable ? '#f97316' : '#3370ff',
                  marginBottom: 6,
                }}
              >
                {item.icon} <span style={{ fontSize: 13, fontWeight: 500 }}>{item.label}</span>
              </div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  padding: '0 8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                }}
              >
                {item.value}
                {item.clickable && <Info style={{ width: 14, height: 14, opacity: 0.7 }} />}
              </div>
              {item.clickable && (
                <div style={{ fontSize: 11, color: '#f97316', marginTop: 4 }}>
                  {t('点击查看范围详情')}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 考试概览 + 考试须知 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div
          style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e6eb', padding: 24 }}
        >
          <h3
            style={{
              fontSize: 16,
              fontWeight: 600,
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <FileText style={{ width: 18, height: 18, color: '#3370ff' }} /> {t('考试概览')}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {questionTypeStats.length > 0 ? (
              <>
                <div style={{ width: '100%', height: 220 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={questionTypeStats}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                        nameKey="name"
                        label={({ name, score }) => t('{name}: {score}分', { name, score })}
                      >
                        {questionTypeStats.map(
                          (entry: (typeof questionTypeStats)[0], index: number) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ),
                        )}
                      </Pie>
                      <Tooltip
                        formatter={(value: number, name: string, props: any) => [
                          t('{value}题 / {score}分', {
                            value,
                            score: props.payload.score,
                          }),
                          name,
                        ]}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {questionTypeStats.map((stat: (typeof questionTypeStats)[0]) => (
                    <div
                      key={stat.name}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: 10,
                        background: '#f5f6f7',
                        borderRadius: 8,
                      }}
                    >
                      <span
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          background: stat.color,
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ fontSize: 13, color: '#1f2329' }}>{stat.name}</span>
                      <span style={{ fontSize: 12, color: '#8f959e', marginLeft: 'auto' }}>
                        {t('{n}题 / {s}分', { n: stat.count, s: stat.score })}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', fontSize: 13, color: '#8f959e', padding: 20 }}>
                {t('暂无题目数据')}
              </div>
            )}
          </div>
        </div>

        <div
          style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e6eb', padding: 24 }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 16,
            }}
          >
            <h3
              style={{
                fontSize: 16,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <BookOpen style={{ width: 18, height: 18, color: '#3370ff' }} /> {t('考试须知')}
            </h3>
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              fontSize: 14,
              color: '#646a73',
            }}
          >
            <p>{t('1. 请在规定时间内完成所有题目，超时将自动提交。')}</p>
            <p>{t('2. 单选题每题只有一个正确答案，多选题有多个正确答案。')}</p>
            <p>{t('3. 答题过程中请勿刷新页面或关闭浏览器。')}</p>
            <p>{t('4. 提交后无法修改答案，请确认后再提交。')}</p>
            <p>{t('5. 考试期间系统将自动保存答题进度。')}</p>
            {(currentUsage?.startTime || currentUsage?.endTime) && (
              <p>
                {t('开放时间：{start} ~ {end}', {
                  start: formatDateTime(currentUsage?.startTime),
                  end: formatDateTime(currentUsage?.endTime),
                })}
              </p>
            )}
          </div>
          <div style={{ marginTop: 24, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 12 }}>
            {canStart ? (
              <Button size="lg" style={{ gap: 8, background: '#3370ff' }} onClick={handleStart}>
                <PlayCircle style={{ width: 20, height: 20 }} /> {t('开始考试')}
              </Button>
            ) : (
              <Button
                size="lg"
                variant="outline"
                disabled
                style={{ gap: 8, maxWidth: '100%' }}
                className="whitespace-normal h-auto py-2.5 px-4 text-sm"
              >
                <PlayCircle style={{ width: 20, height: 20 }} />
                {!currentUsage
                  ? t('暂无考试安排')
                  : currentUsage.status === 'draft' || currentUsage.status === 'pending'
                    ? t('考试未开放')
                    : usageWindowState === 'not_started'
                      ? t('考试未开始（{time} 开放）', {
                          time: formatDateTime(currentUsage.startTime),
                        })
                      : usageWindowState === 'ended'
                        ? t('考试已结束')
                        : !isSceneTask &&
                            (exam.status === 'draft' ||
                              exam.status === 'pending' ||
                              exam.status === 'rejected' ||
                              exam.status === 'approved')
                          ? t('考试未发布')
                          : t('考试已结束')}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* 考试对象名单弹窗 */}
      <Dialog open={showAudienceDialog} onOpenChange={setShowAudienceDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('考试范围详情')}</DialogTitle>
            <DialogDescription>
              {t('本次考试面向 {type}：{detail}', {
                type: targetAudience.type,
                detail: targetAudience.detail,
              })}
            </DialogDescription>
          </DialogHeader>
          <div className="py-6 text-center text-sm text-muted-foreground">
            {t('参考人员名单由管理员在考试安排中指定，暂无明细数据。')}
          </div>
        </DialogContent>
      </Dialog>

      <MobileAccessDialog open={mobileAccessOpen} onOpenChange={setMobileAccessOpen} />
    </div>
  )
}
