'use client'

import { useEffect, useState } from 'react'
import { Pencil, Trash2, Lightbulb } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FormFieldRow } from '@/components/shared/form-field-row'
import { Switch } from '@/components/ui/switch'
import { TableHead, TableCell, TableRow } from '@/components/ui/table'
import { abilityApi } from '@/lib/api'
import type { AbilityPoint } from '@/lib/types/job'
import { useToast } from '@zhiyu/ui'
import { TagBadge } from '@/components/shared/tag-badge'
import { TagFilterBar } from '@/components/shared/tag-filter-bar'
import { TagPicker } from '@/components/shared/tag-picker'
import { useTagBindings } from '@/components/shared/use-tag-bindings'
import { TAG_RESOURCE_TYPES } from '@/lib/types/library'
import { useLibraryCrud } from '../_components/use-library-crud'
import { LibraryPageShell } from '../_components/library-page-shell'

export default function AbilityPointsPage() {
  const { toast } = useToast()
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const { tagsByResource, loadBindings, saveTags } = useTagBindings(
    TAG_RESOURCE_TYPES.ability_point,
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
  } = useLibraryCrud(abilityApi.list, {
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
  const [editingItem, setEditingItem] = useState<AbilityPoint | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [attributes, setAttributes] = useState('')
  const [tagIds, setTagIds] = useState<string[]>([])
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const handleOpenAdd = () => {
    setEditingItem(null)
    setName('')
    setDescription('')
    setIsPublic(false)
    setAttributes('')
    setTagIds([])
    setIsDialogOpen(true)
  }
  const handleOpenEdit = (item: AbilityPoint) => {
    setEditingItem(item)
    setName(item.name)
    setDescription(item.description || '')
    setIsPublic(item.isPublic)
    setAttributes(item.attributes?.join(', ') || '')
    setTagIds((tagsByResource[item.id] || []).map((t) => t.id))
    setIsDialogOpen(true)
  }
  const handleTagFilterChange = (ids: string[]) => {
    setSelectedTagIds(ids)
    setPage(1)
    void loadItems()
  }
  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await abilityApi.delete(deleteTarget)
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
    const attrList = attributes
      ? attributes
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : []
    try {
      let savedId: string
      if (editingItem) {
        savedId = editingItem.id
        await abilityApi.update(editingItem.id, {
          name: name.trim(),
          description: description.trim() || undefined,
          isPublic,
          attributes: attrList,
        } as any)
        toast({ title: '更新成功' })
      } else {
        const created = await abilityApi.create({
          name: name.trim(),
          description: description.trim() || undefined,
          isPublic,
          attributes: attrList,
        } as any)
        savedId = created.id
        toast({ title: '创建成功' })
      }
      await saveTags(savedId, tagIds)
      setIsDialogOpen(false)
      loadItems()
    } catch (err: any) {
      toast({ variant: 'destructive', title: '保存失败', description: err.message })
    }
  }

  return (
    <LibraryPageShell
      title="能力点管理"
      statLabel="能力点总数"
      statIcon={
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Lightbulb className="size-5 text-primary" />
        </div>
      }
      statGradient="from-primary/5 to-primary/10"
      statCount={total}
      searchPlaceholder="搜索能力点..."
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      onAdd={handleOpenAdd}
      addLabel="新建能力点"
      loading={loading}
      items={items}
      deleteTarget={deleteTarget}
      onDeleteCancel={() => setDeleteTarget(null)}
      onDeleteConfirm={confirmDelete}
      deleteLabel="能力点"
      tableHeaders={
        <>
          <TableHead className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            名称
          </TableHead>
          <TableHead className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            编码
          </TableHead>
          <TableHead className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">
            描述
          </TableHead>
          <TableHead className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">
            属性标签
          </TableHead>
          <TableHead className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">
            标签
          </TableHead>
          <TableHead className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            公开
          </TableHead>
          <TableHead className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">
            操作
          </TableHead>
        </>
      }
      tableBody={(item) => (
        <TableRow key={item.id} className="hover:bg-slate-50/50">
          <TableCell className="p-3">
            <div className="flex items-center gap-2">
              <Lightbulb className="size-4 text-primary" />
              <span className="text-sm font-medium text-slate-700">{item.name}</span>
            </div>
          </TableCell>
          <TableCell className="p-3 text-sm text-slate-400">{item.code || '-'}</TableCell>
          <TableCell className="p-3 text-sm text-slate-400 hidden md:table-cell max-w-[200px] truncate">
            {item.description || '-'}
          </TableCell>
          <TableCell className="p-3 text-sm hidden lg:table-cell">
            {item.attributes?.map((a) => (
              <Badge key={a} variant="secondary" className="mr-1 text-xs">
                {a}
              </Badge>
            ))}
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
          <TableCell className="p-3">
            <Badge variant={item.isPublic ? 'default' : 'secondary'} className="text-xs">
              {item.isPublic ? '公开' : '私有'}
            </Badge>
          </TableCell>
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
              <DialogTitle>{editingItem ? '编辑能力点' : '新增能力点'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {editingItem && (
                <FormFieldRow label="编码">
                  <Input value={editingItem.code || '-'} readOnly />
                </FormFieldRow>
              )}
              <FormFieldRow label="名称" required>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="能力点名称"
                />
              </FormFieldRow>
              <FormFieldRow label="描述">
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="简要描述"
                />
              </FormFieldRow>
              <FormFieldRow label="属性标签（逗号分隔）">
                <Input
                  value={attributes}
                  onChange={(e) => setAttributes(e.target.value)}
                  placeholder="沟通, 协作, 领导力"
                />
              </FormFieldRow>
              <FormFieldRow label="标签">
                <TagPicker value={tagIds} onChange={setTagIds} />
              </FormFieldRow>
              <div className="flex items-center space-x-2">
                <Switch checked={isPublic} onCheckedChange={setIsPublic} />
                <Label>公开</Label>
              </div>
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
      pagination={{ page, totalPages, onPageChange: setPage }}
    >
      <TagFilterBar value={selectedTagIds} onChange={handleTagFilterChange} className="mb-4" />
      <div className="flex gap-3">
        {searchQuery && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearchQuery('')
            }}
          >
            清除
          </Button>
        )}
      </div>
    </LibraryPageShell>
  )
}
