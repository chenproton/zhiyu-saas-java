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
  Loader2,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useMemo, useRef, useEffect, useCallback } from "react"
import { PositionList } from "@/components/job/positions/position-list"
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
import { positionApi, batchApi, approvalApi, importExportApi } from "@/lib/api"
import { useIndustryMap, useMajorMap } from "@/lib/use-resource-maps"
import {
  convertCareerPositionToPosition,
  convertJobBatchToBatch,
  positionToCreateRequest,
  positionToUpdateRequest,
} from "@/lib/stores/job-converters"
import type { Position, Batch } from "@/lib/types/job-source"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/components/auth-provider"


type TabType = "my" | "collab" | "public"
type ViewMode = "list" | "group"

export default function PositionsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { hasPermission, user } = useAuth()
  const currentUserId = user?.id ?? ""

  const [positions, setPositions] = useState<Position[]>([])
  const [batches, setBatches] = useState<Batch[]>([])
  const [loading, setLoading] = useState(true)
  const industryMap = useIndustryMap()
  const majorMap = useMajorMap()

  const [activeTab, setActiveTab] = useState<TabType>("my")
  const [viewMode, setViewMode] = useState<ViewMode>("list")

  const [searchQuery, setSearchQuery] = useState("")
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null)
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null)

  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [isResourceImportDialogOpen, setIsResourceImportDialogOpen] = useState(false)
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false)
  const [isBatchMoveDialogOpen, setIsBatchMoveDialogOpen] = useState(false)
  const [moveTargetBatchId, setMoveTargetBatchId] = useState("")

  const [importFile, setImportFile] = useState<File | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [isCloneRenameDialogOpen, setIsCloneRenameDialogOpen] = useState(false)
  const [cloneRenameValue, setCloneRenameValue] = useState("")
  const [cloneTargetPosition, setCloneTargetPosition] = useState<Position | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [posRes, batchRes] = await Promise.all([
        positionApi.list({ limit: 1000 }),
        batchApi.list({ limit: 1000 }),
      ])
      setPositions(posRes.items.map(convertCareerPositionToPosition))
      setBatches(batchRes.items.map(convertJobBatchToBatch))
    } catch (err: any) {
      toast({ variant: 'destructive', title: '加载失败', description: err?.message || '请稍后重试' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadData()
  }, [loadData])

  const [expandedBatches, setExpandedBatches] = useState<string[]>(batches.map((b) => b.id))
  useEffect(() => {
    setExpandedBatches(batches.map((b) => b.id))
  }, [batches])

  const toggleBatch = (batchId: string) => {
    setExpandedBatches((prev) =>
      prev.includes(batchId) ? prev.filter((id) => id !== batchId) : [...prev, batchId]
    )
  }

  const tabFilteredPositions = useMemo(() => {
    switch (activeTab) {
      case "my":
        return positions.filter((p) => p.createdBy === currentUserId)
      case "collab":
        return positions.filter((p) => p.collaborators.includes(currentUserId))
      case "public":
      default:
        return positions.filter((p) => p.status === "published")
    }
  }, [positions, activeTab, currentUserId])

  const filteredPositions = useMemo(() => {
    let result = tabFilteredPositions
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter((p) =>
        p.name.toLowerCase().includes(q) || p.shortName.toLowerCase().includes(q)
      )
    }
    if (selectedBatchId) {
      result = result.filter((p) => p.batchId === selectedBatchId)
    }
    if (selectedStatus) {
      result = result.filter((p) => p.status === selectedStatus)
    }
    return result
  }, [tabFilteredPositions, searchQuery, selectedBatchId, selectedStatus])

  const stats = useMemo(() => {
    const total = filteredPositions.length
    const draft = filteredPositions.filter((p) => p.status === "draft").length
    const pending = filteredPositions.filter((p) => p.status === "pending").length
    const rejected = filteredPositions.filter((p) => p.status === "rejected").length
    const published = filteredPositions.filter((p) => p.status === "published").length
    return { total, draft, pending, rejected, published }
  }, [filteredPositions])

  const positionsByBatch = useMemo(() => {
    if (viewMode !== "group") return null
    const groups: Record<string, Position[]> = {}
    filteredPositions.forEach((p) => {
      if (!p.batchId) return
      if (!groups[p.batchId]) groups[p.batchId] = []
      groups[p.batchId].push(p)
    })
    return groups
  }, [filteredPositions, viewMode])

  const uncategorizedPositions = useMemo(
    () => filteredPositions.filter((p) => !p.batchId && p.status === "draft"),
    [filteredPositions]
  )

  const handleSelectId = (id: string, checked: boolean) => {
    setSelectedIds((prev) => (checked ? [...prev, id] : prev.filter((sid) => sid !== id)))
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(filteredPositions.map((p) => p.id))
    } else {
      setSelectedIds([])
    }
  }

  const selectedPositions = positions.filter((p) => selectedIds.includes(p.id))

  const hasSelected = selectedIds.length > 0

  const canBatchSubmit = selectedPositions.some((p) => p.status === "draft" || p.status === "rejected")
  const canBatchWithdraw = selectedPositions.some((p) => p.status === "pending")
  const canBatchUnpublish = selectedPositions.some((p) => p.status === "published")
  const canBatchPublish = selectedPositions.some((p) => p.status === "approved")
  const canBatchDelete = selectedPositions.some((p) => p.status === "draft" || p.status === "rejected")

  const handleBatchSubmitApproval = async () => {
    for (const id of selectedIds) {
      const position = positions.find((p) => p.id === id)
      if (position && (position.status === "draft" || position.status === "rejected")) {
        const batch = batches.find((b) => b.id === position.batchId)
        if (batch) {
          try {
            await positionApi.submit(id)
            await approvalApi.create({
              targetType: 'career_position',
              targetId: id,
              workflowId: batch.workflowId,
            } as any)
          } catch (err: any) {
            toast({ variant: 'destructive', title: '提交失败', description: err?.message || '请稍后重试' })
          }
        }
      }
    }
    setSelectedIds([])
    loadData()
  }

  const handleBatchWithdrawApproval = async () => {
    for (const id of selectedIds) {
      const position = positions.find((p) => p.id === id)
      if (position && position.status === "pending") {
        try {
          await positionApi.withdraw(id)
        } catch (err: any) {
          toast({ variant: 'destructive', title: '撤回失败', description: err?.message || '请稍后重试' })
        }
      }
    }
    setSelectedIds([])
    loadData()
  }

  const handleBatchUnpublish = async () => {
    for (const id of selectedIds) {
      const position = positions.find((p) => p.id === id)
      if (position && position.status === "published") {
        try {
          await positionApi.unpublish(id)
        } catch (_) {}
      }
    }
    setSelectedIds([])
    loadData()
  }

  const handleBatchPublish = async () => {
    for (const id of selectedIds) {
      const position = positions.find((p) => p.id === id)
      if (position && position.status === "approved") {
        try {
          await positionApi.publish(id)
        } catch (_) {}
      }
    }
    setSelectedIds([])
    loadData()
  }

  const handleBatchDelete = async () => {
    for (const id of selectedIds) {
      try {
        await positionApi.delete(id)
      } catch (err: any) {
        toast({ variant: 'destructive', title: '删除失败', description: err?.message || '请稍后重试' })
      }
    }
    setSelectedIds([])
    loadData()
  }

  const handleBatchClone = async () => {
    const toClone = positions.filter((p) => selectedIds.includes(p.id))
    for (const position of toClone) {
      try {
        await positionApi.create(positionToCreateRequest({
          batchId: position.batchId,
          version: position.version,
          status: "draft",
          name: `${position.name} (克隆)`,
          shortName: position.shortName,
          industry: position.industry,
          majors: position.majors,
          positionType: position.positionType,
          salaryRange: position.salaryRange,
          certificates: [],
          description: position.description,
          responsibilities: position.responsibilities,
          requirements: position.requirements,
          careerPath: position.careerPath,
          abilityModel: { nodes: [], edges: [] },
          abilityBindings: position.abilityBindings,
          abilityDomains: position.abilityDomains,
          competencyConfig: position.competencyConfig,
          createdBy: currentUserId,
          collaborators: [currentUserId],
          favoriteCount: 0,
        }))
      } catch (err: any) {
        toast({ variant: 'destructive', title: '克隆失败', description: err?.message || '请稍后重试' })
      }
    }
    setSelectedIds([])
    loadData()
  }

  const handleBatchExport = async () => {
    try {
      const res = await importExportApi.export('career_positions')
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const disposition = res.headers.get('content-disposition')
      const filename = disposition?.match(/filename="?([^";]+)"?/)?.[1] || 'career_positions-export.csv'
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (err: any) {
      toast({ variant: 'destructive', title: '导出失败', description: err?.message || '请稍后重试' })
    }
    setIsExportDialogOpen(false)
    setSelectedIds([])
  }

  const handleBatchMove = () => {
    setIsBatchMoveDialogOpen(true)
  }

  const handleConfirmMove = async () => {
    if (!moveTargetBatchId) return
    for (const id of selectedIds) {
      try {
        await positionApi.update(id, { batchId: moveTargetBatchId } as any)
      } catch (_) {}
    }
    setSelectedIds([])
    setIsBatchMoveDialogOpen(false)
    setMoveTargetBatchId("")
    loadData()
  }

  const handleClone = (position: Position) => {
    setCloneTargetPosition(position)
    setCloneRenameValue(`${position.name} (克隆)`)
    setIsCloneRenameDialogOpen(true)
  }

  const handleConfirmClone = async () => {
    if (!cloneTargetPosition) return
    try {
      await positionApi.create(positionToCreateRequest({
        batchId: cloneTargetPosition.batchId,
        version: "V1.0",
        status: "draft",
        name: cloneRenameValue,
        shortName: cloneTargetPosition.shortName,
        industry: cloneTargetPosition.industry,
        majors: cloneTargetPosition.majors,
        positionType: cloneTargetPosition.positionType,
        salaryRange: cloneTargetPosition.salaryRange,
        certificates: [],
        description: cloneTargetPosition.description,
        responsibilities: cloneTargetPosition.responsibilities,
        requirements: cloneTargetPosition.requirements,
        careerPath: cloneTargetPosition.careerPath,
        abilityModel: { nodes: [], edges: [] },
        abilityBindings: cloneTargetPosition.abilityBindings,
        abilityDomains: cloneTargetPosition.abilityDomains,
        competencyConfig: cloneTargetPosition.competencyConfig,
        createdBy: currentUserId,
        collaborators: [currentUserId],
        favoriteCount: 0,
      }))
    } catch (err: any) {
      toast({ variant: 'destructive', title: '克隆失败', description: err?.message || '请稍后重试' })
    }
    setIsCloneRenameDialogOpen(false)
    setCloneTargetPosition(null)
    setCloneRenameValue("")
    loadData()
  }

  const handleDelete = async (position: Position) => {
    if (!confirm(`确定要删除岗位「${position.name}」吗？`)) return
    try {
      await positionApi.delete(position.id)
      loadData()
    } catch (err: any) {
      toast({ variant: 'destructive', title: '删除失败', description: err?.message || '请稍后重试' })
    }
  }

  const handleSubmitApproval = async (position: Position) => {
    const batch = batches.find((b) => b.id === position.batchId)
    if (!batch) {
      toast({ variant: 'destructive', title: '无法提交', description: '该岗位未关联批次，无法提交审批' })
      return
    }
    try {
      await positionApi.submit(position.id)
      await approvalApi.create({
        targetType: 'career_position',
        targetId: position.id,
        workflowId: batch.workflowId,
      } as any)
      loadData()
    } catch (err: any) {
      toast({ variant: 'destructive', title: '提交失败', description: err?.message || '请稍后重试' })
    }
  }

  const handleWithdrawApproval = async (position: Position) => {
    try {
      await positionApi.withdraw(position.id)
      loadData()
    } catch (err: any) {
      toast({ variant: 'destructive', title: '撤回失败', description: err?.message || '请稍后重试' })
    }
  }

  const handlePublish = async (position: Position) => {
    try {
      await positionApi.publish(position.id)
      loadData()
    } catch (err: any) {
      toast({ variant: 'destructive', title: '发布失败', description: err?.message || '请稍后重试' })
    }
  }

  const handleUnpublish = async (position: Position) => {
    try {
      await positionApi.unpublish(position.id)
      loadData()
    } catch (err: any) {
      toast({ variant: 'destructive', title: '取消发布失败', description: err?.message || '请稍后重试' })
    }
  }

  const handleInviteCoBuild = async (position: Position) => {
    const userId = window.prompt(`请输入要邀请共建「${position.name}」的用户 ID`)
    if (!userId) return
    try {
      await positionApi.invite(position.id, userId)
      loadData()
    } catch (err: any) {
      toast({ variant: 'destructive', title: '邀请失败', description: err?.message || '请稍后重试' })
    }
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
      const result = await importExportApi.import('career_positions', importFile)
      toast({ title: `导入完成：成功 ${result.created} 条，失败 ${result.failed} 条` })
      setImportFile(null)
      setIsImportDialogOpen(false)
      loadData()
    } catch (err: any) {
      toast({ variant: 'destructive', title: '导入失败', description: err?.message || '未知错误' })
    } finally {
      setIsImporting(false)
    }
  }

  const handleCreate = async () => {
    try {
      const created = await positionApi.create(positionToCreateRequest({
        batchId: "",
        version: "V1.0",
        status: "draft",
        name: "新建岗位",
        shortName: "新岗位",
        industry: "",
        majors: [],
        positionType: "enterprise",
        salaryRange: [0, 0],
        certificates: [],
        description: "",
        responsibilities: [],
        requirements: [],
        careerPath: '',
        abilityModel: { nodes: [], edges: [] },
        abilityBindings: [],
        abilityDomains: [],
        competencyConfig: [],
        createdBy: currentUserId,
        collaborators: [currentUserId],
        favoriteCount: 0,
      }))
      router.push(`/job/positions/${created.id}/edit`)
    } catch (err: any) {
      toast({ variant: 'destructive', title: '创建失败', description: err?.message || '请稍后重试' })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeaderCard
        title="岗位资源管理"
        description="维护岗位信息、能力模型等岗位资源管理功能"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setIsResourceImportDialogOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              导入资源包
            </Button>

            <Button variant="outline" size="sm" onClick={() => setIsImportDialogOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              导入岗位
            </Button>

            <Button size="sm" className="bg-primary hover:bg-primary/90" onClick={handleCreate}>
              <Plus className="mr-2 h-4 w-4" />
              新建岗位
            </Button>
          </>
        }
        stats={
          activeTab !== "public"
            ? [
                {
                  label: "岗位总数",
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

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as TabType); setSelectedIds([]); setSelectedBatchId(null) }}>
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="my" className="w-full">我的岗位</TabsTrigger>
            <TabsTrigger value="collab" className="w-full">共建岗位</TabsTrigger>
            <TabsTrigger value="public" className="w-full">公共岗位</TabsTrigger>
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
                <Search className="h-4 w-4 text-slate-400 shrink-0" />
                <Input
                  placeholder="搜索岗位名称 / 简称"
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
                        <span className="text-xs text-gray-400">({batch.id.slice(0, 8)})</span>
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

          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
            <span className={cn("text-xs mr-1", hasSelected ? "text-slate-700 font-medium" : "text-slate-400")}>
              {hasSelected ? `已选择 ${selectedIds.length} 项：` : "请选择岗位："}
            </span>
            {hasPermission("job", "positions", "submit_approval") && (
              <Button variant="outline" size="sm" className="h-8 text-xs" disabled={!hasSelected || !canBatchSubmit} onClick={handleBatchSubmitApproval}>
                <Send className="mr-1 h-3 w-3" />
                提交审批
              </Button>
            )}
            {hasPermission("job", "positions", "withdraw_approval") && (
              <Button variant="outline" size="sm" className="h-8 text-xs" disabled={!hasSelected || !canBatchWithdraw} onClick={handleBatchWithdrawApproval}>
                <Undo2 className="mr-1 h-3 w-3" />
                撤回审批
              </Button>
            )}
            {hasPermission("job", "positions", "publish") && (
              <Button variant="outline" size="sm" className="h-8 text-xs" disabled={!hasSelected || !canBatchPublish} onClick={handleBatchPublish}>
                <ArrowUpFromLine className="mr-1 h-3 w-3" />
                发布
              </Button>
            )}
            {hasPermission("job", "positions", "unpublish") && (
              <Button variant="outline" size="sm" className="h-8 text-xs" disabled={!hasSelected || !canBatchUnpublish} onClick={handleBatchUnpublish}>
                <ArrowDownFromLine className="mr-1 h-3 w-3" />
                取消发布
              </Button>
            )}
            {hasPermission("job", "positions", "delete") && (
              <Button variant="outline" size="sm" className="h-8 text-xs" disabled={!hasSelected || !canBatchDelete} onClick={handleBatchDelete}>
                <Trash2 className="mr-1 h-3 w-3" />
                删除
              </Button>
            )}
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

        {filteredPositions.length > 0 && viewMode !== "group" && (
          <CardContent className="pt-0">
            <PositionList
              positions={filteredPositions}
              selectedIds={selectedIds}
              onSelectId={handleSelectId}
              onSelectAll={handleSelectAll}
              onClone={handleClone}
              onDelete={handleDelete}
              onSubmitApproval={handleSubmitApproval}
              onWithdrawApproval={handleWithdrawApproval}
              onPublish={handlePublish}
              onUnpublish={handleUnpublish}
              onInviteCoBuild={handleInviteCoBuild}
              configureStepParam="2"
              className="border-0 rounded-none"
              industryMap={industryMap}
              majorMap={majorMap}
            />
          </CardContent>
        )}
      </Card>

      {filteredPositions.length > 0 && viewMode === "group" && positionsByBatch && (
        <div className="space-y-4">
          {Object.entries(positionsByBatch).map(([batchId, batchPositions]) => {
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
                        <span className="text-xs text-gray-400">({batch.department} - {majorMap.get(batch.majorId || "") || batch.major || batch.majorId})</span>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {batchPositions.length} 个岗位
                      </Badge>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="p-4 pt-0">
                      <PositionList
                        positions={batchPositions}
                        selectedIds={selectedIds}
                        onSelectId={handleSelectId}
                        onSelectAll={handleSelectAll}
                        onClone={handleClone}
                        onDelete={handleDelete}
                        onSubmitApproval={handleSubmitApproval}
                        onWithdrawApproval={handleWithdrawApproval}
                        onPublish={handlePublish}
                        onUnpublish={handleUnpublish}
                        onInviteCoBuild={handleInviteCoBuild}
                        configureStepParam="2"
                        industryMap={industryMap}
                        majorMap={majorMap}
                      />
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            )
          })}
          {uncategorizedPositions.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-dashed border-slate-300 bg-white">
              <div className="flex items-center justify-between px-4 py-3 bg-slate-50/80">
                <div className="flex items-center gap-3">
                  <span className="font-medium text-gray-800">未分类</span>
                  <Badge variant="secondary" className="text-xs">
                    {uncategorizedPositions.length} 个岗位
                  </Badge>
                </div>
              </div>
              <div className="p-4 pt-0">
                <PositionList
                  positions={uncategorizedPositions}
                  selectedIds={selectedIds}
                  onSelectId={handleSelectId}
                  onSelectAll={handleSelectAll}
                  onClone={handleClone}
                  onDelete={handleDelete}
                  onSubmitApproval={handleSubmitApproval}
                  onWithdrawApproval={handleWithdrawApproval}
                  onPublish={handlePublish}
                  onUnpublish={handleUnpublish}
                  onInviteCoBuild={handleInviteCoBuild}
                  configureStepParam="2"
                  industryMap={industryMap}
                  majorMap={majorMap}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {filteredPositions.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white py-20 shadow-sm">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
            <Search className="h-8 w-8 text-slate-400" />
          </div>
          <h3 className="mb-2 text-lg font-medium text-slate-700">暂无岗位</h3>
          <p className="mb-4 text-sm text-slate-500">当前筛选条件下没有岗位数据</p>
          <Button size="sm" onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" />
            新建岗位
          </Button>
        </div>
      )}

      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>导入岗位</DialogTitle>
            <DialogDescription>上传 CSV 文件批量导入岗位数据（需包含 name 列）</DialogDescription>
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

      <Dialog open={isResourceImportDialogOpen} onOpenChange={setIsResourceImportDialogOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>资源包导入</DialogTitle>
            <DialogDescription>导入包含岗位、能力模型和资源的完整资源包</DialogDescription>
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

      <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>导出岗位</DialogTitle>
            <DialogDescription>将选中的岗位数据导出为文件</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-slate-500">已选择 {selectedIds.length} 个岗位</p>
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

      <Dialog open={isBatchMoveDialogOpen} onOpenChange={setIsBatchMoveDialogOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>调整批次分组</DialogTitle>
            <DialogDescription>将选中的 {selectedIds.length} 个岗位移动到指定批次</DialogDescription>
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

      <Dialog open={isCloneRenameDialogOpen} onOpenChange={setIsCloneRenameDialogOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>克隆岗位</DialogTitle>
            <DialogDescription>为克隆的岗位命名</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={cloneRenameValue}
              onChange={(e) => setCloneRenameValue(e.target.value)}
              placeholder="输入新岗位名称"
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
