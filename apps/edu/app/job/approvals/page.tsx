'use client'

import { useCallback, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/shared/status-badge'
import { positionApi, batchApi } from '@/lib/api'
import { fetchAllPages } from '@/lib/fetch-all'
import type { CareerPosition, JobBatch } from '@/lib/types/job'
import { useApprovals } from '@/hooks/use-approvals'
import { useSubmitterNames } from '@/hooks/use-submitter-names'
import { ApprovalListPage, type ApprovalColumn } from '@/components/shared/approval-list-page'
import type { ApprovalStepInfo } from '@/hooks/use-approvals'
import { handleLoadError } from '@/lib/load-error'
import { formatDate } from '@/lib/format-utils'
import { useToast } from '@zhiyu/ui'
import { useT } from '@/lib/i18n/locale-provider'

interface ApprovalView {
  id: string
  positionId: string
  positionName: string
  shortName: string
  version: string
  batchId?: string
  batchName?: string
  submitterId: string
  status: string
  submittedAt: string
  stepInfo?: ApprovalStepInfo
  history?: any[]
}

export default function JobApprovalsPage() {
  const t = useT()
  const { records, loading, approve, reject, batchApprove, batchReject, getStepInfo } =
    useApprovals({ targetType: 'career_position' })
  const { getName } = useSubmitterNames()
  const { toast } = useToast()
  const [positionMap, setPositionMap] = useState<Map<string, CareerPosition>>(new Map())
  const [batchMap, setBatchMap] = useState<Map<string, JobBatch>>(new Map())

  useEffect(() => {
    Promise.all([fetchAllPages((page, pageSize) => positionApi.list({ limit: pageSize, offset: page * pageSize })), fetchAllPages((page, pageSize) => batchApi.list({ limit: pageSize, offset: page * pageSize }))])
      .then(([posRes, batchRes]) => {
        setPositionMap(new Map(posRes.map((p) => [p.id, p])))
        setBatchMap(new Map(batchRes.map((b) => [b.id, b])))
      })
      .catch((err) => {
        handleLoadError(err, toast, t, '加载岗位/批次列表失败', '{ source: "加载岗位/批次列表" }')
      })
  }, [toast, t])

  const submitterCol: ApprovalColumn<ApprovalView> = {
    header: t('创建人'),
    className: 'text-sm text-gray-600 whitespace-nowrap',
    cell: (i) => getName(i.submitterId),
  }

  const columns: ApprovalColumn<ApprovalView>[] = [
    { header: t('岗位名称'), cell: (i) => <span className="font-medium">{i.positionName}</span> },
    {
      header: t('岗位简称'),
      cell: (i) => <span className="text-sm text-gray-600">{i.shortName}</span>,
    },
    { header: t('版本'), className: 'text-center text-sm text-gray-600', cell: (i) => i.version },
    {
      header: t('所属批次分组'),
      cell: (i) => <span className="text-sm text-gray-600">{i.batchName || '-'}</span>,
    },
    submitterCol,
    {
      header: t('提交审批日期'),
      cell: (i) => <span className="text-sm text-gray-600">{i.submittedAt}</span>,
    },
    {
      header: t('状态'),
      className: 'text-center',
      cell: (i) => <StatusBadge status={i.status} />,
    },
    {
      header: t('当前步骤'),
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

  const mapRecord = useCallback(
    (a: any): ApprovalView => {
      const position = positionMap.get(a.targetId)
      const batch = position?.batchId ? batchMap.get(position.batchId) : undefined
      return {
        id: a.id,
        positionId: a.targetId,
        positionName: position?.name || a.targetId,
        shortName: position?.shortName || '-',
        version: position?.version || '-',
        batchId: position?.batchId,
        batchName: batch?.name,
        submitterId: a.submitterId,
        status: a.status,
        submittedAt: formatDate(a.createdAt),
        stepInfo: getStepInfo(a),
        history: a.history,
      }
    },
    [positionMap, batchMap, getStepInfo],
  )

  return (
    <ApprovalListPage<ApprovalView>
      entityLabel={t('岗位')}
      pageDescription={t('审核岗位提交申请，管理审批流程')}
      emptyPendingText={t('所有提交的岗位都已处理完毕')}
      records={records}
      loading={loading}
      onApprove={approve}
      onReject={reject}
      onBatchApprove={batchApprove}
      onBatchReject={batchReject}
      mapRecord={mapRecord}
      detailHref={(item) => `/job/landing/${item.positionId}`}
      columns={columns}
      groupOf={(item) => item.batchId}
      groupLabelOf={(key) => (key ? batchMap.get(key)?.name || key : t('未关联批次'))}
    />
  )
}
