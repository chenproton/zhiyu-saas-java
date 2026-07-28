"use client"

import { useEffect, useState } from "react"
import { userManagementApi } from "@/lib/api"
import type { User } from "@/lib/api"

export function useSubmitterNames() {
  const [userMap, setUserMap] = useState<Map<string, User>>(new Map())
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const res = await userManagementApi.list({ limit: 1000 })
        if (!cancelled) {
          setUserMap(new Map(res.items.map((u) => [u.id, u])))
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const getName = (userId: string) => userMap.get(userId)?.name || userId

  return { userMap, getName, loading }
}
