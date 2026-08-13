'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { HoverActionBar } from '@zhiyu/ui'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { FormFieldRow } from '@/components/shared/form-field-row'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ComboboxSelect } from '@/components/shared/combobox-select'
import { SearchInput } from '@/components/shared/search-input'
import {
  Plus,
  Search,
  Trash2,
  Brain,
  AlertCircle,
  Check,
  Pencil,
  Library,
  X,
  Sparkles,
  Loader2,
} from 'lucide-react'
import { abilityApi, positionApi, positionAiAssist, industryApi } from '@/lib/api'
import { ToastAction } from '@/components/ui/toast'
import { reportError } from '@/lib/error-handling'
import { convertApiAbilityToLocal } from '@/lib/converters/job-converters'
import type {
  Position,
  PositionAbilityBinding,
  CompetencyLevel,
  Ability,
} from '@/lib/types/job-source'
import { toast, EmptyState } from '@zhiyu/ui'
import { useT } from '@/lib/i18n/locale-provider'
import { AiAssistProgressDialog } from './ai-assist-progress-dialog'

interface StepAbilityModelingProps {
  position: Position
  onUpdate: (data: Partial<Position>) => void
  /**
   * 能力点库数据源覆盖（缺省走 portal 公共能力库 + 岗位列表）。
   * 企业共建端注入学校只读能力列表：readOnly=true 时隐藏池内能力点的编辑/删除入口，
   * 且不加载岗位过滤下拉（无 partner 侧岗位绑定查询端点）。
   */
  abilityPoolSource?: {
    loadAbilities: () => Promise<Ability[]>
    readOnly?: boolean
  }
}

const ABILITY_ATTRIBUTES = ['知识', '素养', '技能']

const RESP_COLORS = [
  'bg-blue-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-violet-500',
  'bg-cyan-500',
  'bg-orange-500',
  'bg-teal-500',
]

function getRespColor(respId: string) {
  let hash = 0
  for (let i = 0; i < respId.length; i++) {
    hash = respId.charCodeAt(i) + ((hash << 5) - hash)
  }
  return RESP_COLORS[Math.abs(hash) % RESP_COLORS.length]
}

function arrayEquals(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  const sortedA = [...a].sort()
  const sortedB = [...b].sort()
  return sortedA.every((v, i) => v === sortedB[i])
}

