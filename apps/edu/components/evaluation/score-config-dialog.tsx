"use client"

import { useState, useMemo, useEffect } from "react"
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
import { Field, FieldLabel } from "@/components/ui/field"
import { QUESTION_TYPE_LABELS } from "@/lib/types"
import type { ExamQuestion, QuestionType } from "@/lib/types"

interface ScoreConfigDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  questions: ExamQuestion[]
  onApply: (scores: Record<string, number>) => void
}

export function ScoreConfigDialog({
  open,
  onOpenChange,
  questions,
  onApply,
}: ScoreConfigDialogProps) {
  const typeQuestionsMap = useMemo(() => {
    const map: Record<string, ExamQuestion[]> = {}
    questions.forEach((q) => {
      if (!map[q.type]) map[q.type] = []
      map[q.type].push(q)
    })
    return map
  }, [questions])

  const types = useMemo(() => Object.keys(typeQuestionsMap) as QuestionType[], [typeQuestionsMap])

  const [typeScores, setTypeScores] = useState<Record<string, string>>({})

  useEffect(() => {
    if (open && types.length > 0) {
      const init: Record<string, string> = {}
      types.forEach((t) => {
        init[t] = "0"
      })
      setTypeScores(init)
    }
  }, [open, types])

  const totalInput = useMemo(() => {
    return types.reduce((sum, t) => sum + (Number(typeScores[t]) || 0), 0)
  }, [types, typeScores])

  const isValid = totalInput === 100 && types.every((t) => (Number(typeScores[t]) || 0) > 0)

  const handleApply = () => {
    const scores: Record<string, number> = {}
    types.forEach((t) => {
      const typeQuestions = typeQuestionsMap[t]
      const typeTotal = Number(typeScores[t]) || 0
      const n = typeQuestions.length
      const base = Math.floor(typeTotal / n)
      const remainder = typeTotal - base * n
      typeQuestions.forEach((q, idx) => {
        scores[q.questionId] = base + (idx < remainder ? 1 : 0)
      })
    })
    onApply(scores)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>题型分配</DialogTitle>
          <DialogDescription>
            为每种题型配置总分（合计 100 分），系统自动在每个题型内均匀分配。
            如有余数，从该题型的第一道题开始额外增加 1 分。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {types.map((t) => (
            <Field key={t}>
              <FieldLabel>
                {QUESTION_TYPE_LABELS[t]}（{typeQuestionsMap[t].length} 题）
              </FieldLabel>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={typeScores[t] ?? "0"}
                  onChange={(e) =>
                    setTypeScores((prev) => ({ ...prev, [t]: e.target.value }))
                  }
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">分</span>
              </div>
            </Field>
          ))}
          <div className="text-right text-sm">
            <span className={totalInput === 100 ? "text-green-600 font-medium" : "text-red-500"}>
              合计：{totalInput} 分
            </span>
            {totalInput !== 100 && (
              <span className="ml-2 text-muted-foreground">（需等于 100 分）</span>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleApply} disabled={!isValid}>
            应用配置
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
