"use client"

import { useState, useCallback, useEffect } from "react"
import { approvalApi } from "@/lib/api"
import type { ApprovalRecord } from "@/lib/types/backend"
import { toast } from "sonner"

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
}

export function useApprovals({ targetType, limit = 1000 }: UseApprovalsOptions): UseApprovalsReturn {
  const [records, setRecords] = useState<ApprovalRecord[]>([])
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const res = await approvalApi.list({ targetType, limit })
      setRecords(res.items)
    } catch (err: any) {
      toast.error(err.message || "无法获取审批数据")
    } finally {
      setLoading(false)
    }
  }, [targetType, limit])

  useEffect(() => {
    refresh()
  }, [refresh])

  const approve = useCallback(async (id: string, comment?: string) => {
    try {
      const result = await approvalApi.review(id, { status: "approved", comment })
      if (result.status === "approved") {
        toast.success("审批通过")
      } else {
        toast.success("审批意见已记录")
      }
      await refresh()
    } catch (err: any) {
      toast.error(err.message || "审批失败")
    }
  }, [refresh])

  const reject = useCallback(async (id: string, comment?: string) => {
    try {
      const result = await approvalApi.review(id, { status: "rejected", comment })
      if (result.status === "rejected") {
        toast.success("已驳回")
      } else {
        toast.success("驳回意见已记录")
      }
      await refresh()
    } catch (err: any) {
      toast.error(err.message || "驳回失败")
    }
  }, [refresh])

  const batchReview = useCallback(async (ids: string[], status: "approved" | "rejected", comment?: string) => {
    if (ids.length === 0) return
    const label = status === "approved" ? "通过" : "驳回"
    try {
      const results = await Promise.allSettled(
        ids.map((id) => approvalApi.review(id, { status, comment }))
      )
      const success = results.filter((r) => r.status === "fulfilled").length
      const failed = results.length - success
      if (failed === 0) {
        toast.success(`批量${label}成功，共 ${success} 条`)
      } else {
        toast.warning(`批量${label}完成，成功 ${success} 条，失败 ${failed} 条`)
      }
      await refresh()
    } catch (err: any) {
      toast.error(err.message || `批量${label}失败`)
    }
  }, [refresh])

  const batchApprove = useCallback(async (ids: string[], comment?: string) => {
    await batchReview(ids, "approved", comment)
  }, [batchReview])

  const batchReject = useCallback(async (ids: string[], comment?: string) => {
    await batchReview(ids, "rejected", comment)
  }, [batchReview])

  return { records, loading, approve, reject, batchApprove, batchReject, refresh }
}
