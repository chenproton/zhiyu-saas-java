'use client'

import { Loader2 } from 'lucide-react'
import { useT } from '@/lib/i18n/locale-provider'

interface PermissionGuardProps {
  loading: boolean
  allowed: boolean
  children: React.ReactNode
}

/**
 * 页面级权限守卫：未授权时不渲染 children，避免无权限页面
 * 仍发起数据请求（403 噪音 + 无效请求）。
 * 供各业务布局（PlatformLayout / LessonAdminLayout / LibraryLayout 等）复用。
 */
export function PermissionGuard({ loading, allowed, children }: PermissionGuardProps) {
  const t = useT()
  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex h-screen items-center justify-center bg-[#f5f7fa]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }
  if (!allowed) {
    return (
      <div className="fixed inset-0 z-50 flex h-screen items-center justify-center bg-[#f5f7fa]">
        <div className="text-sm text-muted-foreground">
          {t('当前角色暂无权限访问该页面，请联系管理员在角色权限中开通')}
        </div>
      </div>
    )
  }
  return <>{children}</>
}
