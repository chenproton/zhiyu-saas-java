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
import { MultiSelect } from "@/components/ui/multi-select"
import { SingleImageUpload } from "@/components/shared/image-list-upload"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Loader2, Send } from "lucide-react"
import { usePortalAuth } from "@/contexts/portal-auth-context"
import { portalRequest } from "@/lib/api"
import { useToast } from "@zhiyu/ui"
import type { AllianceProject, AllianceEnterprise, AllianceListResponse } from "@/lib/types"

const SECONDARY_COLLEGES = [
  "智能制造学院", "信息技术学院", "经济管理学院", "艺术设计学院",
  "新能源工程学院", "生物医药学院", "现代服务学院", "国际教育学院",
  "创新创业学院", "继续教育学院", "基础教育学院", "马克思主义学院",
]

const PROJECT_TYPES = [
  "人才培养项目", "技术研发项目", "基地建设项目", "技能竞赛项目",
  "创新创业项目", "师资培训项目", "课程开发项目", "专业共建项目",
]

export default function AllianceProjectEditPage() {
  const { id } = useParams<{ id: string }>()
  const { tenantId } = usePortalAuth()
  const { toast } = useToast()
  const router = useRouter()
  const [item, setItem] = useState<AllianceProject | null>(null)
  const [enterprises, setEnterprises] = useState<{ label: string; value: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!tenantId || !id) return
    Promise.all([
      portalRequest<AllianceProject>(`/alliance/projects/${id}`),
      portalRequest<AllianceListResponse<AllianceEnterprise>>("/alliance/enterprises?limit=1000"),
    ])
      .then(([p, ents]) => {
        setItem(p)
        setEnterprises((ents.items || []).map((e) => ({ label: e.name, value: e.id })))
      })
      .catch((e) => toast({ title: "加载失败", description: e.message, variant: "destructive" }))
      .finally(() => setLoading(false))
  }, [tenantId, id, toast])

  const handleSave = async (publish = false) => {
    if (!item) return
    setSaving(true)
    try {
      await portalRequest(`/alliance/projects/${id}`, {
        method: "PUT",
        body: JSON.stringify({ ...item, publishStatus: publish ? "published" : (item.publishStatus || "draft") }),
      })
      toast({ title: publish ? "项目已发布" : "草稿已保存" })
      router.push(`/portal/apps/alliance/projects/${id}`)
    } catch (e: any) {
      toast({ title: "保存失败", description: e.message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="text-center py-12 text-muted-foreground">加载中...</div>
  if (!item) return <div className="text-center py-12 text-muted-foreground">项目不存在</div>

  const setField = (field: string, value: any) => setItem({ ...item, [field]: value } as AllianceProject)
  const enterpriseIds: string[] = (item as any).enterpriseIds || []
  const secondaryColleges: string[] = (item as any).secondaryColleges || []

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-1" />返回
        </Button>
        <h1 className="text-xl font-bold">编辑合作项目</h1>
        <Badge variant={item.publishStatus === "published" ? "default" : "secondary"}>
          {item.publishStatus === "published" ? "已发布" : "草稿"}
        </Badge>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle>基本信息</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>项目名称 *</Label>
                <Input value={item.name} onChange={(e) => setField("name", e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>合作类型</Label>
                <Select value={item.type || PROJECT_TYPES[0]} onValueChange={(v) => setField("type", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PROJECT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
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
                <Input value={item.budget || ""} onChange={(e) => setField("budget", e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>开始日期</Label>
                <Input value={item.startDate || ""} onChange={(e) => setField("startDate", e.target.value)} type="date" />
              </div>
              <div className="grid gap-2">
                <Label>结束日期</Label>
                <Input value={item.endDate || ""} onChange={(e) => setField("endDate", e.target.value)} type="date" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>项目描述</CardTitle></CardHeader>
            <CardContent>
              <Textarea value={item.description || ""} onChange={(e) => setField("description", e.target.value)} rows={5} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>项目封面</CardTitle></CardHeader>
            <CardContent>
              <SingleImageUpload label="项目封面" value={(item as any).coverImage || ""} onChange={(v) => setField("coverImage", v)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>合作企业</CardTitle></CardHeader>
            <CardContent>
              <MultiSelect
                options={enterprises}
                value={enterpriseIds}
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
                value={secondaryColleges}
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
                <Switch checked={item.isPublic || false} onCheckedChange={(v) => setField("isPublic", v)} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-3">
              <Button variant="outline" className="w-full" onClick={() => handleSave(false)} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}保存草稿
              </Button>
              {item.publishStatus !== "published" && (
                <Button className="w-full" onClick={() => handleSave(true)} disabled={saving}>
                  <Send className="h-4 w-4 mr-1" />发布项目
                </Button>
              )}
              <Button variant="outline" className="w-full" onClick={() => router.back()}>取消</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
