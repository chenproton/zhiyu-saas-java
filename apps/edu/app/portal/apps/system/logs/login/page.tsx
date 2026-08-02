'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/shared/status-badge'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Search, Download, RefreshCw, AlertCircle } from 'lucide-react'
import { usePortalAuth } from '@/contexts/portal-auth-context'
import { portalLogApi } from '@/lib/api'
import type { LoginLog } from '@/lib/types/backend'
import { LogTableShell, type LogColumn } from '@/components/shared/log-table-shell'

const PAGE_SIZE = 20

export default function LoginLogsPage() {
  const { tenantId } = usePortalAuth()

  const [logs, setLogs] = useState<LoginLog[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [page, setPage] = useState(1)

  const loadLogs = useCallback(
    async (targetPage = page) => {
      if (!tenantId) return
      setLoading(true)
      setError(null)
      try {
        const res = await portalLogApi.loginLogs({
          tenantId,
          limit: PAGE_SIZE,
          offset: (targetPage - 1) * PAGE_SIZE,
        })
        setLogs(res.items)
        setTotal(res.total)
      } catch (err: any) {
        setError(err?.message || '加载登录日志失败')
      } finally {
        setLoading(false)
      }
    },
    [tenantId, page],
  )

  useEffect(() => {
    ;(async () => {
      await loadLogs()
    })()
  }, [loadLogs])

  const handleRefresh = () => loadLogs()

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > Math.ceil(total / PAGE_SIZE)) return
    setPage(newPage)
  }

  const filteredLogs = logs.filter(
    (log) =>
      (log.userName || '').includes(searchTerm) ||
      (log.userId || '').includes(searchTerm) ||
      (log.ip || '').includes(searchTerm),
  )

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const columns: LogColumn<LoginLog>[] = [
    {
      header: '用户',
      cell: (log) => (
        <>
          <div className="font-medium">{log.userName || '-'}</div>
          <div className="font-mono text-xs text-muted-foreground">{log.userId || '-'}</div>
        </>
      ),
    },
    {
      header: 'IP地址',
      cell: (log) => (
        <span className="font-mono text-sm text-muted-foreground">{log.ip || '-'}</span>
      ),
    },
    { header: '登录地点', cell: (log) => log.location || '-' },
    {
      header: '设备',
      cell: (log) => <span className="text-muted-foreground">{log.device || '-'}</span>,
    },
    {
      header: '状态',
      cell: (log) => (
        <StatusBadge
          status={log.status === 'success' ? 'success' : log.status || 'failed'}
          label={log.status === 'success' ? '成功' : log.status || '失败'}
        />
      ),
    },
    {
      header: '登录时间',
      cell: (log) => <span className="text-muted-foreground">{log.createdAt}</span>,
    },
  ]

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">登录日志查看</h1>
          <p className="mt-1 text-sm text-muted-foreground">查看用户登录记录</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
          <Button variant="outline" size="sm" disabled title="即将上线">
            <Download className="h-4 w-4 mr-1" />
            导出
          </Button>
        </div>
      </div>

      <div className="mb-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜索用户名或IP..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>加载失败</AlertTitle>
          <AlertDescription className="flex items-center gap-4">
            {error}
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              重试
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <LogTableShell
        loading={loading}
        items={filteredLogs}
        columns={columns}
        emptyText="暂无登录日志"
        total={total}
        page={page}
        totalPages={totalPages}
        onPageChange={handlePageChange}
      />
    </div>
  )
}
