"use client"

import { useEffect, useMemo, useState } from "react"
import {
  FileText, Table, Image, Link, Music, Video, Archive,
  Building, Wrench, AppWindow, HelpCircle, Pencil, Plus, Search, Trash2, ExternalLink,
} from "lucide-react"
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
import { Textarea } from "@/components/ui/textarea"
import { resourceLibraryApi } from "@/lib/api"
import { RESOURCE_TYPE_LABELS, type ResourceLibraryItem } from "@/lib/types/library"
import { useToast } from "@/hooks/use-toast"

const TYPE_ICONS: Record<string, React.ReactNode> = {
  document: <FileText className="h-4 w-4" />,
  spreadsheet: <Table className="h-4 w-4" />,
  image: <Image className="h-4 w-4" />,
  link: <Link className="h-4 w-4" />,
  audio: <Music className="h-4 w-4" />,
  video: <Video className="h-4 w-4" />,
  archive: <Archive className="h-4 w-4" />,
  venue: <Building className="h-4 w-4" />,
  facility: <Wrench className="h-4 w-4" />,
  software: <AppWindow className="h-4 w-4" />,
  other: <HelpCircle className="h-4 w-4" />,
}

export default function ResourcesPage() {
  const { toast } = useToast()
  const [items, setItems] = useState<ResourceLibraryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState("")

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<ResourceLibraryItem | null>(null)
  const [name, setName] = useState("")
  const [resourceType, setResourceType] = useState("document")
  const [url, setUrl] = useState("")
  const [description, setDescription] = useState("")
  const [thumbnail, setThumbnail] = useState("")
  const [fileSize, setFileSize] = useState("")

  const loadItems = async () => {
    setLoading(true)
    try {
      const params: any = { limit: 200 }
      if (searchQuery) params.search = searchQuery
      if (typeFilter) params.resourceType = typeFilter
      const res = await resourceLibraryApi.list(params)
      setItems(res.items)
    } catch (err: any) {
      toast({ variant: "destructive", title: "加载失败", description: err.message || "无法获取资源列表" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadItems() }, [searchQuery, typeFilter])

  const handleOpenAdd = () => {
    setEditingItem(null)
    setName("")
    setResourceType("document")
    setUrl("")
    setDescription("")
    setThumbnail("")
    setFileSize("")
    setIsDialogOpen(true)
  }

  const handleOpenEdit = (item: ResourceLibraryItem) => {
    setEditingItem(item)
    setName(item.name)
    setResourceType(item.resourceType)
    setUrl(item.url || "")
    setDescription(item.description || "")
    setThumbnail(item.thumbnail || "")
    setFileSize(item.fileSize ? String(item.fileSize) : "")
    setIsDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("确定要删除该资源吗？")) return
    try {
      await resourceLibraryApi.delete(id)
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
    const sizeNum = fileSize ? parseInt(fileSize, 10) : undefined
    try {
      if (editingItem) {
        await resourceLibraryApi.update(editingItem.id, {
          name: name.trim(),
          resourceType: resourceType as any,
          url: url.trim() || undefined,
          description: description.trim() || undefined,
          thumbnail: thumbnail.trim() || undefined,
          fileSize: sizeNum,
        } as any)
        toast({ title: "更新成功" })
      } else {
        await resourceLibraryApi.create({
          name: name.trim(),
          resourceType: resourceType as any,
          url: url.trim() || undefined,
          description: description.trim() || undefined,
          thumbnail: thumbnail.trim() || undefined,
          fileSize: sizeNum,
        } as any)
        toast({ title: "创建成功" })
      }
      setIsDialogOpen(false)
      loadItems()
    } catch (err: any) {
      toast({ variant: "destructive", title: "保存失败", description: err.message })
    }
  }

  function formatSize(bytes?: number) {
    if (!bytes) return "-"
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="p-6 space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">场景任务资源库</CardTitle>
          <Button onClick={handleOpenAdd}>
            <Plus className="h-4 w-4 mr-1" />新增资源
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索资源名称或描述..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v === "all" ? "" : v)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="资源类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部类型</SelectItem>
                {Object.entries(RESOURCE_TYPE_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="border rounded-lg">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 text-sm font-medium">名称</th>
                  <th className="text-left p-3 text-sm font-medium">类型</th>
                  <th className="text-left p-3 text-sm font-medium">链接</th>
                  <th className="text-left p-3 text-sm font-medium">大小</th>
                  <th className="text-left p-3 text-sm font-medium">描述</th>
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
                        {TYPE_ICONS[item.resourceType] || TYPE_ICONS.other}
                        <span>{item.name}</span>
                      </div>
                    </td>
                    <td className="p-3">
                      <Badge variant="outline">{RESOURCE_TYPE_LABELS[item.resourceType] || item.resourceType}</Badge>
                    </td>
                    <td className="p-3">
                      {item.url ? (
                        <a href={item.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                          <ExternalLink className="h-3 w-3" />访问
                        </a>
                      ) : "-"}
                    </td>
                    <td className="p-3 text-sm text-muted-foreground">{formatSize(item.fileSize)}</td>
                    <td className="p-3 text-sm max-w-[200px] truncate">{item.description || "-"}</td>
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
            <DialogTitle>{editingItem ? "编辑资源" : "新增资源"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>名称 *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="资源名称" />
            </div>
            <div>
              <Label>资源类型 *</Label>
              <Select value={resourceType} onValueChange={setResourceType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(RESOURCE_TYPE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>链接/地址</Label>
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="资源URL" />
            </div>
            <div>
              <Label>缩略图</Label>
              <Input value={thumbnail} onChange={(e) => setThumbnail(e.target.value)} placeholder="缩略图URL" />
            </div>
            <div>
              <Label>文件大小（字节）</Label>
              <Input value={fileSize} onChange={(e) => setFileSize(e.target.value)} placeholder="文件大小" />
            </div>
            <div>
              <Label>描述</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="资源描述" rows={3} />
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
