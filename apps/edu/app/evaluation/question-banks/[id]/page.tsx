"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { ArrowLeft, Plus, Search, Edit, Trash2, Eye, Upload, Copy, Users, Building2, ImageIcon, List, LayoutGrid, FolderInput, ChevronDown, FileDown, Loader2 } from "lucide-react"
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
import { ImportConfirmDialog } from "@/components/shared/import-confirm-dialog"
import type { ImportPreviewResult } from "@/lib/api"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { importExportApi } from "@/lib/api"
import { useToast } from "@zhiyu/ui"
import type { Question, QuestionType, QuestionFormData, QuestionBankFormData } from "@/lib/types"
import { QUESTION_TYPE_LABELS, DIFFICULTY_LABELS } from "@/lib/types"

const TYPE_COLORS: Record<QuestionType, string> = {
  single: "bg-blue-500",
  multiple: "bg-indigo-500",
  judge: "bg-amber-500",
  fill: "bg-purple-500",
  essay: "bg-rose-500",
  short_answer: "bg-teal-500",
}
import { TableRowActions } from "@/components/shared/table-row-actions"

export default function QuestionBankDetailPage() {
  const params = useParams()
  const router = useRouter()
  const bankId = params.id as string
  const { toast } = useToast()

  const {
    getQuestionBank,
    updateQuestionBank,
    deleteQuestionBank,
    questions: allQuestions,
    getQuestionsByBank,
    createQuestion,
    updateQuestion,
    deleteQuestion,
    moveQuestions,
    questionBanks,
    loadBankQuestions,
    evaluationLoading,
  } = useData()

  const bank = getQuestionBank(bankId)

  useEffect(() => {
    if (bankId) {
      loadBankQuestions?.(bankId)
    }
  }, [bankId, loadBankQuestions])

  const questions = getQuestionsByBank(bankId)

  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState<QuestionType | "all">("all")
  const [creatorFilter, setCreatorFilter] = useState<string>("all")
  
  const [bankFormOpen, setBankFormOpen] = useState(false)
  const [questionFormOpen, setQuestionFormOpen] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null)
  const [defaultQuestionType, setDefaultQuestionType] = useState<QuestionType>("single")
  const [previewQuestion, setPreviewQuestion] = useState<Question | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<Question | null>(null)
  const [selectedQuestions, setSelectedQuestions] = useState<Set<string>>(new Set())
  const [batchDeleteConfirm, setBatchDeleteConfirm] = useState(false)
  const [batchMoveOpen, setBatchMoveOpen] = useState(false)
  const [moveSearch, setMoveSearch] = useState("")
  const [isExporting, setIsExporting] = useState(false)

  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [importStep, setImportStep] = useState<"download" | "upload">("download")
  const [isDownloading, setIsDownloading] = useState(false)
  const [isImportConfirmOpen, setIsImportConfirmOpen] = useState(false)
  const [importPreview, setImportPreview] = useState<ImportPreviewResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  // 获取题目创建人列表（后端暂无用户姓名查询，直接展示 ID）
  const creators = useMemo(() => {
    const creatorIds = new Set(questions.map(q => q.creatorId).filter(Boolean))
    return Array.from(creatorIds).map((id) => ({ id: id as string, name: id as string }))
  }, [questions])

  // 题库题目数量从已加载的题目实时计算（后端 question_count 未维护）
  const questionCountByBank = useMemo(() => {
    const counts = new Map<string, number>()
    for (const q of allQuestions) {
      counts.set(q.bankId, (counts.get(q.bankId) || 0) + 1)
    }
    return counts
  }, [allQuestions])

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
    if (evaluationLoading) {
      return (
        <div className="flex h-[50vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )
    }
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

  const handleImportFileSelect = (files: FileList | null) => {
    const file = files?.[0]
    if (file) setImportFile(file)
  }

  const executeImport = async (overwrite = false) => {
    if (!importFile) return
    setIsImporting(true)
    try {
      const result = await importExportApi.importExcel(`question-banks/${bankId}/questions`, importFile, overwrite)
      const errorHint = result.errors && result.errors.length > 0 ? `，错误：${result.errors.slice(0, 3).join(";")}` : ""
      toast({ title: "导入完成", description: `成功 ${result.created} 条，失败 ${result.failed || 0} 条，跳过 ${result.skipped || 0} 条${errorHint}` })
      setImportFile(null)
      setIsImportDialogOpen(false)
      setImportStep("download")
      setIsImportConfirmOpen(false)
      setImportPreview(null)
      await loadBankQuestions?.(bankId)
    } catch (err: any) {
      toast({ variant: "destructive", title: "导入失败", description: err.message || "导入失败" })
    } finally {
      setIsImporting(false)
    }
  }

  const handleImport = async () => {
    if (!importFile) return
    setIsImporting(true)
    try {
      const preview = await importExportApi.importExcelPreview(`question-banks/${bankId}/questions`, importFile)
      if (preview.duplicates > 0) {
        setImportPreview(preview)
        setIsImportConfirmOpen(true)
        setIsImporting(false)
        return
      }
      await executeImport(false)
    } catch (err: any) {
      toast({ variant: "destructive", title: "导入失败", description: err.message || "导入失败" })
      setIsImporting(false)
    }
  }

  const handleDownloadTemplate = async () => {
    setIsDownloading(true)
    try {
      const res = await importExportApi.downloadQuestionTemplate(bankId)
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "题目批量导入模板.xlsx"
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (err: any) {
      toast({ variant: "destructive", title: "下载模板失败", description: err.message || "下载模板失败" })
    } finally {
      setIsDownloading(false)
    }
  }

  const handleBankUpdate = (data: QuestionBankFormData) => {
    updateQuestionBank(bankId, data)
  }

  const handleBankDelete = () => {
    deleteQuestionBank(bankId)
    router.push("/evaluation/question-banks")
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
    setDefaultQuestionType(question.type)
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

  const handleBatchExport = async () => {
    if (selectedQuestions.size === 0) return
    setIsExporting(true)
    try {
      const res = await importExportApi.exportQuestionsExcel(bankId, Array.from(selectedQuestions))
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `HTTP ${res.status}`)
      }
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `题目导出_${bankId}.xlsx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      toast({ title: "导出成功", description: `已导出 ${selectedQuestions.size} 道题目` })
    } catch (err: any) {
      toast({ title: "导出失败", description: err.message || "请稍后重试", variant: "destructive" })
    } finally {
      setIsExporting(false)
    }
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
                <div className="relative shrink-0 size-24 overflow-hidden rounded-lg">
                  <Image
                    src={bank.coverImage}
                    alt={bank.name}
                    fill
                    className="object-cover"
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
              {!isDraftPool && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setBankFormOpen(true)}
                >
                  <Edit className="mr-1 size-3.5" />
                  编辑信息
                </Button>
              )}
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
          <Button variant="outline" size="sm" onClick={() => setIsImportDialogOpen(true)}>
              <Upload className="mr-1 size-3.5" />
              导入题目
            </Button>
          <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-1 size-3.5" />
                  添加题目
                  <ChevronDown className="ml-1 size-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {(Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]).map((type) => (
                  <DropdownMenuItem
                    key={type}
                    onClick={() => {
                      setEditingQuestion(null)
                      setDefaultQuestionType(type)
                      setQuestionFormOpen(true)
                    }}
                  >
                    {QUESTION_TYPE_LABELS[type]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
        </div>
      </div>

      {/* 搜索 + 创建人筛选 + 批量操作 */}
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
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
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleBatchExport} disabled={selectedQuestions.size === 0 || isExporting}>
            <FileDown className="mr-1 size-3" />
            {isExporting ? "导出中..." : "批量导出"}
          </Button>
          <Button variant="outline" size="sm" onClick={handleBatchCopy} disabled={selectedQuestions.size === 0}>
            <Copy className="mr-1 size-3" />
            批量复制
          </Button>
          <Button variant="outline" size="sm" onClick={() => setBatchMoveOpen(true)} disabled={selectedQuestions.size === 0}>
            <FolderInput className="mr-1 size-3" />
            批量移动
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => setBatchDeleteConfirm(true)}
            disabled={selectedQuestions.size === 0}
          >
            <Trash2 className="mr-1 size-3" />
            批量删除
          </Button>
        </div>
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
                题目内容
              </TableHead>
              <TableHead className="w-[100px]">
                题型
              </TableHead>
              <TableHead className="w-[80px]">
                难度
              </TableHead>
              <TableHead className="w-[100px]">
                添加来源
              </TableHead>
              <TableHead className="w-[120px]">创建时间</TableHead>
              <TableHead className="w-[120px] text-right">
                操作
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
                <TableRow key={question.id} className="group">
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
                    <Badge className={`text-xs text-white hover:opacity-90 ${TYPE_COLORS[question.type]}`}>
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
                  <TableRowActions>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => setPreviewQuestion(question)}
                      >
                        <Eye className="mr-1 h-3 w-3" />
                        预览
                      </Button>
                      {canEdit && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => handleCopyQuestion(question)}
                          >
                            <Copy className="mr-1 h-3 w-3" />
                            复制
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => handleQuestionEdit(question)}
                          >
                            <Edit className="mr-1 h-3 w-3" />
                            编辑
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-red-500 hover:text-red-600"
                            onClick={() => setDeleteConfirm(question)}
                          >
                            <Trash2 className="mr-1 h-3 w-3" />
                            删除
                          </Button>
                        </>
                      )}
                    </TableRowActions>
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
        defaultType={defaultQuestionType}
        onSubmit={handleQuestionSubmit}
      />

      <QuestionPreview
        open={!!previewQuestion}
        onOpenChange={(open) => !open && setPreviewQuestion(null)}
        question={previewQuestion}
      />

      {/* Import Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={(open) => { setIsImportDialogOpen(open); if (!open) { setImportStep("download"); setImportFile(null) } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>导入题目</DialogTitle>
            <DialogDescription>
              第 {importStep === "download" ? "1" : "2"} 步：{importStep === "download" ? "下载模板并填写数据" : "上传已填写的 Excel 文件"}，批量导入题目到「{bank?.name || ""}」
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {importStep === "download" ? (
              <div className="space-y-4">
                <div className="rounded-lg border bg-muted/30 p-4">
                  <p className="text-sm font-medium mb-2">操作指引</p>
                  <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                    <li>点击下方按钮下载最新的导入模板（含系统字典数据）</li>
                    <li>参照模板中各 Sheet 的填写说明，填入题目数据</li>
                    <li>完成后点击&quot;下一步&quot;上传文件</li>
                  </ol>
                </div>
                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleDownloadTemplate}
                  disabled={isDownloading}
                >
                  <FileDown className="mr-2 h-5 w-5" />
                  {isDownloading ? "下载中..." : "下载题目批量导入模板"}
                </Button>
              </div>
            ) : (
              <div
                className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground mb-2">
                  {importFile ? importFile.name : "点击选择已填写的 Excel (.xlsx) 文件"}
                </p>
                <p className="text-xs text-muted-foreground">仅支持 .xlsx 格式</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx"
                  className="hidden"
                  onChange={(e) => handleImportFileSelect(e.target.files)}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsImportDialogOpen(false); setImportStep("download"); setImportFile(null) }}>取消</Button>
            {importStep === "download" ? (
              <Button onClick={() => setImportStep("upload")}>下一步</Button>
            ) : (
              <Button onClick={handleImport} disabled={!importFile || isImporting}>
                {isImporting ? "导入中..." : "开始导入"}
              </Button>
            )}
            {importStep === "upload" && (
              <Button variant="ghost" size="sm" onClick={() => setImportStep("download")}>上一步</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {importPreview && (
        <ImportConfirmDialog
          open={isImportConfirmOpen}
          onOpenChange={setIsImportConfirmOpen}
          entityLabel="题目"
          created={importPreview.created}
          duplicates={importPreview.duplicates}
          failed={importPreview.failed}
          duplicateItems={importPreview.duplicateItems}
          onConfirmOverwrite={() => executeImport(true)}
          onConfirmSkip={() => executeImport(false)}
        />
      )}

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
                .filter(b => b.id !== bankId && b.name.toLowerCase().includes(moveSearch.toLowerCase()))
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
                      <div className="text-xs text-muted-foreground">{questionCountByBank.get(bank.id) || 0} 题</div>
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
