'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { TopNav } from '@/components/portal/top-nav'
import { usePortalAuth } from '@/contexts/portal-auth-context'
import { YiKnowAssistant } from '@/components/portal/yi-know-assistant'
import { withPrefix } from '@/lib/path-prefix'

function PortalAuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, activeRoleCode, loading } = usePortalAuth()

  const isLoginPage = pathname === withPrefix('/portal/login')

  useEffect(() => {
    if (loading || isLoginPage) return
    if (!user) {
      router.replace(withPrefix('/portal/login'))
      return
    }
    if (user.platform !== 'portal') {
      router.replace(withPrefix('/portal/login'))
      return
    }

    // 我的服务台只对教师、学生、学校管理员角色开放
    if (
      (pathname === withPrefix('/portal/workspace') || pathname.startsWith(withPrefix('/portal/workspace/'))) &&
      activeRoleCode !== 'teacher' &&
      activeRoleCode !== 'student' &&
      activeRoleCode !== 'school_admin'
    ) {
      router.replace(withPrefix('/portal'))
      return
    }
  }, [loading, user, activeRoleCode, router, pathname, isLoginPage])

  // 认证状态确认前始终渲染 children，避免 SSR/客户端因返回 loading/null 触发 404；
  // useEffect 会在未登录或平台不符时重定向到登录页。
  return <>{children}</>
}

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isLoginPage = pathname === withPrefix('/portal/login')

  return (
    <PortalAuthGuard>
      {isLoginPage ? (
        <main>{children}</main>
      ) : (
        // overflow-x-clip：裁剪横向视觉溢出而不产生滚动容器，不影响子页面 sticky 定位，
        // 兜底防止个别页面装饰/内容横向撑开导致整页左右滑动
        <div className="min-h-screen pt-14 overflow-x-clip">
          <TopNav />
          <main>{children}</main>
          <YiKnowAssistant />
        </div>
      )}
    </PortalAuthGuard>
  )
}
