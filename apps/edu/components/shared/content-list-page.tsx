"use client"

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  FolderKanban,
  GitBranch,
  LayoutGrid,
  List,
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
  Archive,
} from "lucide-react"
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
import { useAuth } from "@/components/auth-provider"

// ─── Types ───────────────────────────────────────────────────────────────

export interface ContentListItem {
  id: string
  name: string
  status: string
  batchId?: string
  creatorId?: string
  coCreatorIds?: string[]
}

export interface ContentBatch {
  id: string
  name: string
  workflowId?: string
}

export interface ContentApi {
  list: (params?: Record<string, any>) => Promise<{ items: any[] }>
  create: (req: any) => Promise<any>
  submit: (id: string) => Promise<any>
  withdraw: (id: string) => Promise<any>
  publish: (id: string) => Promise<any>
  unpublish: (id: string) => Promise<any>
  archive: (id: string) => Promise<any>
  delete: (id: string) => Promise<any>
  invite: (id: string, userId: string) => Promise<any>
  update: (id: string, req: any) => Promise<any>
}

export interface ContentBatchApi {
  list: (params?: Record<string, any>) => Promise<{ items: any[] }>
}

export interface ContentApprovalApi {
  list: (params?: Record<string, any>) => Promise<{ items: any[] }>
  create: (req: { targetType: string; targetId: string; workflowId?: string }) => Promise<any>
  review: (id: string, req: { status: "approved" | "rejected"; comment?: string; stepIdx?: number }) => Promise<any>
}

export interface ContentImportExportApi {
  import: (entity: string, file: File) => Promise<{ created: number; failed: number }>
  export: (entity: string) => Promise<Response>
}

export interface ContentListPageConfig<T extends ContentListItem> {
  title: string
  subtitle: string
  entityLabel: string
  addHref: string

  permissionModule: string
  permissionResource: string

  itemApi: ContentApi
  batchApi: ContentBatchApi
  approvalApi: ContentApprovalApi
  importExportApi: ContentImportExportApi

  approvalTargetType: string
  importEntityName: string
  exportEntityName: string

  statusFilterOptions: { value: string; label: string }[]

  mapItem: (backend: any, currentUserId: string) => T
  mapBatch: (backend: any) => ContentBatch
  afterLoad?: (items: T[]) => Promise<T[]>

  createPayload: (userId: string, entityLabel: string) => any

  renderList: (props: ListRenderProps<T>) => ReactNode

  extraHeaderActions?: ReactNode
  listExtraProps?: Record<string, any>
  children?: ReactNode
}

export interface ListRenderProps<T extends ContentListItem> {
  items: T[]
  selectedIds: string[]
  onSelectId: (id: string, checked: boolean) => void
  onSelectAll: (checked: boolean) => void
  onClone: (item: T) => void
  onDelete: (item: T) => void
  onSubmitApproval: (item: T) => void
  onWithdrawApproval: (item: T) => void
  onApprove: (item: T) => void
  onReject: (item: T) => void
  onViewRejectReason: (item: T) => void
  onPublish: (item: T) => void
  onUnpublish: (item: T) => void
  onArchive: (item: T) => void
  onInviteCoBuild: (item: T) => void
  batchMap: Map<string, string>
  extraProps?: Record<string, any>
}

type TabType = "my" | "collab" | "public"
type ViewMode = "list" | "group"

// ─── Component ──────────────────────────────────────────────────────────

