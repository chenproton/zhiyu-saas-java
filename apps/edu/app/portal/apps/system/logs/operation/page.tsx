'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/shared/status-badge'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Search, Download, RefreshCw, AlertCircle } from 'lucide-react'
import { usePortalAuth } from '@/contexts/portal-auth-context'
import { portalLogApi } from '@/lib/api'
import type { OperationLog } from '@/lib/types/backend'
import { LogTableShell, type LogColumn } from '@/components/shared/log-table-shell'
import { useT } from '@/lib/i18n/locale-provider'

const PAGE_SIZE = 20

export default function OperationLogsPage() {
  const t = useT()
  const { tenantId } = usePortalAuth()

  const [logs, setLogs] = useState<OperationLog[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)

  // 搜索输入 300ms 防抖，避免每次击键触发万级记录全量拉取
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300)
    return () => clearTimeout(timer)
  }, [searchTerm])

  const loadLogs = useCallback(
    async (targetPage = page) => {
      if (!tenantId) return
      setLoading(true)
      setError(null)
      try {
        // 后端操作日志接口不支持 free-text search，搜索时全量拉取后由前端过滤分页
        const searching = debouncedSearch.trim() !== ''
        const res = await portalLogApi.operationLogs({
          tenantId,
          limit: searching ? 10000 : PAGE_SIZE,
          offset: searching ? 0 : (targetPage - 1) * PAGE_SIZE,
        })
        setLogs(res.items)
        setTotal(res.total)
      } catch (err: any) {
        setError(err?.message || t('加载操作日志失败'))
      } finally {
        setLoading(false)
      }
    },
    [tenantId, page, debouncedSearch, t],
  )

  useEffect(() => {
    ;(async () => {
      await loadLogs()
    })()
  }, [loadLogs])

  const handleRefresh = () => loadLogs()

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return
    setPage(newPage)
  }

  const searchFiltered = useMemo(() => {
    const keyword = searchTerm.trim()
    if (!keyword) return logs
    return logs.filter(
      (log) =>
        (log.userName || '').includes(keyword) ||
        (log.userId || '').includes(keyword) ||
        (log.module || '').includes(keyword) ||
        log.action.includes(keyword),
    )
  }, [logs, searchTerm])

  const searching = searchTerm.trim() !== ''
  const displayLogs = searching
    ? searchFiltered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
    : searchFiltered

  const totalPages = Math.max(1, Math.ceil((searching ? searchFiltered.length : total) / PAGE_SIZE))

  const formatTarget = (log: OperationLog) => {
    if (log.detail) return log.detail
    const parts = [log.targetType, log.targetId].filter(Boolean)
    return parts.length ? parts.join(': ') : '-'
  }

  const columns: LogColumn<OperationLog>[] = [
    {
      header: t('用户'),
      cell: (log) => (
        <>
          <div className="font-medium">{log.userName || '-'}</div>
          <div className="font-mono text-xs text-muted-foreground">{log.userId || '-'}</div>
        </>
      ),
    },
    { header: t('模块'), cell: (log) => log.module || '-' },
    { header: t('操作'), cell: (log) => log.action },
    {
      header: t('操作对象'),
      cell: (log) => (
        <span className="text-muted-foreground max-w-xs truncate" title={formatTarget(log)}>
          {formatTarget(log)}
        </span>
      ),
    },
    {
      header: t('IP地址'),
      cell: (log) => (
        <span className="font-mono text-sm text-muted-foreground">{log.ip || '-'}</span>
      ),
    },
    {
      header: t('状态'),
      cell: (log) => (
        <StatusBadge
          status={log.status === 'success' ? 'success' : log.status || 'failed'}
          label={log.status === 'success' ? t('成功') : log.status || t('失败')}
        />
      ),
    },
    {
      header: t('操作时间'),
      cell: (log) => <span className="text-muted-foreground">{log.createdAt}</span>,
    },
  ]

  return (
    <div className="min-h-full">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{t('操作日志查看')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('查看用户操作记录')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            {t('刷新')}
          </Button>
          <Button variant="outline" size="sm" disabled title={t('即将上线')}>
            <Download className="h-4 w-4 mr-1" />
            {t('批量导出')}
          </Button>
        </div>
      </div>

      <div className="mb-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            autoComplete="off"
            placeholder={t('搜索用户、模块或操作...')}
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              setPage(1)
            }}
            className="pl-9"
          />
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t('加载失败')}</AlertTitle>
          <AlertDescription className="flex items-center gap-4">
            {error}
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              {t('重试')}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <LogTableShell
        loading={loading}
        items={displayLogs}
        columns={columns}
        emptyText={t('暂无操作日志')}
        total={searching ? searchFiltered.length : total}
        page={page}
        totalPages={totalPages}
        onPageChange={handlePageChange}
      />
    </div>
  )
}
