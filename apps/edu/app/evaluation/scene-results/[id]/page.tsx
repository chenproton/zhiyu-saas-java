"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  CheckCircle2,
  Save,
  Star,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { evaluationResultApi, taskEvaluationApi, taskApi, userManagementApi } from "@/lib/api"
import type { SceneEvaluationResult, TaskEvaluationMethod, TaskEvalPoint } from "@/lib/types"

const evalMethodLabels: Record<string, string> = {
  random_draw: "现场问答", review: "现场评审", paper: "试卷",
  question_bank: "题库", outcome: "成果评价", homework: "作业", quiz: "随堂测",
}

export default function GradingDetailPage() {
  const params = useParams()
  const id = params.id as string

  const [result, setResult] = useState<SceneEvaluationResult | null>(null)
  const [evalMethods, setEvalMethods] = useState<TaskEvaluationMethod[]>([])
  const [task, setTask] = useState<any>(null)
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [pointScores, setPointScores] = useState<Record<string, number>>({})
  const [comment, setComment] = useState("")
  const [totalScore, setTotalScore] = useState(0)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!id) return
    const load = async () => {
      try {
        const res = await evaluationResultApi.get(id)
        setResult(res)
        setComment(res.comment || "")
        if (res.totalScore != null) setTotalScore(res.totalScore)

        const existingScores = res.evalPointScores as Record<string, any> | undefined
        if (existingScores) {
          const scores: Record<string, number> = {}
          Object.entries(existingScores).forEach(([k, v]) => { if (typeof v === "number") scores[k] = v })
          setPointScores(scores)
        }

        if (res.status === "evaluated") setSaved(true)

        const [taskData, methodsRes] = await Promise.all([
          taskApi.get(res.taskId).catch(() => null),
          taskEvaluationApi.listMethods(res.taskId).catch(() => ({ methods: [] })),
        ])
        setTask(taskData)
        setEvalMethods(methodsRes.methods.filter((m: TaskEvaluationMethod) => m.methodKey === res.methodKey))

        const userData = await userManagementApi.get?.(res.evaluateeId)?.catch(() => null)
        setUser(userData)
      } catch (e) {
        console.error("Failed to load grading detail", e)
      }
      setLoading(false)
    }
    load()
  }, [id])

  const methodConfig = evalMethods[0]
  const evalPoints: TaskEvalPoint[] = methodConfig?.evalPoints || []

  const handlePointScoreChange = (pointId: string, value: number) => {
    setPointScores((prev) => ({ ...prev, [pointId]: value }))
  }

  const computedTotal = evalPoints.reduce((sum, ep) => sum + (pointScores[ep.id] ?? 0), 0)

  const handleSave = async () => {
    if (!result) return
    setSaving(true)
    try {
      await evaluationResultApi.grade(result.id, {
        score: computedTotal,
        comment: comment || undefined,
        evalPointScores: pointScores,
      })
      setTotalScore(computedTotal)
      setSaved(true)
    } catch (e) {
      console.error("Failed to save grade", e)
    }
    setSaving(false)
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">加载中...</div>
  if (!result) return <div className="min-h-screen flex items-center justify-center text-gray-400">记录不存在</div>

  const methodName = evalMethodLabels[result.methodKey] || result.methodKey
  const userName = user?.name || result.evaluateeId
  const statusLabel = result.status === "evaluated" || saved ? "已评分" : "待评分"

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-6 py-6">
        <div className="mb-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/evaluation/scene-results">
              <ArrowLeft className="mr-1 h-4 w-4" />返回列表
            </Link>
          </Button>
        </div>

        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-3">
              <span>{userName} - {methodName}评分</span>
              <Badge className={cn(statusLabel === "待评分" ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700")}>{statusLabel}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-gray-500">任务：</span>{task?.name || result.taskId}</div>
              <div><span className="text-gray-500">测评方式：</span>{methodName}</div>
              <div><span className="text-gray-500">满分：</span>{result.maxScore}</div>
              <div><span className="text-gray-500">总分：</span>
                <span className="font-bold text-lg ml-1">{saved && result.totalScore != null ? result.totalScore : computedTotal}</span>
                <span className="text-gray-400"> / {result.maxScore}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {result.objectiveAnswers && Object.keys(result.objectiveAnswers).length > 0 && (
          <Card className="mb-4">
            <CardHeader><CardTitle className="text-base">客观题作答</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(result.objectiveAnswers).map(([key, val]: [string, any]) => (
                  <div key={key} className="p-3 bg-gray-50 rounded-lg">
                    <div className="text-sm font-medium mb-1">{typeof val === "object" ? val.question || key : key}</div>
                    {typeof val === "object" && val.answer ? (
                      <div className="text-sm text-gray-600">答案: {String(val.answer)}</div>
                    ) : (
                      <div className="text-sm text-gray-600">{String(val)}</div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {evalPoints.length > 0 && (
          <Card className="mb-4">
            <CardHeader><CardTitle className="text-base">评价标准评分</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-4">
                {evalPoints.map((ep) => (
                  <div key={ep.id} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-medium text-sm">{ep.name}</p>
                        {ep.description && <p className="text-xs text-gray-500 mt-0.5">{ep.description}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <Label className="text-xs text-gray-500">得分:</Label>
                        <Input
                          type="number"
                          min={0}
                          max={ep.weight || 100}
                          value={pointScores[ep.id] ?? ""}
                          onChange={(e) => handlePointScoreChange(ep.id, Number(e.target.value))}
                          className="w-20 h-8 text-sm"
                          disabled={saved}
                        />
                        <span className="text-xs text-gray-400">/ {ep.weight || 100}</span>
                      </div>
                    </div>
                    {ep.gradeMapping && ep.gradeMapping.length > 0 && (
                      <div className="flex gap-1.5 mt-2">
                        {(ep.gradeMapping as any[]).map((g: any, idx: number) => (
                          <div key={idx} className={cn("flex-1 text-center rounded px-2 py-1 text-xs", g.color || "bg-gray-100")}>
                            <div className="font-bold">{g.grade}</div>
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

        {methodConfig?.reviewSteps && methodConfig.reviewSteps.length > 0 && (
          <Card className="mb-4">
            <CardHeader><CardTitle className="text-base">评审步骤</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {(methodConfig.reviewSteps as any[]).map((rs: any, idx: number) => (
                  <div key={rs.id || idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-medium">{idx + 1}</div>
                      <span className="text-sm font-medium">{rs.label}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {rs.description && <span className="text-xs text-gray-500">{rs.description}</span>}
                      <Badge variant="outline" className="text-[10px]">{rs.weight}%</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {result.subjectiveContent && Object.keys(result.subjectiveContent).length > 0 && (
          <Card className="mb-4">
            <CardHeader><CardTitle className="text-base">主观作答内容</CardTitle></CardHeader>
            <CardContent>
              <pre className="text-sm whitespace-pre-wrap bg-gray-50 p-4 rounded-lg">{JSON.stringify(result.subjectiveContent, null, 2)}</pre>
            </CardContent>
          </Card>
        )}

        <Card className="mb-4">
          <CardHeader><CardTitle className="text-base">评语</CardTitle></CardHeader>
          <CardContent>
            <Textarea
              placeholder="输入评语..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              disabled={saved}
            />
          </CardContent>
        </Card>

        {!saved && (
          <div className="flex justify-end gap-3">
            <Button variant="outline" asChild>
              <Link href="/evaluation/scene-results">取消</Link>
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Star className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              提交评分
            </Button>
          </div>
        )}

        {saved && (
          <div className="flex justify-end">
            <Button variant="outline" asChild>
              <Link href="/evaluation/scene-results">
                <CheckCircle2 className="mr-2 h-4 w-4 text-green-600" />返回列表
              </Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
