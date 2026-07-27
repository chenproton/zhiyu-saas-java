"use client"

import Link from "next/link"
import { useState, useEffect, useMemo } from "react"
import {
  Clock, FileText, Search, Layers, Library, ClipboardList, Loader2,
} from "lucide-react"
import { questionBankApi, examApi } from "@/lib/api"
import type { QuestionBank, Exam } from "@/lib/types"

function SectionHeader({ title, moreHref }: { title: string; moreHref?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 20 }}>
      <h2 style={{ fontSize: 20, fontWeight: "bold", color: "#1e293b", position: "relative", paddingLeft: 12 }}>
        <span style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)", width: 4, height: 20, background: "linear-gradient(180deg, #2563eb, #3b82f6)", borderRadius: 2 }} />
        {title}
      </h2>
      {moreHref && (
        <Link href={moreHref} style={{ color: "#2563eb", fontSize: 13, textDecoration: "none" }}
          onMouseEnter={(e) => { e.currentTarget.style.textDecoration = "underline" }}
          onMouseLeave={(e) => { e.currentTarget.style.textDecoration = "none" }}>
          查看全部 ›
        </Link>
      )}
    </div>
  )
}

const coverGradients = [
  "linear-gradient(135deg, #2563eb, #3b82f6)",
  "linear-gradient(135deg, #7c3aed, #8b5cf6)",
  "linear-gradient(135deg, #059669, #10b981)",
  "linear-gradient(135deg, #db2777, #ec4899)",
  "linear-gradient(135deg, #ea580c, #f97316)",
  "linear-gradient(135deg, #0891b2, #06b6d4)",
]

