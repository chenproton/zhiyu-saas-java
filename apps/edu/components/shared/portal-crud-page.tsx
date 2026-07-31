"use client"

import { useEffect, useState, useMemo, type ReactNode } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Search, Trash2, Plus, Loader2, Upload, FileDown } from "lucide-react"
import { useToast } from "@zhiyu/ui"
import { useImportFlow, type UseImportFlowOptions } from "@/hooks/use-import-flow"
import { ImportConfirmDialog } from "@/components/shared/import-confirm-dialog"
import { TableRowActions } from "@/components/shared/table-row-actions"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"

export interface PortalCrudPageConfig<T extends { id: string; enabled?: boolean }> {
  title: string
  description: string
  entityLabel: string
  searchPlaceholder: string
  createButtonLabel: string

  items: T[]
  loading: boolean
  error: string | null
  onRetry: () => void

  filterItems: (items: T[], searchTerm: string) => T[]

  importConfig: Omit<UseImportFlowOptions, "onSuccess">
  colSpan: number
  renderTableHeader: () => ReactNode
  renderTableRow: (
    item: T,
    actions: { edit: () => void; delete: () => void; toggle: () => void }
  ) => ReactNode

  createDefault: () => T
  renderForm: (item: T, setItem: (item: T) => void) => ReactNode
  createHref?: string

  getDeleteDescription: (item: T) => ReactNode
  onSave: (item: T, isEdit: boolean) => Promise<void>
  onDelete: (item: T) => Promise<void>
  onToggleEnabled: (item: T) => Promise<void>
}

