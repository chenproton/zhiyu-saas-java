'use client'

import { useCallback, useEffect, useState, useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { programApi, teachingPlanApi, batchApi, affairsBatchApi, approvalApi } from '@/lib/api'
import { fetchAllPages } from '@/lib/fetch-all'
import type { TrainingProgram, TeachingPlan } from '@/lib/types/affairs'
import type { ApprovalHistoryItem, ApprovalRecord } from '@/lib/types/backend'
import { useApprovals } from '@/hooks/use-approvals'
import { useSubmitterNames } from '@/hooks/use-submitter-names'
import { ApprovalListPage, type ApprovalColumn } from '@/components/shared/approval-list-page'
import type { ApprovalStepInfo } from '@/hooks/use-approvals'
import { handleLoadError } from '@/lib/load-error'
import { formatDate } from '@/lib/format-utils'
import { useToast } from '@zhiyu/ui'
import { StatusBadge } from '@/components/shared/status-badge'
import { useT } from '@/lib/i18n/locale-provider'

const TYPE_LABELS: Record<string, string> = {
  training_program: '人培方案',
  teaching_plan: '教学计划',
}

interface ApprovalView {
  id: string
  targetType: 'training_program' | 'teaching_plan'
  targetId: string
  targetName: string
  batchId?: string
  batchName?: string
  submitterId: string
  status: string
  submittedAt: string
  stepInfo?: ApprovalStepInfo
  history?: ApprovalHistoryItem[]
}

export default function AffairsApprovalsPage() {
  const t = useT()
  const {
    records: programRecords,
    loading: programLoading,
    getStepInfo: getProgramStepInfo,
    approve: approveProgram,
    reject: rejectProgram,
    refresh: refreshProgram,
  } = useApprovals({ targetType: 'training_program' })
  const {
    records: planRecords,
    loading: planLoading,
    getStepInfo: getPlanStepInfo,
    approve: approvePlan,
    reject: rejectPlan,
    refresh: refreshPlan,
  } = useApprovals({ targetType: 'teaching_plan' })
  const { getName } = useSubmitterNames()
  const { toast } = useToast()
  const [programMap, setProgramMap] = useState<Map<string, TrainingProgram>>(new Map())
  const [planMap, setPlanMap] = useState<Map<string, TeachingPlan>>(new Map())
  const [batchMap, setBatchMap] = useState<Map<string, any>>(new Map())
  const [affairsBatchMap, setAffairsBatchMap] = useState<Map<string, any>>(new Map())

  useEffect(() => {
    Promise.all([
      programApi.list({ limit: 1000 }),
      teachingPlanApi.list({ limit: 1000 }),
      fetchAllPages((page, pageSize) => batchApi.list({ limit: pageSize, offset: page * pageSize })),
      affairsBatchApi.list({ limit: 1000 }),
    ])
      .then(([pres, plres, bres, abres]) => {
        setProgramMap(new Map(pres.items.map((p) => [p.id, p])))
        setPlanMap(new Map(plres.items.map((p) => [p.id, p])))
        setBatchMap(new Map(bres.map((b) => [b.id, b])))
        setAffairsBatchMap(new Map(abres.items.map((b) => [b.id, b])))
      })
      .catch((err) => {
        handleLoadError(err, toast, t, '加载培养方案/教学计划/批次列表失败', '{ source: "加载培养方案/教学计划/批次列表" }')
      })
  }, [toast, t])

  const loading = programLoading || planLoading

  const allRecords = useMemo(
    () => [...programRecords, ...planRecords],
    [programRecords, planRecords],
  )

  const getStepInfoFn = useCallback(
    (a: any) => {
      if (programRecords.includes(a)) return getProgramStepInfo(a)
      return getPlanStepInfo(a)
    },
    [programRecords, getProgramStepInfo, getPlanStepInfo],
  )

  const columns: ApprovalColumn<ApprovalView>[] = [
    {
      header: t('类型'),
      className: 'text-center',
      cell: (i) => (
        <Badge variant="outline" className="text-xs">
          {t(TYPE_LABELS[i.targetType] || i.targetType)}
        </Badge>
      ),
    },
    { header: t('名称'), cell: (i) => <span className="font-medium">{i.targetName}</span> },
    {
      header: t('所属批次组'),
      cell: (i) => <span className="text-sm text-gray-600">{i.batchName || '-'}</span>,
    },
    { header: t('创建人'), className: 'text-sm text-gray-600', cell: (i) => getName(i.submitterId) },
    {
      header: t('提交日期'),
      cell: (i) => <span className="text-sm text-gray-600">{i.submittedAt}</span>,
    },
    { header: t('状态'), className: 'text-center', cell: (i) => <StatusBadge status={i.status} /> },
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
    (a: ApprovalRecord): ApprovalView => {
      const isProgram = programRecords.includes(a)
      const targetType = isProgram ? ('training_program' as const) : ('teaching_plan' as const)
      const target = (isProgram ? programMap : planMap).get(a.targetId)
      const batchId = target?.batchId
      const targetName = isProgram
        ? (target as TrainingProgram | undefined)?.name || a.targetId
        : `${(target as TeachingPlan | undefined)?.programName || ''} ${(target as TeachingPlan | undefined)?.termName || ''}`.trim() || a.targetId
      return {
        id: a.id,
        targetType,
        targetId: a.targetId,
        targetName,
        batchId,
        batchName: batchId
          ? (isProgram ? batchMap : affairsBatchMap).get(batchId)?.name
          : undefined,
        submitterId: a.submitterId,
        status: a.status,
        submittedAt: formatDate(a.createdAt),
        stepInfo: getStepInfoFn(a),
        history: a.history,
      }
    },
    [programRecords, programMap, planMap, batchMap, affairsBatchMap, getStepInfoFn],
  )

  const handleApprove = async (id: string, comment: string) => {
    const record = allRecords.find((r) => r.id === id)
    if (!record) return
    if (programRecords.includes(record)) await approveProgram(id, comment)
    else await approvePlan(id, comment)
  }

  const handleReject = async (id: string, comment: string) => {
    const record = allRecords.find((r) => r.id === id)
    if (!record) return
    if (programRecords.includes(record)) await rejectProgram(id, comment)
    else await rejectPlan(id, comment)
  }

  const handleBatchReview = async (
    ids: string[],
    status: 'approved' | 'rejected',
    comment?: string,
  ) => {
    if (ids.length === 0) return
    const label = status === 'approved' ? t('通过') : t('驳回')
    try {
      const results = await Promise.allSettled(
        ids.map((id) => approvalApi.review(id, { status, comment })),
      )
      const success = results.filter((r) => r.status === 'fulfilled').length
      const failed = results.length - success
      if (failed === 0) {
        toast({ title: t('批量{action}成功，共 {n} 条', { action: label, n: success }) })
      } else {
        toast({
          title: t('批量{action}完成，成功 {ok} 条，失败 {fail} 条', {
            action: label,
            ok: success,
            fail: failed,
          }),
        })
      }
      await Promise.all([refreshProgram(), refreshPlan()])
    } catch (err: any) {
      toast({ title: err.message || t('批量{action}失败', { action: label }), variant: 'destructive' })
    }
  }

  return (
    <ApprovalListPage<ApprovalView>
      entityLabel={t('教务资源')}
      pageDescription={t('审核人培方案与教学计划提交申请')}
      emptyPendingText={t('所有提交都已处理完毕')}
      records={allRecords}
      loading={loading}
      onApprove={handleApprove}
      onReject={handleReject}
      onBatchApprove={(ids, comment) => handleBatchReview(ids, 'approved', comment)}
      onBatchReject={(ids, comment) => handleBatchReview(ids, 'rejected', comment)}
      mapRecord={mapRecord}
      detailHref={(item) =>
        item.targetType === 'teaching_plan'
          ? `/affairs/teaching-plans/${item.targetId}`
          : `/affairs/programs/${item.targetId}`
      }
      columns={columns}
      groupOf={(item) => item.batchId}
      groupLabelOf={(key) =>
        key
          ? affairsBatchMap.get(key)?.name || batchMap.get(key)?.name || key
          : t('未关联批次')
      }
    />
  )
}
