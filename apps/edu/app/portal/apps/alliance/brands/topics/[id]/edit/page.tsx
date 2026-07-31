"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { ArrowLeft, Loader2, Plus, Trash2 } from "lucide-react"
import { usePortalAuth } from "@/contexts/portal-auth-context"
import { portalRequest } from "@/lib/api"
import { useToast } from "@zhiyu/ui"
import type { AllianceBrand, AllianceBrandTopic, AllianceListResponse } from "@/lib/types"

interface ContentBlock { type: "text" | "image" | "video" | "link"; title?: string; content: string }

export default function AllianceBrandTopicEditPage() {
  const { id } = useParams<{ id: string }>()
  const { tenantId } = usePortalAuth()
  const { toast } = useToast()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [brands, setBrands] = useState<AllianceBrand[]>([])
  const [item, setItem] = useState<AllianceBrandTopic | null>(null)

  useEffect(() => {
    if (!tenantId || !id) return
    Promise.all([
      portalRequest<AllianceBrandTopic>(`/alliance/brand-topics/${id}`),
      portalRequest<AllianceListResponse<AllianceBrand>>("/alliance/brands?limit=1000"),
    ])
      .then(([t, b]) => { setItem(t); setBrands(b.items || []) })
      .catch((e) => toast({ title: "加载失败", description: e.message, variant: "destructive" }))
      .finally(() => setLoading(false))
  }, [tenantId, id, toast])

  const setField = (field: string, value: any) => setItem({ ...item, [field]: value } as AllianceBrandTopic)

  const updateBlock = (idx: number, patch: Partial<ContentBlock>) => {
    const blocks: ContentBlock[] = [...((item as any)?.contentBlocks || [])]
    blocks[idx] = { ...blocks[idx], ...patch }
    setField("contentBlocks", blocks)
  }
  const addBlock = () => {
    const blocks: ContentBlock[] = [...((item as any)?.contentBlocks || []), { type: "text", content: "" }]
    setField("contentBlocks", blocks)
  }
  const removeBlock = (idx: number) => {
    setField("contentBlocks", ((item as any)?.contentBlocks || []).filter((_: any, i: number) => i !== idx))
  }

  const toggleBrand = (bid: string) => {
    const ids: string[] = (item as any)?.relatedBrandIds || []
    setField("relatedBrandIds", ids.includes(bid) ? ids.filter((x) => x !== bid) : [...ids, bid])
  }

  const handleSave = async () => {
    if (!item) return
    if (!item.name) { toast({ title: "请填写专题名称", variant: "destructive" }); return }
    setSaving(true)
    try {
      await portalRequest(`/alliance/brand-topics/${id}`, { method: "PUT", body: JSON.stringify(item) })
      toast({ title: "专题已更新" })
      router.push(`/portal/apps/alliance/brands/topics`)
    } catch (e: any) {
      toast({ title: "保存失败", description: e.message, variant: "destructive" })
    } finally { setSaving(false) }
  }

  if (loading) return <div className="text-center py-12 text-muted-foreground">加载中...</div>
  if (!item) return <div className="text-center py-12 text-muted-foreground">专题不存在</div>

  const blocks: ContentBlock[] = (item as any)?.contentBlocks || []
  const relatedIds: string[] = (item as any)?.relatedBrandIds || []

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}><ArrowLeft className="h-4 w-4 mr-1" />返回</Button>
        <h1 className="text-xl font-bold">编辑品牌专题</h1>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle>基本信息</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>专题名称 *</Label><Input value={item.name} onChange={(e) => setField("name", e.target.value)} /></div>
              <div className="grid gap-2"><Label>主题</Label><Input value={item.theme || ""} onChange={(e) => setField("theme", e.target.value)} /></div>
              <div className="grid gap-2">
                <Label>布局</Label>
                <Select value={item.layout} onValueChange={(v) => setField("layout", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="grid">网格布局</SelectItem>
                    <SelectItem value="timeline">时间线布局</SelectItem>
                    <SelectItem value="magazine">杂志布局</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>状态</Label>
                <Select value={item.status} onValueChange={(v) => setField("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">草稿</SelectItem>
                    <SelectItem value="published">已发布</SelectItem>
                    <SelectItem value="archived">已归档</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2 col-span-2"><Label>封面图 URL</Label><Input value={item.coverImage || ""} onChange={(e) => setField("coverImage", e.target.value)} placeholder="https://..." /></div>
              <div className="grid gap-2 col-span-2"><Label>描述</Label><Textarea value={item.description || ""} onChange={(e) => setField("description", e.target.value)} rows={3} /></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle>内容块</CardTitle>
              <Button size="sm" variant="outline" onClick={addBlock}><Plus className="h-4 w-4 mr-1" />新增内容块</Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {blocks.length === 0 && <p className="text-center py-4 text-sm text-muted-foreground">暂无内容块，点击右上角新增</p>}
              {blocks.map((block, idx) => (
                <div key={idx} className="rounded border p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Select value={block.type} onValueChange={(v) => updateBlock(idx, { type: v as ContentBlock["type"] })}>
                      <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="text">文本</SelectItem>
                        <SelectItem value="image">图片</SelectItem>
                        <SelectItem value="video">视频</SelectItem>
                        <SelectItem value="link">链接</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="ghost" size="sm" className="text-red-600" onClick={() => removeBlock(idx)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                  {(block.type === "text" || block.type === "link") && (
                    <div className="grid gap-2"><Label>标题</Label><Input value={block.title || ""} onChange={(e) => updateBlock(idx, { title: e.target.value })} /></div>
                  )}
                  <div className="grid gap-2">
                    <Label>{block.type === "image" || block.type === "video" ? "URL" : "内容"}</Label>
                    <Textarea value={block.content} onChange={(e) => updateBlock(idx, { content: e.target.value })} rows={block.type === "text" ? 3 : 2} placeholder={block.type === "image" || block.type === "video" ? "https://..." : "请输入内容"} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>关联品牌</CardTitle></CardHeader>
            <CardContent className="space-y-1 max-h-[300px] overflow-y-auto">
              {brands.length === 0 && <p className="text-sm text-muted-foreground">暂无品牌内容</p>}
              {brands.map((b) => (
                <label key={b.id} className="flex items-center gap-2 p-2 rounded border hover:bg-muted/40 cursor-pointer text-sm">
                  <input type="checkbox" className="accent-primary" checked={relatedIds.includes(b.id)} onChange={() => toggleBrand(b.id)} />
                  <span className="text-xs text-muted-foreground mr-1">{allianceLabel("brandType", b.brandType)}</span>
                  <span className="flex-1 truncate">{b.name}</span>
                </label>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>设置</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>首页推荐</Label>
                <Switch checked={item.isRecommended || false} onCheckedChange={(v) => setField("isRecommended", v)} />
              </div>
              <div className="grid gap-2"><Label>排序</Label><Input type="number" value={item.sortOrder ?? 0} onChange={(e) => setField("sortOrder", Number(e.target.value))} /></div>
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
