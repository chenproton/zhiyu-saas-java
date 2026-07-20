"use client"

import { useEffect, useState } from "react"
import { userManagementApi } from "@/lib/api"
import type { User } from "@/lib/api"

export function useSubmitterNames() {
  const [userMap, setUserMap] = useState<Map<string, User>>(new Map())
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    userManagementApi
      .list({ limit: 1000 })
      .then((res) => {
        setUserMap(new Map(res.items.map((u) => [u.id, u])))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const getName = (userId: string) => userMap.get(userId)?.name || userId

  return { userMap, getName, loading }
}
