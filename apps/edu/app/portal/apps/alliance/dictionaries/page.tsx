"use client"

import { useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { TableCell, TableHead } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Trash2, Pencil } from "lucide-react"
import { usePortalAuth } from "@/contexts/portal-auth-context"
import { portalRequest } from "@/lib/api"
import { useToast } from "@zhiyu/ui"
import { TableRowActions } from "@/components/shared/table-row-actions"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import type { AllianceDictionary, AllianceListResponse } from "@/lib/types"

function DictionaryTab({ dictType, label }: { dictType: string; label: string }) {
  const { tenantId, loading: authLoading } = usePortalAuth()
  const { toast } = useToast()
  const [items, setItems] = useState<AllianceDictionary[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [formItem, setFormItem] = useState<{ code: string; name: string; sortOrder: number }>({ code: "", name: "", sortOrder: 0 })
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<AllianceDictionary | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchItems = useCallback(async () => {
    if (!tenantId) return
    
    try {
      const data = await portalRequest<AllianceListResponse<AllianceDictionary>>(`/alliance/dictionaries/${dictType}`)
      setItems(data.items || [])
    } catch {} finally { setLoading(false) }
  }, [tenantId, dictType])

  useEffect(() => { if (authLoading || !tenantId) return; fetchItems() }, [tenantId, authLoading, fetchItems])

  const handleSave = async () => {
    setSaving(true)
    try {
      if (editId) {
        await portalRequest(`/alliance/dictionaries/${dictType}/${editId}`, { method: "PUT", body: JSON.stringify(formItem) })
      } else {
        await portalRequest(`/alliance/dictionaries/${dictType}`, { method: "POST", body: JSON.stringify(formItem) })
      }
      setDialogOpen(false); setEditId(null); await fetchItems(); toast({ title: "已保存" })
    } catch (e: any) { toast({ title: "保存失败", description: e.message, variant: "destructive" }) } finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return; setDeleting(true)
    try { await portalRequest(`/alliance/dictionaries/${dictType}/${deleteTarget.id}`, { method: "DELETE" }); setDeleteTarget(null); await fetchItems(); toast({ title: "已删除" }) }
    catch (e: any) { toast({ title: "删除失败", description: e.message, variant: "destructive" }) } finally { setDeleting(false) }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={() => { setFormItem({ code: "", name: "", sortOrder: items.length }); setEditId(null); setDialogOpen(true) }}>
          <Plus className="h-4 w-4 mr-1" />新增
        </Button>
        <span className="text-sm text-muted-foreground">共 {items.length} 项</span>
      </div>
      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b"><tr><TableHead>编码</TableHead><TableHead>名称</TableHead><TableHead>排序</TableHead><TableHead>操作</TableHead></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={4} className="text-center py-8 text-muted-foreground">加载中...</td></tr>
            : items.length === 0 ? <tr><td colSpan={4} className="text-center py-8 text-muted-foreground">暂无</td></tr>
            : items.map((d) => (
              <tr key={d.id} className="border-b hover:bg-muted/30">
                <TableCell className="font-mono text-sm">{d.code}</TableCell>
                <TableCell>{d.name}</TableCell>
                <TableCell>{d.sortOrder}</TableCell>
                <TableCell><TableRowActions>
                  <Button variant="ghost" size="sm" onClick={() => { setFormItem({ code: d.code, name: d.name, sortOrder: d.sortOrder }); setEditId(d.id); setDialogOpen(true) }}><Pencil className="h-4 w-4 mr-1" />编辑</Button>
                  <Button variant="ghost" size="sm" className="text-red-600" onClick={() => setDeleteTarget(d)}><Trash2 className="h-4 w-4 mr-1" />删除</Button>
                </TableRowActions></TableCell>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setDialogOpen(false)}>
          <div className="bg-background rounded-lg shadow-lg w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">{editId ? "编辑字典项" : "新增字典项"}</h2>
            <div className="space-y-4">
              <div><Label>编码 *</Label><Input value={formItem.code} onChange={(e) => setFormItem({ ...formItem, code: e.target.value })} disabled={!!editId} /></div>
              <div><Label>名称 *</Label><Input value={formItem.name} onChange={(e) => setFormItem({ ...formItem, name: e.target.value })} /></div>
              <div><Label>排序</Label><Input type="number" value={formItem.sortOrder} onChange={(e) => setFormItem({ ...formItem, sortOrder: parseInt(e.target.value) || 0 })} /></div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
              <Button onClick={handleSave} disabled={saving || !formItem.code || !formItem.name}>{saving ? "保存中..." : "保存"}</Button>
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null) }} title="确认删除" description={deleteTarget ? `确定要删除「${deleteTarget.name}」吗？` : ""} variant="destructive" confirmText="删除"  onConfirm={handleDelete} />
    </div>
  )
}

export default function AllianceDictionariesPage() {
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">字典管理</h1><p className="text-muted-foreground text-sm mt-1">维护合作类型与评级字典</p></div>
      <div className="rounded-lg border p-6">
        <h2 className="text-lg font-semibold mb-4">合作类型字典</h2>
        <DictionaryTab dictType="cooperation_type" label="合作类型" />
      </div>
      <div className="rounded-lg border p-6">
        <h2 className="text-lg font-semibold mb-4">合作评级字典</h2>
        <DictionaryTab dictType="cooperation_rating" label="合作评级" />
      </div>
    </div>
  )
}
