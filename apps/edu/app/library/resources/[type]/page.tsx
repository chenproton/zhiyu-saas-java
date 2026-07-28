"use client"

import { useCallback, useEffect, useState, useRef } from "react"
import { useParams } from "next/navigation"
import {
  Pencil, Plus, Search, Trash2, ExternalLink,
  Upload, File, Loader2, Eye, X,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { resourceLibraryApi, fileApi } from "@/lib/api"
import { RESOURCE_TYPE_LABELS, type ResourceLibraryItem, type ResourceKind } from "@/lib/types/library"
import { ResourcePreviewModal, usePreviewResources } from "@/components/shared/resource-preview-modal"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { useToast } from "@zhiyu/ui"
import { cn } from "@/lib/utils"
import {
  TYPE_ICONS, TYPE_COLORS, TYPE_BG,
  resourceTypeAccept, resourceTypeExtensionMap,
  fileTypesWithUpload, RESOURCE_MAX_FILE_SIZE, formatSize,
} from "@/lib/resource-type-constants"

export default function ResourceTypePage() {
  const params = useParams()
  const resourceKind = params.type as ResourceKind
  const typeLabel = RESOURCE_TYPE_LABELS[resourceKind] || resourceKind
  const { toast } = useToast()
  const resFileInputRef = useRef<HTMLInputElement>(null)
  const [previewResources, addPreviewResource, removePreviewResource] = usePreviewResources()

  const [items, setItems] = useState<ResourceLibraryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<ResourceLibraryItem | null>(null)
  const [name, setName] = useState("")
  const [url, setUrl] = useState("")
  const [description, setDescription] = useState("")
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const color = TYPE_COLORS[resourceKind] || "#78716c"
  const bg = TYPE_BG[resourceKind] || "bg-slate-50"
  const icon = TYPE_ICONS[resourceKind] || TYPE_ICONS.other
  const isFileType = fileTypesWithUpload.includes(resourceKind)

  const loadItems = useCallback(async () => {
    setLoading(true)
    try {
      const res = await resourceLibraryApi.list({ resourceType: resourceKind, limit: 500 })
      setItems(res.items)
    } catch (err: any) {
      toast({ variant: "destructive", title: "加载失败", description: err.message || "无法获取资源列表" })
    } finally { setLoading(false) }
  }, [resourceKind, toast])

  useEffect(() => { loadItems() }, [loadItems])

  const filtered = searchQuery
    ? items.filter(r => {
        const q = searchQuery.toLowerCase()
        return r.name.toLowerCase().includes(q) || (r.description || "").toLowerCase().includes(q)
      })
    : items

  const resetDialog = () => {
    setName(""); setUrl(""); setDescription("")
    setUploadFile(null); setUploading(false)
  }

  const handleOpenAdd = () => {
    setEditingItem(null)
    resetDialog()
    setIsDialogOpen(true)
  }

  const handleOpenEdit = (item: ResourceLibraryItem) => {
    setEditingItem(item)
    setName(item.name)
    setUrl(item.url || "")
    setDescription(item.description || "")
    setUploadFile(null)
    setUploading(false)
    setIsDialogOpen(true)
  }

  const handleDelete = (id: string) => { setDeleteTarget(id) }
  const confirmDelete = async () => { if (!deleteTarget) return; try { await resourceLibraryApi.delete(deleteTarget); toast({ title: "删除成功" }); loadItems() } catch (err: any) { toast({ variant: "destructive", title: "删除失败", description: err.message }) } finally { setDeleteTarget(null) } }

  const validateResourceFile = (file: File, type: string): string | null => {
    if (file.size > RESOURCE_MAX_FILE_SIZE) return "文件大小超过 100MB"
    const allowed = resourceTypeExtensionMap[type] || []
    if (allowed.length === 0) return null
    const ext = file.name.split(".").pop()?.toLowerCase() || ""
    if (!allowed.includes(ext)) {
      return `不支持的文件格式，请上传 ${allowed.map(e => `.${e}`).join("、")} 文件`
    }
    return null
  }

  const handleResFileDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation()
    const file = e.dataTransfer.files?.[0]
    if (file && isFileType) {
      const err = validateResourceFile(file, resourceKind)
      if (err) { toast({ variant: "destructive", title: "文件校验失败", description: err }); return }
      setUploadFile(file)
    }
  }

  const handleFileSelect = (file: File) => {
    const err = validateResourceFile(file, resourceKind)
    if (err) { toast({ variant: "destructive", title: "文件校验失败", description: err }); return }
    setUploadFile(file)
  }

  const handleSubmit = async () => {
    if (!name.trim()) { toast({ variant: "destructive", title: "名称不能为空" }); return }

    let finalUrl = url.trim()
    let finalSize: number | undefined = editingItem?.fileSize ?? undefined

    if (isFileType && uploadFile) {
      setUploading(true)
      try {
        const res = await fileApi.upload(uploadFile)
        finalUrl = res.url
        finalSize = res.size
      } catch (err: any) {
        toast({ variant: "destructive", title: "文件上传失败", description: err.message })
        setUploading(false)
        return
      } finally { setUploading(false) }
    }

    try {
      if (editingItem) {
        await resourceLibraryApi.update(editingItem.id, {
          name: name.trim(), resourceType: resourceKind as any,
          url: finalUrl || undefined, description: description.trim() || undefined,
          thumbnail: resourceKind === "image" ? finalUrl || undefined : undefined,
          fileSize: finalSize,
        } as any)
        toast({ title: "更新成功" })
      } else {
        await resourceLibraryApi.create({
          name: name.trim(), resourceType: resourceKind as any,
          url: finalUrl || undefined, description: description.trim() || undefined,
          thumbnail: resourceKind === "image" ? finalUrl || undefined : undefined,
          fileSize: finalSize,
        } as any)
        toast({ title: "创建成功" })
      }
      setIsDialogOpen(false); loadItems()
    } catch (err: any) { toast({ variant: "destructive", title: "保存失败", description: err.message }) }
  }

  return (
    <div className="p-6 space-y-5">
      <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-50 to-blue-100">
        <CardContent className="p-4 flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center`}>
            <span style={{ color }}>{icon}</span>
          </div>
          <div>
            <div className="text-2xl font-bold text-blue-700">{items.length}</div>
            <div className="text-xs text-blue-500">{typeLabel}总数</div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base font-semibold">{typeLabel}</CardTitle>
          <Button onClick={handleOpenAdd} size="sm"><Plus className="size-4 mr-1" />新增资源</Button>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input placeholder={`搜索${typeLabel}...`} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
            </div>
          </div>

          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                  <TableHead className="text-left p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">资源</TableHead>
                  <TableHead className="text-left p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">链接</TableHead>
                  <TableHead className="text-left p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">大小</TableHead>
                  <TableHead className="text-left p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">描述</TableHead>
                  <TableHead className="text-right p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && <TableRow><TableCell colSpan={5} className="p-12 text-center text-muted-foreground">加载中...</TableCell></TableRow>}
                {!loading && filtered.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="p-12 text-center">
                    <div className="text-muted-foreground">暂无数据</div>
                    <Button variant="outline" size="sm" className="mt-3" onClick={handleOpenAdd}><Plus className="size-3 mr-1" />新增第一条资源</Button>
                  </TableCell></TableRow>
                )}
                {filtered.map(item => (
                  <TableRow key={item.id}>
                    <TableCell className="p-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center shrink-0`}>
                          <span style={{ color }}>{icon}</span>
                        </div>
                        <span className="text-sm font-medium text-slate-700 truncate max-w-[180px]">{item.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="p-3 hidden md:table-cell">{item.url ? <a href={item.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"><ExternalLink className="size-3" />访问</a> : "-"}</TableCell>
                    <TableCell className="p-3 text-xs text-slate-400 hidden md:table-cell">{formatSize(item.fileSize)}</TableCell>
                    <TableCell className="p-3 text-xs text-slate-400 hidden lg:table-cell max-w-[200px] truncate">{item.description || "-"}</TableCell>
                    <TableCell className="p-3 text-right whitespace-nowrap">
                      {item.url && isFileType && (
                        <Button variant="ghost" size="sm" onClick={() => addPreviewResource(item as any)}><Eye className="size-4" /></Button>
                      )}
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
        description="确定要删除该资源吗？此操作不可恢复。"
        confirmText="删除"
        variant="destructive"
        onConfirm={confirmDelete}
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingItem ? "编辑资源" : "新增资源"}</DialogTitle>
            <DialogDescription>上传本地资源到{typeLabel}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto pr-1">
            <div>
              <Label>资源类型</Label>
              <Badge variant="outline" className="ml-2 text-xs" style={{ color, borderColor: color }}>{typeLabel}</Badge>
            </div>
            <div>
              <Label>资源名称</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="输入资源名称" className="mt-1.5" />
            </div>

            {resourceKind === "link" && (
              <div>
                <Label>URL 地址</Label>
                <Input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..." className="mt-1.5" />
              </div>
            )}

            <div>
              <Label>资源描述</Label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="输入资源简介、用途说明等" className="mt-1.5" rows={2} />
            </div>

            {isFileType && (
              <div
                className={cn(
                  "border-2 border-dashed rounded-xl p-6 text-center space-y-3 transition-colors",
                  uploading ? "border-primary/30 bg-gray-50/50" : "border-gray-200 hover:border-primary/30 hover:bg-gray-50/50 cursor-pointer"
                )}
                onClick={() => !uploading && resFileInputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); e.stopPropagation() }}
                onDrop={handleResFileDrop}
              >
                <input
                  ref={resFileInputRef}
                  type="file"
                  accept={resourceTypeAccept[resourceKind]}
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0]
                    if (file) handleFileSelect(file)
                    e.target.value = ""
                  }}
                />
                {uploadFile ? (
                  <div className="text-center space-y-2 pointer-events-none">
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                      <File className="h-6 w-6 text-primary" />
                    </div>
                    <p className="text-sm font-medium text-gray-700">{uploadFile.name}</p>
                    <p className="text-xs text-gray-500">{(uploadFile.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                ) : (
                  <>
                    <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto">
                      {uploading ? <Loader2 className="h-6 w-6 text-gray-400 animate-spin" /> : <Upload className="h-6 w-6 text-gray-400" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700">点击或拖拽上传文件</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {resourceTypeAccept[resourceKind]
                          ? `支持 ${resourceTypeAccept[resourceKind]}，最大 100MB`
                          : "支持多种格式，最大 100MB"}
                      </p>
                    </div>
                  </>
                )}
                {uploadFile && !uploading && (
                  <div className="flex items-center justify-center gap-2 pointer-events-auto" onClick={e => e.stopPropagation()}>
                    <Button variant="outline" size="sm" onClick={() => resFileInputRef.current?.click()}>
                      <Upload className="h-3.5 w-3.5 mr-1" />重新选择
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setUploadFile(null)}>
                      <X className="h-3.5 w-3.5 mr-1" />清除
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>取消</Button>
            <Button onClick={handleSubmit} disabled={uploading}>
              {uploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              {editingItem ? "保存" : "上传到资源库"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {previewResources.length > 0 && (
        <div className="fixed inset-0 bg-black/40 z-[90]" onClick={() => previewResources.forEach((r) => removePreviewResource(r.id))} />
      )}
      {previewResources.map((r, i) => (
        <ResourcePreviewModal key={r.id} resource={r} open index={i} onOpenChange={() => removePreviewResource(r.id)} />
      ))}
    </div>
  )
}
