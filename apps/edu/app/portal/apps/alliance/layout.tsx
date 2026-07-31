"use client"

import { PlatformSideNav } from "@zhiyu/ui"
import { allianceNavigationConfig } from "@/lib/navigation-config"
import { useAuth } from "@/components/auth-provider"

export default function AllianceAdminLayout({ children }: { children: React.ReactNode }) {
  const { hasMenuPermission } = useAuth()

  return (
    <div className="flex min-h-[calc(100vh-56px)] bg-[#f5f7fa]">
      <PlatformSideNav config={allianceNavigationConfig} hasMenuPermission={hasMenuPermission} />
      <main className="min-w-0 flex-1">
        <div className="p-4 sm:p-6">{children}</div>
      </main>
    </div>
  )
}
