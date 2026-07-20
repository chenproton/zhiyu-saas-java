"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { usePortalAuth } from "@/contexts/portal-auth-context"
import { portalUserManagementApi, roleApi, type User } from "@/lib/api"
import type { Role } from "@/lib/types/backend"

export interface UsePortalUsersOptions {
  roleCode?: "teacher" | "student"
  search?: string
  status?: string
  page?: number
  pageSize?: number
}

export interface UsePortalUsersResult {
  users: User[]
  roles: Role[]
  roleMap: Map<string, Role>
  total: number
  page: number
  pageSize: number
  loading: boolean
  error?: string
  refetch: () => void
  setPage: (page: number) => void
}

export function usePortalUsers(options: UsePortalUsersOptions = {}): UsePortalUsersResult {
  const { tenantId } = usePortalAuth()
  const [users, setUsers] = useState<User[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(options.page ?? 1)
  const pageSize = options.pageSize ?? 20
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>()
  const [refetchKey, setRefetchKey] = useState(0)

  const refetch = useCallback(() => setRefetchKey((k) => k + 1), [])

  const roleMap = useMemo(() => {
    const map = new Map<string, Role>()
    roles.forEach((r) => map.set(r.id, r))
    return map
  }, [roles])

  useEffect(() => {
    if (!tenantId) return

    let cancelled = false
    setLoading(true)
    setError(undefined)

    async function fetchData() {
      try {
        const rolesRes = await roleApi.list(tenantId ? { tenantId, limit: 1000 } : { limit: 1000 })
        if (cancelled) return
        setRoles(rolesRes.items)

        const usersRes = await portalUserManagementApi.list({
          tenantId,
          ...(options.roleCode ? { roleCode: options.roleCode } : {}),
          ...(options.search ? { search: options.search } : {}),
          ...(options.status ? { status: options.status } : {}),
          limit: pageSize,
          offset: (page - 1) * pageSize,
        })
        if (cancelled) return
        setUsers(usersRes.items)
        setTotal(usersRes.total)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : "加载失败")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchData()
    return () => {
      cancelled = true
    }
  }, [tenantId, options.roleCode, options.search, options.status, page, pageSize, refetchKey])

  return { users, roles, roleMap, total, page, pageSize, loading, error, refetch, setPage }
}
