"use client"

import { useCallback, useEffect, useState } from "react"
import { Pencil, Plus, Search, Trash2, Award, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Label } from "@/components/ui/label"
import { certificateLibraryApi } from "@/lib/api"
import type { CertificateLibraryItem } from "@/lib/types/job"
import { useToast } from "@zhiyu/ui"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"

export default function CertificatesPage() {
  const { toast } = useToast()
  const [items, setItems] = useState<CertificateLibraryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<CertificateLibraryItem | null>(null)
  const [name, setName] = useState("")
  const [url, setUrl] = useState("")
  const [description, setDescription] = useState("")
  const [imageUrl, setImageUrl] = useState("")
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const loadItems = useCallback(async () => {
    setLoading(true)
    try {
      const params: any = { limit: 500 }; if (searchQuery) params.search = searchQuery
      const res = await certificateLibraryApi.list(params); setItems(res.items)
    } catch (err: any) { toast({ variant: "destructive", title: "加载失败", description: err.message }) }
    finally { setLoading(false) }
  }, [searchQuery, toast])
  useEffect(() => {
    ;(async () => {
      await loadItems()
    })()
  }, [loadItems])

  const handleOpenAdd = () => { setEditingItem(null); setName(""); setUrl(""); setDescription(""); setImageUrl(""); setIsDialogOpen(true) }
  const handleOpenEdit = (item: CertificateLibraryItem) => { setEditingItem(item); setName(item.name); setUrl(item.url || ""); setDescription(item.description || ""); setImageUrl(item.imageUrl || ""); setIsDialogOpen(true) }
  const handleDelete = (id: string) => { setDeleteTarget(id) }
  const confirmDelete = async () => { if (!deleteTarget) return; try { await certificateLibraryApi.delete(deleteTarget); toast({ title: "删除成功" }); loadItems() } catch (err: any) { toast({ variant: "destructive", title: "删除失败", description: err.message }) } finally { setDeleteTarget(null) } }
  const handleSubmit = async () => {
    if (!name.trim()) { toast({ variant: "destructive", title: "名称不能为空" }); return }
    try {
      const payload = { name: name.trim(), url: url.trim() || undefined, description: description.trim() || undefined, imageUrl: imageUrl.trim() || undefined }
      if (editingItem) { await certificateLibraryApi.update(editingItem.id, payload as any); toast({ title: "更新成功" }) }
      else { await certificateLibraryApi.create(payload as any); toast({ title: "创建成功" }) }
      setIsDialogOpen(false); loadItems()
    } catch (err: any) { toast({ variant: "destructive", title: "保存失败", description: err.message }) }
  }

  return (
    <div className="p-6 space-y-5">
      <Card className="border-0 shadow-sm bg-gradient-to-br from-rose-50 to-rose-100">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-rose-500/10 flex items-center justify-center"><Award className="size-5 text-rose-600" /></div>
          <div><div className="text-2xl font-bold text-rose-700">{items.length}</div><div className="text-xs text-rose-500">证书总数</div></div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base font-semibold">岗位证书库</CardTitle>
          <Button onClick={handleOpenAdd} size="sm"><Plus className="size-4 mr-1" />新增证书</Button>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 mb-4">
            <div className="relative flex-1 max-w-sm"><Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" /><Input placeholder="搜索证书..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10" /></div>
            {searchQuery && <Button variant="ghost" size="sm" onClick={() => setSearchQuery("")}>清除</Button>}
          </div>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                  <TableHead className="text-left p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">名称</TableHead>
                  <TableHead className="text-left p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">链接</TableHead>
                  <TableHead className="text-left p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">描述</TableHead>
                  <TableHead className="text-left p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">创建时间</TableHead>
                  <TableHead className="text-right p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && <TableRow><TableCell colSpan={5} className="p-12 text-center text-muted-foreground">加载中...</TableCell></TableRow>}
                {!loading && items.length === 0 && <TableRow><TableCell colSpan={5} className="p-12 text-center text-muted-foreground">暂无数据</TableCell></TableRow>}
                {items.map(item => (
                  <TableRow key={item.id}>
                    <TableCell className="p-3"><div className="flex items-center gap-2"><Award className="size-4 text-rose-500" /><span className="text-sm font-medium text-slate-700">{item.name}</span></div></TableCell>
                    <TableCell className="p-3 hidden md:table-cell">{item.url ? <a href={item.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"><ExternalLink className="size-3" />访问</a> : "-"}</TableCell>
                    <TableCell className="p-3 text-sm text-slate-400 hidden lg:table-cell max-w-[300px] truncate">{item.description || "-"}</TableCell>
                    <TableCell className="p-3 text-sm text-slate-400">{new Date(item.createdAt).toLocaleDateString("zh-CN")}</TableCell>
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
        description="确定要删除该证书吗？此操作不可恢复。"
        confirmText="删除"
        variant="destructive"
        onConfirm={confirmDelete}
      />
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent><DialogHeader><DialogTitle>{editingItem ? "编辑证书" : "新增证书"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div><Label>名称 *</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="证书名称" /></div>
          <div><Label>图片地址</Label><Input value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="封面图片URL" /></div>
          <div><Label>链接</Label><Input value={url} onChange={e => setUrl(e.target.value)} placeholder="官方链接" /></div>
          <div><Label>描述</Label><Input value={description} onChange={e => setDescription(e.target.value)} placeholder="简要描述" /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setIsDialogOpen(false)}>取消</Button><Button onClick={handleSubmit}>保存</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
