// @ts-nocheck
"use client"

import { useState, useMemo, useCallback, useEffect } from "react"
import { Shuffle, AlertCircle, ChevronDown, ChevronRight, X, RefreshCw } from "lucide-react"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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

type WeightDimension = 'bank' | 'type' | 'difficulty' | 'knowledge'

const DIMENSION_LABELS: Record<WeightDimension, string> = {
  bank: '按题库比例',
  type: '按题型比例',
  difficulty: '按难度比例',
  knowledge: '按知识点比例',
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

  // ---- collapse panels ----
  const [knowledgeOpen, setKnowledgeOpen] = useState(false)
  const [weightOpen, setWeightOpen] = useState(false)

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

  // ---- weight keys ----
  const weightKeys = useMemo(() => {
    if (!weightDimension) return []
    switch (weightDimension) {
      case 'bank': return selectedBankIds.length > 0 ? selectedBankIds : publishedBanks.map(b => b.id)
      case 'type': return questionTypes
      case 'difficulty': return difficulties
      case 'knowledge': return selectedKnowledgePoints.length > 0 ? selectedKnowledgePoints : knowledgePoints.map(k => k.id)
    }
  }, [weightDimension, selectedBankIds, selectedTypes, selectedDifficulties, selectedKnowledgePoints, publishedBanks, knowledgePoints])

  // ---- random selection ----
  const doRandomSelect = useCallback(() => {
    let pool = [...filteredPool]

    if (weightDimension && weightKeys.length > 0) {
      const active = weightKeys.filter(k => (weightValues[k] ?? 0) > 0)
      const entries = active.length > 0 ? active : weightKeys
      const rawSum = entries.reduce((s, k) => s + (weightValues[k] || 0), 0)
      const normWeights: Record<string, number> = {}
      if (rawSum > 0) {
        entries.forEach(k => { normWeights[k] = (weightValues[k] || 0) / rawSum })
      } else {
        const eq = 1 / entries.length
        entries.forEach(k => { normWeights[k] = eq })
      }

      const used = new Set<string>()
      const selected: Question[] = []

      entries.forEach(key => {
        const target = Math.round(count * normWeights[key])
        const candidates = pool.filter(q => {
          if (used.has(q.id)) return false
          if (weightDimension === 'bank') return q.bankId === key
          if (weightDimension === 'type') return q.type === key
          if (weightDimension === 'difficulty') return q.difficulty === key
          if (weightDimension === 'knowledge') return q.knowledgePoints?.includes(key)
          return false
        })
        const take = Math.min(target, candidates.length)
        for (let i = 0; i < take; i++) {
          const idx = Math.floor(Math.random() * candidates.length)
          const q = candidates.splice(idx, 1)[0]
          selected.push(q)
          used.add(q.id)
        }
      })

      if (selected.length < count) {
        const remaining = pool.filter(q => !used.has(q.id))
        const need = count - selected.length
        for (let i = 0; i < Math.min(need, remaining.length); i++) {
          const idx = Math.floor(Math.random() * remaining.length)
          const q = remaining.splice(idx, 1)[0]
          selected.push(q)
          used.add(q.id)
        }
      }

      for (let i = selected.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [selected[i], selected[j]] = [selected[j], selected[i]]
      }
      setPreviewQuestions(selected)
    } else {
      const shuffled = [...pool]
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
      }
      setPreviewQuestions(shuffled.slice(0, Math.min(count, shuffled.length)))
    }
  }, [filteredPool, weightDimension, weightKeys, weightValues, count])

  // ---- actions ----
  const handleClose = () => {
    setSelectedBankIds([])
    setSelectedTypes([])
    setSelectedDifficulties([])
    setSelectedKnowledgePoints([])
    setCount(5)
    setWeightDimension('')
    setWeightValues({})
    setWeightOpen(false)
    setKnowledgeOpen(false)
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

  const removeFromPreview = (qid: string) => {
    setPreviewQuestions(prev => prev ? prev.filter(q => q.id !== qid) : null)
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
              previewQuestions.map((q, i) => (
                <div key={q.id} className="flex items-center gap-3 rounded-lg border p-3">
                  <span className="text-xs text-muted-foreground w-5 shrink-0">{i + 1}.</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm line-clamp-1">{q.content}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="text-xs">{QUESTION_TYPE_LABELS[q.type]}</Badge>
                      {q.difficulty && <Badge variant="outline" className="text-xs">{DIFFICULTY_LABELS[q.difficulty]}</Badge>}
                      <span className="text-xs text-muted-foreground">{q.score}分</span>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="size-7 shrink-0" onClick={() => removeFromPreview(q.id)}>
                    <X className="size-4" />
                  </Button>
                </div>
              ))
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
            从已发布题库中随机抽取题目，可选配置筛选条件与比例分配
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
                onChange={setSelectedBankIds}
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
                  onClick={() => toggleType(type)}
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
                  onClick={() => toggleDifficulty(d)}
                >
                  {DIFFICULTY_LABELS[d]}
                </Badge>
              ))}
            </div>
          </div>

          {/* 知识点 (collapsible) */}
          <div className="border rounded-lg">
            <button
              type="button"
              className="flex items-center justify-between w-full px-3 py-2 text-sm font-medium hover:bg-muted/50 rounded-lg transition-colors"
              onClick={() => setKnowledgeOpen(!knowledgeOpen)}
            >
              <span>知识点筛选 {selectedKnowledgePoints.length > 0 && <span className="text-primary">({selectedKnowledgePoints.length})</span>}</span>
              {knowledgeOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
            </button>
            {knowledgeOpen && (
              <div className="px-3 pb-3">
                {loadingKnowledgePoints ? (
                  <p className="text-sm text-muted-foreground py-2">加载中...</p>
                ) : (
                  <MultiSelectSearch
                    options={knowledgePoints.map(kp => ({ label: kp.name, value: kp.id }))}
                    selected={selectedKnowledgePoints}
                    onChange={setSelectedKnowledgePoints}
                    placeholder="不选则包含全部知识点"
                    searchPlaceholder="搜索知识点..."
                  />
                )}
              </div>
            )}
          </div>

          {/* 按比例分配 (collapsible) */}
          <div className="border rounded-lg">
            <button
              type="button"
              className="flex items-center justify-between w-full px-3 py-2 text-sm font-medium hover:bg-muted/50 rounded-lg transition-colors"
              onClick={() => setWeightOpen(!weightOpen)}
            >
              <span>按比例分配 {weightDimension ? <span className="text-primary">({DIMENSION_LABELS[weightDimension]})</span> : null}</span>
              {weightOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
            </button>
            {weightOpen && (
              <div className="px-3 pb-3 space-y-3">
                <Select value={weightDimension || ''} onValueChange={(v) => { setWeightDimension(v as WeightDimension || ''); setWeightValues({}) }}>
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="选择分配维度" />
                  </SelectTrigger>
                  <SelectContent>
                    {(['bank', 'type', 'difficulty', 'knowledge'] as WeightDimension[]).map(d => (
                      <SelectItem key={d} value={d}>{DIMENSION_LABELS[d]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {weightDimension && weightKeys.length > 0 && (
                  <div className="space-y-2">
                    {weightKeys.map(key => {
                      const raw = weightValues[key] ?? 0
                      const label = weightDimension === 'bank'
                        ? publishedBanks.find(b => b.id === key)?.name || key
                        : weightDimension === 'type' ? QUESTION_TYPE_LABELS[key as QuestionType]
                        : weightDimension === 'difficulty' ? DIFFICULTY_LABELS[key as Difficulty]
                        : knowledgePoints.find(k => k.id === key)?.name || key
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
                    })}
                    <p className="text-xs text-muted-foreground">输入的数字按比例折算，无需凑满 100</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 抽取数量 */}
          <div className="rounded-lg border p-4">
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm font-medium">抽取数量</Label>
              <Input
                type="number"
                min={1}
                max={Math.min(50, filteredPool.length || 50)}
                value={count}
                onChange={(e) => setCount(Math.max(1, Math.min(Math.min(50, filteredPool.length || 50), parseInt(e.target.value) || 1)))}
                className="h-7 w-16 text-xs text-center"
              />
            </div>
            <Slider
              value={[count]}
              min={1}
              max={Math.max(1, Math.min(50, filteredPool.length))}
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
