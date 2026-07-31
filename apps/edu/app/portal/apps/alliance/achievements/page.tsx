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
import type { AllianceAchievement, AllianceListResponse } from "@/lib/types"

const TYPE_OPTIONS = [
  { value: "job", label: "岗位成果" },
  { value: "scene", label: "场景成果" },
  { value: "course", label: "课程成果" },
  { value: "custom", label: "自定义" },
]

export default function AllianceAchievementsPage() {
  const { tenantId, loading: authLoading } = usePortalAuth()
  const { toast } = useToast()
  const [items, setItems] = useState<AllianceAchievement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState("")
  const [dialogOpen, setDialogOpen] = useState(true)
  const [formItem, setFormItem] = useState<Partial<AllianceAchievement>>({})
  const [saving, setSaving] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<AllianceAchievement | null>(null)
  const [deleting, setDeleting] = useState(true)

  const fetchItems = useCallback(async () => {
    if (!tenantId) return
    
    try {
      const params: Record<string, string> = {}
      if (typeFilter) params.type = typeFilter
      const data = await portalRequest<AllianceListResponse<AllianceAchievement>>(`/alliance/achievements${buildQuery(params)}`)
      setItems(data.items || [])
    } catch (e: any) { setError(e.message || "加载失败") } finally { setLoading(false) }
  }, [tenantId, typeFilter])

  useEffect(() => { if (authLoading || !tenantId) return; fetchItems() }, [tenantId, authLoading, fetchItems])

  const handleSave = async (item: Partial<AllianceAchievement>, isEdit: boolean) => {
    setSaving(true)
    try {
      if (isEdit && item.id) await portalRequest(`/alliance/achievements/${item.id}`, { method: "PUT", body: JSON.stringify(item) })
      else await portalRequest("/alliance/achievements", { method: "POST", body: JSON.stringify(item) })
      setDialogOpen(false); await fetchItems()
      toast({ title: `已${isEdit ? "更新" : "创建"}` })
    } catch (e: any) { toast({ title: "保存失败", description: e.message, variant: "destructive" }) } finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return; setDeleting(true)
    try { await portalRequest(`/alliance/achievements/${deleteTarget.id}`, { method: "DELETE" }); setDeleteTarget(null); await fetchItems(); toast({ title: "已删除" }) }
    catch (e: any) { toast({ title: "删除失败", description: e.message, variant: "destructive" }) } finally { setDeleting(false) }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">合作成果管理</h1><p className="text-muted-foreground text-sm mt-1">管理校企合作产出的各类成果</p></div>
        <Button onClick={() => { setFormItem({ title: "", type: "custom", status: "draft", isPublic: false }); setDialogOpen(true) }}>新增成果</Button>
      </div>
      <div className="flex items-center gap-4">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-32"><SelectValue placeholder="全部类型" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部类型</SelectItem>
            {TYPE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">共 {items.length} 条</span>
      </div>
      {error && <div className="rounded-md border border-red-200 bg-red-50 p-4 text-red-700">{error}<Button variant="link" size="sm" onClick={fetchItems}>重试</Button></div>}
      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b"><tr><TableHead>成果名称</TableHead><TableHead>类型</TableHead><TableHead>状态</TableHead><TableHead>浏览</TableHead><TableHead>公开</TableHead><TableHead>操作</TableHead></tr></thead>
          <tbody>
            {loading && items.length === 0 ? <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">加载中...</td></tr>
            : items.length === 0 ? <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">暂无数据</td></tr>
            : items.map((a) => (
              <tr key={a.id} className="border-b hover:bg-muted/30">
                <TableCell className="font-medium">{a.title}</TableCell>
                <TableCell>{a.type}</TableCell>
                <TableCell><StatusBadge status={a.status} /></TableCell>
                <TableCell>{a.viewCount}</TableCell>
                <TableCell>{a.isPublic ? "是" : "否"}</TableCell>
                <TableCell><TableRowActions>
                  <Button variant="ghost" size="sm" onClick={() => { setFormItem({ ...a }); setDialogOpen(true) }}><Pencil className="h-4 w-4 mr-1" />编辑</Button>
                  <Button variant="ghost" size="sm" className="text-red-600" onClick={() => setDeleteTarget(a)}><Trash2 className="h-4 w-4 mr-1" />删除</Button>
                </TableRowActions></TableCell>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setDialogOpen(false)}>
          <div className="bg-background rounded-lg shadow-lg w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">{formItem.id ? "编辑成果" : "新增成果"}</h2>
            <div className="space-y-4">
              <div><Label>成果标题 *</Label><Input value={formItem.title || ""} onChange={(e) => setFormItem({ ...formItem, title: e.target.value })} /></div>
              <div>
                <Label>成果类型</Label>
                <Select value={formItem.type || "custom"} onValueChange={(v) => setFormItem({ ...formItem, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TYPE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>状态</Label>
                <Select value={formItem.status || "draft"} onValueChange={(v) => setFormItem({ ...formItem, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">草稿</SelectItem>
                    <SelectItem value="published">已发布</SelectItem>
                    <SelectItem value="archived">已归档</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>描述</Label><Textarea value={formItem.description || ""} onChange={(e) => setFormItem({ ...formItem, description: e.target.value })} rows={3} /></div>
              <div><Label>封面图 URL</Label><Input value={formItem.coverImage || ""} onChange={(e) => setFormItem({ ...formItem, coverImage: e.target.value })} /></div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
              <Button onClick={() => handleSave(formItem, !!formItem.id)} disabled={saving || !formItem.title}>{saving ? "保存中..." : "保存"}</Button>
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null) }} title="确认删除" description={deleteTarget ? `确定要删除「${deleteTarget.title}」吗？` : ""} variant="destructive" confirmText="删除"  onConfirm={handleDelete} />
    </div>
  )
}
