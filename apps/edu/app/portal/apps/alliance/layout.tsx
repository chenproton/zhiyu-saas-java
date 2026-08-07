'use client'

import { useMemo } from 'react'
import { PlatformSideNav } from '@zhiyu/ui'
import { allianceNavigationConfig } from '@/lib/navigation-config'
import { useAuth } from '@/components/auth-provider'
import { useT } from '@/lib/i18n/locale-provider'

export default function AllianceAdminLayout({ children }: { children: React.ReactNode }) {
  const { hasMenuPermission } = useAuth()
  const t = useT()

  // 导航配置中的 label 为中文 key，在此统一翻译后再传给 PlatformSideNav
  const translatedConfig = useMemo(() => {
    const translateItems = <T extends { label: string }>(items?: T[]): T[] | undefined =>
      items?.map((item) => ({ ...item, label: t(item.label) }))
    return {
      ...allianceNavigationConfig,
      brandTitle: t(allianceNavigationConfig.brandTitle),
      currentPlatformLabel: t(allianceNavigationConfig.currentPlatformLabel),
      currentUserName: allianceNavigationConfig.currentUserName
        ? t(allianceNavigationConfig.currentUserName)
        : undefined,
      currentUserRoleLabel: allianceNavigationConfig.currentUserRoleLabel
        ? t(allianceNavigationConfig.currentUserRoleLabel)
        : undefined,
      topNavItems: translateItems(allianceNavigationConfig.topNavItems),
      sideNavItems: allianceNavigationConfig.sideNavItems.map((item) => ({
        ...item,
        label: t(item.label),
        children: translateItems(item.children),
      })),
      userMenuItems: translateItems(allianceNavigationConfig.userMenuItems),
      platformSwitchItems: translateItems(allianceNavigationConfig.platformSwitchItems),
    }
  }, [t])

  return (
    <div className="flex min-h-[calc(100vh-56px)] bg-[#f5f7fa]">
      <PlatformSideNav config={translatedConfig} hasMenuPermission={hasMenuPermission} />
      <main className="min-w-0 flex-1">
        <div className="p-4 sm:p-6">{children}</div>
      </main>
    </div>
  )
}
