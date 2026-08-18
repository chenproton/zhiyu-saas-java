'use client'

// AI 广场管理 · 内容管理页（v2.7，school_admin）：知识库管理/智能体管理共用。
// 复用审核列表接口（type+status 三态：待审核/已发布/已驳回）；
// 操作 = 前往使用（详情/对话页只读体验）+ 下架（published→private，二次确认）。
// 审核动作（通过/驳回）仍归审核工作台，职责不混。
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { BookOpen, Bot, ChevronLeft, ChevronRight, ExternalLink, Undo2 } from 'lucide-react'
import { useToast, ConfirmDialog, EmptyState } from '@zhiyu/ui'
import { StatusBadge } from '@/components/shared/status-badge'
import { Spinner } from '@/components/ui/spinner'
import { aiCenterAdminApi, AI_KB_TYPE_LABELS } from '@/lib/api'
import type { AIAgent, AIKnowledgeBase, ListResult } from '@/lib/api'
import { formatDateTime } from '@/lib/format-utils'
import { useT } from '@/lib/i18n/locale-provider'

const PAGE_SIZE = 20

const STATUS_OPTIONS = ['', 'pending', 'published', 'rejected'] as const

interface ContentRow {
  id: string
  name: string
  ownerName?: string
  status: string
  kbType?: string | null
  viewCount?: number
  createdAt: string
  updatedAt: string
}

export function AdminContentPage({ type }: { type: 'kb' | 'agent' }) {
  const t = useT()
  const navigate = useNavigate()
  const { toast } = useToast()
  const isKb = type === 'kb'

  const [status, setStatus] = useState<string>('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<ListResult<AIKnowledgeBase | AIAgent> | null>(null)
  const [loading, setLoading] = useState(true)
  const [takedownTarget, setTakedownTarget] = useState<ContentRow | null>(null)
  const [acting, setActing] = useState(false)

  useEffect(() => {
    let cancelled = false
    // react-hooks/set-state-in-effect：异步帧内标记加载，避免同步级联渲染
    const t0 = setTimeout(() => {
      if (!cancelled) setLoading(true)
    }, 0)
    aiCenterAdminApi
      .reviews({ type, status: status || undefined, page, pageSize: PAGE_SIZE })
      .then((res) => {
        if (!cancelled) setData(res)
      })
      .catch((err: unknown) => {
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
      clearTimeout(t0)
    }
  }, [type, status, page, t, toast])

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const statusLabel = (s: string) =>
    s === 'pending' ? t('待审核') : s === 'published' ? t('已发布') : s === 'rejected' ? t('已驳回') : s

  const goUse = (row: ContentRow) =>
    navigate(isKb ? `/portal/apps/ai/kb/${row.id}` : `/portal/apps/ai/agents/${row.id}`)

  const handleTakedown = async () => {
    if (!takedownTarget) return
    setActing(true)
    try {
      await aiCenterAdminApi.reviewAction(type, takedownTarget.id, 'takedown')
      toast({ title: t('已下架') })
      setTakedownTarget(null)
      // 下架后刷新当前页
      setLoading(true)
      const res = await aiCenterAdminApi.reviews({
        type,
        status: status || undefined,
        page,
        pageSize: PAGE_SIZE,
      })
      setData(res)
      setLoading(false)
    } catch (err) {
      toast({
        title: t('操作失败'),
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    } finally {
      setActing(false)
    }
  }

  const Icon = isKb ? BookOpen : Bot

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h1 className="text-base font-semibold">
            {isKb ? t('知识库管理') : t('智能体管理')}
          </h1>
          <p className="text-xs text-muted-foreground">
            {isKb
              ? t('查看本租户全部待审核/已发布/已驳回知识库，可前往体验或下架')
              : t('查看本租户全部待审核/已发布/已驳回智能体，可前往体验或下架')}
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-gray-100 bg-white shadow-sm">
        {/* 状态筛选（胶囊 chips，对齐大厅筛选语言） */}
        <div className="px-4 pt-4 flex items-center gap-2 flex-wrap">
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s || 'all'}
              onClick={() => {
                setStatus(s)
                setPage(1)
              }}
              className={`px-3.5 h-8 rounded-full text-xs font-medium transition-colors ${
                status === s
                  ? 'bg-primary text-white'
                  : 'bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary'
              }`}
            >
              {s === '' ? t('全部') : statusLabel(s)}
            </button>
          ))}
          <span className="ml-auto text-xs text-muted-foreground">
            {t('共 {count} 条', { count: total })}
          </span>
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
                    {isKb && <TableHead>{t('类型')}</TableHead>}
                    <TableHead>{t('创建者')}</TableHead>
                    <TableHead>{t('浏览量')}</TableHead>
                    <TableHead>{t('更新时间')}</TableHead>
                    <TableHead>{t('状态')}</TableHead>
                    <TableHead className="text-right">{t('操作')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data.items as ContentRow[]).map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium max-w-[260px] truncate">{row.name}</TableCell>
                      {isKb && (
                        <TableCell className="text-muted-foreground">
                          {row.kbType ? t(AI_KB_TYPE_LABELS[row.kbType as keyof typeof AI_KB_TYPE_LABELS] ?? row.kbType) : '-'}
                        </TableCell>
                      )}
                      <TableCell>{row.ownerName || '-'}</TableCell>
                      <TableCell className="text-muted-foreground">{row.viewCount ?? 0}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDateTime(row.updatedAt || row.createdAt)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={row.status} label={statusLabel(row.status)} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-primary"
                            onClick={() => goUse(row)}
                          >
                            <ExternalLink className="w-3.5 h-3.5 mr-1" />
                            {t('前往使用')}
                          </Button>
                          {row.status === 'published' && (
                            <Button size="sm" variant="outline" onClick={() => setTakedownTarget(row)}>
                              <Undo2 className="w-3.5 h-3.5 mr-1" />
                              {t('下架')}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 text-sm text-muted-foreground">
                  <span>
                    {t('第 {page} / {total} 页', { page, total: totalPages })}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!takedownTarget}
        onOpenChange={(open) => !open && setTakedownTarget(null)}
        title={t('确认下架')}
        variant="destructive"
        description={t('下架后将从 AI 广场移除并回到私有状态，确定下架「{name}」吗？', {
          name: takedownTarget?.name ?? '',
        })}
        onConfirm={handleTakedown}
        pending={acting}
      />
    </div>
  )
}
