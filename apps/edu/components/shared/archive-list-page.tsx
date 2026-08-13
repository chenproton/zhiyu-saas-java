'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import {
  GraduationCap,
  Eye,
  RotateCcw,
  Trash2,
  FolderTree,
  ChevronDown,
} from 'lucide-react'
import { StatusBadge } from '@/components/shared/status-badge'
import { useT } from '@/lib/i18n/locale-provider'
import { TableRowActions } from '@/components/shared/table-row-actions'
import { SearchInput } from '@/components/shared/search-input'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'

export interface ArchiveColumn<T> {
  header: string
  className?: string
  cell: (item: T) => ReactNode
}

export interface ArchiveListPageProps<T extends { id: string; name: string; status: string }> {
  entityLabel: string
  pageTitle: string
  pageDescription: string

  sidebarTitle: string
  sidebarItems: { id: string; name: string }[]
  sidebarSelectedId: string | null
  onSidebarSelect: (id: string | null) => void

  items: T[]
  loading: boolean

  onRestore: (item: T) => Promise<void>
  onDelete?: (item: T) => Promise<void>
  onBatchRestore?: (ids: string[]) => Promise<void>
  onBatchDelete?: (ids: string[]) => Promise<void>

  detailHref: (item: T) => string

  searchPlaceholder: string
  searchValue: string
  onSearchChange: (value: string) => void

  columns: ArchiveColumn<T>[]

  renderStatus?: (item: T) => ReactNode
  emptyMessage?: string
}

