'use client'

import * as React from 'react'

import { createUnsavedChangesTracker, type UnsavedChangesTracker } from '../lib/unsaved-changes'

/**
 * 弹窗未保存内容守卫：把容器节点交给 setNode（callback ref），
 * 任何时刻可用 hasUnsavedChanges() 判断弹窗内是否有用户改动。
 *
 * 生命周期要点：追踪器必须**按节点身份**绑定，不能绑在 callback ref 的每次调用上——
 * Radix 的 useComposedRefs 每次重渲染都会先用 null 卸载再挂回同一节点，
 * 若在 ref 回调里重建追踪器，受控表单每敲一个字都会清空基线，守卫会永远判「没改动」。
 * 因此这里只在拿到「新节点」时更新 state 触发 effect，null 卸载不清 state。
 *
 * 追踪逻辑见 lib/unsaved-changes.ts；enabled=false 时不监听（零开销），
 * enabled 运行期切换会重建追踪器（基线随之重置）。
 */
export function useUnsavedChangesGuard<T extends HTMLElement>(enabled: boolean) {
  const nodeRef = React.useRef<T | null>(null)
  const trackerRef = React.useRef<UnsavedChangesTracker | null>(null)
  const [trackedNode, setTrackedNode] = React.useState<T | null>(null)

  const setNode = React.useCallback((node: T | null) => {
    nodeRef.current = node
    // 只认新节点：同一节点重复挂载会被 React 状态相等性短路，不会重建追踪器
    if (node) setTrackedNode(node)
  }, [])

  React.useEffect(() => {
    if (!trackedNode || !enabled) return
    const tracker = createUnsavedChangesTracker(trackedNode)
    trackerRef.current = tracker
    return () => {
      tracker.dispose()
      trackerRef.current = null
    }
  }, [trackedNode, enabled])

  const hasUnsavedChanges = React.useCallback(
    () => trackerRef.current?.hasUnsavedChanges() ?? false,
    [],
  )

  return { setNode, nodeRef, hasUnsavedChanges }
}
