'use client'

import { useMemo } from 'react'
import type { PlatformNavigationConfig } from '@zhiyu/ui'
import { PlatformSideNav, cn } from '@zhiyu/ui'
import { useAuth } from '@/components/auth-provider'
import { TopNav } from '@/components/portal/top-nav'
import { useT } from '@/lib/i18n/locale-provider'

export function PlatformShell({
  config,
  children,
}: {
  config: PlatformNavigationConfig
  children: React.ReactNode
}) {
  const { hasMenuPermission } = useAuth()
  const t = useT()

  // 导航配置中的 label 为中文 key，在此统一翻译后再传给 PlatformSideNav
  const translatedConfig = useMemo(() => {
    const translateItems = <T extends { label: string }>(items?: T[]): T[] | undefined =>
      items?.map((item) => ({ ...item, label: t(item.label) }))
    return {
      ...config,
      brandTitle: t(config.brandTitle),
      currentPlatformLabel: t(config.currentPlatformLabel),
      currentUserName: config.currentUserName ? t(config.currentUserName) : undefined,
      currentUserRoleLabel: config.currentUserRoleLabel
        ? t(config.currentUserRoleLabel)
        : undefined,
      topNavItems: translateItems(config.topNavItems),
      sideNavItems: config.sideNavItems.map((item) => ({
        ...item,
        label: t(item.label),
        children: translateItems(item.children),
      })),
      userMenuItems: translateItems(config.userMenuItems),
      platformSwitchItems: translateItems(config.platformSwitchItems),
    }
  }, [config, t])

  return (
    <div className="min-h-screen bg-[#f5f7fa] pt-14">
      <TopNav />
      <div className={cn('flex min-h-[calc(100vh-3.5rem)]', config.shellClassName)}>
        {config.hideSideNav ? null : (
          <PlatformSideNav config={translatedConfig} hasMenuPermission={hasMenuPermission} />
        )}
        <main className={cn('min-w-0 flex-1', config.mainClassName)}>
          <div className={cn('p-4 sm:p-6', config.contentClassName)}>{children}</div>
        </main>
      </div>
    </div>
  )
}
