'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import {
  ArrowLeft,
  Plus,
  Search,
  Edit,
  Trash2,
  Eye,
  Upload,
  Copy,
  Users,
  Building2,
  ImageIcon,
  FolderInput,
  ChevronDown,
  FileDown,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { ImportConfirmDialog } from '@/components/shared/import-confirm-dialog'
import { ImportWizardDialog } from '@/components/shared/import-wizard-dialog'
import type { ImportPreviewResult } from '@/lib/api'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BankFormDialog } from '@/components/evaluation/bank-form-dialog'
import { QuestionFormDialog } from '@/components/evaluation/question-form-dialog'
import { QuestionPreview } from '@/components/evaluation/question-preview'
import { useData } from '@/components/providers/data-provider'
import { importExportApi, downloadBlob } from '@/lib/api'
import { useToast } from '@zhiyu/ui'
import type { Question, QuestionType, QuestionFormData, QuestionBankFormData } from '@/lib/types'
import { QUESTION_TYPES, QUESTION_TYPE_LABELS, QUESTION_TYPE_BADGE_CLASSES, DIFFICULTY_LABELS } from '@/lib/types'
import { TableRowActions } from '@/components/shared/table-row-actions'
import { formatDate } from '@/lib/format-utils'
import { useT } from '@/lib/i18n/locale-provider'

