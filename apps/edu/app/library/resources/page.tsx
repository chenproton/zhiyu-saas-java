"use client"

import { useEffect, useState } from "react"
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
import { RESOURCE_TYPE_LABELS, type ResourceLibraryItem, type ResourceKind } from "@/lib/types/library"
import { useToast } from "@/hooks/use-toast"

const TYPE_ICONS: Record<string, React.ReactNode> = {
  document: <FileText className="size-4" />,
  spreadsheet: <Table className="size-4" />,
  image: <Image className="size-4" />,
  link: <Link className="size-4" />,
  audio: <Music className="size-4" />,
  video: <Video className="size-4" />,
  archive: <Archive className="size-4" />,
  venue: <Building className="size-4" />,
  facility: <Wrench className="size-4" />,
  software: <AppWindow className="size-4" />,
  other: <HelpCircle className="size-4" />,
}

const TYPE_COLORS: Record<string, string> = {
  document: "#f97316", spreadsheet: "#22c55e", image: "#a855f7",
  link: "#06b6d4", audio: "#ec4899", video: "#3b82f6",
  archive: "#64748b", venue: "#ef4444", facility: "#6366f1",
  software: "#14b8a6", other: "#78716c",
}

const TYPE_LABEL_MAP: Record<string, string> = RESOURCE_TYPE_LABELS

const TYPE_BG: Record<string, string> = {
  document: "bg-orange-50", spreadsheet: "bg-emerald-50", image: "bg-purple-50",
  link: "bg-cyan-50", audio: "bg-pink-50", video: "bg-blue-50",
  archive: "bg-slate-50", venue: "bg-red-50", facility: "bg-indigo-50",
  software: "bg-teal-50", other: "bg-stone-50",
}

function formatSize(bytes?: number) {
  if (!bytes) return "-"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
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
      const params: any = { limit: 500 }
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

  const typeCounts: Record<string, number> = {}
  for (const item of items) {
    typeCounts[item.resourceType] = (typeCounts[item.resourceType] || 0) + 1
  }

  const handleOpenAdd = () => {
    setEditingItem(null)
    setName(""); setResourceType("document"); setUrl("")
    setDescription(""); setThumbnail(""); setFileSize("")
    setIsDialogOpen(true)
  }

  const handleOpenEdit = (item: ResourceLibraryItem) => {
    setEditingItem(item)
    setName(item.name); setResourceType(item.resourceType)
    setUrl(item.url || ""); setDescription(item.description || "")
    setThumbnail(item.thumbnail || ""); setFileSize(item.fileSize ? String(item.fileSize) : "")
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
          name: name.trim(), resourceType: resourceType as any,
          url: url.trim() || undefined, description: description.trim() || undefined,
          thumbnail: thumbnail.trim() || undefined, fileSize: sizeNum,
        } as any)
        toast({ title: "更新成功" })
      } else {
        await resourceLibraryApi.create({
          name: name.trim(), resourceType: resourceType as any,
          url: url.trim() || undefined, description: description.trim() || undefined,
          thumbnail: thumbnail.trim() || undefined, fileSize: sizeNum,
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
    <div className="p-6 space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-50 to-blue-100">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <HelpCircle className="size-5 text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-700">{items.length}</div>
              <div className="text-xs text-blue-500">资源总数</div>
            </div>
          </CardContent>
        </Card>
        {Object.entries(typeCounts).slice(0, 5).map(([type, count]) => (
          <Card key={type} className="border-0 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg ${TYPE_BG[type] || "bg-slate-50"} flex items-center justify-center`}>
                <span style={{ color: TYPE_COLORS[type] || "#78716c" }}>{TYPE_ICONS[type] || TYPE_ICONS.other}</span>
              </div>
              <div>
                <div className="text-xl font-bold text-slate-700">{count}</div>
                <div className="text-xs text-slate-400">{TYPE_LABEL_MAP[type] || type}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main table card */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base font-semibold">场景任务资源库</CardTitle>
          <Button onClick={handleOpenAdd} size="sm"><Plus className="size-4 mr-1" />新增资源</Button>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input placeholder="搜索资源..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
            </div>
            <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v === "all" ? "" : v)}>
              <SelectTrigger className="w-36"><SelectValue placeholder="资源类型" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部类型</SelectItem>
                {Object.entries(RESOURCE_TYPE_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(searchQuery || typeFilter) && (
              <Button variant="ghost" size="sm" onClick={() => { setSearchQuery(""); setTypeFilter("") }}>清除筛选</Button>
            )}
          </div>

          <div className="rounded-lg border">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-slate-50/50">
                  <th className="text-left p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">资源</th>
                  <th className="text-left p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">类型</th>
                  <th className="text-left p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">链接</th>
                  <th className="text-left p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">大小</th>
                  <th className="text-left p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">描述</th>
                  <th className="text-right p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">操作</th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={6} className="p-12 text-center text-muted-foreground">加载中...</td></tr>}
                {!loading && items.length === 0 && (
                  <tr><td colSpan={6} className="p-12 text-center">
                    <div className="text-muted-foreground">暂无数据</div>
                    <Button variant="outline" size="sm" className="mt-3" onClick={handleOpenAdd}><Plus className="size-3 mr-1" />新增第一条资源</Button>
                  </td></tr>
                )}
                {items.map(item => {
                  const color = TYPE_COLORS[item.resourceType] || "#78716c"
                  return (
                    <tr key={item.id} className="border-b last:border-0 hover:bg-slate-50/50 transition-colors">
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-lg ${TYPE_BG[item.resourceType] || "bg-slate-50"} flex items-center justify-center shrink-0`}>
                            <span style={{ color }}>{TYPE_ICONS[item.resourceType] || TYPE_ICONS.other}</span>
                          </div>
                          <span className="text-sm font-medium text-slate-700 truncate max-w-[180px]">{item.name}</span>
                        </div>
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" className="text-xs" style={{ color, borderColor: color }}>{TYPE_LABEL_MAP[item.resourceType] || item.resourceType}</Badge>
                      </td>
                      <td className="p-3 hidden md:table-cell">
                        {item.url ? <a href={item.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"><ExternalLink className="size-3" />访问</a> : "-"}
                      </td>
                      <td className="p-3 text-xs text-slate-400 hidden md:table-cell">{formatSize(item.fileSize)}</td>
                      <td className="p-3 text-xs text-slate-400 hidden lg:table-cell max-w-[200px] truncate">{item.description || "-"}</td>
                      <td className="p-3 text-right whitespace-nowrap">
                        <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(item)}><Pencil className="size-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(item.id)}><Trash2 className="size-4 text-destructive" /></Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingItem ? "编辑资源" : "新增资源"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>名称 *</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="资源名称" /></div>
            <div><Label>资源类型 *</Label>
              <Select value={resourceType} onValueChange={setResourceType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(RESOURCE_TYPE_LABELS).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>链接/地址</Label><Input value={url} onChange={e => setUrl(e.target.value)} placeholder="资源URL" /></div>
            <div><Label>缩略图</Label><Input value={thumbnail} onChange={e => setThumbnail(e.target.value)} placeholder="缩略图URL" /></div>
            <div><Label>文件大小（字节）</Label><Input value={fileSize} onChange={e => setFileSize(e.target.value)} placeholder="文件大小" /></div>
            <div><Label>描述</Label><Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="资源描述" rows={3} /></div>
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
