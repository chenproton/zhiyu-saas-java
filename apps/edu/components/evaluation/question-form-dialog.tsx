// @ts-nocheck
"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import {
  Plus, X, ArrowUp, ArrowDown, Check, ChevronDown, Settings2,
  CircleDot, SquareCheck, Scale, Braces, FileText, AlignLeft,
  Sparkles, Lightbulb, Save, RotateCcw, PenLine
} from "lucide-react"
import type { Question, QuestionType, QuestionFormData, Difficulty, EvalKnowledgePoint } from "@/lib/types"
import { QUESTION_TYPE_LABELS, DIFFICULTY_LABELS } from "@/lib/types"
import { knowledgeApi } from "@/lib/api"

interface QuestionFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  question?: Question | null
  defaultType?: QuestionType
  onSubmit: (data: QuestionFormData) => void
}

const MAX_OPTIONS = 8
const MIN_OPTIONS = 2

const TYPE_ICONS: Record<QuestionType, React.ReactNode> = {
  single: <CircleDot className="size-3.5" />,
  multiple: <SquareCheck className="size-3.5" />,
  judge: <Scale className="size-3.5" />,
  fill: <Braces className="size-3.5" />,
  essay: <FileText className="size-3.5" />,
  short_answer: <AlignLeft className="size-3.5" />,
}

const TYPE_COLORS: Record<QuestionType, string> = {
  single: "bg-blue-500",
  multiple: "bg-indigo-500",
  judge: "bg-amber-500",
  fill: "bg-purple-500",
  essay: "bg-rose-500",
  short_answer: "bg-teal-500",
}

