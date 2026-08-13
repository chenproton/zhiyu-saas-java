'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { CheckSquare, ChevronDown, Eye } from 'lucide-react'
import { useApprovalDialogs } from '@/components/shared/_components/approval-dialogs'
import { EmptyState, TableEmptyRow } from '@zhiyu/ui'
import type { ApprovalStepInfo } from '@/hooks/use-approvals'
import { useT } from '@/lib/i18n/locale-provider'
import { TableRowActions } from '@/components/shared/table-row-actions'
import type { ApprovalHistoryItem } from '@/lib/types/backend'

export interface ApprovalColumn<T> {
  header: string
  className?: string
  cell: (item: T) => React.ReactNode
}

export interface ApprovalListPageProps<
  T extends { id: string; status: string; stepInfo?: ApprovalStepInfo; history?: ApprovalHistoryItem[] },
> {
  entityLabel: string
  pageDescription: string
  emptyPendingText: string
  emptyProcessedText?: string

  records: any[]
  loading: boolean
  onApprove: (id: string, comment: string) => Promise<void>
  onReject: (id: string, comment: string) => Promise<void>
  onBatchApprove: (ids: string[], comment: string) => Promise<void>
  onBatchReject: (ids: string[], comment: string) => Promise<void>

  mapRecord: (record: any) => T
  detailHref?: (item: T) => string
  columns: ApprovalColumn<T>[]
  /** 可选：待审批按分组展示（返回批次 id，undefined 归入「未关联批次」组） */
  groupOf?: (item: T) => string | undefined
  groupLabelOf?: (key: string | undefined) => string
}

export function ApprovalListPage<
  T extends { id: string; status: string; stepInfo?: ApprovalStepInfo; history?: ApprovalHistoryItem[] },
