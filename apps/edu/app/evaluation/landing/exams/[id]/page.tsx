"use client"

import Link from "next/link"
import { useState, useEffect, useMemo, useCallback } from "react"
import { useParams } from "next/navigation"
import {
  ArrowLeft, Clock, FileText, CheckCircle2, AlertCircle, Send,
  ListOrdered, Signal, Trophy, Calendar, PlayCircle, BarChart3,
  ChevronRight, BookOpen, Users, Info, UserX, UserCheck,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { useData } from "@/components/providers/data-provider"
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts"
import type { Exam, ExamUsage } from "@/lib/types"
import { examUsageApi, examResultApi } from "@/lib/api"
import { PrdAnnotation } from "@/components/prd-annotation"
import { getAnnotation } from "@/lib/prd-annotations"

/* ─── 状态颜色映射 ─── */
const statusConfig: Record<string, { bg: string; color: string; label: string }> = {
  draft: { bg: "#f5f6f7", color: "#8f959e", label: "草稿" },
  pending: { bg: "#dbeafe", color: "#3b82f6", label: "审核中" },
  rejected: { bg: "#fee2e2", color: "#dc2626", label: "已驳回" },
  approved: { bg: "#e0e7ff", color: "#4f46e5", label: "已通过" },
  published: { bg: "#dcfce7", color: "#16a34a", label: "已发布" },
}

const typeLabelMap: Record<string, string> = {
  single: "单选题",
  multiple: "多选题",
  judge: "判断题",
  fill: "填空题",
  essay: "问答题",
  short_answer: "简答题",
}

const pieColors = ["#2563eb", "#3b82f6", "#60a5fa", "#93c5fd", "#bfdbfe", "#dbeafe"]

function getExamTimeStatus(status?: string): { bg: string; color: string; label: string } {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    published: { label: "进行中", bg: "#dbeafe", color: "#2563eb" },
    draft: { label: "未开始", bg: "#fef3c7", color: "#d97706" },
    archived: { label: "已完成", bg: "#dcfce7", color: "#16a34a" },
    pending: { label: "审核中", bg: "#e0e7ff", color: "#4f46e5" },
    rejected: { label: "已驳回", bg: "#fee2e2", color: "#dc2626" },
  }
  return map[status || ""] || { label: "进行中", bg: "#dbeafe", color: "#2563eb" }
}

function getTargetAudience(): { type: string; detail: string } {
  // 考试对象名单由考试安排接口决定，当前不展示模拟学生
  return { type: "学生", detail: "由考试安排指定" }
}

