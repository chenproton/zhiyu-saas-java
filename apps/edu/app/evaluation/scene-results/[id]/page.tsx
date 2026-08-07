'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  Eye,
  FileText,
  GraduationCap,
  Package,
  Save,
  Star,
} from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@zhiyu/ui'
import { HoverActionBar } from '@/components/shared/hover-action-bar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { reportError } from '@/lib/error-handling'
import {
  evaluationResultApi,
  taskEvaluationApi,
  taskApi,
  userManagementApi,
  examApi,
  examUsageApi,
  examResultApi,
  randomDrawQuestionApi,
} from '@/lib/api'
import type { SceneEvaluationResult, TaskEvaluationMethod, TaskEvalPoint } from '@/lib/types'
import { EVAL_METHOD_LABELS_GRADING } from '@/lib/types'
import {
  QuestionGradingCard,
  ScoreInput,
  getAutoScore,
  isAutoQuestion,
  questionTypeLabels,
} from '@/components/shared/exam-grading/question-grading-card'
import { useT } from '@/lib/i18n/locale-provider'

const evalMethodColors: Record<string, string> = {
  random_draw: 'bg-purple-50 text-purple-600 border-purple-200',
  review: 'bg-amber-50 text-amber-600 border-amber-200',
  paper: 'bg-blue-50 text-blue-600 border-blue-200',
  question_bank: 'bg-indigo-50 text-indigo-600 border-indigo-200',
  outcome: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  homework: 'bg-cyan-50 text-cyan-600 border-cyan-200',
  quiz: 'bg-rose-50 text-rose-600 border-rose-200',
}

function getInitials(name: string): string {
  if (!name || name === '未知') return '?'
  return name.slice(0, 2).toUpperCase()
}

// ============================================================================
// 学生信息头部卡片
// ============================================================================

