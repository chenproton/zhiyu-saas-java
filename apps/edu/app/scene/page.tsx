"use client"

import {
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  FolderKanban,
  GitBranch,
  List,
  LayoutGrid,
  Plus,
  RotateCcw,
  Search,
  Send,
  SlidersHorizontal,
  Trash2,
  Undo2,
  Upload,
  X,
  ArrowDownFromLine,
  ArrowUpFromLine,
  MessageSquare,
  Archive,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useMemo, useEffect, useCallback, useRef } from "react"
import { ScenarioList, type ScenarioListItem } from "@/components/scene/scenarios/scenario-list"
import { PageHeaderCard } from "@/components/shared/page-header-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"
import { scenarioApi, sceneBatchApi, taskApi, importExportApi, approvalApi } from "@/lib/api"
import type { Scenario, SceneBatch } from "@/lib/types/scene"
import { useAuth } from "@/components/auth-provider"


type TabType = "my" | "collab" | "public"
type ViewMode = "list" | "group"

function generateCode(prefix: string) {
  return `${prefix}-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 10000)).padStart(4, "0")}`
}

export default function SceneHallPage() {
  const router = useRouter()
  const { hasPermission, user } = useAuth()
  const currentUserId = user?.id ?? ""

  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [batches, setBatches] = useState<SceneBatch[]>([])
  const [taskCounts, setTaskCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  const [activeTab, setActiveTab] = useState<TabType>("my")
  const [viewMode, setViewMode] = useState<ViewMode>("list")

  const [searchQuery, setSearchQuery] = useState("")
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null)
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null)

  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [expandedBatches, setExpandedBatches] = useState<string[]>([])

  // Dialogs
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [isResourceImportDialogOpen, setIsResourceImportDialogOpen] = useState(false)
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false)
  const [isBatchMoveDialogOpen, setIsBatchMoveDialogOpen] = useState(false)
  const [moveTargetBatchId, setMoveTargetBatchId] = useState("")

  const [isCloneRenameDialogOpen, setIsCloneRenameDialogOpen] = useState(false)
  const [cloneRenameValue, setCloneRenameValue] = useState("")
  const [cloneTargetScenario, setCloneTargetScenario] = useState<ScenarioListItem | null>(null)

  const [isRejectReasonDialogOpen, setIsRejectReasonDialogOpen] = useState(false)
  const [rejectReasonScenario, setRejectReasonScenario] = useState<ScenarioListItem | null>(null)

  const [importFile, setImportFile] = useState<File | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [scenariosRes, batchesRes, tasksRes] = await Promise.all([
        scenarioApi.list({ limit: 1000 }),
        sceneBatchApi.list({ limit: 1000 }),
        taskApi.list({ limit: 10000 }),
      ])
      setScenarios(scenariosRes.items)
      setBatches(batchesRes.items)
      setExpandedBatches(batchesRes.items.map((b) => b.id))
      const counts: Record<string, number> = {}
      tasksRes.items.forEach((task) => {
        counts[task.scenarioId] = (counts[task.scenarioId] || 0) + 1
      })
      setTaskCounts(counts)
    } catch (err) {
      console.error("加载场景数据失败", err)
      alert("加载场景数据失败，请稍后重试")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const scenarioItems = useMemo<ScenarioListItem[]>(() => {
    return scenarios.map((s) => ({
      id: s.id,
      name: s.name,
      code: s.code,
      version: s.version,
      status: s.status,
      batchId: s.batchId,
      positionName: "-",
      batchName: s.batchId ? batches.find((b) => b.id === s.batchId)?.name || "-" : "-",
      creatorName: "-",
      publishTime: s.publishTime,
      taskCount: taskCounts[s.id] || 0,
    }))
  }, [scenarios, batches, taskCounts])

  const toggleBatch = (batchId: string) => {
    setExpandedBatches((prev) =>
      prev.includes(batchId) ? prev.filter((id) => id !== batchId) : [...prev, batchId]
    )
  }

  const tabFilteredScenarios = useMemo(() => {
    switch (activeTab) {
      case "my":
        return scenarioItems.filter((s) => {
          const backend = scenarios.find((bs) => bs.id === s.id)
          return backend?.creatorId === currentUserId
        })
      case "collab":
        return scenarioItems.filter((s) => {
          const backend = scenarios.find((bs) => bs.id === s.id)
          return backend?.coBuilderIds?.includes(currentUserId) ?? false
        })
      case "public":
      default:
        return scenarioItems.filter((s) => s.status === "published")
    }
  }, [scenarioItems, scenarios, activeTab, currentUserId])

  const filteredScenarios = useMemo(() => {
    let result = tabFilteredScenarios
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter((s) => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q))
    }
    if (selectedBatchId) {
      result = result.filter((s) => {
        const backend = scenarios.find((bs) => bs.id === s.id)
        return backend?.batchId === selectedBatchId
      })
    }
    if (selectedStatus) {
      result = result.filter((s) => s.status === selectedStatus)
    }
    return result
  }, [tabFilteredScenarios, searchQuery, selectedBatchId, selectedStatus, scenarios])

  const stats = useMemo(() => {
    const total = filteredScenarios.length
    const draft = filteredScenarios.filter((s) => s.status === "draft").length
    const pending = filteredScenarios.filter((s) => s.status === "pending").length
    const rejected = filteredScenarios.filter((s) => s.status === "rejected").length
    const published = filteredScenarios.filter((s) => s.status === "published").length
    return { total, draft, pending, rejected, published }
  }, [filteredScenarios])

  const scenariosByBatch = useMemo(() => {
    if (viewMode !== "group") return null
    const groups: Record<string, ScenarioListItem[]> = {}
    filteredScenarios.forEach((s) => {
      const backend = scenarios.find((bs) => bs.id === s.id)
      const batchId = backend?.batchId
      if (!batchId) return
      if (!groups[batchId]) groups[batchId] = []
      groups[batchId].push(s)
    })
    return groups
  }, [filteredScenarios, viewMode, scenarios])

  const uncategorizedScenarios = useMemo(
    () =>
      filteredScenarios.filter((s) => {
        const backend = scenarios.find((bs) => bs.id === s.id)
        return !backend?.batchId && s.status === "draft"
      }),
    [filteredScenarios, scenarios]
  )

  const handleSelectId = (id: string, checked: boolean) => {
    setSelectedIds((prev) => (checked ? [...prev, id] : prev.filter((sid) => sid !== id)))
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(filteredScenarios.map((s) => s.id))
    } else {
      setSelectedIds([])
    }
  }

  const selectedScenarios = useMemo(
    () => scenarios.filter((s) => selectedIds.includes(s.id)),
    [scenarios, selectedIds]
  )

  const hasSelected = selectedIds.length > 0

  const canBatchSubmit = selectedScenarios.some((s) => s.status === "draft" || s.status === "rejected")
  const canBatchWithdraw = selectedScenarios.some((s) => s.status === "pending")
  const canBatchUnpublish = selectedScenarios.some((s) => s.status === "published")
  const canBatchPublish = selectedScenarios.some((s) => s.status === "approved")
  const canBatchDelete = selectedScenarios.some((s) => s.status === "draft" || s.status === "rejected")
  const canBatchArchive = selectedScenarios.some((s) => ["draft", "rejected", "approved", "published"].includes(s.status))

  const refresh = async () => {
    await loadData()
  }

  const handleBatchSubmitApproval = async () => {
    for (const scenario of selectedScenarios) {
      if (scenario.status === "draft" || scenario.status === "rejected") {
        const batch = batches.find((b) => b.id === scenario.batchId)
        try {
          await scenarioApi.submit(scenario.id)
          if (batch) {
            await approvalApi.create({ targetType: 'scenario', targetId: scenario.id, workflowId: batch.workflowId })
          }
        } catch (err) {
          console.error("提交审批失败", err)
        }
      }
    }
    setSelectedIds([])
    await refresh()
  }

  const handleBatchWithdrawApproval = async () => {
    for (const scenario of selectedScenarios) {
      if (scenario.status === "pending") {
        try {
          await scenarioApi.withdraw(scenario.id)
        } catch (err) {
          console.error("撤回审批失败", err)
        }
      }
    }
    setSelectedIds([])
    await refresh()
  }

  const handleBatchUnpublish = async () => {
    for (const scenario of selectedScenarios) {
      if (scenario.status === "published") {
        try {
          await scenarioApi.unpublish(scenario.id)
        } catch (err) {
          console.error("取消发布失败", err)
        }
      }
    }
    setSelectedIds([])
    await refresh()
  }

  const handleBatchPublish = async () => {
    for (const scenario of selectedScenarios) {
      if (scenario.status === "approved") {
        try {
          await scenarioApi.publish(scenario.id)
        } catch (err) {
          console.error("发布失败", err)
        }
      }
    }
    setSelectedIds([])
    await refresh()
  }

  const handleBatchDelete = async () => {
    for (const scenario of selectedScenarios) {
      try {
        await scenarioApi.delete(scenario.id)
      } catch (err) {
        console.error("删除失败", err)
      }
    }
    setSelectedIds([])
    await refresh()
  }

  const handleArchive = async (scenario: ScenarioListItem) => {
    if (!confirm(`确定要归档场景「${scenario.name}」吗？归档后可在场景归档库中查看。`)) return
    try {
      await scenarioApi.archive(scenario.id)
      await refresh()
    } catch (err) {
      console.error("归档失败", err)
      alert("归档失败，请稍后重试")
    }
  }

  const handleBatchArchive = async () => {
    for (const scenario of selectedScenarios) {
      if (["draft", "rejected", "approved", "published"].includes(scenario.status)) {
        try {
          await scenarioApi.archive(scenario.id)
        } catch (err) {
          console.error("归档失败", err)
        }
      }
    }
    setSelectedIds([])
    await refresh()
  }

  const handleBatchClone = async () => {
    for (const scenario of selectedScenarios) {
      try {
        await scenarioApi.create({
          name: `${scenario.name} (克隆)`,
          code: generateCode("SC"),
          status: "draft",
          version: "V1.0",
          difficulty: scenario.difficulty || 1,
          creatorId: currentUserId,
          coBuilderIds: [currentUserId],
          batchId: scenario.batchId,
          careerPositionId: scenario.careerPositionId,
          industryId: scenario.industryId,
          professionId: scenario.professionId,
          background: scenario.background,
          deliveryGoal: scenario.deliveryGoal,
        })
      } catch (err) {
        console.error("克隆失败", err)
      }
    }
    setSelectedIds([])
    await refresh()
  }

  const handleBatchExport = async () => {
    const res = await importExportApi.export("scenarios")
    const blob = await res.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    const disposition = res.headers.get("content-disposition")
    const filename = disposition?.match(/filename="?([^";]+)"?/)?.[1] || "scenarios-export.csv"
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.URL.revokeObjectURL(url)
    setIsExportDialogOpen(false)
    setSelectedIds([])
  }

  const handleBatchMove = () => {
    setIsBatchMoveDialogOpen(true)
  }

  const handleConfirmMove = async () => {
    if (!moveTargetBatchId) return
    for (const scenario of selectedScenarios) {
      try {
        await scenarioApi.update(scenario.id, { batchId: moveTargetBatchId })
      } catch (err) {
        console.error("调整批次失败", err)
      }
    }
    setSelectedIds([])
    setIsBatchMoveDialogOpen(false)
    setMoveTargetBatchId("")
    await refresh()
  }

  const handleClone = (scenario: ScenarioListItem) => {
    setCloneTargetScenario(scenario)
    setCloneRenameValue(`${scenario.name} (克隆)`)
    setIsCloneRenameDialogOpen(true)
  }

  const handleConfirmClone = async () => {
    if (!cloneTargetScenario) return
    const backend = scenarios.find((s) => s.id === cloneTargetScenario.id)
    try {
      await scenarioApi.create({
        name: cloneRenameValue,
        code: generateCode("SC"),
        status: "draft",
        version: "V1.0",
        difficulty: backend?.difficulty || 1,
        creatorId: currentUserId,
        coBuilderIds: [currentUserId],
        batchId: backend?.batchId,
        careerPositionId: backend?.careerPositionId,
        industryId: backend?.industryId,
        professionId: backend?.professionId,
        background: backend?.background,
        deliveryGoal: backend?.deliveryGoal,
      })
      setIsCloneRenameDialogOpen(false)
      setCloneTargetScenario(null)
      setCloneRenameValue("")
      await refresh()
    } catch (err) {
      console.error("克隆失败", err)
      alert("克隆失败，请稍后重试")
    }
  }

  const handleDelete = async (scenario: ScenarioListItem) => {
    if (confirm(`确定要删除场景「${scenario.name}」吗？`)) {
      try {
        await scenarioApi.delete(scenario.id)
        await refresh()
      } catch (err) {
        console.error("删除失败", err)
        alert("删除失败，请稍后重试")
      }
    }
  }

  const handleSubmitApproval = async (scenario: ScenarioListItem) => {
    const batch = batches.find((b) => b.id === scenario.batchId)
    if (!batch) {
      alert("该场景未关联批次，无法提交审批")
      return
    }
    try {
      await scenarioApi.submit(scenario.id)
      await approvalApi.create({ targetType: 'scenario', targetId: scenario.id, workflowId: batch.workflowId })
      await refresh()
    } catch (err) {
      console.error("提交审批失败", err)
      alert("提交审批失败，请稍后重试")
    }
  }

  const handleWithdrawApproval = async (scenario: ScenarioListItem) => {
    try {
      await scenarioApi.withdraw(scenario.id)
      await refresh()
    } catch (err) {
      console.error("撤回审批失败", err)
      alert("撤回审批失败，请稍后重试")
    }
  }

  const handleApprove = async (scenario: ScenarioListItem) => {
    try {
      const records = await approvalApi.list({ targetType: 'scenario', targetId: scenario.id, status: 'pending', limit: 1 })
      if (records.items.length === 0) {
        alert("未找到审批记录")
        return
      }
      await approvalApi.review(records.items[0].id, { status: 'approved' })
      await refresh()
    } catch (err) {
      console.error("审批通过失败", err)
      alert("审批通过失败，请稍后重试")
    }
  }

  const handleReject = async (scenario: ScenarioListItem) => {
    try {
      const records = await approvalApi.list({ targetType: 'scenario', targetId: scenario.id, status: 'pending', limit: 1 })
      if (records.items.length === 0) {
        alert("未找到审批记录")
        return
      }
      await approvalApi.review(records.items[0].id, { status: 'rejected' })
      await refresh()
    } catch (err) {
      console.error("驳回失败", err)
      alert("驳回失败，请稍后重试")
    }
  }

  const handlePublish = async (scenario: ScenarioListItem) => {
    try {
      await scenarioApi.publish(scenario.id)
      await refresh()
    } catch (err) {
      console.error("发布失败", err)
      alert("发布失败，请稍后重试")
    }
  }

  const handleUnpublish = async (scenario: ScenarioListItem) => {
    try {
      await scenarioApi.unpublish(scenario.id)
      await refresh()
    } catch (err) {
      console.error("取消发布失败", err)
      alert("取消发布失败，请稍后重试")
    }
  }

  const handleInviteCoBuild = async (scenario: ScenarioListItem) => {
    const userId = window.prompt(`请输入要邀请共建「${scenario.name}」的用户 ID`)
    if (!userId) return
    try {
      await scenarioApi.invite(scenario.id, userId)
      await refresh()
    } catch (err) {
      console.error("邀请共建失败", err)
      alert("邀请共建失败，请稍后重试")
    }
  }

  const handleViewRejectReason = (scenario: ScenarioListItem) => {
    setRejectReasonScenario(scenario)
    setIsRejectReasonDialogOpen(true)
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
      const result = await importExportApi.import("scenarios", importFile)
      alert(`导入完成：成功 ${result.created} 条，失败 ${result.failed} 条`)
      setImportFile(null)
      setIsImportDialogOpen(false)
      await refresh()
    } catch (err: any) {
      alert(err.message || "导入失败")
    } finally {
      setIsImporting(false)
    }
  }

  const handleCreate = async () => {
    try {
      const newScenario = await scenarioApi.create({
        name: "新建场景",
        code: generateCode("SC"),
        status: "draft",
        version: "V1.0",
        difficulty: 1,
        creatorId: currentUserId,
        coBuilderIds: [currentUserId],
      })
      router.push(`/scene/scenarios/${newScenario.id}/edit?new=true`)
    } catch (err) {
      console.error("创建场景失败", err)
      alert("创建场景失败，请稍后重试")
    }
  }

  const getRejectReason = (scenario: ScenarioListItem) => {
    if (scenario.id === "scenario-3") {
      return "场景任务链不完整，缺少数据清洗环节，请补充后再提交。"
    }
    return "审批未通过，请根据审批意见修改后重新提交。"
  }

  return (
    <div className="space-y-6">
      {/* ===== Part 1: Top Title Card ===== */}
      <PageHeaderCard
        title="场景模板管理"
        description="维护场景信息、任务信息等场景模板管理功能"
        actions={
          <>

            <Button variant="outline" size="sm" onClick={() => setIsResourceImportDialogOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              导入资源包
            </Button>

            <Button variant="outline" size="sm" onClick={() => setIsImportDialogOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              导入场景
            </Button>

            <Button size="sm" className="bg-primary hover:bg-primary/90" onClick={handleCreate}>
              <Plus className="mr-2 h-4 w-4" />
              新建场景
            </Button>
          </>
        }
        stats={
          activeTab !== "public"
            ? [
                {
                  label: "场景总数",
                  value: stats.total,
                  icon: <SlidersHorizontal className="h-3 w-3 text-blue-500" />,
                  iconClassName: "bg-blue-50",
                },
                {
                  label: "未提交",
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

      {/* ===== Part 2: View Switch Area ===== */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as TabType); setSelectedIds([]); setSelectedBatchId(null) }}>
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="my" className="w-full">我的场景</TabsTrigger>
            <TabsTrigger value="collab" className="w-full">共建场景</TabsTrigger>
            <TabsTrigger value="public" className="w-full">公共场景</TabsTrigger>
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

      {/* ===== Part 3: Data List Area ===== */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="flex flex-col gap-4 p-5">
          {/* Search + Filter row */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[200px]">
              <div className="flex items-center gap-2 w-full">
                <Search className="h-4 w-4 text-slate-400" />
                <Input
                  placeholder="搜索场景名称 / 场景编码"
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
              <Select value={selectedStatus || "__all__"} onValueChange={(v) => setSelectedStatus(v === "__all__" ? null : v)}>
                <SelectTrigger className="h-9 text-sm w-36">
                  <SelectValue placeholder="按状态筛选" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">全部状态</SelectItem>
                  <SelectItem value="draft">草稿</SelectItem>
                  <SelectItem value="pending">审批中</SelectItem>
                  <SelectItem value="approved">已通过</SelectItem>
                  <SelectItem value="rejected">已驳回</SelectItem>
                  <SelectItem value="published">已发布</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="sm" className="h-9" onClick={handleResetFilters}>
              <RotateCcw className="mr-1 h-3.5 w-3.5" />
              重置
            </Button>
          </div>

          {/* Quick actions - linked with checkboxes */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
            <span className={cn("text-xs mr-1", hasSelected ? "text-slate-700 font-medium" : "text-slate-400")}>
              {hasSelected ? `已选择 ${selectedIds.length} 项：` : "请选择场景："}
            </span>
            {hasPermission("scene", "scenarios", "submit_approval") && (
              <Button variant="outline" size="sm" className="h-8 text-xs" disabled={!hasSelected || !canBatchSubmit} onClick={handleBatchSubmitApproval}>
                <Send className="mr-1 h-3 w-3" />
                提交审批
              </Button>
            )}
            {hasPermission("scene", "scenarios", "withdraw_approval") && (
              <Button variant="outline" size="sm" className="h-8 text-xs" disabled={!hasSelected || !canBatchWithdraw} onClick={handleBatchWithdrawApproval}>
                <Undo2 className="mr-1 h-3 w-3" />
                撤回审批
              </Button>
            )}
            {hasPermission("scene", "scenarios", "publish") && (
              <Button variant="outline" size="sm" className="h-8 text-xs" disabled={!hasSelected || !canBatchPublish} onClick={handleBatchPublish}>
                <ArrowUpFromLine className="mr-1 h-3 w-3" />
                发布
              </Button>
            )}
            {hasPermission("scene", "scenarios", "unpublish") && (
              <Button variant="outline" size="sm" className="h-8 text-xs" disabled={!hasSelected || !canBatchUnpublish} onClick={handleBatchUnpublish}>
                <ArrowDownFromLine className="mr-1 h-3 w-3" />
                取消发布
              </Button>
            )}
            {hasPermission("scene", "scenarios", "delete") && (
              <Button variant="outline" size="sm" className="h-8 text-xs" disabled={!hasSelected || !canBatchDelete} onClick={handleBatchDelete}>
                <Trash2 className="mr-1 h-3 w-3" />
                删除
              </Button>
            )}
            <Button variant="outline" size="sm" className="h-8 text-xs text-purple-600 hover:text-purple-700" disabled={!hasSelected || !canBatchArchive} onClick={handleBatchArchive}>
              <Archive className="mr-1 h-3 w-3" />
              归档
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs" disabled={!hasSelected} onClick={handleBatchClone}>
              <Copy className="mr-1 h-3 w-3" />
              克隆
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs" disabled={!hasSelected} onClick={handleBatchMove}>
              <FolderKanban className="mr-1 h-3 w-3" />
              调整批次分组
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs" disabled={!hasSelected} onClick={handleBatchExport}>
              <Download className="mr-1 h-3 w-3" />
              导出
            </Button>
          </div>
        </CardContent>

        {/* Scenario list - merged into the same Card */}
        {filteredScenarios.length > 0 && viewMode !== "group" && (
          <CardContent className="pt-0">
            <ScenarioList
              scenarios={filteredScenarios}
              selectedIds={selectedIds}
              onSelectId={handleSelectId}
              onSelectAll={handleSelectAll}
              onClone={handleClone}
              onDelete={handleDelete}
              onSubmitApproval={handleSubmitApproval}
              onWithdrawApproval={handleWithdrawApproval}
              onApprove={handleApprove}
              onReject={handleReject}
              onPublish={handlePublish}
              onUnpublish={handleUnpublish}
              onArchive={handleArchive}
              onViewRejectReason={handleViewRejectReason}
              onInviteCoBuild={handleInviteCoBuild}
              basePath="/scene/scenarios"
              className="border-0 rounded-none"
            />
          </CardContent>
        )}
      </Card>

      {/* Scenario list - group view remains outside the card */}
      {filteredScenarios.length > 0 && viewMode === "group" && scenariosByBatch && (
        <div className="space-y-4">
          {Object.entries(scenariosByBatch).map(([batchId, batchScenarios]) => {
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
                        {batchScenarios.length} 个场景
                      </Badge>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="p-4 pt-0">
                      <ScenarioList
                        scenarios={batchScenarios}
                        selectedIds={selectedIds}
                        onSelectId={handleSelectId}
                        onSelectAll={handleSelectAll}
                        onClone={handleClone}
                        onDelete={handleDelete}
                        onSubmitApproval={handleSubmitApproval}
                        onWithdrawApproval={handleWithdrawApproval}
                        onApprove={handleApprove}
                        onReject={handleReject}
                        onPublish={handlePublish}
                        onUnpublish={handleUnpublish}
                        onViewRejectReason={handleViewRejectReason}
                        onInviteCoBuild={handleInviteCoBuild}
                        basePath="/scene/scenarios"
                      />
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            )
          })}
          {uncategorizedScenarios.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-dashed border-slate-300 bg-white">
              <div className="flex items-center justify-between px-4 py-3 bg-slate-50/80">
                <div className="flex items-center gap-3">
                  <span className="font-medium text-gray-800">未分类</span>
                  <Badge variant="secondary" className="text-xs">
                    {uncategorizedScenarios.length} 个场景
                  </Badge>
                </div>
              </div>
              <div className="p-4 pt-0">
                <ScenarioList
                  scenarios={uncategorizedScenarios}
                  selectedIds={selectedIds}
                  onSelectId={handleSelectId}
                  onSelectAll={handleSelectAll}
                  onClone={handleClone}
                  onDelete={handleDelete}
                  onSubmitApproval={handleSubmitApproval}
                  onWithdrawApproval={handleWithdrawApproval}
                  onApprove={handleApprove}
                  onReject={handleReject}
                  onPublish={handlePublish}
                  onUnpublish={handleUnpublish}
                  onViewRejectReason={handleViewRejectReason}
                  onInviteCoBuild={handleInviteCoBuild}
                  basePath="/scene/scenarios"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {filteredScenarios.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white py-20 shadow-sm">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
            <Search className="h-8 w-8 text-slate-400" />
          </div>
          <h3 className="mb-2 text-lg font-medium text-slate-700">暂无场景</h3>
          <p className="mb-4 text-sm text-slate-500">当前筛选条件下没有实践场景</p>
          <Button size="sm" onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" />
            新建场景
          </Button>
        </div>
      )}

      {/* Import Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>导入场景</DialogTitle>
            <DialogDescription>上传 CSV 文件批量导入场景数据（需包含 name 列）</DialogDescription>
          </DialogHeader>
          <div className="py-6">
            <div
              className="border-2 border-dashed border-slate-200 rounded-lg p-8 flex flex-col items-center justify-center text-center cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => handleImportFileSelect(e.target.files)}
              />
              <Upload className="h-10 w-10 text-slate-300 mb-3" />
              <p className="text-sm text-slate-600 font-medium">
                {importFile ? importFile.name : "点击选择 CSV 文件"}
              </p>
              <p className="text-xs text-slate-400 mt-1">支持 .csv 格式</p>
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

      {/* Resource Import Dialog */}
      <Dialog open={isResourceImportDialogOpen} onOpenChange={setIsResourceImportDialogOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>资源包导入</DialogTitle>
            <DialogDescription>导入包含场景、任务和资源的完整资源包</DialogDescription>
          </DialogHeader>
          <div className="py-6">
            <div className="border-2 border-dashed border-slate-200 rounded-lg p-8 flex flex-col items-center justify-center text-center">
              <Upload className="h-10 w-10 text-slate-300 mb-3" />
              <p className="text-sm text-slate-600 font-medium">点击或拖拽资源包到此处上传</p>
              <p className="text-xs text-slate-400 mt-1">支持 .zip, .rar 格式</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsResourceImportDialogOpen(false)}>取消</Button>
            <Button onClick={() => setIsResourceImportDialogOpen(false)}>开始导入</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Export Dialog */}
      <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>批量导出场景</DialogTitle>
            <DialogDescription>已选择 {selectedIds.length} 个场景，请选择导出格式</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <div className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-slate-50">
              <div className="h-10 w-10 rounded bg-green-50 flex items-center justify-center">
                <span className="text-xs font-bold text-green-600">XLSX</span>
              </div>
              <div>
                <p className="text-sm font-medium">导出为 Excel</p>
                <p className="text-xs text-slate-400">包含场景基础信息和任务配置</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-slate-50">
              <div className="h-10 w-10 rounded bg-blue-50 flex items-center justify-center">
                <span className="text-xs font-bold text-blue-600">JSON</span>
              </div>
              <div>
                <p className="text-sm font-medium">导出为 JSON</p>
                <p className="text-xs text-slate-400">完整的场景数据结构，适用于备份和迁移</p>
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
            <DialogDescription>将选中的 {selectedIds.length} 个场景移动到指定批次</DialogDescription>
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
            <Button onClick={handleConfirmMove} disabled={!moveTargetBatchId}>确认移动</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clone Rename Dialog */}
      <Dialog open={isCloneRenameDialogOpen} onOpenChange={setIsCloneRenameDialogOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>克隆场景</DialogTitle>
            <DialogDescription>请为克隆后的场景命名</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={cloneRenameValue}
              onChange={(e) => setCloneRenameValue(e.target.value)}
              placeholder="输入新场景名称"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCloneRenameDialogOpen(false)}>取消</Button>
            <Button onClick={handleConfirmClone} disabled={!cloneRenameValue.trim()}>确认克隆</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Reason Dialog */}
      <Dialog open={isRejectReasonDialogOpen} onOpenChange={setIsRejectReasonDialogOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>驳回原因</DialogTitle>
            <DialogDescription>
              场景「{rejectReasonScenario?.name}」的审批驳回原因
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="p-4 bg-red-50 rounded-lg border border-red-100">
              <div className="flex items-start gap-2">
                <MessageSquare className="h-4 w-4 text-red-500 mt-0.5" />
                <p className="text-sm text-red-700">
                  {rejectReasonScenario ? getRejectReason(rejectReasonScenario) : ""}
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRejectReasonDialogOpen(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
