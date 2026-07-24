"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Save, FileText, Download, Eye, Star, User } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { evaluationResultApi, taskEvaluationApi, taskApi, userManagementApi } from "@/lib/api"
import type { SceneEvaluationResult, TaskEvaluationMethod } from "@/lib/types"

const evalMethodLabels: Record<string, string> = {
  random_draw: "现场问答", review: "现场评审", paper: "试卷",
  question_bank: "题库", outcome: "成果评价", homework: "作业", quiz: "随堂测",
}

export default function GradingDetailPage() {
  const params = useParams()
  const id = params.id as string

  const [result, setResult] = useState<SceneEvaluationResult | null>(null)
  const [methodConfig, setMethodConfig] = useState<TaskEvaluationMethod | null>(null)
  const [task, setTask] = useState<any>(null)
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [pointScores, setPointScores] = useState<Record<string, number>>({})
  const [comment, setComment] = useState("")
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!id) return
    const load = async () => {
      try {
        const res = await evaluationResultApi.get(id)
        setResult(res)
        setComment(res.comment || "")

        const existingScores = res.evalPointScores as Record<string, any> | undefined
        if (existingScores) {
          const scores: Record<string, number> = {}
          Object.entries(existingScores).forEach(([k, v]) => { if (typeof v === "number") scores[k] = v })
          setPointScores(scores)
        }
        if (res.status === "evaluated") setSaved(true)

        const [taskData, mRes] = await Promise.all([
          taskApi.get(res.taskId).catch(() => null),
          taskEvaluationApi.listMethods(res.taskId).catch(() => ({ methods: [] })),
        ])
        setTask(taskData)
        setMethodConfig(mRes.methods.find((m: TaskEvaluationMethod) => m.methodKey === res.methodKey) || null)

        const u = await userManagementApi.list({ limit: 1000 }).catch(() => ({ items: [] }))
        const found = (u.items || []).find((x: any) => x.id === res.evaluateeId)
        setUser(found || null)
      } catch (e) { /* ignore */ }
      setLoading(false)
    }
    load()
  }, [id])

  const evalPoints = methodConfig?.evalPoints || []
  const reviewSteps = methodConfig?.reviewSteps || []
  const subjectiveContent = result?.subjectiveContent as Record<string, any> | undefined
  const objectiveAnswers = result?.objectiveAnswers as Record<string, any> | undefined

  const computedTotal = evalPoints.reduce((sum, ep) => sum + (pointScores[ep.id] ?? 0), 0)
  const methodName = evalMethodLabels[result?.methodKey || ""] || result?.methodKey || ""
  const studentName = user?.name || result?.evaluateeId || "未知"

  const handleSave = async () => {
    if (!result) return
    setSaving(true)
    try {
      await evaluationResultApi.grade(result.id, {
        score: computedTotal,
        comment: comment || undefined,
        evalPointScores: pointScores,
      })
      setSaved(true)
    } catch (e) { /* ignore */ }
    setSaving(false)
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">加载中...</div>
  if (!result) return <div className="min-h-screen flex items-center justify-center text-gray-400">记录不存在</div>

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-6 py-6">
        <div className="mb-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/evaluation/scene-results"><ArrowLeft className="mr-1 h-4 w-4" />返回列表</Link>
          </Button>
        </div>

        {/* Header */}
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <User className="h-4 w-4" />
              </div>
              <div>
                <div>{studentName} - {methodName}评分</div>
                <div className="text-sm font-normal text-gray-400">{task?.name}</div>
              </div>
              <Badge className={cn("ml-auto", saved ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700")}>
                {saved ? "已评分" : "待评分"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div><span className="text-gray-400">满分：</span>{result.maxScore}</div>
              <div><span className="text-gray-400">当前总分：</span>
                <span className="font-bold text-lg ml-1">{saved && result.totalScore != null ? result.totalScore : computedTotal}</span>
              </div>
              <div><span className="text-gray-400">场景：</span>{result.sceneId}</div>
            </div>
          </CardContent>
        </Card>

        {/* 学生提交内容 */}
        {subjectiveContent && (
          <Card className="mb-4">
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" />学生提交内容</CardTitle></CardHeader>
            <CardContent>
              {subjectiveContent.text && (
                <div className="mb-4">
                  <p className="text-xs text-gray-400 mb-1">文字说明</p>
                  <pre className="text-sm whitespace-pre-wrap bg-gray-50 p-4 rounded-lg">{subjectiveContent.text}</pre>
                </div>
              )}
              {subjectiveContent.files && Array.isArray(subjectiveContent.files) && subjectiveContent.files.length > 0 && (
                <div>
                  <p className="text-xs text-gray-400 mb-1">提交文件</p>
                  <div className="space-y-1">
                    {(subjectiveContent.files as any[]).map((f: any, i: number) => (
                      <a key={i} href={f.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-blue-600 hover:underline p-2 bg-blue-50 rounded">
                        <Download className="h-4 w-4" />{f.name} ({f.size ? `${(f.size / 1024).toFixed(1)}KB` : "未知大小"})
                      </a>
                    ))}
                  </div>
                </div>
              )}
              {!subjectiveContent.text && !subjectiveContent.files && (
                <div className="space-y-1">
                  {Object.entries(subjectiveContent).map(([k, v]) => (
                    <div key={k} className="text-sm bg-gray-50 p-2 rounded">
                      <span className="font-medium">{k}:</span> {typeof v === "object" ? JSON.stringify(v) : String(v)}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* 评审步骤 (review) */}
        {reviewSteps.length > 0 && (
          <Card className="mb-4">
            <CardHeader><CardTitle className="text-base">评审步骤</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {(reviewSteps as any[]).map((rs: any, idx: number) => (
                  <div key={rs.id || idx} className="p-3 bg-gray-50 rounded-lg flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center">{idx + 1}</div>
                    <span className="text-sm font-medium">{rs.label}</span>
                    {rs.description && <span className="text-xs text-gray-500 ml-auto">{rs.description}</span>}
                    <Badge variant="outline" className="text-[10px]">{rs.weight}%</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 评价标准评分 */}
        {evalPoints.length > 0 && (
          <Card className="mb-4">
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Star className="h-4 w-4" />评价标准评分</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-4">
                {evalPoints.map((ep: any) => (
                  <div key={ep.id} className="p-4 border rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{ep.name}</p>
                        {ep.description && <p className="text-xs text-gray-500 mt-0.5">{ep.description}</p>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-4">
                        <Input
                          type="number" min={0} max={ep.weight || 100}
                          value={pointScores[ep.id] ?? ""}
                          onChange={(e) => setPointScores((p) => ({ ...p, [ep.id]: Number(e.target.value) }))}
                          className="w-20 h-8 text-sm"
                          disabled={saved}
                        />
                        <span className="text-xs text-gray-400">/ {ep.weight || 100}</span>
                      </div>
                    </div>
                    {ep.gradeMapping && ep.gradeMapping.length > 0 && (
                      <div className="flex gap-1.5 mt-2">
                        {(ep.gradeMapping as any[]).map((g: any, gi: number) => (
                          <div key={gi} className={cn("flex-1 text-center rounded px-2 py-1 text-xs font-medium",
                            g.color || "bg-gray-100", g.color?.includes("green") || g.grade === "A" ? "bg-green-100 text-green-700" :
                            g.color?.includes("blue") || g.grade === "B" ? "bg-blue-100 text-blue-700" :
                            g.color?.includes("yellow") || g.grade === "C" ? "bg-yellow-100 text-yellow-700" :
                            "bg-red-100 text-red-700"
                          )}>
                            <div className="font-bold text-sm">{g.grade}</div>
                            <div className="opacity-70">{g.minScore}-{g.maxScore}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 评语 */}
        <Card className="mb-4">
          <CardHeader><CardTitle className="text-base">评语</CardTitle></CardHeader>
          <CardContent>
            <Textarea placeholder="输入评语..." value={comment} onChange={(e) => setComment(e.target.value)} rows={4} disabled={saved} />
          </CardContent>
        </Card>

        {/* 操作按钮 */}
        <div className="flex justify-end gap-3">
          <Button variant="outline" asChild><Link href="/evaluation/scene-results">取消</Link></Button>
          {!saved && (
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Star className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              提交评分
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
