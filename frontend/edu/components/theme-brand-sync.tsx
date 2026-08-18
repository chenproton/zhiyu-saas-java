'use client'

import { useEffect, useRef } from 'react'
import { useAuth } from '@/components/auth-provider'
import { applyBrandColor, fetchAndApplyBrandColor, getCachedBrandColor } from '@/lib/theme-brand'

/**
 * 平台主题色同步器：
 * 1. 挂载时立即应用本地缓存（避免闪烁），再向后端拉取最新配置
 * 2. 登录后按租户拉取租户主题色（租户覆盖色优先，未配置回退平台默认）
 * 3. 监听同源其他标签页的 storage 事件与本页自定义事件，实时同步主题色
 */
export function ThemeBrandSync() {
  const { user } = useAuth()
  const tenantId = user?.tenantId

  const appliedRef = useRef('')

  useEffect(() => {
    const cached = getCachedBrandColor(tenantId)
    if (cached !== appliedRef.current) {
      appliedRef.current = cached
      applyBrandColor(cached, tenantId)
    }
    void fetchAndApplyBrandColor(tenantId).then((color) => {
      if (color !== appliedRef.current) {
        appliedRef.current = color
        applyBrandColor(color, tenantId)
      }
    })
  }, [tenantId])

  useEffect(() => {
    const syncFromCache = () => {
      const cached = getCachedBrandColor(tenantId)
      if (cached !== appliedRef.current) {
        appliedRef.current = cached
        applyBrandColor(cached, tenantId)
      }
    }
    const handleStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === undefined || e.key.startsWith('zhiyu-brand-color')) {
        syncFromCache()
      }
    }
    const handleBrandEvent = () => syncFromCache()

    window.addEventListener('storage', handleStorage)
    window.addEventListener('zhiyu-theme-changed', handleBrandEvent)
    return () => {
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener('zhiyu-theme-changed', handleBrandEvent)
    }
  }, [tenantId])

  return null
}