export function ContentListPage<T extends ContentListItem>(config: ContentListPageConfig<T>) {
  const {
    title, subtitle, entityLabel, addHref,
    permissionModule, permissionResource,
    itemApi, batchApi, approvalApi, importExportApi,
    approvalTargetType, importEntityName, exportEntityName,
    statusFilterOptions, mapItem, mapBatch, createPayload,
    renderList, extraHeaderActions, listExtraProps, children, afterLoad,
  } = config

  const router = useRouter()
  const { hasPermission, user } = useAuth()
  const currentUserId = user?.id ?? ""

  const [items, setItems] = useState<any[]>([])
  const [frontItems, setFrontItems] = useState<T[]>([])
  const [batches, setBatches] = useState<ContentBatch[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const [activeTab, setActiveTab] = useState<TabType>("my")
  const [viewMode, setViewMode] = useState<ViewMode>("list")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null)
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [expandedBatches, setExpandedBatches] = useState<string[]>([])

  // Dialogs
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false)
  const [isBatchMoveDialogOpen, setIsBatchMoveDialogOpen] = useState(false)
  const [moveTargetBatchId, setMoveTargetBatchId] = useState("")
  const [isCloneRenameDialogOpen, setIsCloneRenameDialogOpen] = useState(false)
  const [cloneRenameValue, setCloneRenameValue] = useState("")
  const [cloneTarget, setCloneTarget] = useState<T | null>(null)
  const [isRejectReasonDialogOpen, setIsRejectReasonDialogOpen] = useState(false)
  const [rejectReasonItem, setRejectReasonItem] = useState<T | null>(null)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [itemsResp, batchesResp] = await Promise.all([
        itemApi.list({ limit: 1000 }),
        batchApi.list({ limit: 1000 }),
      ])
      setItems(itemsResp.items)
      let front = itemsResp.items.map((i: any) => mapItem(i, currentUserId))
      if (afterLoad) front = await afterLoad(front)
      setFrontItems(front)
      const mappedBatches = batchesResp.items.map(mapBatch)
      setBatches(mappedBatches)
      setExpandedBatches(mappedBatches.map((b) => b.id))
    } catch (err) {
      console.error(`Failed to load ${entityLabel} data:`, err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const refresh = async () => { await loadData() }

  const toggleBatch = (batchId: string) => {
    setExpandedBatches((prev) =>
      prev.includes(batchId) ? prev.filter((id) => id !== batchId) : [...prev, batchId]
    )
  }

  const tabFiltered = useMemo(() => {
    switch (activeTab) {
      case "my":
        return frontItems.filter((i) => i.creatorId === currentUserId)
      case "collab":
        return frontItems.filter((i) => i.coCreatorIds?.includes(currentUserId))
      default:
        return frontItems.filter((i) => i.status === "published")
    }
  }, [frontItems, activeTab, currentUserId])

  const filtered = useMemo(() => {
    let result = tabFiltered
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      result = result.filter((i) => i.name.toLowerCase().includes(q))
    }
    if (selectedBatchId) {
      result = result.filter((i) => i.batchId === selectedBatchId)
    }
    if (selectedStatus) {
      result = result.filter((i) => i.status === selectedStatus)
    } else {
      result = result.filter((i) => i.status !== "archived")
    }
    return result
  }, [tabFiltered, searchQuery, selectedBatchId, selectedStatus])

  const stats = useMemo(() => {
    const total = filtered.length
    const draft = filtered.filter((i) => i.status === "draft").length
    const pending = filtered.filter((i) => i.status === "pending").length
    const rejected = filtered.filter((i) => i.status === "rejected").length
    const published = filtered.filter((i) => i.status === "published").length
    return { total, draft, pending, rejected, published }
  }, [filtered])

  const itemsByBatch = useMemo(() => {
    if (viewMode !== "group") return null
    const groups: Record<string, T[]> = {}
    filtered.forEach((item) => {
      if (!item.batchId) return
      if (!groups[item.batchId]) groups[item.batchId] = []
      groups[item.batchId].push(item)
    })
    return groups
  }, [filtered, viewMode])

  const uncategorized = useMemo(
    () => filtered.filter((i) => !i.batchId && i.status === "draft"),
    [filtered]
  )

  const batchMap = useMemo(() => {
    const map = new Map<string, string>()
    batches.forEach((b) => map.set(b.id, b.name))
    return map
  }, [batches])

  const handleSelectId = (id: string, checked: boolean) => {
    setSelectedIds((prev) => (checked ? [...prev, id] : prev.filter((sid) => sid !== id)))
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) setSelectedIds(filtered.map((i) => i.id))
    else setSelectedIds([])
  }

  const selectedFront = frontItems.filter((i) => selectedIds.includes(i.id))
  const hasSelected = selectedIds.length > 0

  const canBatchSubmit = selectedFront.some((i) => i.status === "draft" || i.status === "rejected")
  const canBatchWithdraw = selectedFront.some((i) => i.status === "pending")
  const canBatchUnpublish = selectedFront.some((i) => i.status === "published")
  const canBatchPublish = selectedFront.some((i) => i.status === "approved")
  const canBatchDelete = selectedFront.some((i) => i.status === "draft" || i.status === "rejected")
  const canBatchArchive = selectedFront.some((i) => ["draft", "rejected", "approved", "published"].includes(i.status))

  // ─── Handlers ──────────────────────────────────────────────────────────

  const handleBatchSubmitApproval = async () => {
    for (const id of selectedIds) {
      const item = frontItems.find((i) => i.id === id)
      if (item && (item.status === "draft" || item.status === "rejected")) {
        const batch = batches.find((b) => b.id === item.batchId)
        if (batch) {
          try {
            await itemApi.submit(id)
            await approvalApi.create({ targetType: approvalTargetType, targetId: id, workflowId: batch.workflowId })
          } catch (err) {
            console.error("提交审批失败", err)
          }
        }
      }
    }
    setSelectedIds([])
    await refresh()
  }

  const handleBatchWithdrawApproval = async () => {
    for (const id of selectedIds) {
      const item = frontItems.find((i) => i.id === id)
      if (item && item.status === "pending") {
        try { await itemApi.withdraw(id) } catch (_) {}
      }
    }
    setSelectedIds([])
    await refresh()
  }

  const handleBatchUnpublish = async () => {
    for (const id of selectedIds) {
      const item = frontItems.find((i) => i.id === id)
      if (item && item.status === "published") {
        try { await itemApi.unpublish(id) } catch (_) {}
      }
    }
    setSelectedIds([])
    await refresh()
  }

  const handleBatchPublish = async () => {
    for (const id of selectedIds) {
      const item = frontItems.find((i) => i.id === id)
      if (item && item.status === "approved") {
        try { await itemApi.publish(id) } catch (_) {}
      }
    }
    setSelectedIds([])
    await refresh()
  }

  const handleBatchDelete = async () => {
    for (const id of selectedIds) {
      try { await itemApi.delete(id) } catch (_) {}
    }
    setSelectedIds([])
    await refresh()
  }

  const handleArchive = async (item: T) => {
    if (!confirm(`确定要归档${entityLabel}「${item.name}」吗？`)) return
    try { await itemApi.archive(item.id); await refresh() } catch (_) {}
  }

  const handleBatchArchive = async () => {
    for (const id of selectedIds) {
      const item = frontItems.find((i) => i.id === id)
      if (item && ["draft", "rejected", "approved", "published"].includes(item.status)) {
        try { await itemApi.archive(item.id) } catch (_) {}
      }
    }
    setSelectedIds([])
    await refresh()
  }

  const handleBatchClone = async () => {
    for (const id of selectedIds) {
      const item = frontItems.find((i) => i.id === id)
      if (!item) continue
      try {
        await itemApi.create({
          ...createPayload(currentUserId, entityLabel),
          name: `${item.name} (克隆)`,
          batchId: item.batchId,
        })
      } catch (_) {}
    }
    setSelectedIds([])
    await refresh()
  }

  const handleBatchExport = async () => {
    try {
      const res = await importExportApi.export(exportEntityName)
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      const disposition = res.headers.get("content-disposition")
      a.download = disposition?.match(/filename="?([^";]+)"?/)?.[1] || `${exportEntityName}-export.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error("导出失败", err)
    }
    setIsExportDialogOpen(false)
    setSelectedIds([])
  }

  const handleBatchMove = () => { setIsBatchMoveDialogOpen(true) }

  const handleConfirmMove = async () => {
    if (!moveTargetBatchId) return
    for (const id of selectedIds) {
      try { await itemApi.update(id, { batchId: moveTargetBatchId }) } catch (_) {}
    }
    setSelectedIds([])
    setIsBatchMoveDialogOpen(false)
    setMoveTargetBatchId("")
    await refresh()
  }

  const handleClone = (item: T) => {
    setCloneTarget(item)
    setCloneRenameValue(`${item.name} (克隆)`)
    setIsCloneRenameDialogOpen(true)
  }

  const handleConfirmClone = async () => {
    if (!cloneTarget) return
    try {
      await itemApi.create({
        ...createPayload(currentUserId, entityLabel),
        name: cloneRenameValue,
        batchId: cloneTarget.batchId,
      })
    } catch (_) {}
    setIsCloneRenameDialogOpen(false)
    setCloneTarget(null)
    setCloneRenameValue("")
    await refresh()
  }

  const handleDelete = async (item: T) => {
    if (!confirm(`确定要删除${entityLabel}「${item.name}」吗？`)) return
    try { await itemApi.delete(item.id); await refresh() } catch (_) {}
  }

  const handleSubmitApproval = async (item: T) => {
    if (!item.batchId) {
      alert(`该${entityLabel}未关联批次，无法提交审批`)
      return
    }
    const batch = batches.find((b) => b.id === item.batchId)
    if (!batch) {
      alert(`该${entityLabel}未关联批次，无法提交审批`)
      return
    }
    try {
      await itemApi.submit(item.id)
      await approvalApi.create({ targetType: approvalTargetType, targetId: item.id, workflowId: batch.workflowId })
      await refresh()
    } catch (err) {
      console.error("提交审批失败", err)
      alert("提交审批失败，请稍后重试")
    }
  }

  const handleWithdrawApproval = async (item: T) => {
    try { await itemApi.withdraw(item.id); await refresh() } catch (_) {}
  }

  const handleApprove = async (item: T) => {
    try {
      const records = await approvalApi.list({ targetType: approvalTargetType, targetId: item.id, status: "pending", limit: 1 })
      if (records.items.length === 0) { alert("未找到审批记录"); return }
      await approvalApi.review(records.items[0].id, { status: "approved" })
      await refresh()
    } catch (_) {}
  }

  const handleReject = async (item: T) => {
    try {
      const records = await approvalApi.list({ targetType: approvalTargetType, targetId: item.id, status: "pending", limit: 1 })
      if (records.items.length === 0) { alert("未找到审批记录"); return }
      await approvalApi.review(records.items[0].id, { status: "rejected" })
      await refresh()
    } catch (_) {}
  }

  const handlePublish = async (item: T) => {
    try { await itemApi.publish(item.id); await refresh() } catch (_) {}
  }

  const handleUnpublish = async (item: T) => {
    try { await itemApi.unpublish(item.id); await refresh() } catch (_) {}
  }

  const handleInviteCoBuild = async (item: T) => {
    const userId = window.prompt(`请输入要邀请共建「${item.name}」的用户 ID`)
    if (!userId) return
    try { await itemApi.invite(item.id, userId); await refresh() } catch (_) {}
  }

  const handleViewRejectReason = (item: T) => {
    setRejectReasonItem(item)
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
      const result = await importExportApi.import(importEntityName, importFile)
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
      const newItem = await itemApi.create(createPayload(currentUserId, entityLabel))
      router.push(`${addHref}?id=${newItem.id}&new=true`)
    } catch (err: any) {
      console.error(`Failed to create ${entityLabel}:`, err)
      alert(err.message || "创建失败")
    }
  }

  const listProps: ListRenderProps<T> = {
    items: filtered,
    selectedIds,
    onSelectId: handleSelectId,
    onSelectAll: handleSelectAll,
    onClone: handleClone,
    onDelete: handleDelete,
    onSubmitApproval: handleSubmitApproval,
    onWithdrawApproval: handleWithdrawApproval,
    onApprove: handleApprove,
    onReject: handleReject,
    onViewRejectReason: handleViewRejectReason,
    onPublish: handlePublish,
    onUnpublish: handleUnpublish,
    onArchive: handleArchive,
    onInviteCoBuild: handleInviteCoBuild,
    batchMap,
    extraProps: listExtraProps,
  }

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <PageHeaderCard
        title={title}
        description={subtitle}
        actions={
          <>
            {extraHeaderActions}
            <Button variant="outline" size="sm" onClick={() => setIsImportDialogOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              导入{entityLabel}
            </Button>
            <Button size="sm" className="bg-primary hover:bg-primary/90" onClick={handleCreate}>
              <Plus className="mr-2 h-4 w-4" />
              新增{entityLabel}
            </Button>
          </>
        }
        stats={
          activeTab !== "public"
            ? [
                {
                  label: `${entityLabel}总数`,
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
            <TabsTrigger value="my" className="w-full">我的{entityLabel}</TabsTrigger>
            <TabsTrigger value="collab" className="w-full">共建{entityLabel}</TabsTrigger>
            <TabsTrigger value="public" className="w-full">公共{entityLabel}</TabsTrigger>
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
                  placeholder={`搜索${entityLabel}名称`}
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
                  {statusFilterOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
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
              {hasSelected ? `已选择 ${selectedIds.length} 项：` : `请选择${entityLabel}：`}
            </span>
            {hasPermission(permissionModule, permissionResource, "submit_approval") && (
              <Button variant="outline" size="sm" className="h-8 text-xs" disabled={!hasSelected || !canBatchSubmit} onClick={handleBatchSubmitApproval}>
                <Send className="mr-1 h-3 w-3" />
                提交审批
              </Button>
            )}
            {hasPermission(permissionModule, permissionResource, "withdraw_approval") && (
              <Button variant="outline" size="sm" className="h-8 text-xs" disabled={!hasSelected || !canBatchWithdraw} onClick={handleBatchWithdrawApproval}>
                <Undo2 className="mr-1 h-3 w-3" />
                撤回审批
              </Button>
            )}
            {hasPermission(permissionModule, permissionResource, "publish") && (
              <Button variant="outline" size="sm" className="h-8 text-xs" disabled={!hasSelected || !canBatchPublish} onClick={handleBatchPublish}>
                <ArrowUpFromLine className="mr-1 h-3 w-3" />
                发布
              </Button>
            )}
            {hasPermission(permissionModule, permissionResource, "unpublish") && (
              <Button variant="outline" size="sm" className="h-8 text-xs" disabled={!hasSelected || !canBatchUnpublish} onClick={handleBatchUnpublish}>
                <ArrowDownFromLine className="mr-1 h-3 w-3" />
                取消发布
              </Button>
            )}
            <Button variant="outline" size="sm" className="h-8 text-xs text-purple-600 hover:text-purple-700" disabled={!hasSelected || !canBatchArchive} onClick={handleBatchArchive}>
              <Archive className="mr-1 h-3 w-3" />
              归档
            </Button>
            {hasPermission(permissionModule, permissionResource, "delete") && (
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

        {!isLoading && filtered.length > 0 && viewMode !== "group" && (
          <CardContent className="pt-0">
            {renderList(listProps)}
          </CardContent>
        )}
      </Card>

      {!isLoading && filtered.length > 0 && viewMode === "group" && itemsByBatch && (
        <div className="space-y-4">
          {Object.entries(itemsByBatch).map(([batchId, batchItems]) => {
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
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {batchItems.length} 个{entityLabel}
                      </Badge>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="p-4 pt-0">
                      {renderList({ ...listProps, items: batchItems })}
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            )
          })}
          {uncategorized.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-dashed border-slate-300 bg-white">
              <div className="flex items-center justify-between px-4 py-3 bg-slate-50/80">
                <div className="flex items-center gap-3">
                  <span className="font-medium text-gray-800">未分类</span>
                  <Badge variant="secondary" className="text-xs">
                    {uncategorized.length} 个{entityLabel}
                  </Badge>
                </div>
              </div>
              <div className="p-4 pt-0">
                {renderList({ ...listProps, items: uncategorized })}
              </div>
            </div>
          )}
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white py-20 shadow-sm">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
            <Search className="h-8 w-8 text-slate-400" />
          </div>
          <h3 className="mb-2 text-lg font-medium text-slate-700">暂无{entityLabel}</h3>
          <p className="mb-4 text-sm text-slate-500">当前筛选条件下没有{entityLabel}数据</p>
          <Button size="sm" onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" />
            新增{entityLabel}
          </Button>
        </div>
      )}

      {isLoading && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white py-20 shadow-sm">
          <p className="text-sm text-slate-500">加载中...</p>
        </div>
      )}

      {/* Import Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>导入{entityLabel}</DialogTitle>
            <DialogDescription>上传 CSV 文件批量导入{entityLabel}数据</DialogDescription>
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
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>导出{entityLabel}</DialogTitle>
            <DialogDescription>将选中的{entityLabel}数据导出为文件</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-slate-500">已选择 {selectedIds.length} 个{entityLabel}</p>
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
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>调整批次分组</DialogTitle>
            <DialogDescription>将选中的 {selectedIds.length} 个{entityLabel}移动到指定批次</DialogDescription>
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
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>克隆{entityLabel}</DialogTitle>
            <DialogDescription>为克隆的{entityLabel}命名</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={cloneRenameValue}
              onChange={(e) => setCloneRenameValue(e.target.value)}
              placeholder="输入新名称"
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
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>驳回原因</DialogTitle>
            <DialogDescription>
              {entityLabel}「{rejectReasonItem?.name}」的审批被驳回，驳回原因如下：
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
              审批人已驳回此{entityLabel}的提交申请，请根据审批意见修改后重新提交。
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRejectReasonDialogOpen(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {children}
    </div>
  )
}
