"use client"

import { Plus, Search, Info } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { PrdAnnotation } from "@/components/prd-annotation"
import { getAnnotation } from "@/lib/prd-annotations"
import { examApi } from "@/lib/api"
import { loadedExams } from "./shared-defs"

interface PaperConfigPanelProps {
  paperCfg: Record<string, any>
  setPaperCfg: (patch: Record<string, any>) => void
  paperIds: string[]
  onSelectPaper: (paperId: string) => void
  pSearch: string
  setPSearch: (v: string) => void
  configPaperId: string | null
  setConfigPaperId: (v: string | null) => void
  showCreatePaper: boolean
  setShowCreatePaper: (v: boolean) => void
  selectedPaperForDetail: string | null
  setSelectedPaperForDetail: (v: string | null) => void
  paperDetailOpen: boolean
  setPaperDetailOpen: (v: boolean) => void
}

export function PaperConfigPanel({
  paperCfg,
  setPaperCfg,
  paperIds,
  onSelectPaper,
  pSearch,
  setPSearch,
  configPaperId,
  setConfigPaperId,
  showCreatePaper,
  setShowCreatePaper,
  selectedPaperForDetail,
  setSelectedPaperForDetail,
  paperDetailOpen,
  setPaperDetailOpen,
}: PaperConfigPanelProps) {
  return (
    <>
    <div className="space-y-4">
      <div className="border rounded-xl p-4">
        <p className="text-sm font-medium mb-3">选择已有试卷</p>
        <div className="flex items-center gap-3 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input value={pSearch} onChange={e => setPSearch(e.target.value)} placeholder="搜索试卷..." className="pl-9" />
          </div>
          <PrdAnnotation data={getAnnotation("paper-action-create")}>
            <Button variant="outline" size="sm" className="h-9 text-xs" onClick={() => { setShowCreatePaper(true); }}>
              <Plus className="h-3.5 w-3.5 mr-1" />新建试卷
            </Button>
          </PrdAnnotation>
        </div>
        <div className="space-y-2">
          {loadedExams.filter((p: any) => !pSearch || p.name.includes(pSearch)).map((paper: any) => {
            const selected = paperIds.includes(paper.id)
            const questionCount = paper.questions?.length ?? paper.questionCount ?? 0
            const totalScore = paper.totalScore ?? 100
            return (
              <div key={paper.id} onClick={() => onSelectPaper(paper.id)} className={cn("px-3 py-2 rounded-lg border cursor-pointer flex items-center gap-3", selected ? "border-primary bg-primary/5" : "hover:border-gray-300")}>
                <div className={cn("w-4 h-4 rounded-full border flex items-center justify-center shrink-0", selected ? "bg-primary border-primary" : "border-gray-300")}>{selected && <div className="w-2 h-2 rounded-full bg-white" />}</div>
                <p className="text-sm font-medium flex-1 min-w-0 truncate">{paper.name}</p>
                <Badge className="text-[10px] bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-50 shrink-0">{questionCount} 题</Badge>
                <Badge className="text-[10px] bg-green-50 text-green-600 border-green-200 hover:bg-green-50 shrink-0">总分 {totalScore}</Badge>
                <Button variant="ghost" size="sm" className="h-7 text-[11px] px-2 text-gray-400 hover:text-primary shrink-0" onClick={e => { e.stopPropagation(); setSelectedPaperForDetail(paper.id); setPaperDetailOpen(true); }}>
                  查看详情
                </Button>
              </div>
            )
          })}
          {loadedExams.filter((p: any) => !pSearch || p.name.includes(pSearch)).length === 0 && !pSearch && (
            <div className="text-center py-8 text-gray-400">
              <Info className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">暂无可选试卷</p>
              <p className="text-xs mt-1">请点击「新建试卷」创建试卷，或在测评中心准备试卷后刷新</p>
            </div>
          )}
          {loadedExams.length > 0 && loadedExams.filter((p: any) => !pSearch || p.name.includes(pSearch)).length === 0 && (
            <div className="text-center py-8 text-gray-400">
              <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">未找到匹配的试卷</p>
            </div>
          )}
        </div>
      </div>

      <div className="border rounded-xl p-4">
        <p className="text-sm font-medium mb-3">考卷设置</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-gray-500">考试时长（分钟）</Label>
            <Input type="number" value={paperCfg.duration ?? 60} onChange={e => setPaperCfg({ duration: Math.max(0, parseInt(e.target.value) || 0) })} className="mt-1 text-sm" min={0} />
          </div>
          <div>
            <Label className="text-xs text-gray-500">允许重考</Label>
            <div className="mt-2 flex items-center gap-2">
              <Switch checked={paperCfg.allowRetake ?? false} onCheckedChange={v => setPaperCfg({ allowRetake: v })} />
              <span className="text-xs text-gray-600">{(paperCfg.allowRetake ?? false) ? "是" : "否"}</span>
            </div>
          </div>
          {(paperCfg.allowRetake ?? false) && (
            <div>
              <Label className="text-xs text-gray-500">最多重考次数</Label>
              <Input type="number" value={paperCfg.retakeCount ?? 1} onChange={e => setPaperCfg({ retakeCount: Math.max(1, parseInt(e.target.value) || 1) })} className="mt-1 text-sm" min={1} />
            </div>
          )}
        </div>
        <div className="mt-3 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch checked={paperCfg.shuffleQuestions ?? true} onCheckedChange={v => setPaperCfg({ shuffleQuestions: v })} />
            <span className="text-xs text-gray-600">题目乱序</span>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={paperCfg.showResult ?? true} onCheckedChange={v => setPaperCfg({ showResult: v })} />
            <span className="text-xs text-gray-600">交卷后显示成绩</span>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t">
          <Label className="text-xs text-gray-500 mb-2">试卷启用条件</Label>
          <div className="grid grid-cols-3 gap-3 mt-2">
            {[
              { key: "manual", label: "手动启用", desc: "老师手动开启后学生可作答" },
              { key: "scheduled", label: "定时启用", desc: "预设开始结束时间，到时间自动开启关闭" },
              { key: "always", label: "随时作答", desc: "创建后立即开放，学生随时可进入作答" },
            ].map(mode => (
              <button
                key={mode.key}
                onClick={() => setPaperCfg({ activationMode: mode.key })}
                className={cn(
                  "w-full text-left p-3 rounded-lg border transition-all",
                  (paperCfg.activationMode ?? "manual") === mode.key
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-gray-200 text-gray-600 hover:border-gray-300"
                )}
              >
                <div className="flex items-center gap-2">
                  <div className={cn("w-4 h-4 rounded-full border flex items-center justify-center shrink-0", (paperCfg.activationMode ?? "manual") === mode.key ? "bg-primary border-primary" : "border-gray-300")}>
                    {(paperCfg.activationMode ?? "manual") === mode.key && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                  <span className="text-xs font-medium">{mode.label}</span>
                </div>
                <p className="text-[11px] text-gray-400 mt-1 ml-6">{mode.desc}</p>
              </button>
            ))}
          </div>
          {(paperCfg.activationMode ?? "manual") === "scheduled" && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-gray-500">启用时间</Label>
                <Input
                  type="datetime-local"
                  value={paperCfg.scheduledTime ?? ""}
                  onChange={e => setPaperCfg({ scheduledTime: e.target.value })}
                  onFocus={e => e.currentTarget.showPicker?.()}
                  className="mt-1 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs text-gray-500">停用时间</Label>
                <Input
                  type="datetime-local"
                  value={paperCfg.scheduledEndTime ?? ""}
                  onChange={e => setPaperCfg({ scheduledEndTime: e.target.value })}
                  onFocus={e => e.currentTarget.showPicker?.()}
                  className="mt-1 text-sm"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    {/* Exam Question Config Dialog */}
    <Dialog open={!!configPaperId} onOpenChange={(v) => { if (!v) { setConfigPaperId(null) } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>试卷创建成功</DialogTitle>
          <DialogDescription>
            试卷「{loadedExams.find((e: any) => e.id === configPaperId)?.name || ""}」已创建并选中。
            你可以在试卷管理页面中配置题目、分数等。
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 text-center text-gray-500 text-sm">
          前往试卷管理页面配置题目（自动抽题、手动抽题、新增题目、分数配置）
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => { setConfigPaperId(null) }}>
            稍后配置
          </Button>
          <Button onClick={() => {
            const id = configPaperId
            setConfigPaperId(null)
            if (id) window.open(`/evaluation/exams/${id}`, "_blank")
          }}>
            前往配置题目
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  )
}
