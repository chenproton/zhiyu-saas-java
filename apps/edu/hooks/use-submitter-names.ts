'use client'

import { useEffect, useState } from 'react'
import { userManagementApi } from '@/lib/api'
import type { User } from '@/lib/api'

export function useSubmitterNames() {
  const [userMap, setUserMap] = useState<Map<string, User>>(new Map())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await userManagementApi.list({ limit: 1000 })
        if (!cancelled) {
          setUserMap(new Map(res.items.map((u) => [u.id, u])))
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : '获取用户列表失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const getName = (userId: string) => userMap.get(userId)?.name || userId

  return { userMap, getName, loading, error }
}
