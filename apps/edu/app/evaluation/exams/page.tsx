"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Archive,
  ArrowDownFromLine,
  ArrowUpFromLine,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  Eye,
  FileText,
  FolderKanban,
  GitBranch,
  LayoutGrid,
  List,
  MessageSquare,
  Pencil,
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
import { examApi, evaluationBatchApi, importExportApi, approvalApi, majorApi, workflowApi } from "@/lib/api"
import type { Exam, EvaluationBatch } from "@/lib/types"
import type { Major, Workflow } from "@/lib/types/backend"
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
import { ExamFormDialog } from "@/components/evaluation/exam-form-dialog"
import { cn } from "@/lib/utils"
import { useAuth } from "@/components/auth-provider"
import { UserSelector } from "@/components/shared/user-selector"
import type { ExamFormData } from "@/lib/types"


type TabType = "my" | "collab" | "public"
type ViewMode = "list" | "group"
type BackendStatus = "draft" | "pending" | "approved" | "rejected" | "published" | "archived"

interface BackendExam extends Omit<Exam, "status" | "createdAt" | "updatedAt"> {
  status: BackendStatus
  createdAt: string
  updatedAt: string
  rejectReason?: string
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
  return new Date(iso).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default function ExamsPage() {
  const router = useRouter()
  const { hasPermission, user, tenantId } = useAuth()
  const currentUserId = user?.id ?? ""

  const [exams, setExams] = useState<BackendExam[]>([])
  const [batches, setBatches] = useState<EvaluationBatch[]>([])
  const [majors, setMajors] = useState<Major[]>([])
  const [workflows, setWorkflows] = useState<Workflow[]>([])
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
  const [newDuration, setNewDuration] = useState("60")
  const [newBatchId, setNewBatchId] = useState("")

  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false)
  const [isBatchMoveDialogOpen, setIsBatchMoveDialogOpen] = useState(false)
  const [moveTargetBatchId, setMoveTargetBatchId] = useState("")
  const [moveSelectedMajorId, setMoveSelectedMajorId] = useState("all")
  const [isSubmitBatchDialogOpen, setIsSubmitBatchDialogOpen] = useState(false)
  const [submitBatchTarget, setSubmitBatchTarget] = useState<BackendExam | null>(null)
  const [submitSelectedBatchId, setSubmitSelectedBatchId] = useState("")
  const [submitSelectedMajorId, setSubmitSelectedMajorId] = useState("all")

