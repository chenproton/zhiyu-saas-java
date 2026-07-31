"use client"
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { TableCell, TableHead } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Pencil, Trash2 } from "lucide-react"
import { usePortalAuth } from "@/contexts/portal-auth-context"
import { portalRequest, buildQuery } from "@/lib/api"
import { useToast } from "@zhiyu/ui"
import { TableRowActions } from "@/components/shared/table-row-actions"
import { StatusBadge } from "@/components/shared/status-badge"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import type { AllianceExpert, AllianceListResponse } from "@/lib/types"

export default function AllianceExpertsPage() {
  const { tenantId, loading: authLoading } = usePortalAuth()
  const { toast } = useToast()
  const [experts, setExperts] = useState<AllianceExpert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(true)
  const [formItem, setFormItem] = useState<Partial<AllianceExpert>>({})
  const [saving, setSaving] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<AllianceExpert | null>(null)
  const [deleting, setDeleting] = useState(true)

  const fetchExperts = useCallback(async () => {
    if (!tenantId) return
    
    try {
      const data = await portalRequest<AllianceListResponse<AllianceExpert>>("/alliance/experts")
      setExperts(data.items || [])
    } catch (e: any) { setError(e.message || "加载失败") } finally { setLoading(false) }
  }, [tenantId])

  useEffect(() => { if (authLoading || !tenantId) return; fetchExperts() }, [tenantId, authLoading, fetchExperts])

  const handleSave = async (item: Partial<AllianceExpert>, isEdit: boolean) => {
    setSaving(true)
    try {
      if (isEdit && item.id) {
        await portalRequest(`/alliance/experts/${item.id}`, { method: "PUT", body: JSON.stringify(item) })
      } else {
        await portalRequest("/alliance/experts", { method: "POST", body: JSON.stringify(item) })
      }
      setDialogOpen(false); await fetchExperts()
      toast({ title: `专家已${isEdit ? "更新" : "创建"}` })
    } catch (e: any) { toast({ title: "保存失败", description: e.message, variant: "destructive" }) } finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try { await portalRequest(`/alliance/experts/${deleteTarget.id}`, { method: "DELETE" }); setDeleteTarget(null); await fetchExperts(); toast({ title: "已删除" }) }
    catch (e: any) { toast({ title: "删除失败", description: e.message, variant: "destructive" }) } finally { setDeleting(false) }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">专家资源库</h1><p className="text-muted-foreground text-sm mt-1">管理产业专家与校企专家档案</p></div>
        <Button onClick={() => { setFormItem({ name: "", status: "active", isPublic: false }); setDialogOpen(true) }}>新增专家</Button>
      </div>
      {error && <div className="rounded-md border border-red-200 bg-red-50 p-4 text-red-700">{error}<Button variant="link" size="sm" onClick={fetchExperts}>重试</Button></div>}
      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b"><tr><TableHead>姓名</TableHead><TableHead>头衔</TableHead><TableHead>职位</TableHead><TableHead>行业</TableHead><TableHead>状态</TableHead><TableHead>评级</TableHead><TableHead>公开</TableHead><TableHead>操作</TableHead></tr></thead>
          <tbody>
            {loading && experts.length === 0 ? <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">加载中...</td></tr>
            : experts.length === 0 ? <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">暂无数据</td></tr>
            : experts.map((e) => (
              <tr key={e.id} className="border-b hover:bg-muted/30">
                <TableCell className="font-medium">{e.name}</TableCell>
                <TableCell>{e.title || "-"}</TableCell>
                <TableCell>{e.position || "-"}</TableCell>
                <TableCell>{e.industry || "-"}</TableCell>
                <TableCell><StatusBadge status={e.status} /></TableCell>
                <TableCell>{e.rating || "-"}</TableCell>
                <TableCell>{e.isPublic ? "是" : "否"}</TableCell>
                <TableCell><TableRowActions>
                  <Button variant="ghost" size="sm" onClick={() => { setFormItem({ ...e }); setDialogOpen(true) }}><Pencil className="h-4 w-4 mr-1" />编辑</Button>
                  <Button variant="ghost" size="sm" className="text-red-600" onClick={() => setDeleteTarget(e)}><Trash2 className="h-4 w-4 mr-1" />删除</Button>
                </TableRowActions></TableCell>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setDialogOpen(false)}>
          <div className="bg-background rounded-lg shadow-lg w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">{formItem.id ? "编辑专家" : "新增专家"}</h2>
            <div className="space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div><Label>姓名 *</Label><Input value={formItem.name || ""} onChange={(e) => setFormItem({ ...formItem, name: e.target.value })} /></div>
                <div><Label>头衔</Label><Input value={formItem.title || ""} onChange={(e) => setFormItem({ ...formItem, title: e.target.value })} /></div>
                <div><Label>职位</Label><Input value={formItem.position || ""} onChange={(e) => setFormItem({ ...formItem, position: e.target.value })} /></div>
                <div><Label>行业</Label><Input value={formItem.industry || ""} onChange={(e) => setFormItem({ ...formItem, industry: e.target.value })} /></div>
                <div><Label>城市</Label><Input value={formItem.city || ""} onChange={(e) => setFormItem({ ...formItem, city: e.target.value })} /></div>
                <div>
                  <Label>状态</Label>
                  <Select value={formItem.status || "active"} onValueChange={(v) => setFormItem({ ...formItem, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">活跃</SelectItem>
                      <SelectItem value="inactive">停用</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>评级</Label>
                  <Select value={formItem.rating || "copper"} onValueChange={(v) => setFormItem({ ...formItem, rating: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gold">金牌</SelectItem>
                      <SelectItem value="silver">银牌</SelectItem>
                      <SelectItem value="copper">铜牌</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>简介</Label><Textarea value={formItem.introduction || ""} onChange={(e) => setFormItem({ ...formItem, introduction: e.target.value })} rows={3} /></div>
              <div><Label>工作经历</Label><Textarea value={formItem.workExperience || ""} onChange={(e) => setFormItem({ ...formItem, workExperience: e.target.value })} rows={3} /></div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
              <Button onClick={() => handleSave(formItem, !!formItem.id)} disabled={saving || !formItem.name}>{saving ? "保存中..." : "保存"}</Button>
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null) }} title="确认删除" description={deleteTarget ? `确定要删除专家「${deleteTarget.name}」吗？` : ""} variant="destructive" confirmText="删除"  onConfirm={handleDelete} />
    </div>
  )
}
