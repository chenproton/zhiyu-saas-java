"use client"

import Link from "next/link"
import { useState, useEffect } from "react"
import {
  MapPin, Layers, Zap, Search, Target, BarChart3,
  Clock, FileText, Users,
} from "lucide-react"
import { useData } from "@/components/providers/data-provider"
import { scenarioApi, taskApi } from "@/lib/api"
import type { Scenario, ScenarioTask } from "@/lib/types"

function SectionHeader({ title, subtitle, moreHref }: { title: string; subtitle?: string; moreHref?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <h2 style={{ fontSize: 20, fontWeight: "bold", color: "#1e293b", position: "relative", paddingLeft: 12 }}>
          <span style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)", width: 4, height: 20, background: "linear-gradient(180deg, #2563eb, #3b82f6)", borderRadius: 2 }} />
          {title}
        </h2>
        {subtitle && <span style={{ color: "#94a3b8", fontSize: 13 }}>{subtitle}</span>}
      </div>
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

const statusColors: Record<string, { color: string; label: string }> = {
  published: { color: "#16a34a", label: "已发布" },
  draft: { color: "#64748b", label: "草稿" },
  pending: { color: "#2563eb", label: "审核中" },
  approved: { color: "#8b5cf6", label: "已通过" },
  archived: { color: "#94a3b8", label: "已归档" },
}

const difficultyMap: Record<number, { color: string; label: string }> = {
  1: { color: "#22c55e", label: "入门" },
  2: { color: "#eab308", label: "初级" },
  3: { color: "#f97316", label: "中级" },
  4: { color: "#ef4444", label: "高级" },
  5: { color: "#8b5cf6", label: "专家" },
}

const coverGradients = [
  "linear-gradient(135deg, #667eea, #764ba2)",
  "linear-gradient(135deg, #f093fb, #f5576c)",
  "linear-gradient(135deg, #4facfe, #00f2fe)",
  "linear-gradient(135deg, #fa709a, #fee140)",
  "linear-gradient(135deg, #30cfd0, #330867)",
  "linear-gradient(135deg, #a8edea, #fed6e3)",
]

export default function SceneLandingPage() {
  const { evaluationMethods } = useData()
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [tasks, setTasks] = useState<ScenarioTask[]>([])
  const [scenarioNameMap, setScenarioNameMap] = useState<Record<string, string>>({})

  useEffect(() => {
    Promise.all([
      scenarioApi.list({ limit: 100 }),
      taskApi.list({ limit: 100 }),
    ]).then(([scenarioRes, taskRes]) => {
      const scns = scenarioRes.items || []
      setScenarios(scns)
      setScenarioNameMap(Object.fromEntries(scns.map((s) => [s.id, s.name])))
      setTasks(taskRes.items || [])
    }).catch(() => {})
  }, [])

  const publishedScenarios = scenarios.filter((s) => s.status === "published").slice(0, 6)
  const displayTasks = tasks.slice(0, 8)

  const stats = [
    { num: scenarios.length, label: "场景数量", icon: <Layers className="h-5 w-5" /> },
    { num: tasks.length, label: "任务数量", icon: <Target className="h-5 w-5" /> },
    { num: evaluationMethods.length, label: "评价方式", icon: <BarChart3 className="h-5 w-5" /> },
    { num: publishedScenarios.length, label: "已发布场景", icon: <Zap className="h-5 w-5" /> },
  ]

  return (
    <div>
      {/* ═══ Hero Banner ═══ */}
      <div style={{
        background: "linear-gradient(135deg, #0f2b4a 0%, #1a4a7a 40%, #2563eb 100%)",
        color: "#fff", padding: "60px 20px 50px", textAlign: "center", position: "relative", overflow: "hidden", minHeight: 360,
      }}>
        <div style={{ maxWidth: 720, margin: "0 auto", position: "relative", zIndex: 1 }}>
          <h1 style={{ fontSize: 40, fontWeight: "bold", marginBottom: 12, letterSpacing: 1 }}>场景化实践教学平台</h1>
          <p style={{ fontSize: 15, opacity: 0.85, marginBottom: 28 }}>以真实岗位场景驱动教学，任务化训练、过程化评价，提升学生综合实战能力</p>
          <div style={{
            background: "#fff", borderRadius: 50, padding: "5px 5px 5px 24px",
            display: "flex", alignItems: "center", boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
          }}>
            <Search style={{ width: 18, height: 18, color: "#94a3b8", marginRight: 10 }} />
            <input type="text" placeholder="搜索场景、任务、评价方式"
              style={{ flex: 1, border: "none", outline: "none", fontSize: 14, padding: "12px 0", color: "#333", background: "transparent" }} />
            <button style={{
              background: "linear-gradient(135deg, #2563eb, #3b82f6)", color: "#fff", border: "none",
              padding: "11px 32px", borderRadius: 50, cursor: "pointer", fontSize: 14, fontWeight: 500,
            }}>搜索</button>
          </div>
        </div>
      </div>

      {/* ═══ 主内容 ═══ */}
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "40px 20px 0" }}>

        {/* ── 数据看板 ── */}
        <section style={{ marginBottom: 50 }}>
          <div style={{
            background: "#fff", borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", padding: 24,
            display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20,
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

        {/* ── 平台精选场景 ── */}
        <section style={{ marginBottom: 50 }}>
          <SectionHeader title="平台精选场景" subtitle="已发布的实践教学场景" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
            {publishedScenarios.map((scenario, i) => {
              const st = statusColors[scenario.status] || statusColors.draft
              const diff = difficultyMap[scenario.difficulty] || difficultyMap[3]
              return (
                <div key={scenario.id} style={{
                  background: "#fff", borderRadius: 10, overflow: "hidden",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.06)", transition: "all 0.25s", cursor: "pointer",
                }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 8px 16px rgba(0,0,0,0.08)" }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.06)" }}>
                  <div style={{
                    height: 120, background: coverGradients[i % coverGradients.length],
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#fff", fontSize: 16, fontWeight: "bold", position: "relative",
                  }}>
                    {scenario.name.slice(0, 8)}
                    <span style={{
                      position: "absolute", top: 10, right: 10,
                      padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 500,
                      background: "rgba(255,255,255,0.25)", color: "#fff",
                    }}>
                      {st.label}
                    </span>
                  </div>
                  <div style={{ padding: 16 }}>
                    <h3 style={{ fontSize: 15, marginBottom: 8, color: "#1e293b", fontWeight: 600 }}>{scenario.name}</h3>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
                      <span style={{
                        padding: "2px 8px", borderRadius: 4, fontSize: 11,
                        background: diff.color + "15", color: diff.color, fontWeight: 500,
                      }}>{diff.label}</span>
                      {(scenario.industryNames || scenario.industryIds || []).length > 0 && (
                        <span style={{ fontSize: 12, color: "#94a3b8", display: "flex", alignItems: "center", gap: 3 }}>
                          <MapPin className="h-3 w-3" /> {(scenario.industryNames || scenario.industryIds || []).join("、")}
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.6, marginBottom: 12, height: 36, overflow: "hidden" }}>
                      {scenario.background || "暂无背景描述"}
                    </p>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, color: "#94a3b8" }}>
                      <span>编码：{scenario.code || scenario.id.slice(0, 8)}</span>
                      <span>版本：{scenario.version}</span>
                    </div>
                  </div>
                </div>
              )
            })}
            {publishedScenarios.length === 0 && (
              <div style={{ gridColumn: "span 3", textAlign: "center", padding: 40, color: "#94a3b8", background: "#fff", borderRadius: 10 }}>暂无已发布场景</div>
            )}
          </div>
        </section>

        {/* ── 场景任务库 ── */}
        <section style={{ marginBottom: 50 }}>
          <SectionHeader title="场景任务库" subtitle="平台已配置的实践任务" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20 }}>
            {displayTasks.map((task, i) => {
              const icons = ["📋", "🎯", "💡", "📊"]
              const taskCovers = [
                "linear-gradient(135deg, #a8edea, #fed6e3)",
                "linear-gradient(135deg, #ffecd2, #fcb69f)",
                "linear-gradient(135deg, #84fab0, #8fd3f4)",
                "linear-gradient(135deg, #a1c4fd, #c2e9fb)",
              ]
              return (
                <div key={task.id} style={{
                  background: "#fff", borderRadius: 10, overflow: "hidden",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.06)", transition: "all 0.25s", cursor: "pointer",
                }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 8px 16px rgba(0,0,0,0.08)" }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.06)" }}>
                  <div style={{
                    height: 90, background: taskCovers[i % 4],
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32,
                  }}>{icons[i % 4]}</div>
                  <div style={{ padding: 14 }}>
                    <h3 style={{ fontSize: 14, marginBottom: 6, color: "#1e293b", fontWeight: 600 }}>{task.name}</h3>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 8, fontSize: 12, color: "#94a3b8" }}>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {task.estimatedHours}h
                      </span>
                      <span className="flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        {task.taskType === "assessment" ? "测评" : "训练"}
                      </span>
                      <span className="flex items-center gap-1">
                        <Target className="h-3 w-3" />
                        Lv.{task.difficulty}
                      </span>
                    </div>
                    <p style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.5, height: 32, overflow: "hidden" }}>
                      {(task as unknown as { sceneName?: string }).sceneName || scenarioNameMap[task.scenarioId] || task.description || "暂无描述"}
                    </p>
                  </div>
                </div>
              )
            })}
            {displayTasks.length === 0 && (
              <div style={{ gridColumn: "span 4", textAlign: "center", padding: 40, color: "#94a3b8", background: "#fff", borderRadius: 10 }}>暂无场景任务</div>
            )}
          </div>
        </section>

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
