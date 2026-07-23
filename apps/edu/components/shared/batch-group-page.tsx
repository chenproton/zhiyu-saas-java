"use client"

import { Check, FolderKanban, Pencil, Plus, Power, RotateCcw, Search, Trash2 } from "lucide-react"
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuth } from "@/components/auth-provider"
import { workflowApi, majorApi } from "@/lib/api"
import type { Workflow, Major } from "@/lib/types/backend"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

export interface BatchGroupItem {
  id: string
  name: string
  code?: string
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
  scene?: string
}

interface BatchView extends BatchGroupItem {
  workflowName?: string
}

export function BatchGroupPage({ api, subtitle, namePlaceholder, workflowHint, detailHref, scene }: BatchGroupPageProps) {
  const { toast } = useToast()
  const { tenantId } = useAuth()
  const [batches, setBatches] = useState<BatchView[]>([])
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [majors, setMajors] = useState<Major[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterStatus, setFilterStatus] = useState<"all" | "open" | "closed">("all")
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingBatch, setEditingBatch] = useState<BatchView | null>(null)
  const [newBatchName, setNewBatchName] = useState("")
  const [newBatchWorkflow, setNewBatchWorkflow] = useState("")
  const [selectedMajorId, setSelectedMajorId] = useState("all")

  useEffect(() => {
    if (!tenantId) {
      setMajors([])
      return
    }
    majorApi.list({ tenantId, limit: 1000 })
      .then((res) => {
        setMajors(res.items.filter((m) => m.enabled))
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
        workflowApi.list({ scene, limit: 1000 }),
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

  const filteredWorkflows = useMemo(() => {
    if (selectedMajorId === "all") return workflows
    return workflows.filter((wf) => (wf.majorIds || []).includes(selectedMajorId))
  }, [workflows, selectedMajorId])

  const filteredBatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return batches.filter((batch) => {
      const matchesSearch =
        !q ||
        batch.name.toLowerCase().includes(q) ||
        (batch.code || "").toLowerCase().includes(q)
      const matchesStatus = filterStatus === "all" || batch.status === filterStatus
      return matchesSearch && matchesStatus
    })
  }, [batches, searchQuery, filterStatus])

  const resetForm = () => {
    setNewBatchName("")
    setNewBatchWorkflow("")
    setSelectedMajorId("all")
    setEditingBatch(null)
  }

  const handleAddBatch = async () => {
    if (!newBatchName || !newBatchWorkflow) return
    try {
      await api.create({
        name: newBatchName,
        code: "BG-" + new Date().getFullYear() + "-" + String(Math.floor(Math.random() * 10000)).padStart(4, "0"),
        workflowId: newBatchWorkflow,
        status: "open",
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
    setSelectedMajorId("all")
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
        <Label htmlFor="workflow">关联审批流 <span className="text-red-500">*</span></Label>
        {majors.length > 0 && (
          <Tabs value={selectedMajorId} onValueChange={setSelectedMajorId}>
            <TabsList className="h-auto flex-wrap justify-start">
              <TabsTrigger value="all">全部专业</TabsTrigger>
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
            <div className="px-4 py-6 text-sm text-gray-500 text-center">
              暂无审批流程
            </div>
          ) : (
            filteredWorkflows.map((wf) => {
              const selected = newBatchWorkflow === wf.id
              return (
                <div
                  key={wf.id}
                  onClick={() => setNewBatchWorkflow(wf.id)}
                  className={cn(
                    "px-4 py-3 cursor-pointer border-b border-slate-100 last:border-b-0 hover:bg-slate-50 flex items-start justify-between gap-3",
                    selected && "bg-primary/5"
                  )}
                >
                  <div className="min-w-0">
                    <div className={cn("font-medium text-sm", selected && "text-primary")}>
                      {wf.name}
                    </div>
                    {wf.description ? (
                      <div className="text-xs text-gray-500 mt-0.5 truncate">{wf.description}</div>
                    ) : null}
                    <div className="text-xs text-gray-400 mt-1">
                      {(wf.steps || []).length} 个审批步骤
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
              <Button onClick={handleAddBatch} disabled={!newBatchName || !newBatchWorkflow}>
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
                placeholder="搜索批次名称、编号..."
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
                  <TableHead className="text-xs font-medium text-slate-500">审批流程</TableHead>
                  <TableHead className="text-xs font-medium text-slate-500">状态</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                      加载中...
                    </TableCell>
                  </TableRow>
                ) : filteredBatches.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                      暂无批次数据
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredBatches.map((batch) => (
                    <TableRow key={batch.id} className="group">
                      <TableCell className="font-medium">
                        {detailHref ? (
                          <Link href={detailHref(batch.id)} prefetch={false} className="hover:text-primary">
                            {batch.name}
                          </Link>
                        ) : (
                          batch.name
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">{batch.code || "-"}</TableCell>
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
                      <TableCell className="text-right relative">
                        <div className="flex items-center justify-end gap-1 absolute right-0 top-1/2 -translate-y-1/2 bg-white/95 backdrop-blur-sm z-10 px-2 py-1 rounded-lg shadow-sm border border-slate-100 opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => openEdit(batch)}
                          >
                            <Pencil className="mr-1 h-3 w-3" />
                            编辑
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => handleToggleStatus(batch)}
                          >
                            <Power className="mr-1 h-3 w-3" />
                            {batch.status === "open" ? "截止批次" : "重新开放"}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-red-500 hover:text-red-600"
                            onClick={() => handleDeleteBatch(batch.id)}
                          >
                            <Trash2 className="mr-1 h-3 w-3" />
                            删除
                          </Button>
                        </div>
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
