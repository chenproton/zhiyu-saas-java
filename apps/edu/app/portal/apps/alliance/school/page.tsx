"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Pencil, Building, Phone, Globe, MapPin, Hash, FileText, Calendar, School, BookOpen, Monitor } from "lucide-react"
import { useToast } from "@zhiyu/ui"
import { usePortalAuth } from "@/contexts/portal-auth-context"
import { portalRequest } from "@/lib/api"
import type { Tenant as BackendTenant } from "@/lib/types/backend"
import { Spinner } from "@/components/ui/spinner"

interface Tenant {
  id: string; code: string; enterpriseName: string
  contact: string; phone: string; adminCount: number
  domain: string; address: string; enterpriseCode: string; description: string
  shortName: string; schoolType: string; province: string; city: string
  website: string; contactPhone: string
  status: "active" | "inactive"; createdAt: string
}

function mapBackendTenant(t: BackendTenant): Tenant {
  return {
    id: t.id, code: t.code, enterpriseName: t.name,
    contact: t.contact || "-", phone: t.phone || "-",
    adminCount: (t.adminIds || []).length,
    domain: t.domain || "-", address: t.address || "-",
    enterpriseCode: t.enterpriseCode || "-", description: t.description || "-",
    shortName: (t as any).shortName || "-", schoolType: (t as any).schoolType || "-",
    province: (t as any).province || "-", city: (t as any).city || "-",
    website: (t as any).website || "-", contactPhone: (t as any).contactPhone || "-",
    status: t.status, createdAt: t.createdAt,
  }
}

