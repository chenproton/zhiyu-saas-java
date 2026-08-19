'use client'

import * as React from 'react'

import { createUnsavedChangesTracker, type UnsavedChangesTracker } from '../lib/unsaved-changes'

/**
 * 弹窗未保存内容守卫：把容器节点交给 setNode（callback ref），
 * 节点挂载时创建追踪器、卸载时销毁，任何时刻可用 hasUnsavedChanges() 判断是否有用户改动。
 *
 * 追踪逻辑见 lib/unsaved-changes.ts；enabled=false 时不监听（零开销），
 * enabled 运行期切换会重建追踪器（基线随之重置）。
 */
export function useUnsavedChangesGuard<T extends HTMLElement>(enabled: boolean) {
  const nodeRef = React.useRef<T | null>(null)
  const trackerRef = React.useRef<UnsavedChangesTracker | null>(null)
  const enabledRef = React.useRef(enabled)

  const syncTracker = React.useCallback(() => {
    trackerRef.current?.dispose()
    const node = nodeRef.current
    trackerRef.current = node && enabledRef.current ? createUnsavedChangesTracker(node) : null
  }, [])

  const setNode = React.useCallback(
    (node: T | null) => {
      nodeRef.current = node
      syncTracker()
    },
    [syncTracker],
  )

  React.useEffect(() => {
    if (enabledRef.current === enabled) return
    enabledRef.current = enabled
    syncTracker()
  }, [enabled, syncTracker])

  const hasUnsavedChanges = React.useCallback(
    () => trackerRef.current?.hasUnsavedChanges() ?? false,
    [],
  )

  return { setNode, nodeRef, hasUnsavedChanges }
}
