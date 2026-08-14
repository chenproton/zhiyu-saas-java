'use client'

import { useState, useEffect, useMemo, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
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
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import {
  OrgFilterTree,
  collectOrgSubtreeIds,
} from '@/components/shared/_components/org-filter-tree'
import { OrgNodePicker } from '@/components/shared/org-node-picker'
import { PaginationBar } from '@/components/shared/pagination-bar'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { ErrorState } from '@/components/shared/error-state'
import { ResetPasswordDialog } from '@/components/shared/reset-password-dialog'
import { ImportConfirmDialog } from '@/components/shared/import-confirm-dialog'
import { ImportWizardDialog } from '@/components/shared/import-wizard-dialog'
import { useToast, TableEmptyRow, FormDialogFooter } from '@zhiyu/ui'
import { useImportFlow, type UseImportFlowOptions } from '@/hooks/use-import-flow'
import { usePortalAuth } from '@/contexts/portal-auth-context'
import type { Organization, OrgType } from '@/lib/types/backend'
import { Upload, Download, FolderTree, Loader2, ChevronDown } from 'lucide-react'
import { useT } from '@/lib/i18n/locale-provider'
import { SearchInput } from '@/components/shared/search-input'

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

  importConfig: Omit<UseImportFlowOptions, 'onSuccess'>
  colSpan: number
  renderTableHeader: () => ReactNode
  renderTableRow: (
    item: T,
    actions: {
      isChecked: boolean
      onToggleCheck: () => void
      edit: () => void
      onDelete: () => void
      onResetPwd: () => void
    },
  ) => ReactNode

  headerActions?: (selectedIds: string[], openJoinDialog: () => void) => ReactNode
  afterImportActions?: (selectedIds: string[], openJoinDialog: () => void) => ReactNode

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
  afterImportActions,
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
  const t = useT()
  const { tenantId } = usePortalAuth()
  const [searchTerm, setSearchTerm] = useState('')

  const [selectedOrgNodeId, setSelectedOrgNodeId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [resetTarget, setResetTarget] = useState<{ id: string; name: string } | null>(null)

  const [isJoinDialogOpen, setIsJoinDialogOpen] = useState(false)
  const [joinTargetNodeId, setJoinTargetNodeId] = useState<string>('')
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
      ;(async () => {
        setIsImportConfirmOpen(true)
      })()
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
      toast({
        variant: 'destructive',
        title: t('请选择目标{joinEntityLabel}', { joinEntityLabel }),
      })
      return
    }
    setJoinLoading(true)
    try {
      await onBatchJoin(joinTargetNodeId, selectedIds)
      toast({
        title: t('已将 {count} 名{entityLabel}加入{joinEntityLabel}', {
          count: selectedIds.length,
          entityLabel,
          joinEntityLabel,
        }),
      })
      setIsJoinDialogOpen(false)
      setJoinTargetNodeId('')
      setSelectedIds([])
      await refetch()
    } catch (err) {
      toast({
        variant: 'destructive',
        title: t('批量加入{joinEntityLabel}失败', { joinEntityLabel }),
        description: err instanceof Error ? err.message : t('未知错误'),
      })
    } finally {
      setJoinLoading(false)
    }
  }

  const [deleting, setDeleting] = useState(false)

  const confirmDelete = async () => {
    if (!deleteTarget || deleting) return
    setDeleting(true)
    try {
      await onDelete(deleteTarget)
      setDeleteTarget(null)
    } catch (err) {
      toast({
        variant: 'destructive',
        title: t('删除失败'),
        description: err instanceof Error ? err.message : t('未知错误'),
      })
      setDeleting(false)
      return
    }
    setDeleting(false)
    // 删除已成功：刷新失败不应误报删除失败
    try {
      await refetch()
    } catch {
      // 静默
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

  const handleExport = async () => {
    try {
      await onExport(selectedIds.length > 0 ? selectedIds : [])
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: t('导出失败'),
        description: err.message || t('导出失败'),
      })
    }
  }

  return (
    <div className="min-h-full">
      <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{t(title)}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {headerActions?.(selectedIds, () => {
            setJoinTargetNodeId('')
            setIsJoinDialogOpen(true)
          })}
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-1" />
            {t('批量导出')}
            {selectedIds.length > 0 ? `(${selectedIds.length})` : ''}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setIsImportDialogOpen(true)}>
            <Upload className="h-4 w-4 mr-1" />
            {t('批量导入')}
          </Button>
          {afterImportActions?.(selectedIds, () => {
            setJoinTargetNodeId('')
            setIsJoinDialogOpen(true)
          })}
          <Button size="sm" onClick={onOpenCreate}>
            <span className="h-4 w-4 mr-1">+</span>
            {createButtonLabel}
          </Button>
        </div>
      </div>

      {error && <ErrorState description={error} onRetry={refetch} />}

      <div className="flex flex-col md:flex-row gap-4 items-start">
        {/* 移动端组织架构开关 */}
        <button
          type="button"
          onClick={() => setOrgTreeOpen((v) => !v)}
          className="md:hidden w-full flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-gray-100 bg-white shadow-sm text-muted-foreground hover:text-foreground"
        >
          <FolderTree className="h-4 w-4 text-primary" />
          {t('组织架构筛选')}
          <ChevronDown
            className={cn('h-4 w-4 ml-auto transition-transform', orgTreeOpen && 'rotate-180')}
          />
        </button>

        <div
          className={cn(
            'w-full md:w-64 md:block shrink-0 rounded-lg border border-gray-100 bg-white shadow-sm p-4',
            orgTreeOpen ? 'block' : 'hidden',
          )}
        >
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
            <FolderTree className="h-4 w-4 text-primary" />
            {t('组织架构')}
          </h3>
          <ScrollArea className="h-[300px] md:h-[500px]">
            <div className="space-y-1">
              <button
                onClick={() => setSelectedOrgNodeId(null)}
                className={cn(
                  'w-full text-left px-2 py-1.5 text-sm rounded-md transition-colors',
                  selectedOrgNodeId === null
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted',
                )}
              >
                {sidebarAllLabel}
              </button>
              {orgLoading ? (
                <div className="flex items-center gap-2 px-2 py-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> {t('加载中...')}
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
              <SearchInput
                wrapperClassName="w-full sm:flex-1 sm:max-w-sm"
                placeholder={searchPlaceholder}
                value={searchTerm}
                onChange={setSearchTerm}
              />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {t(opt.label)}
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
                      // 与 portal-crud-page 一致：部分选中时展示 indeterminate 半选态
                      checked={
                        selectedIds.length > 0 && selectedIds.length < filteredItems.length
                          ? 'indeterminate'
                          : selectedIds.length === filteredItems.length && filteredItems.length > 0
                      }
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
                      <p className="mt-2 text-sm text-muted-foreground">{t('加载中...')}</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {filteredItems.map((item) => (
                      <TableRow key={item.id} className={cn('border-border', 'group')}>
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
                          onResetPwd: () =>
                            setResetTarget({ id: item.id, name: (item as any).name }),
                        })}
                      </TableRow>
                    ))}
                    {filteredItems.length === 0 && (
                      <TableEmptyRow colSpan={colSpan + 1} className="py-8">
                        {searchTerm
                          ? t('未找到匹配的{entityLabel}', { entityLabel })
                          : t('暂无{entityLabel}数据', { entityLabel })}
                      </TableEmptyRow>
                    )}
                  </>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm text-muted-foreground">
            <span>
              {t('共 {total} 条记录', { total })}
              {selectedIds.length > 0
                ? t('，已选择 {count} 条', { count: selectedIds.length })
                : ''}
            </span>
            <PaginationBar page={page} totalPages={totalPages} onPageChange={setPage} />
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
          <form
            onSubmit={(e) => {
              e.preventDefault()
              onFormSave()
            }}
            className="grid gap-4"
          >
            <div className="grid gap-4 py-4">{renderForm()}</div>
            <FormDialogFooter
              onCancel={() => setIsEditDialogOpen(false)}
              confirmText={t('保存')}
              cancelText={t('取消')}
              confirmDisabled={!formValid}
              loading={saving}
            />
          </form>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
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

      {importPreview && (
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

      {/* Batch Join Dialog */}
      <Dialog open={isJoinDialogOpen} onOpenChange={setIsJoinDialogOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>{t('批量加入{joinEntityLabel}', { joinEntityLabel })}</DialogTitle>
            <DialogDescription>
              {t('为选中的 {count} 名{entityLabel}统一关联一个{joinEntityLabel}', {
                count: selectedIds.length,
                entityLabel,
                joinEntityLabel,
              })}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleBatchJoin()
            }}
            className="grid gap-4"
          >
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>
                  {t('目标{joinEntityLabel}', { joinEntityLabel })}{' '}
                  <span className="text-destructive">*</span>
                </Label>
              <OrgNodePicker
                value={joinTargetNodeId}
                onChange={(value) => setJoinTargetNodeId(value || '')}
                tenantId={tenantId}
                placeholder={
                  orgNodePickerProps?.placeholder || t('选择{joinEntityLabel}', { joinEntityLabel })
                }
                title={orgNodePickerProps?.title || t('选择{joinEntityLabel}', { joinEntityLabel })}
                selectableTypes={orgNodePickerProps?.selectableTypes}
              />
            </div>
          </div>
          <FormDialogFooter
            onCancel={() => setIsJoinDialogOpen(false)}
            confirmText={t('确认加入')}
            cancelText={t('取消')}
            confirmDisabled={!joinTargetNodeId}
            loading={joinLoading}
          />
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        title={t('确认删除')}
        description={t('确定要删除该{entityLabel}吗？此操作不可恢复。', { entityLabel })}
        confirmText={deleting ? t('删除中...') : t('删除')}
        variant="destructive"
        pending={deleting}
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
          toast({ title: t('密码重置成功') })
          await refetch()
        }}
      />
    </div>
  )
}
