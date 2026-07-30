"use client"

import { useCallback, useEffect, useState } from "react"
import { Pencil, Trash2, MessageSquare } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { TableHead, TableCell, TableRow } from "@/components/ui/table"
import { randomDrawQuestionApi, majorApi } from "@/lib/api"
import { useToast } from "@zhiyu/ui"
import { LibraryPageShell } from "../_components/library-page-shell"

export default function QuestionsPage() {
  const { toast } = useToast()

  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)
  const [name, setName] = useState("")
  const [desc, setDesc] = useState("")
  const [answer, setAnswer] = useState("")
  const [majorId, setMajorId] = useState("")
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [majors, setMajors] = useState<any[]>([])
  const majorNameMap: Record<string, string> = {}
  majors.forEach((m: any) => { majorNameMap[m.id] = m.name })

  const loadItems = useCallback(async () => {
    setLoading(true)
    try {
      const params: any = { limit: 9999 }; if (searchQuery) params.search = searchQuery
      const res = await randomDrawQuestionApi.list(params)
      setItems(res.items || [])
    } catch (err: any) { toast({ variant: "destructive", title: "加载失败", description: err.message }) }
    finally { setLoading(false) }
  }, [searchQuery, toast])

  const loadMajors = useCallback(async () => {
    try {
      const res = await majorApi.list({ limit: 1000 })
      setMajors((res.items || []).map((m: any) => ({ id: m.id, name: m.name })))
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { loadMajors(); loadItems() }, [loadItems, loadMajors])

  const handleAdd = () => { setEditing(null); setName(""); setDesc(""); setAnswer(""); setMajorId(""); setDialogOpen(true) }
  const handleEdit = (item: any) => { setEditing(item); setName(item.name); setDesc(item.description || ""); setAnswer(item.answer || ""); setMajorId(item.majorId || ""); setDialogOpen(true) }
  const confirmDelete = async () => { if (!deleteTarget) return; try { await randomDrawQuestionApi.delete(deleteTarget); toast({ title: "删除成功" }); loadItems() } catch (err: any) { toast({ variant: "destructive", title: "删除失败", description: err.message }) } finally { setDeleteTarget(null) } }
  const handleSubmit = async () => {
    if (!name.trim()) { toast({ variant: "destructive", title: "题目名称不能为空" }); return }
    try {
      const payload = { name: name.trim(), description: desc.trim() || undefined, answer: answer.trim() || undefined, majorId: majorId || undefined }
      if (editing) { await randomDrawQuestionApi.update(editing.id, payload as any); toast({ title: "更新成功" }) }
      else { await randomDrawQuestionApi.create(payload as any); toast({ title: "创建成功" }) }
      setDialogOpen(false); loadItems()
    } catch (err: any) { toast({ variant: "destructive", title: "保存失败", description: err.message }) }
  }

  return (
    <LibraryPageShell
      title="现场问答题库"
      statLabel="题目总数"
      statIcon={<div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center"><MessageSquare className="size-5 text-blue-600" /></div>}
      statGradient="from-blue-50 to-blue-100"
      statCount={items.length}
      searchPlaceholder="搜索题目名称..."
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      onAdd={handleAdd}
      addLabel="新增现场问答题"
      loading={loading}
      items={items}
      deleteTarget={deleteTarget}
      onDeleteCancel={() => setDeleteTarget(null)}
      onDeleteConfirm={confirmDelete}
      deleteLabel="现场问答题"
      tableHeaders={<>
        <TableHead className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">题目名称</TableHead>
        <TableHead className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">题目描述</TableHead>
        <TableHead className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">适用专业</TableHead>
        <TableHead className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">答案</TableHead>
        <TableHead className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">操作</TableHead>
      </>}
      tableBody={(item: any) => (
        <TableRow key={item.id} className="hover:bg-slate-50/50">
          <TableCell className="p-3"><span className="text-sm font-medium text-slate-700">{item.name}</span></TableCell>
          <TableCell className="p-3"><span className="text-xs text-slate-500 line-clamp-2">{item.description || "-"}</span></TableCell>
          <TableCell className="p-3 hidden md:table-cell"><Badge variant="secondary" className="text-xs">{item.majorName || majorNameMap[item.majorId] || "-"}</Badge></TableCell>
          <TableCell className="p-3 text-xs text-slate-400 hidden md:table-cell line-clamp-2">{item.answer || "-"}</TableCell>
          <TableCell className="p-3 text-right whitespace-nowrap">
            <Button variant="ghost" size="sm" onClick={() => handleEdit(item)}><Pencil className="size-4" /></Button>
            <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(item.id)}><Trash2 className="size-4 text-destructive" /></Button>
          </TableCell>
        </TableRow>
      )}
      dialog={
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{editing ? "编辑现场问答题" : "新增现场问答题"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>题目名称 *</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="输入题目名称" /></div>
              <div>
                <Label>适用专业</Label>
                <Select value={majorId} onValueChange={setMajorId}>
                  <SelectTrigger><SelectValue placeholder="选择适用专业" /></SelectTrigger>
                  <SelectContent>{majors.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>题目描述</Label><Textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="输入题目描述" rows={3} /></div>
              <div><Label>题目答案</Label><Textarea value={answer} onChange={e => setAnswer(e.target.value)} placeholder="输入题目答案" rows={3} /></div>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button><Button onClick={handleSubmit} disabled={!name.trim()}>保存</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      }
    />
  )
}
