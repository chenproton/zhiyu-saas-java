'use client'

import { useState, useMemo, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Sparkles, ArrowRight, CheckCircle2, Trash2, AlertCircle } from 'lucide-react'
import type { Position, PositionAbilityBinding, CompetencyLevel } from '@/lib/types/job-source'
import { COMPETENCY_LEVEL_LABELS } from '@/lib/types/job-source'

const COMPETENCY_LEVELS: { value: CompetencyLevel; label: string; description: string }[] = [
  { value: 'understand', label: '了解', description: '了解基本概念，能在指导下完成简单任务' },
  { value: 'comprehend', label: '理解', description: '理解原理和方法，能独立完成基本任务' },
  { value: 'master', label: '掌握', description: '能独立完成常规任务，处理一般问题' },
  { value: 'proficient', label: '熟练', description: '能处理复杂任务，指导他人，优化流程' },
  { value: 'expert', label: '精通', description: '行业专家水平，能创新和引领发展方向' },
]

const ABILITY_ATTRIBUTES = ['知识', '素养', '技能']

const ABILITY_DOMAINS = [
  '岗位与行业认知',
  '专业知识',
  '职业素养/价值观',
  '专业技能',
  '通用能力',
]

interface Step2AbilityModelProps {
  position: Position
  onUpdate: (data: Partial<Position>) => void
  onNext: () => void
}

