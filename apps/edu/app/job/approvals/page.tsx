'use client'

import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/shared/status-badge'
import { positionApi, batchApi } from '@/lib/api'
import type { CareerPosition, JobBatch } from '@/lib/types/job'
import { useApprovals } from '@/hooks/use-approvals'
import { useSubmitterNames } from '@/hooks/use-submitter-names'
import { ApprovalListPage, type ApprovalColumn } from '@/components/shared/approval-list-page'
import type { ApprovalStepInfo } from '@/hooks/use-approvals'
import { reportError } from '@/lib/error-handling'
import { useToast } from '@zhiyu/ui'

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
  stepInfo?: ApprovalStepInfo
  history?: any[]
}

export default function JobApprovalsPage() {
  const { records, loading, approve, reject, batchApprove, batchReject, getStepInfo } =
    useApprovals({ targetType: 'career_position' })
  const { getName } = useSubmitterNames()
  const { toast } = useToast()
  const [positionMap, setPositionMap] = useState<Map<string, CareerPosition>>(new Map())
  const [batchMap, setBatchMap] = useState<Map<string, JobBatch>>(new Map())

  useEffect(() => {
    Promise.all([positionApi.list({ limit: 1000 }), batchApi.list({ limit: 1000 })])
      .then(([posRes, batchRes]) => {
        setPositionMap(new Map(posRes.items.map((p) => [p.id, p])))
        setBatchMap(new Map(batchRes.items.map((b) => [b.id, b])))
      })
      .catch((err) => {
        reportError(err, { source: '加载岗位/批次列表' })
        toast({
          variant: 'destructive',
          title: '加载失败',
          description: err instanceof Error ? err.message : '加载岗位/批次列表失败',
        })
      })
  }, [toast])

  const submitterCol: ApprovalColumn<ApprovalView> = {
    header: '创建人',
    className: 'text-sm text-gray-600 whitespace-nowrap',
    cell: (i) => getName(i.submitterId),
  }

  const columns: ApprovalColumn<ApprovalView>[] = [
    { header: '岗位名称', cell: (i) => <span className="font-medium">{i.positionName}</span> },
    {
      header: '岗位简称',
      cell: (i) => <span className="text-sm text-gray-600">{i.shortName}</span>,
    },
    { header: '版本', className: 'text-center text-sm text-gray-600', cell: (i) => i.version },
    {
      header: '所属批次分组',
      cell: (i) => <span className="text-sm text-gray-600">{i.batchName || '-'}</span>,
    },
    submitterCol,
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
    const position = positionMap.get(a.targetId)
    const batch = position?.batchId ? batchMap.get(position.batchId) : undefined
    return {
      id: a.id,
      positionId: a.targetId,
      positionName: position?.name || a.targetId,
      shortName: position?.shortName || '-',
      version: position?.version || '-',
      batchName: batch?.name,
      submitterId: a.submitterId,
      status: a.status,
      submittedAt: new Date(a.createdAt).toLocaleDateString(),
      stepInfo: getStepInfo(a),
      history: a.history,
    }
  }

  return (
    <ApprovalListPage<ApprovalView>
      entityLabel="岗位"
      pageDescription="审核岗位提交申请，管理审批流程"
      emptyPendingText="所有提交的岗位都已处理完毕"
      records={records}
      loading={loading}
      getStepInfo={getStepInfo}
      onApprove={approve}
      onReject={reject}
      onBatchApprove={batchApprove}
      onBatchReject={batchReject}
      mapRecord={mapRecord}
      detailHref={(item) => `/job/positions/${item.positionId}/edit`}
      columns={columns}
    />
  )
}
