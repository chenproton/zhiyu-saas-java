'use client'

import { useEffect, useState } from 'react'
import { Pencil, Trash2, BookOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TableRow, TableHead, TableCell } from '@/components/ui/table'
import { knowledgeApi, courseApi } from '@/lib/api'
import { fetchAllPages } from '@/lib/fetch-all'
import type { KnowledgePoint } from '@/lib/types/lesson'
import { useToast } from '@zhiyu/ui'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { TagBadge } from '@/components/shared/tag-badge'
import { TagFilterBar } from '@/components/shared/tag-filter-bar'
import { useTagBindings } from '@/components/shared/use-tag-bindings'
import { TAG_RESOURCE_TYPES } from '@/lib/types/library'
import { LibraryPageShell } from '../_components/library-page-shell'
import { CitationStatsPanel } from '@/components/shared/citation-stats-panel'
import {
  KnowledgePointFormDialog,
  type KnowledgePointFormValues,
} from './_components/knowledge-point-form-dialog'
import type { GranularLessonOption } from './_components/granular-lesson-select-dialog'
import { useLibraryCrud } from '../_components/use-library-crud'
import { useT } from '@/lib/i18n/locale-provider'

export default function KnowledgePointsPage() {
  const t = useT()
  const { toast } = useToast()
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const { tagsByResource, loadBindings, saveTags } = useTagBindings(
    TAG_RESOURCE_TYPES.knowledge_point,
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
  } = useLibraryCrud(knowledgeApi.list, {
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
  const [editingItem, setEditingItem] = useState<KnowledgePoint | null>(null)
  const [dialogMode, setDialogMode] = useState<'add' | 'edit'>('add')
  const [linked, setLinked] = useState(false)
  const [granularCourses, setGranularCourses] = useState<GranularLessonOption[]>([])
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [navigateCourseId, setNavigateCourseId] = useState<string | null>(null)

  const loadGranularCourses = async () => {
    try {
      const res = await fetchAllPages((page, pageSize) => courseApi.list({ type: 'granular', limit: pageSize, offset: page * pageSize }))
      setGranularCourses(
        res.map((c) => ({
          id: c.id,
          name: c.name,
          code: c.code,
          description: c.description || undefined,
        })),
      )
    } catch {
      setGranularCourses([])
    }
  }

  useEffect(() => {
    ;(async () => {
      await loadGranularCourses()
    })()
  }, [])

  const handleOpenAdd = () => {
    setEditingItem(null)
    setDialogMode('add')
    setLinked(false)
    setIsDialogOpen(true)
  }
  const handleOpenEdit = (item: KnowledgePoint) => {
    setEditingItem(item)
    setDialogMode('edit')
    setLinked(item.linked)
    setIsDialogOpen(true)
  }
  const handleTagFilterChange = (tagIds: string[]) => {
    setSelectedTagIds(tagIds)
    setPage(1)
  }
  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await knowledgeApi.delete(deleteTarget)
      toast({ title: t('删除成功') })
      loadItems()
    } catch (err: any) {
      toast({ variant: 'destructive', title: t('删除失败'), description: err.message })
    } finally {
      setDeleteTarget(null)
    }
  }

  const handleSave = async (values: KnowledgePointFormValues) => {
    try {
      let savedId: string
      if (editingItem) {
        savedId = editingItem.id
        await knowledgeApi.update(editingItem.id, {
          name: values.name,
          code: values.code || undefined,
          description: values.description || undefined,
          linked,
          granularLessonIds: values.granularLessonIds,
        } as any)
        toast({ title: t('更新成功') })
      } else {
        const created = await knowledgeApi.create({
          name: values.name,
          code: values.code || undefined,
          description: values.description || undefined,
          linked,
          granularLessonIds: values.granularLessonIds,
        } as any)
        savedId = created.id
        toast({ title: t('创建成功') })
      }
      try {
        await saveTags(savedId, values.tagIds)
      } catch {
        toast({ variant: 'destructive', title: t('标签保存失败'), description: t('实体已保存，标签未关联，可再次保存重试') })
      }
      setIsDialogOpen(false)
      loadItems()
      loadGranularCourses()
    } catch (err: any) {
      toast({ variant: 'destructive', title: t('保存失败'), description: err.message })
    }
  }

  const handleCreateGranularLesson = async (): Promise<string | undefined> => {
    const baseName = editingItem?.name || t('新建颗粒课')
    try {
      const created = await courseApi.create({
        name: t('基于「{name}」的颗粒课', { name: baseName }),
        type: 'granular',
        category: t('专业基础'),
      } as any)
      setGranularCourses((prev) => [
        ...prev,
        {
          id: created.id,
          name: created.name,
          code: created.code,
          description: created.description || undefined,
        },
      ])
      if (editingItem) {
        await knowledgeApi.update(editingItem.id, {
          name: editingItem.name,
          code: editingItem.code || undefined,
          description: editingItem.description || undefined,
          linked: editingItem.linked,
          granularLessonIds: [...(editingItem.granularLessonIds || []), created.id],
        } as any)
        loadItems()
      }
      setNavigateCourseId(created.id)
      return created.id
    } catch (err: any) {
      toast({ variant: 'destructive', title: t('创建颗粒课失败'), description: err.message })
      return undefined
    }
  }

  return (
    <>
      <LibraryPageShell
        title={t('知识点管理')}
        statLabel={t('知识点总数')}
        statIcon={
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <BookOpen className="size-5 text-primary" />
          </div>
        }
        statGradient="from-primary/5 to-primary/10"
        statCount={total}
        statsExtra={
          <CitationStatsPanel
            entityLabel={t('知识点')}
            dialogTitle={t('零引用知识点')}
            fetchStats={() => knowledgeApi.citationStats()}
            fetchUncited={(params) => knowledgeApi.uncited(params)}
            deleteItem={(id) => knowledgeApi.delete(id)}
            onDeleted={loadItems}
            statCount={total}
            statLabel={t('知识点总数')}
            statIcon={<BookOpen className="size-5 text-primary" />}
          />
        }
        searchPlaceholder={t('搜索知识点...')}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onAdd={handleOpenAdd}
        addLabel={t('新建知识点')}
        loading={loading}
        items={items}
        deleteTarget={deleteTarget}
        onDeleteCancel={() => setDeleteTarget(null)}
        onDeleteConfirm={confirmDelete}
        deleteLabel={t('知识点')}
        tableHeaders={
          <>
            <TableHead className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {t('名称')}
            </TableHead>
            <TableHead className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {t('编码')}
            </TableHead>
            <TableHead className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">
              {t('描述')}
            </TableHead>
            <TableHead className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">
              {t('关联课程')}
            </TableHead>
            <TableHead className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">
              {t('标签')}
            </TableHead>
            <TableHead className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">
              {t('操作')}
            </TableHead>
          </>
        }
        tableBody={(item) => (
          <TableRow key={item.id} className="hover:bg-slate-50/50">
            <TableCell className="p-3">
              <div className="flex items-center gap-2">
                <BookOpen className="size-4 text-primary" />
                <span className="text-sm font-medium text-slate-700">{item.name}</span>
              </div>
            </TableCell>
            <TableCell className="p-3 text-sm text-slate-400">{item.code || '-'}</TableCell>
            <TableCell className="p-3 text-sm text-slate-400 hidden md:table-cell max-w-[300px] truncate">
              {item.description || '-'}
            </TableCell>
            <TableCell className="p-3 text-sm text-slate-400 hidden md:table-cell">
              {t('{n} 门', { n: item.granularLessonIds?.length || 0 })}
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
        dialog={<></>}
        pagination={{ page, totalPages, onPageChange: setPage }}
      >
        <TagFilterBar value={selectedTagIds} onChange={handleTagFilterChange} className="mb-4" />
      </LibraryPageShell>
      <ConfirmDialog
        open={navigateCourseId !== null}
        onOpenChange={(open) => {
          if (!open) setNavigateCourseId(null)
        }}
        title={t('前往完善')}
        description={t('占位颗粒课已创建并关联，是否立即前往完善？')}
        confirmText={t('前往')}
        onConfirm={() => {
          if (navigateCourseId) {
            window.open(`/lesson/admin/granular/add?id=${navigateCourseId}`, '_blank')
            setNavigateCourseId(null)
          }
        }}
      />
      <KnowledgePointFormDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        mode={dialogMode}
        initialValues={
          editingItem
            ? {
                name: editingItem.name,
                description: editingItem.description || '',
                code: editingItem.code || '',
                granularLessonIds: editingItem.granularLessonIds || [],
                tagIds: (tagsByResource[editingItem.id] || []).map((t) => t.id),
              }
            : undefined
        }
        granularCourses={granularCourses}
        onSave={handleSave}
        onCreateGranularLesson={handleCreateGranularLesson}
      />
    </>
  )
}
