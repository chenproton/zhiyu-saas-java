"use client"

import { useEffect, useState } from "react"
import { Pencil, Plus, Search, Trash2, BookOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { knowledgeApi } from "@/lib/api"
import type { KnowledgePoint } from "@/lib/types/lesson"
import { useToast } from "@/hooks/use-toast"

export default function KnowledgePointsPage() {
  const { toast } = useToast()
  const [items, setItems] = useState<KnowledgePoint[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<KnowledgePoint | null>(null)
  const [name, setName] = useState("")
  const [code, setCode] = useState("")
  const [description, setDescription] = useState("")
  const [linked, setLinked] = useState(false)

  const loadItems = async () => {
    setLoading(true)
    try {
      const params: any = { limit: 500 }
      if (searchQuery) params.search = searchQuery
      const res = await knowledgeApi.list(params)
      setItems(res.items)
    } catch (err: any) {
      toast({ variant: "destructive", title: "加载失败", description: err.message })
    } finally { setLoading(false) }
  }

  useEffect(() => { loadItems() }, [searchQuery])

  const handleOpenAdd = () => { setEditingItem(null); setName(""); setCode(""); setDescription(""); setLinked(false); setIsDialogOpen(true) }
  const handleOpenEdit = (item: KnowledgePoint) => { setEditingItem(item); setName(item.name); setCode(item.code || ""); setDescription(item.description || ""); setLinked(item.linked); setIsDialogOpen(true) }
  const handleDelete = async (id: string) => { if (!confirm("确定要删除？")) return; try { await knowledgeApi.delete(id); toast({ title: "删除成功" }); loadItems() } catch (err: any) { toast({ variant: "destructive", title: "删除失败", description: err.message }) } }
  const handleSubmit = async () => {
    if (!name.trim()) { toast({ variant: "destructive", title: "名称不能为空" }); return }
    try {
      if (editingItem) {
        await knowledgeApi.update(editingItem.id, { name: name.trim(), code: code.trim() || undefined, description: description.trim() || undefined, linked, granularLessonIds: editingItem.granularLessonIds || [] } as any)
        toast({ title: "更新成功" })
      } else {
        await knowledgeApi.create({ name: name.trim(), code: code.trim() || undefined, description: description.trim() || undefined, linked, granularLessonIds: [] } as any)
        toast({ title: "创建成功" })
      }
      setIsDialogOpen(false); loadItems()
    } catch (err: any) { toast({ variant: "destructive", title: "保存失败", description: err.message }) }
  }

  return (
    <div className="p-6 space-y-5">
      <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-50 to-blue-100">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center"><BookOpen className="size-5 text-blue-600" /></div>
          <div><div className="text-2xl font-bold text-blue-700">{items.length}</div><div className="text-xs text-blue-500">知识点总数</div></div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base font-semibold">知识点管理</CardTitle>
          <Button onClick={handleOpenAdd} size="sm"><Plus className="size-4 mr-1" />新增知识点</Button>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input placeholder="搜索知识点..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10" />
            </div>
            {searchQuery && <Button variant="ghost" size="sm" onClick={() => setSearchQuery("")}>清除</Button>}
          </div>
          <div className="rounded-lg border">
            <table className="w-full">
              <thead><tr className="border-b bg-slate-50/50">
                <th className="text-left p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">名称</th>
                <th className="text-left p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">编码</th>
                <th className="text-left p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">描述</th>
                <th className="text-left p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">关联课程</th>
                <th className="text-right p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">操作</th>
              </tr></thead>
              <tbody>
                {loading && <tr><td colSpan={5} className="p-12 text-center text-muted-foreground">加载中...</td></tr>}
                {!loading && items.length === 0 && <tr><td colSpan={5} className="p-12 text-center text-muted-foreground">暂无数据</td></tr>}
                {items.map(item => (
                  <tr key={item.id} className="border-b last:border-0 hover:bg-slate-50/50">
                    <td className="p-3"><div className="flex items-center gap-2"><BookOpen className="size-4 text-blue-500" /><span className="text-sm font-medium text-slate-700">{item.name}</span></div></td>
                    <td className="p-3 text-sm text-slate-400">{item.code || "-"}</td>
                    <td className="p-3 text-sm text-slate-400 hidden md:table-cell max-w-[300px] truncate">{item.description || "-"}</td>
                    <td className="p-3 text-sm text-slate-400 hidden md:table-cell">{item.granularLessonIds?.length || 0} 门</td>
                    <td className="p-3 text-right whitespace-nowrap">
                      <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(item)}><Pencil className="size-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(item.id)}><Trash2 className="size-4 text-destructive" /></Button>
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
          <DialogHeader><DialogTitle>{editingItem ? "编辑知识点" : "新增知识点"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>名称 *</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="知识点名称" /></div>
            <div><Label>编码</Label><Input value={code} onChange={e => setCode(e.target.value)} placeholder="编码" /></div>
            <div><Label>描述</Label><Input value={description} onChange={e => setDescription(e.target.value)} placeholder="简要描述" /></div>
            <div className="flex items-center space-x-2"><Switch checked={linked} onCheckedChange={setLinked} /><Label>关联课程</Label></div>
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
