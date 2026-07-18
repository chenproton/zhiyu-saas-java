"use client"

import { GitBranch, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { workflowApi, majorApi } from "@/lib/api"
import type { Workflow } from "@/lib/types/backend"
import { useToast } from "@/hooks/use-toast"
import { WorkflowEditor, buildWorkflowSteps, WorkflowStepEditor } from "@/components/shared/workflow-editor"

const DEFAULT_STEP: WorkflowStepEditor = { name: "", approverIds: [], approvalMode: "any" }

export default function WorkflowsPage() {
  const { toast } = useToast()
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [majors, setMajors] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [steps, setSteps] = useState<WorkflowStepEditor[]>([{ ...DEFAULT_STEP }])
  const [majorIds, setMajorIds] = useState<string[]>([])

  const loadWorkflows = async () => {
    setLoading(true)
    try {
      const res = await workflowApi.list({ limit: 1000 })
      setWorkflows(res.items)
    } catch (err: any) {
      toast({ variant: "destructive", title: "加载失败", description: err.message || "无法获取审批流程" })
    } finally { setLoading(false) }
  }

  const loadMajors = async () => { try { const res = await majorApi.list(); setMajors(res.items || []) } catch {} }

  useEffect(() => { loadWorkflows(); loadMajors() }, [])

  const reset = () => { setName(""); setDescription(""); setSteps([{ ...DEFAULT_STEP }]); setMajorIds([]); setEditId(null); setError(null) }

  const openEdit = (wf: Workflow) => {
    setEditId(wf.id)
    setName(wf.name)
    setDescription(wf.description || "")
    setMajorIds(wf.majorIds || [])
    setSteps((wf.steps || []).length > 0 ? wf.steps.map((s) => ({
      name: s.name || "",
      approverIds: s.approverIds || [],
      approvalMode: s.approvalMode || "any",
    })) : [{ ...DEFAULT_STEP }])
    setError(null)
    setIsEditOpen(true)
  }

  const handleSave = async () => {
    const built = buildWorkflowSteps(steps)
    if (!name.trim()) { setError("请输入流程名称"); return }
    if (built.length === 0) { setError("请至少配置一个审批步骤"); return }
    setError(null)
    try {
      const body = {
        name: name.trim(), description: description.trim() || undefined, steps: built,
        scene: "job", status: "active" as const,
        majorIds,
      }
      if (editId) { await workflowApi.update(editId, body); toast({ title: "保存成功" }) }
      else { await workflowApi.create(body); toast({ title: "创建成功" }) }
      setIsCreateOpen(false); setIsEditOpen(false); reset(); await loadWorkflows()
    } catch (err: any) { toast({ variant: "destructive", title: "保存失败", description: err.message }) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("确定删除该审批流程吗？")) return
    try { await workflowApi.delete(id); await loadWorkflows(); toast({ title: "删除成功" }) }
    catch (err: any) { toast({ variant: "destructive", title: "删除失败", description: err.message }) }
  }

  const renderDialog = (isEdit: boolean) => (
    <DialogContent className="sm:max-w-[800px] max-h-[85vh] overflow-y-auto overflow-x-hidden">
      <DialogHeader>
        <DialogTitle>{isEdit ? "编辑审批流程" : "新增审批流程"}</DialogTitle>
        <DialogDescription>{isEdit ? "修改审批流程配置" : "创建新的审批流程模板"}</DialogDescription>
      </DialogHeader>
      <WorkflowEditor error={error} name={name} onNameChange={setName} description={description} onDescriptionChange={setDescription} steps={steps} onStepsChange={setSteps} majorIds={majorIds} onMajorIdsChange={setMajorIds} majors={majors} />
      <DialogFooter>
        <Button variant="outline" onClick={() => { setIsCreateOpen(false); setIsEditOpen(false); reset() }}>取消</Button>
        <Button onClick={handleSave}>{isEdit ? "保存修改" : "创建流程"}</Button>
      </DialogFooter>
    </DialogContent>
  )

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-semibold text-gray-800">审批流程管理</h1><p className="text-sm text-gray-500 mt-1">配置岗位审批流模板，供批次关联使用</p></div>
        <Dialog open={isCreateOpen} onOpenChange={(o) => { if (o) reset(); setIsCreateOpen(o) }}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />新增审批流程</Button></DialogTrigger>
          {renderDialog(false)}
        </Dialog>
      </div>
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>{renderDialog(true)}</Dialog>
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><GitBranch className="h-4 w-4" />审批流程列表</CardTitle><CardDescription>共 {workflows.length} 个审批流程</CardDescription></CardHeader>
        <CardContent>
          <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
            <Table>
              <TableHeader><TableRow className="bg-slate-50"><TableHead className="text-xs">流程名称</TableHead><TableHead className="text-xs">流程描述</TableHead><TableHead className="text-xs">审批步骤</TableHead><TableHead className="text-xs">适用专业</TableHead><TableHead className="text-xs">创建时间</TableHead><TableHead className="w-12" /></TableRow></TableHeader>
              <TableBody>
                {loading ? (<TableRow><TableCell colSpan={6} className="text-center py-8">加载中...</TableCell></TableRow>) : workflows.length === 0 ? (<TableRow><TableCell colSpan={6} className="text-center py-8">暂无审批流程</TableCell></TableRow>) : (
                  workflows.map((wf) => (<TableRow key={wf.id}><TableCell className="font-medium">{wf.name}</TableCell><TableCell className="text-sm text-gray-600">{wf.description || "-"}</TableCell><TableCell><div className="flex flex-wrap gap-1">{(wf.steps || []).map((s, idx) => (<Badge key={idx} variant="outline" className="text-xs">{idx + 1}.{s.name}({s.approvalMode === "all" ? "全" : "任一"})</Badge>))}</div></TableCell><TableCell className="text-sm text-gray-600">{wf.majorIds?.length ? majors.filter((m) => wf.majorIds.includes(m.id)).map((m) => m.name).join("、") || wf.majorIds.join(",") : "-"}</TableCell><TableCell className="text-sm text-gray-500">{new Date(wf.createdAt).toLocaleDateString()}</TableCell><TableCell><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => openEdit(wf)}>编辑</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem className="text-destructive" onClick={() => handleDelete(wf.id)}>删除</DropdownMenuItem></DropdownMenuContent></DropdownMenu></TableCell></TableRow>))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
