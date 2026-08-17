'use client'

import { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { authApi, getToken, removeToken, type MeResponse } from '@/lib/api'
import type { Organization, Major, Role } from '@/lib/types/backend'
import { checkMenuPermission } from '@/lib/menu-permissions'
import { useSubscriptionModules } from '@/hooks/use-subscription-modules'
import { persistActiveRole, resolveActiveRole } from '@/lib/active-role'
import { useRegisterAllianceDicts } from '@/lib/alliance-dicts'
import { isPublicPage } from '@/lib/public-routes'
import { useT } from '@/lib/i18n/locale-provider'

export type UserRole = 'school' | 'enterprise' | 'operator'

interface AuthContextType {
  user?: MeResponse['user']
  institution?: MeResponse['institution']
  tenant?: MeResponse['tenant']
  role?: UserRole
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
  subscriptionModules: Record<string, boolean> | null
}

const AuthContext = createContext<AuthContextType>({
  loading: true,
  refresh: async () => {},
  logout: () => {},
  setActiveRole: () => {},
  hasPermission: () => false,
  hasMenuPermission: () => true,
  subscriptionModules: null,
})

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const t = useT()
  // 登录态请求序号
  const meSeqRef = useRef(0)
  const [state, setState] = useState<{
    me?: MeResponse
    loading: boolean
    error?: string
  }>({ loading: true })

  const fetchMe = useCallback(async () => {
    // 请求序号：pathname 变化触发重取时丢弃过期响应
    const seq = ++meSeqRef.current
    // 公共页面（如 /changelog）不获取登录态：未登录不触发请求，失效 token 也不会被 401 跳转
    if (isPublicPage(pathname)) {
      setState({ loading: false })
      return
    }
    // edu 应用（管理后台）所有页面都面向 portal 用户（学校/教师/学生），
    // 因此统一使用 portal token，避免 /portal 登录后跳转到 /job、/scene 等模块时因 token 不一致被踢回登录页。
    const token = getToken('portal')
    if (!token) {
      setState({ loading: false })
      return
    }

    try {
      const data = await authApi.portalMe()
      if (seq !== meSeqRef.current) return
      setState({
        me: data,
        loading: false,
        error: undefined,
      })
    } catch (err) {
      if (seq !== meSeqRef.current) return
      // 仅鉴权类错误（401/403）清除登录态；网络抖动/服务端瞬时错误保留 token，避免误踢登录
      const status = (err as { status?: number })?.status
      if (status === 401 || status === 403) removeToken('portal')
      setState({
        loading: false,
        error: err instanceof Error ? err.message : t('获取用户信息失败'),
      })
    }
  }, [pathname, t])

  useEffect(() => {
    ;(async () => {
      await fetchMe()
    })()
  }, [fetchMe])

  const logout = useCallback(() => {
    removeToken('portal')
    setState({ me: undefined, loading: false })
    if (typeof window !== 'undefined') {
      window.location.href = '/portal/login'
    }
  }, [])

  const refresh = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true }))
    await fetchMe()
  }, [fetchMe])

  const user = state.me?.user
  const role = user?.role as UserRole | undefined
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

  const setActiveRole = useCallback(
    (roleId: string) => {
      if (user) persistActiveRole(user.id, roleId)
      setActiveRoleId(roleId)
      // 整页刷新，保证所有 provider 与页面状态基于新角色重建
      if (typeof window !== 'undefined') {
        window.location.reload()
      }
    },
    [user],
  )

  // Merge permissions from all roles into a single object.
  // 权限只取当前激活角色：每次仅以一种角色身份使用系统
  const permissions = useMemo(() => {
    if (activeRole?.permissions && typeof activeRole.permissions === 'object') {
      return activeRole.permissions as Record<string, any>
    }
    return {}
  }, [activeRole])

  // 租户套餐是页面可见性的上限，与角色菜单权限共同决定最终可见性
  const subscriptionModules = useSubscriptionModules(user?.tenantId)

  const hasPermission = useCallback(
    (module: string, page?: string, action?: string) => {
      const perms = permissions
      if (!perms || Object.keys(perms).length === 0) return false
      if (typeof perms !== 'object') return false
      if (perms.admin === true) return true

      const mod = perms[module]
      if (!mod) return false
      if (!page) return true

      const p = mod[page]
      if (!p) return false
      if (!action) return true

      if (Array.isArray(p)) return p.includes(action)
      if (typeof p === 'object' && Array.isArray(p.buttons)) return p.buttons.includes(action)
      return false
    },
    [permissions],
  )

  const hasMenuPermission = useCallback(
    (path: string) => {
      // 菜单驱动 RBAC（ADR-0008）语义与后端菜单中间件对齐：
      // school_admin/platform_admin 在「未显式配置 menus」时全量放行（与后端
      // 「无 menus=全量」兜底一致，roles 页对超管回显全选）；一旦显式配置了 menus
      // 则按菜单判定（配置成与教师一致则权限一致）。
      const code = activeRole?.code
      const menus = permissions?.menus
      const hasExplicitMenus =
        menus != null && typeof menus === 'object' && Object.keys(menus as object).length > 0
      if ((code === 'school_admin' || code === 'platform_admin') && !hasExplicitMenus) return true
      return checkMenuPermission(permissions?.menus, path, subscriptionModules ?? undefined)
    },
    [permissions, subscriptionModules, activeRole?.code],
  )

  const contextValue = useMemo(
    () => ({
      user,
      institution: state.me?.institution,
      tenant: state.me?.tenant,
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
      subscriptionModules,
    }),
    [
      user,
      state,
      role,
      permissions,
      roles,
      activeRole,
      setActiveRole,
      refresh,
      logout,
      hasPermission,
      hasMenuPermission,
      subscriptionModules,
    ],
  )

  return (
    <AuthContext.Provider value={contextValue}>
      <AllianceDictRegister />
      {children}
    </AuthContext.Provider>
  )
}

/** 登录后注册联盟字典到 allianceLabel：列表/详情展示文案跟随字典管理页配置 */
function AllianceDictRegister() {
  const { tenantId } = useAuth()
  useRegisterAllianceDicts(tenantId)
  return null
}
