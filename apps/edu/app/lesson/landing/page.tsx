"use client"

import { useState, useEffect, useMemo } from "react"
import {
  BookOpen, GraduationCap, FileText, Search, Layers,
  Clock, Users, BarChart3, MapPin, Loader2, AlertCircle,
} from "lucide-react"
import { courseApi } from "@/lib/api"
import type { Course } from "@/lib/types"

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <h2 style={{ fontSize: 20, fontWeight: "bold", color: "#1e293b", position: "relative", paddingLeft: 12 }}>
          <span style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)", width: 4, height: 20, background: "linear-gradient(180deg, #059669, #10b981)", borderRadius: 2 }} />
          {title}
        </h2>
        {subtitle && <span style={{ color: "#94a3b8", fontSize: 13 }}>{subtitle}</span>}
      </div>
    </div>
  )
}

const courseTypeMap: Record<string, string> = {
  system: "体系课", granular: "颗粒课", hybrid: "混合课",
}

const coverGradients = [
  "linear-gradient(135deg, #059669, #10b981)",
  "linear-gradient(135deg, #0891b2, #06b6d4)",
  "linear-gradient(135deg, #7c3aed, #8b5cf6)",
  "linear-gradient(135deg, #db2777, #ec4899)",
  "linear-gradient(135deg, #ea580c, #f97316)",
  "linear-gradient(135deg, #2563eb, #3b82f6)",
]

