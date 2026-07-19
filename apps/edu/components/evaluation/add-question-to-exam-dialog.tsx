// @ts-nocheck
"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import { Plus, X, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Field, FieldGroup, FieldLabel, FieldDescription } from "@/components/ui/field"
import { useData } from "@/components/providers/data-provider"
import type { QuestionType, Difficulty, QuestionFormData, Question, EvalKnowledgePoint } from "@/lib/types"
import { QUESTION_TYPE_LABELS, DIFFICULTY_LABELS } from "@/lib/types"
import { knowledgeApi } from "@/lib/api"
import { cn } from "@/lib/utils"

interface AddQuestionToExamDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAddQuestion: (question: Question) => void
}

export function AddQuestionToExamDialog({
  open,
  onOpenChange,
  onAddQuestion,
}: AddQuestionToExamDialogProps) {
  const { questionBanks, createQuestion } = useData()
  
  // 只显示已发布或可编辑的题库
  const availableBanks = useMemo(() => {
    return questionBanks.filter(bank => ['published', 'draft', 'rejected'].includes(bank.status))
  }, [questionBanks])

  const scrollRef = useRef<HTMLDivElement>(null)
  const [selectedBankId, setSelectedBankId] = useState<string>("")
  const [type, setType] = useState<QuestionType>("single")
  const [content, setContent] = useState("")
  const [options, setOptions] = useState<string[]>(["", "", "", ""])
  const [singleAnswer, setSingleAnswer] = useState("")
  const [multipleAnswers, setMultipleAnswers] = useState<string[]>([])
  const [judgeAnswer, setJudgeAnswer] = useState<string>("true")
  const [fillAnswers, setFillAnswers] = useState<string[]>([""])
  const [essayAnswer, setEssayAnswer] = useState("")
  const [analysis, setAnalysis] = useState("")
  const [difficulty, setDifficulty] = useState<Difficulty>("medium")
  const [selectedKnowledgePoints, setSelectedKnowledgePoints] = useState<string[]>([])
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

  // 重置表单
  const resetForm = () => {
    setSelectedBankId("")
    setType("single")
    setContent("")
    setOptions(["", "", "", ""])
    setSingleAnswer("")
    setMultipleAnswers([])
    setJudgeAnswer("true")
    setFillAnswers([""])
    setEssayAnswer("")
    setAnalysis("")
    setDifficulty("medium")
    setSelectedKnowledgePoints([])
  }

  useEffect(() => {
    if (!open) {
      resetForm()
    }
  }, [open])

  // 切换题目类型时重置答案
  useEffect(() => {
    setSingleAnswer("")
    setMultipleAnswers([])
    setJudgeAnswer("true")
    setFillAnswers([""])
    setEssayAnswer("")
    if (type === "single" || type === "multiple") {
      setOptions(["", "", "", ""])
    }
  }, [type])

  const addOption = () => {
    if (options.length < 8) {
      setOptions([...options, ""])
    }
  }

  const removeOption = (index: number) => {
    if (options.length > 2) {
      const newOptions = options.filter((_, i) => i !== index)
      setOptions(newOptions)
      // 清除被删除选项的答案
      if (type === "single" && singleAnswer === String(index)) {
        setSingleAnswer("")
      }
      if (type === "multiple") {
        setMultipleAnswers(multipleAnswers.filter(a => a !== String(index)).map(a => {
          const num = parseInt(a)
          return num > index ? String(num - 1) : a
        }))
      }
    }
  }

  const updateOption = (index: number, value: string) => {
    const newOptions = [...options]
    newOptions[index] = value
    setOptions(newOptions)
  }

  const toggleMultipleAnswer = (index: string) => {
    if (multipleAnswers.includes(index)) {
      setMultipleAnswers(multipleAnswers.filter(a => a !== index))
    } else {
      setMultipleAnswers([...multipleAnswers, index])
    }
  }

  const addFillBlank = () => {
    if (fillAnswers.length < 10) {
      setFillAnswers([...fillAnswers, ""])
    }
  }

  const removeFillBlank = (index: number) => {
    if (fillAnswers.length > 1) {
      setFillAnswers(fillAnswers.filter((_, i) => i !== index))
    }
  }

  const updateFillAnswer = (index: number, value: string) => {
    const newAnswers = [...fillAnswers]
    newAnswers[index] = value
    setFillAnswers(newAnswers)
  }

  const toggleKnowledgePoint = (kpId: string) => {
    if (selectedKnowledgePoints.includes(kpId)) {
      setSelectedKnowledgePoints(selectedKnowledgePoints.filter(id => id !== kpId))
    } else {
      setSelectedKnowledgePoints([...selectedKnowledgePoints, kpId])
    }
  }

  const getAnswer = (): string | string[] => {
    switch (type) {
      case "single":
        return options[parseInt(singleAnswer)] || ""
      case "multiple":
        return multipleAnswers.map(i => options[parseInt(i)]).filter(Boolean)
      case "judge":
        return judgeAnswer
      case "fill":
        return fillAnswers.filter(Boolean)
      case "essay":
      case "short_answer":
        return essayAnswer
      default:
        return ""
    }
  }

  const isValid = () => {
    if (!selectedBankId || !content.trim()) return false
    
    switch (type) {
      case "single":
        return options.filter(o => o.trim()).length >= 2 && singleAnswer !== ""
      case "multiple":
        return options.filter(o => o.trim()).length >= 2 && multipleAnswers.length >= 2
      case "judge":
        return true
      case "fill":
        return fillAnswers.some(a => a.trim())
      case "essay":
      case "short_answer":
        return essayAnswer.trim() !== ""
      default:
        return false
    }
  }

  const handleSubmit = async () => {
    if (!isValid()) return

    const formData: QuestionFormData = {
      type,
      content,
      options: (type === "single" || type === "multiple") ? options.filter(o => o.trim()) : undefined,
      answer: getAnswer(),
      analysis: analysis || undefined,
      score: 0, // 分值在试卷中设置
      difficulty,
      knowledgePoints: selectedKnowledgePoints.length > 0 ? selectedKnowledgePoints : undefined,
    }

    const newQuestion = await createQuestion(selectedBankId, formData)
    onAddQuestion(newQuestion)
    onOpenChange(false)
  }

  const optionLabels = ["A", "B", "C", "D", "E", "F", "G", "H"]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl" className="flex h-[85vh] flex-col overflow-hidden p-0" annotationContext="add-question-to-exam" annotationContainerRef={scrollRef}>
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>新增题目</DialogTitle>
          <DialogDescription>
            创建新题目并添加到试卷，题目将同时保存到关联的题库中
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-hidden">
          <div ref={scrollRef} className="px-6 py-4">
            <FieldGroup>
              {/* 关联题库 */}
              <Field>
                <FieldLabel>关联题库 *</FieldLabel>
                <Select value={selectedBankId} onValueChange={setSelectedBankId}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择要关联的题库" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {availableBanks.length === 0 ? (
                        <SelectItem value="none" disabled>
                          暂无可用题库
                        </SelectItem>
                      ) : (
                        availableBanks.map((bank) => (
                          <SelectItem key={bank.id} value={bank.id}>
                            {bank.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FieldDescription>新增的题目将保存到该题库中</FieldDescription>
              </Field>

              {/* 题目类型 */}
              <Field>
                <FieldLabel>题目类型 *</FieldLabel>
                <Select value={type} onValueChange={(v) => setType(v as QuestionType)}>
                  <SelectTrigger>
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

              {/* 题目内容 */}
              <Field>
                <FieldLabel>题目内容 *</FieldLabel>
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="请输入题目内容"
                  rows={3}
                />
              </Field>

              {/* 选项（单选/多选题） */}
              {(type === "single" || type === "multiple") && (
                <Field>
                  <FieldLabel>选项 *</FieldLabel>
                  {type === "single" ? (
                    <RadioGroup value={singleAnswer} onValueChange={setSingleAnswer} className="flex flex-col gap-2">
                      {options.map((option, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <RadioGroupItem value={String(index)} id={`option-${index}`} className="shrink-0" />
                          <label htmlFor={`option-${index}`} className="w-6 shrink-0 text-sm font-medium cursor-pointer">
                            {optionLabels[index]}.
                          </label>
                          <Input
                            value={option}
                            onChange={(e) => updateOption(index, e.target.value)}
                            placeholder={`选项 ${optionLabels[index]}`}
                            className="flex-1"
                          />
                          {options.length > 2 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeOption(index)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </RadioGroup>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {options.map((option, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <Checkbox
                            checked={multipleAnswers.includes(String(index))}
                            onCheckedChange={() => toggleMultipleAnswer(String(index))}
                            className="shrink-0"
                          />
                          <span className="w-6 shrink-0 text-sm font-medium">{optionLabels[index]}.</span>
                          <Input
                            value={option}
                            onChange={(e) => updateOption(index, e.target.value)}
                            placeholder={`选项 ${optionLabels[index]}`}
                            className="flex-1"
                          />
                          {options.length > 2 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeOption(index)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {options.length < 8 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addOption}
                      className="mt-2 w-fit"
                    >
                      <Plus className="mr-1 size-4" />
                      添加选项
                    </Button>
                  )}
                  <FieldDescription>
                    {type === "single" ? "点击单选按钮设置正确答案" : "勾选多个选项设置正确答案"}
                  </FieldDescription>
                </Field>
              )}

              {/* 判断题答案 */}
              {type === "judge" && (
                <Field>
                  <FieldLabel>正确答案 *</FieldLabel>
                  <RadioGroup value={judgeAnswer} onValueChange={setJudgeAnswer} className="flex gap-4">
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="true" id="judge-true" />
                      <label htmlFor="judge-true" className="text-sm">正确</label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="false" id="judge-false" />
                      <label htmlFor="judge-false" className="text-sm">错误</label>
                    </div>
                  </RadioGroup>
                </Field>
              )}

              {/* 填空题答案 */}
              {type === "fill" && (
                <Field>
                  <FieldLabel>填空答案 *</FieldLabel>
                  <div className="flex flex-col gap-2">
                    {fillAnswers.map((answer, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <span className="w-16 text-sm">空格 {index + 1}:</span>
                        <Input
                          value={answer}
                          onChange={(e) => updateFillAnswer(index, e.target.value)}
                          placeholder="请输入答案"
                          className="flex-1"
                        />
                        {fillAnswers.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeFillBlank(index)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                    {fillAnswers.length < 10 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addFillBlank}
                        className="w-fit"
                      >
                        <Plus className="mr-1 size-4" />
                        添加空格
                      </Button>
                    )}
                  </div>
                </Field>
              )}

              {/* 问答题/简答题参考答案 */}
              {(type === "essay" || type === "short_answer") && (
                <Field>
                  <FieldLabel>参考答案 *</FieldLabel>
                  <Textarea
                    value={essayAnswer}
                    onChange={(e) => setEssayAnswer(e.target.value)}
                    placeholder="请输入参考答案"
                    rows={4}
                  />
                </Field>
              )}

              {/* 难度 */}
              <Field>
                <FieldLabel>难度</FieldLabel>
                <Select value={difficulty} onValueChange={(v) => setDifficulty(v as Difficulty)}>
                  <SelectTrigger>
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

              {/* 知识点 */}
              <Field>
                <FieldLabel>关联知识点</FieldLabel>
                {loadingKnowledgePoints ? (
                  <div className="rounded-md border p-3 text-sm text-muted-foreground">加载知识点中...</div>
                ) : (
                  <div className="flex flex-wrap gap-2 rounded-md border p-3">
                    {knowledgePoints.length === 0 ? (
                      <span className="text-sm text-muted-foreground">暂无知识点</span>
                    ) : (
                      knowledgePoints.map((kp) => (
                        <Badge
                          key={kp.id}
                          variant={selectedKnowledgePoints.includes(kp.id) ? "default" : "outline"}
                          className={cn(
                            "cursor-pointer transition-colors",
                            selectedKnowledgePoints.includes(kp.id) && "bg-primary"
                          )}
                          onClick={() => toggleKnowledgePoint(kp.id)}
                        >
                          {kp.name}
                          {selectedKnowledgePoints.includes(kp.id) && (
                            <X className="ml-1 size-3" />
                          )}
                        </Badge>
                      ))
                    )}
                  </div>
                )}
              </Field>

              {/* 解析 */}
              <Field>
                <FieldLabel>解析</FieldLabel>
                <Textarea
                  value={analysis}
                  onChange={(e) => setAnalysis(e.target.value)}
                  placeholder="请输入题目解析（选填）"
                  rows={3}
                />
              </Field>
            </FieldGroup>
          </div>
        </ScrollArea>

        <DialogFooter className="border-t px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid()}>
            添加到试卷
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