>({
  entityLabel,
  pageDescription,
  emptyPendingText,
  emptyProcessedText = '暂无已处理记录',
  records,
  loading,
  onApprove,
  onReject,
  onBatchApprove,
  onBatchReject,
  mapRecord,
  detailHref,
  columns,
  groupOf,
  groupLabelOf,
}: ApprovalListPageProps<T>) {
  const t = useT()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [currentItem, setCurrentItem] = useState<T | null>(null)

  const { dialogs, approveAction } = useApprovalDialogs({
    entityLabel,
    stepInfo: currentItem?.stepInfo,
    history: currentItem?.history,
    onApprove: async (comment) => {
      if (currentItem) await onApprove(currentItem.id, comment)
    },
    onReject: async (comment) => {
      if (currentItem) await onReject(currentItem.id, comment)
    },
  })

  const items: T[] = useMemo(() => records.map(mapRecord), [records, mapRecord])

  const pendingItems = useMemo(() => items.filter((a) => a.status === 'pending'), [items])
  const processedItems = useMemo(() => items.filter((a) => a.status !== 'pending'), [items])

  const pendingGroups = useMemo(() => {
    if (!groupOf) return null
    const groupMap = new Map<string | undefined, T[]>()
    pendingItems.forEach((item) => {
      const key = groupOf(item)
      if (!groupMap.has(key)) groupMap.set(key, [])
      groupMap.get(key)!.push(item)
    })
    const keys = [...groupMap.keys()].sort((a, b) => {
      if (a === undefined) return 1
      if (b === undefined) return -1
      const la = groupLabelOf?.(a) || a
      const lb = groupLabelOf?.(b) || b
      return la.localeCompare(lb)
    })
    return keys.map((key) => ({
      key,
      label: key === undefined ? t('未关联批次') : t(groupLabelOf?.(key) || key),
      items: groupMap.get(key)!,
    }))
  }, [pendingItems, groupOf, groupLabelOf, t])

  const selectedPendingIds = useMemo(
    () => pendingItems.filter((i) => selectedIds.has(i.id)).map((i) => i.id),
    [selectedIds, pendingItems],
  )

  const { dialogs: batchDialogs, batchActionButtons } = useApprovalDialogs({
    entityLabel,
    mode: 'batch',
    selectedCount: selectedPendingIds.length,
    onApprove: async (comment) => {
      if (selectedPendingIds.length > 0) {
        await onBatchApprove(selectedPendingIds, comment)
        setSelectedIds(new Set())
      }
    },
    onReject: async (comment) => {
      if (selectedPendingIds.length > 0) {
        await onBatchReject(selectedPendingIds, comment)
        setSelectedIds(new Set())
      }
    },
  })

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = (data: T[]) => {
    const selectableIds = data.filter((i) => i.status === 'pending').map((i) => i.id)
    const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selectedIds.has(id))
    setSelectedIds((prev) => {
      const next = new Set(prev)
      selectableIds.forEach((id) => {
        if (allSelected) next.delete(id)
        else next.add(id)
      })
      return next
    })
  }

  const colSpan = columns.length + 2

  const renderTableBody = (data: T[]) => {
    const selectableIds = data.filter((i) => i.status === 'pending').map((i) => i.id)
    const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selectedIds.has(id))

    return (
      <div className="rounded-lg border border-slate-200 bg-white overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead className="w-12 text-center">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={() => toggleAll(data)}
                  aria-label={t('全选')}
                />
              </TableHead>
              {columns.map((col, i) => (
                <TableHead
                  key={i}
                  className={`text-xs font-medium text-slate-500 whitespace-nowrap ${col.className || ''}`}
                >
                  {t(col.header)}
                </TableHead>
              ))}
              <TableHead className="text-xs font-medium text-slate-500 text-right whitespace-nowrap sticky right-0 bg-slate-50 z-10 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.05)]">
                {t('操作')}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={colSpan} className="text-center py-8 text-gray-500">
                  {t('加载中...')}
                </TableCell>
              </TableRow>
            ) : data.length === 0 ? (
              <TableEmptyRow colSpan={colSpan} className="py-12 text-gray-500">
                {t('暂无数据')}
              </TableEmptyRow>
            ) : (
              data.map((item) => (
                <TableRow key={item.id} className="group">
                  <TableCell className="text-center">
                    <Checkbox
                      checked={selectedIds.has(item.id)}
                      disabled={item.status !== 'pending'}
                      onCheckedChange={() => toggleSelection(item.id)}
                      aria-label={t('选择审批')}
                    />
                  </TableCell>
                  {columns.map((col, i) => (
                    <TableCell key={i} className={col.className || ''}>
                      {col.cell(item)}
                    </TableCell>
                  ))}
                  <TableRowActions className="sticky right-0 bg-white shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.05)]">
                    {detailHref ? (
                      <Button variant="outline" size="sm" asChild>
                        <Link href={detailHref(item)}>
                          <Eye className="mr-1 h-3 w-3" />
                          {t('查看')}
                        </Link>
                      </Button>
                    ) : null}
                    {approveAction ? (
                      <div className="inline-flex" onClick={() => setCurrentItem(item)}>
                        {approveAction(item.status)}
                      </div>
                    ) : null}
                  </TableRowActions>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    )
  }

  const renderTable = (data: T[]) => {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CheckSquare className="h-4 w-4" />
            {t('审批记录列表')}
          </CardTitle>
          <CardDescription>{t('共 {count} 条审批记录', { count: data.length })}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">{renderTableBody(data)}</CardContent>
      </Card>
    )
  }

  const renderPendingGroups = () => {
    if (!pendingGroups || pendingGroups.length === 0) return renderTable(pendingItems)
    return (
      <div className="space-y-4">
        {pendingGroups.map((group) => (
          <Collapsible key={group.key ?? '__unbound__'} defaultOpen>
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <CollapsibleTrigger asChild>
                <div className="flex cursor-pointer items-center justify-between px-4 py-3 bg-slate-50/80 transition-colors hover:bg-slate-50">
                  <div className="flex items-center gap-3">
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                    <span className="font-medium text-gray-800">{group.label}</span>
                    {group.key === undefined && (
                      <Badge variant="outline" className="text-xs text-gray-500">
                        {t('未绑定批次')}
                      </Badge>
                    )}
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {t('{count} 条待审批', { count: group.items.length })}
                  </Badge>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="p-4 pt-0">{renderTableBody(group.items)}</div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        ))}
      </div>
    )
  }

  return (
    <>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{t('审批中心')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t(pageDescription)}</p>
        </div>

        {selectedPendingIds.length > 0 && (
          <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <span className="text-sm text-gray-700">
              {t('已选 {count} 条待审批记录', { count: selectedPendingIds.length })}
            </span>
            <div className="flex items-center gap-3">{batchActionButtons()}</div>
          </div>
        )}

        <Tabs defaultValue="pending" onValueChange={() => setSelectedIds(new Set())}>
          <TabsList>
            <TabsTrigger value="pending" className="gap-2 w-full">
              {t('待审批')}
              {pendingItems.length > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-1 h-5 px-1.5 bg-yellow-100 text-yellow-700"
                >
                  {pendingItems.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="processed" className="w-full">
              {t('已审批')}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="pending" className="mt-6">
            {pendingItems.length > 0 ? (
              renderPendingGroups()
            ) : (
              <Card>
                <EmptyState
                  icon={<CheckSquare className="h-12 w-12 text-gray-300" />}
                  title={t('暂无待审批项')}
                  titleClassName="text-lg font-medium text-gray-700"
                  description={<span className="text-sm text-gray-500">{t(emptyPendingText)}</span>}
                />
              </Card>
            )}
          </TabsContent>
          <TabsContent value="processed" className="mt-6">
            {processedItems.length > 0 ? (
              renderTable(processedItems)
            ) : (
              <Card>
                <EmptyState
                  icon={<CheckSquare className="h-12 w-12 text-gray-300" />}
                  title={t(emptyProcessedText)}
                  titleClassName="text-lg font-medium text-gray-700"
                />
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {dialogs}
        {batchDialogs}
      </div>
    </>
  )
}