function StudentInfoCard({
  user,
  result,
  task,
  methodName,
  methodKey,
  computedTotal,
  maxScore,
  saved,
}: {
  user: any
  result: SceneEvaluationResult
  task: any
  methodName: string
  methodKey: string
  computedTotal: number
  maxScore: number
  saved: boolean
}) {
  const t = useT()
  const studentName = user?.name || result.evaluateeId || t('未知')
  const classInfo = [user?.grade, user?.className].filter(Boolean).join(' · ')

  return (
    <div className="bg-white border-b px-4 py-3 shrink-0">
      <div className="flex items-center gap-4">
        <Avatar className="h-12 w-12 border-2 border-white shadow-sm">
          <AvatarFallback
            className={cn(
              'text-sm font-medium',
              saved ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700',
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
            <span className="text-sm text-gray-600 truncate max-w-[260px]">{task?.name}</span>
            <Badge
              variant="outline"
              className={cn('text-[10px] h-5 px-1.5', evalMethodColors[methodKey] || '')}
            >
              {t(methodName)}
            </Badge>
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
                saved || computedTotal > 0 ? 'text-green-600' : 'text-gray-400',
              )}
            >
              {saved || computedTotal > 0 ? computedTotal : '-'}
            </span>
            <span className="text-sm text-gray-400">/ {maxScore}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
// ============================================================================
// ============================================================================
// 客观题/主观题评分卡片（共享组件：components/shared/exam-grading/question-grading-card.tsx）
// ============================================================================


function EvalPointGradingCard({
  evalPoint,
  score,
  comment,
  isGraded,
  onChange,
}: {
  evalPoint: TaskEvalPoint
  score: number
  comment: string
  isGraded: boolean
  onChange: (id: string, score: number, comment: string) => void
}) {
  const t = useT()
  const [localScore, setLocalScore] = useState(score.toString())
  const [localComment, setLocalComment] = useState(comment)

  const commitIfValid = (val: string, newComment?: string) => {
    const num = parseFloat(val)
    // 权重为 0（未配置）时按 100 分上限校验，与输入框 max 保持一致，避免失焦后分数被清空
    const max = evalPoint.weight || 100
    const cmt = newComment !== undefined ? newComment : localComment
    if (!isNaN(num) && num >= 0 && num <= max) {
      onChange(evalPoint.id, num, cmt)
      return true
    }
    return false
  }

  const handleScoreInput = (val: string) => {
    setLocalScore(val)
    // 仅当达到满分（含“一键满分”按钮）时同步提交，其余输入在失焦时提交
    if (val === String(evalPoint.weight || 100)) {
      commitIfValid(val)
    }
  }

  const handleScoreBlur = () => {
    if (!commitIfValid(localScore)) {
      setLocalScore(score.toString())
    }
  }

  return (
    <Card className="border-slate-200">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-gray-800 text-sm">{evalPoint.name}</h4>
            {evalPoint.description && (
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">{evalPoint.description}</p>
            )}
          </div>
          <Badge variant="outline" className="text-[10px] h-5 px-1.5 shrink-0">
            {t('{n} 分', { n: evalPoint.weight || 0 })}
          </Badge>
        </div>
        <div className="flex flex-col gap-3 bg-slate-50 rounded-lg border border-slate-100 p-3">
          <div className="flex items-center gap-3">
            <Label className="text-xs text-slate-600 font-medium shrink-0">{t('评分')}</Label>
            <ScoreInput
              value={localScore}
              max={evalPoint.weight || 100}
              disabled={isGraded}
              onChange={handleScoreInput}
              onBlur={handleScoreBlur}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-600 font-medium">{t('评语')}</Label>
            <Textarea
              placeholder={t('请输入评分说明或改进建议...')}
              value={localComment}
              onChange={(e) => setLocalComment(e.target.value)}
              onBlur={() => onChange(evalPoint.id, score, localComment)}
              disabled={isGraded}
              rows={2}
              className="text-sm resize-none bg-white border-slate-300 focus-visible:ring-primary"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================================================
// 评分规则项评分卡片（score_rule 模式）
// ============================================================================

function ScoreRuleGradingCard({
  scoreRule,
  score,
  comment,
  isGraded,
  onChange,
}: {
  scoreRule: { id: string; name: string; description?: string; rule?: string; weight: number }
  score: number
  comment: string
  isGraded: boolean
  onChange: (id: string, score: number, comment: string) => void
}) {
  const t = useT()
  const [localScore, setLocalScore] = useState(score.toString())
  const [localComment, setLocalComment] = useState(comment)

  const commitIfValid = (val: string, newComment?: string) => {
    const num = parseFloat(val)
    // 权重为 0（未配置）时按 100 分上限校验，与输入框 max 保持一致
    const max = scoreRule.weight || 100
    const cmt = newComment !== undefined ? newComment : localComment
    if (!isNaN(num) && num >= 0 && num <= max) {
      onChange(scoreRule.id, num, cmt)
      return true
    }
    return false
  }

  const handleScoreInput = (val: string) => {
    setLocalScore(val)
    if (val === String(scoreRule.weight || 100)) {
      commitIfValid(val)
    }
  }

  const handleScoreBlur = () => {
    if (!commitIfValid(localScore)) {
      setLocalScore(score.toString())
    }
  }

  return (
    <Card className="border-slate-200">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-gray-800 text-sm">{scoreRule.name}</h4>
            {scoreRule.description && (
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">{scoreRule.description}</p>
            )}
            {scoreRule.rule && (
              <p className="text-xs text-blue-600 mt-1 leading-relaxed bg-blue-50 border border-blue-100 rounded px-2 py-1">
                {t('加减分规则：{rule}', { rule: scoreRule.rule })}
              </p>
            )}
          </div>
          <Badge variant="outline" className="text-[10px] h-5 px-1.5 shrink-0">
            {t('{n} 分', { n: scoreRule.weight || 0 })}
          </Badge>
        </div>
        <div className="flex flex-col gap-3 bg-slate-50 rounded-lg border border-slate-100 p-3">
          <div className="flex items-center gap-3">
            <Label className="text-xs text-slate-600 font-medium shrink-0">{t('评分')}</Label>
            <ScoreInput
              value={localScore}
              max={scoreRule.weight || 100}
              disabled={isGraded}
              onChange={handleScoreInput}
              onBlur={handleScoreBlur}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-600 font-medium">{t('评语')}</Label>
            <Textarea
              placeholder={t('请输入评分说明或改进建议...')}
              value={localComment}
              onChange={(e) => setLocalComment(e.target.value)}
              onBlur={() => onChange(scoreRule.id, score, localComment)}
              disabled={isGraded}
              rows={2}
              className="text-sm resize-none bg-white border-slate-300 focus-visible:ring-primary"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================================================
// 现场问答抽题卡片
// ============================================================================

function DrawnQuestionCard({
  question,
  index,
  oralAnswer,
  isGraded,
  onOralAnswerChange,
}: {
  question: any
  index: number
  oralAnswer: string
  isGraded: boolean
  onOralAnswerChange: (questionId: string, oralAnswer: string) => void
}) {
  const t = useT()
  const [value, setValue] = useState(oralAnswer)

  const isSimpleQuestion = !question.content && !!question.name
  const questionContent = question.content || question.name || ''
  const questionType = question.type || 'short_answer'

  const getAnswerLabel = () => {
    if (question.type === 'judge' || question.type === 'judgment') {
      return question.answer === 'true' ? t('正确') : t('错误')
    }
    if (Array.isArray(question.answer)) return question.answer.join('、')
    return question.answer || '-'
  }

  return (
    <Card className="border-slate-200">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge
            variant="outline"
            className="text-[10px] h-5 px-1.5 bg-slate-50 text-slate-600 border-slate-200"
          >
            {t('第 {n} 题', { n: index + 1 })}
          </Badge>
          {!isSimpleQuestion && (
            <Badge variant="outline" className="text-[10px] h-5 px-1.5">
              {t(questionTypeLabels[questionType] || questionType)}
            </Badge>
          )}
        </div>
        <p className="text-sm text-gray-800 leading-relaxed font-medium">{questionContent}</p>
        {question.description && (
          <p className="text-xs text-gray-500 leading-relaxed">{question.description}</p>
        )}
        {question.options && question.options.length > 0 && (
          <div className="space-y-1.5">
            {question.options.map((opt: string, idx: number) => {
              const isCorrect = Array.isArray(question.answer)
                ? question.answer.includes(opt)
                : question.answer === opt
              return (
                <div
                  key={idx}
                  className={cn(
                    'flex items-center gap-3 text-sm px-3 py-2 rounded-lg border',
                    isCorrect
                      ? 'bg-green-50 border-green-200 text-green-700'
                      : 'bg-gray-50/50 border-gray-100 text-gray-600',
                  )}
                >
                  <span
                    className={cn(
                      'text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-md shrink-0',
                      isCorrect
                        ? 'bg-green-500 text-white'
                        : 'bg-white text-gray-500 border border-gray-200',
                    )}
                  >
                    {String.fromCharCode(65 + idx)}
                  </span>
                  <span className="flex-1">{opt}</span>
                  {isCorrect && <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />}
                </div>
              )
            })}
          </div>
        )}
        <div className="bg-green-50 rounded-lg border border-green-100 p-3">
          <div className="text-xs text-green-700 font-medium mb-1.5">{t('参考答案')}</div>
          <p className="text-sm text-green-700 leading-relaxed">{getAnswerLabel()}</p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-gray-500">{t('学生口头回答记录（教师现场记录）')}</Label>
          <Textarea
            placeholder={t('请记录学生现场口头回答的要点...')}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={() => onOralAnswerChange(question.id, value)}
            disabled={isGraded}
            rows={3}
            className="text-sm resize-none border-slate-300 focus-visible:ring-primary"
          />
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================================================
// 附件预览
// ============================================================================

function AttachmentPreview({
  attachment,
  onClose,
}: {
  attachment: { name: string; url: string; type?: string }
  onClose: () => void
}) {
  const t = useT()
  return (
    <Dialog open={!!attachment} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl w-[90vw] max-h-[90vh] p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-4 py-3 border-b shrink-0">
          <DialogTitle className="text-sm font-medium">{attachment.name}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-auto p-4 bg-gray-50 min-h-[300px] max-h-[calc(90vh-120px)]">
          {attachment.type?.startsWith('image') ? (
            // 附件弹窗中的图片需要展示原始尺寸，无法预先确定宽高，故保留 img
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={attachment.url}
              alt={attachment.name}
              className="max-w-full max-h-[70vh] rounded-lg shadow-sm border"
            />
          ) : attachment.type?.startsWith('video') ? (
            <video
              src={attachment.url}
              controls
              className="max-w-full max-h-[70vh] rounded-lg shadow-sm border"
            />
          ) : (
            <div className="text-center py-12 text-gray-400">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">{t('该类型文件暂不支持在线预览')}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================================
// 主页面
// ============================================================================

export default function GradingDetailPage() {
  const params = useParams()
  const t = useT()
  const id = params.id as string

  const [result, setResult] = useState<SceneEvaluationResult | null>(null)
  const [methodConfig, setMethodConfig] = useState<TaskEvaluationMethod | null>(null)
  const [task, setTask] = useState<any>(null)
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)
  const [exam, setExam] = useState<any>(null)
  const [examResult, setExamResult] = useState<any>(null)
  const [rdQuestions, setRdQuestions] = useState<any[]>([])
  const [rdQuestionPool, setRdQuestionPool] = useState<any[]>([])
  const [questionFilter, setQuestionFilter] = useState<'all' | 'pending'>('all')
  const [allExpanded, setAllExpanded] = useState(false)
  const [previewAttachment, setPreviewAttachment] = useState<{
    name: string
    url: string
    type?: string
  } | null>(null)

  const [pointScores, setPointScores] = useState<Record<string, number>>({})
  const [pointComments, setPointComments] = useState<Record<string, string>>({})
  // 已提交过评分（含 0 分）的题目/评价点 id，用于区分“未评分”与“评 0 分”
  const [gradedIds, setGradedIds] = useState<Set<string>>(new Set())
  const [oralAnswers, setOralAnswers] = useState<Record<string, string>>({})
  const [selectedReviewSteps, setSelectedReviewSteps] = useState<Record<string, boolean>>({})
  const [comment, setComment] = useState('')

  useEffect(() => {
    if (!id) return
    const load = async () => {
      try {
        const res = await evaluationResultApi.get(id)
        setResult(res)
        setComment(res.comment || '')

        const eps = (res.evalPointScores as Record<string, any>) || {}
        const scores: Record<string, number> = {}
        const comments: Record<string, string> = {}
        Object.entries(eps).forEach(([k, v]) => {
          if (typeof v === 'number') {
            scores[k] = v
          } else if (v && typeof v === 'object') {
            scores[k] = typeof v.score === 'number' ? v.score : 0
            comments[k] = v.comment || ''
          }
        })
        setPointScores(scores)
        setPointComments(comments)
        if (Object.keys(eps).length > 0) setGradedIds(new Set(Object.keys(eps)))

        const dq = (res.drawnQuestions as Record<string, any>) || {}
        const oral: Record<string, string> = {}
        Object.entries(dq).forEach(([k, v]) => {
          oral[k] = typeof v === 'string' ? v : v?.oralAnswer || ''
        })
        setOralAnswers(oral)

        const completedSteps = (res.subjectiveContent as Record<string, any>)?.reviewSteps || []
        const stepSelected: Record<string, boolean> = {}
        completedSteps.forEach((s: any) => {
          if (s.stepId) stepSelected[s.stepId] = true
        })
        setSelectedReviewSteps(stepSelected)

        if (res.status === 'evaluated') setSaved(true)

        const [taskData, mRes] = await Promise.all([
          taskApi.get(res.taskId).catch(() => null),
          taskEvaluationApi.listMethods(res.taskId).catch(() => ({ methods: [] })),
        ])
        setTask(taskData)
        const cfg =
          mRes.methods.find((m: TaskEvaluationMethod) => m.methodKey === res.methodKey) || null
        setMethodConfig(cfg)

        if (cfg && ['paper', 'question_bank', 'quiz'].includes(res.methodKey)) {
          const examId = cfg.resourceConfig?.paperId || cfg.resourceConfig?.examId
          const usageId = cfg.resourceConfig?.usageId
          if (examId) {
            try {
              const [examData, usageRes] = await Promise.all([
                examApi.get(examId),
                examUsageApi.list({ examId, limit: 50 }),
              ])
              if (cfg.resourceConfig?.questionScores) {
                const scores = cfg.resourceConfig.questionScores as Record<string, number>
                examData.questions = (examData.questions || []).map((q: any) => ({
                  ...q,
                  score: scores[q.questionId] ?? scores[q.id] ?? q.score ?? 0,
                }))
              }
              setExam(examData)
              const usage = usageRes.items.find((u: any) => u.id === usageId) || usageRes.items[0]
              if (usage) {
                const erRes = await examResultApi.list({ usageId: usage.id, limit: 500 })
                const found = (erRes.items || []).find((r: any) => r.userId === res.evaluateeId)
                if (found) setExamResult(found)
              }
            } catch {
              /* ignore */
            }
          }
        }

        if (res.methodKey === 'random_draw') {
          try {
            const rdRes = await randomDrawQuestionApi.list({ limit: 9999 })
            const all = rdRes.items || []
            setRdQuestionPool(all)
            const drawnMap = (res.drawnQuestions || {}) as Record<string, any>
            const drawnIds = Object.keys(drawnMap).filter(
              (k) => drawnMap[k] && typeof drawnMap[k] === 'object',
            )
            const selectedIds =
              drawnIds.length > 0 ? drawnIds : cfg?.resourceConfig?.selectedQuestionIds || []
            const selected = (
              selectedIds.length > 0
                ? selectedIds.map((sid: string) => all.find((q: any) => q.id === sid))
                : all
            ).filter(Boolean) as any[]
            setRdQuestions(selected)
          } catch {
            /* ignore */
          }
        }

        const u = await userManagementApi.list({ limit: 1000 }).catch(() => ({ items: [] }))
        const found = (u.items || []).find((x: any) => x.id === res.evaluateeId)
        setUser(found || null)
      } catch (e) {
        reportError(e, '加载评分详情')
        setLoadError(e instanceof Error ? e.message : t('加载失败'))
      }
      setLoading(false)
    }
    load()
  }, [id, t])

  const methodKey = result?.methodKey || ''
  const methodName = EVAL_METHOD_LABELS_GRADING[methodKey] || methodKey
  const isExamMethod = ['paper', 'question_bank', 'quiz'].includes(methodKey)
  const isRandomDraw = methodKey === 'random_draw'
  const isReview = methodKey === 'review'
  const isOutcome = methodKey === 'outcome'
  const isHomework = methodKey === 'homework'
  const isMaterialMethod = isReview || isOutcome || isHomework

  const evalPoints = useMemo(() => methodConfig?.evalPoints || [], [methodConfig])
  const scoreRules = useMemo(() => methodConfig?.scoreRules || [], [methodConfig])
  const isScoreRuleMode = methodConfig?.standardMode === 'score_rule' || scoreRules.length > 0
  const reviewSteps = useMemo(() => methodConfig?.reviewSteps || [], [methodConfig])
  const subjectiveContent = useMemo(
    () => (result?.subjectiveContent || {}) as Record<string, any>,
    [result],
  )
  const objectiveAnswers = useMemo(
    () => (result?.objectiveAnswers || {}) as Record<string, any>,
    [result],
  )
  const examQuestions = useMemo(() => exam?.questions || [], [exam])

  // 客观题自动分以提交时存储的客观答案为唯一依据，避免读取考试结果中的
  // score（该值可能被其他测评方式串用同步覆盖，也可能已包含教师评分导致重复累加）。
  // 仅当试卷题目加载失败时才回退使用考试结果分数。
  const examAutoTotal = useMemo(() => {
    const fromAnswers = examQuestions.reduce(
      (sum: number, q: any) => sum + getAutoScore(q, objectiveAnswers[q.id]),
      0,
    )
    if (examQuestions.length > 0) {
      return fromAnswers
    }
    if (examResult && typeof examResult.score === 'number') {
      return examResult.score
    }
    return 0
  }, [examQuestions, objectiveAnswers, examResult])

  const examSubjectiveTotal = useMemo(() => {
    return examQuestions.reduce((sum: number, q: any) => {
      if (isAutoQuestion(q)) return sum
      return sum + (pointScores[q.id] ?? 0)
    }, 0)
  }, [examQuestions, pointScores])

  const examTotal = examAutoTotal + examSubjectiveTotal
  const examMaxScore =
    examResult?.totalScore ??
    exam?.totalScore ??
    examQuestions.reduce((sum: number, q: any) => sum + (q.score || 0), 0)

  const evalPointTotal = useMemo(() => {
    if (isScoreRuleMode) {
      return scoreRules.reduce((sum, sr) => sum + (pointScores[sr.id] ?? 0), 0)
    }
    return evalPoints.reduce((sum, ep) => sum + (pointScores[ep.id] ?? 0), 0)
  }, [isScoreRuleMode, scoreRules, evalPoints, pointScores])

  const evalPointMaxTotal = useMemo(() => {
    if (isScoreRuleMode) {
      return scoreRules.reduce((sum, sr) => sum + (sr.weight || 0), 0)
    }
    return evalPoints.reduce((sum, ep) => sum + (ep.weight || 0), 0)
  }, [isScoreRuleMode, scoreRules, evalPoints])

  const computedTotal = isExamMethod ? examTotal : evalPointTotal
  const maxScore = (isExamMethod ? examMaxScore : evalPointMaxTotal) || result?.maxScore || 100

  const allScored = isExamMethod
    ? examQuestions
        .filter((q: any) => !isAutoQuestion(q))
        .every((q: any) => gradedIds.has(q.id) || q.score === 0)
    : isScoreRuleMode
      ? scoreRules.length === 0 || scoreRules.every((sr) => gradedIds.has(sr.id) || sr.weight === 0)
      : isReview
        ? (evalPoints.length === 0 ||
            evalPoints.every((ep) => gradedIds.has(ep.id) || ep.weight === 0)) &&
          (reviewSteps.length === 0 || Object.values(selectedReviewSteps).some(Boolean))
        : evalPoints.length === 0 ||
          evalPoints.every((ep) => gradedIds.has(ep.id) || ep.weight === 0)

  const pendingQuestions = useMemo(() => {
    return examQuestions.filter(
      (q: any) => !isAutoQuestion(q) && !gradedIds.has(q.id) && (pointScores[q.id] ?? 0) === 0,
    )
  }, [examQuestions, pointScores, gradedIds])

  const displayedQuestions = useMemo(() => {
    return questionFilter === 'all' ? examQuestions : pendingQuestions
  }, [questionFilter, examQuestions, pendingQuestions])

  const handleScoreChange = (id: string, score: number) => {
    setPointScores((prev) => ({ ...prev, [id]: score }))
    setGradedIds((prev) => new Set(prev).add(id))
  }

  const handleEvalPointChange = (id: string, score: number, comment: string) => {
    setPointScores((prev) => ({ ...prev, [id]: score }))
    setPointComments((prev) => ({ ...prev, [id]: comment }))
    setGradedIds((prev) => new Set(prev).add(id))
  }

  const handleOralAnswerChange = (questionId: string, oralAnswer: string) => {
    setOralAnswers((prev) => ({ ...prev, [questionId]: oralAnswer }))
  }

  const handleSave = async () => {
    if (!result) return
    setSaving(true)
    try {
      const evalPointScores: Record<string, any> = {}
      Object.entries(pointScores).forEach(([k, v]) => {
        evalPointScores[k] = pointComments[k] ? { score: v, comment: pointComments[k] } : v
      })

      const payload: any = {
        // 总分不超过满分，防止异常累加导致超 100
        score: Math.min(computedTotal, maxScore),
        comment: comment || undefined,
        evalPointScores,
      }
      if (isRandomDraw) {
        const drawnQuestions: Record<string, any> = {}
        rdQuestions.forEach((q) => {
          drawnQuestions[q.id] = { oralAnswer: oralAnswers[q.id] || '' }
        })
        payload.drawnQuestions = drawnQuestions
      }

      if (isReview) {
        const existingSteps = ((result.subjectiveContent as Record<string, any>)?.reviewSteps ||
          []) as any[]
        const newSteps = reviewSteps
          .filter(
            (s) =>
              s.enabled &&
              selectedReviewSteps[s.id] &&
              !existingSteps.some((es: any) => es.stepId === s.id),
          )
          .map((s) => ({ stepId: s.id, completedAt: new Date().toISOString() }))
        payload.subjectiveContent = {
          ...((result.subjectiveContent as Record<string, any>) || {}),
          reviewSteps: [...existingSteps, ...newSteps],
        }
      }

      await evaluationResultApi.grade(result.id, payload)
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

  const renderLeftPanel = () => {
    if (isExamMethod) return null

    if (isRandomDraw) {
      return (
        <div className="flex-1 flex flex-col border-r bg-white min-w-0">
          <div className="px-4 py-3 border-b flex items-center justify-between shrink-0 bg-white sticky top-0 z-10">
            <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <FileText className="h-4 w-4 text-purple-500" />
              {t('现场问答题')}
            </h2>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                {t('{n} 题', { n: rdQuestions.length })}
              </Badge>
              {!saved && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const poolIds = methodConfig?.resourceConfig?.selectedQuestionIds || []
                    const drawCount = Math.max(
                      1,
                      Math.min(
                        poolIds.length,
                        methodConfig?.resourceConfig?.drawCount || poolIds.length || 1,
                      ),
                    )
                    const shuffled = [...poolIds].sort(() => Math.random() - 0.5)
                    const selectedIds = shuffled.slice(0, drawCount)
                    const selected = selectedIds
                      .map((sid: string) => rdQuestionPool.find((q: any) => q.id === sid))
                      .filter(Boolean) as any[]
                    setRdQuestions(selected)
                  }}
                  disabled={!methodConfig?.resourceConfig?.selectedQuestionIds?.length}
                >
                  {t('现场抽题')}
                </Button>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 pb-24 space-y-3">
            {rdQuestions.length === 0 && (
              <div className="text-center py-12 text-gray-400 text-sm bg-gray-50/50 rounded-lg border border-dashed">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
                {t('点击右上角「现场抽题」按钮，从题库中抽取本次问答题目')}
              </div>
            )}
            {rdQuestions.map((q, idx) => (
              <DrawnQuestionCard
                key={`${q.id}-${oralAnswers[q.id] || ''}`}
                question={q}
                index={idx}
                oralAnswer={oralAnswers[q.id] || ''}
                isGraded={saved}
                onOralAnswerChange={handleOralAnswerChange}
              />
            ))}
          </div>
        </div>
      )
    }

    if (isMaterialMethod) {
      return (
        <div className="flex-1 flex flex-col border-r bg-white min-w-0">
          <div className="px-4 py-3 border-b flex items-center justify-between shrink-0 bg-white sticky top-0 z-10">
            <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Package className="h-4 w-4 text-amber-500" />
              {isReview ? t('现场评审材料') : isOutcome ? t('成果材料') : t('作业材料')}
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto p-4 pb-24 space-y-4">
            {isReview && reviewSteps.length > 0 && (
              <Card className="border-slate-200">
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-xs font-medium text-gray-500">
                    {t('评审步骤（选择本次评价的步骤）')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 pt-0 space-y-2">
                  {reviewSteps
                    .filter((s) => s.enabled)
                    .map((step, idx) => {
                      const completed = (subjectiveContent.reviewSteps || []).some(
                        (s: any) => s.stepId === step.id,
                      )
                      const selected = !!selectedReviewSteps[step.id] || completed
                      return (
                        <label
                          key={step.id}
                          className={cn(
                            'flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                            selected
                              ? 'bg-green-50 border-green-200'
                              : 'bg-white border-gray-200 hover:border-primary/30',
                          )}
                        >
                          <div className="shrink-0 mt-0.5">
                            <div
                              className={cn(
                                'w-5 h-5 rounded-full flex items-center justify-center text-xs font-semibold',
                                selected
                                  ? 'bg-green-500 text-white'
                                  : 'bg-gray-100 text-gray-500 border border-gray-200',
                              )}
                            >
                              {idx + 1}
                            </div>
                          </div>
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={selected}
                            disabled={saved || completed}
                            onChange={(e) =>
                              setSelectedReviewSteps((prev) => ({
                                ...prev,
                                [step.id]: e.target.checked,
                              }))
                            }
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800">{step.label}</p>
                            {step.description && (
                              <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                                {step.description}
                              </p>
                            )}
                          </div>
                          {completed && (
                            <StatusBadge
                              status="已完成"
                              className="text-[10px] h-5 px-1.5 border shrink-0"
                            />
                          )}
                        </label>
                      )
                    })}
                </CardContent>
              </Card>
            )}

            {subjectiveContent.pointSelfEval &&
              Object.keys(subjectiveContent.pointSelfEval).length > 0 &&
              evalPoints.length > 0 && (
                <Card className="border-slate-200">
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="text-xs font-medium text-gray-500">
                      {t('学生按评价点自评')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 pt-0 space-y-2">
                    {evalPoints.map((ep) => {
                      const selfEval = subjectiveContent.pointSelfEval?.[ep.id]
                      if (!selfEval) return null
                      return (
                        <div
                          key={ep.id}
                          className="bg-slate-50 rounded-lg border border-slate-100 p-3"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-gray-800">{ep.name}</span>
                            <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                              {t('{n} 分', { n: ep.weight || 0 })}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                            {selfEval}
                          </p>
                        </div>
                      )
                    })}
                  </CardContent>
                </Card>
              )}

            {subjectiveContent.text && (
              <Card className="border-slate-200">
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-xs font-medium text-gray-500">
                    {t('学生提交内容')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 pt-0">
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed bg-slate-50 rounded-lg border border-slate-100 p-3">
                    {subjectiveContent.text}
                  </pre>
                </CardContent>
              </Card>
            )}
            {subjectiveContent.files &&
              Array.isArray(subjectiveContent.files) &&
              subjectiveContent.files.length > 0 && (
                <Card className="border-slate-200">
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="text-xs font-medium text-gray-500">{t('附件')}</CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 pt-0 space-y-2">
                    {subjectiveContent.files.map((f: any, i: number) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg border text-sm group hover:border-primary/30 transition-colors relative"
                      >
                        <Package className="h-4 w-4 text-gray-400 shrink-0" />
                        <span className="text-gray-700 flex-1 min-w-0 truncate">{f.name}</span>
                        <HoverActionBar>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() =>
                              setPreviewAttachment({ name: f.name, url: f.url, type: f.type })
                            }
                          >
                            <Eye className="h-3.5 w-3.5 mr-1" />
                            {t('预览')}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => {
                              const a = document.createElement('a')
                              a.href = f.url
                              a.download = f.name
                              a.click()
                            }}
                          >
                            <Download className="h-3.5 w-3.5 mr-1" />
                            {t('下载')}
                          </Button>
                        </HoverActionBar>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            {!subjectiveContent.text &&
              (!subjectiveContent.files || subjectiveContent.files.length === 0) && (
                <div className="text-center py-12 text-gray-400 text-sm bg-gray-50/50 rounded-lg border border-dashed">
                  <Package className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  {t('学生未提交在线材料')}
                </div>
              )}
          </div>
        </div>
      )
    }

    return null
  }

  const renderRightPanel = () => {
    if (isExamMethod) return null

    return (
      <div className="flex-1 flex flex-col bg-slate-50/50 min-w-0">
        <div className="px-4 py-3 bg-white border-b flex items-center justify-between shrink-0 sticky top-0 z-10">
          <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Star className="h-4 w-4 text-amber-500" />
            {isRandomDraw || isReview ? t('评价点评分') : isHomework ? t('评价标准') : t('评价点评分')}
          </h2>
          <div className="text-sm text-gray-600">
            {t('已评分：')}
            <span className="font-semibold text-gray-900">
              {evalPointTotal} / {evalPointMaxTotal || 100}
            </span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 pb-24 space-y-3">
          {isScoreRuleMode ? (
            scoreRules.length > 0 ? (
              scoreRules.map((sr) => (
                <ScoreRuleGradingCard
                  key={sr.id}
                  scoreRule={sr}
                  score={pointScores[sr.id] ?? 0}
                  comment={pointComments[sr.id] ?? ''}
                  isGraded={saved}
                  onChange={handleEvalPointChange}
                />
              ))
            ) : (
              <div className="text-center py-12 text-gray-400 bg-white rounded-lg border border-dashed">
                <Star className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">{t('该任务未配置评分项')}</p>
              </div>
            )
          ) : evalPoints.length > 0 ? (
            evalPoints.map((ep) => (
              <EvalPointGradingCard
                key={ep.id}
                evalPoint={ep}
                score={pointScores[ep.id] ?? 0}
                comment={pointComments[ep.id] ?? ''}
                isGraded={saved}
                onChange={handleEvalPointChange}
              />
            ))
          ) : (
            <div className="text-center py-12 text-gray-400 bg-white rounded-lg border border-dashed">
              <Star className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">{t('该任务未配置评价点')}</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="h-[calc(100vh-3.5rem-3rem)] flex flex-col bg-gray-50">
        {/* 顶部导航 */}
        <div className="bg-white border-b px-4 py-2 flex items-center gap-3 shrink-0">
          <Button variant="ghost" size="sm" asChild className="h-8">
            <Link
              href={
                result?.sceneId
                  ? `/evaluation/scene-results?sceneId=${result.sceneId}`
                  : '/evaluation/scene-results'
              }
            >
              <ArrowLeft className="mr-1 h-4 w-4" />
              {t('返回')}
            </Link>
          </Button>
          <Separator orientation="vertical" className="h-4" />
          <span className="text-sm text-gray-500 truncate">{t('评分详情')}</span>
        </div>

        <StudentInfoCard
          user={user}
          result={result}
          task={task}
          methodName={methodName}
          methodKey={methodKey}
          computedTotal={computedTotal}
          maxScore={maxScore}
          saved={saved}
        />

        {/* 主内容 */}
        <div className="flex-1 overflow-hidden">
          {isExamMethod ? (
            <div className="h-full flex flex-col">
              {/* 顶部得分汇总 */}
              <div className="px-4 py-3 bg-white border-b shrink-0">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center">
                      <FileText className="h-5 w-5 text-blue-500" />
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold text-gray-800">
                        {t('{name}评分', { name: t(methodName) })}
                      </h2>
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
                      max={maxScore}
                      value={computedTotal}
                      disabled
                      className="w-20 text-right h-9 text-lg font-bold text-blue-600 border-transparent bg-transparent focus-visible:ring-0 px-0"
                    />
                    <span className="text-lg text-gray-400 font-medium">/ {maxScore}</span>
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
                    {examSubjectiveTotal === 0 && !saved && (
                      <Badge
                        variant="outline"
                        className="text-[10px] h-4 px-1 text-amber-600 border-amber-200 bg-white"
                      >
                        {t('待评分')}
                      </Badge>
                    )}
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
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-gray-500 hover:text-gray-700"
                    onClick={() => setAllExpanded((prev) => !prev)}
                  >
                    {allExpanded ? t('全部收起') : t('全部展开')}
                  </Button>
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
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex">
              {renderLeftPanel()}
              {renderRightPanel()}
            </div>
          )}
        </div>

        {previewAttachment && (
          <AttachmentPreview
            attachment={previewAttachment}
            onClose={() => setPreviewAttachment(null)}
          />
        )}
      </div>

      {/* 底部操作栏 - 始终固定在视口底部 */}
      <div className="fixed bottom-0 left-0 right-0 lg:left-56 bg-white border-t shadow-[0_-2px_10px_rgba(0,0,0,0.05)] px-4 py-3 z-50">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 shrink-0 min-w-[140px]">
            <span className="text-sm text-gray-500">{t('最终得分')}</span>
            <span
              className={cn(
                'text-3xl font-bold',
                saved || computedTotal > 0 ? 'text-green-600' : 'text-gray-300',
              )}
            >
              {saved || computedTotal > 0 ? computedTotal : '-'}
            </span>
            <span className="text-sm text-gray-400">/ {maxScore}</span>
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
          {saved && result.gradedAt && (
            <div className="text-xs text-gray-400 shrink-0 text-right">
              <div>{t('评分时间')}</div>
              <div>{new Date(result.gradedAt).toLocaleString('zh-CN')}</div>
            </div>
          )}
          <Button variant="outline" size="sm" asChild className="shrink-0 h-9">
            <Link
              href={
                result?.sceneId
                  ? `/evaluation/scene-results?sceneId=${result.sceneId}`
                  : '/evaluation/scene-results'
              }
            >
              {t('取消')}
            </Link>
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
