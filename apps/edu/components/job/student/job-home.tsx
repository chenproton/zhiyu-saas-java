'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Flag, Heart, Layers, ListChecks, Factory, Building2, Briefcase, GraduationCap } from 'lucide-react'
import { publicPositionApi, scenarioApi, taskApi, positionApi, recommendApi } from '@/lib/api'
import { useAuth } from '@/components/auth-provider'
import { useIndustryMap } from '@/lib/use-resource-maps'
import type { CareerPosition, Scenario } from '@/lib/types'
import { SCENE_DIFFICULTY } from '@/lib/types'
import { formatDate } from '@/lib/format-utils'
import { JobCard } from './job-card'
import { SceneCard } from '@/components/scene/student/scene-card'
import { LandingPagination } from '@/components/shared/landing-pagination'
import { LandingFilterRow } from '@/components/shared/landing-filter-row'
import { RankingList } from './ranking-list'
import { LandingShell, LandingSkeleton, LandingEmpty } from '@/components/shared/landing-shell'

const CARDS_PER_PAGE = 12
const SORT_OPTIONS = [
  { value: 'default', label: '默认排序' },
  { value: 'hot', label: '最多收藏' },
  { value: 'recent', label: '最近收录' },
  { value: 'update', label: '最近更新' },
]
const SCENE_SORT_OPTIONS = [
  { value: 'default', label: '默认排序' },
  { value: 'recent', label: '最近收录' },
  { value: 'update', label: '最近更新' },
  { value: 'tasks', label: '最多任务' },
]

interface JobHomeProps {
  mode?: 'job' | 'scene'
}

