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

export default function AllianceAchievementNewPage() {
  const { tenantId } = usePortalAuth()
  const { toast } = useToast()
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [item, setItem] = useState({
    title: "",
    type: "custom",
    description: "",
    achievementDate: "",
    isPublic: false,
  })

  const setField = (field: string, value: any) => setItem({ ...item, [field]: value })

  const handleSave = async () => {
    setSaving(true)
    try {
      const data = await portalRequest<{ id: string }>("/alliance/achievements", {
        method: "POST",
        body: JSON.stringify(item),
      })
      toast({ title: "成果已创建" })
      router.push(`/portal/apps/alliance/achievements/${data.id}`)
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
        <h1 className="text-xl font-bold">新建合作成果</h1>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle>基本信息</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>成果名称 *</Label>
                <Input value={item.title} onChange={(e) => setField("title", e.target.value)} placeholder="请输入成果名称" />
              </div>
              <div className="grid gap-2">
                <Label>成果类型</Label>
                <Select value={item.type} onValueChange={(v) => setField("type", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="job">岗位</SelectItem>
                    <SelectItem value="scene">场景</SelectItem>
                    <SelectItem value="course">课程</SelectItem>
                    <SelectItem value="custom">自定义</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>成果日期</Label>
                <Input value={item.achievementDate} onChange={(e) => setField("achievementDate", e.target.value)} type="date" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>成果描述</CardTitle></CardHeader>
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
