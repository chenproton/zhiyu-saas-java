"use client"

import Link from "next/link"
import { useMemo } from "react"
import { useParams, useSearchParams } from "next/navigation"
import {
  ArrowLeft, FileText, ListOrdered, Clock, Signal,
  BarChart3, BookOpen,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useData } from "@/components/providers/data-provider"
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { PrdAnnotation } from "@/components/prd-annotation"
import { getAnnotation } from "@/lib/prd-annotations"

const typeLabelMap: Record<string, string> = {
  single: "单选题",
  multiple: "多选题",
  judge: "判断题",
  fill: "填空题",
  essay: "问答题",
  short_answer: "简答题",
}

const pieColors = ["#d97706", "#f59e0b", "#fbbf24", "#fcd34d", "#fde68a", "#fef3c7"]

export default function PaperDetailPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const paperId = params.id as string
  const returnUrl = searchParams.get("returnUrl")
  const { exams } = useData()

  const paper = exams.find((e) => e.id === paperId)

  if (!paper) {
    return (
      <PrdAnnotation data={getAnnotation("lpr-page")}>
        <div style={{ maxWidth: 1400, margin: "0 auto", padding: 24 }}>
          <Link href="/evaluation/landing/resources">
            <Button variant="ghost" size="sm" style={{ gap: 6 }}>
              <ArrowLeft style={{ width: 16, height: 16 }} /> 返回资源库
            </Button>
          </Link>
          <div style={{ textAlign: "center", padding: "80px 0", color: "#8f959e" }}>
            <FileText style={{ width: 48, height: 48, margin: "0 auto 12px", opacity: 0.3 }} />
            <p>试卷不存在</p>
          </div>
        </div>
      </PrdAnnotation>
    )
  }

  const statusMap: Record<string, { bg: string; color: string; label: string }> = {
    draft: { bg: "#f5f6f7", color: "#8f959e", label: "草稿" },
    pending: { bg: "#dbeafe", color: "#3b82f6", label: "审核中" },
    rejected: { bg: "#fee2e2", color: "#dc2626", label: "已驳回" },
    approved: { bg: "#e0e7ff", color: "#4f46e5", label: "已通过" },
    published: { bg: "#dcfce7", color: "#16a34a", label: "已发布" },
  }
  const st = statusMap[paper.status] || statusMap.draft
  const totalScore = paper.questions.reduce((s, q) => s + (q.score || 0), 0)

  const typeLabels: Record<string, string> = {
    single: "单选题", multiple: "多选题", judge: "判断题",
    fill: "填空题", essay: "论述题", short_answer: "简答题",
  }

  const questionTypeStats = useMemo(() => {
    const stats: Record<string, { count: number; score: number }> = {}
    paper.questions.forEach((q) => {
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
  }, [paper.questions])

  return (
    <PrdAnnotation data={getAnnotation("lpr-page")}>
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: 24 }}>
        <div style={{ marginBottom: 24 }}>
          <Link href={returnUrl || "/landingpage/resources"}>
            <Button variant="ghost" size="sm" style={{ gap: 6 }}>
              <ArrowLeft style={{ width: 16, height: 16 }} /> {returnUrl ? "返回" : "返回资源库"}
            </Button>
          </Link>
        </div>

        {/* 头部 */}
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e6eb", overflow: "hidden", marginBottom: 24 }}>
          <div style={{ padding: "24px 32px", background: "linear-gradient(135deg, #f59e0b, #fbbf24)", color: "white", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <PrdAnnotation data={getAnnotation("lpr-title")}>
                <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>{paper.name}</h1>
              </PrdAnnotation>
              <PrdAnnotation data={getAnnotation("lpr-desc")}>
                <p style={{ fontSize: 14, opacity: 0.9 }}>{paper.description}</p>
              </PrdAnnotation>
            </div>
            <PrdAnnotation data={getAnnotation("lpr-status")}>
              <span style={{ padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 500, background: "rgba(255,255,255,0.2)" }}>
                {st.label}
              </span>
            </PrdAnnotation>
          </div>
          <div style={{ padding: "24px 32px", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 24 }}>
            <PrdAnnotation data={getAnnotation("lpr-duration")}>
              <div style={{ textAlign: "center", padding: "16px 0", background: "#f5f6f7", borderRadius: 8 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, color: "#f59e0b", marginBottom: 6 }}>
                  <Clock style={{ width: 18, height: 18 }} /> <span style={{ fontSize: 13, fontWeight: 500 }}>考试时长</span>
                </div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{paper.duration} 分钟</div>
              </div>
            </PrdAnnotation>
            <PrdAnnotation data={getAnnotation("lpr-question-count")}>
              <div style={{ textAlign: "center", padding: "16px 0", background: "#f5f6f7", borderRadius: 8 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, color: "#f59e0b", marginBottom: 6 }}>
                  <ListOrdered style={{ width: 18, height: 18 }} /> <span style={{ fontSize: 13, fontWeight: 500 }}>题目数量</span>
                </div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{paper.questions.length} 题</div>
              </div>
            </PrdAnnotation>
            <PrdAnnotation data={getAnnotation("lpr-total-score")}>
              <div style={{ textAlign: "center", padding: "16px 0", background: "#f5f6f7", borderRadius: 8 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, color: "#f59e0b", marginBottom: 6 }}>
                  <BarChart3 style={{ width: 18, height: 18 }} /> <span style={{ fontSize: 13, fontWeight: 500 }}>总分</span>
                </div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{totalScore} 分</div>
              </div>
            </PrdAnnotation>
            <PrdAnnotation data={getAnnotation("lpr-version")}>
              <div style={{ textAlign: "center", padding: "16px 0", background: "#f5f6f7", borderRadius: 8 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, color: "#f59e0b", marginBottom: 6 }}>
                  <Signal style={{ width: 18, height: 18 }} /> <span style={{ fontSize: 13, fontWeight: 500 }}>版本</span>
                </div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{paper.version}</div>
              </div>
            </PrdAnnotation>
          </div>
        </div>

        {/* 试卷信息 — 全宽，饼图+标签横向 */}
        <PrdAnnotation data={getAnnotation("lpr-type-stats")}>
          <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e6eb", padding: 24, marginBottom: 24 }}>
            <h4 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>试卷信息</h4>
            {questionTypeStats.length > 0 ? (
              <div style={{ display: "flex", gap: 48, alignItems: "center", justifyContent: "center", flexWrap: "wrap" }}>
                {/* 饼图 */}
                <div style={{ width: 280, height: 220, flexShrink: 0 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={questionTypeStats}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={75}
                        paddingAngle={3}
                        dataKey="value"
                        nameKey="name"
                        label={({ name, score }) => `${name}: ${score}分`}
                      >
                        {questionTypeStats.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number, name: string, props: any) => [`${value}题 / ${props.payload.score}分`, name]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                {/* 标签 */}
                <div style={{ width: 320, flexShrink: 0, display: "flex", flexDirection: "column", gap: 10, justifyContent: "center" }}>
                  {questionTypeStats.map((stat) => (
                    <div key={stat.name} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "#f5f6f7", borderRadius: 8 }}>
                      <span style={{ width: 10, height: 10, borderRadius: "50%", background: stat.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 13, color: "#1f2329" }}>{stat.name}</span>
                      <span style={{ fontSize: 12, color: "#8f959e", marginLeft: "auto" }}>{stat.count}题 / {stat.score}分</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ textAlign: "center", fontSize: 13, color: "#8f959e", padding: 20 }}>暂无题目数据</div>
            )}
          </div>
        </PrdAnnotation>

        {/* 题目概览 — 全宽 */}
        <PrdAnnotation data={getAnnotation("lpr-questions")}>
          <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e6eb", padding: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
              <BookOpen style={{ width: 18, height: 18, color: "#f59e0b" }} /> 题目概览
            </h3>
            {paper.questions.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: "#8f959e" }}>暂无题目数据</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {paper.questions.slice(0, 8).map((q, i) => (
                  <div key={q.id} style={{ padding: 14, background: "#f5f6f7", borderRadius: 8 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                      <span style={{ width: 22, height: 22, borderRadius: "50%", background: "#f59e0b", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, flexShrink: 0 }}>{i + 1}</span>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: 14, fontWeight: 500 }} dangerouslySetInnerHTML={{ __html: q.content }} />
                        <span style={{ marginLeft: 8, fontSize: 11, color: "#8f959e" }}>({typeLabels[q.type] || q.type} · {q.score}分)</span>
                      </div>
                    </div>
                  </div>
                ))}
                {paper.questions.length > 8 && (
                  <div style={{ textAlign: "center", fontSize: 13, color: "#8f959e", padding: 8 }}>
                    共 {paper.questions.length} 题，登录后查看全部
                  </div>
                )}
              </div>
            )}
          </div>
        </PrdAnnotation>
      </div>
    </PrdAnnotation>
  )
}
