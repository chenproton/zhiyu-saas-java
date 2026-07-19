"use client"

import { PrdAnnotation } from "@/components/prd-annotation"
import { getAnnotation } from "@/lib/prd-annotations"
import Link from "next/link"
import { useParams } from "next/navigation"
import {
  ArrowLeft, BookOpen, ListOrdered, User, Clock, Search,
  FileText, ChevronRight, Star, CheckCircle2, AlertCircle,
  Heart, Plus, Database,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useData } from "@/components/providers/data-provider"

export default function QuestionBankDetailPage() {
  const params = useParams()
  const bankId = params.id as string
  const { questionBanks, questions } = useData()

  const bank = questionBanks.find((b) => b.id === bankId)
  const bankQuestions = questions.filter((q) => q.bankId === bankId)

  if (!bank) {
    return (
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: 24 }}>
        <Link href="/evaluation/landing/resources">
          <Button variant="ghost" size="sm" style={{ gap: 6 }}>
            <ArrowLeft style={{ width: 16, height: 16 }} /> 返回资源库
          </Button>
        </Link>
        <div style={{ textAlign: "center", padding: "80px 0", color: "#8f959e" }}>
          <BookOpen style={{ width: 48, height: 48, margin: "0 auto 12px", opacity: 0.3 }} />
          <p>题库不存在</p>
        </div>
      </div>
    )
  }

  const statusMap: Record<string, { bg: string; color: string; label: string }> = {
    draft: { bg: "#f5f6f7", color: "#8f959e", label: "草稿" },
    pending: { bg: "#dbeafe", color: "#3b82f6", label: "审核中" },
    rejected: { bg: "#fee2e2", color: "#dc2626", label: "已驳回" },
    approved: { bg: "#e0e7ff", color: "#4f46e5", label: "已通过" },
    published: { bg: "#dcfce7", color: "#16a34a", label: "已发布" },
  }
  const st = statusMap[bank.status] || statusMap.draft

  const typeLabels: Record<string, string> = {
    single: "单选题", multiple: "多选题", judge: "判断题",
    fill: "填空题", essay: "论述题", short_answer: "简答题",
  }

  return (
    <PrdAnnotation data={getAnnotation("lb-page")}>
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <Link href="/evaluation/landing/resources">
          <Button variant="ghost" size="sm" style={{ gap: 6 }}>
            <ArrowLeft style={{ width: 16, height: 16 }} /> 返回资源库
          </Button>
        </Link>
      </div>

      {/* 头部 */}
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e6eb", overflow: "hidden", marginBottom: 24 }}>
        <div style={{ padding: "24px 32px", background: "linear-gradient(135deg, #3370ff, #60a5fa)", color: "white", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <PrdAnnotation data={getAnnotation("lb-title")}>
              <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>{bank.name}</h1>
            </PrdAnnotation>
            <PrdAnnotation data={getAnnotation("lb-desc")}>
              <p style={{ fontSize: 14, opacity: 0.9 }}>{bank.description}</p>
            </PrdAnnotation>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <PrdAnnotation data={getAnnotation("lb-apply-btn")}>
              <Button size="sm" style={{ gap: 6, background: "rgba(255,255,255,0.9)", color: "#3370ff" }}>
                <Plus style={{ width: 14, height: 14 }} /> 申请共建
              </Button>
            </PrdAnnotation>
            <PrdAnnotation data={getAnnotation("lb-fav-btn")}>
              <Button size="sm" variant="outline" style={{ gap: 6, borderColor: "rgba(255,255,255,0.5)", color: "#fff", background: "transparent" }}>
                <Heart style={{ width: 14, height: 14 }} /> 收藏题库
              </Button>
            </PrdAnnotation>
            {/* status tag removed */}
          </div>
        </div>
        <div style={{ padding: "24px 32px", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 24 }}>
          {[
            { icon: <ListOrdered style={{ width: 18, height: 18 }} />, label: "题目数量", value: `${bank.questionCount} 题`, aid: "lb-question-count" as const },
            { icon: <User style={{ width: 18, height: 18 }} />, label: "创建者", value: bank.creatorId || "系统", aid: "lb-creator" as const },
            { icon: <Clock style={{ width: 18, height: 18 }} />, label: "版本", value: bank.version, aid: "lb-version" as const },
            { icon: <Database style={{ width: 18, height: 18 }} />, label: "共建人", value: bank.creatorId || "-" },
          ].map((item, i) => {
            const inner = (
              <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, color: "#3370ff", marginBottom: 6 }}>
                  {item.icon} <span style={{ fontSize: 13, fontWeight: 500 }}>{item.label}</span>
                </div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{item.value}</div>
              </>
            )
            const wrapperStyle = { textAlign: "center" as const, padding: "16px 0", background: "#f5f6f7", borderRadius: 8 }
            return item.aid ? (
              <PrdAnnotation key={i} data={getAnnotation(item.aid)}>
                <div style={wrapperStyle}>{inner}</div>
              </PrdAnnotation>
            ) : (
              <div key={i} style={wrapperStyle}>{inner}</div>
            )
          })}
        </div>
      </div>

      {/* 题目预览 — 全宽 */}
      <PrdAnnotation data={getAnnotation("lb-questions")}>
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e6eb", padding: 24 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <FileText style={{ width: 18, height: 18, color: "#3370ff" }} /> 题目预览
        </h3>
        {bankQuestions.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40, color: "#8f959e" }}>暂无题目数据</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {bankQuestions.slice(0, 8).map((q, i) => (
              <div key={q.id} style={{ padding: 14, background: "#f5f6f7", borderRadius: 8 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
                  <span style={{ width: 22, height: 22, borderRadius: "50%", background: "#3370ff", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, flexShrink: 0 }}>{i + 1}</span>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 14, fontWeight: 500 }}>{q.content}</span>

                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <Badge variant="outline" style={{ fontSize: 10 }}>{typeLabels[q.type] || q.type}</Badge>
                  {q.difficulty && <Badge variant="outline" style={{ fontSize: 10, color: q.difficulty === "easy" ? "#16a34a" : q.difficulty === "hard" ? "#dc2626" : "#f59e0b" }}>{q.difficulty === "easy" ? "简单" : q.difficulty === "hard" ? "困难" : "中等"}</Badge>}
                  {q.knowledgePoints?.map((kp, j) => (
                    <span key={j} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: "#f0f5ff", color: "#3370ff" }}>{kp}</span>
                  ))}
                </div>
                {q.options && q.options.length > 0 && (
                  <div style={{ marginTop: 8, paddingLeft: 32, display: "flex", flexDirection: "column", gap: 4 }}>
                    {q.options.map((opt, j) => (
                      <span key={j} style={{ fontSize: 13, color: "#646a73" }}>{String.fromCharCode(65 + j)}. {opt}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {bankQuestions.length > 8 && (
              <div style={{ textAlign: "center", fontSize: 13, color: "#8f959e", padding: 8 }}>
                共 {bankQuestions.length} 题，{bank.ownerType === "public" ? "登录后查看全部" : "查看更多题目"}
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
