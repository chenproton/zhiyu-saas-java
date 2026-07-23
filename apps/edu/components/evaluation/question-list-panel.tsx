// @ts-nocheck
"use client"

import { useState, useMemo, useEffect } from "react"
import {
  Plus,
  Edit,
  Trash2,
  Eye,
  MoreHorizontal,
  Send,
  Undo2,
  XCircle,
  Rocket,
  Users,
  Building2,
  ImageIcon,
  ArrowRightLeft,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { StatusBadge } from "@/components/shared/status-badge"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { BankFormDialog } from "@/components/evaluation/bank-form-dialog"
import { QuestionFormDialog } from "@/components/evaluation/question-form-dialog"
import { QuestionPreview } from "@/components/evaluation/question-preview"
import { useData } from "@/components/providers/data-provider"
import type { Question, QuestionType, QuestionFormData, QuestionBankFormData, StatusAction, User } from "@/lib/types"
import { QUESTION_TYPE_LABELS, DIFFICULTY_LABELS, STATUS_LABELS, canPerformAction } from "@/lib/types"
import { userManagementApi, orgApi } from "@/lib/api"

interface QuestionListPanelProps {
  bankId: string
}

const questionTypeTabs: { value: QuestionType | "all"; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "single", label: "单选" },
  { value: "multiple", label: "多选" },
  { value: "judge", label: "判断" },
  { value: "fill", label: "填空" },
  { value: "essay", label: "问答" },
  { value: "short_answer", label: "简答" },
]

