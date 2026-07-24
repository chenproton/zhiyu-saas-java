"use client"

import { useEffect, useState } from "react"
import { useParams, useSearchParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Upload, Send, FileText, CheckCircle2, Clock, ClipboardList } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { scenarioApi, taskApi, taskEvaluationApi, evaluationResultApi, fileApi } from "@/lib/api"
import type { TaskEvaluationMethod, SceneEvaluationResult } from "@/lib/types"
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

  const methodConfig = methods.find((m) => m.methodKey === methodKey)
  const evalPoints = methodConfig?.evalPoints || []
  const reviewSteps = methodConfig?.reviewSteps || []
  const resourceConfig = methodConfig?.resourceConfig || {}
  const methodName = evalMethodLabels[methodKey] || methodKey
  const isAutoScored = ["paper", "question_bank", "quiz"].includes(methodKey)
  const isTeacherLed = ["random_draw", "review"].includes(methodKey)
  const isManualSubmit = ["outcome", "homework"].includes(methodKey)
  const paperId = resourceConfig?.paperId
  const questionIds = resourceConfig?.questionIds

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
        setMethods(mRes.methods || [])
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
      await evaluationResultApi.submit({
        taskId, sceneId: id, methodKey,
        evaluateeId: user.id, maxScore: 100,
        subjectiveContent: { text, files },
      })
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

        {/* 材料要求 */}
        {(resourceConfig.submitFormatDesc || resourceConfig.deadlineDays || resourceConfig.venueResources) && (
          <Card className="mb-4">
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" />提交要求</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {resourceConfig.deadlineDays && <p>预计提交天数：<span className="font-medium">{resourceConfig.deadlineDays} 天</span></p>}
              {resourceConfig.submitFormatDesc && <p className="text-gray-600">{resourceConfig.submitFormatDesc}</p>}
              {resourceConfig.venueResources && <p className="text-gray-600">场地资源：{resourceConfig.venueResources}</p>}
              {resourceConfig.allowResubmit !== undefined && <p>允许重新提交：{resourceConfig.allowResubmit ? "是" : "否"}</p>}
            </CardContent>
          </Card>
        )}

        {/* 评价标准预览 */}
        {evalPoints.length > 0 && (
          <Card className="mb-4">
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><ClipboardList className="h-4 w-4" />评价标准</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {evalPoints.map((ep: any, idx: number) => (
                  <div key={ep.id} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{idx + 1}. {ep.name}</span>
                      <Badge variant="outline" className="text-[10px]">{ep.weight || 0}分</Badge>
                    </div>
                    {ep.description && <p className="text-xs text-gray-500 mt-1">{ep.description}</p>}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 评审步骤 */}
        {reviewSteps.length > 0 && (
          <Card className="mb-4">
            <CardHeader><CardTitle className="text-base">评审步骤</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {(reviewSteps as any[]).map((rs: any, idx: number) => (
                  <div key={rs.id || idx} className="p-3 bg-gray-50 rounded-lg flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-medium">{idx + 1}</div>
                    <div><span className="text-sm font-medium">{rs.label}</span>{rs.description && <p className="text-xs text-gray-500">{rs.description}</p>}</div>
                    <Badge variant="outline" className="text-[10px] ml-auto">{rs.weight}%</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 提交区域 - 按方法分类 */}
        {!submitted && isManualSubmit && (
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

        {!submitted && isTeacherLed && (
          <Card className="mb-4">
            <CardContent className="py-8 text-center">
              <p className="text-gray-600 mb-2">此为现场测评方式，无需在线提交。</p>
              <p className="text-sm text-gray-400">请按照上述要求准备好材料，按教师安排参加现场测评。</p>
              <Button onClick={handleSubmit} disabled={submitting} variant="outline" className="mt-4">
                <CheckCircle2 className="mr-2 h-4 w-4" />
                {submitting ? "..." : "确认参加"}
              </Button>
            </CardContent>
          </Card>
        )}

        {!submitted && methodKey === "paper" && !paperId && (
          <Card className="mb-4">
            <CardContent className="py-8 text-center">
              <p className="text-gray-600">教师尚未配置试卷，请联系教师。</p>
            </CardContent>
          </Card>
        )}

        {submitted && (
          <Card className="mb-4 border-green-200 bg-green-50">
            <CardContent className="py-6 text-center">
              <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-2" />
              <p className="text-green-700 font-medium">已成功提交！</p>
              <p className="text-sm text-green-600 mt-1">等待老师评分后可在学习页查看成绩</p>
              <Button variant="outline" size="sm" className="mt-3" asChild>
                <Link href={`/scene/landing/${id}/learn?task=${taskId}`}>返回学习页</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
