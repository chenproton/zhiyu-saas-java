"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { TableCell, TableHead } from "@/components/ui/table"
import { usePortalAuth } from "@/contexts/portal-auth-context"
import { portalRequest } from "@/lib/api"
import { useToast } from "@zhiyu/ui"
import { allianceLabel } from "@zhiyu/shared-types"
import { AllianceDetailShell } from "@/components/shared/alliance-detail-shell"
import { StatusBadge } from "@/components/shared/status-badge"
import { Plus, Pencil, Trash2, Loader2, Link2 } from "lucide-react"
import Link from "next/link"
import { Checkbox } from "@/components/ui/checkbox"
import type { AllianceProject, AllianceProjectMilestone, AllianceAgreement, AllianceAchievement, AllianceListResponse } from "@/lib/types"

export default function AllianceProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { tenantId } = usePortalAuth()
  const { toast } = useToast()
  const [project, setProject] = useState<AllianceProject | null>(null)
  const [milestones, setMilestones] = useState<AllianceProjectMilestone[]>([])
  const [allAgreements, setAllAgreements] = useState<AllianceAgreement[]>([])
  const [achievements, setAchievements] = useState<AllianceAchievement[]>([])
  const [loading, setLoading] = useState(true)
  const [savingM, setSavingM] = useState(false)
  const [milestoneDialog, setMilestoneDialog] = useState<{
    open: boolean; edit?: AllianceProjectMilestone
  }>({ open: false })
  const [mForm, setMForm] = useState({ name: "", description: "", dueDate: "", completedDate: "", isCompleted: false })
  const [linkDialog, setLinkDialog] = useState(false)
  const [linkSelected, setLinkSelected] = useState<string[]>([])
  const [newAgrDialog, setNewAgrDialog] = useState(false)
  const [aForm, setAForm] = useState({ name: "", type: "", startDate: "", endDate: "", status: "draft", content: "" })
  const [savingA, setSavingA] = useState(false)

  const loadData = () => {
    if (!tenantId || !id) return
    Promise.all([
      portalRequest<AllianceProject>(`/alliance/projects/${id}`),
      portalRequest<AllianceListResponse<AllianceProjectMilestone>>(`/alliance/projects/${id}/milestones`),
      portalRequest<AllianceListResponse<AllianceAgreement>>("/alliance/agreements?limit=1000"),
      portalRequest<AllianceListResponse<AllianceAchievement>>("/alliance/achievements?limit=1000"),
    ])
      .then(([p, m, agr, ach]) => {
        setProject(p); setMilestones(m.items || [])
        setAllAgreements(agr.items || [])
        setAchievements(ach.items || [])
      })
      .catch((e) => toast({ title: "加载失败", description: e.message, variant: "destructive" }))
      .finally(() => setLoading(false))
  }
  useEffect(() => { loadData() }, [tenantId, id]) // eslint-disable-line

  const saveLinkAgr = async () => {
    setSavingA(true)
    try {
      const current = project as any
      const agreementIds = [...new Set([...(current.agreementIds || []), ...linkSelected])]
      await portalRequest(`/alliance/projects/${id}`, { method: "PUT", body: JSON.stringify({ ...current, agreementIds }) })
      toast({ title: `已关联 ${linkSelected.length} 份协议` })
      setLinkDialog(false); setLinkSelected([])
      loadData()
    } catch (e: any) {
      toast({ title: "关联失败", description: e.message, variant: "destructive" })
    } finally { setSavingA(false) }
  }

  const unlinkAgr = async (aid: string) => {
    const current = project as any
    try {
      await portalRequest(`/alliance/projects/${id}`, {
        method: "PUT",
        body: JSON.stringify({ ...current, agreementIds: (current.agreementIds || []).filter((x: string) => x !== aid) }),
      })
      toast({ title: "已取消关联" })
      loadData()
    } catch (e: any) {
      toast({ title: "操作失败", description: e.message, variant: "destructive" })
    }
  }

  const createProjectAgreement = async () => {
    if (!aForm.name) { toast({ title: "请填写协议名称", variant: "destructive" }); return }
    setSavingA(true)
    try {
      const data = await portalRequest<{ id: string }>("/alliance/agreements", { method: "POST", body: JSON.stringify(aForm) })
      const current = project as any
      const agreementIds = [...(current.agreementIds || []), data.id]
      await portalRequest(`/alliance/projects/${id}`, { method: "PUT", body: JSON.stringify({ ...current, agreementIds }) })
      toast({ title: "协议已创建并关联项目" })
      setNewAgrDialog(false)
      setAForm({ name: "", type: "", startDate: "", endDate: "", status: "draft", content: "" })
      loadData()
    } catch (e: any) {
      toast({ title: "创建失败", description: e.message, variant: "destructive" })
    } finally { setSavingA(false) }
  }

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
    {
      key: "agreements", label: "项目协议", badge: ((project as any)?.agreementIds || []).length,
      content: (
        <div className="space-y-4">
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => { setLinkSelected([]); setLinkDialog(true) }}>
              <Link2 className="h-4 w-4 mr-1" />关联已有协议
            </Button>
            <Button size="sm" onClick={() => setNewAgrDialog(true)}><Plus className="h-4 w-4 mr-1" />新增协议</Button>
          </div>
          <div className="rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr><TableHead>协议名称</TableHead><TableHead>类型</TableHead><TableHead>状态</TableHead><TableHead>起止日期</TableHead><TableHead>操作</TableHead></tr>
              </thead>
              <tbody>
                {((project as any)?.agreementIds || []).length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">暂无项目协议</td></tr>
                ) : ((project as any)?.agreementIds || []).map((aid: string) => {
                  const agreement = allAgreements.find((a) => a.id === aid)
                  return agreement ? (
                    <tr key={aid} className="border-b">
                      <TableCell className="font-medium">{agreement.name}</TableCell>
                      <TableCell>{agreement.type || "-"}</TableCell>
                      <TableCell>{allianceLabel("agreementStatus", agreement.status)}</TableCell>
                      <TableCell>{agreement.startDate || "-"} ~ {agreement.endDate || "-"}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" className="text-red-600" onClick={() => unlinkAgr(aid)}>取消关联</Button>
                      </TableCell>
                    </tr>
                  ) : null
                })}
              </tbody>
            </table>
          </div>
        </div>
      ),
    },
    {
      key: "achievements", label: "关联成果", badge: achievements.filter((a) => (a.projectIds || []).includes?.(id)).length,
      content: (
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr><TableHead>成果名称</TableHead><TableHead>类型</TableHead><TableHead>状态</TableHead><TableHead>操作</TableHead></tr>
            </thead>
            <tbody>
              {achievements.filter((a) => (a.projectIds || []).includes?.(id)).length === 0 ? (
                <tr><td colSpan={4} className="text-center py-8 text-muted-foreground">暂无关联成果</td></tr>
              ) : achievements.filter((a) => (a.projectIds || []).includes?.(id)).map((a) => (
                <tr key={a.id} className="border-b">
                  <TableCell className="font-medium">
                    <Link href={`/portal/apps/alliance/achievements/${a.id}`} className="hover:underline">{a.title}</Link>
                  </TableCell>
                  <TableCell>{allianceLabel("achievementType", a.type)}</TableCell>
                  <TableCell>{allianceLabel("achievementStatus", a.status)}</TableCell>
                  <TableCell>
                    <Link href={`/portal/apps/alliance/achievements/${a.id}/edit`}>
                      <Button variant="ghost" size="sm"><Pencil className="h-3 w-3 mr-1" />编辑</Button>
                    </Link>
                  </TableCell>
                </tr>
              ))}
            </tbody>
          </table>
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
      {/* 关联已有协议 */}
      <Dialog open={linkDialog} onOpenChange={(o) => !o && setLinkDialog(false)}>
        <DialogContent>
          <DialogHeader><DialogTitle>关联已有协议</DialogTitle></DialogHeader>
          <div className="max-h-[50vh] overflow-y-auto space-y-2">
            {allAgreements.map((a) => (
              <label key={a.id} className="flex items-center gap-2 p-2 rounded border hover:bg-muted/40 cursor-pointer">
                <Checkbox
                  checked={linkSelected.includes(a.id)}
                  onCheckedChange={(v) => setLinkSelected((prev) => v ? [...prev, a.id] : prev.filter((x) => x !== a.id))}
                />
                <div className="flex-1">
                  <p className="text-sm font-medium">{a.name}</p>
                  <p className="text-xs text-muted-foreground">{a.type || "未分类"} · {allianceLabel("agreementStatus", a.status)}</p>
                </div>
              </label>
            ))}
            {allAgreements.length === 0 && <p className="text-center py-6 text-sm text-muted-foreground">暂无可关联的协议</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkDialog(false)}>取消</Button>
            <Button onClick={saveLinkAgr} disabled={savingA || linkSelected.length === 0}>
              {savingA ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}关联 ({linkSelected.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 新增协议（自动关联当前项目） */}
      <Dialog open={newAgrDialog} onOpenChange={(o) => !o && setNewAgrDialog(false)}>
        <DialogContent>
          <DialogHeader><DialogTitle>新增协议（自动关联当前项目）</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2"><Label>协议名称 *</Label><Input value={aForm.name} onChange={(e) => setAForm({ ...aForm, name: e.target.value })} /></div>
            <div className="grid gap-2"><Label>协议类型</Label><Input value={aForm.type} onChange={(e) => setAForm({ ...aForm, type: e.target.value })} placeholder="如：战略合作协议" /></div>
            <div className="grid gap-2">
              <Label>协议状态</Label>
              <Select value={aForm.status} onValueChange={(v) => setAForm({ ...aForm, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">草稿</SelectItem>
                  <SelectItem value="active">生效中</SelectItem>
                  <SelectItem value="expired">已失效</SelectItem>
                  <SelectItem value="renewed">已续签</SelectItem>
                  <SelectItem value="terminated">已终止</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>开始日期</Label><Input type="date" value={aForm.startDate} onChange={(e) => setAForm({ ...aForm, startDate: e.target.value })} /></div>
              <div className="grid gap-2"><Label>结束日期</Label><Input type="date" value={aForm.endDate} onChange={(e) => setAForm({ ...aForm, endDate: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewAgrDialog(false)}>取消</Button>
            <Button onClick={createProjectAgreement} disabled={savingA}>{savingA ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}创建并关联</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