export function StepAbilityModeling({ position, onUpdate, abilityPoolSource }: StepAbilityModelingProps) {
  const t = useT()
  const competencyLevels: { value: CompetencyLevel; label: string; description: string }[] = [
    { value: 'understand', label: t('了解'), description: t('了解基本概念，能在指导下完成简单任务') },
    { value: 'comprehend', label: t('理解'), description: t('理解原理和方法，能独立完成基本任务') },
    { value: 'master', label: t('掌握'), description: t('能独立完成常规任务，处理一般问题') },
    { value: 'proficient', label: t('熟练'), description: t('能处理复杂任务，指导他人，优化流程') },
    { value: 'expert', label: t('精通'), description: t('行业专家水平，能创新和引领发展方向') },
  ]
  const [abilities, setAbilities] = useState<Ability[]>([])
  const [selectedRespId, setSelectedRespId] = useState<string | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [newAbilityName, setNewAbilityName] = useState('')
  const [aiNotice] = useState<string | null>(null)
  const [editingRespId, setEditingRespId] = useState<string | null>(null)
  const [editRespName, setEditRespName] = useState('')
  const [editingAbilityId, setEditingAbilityId] = useState<string | null>(null)
  const [editAbilityName, setEditAbilityName] = useState('')
  const [editAbilityAttributes, setEditAbilityAttributes] = useState<string[]>([])
  const [duplicateName, setDuplicateName] = useState<string | null>(null)
  const [newAbilityAttributes, setNewAbilityAttributes] = useState<string[]>([])
  const [showAbilityPoolDialog, setShowAbilityPoolDialog] = useState(false)
  const [abilityPoolSearch, setAbilityPoolSearch] = useState('')
  const [abilityPoolFilterAttr, setAbilityPoolFilterAttr] = useState<string | null>(null)
  const [abilityPoolFilterPosition, setAbilityPoolFilterPosition] = useState<string | null>(null)
  const [abilityPoolFilterPositionAbilities, setAbilityPoolFilterPositionAbilities] = useState<
    Set<string>
  >(new Set())
  const [abilityPoolPositions, setAbilityPoolPositions] = useState<{ id: string; name: string }[]>(
    [],
  )
  const [hoveredRespId, setHoveredRespId] = useState<string | null>(null)
  const [showAddRespDialog, setShowAddRespDialog] = useState(false)
  const [newRespNames, setNewRespNames] = useState<string[]>([''])

  // AI 辅助拆解状态
  const [aiOpen, setAiOpen] = useState(false)
  const [aiPhase, setAiPhase] = useState(0)
  const [aiRunning, setAiRunning] = useState(false)
  const [confirmAiOpen, setConfirmAiOpen] = useState(false)
  const [industries, setIndustries] = useState<{ id: string; name: string }[]>([])

  const contentRef = useRef<HTMLDivElement>(null)
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const pendingFocusRespRef = useRef<string | null>(null)

  // 行业名解析（portal 端字典；企业共建端无字典源时原样透传）
  useEffect(() => {
    if (abilityPoolSource) return
    industryApi
      .list({ limit: 1000 })
      .then((res) => setIndustries((res.items || []).filter((i) => i.enabled).map((i) => ({ id: i.id, name: i.name }))))
      .catch(() => setIndustries([]))
  }, [abilityPoolSource])

  useEffect(() => {
    if (abilityPoolSource) {
      abilityPoolSource
        .loadAbilities()
        .then(setAbilities)
        .catch((err) => reportError(err, '加载能力点列表'))
      return
    }
    abilityApi
      .list({ limit: 1000, isPublic: true })
      .then((res) => setAbilities(res.items.map(convertApiAbilityToLocal)))
      .catch((err) => reportError(err, '加载能力点列表'))
    positionApi
      .list({ limit: 1000 })
      .then((res) => setAbilityPoolPositions(res.items.map((p) => ({ id: p.id, name: p.name }))))
      .catch((err) => reportError(err, '加载岗位列表'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    ;(async () => {
      if (!isInitialized && position.responsibilities.length > 0) {
        setSelectedRespId(position.responsibilities[0].id)
        setIsInitialized(true)
      }
    })()
  }, [position.responsibilities, isInitialized])

  useEffect(() => {
    const id = pendingFocusRespRef.current
    if (!id) return
    const el = document.querySelector<HTMLTextAreaElement>(`[data-focus-id="${id}"]`)
    if (el) {
      pendingFocusRespRef.current = null
      el.focus()
    }
  }, [newRespNames])

  useEffect(() => {
    // 请求序号：快速切换岗位时丢弃过期响应，避免过滤结果与当前岗位不一致
    const seq = ++abilityFilterSeqRef.current
    ;(async () => {
      if (!abilityPoolFilterPosition) {
        setAbilityPoolFilterPositionAbilities(new Set())
        return
      }
      try {
        const res = await abilityApi.listBindings({ careerPositionId: abilityPoolFilterPosition })
        if (seq !== abilityFilterSeqRef.current) return
        const ids = new Set<string>()
        res.items.forEach((b) => {
          if (b.abilityPointId) ids.add(b.abilityPointId)
        })
        setAbilityPoolFilterPositionAbilities(ids)
      } catch {
        if (seq === abilityFilterSeqRef.current) setAbilityPoolFilterPositionAbilities(new Set())
      }
    })()
  }, [abilityPoolFilterPosition])

  // 岗位过滤请求序号
  const abilityFilterSeqRef = useRef(0)

  const selectedResp = position.responsibilities.find((r) => r.id === selectedRespId)

  const abilityPoolResults = useMemo(() => {
    return abilities.filter((a) => {
      if (
        abilityPoolSearch.trim() &&
        !a.name.toLowerCase().includes(abilityPoolSearch.toLowerCase())
      )
        return false
      if (abilityPoolFilterAttr && !(a.attributes || []).includes(abilityPoolFilterAttr))
        return false
      if (
        abilityPoolFilterPosition &&
        abilityPoolFilterPositionAbilities.size > 0 &&
        !abilityPoolFilterPositionAbilities.has(a.id)
      )
        return false
      return true
    })
  }, [
    abilities,
    abilityPoolSearch,
    abilityPoolFilterAttr,
    abilityPoolFilterPosition,
    abilityPoolFilterPositionAbilities,
  ])

  const scrollToResp = (respId: string) => {
    setSelectedRespId(respId)
    const el = sectionRefs.current[respId]
    if (el && contentRef.current) {
      const elTop = el.getBoundingClientRect().top
      const containerTop = contentRef.current.getBoundingClientRect().top
      const y = contentRef.current.scrollTop + (elTop - containerTop) - 16
      contentRef.current.scrollTo({ top: y, behavior: 'smooth' })
    }
  }

  const handleAddFromPool = (ability: (typeof abilities)[0]) => {
    if (!selectedRespId) return
    const exists = position.abilityBindings.some(
      (b) => b.responsibilityId === selectedRespId && b.publicAbilityId === ability.id,
    )
    if (exists) {
      toast({ title: t('该能力点已添加到当前职责'), variant: 'destructive' })
      return
    }

    const newBinding: PositionAbilityBinding = {
      id: `bind-${Date.now()}`,
      responsibilityId: selectedRespId,
      source: 'public',
      publicAbilityId: ability.id,
      name: ability.name,
      level: 'understand',
      rubricDescription: '',
      description: '',
    }
    onUpdate({ abilityBindings: [...position.abilityBindings, newBinding] })
  }

  const handleCreateCustom = () => {
    if (!selectedRespId || !newAbilityName.trim()) return
    const trimmed = newAbilityName.trim()

    const existing = abilities.find((a) => a.name.toLowerCase() === trimmed.toLowerCase())
    if (existing) {
      setDuplicateName(existing.name)
      return
    }

    const existsInBindings = position.abilityBindings.some(
      (b) =>
        b.responsibilityId === selectedRespId && b.name.toLowerCase() === trimmed.toLowerCase(),
    )
    if (existsInBindings) {
      toast({ title: t('当前职责已存在同名能力点'), variant: 'destructive' })
      return
    }

    const newBinding: PositionAbilityBinding = {
      id: `bind-${Date.now()}`,
      responsibilityId: selectedRespId,
      source: 'custom',
      name: trimmed,
      level: 'understand',
      rubricDescription: '',
      description: '',
      domain: undefined,
      attributes: newAbilityAttributes,
    }
    onUpdate({ abilityBindings: [...position.abilityBindings, newBinding] })
    setNewAbilityName('')
    setNewAbilityAttributes([])
    setShowCreateDialog(false)
    setDuplicateName(null)
  }

  const handleAddExistingFromPool = () => {
    if (!duplicateName || !selectedRespId) return
    const existing = abilities.find((a) => a.name.toLowerCase() === duplicateName.toLowerCase())
    if (existing) {
      handleAddFromPool(existing)
      setNewAbilityName('')
      setShowCreateDialog(false)
      setDuplicateName(null)
    }
  }

  const handleRemoveBinding = (bindingId: string) => {
    onUpdate({
      abilityBindings: position.abilityBindings.filter((b) => b.id !== bindingId),
    })
  }

  const handleUpdateBinding = (bindingId: string, updates: Partial<PositionAbilityBinding>) => {
    onUpdate({
      abilityBindings: position.abilityBindings.map((b) =>
        b.id === bindingId ? { ...b, ...updates } : b,
      ),
    })
  }

  const openAddResponsibilityDialog = () => {
    setNewRespNames([''])
    setShowAddRespDialog(true)
  }

  const handleAddRespRow = () => {
    const next = [...newRespNames, '']
    setNewRespNames(next)
    pendingFocusRespRef.current = `new-resp-${next.length - 1}`
  }

  const handleRemoveRespRow = (index: number) => {
    setNewRespNames((prev) => prev.filter((_, i) => i !== index))
  }

  const handleConfirmAddResponsibilities = () => {
    const names = newRespNames.map((n) => n.trim()).filter(Boolean)
    if (names.length === 0) return
    const now = Date.now()
    const newResps: Position['responsibilities'] = names.map((name) => ({
      id: `resp-${now}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      description: '',
    }))
    onUpdate({ responsibilities: [...position.responsibilities, ...newResps] })
    setSelectedRespId(newResps[newResps.length - 1].id)
    setShowAddRespDialog(false)
    setNewRespNames([''])
    toast({ title: t('已添加 {n} 条工作职责', { n: newResps.length }) })
  }

  const handleRemoveResponsibility = (respId: string) => {
    const remaining = position.responsibilities.filter((r) => r.id !== respId)
    onUpdate({
      responsibilities: remaining,
      abilityBindings: position.abilityBindings.filter((b) => b.responsibilityId !== respId),
    })
    if (selectedRespId === respId) {
      setSelectedRespId(remaining.length > 0 ? remaining[0].id : null)
    }
  }

  const handleStartEditResp = (resp: Position['responsibilities'][0]) => {
    setEditingRespId(resp.id)
    setEditRespName(resp.name)
  }

  const handleSaveEditResp = () => {
    if (!editingRespId) return
    const trimmed = editRespName.trim()
    if (!trimmed) {
      const remaining = position.responsibilities.filter((r) => r.id !== editingRespId)
      onUpdate({ responsibilities: remaining })
      if (selectedRespId === editingRespId) {
        setSelectedRespId(remaining.length > 0 ? remaining[0].id : null)
      }
      setEditingRespId(null)
      setEditRespName('')
      return
    }
    onUpdate({
      responsibilities: position.responsibilities.map((r) =>
        r.id === editingRespId ? { ...r, name: trimmed } : r,
      ),
    })
    setEditingRespId(null)
    setEditRespName('')
  }

  const handleStartEditAbility = (ability: Ability) => {
    setEditingAbilityId(ability.id)
    setEditAbilityName(ability.name)
    setEditAbilityAttributes(ability.attributes || [])
  }

  const handleSaveEditAbility = async (abilityId: string) => {
    const trimmed = editAbilityName.trim()
    if (!trimmed) return
    const current = abilities.find((a) => a.id === abilityId)
    const same =
      trimmed === (current?.name || '') &&
      arrayEquals(editAbilityAttributes, current?.attributes || [])
    if (same) {
      setEditingAbilityId(null)
      setEditAbilityName('')
      setEditAbilityAttributes([])
      return
    }
    try {
      await abilityApi.update(abilityId, {
        name: trimmed,
        attributes: editAbilityAttributes,
      })
      setAbilities((prev) =>
        prev.map((a) =>
          a.id === abilityId ? { ...a, name: trimmed, attributes: editAbilityAttributes } : a,
        ),
      )
      toast({ title: t('能力点已更新') })
    } catch (err: any) {
      toast({ title: err?.message || t('更新失败'), variant: 'destructive' })
    }
    setEditingAbilityId(null)
    setEditAbilityName('')
    setEditAbilityAttributes([])
  }

  const handleDeleteAbility = async (abilityId: string) => {
    try {
      await abilityApi.delete(abilityId)
      setAbilities((prev) => prev.filter((a) => a.id !== abilityId))
      toast({ title: t('能力点已删除') })
    } catch (err: any) {
      toast({ title: err?.message || t('删除失败'), variant: 'destructive' })
    }
  }

  const handleSaveEditAbilityKeyDown = (e: React.KeyboardEvent, abilityId: string) => {
    if (e.key === 'Enter') handleSaveEditAbility(abilityId)
    if (e.key === 'Escape') {
      setEditingAbilityId(null)
      setEditAbilityName('')
    }
  }

  const totalBindings = position.abilityBindings.length
  const totalResponsibilities = position.responsibilities.length

  // ===== AI 辅助拆解能力点（直接写入 + 自动续拆）=====

  const resolveIndustryName = (id: string) => {
    if (!id) return ''
    return industries.find((i) => i.id === id)?.name || id
  }

  const aiSteps = [
    t('阅读岗位信息'),
    ...position.responsibilities.map((r) => `${t('拆解「{name}」能力点', { name: (r.name || t('未命名')).slice(0, 12) })}`),
  ]

  const runAiAssist = async () => {
    const resps = position.responsibilities
    if (resps.length === 0 || aiRunning) return
    setConfirmAiOpen(false)
    setAiRunning(true)
    const bindingsSnapshot = position.abilityBindings
    setAiOpen(true)
    setAiPhase(0)
    try {
      let allBindings = [...bindingsSnapshot]
      for (let i = 0; i < resps.length; i++) {
        const resp = resps[i]
        setAiPhase(i + 1)
        setSelectedRespId(resp.id)
        scrollToResp(resp.id)
        const res = await positionAiAssist({
          field: 'abilities',
          position: {
            name: position.name,
            shortName: position.shortName,
            industry: resolveIndustryName(position.industry),
            majors: [],
            salaryRange: position.salaryRange,
            description: position.description,
            responsibilities: position.responsibilities.map((r) => r.name),
            requirements: position.requirements,
            careerPath: position.careerPath,
            responsibilityName: resp.name,
          },
        })
        const items = res?.abilities
        if (items && items.length > 0) {
          const newBindings: PositionAbilityBinding[] = items.map((a) => ({
            id: `bind-ai-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            responsibilityId: resp.id,
            source: 'custom',
            name: a.name,
            level: 'understand',
            rubricDescription: a.rubricDescription || '',
            description: '',
            attributes: a.attributes || [],
            domain: a.domain || undefined,
          }))
          allBindings = [...allBindings.filter((b) => b.responsibilityId !== resp.id), ...newBindings]
          onUpdate({ abilityBindings: allBindings })
        }
      }
      setAiOpen(false)
      // 生成完成后支持一键撤销到拆解前
      toast({
        title: t('AI 已为 {n} 项职责生成能力点', { n: resps.length }),
        description: t('10 秒内可撤销'),
        duration: 10000,
        action: (
          <ToastAction
            altText={t('撤销')}
            className="h-7 px-2.5 text-xs bg-white border-gray-200 hover:bg-gray-50"
            onClick={() => {
              onUpdate({ abilityBindings: bindingsSnapshot })
              toast({ title: t('已撤销') })
            }}
          >
            {t('撤销')}
          </ToastAction>
        ),
      })
    } finally {
      setAiRunning(false)
    }
  }

  return (
    <div className="flex h-[calc(100vh-280px)] min-h-[500px] rounded-xl border border-gray-200 bg-white overflow-hidden">
      {/* Sidebar - Responsibilities */}
      <div className="w-[36%] shrink-0 border-r flex flex-col bg-gray-50/30">
        <div className="shrink-0 px-5 py-4 border-b border-gray-100 bg-white">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-800">{t('工作职责')}</h3>
              <p className="text-[11px] text-gray-400 mt-0.5">
                {t('{n} 项职责，{m} 个能力点', { n: totalResponsibilities, m: totalBindings })}
              </p>
            </div>
            <Button
              size="sm"
              className="h-7 text-xs rounded-full"
              onClick={openAddResponsibilityDialog}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              {t('添加')}
            </Button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
          {position.responsibilities.length === 0 ? (
            <EmptyState
              compact
              className="py-12"
              icon={<AlertCircle className="h-6 w-6 opacity-30" />}
              title={t('暂无工作职责')}
              titleClassName="text-gray-400"
            />
          ) : (
            position.responsibilities.map((resp) => {
              const bindingCount = position.abilityBindings.filter(
                (b) => b.responsibilityId === resp.id,
              ).length
              const isSelected = resp.id === selectedRespId
              const isEditing = resp.id === editingRespId
              const colorClass = getRespColor(resp.id)
              return (
                <div key={resp.id} className="group relative">
                  {isEditing ? (
                    <div
                      className="flex items-center gap-1 px-3 py-1.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Input
                        value={editRespName}
                        onChange={(e) => setEditRespName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveEditResp()
                          if (e.key === 'Escape') handleSaveEditResp()
                        }}
                        onBlur={handleSaveEditResp}
                        placeholder={t('输入职责名称...')}
                        className="h-7 text-xs border-gray-200"
                        autoFocus
                      />
                      <button
                        className="shrink-0 p-1 rounded text-gray-400 hover:text-gray-600"
                        onClick={handleSaveEditResp}
                      >
                        <Check className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => scrollToResp(resp.id)}
                      className={`w-full text-left pl-3 pr-1 py-3 rounded-xl text-sm transition-all flex items-center gap-2.5 ${
                        isSelected
                          ? 'bg-white shadow-sm border border-gray-200'
                          : 'hover:bg-white/60'
                      }`}
                    >
                      <div className={`w-2 h-2 rounded-full shrink-0 ${colorClass}`} />
                      <span
                        className={`flex-1 truncate ${isSelected ? 'font-medium text-gray-900' : 'text-gray-700'}`}
                      >
                        {resp.name || <span className="text-gray-400 italic">{t('未命名')}</span>}
                      </span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                          bindingCount > 0 ? 'bg-gray-100 text-gray-600' : 'text-gray-400'
                        }`}
                      >
                        {bindingCount}
                      </span>
                      {bindingCount === 0 && (
                        <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-amber-50 text-amber-600 border border-amber-200">
                          {t('未配置')}
                        </span>
                      )}
                      <HoverActionBar>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleStartEditResp(resp)
                          }}
                          className="p-1 rounded text-gray-300 hover:text-gray-600 hover:bg-gray-100"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRemoveResponsibility(resp.id)
                          }}
                          className="p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </HoverActionBar>
                    </button>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Content - Ability list grouped by responsibility */}
      <div className="w-[64%] flex flex-col overflow-hidden bg-gray-50/30">
        <div className="shrink-0 px-5 py-3 border-b border-gray-100 bg-white">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold text-gray-800">{t('能力点列表')}</h3>
            <span className="text-[11px] text-gray-400">{t('共 {n} 个能力点', { n: totalBindings })}</span>
            <div className="flex-1" />
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs rounded-full border-purple-200 text-purple-700 hover:bg-purple-50 hover:text-purple-800 gap-1"
              disabled={aiRunning || position.responsibilities.length === 0}
              onClick={() => setConfirmAiOpen(true)}
            >
              {aiRunning ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              {aiRunning ? t('AI 拆解中...') : t('AI 辅助编写')}
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto" ref={contentRef}>
          {aiNotice && (
            <div className="mx-3 mt-3 rounded-lg border border-amber-200 bg-amber-50/50 p-3 flex items-start gap-2 text-xs text-amber-700">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{aiNotice}</span>
            </div>
          )}

          {position.responsibilities.length === 0 ? (
            <EmptyState
              className="py-20"
              icon={<Brain className="h-10 w-10 opacity-20" />}
              title={t('暂无工作职责和能力点')}
              description={t('请先在左侧添加工作职责')}
              titleClassName="text-gray-300"
            />
          ) : (
            <div className="py-5 space-y-6 px-5">
              {position.responsibilities.map((resp) => {
                const respBindings = position.abilityBindings.filter(
                  (b) => b.responsibilityId === resp.id,
                )
                const isSelectedGroup = resp.id === selectedRespId
                return (
                  <div
                    key={resp.id}
                    ref={(el) => {
                      sectionRefs.current[resp.id] = el
                    }}
                    onMouseEnter={() => setHoveredRespId(resp.id)}
                    onMouseLeave={() => setHoveredRespId(null)}
                    className={`${isSelectedGroup ? 'bg-primary/5 rounded-2xl' : ''} px-4 py-3`}
                  >
                    <div className="flex items-center gap-2 mb-3 px-1">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${getRespColor(resp.id)}`} />
                      <h4 className="text-sm font-semibold text-gray-700 truncate max-w-[140px]">
                        {resp.name || t('未命名职责')}
                      </h4>
                      {respBindings.length > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium shrink-0">
                          {respBindings.length}
                        </span>
                      )}
                      <div className="flex-1" />
                      {hoveredRespId === resp.id && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Button
                            size="sm"
                            className="h-7 text-xs rounded-full"
                            onClick={() => {
                              setSelectedRespId(resp.id)
                              setAbilityPoolSearch('')
                              setAbilityPoolFilterAttr(null)
                              setAbilityPoolFilterPosition(null)
                              setShowAbilityPoolDialog(true)
                            }}
                          >
                            <Library className="mr-1 h-3.5 w-3.5" />
                            {t('从能力点库添加')}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs rounded-full"
                            onClick={() => {
                              setSelectedRespId(resp.id)
                              setDuplicateName(null)
                              setShowCreateDialog(true)
                            }}
                          >
                            <Plus className="mr-1 h-3.5 w-3.5" />
                            {t('新建能力点')}
                          </Button>
                        </div>
                      )}
                    </div>
                    {respBindings.length === 0 ? (
                      <EmptyState
                        compact
                        className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 py-8"
                        title={t('暂无能力点')}
                        titleClassName="text-gray-400"
                        description={t('点击上方按钮添加')}
                      />
                    ) : (
                      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
                        {respBindings.map((binding) => {
                          const levelIdx = competencyLevels.findIndex(
                            (l) => l.value === binding.level,
                          )
                          const colorClass = getRespColor(binding.responsibilityId)
                          return (
                            <div
                              key={binding.id}
                              className="rounded-2xl border border-gray-200 bg-white p-5 hover:border-primary/25 hover:shadow-md transition-all duration-200 group"
                            >
                              <div className="flex items-start justify-between mb-4 relative">
                                <div className="flex items-center gap-2.5 min-w-0 pr-1">
                                  <div className={`w-2 h-2 rounded-full shrink-0 ${colorClass}`} />
                                  <span className="text-sm font-semibold text-gray-800 block truncate">
                                    {binding.name}
                                  </span>
                                </div>
                                <HoverActionBar>
                                  <button
                                    onClick={() => handleRemoveBinding(binding.id)}
                                    className="p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                                    title={t('移除')}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </HoverActionBar>
                              </div>

                              <div className="relative mb-3 mx-1" style={{ height: 38 }}>
                                <div
                                  className="absolute top-2 left-0 right-0 h-2 bg-gray-100 rounded-full"
                                  style={{ margin: '0 5px' }}
                                />
                                <div
                                  className="absolute top-2 left-0 h-2 rounded-full transition-all duration-300"
                                  style={{
                                    width: `calc(${Math.max(0, (levelIdx / (competencyLevels.length - 1)) * 100)}% - 10px)`,
                                    background: 'linear-gradient(90deg, #6366f1, #a78bfa)',
                                    marginLeft: 5,
                                  }}
                                />
                                <div
                                  className="absolute top-[4px] left-0 right-0 flex justify-between"
                                  style={{ padding: '0 5px' }}
                                >
                                  {competencyLevels.map((level, idx) => {
                                    const isReached = idx <= levelIdx
                                    return (
                                      <button
                                        key={level.value}
                                        type="button"
                                        onClick={() =>
                                          handleUpdateBinding(binding.id, { level: level.value })
                                        }
                                        className={`w-3.5 h-3.5 rounded-full border-2 transition-all ${
                                          idx === levelIdx
                                            ? 'border-primary bg-white ring-2 ring-primary/20 scale-110'
                                            : isReached
                                              ? 'border-primary/30 bg-primary/15'
                                              : 'border-gray-300 bg-white hover:border-primary/40'
                                        }`}
                                        title={level.description}
                                      />
                                    )
                                  })}
                                </div>
                                <div
                                  className="absolute bottom-0 left-0 right-0 flex justify-between"
                                  style={{ padding: '0 5px' }}
                                >
                                  {competencyLevels.map((level, idx) => (
                                    <span
                                      key={level.value}
                                      className={`text-[10px] font-medium transition-colors ${
                                        idx === levelIdx
                                          ? 'text-primary'
                                          : idx <= levelIdx
                                            ? 'text-primary/70'
                                            : 'text-gray-300'
                                      }`}
                                    >
                                      {level.label}
                                    </span>
                                  ))}
                                </div>
                              </div>

                              <div>
                                <Textarea
                                  value={binding.rubricDescription}
                                  onChange={(e) =>
                                    handleUpdateBinding(binding.id, {
                                      rubricDescription: e.target.value,
                                    })
                                  }
                                  placeholder={t('胜任标准描述...')}
                                  className="text-[11px] min-h-[40px] resize-none border-gray-100 focus:border-primary/30 bg-gray-50/50 rounded-xl placeholder:text-gray-300"
                                  rows={2}
                                />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          <div className="h-6" />
        </div>
      </div>

      {/* Batch Add Responsibilities Dialog */}
      <Dialog
        open={showAddRespDialog}
        onOpenChange={(open) => {
          setShowAddRespDialog(open)
          if (!open) setNewRespNames([''])
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-gray-800">{t('添加工作职责')}</DialogTitle>
            <DialogDescription className="text-gray-400">
              {t('输入职责名称，回车可继续添加，保存后批量插入')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2 max-h-[50vh] overflow-y-auto pr-1">
            {newRespNames.map((name, index) => (
              <div key={index} className="flex items-start gap-2">
                <Textarea
                  value={name}
                  onChange={(e) => {
                    setNewRespNames((prev) => prev.map((n, i) => (i === index ? e.target.value : n)))
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault()
                      handleAddRespRow()
                    }
                  }}
                  data-focus-id={`new-resp-${index}`}
                  placeholder={t('工作职责 {n}', { n: index + 1 })}
                  className="text-sm min-h-8 py-1"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => handleRemoveRespRow(index)}
                  disabled={newRespNames.length === 1}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="border-gray-200 hover:bg-gray-50"
              onClick={() => setShowAddRespDialog(false)}
            >
              {t('取消')}
            </Button>
            <Button
              onClick={handleConfirmAddResponsibilities}
              disabled={!newRespNames.some((n) => n.trim())}
              className="bg-gray-900 hover:bg-gray-800 text-white"
            >
              {t('保存')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Custom Ability Dialog */}
      <Dialog
        open={showCreateDialog}
        onOpenChange={(open) => {
          setShowCreateDialog(open)
          if (!open) {
            setDuplicateName(null)
            setNewAbilityName('')
            setNewAbilityAttributes([])
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-gray-800">{t('新建能力点')}</DialogTitle>
            <DialogDescription className="text-gray-400">
              {selectedResp
                ? t('为「{name}」新建岗位能力点', { name: selectedResp.name })
                : t('请先选择一项工作职责')}
            </DialogDescription>
          </DialogHeader>
          {duplicateName ? (
            <div className="space-y-4 py-4">
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-800">{t('能力点已存在')}</p>
                    <p className="text-sm text-amber-700 mt-1">
                      {t('公共能力点库中已存在「{name}」，建议直接从库中引用，无需重复创建。', { name: duplicateName })}
                    </p>
                  </div>
                </div>
              </div>
              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  className="border-gray-200 hover:bg-gray-50"
                  onClick={() => {
                    setDuplicateName(null)
                    setNewAbilityName('')
                  }}
                >
                  {t('取消')}
                </Button>
                <Button
                  onClick={handleAddExistingFromPool}
                  className="bg-primary hover:bg-primary/90 text-white"
                >
                  {t('从库中引用')}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setDuplicateName(null)}
                  className="text-gray-500"
                >
                  {t('仍要新建')}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <>
              <div className="space-y-4 py-4">
                <FormFieldRow label={t('能力点名称')} required labelClassName="text-sm text-gray-600">
                  <Input
                    value={newAbilityName}
                    onChange={(e) => setNewAbilityName(e.target.value)}
                    placeholder={t('例如：微服务架构设计')}
                    className="border-gray-200 focus:border-gray-400"
                  />
                </FormFieldRow>
                <div className="space-y-2">
                  <Label className="text-sm text-gray-600">{t('能力属性')}</Label>
                  <div className="flex gap-2">
                    {ABILITY_ATTRIBUTES.map((attr) => {
                      const isSelected = newAbilityAttributes.includes(attr)
                      return (
                        <button
                          key={attr}
                          type="button"
                          onClick={() => {
                            setNewAbilityAttributes((prev) =>
                              prev.includes(attr)
                                ? prev.filter((a) => a !== attr)
                                : [...prev, attr],
                            )
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                            isSelected
                              ? 'bg-gray-900 text-white border-gray-900'
                              : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700'
                          }`}
                        >
                          {attr}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  className="border-gray-200 hover:bg-gray-50"
                  onClick={() => setShowCreateDialog(false)}
                >
                  {t('取消')}
                </Button>
                <Button
                  onClick={handleCreateCustom}
                  disabled={!newAbilityName.trim() || !selectedRespId}
                  className="bg-gray-900 hover:bg-gray-800 text-white"
                >
                  {t('创建并关联')}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Ability Pool Dialog */}
      <Dialog
        open={showAbilityPoolDialog}
        onOpenChange={(open) => {
          setShowAbilityPoolDialog(open)
          if (!open) {
            setAbilityPoolSearch('')
            setAbilityPoolFilterAttr(null)
            setAbilityPoolFilterPosition(null)
          }
        }}
      >
        <DialogContent size="xl" className="!h-[85vh] flex flex-col">
          <DialogHeader className="pb-0">
            <DialogTitle className="text-gray-800">{t('从能力点库添加')}</DialogTitle>
            <DialogDescription className="text-gray-400">
              {t('搜索能力点，添加到当前岗位的工作职责中')}
            </DialogDescription>
          </DialogHeader>

          <div className="shrink-0 rounded-xl border bg-gray-50/50 p-3 space-y-2.5">
            <SearchInput
              iconClassName="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
              placeholder={t('输入名称搜索能力点...')}
              inputClassName="pl-9 h-9 text-sm bg-white border-gray-200"
              value={abilityPoolSearch}
              onChange={setAbilityPoolSearch}
              autoFocus
            />

            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-medium text-gray-500 mr-1">{t('能力属性')}</span>
              {ABILITY_ATTRIBUTES.map((attr) => (
                <button
                  key={attr}
                  onClick={() =>
                    setAbilityPoolFilterAttr(abilityPoolFilterAttr === attr ? null : attr)
                  }
                  className={`px-3 py-1 rounded-full text-[11px] transition-colors ${
                    abilityPoolFilterAttr === attr
                      ? 'bg-gray-800 text-white font-medium shadow-sm'
                      : 'bg-white text-gray-500 border border-gray-200 hover:border-gray-400 hover:text-gray-700'
                  }`}
                >
                  {attr}
                </button>
              ))}
              {abilityPoolFilterAttr && (
                <button
                  onClick={() => setAbilityPoolFilterAttr(null)}
                  className="text-[11px] text-gray-400 hover:text-gray-600 ml-2"
                >
                  {t('清空')}
                </button>
              )}
            </div>

            {!abilityPoolSource && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-medium text-gray-500 mr-1">{t('关联岗位')}</span>
                <ComboboxSelect
                  value={abilityPoolFilterPosition || ''}
                  onChange={(v) => setAbilityPoolFilterPosition(v || null)}
                  options={abilityPoolPositions.map((p) => ({ value: p.id, label: p.name }))}
                  placeholder={t('选择岗位')}
                  searchPlaceholder={t('搜索岗位...')}
                  emptyText={t('暂无匹配岗位')}
                  className="h-7 text-[11px]"
                />
                {abilityPoolFilterPosition && (
                  <button
                    onClick={() => setAbilityPoolFilterPosition(null)}
                    className="text-[11px] text-gray-400 hover:text-gray-600 ml-1"
                  >
                    {t('清空')}
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto mt-3 rounded-lg border bg-white">
            {abilityPoolResults.length === 0 ? (
              <EmptyState
                className="py-16"
                icon={<Search className="h-8 w-8 opacity-25" />}
                title={t('暂无匹配的能力点')}
                titleClassName="text-gray-300"
                action={
                  abilityPoolSearch.trim() && (
                    <button
                      className="text-xs text-primary hover:text-primary font-medium"
                      onClick={() => {
                        setNewAbilityName(abilityPoolSearch.trim())
                        setNewAbilityAttributes([])
                        setDuplicateName(null)
                        setShowCreateDialog(true)
                      }}
                    >
                      {t('+ 库中不存在，点击新建「{name}」', { name: abilityPoolSearch.trim() })}
                    </button>
                  )
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px]">
                  <thead>
                    <tr className="border-b bg-gray-50/80 sticky top-0 z-10">
                      <th className="text-left text-[11px] font-medium text-gray-500 py-2.5 px-4 w-[30%]">
                        {t('能力点名称')}
                      </th>
                      <th className="text-left text-[11px] font-medium text-gray-500 py-2.5 px-4 w-[15%]">
                        {t('能力点编码')}
                      </th>
                      <th className="text-left text-[11px] font-medium text-gray-500 py-2.5 px-4 w-[25%]">
                        {t('能力属性')}
                      </th>
                      <th className="text-right text-[11px] font-medium text-gray-500 py-2.5 px-4 w-[30%]">
                        {t('操作')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {abilityPoolResults.map((ability) => {
                      const isEditing = editingAbilityId === ability.id
                      const alreadyAdded =
                        selectedRespId &&
                        position.abilityBindings.some(
                          (b) =>
                            b.responsibilityId === selectedRespId &&
                            b.publicAbilityId === ability.id,
                        )
                      if (isEditing) {
                        return (
                          <tr key={ability.id} className="bg-primary/5">
                            <td colSpan={4} className="px-4 py-3">
                              <div className="flex items-start gap-4">
                                <div className="flex-1 space-y-2">
                                  <Input
                                    value={editAbilityName}
                                    onChange={(e) => setEditAbilityName(e.target.value)}
                                    onKeyDown={(e) => handleSaveEditAbilityKeyDown(e, ability.id)}
                                    placeholder={t('能力点名称')}
                                    className="h-8 text-sm bg-white"
                                    autoFocus
                                  />
                                  <div className="flex items-center gap-2">
                                    <span className="text-[11px] text-gray-400 shrink-0">{t('属性')}</span>
                                    {ABILITY_ATTRIBUTES.map((attr) => {
                                      const isSel = editAbilityAttributes.includes(attr)
                                      return (
                                        <button
                                          key={attr}
                                          type="button"
                                          onClick={() =>
                                            setEditAbilityAttributes((prev) =>
                                              prev.includes(attr)
                                                ? prev.filter((a) => a !== attr)
                                                : [...prev, attr],
                                            )
                                          }
                                          className={`px-2 py-0.5 rounded text-[11px] border transition-colors ${
                                            isSel
                                              ? 'bg-gray-800 text-white border-gray-800'
                                              : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                                          }`}
                                        >
                                          {attr}
                                        </button>
                                      )
                                    })}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <Button
                                    size="sm"
                                    className="h-7 text-xs"
                                    onClick={() => handleSaveEditAbility(ability.id)}
                                  >
                                    <Check className="mr-1 h-3 w-3" />
                                    {t('保存')}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 text-xs text-gray-500"
                                    onClick={() => {
                                      setEditingAbilityId(null)
                                      setEditAbilityName('')
                                      setEditAbilityAttributes([])
                                    }}
                                  >
                                    {t('取消')}
                                  </Button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )
                      }
                      return (
                        <tr key={ability.id} className="hover:bg-gray-50/80 transition-colors">
                          <td className="px-4 py-3">
                            <span className="text-sm text-gray-800">{ability.name}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm text-gray-400">{ability.code || '-'}</span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              {(ability.attributes || []).map((attr, i) => (
                                <span
                                  key={i}
                                  className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200"
                                >
                                  {attr}
                                </span>
                              ))}
                              {(ability.attributes || []).length === 0 && (
                                <span className="text-[11px] text-gray-300">-</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1.5">
                              {selectedRespId &&
                                (alreadyAdded ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] text-green-600 bg-green-50 px-2.5 py-1 rounded-full border border-green-100">
                                    <Check className="h-3 w-3" />
                                    {t('已添加')}
                                  </span>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-[11px] rounded-full px-3"
                                    onClick={() => handleAddFromPool(ability)}
                                  >
                                    <Plus className="mr-1 h-3 w-3" />
                                    {t('添加')}
                                  </Button>
                                ))}
                              {!abilityPoolSource?.readOnly && (
                                <div className="flex items-center gap-0.5 border border-gray-200 rounded-full overflow-hidden">
                                  <button
                                    onClick={() => handleStartEditAbility(ability)}
                                    className="px-2.5 py-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                                    title={t('编辑')}
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteAbility(ability.id)}
                                    className="px-2.5 py-1 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors border-l border-gray-200"
                                    title={t('删除')}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
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
        </DialogContent>
      </Dialog>

      {/* AI 拆解意图确认弹窗 */}
      <Dialog open={confirmAiOpen} onOpenChange={setConfirmAiOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              {t('确认 AI 拆解能力点？')}
            </DialogTitle>
            <DialogDescription>
              {t('AI 将按 {n} 项工作职责逐条拆解 3-5 个能力点并直接写入（已有的能力点将被替换），自动切换到下一项职责，完成后可一键撤销。', { n: position.responsibilities.length })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmAiOpen(false)}>
              {t('取消')}
            </Button>
            <Button className="bg-purple-600 hover:bg-purple-700 gap-1" onClick={runAiAssist}>
              <Sparkles className="h-4 w-4" />
              {t('确认生成')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI 拆解进度弹窗 */}
      <AiAssistProgressDialog
        open={aiOpen}
        onOpenChange={(open) => {
          if (!open && !aiRunning) setAiOpen(false)
        }}
        title={t('AI 辅助拆解能力点')}
        description={t('大模型正在按工作职责逐个生成能力点并写入')}
        steps={aiSteps}
        currentStep={aiPhase}
        progress={Math.round((aiPhase / Math.max(aiSteps.length - 1, 1)) * 100)}
      />
    </div>
  )
}
