"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Video, FileText, Table, Image, LinkIcon, Music, MapPin, Cpu,
  Monitor, Wrench, Ellipsis, Eye, Search, Sparkles,
  RotateCcw, Flame, ArrowRight, Filter, BookOpen, Lightbulb,
  Award, FolderKanban, MessageSquare, GraduationCap, Archive,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { resourceLibraryApi, knowledgeApi, abilityApi, certificateLibraryApi, onSiteQuestionLibraryApi } from "@/lib/api"
import type { ResourceLibraryItem } from "@/lib/types/library"
import { useToast } from "@/hooks/use-toast"

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 20 }}>
      <h2 style={{ fontSize: 20, fontWeight: "bold", color: "#1e293b", position: "relative", paddingLeft: 12 }}>
        <span style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)", width: 4, height: 20, background: "linear-gradient(180deg, #2563eb, #3b82f6)", borderRadius: 2 }} />
        {title}
      </h2>
      {subtitle && <span style={{ color: "#94a3b8", fontSize: 13 }}>{subtitle}</span>}
    </div>
  )
}

const RESOURCE_TYPE_LABELS: Record<string, string> = {
  document: "文档资源", spreadsheet: "表格资源", image: "图片资源", link: "链接资源",
  audio: "音频资源", video: "视频资源", archive: "压缩包资源", venue: "场地资源",
  facility: "设施设备资源", software: "软件资源", other: "其他资源",
}

const TYPE_EMOJI: Record<string, string> = {
  video: "🎬", document: "📄", spreadsheet: "📊", image: "🖼️",
  link: "🔗", audio: "🎵", archive: "📦", venue: "📍",
  facility: "🔧", software: "💻", other: "📦",
}

const TYPE_GRADIENTS: Record<string, string> = {
  video: "linear-gradient(135deg, #dbeafe, #bfdbfe)",
  document: "linear-gradient(135deg, #ffedd5, #fed7aa)",
  spreadsheet: "linear-gradient(135deg, #dcfce7, #bbf7d0)",
  image: "linear-gradient(135deg, #f3e8ff, #e9d5ff)",
  link: "linear-gradient(135deg, #ecfeff, #cffafe)",
  audio: "linear-gradient(135deg, #fce7f3, #fbcfe8)",
  venue: "linear-gradient(135deg, #fee2e2, #fecaca)",
  facility: "linear-gradient(135deg, #e2e8f0, #cbd5e1)",
  software: "linear-gradient(135deg, #e0e7ff, #c7d2fe)",
  archive: "linear-gradient(135deg, #ccfbf1, #99f6e4)",
  other: "linear-gradient(135deg, #e7e5e4, #d6d3d1)",
}

const TYPE_COLORS: Record<string, string> = {
  video: "#3b82f6", document: "#f97316", spreadsheet: "#22c55e",
  image: "#a855f7", link: "#06b6d4", audio: "#ec4899",
  venue: "#ef4444", facility: "#64748b", software: "#6366f1",
  archive: "#14b8a6", other: "#78716c",
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  video: <Video className="size-5" />, document: <FileText className="size-5" />,
  spreadsheet: <Table className="size-5" />, image: <Image className="size-5" />,
  link: <LinkIcon className="size-5" />, audio: <Music className="size-5" />,
  venue: <MapPin className="size-5" />, facility: <Cpu className="size-5" />,
  software: <Monitor className="size-5" />, archive: <Archive className="size-5" />,
  other: <Ellipsis className="size-5" />,
}

const ALL_TYPES = ["video", "document", "spreadsheet", "image", "link", "audio", "venue", "facility", "software", "archive", "other"]

