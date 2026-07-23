// @ts-nocheck
"use client"

import { useState, useMemo, useCallback, useEffect } from "react"
import { Shuffle, AlertCircle, X, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { MultiSelectSearch } from "@/components/ui/multi-select-search"
import { useData } from "@/components/providers/data-provider"
import { knowledgeApi } from "@/lib/api"
import type { Question, QuestionType, Difficulty, EvalKnowledgePoint } from "@/lib/types"
import { QUESTION_TYPE_LABELS, DIFFICULTY_LABELS } from "@/lib/types"

interface RandomQuestionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedQuestionIds: string[]
  onAddQuestions: (questions: Question[]) => void
}

const questionTypes: QuestionType[] = ['single', 'multiple', 'judge', 'fill', 'short_answer', 'essay']
const difficulties: Difficulty[] = ['easy', 'medium', 'hard']

const TYPE_COLORS: Record<QuestionType, string> = {
  single: "bg-blue-500",
  multiple: "bg-indigo-500",
  judge: "bg-amber-500",
  fill: "bg-purple-500",
  essay: "bg-rose-500",
  short_answer: "bg-teal-500",
}

// ---- weight dimension helpers ----

type WeightDimension = 'bank' | 'type' | 'difficulty' | 'knowledge'

const DIM_LABEL: Record<WeightDimension, string> = {
  bank: '按题库比例',
  type: '按题型比例',
  difficulty: '按难度比例',
  knowledge: '按知识点比例',
}

interface DimOption {
  key: WeightDimension
  label: string
  keys: string[]
  getKeyLabel: (key: string) => string
}

