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
import type { AllianceSchoolInfo } from "@/lib/types"

export default function AllianceSchoolPage() {
  const { tenantId } = usePortalAuth()
  const { toast } = useToast()
  const [info, setInfo] = useState<AllianceSchoolInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!tenantId) return

    portalRequest<AllianceSchoolInfo>("/alliance/school-info")
      .then(setInfo)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [tenantId])

  const handleSave = async () => {
    if (!info) return
    setSaving(true)
    try {
      await portalRequest("/alliance/school-info", { method: "PUT", body: JSON.stringify(info) })
      toast({ title: "学校信息已保存" })
    } catch (e: any) {
      toast({ title: "保存失败", description: e.message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="text-center py-12 text-muted-foreground">加载中...</div>

  const update = (f: Partial<AllianceSchoolInfo>) => setInfo((prev) => prev ? { ...prev, ...f } : prev)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="grid gap-2">
          <h1 className="text-2xl font-bold">学校信息管理</h1>
          <p className="text-muted-foreground text-sm mt-1">配置学校基本信息，数据将展示在门户前台</p>
        </div>
        <Button onClick={handleSave} disabled={saving}>{saving ? "保存中..." : "保存"}</Button>
      </div>
      <Card>
        <CardHeader><CardTitle>基础信息</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>学校全称</Label>
              <Input value={info?.name || ""} onChange={(e) => update({ name: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>学校简称</Label>
              <Input value={info?.shortName || ""} onChange={(e) => update({ shortName: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>办学类型</Label>
              <Input value={info?.schoolType || ""} onChange={(e) => update({ schoolType: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>省份</Label>
              <Input value={info?.province || ""} onChange={(e) => update({ province: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>城市</Label>
              <Input value={info?.city || ""} onChange={(e) => update({ city: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>联系电话</Label>
              <Input value={info?.contactPhone || ""} onChange={(e) => update({ contactPhone: e.target.value })} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>地址</Label>
            <Input value={info?.address || ""} onChange={(e) => update({ address: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label>官网</Label>
            <Input value={info?.website || ""} onChange={(e) => update({ website: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label>学校简介</Label>
            <Textarea value={info?.description || ""} onChange={(e) => update({ description: e.target.value })} rows={6} />
          </div>
          <div className="grid gap-2">
            <Label>Logo URL</Label>
            <Input value={info?.logoUrl || ""} onChange={(e) => update({ logoUrl: e.target.value })} placeholder="https://..." />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
