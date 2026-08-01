'use client'

import { useEffect, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Search, Lock, Info, Loader2 } from 'lucide-react'
import { usePortalAuth } from '@/contexts/portal-auth-context'
import { portalRequest, buildQuery, type ListResponse } from '@/lib/api'
import type { ResourceCode } from '@/lib/types/backend'

export default function ResourceCodesPage() {
  const { tenantId, loading: authLoading } = usePortalAuth()
  const [codes, setCodes] = useState<ResourceCode[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    if (authLoading || !tenantId) return

    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await portalRequest<ListResponse<ResourceCode>>(
          `/resource-codes${buildQuery({ tenantId, limit: 1000 })}`,
        )
        if (!cancelled) {
          setCodes(res.items)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '加载资源编码失败')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [tenantId, authLoading])

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
    <div className="p-4 sm:p-6 bg-[#f5f7fa] min-h-full">
      <div className="mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">资源编码管理</h1>
          <p className="mt-1 text-sm text-muted-foreground">查看系统资源类型编码</p>
        </div>
      </div>

      <div className="mb-4 p-3 rounded-lg bg-blue-50 border border-blue-100 flex items-center gap-2">
        <Info className="w-4 h-4 text-blue-500 shrink-0" />
        <span className="text-sm text-blue-700">
          仅可通过租户 License 导入资源编码，不支持手动新增、编辑或删除
        </span>
      </div>

      <div className="mb-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜索编码名称或代码..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {error && !loading && (
        <div className="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {!loading && (
        <div className="rounded-lg border border-gray-100 bg-white shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="border-border">
                <TableHead>编码</TableHead>
                <TableHead>名称</TableHead>
                <TableHead>说明</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>创建时间</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCodes.map((code) => (
                <TableRow key={code.id} className="border-border">
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
                </TableRow>
              ))}
              {filteredCodes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                    暂无资源编码
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="mt-4 text-sm text-muted-foreground">共 {filteredCodes.length} 条记录</div>
    </div>
  )
}