function PositionSideLists({
  recommendedPositions,
  favoritePositions,
}: {
  recommendedPositions: CareerPosition[]
  favoritePositions: CareerPosition[]
}) {
  const [activeTab, setActiveTab] = useState<'recommended' | 'favorite'>('recommended')
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveTab((t) => (t === 'recommended' ? 'favorite' : 'recommended'))
    }, 4000)
    return () => clearInterval(timer)
  }, [tick])

  const switchTab = (tab: 'recommended' | 'favorite') => {
    setActiveTab(tab)
    setTick((n) => n + 1)
  }

  const isRec = activeTab === 'recommended'
  const positions = isRec ? recommendedPositions : favoritePositions
  const emptyText = isRec ? '暂无目标推荐岗位' : '快去收藏岗位吧！'
  const EmptyIcon = isRec ? Flag : Heart
  const activeClass = isRec
    ? 'bg-gradient-to-br from-yellow-400 to-orange-500 text-white border border-transparent shadow-sm'
    : 'bg-gradient-to-br from-rose-400 to-pink-500 text-white border border-transparent shadow-sm'

  return (
    <div className="bg-white rounded-2xl border border-[#e7e5e4] p-5 text-[#0f172a] shadow-[0_8px_32px_rgba(0,0,0,0.12)] h-[256px] lg:h-[340px] flex flex-col">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="flex gap-1 p-1 rounded-xl bg-[#f1f5f9] border border-[#e2e8f0]">
          <button
            onClick={() => switchTab('recommended')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all ${
              isRec ? activeClass : 'text-[#64748b] hover:text-[#0f172a] hover:bg-white'
            }`}
          >
            <Flag className="w-3.5 h-3.5" />
            目标岗位
          </button>
          <button
            onClick={() => switchTab('favorite')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all ${
              !isRec ? activeClass : 'text-[#64748b] hover:text-[#0f172a] hover:bg-white'
            }`}
          >
            <Heart className="w-3.5 h-3.5" />
            收藏岗位
          </button>
        </div>
        <span className="text-[12px] text-[#94a3b8] ml-auto shrink-0">
          {positions.length} 个岗位
        </span>
      </div>

      {positions.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-[#94a3b8] text-center py-4">
          <EmptyIcon className="w-9 h-9 mb-3 opacity-40" />
          <div className="text-sm font-semibold text-[#475569]">{emptyText}</div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar-thin flex flex-col gap-1">
          {positions.map((pos) => (
            <Link key={pos.id} href={`/job/landing/${pos.id}/learn`}>
              <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-[#f8fafc] cursor-pointer transition-all group">
                <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                  <span
                    className={`text-[13px] truncate text-[#0f172a] transition-colors ${
                      isRec ? 'group-hover:text-yellow-600' : 'group-hover:text-rose-600'
                    }`}
                  >
                    {pos.shortName || pos.name}
                  </span>
                  <span className="text-[11px] text-[#94a3b8] truncate">
                    适用专业：{pos.majorNames?.filter(Boolean)[0] || '未分类'} · 更新：
                    {formatDate(pos.updatedAt)}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
      <style jsx>{`
        .custom-scrollbar-thin::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar-thin::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.2);
          border-radius: 2px;
        }
        .custom-scrollbar-thin::-webkit-scrollbar-track {
          background: transparent;
        }
      `}</style>
    </div>
  )
}


export function JobHome({ mode = 'job' }: JobHomeProps) {
  const { user } = useAuth()
  const industryMap = useIndustryMap()
  const listRef = useRef<HTMLDivElement>(null)
  const isScene = mode === 'scene'

  const [positions, setPositions] = useState<CareerPosition[]>([])
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [taskCountMap, setTaskCountMap] = useState<Map<string, number>>(new Map())
  const [knowledgePointCountMap, setKnowledgePointCountMap] = useState<Map<string, number>>(
    new Map(),
  )
  const [favoritePositions, setFavoritePositions] = useState<CareerPosition[]>([])
  const [hotPositions, setHotPositions] = useState<Array<{ positionId: string; order: number }>>([])
  const [loading, setLoading] = useState(true)

  const [currentPage, setCurrentPage] = useState(1)
  const [sort, setSort] = useState('default')
  const [keyword, setKeyword] = useState('')
  const [selectedIndustry, setSelectedIndustry] = useState<string>('全部')
  const [selectedMajor, setSelectedMajor] = useState<string>('全部')
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('全部')
  const [selectedPosition, setSelectedPosition] = useState<string>('全部')
  const [selectedProfession, setSelectedProfession] = useState<string>('全部')

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      const fetches: Promise<void>[] = []

      if (isScene) {
        fetches.push(
          scenarioApi
            .list({ status: 'published', limit: 1000 })
            .then(async (res) => {
              const scens = res.items || []
              setScenarios(scens)
              const results = await Promise.all(
                scens.map((s) =>
                  taskApi
                    .list({ scenarioId: s.id, limit: 1000 })
                    .catch(() => ({ items: [], total: 0 })),
                ),
              )
              const map = new Map<string, number>()
              const kpMap = new Map<string, number>()
              scens.forEach((s, idx) => {
                const taskList = results[idx]?.items || []
                map.set(s.id, taskList.length)
                const kpIds = new Set<string>()
                taskList.forEach((t: any) =>
                  (t.knowledgePointIds || []).forEach((kid: string) => kpIds.add(kid)),
                )
                kpMap.set(s.id, kpIds.size)
              })
              setTaskCountMap(map)
              setKnowledgePointCountMap(kpMap)
            })
            .catch(() => {
              setScenarios([])
              setTaskCountMap(new Map())
              setKnowledgePointCountMap(new Map())
            }),
        )
        fetches.push(
          publicPositionApi
            .list({ status: 'published', limit: 1000 })
            .then((res) => setPositions(res.items || []))
            .catch(() => setPositions([])),
        )
      } else {
        fetches.push(
          publicPositionApi
            .list({ status: 'published', limit: 1000 })
            .then((res) => setPositions(res.items || []))
            .catch(() => setPositions([])),
        )
      }

      await Promise.all(fetches).finally(() => setLoading(false))
    })()
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
      .list({ status: 'published', limit: 1000 })
      .then((res) => {
        setScenarios(res.items || [])
      })
      .catch(() => {
        setScenarios([])
      })
  }, [isScene])

  useEffect(() => {
    ;(async () => {
      if (!user) {
        setFavoritePositions([])
        return
      }
      try {
        const res = await positionApi.listFavorites()
        setFavoritePositions(res.items || [])
      } catch {
        setFavoritePositions([])
      }
    })()
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

  const industries = useMemo(() => {
    if (isScene) {
      const set = new Set<string>()
      scenarios.forEach((s) => {
        s.industryNames?.forEach((n) => n && set.add(n))
      })
      return ['全部', ...Array.from(set).sort()]
    }
    const set = new Set<string>()
    positions.forEach((p) => {
      if (p.industryId) {
        const name = industryMap.get(p.industryId)
        if (name) set.add(name)
      }
    })
    return ['全部', ...Array.from(set).sort()]
  }, [isScene, scenarios, positions, industryMap])

  const majors = useMemo(() => {
    const set = new Set<string>()
    positions.forEach((p) =>
      p.majorNames?.forEach((m) => {
        if (m) set.add(m)
      }),
    )
    return ['全部', ...Array.from(set).sort()]
  }, [positions])

  const difficulties = useMemo(() => {
    const nums = new Set<number>()
    scenarios.forEach((s) => {
      if (s.difficulty) nums.add(s.difficulty)
    })
    return [
      '全部',
      ...Array.from(nums)
        .sort()
        .map((n) => SCENE_DIFFICULTY[n]?.label || String(n)),
    ]
  }, [scenarios])

  const positionNames = useMemo(() => {
    if (!isScene) return []
    const idToName = new Map(positions.map((p) => [p.id, p.shortName || p.name]))
    const set = new Set<string>()
    scenarios.forEach((s) => {
      if (s.careerPositionId && idToName.has(s.careerPositionId)) {
        set.add(idToName.get(s.careerPositionId)!)
      }
    })
    return ['全部', ...Array.from(set).sort()]
  }, [isScene, scenarios, positions])

  const professionNames = useMemo(() => {
    if (!isScene) return []
    const set = new Set<string>()
    scenarios.forEach((s) => {
      s.professionNames?.forEach((n) => n && set.add(n))
    })
    return ['全部', ...Array.from(set).sort()]
  }, [isScene, scenarios])

  const sceneFiltered = useMemo(() => {
    let list = [...scenarios]
    if (selectedIndustry !== '全部') {
      list = list.filter((s) => s.industryNames?.includes(selectedIndustry))
    }
    if (selectedPosition !== '全部') {
      const idToName = new Map(positions.map((p) => [p.id, p.shortName || p.name]))
      const targetId = Array.from(idToName.entries()).find(
        ([, name]) => name === selectedPosition,
      )?.[0]
      if (targetId) {
        list = list.filter((s) => s.careerPositionId === targetId)
      }
    }
    if (selectedProfession !== '全部') {
      list = list.filter((s) => s.professionNames?.includes(selectedProfession))
    }
    if (selectedDifficulty !== '全部') {
      list = list.filter((s) => SCENE_DIFFICULTY[s.difficulty]?.label === selectedDifficulty)
    }
    if (keyword.trim()) {
      const k = keyword.trim().toLowerCase()
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(k) ||
          (s.code?.toLowerCase().includes(k) ?? false) ||
          (s.background?.toLowerCase().includes(k) ?? false) ||
          s.id.toLowerCase().includes(k),
      )
    }
    switch (sort) {
      case 'tasks':
        list.sort(
          (a, b) =>
            (taskCountMap.get(b.id) ?? 0) - (taskCountMap.get(a.id) ?? 0) ||
            a.name.localeCompare(b.name, 'zh-CN'),
        )
        break
      case 'recent':
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        break
      case 'update':
        list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        break
      default:
        list.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
        break
    }
    return list
  }, [
    scenarios,
    selectedIndustry,
    selectedPosition,
    selectedProfession,
    selectedDifficulty,
    keyword,
    sort,
    taskCountMap,
    positions,
  ])

  const hotPositionIds = useMemo(
    () => new Set(hotPositions.map((h) => h.positionId)),
    [hotPositions],
  )
  const hotOrderMap = useMemo(
    () => new Map(hotPositions.map((h) => [h.positionId, h.order])),
    [hotPositions],
  )

  const recommendedPositions = useMemo(() => {
    const orderMap = new Map(hotPositions.map((h) => [h.positionId, h.order]))
    return positions
      .filter((p) => hotPositionIds.has(p.id))
      .sort((a, b) => (orderMap.get(a.id) ?? 999) - (orderMap.get(b.id) ?? 999))
  }, [positions, hotPositions, hotPositionIds])

  const jobFiltered = useMemo(() => {
    let list = [...positions]
    if (selectedIndustry !== '全部') {
      list = list.filter((p) => p.industryId && industryMap.get(p.industryId) === selectedIndustry)
    }
    if (selectedMajor !== '全部') {
      list = list.filter((p) => p.majorNames?.includes(selectedMajor))
    }
    if (keyword.trim()) {
      const k = keyword.trim().toLowerCase()
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(k) ||
          (p.shortName?.toLowerCase().includes(k) ?? false) ||
          p.id.toLowerCase().includes(k),
      )
    }
    switch (sort) {
      case 'hot':
        list.sort(
          (a, b) =>
            (b.favoriteCount ?? 0) - (a.favoriteCount ?? 0) ||
            a.name.localeCompare(b.name, 'zh-CN'),
        )
        break
      case 'recent':
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        break
      case 'update':
        list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        break
      default: {
        list.sort((a, b) => {
          const aOrder = hotOrderMap.get(a.id)
          const bOrder = hotOrderMap.get(b.id)
          if (aOrder !== undefined && bOrder !== undefined) return aOrder - bOrder
          if (aOrder !== undefined) return -1
          if (bOrder !== undefined) return 1
          return a.name.localeCompare(b.name, 'zh-CN')
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

  useEffect(() => {
    ;(async () => {
      setCurrentPage(1)
    })()
  }, [
    selectedIndustry,
    selectedMajor,
    selectedPosition,
    selectedProfession,
    selectedDifficulty,
    keyword,
    sort,
  ])

  const activeFilters = useMemo(() => {
    const filters: { type: string; label: string }[] = []
    if (selectedIndustry !== '全部')
      filters.push({ type: 'industry', label: `行业：${selectedIndustry}` })
    if (!isScene && selectedMajor !== '全部')
      filters.push({ type: 'major', label: `专业：${selectedMajor}` })
    if (isScene && selectedPosition !== '全部')
      filters.push({ type: 'position', label: `岗位：${selectedPosition}` })
    if (isScene && selectedProfession !== '全部')
      filters.push({ type: 'profession', label: `专业：${selectedProfession}` })
    if (isScene && selectedDifficulty !== '全部')
      filters.push({ type: 'difficulty', label: `难度：${selectedDifficulty}` })
    if (keyword.trim()) filters.push({ type: `keyword`, label: `关键词：${keyword.trim()}` })
    return filters
  }, [
    selectedIndustry,
    selectedMajor,
    selectedPosition,
    selectedProfession,
    selectedDifficulty,
    keyword,
    isScene,
  ])

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
      listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
  }

  const sortOptions = isScene ? SCENE_SORT_OPTIONS : SORT_OPTIONS

  const removeFilter = (type: string) => {
    if (type === 'industry') setSelectedIndustry('全部')
    if (type === 'major') setSelectedMajor('全部')
    if (type === 'position') setSelectedPosition('全部')
    if (type === 'profession') setSelectedProfession('全部')
    if (type === 'difficulty') setSelectedDifficulty('全部')
    if (type === 'keyword') setKeyword('')
  }

  const clearFilters = () => {
    setSelectedIndustry('全部')
    setSelectedMajor('全部')
    setSelectedPosition('全部')
    setSelectedProfession('全部')
    setSelectedDifficulty('全部')
    setKeyword('')
  }

  const sceneStats = [
    {
      icon: Layers,
      value: stats.total,
      label: '实践场景',
      gradient: 'from-primary to-primary/80',
    },
    {
      icon: ListChecks,
      value: stats.taskCount,
      label: '任务总数',
      gradient: 'from-primary/90 to-primary/70',
    },
    {
      icon: Factory,
      value: stats.industryCount,
      label: '覆盖行业',
      gradient: 'from-primary/80 to-primary/60',
    },
    {
      icon: Building2,
      value: stats.favoriteTotal,
      label: '关联岗位',
      gradient: 'from-primary/90 to-primary/70',
    },
  ]

  const jobStats = [
    {
      icon: Briefcase,
      value: stats.total,
      label: '岗位总数',
      gradient: 'from-primary to-primary/80',
    },
    {
      icon: Layers,
      value: scenarios.length,
      label: '实践场景',
      gradient: 'from-primary/90 to-primary/70',
    },
    {
      icon: Factory,
      value: stats.industryCount,
      label: '覆盖行业',
      gradient: 'from-primary/80 to-primary/60',
    },
    {
      icon: GraduationCap,
      value: stats.majorCount,
      label: '覆盖专业',
      gradient: 'from-primary/90 to-primary/70',
    },
  ]

  return (
    <LandingShell
      hero={{
        badge: isScene ? '场景化实践 · 任务驱动教学' : '对接产业前沿 · 赋能岗位能力学习',
        title: isScene ? (
          <>
            场景化实践教学
            <br />
            <span className="text-white/80">以真实场景驱动能力成长</span>
          </>
        ) : (
          <>
            对接产业前沿
            <br />
            <span className="text-white/80">开启岗位能力学习新征程</span>
          </>
        ),
        description: isScene
          ? '基于真实业务场景的任务化训练，从入门到专家，系统提升综合实战能力'
          : '链接真实岗位场景，构建从认知到胜任的能力进阶闭环',
        ctaLabel: isScene ? '浏览场景' : '浏览岗位',
        right: (
          <PositionSideLists
            recommendedPositions={recommendedPositions}
            favoritePositions={favoritePositions}
          />
        ),
      }}
      stats={isScene ? sceneStats : jobStats}
      beforeList={
        !isScene ? (
          <div className="mb-6">
            <RankingList positions={positions} industryMap={industryMap} />
          </div>
        ) : undefined
      }
      filterTitle={isScene ? '场景筛选' : '岗位筛选'}
      filterRows={
        isScene ? (
          <>
            <LandingFilterRow
              label="行业"
              items={industries}
              selected={selectedIndustry}
              onSelect={setSelectedIndustry}
              accentColor="primary"
            />
            <LandingFilterRow
              label="岗位"
              items={positionNames}
              selected={selectedPosition}
              onSelect={setSelectedPosition}
              accentColor="primary"
            />
            <LandingFilterRow
              label="专业"
              items={professionNames}
              selected={selectedProfession}
              onSelect={setSelectedProfession}
              accentColor="primary"
            />
            <LandingFilterRow
              label="难度"
              items={difficulties}
              selected={selectedDifficulty}
              onSelect={setSelectedDifficulty}
              showBorder={false}
              accentColor="primary"
            />
          </>
        ) : (
          <>
            <LandingFilterRow
              label="行业"
              items={industries}
              selected={selectedIndustry}
              onSelect={setSelectedIndustry}
              accentColor="primary"
            />
            <LandingFilterRow
              label="专业"
              items={majors}
              selected={selectedMajor}
              onSelect={setSelectedMajor}
              showBorder={false}
              accentColor="primary"
            />
          </>
        )
      }
      activeFilters={activeFilters}
      onRemoveFilter={removeFilter}
      onClearFilters={clearFilters}
      sortOptions={sortOptions}
      sort={sort}
      onSortChange={setSort}
      keyword={keyword}
      onKeywordChange={setKeyword}
      onSearch={executeSearch}
      searchPlaceholder={isScene ? '搜索场景名称、编码或关键词' : '搜索岗位名称、岗位编码或关键词'}
      totalCount={filtered.length}
      countLabel={isScene ? '个场景查看入口' : '个岗位查看入口'}
      listRef={listRef}
    >
      {loading ? (
        <LandingSkeleton />
      ) : filtered.length === 0 ? (
        <LandingEmpty
          title={isScene ? '暂无匹配的场景' : '暂无匹配的岗位'}
          hint="试试调整筛选条件或搜索关键词"
        />
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
                    knowledgePointCount={knowledgePointCountMap.get(scenario.id) ?? 0}
                  />
                ))
              : (pageItems as CareerPosition[]).map((pos, i) => (
                  <JobCard
                    key={pos.id}
                    position={pos}
                    index={i}
                    isHot={hotPositionIds.has(pos.id)}
                    scenarioCount={scenarioCountMap.get(pos.id) ?? 0}
                    abilityCount={pos.abilityCount ?? 0}
                    industryName={pos.industryId ? industryMap.get(pos.industryId) : undefined}
                  />
                ))}
          </div>
          <LandingPagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={(p) => {
              setCurrentPage(p)
              listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }}
            accentColor="primary"
          />
        </>
      )}
    </LandingShell>
  )
}
