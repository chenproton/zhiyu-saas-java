'use client'

import { useState } from 'react'
import { Pencil, Trash2, Award, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { TableHead, TableCell, TableRow } from '@/components/ui/table'
import { FormFieldRow } from '@/components/shared/form-field-row'
import { certificateLibraryApi, fileApi } from '@/lib/api'
import { formatDate } from '@/lib/format-utils'
import type { CertificateLibraryItem } from '@/lib/types/job'
import { useToast, FormDialogFooter } from '@zhiyu/ui'
import { TagBadge } from '@/components/shared/tag-badge'
import { TagFilterBar } from '@/components/shared/tag-filter-bar'
import { TagPicker } from '@/components/shared/tag-picker'
import { useTagBindings } from '@/components/shared/use-tag-bindings'
import { TAG_RESOURCE_TYPES } from '@/lib/types/library'
import { CoverImageUpload } from '@/components/shared/cover-image-upload'
import { LibraryPageShell } from '../_components/library-page-shell'
import { CitationStatsPanel } from '@/components/shared/citation-stats-panel'
import { useLibraryCrud } from '../_components/use-library-crud'
import { useT } from '@/lib/i18n/locale-provider'
import { useEffect } from 'react'

export default function CertificatesPage() {
  const t = useT()
  const { toast } = useToast()
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const { tagsByResource, loadBindings, saveTags } = useTagBindings(
    TAG_RESOURCE_TYPES.certificate_library,
  )
  const {
    items,
    loading,
    searchQuery,
    setSearchQuery,
    loadItems,
    total,
    page,
    setPage,
    totalPages,
  } = useLibraryCrud(certificateLibraryApi.list, {
    autoLoad: false,
    getParams: () =>
      selectedTagIds.length ? { tagIds: selectedTagIds.join(',') } : {},
  })
  useEffect(() => {
    void loadItems()
  }, [loadItems])
  useEffect(() => {
    if (items.length) void loadBindings(items)
  }, [items, loadBindings])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<CertificateLibraryItem | null>(null)
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [description, setDescription] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [imageUploading, setImageUploading] = useState(false)
  const [tagIds, setTagIds] = useState<string[]>([])
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
      toast({ title: t('封面上传成功') })
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: t('上传失败'),
        description: err?.message || t('请稍后重试'),
      })
    } finally {
      setImageUploading(false)
    }
  }
  const handleImageRemove = () => setImageUrl('')
  const handleOpenAdd = () => {
    setEditingItem(null)
    resetForm()
    setTagIds([])
    setIsDialogOpen(true)
  }
  const handleOpenEdit = (item: CertificateLibraryItem) => {
    setEditingItem(item)
    setName(item.name)
    setUrl(item.url || '')
    setDescription(item.description || '')
    setImageUrl(item.imageUrl || '')
    setTagIds((tagsByResource[item.id] || []).map((t) => t.id))
    setIsDialogOpen(true)
  }
  const handleTagFilterChange = (ids: string[]) => {
    setSelectedTagIds(ids)
    setPage(1)
  }
  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await certificateLibraryApi.delete(deleteTarget)
      toast({ title: t('删除成功') })
      loadItems()
    } catch (err: any) {
      toast({ variant: 'destructive', title: t('删除失败'), description: err.message })
    } finally {
      setDeleteTarget(null)
    }
  }
  const handleSubmit = async () => {
    if (!name.trim()) {
      toast({ variant: 'destructive', title: t('名称不能为空') })
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
        toast({ title: t('更新成功') })
        try {
          await saveTags(editingItem.id, tagIds)
        } catch {
          toast({ variant: 'destructive', title: t('标签保存失败'), description: t('实体已保存，标签未关联，可再次保存重试') })
        }
      } else {
        const created = await certificateLibraryApi.create(payload as any)
        toast({ title: t('创建成功') })
        try {
          await saveTags(created.id, tagIds)
        } catch {
          toast({ variant: 'destructive', title: t('标签保存失败'), description: t('实体已保存，标签未关联，可再次保存重试') })
        }
      }
      setIsDialogOpen(false)
      loadItems()
    } catch (err: any) {
      toast({ variant: 'destructive', title: t('保存失败'), description: err.message })
    }
  }

  return (
    <LibraryPageShell
      title={t('岗位证书库')}
      statLabel={t('证书总数')}
      statIcon={
        <div className="w-10 h-10 rounded-lg bg-rose-500/10 flex items-center justify-center">
          <Award className="size-5 text-rose-600" />
        </div>
      }
      statGradient="from-rose-50 to-rose-100"
      statCount={total}
      statsExtra={
        <CitationStatsPanel
          entityLabel={t('证书')}
          dialogTitle={t('零引用证书')}
          fetchStats={() => certificateLibraryApi.citationStats()}
          fetchUncited={(params) => certificateLibraryApi.uncited(params)}
          deleteItem={(id) => certificateLibraryApi.delete(id)}
          onDeleted={loadItems}
          statCount={total}
          statLabel={t('证书总数')}
          statIcon={<Award className="size-5 text-rose-600" />}
          statGradient="from-rose-50 to-rose-100"
        />
      }
      searchPlaceholder={t('搜索证书...')}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      onAdd={handleOpenAdd}
      addLabel={t('新建证书')}
      loading={loading}
      items={items}
      deleteTarget={deleteTarget}
      onDeleteCancel={() => setDeleteTarget(null)}
      onDeleteConfirm={confirmDelete}
      deleteLabel={t('证书')}
      tableHeaders={
        <>
          <TableHead className="text-left p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            {t('名称')}
          </TableHead>
          <TableHead className="text-left p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">
            {t('链接')}
          </TableHead>
          <TableHead className="text-left p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">
            {t('描述')}
          </TableHead>
          <TableHead className="text-left p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">
            {t('标签')}
          </TableHead>
          <TableHead className="text-left p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            {t('创建时间')}
          </TableHead>
          <TableHead className="text-right p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            {t('操作')}
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
                className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80"
              >
                <ExternalLink className="size-3" />
                {t('访问')}
              </a>
            ) : (
              '-'
            )}
          </TableCell>
          <TableCell className="p-3 text-sm text-slate-400 hidden lg:table-cell max-w-[300px] truncate">
            {item.description || '-'}
          </TableCell>
          <TableCell className="p-3 hidden lg:table-cell">
            <div className="flex flex-wrap gap-1.5">
              {(tagsByResource[item.id] || []).map((tag) => (
                <TagBadge key={tag.id} tag={tag} />
              ))}
              {(tagsByResource[item.id] || []).length === 0 && (
                <span className="text-xs text-slate-300">-</span>
              )}
            </div>
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
              <DialogTitle>{editingItem ? t('编辑证书') : t('新增证书')}</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleSubmit()
              }}
              className="grid gap-4"
            >
              <div className="space-y-4">
              <FormFieldRow label={t('名称')} required>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('证书名称')}
                />
              </FormFieldRow>
              <div>
                <CoverImageUpload
                  imageUrl={imageUrl}
                  uploading={imageUploading}
                  label={t('证书封面')}
                  alt={t('证书封面')}
                  onUpload={handleImageUpload}
                  onRemove={handleImageRemove}
                />
              </div>
              <FormFieldRow label={t('链接')}>
                <Input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder={t('官方链接')}
                />
              </FormFieldRow>
              <FormFieldRow label={t('描述')}>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t('简要描述')}
                />
              </FormFieldRow>
              <FormFieldRow label={t('标签')}>
                <TagPicker value={tagIds} onChange={setTagIds} />
              </FormFieldRow>
              </div>
              <FormDialogFooter onCancel={() => setIsDialogOpen(false)} />
            </form>
          </DialogContent>
        </Dialog>
      }
      pagination={{ page, totalPages, onPageChange: setPage }}
    >
      <TagFilterBar value={selectedTagIds} onChange={handleTagFilterChange} className="mb-4" />
    </LibraryPageShell>
  )
}
