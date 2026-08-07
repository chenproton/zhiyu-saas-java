'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { addDays, format } from 'date-fns'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { PaginationBar } from '@/components/shared/pagination-bar'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { useToast } from '@zhiyu/ui'
import type { UncitedItem } from '@/lib/types/library'

const PAGE_SIZE = 20

interface UncitedResourcesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 弹窗标题，如「零引用知识点」 */
  title: string
  /** 实体名称，如「知识点」「资源」 */
  entityLabel: string
  fetchUncited: (params: {
    startDate?: string
    endDate?: string
    limit: number
    offset: number
  }) => Promise<{ items: UncitedItem[]; total: number }>
  deleteItem: (id: string) => Promise<unknown>
  /** 批量删除成功后回调（刷新页面列表/统计） */
  onDeleted?: () => void
}

/**
 * 零引用资源列表弹窗：按「距今天数」区间筛选、分页展示上传时间与距今天数、批量删除。
 * 引用次数与上传时间定义均来自后端 citation-stats/uncited 接口。
 */
export function UncitedResourcesDialog({
  open,
  onOpenChange,
  title,
  entityLabel,
  fetchUncited,
  deleteItem,
  onDeleted,
}: UncitedResourcesDialogProps) {
  const { toast } = useToast()
  // props 经 ref 同步，避免调用方内联函数身份变化触发弹窗内 effect 重复加载
  const propsRef = useRef({ fetchUncited, deleteItem, onDeleted })
  // 距今天数区间筛选：[minDays, maxDays]，空值表示不设边界
  const [minDays, setMinDays] = useState<number | undefined>(undefined)
  const [maxDays, setMaxDays] = useState<number | undefined>(undefined)
  const [items, setItems] = useState<UncitedItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  // 打开弹窗时记录当前时间：now 仅驱动「距今 X 天」列渲染，
  // 换算筛选日期走 nowRef，避免 load 依赖 now 引发 effect 重载循环
  const nowRef = useRef(0)
  const [now, setNow] = useState(0)

  useEffect(() => {
    propsRef.current = { fetchUncited, deleteItem, onDeleted }
  }, [fetchUncited, deleteItem, onDeleted])

  const load = useCallback(
    async (targetPage: number) => {
      setLoading(true)
      try {
        const base = nowRef.current || Date.now()
        const params: {
          startDate?: string
          endDate?: string
          limit: number
          offset: number
        } = {
          limit: PAGE_SIZE,
          offset: (targetPage - 1) * PAGE_SIZE,
        }
        if (maxDays !== undefined) {
          params.startDate = format(addDays(new Date(base), -maxDays), 'yyyy-MM-dd')
        }
        if (minDays !== undefined) {
          params.endDate = format(addDays(new Date(base), -minDays), 'yyyy-MM-dd')
        }
        const res = await propsRef.current.fetchUncited(params)
        setItems(res.items || [])
        setTotal(res.total || 0)
        setSelected(new Set())
      } catch (err: any) {
        toast({
          variant: 'destructive',
          title: '加载失败',
          description: err.message || '无法获取列表',
        })
      } finally {
        setLoading(false)
      }
    },
    [minDays, maxDays, toast],
  )

  // 将打开弹窗/筛选变化视为外部事件：在微任务回调中重置页码并加载首屏，避免 effect 体内同步 setState
  useEffect(() => {
    if (!open) return
    Promise.resolve().then(() => {
      nowRef.current = Date.now()
      setNow(nowRef.current)
      setPage(1)
      void load(1)
    })
  }, [open, load])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const handlePageChange = (p: number) => {
    setPage(p)
    void load(p)
  }

  const handleDaysInput = (kind: 'min' | 'max', value: string) => {
    const parsed = value === '' ? undefined : Math.max(0, Math.floor(Number(value)))
    if (kind === 'min') {
      setMinDays(parsed)
    } else {
      setMaxDays(parsed)
    }
  }

  const clearFilter = () => {
    setMinDays(undefined)
    setMaxDays(undefined)
  }

  const toggleAll = (checked: boolean) => {
    if (checked) {
      setSelected(new Set(items.map((it) => it.id)))
    } else {
      setSelected(new Set())
    }
  }

  const toggleOne = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) {
        next.add(id)
      } else {
        next.delete(id)
      }
      return next
    })
  }

  const confirmBatchDelete = async () => {
    if (selected.size === 0) return
    setDeleting(true)
    try {
      await Promise.all([...selected].map((id) => propsRef.current.deleteItem(id)))
      toast({ title: `已批量删除 ${selected.size} 个${entityLabel}` })
      propsRef.current.onDeleted?.()
      const remainingPages = Math.max(1, Math.ceil((total - selected.size) / PAGE_SIZE))
      const nextPage = Math.min(page, remainingPages)
      setPage(nextPage)
      await load(nextPage)
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: '批量删除失败',
        description: err.message || '请稍后重试',
      })
    } finally {
      setDeleting(false)
      setConfirmOpen(false)
    }
  }

  const daysAgo = (createdAt: string) => {
    const diff = now - new Date(createdAt).getTime()
    return Math.max(0, Math.floor(diff / 86400000))
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              共 {total} 个零引用{entityLabel}，可按距今天数区间筛选
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500 whitespace-nowrap">距今</span>
            <Input
              type="number"
              min={0}
              value={minDays ?? ''}
              onChange={(e) => handleDaysInput('min', e.target.value)}
              placeholder="最小"
              className="w-24"
            />
            <span className="text-slate-400">~</span>
            <Input
              type="number"
              min={0}
              value={maxDays ?? ''}
              onChange={(e) => handleDaysInput('max', e.target.value)}
              placeholder="最大"
              className="w-24"
            />
            <span className="text-sm text-slate-500 whitespace-nowrap">天</span>
            {(minDays !== undefined || maxDays !== undefined) && (
              <Button variant="ghost" size="sm" onClick={clearFilter}>
                清除筛选
              </Button>
            )}
            {selected.size > 0 && (
              <Button
                variant="destructive"
                size="sm"
                className="ml-auto"
                onClick={() => setConfirmOpen(true)}
                disabled={deleting}
              >
                <Trash2 className="size-4 mr-1" />
                删除选中（{selected.size}）
              </Button>
            )}
          </div>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                  <TableHead className="p-3 w-10">
                    <Checkbox
                      checked={items.length > 0 && selected.size === items.length}
                      onCheckedChange={toggleAll}
                      aria-label="全选"
                    />
                  </TableHead>
                  <TableHead className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    名称
                  </TableHead>
                  <TableHead className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    上传时间
                  </TableHead>
                  <TableHead className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">
                    距今
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={4} className="p-10 text-center text-muted-foreground">
                      加载中...
                    </TableCell>
                  </TableRow>
                )}
                {!loading && items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="p-10 text-center text-muted-foreground">
                      该天数区间内没有零引用{entityLabel}
                    </TableCell>
                  </TableRow>
                )}
                {items.map((item) => (
                  <TableRow key={item.id} className="hover:bg-slate-50/50">
                    <TableCell className="p-3">
                      <Checkbox
                        checked={selected.has(item.id)}
                        onCheckedChange={(checked) => toggleOne(item.id, !!checked)}
                        aria-label="选择"
                      />
                    </TableCell>
                    <TableCell className="p-3">
                      <span className="text-sm font-medium text-slate-700 line-clamp-1">
                        {item.name}
                      </span>
                    </TableCell>
                    <TableCell className="p-3 text-sm text-slate-400 whitespace-nowrap">
                      {format(new Date(item.createdAt), 'yyyy-MM-dd HH:mm')}
                    </TableCell>
                    <TableCell className="p-3 text-sm text-slate-400 text-right whitespace-nowrap">
                      {daysAgo(item.createdAt)} 天
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {totalPages > 1 && (
            <div className="flex justify-end">
              <PaginationBar
                page={page}
                totalPages={totalPages}
                onPageChange={handlePageChange}
                disabled={loading}
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="确认批量删除"
        description={`确定要删除选中的 ${selected.size} 个${entityLabel}吗？此操作不可恢复。`}
        confirmText="删除"
        variant="destructive"
        pending={deleting}
        onConfirm={confirmBatchDelete}
      />
    </>
  )
}
