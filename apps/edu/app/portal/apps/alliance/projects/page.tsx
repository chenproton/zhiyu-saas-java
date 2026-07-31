"use client"
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { TableCell, TableHead } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Pencil, Trash2, Eye } from "lucide-react"
import { usePortalAuth } from "@/contexts/portal-auth-context"
import { portalRequest, buildQuery } from "@/lib/api"
import { useToast } from "@zhiyu/ui"
import { TableRowActions } from "@/components/shared/table-row-actions"
import { StatusBadge } from "@/components/shared/status-badge"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import type { AllianceProject, AllianceListResponse } from "@/lib/types"

const PHASE_OPTIONS = [
  { value: "initiation", label: "立项" },
  { value: "execution", label: "执行" },
  { value: "acceptance", label: "验收" },
  { value: "closure", label: "结项" },
  { value: "archived", label: "已归档" },
  { value: "terminated", label: "已终止" },
]

export default function AllianceProjectsPage() {
  const { tenantId, loading: authLoading } = usePortalAuth()
  const { toast } = useToast()
  const [projects, setProjects] = useState<AllianceProject[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [phaseFilter, setPhaseFilter] = useState("")
  const [dialogOpen, setDialogOpen] = useState(true)
  const [formItem, setFormItem] = useState<Partial<AllianceProject>>({})
  const [saving, setSaving] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<AllianceProject | null>(null)
  const [deleting, setDeleting] = useState(true)

  const fetchProjects = useCallback(async () => {
    if (!tenantId) return
    
    
    try {
      const params: Record<string, string> = {}
      if (phaseFilter) params.phase = phaseFilter
      const data = await portalRequest<AllianceListResponse<AllianceProject>>(`/alliance/projects${buildQuery(params)}`)
      setProjects(data.items || [])
    } catch (e: any) { setError(e.message || "加载失败") } finally { setLoading(false) }
  }, [tenantId, phaseFilter])

  useEffect(() => { if (authLoading || !tenantId) return; fetchProjects() }, [tenantId, authLoading, fetchProjects])

  const handleSave = async (item: Partial<AllianceProject>, isEdit: boolean) => {
    setSaving(true)
    try {
      if (isEdit && item.id) {
        await portalRequest(`/alliance/projects/${item.id}`, { method: "PUT", body: JSON.stringify(item) })
      } else {
        await portalRequest("/alliance/projects", { method: "POST", body: JSON.stringify(item) })
      }
      setDialogOpen(false)
      await fetchProjects()
      toast({ title: `项目已${isEdit ? "更新" : "创建"}` })
    } catch (e: any) { toast({ title: "保存失败", description: e.message, variant: "destructive" }) }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await portalRequest(`/alliance/projects/${deleteTarget.id}`, { method: "DELETE" })
      setDeleteTarget(null)
      await fetchProjects()
      toast({ title: "项目已删除" })
    } catch (e: any) { toast({ title: "删除失败", description: e.message, variant: "destructive" }) } finally { setDeleting(false) }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">合作项目管理</h1><p className="text-muted-foreground text-sm mt-1">管理校企合作项目，追踪项目阶段与里程碑</p></div>
        <Button onClick={() => { setFormItem({ name: "", phase: "initiation", publishStatus: "draft", isPublic: false }); setDialogOpen(true) }}>新增项目</Button>
      </div>
      <div className="flex items-center gap-4">
        <Select value={phaseFilter} onValueChange={setPhaseFilter}>
          <SelectTrigger className="w-32"><SelectValue placeholder="全部阶段" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部阶段</SelectItem>
            {PHASE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">共 {projects.length} 条</span>
      </div>
      {error && <div className="rounded-md border border-red-200 bg-red-50 p-4 text-red-700">{error}<Button variant="link" size="sm" onClick={fetchProjects}>重试</Button></div>}
      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b"><tr><TableHead>项目名称</TableHead><TableHead>阶段</TableHead><TableHead>发布状态</TableHead><TableHead>开始日期</TableHead><TableHead>公开</TableHead><TableHead>操作</TableHead></tr></thead>
          <tbody>
            {loading && projects.length === 0 ? <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">加载中...</td></tr>
            : projects.length === 0 ? <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">暂无数据</td></tr>
            : projects.map((p) => (
              <tr key={p.id} className="border-b hover:bg-muted/30">
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell><StatusBadge status={p.phase} /></TableCell>
                <TableCell>{p.publishStatus === "published" ? "已发布" : "草稿"}</TableCell>
                <TableCell>{p.startDate || "-"}</TableCell>
                <TableCell>{p.isPublic ? "是" : "否"}</TableCell>
                <TableCell><TableRowActions>
                  <Button variant="ghost" size="sm" onClick={() => { setFormItem({ ...p }); setDialogOpen(true) }}><Pencil className="h-4 w-4 mr-1" />编辑</Button>
                  <Button variant="ghost" size="sm" className="text-red-600" onClick={() => setDeleteTarget(p)}><Trash2 className="h-4 w-4 mr-1" />删除</Button>
                </TableRowActions></TableCell>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setDialogOpen(false)}>
          <div className="bg-background rounded-lg shadow-lg w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">{formItem.id ? "编辑项目" : "新增项目"}</h2>
            <div className="space-y-4">
              <div><Label>项目名称 *</Label><Input value={formItem.name || ""} onChange={(e) => setFormItem({ ...formItem, name: e.target.value })} /></div>
              <div><Label>项目阶段</Label>
                <Select value={formItem.phase || ""} onValueChange={(v) => setFormItem({ ...formItem, phase: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PHASE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>开始日期</Label><Input type="date" value={formItem.startDate || ""} onChange={(e) => setFormItem({ ...formItem, startDate: e.target.value })} /></div>
              <div><Label>结束日期</Label><Input type="date" value={formItem.endDate || ""} onChange={(e) => setFormItem({ ...formItem, endDate: e.target.value })} /></div>
              <div><Label>描述</Label><Textarea value={formItem.description || ""} onChange={(e) => setFormItem({ ...formItem, description: e.target.value })} rows={3} /></div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
              <Button onClick={() => handleSave(formItem, !!formItem.id)} disabled={saving || !formItem.name}>{saving ? "保存中..." : "保存"}</Button>
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null) }} title="确认删除" description={deleteTarget ? `确定要删除项目「${deleteTarget.name}」吗？` : ""} variant="destructive" confirmText="删除"  onConfirm={handleDelete} />
    </div>
  )
}
