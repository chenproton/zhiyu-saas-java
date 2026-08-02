'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useToast } from '@zhiyu/ui'

type QueryParams = Record<string, string | number | boolean | undefined>

interface LibraryListFn<TItem> {
  (params?: QueryParams): Promise<{ items: TItem[] }>
}

interface UseLibraryCrudOptions {
  /** 单页拉取数量，默认 500 */
  limit?: number
  /** 额外的查询参数构造器；经 ref 读取，读取的页面 state 变化时需自行触发 loadItems */
  getParams?: () => QueryParams
  /** 是否挂载时自动加载，默认 true；需自行控制加载时机（如额外筛选联动）时设为 false */
  autoLoad?: boolean
}

/**
 * library 列表页统一数据加载 hook：
 * 统一 search 搜索 + limit + loading + 失败 toast + 首载 effect，
 * 消除 knowledge/questions/ability/certificates 等页面的复制粘贴骨架。
 * 需要随页面 state 联动筛选的调用方：autoLoad: false + 自行 useEffect([deps]) 触发 loadItems。
 */
export function useLibraryCrud<TItem>(
  list: LibraryListFn<TItem>,
  options: UseLibraryCrudOptions = {},
) {
  const { toast } = useToast()
  // options 每次渲染为新对象，经 effect 同步到 ref，避免被 loadItems 闭包捕获陈旧值
  const optionsRef = useRef(options)
  const [items, setItems] = useState<TItem[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    optionsRef.current = options
  }, [options])

  const loadItems = useCallback(async () => {
    setLoading(true)
    try {
      const opts = optionsRef.current
      const params: QueryParams = { limit: opts.limit ?? 500 }
      if (searchQuery) params.search = searchQuery
      Object.assign(params, opts.getParams?.() ?? {})
      const res = await list(params)
      setItems(res.items ?? [])
    } catch (err) {
      toast({
        variant: 'destructive',
        title: '加载失败',
        description: err instanceof Error ? err.message : '无法获取列表',
      })
    } finally {
      setLoading(false)
    }
  }, [list, searchQuery, toast])

  useEffect(() => {
    if (optionsRef.current.autoLoad === false) return
    void loadItems()
  }, [loadItems])

  return { items, setItems, loading, searchQuery, setSearchQuery, loadItems }
}
