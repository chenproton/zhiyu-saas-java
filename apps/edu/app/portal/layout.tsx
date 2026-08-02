'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { TopNav } from '@/components/portal/top-nav'
import { usePortalAuth } from '@/contexts/portal-auth-context'
import { YiKnowAssistant } from '@/components/portal/yi-know-assistant'

function PortalAuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, activeRoleCode, loading } = usePortalAuth()

  const isLoginPage = pathname === '/portal/login'

  useEffect(() => {
    if (loading || isLoginPage) return
    if (!user) {
      router.replace('/portal/login')
      return
    }
    if (user.platform !== 'portal') {
      router.replace('/portal/login')
      return
    }

    // 我的服务台只对教师、学生、学校管理员角色开放
    if (
      (pathname === '/portal/workspace' || pathname.startsWith('/portal/workspace/')) &&
      activeRoleCode !== 'teacher' &&
      activeRoleCode !== 'student' &&
      activeRoleCode !== 'school_admin'
    ) {
      router.replace('/portal')
      return
    }
  }, [loading, user, activeRoleCode, router, pathname, isLoginPage])

  // 认证状态确认前始终渲染 children，避免 SSR/客户端因返回 loading/null 触发 404；
  // useEffect 会在未登录或平台不符时重定向到登录页。
  return <>{children}</>
}

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isLoginPage = pathname === '/portal/login'

  return (
    <PortalAuthGuard>
      {isLoginPage ? (
        <main>{children}</main>
      ) : (
        <div className="min-h-screen pt-14">
          <TopNav />
          <main>{children}</main>
          <YiKnowAssistant />
        </div>
      )}
    </PortalAuthGuard>
  )
}
