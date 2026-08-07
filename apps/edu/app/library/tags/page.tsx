'use client'

import { useState } from 'react'
import { Pencil, Trash2, Tags as TagsIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TableHead, TableCell, TableRow } from '@/components/ui/table'
import { tagApi } from '@/lib/api'
import type { TagItem } from '@/lib/types/library'
import { useToast } from '@zhiyu/ui'
import { LibraryPageShell } from '../_components/library-page-shell'
import { TagBadge } from '@/components/shared/tag-badge'
import { useTags } from '@/components/shared/use-tags'
import { useT } from '@/lib/i18n/locale-provider'

export default function TagsPage() {
  const t = useT()
  const { toast } = useToast()
  const { tags, loading, reload } = useTags()
  const [searchQuery, setSearchQuery] = useState('')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<TagItem | null>(null)
  const [name, setName] = useState('')
  const [color, setColor] = useState('#6366f1')
  const [deleteTarget, setDeleteTarget] = useState<TagItem | null>(null)

  const filtered = tags.filter((t) => t.name.toLowerCase().includes(searchQuery.toLowerCase()))

  const randomColor = () =>
    `#${Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0')}`

  const handleOpenAdd = () => {
    setEditingItem(null)
    setName('')
    setColor(randomColor())
    setIsDialogOpen(true)
  }

  const handleOpenEdit = (item: TagItem) => {
    setEditingItem(item)
    setName(item.name)
    setColor(item.color)
    setIsDialogOpen(true)
  }

  const handleSubmit = async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      toast({ variant: 'destructive', title: t('标签名称不能为空') })
      return
    }
    try {
      if (editingItem) {
        await tagApi.update(editingItem.id, { name: trimmed, color })
        toast({ title: t('更新成功') })
      } else {
        await tagApi.create({ name: trimmed, color })
        toast({ title: t('创建成功') })
      }
      setIsDialogOpen(false)
      reload()
    } catch (err: any) {
      toast({ variant: 'destructive', title: t('保存失败'), description: err.message })
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await tagApi.delete(deleteTarget.id)
      toast({ title: t('删除成功') })
      reload()
    } catch (err: any) {
      toast({ variant: 'destructive', title: t('删除失败'), description: err.message })
    } finally {
      setDeleteTarget(null)
    }
  }

  return (
    <>
      <LibraryPageShell
        title={t('标签管理')}
        statLabel={t('标签总数')}
        statIcon={
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <TagsIcon className="size-5 text-primary" />
          </div>
        }
        statGradient="from-primary/5 to-primary/10"
        statCount={tags.length}
        searchPlaceholder={t('搜索标签...')}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onAdd={handleOpenAdd}
        addLabel={t('新建标签')}
        loading={loading}
        items={filtered}
        emptyMessage={t('暂无标签，点击右上角新建')}
        deleteTarget={deleteTarget ? deleteTarget.id : null}
        onDeleteCancel={() => setDeleteTarget(null)}
        onDeleteConfirm={confirmDelete}
        deleteLabel={t('标签（关联资源的标签绑定将一并清除）')}
        tableHeaders={
          <>
            <TableHead className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {t('标签')}
            </TableHead>
            <TableHead className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">
              {t('颜色')}
            </TableHead>
            <TableHead className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {t('绑定资源数')}
            </TableHead>
            <TableHead className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">
              {t('操作')}
            </TableHead>
          </>
        }
        tableBody={(item) => (
          <TableRow key={item.id} className="hover:bg-slate-50/50">
            <TableCell className="p-3">
              <TagBadge tag={item} />
            </TableCell>
            <TableCell className="p-3 hidden md:table-cell">
              <span className="text-sm text-slate-400 font-mono">{item.color}</span>
            </TableCell>
            <TableCell className="p-3 text-sm text-slate-700">{item.resourceCount ?? 0}</TableCell>
            <TableCell className="p-3 text-right whitespace-nowrap">
              <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(item)}>
                <Pencil className="size-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(item)}>
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </TableCell>
          </TableRow>
        )}
        dialog={
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{editingItem ? t('编辑标签') : t('新建标签')}</DialogTitle>
                <DialogDescription>
                  {t('标签可用于公共资源库各列表页的筛选，以及资源新增/编辑时的绑定')}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div>
                  <Label>{t('标签名称')}</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('如：重点教材、精品课程')}
                    className="mt-1.5"
                    maxLength={64}
                  />
                </div>
                <div>
                  <Label>{t('标签颜色')}</Label>
                  <div className="flex items-center gap-3 mt-1.5">
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="w-10 h-10 rounded-lg border border-slate-200 cursor-pointer bg-transparent p-1"
                    />
                    <div className="flex items-center gap-2">
                      <TagBadge tag={{ id: 'preview', tenantId: '', name: name.trim() || t('标签预览'), color, createdAt: '', updatedAt: '' }} />
                      <span className="text-xs text-slate-400 font-mono">{color}</span>
                    </div>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  {t('取消')}
                </Button>
                <Button onClick={handleSubmit}>{editingItem ? t('保存') : t('创建')}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
        pagination={undefined}
      />
    </>
  )
}
