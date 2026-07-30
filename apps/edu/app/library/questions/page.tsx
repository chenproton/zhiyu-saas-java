"use client"

import { useCallback, useEffect, useState } from "react"
import { Pencil, Trash2, MessageSquare, FileQuestion } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TableHead, TableCell, TableRow } from "@/components/ui/table"
import { onSiteQuestionLibraryApi, randomDrawQuestionApi, majorApi } from "@/lib/api"
import type { OnSiteQuestionLibraryItem } from "@/lib/types/library"
import { useToast } from "@zhiyu/ui"
import { LibraryPageShell } from "../_components/library-page-shell"

const QUESTION_TYPE_LABELS: Record<string, string> = { short_answer: "简答", essay: "论述", oral: "口答", practice: "实操" }
const DIFFICULTY: Record<string, { label: string; color: string }> = {
  easy: { label: "简单", color: "bg-emerald-100 text-emerald-700" },
  medium: { label: "中等", color: "bg-amber-100 text-amber-700" },
  hard: { label: "困难", color: "bg-red-100 text-red-700" },
}

export default function QuestionsPage() {
  const { toast } = useToast()
  const [tab, setTab] = useState<"onsite" | "random_draw">("onsite")

  // --- onSiteQuestionLibrary state ---
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
      const params: any = { limit: 500 }; if (searchQuery) params.search = searchQuery; if (typeFilter) params.questionType = typeFilter; if (difficultyFilter) params.difficulty = difficultyFilter
      const res = await onSiteQuestionLibraryApi.list(params); setItems(res.items)
    } catch (err: any) { toast({ variant: "destructive", title: "加载失败", description: err.message }) }
    finally { setLoading(false) }
  }, [searchQuery, typeFilter, difficultyFilter, toast])
  useEffect(() => { ;(async () => { await loadItems() })() }, [loadItems])

  const handleOpenAdd = () => { setEditingItem(null); setQuestionText(""); setAnswer(""); setQuestionType("short_answer"); setScore("0"); setDifficulty("medium"); setTags(""); setIsDialogOpen(true) }
  const handleOpenEdit = (item: OnSiteQuestionLibraryItem) => { setEditingItem(item); setQuestionText(item.questionText); setAnswer(item.answer || ""); setQuestionType(item.questionType); setScore(String(item.score)); setDifficulty(item.difficulty || "medium"); setTags(item.tags?.join(", ") || ""); setIsDialogOpen(true) }
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

  // --- randomDrawQuestion state ---
  const [rdqItems, setRdqItems] = useState<any[]>([])
  const [rdqLoading, setRdqLoading] = useState(false)
  const [rdqSearch, setRdqSearch] = useState("")
  const [rdqDialogOpen, setRdqDialogOpen] = useState(false)
  const [rdqEditing, setRdqEditing] = useState<any | null>(null)
  const [rdqName, setRdqName] = useState("")
  const [rdqDesc, setRdqDesc] = useState("")
  const [rdqAnswer, setRdqAnswer] = useState("")
  const [rdqMajorId, setRdqMajorId] = useState("")
  const [rdqDeleteTarget, setRdqDeleteTarget] = useState<string | null>(null)
  const [majors, setMajors] = useState<any[]>([])
  const majorNameMap: Record<string, string> = {}
  majors.forEach((m: any) => { majorNameMap[m.id] = m.name })

  const loadRdq = useCallback(async () => {
    setRdqLoading(true)
    try {
      const res = await randomDrawQuestionApi.list({ limit: 9999, search: rdqSearch || undefined })
      setRdqItems(res.items || [])
    } catch (err: any) { toast({ variant: "destructive", title: "加载失败", description: err.message }) }
    finally { setRdqLoading(false) }
  }, [rdqSearch, toast])

  const loadMajors = useCallback(async () => {
    try {
      const res = await majorApi.list({ limit: 1000 })
      setMajors((res.items || []).map((m: any) => ({ id: m.id, name: m.name })))
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { if (tab === "random_draw") { loadMajors(); loadRdq() } }, [tab, loadRdq, loadMajors])

  const handleRdqAdd = () => { setRdqEditing(null); setRdqName(""); setRdqDesc(""); setRdqAnswer(""); setRdqMajorId(""); setRdqDialogOpen(true) }
  const handleRdqEdit = (item: any) => { setRdqEditing(item); setRdqName(item.name); setRdqDesc(item.description || ""); setRdqAnswer(item.answer || ""); setRdqMajorId(item.majorId || ""); setRdqDialogOpen(true) }
  const handleRdqDelete = async () => { if (!rdqDeleteTarget) return; try { await randomDrawQuestionApi.delete(rdqDeleteTarget); toast({ title: "删除成功" }); loadRdq() } catch (err: any) { toast({ variant: "destructive", title: "删除失败", description: err.message }) } finally { setRdqDeleteTarget(null) } }
  const handleRdqSubmit = async () => {
    if (!rdqName.trim()) { toast({ variant: "destructive", title: "题目名称不能为空" }); return }
    try {
      const payload = { name: rdqName.trim(), description: rdqDesc.trim() || undefined, answer: rdqAnswer.trim() || undefined, majorId: rdqMajorId || undefined }
      if (rdqEditing) { await randomDrawQuestionApi.update(rdqEditing.id, payload as any); toast({ title: "更新成功" }) }
      else { await randomDrawQuestionApi.create(payload as any); toast({ title: "创建成功" }) }
      setRdqDialogOpen(false); loadRdq()
    } catch (err: any) { toast({ variant: "destructive", title: "保存失败", description: err.message }) }
  }

  const count = tab === "onsite" ? items.length : rdqItems.length

  return (
    <div className="p-6 space-y-5">
      <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl border-0 shadow-sm p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center"><MessageSquare className="size-5 text-amber-600" /></div>
        <div><div className="text-2xl font-bold">{count}</div><div className="text-xs opacity-70">题目总数</div></div>
      </div>

      <div className="border-0 shadow-sm rounded-xl bg-white">
        <div className="flex items-center gap-4 px-4 pt-4 pb-0 border-b">
          <Tabs value={tab} onValueChange={v => setTab(v as "onsite" | "random_draw")}>
            <TabsList>
              <TabsTrigger value="onsite">现场问答题库</TabsTrigger>
              <TabsTrigger value="random_draw">现场问答题</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {tab === "onsite" ? (
          <LibraryPageShell
            title=""
            statLabel="题目总数"
            statIcon={<div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center"><MessageSquare className="size-5 text-amber-600" /></div>}
            statGradient="from-amber-50 to-amber-100"
            statCount={items.length}
            searchPlaceholder="搜索题目..."
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onAdd={handleOpenAdd}
            addLabel="新增题目"
            loading={loading}
            items={items}
            deleteTarget={deleteTarget}
            onDeleteCancel={() => setDeleteTarget(null)}
            onDeleteConfirm={confirmDelete}
            deleteLabel="题目"
            tableHeaders={<>
              <TableHead className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">题目</TableHead>
              <TableHead className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">题型</TableHead>
              <TableHead className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">难度</TableHead>
              <TableHead className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">分数</TableHead>
              <TableHead className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">标签</TableHead>
              <TableHead className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">操作</TableHead>
            </>}
            tableBody={(item) => (
              <TableRow key={item.id} className="hover:bg-slate-50/50">
                <TableCell className="p-3"><div className="flex items-start gap-2"><MessageSquare className="size-4 text-amber-500 mt-0.5 shrink-0" /><span className="text-sm font-medium text-slate-700 line-clamp-2">{item.questionText}</span></div></TableCell>
                <TableCell className="p-3"><Badge variant="outline" className="text-xs">{QUESTION_TYPE_LABELS[item.questionType] || item.questionType}</Badge></TableCell>
                <TableCell className="p-3 hidden md:table-cell">{item.difficulty ? <span className={`px-2 py-0.5 rounded text-xs font-medium ${DIFFICULTY[item.difficulty]?.color || ""}`}>{DIFFICULTY[item.difficulty]?.label || item.difficulty}</span> : "-"}</TableCell>
                <TableCell className="p-3 text-sm text-slate-400 hidden md:table-cell">{item.score}</TableCell>
                <TableCell className="p-3 text-sm hidden lg:table-cell">{item.tags?.map(t => <Badge key={t} variant="secondary" className="mr-1 text-xs">{t}</Badge>)}</TableCell>
                <TableCell className="p-3 text-right whitespace-nowrap">
                  <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(item)}><Pencil className="size-4" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(item.id)}><Trash2 className="size-4 text-destructive" /></Button>
                </TableCell>
              </TableRow>
            )}
            dialog={
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
            }
          >
            <div className="flex gap-3">
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
          </LibraryPageShell>
        ) : (
          <LibraryPageShell
            title=""
            statLabel="题目总数"
            statIcon={<div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center"><FileQuestion className="size-5 text-blue-600" /></div>}
            statGradient="from-blue-50 to-blue-100"
            statCount={rdqItems.length}
            searchPlaceholder="搜索现场问答题名称..."
            searchQuery={rdqSearch}
            onSearchChange={setRdqSearch}
            onAdd={handleRdqAdd}
            addLabel="新增现场问答题"
            loading={rdqLoading}
            items={rdqItems}
            deleteTarget={rdqDeleteTarget}
            onDeleteCancel={() => setRdqDeleteTarget(null)}
            onDeleteConfirm={handleRdqDelete}
            deleteLabel="现场问答题"
            tableHeaders={<>
              <TableHead className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">题目名称</TableHead>
              <TableHead className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">题目描述</TableHead>
              <TableHead className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">适用专业</TableHead>
              <TableHead className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">答案</TableHead>
              <TableHead className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">操作</TableHead>
            </>}
            tableBody={(rdq: any) => (
              <TableRow key={rdq.id} className="hover:bg-slate-50/50">
                <TableCell className="p-3"><span className="text-sm font-medium text-slate-700">{rdq.name}</span></TableCell>
                <TableCell className="p-3"><span className="text-xs text-slate-500 line-clamp-2">{rdq.description || "-"}</span></TableCell>
                <TableCell className="p-3 hidden md:table-cell"><Badge variant="secondary" className="text-xs">{rdq.majorName || majorNameMap[rdq.majorId] || "-"}</Badge></TableCell>
                <TableCell className="p-3 text-xs text-slate-400 hidden md:table-cell line-clamp-2">{rdq.answer || "-"}</TableCell>
                <TableCell className="p-3 text-right whitespace-nowrap">
                  <Button variant="ghost" size="sm" onClick={() => handleRdqEdit(rdq)}><Pencil className="size-4" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => setRdqDeleteTarget(rdq.id)}><Trash2 className="size-4 text-destructive" /></Button>
                </TableCell>
              </TableRow>
            )}
            dialog={
              <Dialog open={rdqDialogOpen} onOpenChange={setRdqDialogOpen}>
                <DialogContent className="max-w-lg">
                  <DialogHeader><DialogTitle>{rdqEditing ? "编辑现场问答题" : "新增现场问答题"}</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div><Label>题目名称 *</Label><Input value={rdqName} onChange={e => setRdqName(e.target.value)} placeholder="输入题目名称" /></div>
                    <div>
                      <Label>适用专业</Label>
                      <Select value={rdqMajorId} onValueChange={setRdqMajorId}>
                        <SelectTrigger><SelectValue placeholder="选择适用专业" /></SelectTrigger>
                        <SelectContent>{majors.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label>题目描述</Label><Textarea value={rdqDesc} onChange={e => setRdqDesc(e.target.value)} placeholder="输入题目描述" rows={3} /></div>
                    <div><Label>题目答案</Label><Textarea value={rdqAnswer} onChange={e => setRdqAnswer(e.target.value)} placeholder="输入题目答案" rows={3} /></div>
                  </div>
                  <DialogFooter><Button variant="outline" onClick={() => setRdqDialogOpen(false)}>取消</Button><Button onClick={handleRdqSubmit} disabled={!rdqName.trim()}>保存</Button></DialogFooter>
                </DialogContent>
              </Dialog>
            }
          />
        )}
      </div>
    </div>
  )
}
