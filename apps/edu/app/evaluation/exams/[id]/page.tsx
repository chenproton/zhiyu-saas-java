"use client"

import { useState, useMemo, useRef } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, GripVertical, Trash2, Eye, FileText, Wand2, Hand, Plus, Edit, Send, Save, FileUp, MonitorPlay, Rocket, ArrowDownFromLine } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { StatusBadge } from "@/components/shared/status-badge"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { ExamFormDialog } from "@/components/evaluation/exam-form-dialog"
import { RandomQuestionDialog } from "@/components/evaluation/random-question-dialog"
import { ManualQuestionDialog } from "@/components/evaluation/manual-question-dialog"
import { AddQuestionToExamDialog } from "@/components/evaluation/add-question-to-exam-dialog"
import { QuestionPreview } from "@/components/evaluation/question-preview"
import { useData } from "@/components/providers/data-provider"
import type { Question, ExamQuestion, ExamFormData, QuestionType } from "@/lib/types"
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
import { useToast } from "@/hooks/use-toast"
import { PrdAnnotation } from "@/components/prd-annotation"
import { getAnnotation } from "@/lib/prd-annotations"

export default function ExamComposerPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const examId = params.id as string
  const isPreview = searchParams.get('mode') === 'preview'
  const hasSavedRef = useRef(false)
  const isNewExam = searchParams.get('new') === 'true'

  const {
    getExam,
    updateExam,
    deleteExam,
    updateExamStatus,
    addQuestionToExam,
    removeQuestionFromExam,
    updateExamQuestionScore,
    reorderExamQuestions,
  } = useData()

  const exam = getExam(examId)

  const [formOpen, setFormOpen] = useState(false)
  const [previewQuestion, setPreviewQuestion] = useState<ExamQuestion | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<ExamQuestion | null>(null)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [randomDialogOpen, setRandomDialogOpen] = useState(false)
  const [manualDialogOpen, setManualDialogOpen] = useState(false)
  const [addQuestionDialogOpen, setAddQuestionDialogOpen] = useState(false)
  const { toast } = useToast()

  const selectedQuestionIds = useMemo(() => {
    return exam?.questions?.map(q => q.questionId) || []
  }, [exam])

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
  const canDelete = !isPreview && ['draft', 'rejected', 'archived'].includes(exam.status)
  const canSubmit = !isPreview && canPerformAction(exam.status, 'submit')
  const canPublish = !isPreview && canPerformAction(exam.status, 'publish')
  const canUnpublish = !isPreview && canPerformAction(exam.status, 'unpublish')

  const handleExamUpdate = (data: ExamFormData) => {
    updateExam(examId, data)
    hasSavedRef.current = true
  }

  const handleExamDelete = () => {
    deleteExam(examId)
    router.push("/evaluation/exams")
  }

  const handleAddQuestions = (questions: Question[]) => {
    questions.forEach(question => {
      addQuestionToExam(examId, question)
    })
    hasSavedRef.current = true
  }

  const handleAddSingleQuestion = (question: Question) => {
    addQuestionToExam(examId, question)
    hasSavedRef.current = true
  }

  const handleRemoveQuestion = () => {
    if (deleteConfirm) {
      removeQuestionFromExam(examId, deleteConfirm.id)
      setDeleteConfirm(null)
    }
  }

  const handleScoreChange = (questionId: string, score: number) => {
    updateExamQuestionScore(examId, questionId, score)
  }

  // 拖拽排序
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

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes} 分钟`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return mins > 0 ? `${hours} 小时 ${mins} 分钟` : `${hours} 小时`
  }

  // 转换 ExamQuestion 为 Question 格式以供预览
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

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      {/* 返回按钮 */}
      <div className="px-6 pt-4">
        <Button variant="ghost" size="sm" onClick={async () => {
          if (isNewExam && !hasSavedRef.current) {
            try { deleteExam(examId) } catch {}
          }
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
                <div className="flex size-24 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <FileText className="size-8 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-xl">{exam.name}</CardTitle>
                    {!isPreview && <StatusBadge status={exam.status} />}
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
                        修改试卷基本信息
                      </Button>
                    </PrdAnnotation>
                  )}
                  {canSubmit && (
                    <PrdAnnotation {...getAnnotation("ec-btn-submit")}>
                      <Button variant="outline" size="sm" onClick={() => updateExamStatus(examId, 'submit')}>
                        <Send className="mr-1 size-4" />
                        提交审批
                      </Button>
                    </PrdAnnotation>
                  )}
                  {canDelete && (
                    <PrdAnnotation {...getAnnotation("ec-btn-delete")}>
                      <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={handleExamDelete}>
                        <Trash2 className="mr-1 size-4" />
                        删除
                      </Button>
                    </PrdAnnotation>
                  )}
                  {canPublish && (
                    <Button variant="outline" size="sm" className="text-indigo-600 hover:text-indigo-700" onClick={() => updateExamStatus(examId, 'publish')}>
                      <Rocket className="mr-1 size-4" />
                      发布
                    </Button>
                  )}
                  {canUnpublish && (
                    <Button variant="outline" size="sm" className="text-red-500 hover:text-red-600" onClick={() => updateExamStatus(examId, 'unpublish')}>
                      <ArrowDownFromLine className="mr-1 size-4" />
                      取消发布
                    </Button>
                  )}
                  <PrdAnnotation {...getAnnotation("ec-btn-preview")}>
                    <Button variant="outline" size="sm" onClick={() => router.push('/evaluation/landing/resources/exams/exam-1?returnUrl=' + encodeURIComponent('/exams/' + examId))}>
                      <MonitorPlay className="mr-1 size-4" />
                      预览试卷
                    </Button>
                  </PrdAnnotation>
                  <PrdAnnotation {...getAnnotation("ec-btn-save")}>
                    <Button size="sm" onClick={async () => {
                      if (exam.status !== 'draft') {
                        await updateExamStatus(examId, 'save_draft')
                        toast({ title: "保存成功", description: "试卷已保存为草稿" })
                      } else {
                        toast({ title: "保存成功", description: "试卷已保存" })
                      }
                    }}>
                      <Save className="mr-1 size-4" />
                      保存试卷
                    </Button>
                  </PrdAnnotation>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-6 text-sm">
              <div>
                <span className="text-muted-foreground">题目数量:</span>{" "}
                <strong>{exam.questions.length}</strong>
              </div>
              <div>
                <span className="text-muted-foreground">总分:</span>{" "}
                <strong>{exam.totalScore} 分</strong>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 主体 */}
      <div className="flex flex-1 flex-col overflow-hidden">
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAddQuestionDialogOpen(true)}
                >
                  <Plus className="mr-1 size-4" />
                  新增题目
                </Button>
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
                    "group flex items-start gap-3 rounded-lg border bg-card p-4 transition-colors",
                    canEdit && "cursor-move hover:border-primary/50",
                    draggedIndex === index && "opacity-50"
                  )}
                >
                  {canEdit && (
                    <GripVertical className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className="mt-0.5 shrink-0 text-sm font-medium text-muted-foreground">
                    {index + 1}.
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm line-clamp-2">{question.content}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <Badge className={`text-xs text-white hover:opacity-90 ${TYPE_COLORS[question.type]}`}>
                        {QUESTION_TYPE_LABELS[question.type]}
                      </Badge>
                      {canEdit ? (
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            min={1}
                            max={100}
                            value={question.score}
                            onChange={(e) => handleScoreChange(question.id, Number(e.target.value))}
                            className="h-6 w-16 text-xs"
                            onClick={(e) => e.stopPropagation()}
                          />
                          <span className="text-xs text-muted-foreground">分</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">{question.score} 分</span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      onClick={() => setPreviewQuestion(question)}
                    >
                      <Eye />
                    </Button>
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-destructive hover:text-destructive"
                        onClick={() => setDeleteConfirm(question)}
                      >
                        <Trash2 />
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

      <AddQuestionToExamDialog
        open={addQuestionDialogOpen}
        onOpenChange={setAddQuestionDialogOpen}
        onAddQuestion={handleAddSingleQuestion}
      />
    </div>
  )
}
