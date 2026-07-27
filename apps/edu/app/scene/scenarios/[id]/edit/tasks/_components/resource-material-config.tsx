"use client"

import { useState } from "react"
import { Plus, Pencil, Trash2, RotateCcw, Info, FileText } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

export interface ReviewStep {
  id: string
  label: string
  desc: string
  enabled: boolean
  subjectType: string
  weight: number
}

interface ResourceMaterialConfigProps {
  methodKey: "review" | "outcome" | "homework"
  cfg: Record<string, any>
  setCfg: (patch: Record<string, any>) => void
  reviewSteps: ReviewStep[]
  setReviewSteps: (steps: ReviewStep[]) => void
}

export function ResourceMaterialConfig({
  methodKey,
  cfg,
  setCfg,
  reviewSteps,
  setReviewSteps,
}: ResourceMaterialConfigProps) {
  const requiresMaterial = cfg.requiresMaterial !== false
  const [editingReviewStepId, setEditingReviewStepId] = useState<string | null>(null)
  const [editingStepLabel, setEditingStepLabel] = useState("")
  const [editingStepDesc, setEditingStepDesc] = useState("")
  const [showAddStep, setShowAddStep] = useState(false)
  const [newStepLabel, setNewStepLabel] = useState("")
  const [newStepDesc, setNewStepDesc] = useState("")
  const [newStepSubjectType, setNewStepSubjectType] = useState("")

  const subjectLabels: Record<string, string> = {
    teacher: "教师",
    enterprise_mentor: "企业导师",
    self: "自评",
    peer: "互评",
  }

  const sharedMaterialFields = (
    <>
      <div className="mt-3">
        <Label className="text-xs text-gray-500 mb-1.5">评价场地/环境资源准备</Label>
        <Textarea
          value={cfg.venueResources || ""}
          onChange={e => setCfg({ venueResources: e.target.value })}
          placeholder="请描述评价所需的场地、设备及环境资源准备要求..."
          rows={4}
          className="text-sm"
        />
      </div>
      <div className="mt-3">
        <div className="flex items-center gap-2">
          <Switch checked={cfg.allowResubmit ?? false} onCheckedChange={v => setCfg({ allowResubmit: v })} />
          <span className="text-xs text-gray-600">允许重新提交</span>
        </div>
      </div>
    </>
  )

  if (methodKey === "review") {
    return (
      <div className="space-y-4">
        <div className="p-4 bg-amber-50/80 rounded-xl border border-amber-200 text-sm text-amber-800">
          <div className="flex items-center gap-2 mb-2">
            <Info className="h-4 w-4" />
            <span className="font-medium">评审说明</span>
          </div>
          <p>评审时教师根据学生现场表现或提交的材料进行打分。评价点配置请在「评价标准配置」卡片中设置。</p>
        </div>
        <div className="border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium">评审材料要求</p>
            <div className="flex items-center gap-2">
              <Switch checked={requiresMaterial} onCheckedChange={v => setCfg({ requiresMaterial: v })} />
              <span className="text-xs text-gray-600">是否需要提交评审材料</span>
            </div>
          </div>
          {requiresMaterial && (
            <>
              <div>
                <Label className="text-xs text-gray-500">预估提交天数</Label>
                <Input type="number" value={cfg.deadlineDays ?? 7} onChange={e => setCfg({ deadlineDays: Math.max(1, parseInt(e.target.value) || 1) })} className="mt-1 text-sm max-w-[50%]" min={1} />
              </div>
              <div className="mt-3">
                <Label className="text-xs text-gray-500 mb-1.5">提交材料要求</Label>
                <Textarea
                  value={cfg.submitFormatDesc || ""}
                  onChange={e => setCfg({ submitFormatDesc: e.target.value })}
                  placeholder="请用一句话说明学生需要提交的材料要求..."
                  rows={4}
                  className="text-sm"
                />
              </div>
            </>
          )}
          {sharedMaterialFields}
        </div>
        <div className="border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <p className="text-sm font-medium">评审流程设置</p>
              {(() => {
                const enabledSteps = reviewSteps.filter(s => s.enabled)
                const totalWeight = enabledSteps.reduce((sum, s) => sum + (s.weight || 0), 0)
                return enabledSteps.length > 0 && (
                  <div className={cn(
                    "flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full font-medium",
                    totalWeight === 100 ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
                  )}>
                    <span>权重合计 {totalWeight}%</span>
                    {totalWeight !== 100 && <span className="text-[10px]">(需等于100%)</span>}
                  </div>
                )
              })()}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => {
                const enabled = reviewSteps.filter(s => s.enabled)
                const count = enabled.length
                if (count === 0) return
                const base = Math.floor(100 / count)
                const remainder = 100 % count
                const newSteps = reviewSteps.map(s => {
                  if (!s.enabled) return s
                  const idx = enabled.findIndex(e => e.id === s.id)
                  return { ...s, weight: base + (idx < remainder ? 1 : 0) }
                })
                setReviewSteps(newSteps)
              }}>
                <RotateCcw className="h-3.5 w-3.5 mr-1" />一键平均权重
              </Button>
              <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => { setShowAddStep(true); setNewStepLabel(""); setNewStepDesc(""); }}>
                <Plus className="h-3.5 w-3.5 mr-1" />新增步骤
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            {reviewSteps.map((step) => (
              <div key={step.id} className="p-3 rounded-lg border">
                {editingReviewStepId === step.id ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <Input value={editingStepLabel} onChange={e => setEditingStepLabel(e.target.value)} placeholder="步骤名称" className="text-sm h-8" />
                      <Select value={step.subjectType || ""} onValueChange={v => setReviewSteps(reviewSteps.map(s => s.id === step.id ? { ...s, subjectType: v } : s))}>
                        <SelectTrigger className="text-sm h-8"><SelectValue placeholder="请选择评价主体" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="teacher">教师</SelectItem>
                          <SelectItem value="enterprise_mentor">企业导师</SelectItem>
                          <SelectItem value="peer">互评</SelectItem>
                          <SelectItem value="self">自评</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Input value={editingStepDesc} onChange={e => setEditingStepDesc(e.target.value)} placeholder="步骤描述" className="text-sm h-8" />
                    <div className="flex items-center gap-2">
                      <Button size="sm" className="h-7 text-xs" onClick={() => {
                        setReviewSteps(reviewSteps.map(s => s.id === step.id ? { ...s, label: editingStepLabel || s.label, desc: editingStepDesc || s.desc } : s))
                        setEditingReviewStepId(null)
                      }}>保存</Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditingReviewStepId(null)}>取消</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <Switch checked={step.enabled} onCheckedChange={v => {
                          if (v && !step.subjectType) {
                            setReviewSteps(reviewSteps.map(s => s.id === step.id ? { ...s, enabled: v, subjectType: "teacher" } : s))
                          } else {
                            setReviewSteps(reviewSteps.map(s => s.id === step.id ? { ...s, enabled: v } : s))
                          }
                        }} />
                        <div>
                          <p className="text-sm font-medium">{step.label}</p>
                          <p className="text-xs text-gray-400">{step.desc}</p>
                        </div>
                      </div>
                      <Badge variant={step.subjectType ? "secondary" : "outline"} className="text-[10px]">{step.subjectType ? (subjectLabels[step.subjectType] || step.subjectType) : "未绑定"}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      {step.enabled && (
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            value={step.weight || 0}
                            onChange={e => setReviewSteps(reviewSteps.map(s => s.id === step.id ? { ...s, weight: Math.max(0, Math.min(100, parseInt(e.target.value) || 0)) } : s))}
                            className="h-7 text-xs w-14 text-center"
                            min={0}
                            max={100}
                          />
                          <span className="text-xs text-gray-400">%</span>
                        </div>
                      )}
                      <Button variant="ghost" size="sm" className="h-6 text-[11px] px-1.5 text-gray-400 hover:text-primary" onClick={() => { setEditingReviewStepId(step.id); setEditingStepLabel(step.label); setEditingStepDesc(step.desc); }}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      {reviewSteps.length > 1 && (
                        <Button variant="ghost" size="sm" className="h-6 text-[11px] px-1.5 text-gray-400 hover:text-red-500" onClick={() => setReviewSteps(reviewSteps.filter(s => s.id !== step.id))}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          {showAddStep && (
            <div className="mt-2 p-3 rounded-lg border border-dashed border-primary/30 bg-primary/[0.02] space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <Input value={newStepLabel} onChange={e => setNewStepLabel(e.target.value)} placeholder="步骤名称" className="text-sm h-8" />
                <Select value={newStepSubjectType} onValueChange={v => setNewStepSubjectType(v)}>
                  <SelectTrigger className="text-sm h-8"><SelectValue placeholder="请选择评价主体" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="teacher">教师</SelectItem>
                    <SelectItem value="enterprise_mentor">企业导师</SelectItem>
                    <SelectItem value="peer">互评</SelectItem>
                    <SelectItem value="self">自评</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Input value={newStepDesc} onChange={e => setNewStepDesc(e.target.value)} placeholder="步骤描述" className="text-sm h-8" />
              <div className="flex items-center gap-2">
                <Button size="sm" className="h-7 text-xs" onClick={() => {
                  if (!newStepLabel.trim() || !newStepSubjectType) return
                  setReviewSteps([...reviewSteps, { id: `rs-${Date.now()}`, label: newStepLabel, desc: newStepDesc, enabled: true, subjectType: newStepSubjectType, weight: 0 }])
                  setShowAddStep(false)
                  setNewStepLabel("")
                  setNewStepDesc("")
                  setNewStepSubjectType("")
                }}>添加</Button>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setShowAddStep(false); setNewStepLabel(""); setNewStepDesc(""); setNewStepSubjectType(""); }}>取消</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  if (methodKey === "outcome") {
    return (
      <div className="space-y-4">
        <div className="p-4 bg-cyan-50/80 rounded-xl border border-cyan-200 text-sm text-cyan-800">
          <div className="flex items-center gap-2 mb-2">
            <Info className="h-4 w-4" />
            <span className="font-medium">成果评价说明</span>
          </div>
          <p>成果评价时教师根据学生提交的成果材料进行打分。评价点配置请在「评价标准配置」卡片中设置。</p>
        </div>
        <div className="border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /><h3 className="text-sm font-semibold">成果材料要求</h3></div>
            <div className="flex items-center gap-2">
              <Switch checked={requiresMaterial} onCheckedChange={v => setCfg({ requiresMaterial: v })} />
              <span className="text-xs text-gray-600">是否需要提交成果材料</span>
            </div>
          </div>
          {requiresMaterial && (
            <>
              <div>
                <Label className="text-xs text-gray-500">预估提交天数</Label>
                <Input type="number" value={cfg.deadlineDays ?? 7} onChange={e => setCfg({ deadlineDays: Math.max(1, parseInt(e.target.value) || 1) })} className="mt-1 text-sm max-w-[50%]" min={1} />
              </div>
              <div className="mt-3">
                <Label className="text-xs text-gray-500 mb-1.5">提交材料要求</Label>
                <Textarea
                  value={cfg.submitFormatDesc || ""}
                  onChange={e => setCfg({ submitFormatDesc: e.target.value })}
                  placeholder="请用一句话说明学生需要提交的成果材料要求..."
                  rows={4}
                  className="text-sm"
                />
              </div>
            </>
          )}
          {sharedMaterialFields}
        </div>
      </div>
    )
  }

  if (methodKey === "homework") {
    return (
      <div className="space-y-4">
        <div className="p-4 bg-pink-50 rounded-lg border border-pink-100 text-sm text-pink-700">
          <div className="flex items-center gap-2 mb-2">
            <Info className="h-4 w-4" />
            <span className="font-medium">作业说明</span>
          </div>
          <p>学生提交作业后，教师按评分规则进行打分。评价点配置请在「评价标准配置」卡片中设置。</p>
        </div>
        <div className="border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /><h3 className="text-sm font-semibold">作业提交要求</h3></div>
            <div className="flex items-center gap-2">
              <Switch checked={requiresMaterial} onCheckedChange={v => setCfg({ requiresMaterial: v })} />
              <span className="text-xs text-gray-600">是否需要提交作业材料</span>
            </div>
          </div>
          {requiresMaterial && (
            <>
              <div>
                <Label className="text-xs text-gray-500">预估提交天数</Label>
                <Input type="number" value={cfg.deadlineDays ?? 7} onChange={e => setCfg({ deadlineDays: Math.max(1, parseInt(e.target.value) || 1) })} className="mt-1 text-sm max-w-[50%]" min={1} />
              </div>
              <div className="mt-3">
                <Label className="text-xs text-gray-500 mb-1.5">作业格式要求</Label>
                <Textarea
                  value={cfg.submitFormatDesc || ""}
                  onChange={e => setCfg({ submitFormatDesc: e.target.value })}
                  placeholder="请用一句话说明学生需要提交的作业格式要求..."
                  rows={4}
                  className="text-sm"
                />
              </div>
            </>
          )}
          <div className="mt-3">
            <Label className="text-xs text-gray-500 mb-1.5">作业场地/环境资源准备</Label>
            <Textarea
              value={cfg.venueResources || ""}
              onChange={e => setCfg({ venueResources: e.target.value })}
              placeholder="请描述作业所需的场地、设备及环境资源准备要求..."
              rows={4}
              className="text-sm"
            />
          </div>
          <div className="mt-3">
            <div className="flex items-center gap-2">
              <Switch checked={cfg.allowResubmit ?? false} onCheckedChange={v => setCfg({ allowResubmit: v })} />
              <span className="text-xs text-gray-600">允许重新提交</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return null
}
