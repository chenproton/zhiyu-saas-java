'use client'

// Partner（企业平台）独立登录态：使用 partner token + /auth/partner/me，
// 与 portal 的 auth-provider 完全隔离（后者硬编码 portal token，勿复用）。
import { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { partnerAuthApi, getToken, removeToken, type PartnerMeResponse } from '@/lib/api'
import { useT } from '@/lib/i18n/locale-provider'

interface PartnerAuthContextType {
  user?: PartnerMeResponse['user']
  enterprise?: PartnerMeResponse['enterprise']
  roles?: PartnerMeResponse['roles']
  /** 当前激活角色编码（enterprise_admin / enterprise_member） */
  activeRoleCode?: string
  isAdmin: boolean
  loading: boolean
  error?: string
  refresh: () => Promise<void>
  logout: () => void
}

const PartnerAuthContext = createContext<PartnerAuthContextType>({
  loading: true,
  isAdmin: false,
  refresh: async () => {},
  logout: () => {},
})

export function usePartnerAuth() {
  return useContext(PartnerAuthContext)
}

export function PartnerAuthProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const t = useT()
  const meSeqRef = useRef(0)
  const [state, setState] = useState<{
    me?: PartnerMeResponse
    loading: boolean
    error?: string
  }>({ loading: true })

  const fetchMe = useCallback(async () => {
    const seq = ++meSeqRef.current
    // 登录/注册页不获取登录态：未登录不触发请求，失效 token 也不会被 401 跳转。
    // 同时保持 loading=true 不重置：登录成功后跳转 workspace 的第一帧若处于
    // loading=false + user=undefined，PartnerAuthGuard 会误判未登录把用户弹回登录页。
    if (pathname === '/partner/login') {
      return
    }
    const token = getToken('partner')
    if (!token) {
      setState({ loading: false })
      return
    }

    // 拉取期间保持 loading：登录页跳转过来的瞬间 user 尚未加载，
    // Guard 若看到 loading=false + user=undefined 会误判未登录弹回登录页
    setState((prev) => ({ ...prev, loading: true }))
    try {
      const data = await partnerAuthApi.me()
      if (seq !== meSeqRef.current) return
      setState({ me: data, loading: false, error: undefined })
    } catch (err) {
      if (seq !== meSeqRef.current) return
      removeToken('partner')
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
    removeToken('partner')
    setState({ me: undefined, loading: false })
    if (typeof window !== 'undefined') {
      window.location.href = '/partner/login'
    }
  }, [])

  const refresh = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true }))
    await fetchMe()
  }, [fetchMe])

  const activeRoleCode = useMemo(() => {
    const codes = state.me?.user?.roleCodes
    if (codes && codes.length > 0) return codes[0]
    return state.me?.roles?.[0]?.code
  }, [state.me])

  const contextValue = useMemo(
    () => ({
      user: state.me?.user,
      enterprise: state.me?.enterprise,
      roles: state.me?.roles,
      activeRoleCode,
      isAdmin: activeRoleCode === 'enterprise_admin',
      loading: state.loading,
      error: state.error,
      refresh,
      logout,
    }),
    [state, activeRoleCode, refresh, logout],
  )

  return <PartnerAuthContext.Provider value={contextValue}>{children}</PartnerAuthContext.Provider>
}
