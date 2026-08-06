'use client'

import { GitBranch, Pencil, Plus, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { workflowApi, majorApi } from '@/lib/api'
import { useT } from '@/lib/i18n/locale-provider'
import { formatDate } from '@/lib/format-utils'
import type { Workflow } from '@/lib/types/backend'
import { useToast } from '@zhiyu/ui'
import { useAuth } from '@/components/auth-provider'
import {
  WorkflowEditor,
  buildWorkflowSteps,
  WorkflowStepEditor,
} from '@/components/shared/_components/workflow-editor'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { TableRowActions } from '@/components/shared/table-row-actions'
import { reportError } from '@/lib/error-handling'

const DEFAULT_STEP: WorkflowStepEditor = { name: '', approverIds: [], approvalMode: 'any' }

interface WorkflowConfigPageProps {
  subtitle: string
}

export function WorkflowConfigPage({ subtitle }: WorkflowConfigPageProps) {
  const t = useT()
  const { toast } = useToast()
  const { tenantId } = useAuth()
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [majors, setMajors] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [steps, setSteps] = useState<WorkflowStepEditor[]>([{ ...DEFAULT_STEP }])
  const [majorIds, setMajorIds] = useState<string[]>([])
  const [filterMajorId, setFilterMajorId] = useState<string>('all')

  const filteredWorkflows = useMemo(
    () =>
      filterMajorId === 'all'
        ? workflows
        : workflows.filter((wf) => (wf.majorIds || []).includes(filterMajorId)),
    [workflows, filterMajorId],
  )

  const loadWorkflows = useCallback(async () => {
    setLoading(true)
    try {
      const res = await workflowApi.list({ limit: 1000 })
      setWorkflows(res.items)
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: t('加载失败'),
        description: err.message || t('无法获取审批流程'),
      })
    } finally {
      setLoading(false)
    }
  }, [toast, t])

  const loadMajors = useCallback(async () => {
    try {
      const res = await majorApi.list()
      setMajors(res.items || [])
    } catch (err) {
      reportError(err, '加载专业列表')
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!cancelled) await loadWorkflows()
      if (!cancelled) await loadMajors()
    })()
    return () => {
      cancelled = true
    }
  }, [loadWorkflows, loadMajors])

  const reset = () => {
    setName('')
    setDescription('')
    setSteps([{ ...DEFAULT_STEP }])
    setMajorIds([])
    setEditId(null)
    setError(null)
  }

  const openEdit = (wf: Workflow) => {
    setEditId(wf.id)
    setName(wf.name)
    setDescription(wf.description || '')
    setMajorIds(wf.majorIds || [])
    setSteps(
      (wf.steps || []).length > 0
        ? wf.steps.map((s) => ({
            name: s.name || '',
            approverIds: s.approverIds || [],
            approvalMode: s.approvalMode || 'any',
          }))
        : [{ ...DEFAULT_STEP }],
    )
    setError(null)
    setIsEditOpen(true)
  }

  const handleSave = async () => {
    const built = buildWorkflowSteps(steps)
    if (!name.trim()) {
      setError(t('请输入流程名称'))
      return
    }
    if (built.length === 0) {
      setError(t('请至少配置一个审批步骤'))
      return
    }
    setError(null)
    try {
      const body = {
        name: name.trim(),
        description: description.trim() || undefined,
        steps: built,
        status: 'active' as const,
        majorIds,
      }
      if (editId) {
        await workflowApi.update(editId, body)
        toast({ title: t('保存成功') })
      } else {
        await workflowApi.create(body)
        toast({ title: t('创建成功') })
      }
      setIsCreateOpen(false)
      setIsEditOpen(false)
      reset()
      await loadWorkflows()
    } catch (err: any) {
      toast({ variant: 'destructive', title: t('保存失败'), description: err.message })
    }
  }

  const handleDelete = (id: string) => {
    setDeleteTargetId(id)
  }
  const confirmDelete = async () => {
    if (!deleteTargetId) return
    try {
      await workflowApi.delete(deleteTargetId)
      await loadWorkflows()
      toast({ title: t('删除成功') })
    } catch (err: any) {
      toast({ variant: 'destructive', title: t('删除失败'), description: err.message })
    } finally {
      setDeleteTargetId(null)
    }
  }

  const renderDialog = (isEdit: boolean) => (
    <DialogContent className="sm:max-w-[800px] max-h-[85vh] overflow-y-auto overflow-x-hidden">
      <DialogHeader>
        <DialogTitle>{isEdit ? t('编辑审批流程') : t('新增审批流程')}</DialogTitle>
        <DialogDescription>
          {isEdit ? t('修改审批流程配置') : t('创建新的审批流程模板')}
        </DialogDescription>
      </DialogHeader>
      <WorkflowEditor
        error={error}
        name={name}
        onNameChange={setName}
        description={description}
        onDescriptionChange={setDescription}
        steps={steps}
        onStepsChange={setSteps}
        majorIds={majorIds}
        onMajorIdsChange={setMajorIds}
        majors={majors}
        tenantId={tenantId}
      />
      <DialogFooter>
        <Button
          variant="outline"
          onClick={() => {
            setIsCreateOpen(false)
            setIsEditOpen(false)
            reset()
          }}
        >
          {t('取消')}
        </Button>
        <Button onClick={handleSave}>{isEdit ? t('保存修改') : t('创建流程')}</Button>
      </DialogFooter>
    </DialogContent>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{t('审批流程配置')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
        </div>
        <Dialog
          open={isCreateOpen}
          onOpenChange={(o) => {
            if (o) reset()
            setIsCreateOpen(o)
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              {t('新建审批流程')}
            </Button>
          </DialogTrigger>
          {renderDialog(false)}
        </Dialog>
      </div>
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        {renderDialog(true)}
      </Dialog>
      {majors.length > 0 && (
        <Tabs value={filterMajorId} onValueChange={setFilterMajorId}>
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
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <GitBranch className="h-4 w-4" />
            {t('审批流程列表')}
          </CardTitle>
          <CardDescription>
            {t('共 {count} 个审批流程', { count: filteredWorkflows.length })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="text-xs">{t('流程名称')}</TableHead>
                  <TableHead className="text-xs">{t('流程描述')}</TableHead>
                  <TableHead className="text-xs">{t('审批步骤')}</TableHead>
                  <TableHead className="text-xs">{t('适用专业')}</TableHead>
                  <TableHead className="text-xs">{t('创建时间')}</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      {t('加载中...')}
                    </TableCell>
                  </TableRow>
                ) : filteredWorkflows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      {t('暂无审批流程')}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredWorkflows.map((wf) => (
                    <TableRow key={wf.id} className="group">
                      <TableCell className="font-medium">{wf.name}</TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {wf.description || '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {(wf.steps || []).map((s, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {t('{order}.{name}({mode})', {
                                order: idx + 1,
                                name: s.name,
                                mode: s.approvalMode === 'all' ? t('全') : t('任一'),
                              })}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {wf.majorIds?.length
                          ? majors
                              .filter((m) => wf.majorIds.includes(m.id))
                              .map((m) => m.name)
                              .join('、') || wf.majorIds.join(',')
                          : '-'}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {formatDate(wf.createdAt)}
                      </TableCell>
                      <TableRowActions>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => openEdit(wf)}
                        >
                          <Pencil className="mr-1 h-3 w-3" />
                          {t('编辑')}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-red-500 hover:text-red-600"
                          onClick={() => handleDelete(wf.id)}
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
        description={t('确定删除该审批流程吗？')}
        variant="destructive"
        onConfirm={confirmDelete}
      />
    </div>
  )
}