export function QuestionFormDialog({
  open,
  onOpenChange,
  question,
  defaultType,
  onSubmit,
}: QuestionFormDialogProps) {
  const contentRef = useRef<HTMLTextAreaElement>(null)
  const [type, setType] = useState<QuestionType>("single")
  const [content, setContent] = useState("")
  const [options, setOptions] = useState<string[]>(["", "", "", ""])
  const [answer, setAnswer] = useState<string | string[]>("")
  const [analysis, setAnalysis] = useState("")
  const [difficulty, setDifficulty] = useState<Difficulty>("medium")
  const [knowledgePointIds, setKnowledgePointIds] = useState<string[]>([])
  const [knowledgePoints, setKnowledgePoints] = useState<EvalKnowledgePoint[]>([])
  const [loadingKnowledgePoints, setLoadingKnowledgePoints] = useState(false)
  const [knowledgeOpen, setKnowledgeOpen] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const knowledgeRef = useRef<HTMLDivElement>(null)

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
        if (!cancelled) {
          console.error('Failed to load knowledge points', err)
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingKnowledgePoints(false)
      })
    return () => { cancelled = true }
  }, [open])

  useEffect(() => {
    if (question) {
      setType(question.type)
      setContent(question.content)
      setOptions(question.options || ["", "", "", ""])
      setAnswer(question.answer)
      setAnalysis(question.analysis || "")
      setDifficulty(question.difficulty || "medium")
      setKnowledgePointIds(question.knowledgePoints || [])
    } else {
      setType(defaultType || "single")
      setContent("")
      setOptions(["", "", "", ""])
      setAnswer(defaultType === "multiple" ? [] : "")
      setAnalysis("")
      setDifficulty("medium")
      setKnowledgePointIds([])
    }
    setKnowledgeOpen(false)
    setAdvancedOpen(false)
  }, [question, open, defaultType])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (knowledgeRef.current && !knowledgeRef.current.contains(e.target as Node)) {
        setKnowledgeOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const blankCount = useMemo(() => {
    const matches = content.match(/\{(\d+)\}/g)
    if (!matches) return 0
    const nums = matches.map(m => parseInt(m.replace(/[{}]/g, ""), 10))
    return Math.max(0, ...nums)
  }, [content])

  const normalizedFillAnswer = useMemo(() => {
    if (type !== "fill") return []
    return Array.isArray(answer) ? answer : (answer ? [answer as string] : [])
  }, [answer, type])

  useEffect(() => {
    if (type !== "fill") return
    const current = Array.isArray(answer) ? [...answer] : (answer ? [answer as string] : [])
    if (current.length < blankCount) {
      while (current.length < blankCount) current.push("")
      setAnswer(current)
    } else if (current.length > blankCount) {
      setAnswer(current.slice(0, blankCount))
    }
  }, [blankCount, type, answer])

  const buildFormData = useCallback((): QuestionFormData => {
    const data: QuestionFormData = {
      type,
      content: content.trim(),
      analysis: analysis.trim() || undefined,
      score: 0,
      answer: Array.isArray(answer) ? answer : [answer],
      difficulty,
      knowledgePoints: knowledgePointIds.length > 0 ? knowledgePointIds : undefined,
    }

    if (type === "single" || type === "multiple") {
      data.options = options.filter(o => o.trim())
    }

    return data
  }, [type, content, analysis, answer, difficulty, knowledgePointIds, options])

  const resetForNext = useCallback(() => {
    setContent("")
    setOptions(["", "", "", ""])
    setAnswer(type === "multiple" ? [] : "")
    setAnalysis("")
  }, [type])

  const handleSubmit = useCallback(() => {
    if (!content.trim()) return
    onSubmit(buildFormData())
    onOpenChange(false)
  }, [content, buildFormData, onSubmit, onOpenChange])

  const handleSubmitAndContinue = useCallback(() => {
    if (!content.trim()) return
    onSubmit(buildFormData())
    resetForNext()
  }, [content, buildFormData, onSubmit, resetForNext])

  // Ctrl+Enter 保存并新建
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "Enter" && open && !question) {
        e.preventDefault()
        handleSubmitAndContinue()
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [open, question, handleSubmitAndContinue])

  const handleTypeChange = useCallback((newType: QuestionType) => {
    setType(newType)
    setOptions(["", "", "", ""])
    setAnswer(newType === "multiple" ? [] : "")
  }, [])

  const handleOptionChange = useCallback((index: number, value: string) => {
    setOptions(prev => {
      const next = [...prev]
      next[index] = value
      return next
    })
  }, [])

  const addOption = useCallback(() => {
    setOptions(prev => prev.length >= MAX_OPTIONS ? prev : [...prev, ""])
  }, [])

  const removeOption = useCallback((index: number) => {
    setOptions(prev => {
      if (prev.length <= MIN_OPTIONS) return prev
      const removedText = prev[index]
      const next = prev.filter((_, i) => i !== index)

      if (type === "single" && answer === removedText) {
        setAnswer("")
      } else if (type === "multiple" && Array.isArray(answer)) {
        const currentAnswers = answer as string[]
        const removeIdx = currentAnswers.indexOf(removedText)
        if (removeIdx >= 0) {
          setAnswer([...currentAnswers.slice(0, removeIdx), ...currentAnswers.slice(removeIdx + 1)])
        }
      }
      return next
    })
  }, [type, answer])

  const moveOption = useCallback((index: number, dir: number) => {
    const newIndex = index + dir
    if (newIndex < 0 || newIndex >= options.length) return
    const newOptions = [...options]
    const temp = newOptions[index]
    newOptions[index] = newOptions[newIndex]
    newOptions[newIndex] = temp
    setOptions(newOptions)
  }, [options])

  const toggleSingleAnswer = useCallback((index: number) => {
    setAnswer(options[index])
  }, [options])

  const toggleMultipleAnswer = useCallback((index: number, checked: boolean) => {
    const optionText = options[index]
    setAnswer(prev => {
      const currentAnswers = Array.isArray(prev) ? prev : []
      if (checked) {
        return [...currentAnswers, optionText]
      } else {
        const removeIdx = currentAnswers.indexOf(optionText)
        if (removeIdx >= 0) {
          return [...currentAnswers.slice(0, removeIdx), ...currentAnswers.slice(removeIdx + 1)]
        }
        return currentAnswers
      }
    })
  }, [options])

  const isMultipleAnswerChecked = useCallback((index: number) => {
    return Array.isArray(answer) && answer.includes(options[index])
  }, [answer, options])

  const insertBlankMarker = useCallback(() => {
    const textarea = contentRef.current
    if (!textarea) return
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const marker = `{${blankCount + 1}}`
    const newContent = content.substring(0, start) + marker + content.substring(end)
    setContent(newContent)
    setTimeout(() => {
      textarea.focus()
      const pos = start + marker.length
      textarea.setSelectionRange(pos, pos)
    }, 0)
  }, [blankCount, content])

  const updateBlankAnswer = useCallback((idx: number, value: string) => {
    setAnswer(prev => {
      const current = Array.isArray(prev) ? [...prev] : []
      current[idx] = value
      return current
    })
  }, [])

  const addKnowledgePoint = useCallback((kpId: string) => {
    setKnowledgePointIds(prev => prev.includes(kpId) ? prev : [...prev, kpId])
  }, [])

  const removeKnowledgePoint = useCallback((kpId: string) => {
    setKnowledgePointIds(prev => prev.filter(id => id !== kpId))
  }, [])

  const getKnowledgePointName = useCallback((id: string) => {
    return knowledgePoints.find(kp => kp.id === id)?.name || id
  }, [knowledgePoints])

  const CardTitle = ({ children, icon: Icon, color = "bg-primary" }: { children: React.ReactNode; icon?: React.ElementType; color?: string }) => (
    <div className="mb-3 flex items-center gap-2">
      {Icon && (
        <div className={`flex size-6 items-center justify-center rounded-md ${color} text-white shadow-sm`}>
          <Icon className="size-3.5" />
        </div>
      )}
      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{children}</span>
      <div className={`ml-auto h-3 w-1 rounded-full ${color} opacity-60`} />
    </div>
  )

  const renderOptionEditor = (isMultiple: boolean) => {
    const isSingle = !isMultiple
    return (
      <div className="flex flex-col gap-3">
        <CardTitle icon={isMultiple ? SquareCheck : CircleDot} color={isMultiple ? "bg-indigo-500" : "bg-blue-500"}>选项设置</CardTitle>
        <div className="flex flex-col gap-2.5">
          {options.map((option, index) => {
            const checked = isMultiple ? isMultipleAnswerChecked(index) : (answer === option && option.trim() !== "")
            return (
              <div
                key={index}
                className={`group flex items-center gap-3 rounded-xl border bg-white p-2.5 shadow-sm transition-all hover:border-primary/30 hover:shadow-md ${
                  checked ? "border-l-4 border-l-primary bg-primary/[0.03]" : "border-border/60"
                }`}
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted/60 font-mono text-xs font-bold text-muted-foreground">
                  {String.fromCharCode(65 + index)}
                </div>
                {isMultiple ? (
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(c) => toggleMultipleAnswer(index, !!c)}
                    className="size-5 shrink-0"
                  />
                ) : (
                  <input
                    type="radio"
                    name="correct-single"
                    checked={checked}
                    onChange={() => toggleSingleAnswer(index)}
                    className="size-5 shrink-0 accent-primary"
                  />
                )}
                <Input
                  value={option}
                  onChange={(e) => handleOptionChange(index, e.target.value)}
                  placeholder={`选项 ${String.fromCharCode(65 + index)}`}
                  className="h-9 flex-1 border-transparent bg-transparent px-2 shadow-none focus-visible:bg-background focus-visible:ring-1"
                />
                <div className="flex shrink-0 opacity-0 transition-opacity group-hover:opacity-100">
                  <Button type="button" variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-foreground" onClick={() => moveOption(index, -1)} disabled={index === 0}>
                    <ArrowUp className="size-3.5" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-foreground" onClick={() => moveOption(index, 1)} disabled={index === options.length - 1}>
                    <ArrowDown className="size-3.5" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-destructive" onClick={() => removeOption(index)} disabled={options.length <= MIN_OPTIONS}>
                    <X className="size-3.5" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
        {options.length < MAX_OPTIONS && (
          <Button type="button" variant="outline" size="sm" onClick={addOption} className="w-fit gap-1 rounded-lg border-dashed">
            <Plus className="size-3.5" />
            添加选项
          </Button>
        )}
      </div>
    )
  }

  const renderContentPreview = () => {
    if (type !== "fill" || !content.trim()) return null
    const parts = content.split(/(\{\d+\})/g)
    return (
      <div className="mt-2 rounded-lg border border-dashed border-primary/30 bg-primary/5 p-2.5 text-sm leading-relaxed text-foreground">
        {parts.map((part, i) => {
          const match = part.match(/^\{(\d+)\}$/)
          if (match) {
            return (
              <Badge key={i} variant="default" className="mx-0.5 bg-primary text-primary-foreground hover:bg-primary">
                空{match[1]}
              </Badge>
            )
          }
          return <span key={i}>{part}</span>
        })}
      </div>
    )
  }

  const renderLeftPane = () => {
    return (
      <div className="flex flex-1 flex-col gap-5">
        {/* 题干 */}
        <div className="rounded-xl border border-border/60 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
          <CardTitle icon={PenLine}>题干</CardTitle>
          <Textarea
            ref={contentRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="请输入题目内容..."
            className="min-h-[100px] resize-none rounded-lg border-border/60 bg-muted/20 text-[15px] leading-relaxed transition-all placeholder:text-muted-foreground/60 focus:border-primary focus:bg-background focus:ring-2 focus:ring-primary/15"
            required
          />
          {renderContentPreview()}
          <div className="mt-3 flex gap-2">
            {type === "fill" && (
              <Button type="button" variant="outline" size="sm" onClick={insertBlankMarker} className="gap-1 rounded-lg border-primary/30 text-primary hover:bg-primary/5">
                <Plus className="size-3.5" />
                插入填空标记
              </Button>
            )}
            <Button type="button" variant="ghost" size="sm" onClick={() => setContent("")} className="gap-1 text-muted-foreground hover:text-foreground">
              <RotateCcw className="size-3.5" />
              清空
            </Button>
          </div>
        </div>

        {/* 题型专属编辑区 */}
        <div className="flex flex-1 flex-col rounded-xl border border-border/60 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
          {type === "single" && renderOptionEditor(false)}
          {type === "multiple" && renderOptionEditor(true)}
          {type === "judge" && (
            <div className="flex flex-1 flex-col gap-4">
              <CardTitle icon={Scale} color="bg-amber-500">正确答案</CardTitle>
              <div className="flex flex-1 gap-4">
                <button
                  type="button"
                  onClick={() => setAnswer("true")}
                  className={`flex flex-1 flex-col items-center justify-center gap-2 rounded-2xl border-2 text-lg font-bold transition-all ${
                    answer === "true"
                      ? "border-green-500 bg-gradient-to-br from-green-50 to-green-100 text-green-700 shadow-md"
                      : "border-border bg-muted/30 text-muted-foreground hover:border-green-300 hover:bg-green-50/50"
                  }`}
                >
                  <Check className="size-8" />
                  正确
                </button>
                <button
                  type="button"
                  onClick={() => setAnswer("false")}
                  className={`flex flex-1 flex-col items-center justify-center gap-2 rounded-2xl border-2 text-lg font-bold transition-all ${
                    answer === "false"
                      ? "border-red-500 bg-gradient-to-br from-red-50 to-red-100 text-red-700 shadow-md"
                      : "border-border bg-muted/30 text-muted-foreground hover:border-red-300 hover:bg-red-50/50"
                  }`}
                >
                  <X className="size-8" />
                  错误
                </button>
              </div>
            </div>
          )}
          {type === "fill" && (
            <div className="flex flex-col gap-4">
              <CardTitle icon={Braces} color="bg-purple-500">空位答案</CardTitle>
              {blankCount === 0 ? (
                <div className="flex items-center gap-2 rounded-xl border border-dashed border-border bg-muted/20 p-6 text-sm text-muted-foreground">
                  <Lightbulb className="size-4 text-amber-500" />
                  在题干中点击「插入填空标记」来创建空位
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {Array.from({ length: blankCount }).map((_, idx) => (
                    <div key={idx} className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/20 p-2 transition-colors focus-within:border-primary/40 focus-within:bg-background focus-within:ring-1 focus-within:ring-primary/10">
                      <Badge variant="default" className="shrink-0 bg-purple-500 text-white hover:bg-purple-500">空位 {idx + 1}</Badge>
                      <Input
                        value={normalizedFillAnswer[idx] || ""}
                        onChange={(e) => updateBlankAnswer(idx, e.target.value)}
                        placeholder="标准答案"
                        className="h-9 flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {(type === "essay" || type === "short_answer") && (
            <div className="flex flex-1 flex-col gap-4">
              <CardTitle icon={FileText} color="bg-rose-500">参考答案</CardTitle>
              <Textarea
                value={answer as string}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="请输入参考答案..."
                className="min-h-0 flex-1 resize-none rounded-lg border-border/60 bg-muted/20 text-[15px] leading-relaxed transition-all placeholder:text-muted-foreground/60 focus:border-primary focus:bg-background focus:ring-2 focus:ring-primary/15"
              />
            </div>
          )}
        </div>
      </div>
    )
  }

  const renderRightAnswer = () => {
    if (type === "single") {
      return (
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Check className="size-3.5" />
            点击选择正确答案
          </div>
          <div className="flex flex-col gap-2">
            {options.map((option, index) => {
              const checked = answer === option && option.trim() !== ""
              return (
                <label
                  key={index}
                  onClick={() => toggleSingleAnswer(index)}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-all ${
                    checked
                      ? "border-l-4 border-l-primary border-primary/30 bg-primary/[0.06] font-medium text-primary"
                      : "border-border/60 bg-white hover:border-primary/20 hover:bg-muted/30"
                  }`}
                >
                  <div className={`flex size-6 shrink-0 items-center justify-center rounded-full border-2 ${
                    checked ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/30"
                  }`}>
                    {checked && <Check className="size-3.5" />}
                  </div>
                  <span className="truncate">{String.fromCharCode(65 + index)}. {option || "（空选项）"}</span>
                </label>
              )
            })}
          </div>
        </div>
      )
    }

    if (type === "multiple") {
      return (
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <SquareCheck className="size-3.5" />
            可多选
          </div>
          <div className="flex flex-col gap-2">
            {options.map((option, index) => {
              const checked = isMultipleAnswerChecked(index)
              return (
                <label
                  key={index}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-all ${
                    checked
                      ? "border-l-4 border-l-indigo-500 border-indigo-200 bg-indigo-50 font-medium text-indigo-700"
                      : "border-border/60 bg-white hover:border-indigo-200 hover:bg-indigo-50/30"
                  }`}
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(c) => toggleMultipleAnswer(index, !!c)}
                    className="size-5 shrink-0 border-2 data-[state=checked]:border-indigo-500 data-[state=checked]:bg-indigo-500"
                  />
                  <span className="truncate">{String.fromCharCode(65 + index)}. {option || "（空选项）"}</span>
                </label>
              )
            })}
          </div>
        </div>
      )
    }

    if (type === "judge") {
      return (
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Scale className="size-3.5" />
            当前判断结果
          </div>
          <div className={`inline-flex w-fit items-center gap-2 rounded-xl px-5 py-3 text-base font-bold shadow-sm ${
            answer === "false"
              ? "bg-gradient-to-r from-red-50 to-red-100 text-red-700 border border-red-200"
              : "bg-gradient-to-r from-green-50 to-green-100 text-green-700 border border-green-200"
          }`}>
            {answer === "false" ? <X className="size-5" /> : <Check className="size-5" />}
            {answer === "false" ? "错误" : "正确"}
          </div>
        </div>
      )
    }

    if (type === "fill") {
      return (
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Braces className="size-3.5" />
            空位摘要
          </div>
          {blankCount === 0 ? (
            <span className="text-sm text-muted-foreground">暂无空位</span>
          ) : (
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: blankCount }).map((_, idx) => (
                <Badge key={idx} className="gap-1 rounded-lg bg-purple-100 px-2.5 py-1 text-xs font-medium text-purple-700 hover:bg-purple-100">
                  空位{idx + 1}: {normalizedFillAnswer[idx] || "未填写"}
                </Badge>
              ))}
            </div>
          )}
        </div>
      )
    }

    return (
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Sparkles className="size-3.5" />
          评分关键词（可选）
        </div>
        <Input placeholder="用逗号分隔关键词" disabled className="h-10 rounded-lg border-dashed" />
        <p className="text-xs text-muted-foreground/70">用于后续自动评分扩展，当前仅作记录</p>
      </div>
    )
  }

  const renderRightPane = () => {
    return (
      <div className="flex flex-col gap-5">
        {/* 基础设置 */}
        <div className="rounded-xl border border-border/60 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
          <CardTitle icon={Settings2} color="bg-slate-500">基础设置</CardTitle>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">难度</label>
              <Select value={difficulty} onValueChange={(v) => setDifficulty(v as Difficulty)}>
                <SelectTrigger className="h-10 w-full rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {(Object.keys(DIFFICULTY_LABELS) as Difficulty[]).map((d) => (
                      <SelectItem key={d} value={d}>{DIFFICULTY_LABELS[d]}</SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div ref={knowledgeRef} className="relative">
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">关联知识点</label>
              <button
                type="button"
                onClick={() => setKnowledgeOpen(!knowledgeOpen)}
                className={`flex h-10 w-full items-center justify-between rounded-lg border bg-background px-3 text-sm transition-all ${
                  knowledgeOpen ? "border-primary ring-2 ring-primary/15" : "border-input hover:border-primary/40"
                }`}
              >
                <span className={knowledgePointIds.length ? "font-medium text-foreground" : "text-muted-foreground"}>
                  {knowledgePointIds.length ? `已选择 ${knowledgePointIds.length} 项` : "选择知识点..."}
                </span>
                <ChevronDown className={`size-4 text-muted-foreground transition-transform ${knowledgeOpen ? "rotate-180" : ""}`} />
              </button>
              {knowledgeOpen && (
                <div className="absolute top-full z-50 mt-1.5 max-h-52 w-full overflow-auto rounded-xl border bg-white p-1.5 shadow-lg">
                  {loadingKnowledgePoints ? (
                    <div className="p-3 text-sm text-muted-foreground">加载中...</div>
                  ) : knowledgePoints.length === 0 ? (
                    <div className="p-3 text-sm text-muted-foreground">暂无知识点</div>
                  ) : (
                    knowledgePoints.map((kp) => (
                      <label
                        key={kp.id}
                        className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-primary/5"
                      >
                        <Checkbox
                          checked={knowledgePointIds.includes(kp.id)}
                          onCheckedChange={(checked) => {
                            if (checked) addKnowledgePoint(kp.id)
                            else removeKnowledgePoint(kp.id)
                          }}
                          className="size-4"
                        />
                        <span>{kp.name}</span>
                      </label>
                    ))
                  )}
                </div>
              )}
              {knowledgePointIds.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {knowledgePointIds.map(id => (
                    <Badge key={id} variant="secondary" className="gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary hover:bg-primary/15">
                      {getKnowledgePointName(id)}
                      <button type="button" onClick={() => removeKnowledgePoint(id)} className="ml-0.5 rounded-full p-0.5 hover:bg-primary/20">
                        <X className="size-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 答案设置 */}
        <div className="rounded-xl border border-border/60 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
          <CardTitle icon={Check} color={type === "judge" ? "bg-amber-500" : type === "multiple" ? "bg-indigo-500" : "bg-primary"}>答案设置</CardTitle>
          {renderRightAnswer()}
        </div>

        {/* 答案解析 */}
        <div className="rounded-xl border border-border/60 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
          <CardTitle icon={Lightbulb} color="bg-amber-500">答案解析</CardTitle>
          <Textarea
            value={analysis}
            onChange={(e) => setAnalysis(e.target.value)}
            placeholder="输入解析内容，帮助学生理解..."
            className="h-24 min-h-0 resize-none rounded-lg border-border/60 bg-muted/20 text-[15px] leading-relaxed transition-all placeholder:text-muted-foreground/60 focus:border-primary focus:bg-background focus:ring-2 focus:ring-primary/15"
          />
          <p className="mt-1.5 text-xs text-muted-foreground/60">选填，用于展示给学生查看</p>
        </div>

        {/* 高级设置 */}
        {(type === "single" || type === "multiple") && (
          <div className="overflow-hidden rounded-xl border border-border/60 bg-white shadow-sm transition-shadow hover:shadow-md">
            <button
              type="button"
              onClick={() => setAdvancedOpen(!advancedOpen)}
              className="flex w-full items-center justify-between px-5 py-3.5 text-xs font-bold uppercase tracking-wider text-muted-foreground transition-colors hover:bg-muted/30"
            >
              <span className="flex items-center gap-2"><Sparkles className="size-3.5" /> 高级设置</span>
              <ChevronDown className={`size-4 text-muted-foreground transition-transform ${advancedOpen ? "rotate-180" : ""}`} />
            </button>
            {advancedOpen && (
              <div className="border-t px-5 py-3">
                <label className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">选项随机排序</span>
                  <Checkbox disabled />
                </label>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="xl"
        className="flex max-h-[94vh] max-w-[1200px] flex-col overflow-hidden border border-border/50 p-0 shadow-2xl"
        annotationContext="question-form"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b bg-gradient-to-r from-background via-background to-muted/30 px-6 py-4">
          <DialogHeader className="m-0 gap-1.5 text-left">
            <div className="flex items-center gap-2.5">
              <div className={`flex size-9 items-center justify-center rounded-xl ${TYPE_COLORS[type]} text-white shadow-md`}>
                {TYPE_ICONS[type]}
              </div>
              <div>
                <DialogTitle className="text-lg font-bold">{question ? "编辑题目" : "新建题目"}</DialogTitle>
                <DialogDescription className="text-xs">
                  {question ? "修改题目内容和答案" : "添加新题目到当前题库"}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="flex items-center gap-2.5">
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="text-muted-foreground hover:text-foreground">
              取消
            </Button>
            {!question && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!content.trim()}
                onClick={handleSubmitAndContinue}
                className="gap-1.5 rounded-lg border-primary/30 text-primary hover:bg-primary/5"
              >
                <Save className="size-3.5" />
                保存并新建
              </Button>
            )}
            <Button type="button" size="sm" disabled={!content.trim()} onClick={handleSubmit} className="gap-1.5 rounded-lg shadow-sm">
              <Save className="size-3.5" />
              {question ? "保存" : "创建"}
            </Button>
          </div>
        </div>

        {/* 题型条 */}
        <div className="flex items-center gap-2 border-b bg-muted/20 px-6 py-2.5">
          <span className="mr-1 text-xs font-medium text-muted-foreground">题型</span>
          {(Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => handleTypeChange(t)}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all ${
                type === t
                  ? `${TYPE_COLORS[t]} text-white shadow-md scale-[1.02]`
                  : "bg-background text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent"
              }`}
            >
              {TYPE_ICONS[t]}
              {QUESTION_TYPE_LABELS[t]}
            </button>
          ))}
        </div>

        {/* 双栏主体 */}
        <div className="flex flex-1 overflow-hidden bg-gradient-to-br from-muted/20 via-background to-muted/10">
          <div className="flex w-[55%] flex-col gap-5 overflow-y-auto p-6">
            {renderLeftPane()}
          </div>
          <div className="my-6 w-px bg-gradient-to-b from-transparent via-border to-transparent" />
          <div className="flex w-[45%] flex-col gap-5 overflow-y-auto p-6">
            {renderRightPane()}
          </div>
        </div>

        {/* 底部状态栏 */}
        <div className="flex h-9 items-center justify-between border-t bg-muted/20 px-6 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>就绪</span>
            <span className="text-border">|</span>
            <Badge variant="secondary" className={`gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-white ${TYPE_COLORS[type]}`}>
              {TYPE_ICONS[type]}
              {QUESTION_TYPE_LABELS[type]}
            </Badge>
          </div>
          <div className="flex items-center gap-1">
            <kbd className="rounded border border-border/70 bg-background px-1.5 py-0.5 font-mono text-[10px] shadow-sm">Ctrl</kbd>
            <span>+</span>
            <kbd className="rounded border border-border/70 bg-background px-1.5 py-0.5 font-mono text-[10px] shadow-sm">Enter</kbd>
            <span className="ml-1">保存并新建</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
