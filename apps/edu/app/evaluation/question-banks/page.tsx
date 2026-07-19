"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowDownFromLine,
  ArrowUpFromLine,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  Eye,
  FolderKanban,
  GitBranch,
  LayoutGrid,
  List,
  Plus,
  Rocket,
  RotateCcw,
  Search,
  Send,
  Trash2,
  Undo2,
  Upload,
  UserPlus,
  X,
  XCircle,
} from "lucide-react"
import { questionBankApi, questionApi, evaluationBatchApi, importExportApi, approvalApi } from "@/lib/api"
import type { QuestionBank, Question, EvaluationBatch } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { PageHeaderCard } from "@/components/shared/page-header-card"
import { cn } from "@/lib/utils"
import { useAuth } from "@/components/auth-provider"


type TabType = "my" | "collab" | "public"
type ViewMode = "list" | "group"
type BackendStatus = "draft" | "pending" | "approved" | "rejected" | "published" | "archived"

interface BackendQuestionBank extends Omit<QuestionBank, "status" | "createdAt" | "updatedAt"> {
  status: BackendStatus
  createdAt: string
  updatedAt: string
}

const STATUS_LABELS: Record<BackendStatus, string> = {
  draft: "草稿",
  pending: "审批中",
  approved: "已通过",
  rejected: "已驳回",
  published: "已发布",
  archived: "已归档",
}

const STATUS_STYLES: Record<BackendStatus, string> = {
  draft: "bg-muted text-muted-foreground border-muted",
  pending: "bg-yellow-50 text-yellow-600 border-yellow-200",
  approved: "bg-blue-50 text-blue-600 border-blue-200",
  rejected: "bg-red-50 text-red-600 border-red-200",
  published: "bg-emerald-50 text-emerald-600 border-emerald-200",
  archived: "bg-gray-100 text-gray-500 border-gray-200",
}

