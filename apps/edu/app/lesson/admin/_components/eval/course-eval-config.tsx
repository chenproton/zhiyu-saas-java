"use client"

import { useState } from "react"
import { Plus, X, GripVertical, Trash2, ChevronDown, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

const METHOD_OPTIONS = [
  { key: "question_bank", label: "题库", icon: "📚", desc: "从题库选题组成测评" },
  { key: "paper", label: "试卷", icon: "📝", desc: "使用固定试卷进行考核" },
  { key: "quiz", label: "随堂测", icon: "📋", desc: "课堂即时测验" },
  { key: "random_draw", label: "现场问答", icon: "🎯", desc: "从题库抽题，教师现场提问" },
  { key: "review", label: "现场评审", icon: "⚖️", desc: "教师根据表现/材料打分" },
  { key: "outcome", label: "成果评价", icon: "📊", desc: "对学生成果进行评价" },
  { key: "homework", label: "作业", icon: "📖", desc: "学生提交作业进行评价" },
]

export interface EvalPoint {
  id: string
  name: string
  weight: number
  scoringMethod: "level" | "score" | "pass_fail"
  gradeMapping: GradeLevel[]
}

export interface GradeLevel {
  grade: string
  minScore: number
  maxScore: number
  color: string
}

export interface EvalMethodConfig {
  methodKey: string
  resourceConfig: {
    bankId?: string
    paperId?: string
    questionCount?: number
    examUsageId?: string
    description?: string
  }
  evalPoints: EvalPoint[]
  gradeMapping: GradeLevel[]
}

export interface CourseEvalData {
  methods: EvalMethodConfig[]
}

const DEFAULT_GRADE_MAPPING: GradeLevel[] = [
  { grade: "A", minScore: 90, maxScore: 100, color: "bg-green-500" },
  { grade: "B", minScore: 75, maxScore: 89, color: "bg-blue-500" },
  { grade: "C", minScore: 60, maxScore: 74, color: "bg-yellow-500" },
  { grade: "D", minScore: 0, maxScore: 59, color: "bg-red-500" },
]

function generateId() { return `ep-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` }

interface CourseEvalConfigProps {
  value?: CourseEvalData
  onChange?: (data: CourseEvalData) => void
}

export function CourseEvalConfig({ value, onChange }: CourseEvalConfigProps) {
  const methods = value?.methods || []

  const update = (newMethods: EvalMethodConfig[]) => {
    onChange?.({ methods: newMethods })
  }

  const toggleMethod = (methodKey: string) => {
    const exists = methods.find(m => m.methodKey === methodKey)
    if (exists) {
      update(methods.filter(m => m.methodKey !== methodKey))
    } else {
      update([...methods, {
        methodKey,
        resourceConfig: {},
        evalPoints: [
          { id: generateId(), name: "准确性", weight: 30, scoringMethod: "score", gradeMapping: DEFAULT_GRADE_MAPPING },
          { id: generateId(), name: "完整性", weight: 25, scoringMethod: "score", gradeMapping: DEFAULT_GRADE_MAPPING },
          { id: generateId(), name: "规范性", weight: 25, scoringMethod: "score", gradeMapping: DEFAULT_GRADE_MAPPING },
          { id: generateId(), name: "创新性", weight: 20, scoringMethod: "score", gradeMapping: DEFAULT_GRADE_MAPPING },
        ],
        gradeMapping: DEFAULT_GRADE_MAPPING,
      }])
    }
  }

  const isSelected = (key: string) => methods.some(m => m.methodKey === key)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {METHOD_OPTIONS.map((opt) => {
          const selected = isSelected(opt.key)
          return (
            <button
              key={opt.key}
              onClick={() => toggleMethod(opt.key)}
              className={cn(
                "text-left p-3 rounded-lg border-2 transition-all",
                selected
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-slate-200 hover:border-slate-300 bg-white"
              )}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-base">{opt.icon}</span>
                <span className="text-sm font-medium">{opt.label}</span>
              </div>
              <p className="text-xs text-muted-foreground">{opt.desc}</p>
            </button>
          )
        })}
      </div>

      {methods.length > 0 && (
        <div className="space-y-3 mt-4">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">已选测评方式配置</Label>
          {methods.map((method) => (
            <MethodConfigPanel
              key={method.methodKey}
              method={method}
              allMethods={methods}
              onChange={(updated) => {
                update(methods.map(m => m.methodKey === updated.methodKey ? updated : m))
              }}
              onRemove={() => toggleMethod(method.methodKey)}
            />
          ))}
        </div>
      )}

      {methods.length > 0 && (
        <Card className="border-0 shadow-sm bg-slate-50">
          <CardContent className="p-4">
            <Label className="text-xs font-semibold mb-3 block">全局等级映射</Label>
            <GradeMappingEditor
              mapping={methods[0].gradeMapping}
              onChange={(gm) => {
                update(methods.map(m => ({ ...m, gradeMapping: gm })))
              }}
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function MethodConfigPanel({
  method,
  allMethods,
  onChange,
  onRemove,
}: {
  method: EvalMethodConfig
  allMethods: EvalMethodConfig[]
  onChange: (m: EvalMethodConfig) => void
  onRemove: () => void
}) {
  const [expanded, setExpanded] = useState(true)
  const meta = METHOD_OPTIONS.find(o => o.key === method.methodKey)

  return (
    <Card className="border-slate-200 shadow-sm">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-slate-50/50 rounded-t-lg"
      >
        <div className="flex items-center gap-2">
          {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          <span className="text-sm font-medium">{meta?.icon} {meta?.label}</span>
          <Badge variant="outline" className="text-xs">{method.evalPoints.reduce((s, p) => s + p.weight, 0)}% 权重</Badge>
        </div>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-400 hover:text-red-600" onClick={(e) => { e.stopPropagation(); onRemove() }}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </button>
      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t">
          <div className="pt-3 space-y-2">
            {(method.methodKey === "question_bank" || method.methodKey === "random_draw") && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">题库 ID</Label>
                  <Input
                    className="h-8 text-xs"
                    placeholder="关联题库UUID"
                    value={method.resourceConfig.bankId || ""}
                    onChange={e => onChange({ ...method, resourceConfig: { ...method.resourceConfig, bankId: e.target.value } })}
                  />
                </div>
                <div>
                  <Label className="text-xs">抽题数量</Label>
                  <Input
                    type="number"
                    className="h-8 text-xs"
                    placeholder="0"
                    value={method.resourceConfig.questionCount || ""}
                    onChange={e => onChange({ ...method, resourceConfig: { ...method.resourceConfig, questionCount: parseInt(e.target.value) || undefined } })}
                  />
                </div>
              </div>
            )}
            {method.methodKey === "paper" && (
              <div>
                <Label className="text-xs">试卷 ID</Label>
                <Input
                  className="h-8 text-xs"
                  placeholder="关联试卷UUID"
                  value={method.resourceConfig.paperId || ""}
                  onChange={e => onChange({ ...method, resourceConfig: { ...method.resourceConfig, paperId: e.target.value } })}
                />
              </div>
            )}
            {(method.methodKey === "quiz" || method.methodKey === "homework") && (
              <div>
                <Label className="text-xs">说明</Label>
                <Input
                  className="h-8 text-xs"
                  placeholder={method.methodKey === "quiz" ? "随堂测说明" : "作业要求说明"}
                  value={method.resourceConfig.description || ""}
                  onChange={e => onChange({ ...method, resourceConfig: { ...method.resourceConfig, description: e.target.value } })}
                />
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs font-semibold">评价维度</Label>
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-xs"
                onClick={() => onChange({
                  ...method,
                  evalPoints: [...method.evalPoints, {
                    id: generateId(),
                    name: "新维度",
                    weight: 0,
                    scoringMethod: "score" as const,
                    gradeMapping: method.gradeMapping,
                  }]
                })}
              >
                <Plus className="h-3 w-3 mr-1" />添加维度
              </Button>
            </div>
            <div className="space-y-2">
              {method.evalPoints.map((point, idx) => (
                <div key={point.id} className="flex items-center gap-2 p-2 rounded bg-slate-50 border border-slate-100">
                  <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                  <Input
                    className="h-7 text-xs flex-1"
                    placeholder="维度名称"
                    value={point.name}
                    onChange={e => {
                      const newPoints = [...method.evalPoints]
                      newPoints[idx] = { ...newPoints[idx], name: e.target.value }
                      onChange({ ...method, evalPoints: newPoints })
                    }}
                  />
                  <Input
                    type="number"
                    className="h-7 text-xs w-16"
                    placeholder="权重"
                    value={point.weight || ""}
                    onChange={e => {
                      const newPoints = [...method.evalPoints]
                      newPoints[idx] = { ...newPoints[idx], weight: parseInt(e.target.value) || 0 }
                      onChange({ ...method, evalPoints: newPoints })
                    }}
                  />
                  <span className="text-xs text-muted-foreground w-6">%</span>
                  <Select
                    value={point.scoringMethod}
                    onValueChange={(v: "level" | "score" | "pass_fail") => {
                      const newPoints = [...method.evalPoints]
                      newPoints[idx] = { ...newPoints[idx], scoringMethod: v }
                      onChange({ ...method, evalPoints: newPoints })
                    }}
                  >
                    <SelectTrigger className="h-7 text-xs w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="level">等级制</SelectItem>
                      <SelectItem value="score">分数制</SelectItem>
                      <SelectItem value="pass_fail">通过/不通过</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-red-400 hover:text-red-600"
                    onClick={() => onChange({ ...method, evalPoints: method.evalPoints.filter((_, i) => i !== idx) })}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}

function GradeMappingEditor({
  mapping,
  onChange,
}: {
  mapping: GradeLevel[]
  onChange: (m: GradeLevel[]) => void
}) {
  const grades = mapping.length > 0 ? mapping : DEFAULT_GRADE_MAPPING

  return (
    <div className="space-y-2">
      {grades.map((g, idx) => (
        <div key={g.grade} className="flex items-center gap-2">
          <Badge className={`w-8 h-6 flex items-center justify-center text-xs font-bold text-white ${g.color}`}>{g.grade}</Badge>
          <div className="flex items-center gap-1 flex-1">
            <Input
              type="number"
              className="h-7 text-xs w-16"
              placeholder="最低分"
              value={g.minScore}
              onChange={e => {
                const next = [...grades]
                next[idx] = { ...next[idx], minScore: parseInt(e.target.value) || 0 }
                onChange(next)
              }}
            />
            <span className="text-xs text-muted-foreground">-</span>
            <Input
              type="number"
              className="h-7 text-xs w-16"
              placeholder="最高分"
              value={g.maxScore}
              onChange={e => {
                const next = [...grades]
                next[idx] = { ...next[idx], maxScore: parseInt(e.target.value) || 0 }
                onChange(next)
              }}
            />
            <span className="text-xs text-muted-foreground">分</span>
          </div>
          <Select
            value={g.color}
            onValueChange={(v) => {
              const next = [...grades]
              next[idx] = { ...next[idx], color: v }
              onChange(next)
            }}
          >
            <SelectTrigger className="h-7 w-8 p-0 [&>span]:hidden">
              <div className={`w-4 h-4 rounded-full ${g.color}`} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bg-green-500">A (绿色)</SelectItem>
              <SelectItem value="bg-blue-500">B (蓝色)</SelectItem>
              <SelectItem value="bg-yellow-500">C (黄色)</SelectItem>
              <SelectItem value="bg-red-500">D (红色)</SelectItem>
            </SelectContent>
          </Select>
          {grades.length > 1 && (
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-400" onClick={() => onChange(grades.filter((_, i) => i !== idx))}>
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      ))}
      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => {
        const letters = "ABCDEFGH".split("")
        const used = new Set(grades.map(g => g.grade))
        const next = letters.find(l => !used.has(l)) || "X"
        onChange([...grades, { grade: next, minScore: 0, maxScore: 0, color: "bg-slate-400" }])
      }}>
        <Plus className="h-3 w-3 mr-1" />添加等级
      </Button>
    </div>
  )
}
