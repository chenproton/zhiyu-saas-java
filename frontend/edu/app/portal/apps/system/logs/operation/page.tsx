'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDebouncedValue } from '@zhiyu/ui'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/shared/status-badge'
import { SearchInput } from '@/components/shared/search-input'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Download, RefreshCw, AlertCircle } from 'lucide-react'
import { usePortalAuth } from '@/contexts/portal-auth-context'
import { portalLogApi } from '@/lib/api'
import { fetchAllPages } from '@zhiyu/api-client'
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
  const debouncedSearch = useDebouncedValue(searchTerm, 300)
  const [page, setPage] = useState(1)
  // 请求序号守卫：快速翻页/连续搜索时丢弃过期响应，避免旧数据覆盖新结果
  const seqRef = useRef(0)

  const loadLogs = useCallback(
    async (targetPage = page) => {
      if (!tenantId) return
      const seq = ++seqRef.current
      setLoading(true)
      setError(null)
      try {
        // 后端操作日志接口不支持 free-text search，搜索时全量拉取后由前端过滤分页；
        // 注意后端列表 limit 上限 200，单次 10000 会被静默钳制为 200 导致搜索截断，必须分页拉全量
        const searching = debouncedSearch.trim() !== ''
        if (searching) {
          const all = await fetchAllPages((pg, ps) =>
            portalLogApi.operationLogs({ tenantId, limit: ps, offset: pg * ps }),
          )
          if (seq !== seqRef.current) return
          setLogs(all)
          setTotal(all.length)
        } else {
          const res = await portalLogApi.operationLogs({
            tenantId,
            limit: PAGE_SIZE,
            offset: (targetPage - 1) * PAGE_SIZE,
          })
          if (seq !== seqRef.current) return
          setLogs(res.items)
          setTotal(res.total)
        }
      } catch (err: any) {
        if (seq !== seqRef.current) return
        setError(err?.message || t('加载操作日志失败'))
      } finally {
        if (seq === seqRef.current) setLoading(false)
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
        <SearchInput
          wrapperClassName="max-w-md"
          placeholder={t('搜索用户、模块或操作...')}
          value={searchTerm}
          onChange={(v) => {
            setSearchTerm(v)
            setPage(1)
          }}
        />
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
