'use client'

import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { TableCell, TableHead } from '@/components/ui/table'
import { Lock, Info } from 'lucide-react'
import { usePortalAuth } from '@/contexts/portal-auth-context'
import { portalRequest, buildQuery, type ListResponse } from '@/lib/api'
import { useAsync } from '@zhiyu/ui'
import { PortalCrudPage } from '@/components/shared/portal-crud-page'
import type { ResourceCode } from '@/lib/types/backend'

export default function ResourceCodesPage() {
  const { tenantId, loading: authLoading } = usePortalAuth()
  const [searchTerm, setSearchTerm] = useState('')

  const { data, loading, error, refresh } = useAsync(
    async () => {
      if (!tenantId) return []
      const res = await portalRequest<ListResponse<ResourceCode>>(
        `/resource-codes${buildQuery({ tenantId, limit: 1000 })}`,
      )
      return res.items
    },
    { deps: [tenantId, authLoading], onError: () => true },
  )

  const codes = useMemo(() => data ?? [], [data])

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
      error={error?.message ?? null}
      onRetry={refresh}
      colSpan={5}
      searchPlaceholder="搜索编码名称或代码..."
      searchValue={searchTerm}
      onSearchChange={setSearchTerm}
      hideImport
      hideCreate
      emptyContent="暂无资源编码"
      beforeTable={
        <div className="mb-4 p-3 rounded-lg bg-primary/5 border border-primary/10 flex items-center gap-2">
          <Info className="w-4 h-4 text-primary shrink-0" />
          <span className="text-sm text-primary">
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
