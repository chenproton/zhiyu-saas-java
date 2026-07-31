"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
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

export default function AllianceEnterpriseNewPage() {
  const { tenantId } = usePortalAuth()
  const { toast } = useToast()
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [item, setItem] = useState({
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
    logoUrl: "",
    address: "",
  })

  const setField = (field: string, value: any) => setItem({ ...item, [field]: value })

  const handleSave = async () => {
    setSaving(true)
    try {
      const data = await portalRequest<{ id: string }>("/alliance/enterprises", {
        method: "POST",
        body: JSON.stringify(item),
      })
      toast({ title: "企业已创建" })
      router.push(`/portal/apps/alliance/enterprises/${data.id}`)
    } catch (e: any) {
      toast({ title: "保存失败", description: e.message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-1" />返回
        </Button>
        <h1 className="text-xl font-bold">新建合作企业</h1>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle>基本信息</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>企业名称 *</Label>
                <Input value={item.name} onChange={(e) => setField("name", e.target.value)} placeholder="请输入企业名称" />
              </div>
              <div className="grid gap-2">
                <Label>企业类型</Label>
                <Select value={item.enterpriseType} onValueChange={(v) => setField("enterpriseType", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="platform">平台企业</SelectItem>
                    <SelectItem value="school-based">校本企业</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>所属行业</Label>
                <Input value={item.industry} onChange={(e) => setField("industry", e.target.value)} placeholder="如：信息技术" />
              </div>
              <div className="grid gap-2">
                <Label>所在地区</Label>
                <Input value={item.region} onChange={(e) => setField("region", e.target.value)} placeholder="如：深圳" />
              </div>
              <div className="grid gap-2">
                <Label>合作状态</Label>
                <Select value={item.status} onValueChange={(v) => setField("status", v)}>
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
                <Select value={item.rating} onValueChange={(v) => setField("rating", v)}>
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
                <Input value={item.contactPerson} onChange={(e) => setField("contactPerson", e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>联系电话</Label>
                <Input value={item.contactPhone} onChange={(e) => setField("contactPhone", e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>联系邮箱</Label>
                <Input value={item.contactEmail} onChange={(e) => setField("contactEmail", e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>企业地址</Label>
                <Input value={item.address} onChange={(e) => setField("address", e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Logo URL</Label>
                <Input value={item.logoUrl} onChange={(e) => setField("logoUrl", e.target.value)} placeholder="https://..." />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>企业描述</CardTitle></CardHeader>
            <CardContent>
              <Textarea value={item.description} onChange={(e) => setField("description", e.target.value)} rows={5} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>设置</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>公开显示</Label>
                <Switch checked={item.isPublic} onCheckedChange={(v) => setField("isPublic", v)} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-3">
              <Button className="w-full" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}创建
              </Button>
              <Button variant="outline" className="w-full" onClick={() => router.back()}>取消</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