function EvalStatusBadge({ status }: { status: BackendStatus }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.draft
  return (
    <Badge variant="outline" className={style}>
      {STATUS_LABELS[status] || status}
    </Badge>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
}

export default function QuestionBanksPage() {
  const router = useRouter()
  const { user } = useAuth()
  const currentUserId = user?.id ?? ""

  const [banks, setBanks] = useState<BackendQuestionBank[]>([])
  const [batches, setBatches] = useState<EvaluationBatch[]>([])
  const [loading, setLoading] = useState(true)

  const [activeTab, setActiveTab] = useState<TabType>("my")
  const [viewMode, setViewMode] = useState<ViewMode>("list")

  const [searchQuery, setSearchQuery] = useState("")
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null)
  const [selectedStatus, setSelectedStatus] = useState<BackendStatus | null>(null)

  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [expandedBatches, setExpandedBatches] = useState<string[]>([])

  // Dialogs
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [newName, setNewName] = useState("")
  const [newDescription, setNewDescription] = useState("")
  const [newBatchId, setNewBatchId] = useState("")

  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false)
  const [isBatchMoveDialogOpen, setIsBatchMoveDialogOpen] = useState(false)
  const [moveTargetBatchId, setMoveTargetBatchId] = useState("")

  const [isCloneRenameDialogOpen, setIsCloneRenameDialogOpen] = useState(false)
  const [cloneRenameValue, setCloneRenameValue] = useState("")
  const [cloneTargetBank, setCloneTargetBank] = useState<BackendQuestionBank | null>(null)

  const [importFile, setImportFile] = useState<File | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [banksRes, batchesRes] = await Promise.all([
        questionBankApi.list({ limit: 1000 }) as unknown as {
          items: BackendQuestionBank[]
          total: number
        },
        evaluationBatchApi.list({ limit: 1000 }),
      ])
      setBanks(banksRes.items)
      setBatches(batchesRes.items)
    } catch (err) {
      console.error("加载数据失败", err)
      alert("加载数据失败，请稍后重试")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    setExpandedBatches(batches.map((b) => b.id))
  }, [batches])

  const toggleBatch = (batchId: string) => {
    setExpandedBatches((prev) =>
      prev.includes(batchId) ? prev.filter((id) => id !== batchId) : [...prev, batchId]
    )
  }

  const tabFilteredBanks = useMemo(() => {
    switch (activeTab) {
      case "my":
        return banks.filter((b) => b.creatorId === currentUserId)
      case "collab":
        return banks.filter((b) => (b.collaboratorIds || []).includes(currentUserId))
      case "public":
      default:
        return banks.filter((b) => b.status === "published")
    }
  }, [banks, activeTab, currentUserId])

  const filteredBanks = useMemo(() => {
    let result = tabFilteredBanks
    const q = searchQuery.trim().toLowerCase()
    if (q) {
      result = result.filter(
        (b) => b.name.toLowerCase().includes(q) || b.description.toLowerCase().includes(q)
      )
    }
    if (selectedBatchId) {
      result = result.filter((b) => b.batchId === selectedBatchId)
    }
    if (selectedStatus) {
      result = result.filter((b) => b.status === selectedStatus)
    }
    return result
  }, [tabFilteredBanks, searchQuery, selectedBatchId, selectedStatus])

  const stats = useMemo(() => {
    const total = filteredBanks.length
    const draft = filteredBanks.filter((b) => b.status === "draft").length
    const pending = filteredBanks.filter((b) => b.status === "pending").length
    const rejected = filteredBanks.filter((b) => b.status === "rejected").length
    const published = filteredBanks.filter((b) => b.status === "published").length
    return { total, draft, pending, rejected, published }
  }, [filteredBanks])

  const banksByBatch = useMemo(() => {
    if (viewMode !== "group") return null
    const groups: Record<string, BackendQuestionBank[]> = {}
    filteredBanks.forEach((b) => {
      if (!b.batchId) return
      if (!groups[b.batchId]) groups[b.batchId] = []
      groups[b.batchId].push(b)
    })
    return groups
  }, [filteredBanks, viewMode])

  const uncategorizedBanks = useMemo(
    () => filteredBanks.filter((b) => !b.batchId && b.status === "draft"),
    [filteredBanks]
  )

  const handleSelectId = (id: string, checked: boolean) => {
    setSelectedIds((prev) => (checked ? [...prev, id] : prev.filter((sid) => sid !== id)))
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(filteredBanks.map((b) => b.id))
    } else {
      setSelectedIds([])
    }
  }

  const selectedBanks = useMemo(
    () => filteredBanks.filter((b) => selectedIds.includes(b.id)),
    [filteredBanks, selectedIds]
  )
  const hasSelected = selectedIds.length > 0

  const canBatchSubmit = selectedBanks.some((b) => b.status === "draft" || b.status === "rejected")
  const canBatchWithdraw = selectedBanks.some((b) => b.status === "pending")
  const canBatchPublish = selectedBanks.some((b) => b.status === "approved")
  const canBatchUnpublish = selectedBanks.some((b) => b.status === "published")
  const canBatchDelete = selectedBanks.some((b) => b.status === "draft" || b.status === "rejected")

  const resetCreateForm = () => {
    setNewName("")
    setNewDescription("")
    setNewBatchId("")
  }

  const handleCreate = async () => {
    if (!newName.trim()) return
    try {
      const created = (await questionBankApi.create({
        name: newName.trim(),
        description: newDescription.trim(),
        status: "draft",
        ownerType: "mine",
        version: "v1.0",
        isDraftPool: false,
        collaboratorIds: [],
        collaboratorDeptIds: [],
        batchId: newBatchId || undefined,
      })) as unknown as BackendQuestionBank
      setIsCreateOpen(false)
      resetCreateForm()
      router.push(`/evaluation/question-banks/${created.id}`)
    } catch (err) {
      console.error("创建题库失败", err)
      alert("创建题库失败")
    }
  }

  const handleDelete = async (bank: BackendQuestionBank) => {
    if (confirm(`确定要删除题库「${bank.name}」吗？`)) {
      try {
        await questionBankApi.delete(bank.id)
        await loadData()
      } catch (err) {
        console.error("删除失败", err)
        alert("删除失败")
      }
    }
  }

  const handleSubmitApproval = async (id: string) => {
    const bank = banks.find((b) => b.id === id)
    if (!bank?.batchId) {
      alert("该题库未关联批次，无法提交审批")
      return
    }
    const batch = batches.find((b) => b.id === bank.batchId)
    try {
      await questionBankApi.submit(id)
      await approvalApi.create({ targetType: "question_bank", targetId: id, workflowId: batch?.workflowId })
      await loadData()
    } catch (err) {
      console.error("提交审批失败", err)
      alert("提交审批失败")
    }
  }

  const handleWithdrawApproval = async (id: string) => {
    try {
      await questionBankApi.withdraw(id)
      await loadData()
    } catch (err) {
      console.error("撤回审批失败", err)
      alert("撤回审批失败")
    }
  }

  const handleInviteCoBuild = async (bank: BackendQuestionBank) => {
    const userId = window.prompt(`请输入要邀请共建「${bank.name}」的用户 ID`)
    if (!userId) return
    try {
      await questionBankApi.invite(bank.id, userId)
      await loadData()
    } catch (err) {
      console.error("邀请共建失败", err)
      alert("邀请共建失败")
    }
  }

  const handleReview = async (id: string, status: "approved" | "rejected") => {
    try {
      const records = await approvalApi.list({ targetType: "question_bank", targetId: id, status: "pending", limit: 1 })
      if (records.items.length === 0) {
        alert("未找到审批记录")
        return
      }
      await approvalApi.review(records.items[0].id, { status })
      await loadData()
    } catch (err) {
      console.error("审批操作失败", err)
      alert("审批操作失败")
    }
  }

  const handlePublish = async (id: string) => {
    try {
      await questionBankApi.publish(id)
      await loadData()
    } catch (err) {
      console.error("发布失败", err)
      alert("发布失败")
    }
  }

  const handleUnpublish = async (id: string) => {
    try {
      await questionBankApi.unpublish(id)
      await loadData()
    } catch (err) {
      console.error("取消发布失败", err)
      alert("取消发布失败")
    }
  }

  const handleClone = (bank: BackendQuestionBank) => {
    setCloneTargetBank(bank)
    setCloneRenameValue(`${bank.name} (克隆)`)
    setIsCloneRenameDialogOpen(true)
  }

  const handleConfirmClone = async () => {
    if (!cloneTargetBank || !cloneRenameValue.trim()) return
    try {
      const cloned = (await questionBankApi.create({
        name: cloneRenameValue.trim(),
        description: cloneTargetBank.description,
        status: "draft",
        ownerType: "mine",
        version: "v1.0",
        isDraftPool: false,
        collaboratorIds: [],
        collaboratorDeptIds: [],
        batchId: cloneTargetBank.batchId || undefined,
      })) as unknown as BackendQuestionBank

      const questionsRes = (await questionApi.list({ bankId: cloneTargetBank.id, limit: 1000 })) as unknown as {
        items: Question[]
      }
      for (const q of questionsRes.items) {
        await questionApi.create({
          bankId: cloned.id,
          type: q.type,
          content: q.content,
          options: q.options,
          answer: q.answer,
          analysis: q.analysis,
          score: q.score,
          difficulty: q.difficulty,
          knowledgePoints: q.knowledgePoints,
          status: "draft",
        })
      }
      setIsCloneRenameDialogOpen(false)
      setCloneTargetBank(null)
      setCloneRenameValue("")
      setSelectedIds([])
      await loadData()
    } catch (err) {
      console.error("克隆失败", err)
      alert("克隆失败")
    }
  }

  const handleBatchSubmitApproval = async () => {
    for (const bank of selectedBanks) {
      if (bank.status === "draft" || bank.status === "rejected") {
        await questionBankApi.submit(bank.id)
      }
    }
    setSelectedIds([])
    await loadData()
  }

  const handleBatchWithdrawApproval = async () => {
    for (const bank of selectedBanks) {
      if (bank.status === "pending") {
        await questionBankApi.withdraw(bank.id)
      }
    }
    setSelectedIds([])
    await loadData()
  }

  const handleBatchPublish = async () => {
    for (const bank of selectedBanks) {
      if (bank.status === "approved") {
        await questionBankApi.publish(bank.id)
      }
    }
    setSelectedIds([])
    await loadData()
  }

  const handleBatchUnpublish = async () => {
    for (const bank of selectedBanks) {
      if (bank.status === "published") {
        await questionBankApi.unpublish(bank.id)
      }
    }
    setSelectedIds([])
    await loadData()
  }

  const handleBatchDelete = async () => {
    if (!confirm(`确定要删除选中的 ${selectedIds.length} 个题库吗？`)) return
    for (const id of selectedIds) {
      await questionBankApi.delete(id)
    }
    setSelectedIds([])
    await loadData()
  }

  const handleBatchClone = async () => {
    for (const bank of selectedBanks) {
      const cloned = (await questionBankApi.create({
        name: `${bank.name} (克隆)`,
        description: bank.description,
        status: "draft",
        ownerType: "mine",
        version: "v1.0",
        isDraftPool: false,
        collaboratorIds: [],
        collaboratorDeptIds: [],
        batchId: bank.batchId || undefined,
      })) as unknown as BackendQuestionBank

      const questionsRes = (await questionApi.list({ bankId: bank.id, limit: 1000 })) as unknown as {
        items: Question[]
      }
      for (const q of questionsRes.items) {
        await questionApi.create({
          bankId: cloned.id,
          type: q.type,
          content: q.content,
          options: q.options,
          answer: q.answer,
          analysis: q.analysis,
          score: q.score,
          difficulty: q.difficulty,
          knowledgePoints: q.knowledgePoints,
          status: "draft",
        })
      }
    }
    setSelectedIds([])
    await loadData()
  }

  const handleBatchMove = async () => {
    if (!moveTargetBatchId) return
    for (const id of selectedIds) {
      await questionBankApi.update(id, { batchId: moveTargetBatchId })
    }
    setSelectedIds([])
    setMoveTargetBatchId("")
    setIsBatchMoveDialogOpen(false)
    await loadData()
  }

  const handleBatchExport = async () => {
    await handleExport()
    setIsExportDialogOpen(false)
    setSelectedIds([])
  }

  const handleResetFilters = () => {
    setSearchQuery("")
    setSelectedBatchId(null)
    setSelectedStatus(null)
  }

  const handleImportFileSelect = (files: FileList | null) => {
    const file = files?.[0]
    if (file) setImportFile(file)
  }

  const handleImport = async () => {
    if (!importFile) return
    setIsImporting(true)
    try {
      const result = await importExportApi.import("question_banks", importFile)
      alert(`导入完成：成功 ${result.created} 条，失败 ${result.failed} 条`)
      setImportFile(null)
      setIsImportDialogOpen(false)
      await loadData()
    } catch (err: any) {
      alert(err.message || "导入失败")
    } finally {
      setIsImporting(false)
    }
  }

  const handleExport = async () => {
    const res = await importExportApi.export("question_banks")
    const blob = await res.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    const disposition = res.headers.get("content-disposition")
    const filename = disposition?.match(/filename="?([^";]+)"?/)?.[1] || "question_banks-export.csv"
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.URL.revokeObjectURL(url)
  }

  const allSelected = filteredBanks.length > 0 && filteredBanks.every((b) => selectedIds.includes(b.id))
  const someSelected = filteredBanks.some((b) => selectedIds.includes(b.id)) && !allSelected

  const renderTable = (items: BackendQuestionBank[]) => {
    const tableAllSelected = items.length > 0 && items.every((b) => selectedIds.includes(b.id))
    const tableSomeSelected = items.some((b) => selectedIds.includes(b.id)) && !tableAllSelected
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40px] text-center">
              <Checkbox
                checked={tableSomeSelected ? "indeterminate" : tableAllSelected}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setSelectedIds((prev) => Array.from(new Set([...prev, ...items.map((b) => b.id)])))
                  } else {
                    setSelectedIds((prev) => prev.filter((id) => !items.find((b) => b.id === id)))
                  }
                }}
                aria-label="全选"
              />
            </TableHead>
            <TableHead className="w-[200px]">题库名称</TableHead>
            <TableHead className="w-[200px]">题库简介</TableHead>
            <TableHead className="w-[100px]">题目数量</TableHead>
            <TableHead className="w-[140px]">所属批次</TableHead>
            <TableHead className="w-[100px]">创建人</TableHead>
            <TableHead className="w-[120px]">共建人</TableHead>
            <TableHead className="w-[100px]">状态</TableHead>
            <TableHead className="w-[120px]">创建时间</TableHead>
            <TableHead className="w-[120px]">更新时间</TableHead>
            <TableHead className="sticky right-0 w-[80px] bg-white text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((bank) => {
            const isSelected = selectedIds.includes(bank.id)
            const batchName = batches.find((b) => b.id === bank.batchId)?.name || "-"
            return (
              <TableRow key={bank.id} className={cn("group", isSelected && "bg-primary/5")}>
                <TableCell className="text-center">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={(checked) => handleSelectId(bank.id, checked === true)}
                    aria-label={`选择 ${bank.name}`}
                  />
                </TableCell>
                <TableCell>
                  <button
                    className="text-left text-sm font-medium hover:text-primary"
                    onClick={() => router.push(`/evaluation/question-banks/${bank.id}`)}
                  >
                    {bank.name}
                  </button>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-muted-foreground line-clamp-2">
                    {bank.description || "-"}
                  </span>
                </TableCell>
                <TableCell>{bank.questionCount} 题</TableCell>
                <TableCell className="text-sm text-muted-foreground">{batchName}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{bank.creatorId || "-"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {(bank.collaboratorIds?.length || 0) > 0 ? `${bank.collaboratorIds!.length} 人` : "-"}
                </TableCell>
                <TableCell>
                  <EvalStatusBadge status={bank.status} />
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{formatDate(bank.createdAt)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{formatDate(bank.updatedAt)}</TableCell>
                <TableCell className="sticky right-0 bg-white text-right relative">
                  <div className="flex items-center justify-end gap-1 absolute right-0 top-1/2 -translate-y-1/2 bg-white/95 backdrop-blur-sm z-10 px-2 py-1 rounded-lg shadow-sm border border-slate-100">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => router.push(`/evaluation/question-banks/${bank.id}`)}
                    >
                      <Eye className="mr-1 h-3 w-3" />
                      查看
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => handleClone(bank)}
                    >
                      <Copy className="mr-1 h-3 w-3" />
                      克隆
                    </Button>
                    {(bank.status === "draft" || bank.status === "rejected") && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-blue-600 hover:text-blue-700"
                        onClick={() => handleSubmitApproval(bank.id)}
                      >
                        <Send className="mr-1 h-3 w-3" />
                        提交审批
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-indigo-600 hover:text-indigo-700"
                      onClick={() => handleInviteCoBuild(bank)}
                    >
                      <UserPlus className="mr-1 h-3 w-3" />
                      邀请共建
                    </Button>
                    {bank.status === "pending" && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-emerald-600 hover:text-emerald-700"
                          onClick={() => handleReview(bank.id, "approved")}
                        >
                          <CheckCircle className="mr-1 h-3 w-3" />
                          通过
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-red-500 hover:text-red-600"
                          onClick={() => handleReview(bank.id, "rejected")}
                        >
                          <XCircle className="mr-1 h-3 w-3" />
                          驳回
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-amber-600 hover:text-amber-700"
                          onClick={() => handleWithdrawApproval(bank.id)}
                        >
                          <Undo2 className="mr-1 h-3 w-3" />
                          撤回
                        </Button>
                      </>
                    )}
                    {bank.status === "approved" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-indigo-600 hover:text-indigo-700"
                        onClick={() => handlePublish(bank.id)}
                      >
                        <Rocket className="mr-1 h-3 w-3" />
                        发布
                      </Button>
                    )}
                    {bank.status === "published" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-red-500 hover:text-red-600"
                        onClick={() => handleUnpublish(bank.id)}
                      >
                        <ArrowDownFromLine className="mr-1 h-3 w-3" />
                        取消发布
                      </Button>
                    )}
                    {(bank.status === "draft" || bank.status === "rejected") && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-red-500 hover:text-red-600"
                        onClick={() => handleDelete(bank)}
                      >
                        <Trash2 className="mr-1 h-3 w-3" />
                        删除
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeaderCard
        title="题库资源管理"
        description="维护题库及题目资源，支持审批、发布与批次分组管理"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setIsImportDialogOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              导入题库
            </Button>

            <Button size="sm" className="bg-primary hover:bg-primary/90" onClick={() => { resetCreateForm(); setIsCreateOpen(true) }}>
              <Plus className="mr-2 h-4 w-4" />
              新建题库
            </Button>
          </>
        }
        stats={
          activeTab !== "public"
            ? [
                {
                  label: "题库总数",
                  value: stats.total,
                  icon: <List className="h-3 w-3 text-blue-500" />,
                  iconClassName: "bg-blue-50",
                },
                {
                  label: "草稿",
                  value: stats.draft,
                  icon: <RotateCcw className="h-3 w-3 text-gray-500" />,
                  iconClassName: "bg-gray-50",
                },
                {
                  label: "审批中",
                  value: stats.pending,
                  icon: <GitBranch className="h-3 w-3 text-yellow-500" />,
                  iconClassName: "bg-yellow-50",
                },
                {
                  label: "已驳回",
                  value: stats.rejected,
                  icon: <X className="h-3 w-3 text-red-500" />,
                  iconClassName: "bg-red-50",
                },
                {
                  label: "已发布",
                  value: stats.published,
                  icon: <ArrowUpFromLine className="h-3 w-3 text-green-500" />,
                  iconClassName: "bg-green-50",
                },
              ]
            : undefined
        }
      />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <Tabs
          value={activeTab}
          onValueChange={(v) => {
            setActiveTab(v as TabType)
            setSelectedIds([])
            setSelectedBatchId(null)
          }}
        >
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="my" className="w-full">我的题库</TabsTrigger>
            <TabsTrigger value="collab" className="w-full">共建题库</TabsTrigger>
            <TabsTrigger value="public" className="w-full">公共题库</TabsTrigger>
          </TabsList>
        </Tabs>

        <ToggleGroup type="single" value={viewMode} onValueChange={(v) => v && setViewMode(v as ViewMode)}>
          <ToggleGroupItem value="list" aria-label="资源列表">
            <List className="h-4 w-4" />
            <span className="ml-1.5">资源列表</span>
          </ToggleGroupItem>
          <ToggleGroupItem value="group" aria-label="批次分组">
            <LayoutGrid className="h-4 w-4" />
            <span className="ml-1.5">批次分组</span>
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardContent className="flex flex-col gap-4 p-5">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[200px]">
              <div className="flex items-center gap-2 w-full">
                <Search className="h-4 w-4 text-slate-400" />
                <Input
                  placeholder="搜索题库名称 / 简介"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 text-sm flex-1"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Select value={selectedBatchId || "__all__"} onValueChange={(v) => setSelectedBatchId(v === "__all__" ? null : v)}>
                <SelectTrigger className="h-9 text-sm w-44">
                  <SelectValue placeholder="按批次筛选" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">全部批次</SelectItem>
                  {batches.map((batch) => (
                    <SelectItem key={batch.id} value={batch.id}>
                      <span className="flex items-center gap-2">
                        {batch.name}
                        <span className="text-xs text-gray-400">({batch.code || batch.id.slice(0, 8)})</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedStatus || "__all__"} onValueChange={(v) => setSelectedStatus(v === "__all__" ? null : (v as BackendStatus))}>
                <SelectTrigger className="h-9 text-sm w-36">
                  <SelectValue placeholder="按状态筛选" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">全部状态</SelectItem>
                  <SelectItem value="draft">草稿</SelectItem>
                  <SelectItem value="pending">审批中</SelectItem>
                  <SelectItem value="rejected">已驳回</SelectItem>
                  <SelectItem value="published">已发布</SelectItem>
                  <SelectItem value="archived">已归档</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="sm" className="h-9" onClick={handleResetFilters}>
              <RotateCcw className="mr-1 h-3.5 w-3.5" />
              重置
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
            <span className={cn("text-xs mr-1", hasSelected ? "text-slate-700 font-medium" : "text-slate-400")}>
              {hasSelected ? `已选择 ${selectedIds.length} 项：` : "请选择题库："}
            </span>
            <Button variant="outline" size="sm" className="h-8 text-xs" disabled={!hasSelected || !canBatchSubmit} onClick={handleBatchSubmitApproval}>
              <Send className="mr-1 h-3 w-3" />
              提交审批
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs" disabled={!hasSelected || !canBatchWithdraw} onClick={handleBatchWithdrawApproval}>
              <Undo2 className="mr-1 h-3 w-3" />
              撤回审批
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs" disabled={!hasSelected || !canBatchPublish} onClick={handleBatchPublish}>
              <ArrowUpFromLine className="mr-1 h-3 w-3" />
              发布
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs" disabled={!hasSelected || !canBatchUnpublish} onClick={handleBatchUnpublish}>
              <ArrowDownFromLine className="mr-1 h-3 w-3" />
              取消发布
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs" disabled={!hasSelected || !canBatchDelete} onClick={handleBatchDelete}>
              <Trash2 className="mr-1 h-3 w-3" />
              删除
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs" disabled={!hasSelected} onClick={handleBatchClone}>
              <Copy className="mr-1 h-3 w-3" />
              克隆
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs" disabled={!hasSelected} onClick={() => setIsBatchMoveDialogOpen(true)}>
              <FolderKanban className="mr-1 h-3 w-3" />
              调整批次分组
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs" disabled={!hasSelected} onClick={handleBatchExport}>
              <Download className="mr-1 h-3 w-3" />
              导出
            </Button>
          </div>
        </CardContent>

        {filteredBanks.length > 0 && viewMode !== "group" && (
          <CardContent className="pt-0">
            <div className="overflow-x-auto">{renderTable(filteredBanks)}</div>
          </CardContent>
        )}
      </Card>

      {viewMode === "group" && banksByBatch && (
        <div className="space-y-4">
          {Object.entries(banksByBatch).map(([batchId, batchBanks]) => {
            const batch = batches.find((b) => b.id === batchId)
            if (!batch) return null
            const isExpanded = expandedBatches.includes(batchId)
            return (
              <Collapsible key={batchId} open={isExpanded} onOpenChange={() => toggleBatch(batchId)}>
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                  <CollapsibleTrigger asChild>
                    <div className="flex cursor-pointer items-center justify-between px-4 py-3 transition-colors hover:bg-slate-50">
                      <div className="flex items-center gap-3">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-gray-400" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-gray-400" />
                        )}
                        <span className="font-medium text-gray-800">{batch.name}</span>
                        <span className="text-xs text-gray-400">({batch.code || batch.id.slice(0, 8)})</span>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {batchBanks.length} 个题库
                      </Badge>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="p-4 pt-0 overflow-x-auto">{renderTable(batchBanks)}</div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            )
          })}
          {uncategorizedBanks.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-dashed border-slate-300 bg-white">
              <div className="flex items-center justify-between px-4 py-3 bg-slate-50/80">
                <div className="flex items-center gap-3">
                  <span className="font-medium text-gray-800">未分类</span>
                  <Badge variant="secondary" className="text-xs">
                    {uncategorizedBanks.length} 个题库
                  </Badge>
                </div>
              </div>
              <div className="p-4 pt-0 overflow-x-auto">{renderTable(uncategorizedBanks)}</div>
            </div>
          )}
        </div>
      )}

      {!loading && filteredBanks.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white py-20 shadow-sm">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
            <Search className="h-8 w-8 text-slate-400" />
          </div>
          <h3 className="mb-2 text-lg font-medium text-slate-700">暂无题库</h3>
          <p className="mb-4 text-sm text-slate-500">当前筛选条件下没有题库数据</p>
          <Button size="sm" onClick={() => { resetCreateForm(); setIsCreateOpen(true) }}>
            <Plus className="mr-2 h-4 w-4" />
            新建题库
          </Button>
        </div>
      )}

      {loading && filteredBanks.length === 0 && (
        <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
          加载中...
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>新建题库</DialogTitle>
            <DialogDescription>创建一个新的题库来管理题目</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="bankName">题库名称 <span className="text-red-500">*</span></Label>
              <Input
                id="bankName"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="请输入题库名称"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="bankDesc">题库简介</Label>
              <Input
                id="bankDesc"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="请输入题库简介（可选）"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="bankBatch">所属批次</Label>
              <Select value={newBatchId || "none"} onValueChange={(v) => setNewBatchId(v === "none" ? "" : v)}>
                <SelectTrigger id="bankBatch">
                  <SelectValue placeholder="选择所属批次" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">不设置批次</SelectItem>
                  {batches.map((batch) => (
                    <SelectItem key={batch.id} value={batch.id}>
                      {batch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>取消</Button>
            <Button onClick={handleCreate} disabled={!newName.trim()}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>导入题库</DialogTitle>
            <DialogDescription>上传 CSV 文件批量导入题库数据（需包含 name 列）</DialogDescription>
          </DialogHeader>
          <div className="py-8">
            <div
              className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground mb-2">
                {importFile ? importFile.name : "点击选择 CSV 文件"}
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => handleImportFileSelect(e.target.files)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsImportDialogOpen(false)}>取消</Button>
            <Button onClick={handleImport} disabled={!importFile || isImporting}>
              {isImporting ? "导入中..." : "开始导入"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export Dialog */}
      <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>导出题库</DialogTitle>
            <DialogDescription>将选中的题库数据导出为文件</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-slate-500">已选择 {selectedIds.length} 个题库</p>
            <div className="grid gap-2">
              <Label>导出格式</Label>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1">Excel (.xlsx)</Button>
                <Button variant="outline" size="sm" className="flex-1">CSV (.csv)</Button>
                <Button variant="outline" size="sm" className="flex-1">JSON (.json)</Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsExportDialogOpen(false)}>取消</Button>
            <Button onClick={handleBatchExport}>确认导出</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch Move Dialog */}
      <Dialog open={isBatchMoveDialogOpen} onOpenChange={setIsBatchMoveDialogOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>调整批次分组</DialogTitle>
            <DialogDescription>将选中的 {selectedIds.length} 个题库移动到指定批次</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select value={moveTargetBatchId} onValueChange={setMoveTargetBatchId}>
              <SelectTrigger>
                <SelectValue placeholder="选择目标批次" />
              </SelectTrigger>
              <SelectContent>
                {batches.map((batch) => (
                  <SelectItem key={batch.id} value={batch.id}>
                    {batch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBatchMoveDialogOpen(false)}>取消</Button>
            <Button onClick={handleBatchMove} disabled={!moveTargetBatchId}>确认移动</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clone Rename Dialog */}
      <Dialog open={isCloneRenameDialogOpen} onOpenChange={setIsCloneRenameDialogOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>克隆题库</DialogTitle>
            <DialogDescription>为克隆的题库命名</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={cloneRenameValue}
              onChange={(e) => setCloneRenameValue(e.target.value)}
              placeholder="输入新题库名称"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCloneRenameDialogOpen(false)}>取消</Button>
            <Button onClick={handleConfirmClone} disabled={!cloneRenameValue.trim()}>确认克隆</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
