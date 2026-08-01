'use client'

import { useEffect, useState } from 'react'
import { portalRequest } from '@/lib/api'

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
      } catch {
        if (cancelled) return
        setModules({})
      }
    })()
    return () => {
      cancelled = true
    }
  }, [tenantId])

  return modules
}
