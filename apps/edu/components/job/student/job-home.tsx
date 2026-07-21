"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Search, Flag, Heart, Crosshair, Sparkles, Filter, X,
  TrendingUp, GraduationCap, ChevronRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { publicPositionApi, scenarioApi } from "@/lib/api"
import { useAuth } from "@/components/auth-provider"
import { useIndustryMap } from "@/lib/use-resource-maps"
import type { CareerPosition, Scenario } from "@/lib/types"
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
  const listRef = useRef<HTMLDivElement>(null)

  const [positions, setPositions] = useState<CareerPosition[]>([])
  const [scenarios, setScenarios] = useState<Scenario[]>([])
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

  useEffect(() => {
    scenarioApi
      .list({ status: "published", limit: 1000 })
      .then((res) => setScenarios(res.items || []))
      .catch(() => setScenarios([]))
  }, [])

  const scenarioCountMap = useMemo(() => {
    const map = new Map<string, number>()
    scenarios.forEach((s) => {
      if (s.careerPositionId) {
        map.set(s.careerPositionId, (map.get(s.careerPositionId) || 0) + 1)
      }
    })
    return map
  }, [scenarios])

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

  const executeSearch = () => {
    setCurrentPage(1)
    setTimeout(() => {
      listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    }, 50)
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F1FAFF]">
      {/* Hero Banner */}
      <div className="relative w-full pt-16 overflow-hidden min-h-[420px]">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/student-hero-bg.png')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[rgba(30,64,175,0.85)] via-[rgba(59,130,246,0.75)] to-[rgba(124,58,237,0.75)]" />
        <div className="relative z-10 max-w-[1400px] mx-auto px-8 pb-12 h-full min-h-[420px] flex flex-col lg:flex-row justify-between items-center gap-8">
          <div className="flex-1">
            <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm text-white px-3.5 py-1.5 rounded-full text-[13px] border border-white/20 mb-5">
              <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
              对接产业前沿 · 赋能岗位能力学习
            </div>
            <h1 className="text-[57px] font-extrabold text-white leading-[1.2] mb-4">
              对接产业前沿<br />开启岗位能力学习新征程
            </h1>
            <p className="text-[17px] text-white/85 mb-6 max-w-xl">
              链接真实岗位场景，构建从认知到胜任的能力进阶闭环
            </p>
            <Button
              className="inline-flex items-center gap-2 bg-white text-blue-600 hover:bg-white/90 px-6 h-11 rounded-full text-sm font-semibold shadow-lg"
              onClick={() => listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
            >
              浏览岗位 <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          <StatsBar
            total={stats.total}
            majorCount={stats.majorCount}
            industryCount={stats.industryCount}
            favoriteTotal={stats.favoriteTotal}
          />
        </div>
      </div>

      <main className="max-w-[1400px] mx-auto px-8 py-6 w-full flex-1">
        {/* Dashboard */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_340px] gap-5 mb-6">
          {/* 目标推荐岗位 */}
          <div className="bg-white rounded-2xl border border-[#e7e5e4] p-3 flex flex-col min-h-[178px]">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2 text-[15px] font-bold text-[#0f172a]">
                <Flag className="w-4 h-4 text-blue-500" />
                目标推荐岗位
              </div>
              <div className="text-xs text-[#94a3b8] cursor-pointer">全部 <ChevronRight className="w-3 h-3 inline" /></div>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center text-[#94a3b8] text-center px-4">
              <Flag className="w-9 h-9 mb-2 text-[#cbd5e1]" />
              <div className="text-sm font-semibold text-[#475569]">暂无目标推荐岗位</div>
              <div className="text-xs mt-0.5">完成能力测评后，系统将为你推荐匹配岗位</div>
            </div>
          </div>

          {/* 我的心仪岗位 */}
          <div className="bg-white rounded-2xl border border-[#e7e5e4] p-3 flex flex-col min-h-[178px]">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2 text-[15px] font-bold text-[#0f172a]">
                <Heart className="w-4 h-4 text-rose-500" />
                我的心仪岗位
              </div>
              <div className="text-xs text-[#94a3b8] cursor-pointer">全部 <ChevronRight className="w-3 h-3 inline" /></div>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center text-[#94a3b8] text-center px-4">
              <Heart className="w-9 h-9 mb-2 text-[#cbd5e1]" />
              <div className="text-sm font-semibold text-[#475569]">快去查看岗位点击收藏吧！</div>
              <div className="text-xs mt-0.5">浏览岗位资源，收藏你感兴趣的岗位</div>
            </div>
          </div>

          {/* 学前能力基线测评 */}
          <div className="rounded-2xl p-6 text-white bg-gradient-to-br from-indigo-500 to-violet-600 flex flex-col justify-between min-h-[178px]">
            <div>
              <div className="flex items-center gap-2.5 mb-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                  <Crosshair className="w-5 h-5" />
                </div>
                <div className="text-[17px] font-bold">学前能力基线测评</div>
              </div>
              <p className="text-[13px] text-white/85 leading-relaxed">
                学习前先测一测，精准定位你的能力起点，量身规划学习路径
              </p>
            </div>
            <Button
              className="self-start bg-white text-indigo-600 hover:bg-white/90 rounded-full h-9 px-5 text-[13px] font-semibold"
              onClick={() => router.push("/evaluation")}
            >
              开始测评 <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>

        {/* 心仪岗位排行榜 */}
        <div className="mb-6">
          <RankingList positions={positions} industryMap={industryMap} />
        </div>

        <div ref={listRef}>
          {/* Filter */}
          <div className="bg-white rounded-2xl border border-[#e7e5e4] p-5 mb-4">
            <div className="flex items-center gap-2 text-[16px] font-bold text-[#0f172a] mb-4 pl-3 border-l-4 border-blue-500">
              <Filter className="w-4 h-4" />
              岗位筛选
            </div>
            <div className="space-y-0">
              <div className="flex items-start gap-3 sm:gap-4 py-3 border-b border-dashed border-[#e7e5e4]">
                <span className="text-sm text-[#374151] font-medium min-w-[40px] pt-1.5">行业</span>
                <div className="flex flex-wrap gap-2.5">
                  {industries.map((item) => (
                    <button
                      key={item}
                      onClick={() => setSelectedIndustry(item)}
                      className={`
                        px-3.5 py-1.5 rounded-full text-[13px] border transition-all whitespace-nowrap
                        ${selectedIndustry === item
                          ? "bg-blue-500 text-white border-blue-500"
                          : "bg-white text-[#475569] border-[#e5e7eb] hover:border-blue-300 hover:text-blue-600"
                        }
                      `}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-start gap-3 sm:gap-4 py-3">
                <span className="text-sm text-[#374151] font-medium min-w-[40px] pt-1.5">专业</span>
                <div className="flex flex-wrap gap-2.5">
                  {majors.map((item) => (
                    <button
                      key={item}
                      onClick={() => setSelectedMajor(item)}
                      className={`
                        px-3.5 py-1.5 rounded-full text-[13px] border transition-all whitespace-nowrap
                        ${selectedMajor === item
                          ? "bg-blue-500 text-white border-blue-500"
                          : "bg-white text-[#475569] border-[#e5e7eb] hover:border-blue-300 hover:text-blue-600"
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
              <div className="flex flex-wrap items-center gap-3 pt-4 mt-3 border-t border-dashed border-[#e7e5e4]">
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
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-[#e7e5e4]">
              {SORT_OPTIONS.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setSort(s.value)}
                  className={`
                    px-4 py-2 rounded-[10px] text-[13px] transition-all
                    ${sort === s.value ? "bg-[#eff6ff] text-blue-600 font-medium" : "text-[#475569] hover:text-blue-600"}
                  `}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <div className="relative w-[320px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" />
              <Input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") executeSearch() }}
                placeholder="搜索岗位名称、岗位编码或关键词"
                className="pl-10 pr-20 h-10 bg-[#f8fafc] border-[#e7e5e4] rounded-[10px] text-sm"
              />
              <Button
                className="absolute right-1 top-1/2 -translate-y-1/2 rounded-[10px] px-4 h-8 bg-gradient-to-r from-blue-500 to-blue-400 hover:from-blue-600 hover:to-blue-500 text-white text-xs"
                onClick={executeSearch}
              >
                搜索
              </Button>
            </div>
          </div>

          <div className="text-sm text-[#64748b] mb-4">
            当前共展示 <b className="text-blue-600">{filtered.length}</b> 个岗位查看入口
          </div>

          {/* Grid */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {Array.from({ length: 12 }).map((_, i) => (
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {pageItems.map((pos, i) => (
                  <JobCard key={pos.id} position={pos} index={i} hideHot={i > 2} scenarioCount={scenarioCountMap.get(pos.id) ?? 0} />
                ))}
              </div>
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={(p) => {
                  setCurrentPage(p)
                  listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
                }}
              />
            </>
          )}
        </div>
      </main>

      <PlatformFooter />
    </div>
  )
}
