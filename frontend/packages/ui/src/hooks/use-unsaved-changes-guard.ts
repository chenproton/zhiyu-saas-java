'use client'

import * as React from 'react'

import { createUnsavedChangesTracker, type UnsavedChangesTracker } from '../lib/unsaved-changes'

/**
 * 弹窗未保存内容守卫：把容器节点交给 setNode（callback ref），
 * 节点挂载时创建追踪器、卸载时销毁，任何时刻可用 hasUnsavedChanges() 判断是否有用户改动。
 *
 * 追踪逻辑见 lib/unsaved-changes.ts；enabled=false 时完全不监听（零开销）。
 */
export function useUnsavedChangesGuard<T extends HTMLElement>(enabled: boolean) {
  const nodeRef = React.useRef<T | null>(null)
  const trackerRef = React.useRef<UnsavedChangesTracker | null>(null)
  const enabledRef = React.useRef(enabled)
  enabledRef.current = enabled

  const setNode = React.useCallback((node: T | null) => {
    nodeRef.current = node
    trackerRef.current?.dispose()
    trackerRef.current = node && enabledRef.current ? createUnsavedChangesTracker(node) : null
  }, [])

  const hasUnsavedChanges = React.useCallback(
    () => trackerRef.current?.hasUnsavedChanges() ?? false,
    [],
  )

  return { setNode, nodeRef, hasUnsavedChanges }
}
