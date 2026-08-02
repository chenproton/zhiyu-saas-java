'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useAuth as useSaasAuth } from '@/components/auth-provider'
import type { UserRole } from '@/components/auth-provider'

interface UserRoleInfo {
  id: string
  name: string
  label: string
}

interface TenantInfo {
  id: string
  name: string
  code: string
}

interface AdaptedUser {
  id: string
  name: string
  avatar: string
  roles: UserRoleInfo[]
  currentRole: UserRoleInfo
  tenant: TenantInfo
}

interface AuthContextType {
  user: AdaptedUser | null
  isLoggedIn: boolean
  isLoading: boolean
  availableTenants: TenantInfo[]
  login: (username: string, password: string, tenantId: string) => Promise<boolean>
  logout: () => void
  switchRole: (roleId: string) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

function roleToInfo(role?: UserRole): UserRoleInfo {
  const map: Record<string, { id: string; name: string; label: string }> = {
    operator: { id: 'admin', name: 'admin', label: '系统管理员' },
    school: { id: 'teacher', name: 'teacher', label: '教职工' },
    enterprise: { id: 'enterprise', name: 'enterprise', label: '企业人员' },
  }
  const fallback = { id: 'student', name: 'student', label: '学生' }
  return map[role ?? 'student'] ?? fallback
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const saasAuth = useSaasAuth()

  const currentRole = roleToInfo(saasAuth.role)
  const user: AdaptedUser | null = saasAuth.user
    ? {
        id: saasAuth.user.id,
        name: saasAuth.user.name,
        avatar: saasAuth.user.name?.charAt(0).toUpperCase() || 'U',
        roles: [currentRole],
        currentRole,
        tenant: saasAuth.tenantId
          ? { id: saasAuth.tenantId, name: saasAuth.activeRole?.name || '', code: '' }
          : { id: '', name: '', code: '' },
      }
    : null

  const login = async (
    _username: string,
    _password: string,
    _tenantId: string,
  ): Promise<boolean> => {
    // Portal pages should rely on the global login flow; this is a compatibility shim.
    return false
  }

  const logout = () => {
    saasAuth.logout()
  }

  const switchRole = (_roleId: string) => {
    // Role switching is handled by the global auth system; this is a compatibility shim.
  }

  const contextValue = useMemo(
    () => ({
      user,
      isLoggedIn: !!user,
      isLoading: saasAuth.loading,
      availableTenants: user ? [user.tenant] : [],
      login,
      logout,
      switchRole,
    }),
    [user, saasAuth.loading, login, logout],
  )

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
