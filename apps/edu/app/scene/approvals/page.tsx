'use client'

import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/shared/status-badge'
import { scenarioApi, sceneBatchApi } from '@/lib/api'
import type { Scenario, SceneBatch } from '@/lib/types/scene'
import { useApprovals } from '@/hooks/use-approvals'
import { useSubmitterNames } from '@/hooks/use-submitter-names'
import { ApprovalListPage, type ApprovalColumn } from '@/components/shared/approval-list-page'
import type { ApprovalStepInfo } from '@/hooks/use-approvals'
import { reportError } from '@/lib/error-handling'
import { useToast } from '@zhiyu/ui'

interface ApprovalView {
  id: string
  scenarioId: string
  scenarioName: string
  scenarioCode: string
  version: string
  positionName?: string
  batchName?: string
  submitterId: string
  status: string
  submittedAt: string
  stepInfo?: ApprovalStepInfo
  history?: any[]
}

export default function SceneApprovalsPage() {
  const { records, loading, approve, reject, batchApprove, batchReject, getStepInfo } =
    useApprovals({ targetType: 'scenario' })
  const { getName } = useSubmitterNames()
  const { toast } = useToast()
  const [scenarioMap, setScenarioMap] = useState<Map<string, Scenario>>(new Map())
  const [batchMap, setBatchMap] = useState<Map<string, SceneBatch>>(new Map())

  useEffect(() => {
    Promise.all([scenarioApi.list({ limit: 1000 }), sceneBatchApi.list({ limit: 1000 })])
      .then(([scenarioRes, batchRes]) => {
        setScenarioMap(new Map(scenarioRes.items.map((s) => [s.id, s])))
        setBatchMap(new Map(batchRes.items.map((b) => [b.id, b])))
      })
      .catch((err) => {
        reportError(err, { source: '加载场景/批次列表' })
        toast({
          variant: 'destructive',
          title: '加载失败',
          description: err instanceof Error ? err.message : '加载场景/批次列表失败',
        })
      })
  }, [toast])

  const columns: ApprovalColumn<ApprovalView>[] = [
    { header: '场景名称', cell: (i) => <span className="font-medium">{i.scenarioName}</span> },
    {
      header: '场景编码',
      cell: (i) => <span className="text-sm text-gray-600">{i.scenarioCode}</span>,
    },
    { header: '版本', className: 'text-center text-sm text-gray-600', cell: (i) => i.version },
    {
      header: '所属岗位',
      cell: (i) => <span className="text-sm text-gray-600">{i.positionName || '-'}</span>,
    },
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
    const scenario = scenarioMap.get(a.targetId)
    const batch = scenario?.batchId ? batchMap.get(scenario.batchId) : undefined
    return {
      id: a.id,
      scenarioId: a.targetId,
      scenarioName: scenario?.name || a.targetId,
      scenarioCode: scenario?.code || '-',
      version: scenario?.version || '-',
      positionName:
        scenario?.professionNames?.join('、') || scenario?.careerPositionId || undefined,
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
      entityLabel="场景"
      pageDescription="审核场景提交申请，管理审批流程"
      emptyPendingText="所有提交的场景都已处理完毕"
      records={records}
      loading={loading}
      onApprove={approve}
      onReject={reject}
      onBatchApprove={batchApprove}
      onBatchReject={batchReject}
      mapRecord={mapRecord}
      detailHref={(item) => `/scene/scenarios/${item.scenarioId}/edit`}
      columns={columns}
    />
  )
}
