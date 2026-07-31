"use client"
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { TableCell, TableHead } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Plus, Trash2 } from "lucide-react"
import { usePortalAuth } from "@/contexts/portal-auth-context"
import { portalRequest, buildQuery } from "@/lib/api"
import { useToast } from "@zhiyu/ui"
import { TableRowActions } from "@/components/shared/table-row-actions"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import type { AlliancePermission, AllianceListResponse } from "@/lib/types"

export default function AlliancePermissionsPage() {
  const { tenantId, loading: authLoading } = usePortalAuth()
  const { toast } = useToast()
  const [items, setItems] = useState<AlliancePermission[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(true)
  const [formItem, setFormItem] = useState<Partial<AlliancePermission>>({})
  const [saving, setSaving] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<AlliancePermission | null>(null)
  const [deleting, setDeleting] = useState(true)

  const fetchItems = useCallback(async () => {
    if (!tenantId) return
    
    try {
      const data = await portalRequest<AllianceListResponse<AlliancePermission>>("/alliance/permissions")
      setItems(data.items || [])
    } catch (e: any) { setError(e.message || "加载失败") } finally { setLoading(false) }
  }, [tenantId])

  useEffect(() => { if (authLoading || !tenantId) return; fetchItems() }, [tenantId, authLoading, fetchItems])

  const handleSave = async (item: Partial<AlliancePermission>, isEdit: boolean) => {
    setSaving(true)
    try {
      if (isEdit && item.id) await portalRequest(`/alliance/permissions/${item.id}`, { method: "PUT", body: JSON.stringify(item) })
      else await portalRequest("/alliance/permissions", { method: "POST", body: JSON.stringify(item) })
      setDialogOpen(false); await fetchItems(); toast({ title: `已${isEdit ? "更新" : "创建"}` })
    } catch (e: any) { toast({ title: "保存失败", description: e.message, variant: "destructive" }) } finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return; setDeleting(true)
    try { await portalRequest(`/alliance/permissions/${deleteTarget.id}`, { method: "DELETE" }); setDeleteTarget(null); await fetchItems(); toast({ title: "已删除" }) }
    catch (e: any) { toast({ title: "删除失败", description: e.message, variant: "destructive" }) } finally { setDeleting(false) }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">合作权限管理</h1><p className="text-muted-foreground text-sm mt-1">管理合作企业/专家的账号权限授权</p></div>
        <Button onClick={() => { setFormItem({ accountName: "", accountType: "enterprise", isEnabled: true }); setDialogOpen(true) }}>新增授权</Button>
      </div>
      {error && <div className="rounded-md border border-red-200 bg-red-50 p-4 text-red-700">{error}<Button variant="link" size="sm" onClick={fetchItems}>重试</Button></div>}
      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b"><tr><TableHead>账号名称</TableHead><TableHead>账号类型</TableHead><TableHead>启用</TableHead><TableHead>操作</TableHead></tr></thead>
          <tbody>
            {loading && items.length === 0 ? <tr><td colSpan={4} className="text-center py-8 text-muted-foreground">加载中...</td></tr>
            : items.length === 0 ? <tr><td colSpan={4} className="text-center py-8 text-muted-foreground">暂无数据</td></tr>
            : items.map((p) => (
              <tr key={p.id} className="border-b hover:bg-muted/30">
                <TableCell className="font-medium">{p.accountName}</TableCell>
                <TableCell>{p.accountType === "enterprise" ? "企业账号" : "专家账号"}</TableCell>
                <TableCell>{p.isEnabled ? "是" : "否"}</TableCell>
                <TableCell><TableRowActions>
                  <Button variant="ghost" size="sm" onClick={() => { setFormItem({ ...p }); setDialogOpen(true) }}>编辑</Button>
                  <Button variant="ghost" size="sm" className="text-red-600" onClick={() => setDeleteTarget(p)}><Trash2 className="h-4 w-4 mr-1" />删除</Button>
                </TableRowActions></TableCell>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setDialogOpen(false)}>
          <div className="bg-background rounded-lg shadow-lg w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">{formItem.id ? "编辑授权" : "新增授权"}</h2>
            <div className="space-y-4">
              <div><Label>账号名称 *</Label><Input value={formItem.accountName || ""} onChange={(e) => setFormItem({ ...formItem, accountName: e.target.value })} /></div>
              <div>
                <Label>账号类型</Label>
                <Select value={formItem.accountType || "enterprise"} onValueChange={(v) => setFormItem({ ...formItem, accountType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="enterprise">企业账号</SelectItem>
                    <SelectItem value="expert">专家账号</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={formItem.isEnabled ?? true} onCheckedChange={(v) => setFormItem({ ...formItem, isEnabled: v })} />
                <Label>启用</Label>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
              <Button onClick={() => handleSave(formItem, !!formItem.id)} disabled={saving || !formItem.accountName}>{saving ? "保存中..." : "保存"}</Button>
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null) }} title="确认删除" description={deleteTarget ? `确定要删除「${deleteTarget.accountName}」的授权吗？` : ""} variant="destructive" confirmText="删除"  onConfirm={handleDelete} />
    </div>
  )
}
