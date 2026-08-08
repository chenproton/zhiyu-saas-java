'use client'

import { useState, useCallback, useEffect } from 'react'
import { approvalApi, workflowApi } from '@/lib/api'
import type { ApprovalRecord, Workflow, WorkflowStep } from '@/lib/types/backend'
import { toast } from '@zhiyu/ui'
import { useT } from '@/lib/i18n/locale-provider'

export interface ApprovalStepInfo {
  currentStepIndex: number
  totalSteps: number
  currentStepName: string
  isFinalStep: boolean
  steps: WorkflowStep[]
}

// 审批无权限时给出明确提示，避免用户误以为系统故障
const PERMISSION_DENIED_HINT = '您暂无权限审批该条记录，请确认自己是当前步骤审批人'

function isApprovalPermissionDenied(err: any): boolean {
  const msg = (err?.message || err?.error || '') as string
  return msg.includes('无权评审此步骤') || msg.includes('permission denied')
}

interface UseApprovalsOptions {
  targetType: string
  limit?: number
}

interface UseApprovalsReturn {
  records: ApprovalRecord[]
  loading: boolean
  approve: (id: string, comment?: string) => Promise<void>
  reject: (id: string, comment?: string) => Promise<void>
  batchApprove: (ids: string[], comment?: string) => Promise<void>
  batchReject: (ids: string[], comment?: string) => Promise<void>
  refresh: () => Promise<void>
  getStepInfo: (record?: ApprovalRecord | null) => ApprovalStepInfo | undefined
}

export function useApprovals({
  targetType,
  limit = 1000,
}: UseApprovalsOptions): UseApprovalsReturn {
  const t = useT()
  const [records, setRecords] = useState<ApprovalRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [workflows, setWorkflows] = useState<Map<string, Workflow>>(new Map())

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const res = await approvalApi.list({ targetType, limit })
      setRecords(res.items)

      const workflowIds = Array.from(
        new Set(
          res.items
            .filter((a) => a.status === 'pending' && a.workflowId)
            .map((a) => a.workflowId as string),
        ),
      )
      if (workflowIds.length > 0) {
        try {
          const wfRes = await workflowApi.list({ limit: 1000 })
          const map = new Map<string, Workflow>()
          wfRes.items.forEach((w) => {
            if (workflowIds.includes(w.id)) map.set(w.id, w)
          })
          setWorkflows(map)
        } catch (_) {
          // 工作流加载失败不影响审批列表
        }
      }
    } catch (err: any) {
      toast({ title: err.message || t('无法获取审批数据'), variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [targetType, limit, t])

  useEffect(() => {
    ;(async () => {
      await refresh()
    })()
  }, [refresh])

  const getStepInfo = useCallback(
    (record?: ApprovalRecord | null): ApprovalStepInfo | undefined => {
      if (!record || record.status !== 'pending') return undefined
      const workflow = record.workflowId ? workflows.get(record.workflowId) : undefined
      const totalSteps = workflow?.steps?.length || 1
      const currentStepIndex = Math.min(record.currentStepIdx, Math.max(0, totalSteps - 1))
      const step = workflow?.steps?.[currentStepIndex]
      return {
        currentStepIndex,
        totalSteps,
        currentStepName: step?.name || t('第 {n} 步', { n: currentStepIndex + 1 }),
        isFinalStep: currentStepIndex >= totalSteps - 1,
        steps: workflow?.steps || [],
      }
    },
    [workflows, t],
  )

  const approve = useCallback(
    async (id: string, comment?: string) => {
      try {
        const result = await approvalApi.review(id, { status: 'approved', comment })
        if (result.status === 'approved') {
          toast({ title: t('审批通过') })
        } else {
          toast({ title: t('审批意见已记录') })
        }
        await refresh()
      } catch (err: any) {
        toast({
          title: isApprovalPermissionDenied(err)
            ? t(PERMISSION_DENIED_HINT)
            : err.message || t('审批失败'),
          variant: 'destructive',
        })
      }
    },
    [refresh, t],
  )

  const reject = useCallback(
    async (id: string, comment?: string) => {
      try {
        const result = await approvalApi.review(id, { status: 'rejected', comment })
        if (result.status === 'rejected') {
          toast({ title: t('已驳回') })
        } else {
          toast({ title: t('驳回意见已记录') })
        }
        await refresh()
      } catch (err: any) {
        toast({
          title: isApprovalPermissionDenied(err)
            ? t(PERMISSION_DENIED_HINT)
            : err.message || t('驳回失败'),
          variant: 'destructive',
        })
      }
    },
    [refresh, t],
  )

  const batchReview = useCallback(
    async (ids: string[], status: 'approved' | 'rejected', comment?: string) => {
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
        } else if (
          failed === results.length &&
          results.every((r) => isApprovalPermissionDenied((r as any).reason))
        ) {
          toast({ title: t(PERMISSION_DENIED_HINT), variant: 'destructive' })
        } else {
          toast({
            title: t('批量{action}完成，成功 {ok} 条，失败 {fail} 条', {
              action: label,
              ok: success,
              fail: failed,
            }),
          })
        }
        await refresh()
      } catch (err: any) {
        toast({ title: err.message || t('批量{action}失败', { action: label }), variant: 'destructive' })
      }
    },
    [refresh, t],
  )

  const batchApprove = useCallback(
    async (ids: string[], comment?: string) => {
      await batchReview(ids, 'approved', comment)
    },
    [batchReview],
  )

  const batchReject = useCallback(
    async (ids: string[], comment?: string) => {
      await batchReview(ids, 'rejected', comment)
    },
    [batchReview],
  )

  return { records, loading, approve, reject, batchApprove, batchReject, refresh, getStepInfo }
}
