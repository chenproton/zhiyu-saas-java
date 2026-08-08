'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { PlatformShell } from '@/components/platform-shell'
import { PermissionGuard } from '@/components/shared/permission-guard'
import { libraryNavigationConfig } from '@/lib/navigation-config'
import { useAuth } from '@/components/auth-provider'

export default function LibraryLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, loading, hasMenuPermission } = useAuth()
  const isLanding = pathname.startsWith('/library/landing')

  useEffect(() => {
    if (!loading && !user && !isLanding) {
      router.replace('/portal/login')
    }
  }, [loading, user, isLanding, router])

  const allowed = !loading && !!user && hasMenuPermission(pathname)

  if (isLanding) {
    return <>{children}</>
  }

  // 未授权时不渲染 children：避免页面在无权限时仍发起数据请求（403 噪音 + 无效请求）
  return (
    <PermissionGuard loading={loading} allowed={allowed}>
      <PlatformShell config={{ ...libraryNavigationConfig, sideBackHref: '/portal/apps' }}>
        {children}
      </PlatformShell>
    </PermissionGuard>
  )
}
