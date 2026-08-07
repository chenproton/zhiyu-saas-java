'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { PlatformShell } from '@/components/platform-shell'
import { adminNavigationConfig } from '@/lib/navigation-config'
import { useAuth } from '@/components/auth-provider'
import { useT } from '@/lib/i18n/locale-provider'
import type { PlatformNavigationConfig } from '@/components/platform-shell'

const config: PlatformNavigationConfig = {
  ...adminNavigationConfig,
  sideBackHref: '/portal/apps',
}

export default function LessonAdminLayout({ children }: { children: React.ReactNode }) {
  const t = useT()
  const router = useRouter()
  const pathname = usePathname()
  const { user, loading, hasMenuPermission } = useAuth()

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/portal/login')
    }
  }, [loading, user, router])

  const allowed = !loading && !!user && hasMenuPermission(pathname)

  return (
    <PlatformShell config={config}>
      {children}
      {(loading || !allowed) && (
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
    </PlatformShell>
  )
}
