"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { ArrowLeft, Loader2 } from "lucide-react"
import { usePortalAuth } from "@/contexts/portal-auth-context"
import { portalRequest } from "@/lib/api"
import { useToast } from "@zhiyu/ui"
import type { AllianceEnterprise } from "@/lib/types"

export default function AllianceEnterpriseEditPage() {
  const { id } = useParams<{ id: string }>()
  const { tenantId } = usePortalAuth()
  const { toast } = useToast()
  const router = useRouter()
  const [item, setItem] = useState<AllianceEnterprise | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!tenantId || !id) return
    portalRequest<AllianceEnterprise>(`/alliance/enterprises/${id}`)
      .then((data) => setItem(data))
      .catch((e) => toast({ title: "加载失败", description: e.message, variant: "destructive" }))
      .finally(() => setLoading(false))
  }, [tenantId, id, toast])

  const handleSave = async () => {
    if (!item) return
    setSaving(true)
    try {
      await portalRequest(`/alliance/enterprises/${id}`, { method: "PUT", body: JSON.stringify(item) })
      toast({ title: "企业已更新" })
      router.push(`/portal/apps/alliance/enterprises/${id}`)
    } catch (e: any) {
      toast({ title: "保存失败", description: e.message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="text-center py-12 text-muted-foreground">加载中...</div>
  if (!item) return <div className="text-center py-12 text-muted-foreground">企业不存在</div>

  const setField = (field: string, value: any) => setItem({ ...item, [field]: value })

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-1" />返回
        </Button>
        <h1 className="text-xl font-bold">编辑合作企业</h1>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle>基本信息</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>企业名称 *</Label>
                <Input value={item.name || ""} onChange={(e) => setField("name", e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>企业类型</Label>
                <Select value={item.enterpriseType || "platform"} onValueChange={(v) => setField("enterpriseType", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="platform">平台企业</SelectItem>
                    <SelectItem value="school-based">校本企业</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>所属行业</Label>
                <Input value={item.industry || ""} onChange={(e) => setField("industry", e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>所在地区</Label>
                <Input value={item.region || ""} onChange={(e) => setField("region", e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>合作状态</Label>
                <Select value={item.status || "negotiating"} onValueChange={(v) => setField("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="negotiating">洽谈中</SelectItem>
                    <SelectItem value="active">合作中</SelectItem>
                    <SelectItem value="paused">已暂停</SelectItem>
                    <SelectItem value="terminated">已终止</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>合作评级</Label>
                <Select value={item.rating || "general"} onValueChange={(v) => setField("rating", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="strategic">战略合作</SelectItem>
                    <SelectItem value="deep">深度合作</SelectItem>
                    <SelectItem value="general">一般合作</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>联系信息</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>联系人</Label>
                <Input value={item.contactPerson || ""} onChange={(e) => setField("contactPerson", e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>联系电话</Label>
                <Input value={item.contactPhone || ""} onChange={(e) => setField("contactPhone", e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>联系邮箱</Label>
                <Input value={item.contactEmail || ""} onChange={(e) => setField("contactEmail", e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>企业地址</Label>
                <Input value={item.address || ""} onChange={(e) => setField("address", e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Logo URL</Label>
                <Input value={(item as any).logoUrl || ""} onChange={(e) => setField("logoUrl", e.target.value)} placeholder="https://..." />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>企业描述</CardTitle></CardHeader>
            <CardContent>
              <Textarea value={item.description || ""} onChange={(e) => setField("description", e.target.value)} rows={5} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>设置</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>公开显示</Label>
                <Switch checked={item.isPublic || false} onCheckedChange={(v) => setField("isPublic", v)} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-3">
              <Button className="w-full" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}保存
              </Button>
              <Button variant="outline" className="w-full" onClick={() => router.back()}>取消</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
