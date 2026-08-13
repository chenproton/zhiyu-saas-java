'use client'

import { useState } from 'react'
import { useAsync } from '@zhiyu/ui'

export interface PagedListParams {
  page: number
  limit: number
  search?: string
}

export interface PagedListResult<T> {
  items: T[]
  total: number
  loading: boolean
  error: Error | null
  refresh: () => Promise<void>
  page: number
  setPage: (p: number) => void
  search: string
  setSearch: (v: string) => void
  /** PortalCrudPage pagination prop */
  pagination: {
    page: number
    total: number
    totalPages: number
    onPageChange: (p: number) => void
  }
}

/**
 * 服务端分页列表公共 hook（PortalCrudPage 配套）：
 * 收敛 page/search 状态 + 分页请求 + total 统计，避免各列表页手写分页样板。
 * 搜索切换时自动回到第 1 页。
 */
export function usePagedList<T>(
  fetcher: (params: PagedListParams) => Promise<{ items: T[]; total: number }>,
  deps: unknown[],
  pageSize = 20,
): PagedListResult<T> {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')

  const { data, loading, error, refresh } = useAsync(
    async () => fetcher({ page, limit: pageSize, search: search.trim() || undefined }),
    { deps: [...deps, page, search], onError: () => true },
  )

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return {
    items: data?.items ?? [],
    total,
    loading,
    error,
    refresh,
    page,
    setPage,
    search,
    setSearch,
    pagination: { page, total, totalPages, onPageChange: setPage },
  }
}
