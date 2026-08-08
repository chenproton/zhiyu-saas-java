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
