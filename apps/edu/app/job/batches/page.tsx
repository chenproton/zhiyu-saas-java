'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StatusBadge } from '@/components/shared/status-badge'
import { Badge } from '@/components/ui/badge'
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
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { OrgNodeSelect } from '@/components/shared/org-node-select'
import { MajorSelect } from '@/components/shared/major-select'
import { useAuth } from '@/components/auth-provider'
import { useOrgTree } from '@/hooks/use-org-tree'
import { Plus, Search, Pencil, Trash2, FolderOpen, GitBranch, Loader2, MoreHorizontal } from 'lucide-react'
import Link from 'next/link'
import { batchApi, workflowApi, majorApi } from '@/lib/api'
import { convertJobBatchToBatch, convertApiWorkflowToLocal } from '@/lib/stores/job-converters'
import type { Batch, Workflow } from '@/lib/types/job-source'
import type { Major } from '@/lib/types/backend'
import { useToast } from '@/hooks/use-toast'

export default function BatchesPage() {
  const { toast } = useToast()
  const { tenantId } = useAuth()
  const { orgMap, orgTypeMap } = useOrgTree(tenantId)
  const [batches, setBatches] = useState<Batch[]>([])
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [majorMap, setMajorMap] = useState<Map<string, Major>>(new Map())
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'open' | 'closed'>('all')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    department: '', // org node id (二级学院)
    major: '',      // major id
    workflowId: '',
  })

  useEffect(() => {
    if (!tenantId) {
      setMajorMap(new Map())
      return
    }
    majorApi.list({ tenantId, limit: 1000 })
      .then((res) => {
        setMajorMap(new Map(res.items.map((m) => [m.id, m])))
      })
      .catch((err: any) => {
        toast({ variant: 'destructive', title: '加载专业失败', description: err?.message || '请稍后重试' })
      })
  }, [tenantId, toast])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [batchRes, wfRes] = await Promise.all([
        batchApi.list({ limit: 1000 }),
        workflowApi.list({ limit: 1000 }),
      ])
      setBatches(batchRes.items.map(convertJobBatchToBatch))
      setWorkflows(wfRes.items.map(convertApiWorkflowToLocal))
    } catch (err: any) {
      toast({ variant: 'destructive', title: '加载失败', description: err?.message || '请稍后重试' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadData()
  }, [loadData])

  const filteredBatches = batches.filter((batch) => {
    const deptName = orgMap.get(batch.orgNodeId || batch.department)?.name || ''
    const majorName = majorMap.get(batch.majorId || '')?.name || batch.major || ''
    const matchesSearch =
      batch.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      deptName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      majorName.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = filterStatus === 'all' || batch.status === filterStatus
    return matchesSearch && matchesStatus
  })

  const resetForm = () => {
    setFormData({ name: '', department: '', major: '', workflowId: '' })
    setEditingBatch(null)
  }

  const handleCreate = async () => {
    if (!formData.name || !formData.department || !formData.major || !formData.workflowId) {
      toast({ variant: 'destructive', title: '请完整填写', description: '批次名称、所属院系、专业方向、审批流程均为必填' })
      return
    }
    try {
      await batchApi.create({
        name: formData.name,
        status: 'open',
        orgNodeId: formData.department || undefined,
        majorId: formData.major || undefined,
        workflowId: formData.workflowId || undefined,
      })
      await loadData()
      setIsCreateOpen(false)
      resetForm()
    } catch (err: any) {
      toast({ variant: 'destructive', title: '创建失败', description: err?.message || '请稍后重试' })
    }
  }

  const handleEdit = (batch: Batch) => {
    setEditingBatch(batch)
    setFormData({
      name: batch.name,
      department: batch.department,
      major: batch.majorId || batch.major || '',
      workflowId: batch.workflowId,
    })
  }

  const handleUpdate = async () => {
    if (!editingBatch) return
    try {
      await batchApi.update(editingBatch.id, {
        name: formData.name,
        orgNodeId: formData.department || undefined,
        majorId: formData.major || undefined,
        workflowId: formData.workflowId || undefined,
      })
      await loadData()
      setEditingBatch(null)
      resetForm()
    } catch (err: any) {
      toast({ variant: 'destructive', title: '更新失败', description: err?.message || '请稍后重试' })
    }
  }

  const handleToggleStatus = async (batch: Batch) => {
    try {
      const newStatus = batch.status === 'open' ? 'closed' : 'open'
      await batchApi.updateStatus(batch.id, newStatus)
      await loadData()
    } catch (err: any) {
      toast({ variant: 'destructive', title: '操作失败', description: err?.message || '请稍后重试' })
    }
  }

  const handleDelete = async (batchId: string) => {
    if (!confirm('确定要删除这个批次吗？')) return
    try {
      await batchApi.delete(batchId)
      await loadData()
    } catch (err: any) {
      toast({ variant: 'destructive', title: '删除失败', description: err?.message || '请稍后重试' })
    }
  }

  const getWorkflowName = (workflowId: string) => {
    const workflow = workflows.find(w => w.id === workflowId)
    return workflow?.name || '-'
  }

  const submitForm = (isEdit: boolean) => {
    if (isEdit) handleUpdate()
    else handleCreate()
  }

  const cancelForm = (isEdit: boolean) => {
    if (isEdit) setEditingBatch(null)
    else setIsCreateOpen(false)
    resetForm()
  }

  const renderBatchForm = (isEdit = false) => (
    <FieldGroup className="gap-4">
      <Field>
        <FieldLabel>批次名称</FieldLabel>
        <Input
          placeholder="例如：2024年春季岗位建设批次"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        />
      </Field>
      <Field>
        <FieldLabel>所属院系</FieldLabel>
        <OrgNodeSelect
          tenantId={tenantId}
          value={formData.department}
          onChange={(value) => setFormData({ ...formData, department: value || '', major: '' })}
          allowedTypes={['二级学院']}
          placeholder="选择院系"
        />
      </Field>
      <Field>
        <FieldLabel>专业方向</FieldLabel>
        <MajorSelect
          tenantId={tenantId}
          orgNodeId={formData.department}
          value={formData.major}
          onChange={(value) => setFormData({ ...formData, major: value || '' })}
          placeholder="选择专业"
        />
      </Field>
      <Field>
        <FieldLabel>审批流程</FieldLabel>
        <Select
          value={formData.workflowId}
          onValueChange={(value) => setFormData({ ...formData, workflowId: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="选择审批流程" />
          </SelectTrigger>
          <SelectContent>
            {workflows.map((workflow) => (
              <SelectItem key={workflow.id} value={workflow.id}>
                {workflow.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <DialogFooter>
        <Button variant="outline" onClick={() => cancelForm(isEdit)}>
          取消
        </Button>
        <Button onClick={() => submitForm(isEdit)}>
          {isEdit ? '保存' : '创建'}
        </Button>
      </DialogFooter>
    </FieldGroup>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">批次管理</h1>
          <p className="text-muted-foreground mt-1">管理岗位建设批次，设置审批流程</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              新建批次
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>新建批次</DialogTitle>
              <DialogDescription>创建一个新的岗位建设批次</DialogDescription>
            </DialogHeader>
            {renderBatchForm()}
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="搜索批次名称、院系、专业..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as typeof filterStatus)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="open">开放中</SelectItem>
                <SelectItem value="closed">已截止</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle>批次列表</CardTitle>
            {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
          <CardDescription>共 {filteredBatches.length} 个批次</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>批次名称</TableHead>
                <TableHead>院系</TableHead>
                <TableHead>专业</TableHead>
                <TableHead>关联审批流程</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>岗位数</TableHead>
                <TableHead>已上架</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBatches.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <FolderOpen className="h-10 w-10 mb-2" />
                      <p>暂无批次数据</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredBatches.map((batch) => (
                  <TableRow key={batch.id} className="group">
                    <TableCell>
                      <Link
                        href={`/job/batches/${batch.id}`}
                        className="font-medium text-foreground hover:text-primary"
                      >
                        {batch.name}
                      </Link>
                    </TableCell>
                    <TableCell>{orgMap.get(batch.orgNodeId || batch.department)?.name || '—'}</TableCell>
                    <TableCell>{majorMap.get(batch.majorId || '')?.name || batch.major || '—'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="gap-1">
                        <GitBranch className="h-3 w-3" />
                        {getWorkflowName(batch.workflowId)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={batch.status} />
                    </TableCell>
                    <TableCell>{batch.positionCount}</TableCell>
                    <TableCell>{batch.publishedCount}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(batch)}>
                            编辑
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggleStatus(batch)}>
                            {batch.status === 'open' ? '截止批次' : '重新开放'}
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(batch.id)}>
                            删除
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!editingBatch} onOpenChange={(open) => !open && setEditingBatch(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑批次</DialogTitle>
            <DialogDescription>修改批次信息</DialogDescription>
          </DialogHeader>
          {renderBatchForm(true)}
        </DialogContent>
      </Dialog>
    </div>
  )
}
