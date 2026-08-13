'use client'

import { Check, FolderKanban, Pencil, Plus, Power, RotateCcw, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { SearchInput } from '@/components/shared/search-input'
import { Label } from '@/components/ui/label'
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
import { useAuth } from '@/components/auth-provider'
import { StatusBadge } from '@/components/shared/status-badge'
import { workflowApi, majorApi } from '@/lib/api'
import type { Workflow, Major } from '@/lib/types/backend'
import { useToast } from '@zhiyu/ui'
import { cn } from '@/lib/utils'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { TableRowActions } from '@/components/shared/table-row-actions'
import { useT } from '@/lib/i18n/locale-provider'

export interface BatchGroupItem {
  id: string
  name: string
  code?: string
  workflowId?: string
  status: 'open' | 'closed'
}

export interface BatchGroupApi {
  list: (
    params?: Record<string, string | number | boolean | undefined>,
  ) => Promise<{ items: BatchGroupItem[] }>
  create: (body: Omit<BatchGroupItem, 'id'>) => Promise<BatchGroupItem>
  update: (id: string, body: Partial<Omit<BatchGroupItem, 'id'>>) => Promise<BatchGroupItem>
  delete: (id: string) => Promise<{ id: string }>
  updateStatus: (id: string, status: string) => Promise<BatchGroupItem>
}

interface BatchGroupPageProps {
  api: BatchGroupApi
  subtitle: string
  namePlaceholder: string
  workflowHint: string
  detailHref?: (id: string) => string
}

interface BatchView extends BatchGroupItem {
  workflowName?: string
}

export function BatchGroupPage({
  api,
  subtitle,
  namePlaceholder,
  workflowHint,
  detailHref,
}: BatchGroupPageProps) {
  const { toast } = useToast()
  const { tenantId } = useAuth()
  const t = useT()
  const [batches, setBatches] = useState<BatchView[]>([])
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [majors, setMajors] = useState<Major[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'open' | 'closed'>('all')
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingBatch, setEditingBatch] = useState<BatchView | null>(null)
  const [newBatchName, setNewBatchName] = useState('')
  const [newBatchWorkflow, setNewBatchWorkflow] = useState('')
  const [selectedMajorId, setSelectedMajorId] = useState('all')
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)

  useEffect(() => {
    if (!tenantId) {
      queueMicrotask(() => setMajors([]))
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const res = await majorApi.list({ tenantId, limit: 1000 })
        if (!cancelled) setMajors(res.items.filter((m) => m.enabled))
      } catch (err: any) {
        if (!cancelled) {
          toast({
            variant: 'destructive',
            title: t('加载专业失败'),
            description: err.message || t('请稍后重试'),
          })
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [tenantId, toast, t])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [batchRes, wfRes] = await Promise.all([
        api.list({ limit: 1000 }),
        workflowApi.list({ limit: 1000 }),
      ])
      setWorkflows(wfRes.items)
      const wfMap = new Map(wfRes.items.map((w) => [w.id, w.name]))
      setBatches(
        (batchRes.items as BatchGroupItem[]).map((b) => ({
          ...b,
          workflowName: b.workflowId ? wfMap.get(b.workflowId) : undefined,
        })),
      )
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: t('加载失败'),
        description: err.message || t('无法获取批次数据'),
      })
    } finally {
      setLoading(false)
    }
  }, [api, toast, t])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!cancelled) await loadData()
    })()
    return () => {
      cancelled = true
    }
  }, [loadData])

  const filteredWorkflows = useMemo(() => {
    if (selectedMajorId === 'all') return workflows
    return workflows.filter((wf) => (wf.majorIds || []).includes(selectedMajorId))
  }, [workflows, selectedMajorId])

  const filteredBatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return batches.filter((batch) => {
      const matchesSearch =
        !q || batch.name.toLowerCase().includes(q) || (batch.code || '').toLowerCase().includes(q)
      const matchesStatus = filterStatus === 'all' || batch.status === filterStatus
      return matchesSearch && matchesStatus
    })
  }, [batches, searchQuery, filterStatus])

  const resetForm = () => {
    setNewBatchName('')
    setNewBatchWorkflow('')
    setSelectedMajorId('all')
    setEditingBatch(null)
  }

  const handleAddBatch = async () => {
    if (!newBatchName || !newBatchWorkflow) return
    try {
      await api.create({
        name: newBatchName,
        code:
          'BG-' +
          new Date().getFullYear() +
          '-' +
          String(Math.floor(Math.random() * 10000)).padStart(4, '0'),
        workflowId: newBatchWorkflow,
        status: 'open',
      })
      await loadData()
      setIsCreateDialogOpen(false)
      resetForm()
      toast({ title: t('创建成功') })
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: t('创建失败'),
        description: err.message || t('请稍后重试'),
      })
    }
  }

  const openEdit = (batch: BatchView) => {
    setEditingBatch(batch)
    setNewBatchName(batch.name)
    setNewBatchWorkflow(batch.workflowId || '')
    setSelectedMajorId('all')
    setIsEditDialogOpen(true)
  }

  const handleUpdateBatch = async () => {
    if (!editingBatch || !newBatchName || !newBatchWorkflow) return
    try {
      await api.update(editingBatch.id, {
        name: newBatchName,
        code: editingBatch.code,
        workflowId: newBatchWorkflow,
        status: editingBatch.status,
      })
      await loadData()
      setIsEditDialogOpen(false)
      resetForm()
      toast({ title: t('保存成功') })
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: t('保存失败'),
        description: err.message || t('请稍后重试'),
      })
    }
  }

  const handleToggleStatus = async (batch: BatchView) => {
    try {
      const newStatus = batch.status === 'open' ? 'closed' : 'open'
      await api.updateStatus(batch.id, newStatus)
      await loadData()
      toast({ title: newStatus === 'open' ? t('批次已重新开放') : t('批次已截止') })
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: t('操作失败'),
        description: err.message || t('请稍后重试'),
      })
    }
  }

  const handleDeleteBatch = (id: string) => {
    setDeleteTargetId(id)
  }
  const confirmDeleteBatch = async () => {
    if (!deleteTargetId) return
    try {
      await api.delete(deleteTargetId)
      await loadData()
      toast({ title: t('删除成功') })
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: t('删除失败'),
        description: err.message || t('请稍后重试'),
      })
    } finally {
      setDeleteTargetId(null)
    }
  }

  const renderForm = () => (
    <div className="grid gap-4 py-4">
      <div className="grid gap-2">
        <Label htmlFor="batchName">{t('分组名称')}</Label>
        <Input
          id="batchName"
          value={newBatchName}
          onChange={(e) => setNewBatchName(e.target.value)}
          placeholder={namePlaceholder}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="workflow">
          {t('关联审批流')} <span className="text-red-500">*</span>
        </Label>
        {majors.length > 0 && (
          <Tabs value={selectedMajorId} onValueChange={setSelectedMajorId}>
            <TabsList className="h-auto flex-wrap justify-start">
              <TabsTrigger value="all">{t('全部专业')}</TabsTrigger>
              {majors.map((m) => (
                <TabsTrigger key={m.id} value={m.id}>
                  {m.name}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden max-h-[260px] overflow-y-auto">
          {filteredWorkflows.length === 0 ? (
            <div className="px-4 py-6 text-sm text-gray-500 text-center">{t('暂无审批流程')}</div>
          ) : (
            filteredWorkflows.map((wf) => {
              const selected = newBatchWorkflow === wf.id
              return (
                <div
                  key={wf.id}
                  onClick={() => setNewBatchWorkflow(wf.id)}
                  className={cn(
                    'px-4 py-3 cursor-pointer border-b border-slate-100 last:border-b-0 hover:bg-slate-50 flex items-start justify-between gap-3',
                    selected && 'bg-primary/5',
                  )}
                >
                  <div className="min-w-0">
                    <div className={cn('font-medium text-sm', selected && 'text-primary')}>
                      {wf.name}
                    </div>
                    {wf.description ? (
                      <div className="text-xs text-gray-500 mt-0.5 truncate">{wf.description}</div>
                    ) : null}
                    <div className="text-xs text-gray-400 mt-1">
                      {t('{n} 个审批步骤', { n: (wf.steps || []).length })}
                    </div>
                  </div>
                  {selected && <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />}
                </div>
              )
            })
          )}
        </div>
        <p className="text-xs text-gray-500">{workflowHint}</p>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{t('批次分组管理')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              {t('新建批次')}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{t('新增批次')}</DialogTitle>
              <DialogDescription>{t('创建新的批次分组，并关联审批流程。')}</DialogDescription>
            </DialogHeader>
            {renderForm()}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                {t('取消')}
              </Button>
              <Button onClick={handleAddBatch} disabled={!newBatchName || !newBatchWorkflow}>
                {t('创建批次')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{t('编辑批次')}</DialogTitle>
            <DialogDescription>{t('修改批次名称与关联审批流程。')}</DialogDescription>
          </DialogHeader>
          {renderForm()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              {t('取消')}
            </Button>
            <Button onClick={handleUpdateBatch} disabled={!newBatchName || !newBatchWorkflow}>
              {t('保存修改')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <SearchInput
              wrapperClassName="flex-1"
              placeholder={t('搜索批次名称、编号...')}
              value={searchQuery}
              onChange={setSearchQuery}
            />
            <Select
              value={filterStatus}
              onValueChange={(v) => setFilterStatus(v as typeof filterStatus)}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('全部状态')}</SelectItem>
                <SelectItem value="open">{t('开放中')}</SelectItem>
                <SelectItem value="closed">{t('已截止')}</SelectItem>
              </SelectContent>
            </Select>
            {(searchQuery || filterStatus !== 'all') && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery('')
                  setFilterStatus('all')
                }}
              >
                <RotateCcw className="mr-1 h-3.5 w-3.5" />
                {t('重置')}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FolderKanban className="h-4 w-4" />
            {t('批次列表')}
          </CardTitle>
          <CardDescription>{t('共 {n} 个批次分组', { n: filteredBatches.length })}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="text-xs font-medium text-slate-500">
                    {t('分组名称')}
                  </TableHead>
                  <TableHead className="text-xs font-medium text-slate-500">
                    {t('批次编号')}
                  </TableHead>
                  <TableHead className="text-xs font-medium text-slate-500">
                    {t('审批流程')}
                  </TableHead>
                  <TableHead className="text-xs font-medium text-slate-500">{t('状态')}</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                      {t('加载中...')}
                    </TableCell>
                  </TableRow>
                ) : filteredBatches.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                      {t('暂无批次数据')}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredBatches.map((batch) => (
                    <TableRow key={batch.id} className="group">
                      <TableCell className="font-medium">
                        {detailHref ? (
                          <Link
                            href={detailHref(batch.id)}
                            prefetch={false}
                            className="hover:text-primary"
                          >
                            {batch.name}
                          </Link>
                        ) : (
                          batch.name
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">{batch.code || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {batch.workflowName || '-'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        <StatusBadge
                          status={batch.status}
                          label={batch.status === 'open' ? t('开放中') : t('已截止')}
                        />
                      </TableCell>
                      <TableRowActions>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => openEdit(batch)}
                        >
                          <Pencil className="mr-1 h-3 w-3" />
                          {t('编辑')}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => handleToggleStatus(batch)}
                        >
                          <Power className="mr-1 h-3 w-3" />
                          {batch.status === 'open' ? t('截止批次') : t('重新开放')}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-red-500 hover:text-red-600"
                          onClick={() => handleDeleteBatch(batch.id)}
                        >
                          <Trash2 className="mr-1 h-3 w-3" />
                          {t('删除')}
                        </Button>
                      </TableRowActions>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      <ConfirmDialog
        open={deleteTargetId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTargetId(null)
        }}
        title={t('确认删除')}
        description={t('确定删除该批次吗？')}
        variant="destructive"
        onConfirm={confirmDeleteBatch}
      />
    </div>
  )
}
