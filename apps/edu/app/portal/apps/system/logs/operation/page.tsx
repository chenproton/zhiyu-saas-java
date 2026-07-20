"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Search, Download, RefreshCw, Loader2, AlertCircle } from "lucide-react"
import { usePortalAuth } from "@/contexts/portal-auth-context"
import { portalLogApi } from "@/lib/api"
import type { OperationLog } from "@/lib/types/backend"

const PAGE_SIZE = 20

export default function OperationLogsPage() {
  const { tenantId } = usePortalAuth()

  const [logs, setLogs] = useState<OperationLog[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [page, setPage] = useState(1)

  const loadLogs = async (targetPage = page) => {
    if (!tenantId) return
    setLoading(true)
    setError(null)
    try {
      const res = await portalLogApi.operationLogs({
        tenantId,
        limit: PAGE_SIZE,
        offset: (targetPage - 1) * PAGE_SIZE,
      })
      setLogs(res.items)
      setTotal(res.total)
    } catch (err: any) {
      setError(err?.message || "加载操作日志失败")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLogs()
  }, [tenantId, page])

  const handleRefresh = () => loadLogs()

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > Math.ceil(total / PAGE_SIZE)) return
    setPage(newPage)
  }

  const filteredLogs = logs.filter((log) =>
    (log.userName || "").includes(searchTerm) ||
    (log.userId || "").includes(searchTerm) ||
    (log.module || "").includes(searchTerm) ||
    log.action.includes(searchTerm)
  )

  const formatTarget = (log: OperationLog) => {
    if (log.detail) return log.detail
    const parts = [log.targetType, log.targetId].filter(Boolean)
    return parts.length ? parts.join(": ") : "-"
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">操作日志查看</h1>
          <p className="mt-1 text-sm text-muted-foreground">查看用户操作记录</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
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
            placeholder="搜索用户、模块或操作..."
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
            <Button variant="outline" size="sm" onClick={handleRefresh}>重试</Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="border-border">
              <TableHead>用户</TableHead>
              <TableHead>模块</TableHead>
              <TableHead>操作</TableHead>
              <TableHead>操作对象</TableHead>
              <TableHead>IP地址</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>操作时间</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                  <span className="mt-2 block text-sm">加载中...</span>
                </TableCell>
              </TableRow>
            ) : filteredLogs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                  暂无操作日志
                </TableCell>
              </TableRow>
            ) : (
              filteredLogs.map((log) => (
                <TableRow key={log.id} className="border-border">
                  <TableCell>
                    <div className="font-medium">{log.userName || "-"}</div>
                    <div className="font-mono text-xs text-muted-foreground">{log.userId || "-"}</div>
                  </TableCell>
                  <TableCell>{log.module || "-"}</TableCell>
                  <TableCell>{log.action}</TableCell>
                  <TableCell className="text-muted-foreground max-w-xs truncate" title={formatTarget(log)}>
                    {formatTarget(log)}
                  </TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground">{log.ip || "-"}</TableCell>
                  <TableCell>
                    <Badge variant={log.status === "success" ? "default" : "destructive"}>
                      {log.status === "success" ? "成功" : (log.status || "失败")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{log.createdAt}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
        <span>共 {total} 条记录</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => handlePageChange(page - 1)}>
            上一页
          </Button>
          <span className="px-2">{page} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages || loading} onClick={() => handlePageChange(page + 1)}>
            下一页
          </Button>
        </div>
      </div>
    </div>
  )
}
