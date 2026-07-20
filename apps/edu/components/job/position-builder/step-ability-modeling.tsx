'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  BookOpen,
  Brain,
  CheckCircle2,
  AlertCircle,
  Check,
  X,
  Pencil,
  Library,
  GripVertical,
} from 'lucide-react'
import { abilityApi } from '@/lib/api'
import { convertApiAbilityToLocal } from '@/lib/stores/job-converters'
import type { Position, PositionAbilityBinding, CompetencyLevel, Ability } from '@/lib/types/job-source'
import { COMPETENCY_LEVEL_LABELS } from '@/lib/types/job-source'
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

export function StepAbilityModeling({ position, onUpdate, aiMode = false }: StepAbilityModelingProps) {
  const [abilities, setAbilities] = useState<Ability[]>([])
  const [selectedRespId, setSelectedRespId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [newAbilityName, setNewAbilityName] = useState('')
  const [newAbilityCategory, setNewAbilityCategory] = useState('专业技能')
  const [aiNotice, setAiNotice] = useState<string | null>(null)
  const [editingRespId, setEditingRespId] = useState<string | null>(null)
  const [editRespName, setEditRespName] = useState('')
  const [expandedBindingId, setExpandedBindingId] = useState<string | null>(null)
  const [showLibraryDialog, setShowLibraryDialog] = useState(false)
  const [editingAbilityId, setEditingAbilityId] = useState<string | null>(null)
  const [editAbilityName, setEditAbilityName] = useState('')
  const [duplicateName, setDuplicateName] = useState<string | null>(null)

  const contentRef = useRef<HTMLDivElement>(null)
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({})

  useEffect(() => {
    abilityApi.list({ limit: 1000, isPublic: true })
      .then((res) => setAbilities(res.items.map(convertApiAbilityToLocal)))
      .catch(() => {})
  }, [])

  const selectedResp = position.responsibilities.find(r => r.id === selectedRespId)

  const filteredPublicAbilities = useMemo(() => {
    if (!searchQuery.trim()) return []
    return abilities.filter(a =>
      a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.category.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [abilities, searchQuery])

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
      level: 'master',
      domain: ABILITY_DOMAINS[0],
      rubricDescription: '',
      description: '',
      attributes: [],
    }
    onUpdate({ abilityBindings: [...position.abilityBindings, newBinding] })
    setSearchQuery('')
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
      level: 'master',
      domain: ABILITY_DOMAINS[0],
      rubricDescription: '',
      description: '',
      attributes: [],
    }
    onUpdate({ abilityBindings: [...position.abilityBindings, newBinding] })
    setExpandedBindingId(newBinding.id)
    setNewAbilityName('')
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

  const handleSetAttribute = (bindingId: string, attr: string) => {
    const binding = position.abilityBindings.find((b) => b.id === bindingId)
    if (!binding) return
    const current = binding.attributes || []
    const next = current.includes(attr)
      ? current.filter((a) => a !== attr)
      : [...current, attr]
    handleUpdateBinding(bindingId, { attributes: next })
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
    onUpdate({
      responsibilities: position.responsibilities.filter(r => r.id !== respId),
      abilityBindings: position.abilityBindings.filter(b => b.responsibilityId !== respId),
    })
    if (selectedRespId === respId) {
      setSelectedRespId(null)
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
      onUpdate({
        responsibilities: position.responsibilities.filter(r => r.id !== editingRespId),
      })
      if (selectedRespId === editingRespId) {
        setSelectedRespId(null)
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
  }

  const handleSaveEditAbility = async (abilityId: string) => {
    const trimmed = editAbilityName.trim()
    if (!trimmed || trimmed === abilities.find(a => a.id === abilityId)?.name) {
      setEditingAbilityId(null)
      return
    }
    try {
      const current = abilities.find(a => a.id === abilityId)
      await abilityApi.update(abilityId, { name: trimmed, category: (current?.category || '专业技能') as any })
      setAbilities(prev => prev.map(a => a.id === abilityId ? { ...a, name: trimmed } : a))
      toast.success('能力点名称已更新')
    } catch (err: any) {
      toast.error(err?.message || '更新失败')
    }
    setEditingAbilityId(null)
    setEditAbilityName('')
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
      <div className="w-60 shrink-0 border-r border-gray-100 flex flex-col bg-gray-50/50">
        <div className="shrink-0 px-4 py-3 border-b border-gray-100">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-medium text-gray-800">工作职责</h3>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-gray-400 hover:text-gray-600"
              onClick={handleAddResponsibility}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-[11px] text-gray-400">{totalResponsibilities} 项职责</p>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {position.responsibilities.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-gray-400">
              <AlertCircle className="h-6 w-6 mb-2 opacity-40" />
              <p className="text-xs">暂无工作职责</p>
            </div>
          ) : (
            position.responsibilities.map((resp) => {
              const bindingCount = position.abilityBindings.filter(b => b.responsibilityId === resp.id).length
              const isSelected = resp.id === selectedRespId
              const isEditing = resp.id === editingRespId
              return (
                <div key={resp.id} className="group">
                  {isEditing ? (
                    <div className="flex items-center gap-1 px-2 py-1" onClick={e => e.stopPropagation()}>
                      <Input
                        value={editRespName}
                        onChange={e => setEditRespName(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleSaveEditResp()
                          if (e.key === 'Escape') handleSaveEditResp()
                        }}
                        onBlur={handleSaveEditResp}
                        placeholder="输入职责名称..."
                        className="h-7 text-xs py-0 border-gray-200"
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
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all flex items-center gap-2 ${
                        isSelected
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'
                      }`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${getRespColor(resp.id)}`} />
                      <span className="flex-1 truncate">{resp.name || <span className="text-gray-400 italic">未命名</span>}</span>
                      <span className="text-[10px] text-gray-400 shrink-0">{bindingCount}</span>
                      <div className="hidden group-hover:flex items-center gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleStartEditResp(resp)
                          }}
                          className="p-0.5 rounded text-gray-300 hover:text-gray-600"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRemoveResponsibility(resp.id)
                          }}
                          className="p-0.5 rounded text-gray-300 hover:text-red-500"
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
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Search bar - sticky */}
        <div className="shrink-0 px-4 py-3 border-b border-gray-100 bg-white">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-medium text-gray-800 shrink-0">能力点列表</h3>
            <span className="text-xs text-gray-400">{totalBindings} 个能力点</span>
            <div className="flex-1" />
            <div className="relative w-56">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="搜索公共能力点库..."
                className="pl-8 h-8 text-xs"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs shrink-0"
              onClick={() => setShowLibraryDialog(true)}
            >
              <Library className="mr-1 h-3.5 w-3.5" />
              查看功能点库
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs shrink-0"
              onClick={() => {
                if (!selectedRespId) {
                  toast.error('请先在左侧选择一个工作职责')
                  return
                }
                setDuplicateName(null)
                setShowCreateDialog(true)
              }}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              新建能力点
            </Button>
          </div>

          {/* Search results dropdown */}
          {searchQuery.trim() && selectedRespId && (
            <div className="mt-2 rounded-lg border border-gray-200 bg-white p-3 space-y-2 max-h-56 overflow-y-auto shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500 font-medium">公共能力点库（{abilities.length}）</p>
                <p className="text-xs text-gray-400">搜索「{searchQuery}」</p>
              </div>
              {filteredPublicAbilities.length === 0 ? (
                <div className="py-3 text-center">
                  <p className="text-sm text-gray-400">未找到匹配的能力点</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-1 text-amber-600 hover:text-amber-700 hover:bg-amber-50/50 text-xs"
                    onClick={() => {
                      setNewAbilityName(searchQuery)
                      setDuplicateName(null)
                      setShowCreateDialog(true)
                    }}
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    新建「{searchQuery}」
                  </Button>
                </div>
              ) : (
                filteredPublicAbilities.map((ability) => (
                  <div
                    key={ability.id}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => handleAddFromPool(ability)}
                  >
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-3.5 w-3.5 text-gray-500" />
                      <span className="text-sm text-gray-700">{ability.name}</span>
                      <Badge variant="outline" className="text-[10px] rounded-md px-1.5 py-0">{ability.category}</Badge>
                    </div>
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-gray-400 hover:text-primary">
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          )}
          {searchQuery.trim() && !selectedRespId && filteredPublicAbilities.length > 0 && (
            <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5">
              <p className="text-xs text-amber-700">
                请先在左侧点击一个工作职责，再添加能力点
              </p>
            </div>
          )}
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto" ref={contentRef}>
          {aiNotice && (
            <div className="mx-4 mt-3 rounded-lg border border-amber-200 bg-amber-50/50 p-3 flex items-start gap-2 text-sm text-amber-800">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{aiNotice}</span>
            </div>
          )}

          {position.responsibilities.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <Brain className="h-12 w-12 mb-4 opacity-25" />
              <p className="text-sm">暂无工作职责和能力点</p>
              <p className="text-xs mt-1 text-gray-300">请先在左侧添加工作职责，再为其添加能力点</p>
            </div>
          ) : (
            <div className="py-3 space-y-1">
              {position.responsibilities.map((resp) => {
                const respBindings = position.abilityBindings.filter(b => b.responsibilityId === resp.id)
                return (
                  <div
                    key={resp.id}
                    ref={(el) => { sectionRefs.current[resp.id] = el }}
                    className="mx-3"
                  >
                    {/* Group header */}
                    <div className="flex items-center gap-2 px-3 py-2 sticky top-0 bg-white/95 backdrop-blur-sm z-10 border-b border-gray-50">
                      <div className={`w-2 h-2 rounded-full ${getRespColor(resp.id)}`} />
                      <h4 className="text-sm font-medium text-gray-700">{resp.name || '未命名职责'}</h4>
                      <Badge variant="secondary" className="text-[10px] rounded-md px-1.5 py-0 font-normal">
                        {respBindings.length} 个能力点
                      </Badge>
                    </div>

                    {/* Bindings for this responsibility */}
                    <div className="px-3 py-2 space-y-1.5">
                      {respBindings.length === 0 ? (
                        <p className="text-xs text-gray-400 py-2 px-1 italic">暂未配置能力点</p>
                      ) : (
                        respBindings.map((binding) => {
                          const isExpanded = expandedBindingId === binding.id
                          return isExpanded ? (
                            <div key={binding.id} className="rounded-xl border border-gray-300 bg-white p-4 space-y-3 shadow-sm ml-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold text-gray-800">{binding.name}</span>
                                  <span className="text-[11px] text-gray-400">{COMPETENCY_LEVEL_LABELS[binding.level]}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Button size="sm" variant="ghost" className="h-7 px-2 text-gray-500 hover:text-gray-800 text-xs" onClick={() => setExpandedBindingId(null)}>
                                    收起
                                  </Button>
                                  <button
                                    className="p-1.5 rounded-md text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                                    onClick={() => handleRemoveBinding(binding.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>

                              <div className="space-y-1.5">
                                <Label className="text-xs text-gray-400 font-medium">所属能力域</Label>
                                <Select
                                  value={binding.domain || ABILITY_DOMAINS[0]}
                                  onValueChange={(v) => handleUpdateBinding(binding.id, { domain: v })}
                                >
                                  <SelectTrigger className="h-8 text-sm w-full max-w-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {ABILITY_DOMAINS.map((d) => (
                                      <SelectItem key={d} value={d}>{d}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="space-y-1.5">
                                <Label className="text-xs text-gray-400 font-medium">能力属性</Label>
                                <div className="flex gap-2">
                                  {ABILITY_ATTRIBUTES.map((attr) => {
                                    const isSelected = (binding.attributes || []).includes(attr)
                                    return (
                                      <button
                                        key={attr}
                                        type="button"
                                        onClick={() => handleSetAttribute(binding.id, attr)}
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
                                <Label className="text-xs text-gray-400 font-medium">掌握程度</Label>
                                <div className="relative pt-2 pb-1 max-w-md">
                                  <div className="absolute top-[14px] left-0 right-0 h-1 bg-gray-100 rounded-full" />
                                  <div
                                    className="absolute top-[14px] left-0 h-1 bg-gray-800 rounded-full transition-all"
                                    style={{
                                      width: `${(COMPETENCY_LEVELS.findIndex(l => l.value === binding.level) / (COMPETENCY_LEVELS.length - 1)) * 100}%`,
                                    }}
                                  />
                                  <div className="relative flex justify-between">
                                    {COMPETENCY_LEVELS.map((level) => {
                                      const currentIdx = COMPETENCY_LEVELS.findIndex(l => l.value === binding.level)
                                      const idx = COMPETENCY_LEVELS.findIndex(l => l.value === level.value)
                                      const isActive = idx <= currentIdx
                                      const isSelected = binding.level === level.value
                                      return (
                                        <button
                                          key={level.value}
                                          type="button"
                                          onClick={() => handleUpdateBinding(binding.id, { level: level.value })}
                                          className="flex flex-col items-center gap-1 group"
                                        >
                                          <div
                                            className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center transition-all ${
                                              isSelected
                                                ? 'border-gray-800 bg-gray-800 scale-110'
                                                : isActive
                                                  ? 'border-gray-800 bg-gray-800/15'
                                                  : 'border-gray-300 bg-white group-hover:border-gray-400'
                                            }`}
                                          >
                                            {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                          </div>
                                          <span
                                            className={`text-[10px] font-medium transition-colors ${
                                              isSelected ? 'text-gray-900' : isActive ? 'text-gray-700' : 'text-gray-400'
                                            }`}
                                          >
                                            {level.label}
                                          </span>
                                        </button>
                                      )
                                    })}
                                  </div>
                                </div>
                              </div>

                              <div className="space-y-1.5">
                                <Label className="text-xs text-gray-400 font-medium">胜任标准描述</Label>
                                <Textarea
                                  value={binding.rubricDescription}
                                  onChange={(e) => handleUpdateBinding(binding.id, { rubricDescription: e.target.value })}
                                  placeholder="描述该能力点在本岗位中的具体达标表现..."
                                  className="text-sm min-h-[56px] resize-none border-gray-200 focus:border-gray-400"
                                  rows={2}
                                />
                              </div>
                            </div>
                          ) : (
                            <div
                              key={binding.id}
                              onClick={() => setExpandedBindingId(binding.id)}
                              className="flex items-center justify-between px-3 py-2.5 ml-2 rounded-lg border border-gray-100 bg-white hover:border-gray-200 hover:bg-gray-50/50 transition-colors cursor-pointer"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <GripVertical className="h-3.5 w-3.5 text-gray-300 shrink-0" />
                                <span className="text-sm text-gray-700 truncate">{binding.name}</span>
                                <span className="text-[11px] text-gray-400 shrink-0">{COMPETENCY_LEVEL_LABELS[binding.level]}</span>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <Badge variant="outline" className="text-[10px] rounded-md px-1.5 py-0 text-gray-400">
                                  {binding.domain || ABILITY_DOMAINS[0]}
                                </Badge>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleRemoveBinding(binding.id)
                                  }}
                                  className="p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Bottom padding */}
          <div className="h-8" />
        </div>
      </div>

      {/* Create Custom Ability Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={(open) => {
        setShowCreateDialog(open)
        if (!open) { setDuplicateName(null); setNewAbilityName('') }
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
                  <Label className="text-sm text-gray-600">能力点名称</Label>
                  <Input
                    value={newAbilityName}
                    onChange={(e) => setNewAbilityName(e.target.value)}
                    placeholder="例如：微服务架构设计"
                    className="border-gray-200 focus:border-gray-400"
                  />
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

      {/* Ability Library Dialog */}
      <Dialog open={showLibraryDialog} onOpenChange={setShowLibraryDialog}>
        <DialogContent className="max-w-xl max-h-[70vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-gray-800">功能点库</DialogTitle>
            <DialogDescription className="text-gray-400">
              系统内全部公共能力点（共 {abilities.length} 个）
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto py-4 space-y-1">
            {abilities.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <Library className="h-10 w-10 mb-3 opacity-30" />
                <p className="text-sm">暂无能点</p>
              </div>
            ) : (
              abilities.map((ability) => {
                const isEditing = editingAbilityId === ability.id
                return (
                  <div
                    key={ability.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors group"
                  >
                    <BookOpen className="h-4 w-4 text-gray-500 shrink-0" />
                    <div className="flex-1 min-w-0 flex items-center gap-2">
                      {isEditing ? (
                        <div className="flex items-center gap-1 flex-1" onClick={e => e.stopPropagation()}>
                          <Input
                            value={editAbilityName}
                            onChange={e => setEditAbilityName(e.target.value)}
                            onKeyDown={e => handleSaveEditAbilityKeyDown(e, ability.id)}
                            onBlur={() => handleSaveEditAbility(ability.id)}
                            placeholder="能力点名称..."
                            className="h-7 text-sm py-0 border-gray-200"
                            autoFocus
                          />
                          <button
                            className="shrink-0 p-1 rounded text-gray-400 hover:text-gray-600"
                            onClick={() => handleSaveEditAbility(ability.id)}
                          >
                            <Check className="h-3 w-3" />
                          </button>
                          <button
                            className="shrink-0 p-1 rounded text-gray-400 hover:text-gray-600"
                            onClick={() => { setEditingAbilityId(null); setEditAbilityName('') }}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-700 truncate">{ability.name}</span>
                      )}
                      {!isEditing && (
                        <Badge variant="outline" className="text-[10px] rounded-md px-1.5 py-0 shrink-0">
                          {ability.category}
                        </Badge>
                      )}
                    </div>
                    {!isEditing && (
                      <button
                        onClick={() => handleStartEditAbility(ability)}
                        className="p-1 rounded text-gray-300 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                        title="编辑名称"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