export function QuestionListPanel({ bankId }: QuestionListPanelProps) {
  const {
    questionBanks,
    getQuestionBank,
    updateQuestionBank,
    deleteQuestionBank,
    updateQuestionBankStatus,
    getQuestionsByBank,
    createQuestion,
    updateQuestion,
    deleteQuestion,
    updateQuestionStatus,
  } = useData()

  const bank = getQuestionBank(bankId)
  const questions = bank ? getQuestionsByBank(bankId) : []

  const [typeTab, setTypeTab] = useState<QuestionType | "all">("all")

  const [bankFormOpen, setBankFormOpen] = useState(false)
  const [questionFormOpen, setQuestionFormOpen] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null)
  const [previewQuestion, setPreviewQuestion] = useState<Question | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<Question | null>(null)
  const [questionActionConfirm, setQuestionActionConfirm] = useState<{question: Question, action: StatusAction, title: string, desc: string} | null>(null)
  const [selectedQuestions, setSelectedQuestions] = useState<Set<string>>(new Set())
  const [batchDeleteConfirm, setBatchDeleteConfirm] = useState(false)
  const [batchSubmitConfirm, setBatchSubmitConfirm] = useState(false)
  const [batchMoveOpen, setBatchMoveOpen] = useState(false)
  const [moveTargetBankId, setMoveTargetBankId] = useState<string>("")
  const [bankDeleteConfirm, setBankDeleteConfirm] = useState(false)
  const [bankActionConfirm, setBankActionConfirm] = useState<{action: StatusAction, title: string, desc: string} | null>(null)

  const [usersMap, setUsersMap] = useState<Record<string, User>>({})
  const [deptsMap, setDeptsMap] = useState<Record<string, { name: string }>>({})

  useEffect(() => {
    let cancelled = false
    userManagementApi.list({ limit: 1000 })
      .then((res) => {
        if (cancelled) return
        const map: Record<string, User> = {}
        res.items.forEach((u) => { map[u.id] = u })
        setUsersMap(map)
      })
      .catch((err) => {
        if (!cancelled) console.error('Failed to load users', err)
      })
    orgApi.tree({})
      .then((res) => {
        if (cancelled) return
        const map: Record<string, { name: string }> = {}
        res.forEach((o) => { map[o.id] = { name: o.name } })
        setDeptsMap(map)
      })
      .catch((err) => {
        if (!cancelled) console.error('Failed to load departments', err)
      })
    return () => { cancelled = true }
  }, [bankId])

  const filteredQuestions = useMemo(() => {
    return questions
      .filter((q) => typeTab === "all" || q.type === typeTab)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  }, [questions, typeTab])

  if (!bank) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-semibold">题库不存在</h2>
          <p className="text-muted-foreground">该题库可能已被删除</p>
        </div>
      </div>
    )
  }

  const isDraftPool = bank.isDraftPool === true
  const canEditBank = isDraftPool || ['draft', 'rejected', 'approved', 'published'].includes(bank.status)

  const handleBankUpdate = (data: QuestionBankFormData) => {
    updateQuestionBank(bankId, data)
  }

  const handleBankDelete = () => {
    deleteQuestionBank(bankId)
    setBankDeleteConfirm(false)
  }

  const handleBankAction = () => {
    if (bankActionConfirm) {
      updateQuestionBankStatus(bankId, bankActionConfirm.action)
      setBankActionConfirm(null)
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

  const handleQuestionAction = () => {
    if (questionActionConfirm) {
      updateQuestionStatus(questionActionConfirm.question.id, questionActionConfirm.action)
      setQuestionActionConfirm(null)
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

  const handleBatchDelete = () => {
    selectedQuestions.forEach((id) => deleteQuestion(id))
    setSelectedQuestions(new Set())
    setBatchDeleteConfirm(false)
  }

  const handleBatchSubmit = () => {
    selectedQuestions.forEach((id) => {
      const q = questions.find((q) => q.id === id)
      if (q && ['draft', 'rejected'].includes(q.status)) {
        updateQuestionStatus(id, 'submit')
      }
    })
    setSelectedQuestions(new Set())
    setBatchSubmitConfirm(false)
  }

  const handleBatchMove = () => {
    if (!moveTargetBankId) return
    selectedQuestions.forEach((id) => {
      const q = questions.find((q) => q.id === id)
      if (q) {
        updateQuestion(id, { ...q, bankId: moveTargetBankId } as any)
      }
    })
    setSelectedQuestions(new Set())
    setBatchMoveOpen(false)
    setMoveTargetBankId("")
  }

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date)
  }

  const getCollaboratorNames = () => {
    return (bank.collaboratorIds || [])
      .map((id) => usersMap[id]?.name)
      .filter(Boolean) as string[]
  }

  const getCollaboratorDeptNames = () => {
    return (bank.collaboratorDeptIds || [])
      .map((id) => deptsMap[id]?.name)
      .filter(Boolean) as string[]
  }

  // 草稿库：题目有独立状态流转
  // 其他题库：题目状态跟随题库，不能单个进行提交审批等操作
  const canEditQuestion = (q: Question) =>
    isDraftPool
      ? ['draft', 'rejected', 'approved', 'published'].includes(q.status)
      : canEditBank

  const canDeleteQuestion = (q: Question) =>
    isDraftPool
      ? ['draft', 'rejected', 'archived'].includes(q.status)
      : canEditBank

  const canSubmitQuestion = (q: Question) =>
    isDraftPool && ['draft', 'rejected'].includes(q.status)

  const canWithdrawQuestion = (q: Question) =>
    isDraftPool && q.status === 'pending'

  const canPublishQuestion = (q: Question) =>
    isDraftPool && q.status === 'approved'

  const otherBanks = questionBanks.filter((b) => b.id !== bankId)

  // Bank action button config based on status
  const getBankActionConfig = () => {
    if (canPerformAction(bank.status, 'submit')) {
      return { action: 'submit' as StatusAction, label: '提交审批', icon: Send }
    }
    if (canPerformAction(bank.status, 'withdraw')) {
      return { action: 'withdraw' as StatusAction, label: '撤回审批', icon: Undo2 }
    }
    if (canPerformAction(bank.status, 'publish')) {
      return { action: 'publish' as StatusAction, label: '发布', icon: Rocket }
    }
    return null
  }

  const bankActionConfig = getBankActionConfig()

  return (
    <div className="space-y-0">
      {/* 题库信息卡片 - sticky */}
      <div className="sticky top-0 z-10 pb-4">
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-4">
              {/* 左侧：封面 + 信息 */}
              <div className="flex min-w-0 flex-1 items-center gap-3">
                {isDraftPool ? (
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-gray-100">
                    <Edit className="size-5 text-gray-400" />
                  </div>
                ) : bank.coverImage ? (
                  <div className="shrink-0 overflow-hidden rounded-lg">
                    <img src={bank.coverImage} alt={bank.name} className="size-12 object-cover" />
                  </div>
                ) : (
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <ImageIcon className="size-5 text-muted-foreground" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-base font-semibold">{bank.name}</h3>
                    {!isDraftPool && <StatusBadge status={bank.status} />}
                    {!isDraftPool && <Badge variant="outline" className="text-xs">{bank.version}</Badge>}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                    <span>题目 <strong className="text-foreground">{bank.questionCount}</strong></span>
                    <span>创建 {formatDate(bank.createdAt)}</span>
                    <span>更新 {formatDate(bank.updatedAt)}</span>
                    {!isDraftPool && getCollaboratorNames().length > 0 && (
                      <span className="flex items-center gap-1">
                        <Users className="size-3" />
                        {getCollaboratorNames().join(", ")}
                      </span>
                    )}
                    {!isDraftPool && getCollaboratorDeptNames().length > 0 && (
                      <span className="flex items-center gap-1">
                        <Building2 className="size-3" />
                        {getCollaboratorDeptNames().join(", ")}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {/* 右侧按钮 */}
              <div className="flex shrink-0 items-center gap-1">
                {!isDraftPool && bankActionConfig && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1 text-xs"
                    onClick={() =>
                      setBankActionConfirm({
                        action: bankActionConfig.action,
                        title: bankActionConfig.label,
                        desc:
                          bankActionConfig.action === 'submit'
                            ? '提交后题库将进入审批流程，审批期间无法编辑。确定要提交吗？'
                            : bankActionConfig.action === 'withdraw'
                              ? '撤回后题库将回到未提交状态，可以继续编辑。确定要撤回吗？'
                              : '发布后题库将对外可见，且无法再编辑。确定要发布吗？',
                      })
                    }
                  >
                    <bankActionConfig.icon className="size-3" />
                    {bankActionConfig.label}
                  </Button>
                )}
                {!isDraftPool && (
                  <>
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setBankFormOpen(true)}>
                      <Edit className="mr-1 size-3" />
                      编辑
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-destructive hover:text-destructive"
                      onClick={() => setBankDeleteConfirm(true)}
                    >
                      <Trash2 className="mr-1 size-3" />
                      删除
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tab + 新增按钮 */}
      <div className="flex items-center justify-between pb-3">
        <Tabs value={typeTab} onValueChange={(v) => setTypeTab(v as QuestionType | "all")}>
          <TabsList className="h-8">
            {questionTypeTabs.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className="px-3 py-1 text-xs">
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Button
          size="sm"
          className="h-8 text-xs"
          onClick={() => {
            setEditingQuestion(null)
            setQuestionFormOpen(true)
          }}
        >
          <Plus className="mr-1 size-3.5" />
          新增题目
        </Button>
      </div>

      {/* 题目列表 */}
      <div className="rounded-lg border bg-white">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]">
                  <Checkbox
                    checked={
                      filteredQuestions.length > 0 &&
                      selectedQuestions.size === filteredQuestions.length
                    }
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead className="w-[45%]">题目内容</TableHead>
                <TableHead className="w-[80px]">题型</TableHead>
                <TableHead className="w-[70px]">难度</TableHead>
                <TableHead className="w-[90px]">状态</TableHead>
                <TableHead className="sticky right-0 w-[80px] bg-white text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredQuestions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    {questions.length === 0 ? "暂无题目，点击上方按钮添加" : "该类型下暂无题目"}
                  </TableCell>
                </TableRow>
              ) : (
                filteredQuestions.map((question) => (
                  <TableRow key={question.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedQuestions.has(question.id)}
                        onCheckedChange={(checked) =>
                          handleSelectQuestion(question.id, !!checked)
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <p className="line-clamp-2 text-sm">{question.content}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs font-normal">
                        {QUESTION_TYPE_LABELS[question.type]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {question.difficulty ? (
                        <Badge variant="outline" className="text-xs font-normal">
                          {DIFFICULTY_LABELS[question.difficulty]}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={isDraftPool ? question.status : bank.status} />
                    </TableCell>
                    <TableCell className="sticky right-0 bg-white text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-7">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setPreviewQuestion(question)}>
                          查看详情
                        </DropdownMenuItem>
                        {canEditQuestion(question) && (
                          <DropdownMenuItem onClick={() => handleQuestionEdit(question)}>
                            编辑
                          </DropdownMenuItem>
                        )}
                        {canSubmitQuestion(question) && (
                          <DropdownMenuItem
                            onClick={() =>
                              setQuestionActionConfirm({
                                question,
                                action: 'submit',
                                title: '提交审核',
                                desc: '提交后题目将进入审批流程，审批期间无法编辑。确定要提交吗？',
                              })
                            }
                          >
                            提交审核
                          </DropdownMenuItem>
                        )}
                        {canWithdrawQuestion(question) && (
                          <DropdownMenuItem
                            onClick={() =>
                              setQuestionActionConfirm({
                                question,
                                action: 'withdraw',
                                title: '撤回审批',
                                desc: '撤回后题目将回到未提交状态，可以继续编辑。确定要撤回吗？',
                              })
                            }
                          >
                            撤回审批
                          </DropdownMenuItem>
                        )}
                        {canPublishQuestion(question) && (
                          <DropdownMenuItem
                            onClick={() =>
                              setQuestionActionConfirm({
                                question,
                                action: 'publish',
                                title: '发布题目',
                                desc: '发布后题目将对外可见，且无法再编辑。确定要发布吗？',
                              })
                            }
                          >
                            发布
                          </DropdownMenuItem>
                        )}
                        {canDeleteQuestion(question) && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setDeleteConfirm(question)}
                              className="text-destructive"
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
      </div>

      {/* 悬浮批量操作栏 */}
      {selectedQuestions.size > 0 && (
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full border bg-white px-5 py-2.5 shadow-lg">
          <span className="text-sm font-medium">已选择 {selectedQuestions.size} 道题目</span>
          <div className="h-4 w-px bg-gray-200" />
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={() => setBatchMoveOpen(true)}
          >
            <ArrowRightLeft className="size-3.5" />
            批量移动
          </Button>
          {isDraftPool && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={() => setBatchSubmitConfirm(true)}
            >
              <Send className="size-3.5" />
              批量提交
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs text-destructive hover:text-destructive"
            onClick={() => setBatchDeleteConfirm(true)}
          >
            <Trash2 className="size-3.5" />
            批量删除
          </Button>
          <div className="h-4 w-px bg-gray-200" />
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setSelectedQuestions(new Set())}
          >
            取消
          </Button>
        </div>
      )}

      {/* 批量移动弹窗 */}
      <Dialog open={batchMoveOpen} onOpenChange={setBatchMoveOpen}>
        <DialogContent size="sm" annotationContext="batch-move">
          <DialogHeader>
            <DialogTitle>批量移动到题库</DialogTitle>
            <DialogDescription>
              将选中的 {selectedQuestions.size} 道题目移动到以下题库：
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Select value={moveTargetBankId} onValueChange={setMoveTargetBankId}>
              <SelectTrigger>
                <SelectValue placeholder="选择目标题库" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {otherBanks.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setBatchMoveOpen(false)}>
                取消
              </Button>
              <Button onClick={handleBatchMove} disabled={!moveTargetBankId}>
                确认移动
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 弹窗 */}
      <BankFormDialog
        open={bankFormOpen}
        onOpenChange={setBankFormOpen}
        bank={isDraftPool ? null : bank}
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
        open={!!questionActionConfirm}
        onOpenChange={(open) => !open && setQuestionActionConfirm(null)}
        title={questionActionConfirm?.title || ''}
        description={questionActionConfirm?.desc || ''}
        onConfirm={handleQuestionAction}
      />

      <ConfirmDialog
        open={batchDeleteConfirm}
        onOpenChange={setBatchDeleteConfirm}
        title="批量删除"
        description={`确定要删除选中的 ${selectedQuestions.size} 道题目吗？此操作不可撤销。`}
        variant="destructive"
        onConfirm={handleBatchDelete}
      />

      <ConfirmDialog
        open={batchSubmitConfirm}
        onOpenChange={setBatchSubmitConfirm}
        title="批量提交审核"
        description={`确定要提交选中的 ${selectedQuestions.size} 道题目进入审批流程吗？`}
        onConfirm={handleBatchSubmit}
      />

      <ConfirmDialog
        open={bankDeleteConfirm}
        onOpenChange={setBankDeleteConfirm}
        title="确认删除题库"
        description="删除后将无法恢复，题库中的所有题目也会被删除。确定要删除吗？"
        variant="destructive"
        onConfirm={handleBankDelete}
      />

      <ConfirmDialog
        open={!!bankActionConfirm}
        onOpenChange={(open) => !open && setBankActionConfirm(null)}
        title={bankActionConfirm?.title || ''}
        description={bankActionConfirm?.desc || ''}
        onConfirm={handleBankAction}
      />
    </div>
  )
}
