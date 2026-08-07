'use client'

import { useEffect, useState, useMemo, type ReactNode } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Search, Plus, Loader2, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@zhiyu/ui'
import { useImportFlow, type UseImportFlowOptions } from '@/hooks/use-import-flow'
import { importExportApi } from '@/lib/api'
import { ImportConfirmDialog } from '@/components/shared/import-confirm-dialog'
import { ImportWizardDialog } from '@/components/shared/import-wizard-dialog'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { ErrorState } from '@/components/shared/error-state'
import { PaginationBar } from '@/components/shared/pagination-bar'
import { useT } from '@/lib/i18n/locale-provider'

export interface PortalStatItem {
  label: string
  value: number
  icon?: ReactNode
  iconClassName?: string
}

export interface PortalRowSelection {
  selectedIds: string[]
  onToggle: (id: string, checked: boolean) => void
  onToggleAll: (checked: boolean) => void
}

export interface PortalPagination {
  page: number
  total: number
  totalPages: number
  onPageChange: (page: number) => void
}

export interface PortalCrudPageConfig<T extends { id: string; enabled?: boolean }> {
  title: string
  description: string
  entityLabel: string
  searchPlaceholder?: string
  createButtonLabel?: string

  items: T[]
  loading: boolean
  error: string | null
  onRetry: () => void

  filterItems?: (items: T[], searchTerm: string) => T[]

  importConfig?: Omit<UseImportFlowOptions, 'onSuccess'>
  colSpan: number
  renderTableHeader?: () => ReactNode
  renderTableRow?: (
    item: T,
    actions: { edit: () => void; delete: () => void; toggle: () => void },
  ) => ReactNode

  createDefault?: () => T
  renderForm?: (item: T, setItem: (item: T) => void) => ReactNode
  createHref?: string

  getDeleteDescription?: (item: T) => ReactNode
  onSave?: (item: T, isEdit: boolean) => Promise<void>
  onDelete?: (item: T) => Promise<void>
  onToggleEnabled?: (item: T) => Promise<void>

