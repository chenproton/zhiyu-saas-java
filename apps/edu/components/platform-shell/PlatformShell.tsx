'use client'

import type { PlatformNavigationConfig } from '@zhiyu/ui'
import { PlatformSideNav, cn } from '@zhiyu/ui'
import { useAuth } from '@/components/auth-provider'
import { TopNav } from '@/components/portal/top-nav'

export function PlatformShell({
  config,
  children,
}: {
  config: PlatformNavigationConfig
  children: React.ReactNode
}) {
  const { hasMenuPermission } = useAuth()

  return (
    <div className="min-h-screen bg-[#f5f7fa] pt-14">
      <TopNav />
      <div className={cn('flex min-h-[calc(100vh-3.5rem)]', config.shellClassName)}>
        {config.hideSideNav ? null : (
          <PlatformSideNav config={config} hasMenuPermission={hasMenuPermission} />
        )}
        <main className={cn('min-w-0 flex-1', config.mainClassName)}>
          <div className={cn('p-4 sm:p-6', config.contentClassName)}>{children}</div>
        </main>
      </div>
    </div>
  )
}
