"use client"

import { useRef, useState } from "react"
import { Plus, Trash2, ChevronDown, ChevronRight, X, CheckCircle2, Search } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import type { EvalPoint, GradeMapping, KnowledgePointItem } from "@/lib/types/lesson"

interface EvaluationRulesEditorProps {
  evalPoints: EvalPoint[]
  knowledgePoints: KnowledgePointItem[]
  onChange: (points: EvalPoint[]) => void
}

const evalSubTypeLabels: Record<string, string> = {
  knowledge_mastery: "知识掌握",
  operation_standard: "操作规范",
  task_completion: "任务完成",
  result_quality: "成果质量",
  communication: "沟通表达",
  collaboration: "团队协作",
  professionalism: "职业素养",
  innovation: "创新思维",
  adaptability: "应变能力",
}

const evalSubTypeColors: Record<string, string> = {
  knowledge_mastery: "bg-blue-50 text-blue-600 border-blue-200",
  operation_standard: "bg-teal-50 text-teal-600 border-teal-200",
  task_completion: "bg-green-50 text-green-600 border-green-200",
  result_quality: "bg-purple-50 text-purple-600 border-purple-200",
  communication: "bg-orange-50 text-orange-600 border-orange-200",
  collaboration: "bg-pink-50 text-pink-600 border-pink-200",
  professionalism: "bg-gray-50 text-gray-600 border-gray-200",
  innovation: "bg-indigo-50 text-indigo-600 border-indigo-200",
  adaptability: "bg-cyan-50 text-cyan-600 border-cyan-200",
}

const defaultGradeMapping: GradeMapping[] = [
  { id: "gm-1", grade: "优秀", minScore: 90, maxScore: 100, color: "bg-green-500" },
  { id: "gm-2", grade: "良好", minScore: 75, maxScore: 89, color: "bg-blue-500" },
  { id: "gm-3", grade: "及格", minScore: 60, maxScore: 74, color: "bg-yellow-500" },
  { id: "gm-4", grade: "不合格", minScore: 0, maxScore: 59, color: "bg-red-500" },
]

