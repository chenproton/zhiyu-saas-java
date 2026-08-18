'use client'

import { useEffect, useState } from 'react'
import { portalRequest } from '@/lib/api'
import { reportError } from '@/lib/error-handling'

export function useSubscriptionModules(tenantId?: string): Record<string, boolean> | null {
  const [modules, setModules] = useState<Record<string, boolean> | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!tenantId) {
        setModules(null)
        return
      }

      try {
        const data = await portalRequest<{ modules?: Record<string, boolean> }>(
          `/subscriptions?tenantId=${tenantId}`,
        )
        if (cancelled) return
        if (data && typeof data.modules === 'object') {
          setModules(data.modules)
        } else {
          setModules({})
        }
      } catch (err) {
        if (cancelled) return
        // 接口失败时保持 null（跳过套餐校验），避免失败态成为最严拦截态隐藏全部菜单
        reportError(err, '加载订阅模块')
        setModules(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [tenantId])

  return modules
}
