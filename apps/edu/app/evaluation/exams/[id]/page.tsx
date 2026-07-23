"use client"

import { useState, useMemo, useCallback } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, GripVertical, Trash2, Eye, FileText, Wand2, Hand, Plus, Edit, FileUp, Rocket, ImageIcon, Users, Building2, SlidersHorizontal, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { ExamFormDialog } from "@/components/evaluation/exam-form-dialog"
import { RandomQuestionDialog } from "@/components/evaluation/random-question-dialog"
import { ManualQuestionDialog } from "@/components/evaluation/manual-question-dialog"
import { QuestionFormDialog } from "@/components/evaluation/question-form-dialog"
import { QuestionPreview } from "@/components/evaluation/question-preview"
import { ScoreConfigDialog } from "@/components/evaluation/score-config-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useData } from "@/components/providers/data-provider"
import type { Question, ExamQuestion, ExamFormData, QuestionType, QuestionFormData } from "@/lib/types"
import { QUESTION_TYPE_LABELS, canPerformAction } from "@/lib/types"

const TYPE_COLORS: Record<QuestionType, string> = {
  single: "bg-blue-500",
  multiple: "bg-indigo-500",
  judge: "bg-amber-500",
  fill: "bg-purple-500",
  essay: "bg-rose-500",
  short_answer: "bg-teal-500",
}
import { cn } from "@/lib/utils"
import { PrdAnnotation } from "@/components/prd-annotation"
import { getAnnotation } from "@/lib/prd-annotations"

