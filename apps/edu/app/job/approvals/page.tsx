"use client"

import { useEffect, useState, useMemo } from "react"
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
import { positionApi, batchApi } from "@/lib/api"
import type { CareerPosition, JobBatch } from "@/lib/types/job"
import { useApprovals } from "@/hooks/use-approvals"
import { useSubmitterNames } from "@/hooks/use-submitter-names"
import { useApprovalDialogs } from "@/components/shared/approval-dialogs"
import { Toaster } from "sonner"

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  pending: { label: "待审批", className: "bg-yellow-50 text-yellow-600" },
  approved: { label: "已通过", className: "bg-green-50 text-green-600" },
  rejected: { label: "已驳回", className: "bg-red-50 text-red-500" },
}

interface ApprovalView {
  id: string
  positionId: string
  positionName: string
  shortName: string
  version: string
  batchName?: string
  submitterId: string
  status: string
  submittedAt: string
}

export default function JobApprovalsPage() {
  const { records, loading, approve, reject, batchApprove, batchReject } = useApprovals({ targetType: "career_position" })
  const { getName } = useSubmitterNames()
  const [positionMap, setPositionMap] = useState<Map<string, CareerPosition>>(new Map())
  const [batchMap, setBatchMap] = useState<Map<string, JobBatch>>(new Map())
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    Promise.all([positionApi.list({ limit: 1000 }), batchApi.list({ limit: 1000 })]).then(
      ([posRes, batchRes]) => {
        setPositionMap(new Map(posRes.items.map((p) => [p.id, p])))
        setBatchMap(new Map(batchRes.items.map((b) => [b.id, b])))
      }
    ).catch(() => {})
  }, [])

  const [currentItem, setCurrentItem] = useState<ApprovalView | null>(null)

  const { dialogs, approveAction } = useApprovalDialogs({
    entityLabel: "岗位",
    onApprove: async (comment) => {
      if (currentItem) await approve(currentItem.id, comment)
    },
    onReject: async (comment) => {
      if (currentItem) await reject(currentItem.id, comment)
    },
  })

  const items: ApprovalView[] = useMemo(() =>
    records.map((a) => {
      const position = positionMap.get(a.targetId)
      const batch = position?.batchId ? batchMap.get(position.batchId) : undefined
      return {
        id: a.id,
        positionId: a.targetId,
        positionName: position?.name || a.targetId,
        shortName: position?.shortName || "-",
        version: position?.version || "-",
        batchName: batch?.name,
        submitterId: a.submitterId,
        status: a.status,
        submittedAt: new Date(a.createdAt).toLocaleDateString(),
      }
    }),
    [records, positionMap, batchMap]
  )

  const selectedPendingIds = useMemo(
    () => items.filter((i) => selectedIds.has(i.id) && i.status === "pending").map((i) => i.id),
    [selectedIds, items]
  )

  const { dialogs: batchDialogs, batchActionButtons } = useApprovalDialogs({
    entityLabel: "岗位",
    mode: "batch",
    selectedCount: selectedPendingIds.length,
    onApprove: async (comment) => {
      if (selectedPendingIds.length > 0) {
        await batchApprove(selectedPendingIds, comment)
        setSelectedIds(new Set())
      }
    },
    onReject: async (comment) => {
      if (selectedPendingIds.length > 0) {
        await batchReject(selectedPendingIds, comment)
        setSelectedIds(new Set())
      }
    },
  })

  const pendingItems = items.filter((a) => a.status === "pending")
  const processedItems = items.filter((a) => a.status !== "pending")

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = (data: ApprovalView[]) => {
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

  const renderTable = (data: ApprovalView[]) => {
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
                  <TableHead className="text-xs font-medium text-slate-500 whitespace-nowrap">岗位名称</TableHead>
                  <TableHead className="text-xs font-medium text-slate-500 whitespace-nowrap">岗位简称</TableHead>
                  <TableHead className="text-xs font-medium text-slate-500 text-center whitespace-nowrap">版本</TableHead>
                  <TableHead className="text-xs font-medium text-slate-500 whitespace-nowrap">所属批次分组</TableHead>
                  <TableHead className="text-xs font-medium text-slate-500 whitespace-nowrap">创建人</TableHead>
                  <TableHead className="text-xs font-medium text-slate-500 whitespace-nowrap">提交审批日期</TableHead>
                  <TableHead className="text-xs font-medium text-slate-500 text-center whitespace-nowrap">状态</TableHead>
                  <TableHead className="text-xs font-medium text-slate-500 text-right whitespace-nowrap sticky right-0 bg-slate-50 z-10 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.05)]">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-gray-500">加载中...</TableCell></TableRow>
                ) : data.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-12 text-gray-500">暂无数据</TableCell></TableRow>
                ) : (
                  data.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={selectedIds.has(item.id)}
                          disabled={item.status !== "pending"}
                          onCheckedChange={() => toggleSelection(item.id)}
                          aria-label={`选择审批 ${item.positionName}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium whitespace-nowrap">{item.positionName}</TableCell>
                      <TableCell className="text-sm text-gray-600 whitespace-nowrap">{item.shortName}</TableCell>
                      <TableCell className="text-center text-sm text-gray-600 whitespace-nowrap">{item.version}</TableCell>
                      <TableCell className="text-sm text-gray-600 whitespace-nowrap">{item.batchName || "-"}</TableCell>
                      <TableCell className="text-sm text-gray-600 whitespace-nowrap">{getName(item.submitterId)}</TableCell>
                      <TableCell className="text-sm text-gray-600 whitespace-nowrap">{item.submittedAt}</TableCell>
                      <TableCell className="text-center whitespace-nowrap">
                        <Badge variant="secondary" className={STATUS_CONFIG[item.status]?.className}>
                          {STATUS_CONFIG[item.status]?.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap sticky right-0 bg-white z-10 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.05)]">
                        <div className="flex items-center justify-end gap-3">
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/job/positions/${item.positionId}/edit`}>
                              <Eye className="mr-1 h-3 w-3" />查看
                            </Link>
                          </Button>
                          {approveAction ? (
                            <div className="inline-flex" onClick={() => setCurrentItem(item)}>
                              {approveAction(item.status)}
                            </div>
                          ) : null}
                        </div>
                      </TableCell>
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
          <p className="text-sm text-gray-500 mt-1">审核岗位提交申请，管理审批流程</p>
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
              <Card><CardContent className="py-12 text-center"><CheckSquare className="h-12 w-12 text-gray-300 mx-auto mb-4" /><h3 className="text-lg font-medium text-gray-700">暂无待审批项</h3><p className="text-sm text-gray-500 mt-1">所有提交的岗位都已处理完毕</p></CardContent></Card>
            )}
          </TabsContent>
          <TabsContent value="processed" className="mt-6">
            {processedItems.length > 0 ? renderTable(processedItems) : (
              <Card><CardContent className="py-12 text-center"><CheckSquare className="h-12 w-12 text-gray-300 mx-auto mb-4" /><h3 className="text-lg font-medium text-gray-700">暂无已处理记录</h3></CardContent></Card>
            )}
          </TabsContent>
        </Tabs>

        {dialogs}
        {batchDialogs}
      </div>
    </>
  )
}
