'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Pencil, Trash2, MessageSquare } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { FormFieldRow } from '@/components/shared/form-field-row'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { TableHead, TableCell, TableRow } from '@/components/ui/table'
import { randomDrawQuestionApi, majorApi } from '@/lib/api'
import { useToast, FormDialogFooter } from '@zhiyu/ui'
import { TagBadge } from '@/components/shared/tag-badge'
import { TagFilterBar } from '@/components/shared/tag-filter-bar'
import { TagPicker } from '@/components/shared/tag-picker'
import { useTagBindings } from '@/components/shared/use-tag-bindings'
import { TAG_RESOURCE_TYPES } from '@/lib/types/library'
import { useLibraryCrud } from '../_components/use-library-crud'
import { LibraryPageShell } from '../_components/library-page-shell'
import { useT } from '@/lib/i18n/locale-provider'

export default function QuestionsPage() {
  const t = useT()
  const { toast } = useToast()
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const { tagsByResource, loadBindings, saveTags } = useTagBindings(
    TAG_RESOURCE_TYPES.random_draw_question,
  )

  const {
    items,
    loading,
    searchQuery,
    setSearchQuery,
    loadItems,
    page,
    setPage,
    totalPages,
    total,
  } = useLibraryCrud(randomDrawQuestionApi.list, {
    limit: 200,
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
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [answer, setAnswer] = useState('')
  const [majorId, setMajorId] = useState('')
  const [tagIds, setTagIds] = useState<string[]>([])
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [majors, setMajors] = useState<any[]>([])
  const majorNameMap = useMemo(() => {
    const map: Record<string, string> = {}
    majors.forEach((m: any) => {
      map[m.id] = m.name
    })
    return map
  }, [majors])

  const loadMajors = useCallback(async () => {
    try {
      const res = await majorApi.list({ limit: 1000 })
      setMajors((res.items || []).map((m: any) => ({ id: m.id, name: m.name })))
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 首次加载数据需要同步 setState
    loadMajors()
  }, [loadMajors])

  const handleAdd = () => {
    setEditing(null)
    setName('')
    setDesc('')
    setAnswer('')
    setMajorId('')
    setTagIds([])
    setDialogOpen(true)
  }
  const handleEdit = (item: any) => {
    setEditing(item)
    setName(item.name)
    setDesc(item.description || '')
    setAnswer(item.answer || '')
    setMajorId(item.majorId || '')
    setTagIds((tagsByResource[item.id] || []).map((t) => t.id))
    setDialogOpen(true)
  }
  const handleTagFilterChange = (ids: string[]) => {
    setSelectedTagIds(ids)
    setPage(1)
  }
  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await randomDrawQuestionApi.delete(deleteTarget)
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
      toast({ variant: 'destructive', title: t('题目名称不能为空') })
      return
    }
    try {
      const payload = {
        name: name.trim(),
        description: desc.trim() || undefined,
        answer: answer.trim() || undefined,
        majorId: majorId || undefined,
      }
      if (editing) {
        await randomDrawQuestionApi.update(editing.id, payload as any)
        toast({ title: t('更新成功') })
        try {
          await saveTags(editing.id, tagIds)
        } catch {
          toast({ variant: 'destructive', title: t('标签保存失败'), description: t('实体已保存，标签未关联，可再次保存重试') })
        }
      } else {
        const created = await randomDrawQuestionApi.create(payload as any)
        toast({ title: t('创建成功') })
        try {
          await saveTags(created.id, tagIds)
        } catch {
          toast({ variant: 'destructive', title: t('标签保存失败'), description: t('实体已保存，标签未关联，可再次保存重试') })
        }
      }
      setDialogOpen(false)
      loadItems()
    } catch (err: any) {
      toast({ variant: 'destructive', title: t('保存失败'), description: err.message })
    }
  }

  return (
    <LibraryPageShell
      title={t('现场问答题库')}
      statLabel={t('题目总数')}
      statIcon={
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <MessageSquare className="size-5 text-primary" />
        </div>
      }
      statGradient="from-primary/5 to-primary/10"
      statCount={total}
      searchPlaceholder={t('搜索题目名称...')}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      onAdd={handleAdd}
      addLabel={t('新建现场问答题')}
      loading={loading}
      items={items}
      deleteTarget={deleteTarget}
      onDeleteCancel={() => setDeleteTarget(null)}
      onDeleteConfirm={confirmDelete}
      deleteLabel={t('现场问答题')}
      tableHeaders={
        <>
          <TableHead className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            {t('题目名称')}
          </TableHead>
          <TableHead className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            {t('题目描述')}
          </TableHead>
          <TableHead className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">
            {t('适用专业')}
          </TableHead>
          <TableHead className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">
            {t('标签')}
          </TableHead>
          <TableHead className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">
            {t('答案')}
          </TableHead>
          <TableHead className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">
            {t('操作')}
          </TableHead>
        </>
      }
      tableBody={(item: any) => (
        <TableRow key={item.id} className="hover:bg-slate-50/50">
          <TableCell className="p-3">
            <span className="text-sm font-medium text-slate-700">{item.name}</span>
          </TableCell>
          <TableCell className="p-3">
            <span className="text-xs text-slate-500 line-clamp-2">{item.description || '-'}</span>
          </TableCell>
          <TableCell className="p-3 hidden md:table-cell">
            <Badge variant="secondary" className="text-xs">
              {item.majorName || majorNameMap[item.majorId] || '-'}
            </Badge>
          </TableCell>
          <TableCell className="p-3 hidden md:table-cell">
            <div className="flex flex-wrap gap-1.5">
              {(tagsByResource[item.id] || []).map((tag) => (
                <TagBadge key={tag.id} tag={tag} />
              ))}
              {(tagsByResource[item.id] || []).length === 0 && (
                <span className="text-xs text-slate-300">-</span>
              )}
            </div>
          </TableCell>
          <TableCell className="p-3 text-xs text-slate-400 hidden md:table-cell line-clamp-2">
            {item.answer || '-'}
          </TableCell>
          <TableCell className="p-3 text-right whitespace-nowrap">
            <Button variant="ghost" size="sm" onClick={() => handleEdit(item)}>
              <Pencil className="size-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(item.id)}>
              <Trash2 className="size-4 text-destructive" />
            </Button>
          </TableCell>
        </TableRow>
      )}
      dialog={
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editing ? t('编辑现场问答题') : t('新增现场问答题')}</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleSubmit()
              }}
              className="grid gap-4"
            >
              <div className="space-y-4">
              <FormFieldRow label={t('题目名称')} required>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('输入题目名称')}
                />
              </FormFieldRow>
              <FormFieldRow label={t('适用专业')}>
                <Select value={majorId} onValueChange={setMajorId}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('选择适用专业')} />
                  </SelectTrigger>
                  <SelectContent>
                    {majors.map((m: any) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormFieldRow>
              <FormFieldRow label={t('题目描述')}>
                <Textarea
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder={t('输入题目描述')}
                  rows={3}
                />
              </FormFieldRow>
              <FormFieldRow label={t('题目答案')}>
                <Textarea
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder={t('输入题目答案')}
                  rows={3}
                />
              </FormFieldRow>
              <FormFieldRow label={t('标签')}>
                <TagPicker value={tagIds} onChange={setTagIds} />
              </FormFieldRow>
              </div>
              <FormDialogFooter
                onCancel={() => setDialogOpen(false)}
                confirmDisabled={!name.trim()}
              />
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
