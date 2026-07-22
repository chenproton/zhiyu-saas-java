"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Search, Flag, Heart, Crosshair, Sparkles, Filter, X,
  TrendingUp, GraduationCap, ChevronRight,
  Layers, ListChecks, Factory, Building2, BarChart3,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { publicPositionApi, scenarioApi, taskApi, positionApi, recommendApi } from "@/lib/api"
import { useAuth } from "@/components/auth-provider"
import { useIndustryMap } from "@/lib/use-resource-maps"
import type { CareerPosition, Scenario } from "@/lib/types"
import { StatsBar } from "./stats-bar"
import { JobCard } from "./job-card"
import { SceneCard } from "@/components/scene/student/scene-card"
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
const SCENE_SORT_OPTIONS = [
  { value: "default", label: "默认排序" },
  { value: "recent", label: "最近收录" },
  { value: "update", label: "最近更新" },
  { value: "tasks", label: "最多任务" },
]

const difficultyMap: Record<number, string> = {
  1: "入门", 2: "初级", 3: "中级", 4: "高级", 5: "专家",
}

interface JobHomeProps {
  mode?: "job" | "scene"
}

export function JobHome({ mode = "job" }: JobHomeProps) {
  const router = useRouter()
  const { user } = useAuth()
  const industryMap = useIndustryMap()
  const listRef = useRef<HTMLDivElement>(null)
  const isScene = mode === "scene"

  const [positions, setPositions] = useState<CareerPosition[]>([])
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [taskCountMap, setTaskCountMap] = useState<Map<string, number>>(new Map())
  const [favoritePositions, setFavoritePositions] = useState<CareerPosition[]>([])
  const [hotPositions, setHotPositions] = useState<Array<{ positionId: string; order: number }>>([])
  const [loading, setLoading] = useState(true)

  const [currentPage, setCurrentPage] = useState(1)
  const [sort, setSort] = useState("default")
  const [keyword, setKeyword] = useState("")
  const [selectedIndustry, setSelectedIndustry] = useState<string>("全部")
  const [selectedMajor, setSelectedMajor] = useState<string>("全部")
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>("全部")

  useEffect(() => {
    setLoading(true)
    if (isScene) {
      scenarioApi
        .list({ status: "published", limit: 1000 })
        .then(async (res) => {
          const scens = res.items || []
          setScenarios(scens)
          const results = await Promise.all(
            scens.map((s) => taskApi.list({ scenarioId: s.id, limit: 1000 }).catch(() => ({ items: [], total: 0 })))
          )
          const map = new Map<string, number>()
          scens.forEach((s, idx) => {
            map.set(s.id, results[idx]?.items?.length ?? 0)
          })
          setTaskCountMap(map)
        })
        .catch(() => { setScenarios([]); setTaskCountMap(new Map()) })
        .finally(() => setLoading(false))
    } else {
      publicPositionApi
        .list({ status: "published", limit: 1000 })
        .then((res) => setPositions(res.items || []))
        .catch(() => setPositions([]))
        .finally(() => setLoading(false))
    }
  }, [isScene])

  useEffect(() => {
    recommendApi
      .list({ limit: 1000 })
      .then((res) => {
        const items = (res.items || [])
          .filter((rec) => rec.isEnabled)
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((rec) => ({ positionId: rec.careerPositionId, order: rec.sortOrder }))
        setHotPositions(items)
      })
      .catch(() => setHotPositions([]))
  }, [])

  useEffect(() => {
    if (isScene) return
    scenarioApi
      .list({ status: "published", limit: 1000 })
      .then(async (res) => {
        const scens = res.items || []
        setScenarios(scens)
        const related = scens.filter((s) => s.careerPositionId)
        if (related.length === 0) { setTaskCountMap(new Map()); return }
        const results = await Promise.all(
          related.map((s) => taskApi.list({ scenarioId: s.id, limit: 1000 }).catch(() => ({ items: [], total: 0 })))
        )
        const map = new Map<string, number>()
        related.forEach((s, idx) => {
          const count = results[idx]?.items?.length ?? 0
          if (count > 0 && s.careerPositionId) {
            map.set(s.careerPositionId, (map.get(s.careerPositionId) || 0) + count)
          }
        })
        setTaskCountMap(map)
      })
      .catch(() => { setScenarios([]); setTaskCountMap(new Map()) })
  }, [isScene])

  useEffect(() => {
    if (!user) { setFavoritePositions([]); return }
    positionApi
      .listFavorites()
      .then((res) => setFavoritePositions(res.items || []))
      .catch(() => setFavoritePositions([]))
  }, [user, isScene])

  const scenarioCountMap = useMemo(() => {
    const map = new Map<string, number>()
    if (isScene) return map
    scenarios.forEach((s) => {
      if (s.careerPositionId) {
        map.set(s.careerPositionId, (map.get(s.careerPositionId) || 0) + 1)
      }
    })
    return map
  }, [scenarios, isScene])

  const favoritePositionScenarios = useMemo(() => {
    if (!isScene || favoritePositions.length === 0) return []
    const fpIds = new Set(favoritePositions.map((p) => p.id))
    return scenarios.filter((s) => s.careerPositionId && fpIds.has(s.careerPositionId))
  }, [isScene, scenarios, favoritePositions])

  const industries = useMemo(() => {
    if (isScene) {
      const set = new Set<string>()
      scenarios.forEach((s) => { s.industryNames?.forEach((n) => n && set.add(n)) })
      return ["全部", ...Array.from(set).sort()]
    }
    const set = new Set<string>()
    positions.forEach((p) => {
      if (p.industryId) {
        const name = industryMap.get(p.industryId)
        if (name) set.add(name)
      }
    })
    return ["全部", ...Array.from(set).sort()]
  }, [isScene, scenarios, positions, industryMap])

  const majors = useMemo(() => {
    const set = new Set<string>()
    positions.forEach((p) => p.majorNames?.forEach((m) => { if (m) set.add(m) }))
    return ["全部", ...Array.from(set).sort()]
  }, [positions])

  const difficulties = useMemo(() => {
    const nums = new Set<number>()
    scenarios.forEach((s) => { if (s.difficulty) nums.add(s.difficulty) })
    return ["全部", ...Array.from(nums).sort().map((n) => difficultyMap[n] || String(n))]
  }, [scenarios])

  const sceneFiltered = useMemo(() => {
    let list = [...scenarios]
    if (selectedIndustry !== "全部") {
      list = list.filter((s) => s.industryNames?.includes(selectedIndustry))
    }
    if (selectedDifficulty !== "全部") {
      list = list.filter((s) => difficultyMap[s.difficulty] === selectedDifficulty)
    }
    if (keyword.trim()) {
      const k = keyword.trim().toLowerCase()
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(k) ||
          (s.code?.toLowerCase().includes(k) ?? false) ||
          (s.background?.toLowerCase().includes(k) ?? false) ||
          s.id.toLowerCase().includes(k)
      )
    }
    switch (sort) {
      case "tasks":
        list.sort((a, b) => (taskCountMap.get(b.id) ?? 0) - (taskCountMap.get(a.id) ?? 0) || a.name.localeCompare(b.name, "zh-CN"))
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
  }, [scenarios, selectedIndustry, selectedDifficulty, keyword, sort, taskCountMap])

  const hotPositionIds = useMemo(() => new Set(hotPositions.map((h) => h.positionId)), [hotPositions])
  const hotOrderMap = useMemo(() => new Map(hotPositions.map((h) => [h.positionId, h.order])), [hotPositions])

  const jobFiltered = useMemo(() => {
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
      default: {
        list.sort((a, b) => {
          const aOrder = hotOrderMap.get(a.id)
          const bOrder = hotOrderMap.get(b.id)
          if (aOrder !== undefined && bOrder !== undefined) return aOrder - bOrder
          if (aOrder !== undefined) return -1
          if (bOrder !== undefined) return 1
          return a.name.localeCompare(b.name, "zh-CN")
        })
        break
      }
    }
    return list
  }, [positions, selectedIndustry, selectedMajor, keyword, sort, industryMap, hotOrderMap])

  const filtered = isScene ? sceneFiltered : jobFiltered

  const totalPages = Math.max(1, Math.ceil(filtered.length / CARDS_PER_PAGE))
  const pageItems = useMemo(() => {
    const start = (currentPage - 1) * CARDS_PER_PAGE
    return filtered.slice(start, start + CARDS_PER_PAGE)
  }, [filtered, currentPage])

  useEffect(() => { setCurrentPage(1) }, [selectedIndustry, selectedMajor, selectedDifficulty, keyword, sort])

  const activeFilters = useMemo(() => {
    const filters: { type: string; label: string }[] = []
    if (selectedIndustry !== "全部") filters.push({ type: "industry", label: `行业：${selectedIndustry}` })
    if (!isScene && selectedMajor !== "全部") filters.push({ type: "major", label: `专业：${selectedMajor}` })
    if (isScene && selectedDifficulty !== "全部") filters.push({ type: "difficulty", label: `难度：${selectedDifficulty}` })
    if (keyword.trim()) filters.push({ type: "keyword", label: `关键词：${keyword.trim()}` })
    return filters
  }, [selectedIndustry, selectedMajor, selectedDifficulty, keyword, isScene])

  const stats = useMemo(() => {
    if (isScene) {
      const industrySet = new Set<string>()
      let totalTasks = 0
      const positionSet = new Set<string>()
      const diffSet = new Set<number>()
      scenarios.forEach((s) => {
        s.industryNames?.forEach((n) => n && industrySet.add(n))
        totalTasks += taskCountMap.get(s.id) ?? 0
        if (s.careerPositionId) positionSet.add(s.careerPositionId)
        if (s.difficulty) diffSet.add(s.difficulty)
      })
      return {
        total: scenarios.length,
        industryCount: industrySet.size,
        taskCount: totalTasks,
        majorCount: totalTasks,
        favoriteTotal: positionSet.size,
        difficultyLevels: diffSet.size,
      }
    }
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
      taskCount: 0,
      difficultyLevels: 0,
    }
  }, [isScene, scenarios, positions, taskCountMap])

  const executeSearch = () => {
    setCurrentPage(1)
    setTimeout(() => {
      listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    }, 50)
  }

  const sortOptions = isScene ? SCENE_SORT_OPTIONS : SORT_OPTIONS

  return (
    <div className="min-h-screen flex flex-col bg-[#F1FAFF]">
      {/* Hero Banner */}
      <div className="relative w-full pt-16 overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: isScene ? "url('/scene-hero-bg.png')" : "url('/student-hero-bg.png')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[rgba(30,64,175,0.88)] via-[rgba(59,130,246,0.78)] to-[rgba(124,58,237,0.78)]" />
        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.15) 1px, transparent 1px)`,
            backgroundSize: "48px 48px",
          }}
        />
        <div className="absolute top-[-80px] right-[10%] w-[420px] h-[420px] rounded-full bg-white/10 blur-[100px] pointer-events-none" />
        <div className="absolute bottom-[-60px] left-[5%] w-[320px] h-[320px] rounded-full bg-blue-400/15 blur-[90px] pointer-events-none" />
        <div className="relative z-10 max-w-[1400px] mx-auto px-8 pb-14 pt-2 flex flex-col lg:flex-row justify-between items-start gap-8">
          <div className="flex-1 pt-4">
            <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-md text-white px-3.5 py-1.5 rounded-full text-[13px] border border-white/25 mb-5 shadow-[0_2px_12px_rgba(0,0,0,0.1)]">
              <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
              {isScene ? "场景化实践 · 任务驱动教学" : "对接产业前沿 · 赋能岗位能力学习"}
            </div>
            <h1 className="text-[42px] sm:text-[48px] lg:text-[52px] font-bold text-white leading-[1.15] mb-5 drop-shadow-sm">
              {isScene ? (
                <>场景化实践教学<br />以真实场景驱动能力成长</>
              ) : (
                <>对接产业前沿<br />开启岗位能力学习新征程</>
              )}
            </h1>
            <p className="text-[17px] text-white/85 mb-7 max-w-2xl leading-relaxed">
              {isScene
                ? "基于真实业务场景的任务化训练，从入门到专家，系统提升综合实战能力"
                : "链接真实岗位场景，构建从认知到胜任的能力进阶闭环"}
            </p>
            <Button
              className="inline-flex items-center gap-2 bg-white text-blue-600 hover:bg-blue-50 hover:-translate-y-0.5 px-7 h-12 rounded-full text-sm font-semibold shadow-lg transition-all"
              onClick={() => listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
            >
              {isScene ? "浏览场景" : "浏览岗位"} <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          {isScene ? (
            <div className="w-full lg:w-[520px] shrink-0 flex flex-col gap-4 pt-4">
              {/* 目标岗位配套场景 */}
              <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-5 text-white shadow-[0_8px_32px_rgba(0,0,0,0.18)]">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-yellow-400/30 to-orange-500/30 border border-white/15 flex items-center justify-center shadow-sm">
                    <Flag className="w-4 h-4 text-yellow-300" />
                  </div>
                  <span className="text-[15px] font-bold">目标岗位配套场景</span>
                </div>
                <div className="flex flex-col items-center justify-center text-white/50 text-center py-6">
                  <Flag className="w-9 h-9 mb-3 opacity-40" />
                  <div className="text-sm font-semibold text-white/80">暂无目标岗位配套场景</div>
                  <div className="text-[12px] mt-1.5 text-white/50 leading-relaxed max-w-[320px]">完成能力测评后，系统将为你推荐匹配岗位，关联场景将在此展示</div>
                </div>
              </div>
              {/* 心仪岗位配套场景 */}
              <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-5 text-white shadow-[0_8px_32px_rgba(0,0,0,0.18)]">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-rose-400/30 to-pink-500/30 border border-white/15 flex items-center justify-center shadow-sm">
                    <Heart className="w-4 h-4 text-rose-300" />
                  </div>
                  <span className="text-[15px] font-bold">心仪岗位配套场景</span>
                </div>
                {favoritePositionScenarios.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-white/50 text-center py-6">
                    <Heart className="w-9 h-9 mb-3 opacity-40" />
                    <div className="text-sm font-semibold text-white/80">快去收藏岗位吧！</div>
                    <div className="text-[12px] mt-1.5 text-white/50 leading-relaxed max-w-[320px]">在岗位列表收藏你感兴趣的岗位，关联场景将在此展示</div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1">
                    {favoritePositionScenarios.slice(0, 4).map((sc) => (
                      <Link key={sc.id} href={`/scene/landing/${sc.id}`}>
                        <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-white/15 cursor-pointer transition-all group">
                          <span className="flex-1 text-[13px] truncate group-hover:text-yellow-200 transition-colors">{sc.name}</span>
                          <span className="text-[11px] text-white/40 shrink-0">v{sc.version || "1.0"}</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <StatsBar
              total={stats.total}
              majorCount={stats.majorCount}
              industryCount={stats.industryCount}
              favoriteTotal={stats.favoriteTotal}
            />
          )}
        </div>
      </div>

      {/* Stats bar for scene mode - 4 indicators below hero */}
      {isScene && (
        <div className="max-w-[1400px] mx-auto px-8 -mt-10 relative z-20 w-full">
          <div className="bg-white rounded-2xl border border-[#e7e5e4] shadow-[0_8px_32px_rgba(0,0,0,0.06)] p-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: Layers, value: stats.total, label: "实践场景", gradient: "from-blue-500 to-blue-400", light: "from-blue-500/20 to-blue-400/5" },
              { icon: ListChecks, value: stats.taskCount, label: "任务总数", gradient: "from-violet-500 to-violet-400", light: "from-violet-500/20 to-violet-400/5" },
              { icon: Factory, value: stats.industryCount, label: "覆盖行业", gradient: "from-emerald-500 to-emerald-400", light: "from-emerald-500/20 to-emerald-400/5" },
              { icon: Building2, value: stats.favoriteTotal, label: "关联岗位", gradient: "from-amber-500 to-amber-400", light: "from-amber-500/20 to-amber-400/5" },
            ].map((s, i) => (
              <div key={i} className="flex items-center gap-4 p-4 rounded-xl transition-all hover:-translate-y-0.5 hover:shadow-md hover:bg-[#f8fafc] cursor-default group">
                <div className={`relative w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg bg-gradient-to-br ${s.gradient} shrink-0 overflow-hidden`}>
                  <div className={`absolute inset-0 bg-gradient-to-br ${s.light} opacity-0 group-hover:opacity-100 transition-opacity`} />
                  <s.icon className="w-7 h-7 relative z-10" strokeWidth={1.8} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[28px] font-bold text-[#0f172a] leading-none tracking-tight">{s.value.toLocaleString()}</div>
                  <div className="text-[13px] text-[#64748b] mt-1 font-medium">{s.label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <main className="max-w-[1400px] mx-auto px-8 py-6 w-full flex-1">
        {/* Dashboard (job mode only) */}
        {!isScene && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_340px] gap-5 mb-6">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-4 flex flex-col min-h-[178px]">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-[15px] font-bold text-slate-800">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
                    <Flag className="w-4 h-4 text-blue-500" />
                  </div>
                  目标推荐岗位
                </div>
                <div className="text-xs text-slate-400 cursor-pointer hover:text-blue-600 transition-colors">全部 <ChevronRight className="w-3 h-3 inline" /></div>
              </div>
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-center px-4">
                <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center mb-3">
                  <Flag className="w-7 h-7 text-slate-300" />
                </div>
                <div className="text-sm font-semibold text-slate-600">暂无目标推荐岗位</div>
                <div className="text-xs mt-1">完成能力测评后，系统将为你推荐匹配岗位</div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-4 flex flex-col min-h-[178px]">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-[15px] font-bold text-slate-800">
                  <div className="w-7 h-7 rounded-lg bg-rose-50 flex items-center justify-center">
                    <Heart className="w-4 h-4 text-rose-500" />
                  </div>
                  我的心仪岗位
                </div>
                <Link href="/job/student" className="text-xs text-slate-400 hover:text-blue-600 cursor-pointer transition-colors">
                  全部 <ChevronRight className="w-3 h-3 inline" />
                </Link>
              </div>
              {favoritePositions.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-center px-4">
                  <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center mb-3">
                    <Heart className="w-7 h-7 text-slate-300" />
                  </div>
                  <div className="text-sm font-semibold text-slate-600">快去查看岗位点击收藏吧！</div>
                  <div className="text-xs mt-1">浏览岗位资源，收藏你感兴趣的岗位</div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col gap-1.5 overflow-hidden">
                  {favoritePositions.slice(0, 5).map((pos, i) => {
                    const display = pos.shortName || pos.name
                    const category = pos.industryId && industryMap.get(pos.industryId)
                      ? industryMap.get(pos.industryId)
                      : (pos.positionType === "enterprise" ? "企业" : "教学")
                    const majors = pos.majorNames?.filter(Boolean) || []
                    const majorText = majors.length === 0 ? "未分类" : majors.length === 1 ? majors[0] : `${majors[0]} +${majors.length - 1}`
                    const palette = { bg: "bg-blue-50/70", hover: "hover:bg-blue-100/60", border: "border-blue-100" }
                    return (
                      <Link key={pos.id} href={`/job/student/${pos.id}`}>
                        <div className={`flex items-start gap-2.5 px-2.5 py-2 rounded-xl border ${palette.bg} ${palette.hover} cursor-pointer transition-all group`}>
                          <div className="flex-1 min-w-0 flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <span className="flex-1 text-[13px] font-semibold text-slate-800 truncate group-hover:text-blue-600 transition-colors">
                                {display}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/70 text-slate-500 whitespace-nowrap font-medium border border-slate-200">
                                v{pos.version || "1.0"}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px]">
                              <span className="px-1.5 py-0.5 rounded-md bg-white/70 text-blue-600 truncate max-w-[80px] font-medium border border-blue-100">
                                {category}
                              </span>
                              <span className="px-1.5 py-0.5 rounded-md bg-white/70 text-emerald-600 truncate max-w-[120px] font-medium border border-emerald-100" title={majors.join("、") || "未分类"}>
                                {majorText}
                              </span>
                            </div>
                          </div>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="rounded-2xl p-6 text-white bg-gradient-to-br from-indigo-500 to-violet-600 flex flex-col justify-between min-h-[178px] shadow-lg shadow-indigo-500/20">
              <div>
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center shadow-sm">
                    <Crosshair className="w-5 h-5" />
                  </div>
                  <div className="text-[17px] font-bold">学前能力基线测评</div>
                </div>
                <p className="text-[13px] text-white/85 leading-relaxed">
                  学习前先测一测，精准定位你的能力起点，量身规划学习路径
                </p>
              </div>
              <Button
                className="self-start bg-white text-indigo-600 hover:bg-blue-50 hover:-translate-y-0.5 rounded-full h-10 px-6 text-[13px] font-semibold shadow-lg transition-all"
                onClick={() => router.push("/evaluation")}
              >
                开始测评 <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Ranking (job mode only) */}
        {!isScene && (
          <div className="mb-6">
            <RankingList positions={positions} industryMap={industryMap} />
          </div>
        )}

        {/* Scene mode: industry cloud + difficulty distribution */}
        {isScene && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-5 mb-6">
            {/* 行业覆盖热力标签 */}
            <div className="bg-white rounded-2xl border border-[#e7e5e4] shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-5">
              <div className="flex items-center gap-2.5 text-[15px] font-bold text-[#0f172a] mb-3">
                <div className="w-1 h-5 rounded-full bg-gradient-to-b from-amber-400 to-orange-500" />
                <Factory className="w-4 h-4 text-amber-500" />
                行业覆盖
                <span className="text-xs text-[#94a3b8] font-normal ml-auto">{(() => { const s = new Set<string>(); scenarios.forEach((sc) => sc.industryNames?.forEach((n) => n && s.add(n))); return s.size })()} 个行业</span>
              </div>
              {(() => {
                const counts = new Map<string, number>()
                scenarios.forEach((s) => s.industryNames?.forEach((n) => n && counts.set(n, (counts.get(n) || 0) + 1)))
                const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])
                const max = sorted[0]?.[1] || 1
                if (sorted.length === 0) return <div className="text-sm text-[#94a3b8] text-center py-6">暂无行业数据</div>
                const palettes = [
                  { bg: "rgba(249,115,22,{a})", text: "rgb(194,65,12)", border: "rgba(249,115,22,{b})" },
                  { bg: "rgba(59,130,246,{a})", text: "rgb(29,78,216)", border: "rgba(59,130,246,{b})" },
                  { bg: "rgba(139,92,246,{a})", text: "rgb(109,40,217)", border: "rgba(139,92,246,{b})" },
                  { bg: "rgba(16,185,129,{a})", text: "rgb(4,120,87)", border: "rgba(16,185,129,{b})" },
                  { bg: "rgba(236,72,153,{a})", text: "rgb(190,24,93)", border: "rgba(236,72,153,{b})" },
                ]
                return (
                  <div className="flex flex-wrap gap-2">
                    {sorted.slice(0, 15).map(([name, count], i) => {
                      const ratio = count / max
                      const p = palettes[i % palettes.length]
                      return (
                        <span
                          key={name}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all hover:scale-105 hover:shadow-sm cursor-default"
                          style={{
                            backgroundColor: p.bg.replace("{a}", String(0.08 + ratio * 0.18)),
                            color: p.text,
                            border: `1px solid ${p.border.replace("{b}", String(0.2 + ratio * 0.25))}`,
                            fontSize: `${12 + ratio * 4}px`,
                          }}
                        >
                          {name}
                          <span className="text-[10px] opacity-70 rounded-full bg-black/[0.06] px-1.5 py-0.5 leading-none font-medium">{count}</span>
                        </span>
                      )
                    })}
                    {sorted.length > 15 && (
                      <span className="text-[13px] text-[#94a3b8] self-end pb-1">+{sorted.length - 15} 更多</span>
                    )}
                  </div>
                )
              })()}
            </div>

            {/* 场景难度分布 */}
            <div className="bg-white rounded-2xl border border-[#e7e5e4] shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-5">
              <div className="flex items-center gap-2.5 text-[15px] font-bold text-[#0f172a] mb-3">
                <div className="w-1 h-5 rounded-full bg-gradient-to-b from-violet-400 to-purple-500" />
                <BarChart3 className="w-4 h-4 text-purple-500" />
                难度分布
              </div>
              {(() => {
                const diffCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
                scenarios.forEach((s) => { if (s.difficulty) diffCounts[s.difficulty] = (diffCounts[s.difficulty] || 0) + 1 })
                const entries = [
                  { key: 1, label: "入门", color: "#22c55e", from: "#22c55e", to: "#16a34a", bg: "#f0fdf4" },
                  { key: 2, label: "初级", color: "#eab308", from: "#facc15", to: "#ca8a04", bg: "#fefce8" },
                  { key: 3, label: "中级", color: "#f97316", from: "#fb923c", to: "#ea580c", bg: "#fff7ed" },
                  { key: 4, label: "高级", color: "#ef4444", from: "#f87171", to: "#dc2626", bg: "#fef2f2" },
                  { key: 5, label: "专家", color: "#8b5cf6", from: "#a78bfa", to: "#7c3aed", bg: "#f5f3ff" },
                ]
                const maxCount = Math.max(...Object.values(diffCounts), 1)
                return (
                  <div className="space-y-3">
                    {entries.map((e) => {
                      const count = diffCounts[e.key] || 0
                      const pct = Math.max(count / maxCount * 100, count > 0 ? 5 : 0)
                      return (
                        <div key={e.key} className="group">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[13px] font-semibold text-[#374151]">{e.label}</span>
                            <span className="text-[13px] font-bold text-[#475569]">{count} 个</span>
                          </div>
                          <div className="h-2 bg-[#f1f5f9] rounded-full overflow-hidden shadow-inner">
                            <div
                              className="h-full rounded-full transition-all duration-700 ease-out group-hover:brightness-110 shadow-[0_0_8px_rgba(0,0,0,0.08)]"
                              style={{
                                width: `${pct}%`,
                                background: `linear-gradient(90deg, ${e.from}, ${e.to})`,
                                minWidth: count > 0 ? "20px" : "0px",
                              }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })()}
            </div>
          </div>
        )}

        <div ref={listRef}>
          {/* Filter */}
          <div className="bg-white rounded-2xl border border-[#e7e5e4] shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-6 mb-5">
            <div className="flex items-center gap-2.5 text-[16px] font-bold text-[#0f172a] mb-5">
              <div className="w-1 h-5 rounded-full bg-gradient-to-b from-blue-400 to-blue-600" />
              <Filter className="w-4 h-4 text-blue-500" />
              {isScene ? "场景筛选" : "岗位筛选"}
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
                          ? "bg-blue-500 text-white border-blue-500 shadow-sm"
                          : "bg-slate-50 text-[#475569] border-slate-200 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50/50"
                        }
                      `}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
              {!isScene ? (
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
                            ? "bg-blue-500 text-white border-blue-500 shadow-sm"
                            : "bg-slate-50 text-[#475569] border-slate-200 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50/50"
                          }
                        `}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3 sm:gap-4 py-3">
                  <span className="text-sm text-[#374151] font-medium min-w-[40px] pt-1.5">难度</span>
                  <div className="flex flex-wrap gap-2.5">
                    {difficulties.map((item) => (
                      <button
                        key={item}
                        onClick={() => setSelectedDifficulty(item)}
                        className={`
                          px-3.5 py-1.5 rounded-full text-[13px] border transition-all whitespace-nowrap
                          ${selectedDifficulty === item
                            ? "bg-blue-500 text-white border-blue-500 shadow-sm"
                            : "bg-slate-50 text-[#475569] border-slate-200 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50/50"
                          }
                        `}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {activeFilters.length > 0 && (
              <div className="flex flex-wrap items-center gap-3 pt-4 mt-3 border-t border-dashed border-[#e7e5e4]">
                <span className="text-[13px] text-[#64748b]">已选条件：</span>
                {activeFilters.map((f) => (
                  <span
                    key={f.type}
                    className="inline-flex items-center gap-1.5 bg-[#eff6ff] text-blue-600 text-xs px-2.5 py-1 rounded-full border border-blue-100"
                  >
                    {f.label}
                    <X
                      className="w-3 h-3 cursor-pointer hover:text-red-500 transition-colors"
                      onClick={() => {
                        if (f.type === "industry") setSelectedIndustry("全部")
                        if (f.type === "major") setSelectedMajor("全部")
                        if (f.type === "difficulty") setSelectedDifficulty("全部")
                        if (f.type === "keyword") setKeyword("")
                      }}
                    />
                  </span>
                ))}
                <button
                  onClick={() => { setSelectedIndustry("全部"); setSelectedMajor("全部"); setSelectedDifficulty("全部"); setKeyword("") }}
                  className="text-[13px] text-blue-600 hover:text-blue-700 font-medium"
                >
                  清空筛选
                </button>
              </div>
            )}
          </div>

          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-0.5 bg-white p-1 rounded-xl border border-[#e7e5e4] shadow-sm">
              {sortOptions.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setSort(s.value)}
                  className={`
                    px-5 py-2 rounded-[10px] text-[13px] transition-all font-medium
                    ${sort === s.value ? "bg-blue-500 text-white shadow-md" : "text-[#475569] hover:text-blue-600 hover:bg-[#f8fafc]"}
                  `}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <div className="relative w-full sm:w-[340px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" />
              <Input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") executeSearch() }}
                placeholder={isScene ? "搜索场景名称、编码或关键词" : "搜索岗位名称、岗位编码或关键词"}
                className="pl-10 pr-[72px] h-11 bg-[#f8fafc] border-[#e7e5e4] rounded-xl text-sm shadow-sm focus:border-blue-300 focus:ring-2 focus:ring-blue-100 focus:bg-white transition-all"
              />
              <Button
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-[10px] px-5 h-8 bg-gradient-to-r from-blue-500 to-blue-400 hover:from-blue-600 hover:to-blue-500 text-white text-xs font-medium shadow-sm hover:shadow-md transition-all"
                onClick={executeSearch}
              >
                搜索
              </Button>
            </div>
          </div>

          <div className="text-[13px] text-[#64748b] mb-5">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
              当前共展示 <b className="text-blue-600">{filtered.length}</b> {isScene ? "个场景查看入口" : "个岗位查看入口"}
            </span>
          </div>

          {/* Grid */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="bg-white rounded-2xl border border-[#e7e5e4] h-[360px] animate-pulse shadow-sm" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 text-[#94a3b8] bg-white rounded-2xl border border-[#e7e5e4] shadow-sm">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#f8fafc] flex items-center justify-center">
                <Search className="w-8 h-8 opacity-30" />
              </div>
              <div className="text-[15px] font-medium text-[#475569]">
                {isScene ? "暂无匹配的场景" : "暂无匹配的岗位"}
              </div>
              <div className="text-[13px] mt-1">试试调整筛选条件或搜索关键词</div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {isScene
                  ? (pageItems as Scenario[]).map((scenario, i) => (
                      <SceneCard
                        key={scenario.id}
                        scenario={scenario}
                        index={i}
                        taskCount={taskCountMap.get(scenario.id) ?? 0}
                      />
                    ))
                  : (pageItems as CareerPosition[]).map((pos, i) => (
                      <JobCard
                        key={pos.id}
                        position={pos}
                        index={i}
                        isHot={hotPositionIds.has(pos.id)}
                        scenarioCount={scenarioCountMap.get(pos.id) ?? 0}
                        taskCount={taskCountMap.get(pos.id) ?? 0}
                        industryName={pos.industryId ? industryMap.get(pos.industryId) : undefined}
                      />
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
