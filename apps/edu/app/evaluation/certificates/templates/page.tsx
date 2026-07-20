"use client"

import { useState, useMemo, useRef } from "react"
import {
  Plus,
  Search,
  FileText,
  Pencil,
  Trash2,
  Settings,
  X,
  Check,
  ImageIcon,
  Upload,
  Bold,
  Italic,
  Underline,
  List,
  Heading1,
  Heading2,
  Heading3,
  Type,
  MoreHorizontal,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { useData } from "@/components/providers/data-provider"
import type { MicroCertTemplate, MicroCertTemplateFormData, CertType } from "@/lib/types"

export default function MicroCertTemplatesPage() {
  const {
    microCertTemplates,
    certTypes,
    createMicroCertTemplate,
    updateMicroCertTemplate,
    deleteMicroCertTemplate,
    updateCertTypes,
  } = useData()

  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")
  const [formOpen, setFormOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<MicroCertTemplate | null>(null)
  const [typeConfigOpen, setTypeConfigOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deletingTemplate, setDeletingTemplate] = useState<MicroCertTemplate | null>(null)

  const [formTitle, setFormTitle] = useState("")
  const [formCertTypeId, setFormCertTypeId] = useState("")
  const [formContent, setFormContent] = useState("")
  const [formCoverUrl, setFormCoverUrl] = useState<string>("")
  const coverFileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const [editingTypes, setEditingTypes] = useState<CertType[]>([])
  const [newTypeName, setNewTypeName] = useState("")

  const openCreateDialog = () => {
    setEditingTemplate(null)
    setFormTitle("")
    setFormCertTypeId("")
    setFormContent("")
    setFormCoverUrl("")
    setFormOpen(true)
  }

  const openEditDialog = (template: MicroCertTemplate) => {
    setEditingTemplate(template)
    setFormTitle(template.title)
    setFormCertTypeId(template.certTypeId)
    setFormContent(template.content)
    setFormCoverUrl(template.coverImage || "")
    setFormOpen(true)
  }

  const openTypeConfig = () => {
    setEditingTypes([...certTypes])
    setNewTypeName("")
    setTypeConfigOpen(true)
  }

  const addCertType = () => {
    if (!newTypeName.trim()) return
    if (editingTypes.some((t) => t.name === newTypeName.trim())) {
      alert("该认证类型已存在")
      return
    }
    const newType: CertType = {
      id: `ct-${Date.now()}`,
      name: newTypeName.trim(),
    }
    setEditingTypes([...editingTypes, newType])
    setNewTypeName("")
  }

  const handleCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      alert("文件大小不能超过 5MB")
      return
    }
    if (!file.type.startsWith("image/")) {
      alert("请上传图片文件")
      return
    }
    setFormCoverUrl(URL.createObjectURL(file))
  }

  const insertTag = (openTag: string, closeTag: string) => {
    const el = textareaRef.current
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    const selectedText = formContent.substring(start, end)
    const before = formContent.substring(0, start)
    const after = formContent.substring(end)
    const newText = before + openTag + (selectedText || "") + closeTag + after
    setFormContent(newText)
    setTimeout(() => {
      el.focus()
      const cursorPos = selectedText ? start + openTag.length + selectedText.length + closeTag.length : start + openTag.length
      el.setSelectionRange(cursorPos, cursorPos)
    }, 0)
  }

  const removeCover = () => {
    setFormCoverUrl("")
    if (coverFileInputRef.current) coverFileInputRef.current.value = ""
  }

  const removeCertType = (id: string) => {
    setEditingTypes(editingTypes.filter((t) => t.id !== id))
  }

  const saveCertTypes = () => {
    updateCertTypes(editingTypes)
    setTypeConfigOpen(false)
  }

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formTitle.trim() || !formCertTypeId || !formContent.trim()) return

    const data: MicroCertTemplateFormData = {
      title: formTitle.trim(),
      certTypeId: formCertTypeId,
      content: formContent.trim(),
      coverImage: formCoverUrl || undefined,
    }

    if (editingTemplate) {
      updateMicroCertTemplate(editingTemplate.id, data)
    } else {
      createMicroCertTemplate(data)
    }
    setFormOpen(false)
  }

  const handleDelete = () => {
    if (deletingTemplate) {
      deleteMicroCertTemplate(deletingTemplate.id)
      setDeleteOpen(false)
      setDeletingTemplate(null)
    }
  }

  const filteredTemplates = useMemo(() => {
    return microCertTemplates.filter((t) => {
      const matchSearch = !search || t.title.toLowerCase().includes(search.toLowerCase())
      const matchType = typeFilter === "all" || t.certTypeId === typeFilter
      return matchSearch && matchType
    })
  }, [microCertTemplates, search, typeFilter])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">微证书模板管理</h1>
          <p className="text-sm text-gray-500 mt-1">管理微证书模板，支持自定义证书内容和认证类型</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={openTypeConfig}>
            <Settings className="mr-1.5 size-4" />
            认证类型配置
          </Button>
          <Button size="sm" onClick={openCreateDialog}>
            <Plus className="mr-1.5 size-4" />
            新建模板
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex items-center gap-3 rounded-lg border bg-white px-4 py-3">
          <div className="flex size-8 items-center justify-center rounded-md bg-blue-50">
            <FileText className="size-3.5 text-blue-600" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">模板总数</div>
            <div className="text-sm font-semibold">{microCertTemplates.length}</div>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border bg-white px-4 py-3">
          <div className="flex size-8 items-center justify-center rounded-md bg-green-50">
            <Settings className="size-3.5 text-green-600" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">认证类型</div>
            <div className="text-sm font-semibold">{certTypes.length}</div>
          </div>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          <Input
            placeholder="搜索模板标题..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="认证类型" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="all">全部类型</SelectItem>
              {certTypes.map((ct) => (
                <SelectItem key={ct.id} value={ct.id}>
                  {ct.name}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      {/* Templates Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[60px]">序号</TableHead>
              <TableHead>证书标题</TableHead>
              <TableHead className="w-[140px]">认证类型</TableHead>
              <TableHead className="w-[180px]">创建时间</TableHead>
              <TableHead className="w-[180px]">更新时间</TableHead>
              <TableHead className="w-[120px]">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTemplates.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-slate-400 py-12">
                  暂无数据
                </TableCell>
              </TableRow>
            ) : (
              filteredTemplates.map((t, idx) => (
                <TableRow key={t.id}>
                  <TableCell className="text-slate-500">{idx + 1}</TableCell>
                  <TableCell className="font-medium">{t.title}</TableCell>
                  <TableCell>
                    <span className="px-2 py-0.5 text-xs rounded-full bg-blue-50 text-blue-600">
                      {t.certTypeName}
                    </span>
                  </TableCell>
                  <TableCell className="text-slate-500 text-sm">
                    {t.createdAt.toLocaleDateString("zh-CN")}
                  </TableCell>
                  <TableCell className="text-slate-500 text-sm">
                    {t.updatedAt.toLocaleDateString("zh-CN")}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditDialog(t)}>
                          编辑
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => { setDeletingTemplate(t); setDeleteOpen(true) }}>
                          删除
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create/Edit Form Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? "编辑模板" : "新建模板"}</DialogTitle>
            <DialogDescription>
              {editingTemplate ? "修改微证书模板信息" : "创建一个新的微证书模板"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleFormSubmit}>
            <FieldGroup className="max-h-[70vh] overflow-y-auto py-4">
              <Field>
                <FieldLabel htmlFor="cert-title">证书标题</FieldLabel>
                <Input
                  id="cert-title"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="请输入证书标题"
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="cert-type">认证类型</FieldLabel>
                <Select value={formCertTypeId} onValueChange={setFormCertTypeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择认证类型" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {certTypes.map((ct) => (
                        <SelectItem key={ct.id} value={ct.id}>
                          {ct.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>证书封面</FieldLabel>
                <input
                  ref={coverFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleCoverUpload}
                  className="hidden"
                />
                {formCoverUrl ? (
                  <div className="relative mt-2 w-full overflow-hidden rounded-lg border">
                    <img
                      src={formCoverUrl}
                      alt="封面预览"
                      className="h-40 w-full object-cover"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute right-2 top-2 size-6"
                      onClick={removeCover}
                    >
                      <X className="size-3" />
                    </Button>
                  </div>
                ) : (
                  <div
                    onClick={() => coverFileInputRef.current?.click()}
                    className="mt-2 flex h-32 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 transition-colors hover:border-muted-foreground/50"
                  >
                    <Upload className="mb-2 size-8 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">点击上传证书封面</span>
                  </div>
                )}
              </Field>
              <Field>
                <FieldLabel htmlFor="cert-content">证书内容（富文本）</FieldLabel>
                <div className="border rounded-lg overflow-hidden">
                  <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 bg-slate-50 border-b">
                    <button
                      type="button"
                      onClick={() => insertTag("<b>", "</b>")}
                      className="p-1.5 rounded hover:bg-slate-200 text-slate-600"
                      title="加粗"
                    >
                      <Bold className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => insertTag("<i>", "</i>")}
                      className="p-1.5 rounded hover:bg-slate-200 text-slate-600"
                      title="斜体"
                    >
                      <Italic className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => insertTag("<u>", "</u>")}
                      className="p-1.5 rounded hover:bg-slate-200 text-slate-600"
                      title="下划线"
                    >
                      <Underline className="size-3.5" />
                    </button>
                    <span className="w-px h-5 bg-slate-200 mx-1" />
                    <button
                      type="button"
                      onClick={() => insertTag("<h2>", "</h2>")}
                      className="p-1.5 rounded hover:bg-slate-200 text-slate-600"
                      title="标题 H2"
                    >
                      <Heading2 className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => insertTag("<h3>", "</h3>")}
                      className="p-1.5 rounded hover:bg-slate-200 text-slate-600"
                      title="标题 H3"
                    >
                      <Heading3 className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => insertTag("<p>", "</p>")}
                      className="p-1.5 rounded hover:bg-slate-200 text-slate-600"
                      title="段落"
                    >
                      <Type className="size-3.5" />
                    </button>
                    <span className="w-px h-5 bg-slate-200 mx-1" />
                    <button
                      type="button"
                      onClick={() => insertTag("<ul><li>", "</li>\n</ul>")}
                      className="p-1.5 rounded hover:bg-slate-200 text-slate-600"
                      title="无序列表"
                    >
                      <List className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => insertTag("<span style=\"color:red\">", "</span>")}
                      className="px-2 py-1 text-xs rounded hover:bg-slate-200 text-red-500 font-medium"
                      title="红色文字"
                    >
                      A
                    </button>
                    <button
                      type="button"
                      onClick={() => insertTag("<span style=\"color:#d4a017\">", "</span>")}
                      className="px-2 py-1 text-xs rounded hover:bg-slate-200 font-medium"
                      style={{ color: "#d4a017" }}
                      title="金色文字"
                    >
                      A
                    </button>
                    <div className="ml-auto text-xs text-slate-400">预览：选中文本后点击按钮插入标签</div>
                  </div>
                  <Textarea
                    id="cert-content"
                    ref={textareaRef}
                    value={formContent}
                    onChange={(e) => setFormContent(e.target.value)}
                    placeholder="请输入证书内容（支持HTML富文本）"
                    rows={12}
                    className="font-mono text-sm border-0 rounded-t-none focus-visible:ring-0"
                    required
                  />
                </div>
              </Field>
            </FieldGroup>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                取消
              </Button>
              <Button type="submit" disabled={!formTitle.trim() || !formCertTypeId || !formContent.trim()}>
                {editingTemplate ? "保存" : "创建"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              确定要删除模板"{deletingTemplate?.title}"吗？此操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Certification Type Config Dialog */}
      <Dialog open={typeConfigOpen} onOpenChange={setTypeConfigOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>认证类型字典配置</DialogTitle>
            <DialogDescription>
              自定义维护证书认证类型，修改后会影响模板中的类型选项
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="输入新类型名称"
                value={newTypeName}
                onChange={(e) => setNewTypeName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    addCertType()
                  }
                }}
              />
              <Button variant="outline" size="sm" onClick={addCertType}>
                <Plus className="size-4" />
              </Button>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {editingTypes.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">暂无认证类型</p>
              ) : (
                editingTypes.map((ct) => (
                  <div
                    key={ct.id}
                    className="flex items-center justify-between px-3 py-2 rounded-md bg-slate-50"
                  >
                    <span className="text-sm">{ct.name}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-slate-400 hover:text-red-500"
                      onClick={() => removeCertType(ct.id)}
                    >
                      <X className="size-3.5" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTypeConfigOpen(false)}>
              取消
            </Button>
            <Button onClick={saveCertTypes}>
              <Check className="mr-1.5 size-4" />
              保存配置
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
