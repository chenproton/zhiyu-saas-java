'use client'

import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { PlatformShell } from '@/components/platform-shell'
import { PermissionGuard } from '@/components/shared/permission-guard'
import { useAuth } from '@/components/auth-provider'
import type { PlatformNavigationConfig } from '@/components/platform-shell'

interface PlatformLayoutProps {
  navigationConfig: PlatformNavigationConfig
  landingPath: string
  children: React.ReactNode
}

export function PlatformLayout({ navigationConfig, landingPath, children }: PlatformLayoutProps) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { user, loading, hasMenuPermission } = useAuth()
  const isLanding = pathname.startsWith(landingPath)

  useEffect(() => {
    if (!loading && !user && !isLanding) {
      navigate('/portal/login', { replace: true })
    }
  }, [loading, user, navigate, isLanding])

  const allowed = !loading && !!user && hasMenuPermission(pathname)

  if (isLanding) {
    return <>{children}</>
  }

  // 未登录：等待登录跳转，不进入 PermissionGuard「无权限」误导分支
  if (!loading && !user) {
    return null
  }

  // 未授权时不渲染 children：避免页面在无权限时仍发起数据请求（403 噪音 + 无效请求）
  return (
    <PermissionGuard loading={loading} allowed={allowed}>
      <PlatformShell
        config={{
          ...navigationConfig,
          sideBackHref: '/portal/apps',
        }}
      >
        {children}
      </PlatformShell>
    </PermissionGuard>
  )
}
