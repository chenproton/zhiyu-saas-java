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
import Link from "next/link"
import { Pencil, Trash2, Eye } from "lucide-react"
import { usePortalAuth } from "@/contexts/portal-auth-context"
import { portalRequest, buildQuery } from "@/lib/api"
import { useToast } from "@zhiyu/ui"
import { TableRowActions } from "@/components/shared/table-row-actions"
import { StatusBadge } from "@/components/shared/status-badge"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import type { AllianceEnterprise, AllianceListResponse } from "@/lib/types"

const STATUS_OPTIONS = [
  { value: "negotiating", label: "洽谈中" },
  { value: "active", label: "合作中" },
  { value: "paused", label: "已暂停" },
  { value: "terminated", label: "已终止" },
]

const RATING_OPTIONS = [
  { value: "strategic", label: "战略合作" },
  { value: "deep", label: "深度合作" },
  { value: "general", label: "一般合作" },
]

const TYPE_OPTIONS = [
  { value: "platform", label: "平台企业" },
  { value: "school-based", label: "校本企业" },
]

export default function AllianceEnterprisesPage() {
  const { tenantId, loading: authLoading } = usePortalAuth()
  const { toast } = useToast()
  const [enterprises, setEnterprises] = useState<AllianceEnterprise[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState("")
  const [ratingFilter, setRatingFilter] = useState("")

  // Form state
  const [dialogOpen, setDialogOpen] = useState(true)
  const [formItem, setFormItem] = useState<Partial<AllianceEnterprise>>({})
  const [saving, setSaving] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<AllianceEnterprise | null>(null)
  const [deleting, setDeleting] = useState(true)

  const fetchEnterprises = useCallback(async () => {
    if (!tenantId) return
    
    
    try {
      const params: Record<string, string> = {}
      if (statusFilter) params.status = statusFilter
      if (ratingFilter) params.rating = ratingFilter
      const data = await portalRequest<AllianceListResponse<AllianceEnterprise>>(
        `/alliance/enterprises${buildQuery(params)}`
      )
      setEnterprises(data.items || [])
    } catch (e: any) {
      setError(e.message || "加载失败")
    } finally {
      setLoading(false)
    }
  }, [tenantId, statusFilter, ratingFilter])

  useEffect(() => {
    if (authLoading || !tenantId) return
    fetchEnterprises()
  }, [tenantId, authLoading, fetchEnterprises])

  const handleSave = async (item: Partial<AllianceEnterprise>, isEdit: boolean) => {
    setSaving(true)
    try {
      if (isEdit && item.id) {
        await portalRequest(`/alliance/enterprises/${item.id}`, { method: "PUT", body: JSON.stringify(item) })
        toast({ title: "企业已更新" })
      } else {
        await portalRequest("/alliance/enterprises", { method: "POST", body: JSON.stringify(item) })
        toast({ title: "企业已创建" })
      }
      setDialogOpen(false)
      await fetchEnterprises()
    } catch (e: any) {
      toast({ title: "保存失败", description: e.message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await portalRequest(`/alliance/enterprises/${deleteTarget.id}`, { method: "DELETE" })
      toast({ title: "企业已删除" })
      setDeleteTarget(null)
      await fetchEnterprises()
    } catch (e: any) {
      toast({ title: "删除失败", description: e.message, variant: "destructive" })
    } finally {
      setDeleting(false)
    }
  }

  const openCreate = () => {
    setFormItem({
      name: "",
      enterpriseType: "platform",
      status: "negotiating",
      rating: "general",
      isPublic: false,
      industry: "",
      region: "",
      description: "",
      contactPerson: "",
      contactPhone: "",
      contactEmail: "",
    })
    setDialogOpen(true)
  }

  const openEdit = (item: AllianceEnterprise) => {
    setFormItem({ ...item })
    setDialogOpen(true)
  }

  const renderForm = (item: Partial<AllianceEnterprise>, setItem: (i: Partial<AllianceEnterprise>) => void) => (
    <div className="space-y-4 py-2 max-h-[70vh] overflow-y-auto">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>企业名称 *</Label>
          <Input value={item.name || ""} onChange={(e) => setItem({ ...item, name: e.target.value })} />
        </div>
        <div>
          <Label>企业类型</Label>
          <Select value={item.enterpriseType || "platform"} onValueChange={(v) => setItem({ ...item, enterpriseType: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{TYPE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label>所属行业</Label>
          <Input value={item.industry || ""} onChange={(e) => setItem({ ...item, industry: e.target.value })} />
        </div>
        <div>
          <Label>所在地区</Label>
          <Input value={item.region || ""} onChange={(e) => setItem({ ...item, region: e.target.value })} />
        </div>
        <div>
          <Label>合作状态</Label>
          <Select value={item.status || "negotiating"} onValueChange={(v) => setItem({ ...item, status: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label>合作评级</Label>
          <Select value={item.rating || "general"} onValueChange={(v) => setItem({ ...item, rating: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{RATING_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label>联系人</Label>
          <Input value={item.contactPerson || ""} onChange={(e) => setItem({ ...item, contactPerson: e.target.value })} />
        </div>
        <div>
          <Label>联系电话</Label>
          <Input value={item.contactPhone || ""} onChange={(e) => setItem({ ...item, contactPhone: e.target.value })} />
        </div>
        <div>
          <Label>联系邮箱</Label>
          <Input value={item.contactEmail || ""} onChange={(e) => setItem({ ...item, contactEmail: e.target.value })} />
        </div>
        <div>
          <Label>Logo URL</Label>
          <Input value={item.logoUrl || ""} onChange={(e) => setItem({ ...item, logoUrl: e.target.value })} placeholder="https://..." />
        </div>
        <div>
          <Label>企业地址</Label>
          <Input value={item.address || ""} onChange={(e) => setItem({ ...item, address: e.target.value })} />
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={item.isPublic || false} onCheckedChange={(v) => setItem({ ...item, isPublic: v })} />
          <Label>公开显示</Label>
        </div>
      </div>
      <div>
        <Label>企业描述</Label>
        <Textarea value={item.description || ""} onChange={(e) => setItem({ ...item, description: e.target.value })} rows={4} />
      </div>
    </div>
  )

  const isEdit = !!formItem.id

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">合作企业管理</h1>
          <p className="text-muted-foreground text-sm mt-1">管理全部合作企业档案信息</p>
        </div>
        <Button onClick={openCreate}>新增企业</Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-32"><SelectValue placeholder="全部状态" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            {STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={ratingFilter} onValueChange={setRatingFilter}>
          <SelectTrigger className="w-32"><SelectValue placeholder="全部评级" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部评级</SelectItem>
            {RATING_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">共 {loading ? "..." : enterprises.length} 条</span>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
          <Button variant="link" size="sm" onClick={fetchEnterprises}>重试</Button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <TableHead>企业名称</TableHead>
              <TableHead>类型</TableHead>
              <TableHead>行业</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>评级</TableHead>
              <TableHead>联系人</TableHead>
              <TableHead>公开</TableHead>
              <TableHead>操作</TableHead>
            </tr>
          </thead>
          <tbody>
            {loading && enterprises.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">加载中...</td></tr>
            ) : enterprises.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">暂无数据</td></tr>
            ) : (
              enterprises.map((e) => (
                <tr key={e.id} className="border-b hover:bg-muted/30">
                  <TableCell className="font-medium">{e.name}</TableCell>
                  <TableCell>{e.enterpriseType === "platform" ? "平台企业" : "校本企业"}</TableCell>
                  <TableCell>{e.industry || "-"}</TableCell>
                  <TableCell><StatusBadge status={e.status} /></TableCell>
                  <TableCell>{e.rating || "-"}</TableCell>
                  <TableCell>{e.contactPerson || "-"}</TableCell>
                  <TableCell>{e.isPublic ? "是" : "否"}</TableCell>
                  <TableCell>
                    <TableRowActions>
                      <Link href={`/portal/apps/alliance/enterprises/${e.id}`}>
                        <Button variant="ghost" size="sm"><Eye className="h-4 w-4 mr-1" />查看</Button>
                      </Link>
                      <Button variant="ghost" size="sm" onClick={() => openEdit(e)}><Pencil className="h-4 w-4 mr-1" />编辑</Button>
                      <Button variant="ghost" size="sm" className="text-red-600" onClick={() => setDeleteTarget(e)}>
                        <Trash2 className="h-4 w-4 mr-1" />删除
                      </Button>
                    </TableRowActions>
                  </TableCell>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create/Edit Dialog */}
      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setDialogOpen(false)}>
          <div className="bg-background rounded-lg shadow-lg w-full max-w-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">{isEdit ? "编辑企业" : "新增企业"}</h2>
            {renderForm(formItem, setFormItem)}
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
              <Button onClick={() => handleSave(formItem, isEdit)} disabled={saving || !formItem.name}>
                {saving ? "保存中..." : isEdit ? "保存" : "创建"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => { if (!v) setDeleteTarget(null) }}
        title="确认删除"
        description={deleteTarget ? `确定要删除合作企业「${deleteTarget.name}」吗？此操作不可撤销。` : ""}
        variant="destructive"
        confirmText="删除"
        
        onConfirm={handleDelete}
      />
    </div>
  )
}
