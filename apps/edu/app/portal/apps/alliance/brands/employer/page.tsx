"use client"
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { TableCell, TableHead } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Pencil, Trash2 } from "lucide-react"
import { usePortalAuth } from "@/contexts/portal-auth-context"
import { portalRequest, buildQuery } from "@/lib/api"
import { useToast } from "@zhiyu/ui"
import { TableRowActions } from "@/components/shared/table-row-actions"
import { StatusBadge } from "@/components/shared/status-badge"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import type { AllianceBrand, AllianceListResponse } from "@/lib/types"

const brandType = "employer"
const brandLabel = "雇主品牌"
const brandDesc = "管理合作企业/机构的雇主品牌信息"

export default function AllianceEmployerBrandPage() {
  const { tenantId, loading: authLoading } = usePortalAuth()
  const { toast } = useToast()
  const [items, setItems] = useState<AllianceBrand[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(true)
  const [formItem, setFormItem] = useState<Partial<AllianceBrand>>({})
  const [saving, setSaving] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<AllianceBrand | null>(null)
  const [deleting, setDeleting] = useState(true)

  const fetchItems = useCallback(async () => {
    if (!tenantId) return
    
    try {
      const data = await portalRequest<AllianceListResponse<AllianceBrand>>(`/alliance/brands?brandType=${brandType}`)
      setItems(data.items || [])
    } catch (e: any) { setError(e.message || "加载失败") } finally { setLoading(false) }
  }, [tenantId])

  useEffect(() => { if (authLoading || !tenantId) return; fetchItems() }, [tenantId, authLoading, fetchItems])

  const handleSave = async (item: Partial<AllianceBrand>, isEdit: boolean) => {
    setSaving(true)
    try {
      item.brandType = brandType
      if (isEdit && item.id) {
        await portalRequest(`/alliance/brands/${item.id}`, { method: "PUT", body: JSON.stringify(item) })
      } else {
        await portalRequest("/alliance/brands", { method: "POST", body: JSON.stringify(item) })
      }
      setDialogOpen(false); await fetchItems()
      toast({ title: `已${isEdit ? "更新" : "创建"}` })
    } catch (e: any) { toast({ title: "保存失败", description: e.message, variant: "destructive" }) } finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try { await portalRequest(`/alliance/brands/${deleteTarget.id}`, { method: "DELETE" }); setDeleteTarget(null); await fetchItems(); toast({ title: "已删除" }) }
    catch (e: any) { toast({ title: "删除失败", description: e.message, variant: "destructive" }) } finally { setDeleting(false) }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">{brandLabel}管理</h1><p className="text-muted-foreground text-sm mt-1">{brandDesc}</p></div>
        <Button onClick={() => { setFormItem({ name: "", status: "draft", isPublic: false }); setDialogOpen(true) }}>新增品牌</Button>
      </div>
      {error && <div className="rounded-md border border-red-200 bg-red-50 p-4 text-red-700">{error}<Button variant="link" size="sm" onClick={fetchItems}>重试</Button></div>}
      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b"><tr><TableHead>名称</TableHead><TableHead>状态</TableHead><TableHead>推荐</TableHead><TableHead>公开</TableHead><TableHead>浏览</TableHead><TableHead>操作</TableHead></tr></thead>
          <tbody>
            {loading && items.length === 0 ? <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">加载中...</td></tr>
            : items.length === 0 ? <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">暂无数据</td></tr>
            : items.map((b) => (
              <tr key={b.id} className="border-b hover:bg-muted/30">
                <TableCell className="font-medium">{b.name}</TableCell>
                <TableCell><StatusBadge status={b.status} /></TableCell>
                <TableCell>{b.isFeatured ? "是" : "否"}</TableCell>
                <TableCell>{b.isPublic ? "是" : "否"}</TableCell>
                <TableCell>{b.viewCount}</TableCell>
                <TableCell><TableRowActions>
                  <Button variant="ghost" size="sm" onClick={() => { setFormItem({ ...b }); setDialogOpen(true) }}><Pencil className="h-4 w-4 mr-1" />编辑</Button>
                  <Button variant="ghost" size="sm" className="text-red-600" onClick={() => setDeleteTarget(b)}><Trash2 className="h-4 w-4 mr-1" />删除</Button>
                </TableRowActions></TableCell>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setDialogOpen(false)}>
          <div className="bg-background rounded-lg shadow-lg w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">{formItem.id ? "编辑品牌" : "新增品牌"}</h2>
            <div className="space-y-4">
              <div><Label>名称 *</Label><Input value={formItem.name || ""} onChange={(e) => setFormItem({ ...formItem, name: e.target.value })} /></div>
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
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2"><Switch checked={formItem.isPublic || false} onCheckedChange={(v) => setFormItem({ ...formItem, isPublic: v })} /><Label>公开显示</Label></div>
                <div className="flex items-center gap-2"><Switch checked={formItem.isFeatured || false} onCheckedChange={(v) => setFormItem({ ...formItem, isFeatured: v })} /><Label>推荐</Label></div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
              <Button onClick={() => handleSave(formItem, !!formItem.id)} disabled={saving || !formItem.name}>{saving ? "保存中..." : "保存"}</Button>
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null) }} title="确认删除" description={deleteTarget ? `确定要删除「${deleteTarget.name}」吗？` : ""} variant="destructive" confirmText="删除"  onConfirm={handleDelete} />
    </div>
  )
}
