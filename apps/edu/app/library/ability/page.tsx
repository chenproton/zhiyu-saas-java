"use client"

import { useEffect, useState } from "react"
import { Pencil, Plus, Search, Trash2, Lightbulb } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { abilityApi } from "@/lib/api"
import type { AbilityPoint } from "@/lib/types/job"
import { useToast } from "@/hooks/use-toast"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"

const CATEGORY_LABELS: Record<string, string> = { knowledge: "知识", skill: "技能", quality: "素质" }
const CATEGORY_COLORS: Record<string, string> = { knowledge: "#7c3aed", skill: "#f97316", quality: "#06b6d4" }

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
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const loadItems = async () => {
    setLoading(true)
    try {
      const params: any = { limit: 500 }
      if (searchQuery) params.search = searchQuery
      if (categoryFilter) params.category = categoryFilter
      const res = await abilityApi.list(params)
      setItems(res.items)
    } catch (err: any) { toast({ variant: "destructive", title: "加载失败", description: err.message }) }
    finally { setLoading(false) }
  }

  useEffect(() => { loadItems() }, [searchQuery, categoryFilter])

  const handleOpenAdd = () => { setEditingItem(null); setName(""); setDescription(""); setCategory("knowledge"); setIsPublic(false); setAttributes(""); setIsDialogOpen(true) }
  const handleOpenEdit = (item: AbilityPoint) => { setEditingItem(item); setName(item.name); setDescription(item.description || ""); setCategory(item.category); setIsPublic(item.isPublic); setAttributes(item.attributes?.join(", ") || ""); setIsDialogOpen(true) }
  const handleDelete = (id: string) => { setDeleteTarget(id) }
  const confirmDelete = async () => { if (!deleteTarget) return; try { await abilityApi.delete(deleteTarget); toast({ title: "删除成功" }); loadItems() } catch (err: any) { toast({ variant: "destructive", title: "删除失败", description: err.message }) } finally { setDeleteTarget(null) } }
  const handleSubmit = async () => {
    if (!name.trim()) { toast({ variant: "destructive", title: "名称不能为空" }); return }
    const attrList = attributes ? attributes.split(",").map(s => s.trim()).filter(Boolean) : []
    try {
      if (editingItem) {
        await abilityApi.update(editingItem.id, { name: name.trim(), description: description.trim() || undefined, category, isPublic, attributes: attrList } as any)
        toast({ title: "更新成功" })
      } else {
        await abilityApi.create({ name: name.trim(), description: description.trim() || undefined, category, isPublic, attributes: attrList } as any)
        toast({ title: "创建成功" })
      }
      setIsDialogOpen(false); loadItems()
    } catch (err: any) { toast({ variant: "destructive", title: "保存失败", description: err.message }) }
  }

  return (
    <div className="p-6 space-y-5">
      <Card className="border-0 shadow-sm bg-gradient-to-br from-purple-50 to-purple-100">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center"><Lightbulb className="size-5 text-purple-600" /></div>
          <div><div className="text-2xl font-bold text-purple-700">{items.length}</div><div className="text-xs text-purple-500">能力点总数</div></div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base font-semibold">能力点管理</CardTitle>
          <Button onClick={handleOpenAdd} size="sm"><Plus className="size-4 mr-1" />新增能力点</Button>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 mb-4">
            <div className="relative flex-1 max-w-sm"><Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" /><Input placeholder="搜索能力点..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10" /></div>
            <Select value={categoryFilter} onValueChange={v => setCategoryFilter(v === "all" ? "" : v)}>
              <SelectTrigger className="w-28"><SelectValue placeholder="类别" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
            {(searchQuery || categoryFilter) && <Button variant="ghost" size="sm" onClick={() => { setSearchQuery(""); setCategoryFilter("") }}>清除</Button>}
          </div>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50">
                  <TableHead className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">名称</TableHead>
                  <TableHead className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">类别</TableHead>
                  <TableHead className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">描述</TableHead>
                  <TableHead className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">属性标签</TableHead>
                  <TableHead className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">公开</TableHead>
                  <TableHead className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && <TableRow><TableCell colSpan={6} className="p-12 text-center text-muted-foreground">加载中...</TableCell></TableRow>}
                {!loading && items.length === 0 && <TableRow><TableCell colSpan={6} className="p-12 text-center text-muted-foreground">暂无数据</TableCell></TableRow>}
                {items.map(item => (
                  <TableRow key={item.id} className="hover:bg-slate-50/50">
                    <TableCell className="p-3"><div className="flex items-center gap-2"><Lightbulb className="size-4" style={{ color: CATEGORY_COLORS[item.category] || "#6366f1" }} /><span className="text-sm font-medium text-slate-700">{item.name}</span></div></TableCell>
                    <TableCell className="p-3"><Badge variant="outline" className="text-xs" style={{ color: CATEGORY_COLORS[item.category], borderColor: CATEGORY_COLORS[item.category] }}>{CATEGORY_LABELS[item.category] || item.category}</Badge></TableCell>
                    <TableCell className="p-3 text-sm text-slate-400 hidden md:table-cell max-w-[200px] truncate">{item.description || "-"}</TableCell>
                    <TableCell className="p-3 text-sm hidden lg:table-cell">{item.attributes?.map(a => <Badge key={a} variant="secondary" className="mr-1 text-xs">{a}</Badge>)}</TableCell>
                    <TableCell className="p-3"><Badge variant={item.isPublic ? "default" : "secondary"} className="text-xs">{item.isPublic ? "公开" : "私有"}</Badge></TableCell>
                    <TableCell className="p-3 text-right whitespace-nowrap">
                      <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(item)}><Pencil className="size-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(item.id)}><Trash2 className="size-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
        title="确认删除"
        description="确定要删除该能力点吗？此操作不可恢复。"
        confirmText="删除"
        variant="destructive"
        onConfirm={confirmDelete}
      />
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingItem ? "编辑能力点" : "新增能力点"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>名称 *</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="能力点名称" /></div>
            <div><Label>类别 *</Label><Select value={category} onValueChange={setCategory}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(CATEGORY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>描述</Label><Input value={description} onChange={e => setDescription(e.target.value)} placeholder="简要描述" /></div>
            <div><Label>属性标签（逗号分隔）</Label><Input value={attributes} onChange={e => setAttributes(e.target.value)} placeholder="沟通, 协作, 领导力" /></div>
            <div className="flex items-center space-x-2"><Switch checked={isPublic} onCheckedChange={setIsPublic} /><Label>公开</Label></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setIsDialogOpen(false)}>取消</Button><Button onClick={handleSubmit}>保存</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