export function ArchiveListPage<T extends { id: string; name: string; status: string }>({
  entityLabel,
  pageTitle,
  pageDescription,
  sidebarTitle,
  sidebarItems,
  sidebarSelectedId,
  onSidebarSelect,
  items,
  loading,
  onRestore,
  onDelete,
  onBatchRestore,
  onBatchDelete,
  detailHref,
  searchPlaceholder,
  searchValue,
  onSearchChange,
  columns,
  renderStatus,
  emptyMessage = `暂无归档${entityLabel}`,
}: ArchiveListPageProps<T>) {
  const t = useT()
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [deleteTarget, setDeleteTarget] = useState<T | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const hasBatchOps = !!(onBatchRestore || onBatchDelete)

  const handleSelect = (id: string, checked: boolean) => {
    setSelectedIds((prev) =>
      checked ? (prev.includes(id) ? prev : [...prev, id]) : prev.filter((item) => item !== id),
    )
  }

  const handleSelectAll = (checked: boolean) => {
    setSelectedIds(checked ? items.map((p) => p.id) : [])
  }

  const allSelected = items.length > 0 && items.every((p) => selectedIds.includes(p.id))
  const someSelected = items.some((p) => selectedIds.includes(p.id)) && !allSelected

  const handleBatchRestore = async () => {
    if (!onBatchRestore || selectedIds.length === 0) return
    await onBatchRestore(selectedIds)
    setSelectedIds([])
  }

  const handleBatchDelete = async () => {
    if (!onBatchDelete || selectedIds.length === 0) return
    await onBatchDelete(selectedIds)
    setSelectedIds([])
  }

  const handleRestore = async (item: T) => {
    await onRestore(item)
  }

  const handleDelete = async (item: T) => {
    if (!onDelete) return
    setDeleteTarget(item)
  }

  const confirmDelete = async () => {
    if (!deleteTarget || !onDelete) return
    await onDelete(deleteTarget)
    setSelectedIds((prev) => prev.filter((id) => id !== deleteTarget.id))
    setDeleteTarget(null)
  }

  const colSpan = columns.length + (hasBatchOps ? 2 : 1)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">{t(pageTitle)}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t(pageDescription)}</p>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-start">
        {/* 移动端侧栏折叠开关 */}
        <button
          type="button"
          onClick={() => setSidebarOpen((v) => !v)}
          className="md:hidden w-full flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-gray-100 bg-white shadow-sm text-muted-foreground hover:text-foreground"
        >
          <FolderTree className="h-4 w-4 text-primary" />
          {t(sidebarTitle)}
          <ChevronDown
            className={cn('h-4 w-4 ml-auto transition-transform', sidebarOpen && 'rotate-180')}
          />
        </button>

        <div
          className={cn(
            'w-full md:w-64 md:block shrink-0 rounded-lg border border-gray-100 bg-white shadow-sm p-4',
            sidebarOpen ? 'block' : 'hidden',
          )}
        >
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
            <GraduationCap className="h-4 w-4 text-primary" />
            {t(sidebarTitle)}
          </h3>
          <ScrollArea className="h-[500px]">
            <div className="space-y-1">
              <button
                onClick={() => onSidebarSelect(null)}
                className={cn(
                  'w-full text-left px-2 py-1.5 text-sm rounded-md transition-colors',
                  sidebarSelectedId === null
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted',
                )}
              >
                {t('全部专业')}
              </button>
              {sidebarItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onSidebarSelect(item.id)}
                  className={cn(
                    'w-full text-left px-2 py-1.5 text-sm rounded-md transition-colors',
                    sidebarSelectedId === item.id
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted',
                  )}
                >
                  {item.name}
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>

        <div className="flex-1 min-w-0 space-y-4">
          <div className="rounded-lg border border-gray-100 bg-white shadow-sm p-4">
            <SearchInput
              iconClassName="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"
              placeholder={t(searchPlaceholder)}
              value={searchValue}
              onChange={onSearchChange}
            />
          </div>

          {hasBatchOps && selectedIds.length > 0 && (
            <div className="flex items-center justify-between rounded-lg border border-gray-100 bg-white shadow-sm p-3">
              <span className="text-sm text-muted-foreground">
                {t('已选择 {count} 个{entityLabel}', {
                  count: selectedIds.length,
                  entityLabel: t(entityLabel),
                })}
              </span>
              <div className="flex items-center gap-2">
                {onBatchRestore && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={handleBatchRestore}
                  >
                    <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                    {t('批量恢复')}
                  </Button>
                )}
                {onBatchDelete && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={handleBatchDelete}
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    {t('批量删除')}
                  </Button>
                )}
              </div>
            </div>
          )}

          <div className="rounded-lg border border-gray-100 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <Table className="min-w-[900px] w-full">
                <TableHeader>
                  <TableRow>
                    {hasBatchOps && (
                      <TableHead className="w-10 px-3">
                        <Checkbox
                          checked={someSelected ? 'indeterminate' : allSelected}
                          onCheckedChange={(checked) => handleSelectAll(checked === true)}
                          aria-label={t('全选')}
                        />
                      </TableHead>
                    )}
                    {columns.map((col, i) => (
                      <TableHead key={i} className={col.className}>
                        {t(col.header)}
                      </TableHead>
                    ))}
                    <TableHead className="w-20">{t('状态')}</TableHead>
                    <TableHead className="w-28 text-right px-3">{t('操作')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell
                        colSpan={colSpan}
                        className="text-center py-10 text-muted-foreground"
                      >
                        {t('加载中...')}
                      </TableCell>
                    </TableRow>
                  ) : items.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={colSpan}
                        className="text-center py-10 text-muted-foreground"
                      >
                        {t(emptyMessage)}
                      </TableCell>
                    </TableRow>
                  ) : (
                    items.map((item) => {
                      const isSelected = selectedIds.includes(item.id)
                      return (
                        <TableRow
                          key={item.id}
                          className="group"
                          data-state={isSelected ? 'selected' : undefined}
                        >
                          {hasBatchOps && (
                            <TableCell className="px-3">
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={(checked) =>
                                  handleSelect(item.id, checked === true)
                                }
                                aria-label={t('选择 {name}', { name: item.name })}
                              />
                            </TableCell>
                          )}
                          {columns.map((col, i) => (
                            <TableCell key={i} className={col.className}>
                              {col.cell(item)}
                            </TableCell>
                          ))}
                          <TableCell>
                            {renderStatus ? (
                              renderStatus(item)
                            ) : (
                              <StatusBadge status={item.status} />
                            )}
                          </TableCell>
                          <TableRowActions className="px-3">
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" asChild>
                              <Link href={detailHref(item)}>
                                <Eye className="mr-1 h-3 w-3" />
                                {t('查看')}
                              </Link>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs text-primary hover:text-primary/90"
                              onClick={() => handleRestore(item)}
                            >
                              <RotateCcw className="mr-1 h-3 w-3" />
                              {t('恢复')}
                            </Button>
                            {onDelete && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs text-red-500 hover:text-red-600"
                                onClick={() => handleDelete(item)}
                              >
                                <Trash2 className="mr-1 h-3 w-3" />
                                {t('删除')}
                              </Button>
                            )}
                          </TableRowActions>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        title={t('确认删除')}
        description={
          deleteTarget
            ? t('确定永久删除 "{name}" 吗？此操作不可恢复。', { name: deleteTarget.name })
            : ''
        }
        variant="destructive"
        onConfirm={confirmDelete}
      />
    </div>
  )
}
