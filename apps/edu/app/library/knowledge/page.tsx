"use client"

import { useCallback, useEffect, useState } from "react"
import { Pencil, Plus, Search, Trash2, BookOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { knowledgeApi, courseApi } from "@/lib/api"
import type { KnowledgePoint } from "@/lib/types/lesson"
import { useToast } from "@/hooks/use-toast"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import {
  KnowledgePointFormDialog,
  type KnowledgePointFormValues,
} from "@/components/shared/knowledge-point-form-dialog"
import type { GranularLessonOption } from "@/components/shared/granular-lesson-select-dialog"

export default function KnowledgePointsPage() {
  const { toast } = useToast()
  const [items, setItems] = useState<KnowledgePoint[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<KnowledgePoint | null>(null)
  const [dialogMode, setDialogMode] = useState<"add" | "edit">("add")
  const [linked, setLinked] = useState(false)
  const [granularCourses, setGranularCourses] = useState<GranularLessonOption[]>([])
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [navigateCourseId, setNavigateCourseId] = useState<string | null>(null)

  const loadItems = useCallback(async () => {
    setLoading(true)
    try {
      const params: any = { limit: 500 }
      if (searchQuery) params.search = searchQuery
      const res = await knowledgeApi.list(params)
      setItems(res.items)
    } catch (err: any) {
      toast({ variant: "destructive", title: "加载失败", description: err.message })
    } finally { setLoading(false) }
  }, [searchQuery, toast])

  const loadGranularCourses = async () => {
    try {
      const res = await courseApi.list({ type: "granular", limit: 1000 })
      setGranularCourses(
        res.items.map((c) => ({
          id: c.id,
          name: c.name,
          code: c.code,
          description: c.description || undefined,
        }))
      )
    } catch {
      setGranularCourses([])
    }
  }

  useEffect(() => { loadItems() }, [loadItems])
  useEffect(() => { loadGranularCourses() }, [])

  const handleOpenAdd = () => {
    setEditingItem(null)
    setDialogMode("add")
    setLinked(false)
    setIsDialogOpen(true)
  }

  const handleOpenEdit = (item: KnowledgePoint) => {
    setEditingItem(item)
    setDialogMode("edit")
    setLinked(item.linked)
    setIsDialogOpen(true)
  }

  const handleDelete = (id: string) => { setDeleteTarget(id) }
  const confirmDelete = async () => { if (!deleteTarget) return; try { await knowledgeApi.delete(deleteTarget); toast({ title: "删除成功" }); loadItems() } catch (err: any) { toast({ variant: "destructive", title: "删除失败", description: err.message }) } finally { setDeleteTarget(null) } }

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
        toast({ title: "更新成功" })
      } else {
        await knowledgeApi.create({
          name: values.name,
          code: values.code || undefined,
          description: values.description || undefined,
          linked,
          granularLessonIds: values.granularLessonIds,
        } as any)
        toast({ title: "创建成功" })
      }
      setIsDialogOpen(false)
      loadItems()
      loadGranularCourses()
    } catch (err: any) {
      toast({ variant: "destructive", title: "保存失败", description: err.message })
    }
  }

  const handleCreateGranularLesson = async (): Promise<string | undefined> => {
    const baseName = editingItem?.name || "新建颗粒课"
    try {
      const created = await courseApi.create({
        name: `基于「${baseName}」的颗粒课`,
        type: "granular",
        category: "专业基础",
      } as any)
      const newCourseId = created.id
      setGranularCourses((prev) => [
        ...prev,
        {
          id: newCourseId,
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
          granularLessonIds: [...(editingItem.granularLessonIds || []), newCourseId],
        } as any)
        loadItems()
      }
      setNavigateCourseId(newCourseId)
      return newCourseId
    } catch (err: any) {
      toast({ variant: "destructive", title: "创建颗粒课失败", description: err.message })
      return undefined
    }
  }

  return (
    <div className="p-6 space-y-5">
      <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-50 to-blue-100">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center"><BookOpen className="size-5 text-blue-600" /></div>
          <div><div className="text-2xl font-bold text-blue-700">{items.length}</div><div className="text-xs text-blue-500">知识点总数</div></div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base font-semibold">知识点管理</CardTitle>
          <Button onClick={handleOpenAdd} size="sm"><Plus className="size-4 mr-1" />新增知识点</Button>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input placeholder="搜索知识点..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10" />
            </div>
            {searchQuery && <Button variant="ghost" size="sm" onClick={() => setSearchQuery("")}>清除</Button>}
          </div>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50">
                  <TableHead className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">名称</TableHead>
                  <TableHead className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">编码</TableHead>
                  <TableHead className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">描述</TableHead>
                  <TableHead className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">关联课程</TableHead>
                  <TableHead className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && <TableRow><TableCell colSpan={5} className="p-12 text-center text-muted-foreground">加载中...</TableCell></TableRow>}
                {!loading && items.length === 0 && <TableRow><TableCell colSpan={5} className="p-12 text-center text-muted-foreground">暂无数据</TableCell></TableRow>}
                {items.map(item => (
                  <TableRow key={item.id} className="hover:bg-slate-50/50">
                    <TableCell className="p-3"><div className="flex items-center gap-2"><BookOpen className="size-4 text-blue-500" /><span className="text-sm font-medium text-slate-700">{item.name}</span></div></TableCell>
                    <TableCell className="p-3 text-sm text-slate-400">{item.code || "-"}</TableCell>
                    <TableCell className="p-3 text-sm text-slate-400 hidden md:table-cell max-w-[300px] truncate">{item.description || "-"}</TableCell>
                    <TableCell className="p-3 text-sm text-slate-400 hidden md:table-cell">{item.granularLessonIds?.length || 0} 门</TableCell>
                    <TableCell className="p-3 text-right whitespace-nowrap">
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
        description="确定要删除该知识点吗？此操作不可恢复。"
        confirmText="删除"
        variant="destructive"
        onConfirm={confirmDelete}
      />
      <ConfirmDialog
        open={navigateCourseId !== null}
        onOpenChange={(open) => { if (!open) setNavigateCourseId(null) }}
        title="前往完善"
        description="占位颗粒课已创建并关联，是否立即前往完善？"
        confirmText="前往"
        onConfirm={() => {
          if (navigateCourseId) {
            window.open(`/lesson/admin/granular/add?id=${navigateCourseId}`, "_blank")
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
                description: editingItem.description || "",
                code: editingItem.code || "",
                granularLessonIds: editingItem.granularLessonIds || [],
              }
            : undefined
        }
        granularCourses={granularCourses}
        onSave={handleSave}
        onCreateGranularLesson={handleCreateGranularLesson}
      />
    </div>
  )
}
