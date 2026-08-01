'use client'

import { useEffect, useState, useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { questionBankApi, examApi, evaluationBatchApi, approvalApi } from '@/lib/api'
import type { QuestionBank, Exam, EvaluationBatch } from '@/lib/types'
import { useApprovals } from '@/hooks/use-approvals'
import { useSubmitterNames } from '@/hooks/use-submitter-names'
import { ApprovalListPage, type ApprovalColumn } from '@/components/shared/approval-list-page'
import type { ApprovalStepInfo } from '@/hooks/use-approvals'
import { StatusBadge } from '@/components/shared/status-badge'
import { toast } from '@zhiyu/ui'
import { reportError } from '@/lib/error-handling'

const TYPE_LABELS: Record<string, string> = {
  question_bank: '题库',
  exam: '试卷',
}

interface ApprovalView {
  id: string
  targetType: 'question_bank' | 'exam'
  targetId: string
  targetName: string
  version: string
  batchName?: string
  submitterId: string
  status: string
  submittedAt: string
  stepInfo?: ApprovalStepInfo
  history?: any[]
}

export default function EvaluationApprovalsPage() {
  const {
    records: bankRecords,
    loading: bankLoading,
    getStepInfo: getBankStepInfo,
    approve: approveBank,
    reject: rejectBank,
    refresh: refreshBank,
  } = useApprovals({ targetType: 'question_bank' })
  const {
    records: examRecords,
    loading: examLoading,
    getStepInfo: getExamStepInfo,
    approve: approveExam,
    reject: rejectExam,
    refresh: refreshExam,
  } = useApprovals({ targetType: 'exam' })
  const { getName } = useSubmitterNames()
  const [bankMap, setBankMap] = useState<Map<string, QuestionBank>>(new Map())
  const [examMap, setExamMap] = useState<Map<string, Exam>>(new Map())
  const [batchMap, setBatchMap] = useState<Map<string, EvaluationBatch>>(new Map())

  useEffect(() => {
    Promise.all([
      questionBankApi.list({ limit: 1000 }),
      examApi.list({ limit: 1000 }),
      evaluationBatchApi.list({ limit: 1000 }),
    ])
      .then(([bankRes, examRes, batchRes]) => {
        setBankMap(new Map(bankRes.items.map((b) => [b.id, b])))
        setExamMap(new Map(examRes.items.map((e) => [e.id, e])))
        setBatchMap(new Map(batchRes.items.map((b) => [b.id, b])))
      })
      .catch((err) => {
        reportError(err, { source: '加载题库/试卷/批次列表' })
        toast({
          variant: 'destructive',
          title: '加载失败',
          description: err instanceof Error ? err.message : '加载题库/试卷/批次列表失败',
        })
      })
  }, [])

  const loading = bankLoading || examLoading

  const allRecords = useMemo(() => [...bankRecords, ...examRecords], [bankRecords, examRecords])

  const getStepInfoFn = (a: any) => {
    // Determine which records array this belongs to
    if (bankRecords.includes(a)) return getBankStepInfo(a)
    return getExamStepInfo(a)
  }

  const columns: ApprovalColumn<ApprovalView>[] = [
    { header: '资源名称', cell: (i) => <span className="font-medium">{i.targetName}</span> },
    {
      header: '类型',
      className: 'text-center',
      cell: (i) => (
        <Badge variant="outline" className="text-xs">
          {TYPE_LABELS[i.targetType]}
        </Badge>
      ),
    },
    { header: '版本', className: 'text-center text-sm text-gray-600', cell: (i) => i.version },
    {
      header: '所属批次分组',
      cell: (i) => <span className="text-sm text-gray-600">{i.batchName || '-'}</span>,
    },
    {
      header: '创建人',
      cell: (i) => <span className="text-sm text-gray-600">{getName(i.submitterId)}</span>,
    },
    {
      header: '提交审批日期',
      cell: (i) => <span className="text-sm text-gray-600">{i.submittedAt}</span>,
    },
    {
      header: '状态',
      className: 'text-center',
      cell: (i) => <StatusBadge status={i.status} />,
    },
    {
      header: '当前步骤',
      className: 'text-center',
      cell: (i) =>
        i.stepInfo ? (
          <Badge variant="outline" className="text-xs">
            {i.stepInfo.currentStepName}
            {i.stepInfo.totalSteps > 1 && (
              <span className="ml-1 text-gray-400">
                ({i.stepInfo.currentStepIndex + 1}/{i.stepInfo.totalSteps})
              </span>
            )}
          </Badge>
        ) : (
          <span className="text-xs text-gray-400">-</span>
        ),
    },
  ]

  const mapRecord = (a: any): ApprovalView => {
    const isBank = bankRecords.includes(a)
    const targetType = isBank ? ('question_bank' as const) : ('exam' as const)
    let targetName = a.targetId
    let version = '-'
    let batchName: string | undefined

    if (isBank) {
      const bank = bankMap.get(a.targetId)
      targetName = bank?.name || a.targetId
      version = bank?.version || '-'
      batchName = bank?.batchId ? batchMap.get(bank.batchId)?.name : undefined
    } else {
      const exam = examMap.get(a.targetId)
      targetName = exam?.name || a.targetId
      batchName = exam?.batchId ? batchMap.get(exam.batchId)?.name : undefined
    }

    return {
      id: a.id,
      targetType,
      targetId: a.targetId,
      targetName,
      version,
      batchName,
      submitterId: a.submitterId,
      status: a.status,
      submittedAt: new Date(a.createdAt).toLocaleDateString(),
      stepInfo: getStepInfoFn(a),
      history: a.history,
    }
  }

  const handleApprove = async (id: string, comment: string) => {
    const record = allRecords.find((r) => r.id === id)
    if (!record) return
    if (bankRecords.includes(record)) await approveBank(id, comment)
    else await approveExam(id, comment)
  }

  const handleReject = async (id: string, comment: string) => {
    const record = allRecords.find((r) => r.id === id)
    if (!record) return
    if (bankRecords.includes(record)) await rejectBank(id, comment)
    else await rejectExam(id, comment)
  }

  const handleBatchReview = async (
    ids: string[],
    status: 'approved' | 'rejected',
    comment?: string,
  ) => {
    if (ids.length === 0) return
    const label = status === 'approved' ? '通过' : '驳回'
    try {
      const results = await Promise.allSettled(
        ids.map((id) => approvalApi.review(id, { status, comment })),
      )
      const success = results.filter((r) => r.status === 'fulfilled').length
      const failed = results.length - success
      if (failed === 0) {
        toast({ title: `批量${label}成功，共 ${success} 条` })
      } else {
        toast({ title: `批量${label}完成，成功 ${success} 条，失败 ${failed} 条` })
      }
      await Promise.all([refreshBank(), refreshExam()])
    } catch (err: any) {
      toast({ title: err.message || `批量${label}失败`, variant: 'destructive' })
    }
  }

  return (
    <ApprovalListPage<ApprovalView>
      entityLabel="测评资源"
      pageDescription="审核题库、试卷提交申请，管理审批流程"
      emptyPendingText="所有提交的测评资源都已处理完毕"
      records={allRecords}
      loading={loading}
      getStepInfo={getStepInfoFn}
      onApprove={handleApprove}
      onReject={handleReject}
      onBatchApprove={(ids, comment) => handleBatchReview(ids, 'approved', comment)}
      onBatchReject={(ids, comment) => handleBatchReview(ids, 'rejected', comment)}
      mapRecord={mapRecord}
      detailHref={(item) =>
        item.targetType === 'question_bank'
          ? `/evaluation/question-banks/${item.targetId}`
          : `/evaluation/exams/${item.targetId}`
      }
      columns={columns}
    />
  )
}
