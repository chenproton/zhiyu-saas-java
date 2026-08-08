'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useToast } from '@zhiyu/ui'
import { useT } from '@/lib/i18n/locale-provider'

type QueryParams = Record<string, string | number | boolean | undefined>

interface LibraryListFn<TItem> {
  (params?: QueryParams): Promise<{ items: TItem[]; total?: number }>
}

interface UseLibraryCrudOptions {
  /** 每页拉取数量（服务端分页），默认 200 */
  limit?: number
  /** 额外的查询参数构造器；经 ref 读取，读取的页面 state 变化时需自行触发 loadItems */
  getParams?: () => QueryParams
  /** 是否挂载时自动加载，默认 true；需自行控制加载时机（如额外筛选联动）时设为 false */
  autoLoad?: boolean
}

/**
 * library 列表页统一数据加载 hook：
 * 统一 search 搜索 + 服务端分页（limit/offset）+ loading + 失败 toast + 首载 effect，
 * 消除 knowledge/questions/ability/certificates 等页面的复制粘贴骨架。
 * 数量超过单页容量时按页加载，总数取接口 total（不再被后端上限截断）。
 * 需要随页面 state 联动筛选的调用方：autoLoad: false + 自行 useEffect([deps]) 触发 loadItems。
 */
export function useLibraryCrud<TItem>(
  list: LibraryListFn<TItem>,
  options: UseLibraryCrudOptions = {},
) {
  const { toast } = useToast()
  const t = useT()
  // options 每次渲染为新对象，经 effect 同步到 ref，避免被 loadItems 闭包捕获陈旧值
  const optionsRef = useRef(options)
  // 请求序号：连续输入搜索词/快速翻页时丢弃过期响应
  const loadSeqRef = useRef(0)
  const [items, setItems] = useState<TItem[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    optionsRef.current = options
  }, [options])

  // limit 由渲染期 props 直接读取（非 ref），供 totalPages 计算；loadItems 内仍走 ref 避免闭包陈旧
  const pageSize = options.limit ?? 200
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  // 筛选参数渲染期快照（如选中的标签）：变化时 loadItems 引用随之重建，
  // 驱动调用方 useEffect([loadItems]) 重载，避免手动调用 loadItems 读到陈旧闭包
  const filterKey = JSON.stringify(options.getParams?.() ?? {})

  const loadItems = useCallback(async () => {
    const seq = ++loadSeqRef.current
    setLoading(true)
    try {
      const opts = optionsRef.current
      const size = opts.limit ?? 200
      const params: QueryParams = { limit: size, offset: (page - 1) * size }
      if (searchQuery) params.search = searchQuery
      // 用渲染期快照（而非调用时读取 ref）保证与 effect 依赖一致，杜绝陈旧筛选参数
      Object.assign(params, JSON.parse(filterKey) as QueryParams)
      const res = await list(params)
      const totalPages = Math.max(1, Math.ceil((res.total ?? 0) / size))
      if (page > totalPages) {
        // 删除/筛选后当前页可能越界，回退到最后一页重新加载
        setPage(totalPages)
        return
      }
      if (seq !== loadSeqRef.current) return
      setItems(res.items ?? [])
      setTotal(res.total ?? 0)
    } catch (err) {
      if (seq !== loadSeqRef.current) return
      toast({
        variant: 'destructive',
        title: t('加载失败'),
        description: err instanceof Error ? err.message : t('无法获取列表'),
      })
    } finally {
      if (seq === loadSeqRef.current) setLoading(false)
    }
  }, [list, page, searchQuery, toast, filterKey, t])

  const handleSearchChange = useCallback((q: string) => {
    setSearchQuery(q)
    setPage(1)
  }, [])

  useEffect(() => {
    if (optionsRef.current.autoLoad === false) return
    void loadItems()
  }, [loadItems])

  return {
    items,
    setItems,
    loading,
    searchQuery,
    setSearchQuery: handleSearchChange,
    loadItems,
    total,
    page,
    setPage,
    totalPages,
  }
}
