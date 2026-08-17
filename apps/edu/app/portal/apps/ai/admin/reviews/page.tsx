'use client'

// AI 智能服务中心 · 审核工作台（school_admin，spec: docs/spec/ai-service-center.md §5.4/§5.6）
// 可见性由后端 RequireRole(school_admin) 保证，前端不做角色门。
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { BookOpen, Bot, Check, ChevronLeft, ChevronRight, Link2, ShieldCheck, X } from 'lucide-react'
import { useToast, ConfirmDialog, EmptyState } from '@zhiyu/ui'
import { StatusBadge } from '@/components/shared/status-badge'
import { Spinner } from '@/components/ui/spinner'
import { aiCenterAdminApi } from '@/lib/api'
import type { AIAdminOverview, AIAgent, AIKnowledgeBase, ListResult } from '@/lib/api'
import { formatDateTime } from '@/lib/format-utils'
import { useT } from '@/lib/i18n/locale-provider'

const PAGE_SIZE = 20

type ReviewType = 'kb' | 'agent'
type ReviewStatus = 'pending' | 'published' | 'rejected'
type ReviewAction = 'approve' | 'reject' | 'takedown'

// reviews 列表对 kb/agent 返回同名公共字段（domain 对齐，见 api-client ai-center.ts）
interface ReviewRow {
  id: string
  name: string
  ownerName?: string
  status: string
  reviewComment?: string
  createdAt: string
  updatedAt: string
}

