'use client'

import { useState, useEffect, useRef } from 'react'
import { Lightbulb, Plus, Search, X, Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { courseApi, knowledgeApi, scenarioApi, taskApi, positionApi } from '@/lib/api'
import type { Course, KnowledgePoint, KnowledgePointItem } from '@/lib/types/lesson'
import type { Scenario, ScenarioTask } from '@/lib/types/scene'
import type { CareerPosition } from '@/lib/types/job'
import { useT } from '@/lib/i18n/locale-provider'

function generateKpCode() {
  return `KP-${Date.now().toString().slice(-6)}`
}

// 服务端知识点 → 选择器条目（granularLessonIds 归一为 granularLessons）
function mapServerKp(k: KnowledgePoint): KnowledgePointItem {
  return {
    id: k.id,
    name: k.name,
    code: k.code,
    description: k.description,
    linked: k.linked,
    granularLessons: k.granularLessonIds || [],
  }
}

// 分页拉取全量数据（后端 limit 钳制 200，逐页翻到 total）
async function fetchAllPages<T>(
  fn: (params: { limit: number; offset: number }) => Promise<{ items: T[]; total: number }>,
): Promise<T[]> {
  const PAGE = 200
  const items: T[] = []
  let offset = 0
  for (;;) {
    const res = await fn({ limit: PAGE, offset })
    items.push(...res.items)
    if (res.items.length < PAGE || items.length >= res.total) break
    offset += PAGE
  }
  return items
}

interface KnowledgeSelectorProps {
  selected: KnowledgePointItem[]
  pool: KnowledgePointItem[]
  onChange?: (selected: KnowledgePointItem[]) => void
  onAddCustom?: (name: string, description?: string) => void
  standalone?: boolean
}

export function KnowledgeSelector({
  selected,
  pool,
  onChange,
  onAddCustom,
  standalone = true,
}: KnowledgeSelectorProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [kpSearch, setKpSearch] = useState('')
  const [searchResults, setSearchResults] = useState<KnowledgePointItem[] | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const searchSeqRef = useRef(0)
  // 场景/岗位筛选请求序号：快速连续切换时丢弃过期响应
  const filterSeqRef = useRef(0)
  const [kpDetailOpen, setKpDetailOpen] = useState(false)
  const [selectedKpForDetail, setSelectedKpForDetail] = useState<string | null>(null)

  // 真实筛选：岗位/场景/任务互斥（只能启用一种），筛选命中后聚合对应知识点集合
  const [positions, setPositions] = useState<CareerPosition[]>([])
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [sceneTasks, setSceneTasks] = useState<ScenarioTask[]>([])
  const [filterMode, setFilterMode] = useState<'all' | 'scene' | 'position'>('all')
  const [selectedPositionId, setSelectedPositionId] = useState('all')
  const [selectedSceneId, setSelectedSceneId] = useState('all')
  const [selectedTaskId, setSelectedTaskId] = useState('all')
  const [filterKpIds, setFilterKpIds] = useState<Set<string> | null>(null)
  const [sceneKpIdSet, setSceneKpIdSet] = useState<Set<string> | null>(null)
  const [filterLoading, setFilterLoading] = useState(false)
  // 筛选时需展示 pool 之外的知识点，懒加载全量知识点（分页）
  const [allKps, setAllKps] = useState<KnowledgePointItem[] | null>(null)

  const [kpActionOpen, setKpActionOpen] = useState(false)
  const [kpActionMode, setKpActionMode] = useState<'add' | 'clone' | 'edit' | null>(null)
  const [kpActionTarget, setKpActionTarget] = useState<KnowledgePointItem | null>(null)
  const [newKpForm, setNewKpForm] = useState<{
    name: string
    description: string
    code: string
    granularLessons: string[]
  }>({ name: '', description: '', code: '', granularLessons: [] })
  const [kpNameError, setKpNameError] = useState('')

  const [glSelectOpen, setGlSelectOpen] = useState(false)
  const [glSelectTargetKp, setGlSelectTargetKp] = useState<string | null>(null)
  const [glSearch, setGlSearch] = useState('')
  const [granularCourses, setGranularCourses] = useState<Course[]>([])

  const t = useT()

  useEffect(() => {
    courseApi
      .list({ type: 'granular' })
      .then((res) => {
        setGranularCourses(res.items || [])
      })
      .catch(() => setGranularCourses([]))
  }, [])

  // 岗位/场景下拉数据（真实数据，分页拉全量）
  useEffect(() => {
    fetchAllPages(({ limit, offset }) => positionApi.list({ limit, offset }))
      .then(setPositions)
      .catch(() => setPositions([]))
    fetchAllPages(({ limit, offset }) => scenarioApi.list({ limit, offset }))
      .then(setScenarios)
      .catch(() => setScenarios([]))
  }, [])

  // 筛选命中集合非空时，懒加载全量知识点（超出 pool 200 条的部分也能筛出来）
  useEffect(() => {
    if (filterKpIds === null || allKps !== null) return
    let cancelled = false
    fetchAllPages(({ limit, offset }) => knowledgeApi.list({ limit, offset }))
      .then((items) => {
        if (!cancelled) setAllKps(items.map(mapServerKp))
      })
      .catch(() => {
        if (!cancelled) setAllKps([])
      })
    return () => {
      cancelled = true
    }
  }, [filterKpIds, allKps])

  const kpSearchTerm = kpSearch.trim()

  // 搜索走后端接口（name/code 模糊匹配），可命中全部知识点，不受初始 pool 200 条限制
  useEffect(() => {
    const seq = ++searchSeqRef.current
    if (!kpSearchTerm) return
    const timer = setTimeout(() => {
      setSearchLoading(true)
      knowledgeApi
        .list({ search: kpSearchTerm, limit: 200 })
        .then((res) => {
          if (seq !== searchSeqRef.current) return
          setSearchResults((res.items || []).map(mapServerKp))
          setSearchLoading(false)
        })
        .catch(() => {
          if (seq !== searchSeqRef.current) return
          setSearchResults([])
          setSearchLoading(false)
        })
    }, 300)
    return () => clearTimeout(timer)
  }, [kpSearchTerm])

  const isReferenceKp = (kp: KnowledgePointItem) => kp.linked

  const isSearching = !!kpSearchTerm
  const filterActive = filterKpIds !== null && !isSearching
  const filtered = isSearching
    ? searchResults || []
    : filterActive
      ? (allKps || []).filter((kp) => filterKpIds!.has(kp.id))
      : pool

  const hasResults = isSearching ? filtered.length > 0 : false

  // 切换筛选模式（岗位/场景任务互斥，切换即重置已选条件）
  const handleFilterModeChange = (mode: 'all' | 'scene' | 'position') => {
    setFilterMode(mode)
    setSelectedSceneId('all')
    setSelectedTaskId('all')
    setSelectedPositionId('all')
    setSceneTasks([])
    setSceneKpIdSet(null)
    setFilterKpIds(null)
    setFilterLoading(false)
  }

  // 场景/任务筛选：选场景 → 拉该场景任务并聚合其全部知识点；选任务 → 缩窄为该任务知识点
  const handleSceneChange = (sid: string) => {
    setSelectedSceneId(sid)
    setSelectedTaskId('all')
    if (sid === 'all') {
      setSceneTasks([])
      setSceneKpIdSet(null)
      setFilterKpIds(null)
      return
    }
    setFilterLoading(true)
    setFilterKpIds(new Set())
    const seq = ++filterSeqRef.current
    taskApi
      .list({ scenarioId: sid, limit: 200 })
      .then((res) => {
        if (seq !== filterSeqRef.current) return
        const tasks = res.items || []
        setSceneTasks(tasks)
        const ids = new Set<string>()
        for (const task of tasks) for (const id of task.knowledgePointIds || []) ids.add(id)
        setSceneKpIdSet(ids)
        setFilterKpIds(ids)
      })
      .catch(() => {
        if (seq !== filterSeqRef.current) return
        setSceneTasks([])
        setFilterKpIds(new Set())
      })
      .finally(() => {
        if (seq === filterSeqRef.current) setFilterLoading(false)
      })
  }

  const handleTaskChange = (tid: string) => {
    setSelectedTaskId(tid)
    if (tid === 'all') {
      setFilterKpIds(sceneKpIdSet)
    } else {
      const task = sceneTasks.find((t) => t.id === tid)
      setFilterKpIds(new Set(task?.knowledgePointIds || []))
    }
  }

  // 岗位筛选：聚合该岗位下所有场景（careerPositionId）的全部任务知识点
  const handlePositionChange = (pid: string) => {
    setSelectedPositionId(pid)
    setSelectedSceneId('all')
    setSelectedTaskId('all')
    setSceneTasks([])
    setSceneKpIdSet(null)
    if (pid === 'all') {
      setFilterKpIds(null)
      return
    }
    const posScenarios = scenarios.filter((s) => s.careerPositionId === pid)
    setFilterLoading(true)
    setFilterKpIds(new Set())
    const seq = ++filterSeqRef.current
    Promise.all(posScenarios.map((s) => taskApi.list({ scenarioId: s.id, limit: 200 })))
      .then((results) => {
        if (seq !== filterSeqRef.current) return
        const ids = new Set<string>()
        for (const r of results) for (const task of r.items || []) for (const id of task.knowledgePointIds || []) ids.add(id)
        setFilterKpIds(ids)
      })
      .catch(() => {
        if (seq !== filterSeqRef.current) return
        setFilterKpIds(new Set())
      })
      .finally(() => {
        if (seq === filterSeqRef.current) setFilterLoading(false)
      })
  }

  const handleReferenceKp = (kp: KnowledgePointItem) => {
    if (selected.find((s) => s.id === kp.id)) return
    onChange?.([...selected, kp])
  }

  const handleRemoveKp = (kpId: string) => {
    onChange?.(selected.filter((s) => s.id !== kpId))
  }

  const openAddKp = () => {
    setNewKpForm({ name: kpSearch, description: '', code: generateKpCode(), granularLessons: [] })
    setKpNameError('')
    setKpActionMode('add')
    setKpActionTarget(null)
    setKpActionOpen(true)
  }

  const openCloneKp = (kp: KnowledgePointItem) => {
    setNewKpForm({
      name: `${kp.name}（克隆）`,
      description: kp.description || '',
      code: generateKpCode(),
      granularLessons: kp.granularLessons || [],
    })
    setKpNameError('')
    setKpActionMode('clone')
    setKpActionTarget(kp)
    setKpActionOpen(true)
  }

  const openEditKp = (kp: KnowledgePointItem) => {
    setNewKpForm({
      name: kp.name,
      description: kp.description || '',
      code: kp.code || generateKpCode(),
      granularLessons: kp.granularLessons || [],
    })
    setKpNameError('')
    setKpActionMode('edit')
    setKpActionTarget(kp)
    setKpActionOpen(true)
  }

  // 名称在租户内唯一（后端唯一约束），重名创建/改名必然 409，直接阻止
  const findNameCollision = (name: string, excludeId?: string) =>
    pool.find((p) => p.id !== excludeId && p.name.trim() === name.trim()) ||
    (searchResults || []).find(
      (p) => p.id !== excludeId && p.name.trim() === name.trim(),
    ) ||
    selected.find((s) => s.id !== excludeId && s.name.trim() === name.trim())

  const handleSaveKp = () => {
    const name = newKpForm.name.trim()
    if (!name) return
    const excludeId = kpActionMode === 'edit' ? kpActionTarget?.id : undefined
    const collision = findNameCollision(name, excludeId)
    if (collision) {
      setKpNameError(
        t('已存在同名知识点「{name}」，请选择已有知识点或使用其他名称', { name: collision.name }),
      )
      return
    }
    setKpNameError('')
    if (kpActionMode === 'edit' && kpActionTarget) {
      const updated = selected.map((s) =>
        s.id === kpActionTarget.id
          ? {
              ...s,
              name,
              description: newKpForm.description.trim(),
              code: newKpForm.code,
              granularLessons: newKpForm.granularLessons,
            }
          : s,
      )
      onChange?.(updated)
      setAllKps(null) // 失效全量缓存，下次筛选重新拉取
      setKpActionOpen(false)
      return
    }
    const newId = `kp-custom-${Date.now()}`
    const newKp: KnowledgePointItem = {
      id: newId,
      name,
      description: newKpForm.description.trim(),
      code: newKpForm.code,
      linked: false,
      granularLessons: newKpForm.granularLessons,
    }
    onAddCustom?.(newKp.name, newKp.description)
    onChange?.([...selected, newKp])
    setAllKps(null) // 失效全量缓存，下次筛选重新拉取
    setKpActionOpen(false)
    setKpSearch('')
  }

  const openGlSelect = (kpId: string) => {
    setGlSelectTargetKp(kpId)
    setGlSearch('')
    setGlSelectOpen(true)
  }

  const handleToggleGlForKp = (kpId: string, glId: string) => {
    const updated = selected.map((s) => {
      if (s.id !== kpId) return s
      const current = s.granularLessons || []
      const updatedGl = current.includes(glId)
        ? current.filter((x) => x !== glId)
        : [...current, glId]
      return { ...s, granularLessons: updatedGl }
    })
    onChange?.(updated)
  }

  const detailKp = selectedKpForDetail
    ? selected.find((s) => s.id === selectedKpForDetail) ||
      pool.find((p) => p.id === selectedKpForDetail) ||
      (searchResults || []).find((p) => p.id === selectedKpForDetail)
    : null
  const detailGranularLessons =
    detailKp?.granularLessons
      ?.map((gid) => granularCourses.find((g) => g.id === gid))
      .filter(Boolean) || []

  const glFiltered = granularCourses.filter(
    (g) => !glSearch || g.name.includes(glSearch) || (g.code && g.code.includes(glSearch)),
  )
  const glTargetKp = glSelectTargetKp
    ? selected.find((s) => s.id === glSelectTargetKp) || null
    : null
  const glSelectedIds =
    glSelectTargetKp === 'new-kp' ? newKpForm.granularLessons : glTargetKp?.granularLessons || []

  const selectionPanels = (
    <div className={cn('flex gap-4', standalone ? 'h-[480px]' : 'h-full min-h-0')}>
      {/* Left: Search Results */}
      <div className="w-3/5 flex flex-col min-h-0 border rounded-xl p-3">
        <div className="flex items-center gap-3 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              value={kpSearch}
              onChange={(e) => setKpSearch(e.target.value)}
              placeholder={t('搜索知识点名称、描述或编码...')}
              className="pl-9"
            />
          </div>
          <Button onClick={openAddKp}>
            <Plus className="h-4 w-4 mr-1" />
            {t('新增知识点')}
          </Button>
        </div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs text-gray-500 shrink-0">{t('筛选')}</span>
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
            {(
              [
                ['all', t('全部')],
                ['scene', t('按场景/任务')],
                ['position', t('按岗位')],
              ] as const
            ).map(([m, label]) => (
              <button
                key={m}
                type="button"
                onClick={() => handleFilterModeChange(m)}
                className={cn(
                  'px-3 py-1 transition-colors',
                  filterMode === m
                    ? 'bg-primary text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50',
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {filterActive && !filterLoading && (
            <span className="text-[10px] text-gray-400">
              {t('筛选出 {count} 条知识点', { count: filtered.length })}
            </span>
          )}
        </div>
        {!isSearching && filterMode === 'scene' && (
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-gray-500 shrink-0">{t('场景')}</span>
            <Select value={selectedSceneId} onValueChange={handleSceneChange}>
              <SelectTrigger className="h-8 text-xs w-[150px]">
                <SelectValue placeholder={t('选择场景')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">
                  {t('全部场景')}
                </SelectItem>
                {scenarios.map((scene) => (
                  <SelectItem key={scene.id} value={scene.id} className="text-xs">
                    {scene.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedSceneId !== 'all' && (
              <>
                <span className="text-xs text-gray-500 shrink-0">{t('任务')}</span>
                <Select value={selectedTaskId} onValueChange={handleTaskChange}>
                  <SelectTrigger className="h-8 text-xs w-[150px]">
                    <SelectValue placeholder={t('选择任务')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">
                      {t('全部任务')}
                    </SelectItem>
                    {sceneTasks.map((task) => (
                      <SelectItem key={task.id} value={task.id} className="text-xs">
                        {task.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}
          </div>
        )}
        {!isSearching && filterMode === 'position' && (
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-gray-500 shrink-0">{t('岗位')}</span>
            <Select value={selectedPositionId} onValueChange={handlePositionChange}>
              <SelectTrigger className="h-8 text-xs w-[170px]">
                <SelectValue placeholder={t('选择岗位')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">
                  {t('全部岗位')}
                </SelectItem>
                {positions.map((pos) => (
                  <SelectItem key={pos.id} value={pos.id} className="text-xs">
                    {pos.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-[10px] text-gray-400">
              {t('聚合该岗位下所有场景任务的知识点')}
            </span>
          </div>
        )}
        <div className="flex-1 overflow-y-auto pr-1">
          {!isSearching && !filterActive && filtered.length === 0 && (
            <div className="text-center text-gray-400 py-8">
              <Lightbulb className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">{t('请输入关键词搜索知识点')}</p>
            </div>
          )}
          {!isSearching && filterActive && filterLoading && (
            <div className="text-center text-gray-400 py-8">
              <Loader2 className="h-6 w-6 mx-auto mb-2 animate-spin" />
              <p className="text-sm">{t('筛选加载中...')}</p>
            </div>
          )}
          {!isSearching && filterActive && !filterLoading && filtered.length === 0 && (
            <div className="text-center text-gray-400 py-8">
              <Lightbulb className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">{t('该筛选条件下暂无知识点')}</p>
            </div>
          )}
          {isSearching && searchLoading && (
            <div className="text-center text-gray-400 py-8">
              <Loader2 className="h-6 w-6 mx-auto mb-2 animate-spin" />
              <p className="text-sm">{t('搜索中...')}</p>
            </div>
          )}
          {isSearching && !searchLoading && !hasResults && (
            <div className="p-6 text-center text-gray-500 text-sm border border-dashed rounded-lg">
              <p className="mb-2">{t('未找到 "{kpSearch}" 相关的知识点')}</p>
              <Button variant="outline" size="sm" onClick={openAddKp}>
                <Plus className="h-3 w-3 mr-1" />
                {t('新增此知识点')}
              </Button>
            </div>
          )}
          {filtered.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[560px]">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th className="text-left text-xs font-medium text-gray-500 px-3 py-2 w-[28%]">
                      {t('知识点名称')}
                    </th>
                    <th className="text-left text-xs font-medium text-gray-500 px-3 py-2 w-[18%]">
                      {t('知识点编码')}
                    </th>
                    <th className="text-left text-xs font-medium text-gray-500 px-3 py-2 w-[34%]">
                      {t('知识点描述')}
                    </th>
                    <th className="text-right text-xs font-medium text-gray-500 px-3 py-2 w-[20%]">
                      {t('操作')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((kp) => {
                    const isSelected = selected.some((s) => s.id === kp.id)
                    return (
                      <tr
                        key={kp.id}
                        className={cn(
                          'hover:bg-gray-50 transition-colors',
                          isSelected ? 'bg-primary/[0.03]' : '',
                        )}
                      >
                        <td className="px-3 py-2">
                          <span className="text-sm font-medium text-gray-800">{kp.name}</span>
                        </td>
                        <td className="px-3 py-2">
                          {kp.code ? (
                            <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                              {kp.code}
                            </Badge>
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <p className="text-xs text-gray-500 line-clamp-1" title={kp.description}>
                            {kp.description}
                          </p>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-[11px] px-1.5 text-gray-500 hover:text-primary"
                              onClick={() => {
                                setSelectedKpForDetail(kp.id)
                                setKpDetailOpen(true)
                              }}
                            >
                              {t('详情')}
                            </Button>
                            {isSelected ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 text-[11px] px-2"
                                onClick={() => handleRemoveKp(kp.id)}
                              >
                                {t('取消')}
                              </Button>
                            ) : (
                              <>
                                <Button
                                  size="sm"
                                  className="h-6 text-[11px] px-2"
                                  onClick={() => handleReferenceKp(kp)}
                                >
                                  {t('引用')}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-6 text-[11px] px-2"
                                  onClick={() => openCloneKp(kp)}
                                >
                                  {t('克隆')}
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Right: Selected Knowledge Points */}
      <div className="w-2/5 border rounded-xl p-3 flex flex-col min-h-0">
        <p className="text-sm font-medium mb-3 text-gray-700">
          {t('已选择知识点 ({count})', { count: selected.length })}
        </p>
        <div className="flex-1 overflow-y-auto">
          {selected.length === 0 ? (
            <div className="text-center text-gray-400 py-8">
              <Lightbulb className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-xs">{t('从左侧搜索并选择知识点')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {selected.map((kp) => {
                const isReference = isReferenceKp(kp)
                const kpGlNames =
                  kp.granularLessons
                    ?.map((gid) => granularCourses.find((g) => g.id === gid)?.name)
                    .filter(Boolean) || []
                return (
                  <div
                    key={kp.id}
                    className={cn(
                      'p-2 rounded-lg border cursor-pointer transition-colors relative overflow-hidden',
                      isReference
                        ? 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                        : 'border-primary/20 bg-primary/5 hover:bg-primary/10',
                    )}
                    onClick={() => {
                      if (isReference) {
                        setSelectedKpForDetail(kp.id)
                        setKpDetailOpen(true)
                      } else {
                        openEditKp(kp)
                      }
                    }}
                  >
                    <div className="flex items-center gap-1 mb-1">
                      <span className="text-xs font-medium flex-1 truncate">{kp.name}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 text-gray-400 -mr-1 -mt-1"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRemoveKp(kp.id)
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                    <p className="text-[11px] text-gray-500 line-clamp-1 mb-1">{kp.description}</p>
                    {kpGlNames.length > 0 && (
                      <div className="flex items-center gap-0.5 flex-wrap">
                        {kpGlNames.slice(0, 2).map((name, i) => (
                          <Badge
                            key={i}
                            variant="outline"
                            className="text-[9px] font-normal px-1 py-0 h-4"
                          >
                            {name}
                          </Badge>
                        ))}
                        {kpGlNames.length > 2 && (
                          <span className="text-[9px] text-gray-400">+{kpGlNames.length - 2}</span>
                        )}
                      </div>
                    )}
                    {isReference && (
                      <div className="absolute bottom-0 right-0">
                        <div className="bg-gray-200 text-gray-600 text-[9px] px-1.5 py-0.5 rounded-tl-md border-t border-l border-white/80">
                          {t('引用')}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )

  const subDialogs = (
    <>
      {/* Add / Clone / Edit Knowledge Dialog */}
      <Dialog open={kpActionOpen} onOpenChange={setKpActionOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {kpActionMode === 'add'
                ? t('新增知识点')
                : kpActionMode === 'clone'
                  ? t('克隆知识点')
                  : t('编辑知识点')}
            </DialogTitle>
            <DialogDescription>
              {kpActionMode === 'add'
                ? t('创建一个新的知识点')
                : kpActionMode === 'clone'
                  ? t('基于「{name}」创建副本', { name: kpActionTarget?.name ?? '' })
                  : t('修改知识点信息')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>{t('知识点名称')}</Label>
              <Input
                value={newKpForm.name}
                onChange={(e) => {
                  setNewKpForm({ ...newKpForm, name: e.target.value })
                  if (kpNameError) setKpNameError('')
                }}
                placeholder={t('输入知识点名称')}
                className="mt-1.5"
              />
              {kpNameError && <p className="text-xs text-red-500 mt-1">{kpNameError}</p>}
            </div>
            <div>
              <Label>{t('描述')}</Label>
              <Textarea
                value={newKpForm.description}
                onChange={(e) => setNewKpForm({ ...newKpForm, description: e.target.value })}
                placeholder={t('输入知识点描述')}
                className="mt-1.5"
                rows={3}
              />
            </div>
            <div>
              <Label>{t('编码')}</Label>
              <Input
                value={newKpForm.code}
                disabled={kpActionMode !== 'edit'}
                onChange={(e) => setNewKpForm({ ...newKpForm, code: e.target.value })}
                className={cn('mt-1.5', kpActionMode !== 'edit' && 'bg-gray-50')}
              />
              <p className="text-xs text-gray-400 mt-1">
                {kpActionMode === 'edit' ? t('可修改编码') : t('系统自动生成，不可修改')}
              </p>
            </div>
            <div>
              <Label>{t('关联颗粒课')}</Label>
              <div className="mt-1.5">
                {newKpForm.granularLessons.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {newKpForm.granularLessons.map((gid) => {
                      const gl = granularCourses.find((g) => g.id === gid)
                      return gl ? (
                        <Badge key={gid} variant="secondary" className="text-xs gap-1">
                          {gl.name}
                          <X
                            className="h-3 w-3 cursor-pointer"
                            onClick={() =>
                              setNewKpForm({
                                ...newKpForm,
                                granularLessons: newKpForm.granularLessons.filter((x) => x !== gid),
                              })
                            }
                          />
                        </Badge>
                      ) : null
                    })}
                  </div>
                ) : null}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      setGlSelectTargetKp('new-kp')
                      setGlSearch('')
                      setGlSelectOpen(true)
                    }}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    {t('选择颗粒课')}
                  </Button>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setKpActionOpen(false)}>
              {t('取消')}
            </Button>
            <Button onClick={handleSaveKp} disabled={!newKpForm.name.trim() || !!kpNameError}>
              {kpActionMode === 'add'
                ? t('新增并选中')
                : kpActionMode === 'clone'
                  ? t('克隆并选中')
                  : t('保存修改')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Granular Lesson Selection Dialog */}
      <Dialog open={glSelectOpen} onOpenChange={setGlSelectOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[80vh] h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {glTargetKp
                ? t('为「{name}」选择颗粒课', { name: glTargetKp.name })
                : t('选择颗粒课')}
            </DialogTitle>
          </DialogHeader>
          <div className="flex gap-4 flex-1 min-h-0 py-4">
            <div className="w-3/5 flex flex-col min-h-0 border rounded-xl p-3">
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  value={glSearch}
                  onChange={(e) => setGlSearch(e.target.value)}
                  placeholder={t('搜索颗粒课名称或编码...')}
                  className="pl-9"
                />
              </div>
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {glFiltered.map((gl) => {
                  const isSelected = glSelectedIds.includes(gl.id)
                  return (
                    <div
                      key={gl.id}
                      className={cn(
                        'p-3 rounded-lg border cursor-pointer transition-all',
                        isSelected
                          ? 'border-primary bg-primary/5'
                          : 'border-gray-200 hover:border-gray-300',
                      )}
                      onClick={() => {
                        if (glSelectTargetKp === 'new-kp') {
                          setNewKpForm((prev) => {
                            const current = prev.granularLessons
                            const updated = current.includes(gl.id)
                              ? current.filter((x) => x !== gl.id)
                              : [...current, gl.id]
                            return { ...prev, granularLessons: updated }
                          })
                        } else if (glSelectTargetKp) {
                          handleToggleGlForKp(glSelectTargetKp, gl.id)
                        }
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            'w-4 h-4 rounded border flex items-center justify-center',
                            isSelected ? 'bg-primary border-primary' : 'border-gray-300',
                          )}
                        >
                          {isSelected && <Check className="h-3 w-3 text-white" />}
                        </div>
                        <span className="text-sm font-medium flex-1">{gl.name}</span>
                        {gl.code && (
                          <Badge variant="outline" className="text-[10px]">
                            {gl.code}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1 ml-6">{gl.description}</p>
                    </div>
                  )
                })}
                {glFiltered.length === 0 && (
                  <div className="text-center text-gray-400 py-8">
                    <p className="text-sm">{t('未找到匹配的颗粒课')}</p>
                  </div>
                )}
              </div>
            </div>
            <div className="w-2/5 border rounded-xl p-3 flex flex-col min-h-0">
              <p className="text-sm font-medium mb-3 text-gray-700">
                {t('已选择 ({count})', { count: glSelectedIds.length })}
              </p>
              <div className="flex-1 overflow-y-auto space-y-2">
                {glSelectedIds.length === 0 ? (
                  <div className="text-center text-gray-400 py-8">
                    <p className="text-xs">{t('从左侧选择颗粒课')}</p>
                  </div>
                ) : (
                  glSelectedIds.map((gid) => {
                    const gl = granularCourses.find((g) => g.id === gid)
                    if (!gl) return null
                    return (
                      <div
                        key={gid}
                        className="flex items-center gap-2 p-2 rounded border bg-gray-50"
                      >
                        <span className="text-sm flex-1 truncate">{gl.name}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-gray-400"
                          onClick={() => {
                            if (glSelectTargetKp === 'new-kp') {
                              setNewKpForm((prev) => ({
                                ...prev,
                                granularLessons: prev.granularLessons.filter((x) => x !== gid),
                              }))
                            } else if (glSelectTargetKp) {
                              handleToggleGlForKp(glSelectTargetKp, gid)
                            }
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setGlSelectOpen(false)}>{t('确定')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Knowledge Point Detail Dialog */}
      <Dialog open={kpDetailOpen} onOpenChange={setKpDetailOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('知识点详情')}</DialogTitle>
          </DialogHeader>
          {detailKp && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-2">
                <Label className="text-xs text-gray-500">{t('知识点名称')}</Label>
                {isReferenceKp(detailKp) ? (
                  <Badge variant="secondary" className="text-[10px] h-5">
                    {t('引用（不可编辑）')}
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="text-[10px] h-5 border-primary/30 text-primary"
                  >
                    {t('自定义（可编辑）')}
                  </Badge>
                )}
              </div>
              <p className="text-sm font-medium">{detailKp.name}</p>
              <div>
                <Label className="text-xs text-gray-500">{t('知识点描述')}</Label>
                <p className="text-sm text-gray-700 mt-1">{detailKp.description}</p>
              </div>
              {detailKp.code && (
                <div>
                  <Label className="text-xs text-gray-500">{t('编码')}</Label>
                  <p className="text-sm text-gray-700 mt-1">{detailKp.code}</p>
                </div>
              )}
              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-gray-500">{t('关联颗粒课')}</Label>
                  {!isReferenceKp(detailKp) && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-[11px] px-2 text-primary"
                        onClick={() => {
                          setKpDetailOpen(false)
                          openGlSelect(detailKp.id)
                        }}
                      >
                        {t('引用颗粒课')}
                      </Button>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {detailGranularLessons.length > 0 ? (
                    detailGranularLessons.map((gl: any) => (
                      <Badge key={gl!.id} variant="outline" className="text-xs">
                        {gl!.name}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-sm text-gray-400">{t('暂无关联颗粒课')}</p>
                  )}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setKpDetailOpen(false)}>
              {t('关闭')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )

  if (!standalone) {
    return (
      <>
        {selectionPanels}
        {subDialogs}
      </>
    )
  }

  return (
    <div className="space-y-4">
      {/* Selected tags */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((kp) => (
            <Badge
              key={kp.id}
              variant="secondary"
              className={cn(
                'px-2.5 py-1 text-xs font-normal hover:cursor-pointer',
                isReferenceKp(kp)
                  ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  : 'bg-primary/5 text-primary hover:bg-primary/10',
              )}
            >
              {kp.name}
              <button
                className="ml-1 text-primary/70 hover:text-primary"
                onClick={() => handleRemoveKp(kp.id)}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Add button + dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="w-full border-dashed">
            <Plus className="mr-2 h-4 w-4" />
            {t('添加知识点')}
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[1075px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('添加知识点')}</DialogTitle>
            <DialogDescription>{t('从知识库中选择或新建知识点')}</DialogDescription>
          </DialogHeader>

          {selectionPanels}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              {t('关闭')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {subDialogs}
    </div>
  )
}
