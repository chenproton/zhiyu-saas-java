// @ts-nocheck
"use client"

import { useState, useEffect, useRef } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Field, FieldGroup, FieldLabel, FieldDescription } from "@/components/ui/field"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Plus, X } from "lucide-react"
import type { Question, QuestionType, QuestionFormData, Difficulty, EvalKnowledgePoint } from "@/lib/types"
import { QUESTION_TYPE_LABELS, DIFFICULTY_LABELS } from "@/lib/types"
import { knowledgeApi } from "@/lib/api"

interface QuestionFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  question?: Question | null
  onSubmit: (data: QuestionFormData) => void
}

export function QuestionFormDialog({
  open,
  onOpenChange,
  question,
  onSubmit,
}: QuestionFormDialogProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [type, setType] = useState<QuestionType>("single")
  const [content, setContent] = useState("")
  const [options, setOptions] = useState<string[]>(["", "", "", ""])
  const [answer, setAnswer] = useState<string | string[]>("")
  const [analysis, setAnalysis] = useState("")
  const [difficulty, setDifficulty] = useState<Difficulty>("medium")
  const [knowledgePointIds, setKnowledgePointIds] = useState<string[]>([])
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
      setType("single")
      setContent("")
      setOptions(["", "", "", ""])
      setAnswer("")
      setAnalysis("")
      setDifficulty("medium")
      setKnowledgePointIds([])
    }
  }, [question, open])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) return

    const data: QuestionFormData = {
      type,
      content: content.trim(),
      analysis: analysis.trim() || undefined,
      score: 0, // 默认为0，在组卷时设置
      answer: Array.isArray(answer) ? answer : [answer],
      difficulty,
      knowledgePoints: knowledgePointIds.length > 0 ? knowledgePointIds : undefined,
    }

    if (type === "single" || type === "multiple") {
      data.options = options.filter(o => o.trim())
    }

    onSubmit(data)
    onOpenChange(false)
  }

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...options]
    newOptions[index] = value
    setOptions(newOptions)
  }

  const addOption = () => {
    setOptions([...options, ""])
  }

  const removeOption = (index: number) => {
    if (options.length <= 2) return
    const newOptions = options.filter((_, i) => i !== index)
    setOptions(newOptions)
    // 更新答案
    if (type === "single" && answer === options[index]) {
      setAnswer("")
    } else if (type === "multiple" && Array.isArray(answer)) {
      const currentAnswers = answer as string[]
      const removeIdx = currentAnswers.indexOf(options[index])
      if (removeIdx >= 0) {
        setAnswer([...currentAnswers.slice(0, removeIdx), ...currentAnswers.slice(removeIdx + 1)])
      }
    }
  }

  const getSingleAnswerIndex = (): string => {
    const filtered = options.filter(o => o.trim())
    const idx = filtered.indexOf(answer as string)
    return idx >= 0 ? String(idx) : ""
  }

  const handleSingleAnswerChange = (value: string) => {
    setAnswer(value)
  }

  const handleSingleAnswerIndexChange = (idxStr: string) => {
    const filtered = options.filter(o => o.trim())
    const idx = parseInt(idxStr)
    setAnswer(filtered[idx] || "")
  }

  const getMultipleCheckedIndex = (idx: number): boolean => {
    if (!Array.isArray(answer)) return false
    const filtered = options.filter(o => o.trim())
    const optionText = filtered[idx] || ""
    const answerTexts = answer as string[]
    const inAnswerCount = answerTexts.filter(a => a === optionText).length
    const beforeCount = filtered.slice(0, idx).filter(o => o === optionText).length
    return beforeCount < inAnswerCount
  }

  const handleMultipleAnswerChange = (idx: number, checked: boolean) => {
    const filtered = options.filter(o => o.trim())
    const optionText = filtered[idx] || ""
    const currentAnswers = Array.isArray(answer) ? answer : []
    if (checked) {
      setAnswer([...currentAnswers, optionText])
    } else {
      const removeIdx = currentAnswers.indexOf(optionText)
      if (removeIdx >= 0) {
        setAnswer([...currentAnswers.slice(0, removeIdx), ...currentAnswers.slice(removeIdx + 1)])
      }
    }
  }

  const addKnowledgePoint = (kpId: string) => {
    if (!knowledgePointIds.includes(kpId)) {
      setKnowledgePointIds([...knowledgePointIds, kpId])
    }
  }

  const removeKnowledgePoint = (kpId: string) => {
    setKnowledgePointIds(knowledgePointIds.filter(id => id !== kpId))
  }

  const getKnowledgePointName = (id: string) => knowledgePoints.find(kp => kp.id === id)?.name || id

  const renderAnswerInput = () => {
    switch (type) {
      case "single":
        return (
          <Field>
            <FieldLabel>正确答案</FieldLabel>
            <RadioGroup value={getSingleAnswerIndex()} onValueChange={handleSingleAnswerIndexChange}>
              {options.filter(o => o.trim()).map((option, index) => (
                <div key={index} className="flex items-center gap-2">
                  <RadioGroupItem value={String(index)} id={`answer-${index}`} />
                  <Label htmlFor={`answer-${index}`}>{option}</Label>
                </div>
              ))}
            </RadioGroup>
          </Field>
        )
      case "multiple":
        return (
          <Field>
            <FieldLabel>正确答案（可多选）</FieldLabel>
            <div className="flex flex-col gap-2">
              {options.filter(o => o.trim()).map((option, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Checkbox
                    id={`answer-${index}`}
                    checked={getMultipleCheckedIndex(index)}
                    onCheckedChange={(checked) => handleMultipleAnswerChange(index, !!checked)}
                  />
                  <Label htmlFor={`answer-${index}`}>{option}</Label>
                </div>
              ))}
            </div>
          </Field>
        )
      case "judge":
        return (
          <Field>
            <FieldLabel>正确答案</FieldLabel>
            <RadioGroup value={answer as string} onValueChange={handleSingleAnswerChange}>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="true" id="answer-true" />
                <Label htmlFor="answer-true">正确</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="false" id="answer-false" />
                <Label htmlFor="answer-false">错误</Label>
              </div>
            </RadioGroup>
          </Field>
        )
      case "fill":
        return (
          <Field>
            <FieldLabel htmlFor="fill-answer">填空答案</FieldLabel>
            <FieldDescription>多个空用逗号分隔</FieldDescription>
            <Input
              id="fill-answer"
              value={Array.isArray(answer) ? answer.join(", ") : answer}
              onChange={(e) => setAnswer(e.target.value.split(",").map(s => s.trim()))}
              placeholder="答案1, 答案2..."
            />
          </Field>
        )
      case "essay":
      case "short_answer":
        return (
          <Field>
            <FieldLabel htmlFor="essay-answer">参考答案</FieldLabel>
            <Textarea
              id="essay-answer"
              value={answer as string}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="请输入参考答案"
              rows={3}
            />
          </Field>
        )
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" className="max-h-[90vh] overflow-y-auto" annotationContext="question-form" annotationContainerRef={scrollRef}>
        <div ref={scrollRef} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{question ? "编辑题目" : "新建题目"}</DialogTitle>
            <DialogDescription>
              {question ? "修改题目内容和答案" : "添加新题目到当前题库"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
          <FieldGroup className="py-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="type">题目类型</FieldLabel>
                <Select
                  value={type}
                  onValueChange={(v) => {
                    setType(v as QuestionType)
                    setAnswer(v === "multiple" ? [] : "")
                  }}
                >
                  <SelectTrigger id="type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {(Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]).map((t) => (
                        <SelectItem key={t} value={t}>
                          {QUESTION_TYPE_LABELS[t]}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="difficulty">难度</FieldLabel>
                <Select value={difficulty} onValueChange={(v) => setDifficulty(v as Difficulty)}>
                  <SelectTrigger id="difficulty">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {(Object.keys(DIFFICULTY_LABELS) as Difficulty[]).map((d) => (
                        <SelectItem key={d} value={d}>
                          {DIFFICULTY_LABELS[d]}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <Field>
              <FieldLabel>关联知识点</FieldLabel>
              {loadingKnowledgePoints ? (
                <div className="rounded-md border p-3 text-sm text-muted-foreground">加载知识点中...</div>
              ) : (
                <Select onValueChange={addKnowledgePoint}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择知识点" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {knowledgePoints.length === 0 ? (
                        <SelectItem value="none" disabled>暂无知识点</SelectItem>
                      ) : (
                        knowledgePoints
                          .filter(kp => !knowledgePointIds.includes(kp.id))
                          .map(kp => (
                            <SelectItem key={kp.id} value={kp.id}>
                              {kp.name}
                            </SelectItem>
                          ))
                      )}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              )}
              {knowledgePointIds.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {knowledgePointIds.map(id => (
                    <Badge key={id} variant="secondary" className="gap-1">
                      {getKnowledgePointName(id)}
                      <button
                        type="button"
                        onClick={() => removeKnowledgePoint(id)}
                        className="ml-1 rounded-full hover:bg-muted"
                      >
                        <X className="size-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </Field>

            <Field>
              <FieldLabel htmlFor="content">题目内容</FieldLabel>
              <Textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="请输入题目内容"
                rows={3}
                required
              />
            </Field>

            {(type === "single" || type === "multiple") && (
              <Field>
                <FieldLabel>选项</FieldLabel>
                <div className="flex flex-col gap-2">
                  {options.map((option, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <span className="w-6 text-muted-foreground">
                        {String.fromCharCode(65 + index)}.
                      </span>
                      <Input
                        value={option}
                        onChange={(e) => handleOptionChange(index, e.target.value)}
                        placeholder={`选项 ${String.fromCharCode(65 + index)}`}
                      />
                      {options.length > 2 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 shrink-0"
                          onClick={() => removeOption(index)}
                        >
                          <X />
                        </Button>
                      )}
                    </div>
                  ))}
                  {options.length < 8 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addOption}
                      className="w-fit"
                    >
                      <Plus />
                      添加选项
                    </Button>
                  )}
                </div>
              </Field>
            )}

            {renderAnswerInput()}

            <Field>
              <FieldLabel htmlFor="analysis">答案解析</FieldLabel>
              <Textarea
                id="analysis"
                value={analysis}
                onChange={(e) => setAnalysis(e.target.value)}
                placeholder="请输入答案解析（可选）"
                rows={2}
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" disabled={!content.trim()}>
              {question ? "保存" : "创建"}
            </Button>
          </DialogFooter>
        </form>
        </div>
      </DialogContent>
    </Dialog>
  )
}