export default function AIAdminReviewsPage() {
  const t = useT()
  const { toast } = useToast()

  const [type, setType] = useState<ReviewType>('kb')
  const [status, setStatus] = useState<ReviewStatus>('pending')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<ListResult<ReviewRow> | null>(null)
  const [overview, setOverview] = useState<AIAdminOverview | null>(null)
  const [loading, setLoading] = useState(true)
  // 操作成功后自增以触发两个 effect 重新拉取（setLoading(true) 放在事件回调里，避免 effect 内同步 setState）
  const [refreshKey, setRefreshKey] = useState(0)

  // 通过走 ConfirmDialog；驳回/下架走带 comment 的 Dialog
  const [approveTarget, setApproveTarget] = useState<ReviewRow | null>(null)
  const [commentAction, setCommentAction] = useState<{ row: ReviewRow; action: 'reject' | 'takedown' } | null>(null)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false
    aiCenterAdminApi
      .overview()
      .then((res) => {
        if (!cancelled) setOverview(res)
      })
      .catch(() => {
        // 概览失败不阻塞列表
      })
    return () => {
      cancelled = true
    }
  }, [refreshKey])

  useEffect(() => {
    let cancelled = false
    aiCenterAdminApi
      .reviews({ type, status, page, pageSize: PAGE_SIZE })
      .then((res) => {
        if (!cancelled)
          setData(res as ListResult<AIKnowledgeBase | AIAgent> as unknown as ListResult<ReviewRow>)
      })
      .catch((err) => {
        if (cancelled) return
        toast({
          title: t('加载失败'),
          description: err instanceof Error ? err.message : undefined,
          variant: 'destructive',
        })
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [type, status, page, refreshKey, t, toast])

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const doAction = async (action: ReviewAction, row: ReviewRow, actionComment?: string) => {
    setSubmitting(true)
    try {
      await aiCenterAdminApi.reviewAction(type, row.id, action, actionComment)
      toast({ title: t('操作成功') })
      setApproveTarget(null)
      setCommentAction(null)
      setComment('')
      setLoading(true)
      setRefreshKey((k) => k + 1)
    } catch (err) {
      toast({
        title: t('操作失败'),
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const submitCommentAction = () => {
    if (!commentAction) return
    const trimmed = comment.trim()
    // 驳回必须填理由（后端同样强制，前端先拦截）
    if (commentAction.action === 'reject' && !trimmed) {
      toast({ title: t('请填写驳回理由'), variant: 'destructive' })
      return
    }
    doAction(commentAction.action, commentAction.row, trimmed || undefined)
  }

  const statusLabel = (s: string) =>
    s === 'pending' ? t('待审核') : s === 'published' ? t('已发布') : s === 'rejected' ? t('已驳回') : s

  const overviewCards: { label: string; value: number; icon: typeof BookOpen; hint?: string }[] = overview
    ? [
        { label: t('知识库总数'), value: overview.kbTotal, icon: BookOpen },
        { label: t('待审知识库'), value: overview.kbPending, icon: ShieldCheck },
        { label: t('已发布知识库'), value: overview.kbPublished, icon: BookOpen },
        { label: t('智能体总数'), value: overview.agentTotal, icon: Bot },
        { label: t('待审智能体'), value: overview.agentPending, icon: ShieldCheck },
        { label: t('已发布智能体'), value: overview.agentPublished, icon: Bot },
        { label: t('外部 AI 服务'), value: overview.integrations, icon: Link2 },
      ]
    : []

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
          <ShieldCheck className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h1 className="text-base font-semibold">{t('知识库/智能体审核')}</h1>
          <p className="text-xs text-muted-foreground">
            {t('审核知识库与智能体的上架申请，管控 AI 广场内容')}
          </p>
        </div>
      </div>

      {overview && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {overviewCards.map((c) => (
            <div key={c.label} className="rounded-lg border border-gray-100 bg-white shadow-sm p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <c.icon className="w-3.5 h-3.5" />
                {c.label}
              </div>
              <p className="mt-1 text-xl font-semibold">{c.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-lg border border-gray-100 bg-white shadow-sm">
        <div className="px-4 pt-4 flex flex-wrap items-center justify-between gap-3">
          <Tabs
            value={type}
            onValueChange={(v) => {
              setType(v as ReviewType)
              setPage(1)
              setLoading(true)
            }}
          >
            <TabsList>
              <TabsTrigger value="kb">{t('知识库审核')}</TabsTrigger>
              <TabsTrigger value="agent">{t('智能体审核')}</TabsTrigger>
            </TabsList>
          </Tabs>
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v as ReviewStatus)
              setPage(1)
              setLoading(true)
            }}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">{t('待审核')}</SelectItem>
              <SelectItem value="published">{t('已发布')}</SelectItem>
              <SelectItem value="rejected">{t('已驳回')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="p-4">
          {loading ? (
            <div className="flex justify-center py-16">
              <Spinner className="h-6 w-6 text-muted-foreground" />
            </div>
          ) : !data || data.items.length === 0 ? (
            <EmptyState title={t('暂无数据')} />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('名称')}</TableHead>
                    <TableHead>{t('提交人')}</TableHead>
                    <TableHead>{t('提交时间')}</TableHead>
                    <TableHead>{t('状态')}</TableHead>
                    {status === 'rejected' && <TableHead>{t('驳回理由')}</TableHead>}
                    <TableHead className="text-right">{t('操作')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium max-w-[260px] truncate">{row.name}</TableCell>
                      <TableCell>{row.ownerName || '-'}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDateTime(row.updatedAt || row.createdAt)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={row.status} label={statusLabel(row.status)} />
                      </TableCell>
                      {status === 'rejected' && (
                        <TableCell className="max-w-[220px] truncate text-muted-foreground">
                          {row.reviewComment || '-'}
                        </TableCell>
                      )}
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {row.status === 'pending' && (
                            <>
                              <Button size="sm" variant="outline" onClick={() => setApproveTarget(row)}>
                                <Check className="w-3.5 h-3.5 mr-1" />
                                {t('通过')}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-destructive"
                                onClick={() => {
                                  setCommentAction({ row, action: 'reject' })
                                  setComment('')
                                }}
                              >
                                <X className="w-3.5 h-3.5 mr-1" />
                                {t('驳回')}
                              </Button>
                            </>
                          )}
                          {row.status === 'published' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setCommentAction({ row, action: 'takedown' })
                                setComment('')
                              }}
                            >
                              {t('下架')}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
                <span>
                  {t('共')} {total} {t('条')}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page <= 1}
                    onClick={() => {
                      setPage((p) => Math.max(1, p - 1))
                      setLoading(true)
                    }}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    {t('上一页')}
                  </Button>
                  <span>
                    {page} / {totalPages}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page >= totalPages}
                    onClick={() => {
                      setPage((p) => p + 1)
                      setLoading(true)
                    }}
                  >
                    {t('下一页')}
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!approveTarget}
        onOpenChange={(open) => !open && setApproveTarget(null)}
        title={t('通过审核')}
        description={t('通过后该内容将发布到 AI 广场，租户内全员可见。确认通过？')}
        confirmText={t('通过')}
        pending={submitting}
        onConfirm={() => approveTarget && doAction('approve', approveTarget)}
      />

      <Dialog open={!!commentAction} onOpenChange={(open) => !open && setCommentAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {commentAction?.action === 'reject' ? t('驳回申请') : t('下架内容')}
            </DialogTitle>
            <DialogDescription>
              {commentAction?.action === 'reject'
                ? t('驳回后创建者可修改后重新提交审核。')
                : t('下架后该内容将从 AI 广场移除，回到私有状态。')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm font-medium">{commentAction?.row.name}</p>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={
                commentAction?.action === 'reject'
                  ? t('请填写驳回理由（必填）')
                  : t('审核意见（可选）')
              }
              rows={4}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCommentAction(null)} disabled={submitting}>
              {t('取消')}
            </Button>
            <Button
              variant={commentAction?.action === 'reject' ? 'destructive' : 'default'}
              onClick={submitCommentAction}
              disabled={submitting}
            >
              {submitting && <Spinner className="h-4 w-4 mr-1" />}
              {t('确认')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
