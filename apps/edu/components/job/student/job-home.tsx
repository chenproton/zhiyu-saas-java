"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Search, Flag, Heart, Crosshair, Briefcase, Sparkles, Filter, X,
  TrendingUp, GraduationCap, ChevronRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { publicPositionApi } from "@/lib/api"
import { useAuth } from "@/components/auth-provider"
import { useIndustryMap } from "@/lib/use-resource-maps"
import type { CareerPosition } from "@/lib/types"
import { StatsBar } from "./stats-bar"
import { JobCard } from "./job-card"
import { Pagination } from "./pagination"
import { RankingList } from "./ranking-list"
import { PlatformFooter } from "./platform-footer"

const CARDS_PER_PAGE = 12
const SORT_OPTIONS = [
  { value: "default", label: "默认排序" },
  { value: "hot", label: "最多收藏" },
  { value: "recent", label: "最近收录" },
  { value: "update", label: "最近更新" },
]

export function JobHome() {
  const router = useRouter()
  const { user } = useAuth()
  const industryMap = useIndustryMap()

  const [positions, setPositions] = useState<CareerPosition[]>([])
  const [loading, setLoading] = useState(true)

  const [currentPage, setCurrentPage] = useState(1)
  const [sort, setSort] = useState("default")
  const [keyword, setKeyword] = useState("")
  const [selectedIndustry, setSelectedIndustry] = useState<string>("全部")
  const [selectedMajor, setSelectedMajor] = useState<string>("全部")

  useEffect(() => {
    setLoading(true)
    publicPositionApi
      .list({ status: "published", limit: 1000 })
      .then((res) => setPositions(res.items || []))
      .catch(() => setPositions([]))
      .finally(() => setLoading(false))
  }, [])

  const industries = useMemo(() => {
    const set = new Set<string>()
    positions.forEach((p) => {
      if (p.industryId) {
        const name = industryMap.get(p.industryId)
        if (name) set.add(name)
      }
    })
    return ["全部", ...Array.from(set).sort()]
  }, [positions, industryMap])

  const majors = useMemo(() => {
    const set = new Set<string>()
    positions.forEach((p) => p.majorNames?.forEach((m) => { if (m) set.add(m) }))
    return ["全部", ...Array.from(set).sort()]
  }, [positions])

  const filtered = useMemo(() => {
    let list = [...positions]
    if (selectedIndustry !== "全部") {
      list = list.filter((p) => p.industryId && industryMap.get(p.industryId) === selectedIndustry)
    }
    if (selectedMajor !== "全部") {
      list = list.filter((p) => p.majorNames?.includes(selectedMajor))
    }
    if (keyword.trim()) {
      const k = keyword.trim().toLowerCase()
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(k) ||
          (p.shortName?.toLowerCase().includes(k) ?? false) ||
          p.id.toLowerCase().includes(k)
      )
    }
    switch (sort) {
      case "hot":
        list.sort((a, b) => (b.favoriteCount ?? 0) - (a.favoriteCount ?? 0) || a.name.localeCompare(b.name, "zh-CN"))
        break
      case "recent":
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        break
      case "update":
        list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        break
      default:
        list.sort((a, b) => a.name.localeCompare(b.name, "zh-CN"))
        break
    }
    return list
  }, [positions, selectedIndustry, selectedMajor, keyword, sort, industryMap])

  const totalPages = Math.max(1, Math.ceil(filtered.length / CARDS_PER_PAGE))
  const pageItems = useMemo(() => {
    const start = (currentPage - 1) * CARDS_PER_PAGE
    return filtered.slice(start, start + CARDS_PER_PAGE)
  }, [filtered, currentPage])

  useEffect(() => { setCurrentPage(1) }, [selectedIndustry, selectedMajor, keyword, sort])

  const activeFilters = useMemo(() => {
    const filters: { type: string; label: string }[] = []
    if (selectedIndustry !== "全部") filters.push({ type: "industry", label: `行业：${selectedIndustry}` })
    if (selectedMajor !== "全部") filters.push({ type: "major", label: `专业：${selectedMajor}` })
    if (keyword.trim()) filters.push({ type: "keyword", label: `关键词：${keyword.trim()}` })
    return filters
  }, [selectedIndustry, selectedMajor, keyword])

  const stats = useMemo(() => {
    const industrySet = new Set<string>()
    const majorSet = new Set<string>()
    let favoriteTotal = 0
    positions.forEach((p) => {
      if (p.industryId) industrySet.add(p.industryId)
      p.majorNames?.forEach((m) => majorSet.add(m))
      favoriteTotal += p.favoriteCount ?? 0
    })
    return {
      total: positions.length,
      industryCount: industrySet.size,
      majorCount: majorSet.size,
      favoriteTotal,
    }
  }, [positions])

  const heroSearch = (
    <div className="relative w-full md:w-[480px]">
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" />
      <Input
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") setCurrentPage(1) }}
        placeholder="搜索岗位名称、岗位编码或关键词"
        className="pl-11 pr-28 py-3 h-12 bg-white/95 border-0 rounded-full text-sm shadow-lg shadow-blue-900/10 focus-visible:ring-2 focus-visible:ring-blue-300"
      />
      <Button
        className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full px-5 h-9 bg-blue-600 hover:bg-blue-700 text-white text-sm"
        onClick={() => setCurrentPage(1)}
      >
        搜索
      </Button>
    </div>
  )

  return (
    <div className="min-h-screen flex flex-col bg-[#F1FAFF]">
      {/* Hero */}
      <div className="relative w-full pt-14 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0f172a] via-[#1e3a8a] to-[#4f46e5]" />
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: "radial-gradient(circle at 80% 20%, rgba(99,102,241,0.4), transparent 40%), radial-gradient(circle at 20% 80%, rgba(59,130,246,0.3), transparent 40%)",
          }}
        />
        <div className="relative z-10 max-w-[1400px] mx-auto px-4 sm:px-8 py-16 md:py-24">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm text-blue-100 px-3 py-1.5 rounded-full text-xs border border-white/10 mb-5">
              <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
              对接产业前沿 · 赋能岗位能力学习
            </div>
            <h1 className="text-3xl md:text-5xl lg:text-[56px] font-extrabold text-white leading-[1.15] mb-5">
              发现适合你的<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-200 to-indigo-200">职业岗位能力路径</span>
            </h1>
            <p className="text-base md:text-lg text-blue-100/80 mb-8 max-w-xl leading-relaxed">
              链接真实企业岗位标准，构建从岗位认知到胜任力达成的完整学习闭环
            </p>
            {heroSearch}
          </div>
        </div>
      </div>

      <StatsBar
        total={stats.total}
        majorCount={stats.majorCount}
        industryCount={stats.industryCount}
        favoriteTotal={stats.favoriteTotal}
      />

      <main className="max-w-[1400px] mx-auto px-4 sm:px-8 py-8 w-full flex-1">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left main */}
          <div className="lg:col-span-2 space-y-5">
            {/* Filter */}
            <div className="bg-white rounded-2xl border border-[#e7e5e4] p-5 shadow-sm">
              <div className="flex items-center gap-2 text-[15px] font-bold text-[#0f172a] mb-4 pl-3 border-l-4 border-blue-600">
                <Filter className="w-4 h-4" />
                岗位筛选
              </div>
              <div className="space-y-3">
                <div className="flex items-start gap-3 sm:gap-4 py-2 border-b border-dashed border-[#e7e5e4]">
                  <span className="text-sm text-[#374151] font-medium min-w-[40px] pt-1.5">行业</span>
                  <div className="flex flex-wrap gap-2">
                    {industries.map((item) => (
                      <button
                        key={item}
                        onClick={() => setSelectedIndustry(item)}
                        className={`
                          px-3.5 py-1.5 rounded-full text-[13px] border transition-all whitespace-nowrap
                          ${selectedIndustry === item
                            ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                            : "bg-white text-[#475569] border-[#e5e7eb] hover:border-blue-400 hover:text-blue-600"
                          }
                        `}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-start gap-3 sm:gap-4 py-2">
                  <span className="text-sm text-[#374151] font-medium min-w-[40px] pt-1.5">专业</span>
                  <div className="flex flex-wrap gap-2">
                    {majors.map((item) => (
                      <button
                        key={item}
                        onClick={() => setSelectedMajor(item)}
                        className={`
                          px-3.5 py-1.5 rounded-full text-[13px] border transition-all whitespace-nowrap
                          ${selectedMajor === item
                            ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                            : "bg-white text-[#475569] border-[#e5e7eb] hover:border-blue-400 hover:text-blue-600"
                          }
                        `}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {activeFilters.length > 0 && (
                <div className="flex flex-wrap items-center gap-3 pt-4 mt-4 border-t border-dashed border-[#e7e5e4]">
                  <span className="text-[13px] text-[#64748b]">已选条件：</span>
                  {activeFilters.map((f) => (
                    <span
                      key={f.type}
                      className="inline-flex items-center gap-1 bg-[#eff6ff] text-blue-600 text-xs px-2.5 py-1 rounded-full"
                    >
                      {f.label}
                      <X
                        className="w-3 h-3 cursor-pointer"
                        onClick={() => {
                          if (f.type === "industry") setSelectedIndustry("全部")
                          if (f.type === "major") setSelectedMajor("全部")
                          if (f.type === "keyword") setKeyword("")
                        }}
                      />
                    </span>
                  ))}
                  <button
                    onClick={() => { setSelectedIndustry("全部"); setSelectedMajor("全部"); setKeyword("") }}
                    className="text-[13px] text-blue-600 hover:underline"
                  >
                    清空筛选
                  </button>
                </div>
              )}
            </div>

            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-[#e7e5e4] shadow-sm">
                {SORT_OPTIONS.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => setSort(s.value)}
                    className={`
                      px-4 py-2 rounded-[10px] text-[13px] transition-all
                      ${sort === s.value ? "bg-[#eff6ff] text-blue-600 font-semibold" : "text-[#475569] hover:text-blue-600"}
                    `}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <div className="text-sm text-[#64748b]">
                共 <b className="text-blue-600">{filtered.length}</b> 个岗位
              </div>
            </div>

            {/* Grid */}
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-2xl border border-[#e7e5e4] h-[360px] animate-pulse" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-20 text-[#94a3b8] bg-white rounded-2xl border border-[#e7e5e4]">
                <Search className="w-14 h-14 mx-auto mb-4 opacity-40" />
                <div className="text-[15px]">暂无匹配的岗位，试试调整筛选条件或搜索关键词</div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {pageItems.map((pos, i) => (
                    <JobCard key={pos.id} position={pos} index={i} hideHot={i > 2} />
                  ))}
                </div>
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={(p) => {
                    setCurrentPage(p)
                    window.scrollTo({ top: 0, behavior: "smooth" })
                  }}
                />
              </>
            )}
          </div>

          {/* Right sidebar */}
          <div className="space-y-5">
            {/* Assessment CTA */}
            <div className="relative overflow-hidden rounded-2xl p-6 text-white bg-gradient-to-br from-indigo-600 to-violet-600 shadow-lg">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="relative z-10">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                    <Crosshair className="w-5 h-5" />
                  </div>
                  <div className="text-[17px] font-bold">学前能力基线测评</div>
                </div>
                <p className="text-[13px] text-white/85 leading-relaxed mb-4">
                  学习前先测一测，精准定位你的能力起点，量身规划学习路径
                </p>
                <Button
                  className="bg-white text-indigo-600 hover:bg-white/90 rounded-full px-5 h-10 text-[13px] font-semibold shadow-sm"
                  onClick={() => router.push("/evaluation")}
                >
                  开始测评 <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>

            <RankingList positions={positions} industryMap={industryMap} />

            {/* My heart jobs */}
            <div className="bg-white rounded-2xl border border-[#e7e5e4] p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="text-[15px] font-bold text-[#0f172a] flex items-center gap-2">
                  <Heart className="w-4 h-4 text-rose-500" />
                  我的心仪岗位
                </div>
              </div>
              <div className="flex flex-col items-center justify-center text-[#94a3b8] py-6 text-center">
                <Heart className="w-10 h-10 mb-3 opacity-40" />
                <div className="text-sm font-semibold text-[#475569]">暂无收藏岗位</div>
                <div className="text-xs mt-1">登录后浏览岗位并点击收藏，即可在此查看</div>
                {!user && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4 rounded-full"
                    onClick={() => router.push("/portal/login")}
                  >
                    去登录
                  </Button>
                )}
              </div>
            </div>

            {/* Target recommendations */}
            <div className="bg-white rounded-2xl border border-[#e7e5e4] p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="text-[15px] font-bold text-[#0f172a] flex items-center gap-2">
                  <Flag className="w-4 h-4 text-blue-500" />
                  目标推荐岗位
                </div>
              </div>
              <div className="flex flex-col items-center justify-center text-[#94a3b8] py-6 text-center">
                <TrendingUp className="w-10 h-10 mb-3 opacity-40" />
                <div className="text-sm font-semibold text-[#475569]">暂无目标推荐</div>
                <div className="text-xs mt-1">完成能力测评后，系统将为你推荐匹配岗位</div>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4 rounded-full"
                  onClick={() => router.push("/evaluation")}
                >
                  <GraduationCap className="w-3.5 h-3.5 mr-1" /> 去测评
                </Button>
              </div>
            </div>
          </div>
        </div>
      </main>

      <PlatformFooter />
    </div>
  )
}