export function PortalCrudPage<T extends { id: string; enabled?: boolean }>({
  title,
  description,
  entityLabel,
  searchPlaceholder,
  createButtonLabel,
  items,
  loading,
  error,
  onRetry,
  filterItems,
  importConfig,
  colSpan,
  renderTableHeader,
  renderTableRow,
  createDefault,
  renderForm,
  getDeleteDescription,
  onSave,
  onDelete,
  onToggleEnabled,
  createHref,
}: PortalCrudPageConfig<T>) {
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [formItem, setFormItem] = useState<T | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<T | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [importStep, setImportStep] = useState<"download" | "upload">("download")
  const [isImportConfirmOpen, setIsImportConfirmOpen] = useState(false)

  const {
    fileInputRef,
    importFiles,
    setImportFiles,
    isImporting,
    isDownloading,
    importPreview,
    handleAddFiles,
    handleImport,
    executeImport,
    handleDownloadTemplate,
  } = useImportFlow({
    ...importConfig,
    onSuccess: onRetry,
  })

  useEffect(() => {
    if (importPreview) {
      queueMicrotask(() => setIsImportConfirmOpen(true))
    }
  }, [importPreview])

  const filteredItems = useMemo(
    () => filterItems(items, searchTerm),
    [items, searchTerm, filterItems]
  )

  const openCreateDialog = () => {
    setFormItem(createDefault())
    setIsDialogOpen(true)
  }

  const openEditDialog = (item: T) => {
    setFormItem(item)
    setIsDialogOpen(true)
  }

  const handleSave = async () => {
    if (!formItem) return
    setSaving(true)
    try {
      await onSave(formItem, !!formItem.id)
      setIsDialogOpen(false)
      await onRetry()
    } catch (err) {
      toast({
        variant: "destructive",
        title: "保存失败",
        description: err instanceof Error ? err.message : "未知错误",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleToggleEnabled = async (item: T) => {
    try {
      await onToggleEnabled(item)
      await onRetry()
    } catch (err) {
      toast({
        variant: "destructive",
        title: "操作失败",
        description: err instanceof Error ? err.message : "未知错误",
      })
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await onDelete(deleteTarget)
      toast({ title: "删除成功" })
      setDeleteTarget(null)
      await onRetry()
    } catch (err) {
      toast({
        variant: "destructive",
        title: "删除失败",
        description: err instanceof Error ? err.message : "未知错误",
      })
    } finally {
      setDeleting(false)
    }
  }

  const doImport = async (overwrite = false) => {
    const ok = await executeImport(overwrite)
    if (ok) {
      setIsImportDialogOpen(false)
      setImportStep("download")
      setIsImportConfirmOpen(false)
    }
  }

  const doHandleImport = async () => {
    const ok = await handleImport()
    if (ok) {
      setIsImportDialogOpen(false)
      setImportStep("download")
      setIsImportConfirmOpen(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 min-h-full">
      <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setIsImportDialogOpen(true)}>
            <Upload className="h-4 w-4 mr-1" />
            导入
          </Button>
          {createHref ? (
            <Link href={createHref}>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                {createButtonLabel}
              </Button>
            </Link>
          ) : (
            <Button size="sm" onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-1" />
              {createButtonLabel}
            </Button>
          )}
        </div>
      </div>

      <div className="mb-4">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {error && !loading && (
        <div className="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {!loading && (
        <>
          <div className="rounded-lg border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  {renderTableHeader()}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item) => (
                  <TableRow key={item.id} className="border-border group">
                    {renderTableRow(item, {
                      edit: () => openEditDialog(item),
                      delete: () => setDeleteTarget(item),
                      toggle: () => handleToggleEnabled(item),
                    })}
                  </TableRow>
                ))}
                {filteredItems.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={colSpan} className="text-center text-sm text-muted-foreground py-8">
                      暂无{entityLabel}数据
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 text-sm text-muted-foreground">共 {filteredItems.length} 条记录</div>
        </>
      )}

      {/* Import Dialog */}
      <Dialog
        open={isImportDialogOpen}
        onOpenChange={(open) => {
          setIsImportDialogOpen(open)
          if (!open) {
            setImportStep("download")
            setImportFiles([])
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>导入{entityLabel}</DialogTitle>
            <DialogDescription>
              第 {importStep === "download" ? "1" : "2"} 步：
              {importStep === "download" ? "下载模板并填写数据" : "上传已填写的 Excel 文件"}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {importStep === "download" ? (
              <div className="space-y-4">
                <div className="rounded-lg border bg-muted/30 p-4">
                  <p className="text-sm font-medium mb-2">操作指引</p>
                  <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                    <li>点击下方按钮下载最新的导入模板（含系统字典数据）</li>
                    <li>参照模板中各 Sheet 的填写说明，填入{entityLabel}数据</li>
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
                  {isDownloading ? "下载中..." : `下载${entityLabel}批量导入模板`}
                </Button>
              </div>
            ) : (
              <div
                className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground mb-2">
                  {importFiles.length > 0 ? importFiles.map(f => f.name).join(", ") : "点击选择已填写的 Excel (.xlsx) 文件"}
                </p>
                <p className="text-xs text-muted-foreground">仅支持 .xlsx 格式</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx"
                  multiple
                  className="hidden"
                  onChange={(e) => handleAddFiles(e.target.files)}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsImportDialogOpen(false)
                setImportStep("download")
                setImportFiles([])
              }}
            >
              取消
            </Button>
            {importStep === "download" ? (
              <Button onClick={() => setImportStep("upload")}>下一步</Button>
            ) : (
              <Button onClick={doHandleImport} disabled={importFiles.length === 0 || isImporting}>
                {isImporting ? "导入中..." : "开始导入"}
              </Button>
            )}
            {importStep === "upload" && (
              <Button variant="ghost" size="sm" onClick={() => setImportStep("download")}>
                上一步
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{formItem?.id ? `编辑${entityLabel}` : `新增${entityLabel}`}</DialogTitle>
            <DialogDescription>
              {formItem?.id ? `修改${entityLabel}信息` : `添加新${entityLabel}`}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {formItem && renderForm(formItem, setFormItem)}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={saving}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
        title="确认删除"
        description={deleteTarget ? getDeleteDescription(deleteTarget) : ""}
        variant="destructive"
        confirmText={deleting ? "删除中..." : "删除"}
        onConfirm={confirmDelete}
      />
    </div>
  )
}
