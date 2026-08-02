'use client'

import { useEffect, useState } from 'react'
import { Pencil, Trash2, BookOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import { knowledgeApi, courseApi } from '@/lib/api'
import type { KnowledgePoint } from '@/lib/types/lesson'
import { useToast } from '@zhiyu/ui'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { LibraryPageShell } from '../_components/library-page-shell'
import {
  KnowledgePointFormDialog,
  type KnowledgePointFormValues,
} from '@/components/shared/knowledge-point-form-dialog'
import type { GranularLessonOption } from '@/components/shared/granular-lesson-select-dialog'
import { useLibraryCrud } from '../_components/use-library-crud'

export default function KnowledgePointsPage() {
  const { toast } = useToast()
  const { items, loading, searchQuery, setSearchQuery, loadItems } = useLibraryCrud(
    knowledgeApi.list,
  )
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<KnowledgePoint | null>(null)
  const [dialogMode, setDialogMode] = useState<'add' | 'edit'>('add')
  const [linked, setLinked] = useState(false)
  const [granularCourses, setGranularCourses] = useState<GranularLessonOption[]>([])
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [navigateCourseId, setNavigateCourseId] = useState<string | null>(null)

  const loadGranularCourses = async () => {
    try {
      const res = await courseApi.list({ type: 'granular', limit: 1000 })
      setGranularCourses(
        res.items.map((c) => ({
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
  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await knowledgeApi.delete(deleteTarget)
      toast({ title: '删除成功' })
      loadItems()
    } catch (err: any) {
      toast({ variant: 'destructive', title: '删除失败', description: err.message })
    } finally {
      setDeleteTarget(null)
    }
  }

  const handleSave = async (values: KnowledgePointFormValues) => {
    try {
      if (editingItem) {
        await knowledgeApi.update(editingItem.id, {
          name: values.name,
          code: values.code || undefined,
          description: values.description || undefined,
          linked,
          granularLessonIds: values.granularLessonIds,
        } as any)
        toast({ title: '更新成功' })
      } else {
        await knowledgeApi.create({
          name: values.name,
          code: values.code || undefined,
          description: values.description || undefined,
          linked,
          granularLessonIds: values.granularLessonIds,
        } as any)
        toast({ title: '创建成功' })
      }
      setIsDialogOpen(false)
      loadItems()
      loadGranularCourses()
    } catch (err: any) {
      toast({ variant: 'destructive', title: '保存失败', description: err.message })
    }
  }

  const handleCreateGranularLesson = async (): Promise<string | undefined> => {
    const baseName = editingItem?.name || '新建颗粒课'
    try {
      const created = await courseApi.create({
        name: `基于「${baseName}」的颗粒课`,
        type: 'granular',
        category: '专业基础',
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
      toast({ variant: 'destructive', title: '创建颗粒课失败', description: err.message })
      return undefined
    }
  }

  return (
    <>
      <LibraryPageShell
        title="知识点管理"
        statLabel="知识点总数"
        statIcon={
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <BookOpen className="size-5 text-blue-600" />
          </div>
        }
        statGradient="from-blue-50 to-blue-100"
        statCount={items.length}
        searchPlaceholder="搜索知识点..."
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onAdd={handleOpenAdd}
        addLabel="新增知识点"
        loading={loading}
        items={items}
        deleteTarget={deleteTarget}
        onDeleteCancel={() => setDeleteTarget(null)}
        onDeleteConfirm={confirmDelete}
        deleteLabel="知识点"
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
            <TableHead className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">
              关联课程
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
                <BookOpen className="size-4 text-blue-500" />
                <span className="text-sm font-medium text-slate-700">{item.name}</span>
              </div>
            </TableCell>
            <TableCell className="p-3 text-sm text-slate-400">{item.code || '-'}</TableCell>
            <TableCell className="p-3 text-sm text-slate-400 hidden md:table-cell max-w-[300px] truncate">
              {item.description || '-'}
            </TableCell>
            <TableCell className="p-3 text-sm text-slate-400 hidden md:table-cell">
              {item.granularLessonIds?.length || 0} 门
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
      />
      <ConfirmDialog
        open={navigateCourseId !== null}
        onOpenChange={(open) => {
          if (!open) setNavigateCourseId(null)
        }}
        title="前往完善"
        description="占位颗粒课已创建并关联，是否立即前往完善？"
        confirmText="前往"
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
