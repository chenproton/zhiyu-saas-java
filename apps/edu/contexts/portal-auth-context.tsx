"use client"

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react"
import { authApi, removeToken, getToken, type MeResponse } from "@/lib/api"
import type { Organization, Major, Role } from "@/lib/types/backend"
import { checkMenuPermission } from "@/lib/menu-permissions"
import { useSubscriptionModules } from "@/hooks/use-subscription-modules"
import { persistActiveRole, resolveActiveRole } from "@/lib/active-role"

export type PortalUserRole = "school" | "enterprise" | "operator"

interface PortalAuthContextType {
  user?: MeResponse["user"]
  institution?: MeResponse["institution"]
  role?: PortalUserRole
  institutionId?: string

  tenantId?: string
  orgNodeId?: string
  orgNode?: Organization
  majorId?: string
  major?: Major
  permissions?: Record<string, any>
  roles?: Role[]
  activeRole?: Role
  activeRoleCode?: string
  setActiveRole: (roleId: string) => void

  loading: boolean
  error?: string
  refresh: () => Promise<void>
  logout: () => void
  hasPermission: (module: string, page?: string, action?: string) => boolean
  hasMenuPermission: (path: string) => boolean
}

const PortalAuthContext = createContext<PortalAuthContextType>({
  loading: true,
  refresh: async () => {},
  logout: () => {},
  setActiveRole: () => {},
  hasPermission: () => false,
  hasMenuPermission: () => true,
})

export function usePortalAuth() {
  return useContext(PortalAuthContext)
}

export function PortalAuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{
    me?: MeResponse
    loading: boolean
    error?: string
  }>({ loading: true })

  const fetchMe = useCallback(async () => {
    const token = getToken("portal")
    if (!token) {
      setState({ loading: false })
      return
    }

    try {
      const data = await authApi.portalMe()
      setState({
        me: data,
        loading: false,
        error: undefined,
      })
    } catch (err) {
      removeToken("portal")
      setState({
        loading: false,
        error: err instanceof Error ? err.message : "获取用户信息失败",
      })
    }
  }, [])

  useEffect(() => {
    fetchMe()
  }, [fetchMe])

  const logout = useCallback(() => {
    removeToken("portal")
    setState({ loading: false })
    if (typeof window !== "undefined") {
      window.location.href = "/portal/login"
    }
  }, [])

  const refresh = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true }))
    await fetchMe()
  }, [fetchMe])

  const user = state.me?.user
  const role = user?.role as PortalUserRole | undefined
  const roles = state.me?.roles
  const [activeRoleId, setActiveRoleId] = useState<string | undefined>()

  const activeRole = useMemo(() => {
    if (!roles || roles.length === 0) return undefined
    if (activeRoleId) {
      const found = roles.find((r) => r.id === activeRoleId)
      if (found) return found
    }
    return resolveActiveRole(user?.id, roles)
  }, [roles, activeRoleId, user?.id])

  const setActiveRole = useCallback((roleId: string) => {
    if (user) persistActiveRole(user.id, roleId)
    setActiveRoleId(roleId)
    // 整页刷新，保证所有 provider 与页面状态基于新角色重建
    if (typeof window !== "undefined") {
      window.location.reload()
    }
  }, [user])

  // 权限只取当前激活角色：每次仅以一种角色身份使用系统
  const permissions = useMemo(() => {
    if (activeRole?.permissions && typeof activeRole.permissions === "object") {
      return activeRole.permissions as Record<string, any>
    }
    return {}
  }, [activeRole])

  // 租户套餐是页面可见性的上限，与角色菜单权限共同决定最终可见性
  const subscriptionModules = useSubscriptionModules(user?.tenantId)

  const hasPermission = useCallback((module: string, page?: string, action?: string) => {
    const perms = permissions
    if (!perms || Object.keys(perms).length === 0) return false
    if (typeof perms !== "object") return false
    if (perms.admin === true) return true

    const mod = perms[module]
    if (!mod) return false
    if (!page) return true

    const p = mod[page]
    if (!p) return false
    if (!action) return true

    if (Array.isArray(p)) return p.includes(action)
    if (typeof p === "object" && Array.isArray(p.buttons)) return p.buttons.includes(action)
    return false
  }, [permissions])

  const hasMenuPermission = useCallback((path: string) => {
    return checkMenuPermission(permissions?.menus, path, subscriptionModules ?? undefined)
  }, [permissions, subscriptionModules])

  return (
    <PortalAuthContext.Provider
      value={{
        user,
        institution: state.me?.institution,
        role,
        institutionId: user?.institutionId,
        tenantId: user?.tenantId,
        orgNodeId: user?.orgNodeId,
        orgNode: state.me?.orgNode,
        majorId: user?.majorId,
        major: state.me?.major,
        permissions,
        roles,
        activeRole,
        activeRoleCode: activeRole?.code,
        setActiveRole,
        loading: state.loading,
        error: state.error,
        refresh,
        logout,
        hasPermission,
        hasMenuPermission,
      }}
    >
      {children}
    </PortalAuthContext.Provider>
  )
}
