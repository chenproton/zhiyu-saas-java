"use client"

import { useEffect, useState, useMemo } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CheckSquare, Eye } from "lucide-react"
import { questionBankApi, examApi, evaluationBatchApi } from "@/lib/api"
import type { QuestionBank, Exam, EvaluationBatch } from "@/lib/types"
import { useApprovals } from "@/hooks/use-approvals"
import { useApprovalDialogs } from "@/components/shared/approval-dialogs"

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  pending: { label: "待审批", className: "bg-yellow-50 text-yellow-600" },
  approved: { label: "已通过", className: "bg-green-50 text-green-600" },
  rejected: { label: "已驳回", className: "bg-red-50 text-red-500" },
}

const TYPE_LABELS: Record<string, string> = {
  question_bank: "题库",
  exam: "试卷",
}

interface ApprovalView {
  id: string
  targetType: "question_bank" | "exam"
  targetId: string
  targetName: string
  version: string
  batchName?: string
  submitterId: string
  status: string
  submittedAt: string
}

export default function EvaluationApprovalsPage() {
  const bankApprovals = useApprovals({ targetType: "question_bank" })
  const examApprovals = useApprovals({ targetType: "exam" })
  const [bankMap, setBankMap] = useState<Map<string, QuestionBank>>(new Map())
  const [examMap, setExamMap] = useState<Map<string, Exam>>(new Map())
  const [batchMap, setBatchMap] = useState<Map<string, EvaluationBatch>>(new Map())

  useEffect(() => {
    Promise.all([
      questionBankApi.list({ limit: 1000 }),
      examApi.list({ limit: 1000 }),
      evaluationBatchApi.list({ limit: 1000 }),
    ]).then(([bankRes, examRes, batchRes]) => {
      setBankMap(new Map(bankRes.items.map((b) => [b.id, b])))
      setExamMap(new Map(examRes.items.map((e) => [e.id, e])))
      setBatchMap(new Map(batchRes.items.map((b) => [b.id, b])))
    }).catch(() => {})
  }, [])

  const { dialogs, approveAction } = useApprovalDialogs({
    entityLabel: "测评资源",
    onApprove: async (comment) => {
      if (!currentItem) return
      if (currentItem.targetType === "question_bank") await bankApprovals.approve(currentItem.id, comment)
      else await examApprovals.approve(currentItem.id, comment)
    },
    onReject: async (comment) => {
      if (!currentItem) return
      if (currentItem.targetType === "question_bank") await bankApprovals.reject(currentItem.id, comment)
      else await examApprovals.reject(currentItem.id, comment)
    },
  })
  const [currentItem, setCurrentItem] = useState<ApprovalView | null>(null)

  const loading = bankApprovals.loading || examApprovals.loading

  const items: ApprovalView[] = useMemo(() => {
    const bankItems: ApprovalView[] = bankApprovals.records.map((a) => {
      const bank = bankMap.get(a.targetId)
      const batch = bank?.batchId ? batchMap.get(bank.batchId) : undefined
      return {
        id: a.id,
        targetType: "question_bank" as const,
        targetId: a.targetId,
        targetName: bank?.name || a.targetId,
        version: bank?.version || "-",
        batchName: batch?.name,
        submitterId: a.submitterId,
        status: a.status,
        submittedAt: new Date(a.createdAt).toLocaleDateString(),
      }
    })
    const examItems: ApprovalView[] = examApprovals.records.map((a) => {
      const exam = examMap.get(a.targetId)
      const batch = exam?.batchId ? batchMap.get(exam.batchId) : undefined
      return {
        id: a.id,
        targetType: "exam" as const,
        targetId: a.targetId,
        targetName: exam?.name || a.targetId,
        version: "-",
        batchName: batch?.name,
        submitterId: a.submitterId,
        status: a.status,
        submittedAt: new Date(a.createdAt).toLocaleDateString(),
      }
    })
    return [...bankItems, ...examItems]
  }, [bankApprovals.records, examApprovals.records, bankMap, examMap, batchMap])

  const pendingItems = items.filter((a) => a.status === "pending")
  const processedItems = items.filter((a) => a.status !== "pending")

  const detailHref = (item: ApprovalView) =>
    item.targetType === "question_bank"
      ? `/evaluation/question-banks/${item.targetId}`
      : `/evaluation/exams/${item.targetId}`

  const renderTable = (data: ApprovalView[]) => (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <CheckSquare className="h-4 w-4" />
          审批记录列表
        </CardTitle>
        <CardDescription>共 {data.length} 条审批记录</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border border-slate-200 bg-white overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="text-xs font-medium text-slate-500 whitespace-nowrap">资源名称</TableHead>
                <TableHead className="text-xs font-medium text-slate-500 text-center whitespace-nowrap">类型</TableHead>
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
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-gray-500">加载中...</TableCell></TableRow>
              ) : data.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-12 text-gray-500">暂无数据</TableCell></TableRow>
              ) : (
                data.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium whitespace-nowrap">{item.targetName}</TableCell>
                    <TableCell className="text-center whitespace-nowrap">
                      <Badge variant="outline" className="text-xs">{TYPE_LABELS[item.targetType]}</Badge>
                    </TableCell>
                    <TableCell className="text-center text-sm text-gray-600 whitespace-nowrap">{item.version}</TableCell>
                    <TableCell className="text-sm text-gray-600 whitespace-nowrap">{item.batchName || "-"}</TableCell>
                    <TableCell className="text-sm text-gray-600 whitespace-nowrap">{item.submitterId}</TableCell>
                    <TableCell className="text-sm text-gray-600 whitespace-nowrap">{item.submittedAt}</TableCell>
                    <TableCell className="text-center whitespace-nowrap">
                      <Badge variant="secondary" className={STATUS_CONFIG[item.status]?.className}>
                        {STATUS_CONFIG[item.status]?.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap sticky right-0 bg-white z-10 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.05)]">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={detailHref(item)}>
                            <Eye className="mr-1 h-3 w-3" />查看
                          </Link>
                        </Button>
                        {approveAction ? (
                          <span onClick={() => setCurrentItem(item)} key={item.id}>
                            {approveAction(item.status)}
                          </span>
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

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-800">审批中心</h1>
        <p className="text-sm text-gray-500 mt-1">审核题库、试卷提交申请，管理审批流程</p>
      </div>

      <Tabs defaultValue="pending">
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
            <Card><CardContent className="py-12 text-center"><CheckSquare className="h-12 w-12 text-gray-300 mx-auto mb-4" /><h3 className="text-lg font-medium text-gray-700">暂无待审批项</h3><p className="text-sm text-gray-500 mt-1">所有提交的测评资源都已处理完毕</p></CardContent></Card>
          )}
        </TabsContent>
        <TabsContent value="processed" className="mt-6">
          {processedItems.length > 0 ? renderTable(processedItems) : (
            <Card><CardContent className="py-12 text-center"><CheckSquare className="h-12 w-12 text-gray-300 mx-auto mb-4" /><h3 className="text-lg font-medium text-gray-700">暂无已处理记录</h3></CardContent></Card>
          )}
        </TabsContent>
      </Tabs>

      {dialogs}
    </div>
  )
}
