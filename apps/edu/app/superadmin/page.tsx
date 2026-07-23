"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Plus,
  Pencil,
  Power,
  Trash2,
  Search,
  Loader2,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"

const API_BASE = "/api/v1/admin/tenants"

interface AdminTenant {
  id: string
  name: string
  code: string
  logoUrl?: string
  domain?: string
  enterpriseCode?: string
  contact?: string
  phone?: string
  address?: string
  description?: string
  adminIds: string[]
  status: "active" | "inactive"
  createdAt: string
  updatedAt: string
}

interface ListResponse<T> {
  items: T[]
  total: number
}

async function adminFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  }
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers })
  const data = await res.json().catch(() => ({ error: "请求失败" }))
  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`)
  }
  return data
}

export default function SuperAdminPage() {
  const [tenants, setTenants] = useState<AdminTenant[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTenant, setEditingTenant] = useState<AdminTenant | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [formData, setFormData] = useState({
    name: "",
    code: "",
    contact: "",
    phone: "",
    domain: "",
    enterpriseCode: "",
    address: "",
    description: "",
    status: "active" as "active" | "inactive",
  })

  const [toggleTarget, setToggleTarget] = useState<AdminTenant | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AdminTenant | null>(null)

  const { toast } = useToast()

  const resetForm = () => {
    setFormData({ name: "", code: "", contact: "", phone: "", domain: "", enterpriseCode: "", address: "", description: "", status: "active" })
  }

  const loadForm = (t: AdminTenant) => {
    setFormData({
      name: t.name,
      code: t.code,
      contact: t.contact || "",
      phone: t.phone || "",
      domain: t.domain || "",
      enterpriseCode: t.enterpriseCode || "",
      address: t.address || "",
      description: t.description || "",
      status: t.status,
    })
  }

  const fetchTenants = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = searchTerm ? `?search=${encodeURIComponent(searchTerm)}` : ""
      const res = await adminFetch<ListResponse<AdminTenant>>(params)
      setTenants(res.items)
      setTotal(res.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载租户列表失败")
    } finally {
      setLoading(false)
    }
  }, [searchTerm])

  useEffect(() => {
    fetchTenants()
  }, [fetchTenants])

  useEffect(() => {
    const timer = setTimeout(() => fetchTenants(), 300)
    return () => clearTimeout(timer)
  }, [searchTerm])

  const openCreate = () => {
    setEditingTenant(null)
    resetForm()
    setDialogOpen(true)
  }

  const openEdit = (t: AdminTenant) => {
    setEditingTenant(t)
    loadForm(t)
    setDialogOpen(true)
  }

  const handleSubmit = async () => {
    if (!formData.name) {
      setError("企业名称不能为空")
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      if (editingTenant) {
        await adminFetch(`/${editingTenant.id}`, {
          method: "PUT",
          body: JSON.stringify({
            name: formData.name,
            contact: formData.contact || null,
            phone: formData.phone || null,
            domain: formData.domain || null,
            enterpriseCode: formData.enterpriseCode || null,
            address: formData.address || null,
            description: formData.description || null,
          }),
        })
        toast({ title: "更新成功" })
      } else {
        const code = formData.code || "t" + Math.random().toString(36).substring(2, 9)
        await adminFetch("", {
          method: "POST",
          body: JSON.stringify({
            name: formData.name,
            code,
            contact: formData.contact || null,
            phone: formData.phone || null,
            domain: formData.domain || null,
            enterpriseCode: formData.enterpriseCode || null,
            address: formData.address || null,
            description: formData.description || null,
          }),
        })
        toast({ title: "创建成功" })
      }
      setDialogOpen(false)
      await fetchTenants()
    } catch (err) {
      setError(err instanceof Error ? err.message : (editingTenant ? "更新失败" : "创建失败"))
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleClick = (t: AdminTenant) => {
    setToggleTarget(t)
  }

  const confirmToggleStatus = async () => {
    if (!toggleTarget) return
    const newStatus = toggleTarget.status === "active" ? "inactive" : "active"
    const label = newStatus === "active" ? "启用" : "停用"
    try {
      await adminFetch(`/${toggleTarget.id}/status`, {
        method: "POST",
        body: JSON.stringify({ status: newStatus }),
      })
      toast({ title: `${label}成功` })
      await fetchTenants()
    } catch (err) {
      toast({ variant: "destructive", title: `${label}失败`, description: err instanceof Error ? err.message : "未知错误" })
    } finally {
      setToggleTarget(null)
    }
  }

  const handleDeleteClick = (t: AdminTenant) => {
    setDeleteTarget(t)
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await adminFetch(`/${deleteTarget.id}`, { method: "DELETE" })
      toast({ title: "删除成功" })
      await fetchTenants()
    } catch (err) {
      toast({ variant: "destructive", title: "删除失败", description: err instanceof Error ? err.message : "未知错误" })
    } finally {
      setDeleteTarget(null)
    }
  }

  return (
    <div className="p-6 bg-[#f5f7fa] min-h-full">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">超级管理员 - 租户管理</h1>
          <p className="mt-1 text-sm text-muted-foreground">管理所有平台租户，支持增删改查</p>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          新增租户
        </Button>
      </div>

      <div className="mb-4 flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="搜索企业名称或标识..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="rounded-lg border border-gray-100 bg-white shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground w-24">租户标识</TableHead>
                  <TableHead className="text-muted-foreground">企业名称</TableHead>
                  <TableHead className="text-muted-foreground">联系人</TableHead>
                  <TableHead className="text-muted-foreground">联系电话</TableHead>
                  <TableHead className="text-muted-foreground">状态</TableHead>
                  <TableHead className="text-muted-foreground">创建时间</TableHead>
                  <TableHead className="text-muted-foreground text-right w-16">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenants.map((t) => (
                  <TableRow key={t.id} className="border-border group">
                    <TableCell className="font-mono text-sm text-muted-foreground">{t.code}</TableCell>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell>{t.contact || "-"}</TableCell>
                    <TableCell className="text-muted-foreground">{t.phone || "-"}</TableCell>
                    <TableCell>
                      <Badge variant={t.status === "active" ? "default" : "secondary"}>
                        {t.status === "active" ? "启用" : "停用"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">{new Date(t.createdAt).toLocaleDateString("zh-CN")}</TableCell>
                    <TableCell className="text-right relative">
                      <div className="flex items-center justify-end gap-1 absolute right-0 top-1/2 -translate-y-1/2 bg-white/95 backdrop-blur-sm z-10 px-2 py-1 rounded-lg shadow-sm border border-slate-100 opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => openEdit(t)}
                        >
                          <Pencil className="mr-1 h-3 w-3" />
                          编辑
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => handleToggleClick(t)}
                        >
                          <Power className="mr-1 h-3 w-3" />
                          {t.status === "active" ? "停用" : "启用"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-red-500 hover:text-red-600"
                          onClick={() => handleDeleteClick(t)}
                        >
                          <Trash2 className="mr-1 h-3 w-3" />
                          删除
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {tenants.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                      暂无租户
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
            <span>共 {total} 条记录</span>
          </div>
        </>
      )}

      {/* 新增/编辑对话框 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent size="lg" className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTenant ? "编辑租户" : "新增租户"}</DialogTitle>
            <DialogDescription>
              {editingTenant ? "修改租户信息，租户标识创建后不可修改" : "创建新的平台租户"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>租户标识 <span className="text-destructive">*</span></Label>
                <Input
                  placeholder="唯一标识，创建后不可修改"
                  value={formData.code}
                  onChange={(e) => setFormData((p) => ({ ...p, code: e.target.value }))}
                  disabled={!!editingTenant}
                  className={editingTenant ? "bg-muted font-mono" : "font-mono"}
                />
              </div>
              <div className="grid gap-2">
                <Label>状态</Label>
                <Select value={formData.status} onValueChange={(v) => setFormData((p) => ({ ...p, status: v as "active" | "inactive" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">启用</SelectItem>
                    <SelectItem value="inactive">停用</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>企业名称 <span className="text-destructive">*</span></Label>
              <Input placeholder="如：清华大学" value={formData.name} onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>联系人</Label>
                <Input placeholder="企业联系人姓名" value={formData.contact} onChange={(e) => setFormData((p) => ({ ...p, contact: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label>联系电话</Label>
                <Input placeholder="联系电话" value={formData.phone} onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>绑定域名</Label>
                <Input placeholder="如：xxx.edu.cn" value={formData.domain} onChange={(e) => setFormData((p) => ({ ...p, domain: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label>企业代码</Label>
                <Input placeholder="统一社会信用代码" value={formData.enterpriseCode} onChange={(e) => setFormData((p) => ({ ...p, enterpriseCode: e.target.value }))} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>企业地址</Label>
              <Input placeholder="企业详细地址" value={formData.address} onChange={(e) => setFormData((p) => ({ ...p, address: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>企业简介</Label>
              <Textarea placeholder="企业简介描述" value={formData.description} onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))} rows={3} />
            </div>
          </div>
          {error && (
            <div className="mb-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>取消</Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              {editingTenant ? "保存" : "创建"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={toggleTarget !== null}
        onOpenChange={(open) => { if (!open) setToggleTarget(null) }}
        title={toggleTarget ? `${toggleTarget.status === "active" ? "停用" : "启用"}租户` : ""}
        description={toggleTarget ? `确定${toggleTarget.status === "active" ? "停用" : "启用"}租户「${toggleTarget.name}」吗？` : ""}
        confirmText={toggleTarget ? (toggleTarget.status === "active" ? "停用" : "启用") : ""}
        onConfirm={confirmToggleStatus}
      />
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
        title="确认删除"
        description={deleteTarget ? `确定删除租户「${deleteTarget.name}」吗？此操作不可撤销。` : ""}
        confirmText="删除"
        variant="destructive"
        onConfirm={confirmDelete}
      />
    </div>
  )
}
