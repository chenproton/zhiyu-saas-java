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
import type { AllianceAchievement } from "@/lib/types"

export default function AllianceAchievementEditPage() {
  const { id } = useParams<{ id: string }>()
  const { tenantId } = usePortalAuth()
  const { toast } = useToast()
  const router = useRouter()
  const [item, setItem] = useState<AllianceAchievement | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!tenantId || !id) return
    portalRequest<AllianceAchievement>(`/alliance/achievements/${id}`)
      .then((data) => setItem(data))
      .catch((e) => toast({ title: "加载失败", description: e.message, variant: "destructive" }))
      .finally(() => setLoading(false))
  }, [tenantId, id, toast])

  const handleSave = async () => {
    if (!item) return
    setSaving(true)
    try {
      await portalRequest(`/alliance/achievements/${id}`, { method: "PUT", body: JSON.stringify(item) })
      toast({ title: "成果已更新" })
      router.push(`/portal/apps/alliance/achievements/${id}`)
    } catch (e: any) {
      toast({ title: "保存失败", description: e.message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="text-center py-12 text-muted-foreground">加载中...</div>
  if (!item) return <div className="text-center py-12 text-muted-foreground">成果不存在</div>

  const setField = (field: string, value: any) => setItem({ ...item, [field]: value })

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-1" />返回
        </Button>
        <h1 className="text-xl font-bold">编辑合作成果</h1>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle>基本信息</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>成果名称 *</Label>
                <Input value={item.title} onChange={(e) => setField("title", e.target.value)} />
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
                <Input value={item.achievementDate || ""} onChange={(e) => setField("achievementDate", e.target.value)} type="date" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>成果描述</CardTitle></CardHeader>
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
