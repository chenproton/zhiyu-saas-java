"use client"

import { FolderKanban, MoreHorizontal, Plus, RotateCcw, Search } from "lucide-react"
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
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
import { MajorSelect } from "@/components/shared/major-select"
import { useAuth } from "@/components/auth-provider"
import { workflowApi, majorApi } from "@/lib/api"
import type { Workflow, Major } from "@/lib/types/backend"
import { useToast } from "@/hooks/use-toast"

export interface BatchGroupItem {
  id: string
  name: string
  code?: string
  majorId?: string
  majorName?: string
  workflowId?: string
  status: string
}

export interface BatchGroupApi {
  list: (params?: Record<string, string | number | boolean | undefined>) => Promise<{ items: any[] }>
  create: (body: any) => Promise<any>
  update: (id: string, body: any) => Promise<any>
  delete: (id: string) => Promise<any>
  updateStatus: (id: string, status: string) => Promise<any>
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

export function BatchGroupPage({ api, subtitle, namePlaceholder, workflowHint, detailHref }: BatchGroupPageProps) {
  const { toast } = useToast()
  const { tenantId } = useAuth()
  const [batches, setBatches] = useState<BatchView[]>([])
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [majorMap, setMajorMap] = useState<Map<string, Major>>(new Map())
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterStatus, setFilterStatus] = useState<"all" | "open" | "closed">("all")
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingBatch, setEditingBatch] = useState<BatchView | null>(null)
  const [newBatchName, setNewBatchName] = useState("")
  const [newBatchWorkflow, setNewBatchWorkflow] = useState("")
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
        api.list({ limit: 1000 }),
        workflowApi.list({ limit: 1000 }),
      ])
      setWorkflows(wfRes.items)
      const wfMap = new Map(wfRes.items.map((w) => [w.id, w.name]))
      setBatches(
        (batchRes.items as BatchGroupItem[]).map((b) => ({
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const majorName = (batch: BatchView) =>
    majorMap.get(batch.majorId || "")?.name || batch.majorName || ""

  const filteredBatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return batches.filter((batch) => {
      const matchesSearch =
        !q ||
        batch.name.toLowerCase().includes(q) ||
        (batch.code || "").toLowerCase().includes(q) ||
        majorName(batch).toLowerCase().includes(q)
      const matchesStatus = filterStatus === "all" || batch.status === filterStatus
      return matchesSearch && matchesStatus
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batches, searchQuery, filterStatus, majorMap])

  const resetForm = () => {
    setNewBatchName("")
    setNewBatchWorkflow("")
    setNewBatchMajorId("")
    setEditingBatch(null)
  }

  const handleAddBatch = async () => {
    if (!newBatchName || !newBatchWorkflow || !newBatchMajorId) return
    try {
      await api.create({
        name: newBatchName,
        code: `BG-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 10000)).padStart(4, "0")}`,
        workflowId: newBatchWorkflow,
        status: "open",
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
    setNewBatchMajorId(batch.majorId || "")
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

  const handleToggleStatus = async (batch: BatchView) => {
    try {
      const newStatus = batch.status === "open" ? "closed" : "open"
      await api.updateStatus(batch.id, newStatus)
      await loadData()
      toast({ title: newStatus === "open" ? "批次已重新开放" : "批次已截止" })
    } catch (err: any) {
      toast({ variant: "destructive", title: "操作失败", description: err.message || "请稍后重试" })
    }
  }

  const handleDeleteBatch = async (id: string) => {
    if (!confirm("确定删除该批次吗？")) return
    try {
      await api.delete(id)
      await loadData()
      toast({ title: "删除成功" })
    } catch (err: any) {
      toast({ variant: "destructive", title: "删除失败", description: err.message || "请稍后重试" })
    }
  }

  const renderForm = () => (
    <div className="grid gap-4 py-4">
      <div className="grid gap-2">
        <Label htmlFor="batchName">分组名称</Label>
        <Input
          id="batchName"
          value={newBatchName}
          onChange={(e) => setNewBatchName(e.target.value)}
          placeholder={namePlaceholder}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="major">所属专业 <span className="text-red-500">*</span></Label>
        <MajorSelect
          tenantId={tenantId}
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
                  <span className="text-xs text-gray-400 ml-2">({(wf.steps || []).length}步)</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-gray-500">{workflowHint}</p>
      </div>
    </div>
  )

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">批次分组管理</h1>
          <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
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
              <DialogDescription>创建新的批次分组，并关联审批流程。</DialogDescription>
            </DialogHeader>
            {renderForm()}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                取消
              </Button>
              <Button onClick={handleAddBatch} disabled={!newBatchName || !newBatchWorkflow || !newBatchMajorId}>
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
          {renderForm()}
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
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="搜索批次名称、编号、专业..."
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
            {(searchQuery || filterStatus !== "all") && (
              <Button variant="outline" size="sm" onClick={() => { setSearchQuery(""); setFilterStatus("all") }}>
                <RotateCcw className="mr-1 h-3.5 w-3.5" />
                重置
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FolderKanban className="h-4 w-4" />
            批次列表
          </CardTitle>
          <CardDescription>共 {filteredBatches.length} 个批次分组</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="text-xs font-medium text-slate-500">分组名称</TableHead>
                  <TableHead className="text-xs font-medium text-slate-500">批次编号</TableHead>
                  <TableHead className="text-xs font-medium text-slate-500">专业</TableHead>
                  <TableHead className="text-xs font-medium text-slate-500">审批流程</TableHead>
                  <TableHead className="text-xs font-medium text-slate-500">状态</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                      加载中...
                    </TableCell>
                  </TableRow>
                ) : filteredBatches.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                      暂无批次数据
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredBatches.map((batch) => (
                    <TableRow key={batch.id}>
                      <TableCell className="font-medium">
                        {detailHref ? (
                          <Link href={detailHref(batch.id)} className="hover:text-primary">
                            {batch.name}
                          </Link>
                        ) : (
                          batch.name
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">{batch.code || "-"}</TableCell>
                      <TableCell className="text-sm text-gray-600">{majorName(batch) || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {batch.workflowName || "-"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        <Badge variant={batch.status === "open" ? "secondary" : "outline"} className="text-xs">
                          {batch.status === "open" ? "开放中" : "已截止"}
                        </Badge>
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
                            <DropdownMenuItem onClick={() => handleToggleStatus(batch)}>
                              {batch.status === "open" ? "截止批次" : "重新开放"}
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
