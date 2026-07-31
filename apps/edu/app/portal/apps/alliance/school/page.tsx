"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { usePortalAuth } from "@/contexts/portal-auth-context"
import { portalRequest } from "@/lib/api"
import { useToast } from "@zhiyu/ui"
import type { Tenant as BackendTenant } from "@/lib/types/backend"

export default function AllianceSchoolPage() {
  const { tenantId } = usePortalAuth()
  const { toast } = useToast()
  const [tenant, setTenant] = useState<BackendTenant | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!tenantId) return
    portalRequest<BackendTenant>(`/tenants/${tenantId}`)
      .then(setTenant)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [tenantId])

  const handleSave = async () => {
    if (!tenant) return
    setSaving(true)
    try {
      await portalRequest(`/tenants/${tenant.id}`, { method: "PUT", body: JSON.stringify(tenant) })
      toast({ title: "学校信息已保存" })
    } catch (e: any) {
      toast({ title: "保存失败", description: e.message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="text-center py-12 text-muted-foreground">加载中...</div>

  const update = (f: Partial<BackendTenant>) => setTenant((prev) => prev ? { ...prev, ...f } : prev)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">学校信息管理</h1>
          <p className="text-muted-foreground text-sm mt-1">配置学校基本信息，数据将展示在门户前台，与租户信息同步</p>
        </div>
        <Button onClick={handleSave} disabled={saving}>{saving ? "保存中..." : "保存"}</Button>
      </div>
      <Card>
        <CardHeader><CardTitle>基础信息</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>学校全称</Label>
              <Input value={(tenant as any)?.name || ""} onChange={(e) => update({ name: e.target.value } as any)} />
            </div>
            <div className="grid gap-2">
              <Label>学校简称</Label>
              <Input value={(tenant as any)?.shortName || ""} onChange={(e) => update({ shortName: e.target.value } as any)} />
            </div>
            <div className="grid gap-2">
              <Label>办学类型</Label>
              <Input value={(tenant as any)?.schoolType || ""} onChange={(e) => update({ schoolType: e.target.value } as any)} />
            </div>
            <div className="grid gap-2">
              <Label>省份</Label>
              <Input value={(tenant as any)?.province || ""} onChange={(e) => update({ province: e.target.value } as any)} />
            </div>
            <div className="grid gap-2">
              <Label>城市</Label>
              <Input value={(tenant as any)?.city || ""} onChange={(e) => update({ city: e.target.value } as any)} />
            </div>
            <div className="grid gap-2">
              <Label>联系电话</Label>
              <Input value={(tenant as any)?.contactPhone || ""} onChange={(e) => update({ contactPhone: e.target.value } as any)} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>地址</Label>
            <Input value={(tenant as any)?.address || ""} onChange={(e) => update({ address: e.target.value } as any)} />
          </div>
          <div className="grid gap-2">
            <Label>官网</Label>
            <Input value={(tenant as any)?.website || ""} onChange={(e) => update({ website: e.target.value } as any)} />
          </div>
          <div className="grid gap-2">
            <Label>学校简介</Label>
            <Textarea value={(tenant as any)?.description || ""} onChange={(e) => update({ description: e.target.value } as any)} rows={6} />
          </div>
          <div className="grid gap-2">
            <Label>Logo URL</Label>
            <Input value={(tenant as any)?.logoUrl || ""} onChange={(e) => update({ logoUrl: e.target.value } as any)} placeholder="https://..." />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
