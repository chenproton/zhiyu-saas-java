"use client"

import { useEffect, useState } from "react"
import { portalRequest } from "@/lib/api"

export function useSubscriptionModules(tenantId?: string): Record<string, boolean> | null {
  const [modules, setModules] = useState<Record<string, boolean> | null>(null)

  useEffect(() => {
    if (!tenantId) {
      setModules(null)
      return
    }

    portalRequest<{ modules?: Record<string, boolean> }>(`/subscriptions?tenantId=${tenantId}`)
      .then((data) => {
        if (data && typeof data.modules === "object") {
          setModules(data.modules)
        } else {
          setModules({})
        }
      })
      .catch(() => {
        setModules({})
      })
  }, [tenantId])

  return modules
}
