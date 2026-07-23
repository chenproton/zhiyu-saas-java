// @ts-nocheck
"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import type { Question } from "@/lib/types"
import { QUESTION_TYPE_LABELS } from "@/lib/types"

interface QuestionPreviewProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  question: Question | null
}

export function QuestionPreview({ open, onOpenChange, question }: QuestionPreviewProps) {
  if (!question) return null

  const renderAnswer = () => {
    switch (question.type) {
      case "single":
      case "essay":
        return <span>{question.answer as string}</span>
      case "multiple":
        return <span>{(question.answer as string[]).join(", ")}</span>
      case "judge":
        return <span>{question.answer === "true" ? "正确" : "错误"}</span>
      case "fill":
        return <span>{(question.answer as string[]).join(", ")}</span>
      default:
        return null
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" annotationContext="question-preview">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            题目预览
            <Badge variant="secondary">{QUESTION_TYPE_LABELS[question.type]}</Badge>
            <Badge variant="outline">{question.score} 分</Badge>
          </DialogTitle>
          <DialogDescription>预览题目的详细内容和答案</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div>
            <h4 className="mb-2 font-medium">题目内容</h4>
            <p className="whitespace-pre-wrap text-sm">{question.content}</p>
          </div>

          {question.options && question.options.length > 0 && (
            <div>
              <h4 className="mb-2 font-medium">选项</h4>
              <div className="flex flex-col gap-1">
                {question.options.map((option, index) => (
                  <div key={index} className="text-sm">
                    <span className="mr-2 text-muted-foreground">
                      {String.fromCharCode(65 + index)}.
                    </span>
                    {option}
                  </div>
                ))}
              </div>
            </div>
          )}

          <Separator />

          <div>
            <h4 className="mb-2 font-medium text-emerald-600">正确答案</h4>
            <p className="text-sm">{renderAnswer()}</p>
          </div>

          {question.analysis && (
            <div>
              <h4 className="mb-2 font-medium text-blue-600">答案解析</h4>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                {question.analysis}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
