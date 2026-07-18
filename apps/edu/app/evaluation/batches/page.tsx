"use client"

import { FolderKanban, MoreHorizontal, Plus } from "lucide-react"
import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { OrgNodeSelect } from "@/components/shared/org-node-select"
import { MajorSelect } from "@/components/shared/major-select"
import { useAuth } from "@/components/auth-provider"
import { useOrgTree } from "@/hooks/use-org-tree"
import { evaluationBatchApi, workflowApi, majorApi } from "@/lib/api"
import type { EvaluationBatch } from "@/lib/types/evaluation"
import type { Workflow, Major } from "@/lib/types/backend"
import { useToast } from "@/hooks/use-toast"

interface BatchView extends EvaluationBatch {
  workflowName?: string
}

export default function BatchesPage() {
  const { toast } = useToast()
  const { tenantId } = useAuth()
  const { orgMap } = useOrgTree(tenantId)
  const [batches, setBatches] = useState<BatchView[]>([])
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [majorMap, setMajorMap] = useState<Map<string, Major>>(new Map())
  const [loading, setLoading] = useState(false)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingBatch, setEditingBatch] = useState<BatchView | null>(null)
  const [newBatchName, setNewBatchName] = useState("")
  const [newBatchWorkflow, setNewBatchWorkflow] = useState("")
  const [newBatchDepartmentId, setNewBatchDepartmentId] = useState("")
  const [newBatchMajorId, setNewBatchMajorId] = useState("")

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
        toast({ variant: "destructive", title: "加载专业失败", description: err.message || "请稍后重试" })
      })
  }, [tenantId, toast])

  const loadData = async () => {
    setLoading(true)
    try {
      const [batchRes, wfRes] = await Promise.all([
        evaluationBatchApi.list({ limit: 1000 }),
        workflowApi.list({ limit: 1000 }),
      ])
      setWorkflows(wfRes.items)
      const wfMap = new Map(wfRes.items.map((w) => [w.id, w.name]))
      setBatches(
        batchRes.items.map((b) => ({
          ...b,
          workflowName: b.workflowId ? wfMap.get(b.workflowId) : undefined,
        }))
      )
    } catch (err: any) {
      toast({ variant: "destructive", title: "加载失败", description: err.message || "无法获取批次数据" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const resetForm = () => {
    setNewBatchName("")
    setNewBatchWorkflow("")
    setNewBatchDepartmentId("")
    setNewBatchMajorId("")
    setEditingBatch(null)
  }

  const handleAddBatch = async () => {
    if (!newBatchName || !newBatchWorkflow || !newBatchDepartmentId || !newBatchMajorId) return
    try {
      await evaluationBatchApi.create({
        name: newBatchName,
        code: `BG-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 10000)).padStart(4, "0")}`,
        workflowId: newBatchWorkflow,
        status: "open",
        orgNodeId: newBatchDepartmentId,
        majorId: newBatchMajorId,
      })
      await loadData()
      setIsCreateDialogOpen(false)
      resetForm()
      toast({ title: "创建成功" })
    } catch (err: any) {
      toast({ variant: "destructive", title: "创建失败", description: err.message || "请稍后重试" })
    }
  }

  const openEdit = (batch: BatchView) => {
    setEditingBatch(batch)
    setNewBatchName(batch.name)
    setNewBatchWorkflow(batch.workflowId || "")
    setNewBatchDepartmentId(batch.orgNodeId || "")
    setNewBatchMajorId(batch.majorId || "")
    setIsEditDialogOpen(true)
  }

  const handleUpdateBatch = async () => {
    if (!editingBatch || !newBatchName || !newBatchWorkflow) return
    try {
      await evaluationBatchApi.update(editingBatch.id, {
        name: newBatchName,
        code: editingBatch.code,
        workflowId: newBatchWorkflow,
        status: editingBatch.status,
        orgNodeId: newBatchDepartmentId || undefined,
        majorId: newBatchMajorId || undefined,
      })
      await loadData()
      setIsEditDialogOpen(false)
      resetForm()
      toast({ title: "保存成功" })
    } catch (err: any) {
      toast({ variant: "destructive", title: "保存失败", description: err.message || "请稍后重试" })
    }
  }

  const handleDeleteBatch = async (id: string) => {
    if (!confirm("确定删除该批次吗？")) return
    try {
      await evaluationBatchApi.delete(id)
      await loadData()
      toast({ title: "删除成功" })
    } catch (err: any) {
      toast({ variant: "destructive", title: "删除失败", description: err.message || "请稍后重试" })
    }
  }

  const renderForm = (isEdit: boolean) => (
    <div className="grid gap-4 py-4">
      <div className="grid gap-2">
        <Label htmlFor="batchName">分组名称</Label>
        <Input
          id="batchName"
          value={newBatchName}
          onChange={(e) => setNewBatchName(e.target.value)}
          placeholder="例如：2026春季测评资源建设批次"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="department">所属院系 <span className="text-red-500">*</span></Label>
        <OrgNodeSelect
          tenantId={tenantId}
          value={newBatchDepartmentId}
          onChange={(value) => {
            setNewBatchDepartmentId(value || "")
            setNewBatchMajorId("")
          }}
          allowedTypes={["二级学院"]}
          placeholder="选择院系"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="major">所属专业 <span className="text-red-500">*</span></Label>
        <MajorSelect
          tenantId={tenantId}
          orgNodeId={newBatchDepartmentId}
          value={newBatchMajorId}
          onChange={(value) => setNewBatchMajorId(value || "")}
          placeholder="选择专业"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="workflow">关联审批流 <span className="text-red-500">*</span></Label>
        <Select value={newBatchWorkflow} onValueChange={setNewBatchWorkflow}>
          <SelectTrigger id="workflow">
            <SelectValue placeholder="选择审批流程" />
          </SelectTrigger>
          <SelectContent>
            {workflows.map((wf) => (
              <SelectItem key={wf.id} value={wf.id}>
                <span className="inline-flex items-center">
                  <span>{wf.name}</span>
                  <span className="text-xs text-gray-400 ml-2">({wf.steps.length}步)</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-gray-500">批次内所有测评资源将强制使用相同的审批流程</p>
      </div>
    </div>
  )

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">批次分组管理</h1>
          <p className="text-sm text-gray-500 mt-1">管理测评资源建设批次分组，关联审批流程</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              新增批次
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>新增批次</DialogTitle>
              <DialogDescription>创建新的测评资源建设批次分组，并关联审批流程。</DialogDescription>
            </DialogHeader>
            {renderForm(false)}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                取消
              </Button>
              <Button onClick={handleAddBatch} disabled={!newBatchName || !newBatchWorkflow || !newBatchDepartmentId || !newBatchMajorId}>
                创建批次
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>编辑批次</DialogTitle>
            <DialogDescription>修改批次名称与关联审批流程。</DialogDescription>
          </DialogHeader>
          {renderForm(true)}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleUpdateBatch} disabled={!newBatchName || !newBatchWorkflow}>
              保存修改
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FolderKanban className="h-4 w-4" />
            批次列表
          </CardTitle>
          <CardDescription>共 {batches.length} 个批次分组</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="text-xs font-medium text-slate-500">分组名称</TableHead>
                  <TableHead className="text-xs font-medium text-slate-500">批次编号</TableHead>
                  <TableHead className="text-xs font-medium text-slate-500">院系</TableHead>
                  <TableHead className="text-xs font-medium text-slate-500">专业</TableHead>
                  <TableHead className="text-xs font-medium text-slate-500">审批流程</TableHead>
                  <TableHead className="text-xs font-medium text-slate-500">状态</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                      加载中...
                    </TableCell>
                  </TableRow>
                ) : batches.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                      暂无批次数据
                    </TableCell>
                  </TableRow>
                ) : (
                  batches.map((batch) => (
                    <TableRow key={batch.id}>
                      <TableCell className="font-medium">{batch.name}</TableCell>
                      <TableCell className="text-sm text-gray-600">{batch.code || "-"}</TableCell>
                      <TableCell className="text-sm text-gray-600">{orgMap.get(batch.orgNodeId || '')?.name || "—"}</TableCell>
                      <TableCell className="text-sm text-gray-600">{majorMap.get(batch.majorId || '')?.name || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {batch.workflowName || "-"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {batch.status === "open" ? "开启" : "关闭"}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(batch)}>
                              编辑
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => handleDeleteBatch(batch.id)}
                            >
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
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
