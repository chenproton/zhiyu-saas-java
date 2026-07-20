"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
  Loader2,
  Pencil,
  Building,
  Phone,
  Globe,
  MapPin,
  Hash,
  FileText,
  Calendar,
  Shield,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { usePortalAuth } from "@/contexts/portal-auth-context"
import { portalRequest } from "@/lib/api"
import type { Tenant as BackendTenant } from "@/lib/types/backend"
import { Spinner } from "@/components/ui/spinner"

interface Tenant {
  id: string
  code: string
  enterpriseName: string
  contact: string
  phone: string
  adminCount: number
  domain: string
  address: string
  enterpriseCode: string
  description: string
  status: "active" | "inactive"
  createdAt: string
}

function mapBackendTenant(t: BackendTenant): Tenant {
  return {
    id: t.id,
    code: t.code,
    enterpriseName: t.name,
    contact: t.contact || "-",
    phone: t.phone || "-",
    adminCount: (t.adminIds || []).length,
    domain: t.domain || "-",
    address: t.address || "-",
    enterpriseCode: t.enterpriseCode || "-",
    description: t.description || "-",
    status: t.status,
    createdAt: t.createdAt,
  }
}

export default function TenantPage() {
  const { tenantId, loading: authLoading } = usePortalAuth()
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    contact: "",
    phone: "",
    domain: "",
    address: "",
    enterpriseCode: "",
    description: "",
    status: "active" as "active" | "inactive",
  })
  const [submitting, setSubmitting] = useState(false)
  const { toast } = useToast()

  const loadTenantToForm = (t: Tenant) => {
    setFormData({
      name: t.enterpriseName,
      contact: t.contact === "-" ? "" : t.contact,
      phone: t.phone === "-" ? "" : t.phone,
      domain: t.domain === "-" ? "" : t.domain,
      address: t.address === "-" ? "" : t.address,
      enterpriseCode: t.enterpriseCode === "-" ? "" : t.enterpriseCode,
      description: t.description === "-" ? "" : t.description,
      status: t.status,
    })
  }

  const fetchTenant = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    setError(null)
    try {
      const res = await portalRequest<BackendTenant>(`/tenants/${tenantId}`)
      const t = mapBackendTenant(res)
      setTenant(t)
      loadTenantToForm(t)
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载租户信息失败")
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => {
    if (authLoading) return
    fetchTenant()
  }, [fetchTenant, authLoading])

  const handleUpdate = async () => {
    if (!formData.name || !formData.contact || !formData.phone || !tenant) {
      setError("请填写学校名称、联系人、联系电话")
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await portalRequest(`/tenants/${tenant.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: formData.name,
          contact: formData.contact || null,
          phone: formData.phone || null,
          domain: formData.domain || null,
          address: formData.address || null,
          enterpriseCode: formData.enterpriseCode || null,
          description: formData.description || null,
        }),
      })
      setIsEditDialogOpen(false)
      toast({ title: "保存成功" })
      await fetchTenant()
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新租户失败")
    } finally {
      setSubmitting(false)
    }
  }

  const openEdit = () => {
    if (!tenant) return
    loadTenantToForm(tenant)
    setIsEditDialogOpen(true)
  }

  if (authLoading || loading) {
    return (
      <div className="flex h-64 items-center justify-center gap-2 text-muted-foreground">
        <Spinner className="h-5 w-5" />
        加载中...
      </div>
    )
  }

  return (
    <div className="p-6 bg-[#f5f7fa] min-h-full">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">租户信息管理</h1>
          <p className="mt-1 text-sm text-muted-foreground">查看和编辑当前租户信息</p>
        </div>
        {tenant && (
          <Button size="sm" onClick={openEdit}>
            <Pencil className="h-4 w-4 mr-1" />
            编辑
          </Button>
        )}
      </div>

      {error && !tenant && (
        <div className="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {!authLoading && !tenantId && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-center">
          <p className="text-amber-800 font-medium text-sm">未关联租户</p>
          <p className="text-amber-600 text-xs mt-1">当前账号未关联租户，请联系平台管理员分配租户后重试。</p>
        </div>
      )}

      {tenant && (
        <div className="rounded-lg border border-gray-100 bg-white shadow-sm">
          <div className="px-6 py-5 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Building className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">{tenant.enterpriseName}</h2>
                <p className="text-sm text-muted-foreground font-mono">{tenant.code}</p>
              </div>
              <Badge variant={tenant.status === "active" ? "default" : "secondary"} className="ml-auto">
                {tenant.status === "active" ? "启用" : "停用"}
              </Badge>
            </div>
          </div>
          <div className="px-6 py-5 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex items-start gap-3">
              <Phone className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">联系人</p>
                <p className="text-sm">{tenant.contact} / {tenant.phone}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Globe className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">绑定域名</p>
                <p className="text-sm">{tenant.domain}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">学校地址</p>
                <p className="text-sm">{tenant.address}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Hash className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">学校代码</p>
                <p className="text-sm font-mono">{tenant.enterpriseCode}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Calendar className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">创建时间</p>
                <p className="text-sm">{tenant.createdAt}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Shield className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">管理员数量</p>
                <p className="text-sm">{tenant.adminCount} 人</p>
              </div>
            </div>
          </div>
          {tenant.description && tenant.description !== "-" && (
            <div className="px-6 py-4 border-t border-gray-100">
              <div className="flex items-start gap-3">
                <FileText className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">学校简介</p>
                  <p className="text-sm mt-1 leading-relaxed">{tenant.description}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent size="lg" className="max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>编辑租户</DialogTitle>
            <DialogDescription>修改租户信息，租户标识创建后不可修改</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 overflow-y-auto flex-1 min-h-0">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>租户唯一标识</Label>
                <Input value={tenant?.code || ""} disabled className="bg-muted font-mono" />
              </div>
              <div className="grid gap-2">
                <Label>租户状态</Label>
                <Select value={formData.status} onValueChange={(v) => setFormData((prev) => ({ ...prev, status: v as "active" | "inactive" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">启用</SelectItem>
                    <SelectItem value="inactive">停用</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>学校名称 <span className="text-destructive">*</span></Label>
              <Input placeholder="如：清华大学" value={formData.name} onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>联系人 <span className="text-destructive">*</span></Label>
                <Input placeholder="学校联系人姓名" value={formData.contact} onChange={(e) => setFormData((prev) => ({ ...prev, contact: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label>联系电话 <span className="text-destructive">*</span></Label>
                <Input placeholder="联系电话" value={formData.phone} onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>绑定域名</Label>
              <Input placeholder="如：xxx.edu.cn" value={formData.domain} onChange={(e) => setFormData((prev) => ({ ...prev, domain: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>学校地址</Label>
              <Input placeholder="学校详细地址" value={formData.address} onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>学校代码</Label>
              <Input placeholder="统一社会信用代码" value={formData.enterpriseCode} onChange={(e) => setFormData((prev) => ({ ...prev, enterpriseCode: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>学校简介</Label>
              <Textarea placeholder="学校简介描述" value={formData.description} onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))} rows={3} />
            </div>
          </div>
          {error && (
            <div className="mb-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} disabled={submitting}>取消</Button>
            <Button onClick={handleUpdate} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
