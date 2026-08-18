'use client'

import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { PlatformShell } from '@/components/platform-shell'
import { PermissionGuard } from '@/components/shared/permission-guard'
import { adminNavigationConfig } from '@/lib/navigation-config'
import { useAuth } from '@/components/auth-provider'
import type { PlatformNavigationConfig } from '@/components/platform-shell'

const config: PlatformNavigationConfig = {
  ...adminNavigationConfig,
  sideBackHref: '/portal/apps',
}

export default function LessonAdminLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { user, loading, hasMenuPermission } = useAuth()

  useEffect(() => {
    if (!loading && !user) {
      navigate('/portal/login', { replace: true })
    }
  }, [loading, user, navigate])

  const allowed = !loading && !!user && hasMenuPermission(pathname)

  return (
    <PlatformShell config={config}>
      <PermissionGuard loading={loading} allowed={allowed}>{children}</PermissionGuard>
    </PlatformShell>
  )
}