export default function QuestionBankDetailPage() {
  const params = useParams()
  const router = useRouter()
  const t = useT()
  const bankId = params.id as string
  const { toast } = useToast()

  const {
    getQuestionBank,
    updateQuestionBank,
    questions: allQuestions,
    getQuestionsByBank,
    createQuestion,
    updateQuestion,
    deleteQuestion,
    moveQuestions,
    questionBanks,
    loadBankQuestions,
    loadQuestionBanks,
    evaluationLoading,
  } = useData()

  const bank = getQuestionBank(bankId)

  const [loadingBank, setLoadingBank] = useState(!getQuestionBank(bankId))
  const triedReload = useRef(false)

  useEffect(() => {
    if (getQuestionBank(bankId) || triedReload.current) return
    triedReload.current = true
    loadQuestionBanks?.().finally(() => setLoadingBank(false))
  }, [bankId, getQuestionBank, loadQuestionBanks])

  useEffect(() => {
    if (bankId) {
      loadBankQuestions?.(bankId)
    }
  }, [bankId, loadBankQuestions])

  const questions = getQuestionsByBank(bankId)

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<QuestionType | 'all'>('all')
  const [creatorFilter, setCreatorFilter] = useState<string>('all')

  const [bankFormOpen, setBankFormOpen] = useState(false)
  const [questionFormOpen, setQuestionFormOpen] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null)
  const [defaultQuestionType, setDefaultQuestionType] = useState<QuestionType>('single')
  const [previewQuestion, setPreviewQuestion] = useState<Question | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<Question | null>(null)
  const [selectedQuestions, setSelectedQuestions] = useState<Set<string>>(new Set())
  const [batchDeleteConfirm, setBatchDeleteConfirm] = useState(false)
  const [batchMoveOpen, setBatchMoveOpen] = useState(false)
  const [moveSearch, setMoveSearch] = useState('')
  const [isExporting, setIsExporting] = useState(false)

  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [importFiles, setImportFiles] = useState<File[]>([])
  const [isImporting, setIsImporting] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [isImportConfirmOpen, setIsImportConfirmOpen] = useState(false)
  const [importPreview, setImportPreview] = useState<ImportPreviewResult | null>(null)
  // 获取题目创建人列表（后端暂无用户姓名查询，直接展示 ID）
  const creators = useMemo(() => {
    const creatorIds = new Set(questions.map((q) => q.creatorId).filter(Boolean))
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
        const matchType = typeFilter === 'all' || q.type === typeFilter
        const matchCreator = creatorFilter === 'all' || q.creatorId === creatorFilter
        return matchSearch && matchType && matchCreator
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [questions, search, typeFilter, creatorFilter])

  if (!bank) {
    if (evaluationLoading || loadingBank) {
      return (
        <div className="flex h-[50vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )
    }
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-semibold">{t('题库不存在')}</h2>
          <p className="mb-4 text-muted-foreground">{t('该题库可能已被删除')}</p>
          <Button asChild>
            <Link href="/evaluation/question-banks">{t('返回题库列表')}</Link>
          </Button>
        </div>
      </div>
    )
  }

  const isDraftPool = bank.isDraftPool === true
  // 归档题库只读，其余状态（草稿/已发布）允许编辑题目
  const canEdit = bank.status !== 'archived'

  const handleAddFiles = (files: FileList | null) => {
    if (!files) return
    const existing = new Set(importFiles.map((f) => f.name + '_' + f.size))
    const added = Array.from(files).filter((f) => !existing.has(f.name + '_' + f.size))
    // 导入仅处理单个文件，单选避免其余文件被静默忽略
    setImportFiles((prev) => [...prev, ...added].slice(0, 1))
  }

  const handleRemoveFile = (index: number) => {
    setImportFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const resetImport = () => {
    setImportFiles([])
    setImportPreview(null)
    setIsImportConfirmOpen(false)
  }

  const executeImport = async (mode: 'skip' | 'overwrite' | 'new' = 'skip'): Promise<boolean> => {
    const file = importFiles[0]
    if (!file) return false
    setIsImporting(true)
    try {
      const result = await importExportApi.importExcel(
        `question-banks/${bankId}/questions`,
        file,
        mode === 'overwrite',
        mode === 'new',
      )
      const errorHint =
        result.errors && result.errors.length > 0
          ? t('，错误：{details}', { details: result.errors.slice(0, 3).join(';') })
          : ''
      const permissionHint =
        result.permissionSkipped && result.permissionSkipped > 0
          ? t('，{n} 个题目非本人创建，已跳过覆盖', { n: result.permissionSkipped })
          : ''
      toast({
        title: t('导入完成'),
        description: t('成功 {created} 条，失败 {failed} 条，跳过 {skipped} 条{permission}{error}', {
          created: result.created,
          failed: result.failed || 0,
          skipped: result.skipped || 0,
          permission: permissionHint,
          error: errorHint,
        }),
      })
      resetImport()
      setIsImportDialogOpen(false)
      await loadBankQuestions?.(bankId)
      return true
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: t('导入失败'),
        description: err.message || t('导入失败'),
      })
      return false
    } finally {
      setIsImporting(false)
    }
  }

  const handleImport = async (files: File[]) => {
    const file = files[0]
    if (!file) return false
    setIsImporting(true)
    try {
      const preview = await importExportApi.importExcelPreview(
        `question-banks/${bankId}/questions`,
        file,
      )
      if (preview.duplicates > 0) {
        setImportPreview(preview)
        setIsImportConfirmOpen(true)
        setIsImporting(false)
        return false
      }
      return await executeImport('skip')
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: t('导入失败'),
        description: err.message || t('导入失败'),
      })
      setIsImporting(false)
      return false
    }
  }

  const handleDownloadTemplate = async () => {
    setIsDownloading(true)
    try {
      const res = await importExportApi.downloadQuestionTemplate(bankId)
      downloadBlob(await res.blob(), t('题目批量导入模板.xlsx'))
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: t('下载模板失败'),
        description: err.message || t('下载模板失败'),
      })
    } finally {
      setIsDownloading(false)
    }
  }

  const handleBankUpdate = (data: QuestionBankFormData) => {
    updateQuestionBank(bankId, data)
  }

  const handleQuestionSubmit = async (data: QuestionFormData) => {
    try {
      if (editingQuestion) {
        await updateQuestion(editingQuestion.id, data)
      } else {
        await createQuestion(bankId, data)
      }
      setEditingQuestion(null)
    } catch (err: any) {
      toast({ variant: 'destructive', title: t('保存失败'), description: err.message })
    }
  }

  const handleQuestionEdit = (question: Question) => {
    setEditingQuestion(question)
    setDefaultQuestionType(question.type)
    setQuestionFormOpen(true)
  }

  const handleQuestionDelete = async () => {
    if (deleteConfirm) {
      try {
        await deleteQuestion(deleteConfirm.id)
        setDeleteConfirm(null)
      } catch (err: any) {
        toast({ variant: 'destructive', title: t('删除失败'), description: err.message })
      }
    }
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedQuestions(new Set(filteredQuestions.map((q) => q.id)))
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

  const handleBatchDelete = async () => {
    try {
      for (const id of selectedQuestions) {
        await deleteQuestion(id)
      }
      setSelectedQuestions(new Set())
      setBatchDeleteConfirm(false)
    } catch (err: any) {
      toast({ variant: 'destructive', title: t('批量删除失败'), description: err.message })
    }
  }

  const handleBatchCopy = async () => {
    try {
      for (const id of selectedQuestions) {
        const question = questions.find((q) => q.id === id)
        if (!question) continue
        await createQuestion(bankId, {
          type: question.type,
          content: question.content + t(' (复制)'),
          options: question.options,
          answer: question.answer,
          analysis: question.analysis,
          score: question.score,
          difficulty: question.difficulty,
          knowledgePoints: question.knowledgePoints,
        })
      }
      setSelectedQuestions(new Set())
    } catch (err: any) {
      toast({ variant: 'destructive', title: t('批量复制失败'), description: err.message })
    }
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
      downloadBlob(blob, t('题目导出_{id}.xlsx', { id: bankId }))
      toast({ title: t('导出成功'), description: t('已导出 {n} 道题目', { n: selectedQuestions.size }) })
    } catch (err: any) {
      toast({
        title: t('导出失败'),
        description: err.message || t('请稍后重试'),
        variant: 'destructive',
      })
    } finally {
      setIsExporting(false)
    }
  }

  const handleBatchMove = async (targetBankId: string) => {
    try {
      await moveQuestions(Array.from(selectedQuestions), targetBankId)
      setSelectedQuestions(new Set())
      setBatchMoveOpen(false)
    } catch (err: any) {
      toast({ variant: 'destructive', title: t('批量移动失败'), description: err.message })
    }
  }

  const handleCopyQuestion = async (question: Question) => {
    try {
      await createQuestion(bankId, {
        type: question.type,
        content: question.content + t(' (复制)'),
        options: question.options,
        answer: question.answer,
        analysis: question.analysis,
        score: question.score,
      difficulty: question.difficulty,
      knowledgePoints: question.knowledgePoints,
      })
    } catch (err: any) {
      toast({ variant: 'destructive', title: t('复制失败'), description: err.message })
    }
  }

  const getCollaboratorNames = () =>
    (bank.collaboratorNames || bank.collaboratorIds || []).filter(Boolean)

  const getCollaboratorDeptNames = () => (bank.collaboratorDeptIds || []).filter(Boolean)

  return (
    <div className="p-6">
      {/* 返回按钮 */}
      <div className="mb-4">
        <Button variant="ghost" size="sm" onClick={() => router.push('/evaluation/question-banks')}>
          <ArrowLeft />
          {t('返回题库列表')}
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
                  <Image src={bank.coverImage} alt={bank.name} fill className="object-cover" />
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
                      {t('草稿库')}
                    </span>
                  )}
                  <Badge variant="outline">{bank.version}</Badge>
                </div>
                <CardDescription className="mt-2">
                  {bank.description || t('暂无描述')}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-start gap-2">
              {!isDraftPool && (
                <Button variant="outline" size="sm" onClick={() => setBankFormOpen(true)}>
                  <Edit className="mr-1 size-3.5" />
                  {t('编辑信息')}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-6 text-sm">
            <div>
              <span className="text-muted-foreground">{t('创建人:')}</span>{' '}
              <strong>{bank.creatorName || bank.creatorId || '-'}</strong>
            </div>
            <div>
              <span className="text-muted-foreground">{t('题目数量:')}</span>{' '}
              <strong>{bank.questionCount}</strong>
            </div>
            <div>
              <span className="text-muted-foreground">{t('创建时间:')}</span>{' '}
              {formatDate(bank.createdAt)}
            </div>
            <div>
              <span className="text-muted-foreground">{t('更新时间:')}</span>{' '}
              {formatDate(bank.updatedAt)}
            </div>
          </div>
          {/* 共建人/共建部门 */}
          {(getCollaboratorNames().length > 0 || getCollaboratorDeptNames().length > 0) && (
            <div className="mt-4 flex flex-wrap gap-4 border-t pt-4">
              {getCollaboratorNames().length > 0 && (
                <div className="flex items-center gap-2">
                  <Users className="size-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{t('共建人:')}</span>
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
                  <span className="text-sm text-muted-foreground">{t('共建部门:')}</span>
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
          <h2 className="text-lg font-semibold">{t('题目列表')}</h2>
          <Tabs value={typeFilter} onValueChange={(v) => setTypeFilter(v as QuestionType | 'all')}>
            <TabsList className="h-8">
              <TabsTrigger value="all" className="text-xs">
                {t('全部')}
              </TabsTrigger>
              {QUESTION_TYPES.map((type) => (
                <TabsTrigger key={type} value={type} className="text-xs">
                  {t(QUESTION_TYPE_LABELS[type])}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setIsImportDialogOpen(true)}>
            <Upload className="mr-1 size-3.5" />
            {t('导入题目')}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm">
                <Plus className="mr-1 size-3.5" />
                {t('添加题目')}
                <ChevronDown className="ml-1 size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {QUESTION_TYPES.map((type) => (
                <DropdownMenuItem
                  key={type}
                  onClick={() => {
                    setEditingQuestion(null)
                    setDefaultQuestionType(type)
                    setQuestionFormOpen(true)
                  }}
                >
                  {t(QUESTION_TYPE_LABELS[type])}
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
              placeholder={t('搜索题目内容...')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          {creators.length > 0 && (
            <Select value={creatorFilter} onValueChange={setCreatorFilter}>
              <SelectTrigger className="h-9 w-[140px]">
                <SelectValue placeholder={t('全部创建人')} />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">{t('全部创建人')}</SelectItem>
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
          <Button
            variant="outline"
            size="sm"
            onClick={handleBatchExport}
            disabled={selectedQuestions.size === 0 || isExporting}
          >
            <FileDown className="mr-1 size-3" />
            {isExporting ? t('导出中...') : t('批量导出')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleBatchCopy}
            disabled={selectedQuestions.size === 0}
          >
            <Copy className="mr-1 size-3" />
            {t('批量复制')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setBatchMoveOpen(true)}
            disabled={selectedQuestions.size === 0}
          >
            <FolderInput className="mr-1 size-3" />
            {t('批量移动')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => setBatchDeleteConfirm(true)}
            disabled={selectedQuestions.size === 0}
          >
            <Trash2 className="mr-1 size-3" />
            {t('批量删除')}
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
                    checked={
                      filteredQuestions.length > 0 &&
                      selectedQuestions.size === filteredQuestions.length
                    }
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
              )}
              <TableHead className="w-[40%]">{t('题目内容')}</TableHead>
              <TableHead className="w-[100px]">{t('题型')}</TableHead>
              <TableHead className="w-[80px]">{t('难度')}</TableHead>
              <TableHead className="w-[100px]">{t('添加来源')}</TableHead>
              <TableHead className="w-[120px]">{t('创建时间')}</TableHead>
              <TableHead className="w-[120px] text-right">{t('操作')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredQuestions.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={canEdit ? 7 : 6}
                  className="h-24 text-center text-muted-foreground"
                >
                  {questions.length === 0
                    ? t('暂无题目，点击上方按钮添加')
                    : t('没有找到匹配的题目')}
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
                    <Badge
                      className={`text-xs text-white hover:opacity-90 ${QUESTION_TYPE_BADGE_CLASSES[question.type]}`}
                    >
                      {t(QUESTION_TYPE_LABELS[question.type])}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {question.difficulty && (
                      <Badge variant="outline">
                        {t(DIFFICULTY_LABELS[question.difficulty])}
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
                      {t('预览')}
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
                          {t('复制')}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => handleQuestionEdit(question)}
                        >
                          <Edit className="mr-1 h-3 w-3" />
                          {t('编辑')}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-red-500 hover:text-red-600"
                          onClick={() => setDeleteConfirm(question)}
                        >
                          <Trash2 className="mr-1 h-3 w-3" />
                          {t('删除')}
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
      <ImportWizardDialog
        open={isImportDialogOpen}
        onOpenChange={(open) => {
          setIsImportDialogOpen(open)
          if (!open) resetImport()
        }}
        title={t('导入题目')}
        guideItems={[
          <>{t('点击下方按钮下载最新的导入模板（含系统字典数据）')}</>,
          <>{t('参照模板中各 Sheet 的填写说明，填入题目数据')}</>,
          <>{t('完成后点击&quot;下一步&quot;上传文件')}</>,
        ]}
        downloadLabel={t('下载题目批量导入模板')}
        onDownload={handleDownloadTemplate}
        uploadHint={t('点击选择已填写的 Excel (.xlsx) 文件')}
        importLabel={() => t('开始导入')}
        onImport={handleImport}
        files={importFiles}
        onAddFiles={handleAddFiles}
        onRemoveFile={handleRemoveFile}
        importing={isImporting}
        downloading={isDownloading}
        allowMultiple={false}
      />

      {importPreview && (
        <ImportConfirmDialog
          open={isImportConfirmOpen}
          onOpenChange={setIsImportConfirmOpen}
          entityLabel={t('题目')}
          created={importPreview.created}
          duplicates={importPreview.duplicates}
          failed={importPreview.failed}
          duplicateItems={importPreview.duplicateItems}
          onConfirmOverwrite={() => executeImport('overwrite')}
          onConfirmSkip={() => executeImport('skip')}
          onConfirmNew={() => executeImport('new')}
        />
      )}

      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
        title={t('确认删除')}
        description={t('删除后将无法恢复。确定要删除这道题目吗？')}
        variant="destructive"
        onConfirm={handleQuestionDelete}
      />

      <ConfirmDialog
        open={batchDeleteConfirm}
        onOpenChange={setBatchDeleteConfirm}
        title={t('批量删除')}
        description={t('确定要删除选中的 {n} 道题目吗？此操作不可撤销。', {
          n: selectedQuestions.size,
        })}
        variant="destructive"
        onConfirm={handleBatchDelete}
      />

      {/* 批量移动弹窗 */}
      {batchMoveOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg border bg-white p-6 shadow-lg">
            <h3 className="text-lg font-semibold">{t('批量移动题目')}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('选择目标题库，将选中的 {n} 道题目移动过去', { n: selectedQuestions.size })}
            </p>
            <div className="relative mt-4">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t('搜索题库名称...')}
                value={moveSearch}
                onChange={(e) => setMoveSearch(e.target.value)}
                className="h-9 pl-9 text-sm"
              />
            </div>
            <div className="mt-3 max-h-60 overflow-auto">
              {questionBanks
                .filter(
                  (b) => b.id !== bankId && b.name.toLowerCase().includes(moveSearch.toLowerCase()),
                )
                .map((bank) => (
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
                      <div className="text-xs text-muted-foreground">
                        {t('{n} 题', { n: questionCountByBank.get(bank.id) || 0 })}
                      </div>
                    </div>
                  </button>
                ))}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setBatchMoveOpen(false)
                  setMoveSearch('')
                }}
              >
                {t('取消')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