function formatSize(bytes?: number) {
  if (!bytes) return ""
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function LibraryLandingPage() {
  const { toast } = useToast()
  const [resources, setResources] = useState<ResourceLibraryItem[]>([])
  const [knowledgeCount, setKnowledgeCount] = useState(0)
  const [abilityCount, setAbilityCount] = useState(0)
  const [certCount, setCertCount] = useState(0)
  const [questionCount, setQuestionCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState<string>("全部")
  const [sortBy, setSortBy] = useState<"newest" | "popular">("newest")
  const [titleSearch, setTitleSearch] = useState("")
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailResource, setDetailResource] = useState<ResourceLibraryItem | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const [resRes, kRes, aRes, cRes, qRes] = await Promise.allSettled([
          resourceLibraryApi.list({ limit: 500 }),
          knowledgeApi.list({ limit: 1 }),
          abilityApi.list({ limit: 1 }),
          certificateLibraryApi.list({ limit: 1 }),
          onSiteQuestionLibraryApi.list({ limit: 1 }),
        ])
        if (resRes.status === "fulfilled") setResources(resRes.value.items)
        if (kRes.status === "fulfilled") setKnowledgeCount(kRes.value.total)
        if (aRes.status === "fulfilled") setAbilityCount(aRes.value.total)
        if (cRes.status === "fulfilled") setCertCount(cRes.value.total)
        if (qRes.status === "fulfilled") setQuestionCount(qRes.value.total)
      } catch {} finally { setLoading(false) }
    }
    load()
  }, [])

  const typeStats = useMemo(() => {
    const stats: Record<string, number> = {}
    for (const r of resources) { stats[r.resourceType] = (stats[r.resourceType] || 0) + 1 }
    stats["total"] = resources.length
    return stats
  }, [resources])

  const filteredResources = useMemo(() => {
    let list = resources
    if (typeFilter !== "全部") list = list.filter(r => r.resourceType === typeFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(r => r.name.toLowerCase().includes(q) || (r.description || "").toLowerCase().includes(q))
    }
    if (titleSearch.trim()) {
      list = list.filter(r => r.name.toLowerCase().includes(titleSearch.toLowerCase()))
    }
    if (sortBy === "popular") {
      list = [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    } else {
      list = [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    }
    return list
  }, [resources, typeFilter, search, titleSearch, sortBy])

  const totalCount = resources.length + knowledgeCount + abilityCount + certCount + questionCount

  return (
    <div>
      {/* ═══ Hero Banner ═══ */}
      <div style={{
        color: "#fff", padding: "60px 20px 50px", textAlign: "center",
        position: "relative", overflow: "hidden", minHeight: 360,
        background: "linear-gradient(160deg, #0c1929 0%, #152238 35%, #1a3a5c 65%, #0f2847 100%)",
      }}>
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(circle at 20% 30%, rgba(59,130,246,0.12), transparent 45%), radial-gradient(circle at 80% 70%, rgba(139,92,246,0.1), transparent 45%)" }} />
        <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
        <div style={{ maxWidth: 720, margin: "0 auto", position: "relative", zIndex: 1 }}>
          <h1 style={{ fontSize: 40, fontWeight: "bold", marginBottom: 12, letterSpacing: 1 }}>教学资产共享中心</h1>
          <p style={{ fontSize: 15, opacity: 0.9, marginBottom: 28 }}>
            汇聚视频、文档、软件、场地等教学资源，为教师提供一站式资源共享服务
          </p>
          <div style={{
            background: "#fff", borderRadius: 50, padding: "5px 5px 5px 24px",
            display: "flex", alignItems: "center", boxShadow: "0 10px 30px rgba(0,0,0,0.15)", marginBottom: 28,
          }}>
            <Search style={{ width: 18, height: 18, color: "#94a3b8", marginRight: 10, flexShrink: 0 }} />
            <input type="text" placeholder="搜索视频、文档、软件、场地等教学资源..." value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ flex: 1, border: "none", outline: "none", fontSize: 14, padding: "12px 0", color: "#333", background: "transparent" }} />
            <button onClick={() => document.getElementById("resource-list")?.scrollIntoView({ behavior: "smooth" })}
              style={{ background: "linear-gradient(135deg, #2563eb, #3b82f6)", color: "#fff", border: "none", padding: "11px 32px", borderRadius: 50, cursor: "pointer", fontSize: 14, fontWeight: 500, whiteSpace: "nowrap" }}>
              搜索
            </button>
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: 48 }}>
            {[
              { num: totalCount, label: "资源总量" },
              { num: resources.length, label: "教学资源" },
              { num: knowledgeCount + abilityCount, label: "知识/能力点" },
              { num: certCount + questionCount, label: "证书/题库" },
            ].map((s, i) => (
              <div key={i} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 28, fontWeight: "bold", lineHeight: 1.2 }}>{s.num}</div>
                <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "40px 20px 0", background: "#f7f8fc" }}>

        {/* ── 数据看板 ── */}
        <section style={{ marginBottom: 50 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <h2 style={{ fontSize: 20, fontWeight: "bold", color: "#1e293b", position: "relative", paddingLeft: 12 }}>
                <span style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)", width: 4, height: 20, background: "linear-gradient(180deg, #2563eb, #3b82f6)", borderRadius: 2 }} />
                数据看板
              </h2>
              <span style={{ color: "#94a3b8", fontSize: 13 }}>点击分类可快速筛选</span>
            </div>
            <span style={{ fontSize: 13, color: "#64748b" }}>
              共计 <strong style={{ color: "#2563eb" }}>{typeStats.total}</strong> 个资源
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
            {ALL_TYPES.map((type) => {
              const count = typeStats[type] || 0
              const active = typeFilter === type
              return (
                <button key={type}
                  onClick={() => {
                    setTypeFilter(active ? "全部" : type)
                    document.getElementById("resource-list")?.scrollIntoView({ behavior: "smooth" })
                  }}
                  style={{
                    background: TYPE_GRADIENTS[type] || TYPE_GRADIENTS.other,
                    border: active ? `2px solid ${TYPE_COLORS[type] || TYPE_COLORS.other}` : "2px solid transparent",
                    borderRadius: 14, padding: "14px 16px", cursor: "pointer",
                    transition: "all 0.2s ease",
                    position: "relative", overflow: "hidden",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-2px)"
                    e.currentTarget.style.boxShadow = `0 6px 18px ${TYPE_COLORS[type]}1a`
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "none"
                    e.currentTarget.style.boxShadow = "none"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, justifyContent: "center" }}>
                    <span style={{ color: TYPE_COLORS[type] || TYPE_COLORS.other, display: "flex" }}>{TYPE_ICONS[type] || TYPE_ICONS.other}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>{RESOURCE_TYPE_LABELS[type] || "其他"}</span>
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: TYPE_COLORS[type] || TYPE_COLORS.other, lineHeight: 1, textAlign: "center" as const }}>
                    {count}
                  </div>
                </button>
              )
            })}
          </div>
        </section>

        {/* ── 资源列表 ── */}
        <section id="resource-list" style={{ marginBottom: 50 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h2 style={{ fontSize: 20, fontWeight: "bold", color: "#1e293b", position: "relative", paddingLeft: 12 }}>
              <span style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)", width: 4, height: 20, background: "linear-gradient(180deg, #2563eb, #3b82f6)", borderRadius: 2 }} />
              公共资源库
            </h2>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ position: "relative" }}>
                <Search style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, color: "#94a3b8" }} />
                <input type="text" placeholder="搜索资源名称..." value={titleSearch}
                  onChange={(e) => setTitleSearch(e.target.value)}
                  style={{ width: 180, padding: "6px 12px 6px 32px", borderRadius: 20, fontSize: 12, border: "1px solid #e2e8f0", outline: "none", color: "#334155", background: "#f8fafc", transition: "all 0.2s" }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "#2563eb"; e.currentTarget.style.background = "#fff" }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.background = "#f8fafc" }} />
              </div>
              <span style={{ color: "#94a3b8", fontSize: 13 }}>共 {filteredResources.length} 个资源</span>
            </div>
          </div>
          <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", padding: "12px 16px", marginBottom: 20, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 13, color: "#94a3b8", marginRight: 4 }}>分类：</span>
            {[{ value: "全部" as const, label: "全部" }, ...ALL_TYPES.map(t => ({ value: t, label: `${TYPE_EMOJI[t] || "📦"} ${RESOURCE_TYPE_LABELS[t] || "其他"}` }))].map((item) => (
              <button key={item.value} onClick={() => setTypeFilter(item.value)}
                style={{ padding: "5px 14px", borderRadius: 20, fontSize: 12, cursor: "pointer", border: "none", fontWeight: 500, transition: "all 0.2s", background: typeFilter === item.value ? "#2563eb" : "#f1f5f9", color: typeFilter === item.value ? "#fff" : "#64748b", whiteSpace: "nowrap" }}
                onMouseEnter={(e) => { if (typeFilter !== item.value) e.currentTarget.style.background = "#e2e8f0" }}
                onMouseLeave={(e) => { if (typeFilter !== item.value) e.currentTarget.style.background = "#f1f5f9" }}
              >
                {item.label}
              </button>
            ))}
          </div>
          {filteredResources.length === 0 ? (
            <div style={{ textAlign: "center", padding: 60, color: "#94a3b8", background: "#fff", borderRadius: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
              <Filter style={{ width: 32, height: 32, margin: "0 auto 12", opacity: 0.4 }} />
              <div>{loading ? "加载中..." : "暂无符合条件的资源"}</div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
              {filteredResources.map((resource) => (
                <button key={resource.id} onClick={() => { setDetailResource(resource); setDetailOpen(true) }}
                  style={{ background: "#fff", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", transition: "all 0.25s", cursor: "pointer", border: "1px solid #f1f5f9", textAlign: "left" as const, width: "100%", display: "block", borderTop: `3px solid ${TYPE_COLORS[resource.resourceType] || "#78716c"}` }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 10px 20px rgba(0,0,0,0.08)" }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.06)" }}
                >
                  <div style={{ padding: 16 }}>
                    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                      <div style={{ width: 44, height: 44, borderRadius: "50%", background: TYPE_GRADIENTS[resource.resourceType] || "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>
                        {TYPE_EMOJI[resource.resourceType] || "📦"}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                          <h3 style={{ fontSize: 15, fontWeight: 600, color: "#1e293b", lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{resource.name}</h3>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 12, color: TYPE_COLORS[resource.resourceType] || "#78716c", background: `${TYPE_COLORS[resource.resourceType]}15`, padding: "2px 8px", borderRadius: 4, fontWeight: 500 }}>
                            {RESOURCE_TYPE_LABELS[resource.resourceType] || resource.resourceType}
                          </span>
                          {resource.fileSize != null && (
                            <span style={{ fontSize: 12, color: "#94a3b8" }}>{formatSize(resource.fileSize)}</span>
                          )}
                        </div>
                        {resource.description && (
                          <p style={{ fontSize: 12, color: "#64748b", lineHeight: 1.6, marginBottom: 12, height: 38, overflow: "hidden" }}>{resource.description}</p>
                        )}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 12, borderTop: "1px dashed #f1f5f9" }}>
                          <div style={{ display: "flex", gap: 14, fontSize: 12, color: "#94a3b8" }}>
                            <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                              <Eye style={{ width: 12, height: 12 }} />
                              查看详情
                            </span>
                          </div>
                          {resource.url && (
                            <a href={resource.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                              style={{ fontSize: 12, color: "#2563eb", textDecoration: "none", fontWeight: 500 }}>
                              访问资源 →
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* ═══ Detail Dialog ═══ */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent style={{ maxWidth: 640, maxHeight: "85vh", overflow: "auto" }}>
          {detailResource && (
            <>
              <DialogHeader>
                <DialogTitle>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 48, height: 48, borderRadius: 10, background: TYPE_GRADIENTS[detailResource.resourceType] || "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>
                      {TYPE_EMOJI[detailResource.resourceType] || "📦"}
                    </div>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 600 }}>{detailResource.name}</div>
                      <div style={{ fontSize: 13, fontWeight: 400, color: "#94a3b8", marginTop: 2 }}>
                        {RESOURCE_TYPE_LABELS[detailResource.resourceType] || detailResource.resourceType}
                        {detailResource.fileSize != null && ` · ${formatSize(detailResource.fileSize)}`}
                      </div>
                    </div>
                  </div>
                </DialogTitle>
              </DialogHeader>

              {/* Preview area */}
              {(detailResource.resourceType === "video" || detailResource.resourceType === "image" || detailResource.resourceType === "document" || detailResource.resourceType === "audio" || detailResource.resourceType === "spreadsheet" || detailResource.resourceType === "link") && (
                <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid #e2e8f0", backgroundColor: "#f8fafc", marginTop: 8 }}>
                  {detailResource.resourceType === "video" && (
                    <div style={{ background: "#0f172a", aspectRatio: "16/9", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                      <Video style={{ width: 48, height: 48, color: "rgba(255,255,255,0.2)" }} />
                      <div style={{ position: "absolute", width: 56, height: 56, borderRadius: "50%", background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", backdropFilter: "blur(4px)", transition: "background 0.2s" }}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><polygon points="8,5 19,12 8,19" /></svg>
                      </div>
                      <div style={{ position: "absolute", bottom: 10, left: 14, right: 14, display: "flex", justifyContent: "space-between", color: "rgba(255,255,255,0.5)", fontSize: 11 }}>
                        <span>视频资源预览</span>
                        <span style={{ background: "rgba(255,255,255,0.1)", padding: "2px 8px", borderRadius: 4 }}>系统内预览</span>
                      </div>
                    </div>
                  )}
                  {detailResource.resourceType === "image" && (
                    <div style={{ aspectRatio: "16/10", display: "flex", alignItems: "center", justifyContent: "center", background: "#f1f5f9", position: "relative", flexDirection: "column", gap: 12 }}>
                      <Image style={{ width: 48, height: 48, color: "#cbd5e1" }} />
                      <span style={{ fontSize: 12, color: "#94a3b8" }}>图片预览 · 仅限系统内查看</span>
                    </div>
                  )}
                  {detailResource.resourceType === "document" && (
                    <div style={{ padding: 20, background: "#fff", minHeight: 200, display: "flex", flexDirection: "column", gap: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid #e2e8f0", paddingBottom: 12 }}>
                        <FileText style={{ width: 22, height: 22, color: "#f97316" }} />
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{detailResource.name}</div>
                      </div>
                      <div style={{ flex: 1, background: "#fafaf9", borderRadius: 8, padding: 24, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: 13, flexDirection: "column", gap: 8 }}>
                        <FileText style={{ width: 28, height: 28, opacity: 0.25 }} />
                        <span>文档内容仅限系统内在线预览</span>
                      </div>
                    </div>
                  )}
                  {detailResource.resourceType === "audio" && (
                    <div style={{ padding: 16, background: "linear-gradient(135deg, #fce7f3, #fbcfe8)", display: "flex", alignItems: "center", gap: 14 }}>
                      <Music style={{ width: 28, height: 28, color: "#ec4899" }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{detailResource.name}</div>
                        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>音频资源</div>
                      </div>
                      <div style={{ width: 120, height: 4, background: "rgba(236,72,153,0.15)", borderRadius: 2, position: "relative" }}>
                        <div style={{ width: "35%", height: "100%", background: "#ec4899", borderRadius: 2 }} />
                      </div>
                    </div>
                  )}
                  {detailResource.resourceType === "spreadsheet" && (
                    <div style={{ padding: 14, background: "#fff" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 1, background: "#e2e8f0", borderRadius: 6, overflow: "hidden", fontSize: 11 }}>
                        {["名称", "数量", "单价", "总价"].map(h => (
                          <div key={h} style={{ background: "#f8fafc", padding: "7px 10px", fontWeight: 600, color: "#475569", textAlign: "center" }}>{h}</div>
                        ))}
                        {Array.from({ length: 3 }).map((_, i) => [
                          `项目 ${i + 1}`, String(Math.floor(Math.random() * 100) + 1),
                          `¥${(Math.random() * 1000).toFixed(2)}`, `¥${(Math.random() * 10000).toFixed(2)}`,
                        ].map((c, j) => (
                          <div key={j} style={{ background: "#fff", padding: "7px 10px", color: "#64748b", textAlign: "center" }}>{c}</div>
                        )))}
                      </div>
                      <div style={{ textAlign: "center", marginTop: 10, fontSize: 11, color: "#94a3b8" }}>表格预览 · 仅限系统内查看</div>
                    </div>
                  )}
                  {detailResource.resourceType === "link" && (
                    <div style={{ padding: 14, background: "#ecfeff", display: "flex", alignItems: "center", gap: 10 }}>
                      <LinkIcon style={{ width: 24, height: 24, color: "#06b6d4", flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#0e7490" }}>{detailResource.name}</div>
                        {detailResource.url && (
                          <div style={{ fontSize: 11, color: "#0891b2", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{detailResource.url}</div>
                        )}
                      </div>
                      {detailResource.url && (
                        <a href={detailResource.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "#2563eb", textDecoration: "none", whiteSpace: "nowrap", flexShrink: 0 }}>
                          前往查看 →
                        </a>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 4 }}>
                {detailResource.description && (
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 6 }}>资源描述</div>
                    <p style={{ fontSize: 14, color: "#64748b", lineHeight: 1.7 }}>{detailResource.description}</p>
                  </div>
                )}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 12, borderTop: "1px solid #e2e8f0", fontSize: 13, color: "#94a3b8" }}>
                  <span>创建时间 {new Date(detailResource.createdAt).toLocaleString("zh-CN")}</span>
                  <span>最近更新 {new Date(detailResource.updatedAt).toLocaleString("zh-CN")}</span>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ═══ Footer ═══ */}
      <footer style={{background: '#141a2e', marginTop: 60, width: '100%'}}>
        <div style={{height: 3, background: 'linear-gradient(90deg, #8b5cf6, #818cf8, #22d3ee)'}} />
        <div style={{padding: '48px 5% 32px'}}>
          <div style={{maxWidth: 1280, margin: '0 auto'}}>
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 32}}>
            <div>
              <h3 style={{fontSize: 15, fontWeight: 600, color: '#fff', margin: '0 0 12px 0'}}>场景化数智教学服务平台</h3>
              <p style={{fontSize: 13, color: '#a8b3cf', lineHeight: 1.8, margin: 0}}>专注职业教育数字化</p>
              <div style={{fontSize: 12, color: '#6b7a99', marginTop: 8}}>版本：V3.2.1</div>
            </div>
            <div>
              <h3 style={{fontSize: 15, fontWeight: 600, color: '#fff', margin: '0 0 12px 0'}}>教学资源</h3>
              <p style={{fontSize: 13, color: '#a8b3cf', lineHeight: 1.8, margin: 0}}>岗位标准、实践场景、企业导师</p>
            </div>
            <div>
              <h3 style={{fontSize: 15, fontWeight: 600, color: '#fff', margin: '0 0 12px 0'}}>技术支持</h3>
              <ul style={{listStyle: 'none', padding: 0, margin: 0}}>
                <li style={{fontSize: 13, color: '#a8b3cf', lineHeight: 1.8}}>服务热线：400-888-8888</li>
                <li style={{fontSize: 13, color: '#a8b3cf', lineHeight: 1.8}}>邮箱：support@example.com</li>
              </ul>
            </div>
            <div>
              <h3 style={{fontSize: 15, fontWeight: 600, color: '#fff', margin: '0 0 12px 0'}}>校内支持</h3>
              <ul style={{listStyle: 'none', padding: 0, margin: 0}}>
                <li style={{fontSize: 13, color: '#a8b3cf', lineHeight: 1.8}}>授权院校：XX职业技术学院</li>
                <li style={{fontSize: 13, color: '#a8b3cf', lineHeight: 1.8}}>校内管理员：张老师</li>
              </ul>
            </div>
          </div>
          <hr style={{border: 'none', borderTop: '1px solid #29324a', margin: '40px 0 24px'}} />
          <div style={{display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, fontSize: 12, color: '#6b7a99'}}>
            <div>
              <a href="#" style={{color: '#6b7a99', textDecoration: 'none'}}>隐私政策</a>
              <span style={{color: '#29324a'}}>&nbsp;|&nbsp;</span>
              <a href="#" style={{color: '#6b7a99', textDecoration: 'none'}}>用户协议</a>
            </div>
            <div style={{textAlign: 'right'}}>版权所有 © 2020-2026 杭州知与未来科技有限公司 ｜ 软件著作权登记号：2020SR0123456 ｜ 京ICP备2025105397号-1</div>
          </div>
        </div>
        </div>
      </footer>
    </div>
  )
}
