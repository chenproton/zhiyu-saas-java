"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { PlatformShell } from "@/components/platform-shell"
import { jobNavigationConfig } from "@/lib/navigation-config"
import { useAuth } from "@/components/auth-provider"

export default function JobLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, loading, hasMenuPermission } = useAuth()
  const isJobViewerPage = pathname.startsWith("/job/landing") || pathname.startsWith("/job/student")

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/portal/login")
    }
  }, [loading, user, router])

  const allowed = !loading && !!user && hasMenuPermission(pathname)

  const config = {
    ...jobNavigationConfig,
    sideBackHref: "/portal/apps",
  }

  const content = isJobViewerPage ? (
    <>{children}</>
  ) : (
    <PlatformShell config={config}>
      {children}
    </PlatformShell>
  )

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex h-screen items-center justify-center bg-[#f5f7fa]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <>
      {content}
      {!isJobViewerPage && !allowed && (
        <div className="fixed inset-0 z-50 flex h-screen items-center justify-center bg-[#f5f7fa]">
          <div className="text-sm text-muted-foreground">
            当前角色暂无权限访问该页面，请联系管理员在角色权限中开通
          </div>
        </div>
      )}
    </>
  )
}