export function RandomQuestionDialog({
  open,
  onOpenChange,
  selectedQuestionIds,
  onAddQuestions,
}: RandomQuestionDialogProps) {
  const { questionBanks, questions } = useData()

  const publishedBanks = useMemo(() =>
    questionBanks.filter(bank => bank.status === 'published'),
    [questionBanks]
  )

  // ---- filters ----
  const [selectedBankIds, setSelectedBankIds] = useState<string[]>([])
  const [selectedTypes, setSelectedTypes] = useState<QuestionType[]>([])
  const [selectedDifficulties, setSelectedDifficulties] = useState<Difficulty[]>([])
  const [selectedKnowledgePoints, setSelectedKnowledgePoints] = useState<string[]>([])
  const [count, setCount] = useState(5)

  // ---- weight ----
  const [weightDimension, setWeightDimension] = useState<WeightDimension | ''>('')
  const [weightValues, setWeightValues] = useState<Record<string, number>>({})

  // ---- preview ----
  const [previewQuestions, setPreviewQuestions] = useState<Question[] | null>(null)

  // ---- knowledge points ----
  const [knowledgePoints, setKnowledgePoints] = useState<EvalKnowledgePoint[]>([])
  const [loadingKnowledgePoints, setLoadingKnowledgePoints] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoadingKnowledgePoints(true)
    knowledgeApi.list({ limit: 1000 })
      .then((res) => {
        if (cancelled) return
        setKnowledgePoints(res.items.map((kp) => ({ id: kp.id, name: kp.name })))
      })
      .catch((err) => {
        if (!cancelled) console.error('Failed to load knowledge points', err)
      })
      .finally(() => {
        if (!cancelled) setLoadingKnowledgePoints(false)
      })
    return () => { cancelled = true }
  }, [open])

  // ---- computed pools ----

  const basePool = useMemo(() => {
    return questions.filter(q => {
      if (selectedQuestionIds.includes(q.id)) return false
      const bank = questionBanks.find(b => b.id === q.bankId)
      return bank?.status === 'published'
    })
  }, [questions, questionBanks, selectedQuestionIds])

  const filteredPool = useMemo(() => {
    let pool = [...basePool]
    if (selectedBankIds.length > 0) pool = pool.filter(q => selectedBankIds.includes(q.bankId))
    if (selectedTypes.length > 0) pool = pool.filter(q => selectedTypes.includes(q.type))
    if (selectedDifficulties.length > 0) pool = pool.filter(q => q.difficulty && selectedDifficulties.includes(q.difficulty))
    if (selectedKnowledgePoints.length > 0) pool = pool.filter(q => q.knowledgePoints?.some(kp => selectedKnowledgePoints.includes(kp)))
    return pool
  }, [basePool, selectedBankIds, selectedTypes, selectedDifficulties, selectedKnowledgePoints])

  // ---- weight dimension keys ----
  const weightKeys = useMemo(() => {
    if (!weightDimension) return []
    switch (weightDimension) {
      case 'bank': return selectedBankIds.length > 0 ? selectedBankIds : publishedBanks.map(b => b.id)
      case 'type': return questionTypes
      case 'difficulty': return difficulties
      case 'knowledge': return selectedKnowledgePoints.length > 0 ? selectedKnowledgePoints : knowledgePoints.map(k => k.id)
    }
  }, [weightDimension, selectedBankIds, selectedTypes, selectedDifficulties, selectedKnowledgePoints, publishedBanks, knowledgePoints])

  // 可用的权重维度（排除仅 1 个选项的维度）
  const availableDimensions = useMemo((): WeightDimension[] => {
    const dims: WeightDimension[] = []
    const bankKeys = selectedBankIds.length > 0 ? selectedBankIds : publishedBanks.map(b => b.id)
    if (bankKeys.length >= 2) dims.push('bank')
    const typeKeys = selectedTypes.length > 0 ? selectedTypes : questionTypes
    if (typeKeys.length >= 2) dims.push('type')
    const diffKeys = selectedDifficulties.length > 0 ? selectedDifficulties : difficulties
    if (diffKeys.length >= 2) dims.push('difficulty')
    const kpKeys = selectedKnowledgePoints.length > 0 ? selectedKnowledgePoints : knowledgePoints.map(k => k.id)
    if (kpKeys.length >= 2) dims.push('knowledge')
    return dims
  }, [publishedBanks, selectedBankIds, selectedTypes, selectedDifficulties, selectedKnowledgePoints, knowledgePoints])

  // ---- largest-remainder proportional allocation ----
  const allocateProportions = useCallback((
    total: number,
    entries: string[],
    weights: Record<string, number>
  ): Record<string, number> => {
    const active = entries.filter(k => (weights[k] ?? 0) > 0)
    const items = active.length > 0 ? active : entries
    const rawSum = items.reduce((s, k) => s + (weights[k] || 0), 0)
    const fracs = items.map(k => ({
      key: k,
      frac: rawSum > 0 ? total * (weights[k] || 0) / rawSum : total / items.length,
    }))
    // floor first, track remainders
    const result: Record<string, number> = {}
    let allocated = 0
    const remainders: { key: string; rem: number }[] = []
    fracs.forEach(({ key, frac }) => {
      const floor = Math.floor(frac)
      result[key] = floor
      allocated += floor
      remainders.push({ key, rem: frac - floor })
    })
    // distribute leftover by largest remainder
    remainders.sort((a, b) => b.rem - a.rem)
    for (let i = 0; i < total - allocated; i++) {
      if (i < remainders.length) result[remainders[i].key]++
    }
    return result
  }, [])

  // ---- random selection ----
  const doRandomSelect = useCallback(() => {
    let allSelected: Question[] = []

    if (weightDimension && weightKeys.length > 0) {
      const allocation = allocateProportions(count, weightKeys, weightValues)
      const used = new Set<string>()

      Object.entries(allocation).forEach(([key, target]) => {
        if (target <= 0) return
        const candidates = filteredPool.filter(q => {
          if (used.has(q.id)) return false
          if (weightDimension === 'bank') return q.bankId === key
          if (weightDimension === 'type') return q.type === key
          if (weightDimension === 'difficulty') return q.difficulty === key
          return q.knowledgePoints?.includes(key)
        })
        const take = Math.min(target, candidates.length)
        for (let i = 0; i < take; i++) {
          const idx = Math.floor(Math.random() * candidates.length)
          const q = candidates.splice(idx, 1)[0]
          allSelected.push(q)
          used.add(q.id)
        }
      })

      // fill remaining
      if (allSelected.length < count) {
        const remaining = filteredPool.filter(q => !used.has(q.id))
        const need = count - allSelected.length
        for (let i = 0; i < Math.min(need, remaining.length); i++) {
          const idx = Math.floor(Math.random() * remaining.length)
          const q = remaining.splice(idx, 1)[0]
          allSelected.push(q)
          used.add(q.id)
        }
      }
    } else {
      const shuffled = [...filteredPool]
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
      }
      allSelected = shuffled.slice(0, Math.min(count, shuffled.length))
    }

    // Fisher-Yates shuffle
    for (let i = allSelected.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allSelected[i], allSelected[j]] = [allSelected[j], allSelected[i]]
    }
    setPreviewQuestions(allSelected)
  }, [filteredPool, weightDimension, weightKeys, weightValues, count, allocateProportions])

  // ---- actions ----
  const handleClose = () => {
    setSelectedBankIds([])
    setSelectedTypes([])
    setSelectedDifficulties([])
    setSelectedKnowledgePoints([])
    setCount(5)
    setWeightDimension('')
    setWeightValues({})
    setPreviewQuestions(null)
    onOpenChange(false)
  }

  const handleConfirm = () => {
    if (previewQuestions && previewQuestions.length > 0) {
      onAddQuestions(previewQuestions)
    }
    handleClose()
  }

  const toggleType = (type: QuestionType) => {
    setSelectedTypes(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type])
  }

  const toggleDifficulty = (difficulty: Difficulty) => {
    setSelectedDifficulties(prev => prev.includes(difficulty) ? prev.filter(d => d !== difficulty) : [...prev, difficulty])
  }

  const toggleWeightDim = (dim: WeightDimension) => {
    if (weightDimension === dim) {
      setWeightDimension('')
      setWeightValues({})
    } else {
      setWeightDimension(dim)
      setWeightValues({})
    }
  }

  const removeFromPreview = (qid: string) => {
    setPreviewQuestions(prev => prev ? prev.filter(q => q.id !== qid) : null)
  }

  const countSliderMax = Math.max(1, Math.min(50, filteredPool.length))

  // ---- render helpers ----
  const renderWeightSliderRow = (key: string, label: string) => {
    const raw = weightValues[key] ?? 0
    return (
      <div key={key} className="flex items-center gap-3">
        <span className="text-xs w-20 truncate shrink-0">{label}</span>
        <Slider
          value={[raw]}
          min={0}
          max={100}
          step={1}
          onValueChange={([v]) => setWeightValues(prev => ({ ...prev, [key]: v }))}
          className="flex-1"
        />
        <Input
          type="number"
          min={0}
          max={100}
          value={raw || ''}
          placeholder="0"
          onChange={(e) => setWeightValues(prev => ({ ...prev, [key]: Math.max(0, Math.min(100, parseInt(e.target.value) || 0)) }))}
          className="h-7 w-14 text-xs"
        />
      </div>
    )
  }

  const weightKeyLabel = (key: string): string => {
    if (weightDimension === 'bank') return publishedBanks.find(b => b.id === key)?.name || key
    if (weightDimension === 'type') return QUESTION_TYPE_LABELS[key as QuestionType]
    if (weightDimension === 'difficulty') return DIFFICULTY_LABELS[key as Difficulty]
    return knowledgePoints.find(k => k.id === key)?.name || key
  }

  // ---- render ----

  if (previewQuestions) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent size="lg" annotationContext="random-question">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shuffle className="size-5" />
              抽题预览
            </DialogTitle>
            <DialogDescription>
              已抽取 {previewQuestions.length} 道题目，可移除不需要的题目后确认加入
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[55vh] overflow-y-auto space-y-2">
            {previewQuestions.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                未抽到符合条件的题目，请调整筛选条件后重试
              </div>
            ) : (
              previewQuestions.map((q, i) => {
                const bankName = questionBanks.find(b => b.id === q.bankId)?.name
                const kpNames = (q.knowledgePoints || [])
                  .map(id => knowledgePoints.find(k => k.id === id)?.name)
                  .filter(Boolean) as string[]
                return (
                <div key={q.id} className="flex items-center gap-3 rounded-lg border p-3">
                  <span className="text-xs text-muted-foreground w-5 shrink-0">{i + 1}.</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm line-clamp-1">{q.content}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge className={`text-xs text-white ${TYPE_COLORS[q.type]}`}>{QUESTION_TYPE_LABELS[q.type]}</Badge>
                      {q.difficulty && <Badge variant="outline" className="text-xs">{DIFFICULTY_LABELS[q.difficulty]}</Badge>}
                      {bankName && <span className="text-xs text-muted-foreground">{bankName}</span>}
                      {kpNames.length > 0 && <span className="text-xs text-muted-foreground truncate max-w-[200px]">{kpNames.join('、')}</span>}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="size-7 shrink-0" onClick={() => removeFromPreview(q.id)}>
                    <X className="size-4" />
                  </Button>
                </div>
              )})
            )}
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <div className="flex-1" />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setPreviewQuestions(null)}>
                <RefreshCw className="mr-2 size-4" />
                重新抽题
              </Button>
              <Button onClick={handleConfirm} disabled={previewQuestions.length === 0}>
                确认加入试卷
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  const filterSummary = [
    selectedBankIds.length > 0 && `题库 ${selectedBankIds.length} 个`,
    selectedTypes.length > 0 && `题型 ${selectedTypes.length} 种`,
    selectedDifficulties.length > 0 && `难度 ${selectedDifficulties.length} 级`,
    selectedKnowledgePoints.length > 0 && `知识点 ${selectedKnowledgePoints.length} 个`,
  ].filter(Boolean).join('，')

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent size="lg" annotationContext="random-question">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shuffle className="size-5" />
            随机抽题
          </DialogTitle>
          <DialogDescription>
            从已发布题库中随机抽取题目，可配置筛选条件与比例分配
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 max-h-[58vh] overflow-y-auto pr-1">
          {/* 题库 */}
          <div>
            <Label className="text-sm font-medium mb-2 block">选择题库</Label>
            {publishedBanks.length === 0 ? (
              <p className="text-sm text-muted-foreground">暂无已发布的题库</p>
            ) : (
              <MultiSelectSearch
                options={publishedBanks.map(b => ({ label: b.name, value: b.id, subtitle: `${b.questionCount}题` }))}
                selected={selectedBankIds}
                onChange={(ids) => { setSelectedBankIds(ids); setWeightDimension(''); setWeightValues({}) }}
                placeholder="不选则从全部题库抽取"
                searchPlaceholder="搜索题库名称..."
              />
            )}
          </div>

          {/* 题型 */}
          <div>
            <Label className="text-sm font-medium mb-2 block">题目类型</Label>
            <div className="flex flex-wrap gap-1.5">
              {questionTypes.map(type => (
                <Badge
                  key={type}
                  variant={selectedTypes.includes(type) ? "default" : "outline"}
                  className="cursor-pointer select-none"
                  onClick={() => { toggleType(type); setWeightDimension(''); setWeightValues({}) }}
                >
                  {QUESTION_TYPE_LABELS[type]}
                </Badge>
              ))}
            </div>
          </div>

          {/* 难度 */}
          <div>
            <Label className="text-sm font-medium mb-2 block">难度等级</Label>
            <div className="flex flex-wrap gap-1.5">
              {difficulties.map(d => (
                <Badge
                  key={d}
                  variant={selectedDifficulties.includes(d) ? "default" : "outline"}
                  className="cursor-pointer select-none"
                  onClick={() => { toggleDifficulty(d); setWeightDimension(''); setWeightValues({}) }}
                >
                  {DIFFICULTY_LABELS[d]}
                </Badge>
              ))}
            </div>
          </div>

          {/* 知识点 (always expanded) */}
          <div>
            <Label className="text-sm font-medium mb-2 block">知识点</Label>
            {loadingKnowledgePoints ? (
              <p className="text-sm text-muted-foreground py-1">加载中...</p>
            ) : (
              <MultiSelectSearch
                options={knowledgePoints.map(kp => ({ label: kp.name, value: kp.id }))}
                selected={selectedKnowledgePoints}
                onChange={(ids) => { setSelectedKnowledgePoints(ids); setWeightDimension(''); setWeightValues({}) }}
                placeholder="不选则包含全部知识点"
                searchPlaceholder="搜索知识点..."
              />
            )}
          </div>

          {/* 按比例分配 */}
          {availableDimensions.length > 0 && (
            <div>
              <Label className="text-sm font-medium mb-2 block">按比例分配</Label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {availableDimensions.map(dim => (
                  <Badge
                    key={dim}
                    variant={weightDimension === dim ? "default" : "outline"}
                    className="cursor-pointer select-none"
                    onClick={() => toggleWeightDim(dim)}
                  >
                    {DIM_LABEL[dim]}
                  </Badge>
                ))}
              </div>
              {weightDimension && weightKeys.length > 0 && (
                <div className="rounded-lg border bg-muted/30 p-3 space-y-2 max-h-48 overflow-y-auto">
                  {weightKeys.map(key => renderWeightSliderRow(key, weightKeyLabel(key)))}
                  <p className="text-xs text-muted-foreground pt-1">输入的数字按比例折算，无需凑满 100</p>
                </div>
              )}
            </div>
          )}

          {/* 抽取数量 */}
          <div className="rounded-lg border p-4">
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm font-medium">抽取数量</Label>
              <Input
                type="number"
                min={1}
                max={countSliderMax}
                value={count}
                onChange={(e) => setCount(Math.max(1, Math.min(countSliderMax, parseInt(e.target.value) || 1)))}
                className="h-7 w-16 text-xs text-center"
              />
            </div>
            <Slider
              value={[count]}
              min={1}
              max={countSliderMax}
              step={1}
              onValueChange={([v]) => setCount(v)}
            />
            <p className="text-xs text-muted-foreground mt-2">
              {filterSummary ? `筛选条件：${filterSummary}` : '未设置筛选，从全部题目中抽取'}
              ｜可用题目池：{filteredPool.length} 道
              {count > filteredPool.length && (
                <span className="text-amber-600 ml-1">（超过可用数量，将全部抽取）</span>
              )}
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <div className="flex-1 text-sm text-muted-foreground">
            {filteredPool.length === 0 ? (
              <span className="text-destructive flex items-center gap-1">
                <AlertCircle className="size-4" />当前条件下没有可用题目
              </span>
            ) : (
              <span>实际抽取 {Math.min(count, filteredPool.length)} 道题目</span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose}>取消</Button>
            <Button onClick={doRandomSelect} disabled={filteredPool.length === 0}>
              <Shuffle className="mr-2 size-4" />
              随机抽题
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