export default function LessonLandingPage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [search, setSearch] = useState("")

  useEffect(() => {
    setLoading(true)
    setError(false)
    courseApi.list({ limit: 100 }).then((res) => {
      setCourses(res.items || [])
    }).catch(() => {
      setError(true)
    }).finally(() => {
      setLoading(false)
    })
  }, [])

  const filteredCourses = useMemo(() => {
    if (!search.trim()) return courses
    const q = search.toLowerCase()
    return courses.filter((c) =>
      c.name.toLowerCase().includes(q) ||
      (c.description || "").toLowerCase().includes(q) ||
      (c.majorName || "").toLowerCase().includes(q)
    )
  }, [courses, search])

  const publishedCourses = useMemo(
    () => filteredCourses.filter((c) => c.status === "published").slice(0, 6),
    [filteredCourses]
  )
  const totalNodes = courses.reduce((sum, c) => sum + (c.nodeCount || 0), 0)
  const totalResources = courses.reduce((sum, c) => sum + (c.resourceCount || 0), 0)

  const stats = [
    { num: courses.length, label: "课程数量", icon: <BookOpen className="h-5 w-5" /> },
    { num: publishedCourses.length, label: "已发布课程", icon: <GraduationCap className="h-5 w-5" /> },
    { num: totalNodes, label: "课程节点", icon: <Layers className="h-5 w-5" /> },
    { num: totalResources, label: "教学资源", icon: <FileText className="h-5 w-5" /> },
  ]

  return (
    <div>
      {/* ═══ Hero Banner ═══ */}
      <div style={{
        background: "linear-gradient(135deg, #064e3b 0%, #047857 40%, #059669 100%)",
        color: "#fff", padding: "60px 20px 50px", textAlign: "center", position: "relative", overflow: "hidden", minHeight: 340,
      }}>
        <div style={{ maxWidth: 640, margin: "0 auto", position: "relative", zIndex: 1 }}>
          <h1 style={{ fontSize: 40, fontWeight: "bold", marginBottom: 12, letterSpacing: 1 }}>课程教学管理平台</h1>
          <p style={{ fontSize: 15, opacity: 0.85, marginBottom: 28 }}>体系化课程设计、颗粒化知识点管理、多维度教学资源整合，让教与学更高效</p>
          <div style={{
            background: "#fff", borderRadius: 50, padding: "5px 5px 5px 24px",
            display: "flex", alignItems: "center", boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
          }}>
            <Search style={{ width: 18, height: 18, color: "#94a3b8", marginRight: 10 }} />
            <input
              type="text"
              placeholder="搜索课程名称、描述、专业"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ flex: 1, border: "none", outline: "none", fontSize: 14, padding: "12px 0", color: "#333", background: "transparent" }}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                style={{
                  background: "transparent", border: "none", color: "#94a3b8",
                  cursor: "pointer", fontSize: 13, padding: "4px 12px", marginRight: 4,
                }}
              >清除</button>
            )}
          </div>
        </div>
      </div>

      {/* ═══ 主内容 ═══ */}
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "40px 20px 0" }}>

        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 80 }}>
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : error ? (
          <div style={{
            textAlign: "center", padding: 60, background: "#fff",
            borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          }}>
            <AlertCircle className="h-10 w-10 mx-auto mb-4 text-red-400" />
            <p style={{ color: "#94a3b8", fontSize: 14, marginBottom: 16 }}>加载课程列表失败，请稍后重试</p>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: "8px 24px", borderRadius: 8, border: "none",
                background: "#059669", color: "#fff", cursor: "pointer", fontSize: 14,
              }}
            >重新加载</button>
          </div>
        ) : (
          <>
            {/* ── 数据看板 ── */}
            <section style={{ marginBottom: 50 }}>
              <div style={{
                background: "#fff", borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", padding: 24,
                display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20,
              }}>
                {stats.map((s, i) => (
                  <div key={i} style={{ textAlign: "center", borderRight: i < stats.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                    <div style={{ display: "flex", justifyContent: "center", marginBottom: 8, color: "#059669" }}>{s.icon}</div>
                    <div style={{ fontSize: 28, fontWeight: "bold", color: "#059669", lineHeight: 1.2 }}>{s.num}</div>
                    <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 6 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </section>

            {/* ── 课程列表 ── */}
            <section style={{ marginBottom: 50 }}>
              <SectionHeader
                title={search ? `搜索结果（${filteredCourses.length}）` : "精选课程"}
                subtitle={search ? "" : "已发布的体系化课程"}
              />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
                {publishedCourses.map((course, i) => (
                  <div key={course.id} style={{
                    background: "#fff", borderRadius: 10, overflow: "hidden",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.06)", transition: "all 0.25s",
                  }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 8px 16px rgba(0,0,0,0.08)" }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.06)" }}>
                    <div style={{
                      height: 120, background: coverGradients[i % coverGradients.length],
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: "#fff", fontSize: 16, fontWeight: "bold", position: "relative",
                    }}>
                      {course.name.slice(0, 8)}
                      <span style={{
                        position: "absolute", top: 10, right: 10,
                        padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 500,
                        background: "rgba(255,255,255,0.25)", color: "#fff",
                      }}>
                        已发布
                      </span>
                    </div>
                    <div style={{ padding: 16 }}>
                      <h3 style={{ fontSize: 15, marginBottom: 8, color: "#1e293b", fontWeight: 600 }}>{course.name}</h3>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
                        <span style={{
                          padding: "2px 8px", borderRadius: 4, fontSize: 11,
                          background: "#eff6ff", color: "#059669", fontWeight: 500,
                        }}>{courseTypeMap[course.type] || course.type}</span>
                        {course.majorName && (
                          <span style={{ fontSize: 12, color: "#94a3b8", display: "flex", alignItems: "center", gap: 3 }}>
                            <MapPin className="h-3 w-3" /> {course.majorName}
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.6, marginBottom: 12, height: 36, overflow: "hidden" }}>
                        {course.description || "暂无课程描述"}
                      </p>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, fontSize: 12, color: "#94a3b8" }}>
                        <span className="flex items-center gap-1"><Layers className="h-3 w-3" /> {course.nodeCount} 节点</span>
                        <span className="flex items-center gap-1"><FileText className="h-3 w-3" /> {course.resourceCount} 资源</span>
                        <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {course.studyCount} 学习人次</span>
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {course.onlineHours || 0} h</span>
                      </div>
                    </div>
                  </div>
                ))}
                {publishedCourses.length === 0 && (
                  <div style={{ gridColumn: "span 3", textAlign: "center", padding: 40, color: "#94a3b8", background: "#fff", borderRadius: 10 }}>
                    {search ? "没有找到匹配的课程" : "暂无已发布课程"}
                  </div>
                )}
              </div>
            </section>

            {/* ── 平台优势 ── */}
            <section style={{ marginBottom: 50 }}>
              <SectionHeader title="平台优势" subtitle="为什么选择我们" />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
                {[
                  { title: "体系化课程设计", desc: "从基础到进阶，覆盖专业核心知识体系，匹配岗位能力模型", icon: <BookOpen className="h-6 w-6" /> },
                  { title: "颗粒化知识管理", desc: "知识点精细拆分、独立管理、灵活组合，支持跨课程复用", icon: <Layers className="h-6 w-6" /> },
                  { title: "多维度教学评价", desc: "线上学习 + 线下实训，过程评价 + 结果考核，全面评估学习效果", icon: <BarChart3 className="h-6 w-6" /> },
                ].map((item, i) => (
                  <div key={i} style={{
                    background: "#fff", borderRadius: 10, padding: 28,
                    boxShadow: "0 1px 3px rgba(0,0,0,0.06)", textAlign: "center",
                    transition: "all 0.25s",
                  }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 8px 16px rgba(0,0,0,0.08)" }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.06)" }}>
                    <div style={{ display: "flex", justifyContent: "center", marginBottom: 14, color: "#059669" }}>{item.icon}</div>
                    <h3 style={{ fontSize: 16, fontWeight: 600, color: "#1e293b", marginBottom: 8 }}>{item.title}</h3>
                    <p style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.8, margin: 0 }}>{item.desc}</p>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {/* Footer */}
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
