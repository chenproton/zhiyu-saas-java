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
import type { AllianceAgreement, AllianceListResponse } from "@/lib/types"

export default function AllianceAgreementsPage() {
  const { tenantId, loading: authLoading } = usePortalAuth()
  const { toast } = useToast()
  const [items, setItems] = useState<AllianceAgreement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(true)
  const [formItem, setFormItem] = useState<Partial<AllianceAgreement>>({})
  const [saving, setSaving] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<AllianceAgreement | null>(null)
  const [deleting, setDeleting] = useState(true)

  const fetchItems = useCallback(async () => {
    if (!tenantId) return
    
    try {
      const data = await portalRequest<AllianceListResponse<AllianceAgreement>>("/alliance/agreements")
      setItems(data.items || [])
    } catch (e: any) { setError(e.message || "加载失败") } finally { setLoading(false) }
  }, [tenantId])

  useEffect(() => { if (authLoading || !tenantId) return; fetchItems() }, [tenantId, authLoading, fetchItems])

  const handleSave = async (item: Partial<AllianceAgreement>, isEdit: boolean) => {
    setSaving(true)
    try {
      if (isEdit && item.id) await portalRequest(`/alliance/agreements/${item.id}`, { method: "PUT", body: JSON.stringify(item) })
      else await portalRequest("/alliance/agreements", { method: "POST", body: JSON.stringify(item) })
      setDialogOpen(false); await fetchItems(); toast({ title: `已${isEdit ? "更新" : "创建"}` })
    } catch (e: any) { toast({ title: "保存失败", description: e.message, variant: "destructive" }) } finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return; setDeleting(true)
    try { await portalRequest(`/alliance/agreements/${deleteTarget.id}`, { method: "DELETE" }); setDeleteTarget(null); await fetchItems(); toast({ title: "已删除" }) }
    catch (e: any) { toast({ title: "删除失败", description: e.message, variant: "destructive" }) } finally { setDeleting(false) }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">合作协议管理</h1><p className="text-muted-foreground text-sm mt-1">管理校企合作协议的独立记录</p></div>
        <Button onClick={() => { setFormItem({ name: "", status: "draft" }); setDialogOpen(true) }}>新增协议</Button>
      </div>
      {error && <div className="rounded-md border border-red-200 bg-red-50 p-4 text-red-700">{error}<Button variant="link" size="sm" onClick={fetchItems}>重试</Button></div>}
      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b"><tr><TableHead>协议名称</TableHead><TableHead>类型</TableHead><TableHead>状态</TableHead><TableHead>起止日期</TableHead><TableHead>操作</TableHead></tr></thead>
          <tbody>
            {loading && items.length === 0 ? <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">加载中...</td></tr>
            : items.length === 0 ? <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">暂无数据</td></tr>
            : items.map((a) => (
              <tr key={a.id} className="border-b hover:bg-muted/30">
                <TableCell className="font-medium">{a.name}</TableCell>
                <TableCell>{a.type || "-"}</TableCell>
                <TableCell><StatusBadge status={a.status} /></TableCell>
                <TableCell>{a.startDate || "-"} ~ {a.endDate || "-"}</TableCell>
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
            <h2 className="text-lg font-semibold mb-4">{formItem.id ? "编辑协议" : "新增协议"}</h2>
            <div className="space-y-4">
              <div><Label>协议名称 *</Label><Input value={formItem.name || ""} onChange={(e) => setFormItem({ ...formItem, name: e.target.value })} /></div>
              <div><Label>协议类型</Label><Input value={formItem.type || ""} onChange={(e) => setFormItem({ ...formItem, type: e.target.value })} /></div>
              <div>
                <Label>状态</Label>
                <Select value={formItem.status || "draft"} onValueChange={(v) => setFormItem({ ...formItem, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">草稿</SelectItem>
                    <SelectItem value="active">生效中</SelectItem>
                    <SelectItem value="expired">已过期</SelectItem>
                    <SelectItem value="renewed">已续签</SelectItem>
                    <SelectItem value="terminated">已终止</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>开始日期</Label><Input type="date" value={formItem.startDate || ""} onChange={(e) => setFormItem({ ...formItem, startDate: e.target.value })} /></div>
                <div><Label>结束日期</Label><Input type="date" value={formItem.endDate || ""} onChange={(e) => setFormItem({ ...formItem, endDate: e.target.value })} /></div>
              </div>
              <div><Label>协议内容</Label><Textarea value={formItem.content || ""} onChange={(e) => setFormItem({ ...formItem, content: e.target.value })} rows={4} /></div>
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
