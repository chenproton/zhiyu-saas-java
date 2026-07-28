"use client"

import { useState, useMemo, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { questionApi } from "@/lib/api"
import type { NodeQuiz, QuizQuestion } from "@/lib/types/lesson-source"
import { X, Check } from "lucide-react"

function generateQuizId() {
  return `quiz-${Date.now()}`
}

interface QuizConfigModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (quiz: NodeQuiz) => void
}

export default function QuizConfigModal({
  open,
  onOpenChange,
  onConfirm,
}: QuizConfigModalProps) {
  const [selectedQuestions, setSelectedQuestions] = useState<Set<string>>(new Set())
  const [qbKeyword, setQbKeyword] = useState("")
  const [quizTitle, setQuizTitle] = useState("")
  const [timeLimit, setTimeLimit] = useState(120)
  const [questionBank, setQuestionBank] = useState<QuizQuestion[]>([])

  useEffect(() => {
    questionApi.list({ limit: 200 }).then((res) => {
      setQuestionBank((res.items || []).map((q) => ({
        id: q.id,
        type: q.type === "short_answer" ? "essay" : q.type === "fill" ? "essay" : q.type as QuizQuestion["type"],
        question: q.content,
        options: q.options ? q.options.map((text, i) => ({ key: String.fromCharCode(65 + i), text })) : undefined,
        answer: Array.isArray(q.answer) ? q.answer.join(",") : q.answer,
        score: q.score,
      })))
    }).catch(() => setQuestionBank([]))
  }, [])

  const filteredQuestions = useMemo(() => {
    if (!qbKeyword.trim()) return questionBank
    return questionBank.filter((q) =>
      q.question.toLowerCase().includes(qbKeyword.trim().toLowerCase())
    )
  }, [qbKeyword, questionBank])

  const toggleQuestion = (id: string) => {
    setSelectedQuestions((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleConfirm = () => {
    const questions: QuizQuestion[] = questionBank
      .filter((q) => selectedQuestions.has(q.id))
      .map((q) => ({ ...q }))
    if (questions.length === 0) return
    onConfirm({
      id: generateQuizId(),
      title: quizTitle || "随堂测验",
      type: "question_bank",
      questions,
      timeLimit,
    })
    reset()
    onOpenChange(false)
  }

  const reset = () => {
    setSelectedQuestions(new Set())
    setQbKeyword("")
    setQuizTitle("")
    setTimeLimit(120)
  }

  const selectedList = questionBank.filter((q) => selectedQuestions.has(q.id))

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset()
        onOpenChange(v)
      }}
    >
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>从题库选题</DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex flex-col min-h-0">
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="col-span-2">
              <Label className="text-xs text-gray-500">测验标题</Label>
              <Input
                value={quizTitle}
                onChange={(e) => setQuizTitle(e.target.value)}
                placeholder="请输入测验标题"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs text-gray-500">作答限时（秒）</Label>
              <Input
                type="number"
                value={timeLimit}
                onChange={(e) => setTimeLimit(Number(e.target.value))}
                className="mt-1"
              />
            </div>
          </div>

          <div className="flex gap-4 flex-1 min-h-0">
            <div className="flex-1 flex flex-col min-h-0">
              <div className="relative mb-3">
                <Input
                  placeholder="搜索题目名称..."
                  value={qbKeyword}
                  onChange={(e) => setQbKeyword(e.target.value)}
                />
              </div>
              <div className="flex-1 overflow-auto border rounded-lg">
                <Table>
                  <TableHeader className="bg-gray-50 sticky top-0">
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead>题目名称</TableHead>
                      <TableHead>类型</TableHead>
                      <TableHead>分值</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredQuestions.map((q) => {
                      const checked = selectedQuestions.has(q.id)
                      return (
                        <TableRow
                          key={q.id}
                          className="cursor-pointer"
                          onClick={() => toggleQuestion(q.id)}
                        >
                          <TableCell>
                            <div
                              className={`w-4 h-4 rounded border flex items-center justify-center ${
                                checked
                                  ? "bg-blue-600 border-blue-600"
                                  : "border-gray-300"
                              }`}
                            >
                              {checked && <Check className="w-3 h-3 text-white" />}
                            </div>
                          </TableCell>
                          <TableCell>{q.question}</TableCell>
                          <TableCell>
                            <span className="px-1.5 py-0.5 text-[10px] bg-gray-100 rounded">
                              {q.type === "single"
                                ? "单选"
                                : q.type === "multiple"
                                ? "多选"
                                : q.type === "judge"
                                ? "判断"
                                : "简答"}
                            </span>
                          </TableCell>
                          <TableCell>{q.score}分</TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="w-72 flex flex-col min-h-0">
              <div className="text-sm font-semibold text-gray-800 mb-2">
                已选择题目 ({selectedList.length})
              </div>
              <div className="flex-1 overflow-auto space-y-2">
                {selectedList.length === 0 && (
                  <div className="text-center py-8 text-gray-400 text-sm">
                    暂未选择题目
                  </div>
                )}
                {selectedList.map((q) => (
                  <div
                    key={q.id}
                    className="bg-blue-50 border border-blue-100 rounded-lg p-3 relative"
                  >
                    <div className="text-sm text-blue-700 font-medium pr-5">
                      {q.question}
                    </div>
                    <div className="flex gap-1.5 text-xs text-blue-500 mt-1">
                      <span className="bg-blue-50/50 px-2 py-0.5 rounded">
                        {q.type === "single"
                          ? "单选"
                          : q.type === "multiple"
                          ? "多选"
                          : q.type === "judge"
                          ? "判断"
                          : "简答"}
                      </span>
                      <span className="bg-blue-50/50 px-2 py-0.5 rounded">
                        {q.score}分
                      </span>
                    </div>
                    <button
                      className="absolute top-2 right-2 w-5 h-5 rounded-full bg-black/5 text-gray-500 flex items-center justify-center hover:bg-red-100 hover:text-red-600 transition-colors"
                      onClick={() => toggleQuestion(q.id)}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={selectedQuestions.size === 0}
          >
            确认选择
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