export default function ExamDetailPage() {
  const params = useParams()
  const examId = params.id as string
  const { exams, getExam } = useData()

  const exam = getExam ? getExam(examId) : exams.find((e) => e.id === examId)

  const [started, setStarted] = useState(false)
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({})
  const [submitted, setSubmitted] = useState(false)
  const [timeLeft, setTimeLeft] = useState(0)
  const [examAccessState, setExamAccessState] = useState<'not-in-range' | 'not-started' | 'started'>('started')
  const [showAudienceDialog, setShowAudienceDialog] = useState(false)
  const [usages, setUsages] = useState<ExamUsage[]>([])
  const [currentUsage, setCurrentUsage] = useState<ExamUsage | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!examId) return
    examUsageApi
      .list({ examId })
      .then((res) => {
        const items = res.items || []
        setUsages(items)
        if (items.length > 0 && !currentUsage) setCurrentUsage(items[0])
      })
      .catch(() => {})
  }, [examId])

  const handleSubmit = useCallback(async () => {
    if (!currentUsage) return
    setSubmitting(true)
    try {
      await examResultApi.submit({ examUsageId: currentUsage.id, answers })
      setSubmitted(true)
    } catch {
      alert("提交失败，请重试")
    } finally {
      setSubmitting(false)
    }
  }, [currentUsage, answers])

  useEffect(() => {
    if (started && exam && !submitted) {
      setTimeLeft(exam.duration * 60)
      const timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) { clearInterval(timer); handleSubmit(); return 0 }
          return prev - 1
        })
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [started, exam, submitted, handleSubmit])

  if (!exam) {
    return (
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: 24 }}>
        <div style={{ textAlign: "center", padding: "80px 0", color: "#8f959e" }}>
          <AlertCircle style={{ width: 48, height: 48, margin: "0 auto 12px", opacity: 0.3 }} />
          <p>考试不存在或已删除</p>
          <Link href="/evaluation/landing/exams">
            <Button variant="outline" size="sm" style={{ marginTop: 16 }}>返回考试列表</Button>
          </Link>
        </div>
      </div>
    )
  }

  const cfg = statusConfig[exam.status] || statusConfig.draft
  const totalScore = exam.questions.reduce((s, q) => s + (q.score || 0), 0)
  const answeredCount = Object.keys(answers).length
  const timeStatus = getExamTimeStatus(exam.status)
  const targetAudience = getTargetAudience()

  const questionTypeStats = useMemo(() => {
    const stats: Record<string, { count: number; score: number }> = {}
    exam.questions.forEach((q) => {
      const label = typeLabelMap[q.type] || q.type
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
  }, [exam.questions])

  const handleSingle = (qid: string, val: string) => setAnswers((p) => ({ ...p, [qid]: val }))
  const handleMultiple = (qid: string, opt: string, checked: boolean) => {
    setAnswers((p) => {
      const cur = (p[qid] as string[]) || []
      return { ...p, [qid]: checked ? [...cur, opt] : cur.filter((o) => o !== opt) }
    })
  }
  const handleEssay = (qid: string, val: string) => setAnswers((p) => ({ ...p, [qid]: val }))

  const fmtTime = (sec: number) => {
    const m = Math.floor(sec / 60), s = sec % 60
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
  }

  /* ─── 提交成功 ─── */
  if (submitted) {
    return (
      <PrdAnnotation data={getAnnotation("le-page")}>
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: 24 }}>
        <div style={{ marginBottom: 24 }}>
          <Link href="/evaluation/landing/exams">
            <Button variant="ghost" size="sm" style={{ gap: 6 }}>
              <ArrowLeft style={{ width: 16, height: 16 }} /> 返回考试列表
            </Button>
          </Link>
        </div>
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e6eb", padding: 48, textAlign: "center" }}>
          <CheckCircle2 style={{ width: 64, height: 64, color: "#34c759", margin: "0 auto 16px" }} />
          <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>试卷已提交</h2>
          <p style={{ color: "#8f959e" }}>感谢您的参与，考试结果将在阅卷完成后公布。</p>
          <div style={{ marginTop: 24 }}>
            <Link href="/evaluation/landing/exams">
              <Button variant="outline">返回考试列表</Button>
            </Link>
          </div>
        </div>
      </div>
      </PrdAnnotation>
    )
  }

  /* ─── 答题中 ─── */
  if (started) {
    return (
      <PrdAnnotation data={getAnnotation("le-page")}>
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <h1 style={{ fontSize: 18, fontWeight: 700 }}>{exam.name}</h1>
          <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 14 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 4, color: timeLeft < 300 ? "#dc2626" : "#8f959e" }}>
              <Clock style={{ width: 16, height: 16 }} /> 剩余 {fmtTime(timeLeft)}
            </span>
            <span style={{ color: "#8f959e" }}>已答 {answeredCount} / {exam.questions.length} 题</span>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 24 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {exam.questions.map((q, idx) => (
              <div key={q.id} style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e6eb", padding: 24 }}>
                <div style={{ marginBottom: 16 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "#8f959e" }}>{idx + 1}. </span>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{q.content}</span>
                  <span style={{ marginLeft: 8, fontSize: 12, color: "#8f959e" }}>（{q.score} 分）</span>
                </div>
                {q.type === "single" && q.options && (
                  <RadioGroup value={(answers[q.id] as string) || ""} onValueChange={(v) => handleSingle(q.id, v)}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {q.options.map((opt) => (
                        <label key={opt} style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, borderRadius: 8, border: "1px solid #e5e6eb", cursor: "pointer", transition: "background 0.2s" }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = "#f5f6f7" }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent" }}>
                          <RadioGroupItem value={opt} />
                          <span style={{ fontSize: 14 }}>{opt}</span>
                        </label>
                      ))}
                    </div>
                  </RadioGroup>
                )}
                {q.type === "multiple" && q.options && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {q.options.map((opt) => (
                      <label key={opt} style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, borderRadius: 8, border: "1px solid #e5e6eb", cursor: "pointer", transition: "background 0.2s" }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = "#f5f6f7" }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent" }}>
                        <Checkbox checked={((answers[q.id] as string[]) || []).includes(opt)} onCheckedChange={(c) => handleMultiple(q.id, opt, c as boolean)} />
                        <span style={{ fontSize: 14 }}>{opt}</span>
                      </label>
                    ))}
                  </div>
                )}
                {(q.type === "essay" || q.type === "short_answer" || q.type === "fill" || q.type === "judge") && (
                  <Textarea placeholder="请输入您的答案..." rows={4} value={(answers[q.id] as string) || ""} onChange={(e) => handleEssay(q.id, e.target.value)} />
                )}
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "center", marginTop: 8 }}>
              <Button size="lg" style={{ gap: 8 }} onClick={handleSubmit} disabled={!currentUsage || submitting}>
                <Send style={{ width: 20, height: 20 }} /> {submitting ? "提交中..." : "提交试卷"}
              </Button>
            </div>
          </div>

          {/* 答题卡 */}
          <div style={{ position: "sticky", top: 80, alignSelf: "flex-start", background: "#fff", borderRadius: 12, border: "1px solid #e5e6eb", padding: 20 }}>
            <h4 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>答题卡</h4>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
              {exam.questions.map((q, i) => (
                <div key={q.id} style={{
                  width: 36, height: 36, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13, fontWeight: 500, cursor: "pointer",
                  background: answers[q.id] ? "#3370ff" : "#f5f6f7",
                  color: answers[q.id] ? "white" : "#646a73",
                  border: "none",
                }}>
                  {i + 1}
                </div>
              ))}
            </div>
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #e5e6eb", fontSize: 13, color: "#8f959e" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ width: 12, height: 12, borderRadius: 4, background: "#3370ff" }} />
                已答 {answeredCount} 题
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 12, height: 12, borderRadius: 4, background: "#f5f6f7", border: "1px solid #e5e6eb" }} />
                未答 {exam.questions.length - answeredCount} 题
              </div>
            </div>
          </div>
        </div>
      </div>
      </PrdAnnotation>
    )
  }

  /* ─── 概览页 ─── */
  return (
    <PrdAnnotation data={getAnnotation("le-page")}>
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <Link href="/evaluation/landing/exams">
          <Button variant="ghost" size="sm" style={{ gap: 6 }}>
            <ArrowLeft style={{ width: 16, height: 16 }} /> 返回考试列表
          </Button>
        </Link>
      </div>

      {/* 主信息 */}
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e6eb", overflow: "hidden", marginBottom: 24 }}>
        <div style={{ padding: "24px 32px", background: "linear-gradient(135deg, #3370ff, #7c3aed)", color: "white", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <PrdAnnotation data={getAnnotation("le-title")}>
              <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>{exam.name}</h1>
            </PrdAnnotation>
            <PrdAnnotation data={getAnnotation("le-desc")}>
              <p style={{ fontSize: 14, opacity: 0.9 }}>{exam.description}</p>
            </PrdAnnotation>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <PrdAnnotation data={getAnnotation("le-status")}>
              <PrdAnnotation data={getAnnotation("le-time-status")}>
                <span style={{ padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 500, background: timeStatus.bg, color: timeStatus.color }}>
                  {timeStatus.label}
                </span>
              </PrdAnnotation>
            </PrdAnnotation>
          </div>
        </div>
        <div style={{ padding: "24px 32px", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 24 }}>
          {[
            { icon: <Clock style={{ width: 18, height: 18 }} />, label: "考试时长", value: `${exam.duration} 分钟` },
            { icon: <ListOrdered style={{ width: 18, height: 18 }} />, label: "题目数量", value: `${exam.questions.length} 题` },
            { icon: <BarChart3 style={{ width: 18, height: 18 }} />, label: "总分", value: `${totalScore} 分` },
            { icon: <Users style={{ width: 18, height: 18 }} />, label: "考试对象", value: `${targetAudience.type}（${targetAudience.detail}）`, clickable: examAccessState === 'not-in-range', key: 'audience' }
          ].map((item, i) => (
            <PrdAnnotation key={i} data={getAnnotation(["le-duration", "le-question-count", "le-total-score", "le-target"][i])}>
              <div
                style={{
                  textAlign: "center",
                  padding: "16px 0",
                  background: item.clickable ? "#fff7ed" : "#f5f6f7",
                  borderRadius: 8,
                  cursor: item.clickable ? "pointer" : "default",
                  border: item.clickable ? "1px dashed #f97316" : "1px solid transparent",
                  transition: "all 0.2s",
                }}
                onClick={() => item.clickable && setShowAudienceDialog(true)}
                onMouseEnter={(e) => { if (item.clickable) { e.currentTarget.style.background = "#ffedd5" } }}
                onMouseLeave={(e) => { if (item.clickable) { e.currentTarget.style.background = "#fff7ed" } }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, color: item.clickable ? "#f97316" : "#3370ff", marginBottom: 6 }}>
                  {item.icon} <span style={{ fontSize: 13, fontWeight: 500 }}>{item.label}</span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, padding: "0 8px", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                  {item.value}
                  {item.clickable && <Info style={{ width: 14, height: 14, opacity: 0.7 }} />}
                </div>
                {item.clickable && (
                  <div style={{ fontSize: 11, color: "#f97316", marginTop: 4 }}>点击查看范围详情</div>
                )}
              </div>
            </PrdAnnotation>
          ))}
        </div>
      </div>

      {/* 考试概览 + 考试须知 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e6eb", padding: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
            <FileText style={{ width: 18, height: 18, color: "#3370ff" }} /> 考试概览
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {questionTypeStats.length > 0 ? (
              <>
                <div style={{ width: "100%", height: 220 }}>
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
                        label={({ name, score }) => `${name}: ${score}分`}
                      >
                        {questionTypeStats.map((entry: typeof questionTypeStats[0], index: number) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number, name: string, props: any) => [`${value}题 / ${props.payload.score}分`, name]} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <PrdAnnotation data={getAnnotation("le-question-list")}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    {questionTypeStats.map((stat: typeof questionTypeStats[0]) => (
                      <div key={stat.name} style={{ display: "flex", alignItems: "center", gap: 8, padding: 10, background: "#f5f6f7", borderRadius: 8 }}>
                        <span style={{ width: 10, height: 10, borderRadius: "50%", background: stat.color, flexShrink: 0 }} />
                        <span style={{ fontSize: 13, color: "#1f2329" }}>{stat.name}</span>
                        <span style={{ fontSize: 12, color: "#8f959e", marginLeft: "auto" }}>{stat.count}题 / {stat.score}分</span>
                      </div>
                    ))}
                  </div>
                </PrdAnnotation>
              </>
            ) : (
              <div style={{ textAlign: "center", fontSize: 13, color: "#8f959e", padding: 20 }}>暂无题目数据</div>
            )}
          </div>
        </div>

        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e6eb", padding: 24 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
              <BookOpen style={{ width: 18, height: 18, color: "#3370ff" }} /> 考试须知
            </h3>
            <Select value={examAccessState} onValueChange={(v) => setExamAccessState(v as typeof examAccessState)}>
              <SelectTrigger className="w-[140px] h-8 text-xs" style={{ background: "#f5f6f7", border: "1px solid #e5e6eb" }}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="not-in-range">不在范围</SelectItem>
                <SelectItem value="not-started">考试未开始</SelectItem>
                <SelectItem value="started">考试已开始</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 14, color: "#646a73" }}>
            <p>1. 请在规定时间内完成所有题目，超时将自动提交。</p>
            <p>2. 单选题每题只有一个正确答案，多选题有多个正确答案。</p>
            <p>3. 答题过程中请勿刷新页面或关闭浏览器。</p>
            <p>4. 提交后无法修改答案，请确认后再提交。</p>
            <p>5. 考试期间系统将自动保存答题进度。</p>
          </div>
          <div style={{ marginTop: 24, display: "flex", justifyContent: "center" }}>
            <PrdAnnotation data={getAnnotation("le-start-btn")}>
              {examAccessState === 'started' && exam.status === "published" && currentUsage ? (
                <Button size="lg" style={{ gap: 8, background: "#3370ff" }} onClick={() => setStarted(true)}>
                  <PlayCircle style={{ width: 20, height: 20 }} /> 开始考试
                </Button>
              ) : (
                <Button size="lg" variant="outline" disabled style={{ gap: 8 }}>
                  <PlayCircle style={{ width: 20, height: 20 }} />
                  {!currentUsage ? '暂无考试安排' : examAccessState === 'not-in-range' ? '您不在本次考试范围内' : examAccessState === 'not-started' ? '考试尚未开始' : exam.status === "draft" || exam.status === "pending" || exam.status === "rejected" || exam.status === "approved" ? "考试未发布" : "考试已结束"}
                </Button>
              )}
            </PrdAnnotation>
          </div>
        </div>
      </div>

      {/* 考试对象名单弹窗 */}
      <Dialog open={showAudienceDialog} onOpenChange={setShowAudienceDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>考试范围详情</DialogTitle>
            <DialogDescription>
              本次考试面向 {targetAudience.type}：{targetAudience.detail}
            </DialogDescription>
          </DialogHeader>
          <div className="py-6 text-center text-sm text-muted-foreground">
            参考人员名单由管理员在考试安排中指定，暂无明细数据。
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </PrdAnnotation>
  )
}
