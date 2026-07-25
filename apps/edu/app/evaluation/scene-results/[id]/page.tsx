"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
  FileText,
  Package,
  Save,
  Star,
  XCircle,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import {
  evaluationResultApi,
  taskEvaluationApi,
  taskApi,
  userManagementApi,
  examApi,
  examUsageApi,
  examResultApi,
  randomDrawQuestionApi,
} from "@/lib/api"
import type { SceneEvaluationResult, TaskEvaluationMethod, TaskEvalPoint } from "@/lib/types"

const evalMethodLabels: Record<string, string> = {
  random_draw: "现场问答",
  review: "现场评审",
  paper: "试卷",
  question_bank: "题库",
  outcome: "成果评价",
  homework: "作业",
  quiz: "随堂测",
}

const questionTypeLabels: Record<string, string> = {
  single: "单选",
  multiple: "多选",
  judge: "判断",
  judgment: "判断",
  fill: "填空",
  essay: "问答",
  short_answer: "简答",
}

function toStringArray(v: any): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x).toLowerCase())
  if (typeof v === "string") return [v.toLowerCase()]
  return []
}

function isAnswerCorrect(q: any, ans: any): boolean {
  const correct = toStringArray(q.answer)
  const type = q.type
  if (type === "single") {
    const s = typeof ans === "string" ? ans.toLowerCase() : ""
    return correct.length > 0 && s === correct[0]
  }
  if (type === "multiple") {
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
  if (type === "judge" || type === "judgment") {
    const s = typeof ans === "string" ? ans.toLowerCase().trim() : ""
    if (correct.length === 0) return false
    const c = correct[0]
    return s === c || (s === "正确" && c === "true") || (s === "错误" && c === "false")
  }
  return false
}

function getAutoScore(q: any, ans: any): number {
  const type = q.type
  if (type === "single" || type === "multiple") return isAnswerCorrect(q, ans) ? q.score || 0 : 0
  if (type === "judge" || type === "judgment") return isAnswerCorrect(q, ans) ? q.score || 0 : 0
  return 0
}

function isAutoQuestion(q: any): boolean {
  const type = q.type
  return type === "single" || type === "multiple" || type === "judge" || type === "judgment"
}

function getAnswerLabel(ans: any): string {
  if (Array.isArray(ans)) return ans.join("、")
  if (typeof ans === "string") return ans
  return "未作答"
}

// ============================================================================
// 客观题/主观题评分卡片
// ============================================================================

function QuestionGradingCard({
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
  const [localScore, setLocalScore] = useState(score.toString())
  const [expanded, setExpanded] = useState(!isAutoQuestion(question))

  useEffect(() => {
    setLocalScore(score.toString())
  }, [score])

  const handleBlur = () => {
    const num = parseFloat(localScore)
    const max = question.score || 0
    if (!isNaN(num) && num >= 0 && num <= max) {
      onScoreChange(question.id, num)
    } else {
      setLocalScore(score.toString())
    }
  }

  const auto = isAutoQuestion(question)
  const correct = isAnswerCorrect(question, answer)
  const autoScore = auto ? getAutoScore(question, answer) : 0

  return (
    <Card className={cn("border-slate-200", !auto && "border-amber-200")}>
      <CardContent className="p-0">
        <div
          className={cn(
            "flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors",
            !auto ? "bg-amber-50/40 hover:bg-amber-50/60" : "hover:bg-gray-50/50"
          )}
          onClick={() => setExpanded(!expanded)}
        >
          <Badge
            variant="outline"
            className={cn("text-xs shrink-0", !auto && "border-amber-300 text-amber-700")}
          >
            {questionTypeLabels[question.type] || question.type}
          </Badge>
          <span className="text-xs text-gray-400 shrink-0">第 {index + 1} 题</span>
          <span className="text-sm font-medium text-gray-800 flex-1 truncate">
            {question.content}
          </span>
          <div className="flex items-center gap-2 shrink-0">
            {!auto ? (
              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <Input
                  type="number"
                  min={0}
                  max={question.score || 0}
                  step={0.5}
                  value={localScore}
                  onChange={(e) => setLocalScore(e.target.value)}
                  onBlur={handleBlur}
                  disabled={isGraded}
                  className="w-16 text-right h-8 text-sm font-semibold border-amber-300 focus-visible:ring-amber-400"
                />
                <span className="text-xs text-gray-400">/ {question.score || 0}</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium text-gray-700">{autoScore}</span>
                <span className="text-xs text-gray-400">/ {question.score || 0}</span>
                {correct ? (
                  <Badge
                    variant="outline"
                    className="bg-green-50 text-green-600 border-green-200 text-[10px] px-1 py-0 h-5"
                  >
                    <CheckCircle2 className="h-3 w-3 mr-0.5" />
                    正确
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="bg-red-50 text-red-600 border-red-200 text-[10px] px-1 py-0 h-5"
                  >
                    <XCircle className="h-3 w-3 mr-0.5" />
                    错误
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
          <div className="px-4 pb-4 pt-1 border-t border-gray-100 space-y-3">
            <p className="text-sm text-gray-800 leading-relaxed">{question.content}</p>

            {question.options && question.options.length > 0 && (
              <div className="space-y-1.5">
                {question.options.map((opt: string, idx: number) => {
                  const optLabel = String.fromCharCode(65 + idx)
                  const isSelected = Array.isArray(answer)
                    ? answer.includes(opt)
                    : answer === opt
                  const isCorrect = Array.isArray(question.answer)
                    ? question.answer.includes(opt)
                    : question.answer === opt
                  return (
                    <div
                      key={idx}
                      className={cn(
                        "flex items-center gap-2 text-sm px-3 py-2 rounded-md",
                        isCorrect
                          ? "bg-green-50 text-green-700 border border-green-200"
                          : isSelected && !isCorrect
                            ? "bg-red-50 text-red-700 border border-red-200"
                            : "text-gray-600"
                      )}
                    >
                      <span
                        className={cn(
                          "w-5 h-5 flex items-center justify-center rounded text-xs font-medium",
                          isCorrect
                            ? "bg-green-500 text-white"
                            : isSelected && !isCorrect
                              ? "bg-red-500 text-white"
                              : "bg-gray-100 text-gray-500"
                        )}
                      >
                        {optLabel}
                      </span>
                      <span>{opt}</span>
                      {isCorrect && <CheckCircle2 className="h-3.5 w-3.5 text-green-500 ml-auto" />}
                      {isSelected && !isCorrect && (
                        <XCircle className="h-3.5 w-3.5 text-red-500 ml-auto" />
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {!auto && (
              <div className="space-y-2">
                <div className="bg-amber-50/50 rounded-lg border border-amber-100 p-3">
                  <div className="text-xs text-amber-700 font-medium mb-1">学生答案</div>
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {getAnswerLabel(answer)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">教师评分</span>
                  <Input
                    type="number"
                    min={0}
                    max={question.score || 0}
                    step={0.5}
                    value={localScore}
                    onChange={(e) => setLocalScore(e.target.value)}
                    onBlur={handleBlur}
                    disabled={isGraded}
                    className="w-20 text-right h-8 text-sm"
                  />
                  <span className="text-xs text-gray-400">/ {question.score || 0}</span>
                </div>
              </div>
            )}

            {auto && (
              <div className="flex items-center gap-4 pt-1 bg-gray-50 rounded-lg px-3 py-2">
                <div className="text-sm">
                  <span className="text-gray-500">学生答案：</span>
                  <span className={correct ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                    {getAnswerLabel(answer)}
                  </span>
                </div>
                <div className="text-sm">
                  <span className="text-gray-500">正确答案：</span>
                  <span className="text-green-600 font-medium">{getAnswerLabel(question.answer)}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ============================================================================
// 评价点评分卡片
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
  const [localScore, setLocalScore] = useState(score.toString())
  const [localComment, setLocalComment] = useState(comment)

  useEffect(() => {
    setLocalScore(score.toString())
  }, [score])

  const handleScoreBlur = () => {
    const num = parseFloat(localScore)
    const max = evalPoint.weight || 0
    if (!isNaN(num) && num >= 0 && num <= max) {
      onChange(evalPoint.id, num, localComment)
    } else {
      setLocalScore(score.toString())
    }
  }

  return (
    <Card className="border-slate-200">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-gray-800 text-sm">{evalPoint.name}</h4>
            {evalPoint.description && (
              <p className="text-xs text-gray-500 mt-0.5">{evalPoint.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-start gap-3 bg-amber-50/60 border border-amber-100 rounded-lg px-3 py-2.5">
          <div className="shrink-0">
            <Label className="text-xs text-amber-700 font-medium block mb-1">评分</Label>
            <div className="flex items-center gap-1">
              <Input
                type="number"
                min={0}
                max={evalPoint.weight || 100}
                step={0.5}
                value={localScore}
                onChange={(e) => setLocalScore(e.target.value)}
                onBlur={handleScoreBlur}
                disabled={isGraded}
                className="w-16 text-right h-9 text-sm font-semibold bg-white"
              />
              <span className="text-xs text-gray-500">/ {evalPoint.weight || 0}</span>
            </div>
          </div>
          <div className="flex-1">
            <Label className="text-xs text-amber-700 font-medium block mb-1">评语</Label>
            <Textarea
              placeholder="请输入评分说明或改进建议..."
              value={localComment}
              onChange={(e) => setLocalComment(e.target.value)}
              onBlur={() => onChange(evalPoint.id, parseFloat(localScore) || 0, localComment)}
              disabled={isGraded}
              rows={2}
              className="text-sm resize-none bg-white"
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
  const [value, setValue] = useState(oralAnswer)

  useEffect(() => {
    setValue(oralAnswer)
  }, [oralAnswer])

  const getAnswerLabel = () => {
    if (question.type === "judge" || question.type === "judgment") {
      return question.answer === "true" ? "正确" : "错误"
    }
    if (Array.isArray(question.answer)) return question.answer.join("、")
    return question.answer
  }

  return (
    <Card className="border-slate-200">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-xs bg-slate-50 text-slate-600 border-slate-200">
            第 {index + 1} 题
          </Badge>
          <Badge variant="outline" className="text-xs">
            {questionTypeLabels[question.type] || question.type}
          </Badge>
        </div>
        <p className="text-sm text-gray-800 leading-relaxed">{question.content}</p>
        {question.options && question.options.length > 0 && (
          <div className="space-y-1">
            {question.options.map((opt: string, idx: number) => {
              const isCorrect = Array.isArray(question.answer)
                ? question.answer.includes(opt)
                : question.answer === opt
              return (
                <div
                  key={idx}
                  className={cn(
                    "flex items-center gap-2 text-sm px-2.5 py-1.5 rounded border",
                    isCorrect
                      ? "bg-green-50 border-green-200 text-green-700"
                      : "bg-gray-50 border-gray-100 text-gray-600"
                  )}
                >
                  <span
                    className={cn(
                      "text-xs font-mono w-5 h-5 flex items-center justify-center rounded shrink-0",
                      isCorrect ? "bg-green-200 text-green-800" : "bg-gray-200 text-gray-500"
                    )}
                  >
                    {String.fromCharCode(65 + idx)}
                  </span>
                  <span>{opt}</span>
                  {isCorrect && <CheckCircle2 className="h-3.5 w-3.5 text-green-600 ml-auto shrink-0" />}
                </div>
              )
            })}
          </div>
        )}
        <div className="bg-green-50 rounded-lg border border-green-100 p-3">
          <div className="text-xs text-green-600 font-medium mb-1">参考答案</div>
          <p className="text-sm text-green-700 leading-relaxed">{getAnswerLabel()}</p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-gray-500">学生口头回答记录（教师现场记录）</Label>
          <Textarea
            placeholder="请记录学生现场口头回答的要点..."
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={() => onOralAnswerChange(question.id, value)}
            disabled={isGraded}
            rows={3}
            className="text-sm resize-none"
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
  return (
    <Dialog open={!!attachment} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl w-[90vw] max-h-[90vh] p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-4 py-3 border-b shrink-0">
          <DialogTitle className="text-sm font-medium">{attachment.name}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-auto p-4 bg-gray-50 min-h-[300px] max-h-[calc(90vh-120px)]">
          {attachment.type?.startsWith("image") ? (
            <img src={attachment.url} alt={attachment.name} className="max-w-full max-h-[70vh] rounded-lg shadow-sm border" />
          ) : attachment.type?.startsWith("video") ? (
            <video src={attachment.url} controls className="max-w-full max-h-[70vh] rounded-lg shadow-sm border" />
          ) : (
            <div className="text-center py-12 text-gray-400">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">该类型文件暂不支持在线预览</p>
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
  const id = params.id as string

  const [result, setResult] = useState<SceneEvaluationResult | null>(null)
  const [methodConfig, setMethodConfig] = useState<TaskEvaluationMethod | null>(null)
  const [task, setTask] = useState<any>(null)
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [exam, setExam] = useState<any>(null)
  const [examResult, setExamResult] = useState<any>(null)
  const [rdQuestions, setRdQuestions] = useState<any[]>([])
  const [questionFilter, setQuestionFilter] = useState<"all" | "pending">("all")
  const [previewAttachment, setPreviewAttachment] = useState<{ name: string; url: string; type?: string } | null>(null)

  const [pointScores, setPointScores] = useState<Record<string, number>>({})
  const [pointComments, setPointComments] = useState<Record<string, string>>({})
  const [oralAnswers, setOralAnswers] = useState<Record<string, string>>({})
  const [comment, setComment] = useState("")

  useEffect(() => {
    if (!id) return
    const load = async () => {
      try {
        const res = await evaluationResultApi.get(id)
        setResult(res)
        setComment(res.comment || "")

        const [taskData, mRes] = await Promise.all([
          taskApi.get(res.taskId).catch(() => null),
          taskEvaluationApi.listMethods(res.taskId).catch(() => ({ methods: [] })),
        ])
        setTask(taskData)
        const cfg = mRes.methods.find((m: TaskEvaluationMethod) => m.methodKey === res.methodKey) || null
        setMethodConfig(cfg)

        if (cfg && ["paper", "question_bank", "quiz"].includes(res.methodKey)) {
          const examId = cfg.resourceConfig?.paperId || cfg.resourceConfig?.examId
          const usageId = cfg.resourceConfig?.usageId
          if (examId) {
            try {
              const [examData, usageRes] = await Promise.all([
                examApi.get(examId),
                examUsageApi.list({ examId, limit: 50 }),
              ])
              setExam(examData)
              const usage = usageRes.items.find((u: any) => u.id === usageId) || usageRes.items[0]
              if (usage) {
                const erRes = await examResultApi.list({ usageId: usage.id, limit: 500 })
                const found = (erRes.items || []).find((r: any) => r.userId === res.evaluateeId)
                if (found) setExamResult(found)
              }
            } catch { /* ignore */ }
          }
        }

        if (res.methodKey === "random_draw") {
          try {
            const rdRes = await randomDrawQuestionApi.list({ limit: 9999 })
            const all = rdRes.items || []
            // Prefer the student's actually drawn questions; fall back to configured pool.
            const drawnMap = (res.drawnQuestions || {}) as Record<string, any>
            const drawnIds = Object.keys(drawnMap).filter((k) => drawnMap[k] && typeof drawnMap[k] === "object")
            const selectedIds = drawnIds.length > 0
              ? drawnIds
              : cfg?.resourceConfig?.selectedQuestionIds || []
            const selected = (selectedIds.length > 0
              ? selectedIds.map((sid: string) => all.find((q: any) => q.id === sid))
              : all
            ).filter(Boolean) as any[]
            setRdQuestions(selected)
            // Pre-fill oral answers saved in the result.
            const oral: Record<string, string> = {}
            Object.entries(drawnMap).forEach(([k, v]) => {
              oral[k] = typeof v === "string" ? v : v?.oralAnswer || ""
            })
            setOralAnswers(oral)
          } catch { /* ignore */ }
        }

        const u = await userManagementApi.list({ limit: 1000 }).catch(() => ({ items: [] }))
        const found = (u.items || []).find((x: any) => x.id === res.evaluateeId)
        setUser(found || null)
      } catch (e) { /* ignore */ }
      setLoading(false)
    }
    load()
  }, [id])

  // 初始化分数与口头回答
  useEffect(() => {
    if (!result) return
    const eps = (result.evalPointScores as Record<string, any>) || {}
    const scores: Record<string, number> = {}
    const comments: Record<string, string> = {}
    Object.entries(eps).forEach(([k, v]) => {
      if (typeof v === "number") {
        scores[k] = v
      } else if (v && typeof v === "object") {
        scores[k] = typeof v.score === "number" ? v.score : 0
        comments[k] = v.comment || ""
      }
    })
    setPointScores(scores)
    setPointComments(comments)

    const dq = (result.drawnQuestions as Record<string, any>) || {}
    const oral: Record<string, string> = {}
    Object.entries(dq).forEach(([k, v]) => {
      oral[k] = typeof v === "string" ? v : v?.oralAnswer || ""
    })
    setOralAnswers(oral)
    if (result.status === "evaluated") setSaved(true)
  }, [result])

  const methodKey = result?.methodKey || ""
  const methodName = evalMethodLabels[methodKey] || methodKey
  const isExamMethod = ["paper", "question_bank", "quiz"].includes(methodKey)
  const isRandomDraw = methodKey === "random_draw"
  const isReview = methodKey === "review"
  const isOutcome = methodKey === "outcome"
  const isHomework = methodKey === "homework"
  const isMaterialMethod = isReview || isOutcome || isHomework

  const evalPoints = useMemo(() => methodConfig?.evalPoints || [], [methodConfig])
  const reviewSteps = useMemo(() => methodConfig?.reviewSteps || [], [methodConfig])
  const subjectiveContent = useMemo(() => (result?.subjectiveContent || {}) as Record<string, any>, [result])
  const objectiveAnswers = useMemo(() => (result?.objectiveAnswers || {}) as Record<string, any>, [result])
  const examQuestions = useMemo(() => exam?.questions || [], [exam])

  // Prefer the original ExamResult score for objective questions; fall back to recomputing.
  const examAutoTotal = useMemo(() => {
    if (examResult && typeof examResult.score === "number") {
      return examResult.score
    }
    return examQuestions.reduce((sum: number, q: any) => sum + getAutoScore(q, objectiveAnswers[q.id]), 0)
  }, [examQuestions, objectiveAnswers, examResult])

  const examSubjectiveTotal = useMemo(() => {
    return examQuestions.reduce((sum: number, q: any) => {
      if (isAutoQuestion(q)) return sum
      return sum + (pointScores[q.id] ?? 0)
    }, 0)
  }, [examQuestions, pointScores])

  const examTotal = examAutoTotal + examSubjectiveTotal
  const examMaxScore = examResult?.totalScore ?? exam?.totalScore ?? examQuestions.reduce((sum: number, q: any) => sum + (q.score || 0), 0)

  const evalPointTotal = useMemo(() => {
    return evalPoints.reduce((sum, ep) => sum + (pointScores[ep.id] ?? 0), 0)
  }, [evalPoints, pointScores])

  const evalPointMaxTotal = useMemo(() => {
    return evalPoints.reduce((sum, ep) => sum + (ep.weight || 0), 0)
  }, [evalPoints])

  const computedTotal = isExamMethod ? examTotal : evalPointTotal
  const maxScore = isExamMethod ? examMaxScore : evalPointMaxTotal || result?.maxScore || 100

  const allScored = isExamMethod
    ? examQuestions.filter((q: any) => !isAutoQuestion(q)).every((q: any) => (pointScores[q.id] ?? 0) > 0 || q.score === 0)
    : evalPoints.length === 0 || evalPoints.every((ep) => (pointScores[ep.id] ?? 0) > 0 || ep.weight === 0)

  const handleScoreChange = (id: string, score: number) => {
    setPointScores((prev) => ({ ...prev, [id]: score }))
  }

  const handleEvalPointChange = (id: string, score: number, comment: string) => {
    setPointScores((prev) => ({ ...prev, [id]: score }))
    setPointComments((prev) => ({ ...prev, [id]: comment }))
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
        score: computedTotal,
        comment: comment || undefined,
        evalPointScores,
      }
      if (isRandomDraw) {
        const drawnQuestions: Record<string, any> = {}
        Object.entries(oralAnswers).forEach(([k, v]) => {
          if (v.trim()) drawnQuestions[k] = { oralAnswer: v }
        })
        payload.drawnQuestions = drawnQuestions
      }

      await evaluationResultApi.grade(result.id, payload)
      setSaved(true)
    } catch (e) { /* ignore */ }
    setSaving(false)
  }

  if (loading) return <div className="h-screen flex items-center justify-center text-gray-400">加载中...</div>
  if (!result) return <div className="h-screen flex items-center justify-center text-gray-400">记录不存在</div>

  const studentName = user?.name || result.evaluateeId || "未知"

  const renderLeftPanel = () => {
    if (isExamMethod) return null

    if (isRandomDraw) {
      return (
        <div className="w-1/2 flex flex-col border-r bg-white">
          <div className="px-4 py-2 border-b flex items-center justify-between shrink-0">
            <h2 className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <FileText className="h-4 w-4 text-amber-500" />
              抽题记录
            </h2>
            <span className="text-xs text-gray-400">{rdQuestions.length} 题</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {rdQuestions.length === 0 && (
              <div className="text-center py-8 text-gray-400 text-sm">未配置现场问答题</div>
            )}
            {rdQuestions.map((q, idx) => (
              <DrawnQuestionCard
                key={q.id}
                question={q}
                index={idx}
                oralAnswer={oralAnswers[q.id] || ""}
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
        <div className="w-1/2 flex flex-col border-r bg-white">
          <div className="px-4 py-2 border-b flex items-center justify-between shrink-0">
            <h2 className="text-sm font-medium text-gray-700">
              {isReview ? "现场评审材料" : isOutcome ? "成果材料" : "作业材料"}
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {isReview && reviewSteps.length > 0 && (
              <div className="px-4 py-3 border-b bg-gray-50/50 -mx-4 -mt-4 mb-4">
                <h3 className="text-xs font-medium text-gray-500 mb-2">评审步骤</h3>
                <div className="flex items-center">
                  {reviewSteps
                    .filter((s) => s.enabled)
                    .map((step, idx, arr) => {
                      const completed = (subjectiveContent.reviewSteps || []).some((s: any) => s.stepId === step.id)
                      return (
                        <div key={step.id} className="flex items-center flex-1">
                          <div className="flex flex-col items-center flex-1">
                            <div className={cn(
                              "w-7 h-7 rounded-full text-xs flex items-center justify-center border-2",
                              completed
                                ? "bg-green-100 text-green-600 border-green-300"
                                : "bg-primary/10 text-primary border-primary"
                            )}>
                              {completed ? <CheckCircle2 className="h-4 w-4" /> : idx + 1}
                            </div>
                            <span className="text-[10px] mt-1 text-gray-700 font-medium text-center">{step.label}</span>
                          </div>
                          {idx < arr.length - 1 && <div className="h-0.5 flex-1 mx-1 bg-gray-200" />}
                        </div>
                      )
                    })}
                </div>
              </div>
            )}

            {subjectiveContent.pointSelfEval && Object.keys(subjectiveContent.pointSelfEval).length > 0 && evalPoints.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-medium text-gray-500">学生按评价点自评</h3>
                {evalPoints.map((ep) => {
                  const selfEval = subjectiveContent.pointSelfEval?.[ep.id]
                  if (!selfEval) return null
                  return (
                    <div key={ep.id} className="bg-gray-50 rounded-lg border p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">{ep.name}</span>
                        <Badge variant="outline" className="text-[10px]">{ep.weight || 0} 分</Badge>
                      </div>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{selfEval}</p>
                    </div>
                  )
                })}
              </div>
            )}

            {subjectiveContent.text && (
              <div className="bg-gray-50 rounded-lg border p-3">
                <h3 className="text-xs font-medium text-gray-500 mb-2">学生提交内容</h3>
                <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
                  {subjectiveContent.text}
                </pre>
              </div>
            )}
            {subjectiveContent.files && Array.isArray(subjectiveContent.files) && subjectiveContent.files.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-medium text-gray-500">附件</h3>
                {subjectiveContent.files.map((f: any, i: number) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border text-sm group"
                  >
                    <Package className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-700 flex-1 min-w-0 truncate">{f.name}</span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => setPreviewAttachment({ name: f.name, url: f.url, type: f.type })}
                      >
                        <Eye className="h-3.5 w-3.5 mr-1" />
                        预览
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => {
                          const a = document.createElement("a")
                          a.href = f.url
                          a.download = f.name
                          a.click()
                        }}
                      >
                        <Download className="h-3.5 w-3.5 mr-1" />
                        下载
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {!subjectiveContent.text && (!subjectiveContent.files || subjectiveContent.files.length === 0) && (
              <div className="text-center py-8 text-gray-400 text-sm">学生未提交在线材料</div>
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
      <div className="w-1/2 flex flex-col bg-gray-50">
        <div className="px-4 py-2 bg-white border-b flex items-center justify-between shrink-0">
          <h2 className="text-sm font-medium text-gray-700">
            {isRandomDraw || isReview ? "评价点评分" : isHomework ? "评价标准" : "评价点评分"}
          </h2>
          <div className="text-sm text-gray-500">
            已评分：
            <span className="font-medium text-gray-800">
              {evalPointTotal} / {evalPointMaxTotal}
            </span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {evalPoints.length > 0 ? (
            evalPoints.map((ep) => (
              <EvalPointGradingCard
                key={ep.id}
                evalPoint={ep}
                score={pointScores[ep.id] ?? 0}
                comment={pointComments[ep.id] ?? ""}
                isGraded={saved}
                onChange={handleEvalPointChange}
              />
            ))
          ) : (
            <div className="text-center py-8 text-gray-400">
              <Star className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">该任务未配置评价点</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* 顶部导航 */}
      <div className="bg-white border-b px-4 py-2 flex items-center gap-3 shrink-0">
        <Button variant="ghost" size="sm" asChild className="h-8">
          <Link href="/evaluation/scene-results">
            <ArrowLeft className="mr-1 h-4 w-4" />
            返回
          </Link>
        </Button>
        <div className="h-4 w-px bg-gray-200" />
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium text-gray-800">{studentName}</span>
          <span className="text-gray-400">·</span>
          <span className="text-gray-600">{task?.name}</span>
          <Badge variant="outline" className="text-xs ml-1">{methodName}</Badge>
          {methodConfig?.isEnabled === false && (
            <Badge variant="outline" className="text-xs ml-1 bg-gray-50 text-gray-500 border-gray-200">
              已禁用
            </Badge>
          )}
        </div>
        <div className="flex-1" />
        {saved && (
          <Badge variant="outline" className="bg-green-50 text-green-600 border-green-200 gap-1 text-xs">
            <CheckCircle2 className="h-3 w-3" />
            已评分
          </Badge>
        )}
      </div>

      {/* 主内容 */}
      <div className="flex-1 overflow-hidden">
        {isExamMethod ? (
          <div className="h-full flex flex-col">
            {/* 顶部得分汇总 */}
            <div className="px-4 py-3 bg-white border-b shrink-0">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-blue-500" />
                  <div>
                    <h2 className="text-sm font-medium text-gray-700">{methodName}评分</h2>
                    <p className="text-xs text-gray-400">
                      共 {examQuestions.length} 题
                      （客观{examQuestions.filter((q: any) => isAutoQuestion(q)).length} / 主观
                      {examQuestions.filter((q: any) => !isAutoQuestion(q)).length}）
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">最终总分</span>
                  <Input
                    type="number"
                    min={0}
                    max={maxScore}
                    value={computedTotal}
                    disabled
                    className="w-20 text-right h-10 text-lg font-bold text-blue-600"
                  />
                  <span className="text-lg text-gray-400">/ {maxScore}</span>
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-500">客观题自动得分</span>
                  <span className="font-medium text-gray-700">
                    {examAutoTotal} / {examQuestions.reduce((s: number, q: any) => s + (isAutoQuestion(q) ? q.score || 0 : 0), 0)}
                  </span>
                </div>
                <div className="h-3 w-px bg-gray-200" />
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-500">主观题得分</span>
                  <span className={cn("font-medium", examSubjectiveTotal > 0 ? "text-gray-700" : "text-amber-600")}>
                    {examSubjectiveTotal} / {examQuestions.reduce((s: number, q: any) => s + (!isAutoQuestion(q) ? q.score || 0 : 0), 0)}
                  </span>
                  {examSubjectiveTotal === 0 && !saved && (
                    <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-200 bg-amber-50">
                      待评分
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <button
                  className={cn(
                    "px-3 py-1 rounded-full text-xs font-medium transition-colors",
                    questionFilter === "all"
                      ? "bg-primary text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  )}
                  onClick={() => setQuestionFilter("all")}
                >
                  全部题目 ({examQuestions.length})
                </button>
                <button
                  className={cn(
                    "px-3 py-1 rounded-full text-xs font-medium transition-colors",
                    questionFilter === "pending"
                      ? "bg-amber-500 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  )}
                  onClick={() => setQuestionFilter("pending")}
                >
                  待评分题目 ({examQuestions.filter((q: any) => !isAutoQuestion(q) && (pointScores[q.id] ?? 0) === 0).length})
                </button>
              </div>
              <div className="space-y-1.5">
                {(questionFilter === "all"
                  ? examQuestions
                  : examQuestions.filter((q: any) => !isAutoQuestion(q) && (pointScores[q.id] ?? 0) === 0)
                ).map((q: any, idx: number) => (
                  <QuestionGradingCard
                    key={q.id}
                    question={q}
                    index={questionFilter === "all" ? idx : examQuestions.indexOf(q)}
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

      {/* 底部操作栏 */}
      <div className="bg-white border-t shadow-[0_-2px_8px_rgba(0,0,0,0.06)] px-4 py-2.5 shrink-0 z-50">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-sm text-gray-500">最终得分</span>
            <span className={cn("text-2xl font-bold", saved || computedTotal > 0 ? "text-green-600" : "text-gray-400")}>
              {saved || computedTotal > 0 ? computedTotal : "-"}
            </span>
            <span className="text-sm text-gray-400">/ {maxScore}</span>
          </div>
          <div className="h-6 w-px bg-gray-200 shrink-0" />
          <div className="flex-1 min-w-0">
            <Textarea
              placeholder="教师评语..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              disabled={saved}
              rows={1}
              className="resize-none text-sm min-h-[36px] py-2"
            />
          </div>
          {saved && result.gradedAt && (
            <div className="text-xs text-gray-400 shrink-0">
              {new Date(result.gradedAt).toLocaleString("zh-CN")}
            </div>
          )}
          <Button variant="outline" size="sm" asChild className="shrink-0">
            <Link href="/evaluation/scene-results">取消</Link>
          </Button>
          {!saved && (
            <Button size="sm" onClick={handleSave} disabled={saving || !allScored} className="shrink-0 gap-1">
              <Save className="h-3.5 w-3.5" />
              {saving ? "保存中..." : "提交评分"}
            </Button>
          )}
          {saved && (
            <Button size="sm" disabled className="bg-green-600 hover:bg-green-600 shrink-0 gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              已提交
            </Button>
          )}
        </div>
      </div>

      {previewAttachment && <AttachmentPreview attachment={previewAttachment} onClose={() => setPreviewAttachment(null)} />}
    </div>
  )
}
