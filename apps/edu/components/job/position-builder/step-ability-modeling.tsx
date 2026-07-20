'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Plus,
  Search,
  Trash2,
  Brain,
  AlertCircle,
  Check,
  X,
  Pencil,
  Library,
} from 'lucide-react'
import { abilityApi } from '@/lib/api'
import { convertApiAbilityToLocal } from '@/lib/stores/job-converters'
import type { Position, PositionAbilityBinding, CompetencyLevel, Ability } from '@/lib/types/job-source'
import { toast } from 'sonner'

interface StepAbilityModelingProps {
  position: Position
  onUpdate: (data: Partial<Position>) => void
  aiMode?: boolean
}

const COMPETENCY_LEVELS: { value: CompetencyLevel; label: string; description: string }[] = [
  { value: 'understand', label: '了解', description: '了解基本概念，能在指导下完成简单任务' },
  { value: 'comprehend', label: '理解', description: '理解原理和方法，能独立完成基本任务' },
  { value: 'master', label: '掌握', description: '能独立完成常规任务，处理一般问题' },
  { value: 'proficient', label: '熟练', description: '能处理复杂任务，指导他人，优化流程' },
  { value: 'expert', label: '精通', description: '行业专家水平，能创新和引领发展方向' },
]

const ABILITY_DOMAINS = [
  '业务洞察',
  '专业工具',
  '通用素质',
  '团队协作',
  '创新思维',
]

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

