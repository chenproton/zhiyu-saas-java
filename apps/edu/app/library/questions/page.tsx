"use client"

import { useCallback, useEffect, useState } from "react"
import { Pencil, Plus, Search, Trash2, MessageSquare } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { onSiteQuestionLibraryApi } from "@/lib/api"
import type { OnSiteQuestionLibraryItem } from "@/lib/types/library"
import { useToast } from "@zhiyu/ui"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"

const QUESTION_TYPE_LABELS: Record<string, string> = { short_answer: "简答", essay: "论述", oral: "口答", practice: "实操" }
const DIFFICULTY: Record<string, { label: string; color: string }> = {
  easy: { label: "简单", color: "bg-emerald-100 text-emerald-700" },
  medium: { label: "中等", color: "bg-amber-100 text-amber-700" },
  hard: { label: "困难", color: "bg-red-100 text-red-700" },
}

export default function OnSiteQuestionsPage() {
  const { toast } = useToast()
  const [items, setItems] = useState<OnSiteQuestionLibraryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState("")
  const [difficultyFilter, setDifficultyFilter] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<OnSiteQuestionLibraryItem | null>(null)
  const [questionText, setQuestionText] = useState("")
  const [answer, setAnswer] = useState("")
  const [questionType, setQuestionType] = useState("short_answer")
  const [score, setScore] = useState("0")
  const [difficulty, setDifficulty] = useState("medium")
  const [tags, setTags] = useState("")
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const loadItems = useCallback(async () => {
    setLoading(true)
    try {
      const params: any = { limit: 500 }
      if (searchQuery) params.search = searchQuery
      if (typeFilter) params.questionType = typeFilter
      if (difficultyFilter) params.difficulty = difficultyFilter
      const res = await onSiteQuestionLibraryApi.list(params)
      setItems(res.items)
    } catch (err: any) { toast({ variant: "destructive", title: "加载失败", description: err.message }) }
    finally { setLoading(false) }
  }, [searchQuery, typeFilter, difficultyFilter, toast])
  useEffect(() => { loadItems() }, [loadItems])

  const handleOpenAdd = () => { setEditingItem(null); setQuestionText(""); setAnswer(""); setQuestionType("short_answer"); setScore("0"); setDifficulty("medium"); setTags(""); setIsDialogOpen(true) }
  const handleOpenEdit = (item: OnSiteQuestionLibraryItem) => { setEditingItem(item); setQuestionText(item.questionText); setAnswer(item.answer || ""); setQuestionType(item.questionType); setScore(String(item.score)); setDifficulty(item.difficulty || "medium"); setTags(item.tags?.join(", ") || ""); setIsDialogOpen(true) }
  const handleDelete = (id: string) => { setDeleteTarget(id) }
  const confirmDelete = async () => { if (!deleteTarget) return; try { await onSiteQuestionLibraryApi.delete(deleteTarget); toast({ title: "删除成功" }); loadItems() } catch (err: any) { toast({ variant: "destructive", title: "删除失败", description: err.message }) } finally { setDeleteTarget(null) } }
  const handleSubmit = async () => {
    if (!questionText.trim()) { toast({ variant: "destructive", title: "题目内容不能为空" }); return }
    const tagList = tags ? tags.split(",").map(s => s.trim()).filter(Boolean) : []
    try {
      const payload = { questionText: questionText.trim(), answer: answer.trim() || undefined, questionType, score: parseFloat(score) || 0, difficulty: difficulty || undefined, tags: tagList.length > 0 ? tagList : undefined }
      if (editingItem) { await onSiteQuestionLibraryApi.update(editingItem.id, payload as any); toast({ title: "更新成功" }) }
      else { await onSiteQuestionLibraryApi.create(payload as any); toast({ title: "创建成功" }) }
      setIsDialogOpen(false); loadItems()
    } catch (err: any) { toast({ variant: "destructive", title: "保存失败", description: err.message }) }
  }

  return (
    <div className="p-6 space-y-5">
      <Card className="border-0 shadow-sm bg-gradient-to-br from-amber-50 to-amber-100">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center"><MessageSquare className="size-5 text-amber-600" /></div>
          <div><div className="text-2xl font-bold text-amber-700">{items.length}</div><div className="text-xs text-amber-500">题目总数</div></div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base font-semibold">现场问答题库</CardTitle>
          <Button onClick={handleOpenAdd} size="sm"><Plus className="size-4 mr-1" />新增题目</Button>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 mb-4">
            <div className="relative flex-1 max-w-sm"><Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" /><Input placeholder="搜索题目..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10" /></div>
            <Select value={typeFilter} onValueChange={v => setTypeFilter(v === "all" ? "" : v)}>
              <SelectTrigger className="w-28"><SelectValue placeholder="题型" /></SelectTrigger>
              <SelectContent><SelectItem value="all">全部</SelectItem>{Object.entries(QUESTION_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={difficultyFilter} onValueChange={v => setDifficultyFilter(v === "all" ? "" : v)}>
              <SelectTrigger className="w-28"><SelectValue placeholder="难度" /></SelectTrigger>
              <SelectContent><SelectItem value="all">全部</SelectItem>{Object.entries(DIFFICULTY).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
            </Select>
            {(searchQuery || typeFilter || difficultyFilter) && <Button variant="ghost" size="sm" onClick={() => { setSearchQuery(""); setTypeFilter(""); setDifficultyFilter("") }}>清除</Button>}
          </div>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50">
                  <TableHead className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">题目</TableHead>
                  <TableHead className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">题型</TableHead>
                  <TableHead className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">难度</TableHead>
                  <TableHead className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">分数</TableHead>
                  <TableHead className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">标签</TableHead>
                  <TableHead className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && <TableRow><TableCell colSpan={6} className="p-12 text-center text-muted-foreground">加载中...</TableCell></TableRow>}
                {!loading && items.length === 0 && <TableRow><TableCell colSpan={6} className="p-12 text-center text-muted-foreground">暂无数据</TableCell></TableRow>}
                {items.map(item => (
                  <TableRow key={item.id} className="hover:bg-slate-50/50">
                    <TableCell className="p-3"><div className="flex items-start gap-2"><MessageSquare className="size-4 text-amber-500 mt-0.5 shrink-0" /><span className="text-sm font-medium text-slate-700 line-clamp-2">{item.questionText}</span></div></TableCell>
                    <TableCell className="p-3"><Badge variant="outline" className="text-xs">{QUESTION_TYPE_LABELS[item.questionType] || item.questionType}</Badge></TableCell>
                    <TableCell className="p-3 hidden md:table-cell">{item.difficulty ? <span className={`px-2 py-0.5 rounded text-xs font-medium ${DIFFICULTY[item.difficulty]?.color || ""}`}>{DIFFICULTY[item.difficulty]?.label || item.difficulty}</span> : "-"}</TableCell>
                    <TableCell className="p-3 text-sm text-slate-400 hidden md:table-cell">{item.score}</TableCell>
                    <TableCell className="p-3 text-sm hidden lg:table-cell">{item.tags?.map(t => <Badge key={t} variant="secondary" className="mr-1 text-xs">{t}</Badge>)}</TableCell>
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
        description="确定要删除该题目吗？此操作不可恢复。"
        confirmText="删除"
        variant="destructive"
        onConfirm={confirmDelete}
      />
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editingItem ? "编辑题目" : "新增题目"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>题目内容 *</Label><Textarea value={questionText} onChange={e => setQuestionText(e.target.value)} placeholder="请输入题目内容" rows={4} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>题型</Label><Select value={questionType} onValueChange={setQuestionType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(QUESTION_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>难度</Label><Select value={difficulty} onValueChange={setDifficulty}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(DIFFICULTY).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>分数</Label><Input value={score} onChange={e => setScore(e.target.value)} placeholder="0" type="number" /></div>
              <div><Label>标签（逗号分隔）</Label><Input value={tags} onChange={e => setTags(e.target.value)} placeholder="安全, 操作规范" /></div>
            </div>
            <div><Label>参考答案</Label><Textarea value={answer} onChange={e => setAnswer(e.target.value)} placeholder="请输入参考答案" rows={3} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setIsDialogOpen(false)}>取消</Button><Button onClick={handleSubmit}>保存</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