  const [isCloneRenameDialogOpen, setIsCloneRenameDialogOpen] = useState(false)
  const [cloneRenameValue, setCloneRenameValue] = useState("")
  const [cloneTargetExam, setCloneTargetExam] = useState<BackendExam | null>(null)

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingExam, setEditingExam] = useState<BackendExam | null>(null)

  const [importFile, setImportFile] = useState<File | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false)
  const [inviteTarget, setInviteTarget] = useState<BackendExam | null>(null)
  const [inviteSelectedIds, setInviteSelectedIds] = useState<string[]>([])

  const [isRejectReasonDialogOpen, setIsRejectReasonDialogOpen] = useState(false)
  const [rejectReasonTarget, setRejectReasonTarget] = useState<BackendExam | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [examsRes, batchesRes] = await Promise.all([
        examApi.list({ limit: 1000 }) as unknown as {
          items: BackendExam[]
          total: number
        },
        evaluationBatchApi.list({ limit: 1000 }),
      ])
      setExams(examsRes.items)
      setBatches(batchesRes.items)

      const loadedExams = examsRes.items
      const rejectedExams = loadedExams.filter((e) => e.status === "rejected")
      if (rejectedExams.length > 0) {
        try {
          const approvalsResp = await approvalApi.list({
            targetType: "exam",
            status: "rejected",
            limit: 1000,
          }) as unknown as { items: { targetId: string; history?: { action?: string; remark?: string }[] }[] }
          const reasonMap = new Map<string, string>()
          for (const record of approvalsResp.items) {
            if (reasonMap.has(record.targetId)) continue
            const history = record.history || []
            for (let i = history.length - 1; i >= 0; i--) {
              const h = history[i]
              const action = h.action
              const remark = h.remark
              if (action === "rejected" && remark) {
                reasonMap.set(record.targetId, remark)
                break
              }
            }
          }
          setExams(loadedExams.map((e) => {
            if (e.status === "rejected" && reasonMap.has(e.id)) {
              return { ...e, rejectReason: reasonMap.get(e.id) }
            }
            return e
          }))
        } catch (_) {
          // 审批记录读取失败不影响列表展示
        }
      }

      if (tenantId) {
        try {
          const [majorsRes, workflowsRes] = await Promise.all([
            majorApi.list({ tenantId, limit: 1000 }),
            workflowApi.list({ limit: 1000 }),
          ])
          setMajors((majorsRes.items as Major[]).filter((m) => m.enabled))
          setWorkflows(workflowsRes.items as Workflow[])
        } catch (_) {
          // 专业/审批流加载失败不影响列表展示
        }
      }
    } catch (err) {
      console.error("加载数据失败", err)
      alert("加载数据失败，请稍后重试")
    } finally {
      setLoading(false)
    }
  }, [tenantId])

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

  const tabFilteredExams = useMemo(() => {
    switch (activeTab) {
      case "my":
        return exams.filter((e) => e.creatorId === currentUserId)
      case "collab":
        return exams.filter((e) => (e.collaboratorIds || []).includes(currentUserId))
      case "public":
      default:
        return exams.filter((e) => e.status === "published")
    }
  }, [exams, activeTab, currentUserId])

  const filteredExams = useMemo(() => {
    let result = tabFilteredExams
    const q = searchQuery.trim().toLowerCase()
    if (q) {
      result = result.filter(
        (e) => e.name.toLowerCase().includes(q) || e.description.toLowerCase().includes(q)
      )
    }
    if (selectedBatchId) {
      result = result.filter((e) => e.batchId === selectedBatchId)
    }
    if (selectedStatus) {
      result = result.filter((e) => e.status === selectedStatus)
    }
    return result
  }, [tabFilteredExams, searchQuery, selectedBatchId, selectedStatus])

  const stats = useMemo(() => {
    const total = filteredExams.length
    const draft = filteredExams.filter((e) => e.status === "draft").length
    const pending = filteredExams.filter((e) => e.status === "pending").length
    const rejected = filteredExams.filter((e) => e.status === "rejected").length
    const published = filteredExams.filter((e) => e.status === "published").length
    return { total, draft, pending, rejected, published }
  }, [filteredExams])

  const examsByBatch = useMemo(() => {
    if (viewMode !== "group") return null
    const groups: Record<string, BackendExam[]> = {}
    filteredExams.forEach((e) => {
      if (!e.batchId) return
      if (!groups[e.batchId]) groups[e.batchId] = []
      groups[e.batchId].push(e)
    })
    return groups
  }, [filteredExams, viewMode])

  const uncategorizedExams = useMemo(
    () => filteredExams.filter((e) => !e.batchId && e.status === "draft"),
    [filteredExams]
  )

  const filteredBatchesByMajor = useMemo(() => {
    if (moveSelectedMajorId === "all") return batches
    return batches.filter((b) => {
      const wf = workflows.find((w) => w.id === b.workflowId)
      return wf && (wf.majorIds || []).includes(moveSelectedMajorId)
    })
  }, [batches, workflows, moveSelectedMajorId])

  const submitFilteredBatches = useMemo(() => {
    if (submitSelectedMajorId === "all") return batches
    return batches.filter((b) => {
      const wf = workflows.find((w) => w.id === b.workflowId)
      return wf && (wf.majorIds || []).includes(submitSelectedMajorId)
    })
  }, [batches, workflows, submitSelectedMajorId])

  const handleSelectId = (id: string, checked: boolean) => {
    setSelectedIds((prev) => (checked ? [...prev, id] : prev.filter((sid) => sid !== id)))
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(filteredExams.map((e) => e.id))
    } else {
      setSelectedIds([])
    }
  }

  const selectedExams = useMemo(
    () => filteredExams.filter((e) => selectedIds.includes(e.id)),
    [filteredExams, selectedIds]
  )
  const hasSelected = selectedIds.length > 0

  const canBatchSubmit = selectedExams.some((e) => e.status === "draft" || e.status === "rejected")
  const canBatchWithdraw = selectedExams.some((e) => e.status === "pending")
  const canBatchPublish = selectedExams.some((e) => e.status === "approved")
  const canBatchUnpublish = selectedExams.some((e) => e.status === "published")
  const canBatchDelete = selectedExams.some((e) => e.status === "draft" || e.status === "rejected" || e.status === "archived")

  const resetCreateForm = () => {
    setNewName("")
    setNewDescription("")
    setNewDuration("60")
    setNewBatchId("")
  }

  const handleCreate = async () => {
    if (!newName.trim()) return
    const duration = parseInt(newDuration, 10) || 60
    try {
      const created = (await examApi.create({
        name: newName.trim(),
        description: newDescription.trim(),
        duration,
        status: "draft",
        ownerType: "mine",
        version: "v1.0",
        questions: [],
        collaboratorIds: [],
        collaboratorDeptIds: [],
        batchId: newBatchId || undefined,
      })) as unknown as BackendExam
      setIsCreateOpen(false)
      resetCreateForm()
      router.push(`/evaluation/exams/${created.id}?new=true`)
    } catch (err) {
      console.error("创建试卷失败", err)
      alert("创建试卷失败")
    }
  }

  const handleDelete = async (exam: BackendExam) => {
    if (confirm(`确定要删除试卷「${exam.name}」吗？`)) {
      try {
        await examApi.delete(exam.id)
        await loadData()
      } catch (err) {
        console.error("删除失败", err)
        alert("删除失败")
      }
    }
  }

  const handleEdit = (exam: BackendExam) => {
    setEditingExam(exam)
    setIsEditDialogOpen(true)
  }

  const handleEditSubmit = async (data: ExamFormData) => {
    if (!editingExam) return
    try {
      await examApi.update(editingExam.id, {
        name: data.name,
        description: data.description,
        duration: data.duration,
        coverImage: data.coverImage,
        collaboratorIds: data.collaboratorIds,
        batchId: data.batchId,
      })
      setIsEditDialogOpen(false)
      setEditingExam(null)
      await loadData()
    } catch (err) {
      console.error("编辑试卷失败", err)
      alert("编辑试卷失败")
    }
  }

  const handleSubmitApproval = async (id: string) => {
    const exam = exams.find((e) => e.id === id)
    if (!exam?.batchId) {
      setSubmitBatchTarget(exam || null)
      setSubmitSelectedMajorId("all")
      setSubmitSelectedBatchId("")
      setIsSubmitBatchDialogOpen(true)
      return
    }
    const batch = batches.find((b) => b.id === exam.batchId)
    try {
      await examApi.submit(id)
      await approvalApi.create({ targetType: "exam", targetId: id, workflowId: batch?.workflowId })
      await loadData()
    } catch (err) {
      console.error("提交审批失败", err)
      alert("提交审批失败")
    }
  }

  const handleConfirmSubmitBatch = async () => {
    if (!submitBatchTarget || !submitSelectedBatchId) return
    const batch = batches.find((b) => b.id === submitSelectedBatchId)
    if (!batch) return
    try {
      await examApi.update(submitBatchTarget.id, { name: submitBatchTarget.name, batchId: submitSelectedBatchId })
      await examApi.submit(submitBatchTarget.id)
      await approvalApi.create({ targetType: "exam", targetId: submitBatchTarget.id, workflowId: batch.workflowId })
      setIsSubmitBatchDialogOpen(false)
      setSubmitBatchTarget(null)
      setSubmitSelectedBatchId("")
      setSubmitSelectedMajorId("all")
      await loadData()
    } catch (err) {
      console.error("提交审批失败", err)
      alert("提交审批失败")
    }
  }

  const handleWithdrawApproval = async (id: string) => {
    try {
      await examApi.withdraw(id)
      await loadData()
    } catch (err) {
      console.error("撤回审批失败", err)
      alert("撤回审批失败")
    }
  }

  const handleInviteCoBuild = (exam: BackendExam) => {
    setInviteTarget(exam)
    setInviteSelectedIds((exam.collaboratorIds || []).filter((id) => id !== exam.creatorId))
    setIsInviteDialogOpen(true)
  }

  const handleInviteConfirm = async () => {
    if (!inviteTarget) return
    try {
      await examApi.update(inviteTarget.id, { collaboratorIds: inviteSelectedIds })
      setIsInviteDialogOpen(false)
      setInviteTarget(null)
      await loadData()
    } catch (_) {
      alert("调整共建人失败，请稍后重试")
    }
  }

  const handleArchive = async (id: string) => {
    try {
      await examApi.archive(id)
      await loadData()
    } catch (err) {
      console.error("归档失败", err)
      alert("归档失败")
    }
  }

  const handleViewRejectReason = (exam: BackendExam) => {
    setRejectReasonTarget(exam)
    setIsRejectReasonDialogOpen(true)
  }

  const handleReview = async (id: string, status: "approved" | "rejected") => {
    try {
      const records = await approvalApi.list({ targetType: "exam", targetId: id, limit: 1 })
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
      await examApi.publish(id)
      await loadData()
    } catch (err) {
      console.error("发布失败", err)
      alert("发布失败")
    }
  }

  const handleUnpublish = async (id: string) => {
    try {
      await examApi.unpublish(id)
      await loadData()
    } catch (err) {
      console.error("取消发布失败", err)
      alert("取消发布失败")
    }
  }

  const handleClone = (exam: BackendExam) => {
    setCloneTargetExam(exam)
    setCloneRenameValue(`${exam.name} (克隆)`)
    setIsCloneRenameDialogOpen(true)
  }

  const handleConfirmClone = async () => {
    if (!cloneTargetExam || !cloneRenameValue.trim()) return
    try {
      const cloned = (await examApi.create({
        name: cloneRenameValue.trim(),
        description: cloneTargetExam.description,
        duration: cloneTargetExam.duration,
        status: "draft",
        ownerType: "mine",
        version: "v1.0",
        questions: [],
        collaboratorIds: [],
        collaboratorDeptIds: [],
        batchId: cloneTargetExam.batchId || undefined,
      })) as unknown as BackendExam

      for (const q of cloneTargetExam.questions || []) {
        await examApi.addQuestion(cloned.id, q.questionId, q.score)
      }
      setIsCloneRenameDialogOpen(false)
      setCloneTargetExam(null)
      setCloneRenameValue("")
      setSelectedIds([])
      await loadData()
    } catch (err) {
      console.error("克隆失败", err)
      alert("克隆失败")
    }
  }

  const handleBatchSubmitApproval = async () => {
    for (const exam of selectedExams) {
      if (exam.status === "draft" || exam.status === "rejected") {
        await examApi.submit(exam.id)
      }
    }
    setSelectedIds([])
    await loadData()
  }

  const handleBatchWithdrawApproval = async () => {
    for (const exam of selectedExams) {
      if (exam.status === "pending") {
        await examApi.withdraw(exam.id)
      }
    }
    setSelectedIds([])
    await loadData()
  }

  const handleBatchPublish = async () => {
    for (const exam of selectedExams) {
      if (exam.status === "approved") {
        await examApi.publish(exam.id)
      }
    }
    setSelectedIds([])
    await loadData()
  }

  const handleBatchUnpublish = async () => {
    for (const exam of selectedExams) {
      if (exam.status === "published") {
        await examApi.unpublish(exam.id)
      }
    }
    setSelectedIds([])
    await loadData()
  }

  const handleBatchDelete = async () => {
    if (!confirm(`确定要删除选中的 ${selectedIds.length} 个试卷吗？`)) return
    for (const id of selectedIds) {
      await examApi.delete(id)
    }
    setSelectedIds([])
    await loadData()
  }

  const handleBatchClone = async () => {
    for (const exam of selectedExams) {
      const cloned = (await examApi.create({
        name: `${exam.name} (克隆)`,
        description: exam.description,
        duration: exam.duration,
        status: "draft",
        ownerType: "mine",
        version: "v1.0",
        questions: [],
        collaboratorIds: [],
        collaboratorDeptIds: [],
        batchId: exam.batchId || undefined,
      })) as unknown as BackendExam

      for (const q of exam.questions || []) {
        await examApi.addQuestion(cloned.id, q.questionId, q.score)
      }
    }
    setSelectedIds([])
    await loadData()
  }

  const handleBatchMove = async () => {
    if (!moveTargetBatchId) return
    for (const id of selectedIds) {
      await examApi.update(id, { batchId: moveTargetBatchId })
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
      const result = await importExportApi.import("exams", importFile)
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
    const res = await importExportApi.export("exams")
    const blob = await res.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    const disposition = res.headers.get("content-disposition")
    const filename = disposition?.match(/filename="?([^";]+)"?/)?.[1] || "exams-export.csv"
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.URL.revokeObjectURL(url)
  }

  const allSelected = filteredExams.length > 0 && filteredExams.every((e) => selectedIds.includes(e.id))
  const someSelected = filteredExams.some((e) => selectedIds.includes(e.id)) && !allSelected

  const renderTable = (items: BackendExam[]) => {
    const tableAllSelected = items.length > 0 && items.every((e) => selectedIds.includes(e.id))
    const tableSomeSelected = items.some((e) => selectedIds.includes(e.id)) && !tableAllSelected
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40px] text-center">
              <Checkbox
                checked={tableSomeSelected ? "indeterminate" : tableAllSelected}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setSelectedIds((prev) => Array.from(new Set([...prev, ...items.map((e) => e.id)])))
                  } else {
                    setSelectedIds((prev) => prev.filter((id) => !items.find((e) => e.id === id)))
                  }
                }}
                aria-label="全选"
              />
            </TableHead>
            <TableHead className="w-[180px]">试卷名称</TableHead>
            <TableHead className="w-[200px]">试卷简介</TableHead>
            <TableHead className="w-[80px]">题目数量</TableHead>
            <TableHead className="w-[80px]">总分</TableHead>
            <TableHead className="w-[120px]">所属批次</TableHead>
            <TableHead className="w-[100px]">创建人</TableHead>
            <TableHead className="w-[120px]">共建人</TableHead>
            <TableHead className="w-[100px]">状态</TableHead>
            <TableHead className="w-[130px]">创建时间</TableHead>
            <TableHead className="w-[130px]">更新时间</TableHead>
            <TableHead className="sticky right-0 w-[80px] bg-white text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((exam) => {
            const isSelected = selectedIds.includes(exam.id)
            const batchName = batches.find((b) => b.id === exam.batchId)?.name || "-"
            return (
              <TableRow key={exam.id} className={cn("group", isSelected && "bg-primary/5")}>
                <TableCell className="text-center">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={(checked) => handleSelectId(exam.id, checked === true)}
                    aria-label={`选择 ${exam.name}`}
                  />
                </TableCell>
                <TableCell>
                  <button
                    className="text-left text-sm font-medium hover:text-primary"
                    onClick={() => router.push(`/evaluation/exams/${exam.id}`)}
                  >
                    {exam.name}
                  </button>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-muted-foreground line-clamp-2">
                    {exam.description || "-"}
                  </span>
                </TableCell>
                <TableCell>{(exam.questions || []).length} 题</TableCell>
                <TableCell>{exam.totalScore} 分</TableCell>
                <TableCell className="text-sm text-muted-foreground">{batchName}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{exam.creatorName || exam.creatorId || "-"}</TableCell>
                <TableCell className="text-sm text-muted-foreground truncate">
                  {exam.collaboratorNames && exam.collaboratorNames.length > 0 ? exam.collaboratorNames.join(", ") : "-"}
                </TableCell>
                <TableCell>
                  <EvalStatusBadge status={exam.status} />
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{formatDate(exam.createdAt)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{formatDate(exam.updatedAt)}</TableCell>
                <TableCell className="sticky right-0 bg-white text-right relative">
                  <div className="flex items-center justify-end gap-1 absolute right-0 top-1/2 -translate-y-1/2 bg-white/95 backdrop-blur-sm z-10 px-2 py-1 rounded-lg shadow-sm border border-slate-100 opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => router.push(`/evaluation/exams/${exam.id}`)}
                    >
                      <Eye className="mr-1 h-3 w-3" />
                      查看
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => handleClone(exam)}
                    >
                      <Copy className="mr-1 h-3 w-3" />
                      克隆
                    </Button>
                    {exam.status !== "archived" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => handleEdit(exam)}
                      >
                        <Pencil className="mr-1 h-3 w-3" />
                        编辑
                      </Button>
                    )}
                    {exam.status === "archived" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-emerald-600 hover:text-emerald-700"
                        onClick={() => handleUnpublish(exam.id)}
                      >
                        <RotateCcw className="mr-1 h-3 w-3" />
                        恢复
                      </Button>
                    )}
                    {(exam.status === "draft" || exam.status === "rejected") && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-blue-600 hover:text-blue-700"
                        onClick={() => handleSubmitApproval(exam.id)}
                      >
                        <Send className="mr-1 h-3 w-3" />
                        提交审批
                      </Button>
                    )}
                    {exam.status === "rejected" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-orange-600 hover:text-orange-700"
                        onClick={() => handleViewRejectReason(exam)}
                      >
                        <MessageSquare className="mr-1 h-3 w-3" />
                        查看驳回原因
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-indigo-600 hover:text-indigo-700"
                      onClick={() => handleInviteCoBuild(exam)}
                    >
                      <UserPlus className="mr-1 h-3 w-3" />
                      邀请共建
                     </Button>
                    {exam.status !== "pending" && exam.status !== "archived" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-purple-600 hover:text-purple-700"
                        onClick={() => handleArchive(exam.id)}
                      >
                        <Archive className="mr-1 h-3 w-3" />
                        归档
                      </Button>
                    )}
                    {exam.status === "pending" && (
                      <>
                        {hasPermission("evaluation", "exams", "review") && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-emerald-600 hover:text-emerald-700"
                            onClick={() => handleReview(exam.id, "approved")}
                          >
                            <CheckCircle className="mr-1 h-3 w-3" />
                            通过
                          </Button>
                        )}
                        {hasPermission("evaluation", "exams", "reject") && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-red-500 hover:text-red-600"
                            onClick={() => handleReview(exam.id, "rejected")}
                          >
                            <XCircle className="mr-1 h-3 w-3" />
                            驳回
                          </Button>
                        )}
                        {hasPermission("evaluation", "exams", "withdraw_approval") && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-amber-600 hover:text-amber-700"
                            onClick={() => handleWithdrawApproval(exam.id)}
                          >
                            <Undo2 className="mr-1 h-3 w-3" />
                            撤回
                          </Button>
                        )}
                      </>
                    )}
                    {exam.status === "approved" && hasPermission("evaluation", "exams", "publish") && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-indigo-600 hover:text-indigo-700"
                        onClick={() => handlePublish(exam.id)}
                      >
                        <Rocket className="mr-1 h-3 w-3" />
                        发布
                      </Button>
                    )}
                    {exam.status === "published" && hasPermission("evaluation", "exams", "unpublish") && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-red-500 hover:text-red-600"
                        onClick={() => handleUnpublish(exam.id)}
                      >
                        <ArrowDownFromLine className="mr-1 h-3 w-3" />
                        取消发布
                      </Button>
                    )}
                    {hasPermission("evaluation", "exams", "delete") && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-red-500 hover:text-red-600"
                        onClick={() => handleDelete(exam)}
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
        title="试卷资源管理"
        description="维护试卷资源，支持组卷、审批、发布与批次分组管理"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setIsImportDialogOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              导入试卷
            </Button>

            <Button size="sm" className="bg-primary hover:bg-primary/90" onClick={() => { resetCreateForm(); setIsCreateOpen(true) }}>
              <Plus className="mr-2 h-4 w-4" />
              新建试卷
            </Button>
          </>
        }
        stats={
          activeTab !== "public"
            ? [
                {
                  label: "试卷总数",
                  value: stats.total,
                  icon: <FileText className="h-3 w-3 text-blue-500" />,
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
            <TabsTrigger value="my" className="w-full">我的试卷</TabsTrigger>
            <TabsTrigger value="collab" className="w-full">共建试卷</TabsTrigger>
            <TabsTrigger value="public" className="w-full">公共试卷</TabsTrigger>
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
                  placeholder="搜索试卷名称 / 简介"
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
              {hasSelected ? `已选择 ${selectedIds.length} 项：` : "请选择试卷："}
            </span>
            {hasPermission("evaluation", "exams", "submit_approval") && (
              <Button variant="outline" size="sm" className="h-8 text-xs" disabled={!hasSelected || !canBatchSubmit} onClick={handleBatchSubmitApproval}>
                <Send className="mr-1 h-3 w-3" />
                提交审批
              </Button>
            )}
            {hasPermission("evaluation", "exams", "withdraw_approval") && (
              <Button variant="outline" size="sm" className="h-8 text-xs" disabled={!hasSelected || !canBatchWithdraw} onClick={handleBatchWithdrawApproval}>
                <Undo2 className="mr-1 h-3 w-3" />
                撤回审批
              </Button>
            )}
            {hasPermission("evaluation", "exams", "publish") && (
              <Button variant="outline" size="sm" className="h-8 text-xs" disabled={!hasSelected || !canBatchPublish} onClick={handleBatchPublish}>
                <ArrowUpFromLine className="mr-1 h-3 w-3" />
                发布
              </Button>
            )}
            {hasPermission("evaluation", "exams", "unpublish") && (
              <Button variant="outline" size="sm" className="h-8 text-xs" disabled={!hasSelected || !canBatchUnpublish} onClick={handleBatchUnpublish}>
                <ArrowDownFromLine className="mr-1 h-3 w-3" />
                取消发布
              </Button>
            )}
            {hasPermission("evaluation", "exams", "delete") && (
              <Button variant="outline" size="sm" className="h-8 text-xs" disabled={!hasSelected || !canBatchDelete} onClick={handleBatchDelete}>
                <Trash2 className="mr-1 h-3 w-3" />
                删除
              </Button>
            )}
            <Button variant="outline" size="sm" className="h-8 text-xs" disabled={!hasSelected} onClick={handleBatchClone}>
              <Copy className="mr-1 h-3 w-3" />
              克隆
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs" disabled={!hasSelected} onClick={() => { setMoveSelectedMajorId("all"); setMoveTargetBatchId(""); setIsBatchMoveDialogOpen(true) }}>
              <FolderKanban className="mr-1 h-3 w-3" />
              调整批次分组
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs" disabled={!hasSelected} onClick={handleBatchExport}>
              <Download className="mr-1 h-3 w-3" />
              导出
            </Button>
          </div>
        </CardContent>

        {filteredExams.length > 0 && viewMode !== "group" && (
          <CardContent className="pt-0">
            <div className="overflow-x-auto">{renderTable(filteredExams)}</div>
          </CardContent>
        )}
      </Card>

      {viewMode === "group" && examsByBatch && (
        <div className="space-y-4">
          {Object.entries(examsByBatch).map(([batchId, batchExams]) => {
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
                        {batchExams.length} 个试卷
                      </Badge>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="p-4 pt-0 overflow-x-auto">{renderTable(batchExams)}</div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            )
          })}
          {uncategorizedExams.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-dashed border-slate-300 bg-white">
              <div className="flex items-center justify-between px-4 py-3 bg-slate-50/80">
                <div className="flex items-center gap-3">
                  <span className="font-medium text-gray-800">未分类</span>
                  <Badge variant="secondary" className="text-xs">
                    {uncategorizedExams.length} 个试卷
                  </Badge>
                </div>
              </div>
              <div className="p-4 pt-0 overflow-x-auto">{renderTable(uncategorizedExams)}</div>
            </div>
          )}
        </div>
      )}

      {!loading && filteredExams.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white py-20 shadow-sm">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
            <Search className="h-8 w-8 text-slate-400" />
          </div>
          <h3 className="mb-2 text-lg font-medium text-slate-700">暂无试卷</h3>
          <p className="mb-4 text-sm text-slate-500">当前筛选条件下没有试卷数据</p>
          <Button size="sm" onClick={() => { resetCreateForm(); setIsCreateOpen(true) }}>
            <Plus className="mr-2 h-4 w-4" />
            新建试卷
          </Button>
        </div>
      )}

      {loading && filteredExams.length === 0 && (
        <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
          加载中...
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>新建试卷</DialogTitle>
            <DialogDescription>创建一个新的试卷</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="examName">试卷名称 <span className="text-red-500">*</span></Label>
              <Input
                id="examName"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="请输入试卷名称"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="examDesc">试卷简介</Label>
              <Input
                id="examDesc"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="请输入试卷简介（可选）"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="examDuration">考试时长（分钟）</Label>
              <Input
                id="examDuration"
                type="number"
                value={newDuration}
                onChange={(e) => setNewDuration(e.target.value)}
                placeholder="60"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="examBatch">所属批次</Label>
              <Select value={newBatchId || "none"} onValueChange={(v) => setNewBatchId(v === "none" ? "" : v)}>
                <SelectTrigger id="examBatch">
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
            <DialogTitle>导入试卷</DialogTitle>
            <DialogDescription>上传 CSV 文件批量导入试卷数据（需包含 name 列）</DialogDescription>
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
            <DialogTitle>导出试卷</DialogTitle>
            <DialogDescription>将选中的试卷数据导出为文件</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-slate-500">已选择 {selectedIds.length} 个试卷</p>
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
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>调整批次分组</DialogTitle>
            <DialogDescription>将选中的 {selectedIds.length} 个试卷移动到指定批次</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {majors.length > 0 && (
              <Tabs value={moveSelectedMajorId} onValueChange={setMoveSelectedMajorId}>
                <TabsList className="h-auto flex-wrap justify-start">
                  <TabsTrigger value="all">全部专业</TabsTrigger>
                  {majors.map((m) => (
                    <TabsTrigger key={m.id} value={m.id}>
                      {m.name}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            )}
            <div className="rounded-lg border border-slate-200 bg-white overflow-hidden max-h-[260px] overflow-y-auto">
              {filteredBatchesByMajor.length === 0 ? (
                <div className="px-4 py-6 text-sm text-gray-500 text-center">
                  暂无批次分组
                </div>
              ) : (
                filteredBatchesByMajor.map((batch) => {
                  const selected = moveTargetBatchId === batch.id
                  return (
                    <div
                      key={batch.id}
                      onClick={() => setMoveTargetBatchId(batch.id)}
                      className={cn(
                        "px-4 py-3 cursor-pointer border-b border-slate-100 last:border-b-0 hover:bg-slate-50 flex items-center justify-between gap-3",
                        selected && "bg-primary/5"
                      )}
                    >
                      <div className="min-w-0">
                        <div className={cn("font-medium text-sm", selected && "text-primary")}>
                          {batch.name}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          ID: {batch.id.slice(0, 8)}
                        </div>
                      </div>
                      {selected && <Check className="h-4 w-4 text-primary shrink-0" />}
                    </div>
                  )
                })
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBatchMoveDialogOpen(false)}>取消</Button>
            <Button onClick={handleBatchMove} disabled={!moveTargetBatchId}>确认移动</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Submit With Batch Dialog */}
      <Dialog open={isSubmitBatchDialogOpen} onOpenChange={setIsSubmitBatchDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>选择批次并提交审批</DialogTitle>
            <DialogDescription>
              试卷「{submitBatchTarget?.name}」未关联批次，请选择批次分组后继续提交审批
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {majors.length > 0 && (
              <Tabs value={submitSelectedMajorId} onValueChange={setSubmitSelectedMajorId}>
                <TabsList className="h-auto flex-wrap justify-start">
                  <TabsTrigger value="all">全部专业</TabsTrigger>
                  {majors.map((m) => (
                    <TabsTrigger key={m.id} value={m.id}>
                      {m.name}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            )}
            <div className="rounded-lg border border-slate-200 bg-white overflow-hidden max-h-[260px] overflow-y-auto">
              {submitFilteredBatches.length === 0 ? (
                <div className="px-4 py-6 text-sm text-gray-500 text-center">
                  暂无批次分组
                </div>
              ) : (
                submitFilteredBatches.map((batch) => {
                  const selected = submitSelectedBatchId === batch.id
                  return (
                    <div
                      key={batch.id}
                      onClick={() => setSubmitSelectedBatchId(batch.id)}
                      className={cn(
                        "px-4 py-3 cursor-pointer border-b border-slate-100 last:border-b-0 hover:bg-slate-50 flex items-center justify-between gap-3",
                        selected && "bg-primary/5"
                      )}
                    >
                      <div className="min-w-0">
                        <div className={cn("font-medium text-sm", selected && "text-primary")}>
                          {batch.name}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          ID: {batch.id.slice(0, 8)}
                        </div>
                      </div>
                      {selected && <Check className="h-4 w-4 text-primary shrink-0" />}
                    </div>
                  )
                })
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSubmitBatchDialogOpen(false)}>取消</Button>
            <Button onClick={handleConfirmSubmitBatch} disabled={!submitSelectedBatchId}>确认并提交审批</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clone Rename Dialog */}
      <Dialog open={isCloneRenameDialogOpen} onOpenChange={setIsCloneRenameDialogOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>克隆试卷</DialogTitle>
            <DialogDescription>为克隆的试卷命名</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={cloneRenameValue}
              onChange={(e) => setCloneRenameValue(e.target.value)}
              placeholder="输入新试卷名称"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCloneRenameDialogOpen(false)}>取消</Button>
            <Button onClick={handleConfirmClone} disabled={!cloneRenameValue.trim()}>确认克隆</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite Co-builders Dialog */}
      <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>调整共建人</DialogTitle>
            <DialogDescription>
              选择参与共建「{inviteTarget?.name}」的用户
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <UserSelector
              value={inviteSelectedIds}
              onChange={setInviteSelectedIds}
              multiple
              placeholder="点击选择共建人"
              tenantId={tenantId || undefined}
              excludeUserIds={inviteTarget?.creatorId ? [inviteTarget.creatorId] : undefined}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsInviteDialogOpen(false)}>取消</Button>
            <Button onClick={handleInviteConfirm}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Reason Dialog */}
      <Dialog open={isRejectReasonDialogOpen} onOpenChange={setIsRejectReasonDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>驳回原因</DialogTitle>
            <DialogDescription>
              试卷「{rejectReasonTarget?.name}」的审批被驳回，驳回原因如下：
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700 whitespace-pre-wrap">
              {rejectReasonTarget?.rejectReason || "审批人已驳回此试卷的提交申请，请根据审批意见修改后重新提交。"}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRejectReasonDialogOpen(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <ExamFormDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        exam={editingExam as unknown as import("@/lib/types").Exam}
        onSubmit={handleEditSubmit}
      />
    </div>
  )
}
