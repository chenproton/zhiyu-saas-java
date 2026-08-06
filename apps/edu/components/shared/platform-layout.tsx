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

  const content = isLanding ? (
    <>{children}</>
  ) : (
    <PlatformShell
      config={{
        ...navigationConfig,
        sideBackHref: '/portal/apps',
      }}
    >
      {children}
    </PlatformShell>
  )

  return (
    <>
      {content}
      {!isLanding && (loading || !allowed) && (
        <div className="fixed inset-0 z-50 flex h-screen items-center justify-center bg-[#f5f7fa]">
          {loading ? (
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          ) : (
            <div className="text-sm text-muted-foreground">
              {t('当前角色暂无权限访问该页面，请联系管理员在角色权限中开通')}
            </div>
          )}
        </div>
      )}
    </>
  )
}
