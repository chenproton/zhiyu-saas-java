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

  return { records, loading, approve, reject, refresh }
}
