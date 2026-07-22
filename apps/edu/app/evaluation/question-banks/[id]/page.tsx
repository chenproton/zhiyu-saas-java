"use client"

import { useState, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Plus, Search, Edit, Trash2, Eye, Upload, Copy, Users, Building2, ImageIcon, List, LayoutGrid, FolderInput, MoreHorizontal, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BankFormDialog } from "@/components/evaluation/bank-form-dialog"
import { QuestionFormDialog } from "@/components/evaluation/question-form-dialog"
import { QuestionPreview } from "@/components/evaluation/question-preview"
import { useData } from "@/components/providers/data-provider"
import type { Question, QuestionType, QuestionFormData, QuestionBankFormData } from "@/lib/types"
import { QUESTION_TYPE_LABELS, DIFFICULTY_LABELS } from "@/lib/types"

import { PrdAnnotation } from "@/components/prd-annotation"
import { getAnnotation } from "@/lib/prd-annotations"
import { useToast } from "@/hooks/use-toast"

export default function QuestionBankDetailPage() {
  const params = useParams()
  const router = useRouter()
  const bankId = params.id as string

  const {
    getQuestionBank,
    updateQuestionBank,
    updateQuestionBankStatus,
    deleteQuestionBank,
    getQuestionsByBank,
    createQuestion,
    updateQuestion,
    deleteQuestion,
    moveQuestions,
    questionBanks,
  } = useData()

  const bank = getQuestionBank(bankId)
  const questions = getQuestionsByBank(bankId)
  const { toast } = useToast()

  const [search, setSearch] = useState("")
  const [savingBank, setSavingBank] = useState(false)
  const [typeFilter, setTypeFilter] = useState<QuestionType | "all">("all")
  const [creatorFilter, setCreatorFilter] = useState<string>("all")
  
  const [bankFormOpen, setBankFormOpen] = useState(false)
  const [questionFormOpen, setQuestionFormOpen] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null)
  const [previewQuestion, setPreviewQuestion] = useState<Question | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<Question | null>(null)
  const [selectedQuestions, setSelectedQuestions] = useState<Set<string>>(new Set())
  const [batchDeleteConfirm, setBatchDeleteConfirm] = useState(false)
  const [batchMoveOpen, setBatchMoveOpen] = useState(false)
  const [moveSearch, setMoveSearch] = useState("")
  // 获取题目创建人列表（后端暂无用户姓名查询，直接展示 ID）
  const creators = useMemo(() => {
    const creatorIds = new Set(questions.map(q => q.creatorId).filter(Boolean))
    return Array.from(creatorIds).map((id) => ({ id: id as string, name: id as string }))
  }, [questions])

  const filteredQuestions = useMemo(() => {
    return questions
      .filter((q) => {
        const matchSearch = q.content.toLowerCase().includes(search.toLowerCase())
        const matchType = typeFilter === "all" || q.type === typeFilter
        const matchCreator = creatorFilter === "all" || q.creatorId === creatorFilter
        return matchSearch && matchType && matchCreator
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  }, [questions, search, typeFilter, creatorFilter])

  if (!bank) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-semibold">题库不存在</h2>
          <p className="mb-4 text-muted-foreground">该题库可能已被删除</p>
          <Button asChild>
            <Link href="/evaluation/question-banks">返回题库列表</Link>
          </Button>
        </div>
      </div>
    )
  }

  const isDraftPool = bank.isDraftPool === true
  const canEdit = true // 所有题库均可编辑题目

  const handleBankUpdate = (data: QuestionBankFormData) => {
    updateQuestionBank(bankId, data)
  }

  const handleBankDelete = () => {
    deleteQuestionBank(bankId)
    router.push("/evaluation/question-banks")
  }

  const handleSaveBank = async () => {
    if (bank.status !== "draft") {
      setSavingBank(true)
      try {
        await updateQuestionBankStatus(bankId, "save_draft")
        toast({ title: "保存成功", description: "题库已退回草稿状态" })
      } catch (err: any) {
        toast({ variant: "destructive", title: "保存失败", description: err.message || "请稍后重试" })
      } finally {
        setSavingBank(false)
      }
    } else {
      toast({ title: "保存成功", description: "题库状态无需变更" })
    }
  }

  const handleQuestionSubmit = (data: QuestionFormData) => {
    if (editingQuestion) {
      updateQuestion(editingQuestion.id, data)
    } else {
      createQuestion(bankId, data)
    }
    setEditingQuestion(null)
  }

  const handleQuestionEdit = (question: Question) => {
    setEditingQuestion(question)
    setQuestionFormOpen(true)
  }

  const handleQuestionDelete = () => {
    if (deleteConfirm) {
      deleteQuestion(deleteConfirm.id)
      setDeleteConfirm(null)
    }
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedQuestions(new Set(filteredQuestions.map(q => q.id)))
    } else {
      setSelectedQuestions(new Set())
    }
  }

  const handleSelectQuestion = (questionId: string, checked: boolean) => {
    const newSelected = new Set(selectedQuestions)
    if (checked) {
      newSelected.add(questionId)
    } else {
      newSelected.delete(questionId)
    }
    setSelectedQuestions(newSelected)
  }

  const handleBatchDelete = () => {
    selectedQuestions.forEach(id => {
      deleteQuestion(id)
    })
    setSelectedQuestions(new Set())
    setBatchDeleteConfirm(false)
  }

  const handleBatchCopy = () => {
    selectedQuestions.forEach(id => {
      const question = questions.find(q => q.id === id)
      if (question) {
        createQuestion(bankId, {
          type: question.type,
          content: question.content + " (复制)",
          options: question.options,
          answer: question.answer,
          analysis: question.analysis,
          score: question.score,
          difficulty: question.difficulty,
          knowledgePoints: question.knowledgePoints,
        })
      }
    })
    setSelectedQuestions(new Set())
  }

  const handleBatchMove = (targetBankId: string) => {
    moveQuestions(Array.from(selectedQuestions), targetBankId)
    setSelectedQuestions(new Set())
    setBatchMoveOpen(false)
  }

  const handleCopyQuestion = (question: Question) => {
    createQuestion(bankId, {
      type: question.type,
      content: question.content + " (复制)",
      options: question.options,
      answer: question.answer,
      analysis: question.analysis,
      score: question.score,
      difficulty: question.difficulty,
      knowledgePoints: question.knowledgePoints,
    })
  }

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date)
  }

  const getCollaboratorNames = () => (bank.collaboratorNames || bank.collaboratorIds || []).filter(Boolean)

  const getCollaboratorDeptNames = () => (bank.collaboratorDeptIds || []).filter(Boolean)

  return (
    <div className="p-6">
      {/* 返回按钮 */}
      <div className="mb-4">
        <Button variant="ghost" size="sm" onClick={() => router.push("/evaluation/question-banks")}>
          <ArrowLeft />
          返回题库列表
        </Button>
      </div>

      {/* 题库信息卡片 */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex gap-4">
              {/* 封面 */}
              {bank.coverImage ? (
                <div className="shrink-0 overflow-hidden rounded-lg">
                  <img
                    src={bank.coverImage}
                    alt={bank.name}
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
                  <CardTitle className="text-xl">{bank.name}</CardTitle>
                  {isDraftPool && (
                    <span className="shrink-0 rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                      草稿库
                    </span>
                  )}
                  <Badge variant="outline">{bank.version}</Badge>
                </div>
                <CardDescription className="mt-2">
                  {bank.description || "暂无描述"}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBankFormOpen(true)}
              >
                <Edit className="mr-1 size-3.5" />
                编辑信息
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-6 text-sm">
            <div>
              <span className="text-muted-foreground">创建人:</span>{" "}
              <strong>{bank.creatorName || bank.creatorId || "-"}</strong>
            </div>
            <div>
              <span className="text-muted-foreground">题目数量:</span>{" "}
              <strong>{bank.questionCount}</strong>
            </div>
            <div>
              <span className="text-muted-foreground">创建时间:</span>{" "}
              {formatDate(bank.createdAt)}
            </div>
            <div>
              <span className="text-muted-foreground">更新时间:</span>{" "}
              {formatDate(bank.updatedAt)}
            </div>
          </div>
          {/* 共建人/共建部门 */}
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

      {/* 题目管理标题 + Tab + 按钮 */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold">题目列表</h2>
          <Tabs value={typeFilter} onValueChange={(v) => setTypeFilter(v as QuestionType | "all")}>
            <TabsList className="h-8">
              <TabsTrigger value="all" className="text-xs">全部</TabsTrigger>
              {(Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]).map((type) => (
                <TabsTrigger key={type} value={type} className="text-xs">
                  {QUESTION_TYPE_LABELS[type]}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleSaveBank} disabled={savingBank}>
            <Save className="mr-1 size-3.5" />
            {savingBank ? "保存中..." : "保存题库"}
          </Button>
          <PrdAnnotation data={getAnnotation("qbd-btn-import")}>
            <Button variant="outline" size="sm" disabled title="题目导入功能开发中">
              <Upload className="mr-1 size-3.5" />
              导入题目
            </Button>
          </PrdAnnotation>
          <PrdAnnotation data={getAnnotation("qbd-btn-add-question")}>
            <Button size="sm" onClick={() => { setEditingQuestion(null); setQuestionFormOpen(true) }}>
              <Plus className="mr-1 size-3.5" />
              添加题目
            </Button>
          </PrdAnnotation>
        </div>
      </div>

      {/* 批量操作栏 */}
      {selectedQuestions.size > 0 && canEdit && (
        <div className="mb-4 flex items-center gap-4 rounded-lg border bg-muted/50 px-4 py-2">
          <span className="text-sm text-muted-foreground">
            已选择 {selectedQuestions.size} 道题目
          </span>
          <Button variant="outline" size="sm" onClick={handleBatchCopy}>
            <Copy className="mr-1 size-3" />
            批量复制
          </Button>
          <Button variant="outline" size="sm" onClick={() => setBatchMoveOpen(true)}>
            <FolderInput className="mr-1 size-3" />
            批量移动
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => setBatchDeleteConfirm(true)}
          >
            <Trash2 className="mr-1 size-3" />
            批量删除
          </Button>
        </div>
      )}

      {/* 搜索 + 创建人筛选 */}
      <div className="mb-4 flex items-center gap-2">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜索题目内容..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {creators.length > 0 && (
          <Select value={creatorFilter} onValueChange={setCreatorFilter}>
            <SelectTrigger className="h-9 w-[140px]">
              <SelectValue placeholder="全部创建人" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">全部创建人</SelectItem>
                {creators.map((creator) => (
                  <SelectItem key={creator.id} value={creator.id}>
                    {creator.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        )}
      </div>

      {/* 题目列表 */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              {canEdit && (
                <TableHead className="w-[50px]">
                  <Checkbox
                    checked={filteredQuestions.length > 0 && selectedQuestions.size === filteredQuestions.length}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
              )}
              <TableHead className="w-[40%]">
                <PrdAnnotation data={getAnnotation("qbd-col-content")}>题目内容</PrdAnnotation>
              </TableHead>
              <TableHead className="w-[100px]">
                <PrdAnnotation data={getAnnotation("qbd-col-type")}>题型</PrdAnnotation>
              </TableHead>
              <TableHead className="w-[80px]">
                <PrdAnnotation data={getAnnotation("qbd-col-difficulty")}>难度</PrdAnnotation>
              </TableHead>
              <TableHead className="w-[100px]">
                <PrdAnnotation data={getAnnotation("qbd-col-source")}>添加来源</PrdAnnotation>
              </TableHead>
              <TableHead className="w-[120px]">创建时间</TableHead>
              <TableHead className="w-[120px] text-right">
                <PrdAnnotation data={getAnnotation("qbd-col-actions")}>操作</PrdAnnotation>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredQuestions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canEdit ? 7 : 6} className="h-24 text-center text-muted-foreground">
                  {questions.length === 0 ? "暂无题目，点击上方按钮添加" : "没有找到匹配的题目"}
                </TableCell>
              </TableRow>
            ) : (
              filteredQuestions.map((question) => (
                <TableRow key={question.id}>
                  {canEdit && (
                    <TableCell>
                      <Checkbox
                        checked={selectedQuestions.has(question.id)}
                        onCheckedChange={(checked) => handleSelectQuestion(question.id, !!checked)}
                      />
                    </TableCell>
                  )}
                  <TableCell>
                    <p className="line-clamp-2">{question.content}</p>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {QUESTION_TYPE_LABELS[question.type]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {question.difficulty && (
                      <Badge variant="outline">
                        {DIFFICULTY_LABELS[question.difficulty]}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">{question.source || '-'}</span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(question.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8">
                          <MoreHorizontal className="size-4" />
                          <span className="sr-only">操作菜单</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setPreviewQuestion(question)}>
                          预览
                        </DropdownMenuItem>
                        {canEdit && (
                          <>
                            <DropdownMenuItem onClick={() => handleCopyQuestion(question)}>
                              复制
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleQuestionEdit(question)}>
                              编辑
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setDeleteConfirm(question)}
                              className="text-destructive focus:text-destructive"
                            >
                              删除
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* 弹窗 */}
      <BankFormDialog
        open={bankFormOpen}
        onOpenChange={setBankFormOpen}
        bank={bank}
        onSubmit={handleBankUpdate}
      />

      <QuestionFormDialog
        open={questionFormOpen}
        onOpenChange={setQuestionFormOpen}
        question={editingQuestion}
        onSubmit={handleQuestionSubmit}
      />

      <QuestionPreview
        open={!!previewQuestion}
        onOpenChange={(open) => !open && setPreviewQuestion(null)}
        question={previewQuestion}
      />

      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
        title="确认删除"
        description="删除后将无法恢复。确定要删除这道题目吗？"
        variant="destructive"
        onConfirm={handleQuestionDelete}
      />

      <ConfirmDialog
        open={batchDeleteConfirm}
        onOpenChange={setBatchDeleteConfirm}
        title="批量删除"
        description={`确定要删除选中的 ${selectedQuestions.size} 道题目吗？此操作不可撤销。`}
        variant="destructive"
        onConfirm={handleBatchDelete}
      />

      {/* 批量移动弹窗 */}
      {batchMoveOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg border bg-white p-6 shadow-lg">
            <h3 className="text-lg font-semibold">批量移动题目</h3>
            <p className="mt-1 text-sm text-muted-foreground">选择目标题库，将选中的 {selectedQuestions.size} 道题目移动过去</p>
            <div className="relative mt-4">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="搜索题库名称..."
                value={moveSearch}
                onChange={(e) => setMoveSearch(e.target.value)}
                className="h-9 pl-9 text-sm"
              />
            </div>
            <div className="mt-3 max-h-60 overflow-auto">
              {questionBanks
                .filter(b => b.id !== bankId && !b.isDraftPool && b.name.toLowerCase().includes(moveSearch.toLowerCase()))
                .map(bank => (
                  <button
                    key={bank.id}
                    className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
                    onClick={() => handleBatchMove(bank.id)}
                  >
                    <div className="flex size-8 items-center justify-center rounded bg-blue-50">
                      <ImageIcon className="size-4 text-blue-600" />
                    </div>
                    <div>
                      <div className="font-medium">{bank.name}</div>
                      <div className="text-xs text-muted-foreground">{bank.questionCount} 题</div>
                    </div>
                  </button>
                ))}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => { setBatchMoveOpen(false); setMoveSearch("") }}>取消</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
