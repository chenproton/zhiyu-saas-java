'use client'

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { tagApi } from '@/lib/api'
import type { TagItem } from '@/lib/types/library'

// 模块级缓存 + 订阅：多个列表页共享标签列表，避免重复请求；
// 标签管理页增删改后调用 reload 失效缓存并通知所有订阅方。
let cachedTags: TagItem[] | null = null
// 模块级 inflight：reload 使多个订阅方同时重拉时只发一个请求
let inflight: Promise<void> | null = null
let version = 0
const listeners = new Set<() => void>()

function emitChange() {
  version++
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot() {
  return version
}

function getServerSnapshot() {
  return 0
}

/**
 * 拉取租户全部标签（含绑定数量），带模块级缓存与跨组件同步。
 * 列表页筛选栏/表单标签选择器复用同一份数据。
 */
export function useTags() {
  const v = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const [loading, setLoading] = useState(cachedTags === null)
  const [prevVersion, setPrevVersion] = useState(v)

  // reload 失效缓存（v 变化且缓存为空）时恢复加载态（渲染期同步），避免 UI 误显示「暂无标签」
  if (prevVersion !== v) {
    setPrevVersion(v)
    if (cachedTags === null) setLoading(true)
  }

  useEffect(() => {
    if (cachedTags !== null) return
    let cancelled = false
    inflight =
      inflight ??
      tagApi
        .list()
        .then((res) => {
          cachedTags = res.items || []
          emitChange()
        })
        .catch(() => {
          // 失败落空态并通知订阅者（而非永久 loading），避免静默「暂无标签」；可经 reload 手动重试
          cachedTags = []
          emitChange()
        })
        .finally(() => {
          inflight = null
        })
    inflight
      .then(() => {
        if (!cancelled) setLoading(false)
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [v])

  const reload = useCallback(() => {
    cachedTags = null
    emitChange()
  }, [])

  return { tags: cachedTags ?? [], loading, reload }
}
