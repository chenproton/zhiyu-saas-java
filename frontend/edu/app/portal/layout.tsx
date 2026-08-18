'use client'

import { useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router'
import { TopNav } from '@/components/portal/top-nav'
import { usePortalAuth } from '@/contexts/portal-auth-context'
import { YiKnowAssistant } from '@/components/portal/yi-know-assistant'

function PortalAuthGuard({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { user, activeRoleCode, loading } = usePortalAuth()

  const isLoginPage = pathname === '/portal/login'

  useEffect(() => {
    if (loading || isLoginPage) return
    if (!user) {
      navigate('/portal/login', { replace: true })
      return
    }
    if (user.platform !== 'portal') {
      navigate('/portal/login', { replace: true })
      return
    }

    // 我的服务台只对教师、学生、学校管理员角色开放
    if (
      (pathname === '/portal/workspace' || pathname.startsWith('/portal/workspace/')) &&
      activeRoleCode !== 'teacher' &&
      activeRoleCode !== 'student' &&
      activeRoleCode !== 'school_admin'
    ) {
      navigate('/portal', { replace: true })
      return
    }
  }, [loading, user, activeRoleCode, navigate, pathname, isLoginPage])

  // 认证状态确认前始终渲染 children，避免 SSR/客户端因返回 loading/null 触发 404；
  // useEffect 会在未登录或平台不符时重定向到登录页。
  return <>{children}</>
}

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation()
  const isLoginPage = pathname === '/portal/login'

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
