'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { useToast } from './use-toast'

interface UseAsyncOptions<T> {
  /** 依赖变化时自动重新加载；适合随页面 state 联动的筛选场景 */
  deps?: unknown[]
  /** 是否挂载时自动加载，默认 true；需自行控制时机时设为 false */
  autoLoad?: boolean
  /** 错误附加回调；返回 true 时抑制默认 toast（如页面已有 ErrorState 重试 UI） */
  onError?: (err: Error) => boolean | void
  /** 初始数据，默认 undefined */
  initialData?: T
}

export interface UseAsyncResult<T> {
  data: T | undefined
  loading: boolean
  error: Error | null
  /** 手动重新加载 */
  refresh: () => Promise<void>
  /** 外部改写数据（如本地删除后回写） */
  setData: (d: T) => void
}

/**
 * 页面数据加载统一 hook：
 * 收敛「loading state + try/catch + 失败 toast + 首载 effect」样板。
 * fetcher/options 每次渲染都是新闭包，经 ref 同步以避免陈旧捕获；
 * 需要随参数联动的调用方：deps 传入联动 state，或 autoLoad:false + 自行触发 refresh。
 */
export function useAsync<T>(fetcher: () => Promise<T>, options: UseAsyncOptions<T> = {}) {
  const { toast } = useToast()
  const [data, setData] = useState<T | undefined>(options.initialData)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const fetcherRef = useRef(fetcher)
  const optionsRef = useRef(options)

  useEffect(() => {
    fetcherRef.current = fetcher
  }, [fetcher])

  useEffect(() => {
    optionsRef.current = options
  }, [options])

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetcherRef.current()
      setData(res)
      setError(null)
    } catch (err) {
      const e = err instanceof Error ? err : new Error('未知错误')
      setError(e)
      if (!optionsRef.current.onError?.(e)) {
        toast({
          variant: 'destructive',
          title: '加载失败',
          description: e.message || '无法获取数据',
        })
      }
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    if (optionsRef.current.autoLoad === false) return
    void refresh()
    // deps 由调用方控制，无需 lint 校验
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh, ...(options.deps ?? [])])

  return { data, loading, error, refresh, setData }
}