function LevelRuleEditor({ gradeMapping, onChange }: { gradeMapping: GradeMapping[]; onChange: (gm: GradeMapping[]) => void }) {
  const gradeColors = [
    { light: "bg-green-50 border-green-200 text-green-700", dot: "bg-green-500" },
    { light: "bg-blue-50 border-blue-200 text-blue-700", dot: "bg-blue-500" },
    { light: "bg-yellow-50 border-yellow-200 text-yellow-700", dot: "bg-yellow-500" },
    { light: "bg-red-50 border-red-200 text-red-700", dot: "bg-red-500" },
  ]
  return (
    <div className="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-100">
      <p className="text-xs font-medium text-gray-600 mb-2">等级转换规则</p>
      <div className="h-6 bg-gray-200 rounded overflow-hidden flex mb-2">
        {[...gradeMapping].sort((a, b) => a.minScore - b.minScore).map((g) => {
          const width = g.maxScore - g.minScore + 1
          return <div key={g.id} className={cn("flex items-center justify-center text-white text-[10px] font-medium", g.color)} style={{ width: `${width}%` }}>{g.grade}</div>
        })}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[...gradeMapping].sort((a, b) => b.maxScore - a.maxScore).map((g, i) => {
          const c = gradeColors[i % gradeColors.length]
          return (
            <div key={g.id} className={cn("rounded border p-2", c.light)}>
              <div className="flex items-center justify-between mb-1">
                <Input value={g.grade} onChange={(e) => onChange(gradeMapping.map((x) => x.id === g.id ? { ...x, grade: e.target.value } : x))} className="w-14 h-6 text-center text-xs font-semibold" />
                <div className={cn("w-3 h-3 rounded-full", c.dot)} />
              </div>
              <div className="flex items-center gap-1">
                <Input type="number" value={g.minScore} onChange={(e) => onChange(gradeMapping.map((x) => x.id === g.id ? { ...x, minScore: parseInt(e.target.value) || 0 } : x))} className="w-16 h-6 text-center text-xs" min={0} max={100} />
                <span className="text-gray-500 text-xs">-</span>
                <Input type="number" value={g.maxScore} onChange={(e) => onChange(gradeMapping.map((x) => x.id === g.id ? { ...x, maxScore: parseInt(e.target.value) || 0 } : x))} className="w-16 h-6 text-center text-xs" min={0} max={100} />
                <span className="text-xs text-gray-500">分</span>
              </div>
              <div className="mt-1.5">
                <Input value={g.remark || ""} onChange={(e) => onChange(gradeMapping.map((x) => x.id === g.id ? { ...x, remark: e.target.value } : x))} className="h-7 text-[10px] bg-white/70" placeholder="等级备注说明" />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function EvaluationRulesEditor({ evalPoints, knowledgePoints, onChange }: EvaluationRulesEditorProps) {
  const [expandedTypes, setExpandedTypes] = useState<Record<string, boolean>>({})
  const [kpSearch, setKpSearch] = useState("")
  const idCounterRef = useRef(0)

  const addEvalPoint = (subType?: string, presetName?: string) => {
    const newPoint: EvalPoint = {
      id: `ep-${++idCounterRef.current}`,
      name: presetName || "未命名评价点",
      desc: "",
      subType,
      scoringMethod: "level",
      gradeMapping: JSON.parse(JSON.stringify(defaultGradeMapping)),
      weight: 10,
      knowledgePointIds: [],
    }
    onChange([...evalPoints, newPoint])
  }

  const removeEvalPoint = (id: string) => {
    onChange(evalPoints.filter((p) => p.id !== id))
  }

  const updateEvalPoint = (id: string, updates: Partial<EvalPoint>) => {
    onChange(evalPoints.map((p) => p.id === id ? { ...p, ...updates } : p))
  }

  const toggleType = (st: string) => {
    setExpandedTypes((prev) => ({ ...prev, [st]: !prev[st] }))
  }

  // Group points by subType
  const grouped = evalPoints.reduce((acc, ep) => {
    const key = ep.subType || "uncategorized"
    if (!acc[key]) acc[key] = []
    acc[key].push(ep)
    return acc
  }, {} as Record<string, EvalPoint[]>)

  const subTypeKeys = Object.keys(evalSubTypeLabels)
  const usedSubTypes = subTypeKeys.filter((st) => grouped[st]?.length > 0)

  return (
    <div className="space-y-4">
      {/* Sub-type selector */}
      <div className="border rounded-xl p-4">
        <p className="text-sm font-medium mb-3">评价点配置</p>
        <div className="mb-4">
          <p className="text-xs text-gray-500 mb-2">选择细分类型并添加评价点</p>
          <div className="flex flex-wrap gap-1.5">
            {subTypeKeys.map((st) => {
              const count = grouped[st]?.length || 0
              const active = count > 0
              return (
                <button
                  key={st}
                  onClick={() => {
                    if (!active) {
                      addEvalPoint(st, `${evalSubTypeLabels[st]}评价点`)
                    }
                    toggleType(st)
                  }}
                  className={cn(
                    "px-2.5 py-1 rounded-full text-xs border transition-all",
                    active
                      ? cn(evalSubTypeColors[st], "border-current")
                      : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                  )}
                >
                  {evalSubTypeLabels[st]}
                  {count > 0 && <span className="ml-1 font-medium">({count})</span>}
                </button>
              )
            })}
          </div>
        </div>

        {/* Grouped eval points */}
        <div className="space-y-3">
          {usedSubTypes.map((st) => {
            const expanded = expandedTypes[st] !== false
            const eps = grouped[st]
            return (
              <div key={st} className="border rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleType(st)}
                  className={cn("w-full flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors", expanded ? "bg-gray-50" : "bg-white hover:bg-gray-50")}
                >
                  {expanded ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
                  <Badge variant="outline" className={cn("text-[10px]", evalSubTypeColors[st])}>{evalSubTypeLabels[st]}</Badge>
                  <span className="flex-1 text-left text-gray-600">{eps.length} 个评价点</span>
                  <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2 text-gray-400 hover:text-primary" onClick={(e) => { e.stopPropagation(); addEvalPoint(st, ""); }}>
                    <Plus className="h-3 w-3 mr-1" />手动添加
                  </Button>
                </button>
                {expanded && (
                  <div className="p-3 space-y-2 border-t">
                    {eps.map((ep) => (
                      <div key={ep.id} className="p-3 bg-white rounded-lg border">
                        <div className="flex items-center gap-2 mb-2">
                          <Input value={ep.name} onChange={(e) => updateEvalPoint(ep.id, { name: e.target.value })} className="flex-1 h-8 text-sm" placeholder="评价点名称" />
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-red-500" onClick={() => removeEvalPoint(ep.id)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          <Badge variant="outline" className={cn("text-[10px]", evalSubTypeColors[ep.subType || ""])}>{ep.subType ? evalSubTypeLabels[ep.subType] : "未分类"}</Badge>
                          <Select value={ep.scoringMethod || "level"} onValueChange={(v) => updateEvalPoint(ep.id, { scoringMethod: v as "score" | "level" | "rubric" })}>
                            <SelectTrigger className="h-7 text-[10px] w-28">
                              <SelectValue placeholder="评分方式" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="score">分值制</SelectItem>
                              <SelectItem value="level">等级制</SelectItem>
                              <SelectItem value="rubric">rubric量表</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="mb-2">
                          <p className="text-xs text-gray-500 mb-1">关联知识点</p>
                          <div className="flex flex-wrap gap-1">
                            {(ep.knowledgePointIds || []).map((kpid) => {
                              const kp = knowledgePoints.find((k) => k.id === kpid)
                              return kp ? (
                                <Badge key={kpid} variant="secondary" className="text-[10px] font-normal">
                                  {kp.name}
                                  <button onClick={() => updateEvalPoint(ep.id, { knowledgePointIds: (ep.knowledgePointIds || []).filter((id) => id !== kpid) })} className="ml-1 text-gray-400 hover:text-red-500">×</button>
                                </Badge>
                              ) : null
                            })}
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2 text-gray-400 hover:text-primary">+ 添加知识点</Button>
                              </DialogTrigger>
                              <DialogContent className="sm:max-w-md">
                                <DialogHeader><DialogTitle>关联知识点</DialogTitle></DialogHeader>
                                <div className="relative mb-3">
                                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                  <Input value={kpSearch} onChange={(e) => setKpSearch(e.target.value)} placeholder="搜索知识点..." className="pl-9" />
                                </div>
                                <div className="space-y-2 max-h-64 overflow-y-auto">
                                  {knowledgePoints.filter((k) => !kpSearch || k.name.includes(kpSearch)).map((k) => {
                                    const alreadyLinked = (ep.knowledgePointIds || []).includes(k.id)
                                    return (
                                      <div key={k.id} onClick={() => {
                                        if (alreadyLinked) return
                                        updateEvalPoint(ep.id, { knowledgePointIds: [...(ep.knowledgePointIds || []), k.id] })
                                      }} className={cn("p-2 rounded-lg border cursor-pointer text-sm", alreadyLinked ? "border-primary bg-primary/5 opacity-50" : "hover:border-gray-300")}>
                                        <div className="flex items-center gap-2">
                                          <span className="flex-1">{k.name}</span>
                                          {alreadyLinked && <CheckCircle2 className="h-4 w-4 text-primary" />}
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              </DialogContent>
                            </Dialog>
                          </div>
                        </div>
                        {ep.scoringMethod === "level" && ep.gradeMapping && (
                          <LevelRuleEditor gradeMapping={ep.gradeMapping} onChange={(gm) => updateEvalPoint(ep.id, { gradeMapping: gm })} />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          {/* Uncategorized points */}
          {grouped["uncategorized"]?.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <button onClick={() => toggleType("uncategorized")} className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium bg-white hover:bg-gray-50 transition-colors">
                {expandedTypes["uncategorized"] !== false ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
                <span className="text-gray-600">未分类评价点</span>
                <span className="text-gray-400">({grouped["uncategorized"].length})</span>
              </button>
              {expandedTypes["uncategorized"] !== false && (
                <div className="p-3 space-y-2 border-t">
                  {grouped["uncategorized"].map((ep) => (
                    <div key={ep.id} className="p-3 bg-white rounded-lg border">
                      <div className="flex items-center gap-2 mb-2">
                        <Input value={ep.name} onChange={(e) => updateEvalPoint(ep.id, { name: e.target.value })} className="flex-1 h-8 text-sm" placeholder="评价点名称" />
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-red-500" onClick={() => removeEvalPoint(ep.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <Badge variant="outline" className="text-[10px]">未分类</Badge>
                        <Select value={ep.scoringMethod || "level"} onValueChange={(v) => updateEvalPoint(ep.id, { scoringMethod: v as "score" | "level" | "rubric" })}>
                          <SelectTrigger className="h-7 text-[10px] w-28">
                            <SelectValue placeholder="评分方式" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="score">分值制</SelectItem>
                            <SelectItem value="level">等级制</SelectItem>
                            <SelectItem value="rubric">rubric量表</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {ep.scoringMethod === "level" && ep.gradeMapping && (
                        <LevelRuleEditor gradeMapping={ep.gradeMapping} onChange={(gm) => updateEvalPoint(ep.id, { gradeMapping: gm })} />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
