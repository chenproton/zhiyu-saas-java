"use client"

import { useEffect, useMemo, useState } from "react"
import {
  BookOpen, Lightbulb, Award, FolderKanban, MessageSquare,
  Search, Eye, ExternalLink, Filter, Heart,
  FileText, Table, Image, Link, Music, Video, Archive,
  Building, Wrench, AppWindow, HelpCircle, Sparkles,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { resourceLibraryApi, knowledgeApi, abilityApi, certificateLibraryApi, onSiteQuestionLibraryApi } from "@/lib/api"
import type { ResourceLibraryItem } from "@/lib/types/library"
import type { KnowledgePoint } from "@/lib/types/lesson"
import type { AbilityPoint } from "@/lib/types/job"
import type { CertificateLibraryItem } from "@/lib/types/job"
import type { OnSiteQuestionLibraryItem } from "@/lib/types/library"
import { useToast } from "@/hooks/use-toast"

const RESOURCE_TYPE_LABELS: Record<string, string> = {
  document: "文档", spreadsheet: "表格", image: "图片", link: "链接",
  audio: "音频", video: "视频", archive: "压缩包", venue: "场地",
  facility: "设施设备", software: "软件", other: "其他",
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  document: <FileText className="size-5" />, spreadsheet: <Table className="size-5" />,
  image: <Image className="size-5" />, link: <Link className="size-5" />,
  audio: <Music className="size-5" />, video: <Video className="size-5" />,
  archive: <Archive className="size-5" />, venue: <Building className="size-5" />,
  facility: <Wrench className="size-5" />, software: <AppWindow className="size-5" />,
  other: <HelpCircle className="size-5" />,
}

const TYPE_GRADIENTS: Record<string, string> = {
  document: "linear-gradient(135deg, #ffedd5, #fed7aa)",
  spreadsheet: "linear-gradient(135deg, #dcfce7, #bbf7d0)",
  image: "linear-gradient(135deg, #f3e8ff, #e9d5ff)",
  link: "linear-gradient(135deg, #ecfeff, #cffafe)",
  audio: "linear-gradient(135deg, #fce7f3, #fbcfe8)",
  video: "linear-gradient(135deg, #dbeafe, #bfdbfe)",
  archive: "linear-gradient(135deg, #e2e8f0, #cbd5e1)",
  venue: "linear-gradient(135deg, #fee2e2, #fecaca)",
  facility: "linear-gradient(135deg, #e0e7ff, #c7d2fe)",
  software: "linear-gradient(135deg, #ccfbf1, #99f6e4)",
  other: "linear-gradient(135deg, #e7e5e4, #d6d3d1)",
}

const TYPE_COLORS: Record<string, string> = {
  document: "#f97316", spreadsheet: "#22c55e", image: "#a855f7",
  link: "#06b6d4", audio: "#ec4899", video: "#3b82f6",
  archive: "#64748b", venue: "#ef4444", facility: "#6366f1",
  software: "#14b8a6", other: "#78716c",
}

const CATEGORIES = [
  { id: "all", icon: FolderKanban, label: "全部", gradient: "linear-gradient(135deg, #e0e7ff, #c7d2fe)", color: "#6366f1" },
  { id: "knowledge", icon: BookOpen, label: "知识点", gradient: "linear-gradient(135deg, #e0f2fe, #bae6fd)", color: "#0284c7" },
  { id: "ability", icon: Lightbulb, label: "能力点", gradient: "linear-gradient(135deg, #ede9fe, #ddd6fe)", color: "#7c3aed" },
  { id: "certificates", icon: Award, label: "证书库", gradient: "linear-gradient(135deg, #ffe4e6, #fecdd3)", color: "#e11d48" },
  { id: "resources", icon: FolderKanban, label: "资源库", gradient: "linear-gradient(135deg, #dcfce7, #bbf7d0)", color: "#16a34a" },
  { id: "questions", icon: MessageSquare, label: "问答题库", gradient: "linear-gradient(135deg, #fef3c7, #fde68a)", color: "#d97706" },
]

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex items-baseline gap-3 mb-5">
      <h2 className="text-xl font-bold text-slate-800 relative pl-3">
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-sm bg-gradient-to-b from-blue-600 to-blue-500" />
        {title}
      </h2>
      {subtitle && <span className="text-slate-400 text-sm">{subtitle}</span>}
    </div>
  )
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
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")

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
      } catch {
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const stats = useMemo(() => ({
    total: resources.length + knowledgeCount + abilityCount + certCount + questionCount,
    knowledge: knowledgeCount,
    ability: abilityCount,
    certificates: certCount,
    resources: resources.length,
    questions: questionCount,
  }), [resources, knowledgeCount, abilityCount, certCount, questionCount])

  const filteredResources = useMemo(() => {
    let list = resources
    if (typeFilter !== "all") list = list.filter(r => r.resourceType === typeFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(r =>
        r.name.toLowerCase().includes(q) ||
        (r.description || "").toLowerCase().includes(q)
      )
    }
    return list
  }, [resources, typeFilter, search])

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const r of resources) {
      const t = r.resourceType
      counts[t] = (counts[t] || 0) + 1
    }
    return counts
  }, [resources])

  const categoryStats = useMemo(() => [
    { ...CATEGORIES[0], count: stats.total },
    { ...CATEGORIES[1], count: stats.knowledge },
    { ...CATEGORIES[2], count: stats.ability },
    { ...CATEGORIES[3], count: stats.certificates },
    { ...CATEGORIES[4], count: stats.resources },
    { ...CATEGORIES[5], count: stats.questions },
  ], [stats])

  function formatSize(bytes?: number) {
    if (!bytes) return ""
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div>
      {/* ═══ Hero ═══ */}
      <div className="relative text-white text-center overflow-hidden" style={{ padding: "60px 20px 50px", minHeight: 360, background: "linear-gradient(135deg, #0f172a 0%, #1e293b 40%, #1e3a5f 70%, #0c4a6e 100%)" }}>
        <div className="absolute inset-0" style={{ background: "radial-gradient(circle at 20% 50%, rgba(59,130,246,0.15), transparent 50%), radial-gradient(circle at 80% 20%, rgba(139,92,246,0.12), transparent 50%)" }} />
        <div className="absolute inset-0" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)", backgroundSize: "48px 48px" }} />
        <div className="relative z-10 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur rounded-full px-4 py-1.5 mb-6 text-sm">
            <Sparkles className="size-4 text-amber-400" />
            <span className="text-white/90">共建共享 · 持续进化</span>
          </div>
          <h1 className="text-4xl font-extrabold mb-3 tracking-wide">教学资产共享中心</h1>
          <p className="text-base text-white/70 mb-8 max-w-xl mx-auto">
            沉淀校本智力资产，构建共建共享、持续进化的场景化数智教学资源生态
          </p>
          <div className="bg-white rounded-full p-1.5 pl-6 flex items-center max-w-lg mx-auto shadow-2xl mb-8">
            <Search className="size-4 text-slate-400 mr-3 shrink-0" />
            <input
              type="text" placeholder="搜索教学资源..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 border-none outline-none text-sm py-2.5 text-slate-700 bg-transparent"
            />
            <button
              onClick={() => document.getElementById("resource-grid")?.scrollIntoView({ behavior: "smooth" })}
              className="bg-gradient-to-r from-blue-600 to-blue-500 text-white border-none py-2.5 px-8 rounded-full cursor-pointer text-sm font-medium whitespace-nowrap hover:from-blue-700 hover:to-blue-600 transition"
            >
              搜索
            </button>
          </div>
          <div className="flex justify-center gap-10">
            {[
              { num: stats.total, label: "资源总量" },
              { num: stats.resources, label: "教学资源" },
              { num: stats.knowledge + stats.ability, label: "知识点/能力点" },
              { num: stats.questions, label: "问答题" },
            ].map((s, i) => (
              <div key={i} className="text-center">
                <div className="text-2xl font-bold leading-tight">{s.num}</div>
                <div className="text-xs text-white/70 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-[1280px] mx-auto px-5 py-10">
        {/* ═══ 分类看板 ═══ */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-5">
            <SectionHeader title="数据看板" />
            <span className="text-sm text-slate-500">共计 <strong className="text-blue-600">{stats.total}</strong> 个资源</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {categoryStats.map(cat => {
              const active = categoryFilter === cat.id
              const CatIcon = cat.icon
              return (
                <button
                  key={cat.id}
                  onClick={() => setCategoryFilter(active ? "all" : cat.id)}
                  className="rounded-xl p-4 cursor-pointer transition-all duration-200 relative overflow-hidden text-left"
                  style={{
                    background: cat.gradient,
                    border: active ? `2px solid ${cat.color}` : "2px solid transparent",
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = "translateY(-2px)"}
                  onMouseLeave={e => e.currentTarget.style.transform = "none"}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <CatIcon className="size-4" style={{ color: cat.color }} />
                    <span className="text-xs font-semibold" style={{ color: cat.color }}>{cat.label}</span>
                  </div>
                  <div className="text-2xl font-extrabold" style={{ color: cat.color }}>{cat.count}</div>
                </button>
              )
            })}
          </div>
        </section>

        {/* ═══ 资源列表 ═══ */}
        <section id="resource-grid" className="mb-12">
          <div className="flex items-center justify-between mb-5">
            <SectionHeader title="资源列表" subtitle={`共 ${filteredResources.length} 个`} />
          </div>

          {/* Type filter pills */}
          <div className="bg-white rounded-xl shadow-sm p-3 mb-5 flex gap-2 flex-wrap items-center border border-slate-100">
            <span className="text-sm text-slate-400 mr-1">分类：</span>
            <button
              onClick={() => setTypeFilter("all")}
              className="px-3 py-1.5 rounded-full text-xs font-medium transition cursor-pointer border-none"
              style={{ background: typeFilter === "all" ? "#2563eb" : "#f1f5f9", color: typeFilter === "all" ? "#fff" : "#64748b" }}
            >
              全部
            </button>
            {Object.entries(RESOURCE_TYPE_LABELS).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTypeFilter(typeFilter === key ? "all" : key)}
                className="px-3 py-1.5 rounded-full text-xs font-medium transition cursor-pointer border-none"
                style={{ background: typeFilter === key ? TYPE_COLORS[key] : "#f1f5f9", color: typeFilter === key ? "#fff" : "#64748b" }}
              >
                {TYPE_ICONS[key as keyof typeof TYPE_ICONS]} {label} {typeCounts[key] || 0}
              </button>
            ))}
          </div>

          {filteredResources.length === 0 ? (
            <div className="text-center py-16 text-slate-400 bg-white rounded-xl shadow-sm border border-slate-100">
              <Filter className="size-8 mx-auto mb-3 opacity-30" />
              <div>{loading ? "加载中..." : "暂无资源"}</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredResources.map(resource => {
                const color = TYPE_COLORS[resource.resourceType] || "#78716c"
                return (
                  <button
                    key={resource.id}
                    onClick={() => { setDetailResource(resource); setDetailOpen(true) }}
                    className="bg-white rounded-xl overflow-hidden shadow-sm transition-all duration-200 cursor-pointer border border-slate-100 hover:-translate-y-1 hover:shadow-md text-left w-full"
                    style={{ borderTop: `3px solid ${color}` }}
                  >
                    <div className="p-4">
                      <div className="flex gap-3 items-start">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: TYPE_GRADIENTS[resource.resourceType] || "#f1f5f9" }}>
                          <span style={{ color: color }}>{TYPE_ICONS[resource.resourceType] || TYPE_ICONS.other}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-semibold text-slate-800 leading-tight mb-1.5 truncate">{resource.name}</h3>
                          <div className="flex items-center gap-2 flex-wrap mb-2">
                            <span className="text-xs font-medium px-2 py-0.5 rounded" style={{ color, background: `${color}15` }}>
                              {RESOURCE_TYPE_LABELS[resource.resourceType] || resource.resourceType}
                            </span>
                            {resource.fileSize && (
                              <span className="text-xs text-slate-400">{formatSize(resource.fileSize)}</span>
                            )}
                          </div>
                          {resource.description && (
                            <p className="text-xs text-slate-500 leading-relaxed line-clamp-2 mb-3">{resource.description}</p>
                          )}
                          <div className="flex items-center justify-between pt-3 border-t border-dashed border-slate-100">
                            <div className="flex items-center gap-3 text-xs text-slate-400">
                              <span className="flex items-center gap-1"><Eye className="size-3" />查看</span>
                            </div>
                            {resource.url && (
                              <a href={resource.url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1">
                                <ExternalLink className="size-3" />访问
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </section>
      </div>

      {/* ═══ Detail dialog ═══ */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-auto">
          {detailResource && (
            <>
              <DialogHeader>
                <DialogTitle>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: TYPE_GRADIENTS[detailResource.resourceType] || "#f1f5f9" }}>
                      <span style={{ color: TYPE_COLORS[detailResource.resourceType] || "#78716c" }}>
                        {TYPE_ICONS[detailResource.resourceType] || TYPE_ICONS.other}
                      </span>
                    </div>
                    <div>
                      <div className="text-base font-semibold">{detailResource.name}</div>
                      <div className="text-sm font-normal text-slate-400 mt-0.5">
                        {RESOURCE_TYPE_LABELS[detailResource.resourceType] || detailResource.resourceType}
                      </div>
                    </div>
                  </div>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 mt-2">
                {detailResource.description && (
                  <div>
                    <div className="text-sm font-semibold text-slate-600 mb-1">描述</div>
                    <p className="text-sm text-slate-500 leading-relaxed">{detailResource.description}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {detailResource.fileSize != null && (
                    <div className="flex gap-2"><span className="text-slate-400">文件大小</span><span className="text-slate-700">{formatSize(detailResource.fileSize)}</span></div>
                  )}
                  <div className="flex gap-2">
                    <span className="text-slate-400">创建时间</span>
                    <span className="text-slate-700">{new Date(detailResource.createdAt).toLocaleDateString("zh-CN")}</span>
                  </div>
                </div>
                {detailResource.url && (
                  <div className="pt-3 border-t border-slate-100">
                    <a href={detailResource.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800">
                      <ExternalLink className="size-4" />在浏览器中打开资源
                    </a>
                  </div>
                )}
                {detailResource.thumbnail && (
                  <div className="rounded-lg overflow-hidden border border-slate-100">
                    <img src={detailResource.thumbnail} alt={detailResource.name} className="w-full h-48 object-cover" />
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ═══ Footer ═══ */}
      <footer style={{ background: "#141a2e", marginTop: 60, width: "100%" }}>
        <div style={{ height: 3, background: "linear-gradient(90deg, #8b5cf6, #818cf8, #22d3ee)" }} />
        <div style={{ padding: "48px 5% 32px" }}>
          <div style={{ maxWidth: 1280, margin: "0 auto" }}>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              <div>
                <h3 className="text-sm font-semibold text-white mb-3">场景化数智教学服务平台</h3>
                <p className="text-xs text-slate-400 leading-relaxed mb-2">专注职业教育数字化</p>
                <div className="text-xs text-slate-500">版本：V3.2.1</div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white mb-3">教学资源</h3>
                <p className="text-xs text-slate-400 leading-relaxed">岗位标准 · 实践场景 · 企业导师</p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white mb-3">技术支持</h3>
                <ul className="list-none p-0 m-0 text-xs text-slate-400 space-y-1">
                  <li>服务热线：400-888-8888</li>
                  <li>邮箱：support@example.com</li>
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white mb-3">校内支持</h3>
                <ul className="list-none p-0 m-0 text-xs text-slate-400 space-y-1">
                  <li>授权院校：XX职业技术学院</li>
                  <li>校内管理员：张老师</li>
                </ul>
              </div>
            </div>
            <hr className="border-slate-700 my-8" />
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500">
              <div>隐私政策 | 用户协议</div>
              <div>版权所有 © 2020-2026 杭州知与未来科技有限公司 | 京ICP备2025105397号-1</div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
