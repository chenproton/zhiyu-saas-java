'use client'

import { useEffect } from 'react'
import { applyBrandColor, fetchAndApplyBrandColor, getCachedBrandColor } from '@/lib/theme-brand'

/**
 * 平台主题色同步器：
 * 1. 挂载时立即应用本地缓存（避免闪烁），再向后端拉取最新配置
 * 2. 监听同源其他标签页的 storage 事件与本页自定义事件，实时同步主题色
 */
export function ThemeBrandSync() {
  useEffect(() => {
    applyBrandColor(getCachedBrandColor())
    void fetchAndApplyBrandColor()

    const syncFromCache = () => applyBrandColor(getCachedBrandColor())
    const handleStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === undefined) {
        syncFromCache()
        return
      }
      const cached = getCachedBrandColor()
      if (e.key === 'zhiyu-brand-color' || e.key === cached) {
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
  }, [])

  return null
}
