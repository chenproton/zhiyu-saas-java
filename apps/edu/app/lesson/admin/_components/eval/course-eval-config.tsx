"use client"

import { useState, useRef } from "react"
import {
  Database, ClipboardList, FileQuestion, Gavel, FolderCheck, BookOpen,
  Plus, X, Trash2, CheckCircle2, RotateCcw, Target, Search,
  Package, Shield,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

type EvalMethodKey = "question_bank" | "paper" | "quiz" | "random_draw" | "review" | "outcome" | "homework"

interface EvaluationMethodOption {
  key: EvalMethodKey
  label: string
  icon: React.ReactNode
  color: string
  available: boolean
  desc: string
  primaryCategory: "platform" | "industry"
  secondaryCategory: string
}

const EVALUATION_METHOD_OPTIONS: EvaluationMethodOption[] = [
  { key: "question_bank", label: "题库", icon: <Database className="h-5 w-5" />, color: "bg-orange-50 text-orange-600 border-orange-200", available: true, desc: "从题库选题组成测评资源", primaryCategory: "platform", secondaryCategory: "知识评价" },
  { key: "paper", label: "试卷", icon: <ClipboardList className="h-5 w-5" />, color: "bg-green-50 text-green-600 border-green-200", available: true, desc: "使用固定试卷进行考核", primaryCategory: "platform", secondaryCategory: "知识评价" },
  { key: "quiz", label: "随堂测", icon: <FileQuestion className="h-5 w-5" />, color: "bg-red-50 text-red-600 border-red-200", available: true, desc: "课堂即时测验", primaryCategory: "platform", secondaryCategory: "知识评价" },
  { key: "random_draw", label: "现场问答", icon: <FileQuestion className="h-5 w-5" />, color: "bg-blue-50 text-blue-600 border-blue-200", available: true, desc: "从题库抽取题目，教师现场提问", primaryCategory: "platform", secondaryCategory: "过程评价" },
  { key: "review", label: "现场评审", icon: <Gavel className="h-5 w-5" />, color: "bg-purple-50 text-purple-600 border-purple-200", available: true, desc: "教师根据表现/材料给评价点打分", primaryCategory: "platform", secondaryCategory: "成果评价" },
  { key: "outcome", label: "成果评价", icon: <FolderCheck className="h-5 w-5" />, color: "bg-cyan-50 text-cyan-600 border-cyan-200", available: true, desc: "对学生成果进行评价", primaryCategory: "platform", secondaryCategory: "成果评价" },
  { key: "homework", label: "作业", icon: <BookOpen className="h-5 w-5" />, color: "bg-pink-50 text-pink-600 border-pink-200", available: true, desc: "学生提交作业进行评价", primaryCategory: "platform", secondaryCategory: "成果评价" },
  { key: "wms_inbound" as any, label: "WMS(入库单)自动化评分", icon: <Package className="h-5 w-5" />, color: "bg-indigo-50 text-indigo-600 border-indigo-200", available: false, desc: "基于 WMS 入库单操作的自动化评分", primaryCategory: "industry", secondaryCategory: "智慧物流" },
  { key: "wms_outbound" as any, label: "WMS(出库单)自动化评分", icon: <Package className="h-5 w-5" />, color: "bg-indigo-50 text-indigo-600 border-indigo-200", available: false, desc: "基于 WMS 出库单操作的自动化评分", primaryCategory: "industry", secondaryCategory: "智慧物流" },
  { key: "wms_wave" as any, label: "WMS(波次分拣)自动化评分", icon: <Package className="h-5 w-5" />, color: "bg-indigo-50 text-indigo-600 border-indigo-200", available: false, desc: "基于 WMS 波次分拣操作的自动化评分", primaryCategory: "industry", secondaryCategory: "智慧物流" },
  { key: "network_traffic" as any, label: "网络流量分析自助评价", icon: <Shield className="h-5 w-5" />, color: "bg-emerald-50 text-emerald-600 border-emerald-200", available: false, desc: "基于网络流量分析的自助评价", primaryCategory: "industry", secondaryCategory: "网络安全" },
  { key: "cyber_range" as any, label: "网络靶场自助评价", icon: <Shield className="h-5 w-5" />, color: "bg-emerald-50 text-emerald-600 border-emerald-200", available: false, desc: "基于网络靶场环境的自助评价", primaryCategory: "industry", secondaryCategory: "网络安全" },
]

interface GradeMappingItem {
  id: string
  grade: string
  minScore: number
  maxScore: number
  remark: string
}

interface EvalPoint {
  id: string
  name: string
  knowledgePointIds?: string[]
  abilityPointIds?: string[]
  weight: number
  gradeMapping: GradeMappingItem[]
}

interface ScoreRuleItem {
  id: string
  name: string
  rule: string
  weight: number
}

interface MethodConfig {
  methodKey: EvalMethodKey
  evaluationMode: "rubric" | "score_rule"
  evalPoints: EvalPoint[]
  scoreRuleItems: ScoreRuleItem[]
  methodResourceConfig?: Record<string, any>
}

export interface CourseEvalData {
  methods: EvalMethodKey[]
  methodConfigs: Record<string, MethodConfig>
}

interface CourseEvalConfigProps {
  value?: CourseEvalData
  onChange?: (data: CourseEvalData) => void
}

function generateId() { return `${Date.now()}-${Math.random().toString(36).slice(2, 6)}` }

function GradeMappingDialog({
  open,
  onOpenChange,
  gradeMapping,
  onChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  gradeMapping: GradeMappingItem[]
  onChange: (mapping: GradeMappingItem[]) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>配置评价等级</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {gradeMapping.map((gm, idx) => (
            <div key={gm.id} className="flex items-center gap-3 p-3 rounded-lg border bg-slate-50">
              <Input
                className="h-8 w-16 text-sm"
                value={gm.grade}
                onChange={e => {
                  const next = [...gradeMapping]
                  next[idx] = { ...next[idx], grade: e.target.value }
                  onChange(next)
                }}
              />
              <span className="text-xs text-gray-400">最小分</span>
              <Input
                type="number"
                className="h-8 w-20 text-sm"
                value={gm.minScore}
                onChange={e => {
                  const next = [...gradeMapping]
                  next[idx] = { ...next[idx], minScore: parseInt(e.target.value) || 0 }
                  onChange(next)
                }}
              />
              <span className="text-xs text-gray-400">最大分</span>
              <Input
                type="number"
                className="h-8 w-20 text-sm"
                value={gm.maxScore}
                onChange={e => {
                  const next = [...gradeMapping]
                  next[idx] = { ...next[idx], maxScore: parseInt(e.target.value) || 0 }
                  onChange(next)
                }}
              />
              <Input
                className="h-8 flex-1 text-sm"
                placeholder="说明"
                value={gm.remark || ""}
                onChange={e => {
                  const next = [...gradeMapping]
                  next[idx] = { ...next[idx], remark: e.target.value }
                  onChange(next)
                }}
              />
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-400" onClick={() => onChange(gradeMapping.filter((_, i) => i !== idx))}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" className="w-full" onClick={() => {
            const letters = "ABCDEFGH".split("")
            const used = new Set(gradeMapping.map(g => g.grade))
            const next = letters.find(l => !used.has(l)) || "X"
            onChange([...gradeMapping, { id: generateId(), grade: next, minScore: 0, maxScore: 0, remark: "" }])
          }}>
            <Plus className="h-3.5 w-3.5 mr-1" />添加等级
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

const PRIMARY_TABS = [
  { key: "platform" as const, label: "平台通用" },
  { key: "industry" as const, label: "行业专属" },
]

const SECONDARY_TABS: Record<string, string[]> = {
  platform: ["全部", "知识评价", "过程评价", "成果评价"],
  industry: ["全部", "智慧物流", "网络安全"],
}

const DEFAULT_GRADE: GradeMappingItem[] = [
  { id: "grade-1", grade: "A", minScore: 90, maxScore: 100, remark: "表现卓越" },
  { id: "grade-2", grade: "B", minScore: 75, maxScore: 89, remark: "表现良好" },
  { id: "grade-3", grade: "C", minScore: 60, maxScore: 74, remark: "基本达标" },
  { id: "grade-4", grade: "D", minScore: 0, maxScore: 59, remark: "未达标" },
]

export function CourseEvalConfig({ value, onChange }: CourseEvalConfigProps) {
  const methods = value?.methods || []
  const configs = value?.methodConfigs || {}
  const [primaryTab, setPrimaryTab] = useState<"platform" | "industry">("platform")
  const [secondaryTab, setSecondaryTab] = useState("全部")
  const [configDialogKey, setConfigDialogKey] = useState<EvalMethodKey | null>(null)
  const [gradeMappingDialogOpen, setGradeMappingDialogOpen] = useState(false)
  const [editingGradeMappingPointId, setEditingGradeMappingPointId] = useState<string | null>(null)
  const [editingGradeMapping, setEditingGradeMapping] = useState<GradeMappingItem[]>([])

  const secondaryTabs = SECONDARY_TABS[primaryTab]

  const toggleMethod = (key: EvalMethodKey) => {
    const opt = EVALUATION_METHOD_OPTIONS.find(o => o.key === key)
    if (!opt || !opt.available) return
    const enabled = methods.includes(key)
    const newMethods = enabled ? methods.filter(m => m !== key) : [...methods, key]
    const newConfigs = { ...configs }
    if (!enabled && !newConfigs[key]) {
      newConfigs[key] = {
        methodKey: key,
        evaluationMode: key === "homework" ? "score_rule" : "rubric",
        evalPoints: [
          { id: generateId(), name: "", knowledgePointIds: [], abilityPointIds: [], weight: 0, gradeMapping: DEFAULT_GRADE },
        ],
        scoreRuleItems: key === "homework" ? [{ id: generateId(), name: "", rule: "", weight: 0 }] : [],
        methodResourceConfig: {},
      }
    }
    onChange?.({ methods: newMethods, methodConfigs: newConfigs })
  }

  const updateConfig = (key: EvalMethodKey, updates: Partial<MethodConfig>) => {
    onChange?.({
      methods,
      methodConfigs: { ...configs, [key]: { ...configs[key], ...updates } }
    })
  }

  const selectedCount = methods.filter(m => {
    const opt = EVALUATION_METHOD_OPTIONS.find(o => o.key === m)
    return opt?.available
  }).length

  const filteredMethods = EVALUATION_METHOD_OPTIONS.filter(m => {
    if (m.primaryCategory !== primaryTab) return false
    if (secondaryTab === "全部") return true
    return m.secondaryCategory === secondaryTab
  })

  const configDialogMethod = configDialogKey ? EVALUATION_METHOD_OPTIONS.find(o => o.key === configDialogKey) : null
  const configDialogConfig = configDialogKey ? configs[configDialogKey] : null

  return (
    <div className="space-y-4">
      {/* 一级分类 */}
      <div className="flex items-center gap-2 border-b pb-2">
        {PRIMARY_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => { setPrimaryTab(tab.key); setSecondaryTab("全部") }}
            className={cn(
              "px-4 py-1.5 rounded-full text-sm font-medium transition-colors",
              primaryTab === tab.key ? "bg-primary text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >{tab.label}</button>
        ))}
      </div>

      {/* 二级分类 */}
      <div className="flex items-center gap-2">
        {secondaryTabs.map(tab => (
          <button
            key={tab}
            onClick={() => setSecondaryTab(tab)}
            className={cn(
              "px-3 py-1 rounded-md text-xs font-medium transition-colors border",
              secondaryTab === tab ? "border-primary text-primary bg-primary/5" : "border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50"
            )}
          >{tab}</button>
        ))}
      </div>

      {/* 测评方式网格 */}
      <div className="grid grid-cols-2 gap-2">
        {filteredMethods.map(method => {
          const enabled = methods.includes(method.key as EvalMethodKey)
          return (
            <button
              key={method.key}
              disabled={!method.available}
              onClick={() => toggleMethod(method.key as EvalMethodKey)}
              className={cn(
                "p-2.5 rounded-lg border text-left transition-all flex flex-col gap-1.5 relative overflow-hidden",
                !method.available
                  ? "opacity-50 cursor-not-allowed bg-white border-gray-200"
                  : enabled
                    ? "border-primary bg-white ring-1 ring-primary/20 shadow-sm"
                    : "border-gray-200 hover:border-primary/40 bg-white hover:shadow-sm"
              )}
            >
              {!method.available && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                  <span className="text-xl font-bold text-gray-300/60 rotate-[-12deg] select-none border-2 border-gray-300/40 px-3 py-1 rounded">未开通</span>
                </div>
              )}
              <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-2.5">
                  <div className={cn("p-2 rounded-lg", method.available ? method.color : "bg-gray-100 text-gray-400")}>{method.icon}</div>
                  <div>
                    <p className={cn("text-sm font-semibold", !method.available && "text-gray-400")}>{method.label}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">{method.desc}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {enabled && (
                    <div className="flex items-center gap-1.5 text-primary text-xs font-medium bg-primary/5 px-2 py-1 rounded-full">
                      <CheckCircle2 className="h-3.5 w-3.5" />已开通
                    </div>
                  )}
                  {!method.available && (
                    <Badge variant="outline" className="text-[10px] text-gray-400 border-gray-300 bg-white">未开通</Badge>
                  )}
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* 已选方法摘要 */}
      {selectedCount > 0 && (
        <div className="flex flex-wrap gap-2 pt-2 border-t">
          <span className="text-sm font-medium text-gray-600">已选方法：</span>
          {methods.map(key => {
            const opt = EVALUATION_METHOD_OPTIONS.find(o => o.key === key)
            if (!opt?.available) return null
            return (
              <button
                key={key}
                onClick={() => setConfigDialogKey(key as EvalMethodKey)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs border flex items-center gap-1.5 transition-all",
                  "border-primary/30 bg-primary/5 text-primary hover:bg-primary/10"
                )}
              >
                <div className={cn("p-0.5 rounded", opt.color)}>{opt.icon}</div>
                {opt.label}
                <span className="text-primary/50">配置 →</span>
              </button>
            )
          })}
        </div>
      )}

      {/* 测评方法配置 Dialog */}
      <Dialog open={configDialogKey !== null} onOpenChange={(v) => { if (!v) setConfigDialogKey(null) }}>
        <DialogContent className="sm:max-w-[900px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>配置 {configDialogMethod?.label} 的测评规则</DialogTitle>
          </DialogHeader>
          {configDialogConfig && configDialogKey && (
            <div className="space-y-5 py-2">
              {/* 资源库 & 试卷配置 */}
              {(configDialogKey === "question_bank" || configDialogKey === "random_draw") && (
                <div className="border border-border rounded-xl p-4 bg-white shadow-sm">
                  <p className="text-sm font-medium mb-3">测评资源</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-gray-500">题库 ID</Label>
                      <Input
                        className="mt-1 text-sm h-8"
                        placeholder="关联题库UUID"
                        value={configDialogConfig.methodResourceConfig?.bankId || ""}
                        onChange={e => updateConfig(configDialogKey, { methodResourceConfig: { ...configDialogConfig.methodResourceConfig, bankId: e.target.value } })}
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">抽题数量</Label>
                      <Input
                        type="number"
                        className="mt-1 text-sm h-8"
                        placeholder="0"
                        value={configDialogConfig.methodResourceConfig?.questionCount || ""}
                        onChange={e => updateConfig(configDialogKey, { methodResourceConfig: { ...configDialogConfig.methodResourceConfig, questionCount: parseInt(e.target.value) || 0 } })}
                      />
                    </div>
                  </div>
                </div>
              )}
              {configDialogKey === "paper" && (
                <div className="border border-border rounded-xl p-4 bg-white shadow-sm">
                  <p className="text-sm font-medium mb-3">试卷配置</p>
                  <div>
                    <Label className="text-xs text-gray-500">试卷 ID</Label>
                    <Input
                      className="mt-1 text-sm h-8"
                      placeholder="关联试卷UUID"
                      value={configDialogConfig.methodResourceConfig?.paperId || ""}
                      onChange={e => updateConfig(configDialogKey, { methodResourceConfig: { ...configDialogConfig.methodResourceConfig, paperId: e.target.value } })}
                    />
                  </div>
                </div>
              )}

              {/* 评价标准名称 + 类型 */}
              <div className="border border-border rounded-xl p-5 bg-white shadow-sm">
                <p className="text-sm font-medium mb-3">评价标准信息</p>
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs text-gray-500">评价标准名称</Label>
                    <Input
                      value={configDialogConfig.methodResourceConfig?.rubricName || ""}
                      onChange={e => updateConfig(configDialogKey, { methodResourceConfig: { ...configDialogConfig.methodResourceConfig, rubricName: e.target.value } })}
                      className="mt-1 text-sm"
                      placeholder="输入评价标准名称"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">评价标准类型</Label>
                    <div className="flex gap-3 mt-1">
                      {configDialogKey !== "homework" && (
                        <button
                          onClick={() => updateConfig(configDialogKey, { evaluationMode: "rubric" })}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-xs border transition-all flex items-center gap-1.5",
                            configDialogConfig.evaluationMode === "rubric" ? "bg-primary/10 text-primary border-primary" : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                          )}
                        >
                          <div className={cn("w-3.5 h-3.5 rounded-full border flex items-center justify-center", configDialogConfig.evaluationMode === "rubric" ? "border-primary" : "border-gray-300")}>
                            {configDialogConfig.evaluationMode === "rubric" && <div className="w-2 h-2 rounded-full bg-primary" />}
                          </div>
                          评价量规
                        </button>
                      )}
                      <button
                        onClick={() => updateConfig(configDialogKey, { evaluationMode: "score_rule" })}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-xs border transition-all flex items-center gap-1.5",
                          configDialogConfig.evaluationMode === "score_rule" ? "bg-primary/10 text-primary border-primary" : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                        )}
                      >
                        <div className={cn("w-3.5 h-3.5 rounded-full border flex items-center justify-center", configDialogConfig.evaluationMode === "score_rule" ? "border-primary" : "border-gray-300")}>
                          {configDialogConfig.evaluationMode === "score_rule" && <div className="w-2 h-2 rounded-full bg-primary" />}
                        </div>
                        评分规则
                      </button>
                    </div>
                    {configDialogKey === "homework" && (
                      <p className="text-[10px] text-gray-400 mt-1">作业测评仅需使用评分规则即可</p>
                    )}
                  </div>
                </div>
              </div>

              {/* 评价量规模式 */}
              {configDialogConfig.evaluationMode === "rubric" && (
                <div className="border rounded-xl p-4 overflow-hidden">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-medium">评价量规配置表</p>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => {
                        const pts = configDialogConfig.evalPoints
                        const count = pts.length
                        if (count === 0) return
                        const base = Math.floor(100 / count)
                        const remainder = 100 % count
                        updateConfig(configDialogKey, { evalPoints: pts.map((p, i) => ({ ...p, weight: base + (i < remainder ? 1 : 0) })) })
                      }}>
                        <RotateCcw className="h-3.5 w-3.5 mr-1" />一键均分
                      </Button>
                      <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => {
                        updateConfig(configDialogKey, {
                          evalPoints: [...configDialogConfig.evalPoints, {
                            id: generateId(), name: "", knowledgePointIds: [], abilityPointIds: [], weight: 0, gradeMapping: DEFAULT_GRADE
                          }]
                        })
                      }}>
                        <Plus className="h-3.5 w-3.5 mr-1" />添加评价维度
                      </Button>
                    </div>
                  </div>
                  <div className="overflow-x-auto max-w-full">
                    <table className="w-full text-sm border-collapse table-fixed">
                      <thead>
                        <tr className="border-b bg-gray-50 text-gray-500 text-xs">
                          <th className="py-2.5 px-2 text-left w-[8%]">序号</th>
                          <th className="py-2.5 px-2 text-left w-[45%]">评价维度名称</th>
                          <th className="py-2.5 px-2 text-right w-[27%]">评价等级</th>
                          <th className="py-2.5 px-2 text-center w-[12%]">权重(%)</th>
                          <th className="py-2.5 px-2 text-center w-[8%]">操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {configDialogConfig.evalPoints.map((ep, idx) => (
                          <tr key={ep.id} className="border-b hover:bg-gray-50/50 transition-colors">
                            <td className="py-3 px-2"><span className="text-gray-600 align-middle">{idx + 1}</span></td>
                            <td className="py-3 px-2">
                              <Input
                                value={ep.name}
                                onChange={e => {
                                  const pts = [...configDialogConfig.evalPoints]
                                  pts[idx] = { ...pts[idx], name: e.target.value }
                                  updateConfig(configDialogKey, { evalPoints: pts })
                                }}
                                className="h-8 text-sm"
                                placeholder="维度名称和关联知识点/能力点"
                              />
                            </td>
                            <td className="py-3 px-2">
                              <button
                                onClick={() => {
                                  setEditingGradeMapping(ep.gradeMapping || [])
                                  setEditingGradeMappingPointId(ep.id)
                                  setGradeMappingDialogOpen(true)
                                }}
                                className="text-xs text-right text-primary hover:underline w-full block"
                              >
                                {ep.gradeMapping?.map(gm => (
                                  <div key={gm.id} className="truncate leading-relaxed" title={`${gm.grade} (${gm.minScore}-${gm.maxScore}分) ${gm.remark}`}>
                                    {gm.grade} ({gm.minScore}-{gm.maxScore}分) {gm.remark}
                                  </div>
                                ))}
                                {!ep.gradeMapping?.length && "点击配置评价等级"}
                              </button>
                            </td>
                            <td className="py-3 px-2">
                              <Input
                                type="number"
                                value={ep.weight || 0}
                                onChange={e => {
                                  const pts = [...configDialogConfig.evalPoints]
                                  pts[idx] = { ...pts[idx], weight: Math.max(0, Math.min(100, parseInt(e.target.value) || 0)) }
                                  updateConfig(configDialogKey, { evalPoints: pts })
                                }}
                                className="h-8 text-sm text-center w-20"
                              />
                            </td>
                            <td className="py-3 px-2 text-center">
                              <button
                                className="text-red-500 hover:text-red-600 text-xs"
                                onClick={() => {
                                  updateConfig(configDialogKey, { evalPoints: configDialogConfig.evalPoints.filter((_, i) => i !== idx) })
                                }}
                              >删除</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-3 space-y-2">
                    <button
                      onClick={() => updateConfig(configDialogKey, {
                        evalPoints: [...configDialogConfig.evalPoints, {
                          id: generateId(), name: "", knowledgePointIds: [], abilityPointIds: [], weight: 0, gradeMapping: DEFAULT_GRADE
                        }]
                      })}
                      className="w-full py-3 border-2 border-dashed border-gray-200 rounded-lg text-sm text-gray-500 hover:border-primary/40 hover:text-primary transition-colors flex items-center justify-center gap-1"
                    >
                      <Plus className="h-4 w-4" />添加评价维度
                    </button>
                    {configDialogConfig.evalPoints.length > 0 && (
                      <div className="flex justify-end text-xs items-center gap-1">
                        <span className="text-gray-500">维度权重合计：</span>
                        <span className={cn("font-semibold", (configDialogConfig.evalPoints.reduce((sum, p) => sum + (p.weight || 0), 0)) === 100 ? "text-green-600" : "text-red-500")}>
                          {configDialogConfig.evalPoints.reduce((sum, p) => sum + (p.weight || 0), 0)}%
                        </span>
                        {(configDialogConfig.evalPoints.reduce((sum, p) => sum + (p.weight || 0), 0)) !== 100 && (
                          <span className="text-red-500">⚠️（需等于100%）</span>
                        )}
                      </div>
                    )}
                  </div>
                  {configDialogConfig.evalPoints.length === 0 && (
                    <div className="text-center text-gray-400 py-8">
                      <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">尚未添加评价点</p>
                      <p className="text-xs mt-1">点击上方按钮添加第一个评价点</p>
                    </div>
                  )}
                </div>
              )}

              {/* 评分规则模式 */}
              {configDialogConfig.evaluationMode === "score_rule" && (
                <div className="border rounded-xl p-4 overflow-hidden">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-medium">评分规则配置表</p>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => {
                        const items = configDialogConfig.scoreRuleItems || []
                        const count = items.length
                        if (count === 0) return
                        const base = Math.floor(100 / count)
                        const remainder = 100 % count
                        updateConfig(configDialogKey, { scoreRuleItems: items.map((it, i) => ({ ...it, weight: base + (i < remainder ? 1 : 0) })) })
                      }}>
                        <RotateCcw className="h-3.5 w-3.5 mr-1" />一键均分
                      </Button>
                      <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => {
                        updateConfig(configDialogKey, {
                          scoreRuleItems: [...(configDialogConfig.scoreRuleItems || []), { id: generateId(), name: "", rule: "", weight: 0 }]
                        })
                      }}>
                        <Plus className="h-3.5 w-3.5 mr-1" />添加评价项
                      </Button>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse min-w-[700px]">
                      <thead>
                        <tr className="border-b bg-gray-50 text-gray-500 text-xs">
                          <th className="py-2.5 px-2 text-left w-16">序号</th>
                          <th className="py-2.5 px-2 text-left min-w-[300px]">评价项/评分标准描述</th>
                          <th className="py-2.5 px-2 text-left min-w-[200px]">加减分规则</th>
                          <th className="py-2.5 px-2 text-center w-20">分值</th>
                          <th className="py-2.5 px-2 text-center w-16">操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(configDialogConfig.scoreRuleItems || []).map((item, idx) => (
                          <tr key={item.id} className="border-b hover:bg-gray-50/50 transition-colors">
                            <td className="py-3 px-2"><span className="text-gray-600 align-middle">{idx + 1}</span></td>
                            <td className="py-3 px-2">
                              <Input
                                value={item.name}
                                onChange={e => {
                                  const items = [...(configDialogConfig.scoreRuleItems || [])]
                                  items[idx] = { ...items[idx], name: e.target.value }
                                  updateConfig(configDialogKey, { scoreRuleItems: items })
                                }}
                                className="h-8 text-sm" placeholder="评价项名称"
                              />
                            </td>
                            <td className="py-3 px-2">
                              <Input
                                value={item.rule}
                                onChange={e => {
                                  const items = [...(configDialogConfig.scoreRuleItems || [])]
                                  items[idx] = { ...items[idx], rule: e.target.value }
                                  updateConfig(configDialogKey, { scoreRuleItems: items })
                                }}
                                className="h-8 text-sm" placeholder="评分规则描述"
                              />
                            </td>
                            <td className="py-3 px-2">
                              <Input
                                type="number"
                                value={item.weight || 0}
                                onChange={e => {
                                  const items = [...(configDialogConfig.scoreRuleItems || [])]
                                  items[idx] = { ...items[idx], weight: parseInt(e.target.value) || 0 }
                                  updateConfig(configDialogKey, { scoreRuleItems: items })
                                }}
                                className="h-8 text-sm text-center w-20"
                              />
                            </td>
                            <td className="py-3 px-2 text-center">
                              <button
                                className="text-red-500 hover:text-red-600 text-xs"
                                onClick={() => {
                                  updateConfig(configDialogKey, {
                                    scoreRuleItems: (configDialogConfig.scoreRuleItems || []).filter((_, i) => i !== idx)
                                  })
                                }}
                              >删除</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 等级映射 Dialog */}
      <GradeMappingDialog
        open={gradeMappingDialogOpen}
        onOpenChange={(v) => {
          if (!v) {
            if (configDialogKey && editingGradeMappingPointId) {
              const pts = configDialogConfig!.evalPoints.map(ep =>
                ep.id === editingGradeMappingPointId ? { ...ep, gradeMapping: editingGradeMapping } : ep
              )
              updateConfig(configDialogKey!, { evalPoints: pts })
            }
            setGradeMappingDialogOpen(false)
            setEditingGradeMappingPointId(null)
          }
        }}
        gradeMapping={editingGradeMapping}
        onChange={setEditingGradeMapping}
      />
    </div>
  )
}
