'use client'

import { useEffect, useState } from 'react'
import { userManagementApi } from '@/lib/api'
import { useT } from '@/lib/i18n/locale-provider'
import { fetchAllPages } from '@zhiyu/api-client'
import type { User } from '@/lib/api'

export function useSubmitterNames() {
  const t = useT()
  const [userMap, setUserMap] = useState<Map<string, User>>(new Map())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        // 分页合并全量拉取，避免超过后端 maxPageSize(200) 截断导致姓名回退显示 userId
        const items = await fetchAllPages((page, pageSize) =>
          userManagementApi.list({ limit: pageSize, offset: page * pageSize }),
        )
        if (!cancelled) {
          setUserMap(new Map(items.map((u) => [u.id, u])))
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : t('获取用户列表失败'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [t])

  const getName = (userId: string) => userMap.get(userId)?.name || userId

  return { userMap, getName, loading, error }
}
