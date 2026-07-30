"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Search, Plus, X, FileQuestion, ChevronDown, ChevronUp } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { randomDrawQuestionApi } from "@/lib/api"
import type { RandomDrawQuestion } from "@/lib/types"

interface RandomDrawResourcePanelProps {
  state: any
  updateState: (u: any) => void
  majors: any[]
  rdqSearch: string
  setRdqSearch: (v: string) => void
  rdqActionOpen: boolean
  setRdqActionOpen: (v: boolean) => void
  rdqActionMode: "add" | "edit" | null
  setRdqActionMode: (v: "add" | "edit" | null) => void
  rdqActionTarget: { id: string; name: string; description: string; answer: string } | null
  setRdqActionTarget: (v: { id: string; name: string; description: string; answer: string } | null) => void
  newRdqForm: { name: string; description: string; answer: string; majorId: string }
  setNewRdqForm: (v: { name: string; description: string; answer: string; majorId: string }) => void
  rdqDetailOpen: boolean
  setRdqDetailOpen: (v: boolean) => void
  selectedRdqForDetail: string | null
  setSelectedRdqForDetail: (v: string | null) => void
}

export function RandomDrawResourcePanel({
  state,
  updateState,
  majors,
  rdqSearch,
  setRdqSearch,
  rdqActionOpen,
  setRdqActionOpen,
  rdqActionMode,
  setRdqActionMode,
  rdqActionTarget,
  setRdqActionTarget,
  newRdqForm,
  setNewRdqForm,
  rdqDetailOpen,
  setRdqDetailOpen,
  selectedRdqForDetail,
  setSelectedRdqForDetail,
}: RandomDrawResourcePanelProps) {
  const majorOptions = useMemo(() => [{ id: "全部", name: "全部" }, ...majors.map((m: any) => ({ id: m.id, name: m.name }))], [majors])
  const majorNameMap = useMemo(() => {
    const map: Record<string, string> = {}
    majors.forEach((m: any) => { map[m.id] = m.name })
    return map
  }, [majors])
  const rdCfg = state.methodResourceConfigs.random_draw || {}
  const [rdqMajorTab, setRdqMajorTab] = useState("全部")
  const [rdqDrawMode, setRdqDrawMode] = useState<"random" | "manual">((rdCfg.drawMode as "random" | "manual") ?? "random")
  const [rdqDrawCount, setRdqDrawCount] = useState(rdCfg.drawCount ?? 5)

  useEffect(() => {
    ;(async () => {
      setRdqDrawMode((rdCfg.drawMode as "random" | "manual") ?? "random")
      setRdqDrawCount(rdCfg.drawCount ?? 5)
    })()
  }, [rdCfg.drawMode, rdCfg.drawCount])
  const [allQuestions, setAllQuestions] = useState<RandomDrawQuestion[]>([])
  const [loading, setLoading] = useState(true)

  const [submitFormatDesc, setSubmitFormatDesc] = useState<string>(rdCfg.submitFormatDesc || "")
  const [venueResources, setVenueResources] = useState<string>(rdCfg.venueResources || "")

  useEffect(() => {
    ;(async () => {
      setSubmitFormatDesc(rdCfg.submitFormatDesc || "")
      setVenueResources(rdCfg.venueResources || "")
    })()
  }, [rdCfg.submitFormatDesc, rdCfg.venueResources])

  const loadQuestions = useCallback(async () => {
    try {
      const res = await randomDrawQuestionApi.list({ limit: 9999 })
      setAllQuestions(res.items)
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  useEffect(() => {
    ;(async () => {
      await loadQuestions()
    })()
  }, [loadQuestions])

  const filteredRdq = allQuestions.filter(q => {
    const matchMajor = rdqMajorTab === "全部" || q.majorId === rdqMajorTab
    const matchSearch = !rdqSearch || q.name.includes(rdqSearch) || (q.description || "").includes(rdqSearch) || (q.majorName || "").includes(rdqSearch)
    return matchMajor && matchSearch
  })

  const handleAddRdq = () => {
    setNewRdqForm({ name: "", description: "", answer: "", majorId: "" })
    setRdqActionMode("add")
    setRdqActionTarget(null)
    setRdqActionOpen(true)
  }

  const handleEditRdq = (q: typeof allQuestions[0]) => {
    setNewRdqForm({ name: q.name, description: q.description || "", answer: q.answer || "", majorId: q.majorId || "" })
    setRdqActionMode("edit")
    setRdqActionTarget({ id: q.id, name: q.name, description: q.description || "", answer: q.answer || "" })
    setRdqActionOpen(true)
  }

  const handleSaveRdq = async () => {
    if (!newRdqForm.name.trim()) return
    try {
      if (rdqActionMode === "edit" && rdqActionTarget) {
        await randomDrawQuestionApi.update(rdqActionTarget.id, {
          name: newRdqForm.name.trim(),
          description: newRdqForm.description.trim() || undefined,
          answer: newRdqForm.answer.trim() || undefined,
          majorId: newRdqForm.majorId || undefined,
        } as any)
      } else {
        await randomDrawQuestionApi.create({
          name: newRdqForm.name.trim(),
          description: newRdqForm.description.trim() || undefined,
          answer: newRdqForm.answer.trim() || undefined,
          majorId: newRdqForm.majorId || undefined,
        } as any)
      }
      await loadQuestions()
    } catch { /* ignore */ }
    setRdqActionOpen(false)
    setRdqSearch("")
  }

  const handleDeleteRdq = async (id: string) => {
    try {
      await randomDrawQuestionApi.delete(id)
      updateState({ randomDrawSelectedIds: state.randomDrawSelectedIds.filter((sid: string) => sid !== id) })
      await loadQuestions()
    } catch { /* ignore */ }
  }

  const handleToggleSelect = (id: string) => {
    const isSelected = state.randomDrawSelectedIds.includes(id)
    if (isSelected) {
      updateState({ randomDrawSelectedIds: state.randomDrawSelectedIds.filter((sid: string) => sid !== id) })
    } else {
      updateState({ randomDrawSelectedIds: [...state.randomDrawSelectedIds, id] })
    }
  }

  const selectedRdqList = state.randomDrawSelectedIds.map((id: string) => allQuestions.find(q => q.id === id)).filter(Boolean) as typeof allQuestions

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input value={rdqSearch} onChange={e => setRdqSearch(e.target.value)} placeholder="搜索现场问答题名称、描述或适用专业..." className="pl-9" />
        </div>
        <Button onClick={handleAddRdq}>
          <Plus className="h-4 w-4 mr-1" />新增现场问答题
        </Button>
      </div>

      <div className="flex gap-4">
        {/* Left: All questions */}
        <div className="w-3/5 flex flex-col border rounded-xl p-3">
          <div className="flex items-center gap-1 mb-2 flex-wrap">
            {majorOptions.map(opt => (
              <button
                key={opt.id}
                onClick={() => setRdqMajorTab(opt.id)}
                className={cn(
                  "px-2.5 py-1 rounded-md text-[11px] transition-all",
                  rdqMajorTab === opt.id
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-gray-500 hover:bg-gray-100"
                )}
              >
                {opt.name}
              </button>
            ))}
          </div>
          <p className="text-sm font-medium mb-2 text-gray-700">
            {rdqSearch ? `搜索结果 (${filteredRdq.length})` : (rdqMajorTab === "全部" ? "全部现场问答题" : `${majorNameMap[rdqMajorTab] || rdqMajorTab}相关现场问答题`)}
          </p>
          <div className="min-h-[400px] overflow-y-auto pr-1">
            {loading ? (
              <div className="text-center text-gray-400 py-8">
                <p className="text-sm">加载中...</p>
              </div>
            ) : filteredRdq.length === 0 ? (
              <div className="text-center text-gray-400 py-8">
                <FileQuestion className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">{rdqSearch ? "未找到匹配的现场问答题" : "暂无现场问答题，请点击上方按钮新增"}</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th className="text-left text-xs font-medium text-gray-500 px-3 py-2 w-[26%]">题目名称</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-3 py-2 w-[30%]">题目描述</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-3 py-2 w-[14%]">适用专业</th>
                    <th className="text-right text-xs font-medium text-gray-500 px-3 py-2 w-[30%]">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredRdq.map(q => {
                    const isSelected = state.randomDrawSelectedIds.includes(q.id)
                    return (
                      <tr key={q.id} className={cn("hover:bg-gray-50 transition-colors", isSelected ? "bg-primary/[0.03]" : "")}>
                        <td className="px-3 py-2">
                          <span className="text-sm font-medium text-gray-800">{q.name}</span>
                        </td>
                        <td className="px-3 py-2">
                          <p className="text-xs text-gray-500 line-clamp-1" title={q.description}>{q.description || "-"}</p>
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant="secondary" className="text-[10px]">{q.majorName || "-"}</Badge>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="sm" className="h-6 text-[11px] px-1.5 text-gray-500 hover:text-primary" onClick={() => { setSelectedRdqForDetail(q.id); setRdqDetailOpen(true) }}>
                              详情
                            </Button>
                            <Button variant="ghost" size="sm" className="h-6 text-[11px] px-1.5 text-gray-500 hover:text-primary" onClick={() => handleEditRdq(q)}>
                              编辑
                            </Button>
                            {isSelected ? (
                              <Button size="sm" variant="outline" className="h-6 text-[11px] px-2" onClick={() => handleToggleSelect(q.id)}>
                                取消
                              </Button>
                            ) : (
                              <Button size="sm" className="h-6 text-[11px] px-2" onClick={() => handleToggleSelect(q.id)}>
                                选择
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" className="h-6 text-[11px] px-1.5 text-red-400 hover:text-red-600" onClick={() => handleDeleteRdq(q.id)}>
                              删除
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right: Selected questions */}
        <div className="w-2/5 border rounded-xl p-3 flex flex-col">
          <p className="text-sm font-medium mb-3 text-gray-700">已配置现场问答题 ({selectedRdqList.length})</p>
          <div className="min-h-[400px] overflow-y-auto">
            {selectedRdqList.length === 0 ? (
              <div className="text-center text-gray-400 py-8">
                <FileQuestion className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-xs">请从左侧选择现场问答题</p>
              </div>
            ) : (
              <div className="space-y-2">
                {selectedRdqList.map(q => (
                  <div key={q.id} className="p-2.5 rounded-lg border border-primary/20 bg-primary/5 relative">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium flex-1 truncate">{q.name}</span>
                      <Button variant="ghost" size="icon" className="h-5 w-5 text-gray-400 -mr-1 -mt-1" onClick={() => handleToggleSelect(q.id)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                    <p className="text-[11px] text-gray-500 line-clamp-1">{q.description || "暂无描述"}</p>
                    <Badge variant="outline" className="text-[9px] mt-1 font-normal px-1 py-0 h-4">{q.majorName || "通用"}</Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 抽题规则 */}
      <div className="border rounded-xl p-4 mt-4">
        <p className="text-sm font-medium mb-3">抽题规则</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-gray-500">抽题方式</Label>
            <Select value={rdqDrawMode} onValueChange={v => { const mode = v as "random" | "manual"; setRdqDrawMode(mode); updateState({ methodResourceConfigs: { ...state.methodResourceConfigs, random_draw: { ...rdCfg, drawMode: mode } } }) }}>
              <SelectTrigger className="mt-1 text-sm h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="random">系统随机分配</SelectItem>
                <SelectItem value="manual">老师手动选择</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-gray-500">抽题数量</Label>
            <Input type="number" value={rdqDrawCount} onChange={e => { const count = Math.max(1, parseInt(e.target.value) || 1); setRdqDrawCount(count); updateState({ methodResourceConfigs: { ...state.methodResourceConfigs, random_draw: { ...rdCfg, drawCount: count } } }) }} className="mt-1 text-sm" min={1} />
          </div>
        </div>
      </div>

      {/* 现场要求 */}
      <div className="border rounded-xl p-4 mt-4">
        <p className="text-sm font-medium mb-3">现场要求</p>
        <div className="space-y-3">
          <div>
            <Label className="text-xs text-gray-500 mb-1.5">提交材料要求</Label>
            <Textarea
              value={submitFormatDesc}
              onChange={e => {
                const v = e.target.value
                setSubmitFormatDesc(v)
                updateState({ methodResourceConfigs: { ...state.methodResourceConfigs, random_draw: { ...rdCfg, submitFormatDesc: v } } })
              }}
              placeholder="请用一句话说明学生需要准备的材料要求..."
              rows={4}
              className="text-sm"
            />
          </div>
          <div>
            <Label className="text-xs text-gray-500 mb-1.5">评审场地/环境资源准备</Label>
            <Textarea
              value={venueResources}
              onChange={e => {
                const v = e.target.value
                setVenueResources(v)
                updateState({ methodResourceConfigs: { ...state.methodResourceConfigs, random_draw: { ...rdCfg, venueResources: v } } })
              }}
              placeholder="请描述现场问答所需的场地、设备及环境资源准备要求..."
              rows={4}
              className="text-sm"
            />
          </div>
        </div>
      </div>

      {/* Add / Edit Dialog */}
      <Dialog open={rdqActionOpen} onOpenChange={setRdqActionOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{rdqActionMode === "add" ? "新增现场问答题" : "编辑现场问答题"}</DialogTitle>
            <DialogDescription>{rdqActionMode === "add" ? "创建一个新的现场问答题" : "修改现场问答题信息"}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>题目名称</Label>
              <Input value={newRdqForm.name} onChange={e => setNewRdqForm({ ...newRdqForm, name: e.target.value })} placeholder="输入题目名称" className="mt-1.5" />
            </div>
            <div>
              <Label>适用专业</Label>
              <Select value={newRdqForm.majorId} onValueChange={v => setNewRdqForm({ ...newRdqForm, majorId: v })}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="选择适用专业" /></SelectTrigger>
                <SelectContent>
                  {majors.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>题目描述</Label>
              <Textarea value={newRdqForm.description} onChange={e => setNewRdqForm({ ...newRdqForm, description: e.target.value })} placeholder="输入题目描述" className="mt-1.5" rows={3} />
            </div>
            <div>
              <Label>题目答案</Label>
              <Textarea value={newRdqForm.answer} onChange={e => setNewRdqForm({ ...newRdqForm, answer: e.target.value })} placeholder="输入题目答案" className="mt-1.5" rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRdqActionOpen(false)}>取消</Button>
            <Button onClick={handleSaveRdq} disabled={!newRdqForm.name.trim()}>
              {rdqActionMode === "add" ? "新增" : "保存修改"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={rdqDetailOpen} onOpenChange={setRdqDetailOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>现场问答题详情</DialogTitle>
          </DialogHeader>
          {(() => {
            const q = allQuestions.find(x => x.id === selectedRdqForDetail)
            if (!q) return null
            return (
              <div className="space-y-4 py-2">
                <div>
                  <Label className="text-xs text-gray-500">题目名称</Label>
                  <p className="text-sm font-medium mt-1">{q.name}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">适用专业</Label>
                  <Badge variant="secondary" className="text-[10px] mt-1">{q.majorName || "通用"}</Badge>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">题目描述</Label>
                  <p className="text-sm mt-1 text-gray-700 whitespace-pre-wrap">{q.description || "-"}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">题目答案</Label>
                  <p className="text-sm mt-1 text-gray-700 whitespace-pre-wrap">{q.answer || "-"}</p>
                </div>
              </div>
            )
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRdqDetailOpen(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