export default function AllianceSchoolPage() {
  const { tenantId, loading: authLoading } = usePortalAuth()
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [formData, setFormData] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const { toast } = useToast()

  const loadTenantToForm = (t: Tenant) => {
    setFormData({
      name: t.enterpriseName, shortName: t.shortName === "-" ? "" : t.shortName,
      schoolType: t.schoolType === "-" ? "" : t.schoolType,
      province: t.province === "-" ? "" : t.province, city: t.city === "-" ? "" : t.city,
      contact: t.contact === "-" ? "" : t.contact, phone: t.phone === "-" ? "" : t.phone,
      contactPhone: t.contactPhone === "-" ? "" : t.contactPhone,
      domain: t.domain === "-" ? "" : t.domain, address: t.address === "-" ? "" : t.address,
      website: t.website === "-" ? "" : t.website,
      enterpriseCode: t.enterpriseCode === "-" ? "" : t.enterpriseCode,
      description: t.description === "-" ? "" : t.description,
    })
  }

  const fetchTenant = useCallback(async () => {
    if (!tenantId) return
    setLoading(true); setError(null)
    try {
      const res = await portalRequest<BackendTenant>(`/tenants/${tenantId}`)
      const t = mapBackendTenant(res); setTenant(t); loadTenantToForm(t)
    } catch (err) { setError(err instanceof Error ? err.message : "加载失败") }
    finally { setLoading(false) }
  }, [tenantId])

  useEffect(() => { if (authLoading) return; fetchTenant() }, [fetchTenant, authLoading])

  const handleUpdate = async () => {
    if (!formData.name || !tenant) { setError("请填写学校名称"); return }
    setSubmitting(true); setError(null)
    try {
      await portalRequest(`/tenants/${tenant.id}`, { method: "PUT", body: JSON.stringify({
        name: formData.name, contact: formData.contact || null, phone: formData.phone || null,
        domain: formData.domain || null, address: formData.address || null,
        enterpriseCode: formData.enterpriseCode || null, description: formData.description || null,
        shortName: formData.shortName || null, schoolType: formData.schoolType || null,
        province: formData.province || null, city: formData.city || null,
        website: formData.website || null, contactPhone: formData.contactPhone || null,
      })})
      setIsEditDialogOpen(false); toast({ title: "学校信息已保存" }); await fetchTenant()
    } catch (err) { setError(err instanceof Error ? err.message : "保存失败") }
    finally { setSubmitting(false) }
  }

  const setF = (key: string, value: string) => setFormData(prev => ({ ...prev, [key]: value }))

  if (authLoading || loading) return <div className="flex h-64 items-center justify-center gap-2 text-muted-foreground"><Spinner className="h-5 w-5" />加载中...</div>

  return (
    <div className="p-6 bg-[#f5f7fa] min-h-full">
      <div className="mb-6 flex items-center justify-between">
        <div><h1 className="text-xl font-semibold">学校信息管理</h1><p className="mt-1 text-sm text-muted-foreground">配置学校基本信息，数据将展示在门户前台，与租户信息同步</p></div>
        {tenant && <Button size="sm" onClick={() => { loadTenantToForm(tenant); setIsEditDialogOpen(true) }}><Pencil className="h-4 w-4 mr-1" />编辑</Button>}
      </div>
      {!loading && !tenantId && <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-center"><p className="text-amber-800 font-medium text-sm">未关联租户</p></div>}
      {tenant && (
        <div className="rounded-lg border border-gray-100 bg-white shadow-sm">
          <div className="px-6 py-5 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center"><Building className="w-5 h-5 text-primary" /></div>
              <div><h2 className="text-lg font-semibold">{tenant.enterpriseName}</h2><p className="text-sm text-muted-foreground">{tenant.schoolType !== "-" ? tenant.schoolType : ""} {tenant.shortName !== "-" ? `(${tenant.shortName})` : ""}</p></div>
            </div>
          </div>
          <div className="px-6 py-5 grid grid-cols-1 md:grid-cols-2 gap-6">
            <Field icon={Phone} label="联系人" value={`${tenant.contact} / ${tenant.contactPhone !== "-" ? tenant.contactPhone : tenant.phone}`} />
            <Field icon={School} label="学校简称" value={tenant.shortName} />
            <Field icon={BookOpen} label="办学类型" value={tenant.schoolType} />
            <Field icon={MapPin} label="省份/城市" value={`${tenant.province} ${tenant.city}`} />
            <Field icon={Monitor} label="官网" value={tenant.website} />
            <Field icon={Globe} label="绑定域名" value={tenant.domain} />
            <Field icon={MapPin} label="学校地址" value={tenant.address} />
            <Field icon={Hash} label="学校代码" value={tenant.enterpriseCode} />
            <Field icon={Calendar} label="创建时间" value={tenant.createdAt} />
          </div>
          {tenant.description && tenant.description !== "-" && (
            <div className="px-6 py-4 border-t border-gray-100"><div className="flex items-start gap-3"><FileText className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" /><div><p className="text-xs text-muted-foreground">学校简介</p><p className="text-sm mt-1 leading-relaxed">{tenant.description}</p></div></div></div>
          )}
        </div>
      )}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent size="lg" className="max-h-[85vh] flex flex-col">
          <DialogHeader><DialogTitle>编辑学校信息</DialogTitle><DialogDescription>修改学校基本信息，保存后与租户信息同步更新</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-4 overflow-y-auto flex-1 min-h-0">
            <div className="grid gap-2"><Label>学校名称 <span className="text-destructive">*</span></Label><Input value={formData.name || ""} onChange={(e) => setF("name", e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>学校简称</Label><Input value={formData.shortName || ""} onChange={(e) => setF("shortName", e.target.value)} /></div>
              <div className="grid gap-2"><Label>办学类型</Label><Input value={formData.schoolType || ""} onChange={(e) => setF("schoolType", e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>省份</Label><Input value={formData.province || ""} onChange={(e) => setF("province", e.target.value)} /></div>
              <div className="grid gap-2"><Label>城市</Label><Input value={formData.city || ""} onChange={(e) => setF("city", e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2"><Label>联系人</Label><Input value={formData.contact || ""} onChange={(e) => setF("contact", e.target.value)} /></div>
              <div className="grid gap-2"><Label>联系电话</Label><Input value={formData.contactPhone || formData.phone || ""} onChange={(e) => { setF("phone", e.target.value); setF("contactPhone", e.target.value) }} /></div>
              <div className="grid gap-2"><Label>官网</Label><Input value={formData.website || ""} onChange={(e) => setF("website", e.target.value)} /></div>
            </div>
            <div className="grid gap-2"><Label>学校地址</Label><Input value={formData.address || ""} onChange={(e) => setF("address", e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>学校代码</Label><Input value={formData.enterpriseCode || ""} onChange={(e) => setF("enterpriseCode", e.target.value)} /></div>
              <div className="grid gap-2"><Label>绑定域名</Label><Input value={formData.domain || ""} onChange={(e) => setF("domain", e.target.value)} /></div>
            </div>
            <div className="grid gap-2"><Label>学校简介</Label><Textarea value={formData.description || ""} onChange={(e) => setF("description", e.target.value)} rows={3} /></div>
          </div>
          {error && <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} disabled={submitting}>取消</Button>
            <Button onClick={handleUpdate} disabled={submitting}>{submitting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Field({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
      <div><p className="text-xs text-muted-foreground">{label}</p><p className="text-sm">{value === "- -" ? "-" : value}</p></div>
    </div>
  )
}