export function Step2AbilityModel({ position, onUpdate, onNext }: Step2AbilityModelProps) {
  const [currentRespIndex, setCurrentRespIndex] = useState(0)
  const [aiNotice, setAiNotice] = useState<string | null>(null)

  const responsibilities = position.responsibilities
  const currentResp = responsibilities[currentRespIndex]

  const currentBindings = useMemo(
    () => position.abilityBindings.filter((b) => b.responsibilityId === currentResp?.id),
    [position.abilityBindings, currentResp?.id]
  )

  const allResponsibilitiesBound = responsibilities.length > 0 &&
    responsibilities.every((resp) => position.abilityBindings.some((b) => b.responsibilityId === resp.id))

  const progressPercent = responsibilities.length > 0
    ? Math.round(((currentRespIndex + (currentBindings.length > 0 ? 1 : 0)) / responsibilities.length) * 100)
    : 0

  const startAiAssist = () => {
    setAiNotice('AI 生成服务暂未接入，请手动填写')
  }

  const generateAbilitiesForCurrentResp = () => {
    if (!currentResp) return
    const newBindings: PositionAbilityBinding[] = [
      {
        id: `bind-${Date.now()}-1`,
        responsibilityId: currentResp.id,
        source: 'custom',
        name: '',
        category: '专业技能',
        level: 'understand',
        rubricDescription: '',
        description: '',
        attributes: ['技能'],
        domain: ABILITY_DOMAINS[0],
      },
    ]

    const cleaned = position.abilityBindings.filter(
      (b) => b.responsibilityId !== currentResp.id
    )
    onUpdate({ abilityBindings: [...cleaned, ...newBindings] })
  }

  const handleUpdateBinding = (bindingId: string, updates: Partial<PositionAbilityBinding>) => {
    onUpdate({
      abilityBindings: position.abilityBindings.map((b) =>
        b.id === bindingId ? { ...b, ...updates } : b
      ),
    })
  }

  const handleRemoveBinding = (bindingId: string) => {
    onUpdate({
      abilityBindings: position.abilityBindings.filter((b) => b.id !== bindingId),
    })
  }

  const handleAddBinding = () => {
    if (!currentResp) return
    const newBinding: PositionAbilityBinding = {
      id: `bind-manual-${Date.now()}`,
      responsibilityId: currentResp.id,
      source: 'custom',
      name: '',
      category: '专业技能',
      level: 'master',
      rubricDescription: '',
      description: '',
      attributes: [],
      domain: ABILITY_DOMAINS[0],
    }
    onUpdate({ abilityBindings: [...position.abilityBindings, newBinding] })
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">步骤二：能力模型配置</h2>
          <p className="text-sm text-gray-500 mt-0.5">按工作职责逐个拆解能力点，AI 辅助生成后可自由编辑</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="border-purple-200 text-purple-700 hover:bg-purple-50 hover:text-purple-800 gap-1"
            onClick={startAiAssist}
            disabled={!currentResp}
          >
            <Sparkles className="h-4 w-4" />
            AI 辅助编写
          </Button>
          {allResponsibilitiesBound && (
            <Button onClick={onNext} className="gap-1">
              配置岗位胜任力标准 <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {aiNotice && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 flex items-start gap-2 text-sm text-amber-800">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{aiNotice}</span>
        </div>
      )}

      {/* Top progress */}
      <Card className="border-purple-100 bg-purple-50/20">
        <CardContent className="py-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-purple-800 font-medium">已拆解工作职责 {Math.min(currentRespIndex + 1, responsibilities.length)} / {responsibilities.length}</span>
            <span className="text-purple-700">{progressPercent}%</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </CardContent>
      </Card>

      {responsibilities.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            <AlertCircle className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>暂无工作职责</p>
            <p className="text-xs mt-1 text-gray-400">请先返回步骤一添加工作职责</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">
          {/* Left: Responsibility list */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-base">工作职责列表</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {responsibilities.map((resp, idx) => {
                const isCurrent = idx === currentRespIndex
                const hasBindings = position.abilityBindings.some((b) => b.responsibilityId === resp.id)
                return (
                  <button
                    key={resp.id}
                    onClick={() => setCurrentRespIndex(idx)}
                    className={`w-full text-left p-3 rounded-xl border transition-all ${
                      isCurrent
                        ? 'border-purple-300 bg-purple-50/50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50/50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium ${isCurrent ? 'text-purple-700' : 'text-gray-500'}`}>
                        职责 {idx + 1}
                      </span>
                      {hasBindings && (
                        <CheckCircle2 className={`h-3.5 w-3.5 ${isCurrent ? 'text-purple-600' : 'text-green-600'}`} />
                      )}
                    </div>
                    <p className={`text-sm mt-1 truncate ${isCurrent ? 'text-gray-900 font-medium' : 'text-gray-700'}`}>
                      {resp.name || <span className="text-gray-400 italic">未命名职责</span>}
                    </p>
                  </button>
                )
              })}
            </CardContent>
          </Card>

          {/* Right: Ability bindings for current responsibility */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base">能力点编辑</CardTitle>
                <p className="text-xs text-gray-500 mt-0.5">
                  当前职责：{currentResp?.name || '未命名'}
                </p>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {currentBindings.length === 0 ? (
                <div className="text-center py-10 text-gray-500 border border-dashed border-gray-200 rounded-xl">
                  <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">当前职责暂无能力点</p>
                  <p className="text-xs mt-1 text-gray-400">点击下方按钮添加能力点</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {currentBindings.map((binding) => (
                    <div
                      key={binding.id}
                      className="rounded-xl border border-gray-200 bg-white p-4 space-y-4"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px]">{binding.domain || '未分类'}</Badge>
                        </div>
                        <button
                          className="p-1.5 rounded-md text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                          onClick={() => handleRemoveBinding(binding.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs text-gray-500">能力点名称</Label>
                          <Input
                            value={binding.name}
                            onChange={(e) => handleUpdateBinding(binding.id, { name: e.target.value })}
                            placeholder="例如：需求分析能力"
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-gray-500">所属能力域</Label>
                          <Select
                            value={binding.domain || ABILITY_DOMAINS[0]}
                            onValueChange={(v) => handleUpdateBinding(binding.id, { domain: v })}
                          >
                            <SelectTrigger className="h-8 text-sm">
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

                      <div className="space-y-1.5">
                        <Label className="text-xs text-gray-500">能力属性</Label>
                        <div className="flex gap-2">
                          {ABILITY_ATTRIBUTES.map((attr) => {
                            const isSelected = (binding.attributes || [])[0] === attr
                            return (
                              <button
                                key={attr}
                                type="button"
                                onClick={() => handleUpdateBinding(binding.id, { attributes: [attr] })}
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
                        <Label className="text-xs text-gray-500">掌握程度</Label>
                        <div className="relative pt-2 pb-1 max-w-md">
                          <div className="absolute top-[14px] left-0 right-0 h-1 bg-gray-100 rounded-full" />
                          <div
                            className="absolute top-[14px] left-0 h-1 bg-gray-800 rounded-full transition-all"
                            style={{
                              width: `${(COMPETENCY_LEVELS.findIndex((l) => l.value === binding.level) / (COMPETENCY_LEVELS.length - 1)) * 100}%`,
                            }}
                          />
                          <div className="relative flex justify-between">
                            {COMPETENCY_LEVELS.map((level) => {
                              const currentIdx = COMPETENCY_LEVELS.findIndex((l) => l.value === binding.level)
                              const idx = COMPETENCY_LEVELS.findIndex((l) => l.value === level.value)
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
                        <Label className="text-xs text-gray-500">胜任标准描述</Label>
                        <Textarea
                          value={binding.rubricDescription}
                          onChange={(e) => handleUpdateBinding(binding.id, { rubricDescription: e.target.value })}
                          placeholder="描述该能力点在本岗位中的具体达标表现..."
                          className="text-sm min-h-[72px] resize-none border-gray-200 focus:border-gray-400"
                          rows={3}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <Button variant="outline" className="w-full border-dashed" onClick={handleAddBinding}>
                + 添加能力点
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
