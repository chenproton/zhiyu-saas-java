'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { PlatformShell } from '@/components/platform-shell'
import { useAuth } from '@/components/auth-provider'
import type { PlatformNavigationConfig } from '@/components/platform-shell'
import { useT } from '@/lib/i18n/locale-provider'

interface PlatformLayoutProps {
  navigationConfig: PlatformNavigationConfig
  landingPath: string
  children: React.ReactNode
}

export function PlatformLayout({ navigationConfig, landingPath, children }: PlatformLayoutProps) {
  const t = useT()
  const router = useRouter()
  const pathname = usePathname()
  const { user, loading, hasMenuPermission } = useAuth()
  const isLanding = pathname.startsWith(landingPath)

  useEffect(() => {
    if (!loading && !user && !isLanding) {
      router.replace('/portal/login')
    }
  }, [loading, user, router, isLanding])

  const allowed = !loading && !!user && hasMenuPermission(pathname)

  if (isLanding) {
    return <>{children}</>
  }

  // 未授权时不渲染 children：避免页面在无权限时仍发起数据请求（403 噪音 + 无效请求）
  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex h-screen items-center justify-center bg-[#f5f7fa]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }
  if (!allowed) {
    return (
      <div className="fixed inset-0 z-50 flex h-screen items-center justify-center bg-[#f5f7fa]">
        <div className="text-sm text-muted-foreground">
          {t('当前角色暂无权限访问该页面，请联系管理员在角色权限中开通')}
        </div>
      </div>
    )
  }

  const content = (
    <PlatformShell
      config={{
        ...navigationConfig,
        sideBackHref: '/portal/apps',
      }}
    >
      {children}
    </PlatformShell>
  )

  return <>{content}</>
}
