"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams, useSearchParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Upload, Send, FileText, CheckCircle2, Clock, ClipboardList } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { scenarioApi, taskApi, taskEvaluationApi, evaluationResultApi, fileApi, examApi, examUsageApi } from "@/lib/api"
import type { TaskEvaluationMethod, SceneEvaluationResult, Exam, ExamUsage } from "@/lib/types"
import { useAuth } from "@/components/auth-provider"

const evalMethodLabels: Record<string, string> = {
  random_draw: "现场问答", review: "现场评审", paper: "试卷",
  question_bank: "题库", outcome: "成果评价", homework: "作业", quiz: "随堂测",
}

export default function EvaluatePage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const id = params.id as string
  const taskId = searchParams.get("task") || ""
  const methodKey = searchParams.get("method") || ""
  const { user } = useAuth()

  const [scenario, setScenario] = useState<any>(null)
  const [task, setTask] = useState<any>(null)
  const [methods, setMethods] = useState<TaskEvaluationMethod[]>([])
  const [result, setResult] = useState<SceneEvaluationResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const [text, setText] = useState("")
  const [files, setFiles] = useState<{ name: string; url: string; size: number }[]>([])
  const [uploading, setUploading] = useState(false)

  const [drawnQuestionIds, setDrawnQuestionIds] = useState<string[]>([])
  const [reviewStepDone, setReviewStepDone] = useState<Record<string, boolean>>({})

  const [exam, setExam] = useState<Exam | null>(null)
  const [usages, setUsages] = useState<ExamUsage[]>([])
  const [examLoading, setExamLoading] = useState(false)

  const methodConfig = methods.find((m) => m.methodKey === methodKey)
  const reviewSteps = methodConfig?.reviewSteps || []
  const resourceConfig = methodConfig?.resourceConfig || {}
  const methodName = evalMethodLabels[methodKey] || methodKey
  const isAutoScored = ["paper", "question_bank", "quiz"].includes(methodKey)
  const isTeacherLed = ["random_draw", "review"].includes(methodKey)
  const isManualSubmit = ["outcome", "homework"].includes(methodKey)
  const paperId = resourceConfig?.paperId
  const tempExamId = resourceConfig?.examId
  const examId = methodKey === "paper" ? paperId : tempExamId
  const isExamMethod = ["paper", "question_bank", "quiz"].includes(methodKey)
  const questionIds = resourceConfig?.questionIds
  // 是否需要提交材料：默认 true，保持与现有未配置数据兼容
  const requiresMaterial = resourceConfig.requiresMaterial !== false
  const formatDateTime = (v: string | undefined) => {
    if (!v) return "-"
    const d = new Date(v)
    return isNaN(d.getTime()) ? v : d.toLocaleString("zh-CN", { hour12: false })
  }

  const currentUsage = useMemo(() => {
    if (resourceConfig?.usageId) {
      const found = usages.find((u) => u.id === resourceConfig.usageId)
      if (found) return found
    }
    return usages[0] || null
  }, [usages, resourceConfig])

  const examEntryStatus = useMemo(() => {
    if (!isExamMethod) return null
    if (examLoading) return { label: "加载中...", disabled: true }
    if (!examId) return { label: "教师尚未配置考试", disabled: true }
    if (!currentUsage) return { label: "暂无考试安排", disabled: true }
    const now = new Date()
    const scheduledStart = resourceConfig.scheduledTime ? new Date(resourceConfig.scheduledTime) : null
    const scheduledEnd = resourceConfig.scheduledEndTime ? new Date(resourceConfig.scheduledEndTime) : null
    if (resourceConfig.activationMode === "scheduled" && scheduledStart && now < scheduledStart) {
      return { label: `考试未开始（${formatDateTime(resourceConfig.scheduledTime)}）`, disabled: true }
    }
    if (resourceConfig.activationMode === "scheduled" && scheduledEnd && now > scheduledEnd) {
      return { label: "考试已结束", disabled: true }
    }
    if (currentUsage.status === "finished") {
      return { label: "考试已结束", disabled: true }
    }
    return { label: "前往考试", disabled: false }
  }, [isExamMethod, examLoading, examId, currentUsage, resourceConfig])

  const resubmitConfig = useMemo(() => {
    const allow = isExamMethod ? resourceConfig.allowRetake : resourceConfig.allowResubmit
    const maxCount = resourceConfig.retakeCount ?? (allow ? 999 : 0)
    const attempts = result?.subjectiveContent?.attempts || 0
    const can = !!allow && (result?.status !== "evaluated" || attempts < maxCount)
    return { allow, maxCount, attempts, can }
  }, [resourceConfig, result, isExamMethod])

  const resetForResubmit = () => {
    setSubmitted(false)
    setText("")
    setFiles([])
    setDrawnQuestionIds([])
    setReviewStepDone({})
  }

  useEffect(() => {
    if (!id || !taskId || !methodKey) { setLoading(false); return }
    const load = async () => {
      try {
        const [sc, t, mRes, rRes] = await Promise.all([
          scenarioApi.get(id).catch(() => null),
          taskApi.get(taskId).catch(() => null),
          taskEvaluationApi.listMethods(taskId).catch(() => ({ methods: [] })),
          evaluationResultApi.list({ taskId, evaluateeId: user?.id, methodKey, limit: 1 })
            .catch(() => ({ items: [] as SceneEvaluationResult[] })),
        ])
        setScenario(sc)
        setTask(t)
        const enabledMethods = (mRes.methods || []).filter((m: TaskEvaluationMethod) => m.isEnabled !== false)
        setMethods(enabledMethods)
        const cfg = enabledMethods.find((m: TaskEvaluationMethod) => m.methodKey === methodKey)
        if (cfg && isExamMethod) {
          setExamLoading(true)
          const cfgExamId = methodKey === "paper" ? cfg.resourceConfig?.paperId : cfg.resourceConfig?.examId
          if (cfgExamId) {
            try {
              const [examData, usageRes] = await Promise.all([
                examApi.get(cfgExamId),
                examUsageApi.list({ examId: cfgExamId, limit: 50 }),
              ])
              setExam(examData)
              setUsages(usageRes.items || [])
            } catch { /* ignore */ }
          }
          setExamLoading(false)
        }
        const existing = (rRes.items || []).find((r: SceneEvaluationResult) => r.methodKey === methodKey)
        if (existing) {
          setResult(existing)
          setText(typeof existing.subjectiveContent === "object" ? "" : "")
          setSubmitted(existing.status === "evaluated" || !!existing.subjectiveContent)
        }
      } catch (e) { /* ignore */ }
      setLoading(false)
    }
    load()
  }, [id, taskId, methodKey, user?.id])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const res = await fileApi.upload(file)
      setFiles((prev) => [...prev, { name: file.name, url: res.url, size: res.size || file.size }])
    } catch { /* ignore */ }
    setUploading(false)
    e.target.value = ""
  }

  const handleSubmit = async () => {
    if (!user?.id) return
    setSubmitting(true)
    try {
      const payload: any = {
        taskId, sceneId: id, methodKey,
        evaluateeId: user.id, maxScore: 100,
      }
      if (isManualSubmit) {
        payload.subjectiveContent = { text, files, attempts: (resubmitConfig.attempts || 0) + 1 }
      } else if (methodKey === "random_draw") {
        const drawnQuestions: Record<string, any> = {}
        drawnQuestionIds.forEach((qid) => {
          drawnQuestions[qid] = { drawnAt: new Date().toISOString(), oralAnswer: "" }
        })
        payload.drawnQuestions = drawnQuestions
      } else if (methodKey === "review") {
        const completedSteps = reviewSteps
          .filter((s: any) => s.enabled && reviewStepDone[s.id])
          .map((s: any) => ({ stepId: s.id, completedAt: new Date().toISOString() }))
        payload.subjectiveContent = { reviewSteps: completedSteps, attempts: (resubmitConfig.attempts || 0) + 1 }
      } else {
        payload.subjectiveContent = {}
      }
      await evaluationResultApi.submit(payload)
      setSubmitted(true)
      const rRes = await evaluationResultApi.list({ taskId, evaluateeId: user.id, methodKey, limit: 1 })
      const updated = (rRes.items || []).find((r: SceneEvaluationResult) => r.methodKey === methodKey)
      if (updated) setResult(updated)
    } catch (e) { /* ignore */ }
    setSubmitting(false)
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">加载中...</div>
  if (!task || !methodConfig) return <div className="min-h-screen flex items-center justify-center text-gray-400">未找到任务或测评方式</div>

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-6 py-6">
        <div className="mb-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/scene/landing/${id}/learn?task=${taskId}`}>
              <ArrowLeft className="mr-1 h-4 w-4" />返回学习页
            </Link>
          </Button>
        </div>

        {/* 任务信息 */}
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-lg">
              {task.name} - {methodName}
              {submitted && <Badge className="ml-3 bg-green-100 text-green-700">已提交</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {scenario && <p className="text-sm text-gray-500 mb-2">场景：{scenario.name}</p>}
            {task.description && <p className="text-sm text-gray-600">{task.description}</p>}
            {result && result.totalScore != null && (
              <p className="text-sm mt-2 font-medium text-green-600">评分：{result.totalScore} / {result.maxScore}</p>
            )}
          </CardContent>
        </Card>

        {/* 现场类测评要求：展示提交材料要求、场地/环境资源、截止时间、是否允许重新提交 */}
        {isTeacherLed && (
          <Card className="mb-4">
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" />测评要求</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              {!requiresMaterial && (
                <p className="text-gray-600">本测评无需在线提交材料。</p>
              )}
              {requiresMaterial && resourceConfig.submitFormatDesc ? (
                <div>
                  <p className="font-medium mb-1">提交材料要求</p>
                  <p className="text-gray-600 whitespace-pre-wrap">{resourceConfig.submitFormatDesc}</p>
                </div>
              ) : requiresMaterial ? (
                <p className="text-gray-500">请按照教师要求准备材料</p>
              ) : null}
              {resourceConfig.venueResources ? (
                <div>
                  <p className="font-medium mb-1">评审场地/环境资源</p>
                  <p className="text-gray-600 whitespace-pre-wrap">{resourceConfig.venueResources}</p>
                </div>
              ) : (
                <p className="text-gray-500">请关注教师通知的场地安排</p>
              )}
              {resourceConfig.deadlineDays != null && (
                <p>预计提交天数：<span className="font-medium">{resourceConfig.deadlineDays} 天</span></p>
              )}
              {resourceConfig.allowResubmit !== undefined && (
                <p>允许重新提交：{resourceConfig.allowResubmit ? "是" : "否"}</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* 材料类测评要求 */}
        {isManualSubmit && (
          <Card className="mb-4">
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" />测评要求</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {!requiresMaterial ? (
                <p className="text-gray-600">本测评无需提交材料。</p>
              ) : (
                <>
                  {resourceConfig.deadlineDays != null && <p>预计提交天数：<span className="font-medium">{resourceConfig.deadlineDays} 天</span></p>}
                  {resourceConfig.submitFormatDesc ? (
                    <div><p className="font-medium mb-1">提交材料格式要求：</p><p className="text-gray-600">{resourceConfig.submitFormatDesc}</p></div>
                  ) : (
                    <p className="text-gray-500">请按照教师要求准备材料</p>
                  )}
                  {resourceConfig.venueResources && (
                    <div><p className="font-medium mb-1">评审场地/环境资源：</p><p className="text-gray-600">{resourceConfig.venueResources}</p></div>
                  )}
                  {resourceConfig.allowResubmit !== undefined && <p>允许重新提交：{resourceConfig.allowResubmit ? "是" : "否"}</p>}
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* 评审流程（仅现场评审） */}
        {methodKey === "review" && reviewSteps.length > 0 && (
          <Card className="mb-4">
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><ClipboardList className="h-4 w-4" />评审流程</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {reviewSteps.filter((s: any) => s.enabled).map((s: any, idx: number) => (
                  <div key={s.id || idx} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{idx + 1}. {s.label}</span>
                      <Badge variant="outline" className="text-[10px]">{s.weight || 0}%</Badge>
                    </div>
                    {s.description && <p className="text-xs text-gray-500 mt-1">{s.description}</p>}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 提交区域 - 按方法分类 */}
        {!submitted && isManualSubmit && requiresMaterial && (
          <Card className="mb-4">
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Send className="h-4 w-4" />提交内容</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">文字说明</label>
                <Textarea placeholder="描述你的成果/作业内容..." value={text} onChange={(e) => setText(e.target.value)} rows={6} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">上传文件</label>
                {files.length > 0 && (
                  <div className="space-y-1 mb-2">
                    {files.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 p-2 rounded">
                        <FileText className="h-4 w-4" />{f.name}
                        <Button variant="ghost" size="sm" className="h-5 text-xs text-red-500" onClick={() => setFiles(files.filter((_, j) => j !== i))}>删除</Button>
                      </div>
                    ))}
                  </div>
                )}
                <input type="file" onChange={handleFileUpload} disabled={uploading} className="text-sm" />
                {uploading && <span className="text-xs text-gray-400 ml-2">上传中...</span>}
              </div>
              <Button onClick={handleSubmit} disabled={submitting} className="w-full">
                {submitting ? <Clock className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                {submitting ? "提交中..." : "提交测评"}
              </Button>
            </CardContent>
          </Card>
        )}

        {!submitted && isTeacherLed && methodKey === "random_draw" && (
          <Card className="mb-4">
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><ClipboardList className="h-4 w-4" />现场抽题</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600">点击“开始抽题”后，系统将从题库中随机抽取题目，作为您本次现场问答的题目。</p>
              {drawnQuestionIds.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                  <p className="text-xs font-medium text-gray-500">已抽中 {drawnQuestionIds.length} 题</p>
                  <div className="flex flex-wrap gap-2">
                    {drawnQuestionIds.map((qid, idx) => (
                      <Badge key={qid} variant="outline" className="text-xs">第 {idx + 1} 题</Badge>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    const ids = resourceConfig.selectedQuestionIds || []
                    const drawCount = Math.max(1, Math.min(ids.length, resourceConfig.drawCount || ids.length || 1))
                    const shuffled = [...ids].sort(() => Math.random() - 0.5)
                    setDrawnQuestionIds(shuffled.slice(0, drawCount))
                  }}
                  disabled={submitting || !(resourceConfig.selectedQuestionIds?.length > 0)}
                >
                  开始抽题
                </Button>
                <Button onClick={handleSubmit} disabled={submitting || drawnQuestionIds.length === 0}>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  {submitting ? "..." : "确认参加"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {!submitted && isTeacherLed && methodKey === "review" && (
          <Card className="mb-4">
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><ClipboardList className="h-4 w-4" />评审流程确认</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600">请按顺序完成以下评审步骤，完成后点击“确认参加”。</p>
              <div className="space-y-2">
                {reviewSteps.filter((s: any) => s.enabled).map((s: any, idx: number) => (
                  <label key={s.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={!!reviewStepDone[s.id]}
                      onChange={(e) => setReviewStepDone((prev) => ({ ...prev, [s.id]: e.target.checked }))}
                    />
                    <div>
                      <p className="text-sm font-medium">{idx + 1}. {s.label}</p>
                      {s.description && <p className="text-xs text-gray-500">{s.description}</p>}
                    </div>
                  </label>
                ))}
              </div>
              <Button onClick={handleSubmit} disabled={submitting || !reviewSteps.filter((s: any) => s.enabled).every((s: any) => reviewStepDone[s.id])}>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                {submitting ? "..." : "确认参加"}
              </Button>
            </CardContent>
          </Card>
        )}

        {!submitted && isExamMethod && (
          <Card className="mb-4">
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Clock className="h-4 w-4" />考试规则</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <p>时长：<span className="font-medium">{resourceConfig.timeLimit ?? resourceConfig.duration ?? 90} 分钟</span></p>
                <p>允许重考：<span className="font-medium">{resourceConfig.allowRetake ? `是（最多 ${resourceConfig.retakeCount ?? 1} 次）` : "否"}</span></p>
                <p>题目乱序：<span className="font-medium">{resourceConfig.shuffleQuestions !== false ? "是" : "否"}</span></p>
                <p>交卷后显示成绩：<span className="font-medium">{resourceConfig.showResult !== false ? "是" : "否"}</span></p>
                <p>启用方式：<span className="font-medium">{resourceConfig.activationMode === "scheduled" ? "定时启用" : resourceConfig.activationMode === "always" ? "随时可考" : "后台手动启用"}</span></p>
                {resourceConfig.activationMode === "scheduled" && (
                  <p>起止时间：<span className="font-medium">{formatDateTime(resourceConfig.scheduledTime)} ~ {formatDateTime(resourceConfig.scheduledEndTime)}</span></p>
                )}
                {methodKey === "question_bank" && resourceConfig.passRate != null && (
                  <p>正确率要求：<span className="font-medium">{resourceConfig.passRate}%</span></p>
                )}
              </div>
              <div className="pt-4 text-center">
                {examEntryStatus?.disabled ? (
                  <Button disabled>{examEntryStatus.label}</Button>
                ) : (
                  <Button asChild>
                    <Link href={`/evaluation/landing/exams/${examId}?task=${taskId}&scene=${id}&method=${methodKey}&usage=${currentUsage?.id || ""}`}>{examEntryStatus?.label || "前往考试"}</Link>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {submitted && (
          <Card className="mb-4 border-green-200 bg-green-50">
            <CardContent className="py-6 text-center">
              <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-2" />
              <p className="text-green-700 font-medium">已成功提交！</p>
              <p className="text-sm text-green-600 mt-1">
                {result?.status === "evaluated"
                  ? `评分：${result.totalScore}/${result.maxScore}`
                  : "等待老师评分后可在学习页查看成绩"}
              </p>
              <div className="flex items-center justify-center gap-2 mt-3">
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/scene/landing/${id}/learn?task=${taskId}`}>返回学习页</Link>
                </Button>
                {resubmitConfig.can && (
                  <Button size="sm" onClick={resetForResubmit}>
                    重新测评
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