  // ── 可选差异点 ────────────────────────────────────────────
  children?: ReactNode
  headerActions?: ReactNode
  afterImportActions?: ReactNode
  hideImport?: boolean
  hideCreate?: boolean
  search?: boolean
  searchRight?: ReactNode
  searchValue?: string
  onSearchChange?: (value: string) => void
  toolbar?: ReactNode
  stats?: PortalStatItem[]
  beforeTable?: ReactNode
  body?: ReactNode
  emptyContent?: ReactNode
  footer?: ReactNode
  pagination?: PortalPagination
  rowSelection?: PortalRowSelection
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
  children,
  headerActions,
  afterImportActions,
  hideImport,
  hideCreate,
  search = true,
  searchRight,
  searchValue,
  onSearchChange,
  toolbar,
  stats,
  beforeTable,
  body,
  emptyContent,
  footer,
  pagination,
  rowSelection,
}: PortalCrudPageConfig<T>) {
  const { toast } = useToast()
  const t = useT()
  const [internalSearch, setInternalSearch] = useState('')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [formItem, setFormItem] = useState<T | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<T | null>(null)
  const [deleting, setDeleting] = useState(false)

  const searchTerm = searchValue ?? internalSearch
  const handleSearchChange = onSearchChange ?? setInternalSearch

  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [isImportConfirmOpen, setIsImportConfirmOpen] = useState(false)

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
    importType: (importConfig?.importType || 'positions') as Parameters<
      typeof importExportApi.downloadTemplate
    >[0],
    entityLabel: importConfig?.entityLabel || entityLabel,
    templateFileName: importConfig?.templateFileName || `${entityLabel}批量导入模板.xlsx`,
    onSuccess: onRetry,
  })

  useEffect(() => {
    if (importPreview) {
      queueMicrotask(() => setIsImportConfirmOpen(true))
    }
  }, [importPreview])

  const filteredItems = useMemo(() => {
    if (!filterItems || !search) return items
    return filterItems(items, searchTerm)
  }, [items, searchTerm, filterItems, search])

  const totalCount = pagination ? pagination.total : filteredItems.length

  const openCreateDialog = () => {
    if (!createDefault) return
    setFormItem(createDefault())
    setIsDialogOpen(true)
  }

  const openEditDialog = (item: T) => {
    if (!createDefault) return
    setFormItem(item)
    setIsDialogOpen(true)
  }

  const handleSave = async () => {
    if (!formItem || !onSave) return
    setSaving(true)
    try {
      await onSave(formItem, !!formItem.id)
      setIsDialogOpen(false)
      await onRetry()
    } catch (err) {
      toast({
        variant: 'destructive',
        title: t('保存失败'),
        description: err instanceof Error ? err.message : t('未知错误'),
      })
    } finally {
      setSaving(false)
    }
  }

  const handleToggleEnabled = async (item: T) => {
    if (!onToggleEnabled) return
    try {
      await onToggleEnabled(item)
      await onRetry()
    } catch (err) {
      toast({
        variant: 'destructive',
        title: t('操作失败'),
        description: err instanceof Error ? err.message : t('未知错误'),
      })
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget || !onDelete) return
    setDeleting(true)
    try {
      await onDelete(deleteTarget)
      toast({ title: t('删除成功') })
      setDeleteTarget(null)
      await onRetry()
    } catch (err) {
      toast({
        variant: 'destructive',
        title: t('删除失败'),
        description: err instanceof Error ? err.message : t('未知错误'),
      })
    } finally {
      setDeleting(false)
    }
  }

  const doImport = async (mode: 'skip' | 'overwrite' | 'new' = 'skip') => {
    const ok = await executeImport(mode)
    if (ok) {
      setIsImportDialogOpen(false)
      setIsImportConfirmOpen(false)
      setImportFiles([])
    }
  }

  const selectionCount = rowSelection ? rowSelection.selectedIds.length : 0
  const allSelected =
    !!rowSelection && filteredItems.length > 0 && selectionCount === filteredItems.length
  const someSelected = !!rowSelection && selectionCount > 0 && !allSelected

  return (
    <div className="min-h-full">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{t(title)}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {headerActions}
          {!hideImport && importConfig && (
            <Button variant="outline" size="sm" onClick={() => setIsImportDialogOpen(true)}>
              <Upload className="h-4 w-4 mr-1" />
              {t('批量导入')}
            </Button>
          )}
          {afterImportActions}
          {!hideCreate && (createHref || createButtonLabel) && (
            <>
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
            </>
          )}
        </div>
      </div>

      {stats && stats.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-lg border border-gray-100 bg-white p-3 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div className="text-xs text-muted-foreground">{t(stat.label)}</div>
                {stat.icon && (
                  <div
                    className={cn(
                      'h-6 w-6 rounded-full flex items-center justify-center',
                      stat.iconClassName || 'bg-primary/5',
                    )}
                  >
                    {stat.icon}
                  </div>
                )}
              </div>
              <div className="mt-1 text-xl font-semibold text-foreground">{stat.value}</div>
            </div>
          ))}
        </div>
      )}

      {toolbar}

      {search && searchPlaceholder && (
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9"
            />
          </div>
          {searchRight}
        </div>
      )}

      {beforeTable}

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {error && !loading && <ErrorState description={error} onRetry={onRetry} />}

      {!loading && !body && (
        <>
          <div className="rounded-lg border border-gray-100 bg-white shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  {rowSelection && (
                    <TableHead className="w-12">
                      <Checkbox
                        checked={someSelected ? 'indeterminate' : allSelected}
                        onCheckedChange={(checked) => rowSelection.onToggleAll(checked === true)}
                      />
                    </TableHead>
                  )}
                  {renderTableHeader?.()}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item) => (
                  <TableRow key={item.id} className="border-border group">
                    {rowSelection && (
                      <TableCell>
                        <Checkbox
                          checked={rowSelection.selectedIds.includes(item.id)}
                          onCheckedChange={(checked) =>
                            rowSelection.onToggle(item.id, checked === true)
                          }
                        />
                      </TableCell>
                    )}
                    {renderTableRow?.(item, {
                      edit: () => openEditDialog(item),
                      delete: () => setDeleteTarget(item),
                      toggle: () => handleToggleEnabled(item),
                    })}
                  </TableRow>
                ))}
                {filteredItems.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={colSpan + (rowSelection ? 1 : 0)}
                      className="text-center text-sm text-muted-foreground py-8"
                    >
                      {emptyContent ?? t('暂无{entityLabel}数据', { entityLabel })}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            {footer ?? (
              <span className="text-sm text-muted-foreground">
                {t('共 {totalCount} 条记录', { totalCount })}
                {selectionCount > 0 ? t('，已选择 {selectionCount} 条', { selectionCount }) : ''}
              </span>
            )}
            {pagination && (
              <PaginationBar
                page={pagination.page}
                totalPages={pagination.totalPages}
                onPageChange={pagination.onPageChange}
              />
            )}
          </div>
        </>
      )}

      {!loading && body}

      {importConfig && (
        <ImportWizardDialog
          open={isImportDialogOpen}
          onOpenChange={(open) => {
            setIsImportDialogOpen(open)
            if (!open) setImportFiles([])
          }}
          title={t('导入{entityLabel}', { entityLabel })}
          guideItems={[
            <>{t('点击下方按钮下载最新的导入模板（含系统字典数据）')}</>,
            <>{t('参照模板中各 Sheet 的填写说明，填入{entityLabel}数据', { entityLabel })}</>,
            <>{t('完成后点击"下一步"上传文件')}</>,
          ]}
          downloadLabel={t('下载{entityLabel}批量导入模板', { entityLabel })}
          onDownload={handleDownloadTemplate}
          uploadHint={t('点击选择已填写的 Excel (.xlsx) 文件')}
          importLabel={() => t('开始导入')}
          onImport={handleImport}
          files={importFiles}
          onAddFiles={handleAddFiles}
          onRemoveFile={handleRemoveFile}
          importing={isImporting}
          downloading={isDownloading}
        />
      )}

      {importConfig && importPreview && (
        <ImportConfirmDialog
          open={isImportConfirmOpen}
          onOpenChange={setIsImportConfirmOpen}
          entityLabel={entityLabel}
          created={importPreview.created}
          duplicates={importPreview.duplicates}
          failed={importPreview.failed}
          duplicateItems={importPreview.duplicateItems}
          onConfirmOverwrite={() => doImport('overwrite')}
          onConfirmSkip={() => doImport('skip')}
          onConfirmNew={() => doImport('new')}
        />
      )}

      {createDefault && renderForm && onSave && (
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {formItem?.id
                  ? t('编辑{entityLabel}', { entityLabel })
                  : t('新增{entityLabel}', { entityLabel })}
              </DialogTitle>
              <DialogDescription>
                {formItem?.id
                  ? t('修改{entityLabel}信息', { entityLabel })
                  : t('添加新{entityLabel}', { entityLabel })}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">{formItem && renderForm(formItem, setFormItem)}</div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={saving}>
                {t('取消')}
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                {t('保存')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {onDelete && (
        <ConfirmDialog
          open={deleteTarget !== null}
          onOpenChange={(open) => {
            if (!open) setDeleteTarget(null)
          }}
          title={t('确认删除')}
          description={deleteTarget ? getDeleteDescription?.(deleteTarget) : ''}
          pending={deleting}
          variant="destructive"
          confirmText={deleting ? t('删除中...') : t('删除')}
          onConfirm={confirmDelete}
        />
      )}

      {children}
    </div>
  )
}
