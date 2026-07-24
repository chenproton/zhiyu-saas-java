"use client"

import { useEffect, useMemo, useState } from "react"
import { Pencil, Plus, Search, Trash2, Lightbulb } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { abilityApi } from "@/lib/api"
import type { AbilityPoint } from "@/lib/types/job"
import { useToast } from "@/hooks/use-toast"

const CATEGORY_LABELS: Record<string, string> = {
  knowledge: "知识",
  skill: "技能",
  quality: "素质",
}

export default function AbilityPointsPage() {
  const { toast } = useToast()
  const [items, setItems] = useState<AbilityPoint[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("")

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<AbilityPoint | null>(null)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState("knowledge")
  const [isPublic, setIsPublic] = useState(false)
  const [attributes, setAttributes] = useState("")

  const loadItems = async () => {
    setLoading(true)
    try {
      const params: any = { limit: 200 }
      if (searchQuery) params.search = searchQuery
      if (categoryFilter) params.category = categoryFilter
      const res = await abilityApi.list(params)
      setItems(res.items)
    } catch (err: any) {
      toast({ variant: "destructive", title: "加载失败", description: err.message || "无法获取能力点列表" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadItems() }, [searchQuery, categoryFilter])

  const handleOpenAdd = () => {
    setEditingItem(null)
    setName("")
    setDescription("")
    setCategory("knowledge")
    setIsPublic(false)
    setAttributes("")
    setIsDialogOpen(true)
  }

  const handleOpenEdit = (item: AbilityPoint) => {
    setEditingItem(item)
    setName(item.name)
    setDescription(item.description || "")
    setCategory(item.category)
    setIsPublic(item.isPublic)
    setAttributes(item.attributes?.join(", ") || "")
    setIsDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("确定要删除该能力点吗？")) return
    try {
      await abilityApi.delete(id)
      toast({ title: "删除成功" })
      loadItems()
    } catch (err: any) {
      toast({ variant: "destructive", title: "删除失败", description: err.message })
    }
  }

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast({ variant: "destructive", title: "名称不能为空" })
      return
    }
    const attrList = attributes ? attributes.split(",").map((s) => s.trim()).filter(Boolean) : []
    try {
      if (editingItem) {
        await abilityApi.update(editingItem.id, {
          name: name.trim(),
          description: description.trim() || undefined,
          category,
          isPublic,
          attributes: attrList,
        } as any)
        toast({ title: "更新成功" })
      } else {
        await abilityApi.create({
          name: name.trim(),
          description: description.trim() || undefined,
          category,
          isPublic,
          attributes: attrList,
        } as any)
        toast({ title: "创建成功" })
      }
      setIsDialogOpen(false)
      loadItems()
    } catch (err: any) {
      toast({ variant: "destructive", title: "保存失败", description: err.message })
    }
  }

  return (
    <div className="p-6 space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">能力点管理</CardTitle>
          <Button onClick={handleOpenAdd}>
            <Plus className="h-4 w-4 mr-1" />新增能力点
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索能力点名称..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v === "all" ? "" : v)}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="类别" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="knowledge">知识</SelectItem>
                <SelectItem value="skill">技能</SelectItem>
                <SelectItem value="quality">素质</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="border rounded-lg">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 text-sm font-medium">名称</th>
                  <th className="text-left p-3 text-sm font-medium">类别</th>
                  <th className="text-left p-3 text-sm font-medium">描述</th>
                  <th className="text-left p-3 text-sm font-medium">属性标签</th>
                  <th className="text-left p-3 text-sm font-medium">公开</th>
                  <th className="text-right p-3 text-sm font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">加载中...</td></tr>
                )}
                {!loading && items.length === 0 && (
                  <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">暂无数据</td></tr>
                )}
                {items.map((item) => (
                  <tr key={item.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <Lightbulb className="h-4 w-4 text-muted-foreground" />
                        <span>{item.name}</span>
                      </div>
                    </td>
                    <td className="p-3">
                      <Badge variant="outline">{CATEGORY_LABELS[item.category] || item.category}</Badge>
                    </td>
                    <td className="p-3 text-sm max-w-[200px] truncate">{item.description || "-"}</td>
                    <td className="p-3 text-sm">
                      {item.attributes?.map((a) => (
                        <Badge key={a} variant="secondary" className="mr-1">{a}</Badge>
                      ))}
                    </td>
                    <td className="p-3">
                      <Badge variant={item.isPublic ? "default" : "secondary"}>
                        {item.isPublic ? "公开" : "私有"}
                      </Badge>
                    </td>
                    <td className="p-3 text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(item)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(item.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? "编辑能力点" : "新增能力点"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>名称 *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="能力点名称" />
            </div>
            <div>
              <Label>类别 *</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="knowledge">知识</SelectItem>
                  <SelectItem value="skill">技能</SelectItem>
                  <SelectItem value="quality">素质</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>描述</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="简要描述" />
            </div>
            <div>
              <Label>属性标签（逗号分隔）</Label>
              <Input value={attributes} onChange={(e) => setAttributes(e.target.value)} placeholder="例如：沟通, 协作, 领导力" />
            </div>
            <div className="flex items-center space-x-2">
              <Switch checked={isPublic} onCheckedChange={setIsPublic} />
              <Label>公开</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>取消</Button>
            <Button onClick={handleSubmit}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
