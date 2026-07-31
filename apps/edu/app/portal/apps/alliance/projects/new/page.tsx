"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { MultiSelect } from "@/components/ui/multi-select"
import { ArrowLeft, Loader2 } from "lucide-react"
import { usePortalAuth } from "@/contexts/portal-auth-context"
import { portalRequest } from "@/lib/api"
import { useToast } from "@zhiyu/ui"
import type { AllianceEnterprise, AllianceListResponse } from "@/lib/types"

const SECONDARY_COLLEGES = [
  "智能制造学院", "信息技术学院", "经济管理学院", "艺术设计学院",
  "新能源工程学院", "生物医药学院", "现代服务学院", "国际教育学院",
  "创新创业学院", "继续教育学院", "基础教育学院", "马克思主义学院",
]

export default function AllianceProjectNewPage() {
  const { tenantId } = usePortalAuth()
  const { toast } = useToast()
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [enterprises, setEnterprises] = useState<{ label: string; value: string }[]>([])
  const [item, setItem] = useState({
    name: "",
    type: "",
    phase: "initiation",
    startDate: "",
    endDate: "",
    budget: "",
    description: "",
    isPublic: false,
    enterpriseIds: [] as string[],
    secondaryColleges: [] as string[],
  })

  useEffect(() => {
    portalRequest<AllianceListResponse<AllianceEnterprise>>("/alliance/enterprises?limit=1000")
      .then((res) => setEnterprises((res.items || []).map((e) => ({ label: e.name, value: e.id }))))
      .catch(() => {})
  }, [])

  const setField = (field: string, value: any) => setItem({ ...item, [field]: value })

  const handleSave = async () => {
    setSaving(true)
    try {
      const data = await portalRequest<{ id: string }>("/alliance/projects", {
        method: "POST",
        body: JSON.stringify(item),
      })
      toast({ title: "项目已创建" })
      router.push(`/portal/apps/alliance/projects/${data.id}`)
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
        <h1 className="text-xl font-bold">新建合作项目</h1>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle>基本信息</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>项目名称 *</Label>
                <Input value={item.name} onChange={(e) => setField("name", e.target.value)} placeholder="请输入项目名称" />
              </div>
              <div className="grid gap-2">
                <Label>项目类型</Label>
                <Input value={item.type} onChange={(e) => setField("type", e.target.value)} placeholder="如：技术研发" />
              </div>
              <div className="grid gap-2">
                <Label>项目阶段</Label>
                <Select value={item.phase} onValueChange={(v) => setField("phase", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="initiation">启动</SelectItem>
                    <SelectItem value="execution">执行中</SelectItem>
                    <SelectItem value="acceptance">验收</SelectItem>
                    <SelectItem value="closure">关闭</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>预算</Label>
                <Input value={item.budget} onChange={(e) => setField("budget", e.target.value)} placeholder="如：50万" />
              </div>
              <div className="grid gap-2">
                <Label>开始日期</Label>
                <Input value={item.startDate} onChange={(e) => setField("startDate", e.target.value)} type="date" />
              </div>
              <div className="grid gap-2">
                <Label>结束日期</Label>
                <Input value={item.endDate} onChange={(e) => setField("endDate", e.target.value)} type="date" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>项目描述</CardTitle></CardHeader>
            <CardContent>
              <Textarea value={item.description} onChange={(e) => setField("description", e.target.value)} rows={5} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>合作企业</CardTitle></CardHeader>
            <CardContent>
              <MultiSelect
                options={enterprises}
                value={item.enterpriseIds}
                onChange={(v) => setField("enterpriseIds", v)}
                placeholder="选择合作企业"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>二级学院</CardTitle></CardHeader>
            <CardContent>
              <MultiSelect
                options={SECONDARY_COLLEGES}
                value={item.secondaryColleges}
                onChange={(v) => setField("secondaryColleges", v)}
                placeholder="选择归属学院"
              />
            </CardContent>
          </Card>

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