export default function ExamComposerPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const examId = params.id as string
  const isPreview = searchParams.get('mode') === 'preview'
  const {
    getExam,
    updateExam,
    updateExamStatus,
    addQuestionToExam,
    removeQuestionFromExam,
    updateExamQuestionScore,
    updateExamQuestionScores,
    reorderExamQuestions,
    questionBanks,
    createQuestion,
  } = useData()

  const exam = getExam(examId)

  const draftPoolBank = useMemo(() => {
    return questionBanks.find(b => b.isDraftPool === true)
  }, [questionBanks])

  const [formOpen, setFormOpen] = useState(false)
  const [previewQuestion, setPreviewQuestion] = useState<ExamQuestion | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<ExamQuestion | null>(null)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [randomDialogOpen, setRandomDialogOpen] = useState(false)
  const [manualDialogOpen, setManualDialogOpen] = useState(false)
  const [questionFormOpen, setQuestionFormOpen] = useState(false)
  const [defaultQuestionType, setDefaultQuestionType] = useState<QuestionType>("single")
  const [scoreTypeDialogOpen, setScoreTypeDialogOpen] = useState(false)
  const [editScores, setEditScores] = useState<Record<string, string>>({})
  const [savingScoreId, setSavingScoreId] = useState<string | null>(null)

  const selectedQuestionIds = useMemo(() => {
    return exam?.questions?.map(q => q.questionId) || []
  }, [exam])

  const commitScore = useCallback((questionId: string) => {
    const raw = editScores[questionId]
    if (raw === undefined) return
    const score = Number(raw)
    if (isNaN(score) || score <= 0) return
    setSavingScoreId(questionId)
    updateExamQuestionScore(examId, questionId, score).finally(() => {
      setSavingScoreId(null)
      setEditScores((prev) => {
        const next = { ...prev }
        delete next[questionId]
        return next
      })
    })
  }, [examId, editScores, updateExamQuestionScore])

  const handleScoreKeyDown = useCallback((e: React.KeyboardEvent, questionId: string) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      commitScore(questionId)
    } else if (e.key === 'Escape') {
      setEditScores((prev) => {
        const next = { ...prev }
        delete next[questionId]
        return next
      })
    }
  }, [commitScore])

  const totalScore = useMemo(() => {
    return exam?.questions?.reduce((sum, q) => sum + (q.score || 0), 0) ?? 0
  }, [exam?.questions])

  if (!exam) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-semibold">试卷不存在</h2>
          <p className="mb-4 text-muted-foreground">该试卷可能已被删除</p>
          <Button asChild>
            <Link href="/evaluation/exams">返回组卷列表</Link>
          </Button>
        </div>
      </div>
    )
  }

  const canEdit = !isPreview && ['draft', 'rejected', 'approved', 'published'].includes(exam.status)
  const canPublish = !isPreview && canPerformAction(exam.status, 'publish')

  const handleExamUpdate = (data: ExamFormData) => {
    updateExam(examId, data)
  }

  const handleAddQuestions = (questions: Question[]) => {
    questions.forEach(question => {
      addQuestionToExam(examId, question)
    })
  }

  const handleAddSingleQuestion = (question: Question) => {
    addQuestionToExam(examId, question)
  }

  const handleCreateQuestion = async (data: QuestionFormData) => {
    if (!draftPoolBank) return
    const newQuestion = await createQuestion(draftPoolBank.id, data)
    addQuestionToExam(examId, newQuestion)
  }

  const handleRemoveQuestion = () => {
    if (deleteConfirm) {
      removeQuestionFromExam(examId, deleteConfirm.id)
      setDeleteConfirm(null)
    }
  }

  const toPreviewQuestion = (eq: ExamQuestion): Question => ({
    id: eq.id,
    bankId: '',
    type: eq.type,
    content: eq.content,
    options: eq.options,
    answer: eq.answer,
    analysis: eq.analysis,
    score: eq.score,
    status: 'published',
    createdAt: new Date(),
  })

  const handleDragStart = (index: number) => {
    setDraggedIndex(index)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === index) return

    const newQuestions = [...exam.questions]
    const [dragged] = newQuestions.splice(draggedIndex, 1)
    newQuestions.splice(index, 0, dragged)
    
    reorderExamQuestions(examId, newQuestions)
    setDraggedIndex(index)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
  }

  const handleEvenDistribution = () => {
    const qs = exam.questions
    if (qs.length === 0) return
    const n = qs.length
    const base = Math.floor(100 / n)
    const remainder = 100 - base * n
    const scores: Record<string, number> = {}
    qs.forEach((q, i) => {
      scores[q.questionId] = base + (i < remainder ? 1 : 0)
    })
    updateExamQuestionScores(examId, scores)
  }

  const handleTypeDistribution = (scores: Record<string, number>) => {
    updateExamQuestionScores(examId, scores)
  }

  const handleProportionalDistribution = () => {
    const qs = exam.questions
    if (qs.length === 0) return
    const total = qs.reduce((sum, q) => sum + (q.score || 0), 0)
    if (total <= 0) {
      handleEvenDistribution()
      return
    }
    const raw = qs.map((q) => ((q.score || 0) / total) * 100)
    const floored = raw.map((r) => Math.floor(r))
    let sumFloored = floored.reduce((s, v) => s + v, 0)
    const remainders = raw.map((r, i) => ({ idx: i, rem: r - Math.floor(r) }))
    remainders.sort((a, b) => b.rem - a.rem)
    let ri = 0
    while (sumFloored < 100 && ri < remainders.length) {
      floored[remainders[ri].idx]++
      sumFloored++
      ri++
    }
    const scores: Record<string, number> = {}
    qs.forEach((q, i) => {
      scores[q.questionId] = floored[i]
    })
    updateExamQuestionScores(examId, scores)
  }

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes} 分钟`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return mins > 0 ? `${hours} 小时 ${mins} 分钟` : `${hours} 小时`
  }

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date)
  }

  const getCollaboratorNames = () => (exam.collaboratorNames || exam.collaboratorIds || []).filter(Boolean)
  const getCollaboratorDeptNames = () => (exam.collaboratorDeptIds || []).filter(Boolean)

  // 转换 ExamQuestion 为 Question 格式以供预览
  // (defined above)

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col">
      {/* 返回按钮 */}
      <div className="px-6 pt-4">
        <Button variant="ghost" size="sm" onClick={() => {
          if (isPreview) {
            router.back()
          } else {
            router.push("/evaluation/exams")
          }
        }}>
          <ArrowLeft />
          {isPreview ? "返回" : "返回组卷列表"}
        </Button>
      </div>

      {/* 试卷信息卡片 */}
      <div className="px-6 pt-4">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex gap-4">
                {exam.coverImage ? (
                  <div className="shrink-0 overflow-hidden rounded-lg">
                    <img
                      src={exam.coverImage}
                      alt={exam.name}
                      className="size-24 object-cover"
                    />
                  </div>
                ) : (
                  <div className="flex size-24 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <ImageIcon className="size-8 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-xl">{exam.name}</CardTitle>
                    <Badge variant="outline">{exam.version}</Badge>
                  </div>
                  <CardDescription className="mt-2">
                    {exam.description || "暂无描述"}
                  </CardDescription>
                </div>
              </div>
              {!isPreview && (
                <div className="flex items-start gap-2">
                  {canEdit && (
                    <PrdAnnotation {...getAnnotation("ec-btn-edit-info")}>
                      <Button variant="outline" size="sm" onClick={() => setFormOpen(true)}>
                        <Edit className="mr-1 size-4" />
                        编辑信息
                      </Button>
                    </PrdAnnotation>
                  )}
                  {canPublish && (
                    <Button variant="outline" size="sm" className="text-indigo-600 hover:text-indigo-700" onClick={() => updateExamStatus(examId, 'publish')}>
                      <Rocket className="mr-1 size-4" />
                      发布
                    </Button>
                  )}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-6 text-sm">
              <div>
                <span className="text-muted-foreground">创建人:</span>{" "}
                <strong>{exam.creatorName || exam.creatorId || "-"}</strong>
              </div>
              <div>
                <span className="text-muted-foreground">题目数量:</span>{" "}
                <strong>{exam.questions.length}</strong>
              </div>
              <div>
                <span className="text-muted-foreground">总分:</span>{" "}
                <strong>{totalScore} 分</strong>
              </div>
              <div>
                <span className="text-muted-foreground">创建时间:</span>{" "}
                {formatDate(exam.createdAt)}
              </div>
              <div>
                <span className="text-muted-foreground">更新时间:</span>{" "}
                {formatDate(exam.updatedAt)}
              </div>
            </div>
            {(getCollaboratorNames().length > 0 || getCollaboratorDeptNames().length > 0) && (
              <div className="mt-4 flex flex-wrap gap-4 border-t pt-4">
                {getCollaboratorNames().length > 0 && (
                  <div className="flex items-center gap-2">
                    <Users className="size-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">共建人:</span>
                    <div className="flex flex-wrap gap-1">
                      {getCollaboratorNames().map((name, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {getCollaboratorDeptNames().length > 0 && (
                  <div className="flex items-center gap-2">
                    <Building2 className="size-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">共建部门:</span>
                    <div className="flex flex-wrap gap-1">
                      {getCollaboratorDeptNames().map((name, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 主体 */}
      <div className="flex flex-1 flex-col">
        {/* 工具栏 */}
        <div className="flex items-center justify-between border-b px-6 py-3">
          <div>
            <h3 className="font-semibold">试卷题目</h3>
            <p className="text-sm text-muted-foreground">
              {canEdit ? "拖拽调整顺序，点击分值可修改" : "查看试卷题目"}
            </p>
          </div>
          {canEdit && (
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm">
                    <SlidersHorizontal className="mr-1 size-4" />
                    分数配置
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-72">
                  <DropdownMenuItem onClick={handleEvenDistribution}>
                    <div>
                      <div className="font-medium">均匀分配</div>
                      <div className="text-xs text-muted-foreground">
                        将 100 分均匀分给每道题，余数从第一题起依次加 1 分
                      </div>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setScoreTypeDialogOpen(true)}>
                    <div>
                      <div className="font-medium">题型分配</div>
                      <div className="text-xs text-muted-foreground">
                        为每种题型分配总分（合计 100），各题型内均匀分配
                      </div>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleProportionalDistribution}>
                    <div>
                      <div className="font-medium">等比分配</div>
                      <div className="text-xs text-muted-foreground">
                        按当前每题分数的比例缩放至总分 100 分
                      </div>
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <PrdAnnotation {...getAnnotation("ec-btn-random")}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRandomDialogOpen(true)}
                >
                  <Wand2 className="mr-1 size-4" />
                  自动抽题
                </Button>
              </PrdAnnotation>
              <PrdAnnotation {...getAnnotation("ec-btn-manual")}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setManualDialogOpen(true)}
                >
                  <Hand className="mr-1 size-4" />
                  手动抽题
                </Button>
              </PrdAnnotation>
              <PrdAnnotation {...getAnnotation("ec-btn-add-question")}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Plus className="mr-1 size-4" />
                      新增题目
                      <ChevronDown className="ml-1 size-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {(Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]).map((type) => (
                      <DropdownMenuItem
                        key={type}
                        onClick={() => {
                          setDefaultQuestionType(type)
                          setQuestionFormOpen(true)
                        }}
                      >
                        {QUESTION_TYPE_LABELS[type]}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </PrdAnnotation>
              <PrdAnnotation {...getAnnotation("ec-btn-batch-import")}>
                <Button
                  variant="outline"
                  size="sm"
                  disabled
                  title="批量导入题目功能开发中"
                >
                  <FileUp className="mr-1 size-4" />
                  批量导入题目
                </Button>
              </PrdAnnotation>
            </div>
          )}
        </div>

        {/* 题目列表 */}
        <ScrollArea className="flex-1">
          {exam.questions.length === 0 ? (
            <div className="flex h-full items-center justify-center p-8 text-center">
              <div>
                <FileText className="mx-auto mb-2 size-12 text-muted-foreground/50" />
                <p className="text-muted-foreground">暂无题目</p>
                {canEdit && (
                  <p className="text-sm text-muted-foreground">
                    点击上方按钮抽取或新增题目
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2 p-6">
              {exam.questions.map((question, index) => (
                <div
                  key={question.id}
                  draggable={canEdit}
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  className={cn(
                    "group flex items-center gap-3 rounded-lg border bg-card py-2.5 px-3 transition-colors",
                    canEdit && "cursor-move hover:border-primary/50",
                    draggedIndex === index && "opacity-50"
                  )}
                >
                  {canEdit && (
                    <GripVertical className="size-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className="shrink-0 text-xs font-medium text-muted-foreground w-5">
                    {index + 1}.
                  </span>
                  <p className="flex-1 text-sm line-clamp-1 min-w-0">{question.content}</p>
                  <Badge className={`text-xs text-white shrink-0 hover:opacity-90 ${TYPE_COLORS[question.type]}`}>
                    {QUESTION_TYPE_LABELS[question.type]}
                  </Badge>
                  {canEdit ? (
                    <div className="flex items-center gap-1 shrink-0">
                      <Input
                        type="number"
                        min={0.5}
                        step={0.5}
                        value={editScores[question.id] ?? String(question.score)}
                        onChange={(e) => setEditScores((prev) => ({ ...prev, [question.id]: e.target.value }))}
                        onBlur={() => commitScore(question.id)}
                        onKeyDown={(e) => handleScoreKeyDown(e, question.id)}
                        className="h-6 w-14 text-xs"
                        disabled={savingScoreId === question.id}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <span className="text-xs text-muted-foreground">分</span>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground shrink-0">{question.score} 分</span>
                  )}
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      onClick={() => setPreviewQuestion(question)}
                    >
                      <Eye className="size-3.5" />
                    </Button>
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-destructive hover:text-destructive"
                        onClick={() => setDeleteConfirm(question)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* 弹窗 */}
      <ExamFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        exam={exam}
        onSubmit={handleExamUpdate}
      />

      {previewQuestion && (
        <QuestionPreview
          open={!!previewQuestion}
          onOpenChange={(open) => !open && setPreviewQuestion(null)}
          question={toPreviewQuestion(previewQuestion)}
        />
      )}

      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
        title="移除题目"
        description="确定要从试卷中移除这道题目吗？"
        variant="destructive"
        onConfirm={handleRemoveQuestion}
      />

      <RandomQuestionDialog
        open={randomDialogOpen}
        onOpenChange={setRandomDialogOpen}
        selectedQuestionIds={selectedQuestionIds}
        onAddQuestions={handleAddQuestions}
      />

      <ManualQuestionDialog
        open={manualDialogOpen}
        onOpenChange={setManualDialogOpen}
        selectedQuestionIds={selectedQuestionIds}
        onAddQuestions={handleAddQuestions}
      />

      <QuestionFormDialog
        open={questionFormOpen}
        onOpenChange={setQuestionFormOpen}
        defaultType={defaultQuestionType}
        onSubmit={handleCreateQuestion}
      />

      <ScoreConfigDialog
        open={scoreTypeDialogOpen}
        onOpenChange={setScoreTypeDialogOpen}
        questions={exam.questions}
        onApply={handleTypeDistribution}
      />
    </div>
  )
}
