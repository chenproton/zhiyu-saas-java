"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CheckSquare, Eye } from "lucide-react"
import { useApprovalDialogs } from "@/components/shared/_components/approval-dialogs"
import { TableRowActions } from "@/components/shared/table-row-actions"
import type { ApprovalStepInfo } from "@/hooks/use-approvals"
import { Toaster } from "sonner"

export interface ApprovalColumn<T> {
  header: string
  className?: string
  cell: (item: T) => React.ReactNode
}

export interface ApprovalListPageProps<T extends { id: string; status: string; stepInfo?: ApprovalStepInfo; history?: any[] }> {
  entityLabel: string
  pageDescription: string
  emptyPendingText: string
  emptyProcessedText?: string

  records: any[]
  loading: boolean
  getStepInfo: (record: any) => ApprovalStepInfo | undefined
  onApprove: (id: string, comment: string) => Promise<void>
  onReject: (id: string, comment: string) => Promise<void>
  onBatchApprove: (ids: string[], comment: string) => Promise<void>
  onBatchReject: (ids: string[], comment: string) => Promise<void>

  mapRecord: (record: any) => T
  detailHref: (item: T) => string
  columns: ApprovalColumn<T>[]
}

export function ApprovalListPage<T extends { id: string; status: string; stepInfo?: ApprovalStepInfo; history?: any[] }>({
  entityLabel,
  pageDescription,
  emptyPendingText,
  emptyProcessedText = "暂无已处理记录",
  records,
  loading,
  getStepInfo,
  onApprove,
  onReject,
  onBatchApprove,
  onBatchReject,
  mapRecord,
  detailHref,
  columns,
}: ApprovalListPageProps<T>) {
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

  const pendingItems = useMemo(() => items.filter((a) => a.status === "pending"), [items])
  const processedItems = useMemo(() => items.filter((a) => a.status !== "pending"), [items])

  const selectedPendingIds = useMemo(
    () => pendingItems.filter((i) => selectedIds.has(i.id)).map((i) => i.id),
    [selectedIds, pendingItems]
  )

  const { dialogs: batchDialogs, batchActionButtons } = useApprovalDialogs({
    entityLabel,
    mode: "batch",
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
    const selectableIds = data.filter((i) => i.status === "pending").map((i) => i.id)
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

  const renderTable = (data: T[]) => {
    const selectableIds = data.filter((i) => i.status === "pending").map((i) => i.id)
    const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selectedIds.has(id))

    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CheckSquare className="h-4 w-4" />
            审批记录列表
          </CardTitle>
          <CardDescription>共 {data.length} 条审批记录</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="rounded-lg border border-slate-200 bg-white overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="w-12 text-center">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={() => toggleAll(data)}
                      aria-label="全选"
                    />
                  </TableHead>
                  {columns.map((col, i) => (
                    <TableHead key={i} className={`text-xs font-medium text-slate-500 whitespace-nowrap ${col.className || ""}`}>
                      {col.header}
                    </TableHead>
                  ))}
                  <TableHead className="text-xs font-medium text-slate-500 text-right whitespace-nowrap sticky right-0 bg-slate-50 z-10 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.05)]">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={colSpan} className="text-center py-8 text-gray-500">加载中...</TableCell></TableRow>
                ) : data.length === 0 ? (
                  <TableRow><TableCell colSpan={colSpan} className="text-center py-12 text-gray-500">暂无数据</TableCell></TableRow>
                ) : (
                  data.map((item) => (
                    <TableRow key={item.id} className="group">
                      <TableCell className="text-center">
                        <Checkbox
                          checked={selectedIds.has(item.id)}
                          disabled={item.status !== "pending"}
                          onCheckedChange={() => toggleSelection(item.id)}
                          aria-label={`选择审批`}
                        />
                      </TableCell>
                      {columns.map((col, i) => (
                        <TableCell key={i} className={col.className || ""}>
                          {col.cell(item)}
                        </TableCell>
                      ))}
                      <TableRowActions className="sticky right-0 bg-white shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.05)]">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={detailHref(item)}>
                            <Eye className="mr-1 h-3 w-3" />查看
                          </Link>
                        </Button>
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
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Toaster />
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">审批中心</h1>
          <p className="text-sm text-gray-500 mt-1">{pageDescription}</p>
        </div>

        {selectedPendingIds.length > 0 && (
          <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <span className="text-sm text-gray-700">已选 {selectedPendingIds.length} 条待审批记录</span>
            <div className="flex items-center gap-3">
              {batchActionButtons()}
            </div>
          </div>
        )}

        <Tabs defaultValue="pending" onValueChange={() => setSelectedIds(new Set())}>
          <TabsList>
            <TabsTrigger value="pending" className="gap-2 w-full">
              待审批
              {pendingItems.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 bg-yellow-100 text-yellow-700">
                  {pendingItems.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="processed" className="w-full">已审批</TabsTrigger>
          </TabsList>
          <TabsContent value="pending" className="mt-6">
            {pendingItems.length > 0 ? renderTable(pendingItems) : (
              <Card><CardContent className="py-12 text-center"><CheckSquare className="h-12 w-12 text-gray-300 mx-auto mb-4" /><h3 className="text-lg font-medium text-gray-700">暂无待审批项</h3><p className="text-sm text-gray-500 mt-1">{emptyPendingText}</p></CardContent></Card>
            )}
          </TabsContent>
          <TabsContent value="processed" className="mt-6">
            {processedItems.length > 0 ? renderTable(processedItems) : (
              <Card><CardContent className="py-12 text-center"><CheckSquare className="h-12 w-12 text-gray-300 mx-auto mb-4" /><h3 className="text-lg font-medium text-gray-700">{emptyProcessedText}</h3></CardContent></Card>
            )}
          </TabsContent>
        </Tabs>

        {dialogs}
        {batchDialogs}
      </div>
    </>
  )
}