export default function LandingHomePage() {
  const [banks, setBanks] = useState<QuestionBank[]>([])
  const [exams, setExams] = useState<Exam[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  useEffect(() => {
    setLoading(true)
    Promise.all([
      questionBankApi.list({ limit: 100 }).then((res) => setBanks(res.items || [])),
      examApi.list({ limit: 100 }).then((res) => setExams(res.items || [])),
    ]).catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const publishedBanks = useMemo(
    () => banks.filter((b) => b.status === "published"),
    [banks]
  )
  const publishedExams = useMemo(
    () => exams.filter((e) => e.status === "published"),
    [exams]
  )
  const totalQuestions = useMemo(
    () => banks.reduce((sum, b) => sum + (b.questionCount || 0), 0),
    [banks]
  )

  const stats = [
    { num: publishedBanks.length, label: "已发布题库", icon: <Library className="h-5 w-5" /> },
    { num: publishedExams.length, label: "已发布试卷", icon: <ClipboardList className="h-5 w-5" /> },
    { num: totalQuestions, label: "题目总数", icon: <FileText className="h-5 w-5" /> },
  ]

  const filteredExams = useMemo(() => {
    if (!search) return publishedExams.slice(0, 4)
    const q = search.toLowerCase()
    return publishedExams.filter((e) =>
      e.name.toLowerCase().includes(q) || (e.description || "").toLowerCase().includes(q)
    ).slice(0, 4)
  }, [publishedExams, search])

  const filteredBanks = useMemo(() => {
    if (!search) return publishedBanks.slice(0, 4)
    const q = search.toLowerCase()
    return publishedBanks.filter((b) =>
      b.name.toLowerCase().includes(q) || (b.description || "").toLowerCase().includes(q)
    ).slice(0, 4)
  }, [publishedBanks, search])

  return (
    <div>
      <div style={{
        background: "linear-gradient(135deg, #1e3a5f 0%, #2d5a87 40%, #3b82f6 100%)",
        color: "#fff", padding: "60px 20px 50px", textAlign: "center", position: "relative", overflow: "hidden", minHeight: 340,
      }}>
        <div style={{ maxWidth: 640, margin: "0 auto", position: "relative", zIndex: 1 }}>
          <h1 style={{ fontSize: 40, fontWeight: "bold", marginBottom: 12, letterSpacing: 1 }}>测评资源平台</h1>
          <p style={{ fontSize: 15, opacity: 0.85, marginBottom: 28 }}>海量题库与试卷资源，支持在线考试与智能组卷，助力教学测评</p>
          <div style={{
            background: "#fff", borderRadius: 50, padding: "5px 5px 5px 24px",
            display: "flex", alignItems: "center", boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
          }}>
            <Search style={{ width: 18, height: 18, color: "#94a3b8", marginRight: 10 }} />
            <input type="text" placeholder="搜索题库、试卷名称"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ flex: 1, border: "none", outline: "none", fontSize: 14, padding: "12px 0", color: "#333", background: "transparent" }} />
            <button style={{
              background: "linear-gradient(135deg, #2563eb, #3b82f6)", color: "#fff", border: "none",
              padding: "11px 32px", borderRadius: 50, cursor: "pointer", fontSize: 14, fontWeight: 500,
            }}>搜索</button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "40px 20px 0" }}>

        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 80 }}>
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : (
          <>
            <section style={{ marginBottom: 50 }}>
              <div style={{
                background: "#fff", borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", padding: 24,
                display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20,
              }}>
                {stats.map((s, i) => (
                  <div key={i} style={{ textAlign: "center", borderRight: i < stats.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                    <div style={{ display: "flex", justifyContent: "center", marginBottom: 8, color: "#2563eb" }}>{s.icon}</div>
                    <div style={{ fontSize: 28, fontWeight: "bold", color: "#2563eb", lineHeight: 1.2 }}>{s.num}</div>
                    <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 6 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </section>

            <section style={{ marginBottom: 50 }}>
              <SectionHeader title="题库中心" />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20 }}>
                {filteredBanks.map((bank, i) => (
                  <div key={bank.id} style={{
                    background: "#fff", borderRadius: 10, overflow: "hidden",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.06)", transition: "all 0.25s", cursor: "default",
                  }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 8px 16px rgba(0,0,0,0.08)" }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.06)" }}>
                    <div style={{
                      height: 100, background: coverGradients[i % coverGradients.length],
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: "#fff", fontSize: 18, fontWeight: "bold",
                    }}>
                      <Library className="h-10 w-10" />
                    </div>
                    <div style={{ padding: 16 }}>
                      <h3 style={{ fontSize: 15, marginBottom: 8, color: "#1e293b", fontWeight: 600 }}>{bank.name}</h3>
                      <p style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.6, marginBottom: 12, height: 36, overflow: "hidden" }}>
                        {bank.description || "暂无描述"}
                      </p>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 12, color: "#64748b" }}>
                        <span className="flex items-center gap-1"><FileText className="h-3 w-3" /> {bank.questionCount} 题</span>
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> v{bank.version}</span>
                        {bank.creatorName && <span className="flex items-center gap-1"><Layers className="h-3 w-3" /> {bank.creatorName}</span>}
                        <span style={{ color: "#94a3b8" }}>{new Date(bank.createdAt).toLocaleDateString("zh-CN")}</span>
                      </div>
                    </div>
                  </div>
                ))}
                {filteredBanks.length === 0 && (
                  <div style={{ gridColumn: "span 4", textAlign: "center", padding: 40, color: "#94a3b8", background: "#fff", borderRadius: 10 }}>暂无已发布题库</div>
                )}
              </div>
            </section>

            <section style={{ marginBottom: 50 }}>
              <SectionHeader title="试卷中心" moreHref="/evaluation/landing/exams" />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20 }}>
                {filteredExams.map((exam, i) => (
                  <Link key={exam.id} href={`/evaluation/landing/exams/${exam.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                    <div style={{
                      background: "#fff", borderRadius: 10, overflow: "hidden",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.06)", transition: "all 0.25s", cursor: "pointer",
                    }}
                      onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 8px 16px rgba(0,0,0,0.08)" }}
                      onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.06)" }}>
                      <div style={{
                        height: 100, background: coverGradients[(i + 3) % coverGradients.length],
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: "#fff", fontSize: 18, fontWeight: "bold",
                      }}>
                        <ClipboardList className="h-10 w-10" />
                      </div>
                      <div style={{ padding: 16 }}>
                        <h3 style={{ fontSize: 15, marginBottom: 8, color: "#1e293b", fontWeight: 600 }}>{exam.name}</h3>
                        <p style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.6, marginBottom: 12, height: 36, overflow: "hidden" }}>
                          {exam.description || "暂无描述"}
                        </p>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 12, color: "#64748b" }}>
                          <span className="flex items-center gap-1"><FileText className="h-3 w-3" /> {exam.questions.length} 题</span>
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {exam.duration} 分钟</span>
                          <span>总分 {exam.totalScore}</span>
                          {exam.creatorName && <span>{exam.creatorName}</span>}
                        </div>
                        <div style={{ marginTop: 12 }}>
                          <span style={{
                            display: "block", width: "100%", borderRadius: 8, padding: "8px 0",
                            textAlign: "center", fontSize: 14, fontWeight: 500,
                            background: "#2563eb", color: "#fff",
                          }}>去考试</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
                {filteredExams.length === 0 && (
                  <div style={{ gridColumn: "span 4", textAlign: "center", padding: 40, color: "#94a3b8", background: "#fff", borderRadius: 10 }}>暂无已发布试卷</div>
                )}
              </div>
            </section>
          </>
        )}

        <footer style={{ background: '#141a2e', marginTop: 60, width: '100vw', position: 'relative', left: 'calc(-50vw + 50%)' }}>
          <div style={{ height: 3, background: 'linear-gradient(90deg, #8b5cf6, #818cf8, #22d3ee)' }} />
          <div style={{ padding: '48px 5% 32px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 32, maxWidth: 1280, margin: '0 auto' }}>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: '#fff', marginBottom: 12 }}>场景化数智教学服务平台</h3>
                <p style={{ fontSize: 13, color: '#a8b3cf', lineHeight: 1.8, margin: 0 }}>专注职业教育数字化</p>
                <div style={{ fontSize: 12, color: '#6b7a99', marginTop: 8 }}>版本：V3.2.1</div>
                <a href="#" style={{ color: '#22d3ee', fontSize: 13, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 8 }}>访问官网 →</a>
              </div>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: '#fff', marginBottom: 12 }}>教学资源</h3>
                <p style={{ fontSize: 13, color: '#a8b3cf', lineHeight: 1.8, margin: 0 }}>岗位标准、实践场景、企业导师</p>
                <a href="#" style={{ color: '#22d3ee', fontSize: 13, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 8 }}>进入资源商城 →</a>
              </div>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: '#fff', marginBottom: 12 }}>技术支持</h3>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  <li style={{ fontSize: 13, color: '#a8b3cf', lineHeight: 1.8 }}>服务热线：400-888-8888</li>
                  <li style={{ fontSize: 13, color: '#a8b3cf', lineHeight: 1.8 }}>邮箱：support@example.com</li>
                  <li><a href="#" style={{ color: '#22d3ee', fontSize: 13, textDecoration: 'none' }}>使用手册</a></li>
                  <li><a href="#" style={{ color: '#22d3ee', fontSize: 13, textDecoration: 'none' }}>常见问题</a></li>
                </ul>
              </div>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: '#fff', marginBottom: 12 }}>校内支持</h3>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  <li style={{ fontSize: 13, color: '#a8b3cf', lineHeight: 1.8 }}>授权院校：XX职业技术学院</li>
                  <li style={{ fontSize: 13, color: '#a8b3cf', lineHeight: 1.8 }}>校内管理员：张老师</li>
                  <li style={{ fontSize: 13, color: '#a8b3cf', lineHeight: 1.8 }}>管理员电话：0000-12345678</li>
                </ul>
              </div>
            </div>
            <hr style={{ border: 'none', borderTop: '1px solid #29324a', margin: '40px 0 24px' }} />
            <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, fontSize: 12, color: '#6b7a99', maxWidth: 1280, margin: '0 auto' }}>
              <div>
                <a href="#" style={{ color: '#6b7a99', textDecoration: 'none' }}>隐私政策</a>
                <span style={{ color: '#29324a' }}>&nbsp;|&nbsp;</span>
                <a href="#" style={{ color: '#6b7a99', textDecoration: 'none' }}>用户协议</a>
              </div>
              <div style={{ textAlign: 'right' }}>版权所有 © 2020-2026 杭州知与未来科技有限公司 ｜ 软件著作权登记号：2020SR0123456 ｜ 京ICP备2025105397号-1</div>
            </div>
          </div>
        </footer>

      </div>
    </div>
  )
}
