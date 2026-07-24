"use client"

import { useEffect, useMemo, useState } from "react"
import { Pencil, Plus, Search, Trash2, Award, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { certificateLibraryApi } from "@/lib/api"
import type { CertificateLibraryItem } from "@/lib/types/job"
import { useToast } from "@/hooks/use-toast"

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

  const loadItems = async () => {
    setLoading(true)
    try {
      const params: any = { limit: 200 }
      if (searchQuery) params.search = searchQuery
      const res = await certificateLibraryApi.list(params)
      setItems(res.items)
    } catch (err: any) {
      toast({ variant: "destructive", title: "加载失败", description: err.message || "无法获取证书列表" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadItems() }, [searchQuery])

  const handleOpenAdd = () => {
    setEditingItem(null)
    setName("")
    setUrl("")
    setDescription("")
    setImageUrl("")
    setIsDialogOpen(true)
  }

  const handleOpenEdit = (item: CertificateLibraryItem) => {
    setEditingItem(item)
    setName(item.name)
    setUrl(item.url || "")
    setDescription(item.description || "")
    setImageUrl(item.imageUrl || "")
    setIsDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("确定要删除该证书吗？")) return
    try {
      await certificateLibraryApi.delete(id)
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
    try {
      if (editingItem) {
        await certificateLibraryApi.update(editingItem.id, {
          name: name.trim(),
          url: url.trim() || undefined,
          description: description.trim() || undefined,
          imageUrl: imageUrl.trim() || undefined,
        } as any)
        toast({ title: "更新成功" })
      } else {
        await certificateLibraryApi.create({
          name: name.trim(),
          url: url.trim() || undefined,
          description: description.trim() || undefined,
          imageUrl: imageUrl.trim() || undefined,
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
          <CardTitle className="text-lg">岗位证书库</CardTitle>
          <Button onClick={handleOpenAdd}>
            <Plus className="h-4 w-4 mr-1" />新增证书
          </Button>
        </CardHeader>
        <CardContent>
          <div className="mb-4 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索证书名称或描述..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="border rounded-lg">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 text-sm font-medium">名称</th>
                  <th className="text-left p-3 text-sm font-medium">链接</th>
                  <th className="text-left p-3 text-sm font-medium">描述</th>
                  <th className="text-left p-3 text-sm font-medium">创建时间</th>
                  <th className="text-right p-3 text-sm font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">加载中...</td></tr>
                )}
                {!loading && items.length === 0 && (
                  <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">暂无数据</td></tr>
                )}
                {items.map((item) => (
                  <tr key={item.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <Award className="h-4 w-4 text-muted-foreground" />
                        <span>{item.name}</span>
                      </div>
                    </td>
                    <td className="p-3">
                      {item.url ? (
                        <a href={item.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                          <ExternalLink className="h-3 w-3" />访问
                        </a>
                      ) : "-"}
                    </td>
                    <td className="p-3 text-sm max-w-[300px] truncate">{item.description || "-"}</td>
                    <td className="p-3 text-sm text-muted-foreground">
                      {new Date(item.createdAt).toLocaleDateString("zh-CN")}
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
            <DialogTitle>{editingItem ? "编辑证书" : "新增证书"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>名称 *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="证书名称" />
            </div>
            <div>
              <Label>图片地址</Label>
              <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="证书封面图片URL" />
            </div>
            <div>
              <Label>链接</Label>
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="证书官方链接" />
            </div>
            <div>
              <Label>描述</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="证书简要描述" />
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