export function StepAbilityModeling({ position, onUpdate, aiMode = false }: StepAbilityModelingProps) {
  const [abilities, setAbilities] = useState<Ability[]>([])
  const [selectedRespId, setSelectedRespId] = useState<string | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [newAbilityName, setNewAbilityName] = useState('')
  const [newAbilityCategory, setNewAbilityCategory] = useState('专业技能')
  const [aiNotice, setAiNotice] = useState<string | null>(null)
  const [editingRespId, setEditingRespId] = useState<string | null>(null)
  const [editRespName, setEditRespName] = useState('')
  const [editingAbilityId, setEditingAbilityId] = useState<string | null>(null)
  const [editAbilityName, setEditAbilityName] = useState('')
  const [editAbilityDomain, setEditAbilityDomain] = useState('')
  const [editAbilityAttributes, setEditAbilityAttributes] = useState<string[]>([])
  const [duplicateName, setDuplicateName] = useState<string | null>(null)
  const [newAbilityDomain, setNewAbilityDomain] = useState('')
  const [newAbilityAttributes, setNewAbilityAttributes] = useState<string[]>([])
  const [showAbilityPoolDialog, setShowAbilityPoolDialog] = useState(false)
  const [abilityPoolSearch, setAbilityPoolSearch] = useState('')
  const [abilityPoolFilterAttr, setAbilityPoolFilterAttr] = useState<string | null>(null)
  const [abilityPoolFilterDomain, setAbilityPoolFilterDomain] = useState<string | null>(null)

  const contentRef = useRef<HTMLDivElement>(null)
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({})

  useEffect(() => {
    abilityApi.list({ limit: 1000, isPublic: true })
      .then((res) => setAbilities(res.items.map(convertApiAbilityToLocal)))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!isInitialized && position.responsibilities.length > 0) {
      setSelectedRespId(position.responsibilities[0].id)
      setIsInitialized(true)
    }
  }, [position.responsibilities, isInitialized])

  const selectedResp = position.responsibilities.find(r => r.id === selectedRespId)

  const abilityPoolResults = useMemo(() => {
    return abilities.filter(a => {
      if (abilityPoolSearch.trim() &&
        !a.name.toLowerCase().includes(abilityPoolSearch.toLowerCase()) &&
        !a.category.toLowerCase().includes(abilityPoolSearch.toLowerCase())) return false
      if (abilityPoolFilterAttr && !(a.attributes || []).includes(abilityPoolFilterAttr)) return false
      if (abilityPoolFilterDomain && (a.domain || ABILITY_DOMAINS[0]) !== abilityPoolFilterDomain) return false
      return true
    })
  }, [abilities, abilityPoolSearch, abilityPoolFilterAttr, abilityPoolFilterDomain])

  const scrollToResp = (respId: string) => {
    setSelectedRespId(respId)
    const el = sectionRefs.current[respId]
    if (el && contentRef.current) {
      const offsetTop = el.offsetTop - 80
      contentRef.current.scrollTo({ top: offsetTop, behavior: 'smooth' })
    }
  }

  const handleAddFromPool = (ability: typeof abilities[0]) => {
    if (!selectedRespId) return
    const exists = position.abilityBindings.some(
      b => b.responsibilityId === selectedRespId && b.publicAbilityId === ability.id
    )
    if (exists) {
      toast.error('该能力点已添加到当前职责')
      return
    }

    const newBinding: PositionAbilityBinding = {
      id: `bind-${Date.now()}`,
      responsibilityId: selectedRespId,
      source: 'public',
      publicAbilityId: ability.id,
      name: ability.name,
      category: ability.category,
      level: 'understand',
      rubricDescription: '',
      description: '',
    }
    onUpdate({ abilityBindings: [...position.abilityBindings, newBinding] })
  }

  const handleCreateCustom = () => {
    if (!selectedRespId || !newAbilityName.trim()) return
    const trimmed = newAbilityName.trim()

    const existing = abilities.find(a => a.name.toLowerCase() === trimmed.toLowerCase())
    if (existing) {
      setDuplicateName(existing.name)
      return
    }

    const existsInBindings = position.abilityBindings.some(
      b => b.responsibilityId === selectedRespId && b.name.toLowerCase() === trimmed.toLowerCase()
    )
    if (existsInBindings) {
      toast.error('当前职责已存在同名能力点')
      return
    }

    const newBinding: PositionAbilityBinding = {
      id: `bind-${Date.now()}`,
      responsibilityId: selectedRespId,
      source: 'custom',
      name: trimmed,
      category: newAbilityCategory,
      level: 'understand',
      rubricDescription: '',
      description: '',
      domain: newAbilityDomain || ABILITY_DOMAINS[0],
      attributes: newAbilityAttributes,
    }
    onUpdate({ abilityBindings: [...position.abilityBindings, newBinding] })
    setNewAbilityName('')
    setNewAbilityDomain('')
    setNewAbilityAttributes([])
    setShowCreateDialog(false)
    setDuplicateName(null)
  }

  const handleAddExistingFromPool = () => {
    if (!duplicateName || !selectedRespId) return
    const existing = abilities.find(a => a.name.toLowerCase() === duplicateName.toLowerCase())
    if (existing) {
      handleAddFromPool(existing)
      setNewAbilityName('')
      setShowCreateDialog(false)
      setDuplicateName(null)
    }
  }

  const handleRemoveBinding = (bindingId: string) => {
    onUpdate({
      abilityBindings: position.abilityBindings.filter(b => b.id !== bindingId),
    })
  }

  const handleUpdateBinding = (bindingId: string, updates: Partial<PositionAbilityBinding>) => {
    onUpdate({
      abilityBindings: position.abilityBindings.map(b =>
        b.id === bindingId ? { ...b, ...updates } : b
      ),
    })
  }

  const handleAddResponsibility = () => {
    const newResp: Position['responsibilities'][0] = {
      id: `resp-${Date.now()}`,
      name: '',
      description: '',
    }
    onUpdate({ responsibilities: [...position.responsibilities, newResp] })
    setSelectedRespId(newResp.id)
    setEditingRespId(newResp.id)
    setEditRespName('')
  }

  const handleRemoveResponsibility = (respId: string) => {
    const remaining = position.responsibilities.filter(r => r.id !== respId)
    onUpdate({
      responsibilities: remaining,
      abilityBindings: position.abilityBindings.filter(b => b.responsibilityId !== respId),
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
      const remaining = position.responsibilities.filter(r => r.id !== editingRespId)
      onUpdate({ responsibilities: remaining })
      if (selectedRespId === editingRespId) {
        setSelectedRespId(remaining.length > 0 ? remaining[0].id : null)
      }
      setEditingRespId(null)
      setEditRespName('')
      return
    }
    onUpdate({
      responsibilities: position.responsibilities.map(r =>
        r.id === editingRespId ? { ...r, name: trimmed } : r
      ),
    })
    setEditingRespId(null)
    setEditRespName('')
  }

  const handleStartEditAbility = (ability: Ability) => {
    setEditingAbilityId(ability.id)
    setEditAbilityName(ability.name)
    setEditAbilityDomain(ability.domain || '')
    setEditAbilityAttributes(ability.attributes || [])
  }

  const handleSaveEditAbility = async (abilityId: string) => {
    const trimmed = editAbilityName.trim()
    if (!trimmed) {
      return
    }
    const current = abilities.find(a => a.id === abilityId)
    const same = trimmed === (current?.name || '')
      && (editAbilityDomain || '') === (current?.domain || '')
      && arrayEquals(editAbilityAttributes, current?.attributes || [])
    if (same) {
      setEditingAbilityId(null)
      setEditAbilityName('')
      setEditAbilityDomain('')
      setEditAbilityAttributes([])
      return
    }
    try {
      await abilityApi.update(abilityId, {
        name: trimmed,
        category: (current?.category || '专业技能') as any,
        domain: editAbilityDomain || undefined,
        attributes: editAbilityAttributes,
      })
      setAbilities(prev => prev.map(a => a.id === abilityId ? { ...a, name: trimmed, domain: editAbilityDomain || '', attributes: editAbilityAttributes } : a))
      toast.success('能力点已更新')
    } catch (err: any) {
      toast.error(err?.message || '更新失败')
    }
    setEditingAbilityId(null)
    setEditAbilityName('')
    setEditAbilityDomain('')
    setEditAbilityAttributes([])
  }

  const handleDeleteAbility = async (abilityId: string) => {
    try {
      await abilityApi.delete(abilityId)
      setAbilities(prev => prev.filter(a => a.id !== abilityId))
      toast.success('能力点已删除')
    } catch (err: any) {
      toast.error(err?.message || '删除失败')
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

  return (
    <div className="flex h-[calc(100vh-280px)] min-h-[500px] rounded-xl border border-gray-200 bg-white overflow-hidden">
      {/* Sidebar - Responsibilities */}
      <div className="w-[36%] shrink-0 border-r flex flex-col bg-gray-50/30">
        <div className="shrink-0 px-5 py-4 border-b border-gray-100 bg-white">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-800">工作职责</h3>
              <p className="text-[11px] text-gray-400 mt-0.5">{totalResponsibilities} 项职责，{totalBindings} 个能力点</p>
            </div>
            <Button
              size="sm"
              className="h-7 text-xs rounded-full"
              onClick={handleAddResponsibility}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />添加
            </Button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
          {position.responsibilities.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <AlertCircle className="h-6 w-6 mb-2 opacity-30" />
              <p className="text-xs">暂无工作职责</p>
            </div>
          ) : (
            position.responsibilities.map((resp) => {
              const bindingCount = position.abilityBindings.filter(b => b.responsibilityId === resp.id).length
              const isSelected = resp.id === selectedRespId
              const isEditing = resp.id === editingRespId
              const colorClass = getRespColor(resp.id)
              return (
                <div key={resp.id} className="group relative">
                  {isEditing ? (
                    <div className="flex items-center gap-1 px-3 py-1.5" onClick={e => e.stopPropagation()}>
                      <Input
                        value={editRespName}
                        onChange={e => setEditRespName(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleSaveEditResp()
                          if (e.key === 'Escape') handleSaveEditResp()
                        }}
                        onBlur={handleSaveEditResp}
                        placeholder="输入职责名称..."
                        className="h-7 text-xs border-gray-200"
                        autoFocus
                      />
                      <button className="shrink-0 p-1 rounded text-gray-400 hover:text-gray-600" onClick={handleSaveEditResp}>
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
                      <span className={`flex-1 truncate ${isSelected ? 'font-medium text-gray-900' : 'text-gray-700'}`}>
                        {resp.name || <span className="text-gray-400 italic">未命名</span>}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                        bindingCount > 0 ? 'bg-gray-100 text-gray-600' : 'text-gray-400'
                      }`}>
                        {bindingCount}
                      </span>
                      <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleStartEditResp(resp) }}
                          className="p-1 rounded text-gray-300 hover:text-gray-600 hover:bg-gray-100"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleRemoveResponsibility(resp.id) }}
                          className="p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
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
        <div className="shrink-0 px-5 py-4 border-b border-gray-100 bg-white">
          <div className="flex items-center gap-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-800">能力点列表</h3>
              <p className="text-[11px] text-gray-400 mt-0.5">共 {totalBindings} 个能力点</p>
            </div>
            <div className="flex-1" />
            <Button
              size="sm"
              className="h-7 text-xs rounded-full"
              onClick={() => {
                setAbilityPoolSearch('')
                setAbilityPoolFilterAttr(null)
                setAbilityPoolFilterDomain(null)
                setShowAbilityPoolDialog(true)
              }}
            >
              <Library className="mr-1 h-3.5 w-3.5" />
              从能力点库添加
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs rounded-full"
              onClick={() => {
                setDuplicateName(null)
                setShowCreateDialog(true)
              }}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              新建能力点
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
            <div className="flex flex-col items-center justify-center py-20 text-gray-300">
              <Brain className="h-10 w-10 mb-3 opacity-20" />
              <p className="text-sm">暂无工作职责和能力点</p>
              <p className="text-xs mt-1">请先在左侧添加工作职责</p>
            </div>
           ) : (
            <div className="py-5 space-y-12 px-5">
              {position.responsibilities.map((resp) => {
                const respBindings = position.abilityBindings.filter(b => b.responsibilityId === resp.id)
                const isSelectedGroup = resp.id === selectedRespId
                return (
                  <div
                    key={resp.id}
                    ref={(el) => { sectionRefs.current[resp.id] = el }}
                    className={`${isSelectedGroup ? 'bg-indigo-50/40 rounded-2xl' : ''} px-4 py-3`}
                  >
                    <div className="flex items-center gap-2 mb-3 px-1">
                      <div className={`w-2 h-2 rounded-full ${getRespColor(resp.id)}`} />
                      <h4 className="text-sm font-semibold text-gray-700">{resp.name || '未命名职责'}</h4>
                      {respBindings.length > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">
                          {respBindings.length}
                        </span>
                      )}
                    </div>
                      {respBindings.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 py-8 flex flex-col items-center justify-center">
                          <p className="text-xs text-gray-400">暂无能力点</p>
                          <p className="text-[10px] text-gray-300 mt-1">点击上方按钮添加</p>
                        </div>
                      ) : (
                        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
                          {respBindings.map((binding) => {
                            const levelIdx = COMPETENCY_LEVELS.findIndex(l => l.value === binding.level)
                            const colorClass = getRespColor(binding.responsibilityId)
                            return (
                              <div
                                key={binding.id}
                                className="rounded-2xl border border-gray-200 bg-white p-5 hover:border-indigo-200 hover:shadow-md transition-all duration-200 group"
                              >
                                <div className="flex items-start justify-between mb-4">
                                  <div className="flex items-center gap-2.5 min-w-0 pr-1">
                                    <div className={`w-2 h-2 rounded-full shrink-0 ${colorClass}`} />
                                    <span className="text-sm font-semibold text-gray-800 block truncate">{binding.name}</span>
                                  </div>
                                  <button
                                    onClick={() => handleRemoveBinding(binding.id)}
                                    className="shrink-0 p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                                    title="移除"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>

                                <div className="relative mb-4 mx-1">
                                  <div className="absolute top-2.5 left-[6px] right-[6px] h-2 bg-gray-100 rounded-full" />
                                  <div
                                    className="absolute top-2.5 left-[6px] h-2 rounded-full transition-all duration-300"
                                    style={{
                                      width: `calc(${Math.max(0, (levelIdx / (COMPETENCY_LEVELS.length - 1)) * 100)}% - 12px)`,
                                      background: 'linear-gradient(90deg, #6366f1, #a78bfa)',
                                    }}
                                  />
                                  <div className="relative flex justify-between pt-4">
                                    {COMPETENCY_LEVELS.map((level, idx) => {
                                      const isReached = idx <= levelIdx
                                      return (
                                        <button
                                          key={level.value}
                                          type="button"
                                          onClick={() => handleUpdateBinding(binding.id, { level: level.value })}
                                          className={`w-3.5 h-3.5 rounded-full border-2 transition-all ${
                                            idx === levelIdx
                                              ? 'border-indigo-500 bg-white ring-2 ring-indigo-200 scale-110'
                                              : isReached
                                                ? 'border-indigo-300 bg-indigo-200'
                                                : 'border-gray-300 bg-white hover:border-indigo-400'
                                          }`}
                                          title={level.description}
                                        />
                                      )
                                    })}
                                  </div>
                                  <div className="relative flex justify-between mt-2">
                                    {COMPETENCY_LEVELS.map((level, idx) => (
                                      <span
                                        key={level.value}
                                        className={`text-[10px] font-medium transition-colors ${
                                          idx === levelIdx
                                            ? 'text-indigo-600'
                                            : idx <= levelIdx
                                              ? 'text-indigo-400'
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
                                    onChange={(e) => handleUpdateBinding(binding.id, { rubricDescription: e.target.value })}
                                    placeholder="胜任标准描述..."
                                    className="text-[11px] min-h-[40px] resize-none border-gray-100 focus:border-indigo-300 bg-gray-50/50 rounded-xl placeholder:text-gray-300"
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

      {/* Create Custom Ability Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={(open) => {
        setShowCreateDialog(open)
        if (!open) { setDuplicateName(null); setNewAbilityName(''); setNewAbilityDomain(''); setNewAbilityAttributes([]) }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-gray-800">新建能力点</DialogTitle>
            <DialogDescription className="text-gray-400">
              {selectedResp
                ? `为「${selectedResp.name}」新建岗位能力点`
                : '请先选择一项工作职责'}
            </DialogDescription>
          </DialogHeader>
          {duplicateName ? (
            <div className="space-y-4 py-4">
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-800">能力点已存在</p>
                    <p className="text-sm text-amber-700 mt-1">
                      公共能力点库中已存在「<span className="font-medium">{duplicateName}</span>」，建议直接从库中引用，无需重复创建。
                    </p>
                  </div>
                </div>
              </div>
              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  className="border-gray-200 hover:bg-gray-50"
                  onClick={() => { setDuplicateName(null); setNewAbilityName('') }}
                >
                  取消
                </Button>
                <Button
                  onClick={handleAddExistingFromPool}
                  className="bg-primary hover:bg-primary/90 text-white"
                >
                  从库中引用
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setDuplicateName(null)}
                  className="text-gray-500"
                >
                  仍要新建
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label className="text-sm text-gray-600">能力点名称 <span className="text-red-400">*</span></Label>
                  <Input
                    value={newAbilityName}
                    onChange={(e) => setNewAbilityName(e.target.value)}
                    placeholder="例如：微服务架构设计"
                    className="border-gray-200 focus:border-gray-400"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-gray-600">能力属性</Label>
                  <div className="flex gap-2">
                    {ABILITY_ATTRIBUTES.map((attr) => {
                      const isSelected = newAbilityAttributes.includes(attr)
                      return (
                        <button
                          key={attr}
                          type="button"
                          onClick={() => {
                            setNewAbilityAttributes(prev =>
                              prev.includes(attr) ? prev.filter(a => a !== attr) : [...prev, attr]
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
                <div className="space-y-2">
                  <Label className="text-sm text-gray-600">所属能力域</Label>
                  <Select value={newAbilityDomain || ABILITY_DOMAINS[0]} onValueChange={setNewAbilityDomain}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ABILITY_DOMAINS.map((d) => (
                        <SelectItem key={d} value={d}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" className="border-gray-200 hover:bg-gray-50" onClick={() => setShowCreateDialog(false)}>
                  取消
                </Button>
                <Button
                  onClick={handleCreateCustom}
                  disabled={!newAbilityName.trim() || !selectedRespId}
                  className="bg-gray-900 hover:bg-gray-800 text-white"
                >
                  创建并关联
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Ability Pool Dialog */}
      <Dialog open={showAbilityPoolDialog} onOpenChange={(open) => {
        setShowAbilityPoolDialog(open)
        if (!open) { setAbilityPoolSearch(''); setAbilityPoolFilterAttr(null); setAbilityPoolFilterDomain(null) }
      }}>
        <DialogContent size="xl" className="!h-[85vh] flex flex-col">
          <DialogHeader className="pb-0">
            <DialogTitle className="text-gray-800">从能力点库添加</DialogTitle>
            <DialogDescription className="text-gray-400">
              搜索能力点，添加到当前岗位的工作职责中
            </DialogDescription>
          </DialogHeader>

          <div className="shrink-0 rounded-xl border bg-gray-50/50 p-3 space-y-2.5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="输入名称搜索能力点..."
                className="pl-9 h-9 text-sm bg-white border-gray-200"
                value={abilityPoolSearch}
                onChange={(e) => setAbilityPoolSearch(e.target.value)}
                autoFocus
              />
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-medium text-gray-500 mr-1">能力属性</span>
              {ABILITY_ATTRIBUTES.map((attr) => (
                <button
                  key={attr}
                  onClick={() => setAbilityPoolFilterAttr(abilityPoolFilterAttr === attr ? null : attr)}
                  className={`px-3 py-1 rounded-full text-[11px] transition-colors ${
                    abilityPoolFilterAttr === attr
                      ? 'bg-gray-800 text-white font-medium shadow-sm'
                      : 'bg-white text-gray-500 border border-gray-200 hover:border-gray-400 hover:text-gray-700'
                  }`}
                >
                  {attr}
                </button>
              ))}
              <span className="text-[11px] font-medium text-gray-500 ml-3 mr-1">能力领域</span>
              {ABILITY_DOMAINS.map((dom) => (
                <button
                  key={dom}
                  onClick={() => setAbilityPoolFilterDomain(abilityPoolFilterDomain === dom ? null : dom)}
                  className={`px-3 py-1 rounded-full text-[11px] transition-colors ${
                    abilityPoolFilterDomain === dom
                      ? 'bg-gray-800 text-white font-medium shadow-sm'
                      : 'bg-white text-gray-500 border border-gray-200 hover:border-gray-400 hover:text-gray-700'
                  }`}
                >
                  {dom}
                </button>
              ))}
              {(abilityPoolFilterAttr || abilityPoolFilterDomain) && (
                <button
                  onClick={() => { setAbilityPoolFilterAttr(null); setAbilityPoolFilterDomain(null) }}
                  className="text-[11px] text-gray-400 hover:text-gray-600 ml-2"
                >
                  清空
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto mt-3 rounded-lg border bg-white">
            {abilityPoolResults.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-300">
                <Search className="h-8 w-8 mb-2 opacity-25" />
                <p className="text-sm">暂无匹配的能力点</p>
                {abilityPoolSearch.trim() && (
                  <button
                    className="mt-3 text-xs text-indigo-500 hover:text-indigo-600 font-medium"
                    onClick={() => {
                      setNewAbilityName(abilityPoolSearch.trim())
                      setNewAbilityDomain('')
                      setNewAbilityAttributes([])
                      setDuplicateName(null)
                      setShowCreateDialog(true)
                    }}
                  >
                    + 库中不存在，点击新建「{abilityPoolSearch.trim()}」
                  </button>
                )}
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-gray-50/80 sticky top-0 z-10">
                    <th className="text-left text-[11px] font-medium text-gray-500 py-2.5 px-4 w-[34%]">能力点名称</th>
                    <th className="text-left text-[11px] font-medium text-gray-500 py-2.5 px-4 w-[26%]">属性 · 领域</th>
                    <th className="text-right text-[11px] font-medium text-gray-500 py-2.5 px-4 w-[40%]">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {abilityPoolResults.map((ability) => {
                    const isEditing = editingAbilityId === ability.id
                    const alreadyAdded = selectedRespId && position.abilityBindings.some(
                      b => b.responsibilityId === selectedRespId && b.publicAbilityId === ability.id
                    )
                    if (isEditing) {
                      return (
                        <tr key={ability.id} className="bg-indigo-50/40">
                          <td colSpan={3} className="px-4 py-3">
                            <div className="flex items-start gap-4">
                              <div className="flex-1 space-y-2">
                                <Input
                                  value={editAbilityName}
                                  onChange={e => setEditAbilityName(e.target.value)}
                                  onKeyDown={e => handleSaveEditAbilityKeyDown(e, ability.id)}
                                  placeholder="能力点名称"
                                  className="h-8 text-sm bg-white"
                                  autoFocus
                                />
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] text-gray-400 shrink-0">属性</span>
                                  {ABILITY_ATTRIBUTES.map((attr) => {
                                    const isSel = editAbilityAttributes.includes(attr)
                                    return (
                                      <button
                                        key={attr}
                                        type="button"
                                        onClick={() => setEditAbilityAttributes(prev =>
                                          prev.includes(attr) ? prev.filter(a => a !== attr) : [...prev, attr]
                                        )}
                                        className={`px-2 py-0.5 rounded text-[11px] border transition-colors ${
                                          isSel ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                                        }`}
                                      >
                                        {attr}
                                      </button>
                                    )
                                  })}
                                  <span className="text-[11px] text-gray-400 shrink-0 ml-3">领域</span>
                                  <Select value={editAbilityDomain || ABILITY_DOMAINS[0]} onValueChange={setEditAbilityDomain}>
                                    <SelectTrigger className="h-6 text-[11px] w-28 bg-white">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {ABILITY_DOMAINS.map((d) => (
                                        <SelectItem key={d} value={d}>{d}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <Button size="sm" className="h-7 text-xs" onClick={() => handleSaveEditAbility(ability.id)}>
                                  <Check className="mr-1 h-3 w-3" />保存
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7 text-xs text-gray-500" onClick={() => { setEditingAbilityId(null); setEditAbilityName(''); setEditAbilityDomain(''); setEditAbilityAttributes([]) }}>
                                  取消
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
                          <div className="flex items-center gap-1.5">
                            {(ability.attributes || []).map((attr, i) => (
                              <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">{attr}</span>
                            ))}
                            {((ability.attributes || []).length > 0) && <span className="text-gray-300 text-[10px]">·</span>}
                            <span className="text-[11px] text-gray-400">{ability.domain || ABILITY_DOMAINS[0]}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1.5">
                            {selectedRespId && (
                              alreadyAdded ? (
                                <span className="inline-flex items-center gap-1 text-[11px] text-green-600 bg-green-50 px-2.5 py-1 rounded-full border border-green-100">
                                  <Check className="h-3 w-3" />已添加
                                </span>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-[11px] rounded-full px-3"
                                  onClick={() => handleAddFromPool(ability)}
                                >
                                  <Plus className="mr-1 h-3 w-3" />添加
                                </Button>
                              )
                            )}
                            <div className="flex items-center gap-0.5 border border-gray-200 rounded-full overflow-hidden">
                              <button
                                onClick={() => handleStartEditAbility(ability)}
                                className="px-2.5 py-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                                title="编辑"
                              >
                                <Pencil className="h-3 w-3" />
                              </button>
                              <button
                                onClick={() => handleDeleteAbility(ability.id)}
                                className="px-2.5 py-1 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors border-l border-gray-200"
                                title="删除"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </DialogContent>
      </Dialog>

    </div>
  )
}
