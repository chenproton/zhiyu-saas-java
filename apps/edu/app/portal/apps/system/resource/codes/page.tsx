'use client'

import { useEffect, useMemo, useCallback, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { TableCell, TableHead } from '@/components/ui/table'
import { Lock, Info } from 'lucide-react'
import { usePortalAuth } from '@/contexts/portal-auth-context'
import { portalRequest, buildQuery, type ListResponse } from '@/lib/api'
import { PortalCrudPage } from '@/components/shared/portal-crud-page'
import type { ResourceCode } from '@/lib/types/backend'

export default function ResourceCodesPage() {
  const { tenantId, loading: authLoading } = usePortalAuth()
  const [codes, setCodes] = useState<ResourceCode[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  const fetchCodes = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    setError(null)
    try {
      const res = await portalRequest<ListResponse<ResourceCode>>(
        `/resource-codes${buildQuery({ tenantId, limit: 1000 })}`,
      )
      setCodes(res.items)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载资源编码失败')
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => {
    if (authLoading || !tenantId) return
    let cancelled = false
    ;(async () => {
      if (!cancelled) await fetchCodes()
    })()
    return () => {
      cancelled = true
    }
  }, [tenantId, authLoading, fetchCodes])

  const filteredCodes = useMemo(
    () => codes.filter((code) => code.name.includes(searchTerm) || code.code.includes(searchTerm)),
    [codes, searchTerm],
  )

  const typeLabel = (type?: string) => {
    if (type === 'public') return '公共编码'
    if (type === 'custom') return '自定义编码'
    return type || '公共编码'
  }

  return (
    <PortalCrudPage
      title="资源编码管理"
      description="查看系统资源类型编码"
      entityLabel="资源编码"
      items={filteredCodes}
      loading={loading}
      error={error}
      onRetry={fetchCodes}
      colSpan={5}
      searchPlaceholder="搜索编码名称或代码..."
      searchValue={searchTerm}
      onSearchChange={setSearchTerm}
      hideImport
      hideCreate
      emptyContent="暂无资源编码"
      beforeTable={
        <div className="mb-4 p-3 rounded-lg bg-blue-50 border border-blue-100 flex items-center gap-2">
          <Info className="w-4 h-4 text-blue-500 shrink-0" />
          <span className="text-sm text-blue-700">
            仅可通过租户 License 导入资源编码，不支持手动新增、编辑或删除
          </span>
        </div>
      }
      renderTableHeader={() => (
        <>
          <TableHead>编码</TableHead>
          <TableHead>名称</TableHead>
          <TableHead>说明</TableHead>
          <TableHead>类型</TableHead>
          <TableHead>创建时间</TableHead>
        </>
      )}
      renderTableRow={(code) => (
        <>
          <TableCell className="font-mono text-sm">{code.code}</TableCell>
          <TableCell className="font-medium">{code.name}</TableCell>
          <TableCell className="text-muted-foreground">{code.description || '-'}</TableCell>
          <TableCell>
            <Badge variant="secondary">
              <Lock className="w-3 h-3 mr-1" />
              {typeLabel(code.type)}
            </Badge>
          </TableCell>
          <TableCell className="text-muted-foreground">{code.createdAt}</TableCell>
        </>
      )}
    />
  )
}
