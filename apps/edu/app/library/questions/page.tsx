"use client"

import { useEffect, useState } from "react"
import { Pencil, Plus, Search, Trash2, MessageSquare } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { onSiteQuestionLibraryApi } from "@/lib/api"
import type { OnSiteQuestionLibraryItem } from "@/lib/types/library"
import { useToast } from "@/hooks/use-toast"

const QUESTION_TYPE_LABELS: Record<string, string> = {
  short_answer: "简答题",
  essay: "论述题",
  oral: "口答题",
  practice: "实操题",
}

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: "简单",
  medium: "中等",
  hard: "困难",
}

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: "bg-green-100 text-green-700",
  medium: "bg-yellow-100 text-yellow-700",
  hard: "bg-red-100 text-red-700",
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

  const loadItems = async () => {
    setLoading(true)
    try {
      const params: any = { limit: 200 }
      if (searchQuery) params.search = searchQuery
      if (typeFilter) params.questionType = typeFilter
      if (difficultyFilter) params.difficulty = difficultyFilter
      const res = await onSiteQuestionLibraryApi.list(params)
      setItems(res.items)
    } catch (err: any) {
      toast({ variant: "destructive", title: "加载失败", description: err.message || "无法获取题目列表" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadItems() }, [searchQuery, typeFilter, difficultyFilter])

  const handleOpenAdd = () => {
    setEditingItem(null)
    setQuestionText("")
    setAnswer("")
    setQuestionType("short_answer")
    setScore("0")
    setDifficulty("medium")
    setTags("")
    setIsDialogOpen(true)
  }

  const handleOpenEdit = (item: OnSiteQuestionLibraryItem) => {
    setEditingItem(item)
    setQuestionText(item.questionText)
    setAnswer(item.answer || "")
    setQuestionType(item.questionType)
    setScore(String(item.score))
    setDifficulty(item.difficulty || "medium")
    setTags(item.tags?.join(", ") || "")
    setIsDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("确定要删除该题目吗？")) return
    try {
      await onSiteQuestionLibraryApi.delete(id)
      toast({ title: "删除成功" })
      loadItems()
    } catch (err: any) {
      toast({ variant: "destructive", title: "删除失败", description: err.message })
    }
  }

  const handleSubmit = async () => {
    if (!questionText.trim()) {
      toast({ variant: "destructive", title: "题目内容不能为空" })
      return
    }
    const tagList = tags ? tags.split(",").map((s) => s.trim()).filter(Boolean) : []
    const scoreNum = parseFloat(score) || 0
    try {
      if (editingItem) {
        await onSiteQuestionLibraryApi.update(editingItem.id, {
          questionText: questionText.trim(),
          answer: answer.trim() || undefined,
          questionType,
          score: scoreNum,
          difficulty: difficulty || undefined,
          tags: tagList.length > 0 ? tagList : undefined,
        } as any)
        toast({ title: "更新成功" })
      } else {
        await onSiteQuestionLibraryApi.create({
          questionText: questionText.trim(),
          answer: answer.trim() || undefined,
          questionType,
          score: scoreNum,
          difficulty: difficulty || undefined,
          tags: tagList.length > 0 ? tagList : undefined,
        } as any)
        toast({ title: "创建成功" })
      }
      setIsDialogOpen(false)
      loadItems()
    } catch (err: any) {
      toast({ variant: "destructive", title: "保存失败", description: err.message })
    }
  }

  return (
    <div className="p-6 space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">现场问答题库</CardTitle>
          <Button onClick={handleOpenAdd}>
            <Plus className="h-4 w-4 mr-1" />新增题目
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索题目内容..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v === "all" ? "" : v)}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="题型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部题型</SelectItem>
                {Object.entries(QUESTION_TYPE_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={difficultyFilter} onValueChange={(v) => setDifficultyFilter(v === "all" ? "" : v)}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="难度" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部难度</SelectItem>
                {Object.entries(DIFFICULTY_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="border rounded-lg">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 text-sm font-medium">题目内容</th>
                  <th className="text-left p-3 text-sm font-medium">题型</th>
                  <th className="text-left p-3 text-sm font-medium">难度</th>
                  <th className="text-left p-3 text-sm font-medium">分数</th>
                  <th className="text-left p-3 text-sm font-medium">标签</th>
                  <th className="text-right p-3 text-sm font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">加载中...</td></tr>
                )}
                {!loading && items.length === 0 && (
                  <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">暂无数据</td></tr>
                )}
                {items.map((item) => (
                  <tr key={item.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="line-clamp-2">{item.questionText}</span>
                      </div>
                    </td>
                    <td className="p-3">
                      <Badge variant="outline">{QUESTION_TYPE_LABELS[item.questionType] || item.questionType}</Badge>
                    </td>
                    <td className="p-3">
                      {item.difficulty ? (
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${DIFFICULTY_COLORS[item.difficulty] || ""}`}>
                          {DIFFICULTY_LABELS[item.difficulty] || item.difficulty}
                        </span>
                      ) : "-"}
                    </td>
                    <td className="p-3 text-sm">{item.score}</td>
                    <td className="p-3 text-sm">
                      {item.tags?.map((t) => (
                        <Badge key={t} variant="secondary" className="mr-1">{t}</Badge>
                      ))}
                    </td>
                    <td className="p-3 text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(item)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(item.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingItem ? "编辑题目" : "新增题目"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>题目内容 *</Label>
              <Textarea value={questionText} onChange={(e) => setQuestionText(e.target.value)} placeholder="请输入题目内容" rows={4} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>题型</Label>
                <Select value={questionType} onValueChange={setQuestionType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(QUESTION_TYPE_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>难度</Label>
                <Select value={difficulty} onValueChange={setDifficulty}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(DIFFICULTY_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>分数</Label>
                <Input value={score} onChange={(e) => setScore(e.target.value)} placeholder="0" type="number" />
              </div>
              <div>
                <Label>标签（逗号分隔）</Label>
                <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="例如：安全, 操作规范" />
              </div>
            </div>
            <div>
              <Label>参考答案</Label>
              <Textarea value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="请输入参考答案" rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>取消</Button>
            <Button onClick={handleSubmit}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
