'use client'

import { useCallback, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/shared/status-badge'
import { scenarioApi, sceneBatchApi } from '@/lib/api'
import type { Scenario, SceneBatch } from '@/lib/types/scene'
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
  scenarioId: string
  scenarioName: string
  scenarioCode: string
  version: string
  positionName?: string
  batchId?: string
  batchName?: string
  submitterId: string
  status: string
  submittedAt: string
  stepInfo?: ApprovalStepInfo
  history?: any[]
}

export default function SceneApprovalsPage() {
  const t = useT()
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
        handleLoadError(err, toast, t, '加载场景/批次列表失败', '{ source: "加载场景/批次列表" }')
      })
  }, [toast, t])

  const columns: ApprovalColumn<ApprovalView>[] = [
    { header: t('场景名称'), cell: (i) => <span className="font-medium">{i.scenarioName}</span> },
    {
      header: t('场景编码'),
      cell: (i) => <span className="text-sm text-gray-600">{i.scenarioCode}</span>,
    },
    { header: t('版本'), className: 'text-center text-sm text-gray-600', cell: (i) => i.version },
    {
      header: t('所属岗位'),
      cell: (i) => <span className="text-sm text-gray-600">{i.positionName || '-'}</span>,
    },
    {
      header: t('所属批次分组'),
      cell: (i) => <span className="text-sm text-gray-600">{i.batchName || '-'}</span>,
    },
    {
      header: t('创建人'),
      cell: (i) => <span className="text-sm text-gray-600">{getName(i.submitterId)}</span>,
    },
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
        batchId: scenario?.batchId,
        batchName: batch?.name,
        submitterId: a.submitterId,
        status: a.status,
        submittedAt: formatDate(a.createdAt),
        stepInfo: getStepInfo(a),
        history: a.history,
      }
    },
    [scenarioMap, batchMap, getStepInfo],
  )

  return (
    <ApprovalListPage<ApprovalView>
      entityLabel={t('场景')}
      pageDescription={t('审核场景提交申请，管理审批流程')}
      emptyPendingText={t('所有提交的场景都已处理完毕')}
      records={records}
      loading={loading}
      onApprove={approve}
      onReject={reject}
      onBatchApprove={batchApprove}
      onBatchReject={batchReject}
      mapRecord={mapRecord}
      detailHref={(item) => `/scene/landing/${item.scenarioId}`}
      columns={columns}
      groupOf={(item) => item.batchId}
      groupLabelOf={(key) => (key ? batchMap.get(key)?.name || key : t('未关联批次'))}
    />
  )
}
