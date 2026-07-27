"use client"

import { useState } from "react"
import {
  Database, ClipboardList, FileQuestion, Gavel, FolderCheck, BookOpen,
  Plus, X, CheckCircle2, RotateCcw, Target, Search, Users, UserCheck, User,
  Package, Shield, ArrowRight, Clock,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

type EvalMethodKey = "question_bank" | "paper" | "quiz" | "random_draw" | "review" | "outcome" | "homework"

interface EvaluationMethodOption {
  key: EvalMethodKey | string
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
  { key: "wms_inbound", label: "WMS(入库单)自动化评分", icon: <Package className="h-5 w-5" />, color: "bg-indigo-50 text-indigo-600 border-indigo-200", available: false, desc: "基于 WMS 入库单操作的自动化评分", primaryCategory: "industry", secondaryCategory: "智慧物流" },
  { key: "wms_outbound", label: "WMS(出库单)自动化评分", icon: <Package className="h-5 w-5" />, color: "bg-indigo-50 text-indigo-600 border-indigo-200", available: false, desc: "基于 WMS 出库单操作的自动化评分", primaryCategory: "industry", secondaryCategory: "智慧物流" },
  { key: "wms_wave", label: "WMS(波次分拣)自动化评分", icon: <Package className="h-5 w-5" />, color: "bg-indigo-50 text-indigo-600 border-indigo-200", available: false, desc: "基于 WMS 波次分拣操作的自动化评分", primaryCategory: "industry", secondaryCategory: "智慧物流" },
  { key: "network_traffic", label: "网络流量分析自助评价", icon: <Shield className="h-5 w-5" />, color: "bg-emerald-50 text-emerald-600 border-emerald-200", available: false, desc: "基于网络流量分析的自助评价", primaryCategory: "industry", secondaryCategory: "网络安全" },
  { key: "cyber_range", label: "网络靶场自助评价", icon: <Shield className="h-5 w-5" />, color: "bg-emerald-50 text-emerald-600 border-emerald-200", available: false, desc: "基于网络靶场环境的自助评价", primaryCategory: "industry", secondaryCategory: "网络安全" },
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

type EvalObjectType = "individual" | "group"

interface EvalSubjectConfig {
  type: "teacher" | "enterprise_mentor" | "peer" | "self"
  enabled: boolean
  weightPercent: number
  params?: Record<string, any>
}

interface MethodConfig {
  evalObject?: EvalObjectType
  evalSubjects?: EvalSubjectConfig[]
  evaluationMode: "rubric" | "score_rule"
  evalPoints: EvalPoint[]
  scoreRuleItems: ScoreRuleItem[]
  resourceConfig: Record<string, any>
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

const DEFAULT_GRADE: GradeMappingItem[] = [
  { id: "grade-1", grade: "A", minScore: 90, maxScore: 100, remark: "表现卓越" },
  { id: "grade-2", grade: "B", minScore: 75, maxScore: 89, remark: "表现良好" },
  { id: "grade-3", grade: "C", minScore: 60, maxScore: 74, remark: "基本达标" },
  { id: "grade-4", grade: "D", minScore: 0, maxScore: 59, remark: "未达标" },
]

const DEFAULT_SUBJECTS: EvalSubjectConfig[] = [
  { type: "teacher", enabled: true, weightPercent: 50, params: { minTeachingYears: 3 } },
  { type: "enterprise_mentor", enabled: true, weightPercent: 30, params: { minYears: 3 } },
  { type: "self", enabled: false, weightPercent: 0, params: {} },
  { type: "peer", enabled: false, weightPercent: 0, params: {} },
]

const SUBJECT_LABELS: Record<string, string> = { teacher: "教师评价", enterprise_mentor: "企业导师评价", self: "学生自评", peer: "学生互评" }
const OBJECT_OPTIONS = [
  { key: "individual" as const, label: "个人", desc: "以学生个人为单位进行测评" },
  { key: "group" as const, label: "小组", desc: "以小组为单位进行测评" },
]

const PRIMARY_TABS = [
  { key: "platform" as const, label: "平台通用" },
  { key: "industry" as const, label: "行业专属" },
]
const SECONDARY_TABS: Record<string, string[]> = {
  platform: ["全部", "知识评价", "过程评价", "成果评价"],
  industry: ["全部", "智慧物流", "网络安全"],
}

const DEFAULT_RESOURCE_CONFIGS: Record<string, any> = {
  review: { materialType: "project_report", submitFormatDesc: "请提交 PDF 格式的项目报告。", deadlineDays: 7, allowResubmit: false },
  outcome: { materialType: "project_report", submitFormatDesc: "请提交 PDF 格式的成果材料。", deadlineDays: 7, allowResubmit: false },
  homework: { materialType: "homework_file", submitFormatDesc: "请提交 PDF 或 DOCX 格式的作业文件。", deadlineDays: 7, allowResubmit: false },
  random_draw: { questionCount: 5, difficulty: "mixed" },
}

const ALLOWED_SUBJECTS_FOR_METHOD: Record<string, string[]> = {
  paper: ["teacher", "enterprise_mentor"],
  question_bank: ["teacher", "enterprise_mentor"],
  quiz: ["teacher", "enterprise_mentor"],
  random_draw: ["teacher", "enterprise_mentor", "self", "peer"],
  review: ["teacher", "enterprise_mentor", "self", "peer"],
  outcome: ["teacher", "enterprise_mentor"],
  homework: ["teacher", "enterprise_mentor"],
}

export function CourseEvalConfig({ value, onChange }: CourseEvalConfigProps) {
  const methods = value?.methods || []
  const configs = value?.methodConfigs || {}

  const [primaryTab, setPrimaryTab] = useState<"platform" | "industry">("platform")
  const [secondaryTab, setSecondaryTab] = useState("全部")

  const [erDialogOpen, setErDialogOpen] = useState<"object" | "subject" | "resource" | "method" | null>(null)
  const [erDialogMethod, setErDialogMethod] = useState<EvalMethodKey | null>(null)

  const [gradeMappingDialogOpen, setGradeMappingDialogOpen] = useState(false)
  const [editingGradeMapping, setEditingGradeMapping] = useState<GradeMappingItem[]>([])

  const updateConfig = (key: EvalMethodKey, updates: Partial<MethodConfig>) => {
    onChange?.({ methods, methodConfigs: { ...configs, [key]: { ...configs[key], ...updates } } })
  }

  const toggleMethod = (key: EvalMethodKey) => {
    const opt = EVALUATION_METHOD_OPTIONS.find(o => o.key === key)
    if (!opt || !opt.available) return
    const enabled = methods.includes(key)
    const newMethods = enabled ? methods.filter(m => m !== key) : [...methods, key]
    const newConfigs = { ...configs }
    if (!enabled && !newConfigs[key]) {
      newConfigs[key] = {
        evalObject: "individual",
        evalSubjects: JSON.parse(JSON.stringify(DEFAULT_SUBJECTS)),
        evaluationMode: key === "homework" ? "score_rule" : "rubric",
        evalPoints: [{ id: generateId(), name: "", weight: 0, gradeMapping: DEFAULT_GRADE }],
        scoreRuleItems: key === "homework" ? [{ id: generateId(), name: "", rule: "", weight: 0 }] : [],
        resourceConfig: { ...(DEFAULT_RESOURCE_CONFIGS[key] || {}) },
      }
    }
    onChange?.({ methods: newMethods, methodConfigs: newConfigs })
  }

  const openDialog = (type: "object" | "subject" | "resource" | "method", key: EvalMethodKey) => {
    setErDialogMethod(key)
    setErDialogOpen(type)
  }

  const secondaryTabs = SECONDARY_TABS[primaryTab]
  const filteredMethods = EVALUATION_METHOD_OPTIONS.filter(m => {
    if (m.primaryCategory !== primaryTab) return false
    if (secondaryTab === "全部") return true
    return m.secondaryCategory === secondaryTab
  })

  const getMethodConfigSummary = (key: EvalMethodKey) => {
    const cfg = configs[key]
    if (!cfg) return { configured: false, summary: "未配置" }
    if (key === "question_bank" || key === "quiz") {
      return {
        configured: !!(cfg.resourceConfig?.bankId || cfg.resourceConfig?.questionCount),
        summary: cfg.resourceConfig?.bankId ? `题库 ${cfg.resourceConfig.questionCount || 0} 题` : "未配置题库"
      }
    }
    if (key === "paper") {
      return {
        configured: !!cfg.resourceConfig?.paperId,
        summary: cfg.resourceConfig?.paperId ? "已选试卷" : "未选试卷"
      }
    }
    if (key === "random_draw") {
      return {
        configured: !!cfg.resourceConfig?.questionCount,
        summary: `抽 ${cfg.resourceConfig?.questionCount || 0} 题`
      }
    }
    if (key === "review" || key === "outcome") {
      return {
        configured: !!cfg.resourceConfig?.materialType,
        summary: "已配置评审材料"
      }
    }
    if (key === "homework") {
      return {
        configured: !!cfg.resourceConfig?.materialType,
        summary: "已配置作业要求"
      }
    }
    return { configured: false, summary: "未配置" }
  }

  const erDialogMethodOption = erDialogMethod ? EVALUATION_METHOD_OPTIONS.find(o => o.key === erDialogMethod) : null
  const erDialogConfig = erDialogMethod ? configs[erDialogMethod] : null

  return (
    <div className="space-y-4">
      {/* 分类 tabs */}
      <div className="flex items-center gap-2 border-b pb-2">
        {PRIMARY_TABS.map(tab => (
          <button key={tab.key} onClick={() => { setPrimaryTab(tab.key); setSecondaryTab("全部") }}
            className={cn("px-4 py-1.5 rounded-full text-sm font-medium transition-colors", primaryTab === tab.key ? "bg-primary text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200")}>
            {tab.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        {secondaryTabs.map(tab => (
          <button key={tab} onClick={() => setSecondaryTab(tab)}
            className={cn("px-3 py-1 rounded-md text-xs font-medium transition-colors border", secondaryTab === tab ? "border-primary text-primary bg-primary/5" : "border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50")}>
            {tab}
          </button>
        ))}
      </div>

      {/* 测评方式网格 */}
      <div className="grid grid-cols-2 gap-2">
        {filteredMethods.map(method => {
          const enabled = methods.includes(method.key as EvalMethodKey)
          return (
            <button key={method.key} disabled={!method.available} onClick={() => toggleMethod(method.key as EvalMethodKey)}
              className={cn("p-2.5 rounded-lg border text-left transition-all flex flex-col gap-1.5 relative overflow-hidden",
                !method.available ? "opacity-50 cursor-not-allowed bg-white border-gray-200" :
                enabled ? "border-primary bg-white ring-1 ring-primary/20 shadow-sm" : "border-gray-200 hover:border-primary/40 bg-white hover:shadow-sm")}>
              {!method.available && <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20"><span className="text-xl font-bold text-gray-300/60 rotate-[-12deg] select-none border-2 border-gray-300/40 px-3 py-1 rounded">未开通</span></div>}
              <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-2.5">
                  <div className={cn("p-2 rounded-lg", method.available ? method.color : "bg-gray-100 text-gray-400")}>{method.icon}</div>
                  <div><p className={cn("text-sm font-semibold", !method.available && "text-gray-400")}>{method.label}</p><p className="text-[11px] text-gray-400 mt-0.5">{method.desc}</p></div>
                </div>
                <div className="flex items-center gap-1.5">
                  {enabled && <div className="flex items-center gap-1.5 text-primary text-xs font-medium bg-primary/5 px-2 py-1 rounded-full"><CheckCircle2 className="h-3.5 w-3.5" />已开通</div>}
                  {!method.available && <Badge variant="outline" className="text-[10px] text-gray-400 border-gray-300 bg-white">未开通</Badge>}
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* 已选方法 4-step 卡片 */}
      {methods.filter(k => EVALUATION_METHOD_OPTIONS.find(o => o.key === k)?.available).length > 0 && (
        <div className="space-y-5 pt-2 border-t">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">已选方法配置</Label>
          {methods.filter(k => EVALUATION_METHOD_OPTIONS.find(o => o.key === k)?.available).map(methodKey => {
            const method = EVALUATION_METHOD_OPTIONS.find(o => o.key === methodKey)!
            const cfg = configs[methodKey as EvalMethodKey]

            const ObjectCard = ({ onClick }: { onClick: () => void }) => {
              const obj = cfg?.evalObject || "individual"
              const opt = OBJECT_OPTIONS.find(o => o.key === obj)
              return (
                <button onClick={onClick} className="flex-1 min-w-0 p-4 rounded-xl border text-left transition-all hover:border-primary/50 hover:bg-primary/[0.02] bg-white group">
                  <div className="flex items-center gap-2 mb-2"><Users className="h-4 w-4 text-gray-400 group-hover:text-primary" /><span className="text-xs font-medium text-gray-500">测评对象</span></div>
                  <p className="text-sm font-semibold truncate">{opt?.label || "未选择"}</p>
                  <p className="text-xs text-gray-400 truncate mt-0.5">{opt?.desc || "点击配置"}</p>
                </button>
              )
            }

            const SubjectCard = ({ onClick }: { onClick: () => void }) => {
              const subjects = cfg?.evalSubjects || DEFAULT_SUBJECTS
              const obj = cfg?.evalObject || "individual"
              const enabled = subjects.filter(s => s.enabled && !(s.type === "peer" && obj !== "group"))
              const totalWeight = enabled.reduce((s, sub) => s + (sub.weightPercent || 0), 0)
              return (
                <button onClick={onClick} className="flex-1 min-w-0 p-4 rounded-xl border text-left transition-all hover:border-primary/50 hover:bg-primary/[0.02] bg-white group">
                  <div className="flex items-center justify-between mb-2"><div className="flex items-center gap-2"><UserCheck className="h-4 w-4 text-gray-400 group-hover:text-primary" /><span className="text-xs font-medium text-gray-500">评价主体</span></div>{enabled.length > 0 && <Badge variant="outline" className="text-[10px]">{enabled.length} 类</Badge>}</div>
                  <p className="text-sm font-semibold truncate">{enabled.length === 0 ? "未配置" : enabled.map(s => SUBJECT_LABELS[s.type]).join("、")}</p>
                  <p className="text-xs text-gray-400 truncate mt-0.5">{enabled.length === 0 ? "点击配置" : `总权重 ${totalWeight}%`}</p>
                </button>
              )
            }

            const ResourceCard = ({ onClick }: { onClick: () => void }) => {
              const summary = getMethodConfigSummary(methodKey as EvalMethodKey)
              return (
                <button onClick={onClick} className="flex-1 min-w-0 p-4 rounded-xl border text-left transition-all hover:border-primary/50 hover:bg-primary/[0.02] bg-white group">
                  <div className="flex items-center justify-between mb-2"><div className="flex items-center gap-2"><Database className="h-4 w-4 text-gray-400 group-hover:text-primary" /><span className="text-xs font-medium text-gray-500">测评资源</span></div>{summary.configured && <CheckCircle2 className="h-3.5 w-3.5 text-primary" />}</div>
                  <p className="text-sm font-semibold truncate">{summary.summary || "未配置"}</p>
                  <p className="text-xs text-gray-400 truncate mt-0.5">&nbsp;</p>
                </button>
              )
            }

            const MethodCard = ({ onClick }: { onClick: () => void }) => {
              const isScoreRule = cfg?.evaluationMode === "score_rule"
              const hasManual = isScoreRule ? (cfg?.scoreRuleItems?.length || 0) > 0 : (cfg?.evalPoints?.length || 0) > 0
              const count = isScoreRule ? (cfg?.scoreRuleItems?.length || 0) : (cfg?.evalPoints?.length || 0)
              const label = isScoreRule ? "评价项" : "评价点"
              const title = hasManual ? (cfg?.resourceConfig?.rubricName || "自定义评价标准") : "未配置评价点"
              return (
                <button onClick={onClick} className="flex-1 min-w-0 p-4 rounded-xl border text-left transition-all hover:border-primary/50 hover:bg-primary/[0.02] bg-white group">
                  <div className="flex items-center justify-between mb-2"><div className="flex items-center gap-2"><Target className="h-4 w-4 text-gray-400 group-hover:text-primary" /><span className="text-xs font-medium text-gray-500">评价标准</span></div>{count > 0 && <Badge variant="outline" className="text-[10px]">{count} {label}{count > 0 ? "项" : ""}</Badge>}</div>
                  <p className="text-sm font-semibold truncate">{title}</p>
                  <p className="text-xs text-gray-400 truncate mt-0.5">{count > 0 ? `共 ${count} 个${label}` : "点击配置"}</p>
                </button>
              )
            }

            return (
              <div key={methodKey} className="border border-border rounded-xl p-5 bg-white shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className={cn("p-2 rounded-lg", method.color)}>{method.icon}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{method.label}</p>
                    <p className="text-xs text-gray-400">{method.desc}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <ObjectCard onClick={() => openDialog("object", methodKey as EvalMethodKey)} />
                  <div className="flex flex-col items-center justify-center text-gray-300 shrink-0 px-0.5"><span className="text-[10px] font-medium">①</span><ArrowRight className="h-3.5 w-3.5" /></div>
                  <SubjectCard onClick={() => openDialog("subject", methodKey as EvalMethodKey)} />
                  <div className="flex flex-col items-center justify-center text-gray-300 shrink-0 px-0.5"><span className="text-[10px] font-medium">②</span><ArrowRight className="h-3.5 w-3.5" /></div>
                  <ResourceCard onClick={() => openDialog("resource", methodKey as EvalMethodKey)} />
                  <div className="flex flex-col items-center justify-center text-gray-300 shrink-0 px-0.5"><span className="text-[10px] font-medium">③</span><ArrowRight className="h-3.5 w-3.5" /></div>
                  <MethodCard onClick={() => openDialog("method", methodKey as EvalMethodKey)} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 测评对象 Dialog */}
      <Dialog open={erDialogOpen === "object"} onOpenChange={v => !v && setErDialogOpen(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>配置测评对象</DialogTitle>
            <DialogDescription>配置 {erDialogMethodOption?.label} 的测评对象</DialogDescription>
          </DialogHeader>
          {erDialogMethod && erDialogConfig && (
            <div className="space-y-4 py-2">
              <p className="text-sm text-gray-500">选择本评价方式的测评对象类型</p>
              <div className="grid grid-cols-2 gap-4">
                {OBJECT_OPTIONS.map(opt => (
                  <button key={opt.key}
                    onClick={() => updateConfig(erDialogMethod, { evalObject: opt.key })}
                    className={cn("p-5 rounded-xl border text-left transition-all flex items-center gap-4",
                      erDialogConfig.evalObject === opt.key ? "border-primary bg-primary/[0.03] ring-1 ring-primary/20" : "border-gray-200 hover:border-gray-300 bg-white")}>
                    <div className={cn("p-3 rounded-lg", erDialogConfig.evalObject === opt.key ? "bg-primary/10 text-primary" : "bg-gray-100 text-gray-400")}>
                      <User className="h-6 w-6" />
                    </div>
                    <div><p className="text-sm font-semibold mb-1">{opt.label}</p><p className="text-xs text-gray-400">{opt.desc}</p></div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 评价主体 Dialog */}
      <Dialog open={erDialogOpen === "subject"} onOpenChange={v => !v && setErDialogOpen(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>评价主体配置</DialogTitle>
            <DialogDescription>配置 {erDialogMethodOption?.label} 的评价主体</DialogDescription>
          </DialogHeader>
          {erDialogMethod && erDialogConfig && (
            <div className="space-y-3 py-2">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">配置参与评价的主体及权重</p>
                <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => {
                  const subjects = erDialogConfig.evalSubjects || DEFAULT_SUBJECTS
                  const allowed = (ALLOWED_SUBJECTS_FOR_METHOD[erDialogMethod] || [])
                  const enabled = subjects.filter(s => s.enabled && allowed.includes(s.type))
                  const count = enabled.length
                  if (count === 0) return
                  const base = Math.floor(100 / count)
                  const rem = 100 % count
                  const newSubs = subjects.map((s, i) => {
                    if (!s.enabled || !allowed.includes(s.type)) return s
                    const idx = enabled.findIndex(e => e.type === s.type)
                    return { ...s, weightPercent: base + (idx < rem ? 1 : 0) }
                  })
                  updateConfig(erDialogMethod, { evalSubjects: newSubs })
                }}>一键平均权重</Button>
              </div>
              {DEFAULT_SUBJECTS.map(subject => {
                const idx = (erDialogConfig.evalSubjects || DEFAULT_SUBJECTS).findIndex(s => s.type === subject.type)
                const s = erDialogConfig.evalSubjects?.[idx] || subject
                const allowed = (ALLOWED_SUBJECTS_FOR_METHOD[erDialogMethod] || []).includes(subject.type)
                const peerAllowed = subject.type !== "peer" || erDialogConfig.evalObject === "group"
                const disabled = !allowed || !peerAllowed
                return (
                  <div key={subject.type} className={cn("flex items-center gap-4 p-3 rounded-lg border", disabled ? "opacity-50 bg-gray-50" : "bg-white")}>
                    <Switch checked={s.enabled} disabled={disabled}
                      onCheckedChange={v => {
                        const subs = [...(erDialogConfig.evalSubjects || DEFAULT_SUBJECTS)]
                        subs[idx] = { ...subs[idx], enabled: v, weightPercent: v ? (subs[idx].weightPercent || 25) : 0 }
                        updateConfig(erDialogMethod, { evalSubjects: subs })
                      }} />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{SUBJECT_LABELS[subject.type]}</p>
                      {disabled && <p className="text-xs text-gray-400">{!allowed ? "该方法不支持此评价主体" : "小组测评支持学生互评"}</p>}
                    </div>
                    {s.enabled && (
                      <div className="flex items-center gap-1">
                        <Input type="number" value={s.weightPercent || 0}
                          onChange={e => {
                            const subs = [...(erDialogConfig.evalSubjects || DEFAULT_SUBJECTS)]
                            subs[idx] = { ...subs[idx], weightPercent: Math.max(0, Math.min(100, parseInt(e.target.value) || 0)) }
                            updateConfig(erDialogMethod, { evalSubjects: subs })
                          }} className="h-7 w-16 text-xs text-center" />
                        <span className="text-xs text-gray-400">%</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 测评资源 Dialog */}
      <Dialog open={erDialogOpen === "resource"} onOpenChange={v => !v && setErDialogOpen(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>测评资源配置</DialogTitle>
            <DialogDescription>配置 {erDialogMethodOption?.label} 的测评资源</DialogDescription>
          </DialogHeader>
          {erDialogMethod && erDialogConfig && (
            <div className="space-y-4 py-2">
              {(erDialogMethod === "question_bank" || erDialogMethod === "quiz") && (
                <>
                  <div>
                    <Label className="text-xs text-gray-500">题库 ID</Label>
                    <Input className="mt-1 text-sm h-8" placeholder="关联题库 UUID" value={erDialogConfig.resourceConfig?.bankId || ""}
                      onChange={e => updateConfig(erDialogMethod, { resourceConfig: { ...erDialogConfig.resourceConfig, bankId: e.target.value } })} />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">抽题数量</Label>
                    <Input type="number" className="mt-1 text-sm h-8" placeholder="0" value={erDialogConfig.resourceConfig?.questionCount || ""}
                      onChange={e => updateConfig(erDialogMethod, { resourceConfig: { ...erDialogConfig.resourceConfig, questionCount: parseInt(e.target.value) || 0 } })} />
                  </div>
                </>
              )}
              {erDialogMethod === "paper" && (
                <div>
                  <Label className="text-xs text-gray-500">试卷 ID</Label>
                  <Input className="mt-1 text-sm h-8" placeholder="关联试卷 UUID" value={erDialogConfig.resourceConfig?.paperId || ""}
                    onChange={e => updateConfig(erDialogMethod, { resourceConfig: { ...erDialogConfig.resourceConfig, paperId: e.target.value } })} />
                </div>
              )}
              {(erDialogMethod === "review" || erDialogMethod === "outcome") && (
                <>
                  <div>
                    <Label className="text-xs text-gray-500">提交材料类型</Label>
                    <Input className="mt-1 text-sm h-8" placeholder={DEFAULT_RESOURCE_CONFIGS.review.materialType} value={erDialogConfig.resourceConfig?.materialType || ""}
                      onChange={e => updateConfig(erDialogMethod, { resourceConfig: { ...erDialogConfig.resourceConfig, materialType: e.target.value } })} />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">提交说明</Label>
                    <Input className="mt-1 text-sm h-8" placeholder={DEFAULT_RESOURCE_CONFIGS.review.submitFormatDesc} value={erDialogConfig.resourceConfig?.submitFormatDesc || ""}
                      onChange={e => updateConfig(erDialogMethod, { resourceConfig: { ...erDialogConfig.resourceConfig, submitFormatDesc: e.target.value } })} />
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <Label className="text-xs text-gray-500">截止天数</Label>
                      <Input type="number" className="mt-1 text-sm h-8" value={erDialogConfig.resourceConfig?.deadlineDays || ""}
                        onChange={e => updateConfig(erDialogMethod, { resourceConfig: { ...erDialogConfig.resourceConfig, deadlineDays: parseInt(e.target.value) || 0 } })} />
                    </div>
                    <div className="flex items-center gap-2 mt-6">
                      <Switch checked={!!erDialogConfig.resourceConfig?.allowResubmit}
                        onCheckedChange={v => updateConfig(erDialogMethod, { resourceConfig: { ...erDialogConfig.resourceConfig, allowResubmit: v } })} />
                      <Label className="text-xs">允许重新提交</Label>
                    </div>
                  </div>
                </>
              )}
              {erDialogMethod === "homework" && (
                <>
                  <div>
                    <Label className="text-xs text-gray-500">提交格式说明</Label>
                    <Input className="mt-1 text-sm h-8" placeholder={DEFAULT_RESOURCE_CONFIGS.homework.submitFormatDesc} value={erDialogConfig.resourceConfig?.submitFormatDesc || ""}
                      onChange={e => updateConfig(erDialogMethod, { resourceConfig: { ...erDialogConfig.resourceConfig, submitFormatDesc: e.target.value } })} />
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <Label className="text-xs text-gray-500">截止天数</Label>
                      <Input type="number" className="mt-1 text-sm h-8" value={erDialogConfig.resourceConfig?.deadlineDays || ""}
                        onChange={e => updateConfig(erDialogMethod, { resourceConfig: { ...erDialogConfig.resourceConfig, deadlineDays: parseInt(e.target.value) || 0 } })} />
                    </div>
                  </div>
                </>
              )}
              {erDialogMethod === "random_draw" && (
                <div>
                  <Label className="text-xs text-gray-500">抽题数量</Label>
                  <Input type="number" className="mt-1 text-sm h-8" placeholder="5" value={erDialogConfig.resourceConfig?.questionCount || ""}
                    onChange={e => updateConfig(erDialogMethod, { resourceConfig: { ...erDialogConfig.resourceConfig, questionCount: parseInt(e.target.value) || 0 } })} />
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 评价标准 Dialog */}
      <Dialog open={erDialogOpen === "method"} onOpenChange={v => !v && setErDialogOpen(null)}>
        <DialogContent className="sm:max-w-[85vw] max-w-[85vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>评价标准配置</DialogTitle>
            <DialogDescription>配置 {erDialogMethodOption?.label} 的评价点与评分规则</DialogDescription>
          </DialogHeader>
          {erDialogMethod && erDialogConfig && (
            <div className="space-y-5 py-2">
              <div className="border border-border rounded-xl p-5 bg-white shadow-sm">
                <p className="text-sm font-medium mb-3">评价标准信息</p>
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs text-gray-500">评价标准名称</Label>
                    <Input value={erDialogConfig.resourceConfig?.rubricName || ""} className="mt-1 text-sm" placeholder="输入评价标准名称"
                      onChange={e => updateConfig(erDialogMethod, { resourceConfig: { ...erDialogConfig.resourceConfig, rubricName: e.target.value } })} />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">评价标准类型</Label>
                    <div className="flex gap-3 mt-1">
                      {erDialogMethod !== "homework" && (
                        <button onClick={() => updateConfig(erDialogMethod, { evaluationMode: "rubric" })}
                          className={cn("px-3 py-1.5 rounded-lg text-xs border transition-all flex items-center gap-1.5",
                            erDialogConfig.evaluationMode === "rubric" ? "bg-primary/10 text-primary border-primary" : "bg-white text-gray-500 border-gray-200 hover:border-gray-300")}>
                          <div className={cn("w-3.5 h-3.5 rounded-full border flex items-center justify-center", erDialogConfig.evaluationMode === "rubric" ? "border-primary" : "border-gray-300")}>
                            {erDialogConfig.evaluationMode === "rubric" && <div className="w-2 h-2 rounded-full bg-primary" />}
                          </div>评价量规
                        </button>
                      )}
                      <button onClick={() => updateConfig(erDialogMethod, { evaluationMode: "score_rule" })}
                        className={cn("px-3 py-1.5 rounded-lg text-xs border transition-all flex items-center gap-1.5",
                          erDialogConfig.evaluationMode === "score_rule" ? "bg-primary/10 text-primary border-primary" : "bg-white text-gray-500 border-gray-200 hover:border-gray-300")}>
                        <div className={cn("w-3.5 h-3.5 rounded-full border flex items-center justify-center", erDialogConfig.evaluationMode === "score_rule" ? "border-primary" : "border-gray-300")}>
                          {erDialogConfig.evaluationMode === "score_rule" && <div className="w-2 h-2 rounded-full bg-primary" />}
                        </div>评分规则
                      </button>
                    </div>
                    {erDialogMethod === "homework" && <p className="text-[10px] text-gray-400 mt-1">作业测评仅需使用评分规则即可</p>}
                  </div>
                </div>
              </div>

              {/* 评价量规 */}
              {erDialogConfig.evaluationMode === "rubric" && (
                <div className="border rounded-xl p-4 overflow-hidden">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-medium">评价量规配置表</p>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => {
                        const pts = erDialogConfig.evalPoints; const count = pts.length
                        if (count === 0) return
                        const base = Math.floor(100 / count); const rem = 100 % count
                        updateConfig(erDialogMethod, { evalPoints: pts.map((p, i) => ({ ...p, weight: base + (i < rem ? 1 : 0) })) })
                      }}><RotateCcw className="h-3.5 w-3.5 mr-1" />一键均分</Button>
                      <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => updateConfig(erDialogMethod, {
                        evalPoints: [...erDialogConfig.evalPoints, { id: generateId(), name: "", weight: 0, gradeMapping: DEFAULT_GRADE }]
                      })}><Plus className="h-3.5 w-3.5 mr-1" />添加评价维度</Button>
                    </div>
                  </div>
                  <div className="overflow-x-auto max-w-full">
                    <table className="w-full text-sm border-collapse table-fixed">
                      <thead><tr className="border-b bg-gray-50 text-gray-500 text-xs">
                        <th className="py-2.5 px-2 text-left w-[8%]">序号</th>
                        <th className="py-2.5 px-2 text-left w-[45%]">评价维度名称</th>
                        <th className="py-2.5 px-2 text-right w-[27%]">评价等级</th>
                        <th className="py-2.5 px-2 text-center w-[12%]">权重(%)</th>
                        <th className="py-2.5 px-2 text-center w-[8%]">操作</th>
                      </tr></thead>
                      <tbody>
                        {erDialogConfig.evalPoints.map((ep, idx) => (
                          <tr key={ep.id} className="border-b hover:bg-gray-50/50 transition-colors">
                            <td className="py-3 px-2"><span className="text-gray-600 align-middle">{idx + 1}</span></td>
                            <td className="py-3 px-2">
                              <Input value={ep.name} className="h-8 text-sm"
                                onChange={e => { const pts = [...erDialogConfig.evalPoints]; pts[idx] = { ...pts[idx], name: e.target.value }; updateConfig(erDialogMethod, { evalPoints: pts }) }}
                                placeholder="维度名称和关联知识点/能力点" />
                            </td>
                            <td className="py-3 px-2">
                              <button onClick={() => { setEditingGradeMapping(ep.gradeMapping || []); setGradeMappingDialogOpen(true); }}
                                className="text-xs text-right text-primary hover:underline w-full block">
                                {ep.gradeMapping?.map(gm => (<div key={gm.id} className="truncate leading-relaxed" title={`${gm.grade} (${gm.minScore}-${gm.maxScore}分) ${gm.remark}`}>{gm.grade} ({gm.minScore}-{gm.maxScore}分) {gm.remark}</div>))}
                                {!ep.gradeMapping?.length && "点击配置评价等级"}
                              </button>
                            </td>
                            <td className="py-3 px-2">
                              <Input type="number" value={ep.weight || 0} className="h-8 text-sm text-center w-20"
                                onChange={e => { const pts = [...erDialogConfig.evalPoints]; pts[idx] = { ...pts[idx], weight: Math.max(0, Math.min(100, parseInt(e.target.value) || 0)) }; updateConfig(erDialogMethod, { evalPoints: pts }) }} />
                            </td>
                            <td className="py-3 px-2 text-center">
                              <button className="text-red-500 hover:text-red-600 text-xs"
                                onClick={() => updateConfig(erDialogMethod, { evalPoints: erDialogConfig.evalPoints.filter((_, i) => i !== idx) })}>删除</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-3 space-y-2">
                    <button onClick={() => updateConfig(erDialogMethod, { evalPoints: [...erDialogConfig.evalPoints, { id: generateId(), name: "", weight: 0, gradeMapping: DEFAULT_GRADE }] })}
                      className="w-full py-3 border-2 border-dashed border-gray-200 rounded-lg text-sm text-gray-500 hover:border-primary/40 hover:text-primary transition-colors flex items-center justify-center gap-1"><Plus className="h-4 w-4" />添加评价维度</button>
                    {erDialogConfig.evalPoints.length > 0 && (
                      <div className="flex justify-end text-xs items-center gap-1">
                        <span className="text-gray-500">维度权重合计：</span>
                        <span className={cn("font-semibold", (erDialogConfig.evalPoints.reduce((s, p) => s + (p.weight || 0), 0)) === 100 ? "text-green-600" : "text-red-500")}>{erDialogConfig.evalPoints.reduce((s, p) => s + (p.weight || 0), 0)}%</span>
                        {(erDialogConfig.evalPoints.reduce((s, p) => s + (p.weight || 0), 0)) !== 100 && <span className="text-red-500">⚠️（需等于100%）</span>}
                      </div>
                    )}
                  </div>
                  {erDialogConfig.evalPoints.length === 0 && (
                    <div className="text-center text-gray-400 py-8"><Target className="h-8 w-8 mx-auto mb-2 opacity-50" /><p className="text-sm">尚未添加评价点</p><p className="text-xs mt-1">点击上方按钮添加第一个评价点</p></div>
                  )}
                </div>
              )}

              {/* 评分规则 */}
              {erDialogConfig.evaluationMode === "score_rule" && (
                <div className="border rounded-xl p-4 overflow-hidden">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-medium">评分规则配置表</p>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => {
                        const items = erDialogConfig.scoreRuleItems || []; const count = items.length
                        if (count === 0) return; const base = Math.floor(100 / count); const rem = 100 % count
                        updateConfig(erDialogMethod, { scoreRuleItems: items.map((it, i) => ({ ...it, weight: base + (i < rem ? 1 : 0) })) })
                      }}><RotateCcw className="h-3.5 w-3.5 mr-1" />一键均分</Button>
                      <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => updateConfig(erDialogMethod, {
                        scoreRuleItems: [...(erDialogConfig.scoreRuleItems || []), { id: generateId(), name: "", rule: "", weight: 0 }]
                      })}><Plus className="h-3.5 w-3.5 mr-1" />添加评价项</Button>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse min-w-[700px]">
                      <thead><tr className="border-b bg-gray-50 text-gray-500 text-xs">
                        <th className="py-2.5 px-2 text-left w-16">序号</th>
                        <th className="py-2.5 px-2 text-left min-w-[300px]">评价项/评分标准描述</th>
                        <th className="py-2.5 px-2 text-left min-w-[200px]">加减分规则</th>
                        <th className="py-2.5 px-2 text-center w-20">分值</th>
                        <th className="py-2.5 px-2 text-center w-16">操作</th>
                      </tr></thead>
                      <tbody>
                        {(erDialogConfig.scoreRuleItems || []).map((item, idx) => (
                          <tr key={item.id} className="border-b hover:bg-gray-50/50 transition-colors">
                            <td className="py-3 px-2"><span className="text-gray-600 align-middle">{idx + 1}</span></td>
                            <td className="py-3 px-2"><Input value={item.name} className="h-8 text-sm" placeholder="评价项名称"
                              onChange={e => { const items = [...(erDialogConfig.scoreRuleItems || [])]; items[idx] = { ...items[idx], name: e.target.value }; updateConfig(erDialogMethod, { scoreRuleItems: items }) }} /></td>
                            <td className="py-3 px-2"><Input value={item.rule} className="h-8 text-sm" placeholder="评分规则描述"
                              onChange={e => { const items = [...(erDialogConfig.scoreRuleItems || [])]; items[idx] = { ...items[idx], rule: e.target.value }; updateConfig(erDialogMethod, { scoreRuleItems: items }) }} /></td>
                            <td className="py-3 px-2"><Input type="number" value={item.weight || 0} className="h-8 text-sm text-center w-20"
                              onChange={e => { const items = [...(erDialogConfig.scoreRuleItems || [])]; items[idx] = { ...items[idx], weight: parseInt(e.target.value) || 0 }; updateConfig(erDialogMethod, { scoreRuleItems: items }) }} /></td>
                            <td className="py-3 px-2 text-center"><button className="text-red-500 hover:text-red-600 text-xs"
                              onClick={() => updateConfig(erDialogMethod, { scoreRuleItems: (erDialogConfig.scoreRuleItems || []).filter((_, i) => i !== idx) })}>删除</button></td>
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
      <Dialog open={gradeMappingDialogOpen} onOpenChange={v => {
        if (!v) { setGradeMappingDialogOpen(false) }
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>配置评价等级</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            {editingGradeMapping.map((gm, idx) => (
              <div key={gm.id} className="flex items-center gap-3 p-3 rounded-lg border bg-slate-50">
                <Input className="h-8 w-16 text-sm" value={gm.grade}
                  onChange={e => { const next = [...editingGradeMapping]; next[idx] = { ...next[idx], grade: e.target.value }; setEditingGradeMapping(next) }} />
                <span className="text-xs text-gray-400">最小分</span>
                <Input type="number" className="h-8 w-20 text-sm" value={gm.minScore}
                  onChange={e => { const next = [...editingGradeMapping]; next[idx] = { ...next[idx], minScore: parseInt(e.target.value) || 0 }; setEditingGradeMapping(next) }} />
                <span className="text-xs text-gray-400">最大分</span>
                <Input type="number" className="h-8 w-20 text-sm" value={gm.maxScore}
                  onChange={e => { const next = [...editingGradeMapping]; next[idx] = { ...next[idx], maxScore: parseInt(e.target.value) || 0 }; setEditingGradeMapping(next) }} />
                <Input className="h-8 flex-1 text-sm" placeholder="说明" value={gm.remark || ""}
                  onChange={e => { const next = [...editingGradeMapping]; next[idx] = { ...next[idx], remark: e.target.value }; setEditingGradeMapping(next) }} />
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-400" onClick={() => setEditingGradeMapping(editingGradeMapping.filter((_, i) => i !== idx))}><X className="h-3.5 w-3.5" /></Button>
              </div>
            ))}
            <Button variant="outline" size="sm" className="w-full" onClick={() => {
              const letters = "ABCDEFGH".split(""); const used = new Set(editingGradeMapping.map(g => g.grade))
              const next = letters.find(l => !used.has(l)) || "X"
              setEditingGradeMapping([...editingGradeMapping, { id: generateId(), grade: next, minScore: 0, maxScore: 0, remark: "" }])
            }}><Plus className="h-3.5 w-3.5 mr-1" />添加等级</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
