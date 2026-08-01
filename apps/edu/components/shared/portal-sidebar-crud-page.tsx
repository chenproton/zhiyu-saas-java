"use client"

import { useState, useEffect, useMemo, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { OrgFilterTree, collectOrgSubtreeIds } from "@/components/shared/_components/org-filter-tree"
import { OrgNodePicker } from "@/components/shared/org-node-picker"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { ResetPasswordDialog } from "@/components/shared/reset-password-dialog"
import { ImportConfirmDialog } from "@/components/shared/import-confirm-dialog"
import { ImportWizardDialog } from "@/components/shared/import-wizard-dialog"
import { useToast } from "@zhiyu/ui"
import { useImportFlow, type UseImportFlowOptions } from "@/hooks/use-import-flow"
import type { Organization, OrgType } from "@/lib/types/backend"
import {
  Search, Upload, Download,
  FolderTree, Loader2, AlertCircle, RotateCcw, ChevronLeft, ChevronRight, ChevronDown,
} from "lucide-react"

export interface PortalSidebarCrudPageConfig<T extends { id: string; orgNodeId?: string }> {
  title: string
  description: string
  entityLabel: string
  searchPlaceholder: string
  createButtonLabel: string

  items: T[]
  loading: boolean
  error: string | null | undefined
  total: number
  page: number
  pageSize: number
  setPage: (page: number) => void
  refetch: () => void

  orgs: Organization[]
  orgMap: Map<string, Organization>
  orgTypeMap: Map<string, OrgType>
  orgLoading: boolean
  sidebarAllLabel: string

  statusFilter: string
  setStatusFilter: (v: string) => void
  statusOptions: { value: string; label: string }[]

  filterItems: (items: T[], search: string, status: string) => T[]
  getItemOrgNodeId: (item: T) => string | undefined

  importConfig: Omit<UseImportFlowOptions, "onSuccess">
  colSpan: number
  renderTableHeader: () => ReactNode
  renderTableRow: (
    item: T,
    actions: { isChecked: boolean; onToggleCheck: () => void; edit: () => void; onDelete: () => void; onResetPwd: () => void }
  ) => ReactNode

  headerActions?: (selectedIds: string[], openJoinDialog: () => void) => ReactNode

  onOpenCreate: () => void
  onOpenEdit: (item: T) => void
  isEditDialogOpen: boolean
  setIsEditDialogOpen: (open: boolean) => void
  editDialogTitle: ReactNode
  editDialogDescription: ReactNode
  renderForm: () => ReactNode
  formValid: boolean
  saving: boolean
  onFormSave: () => Promise<void>

  onDelete: (id: string) => Promise<void>
  onExport: (selectedIds: string[]) => Promise<void>

  joinEntityLabel: string
  onBatchJoin: (orgNodeId: string, userIds: string[]) => Promise<void>
  orgNodePickerProps?: {
    selectableTypes?: string[]
    placeholder?: string
    title?: string
  }
}

export function PortalSidebarCrudPage<T extends { id: string; orgNodeId?: string }>({
  title,
  description,
  entityLabel,
  searchPlaceholder,
  createButtonLabel,
  items,
  loading,
  error,
  total,
  page,
  pageSize,
  setPage,
  refetch,
  orgs,
  orgMap,
  orgTypeMap,
  orgLoading,
  sidebarAllLabel,
  statusFilter,
  setStatusFilter,
  statusOptions,
  filterItems,
  getItemOrgNodeId,
  importConfig,
  colSpan,
  renderTableHeader,
  renderTableRow,
  headerActions,
  onOpenCreate,
  onOpenEdit,
  isEditDialogOpen,
  setIsEditDialogOpen,
  editDialogTitle,
  editDialogDescription,
  renderForm,
  formValid,
  saving,
  onFormSave,
  onDelete,
  onExport,
  joinEntityLabel,
  onBatchJoin,
  orgNodePickerProps,
}: PortalSidebarCrudPageConfig<T>) {
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState("")

  const [selectedOrgNodeId, setSelectedOrgNodeId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [resetTarget, setResetTarget] = useState<{ id: string; name: string } | null>(null)

  const [isJoinDialogOpen, setIsJoinDialogOpen] = useState(false)
  const [joinTargetNodeId, setJoinTargetNodeId] = useState<string>("")
  const [joinLoading, setJoinLoading] = useState(false)

  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [isImportConfirmOpen, setIsImportConfirmOpen] = useState(false)
  const [orgTreeOpen, setOrgTreeOpen] = useState(false)

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const {
    importFiles,
    setImportFiles,
    isImporting,
    isDownloading,
    importPreview,
    handleAddFiles,
    handleRemoveFile,
    handleImport,
    executeImport,
    handleDownloadTemplate,
  } = useImportFlow({
    ...importConfig,
    onSuccess: refetch,
  })

  useEffect(() => {
    if (importPreview) {
      (async () => { setIsImportConfirmOpen(true) })()
    }
  }, [importPreview])

  const selectedOrgIds = useMemo(() => {
    if (!selectedOrgNodeId) return null
    return collectOrgSubtreeIds(orgMap, selectedOrgNodeId)
  }, [selectedOrgNodeId, orgMap])

  const filteredItems = useMemo(() => {
    let result = filterItems(items, searchTerm, statusFilter)
    if (selectedOrgIds) {
      result = result.filter((item) => {
        const nodeId = getItemOrgNodeId(item)
        return !!nodeId && selectedOrgIds.has(nodeId)
      })
    }
    return result
  }, [items, searchTerm, statusFilter, selectedOrgIds, filterItems, getItemOrgNodeId])

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredItems.length && filteredItems.length > 0) {
      setSelectedIds([])
    } else {
      setSelectedIds(filteredItems.map((t) => t.id))
    }
  }

  const toggleSelectItem = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]))
  }

  const handleBatchJoin = async () => {
    if (selectedIds.length === 0) return
    if (!joinTargetNodeId) {
      toast({ variant: "destructive", title: `请选择目标${joinEntityLabel}` })
      return
    }
    setJoinLoading(true)
    try {
      await onBatchJoin(joinTargetNodeId, selectedIds)
      toast({ title: `已将 ${selectedIds.length} 名${entityLabel}加入${joinEntityLabel}` })
      setIsJoinDialogOpen(false)
      setJoinTargetNodeId("")
      setSelectedIds([])
      await refetch()
    } catch (err) {
      toast({
        variant: "destructive",
        title: `批量加入${joinEntityLabel}失败`,
        description: err instanceof Error ? err.message : "未知错误",
      })
    } finally {
      setJoinLoading(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await onDelete(deleteTarget)
    } catch (err) {
      toast({
        variant: "destructive",
        title: "删除失败",
        description: err instanceof Error ? err.message : "未知错误",
      })
    } finally {
      setDeleteTarget(null)
      await refetch()
    }
  }

  const doImport = async (overwrite = false) => {
    const ok = await executeImport(overwrite)
    if (ok) {
      setIsImportDialogOpen(false)
      setIsImportConfirmOpen(false)
      setImportFiles([])
    }
  }

  const handleExport = async () => {
    try {
      await onExport(selectedIds.length > 0 ? selectedIds : [])
    } catch (err: any) {
      toast({ variant: "destructive", title: "导出失败", description: err.message || "导出失败" })
    }
  }

  return (
    <div className="p-4 sm:p-6 bg-[#f5f7fa] min-h-full">
      <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {headerActions?.(selectedIds, () => { setJoinTargetNodeId(""); setIsJoinDialogOpen(true) })}
          <Button variant="outline" size="sm" onClick={() => setIsImportDialogOpen(true)}>
            <Upload className="h-4 w-4 mr-1" />导入
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-1" />
            导出{selectedIds.length > 0 ? `(${selectedIds.length})` : ""}
          </Button>
          <Button size="sm" onClick={onOpenCreate}>
            <span className="h-4 w-4 mr-1">+</span>
            {createButtonLabel}
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded border border-destructive/20 bg-destructive/10 p-4 text-destructive flex items-start gap-3">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium">加载失败</p>
            <p className="text-sm opacity-90">{error}</p>
          </div>
          <Button variant="outline" size="sm" onClick={refetch}>
            <RotateCcw className="h-4 w-4 mr-1" />重试
          </Button>
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-4 items-start">
        {/* 移动端组织架构开关 */}
        <button
          type="button"
          onClick={() => setOrgTreeOpen((v) => !v)}
          className="md:hidden w-full flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-gray-100 bg-white shadow-sm text-muted-foreground hover:text-foreground"
        >
          <FolderTree className="h-4 w-4 text-primary" />
          组织架构筛选
          <ChevronDown className={cn("h-4 w-4 ml-auto transition-transform", orgTreeOpen && "rotate-180")} />
        </button>

        <div
          className={cn(
            "w-full md:w-64 md:block shrink-0 rounded-lg border border-gray-100 bg-white shadow-sm p-4",
            orgTreeOpen ? "block" : "hidden"
          )}
        >
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
            <FolderTree className="h-4 w-4 text-primary" />组织架构
          </h3>
          <ScrollArea className="h-[300px] md:h-[500px]">
            <div className="space-y-1">
              <button
                onClick={() => setSelectedOrgNodeId(null)}
                className={cn(
                  "w-full text-left px-2 py-1.5 text-sm rounded-md transition-colors",
                  selectedOrgNodeId === null ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                )}
              >
                {sidebarAllLabel}
              </button>
              {orgLoading ? (
                <div className="flex items-center gap-2 px-2 py-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> 加载中...
                </div>
              ) : (
                <OrgFilterTree
                  nodes={orgs}
                  orgTypeMap={orgTypeMap}
                  selectedId={selectedOrgNodeId}
                  onSelect={setSelectedOrgNodeId}
                />
              )}
            </div>
          </ScrollArea>
        </div>

        <div className="flex-1 space-y-4 min-w-0">
          <div className="rounded-lg border border-gray-100 bg-white shadow-sm p-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="relative w-full sm:flex-1 sm:max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder={searchPlaceholder}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-lg border border-gray-100 bg-white shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedIds.length === filteredItems.length && filteredItems.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  {renderTableHeader()}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={colSpan + 1} className="text-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                      <p className="mt-2 text-sm text-muted-foreground">加载中...</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {filteredItems.map((item) => (
                      <TableRow key={item.id} className={cn("border-border", "group")}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.includes(item.id)}
                            onCheckedChange={() => toggleSelectItem(item.id)}
                          />
                        </TableCell>
                        {renderTableRow(item, {
                          isChecked: selectedIds.includes(item.id),
                          onToggleCheck: () => toggleSelectItem(item.id),
                          edit: () => onOpenEdit(item),
                          onDelete: () => setDeleteTarget(item.id),
                          onResetPwd: () => setResetTarget({ id: item.id, name: (item as any).name }),
                        })}
                      </TableRow>
                    ))}
                    {filteredItems.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={colSpan + 1} className="text-center text-muted-foreground py-8">
                          {searchTerm ? `未找到匹配的${entityLabel}` : `暂无${entityLabel}数据`}
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm text-muted-foreground">
            <span>
              共 {total} 条记录{selectedIds.length > 0 ? `，已选择 ${selectedIds.length} 条` : ""}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span>
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>{editDialogTitle}</DialogTitle>
            <DialogDescription>{editDialogDescription}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {renderForm()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} disabled={saving}>
              取消
            </Button>
            <Button onClick={() => onFormSave()} disabled={saving || !formValid}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <ImportWizardDialog
        open={isImportDialogOpen}
        onOpenChange={(open) => {
          setIsImportDialogOpen(open)
          if (!open) setImportFiles([])
        }}
        title={`导入${entityLabel}`}
        guideItems={[
          <>点击下方按钮下载最新的导入模板（含系统字典数据）</>,
          <>参照模板中各 Sheet 的填写说明，填入{entityLabel}数据</>,
          <>完成后点击&quot;下一步&quot;上传文件</>,
        ]}
        downloadLabel={`下载${entityLabel}批量导入模板`}
        onDownload={handleDownloadTemplate}
        uploadHint="点击选择已填写的 Excel (.xlsx) 文件"
        importLabel={() => "开始导入"}
        onImport={handleImport}
        files={importFiles}
        onAddFiles={handleAddFiles}
        onRemoveFile={handleRemoveFile}
        importing={isImporting}
        downloading={isDownloading}
      />

      {importPreview && (
        <ImportConfirmDialog
          open={isImportConfirmOpen}
          onOpenChange={setIsImportConfirmOpen}
          entityLabel={entityLabel}
          created={importPreview.created}
          duplicates={importPreview.duplicates}
          failed={importPreview.failed}
          duplicateItems={importPreview.duplicateItems}
          onConfirmOverwrite={() => doImport(true)}
          onConfirmSkip={() => doImport(false)}
        />
      )}

      {/* Batch Join Dialog */}
      <Dialog open={isJoinDialogOpen} onOpenChange={setIsJoinDialogOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>批量加入{joinEntityLabel}</DialogTitle>
            <DialogDescription>
              为选中的 {selectedIds.length} 名{entityLabel}统一关联一个{joinEntityLabel}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>
                目标{joinEntityLabel} <span className="text-destructive">*</span>
              </Label>
              <OrgNodePicker
                value={joinTargetNodeId}
                onChange={(value) => setJoinTargetNodeId(value || "")}
                placeholder={orgNodePickerProps?.placeholder || `选择${joinEntityLabel}`}
                title={orgNodePickerProps?.title || `选择${joinEntityLabel}`}
                selectableTypes={orgNodePickerProps?.selectableTypes}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsJoinDialogOpen(false)} disabled={joinLoading}>
              取消
            </Button>
            <Button onClick={handleBatchJoin} disabled={joinLoading || !joinTargetNodeId}>
              {joinLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              确认加入
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        title="确认删除"
        description={`确定要删除该${entityLabel}吗？此操作不可恢复。`}
        confirmText="删除"
        variant="destructive"
        onConfirm={confirmDelete}
      />

      <ResetPasswordDialog
        open={!!resetTarget}
        onOpenChange={(open) => {
          if (!open) setResetTarget(null)
        }}
        userId={resetTarget?.id}
        userName={resetTarget?.name}
        onSuccess={async () => {
          toast({ title: "密码重置成功" })
          await refetch()
        }}
      />
    </div>
  )
}
