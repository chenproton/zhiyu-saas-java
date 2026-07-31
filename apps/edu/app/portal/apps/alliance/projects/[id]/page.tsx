"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { TableCell, TableHead } from "@/components/ui/table"
import { usePortalAuth } from "@/contexts/portal-auth-context"
import { portalRequest } from "@/lib/api"
import { useToast } from "@zhiyu/ui"
import { allianceLabel } from "@zhiyu/shared-types"
import { AllianceDetailShell } from "@/components/shared/alliance-detail-shell"
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react"
import type { AllianceProject, AllianceProjectMilestone, AllianceListResponse } from "@/lib/types"

export default function AllianceProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { tenantId } = usePortalAuth()
  const { toast } = useToast()
  const [project, setProject] = useState<AllianceProject | null>(null)
  const [milestones, setMilestones] = useState<AllianceProjectMilestone[]>([])
  const [loading, setLoading] = useState(true)
  const [savingM, setSavingM] = useState(false)
  const [milestoneDialog, setMilestoneDialog] = useState<{
    open: boolean; edit?: AllianceProjectMilestone
  }>({ open: false })
  const [mForm, setMForm] = useState({ name: "", description: "", dueDate: "", completedDate: "", isCompleted: false })

  const loadData = () => {
    if (!tenantId || !id) return
    Promise.all([
      portalRequest<AllianceProject>(`/alliance/projects/${id}`),
      portalRequest<AllianceListResponse<AllianceProjectMilestone>>(`/alliance/projects/${id}/milestones`),
    ])
      .then(([p, m]) => { setProject(p); setMilestones(m.items || []) })
      .catch((e) => toast({ title: "加载失败", description: e.message, variant: "destructive" }))
      .finally(() => setLoading(false))
  }
  useEffect(() => { loadData() }, [tenantId, id]) // eslint-disable-line

  const openMForm = (m?: AllianceProjectMilestone) => {
    setMForm(m ? {
      name: m.name, description: m.description || "",
      dueDate: m.dueDate || "", completedDate: m.completedDate || "",
      isCompleted: m.isCompleted || false,
    } : { name: "", description: "", dueDate: "", completedDate: "", isCompleted: false })
    setMilestoneDialog({ open: true, edit: m })
  }
  const saveMilestone = async () => {
    setSavingM(true)
    try {
      const edit = milestoneDialog.edit
      if (edit) {
        await portalRequest(`/alliance/projects/${id}/milestones/${edit.id}`, {
          method: "PUT", body: JSON.stringify({ ...edit, ...mForm }),
        })
        toast({ title: "里程碑已更新" })
      } else {
        await portalRequest(`/alliance/projects/${id}/milestones`, {
          method: "POST", body: JSON.stringify(mForm),
        })
        toast({ title: "里程碑已创建" })
      }
      setMilestoneDialog({ open: false })
      loadData()
    } catch (e: any) {
      toast({ title: "保存失败", description: e.message, variant: "destructive" })
    } finally { setSavingM(false) }
  }
  const deleteMilestone = async (mid: string) => {
    try {
      await portalRequest(`/alliance/projects/${id}/milestones/${mid}`, { method: "DELETE" })
      toast({ title: "已删除" })
      loadData()
    } catch (e: any) {
      toast({ title: "删除失败", description: e.message, variant: "destructive" })
    }
  }

  if (!project && !loading) {
    return <AllianceDetailShell title="" tabs={[]} notFound backHref="/portal/apps/alliance/projects" />
  }

  const tabs = [
    {
      key: "info", label: "基本信息",
      content: (
        <div className="grid grid-cols-2 gap-6">
          <Card><CardHeader><CardTitle>基础信息</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p><span className="text-muted-foreground">项目类型：</span>{project?.type || "-"}</p>
              <p><span className="text-muted-foreground">项目阶段：</span>{allianceLabel("projectPhase", project?.phase)}</p>
              <p><span className="text-muted-foreground">发布状态：</span>{allianceLabel("publishStatus", project?.publishStatus)}</p>
              <p><span className="text-muted-foreground">公开显示：</span>{project?.isPublic ? "是" : "否"}</p>
            </CardContent></Card>
          <Card><CardHeader><CardTitle>时间信息</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p><span className="text-muted-foreground">开始日期：</span>{project?.startDate || "-"}</p>
              <p><span className="text-muted-foreground">结束日期：</span>{project?.endDate || "-"}</p>
              <p><span className="text-muted-foreground">预算：</span>{project?.budget || "-"}</p>
            </CardContent></Card>
          {project?.description && (
            <Card className="col-span-2"><CardHeader><CardTitle>项目描述</CardTitle></CardHeader>
              <CardContent><p className="text-sm whitespace-pre-wrap">{project.description}</p></CardContent></Card>
          )}
        </div>
      ),
    },
    {
      key: "milestones", label: "里程碑", badge: milestones.length,
      content: (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => openMForm()}><Plus className="h-4 w-4 mr-1" />新增里程碑</Button>
          </div>
          <div className="rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <TableHead>里程碑名称</TableHead>
                  <TableHead>描述</TableHead>
                  <TableHead>截止日期</TableHead>
                  <TableHead>完成日期</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>操作</TableHead>
                </tr>
              </thead>
              <tbody>
                {milestones.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">暂无里程碑</td></tr>
                ) : milestones.map((m) => (
                  <tr key={m.id} className="border-b">
                    <TableCell className="font-medium">{m.name}</TableCell>
                    <TableCell className="text-muted-foreground">{m.description || "-"}</TableCell>
                    <TableCell>{m.dueDate || "-"}</TableCell>
                    <TableCell>{m.completedDate || "-"}</TableCell>
                    <TableCell><StatusBadge status={m.isCompleted ? "completed" : "pending"} /></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openMForm(m)}><Pencil className="h-3 w-3" /></Button>
                        <Button variant="ghost" size="sm" className="text-red-600" onClick={() => deleteMilestone(m.id)}><Trash2 className="h-3 w-3" /></Button>
                      </div>
                    </TableCell>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ),
    },
  ]

  return (
    <>
      <AllianceDetailShell
        title={project?.name || ""}
        statusBadge={project ? <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">{allianceLabel("projectPhase", project.phase)}</span> : undefined}
        backHref="/portal/apps/alliance/projects"
        editHref={`/portal/apps/alliance/projects/${id}/edit`}
        tabs={tabs}
        defaultTab="info"
        loading={loading}
      />

      <Dialog open={milestoneDialog.open} onOpenChange={(o) => !o && setMilestoneDialog({ open: false })}>
        <DialogContent>
          <DialogHeader><DialogTitle>{milestoneDialog.edit ? "编辑" : "新增"}里程碑</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2"><Label>名称 *</Label><Input value={mForm.name} onChange={(e) => setMForm({ ...mForm, name: e.target.value })} /></div>
            <div className="grid gap-2"><Label>描述</Label><Textarea value={mForm.description} onChange={(e) => setMForm({ ...mForm, description: e.target.value })} rows={2} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>截止日期</Label><Input type="date" value={mForm.dueDate} onChange={(e) => setMForm({ ...mForm, dueDate: e.target.value })} /></div>
              <div className="grid gap-2"><Label>完成日期</Label><Input type="date" value={mForm.completedDate} onChange={(e) => setMForm({ ...mForm, completedDate: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMilestoneDialog({ open: false })}>取消</Button>
            <Button onClick={saveMilestone} disabled={savingM}>{savingM ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
