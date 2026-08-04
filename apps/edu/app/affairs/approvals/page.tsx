'use client'

import { useCallback, useEffect, useState } from 'react'
import { StatusBadge } from '@/components/shared/status-badge'
import { programApi, batchApi } from '@/lib/api'
import type { TrainingProgram } from '@/lib/types'
import { useApprovals } from '@/hooks/use-approvals'
import { useSubmitterNames } from '@/hooks/use-submitter-names'
import { ApprovalListPage, type ApprovalColumn } from '@/components/shared/approval-list-page'
import type { ApprovalStepInfo } from '@/hooks/use-approvals'
import { reportError } from '@/lib/error-handling'
import { formatDate } from '@/lib/format-utils'
import { useToast } from '@zhiyu/ui'

interface ApprovalView {
  id: string
  programId: string
  programName: string
  batchName?: string
  submitterId: string
  status: string
  submittedAt: string
  stepInfo?: ApprovalStepInfo
  history?: any[]
}

export default function AffairsApprovalsPage() {
  const targetType = 'training_program'
  const { records, loading, approve, reject, batchApprove, batchReject, getStepInfo } =
    useApprovals({ targetType })
  const { getName } = useSubmitterNames()
  const { toast } = useToast()
  const [programMap, setProgramMap] = useState<Map<string, TrainingProgram>>(new Map())
  const [batchMap, setBatchMap] = useState<Map<string, any>>(new Map())

  useEffect(() => {
    Promise.all([programApi.list({ limit: 1000 }), batchApi.list({ limit: 1000 })])
      .then(([pres, bres]) => {
        setProgramMap(new Map(pres.items.map((p) => [p.id, p])))
        setBatchMap(new Map(bres.items.map((b) => [b.id, b])))
      })
      .catch((err) => {
        reportError(err, { source: '加载培养方案/批次列表' })
        toast({
          variant: 'destructive',
          title: '加载失败',
          description: err instanceof Error ? err.message : '加载培养方案/批次列表失败',
        })
      })
  }, [toast])

  const columns: ApprovalColumn<ApprovalView>[] = [
    { header: '方案名称', cell: (i) => <span className="font-medium">{i.programName}</span> },
    {
      header: '所属批次组',
      cell: (i) => <span className="text-sm text-gray-600">{i.batchName || '-'}</span>,
    },
    { header: '创建人', className: 'text-sm text-gray-600', cell: (i) => getName(i.submitterId) },
    {
      header: '提交日期',
      cell: (i) => <span className="text-sm text-gray-600">{i.submittedAt}</span>,
    },
    { header: '状态', className: 'text-center', cell: (i) => <StatusBadge status={i.status} /> },
  ]

  const mapRecord = useCallback(
    (a: any): ApprovalView => {
      const program = programMap.get(a.targetId)
      const batch = program?.batchId ? batchMap.get(program.batchId) : undefined
      return {
        id: a.id,
        programId: a.targetId,
        programName: program?.name || a.targetId,
        batchName: batch?.name,
        submitterId: a.submitterId,
        status: a.status,
        submittedAt: formatDate(a.createdAt),
        stepInfo: getStepInfo(a),
        history: a.history,
      }
    },
    [programMap, batchMap, getStepInfo],
  )

  return (
    <ApprovalListPage<ApprovalView>
      entityLabel="人培方案"
      pageDescription="审核人培方案提交申请"
      emptyPendingText="所有提交都已处理完毕"
      records={records}
      loading={loading}
      onApprove={approve}
      onReject={reject}
      onBatchApprove={batchApprove}
      onBatchReject={batchReject}
      mapRecord={mapRecord}
      columns={columns}
    />
  )
}
