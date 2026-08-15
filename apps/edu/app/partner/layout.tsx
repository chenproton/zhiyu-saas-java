'use client'

import { useEffect, useMemo } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Image from 'next/image'
import { LogOut } from 'lucide-react'
import { PlatformSideNav } from '@zhiyu/ui'
import { partnerNavigationConfig } from '@/lib/navigation-config'
import { PartnerAuthProvider, usePartnerAuth } from '@/components/partner-auth-provider'
import { useT } from '@/lib/i18n/locale-provider'

function PartnerAuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, loading } = usePartnerAuth()

  const isLoginPage = pathname === '/partner/login'

  useEffect(() => {
    if (loading || isLoginPage) return
    if (!user || user.platform !== 'partner') {
      router.replace('/partner/login')
    }
  }, [loading, user, router, isLoginPage])

  // 认证状态确认前始终渲染 children，避免 SSR/客户端因返回 loading/null 触发 404；
  // useEffect 会在未登录或平台不符时重定向到登录页。
  return <>{children}</>
}

function PartnerShell({ children }: { children: React.ReactNode }) {
  const t = useT()
  const { user, enterprise, isAdmin, logout } = usePartnerAuth()

  // 导航裁剪：admin 可见全部（成员管理已移除）；专家（member）只可见
  // 专家资源（我的档案）/岗位共建/场景共建/测评任务/账号安全
  const translatedConfig = useMemo(() => {
    const items = partnerNavigationConfig.sideNavItems
      .filter((item) => {
        if (isAdmin) return true
        return [
          'experts',
          'cobuild-positions',
          'employment-projects',
          'cobuild-scenes',
          'tasks',
          'settings',
        ].includes(item.id)
      })
      .map((item) => ({
        ...item,
        label: t(item.label),
        children: item.children?.map((c) => ({ ...c, label: t(c.label) })),
      }))
    return {
      ...partnerNavigationConfig,
      brandTitle: t(partnerNavigationConfig.brandTitle),
      currentPlatformLabel: t(partnerNavigationConfig.currentPlatformLabel),
      sideNavItems: items,
    }
  }, [t, isAdmin])

  return (
    <div className="min-h-screen overflow-x-clip bg-[#f5f7fa]">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-gray-100 bg-white px-4 sm:px-6">
        <div className="flex items-center gap-2.5">
          <Image src="/logo.png?v=2" alt="知育" width={369} height={139} className="h-7 w-auto" />
          <span className="text-sm font-medium text-gray-800">{t('企业服务台')}</span>
          {enterprise?.name && (
            <span className="hidden sm:inline text-xs text-muted-foreground">
              ｜ {enterprise.name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600">{user?.name || user?.username}</span>
          <button
            type="button"
            onClick={logout}
            className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-gray-500 transition-colors hover:bg-gray-50 hover:text-red-600"
          >
            <LogOut className="h-4 w-4" />
            {t('退出')}
          </button>
        </div>
      </header>
      <div className="flex min-h-[calc(100vh-56px)]">
        <PlatformSideNav config={translatedConfig} hasMenuPermission={() => true} />
        <main className="min-w-0 flex-1">
          <div className="p-4 sm:p-6">{children}</div>
        </main>
      </div>
    </div>
  )
}

export default function PartnerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isLoginPage = pathname === '/partner/login'

  return (
    <PartnerAuthProvider>
      <PartnerAuthGuard>
        {isLoginPage ? <main>{children}</main> : <PartnerShell>{children}</PartnerShell>}
      </PartnerAuthGuard>
    </PartnerAuthProvider>
  )
}
