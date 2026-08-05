'use client'

import { useState } from 'react'
import { Pencil, Trash2, Award, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { TableHead, TableCell, TableRow } from '@/components/ui/table'
import { FormFieldRow } from '@/components/shared/form-field-row'
import { certificateLibraryApi, fileApi } from '@/lib/api'
import { formatDate } from '@/lib/format-utils'
import type { CertificateLibraryItem } from '@/lib/types/job'
import { useToast } from '@zhiyu/ui'
import { CoverImageUpload } from '@/components/shared/cover-image-upload'
import { LibraryPageShell } from '../_components/library-page-shell'
import { useLibraryCrud } from '../_components/use-library-crud'

export default function CertificatesPage() {
  const { toast } = useToast()
  const { items, loading, searchQuery, setSearchQuery, loadItems } = useLibraryCrud(
    certificateLibraryApi.list,
  )
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<CertificateLibraryItem | null>(null)
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [description, setDescription] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [imageUploading, setImageUploading] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const resetForm = () => {
    setName('')
    setUrl('')
    setDescription('')
    setImageUrl('')
  }
  const handleImageUpload = async (file: File) => {
    setImageUploading(true)
    try {
      const res = await fileApi.upload(file)
      setImageUrl(res.url)
      toast({ title: '封面上传成功' })
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: '上传失败',
        description: err?.message || '请稍后重试',
      })
    } finally {
      setImageUploading(false)
    }
  }
  const handleImageRemove = () => setImageUrl('')
  const handleOpenAdd = () => {
    setEditingItem(null)
    resetForm()
    setIsDialogOpen(true)
  }
  const handleOpenEdit = (item: CertificateLibraryItem) => {
    setEditingItem(item)
    setName(item.name)
    setUrl(item.url || '')
    setDescription(item.description || '')
    setImageUrl(item.imageUrl || '')
    setIsDialogOpen(true)
  }
  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await certificateLibraryApi.delete(deleteTarget)
      toast({ title: '删除成功' })
      loadItems()
    } catch (err: any) {
      toast({ variant: 'destructive', title: '删除失败', description: err.message })
    } finally {
      setDeleteTarget(null)
    }
  }
  const handleSubmit = async () => {
    if (!name.trim()) {
      toast({ variant: 'destructive', title: '名称不能为空' })
      return
    }
    try {
      const payload = {
        name: name.trim(),
        url: url.trim() || undefined,
        description: description.trim() || undefined,
        imageUrl: imageUrl.trim() || undefined,
      }
      if (editingItem) {
        await certificateLibraryApi.update(editingItem.id, payload as any)
        toast({ title: '更新成功' })
      } else {
        await certificateLibraryApi.create(payload as any)
        toast({ title: '创建成功' })
      }
      setIsDialogOpen(false)
      loadItems()
    } catch (err: any) {
      toast({ variant: 'destructive', title: '保存失败', description: err.message })
    }
  }

  return (
    <LibraryPageShell
      title="岗位证书库"
      statLabel="证书总数"
      statIcon={
        <div className="w-10 h-10 rounded-lg bg-rose-500/10 flex items-center justify-center">
          <Award className="size-5 text-rose-600" />
        </div>
      }
      statGradient="from-rose-50 to-rose-100"
      statCount={items.length}
      searchPlaceholder="搜索证书..."
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      onAdd={handleOpenAdd}
      addLabel="新增证书"
      loading={loading}
      items={items}
      deleteTarget={deleteTarget}
      onDeleteCancel={() => setDeleteTarget(null)}
      onDeleteConfirm={confirmDelete}
      deleteLabel="证书"
      tableHeaders={
        <>
          <TableHead className="text-left p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            名称
          </TableHead>
          <TableHead className="text-left p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">
            链接
          </TableHead>
          <TableHead className="text-left p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">
            描述
          </TableHead>
          <TableHead className="text-left p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            创建时间
          </TableHead>
          <TableHead className="text-right p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            操作
          </TableHead>
        </>
      }
      tableBody={(item) => (
        <TableRow key={item.id}>
          <TableCell className="p-3">
            <div className="flex items-center gap-2">
              <Award className="size-4 text-rose-500" />
              <span className="text-sm font-medium text-slate-700">{item.name}</span>
            </div>
          </TableCell>
          <TableCell className="p-3 hidden md:table-cell">
            {item.url ? (
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
              >
                <ExternalLink className="size-3" />
                访问
              </a>
            ) : (
              '-'
            )}
          </TableCell>
          <TableCell className="p-3 text-sm text-slate-400 hidden lg:table-cell max-w-[300px] truncate">
            {item.description || '-'}
          </TableCell>
          <TableCell className="p-3 text-sm text-slate-400">{formatDate(item.createdAt)}</TableCell>
          <TableCell className="p-3 text-right whitespace-nowrap">
            <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(item)}>
              <Pencil className="size-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(item.id)}>
              <Trash2 className="size-4 text-destructive" />
            </Button>
          </TableCell>
        </TableRow>
      )}
      dialog={
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingItem ? '编辑证书' : '新增证书'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <FormFieldRow label="名称" required>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="证书名称"
                />
              </FormFieldRow>
              <div>
                <CoverImageUpload
                  imageUrl={imageUrl}
                  uploading={imageUploading}
                  label="证书封面"
                  alt="证书封面"
                  onUpload={handleImageUpload}
                  onRemove={handleImageRemove}
                />
              </div>
              <FormFieldRow label="链接">
                <Input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="官方链接"
                />
              </FormFieldRow>
              <FormFieldRow label="描述">
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="简要描述"
                />
              </FormFieldRow>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                取消
              </Button>
              <Button onClick={handleSubmit}>保存</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
    />
  )
}
