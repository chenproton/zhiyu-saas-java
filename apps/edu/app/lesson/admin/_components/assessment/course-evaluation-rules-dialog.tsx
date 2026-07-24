"use client"

import {
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Database,
  FileQuestion,
  FileText,
  Info,
  Lightbulb,
  ListOrdered,
  PenTool,
  Plus,
  RotateCcw,
  Scale,
  Search,
  Target,
  Trash2,
  X,
  Award,
  BookOpen,
  ClipboardList,
} from "lucide-react"
import { useMemo, useState, useRef, useLayoutEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import type { EvalPoint, GradeMapping, KnowledgePointItem } from "@/lib/types/lesson"

// ============ Types & Configs ============

type EvalObjectType = "individual" | "group"

interface EvalSubjectConfig {
  type: "teacher" | "enterprise_mentor" | "peer" | "self" | "ai" | "service_target"
  enabled: boolean
  params?: {
    teacherBackground?: string
    scorerCount?: number
    weightPercent?: number
    scoringDimensions?: string[]
    minTeachingYears?: number
    aggregationRule?: "average" | "median" | "max" | "min"
    expertise?: string
    minYears?: number
    companyType?: string
    jobExperience?: string
    peerCount?: number
    peerRule?: string
    anonymous?: boolean
    requiresReflection?: boolean
    reflectionMinLength?: number
    aiModel?: string
    confidenceThreshold?: number
    autoReview?: boolean
    serviceMethod?: string
    sampleSize?: number
  }
}

export interface CourseEvalRulesConfig {
  evaluationMethods: string[]
  methodWeights: Record<string, number>
  evalObject: EvalObjectType
  methodEvalObjects: Record<string, EvalObjectType>
  evalSubjects: EvalSubjectConfig[]
  methodEvalSubjects: Record<string, EvalSubjectConfig[]>
  randomDrawQuestions: string[]
  randomDrawCustomQuestions: { id: string; name: string; description: string; answer: string; major: string }[]
  randomDrawSelectedIds: string[]
  randomDrawEvalPoints: EvalPoint[]
  randomDrawScoreType: "eval_points" | "ability_levels"
  randomDrawRubricId: string | null
  reviewEvalPoints: EvalPoint[]
  reviewScoreType: "eval_points" | "ability_levels"
  reviewRubricId: string | null
  paperIds: string[]
  paperWeights: Record<string, number>
  paperEvalPoints: EvalPoint[]
  questionBankQuestions: string[]
  questionBankEvalPoints: EvalPoint[]
  outcomeEvalPoints: EvalPoint[]
  outcomeScoreType: "eval_points" | "ability_levels"
  outcomeRubricId: string | null
  homeworkEvalPoints: EvalPoint[]
  homeworkScoreType: "eval_points" | "ability_levels"
  homeworkRubricId: string | null
  quizQuestions: string[]
  quizEvalPoints: EvalPoint[]
  gradeMapping: GradeMapping[]
}

export interface AbilityPointItem {
  id: string
  name: string
  code?: string
  description?: string
}

interface CourseEvaluationRulesDialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  inline?: boolean
  evaluationMethods: string[]
  initialConfig?: Partial<CourseEvalRulesConfig>
  onChange?: (config: CourseEvalRulesConfig) => void
  title?: string
  knowledgePoints?: KnowledgePointItem[]
  abilityPoints?: AbilityPointItem[]
}

const evaluationMethodOptions = [
  { key: "question_bank", label: "题库", icon: <Database className="h-5 w-5" />, color: "bg-orange-50 text-orange-600 border-orange-200", available: true, desc: "从题库选题组成测评资源" },
  { key: "paper", label: "试卷", icon: <ClipboardList className="h-5 w-5" />, color: "bg-green-50 text-green-600 border-green-200", available: true, desc: "使用固定试卷进行考核" },
  { key: "random_draw", label: "现场问答", icon: <FileQuestion className="h-5 w-5" />, color: "bg-blue-50 text-blue-600 border-blue-200", available: true, desc: "从题库抽取题目，教师现场提问" },
  { key: "review", label: "现场评审", icon: <PenTool className="h-5 w-5" />, color: "bg-purple-50 text-purple-600 border-purple-200", available: true, desc: "教师根据表现/材料给评价点打分" },
  { key: "outcome", label: "成果评价", icon: <FileText className="h-5 w-5" />, color: "bg-cyan-50 text-cyan-600 border-cyan-200", available: true, desc: "对学生成果进行评价" },
  { key: "homework", label: "作业", icon: <BookOpen className="h-5 w-5" />, color: "bg-pink-50 text-pink-600 border-pink-200", available: true, desc: "学生提交作业进行评价" },
  { key: "quiz", label: "随堂测", icon: <FileQuestion className="h-5 w-5" />, color: "bg-red-50 text-red-600 border-red-200", available: true, desc: "课堂即时测验" },
]

const abilityLevels = ["了解", "理解", "掌握", "熟练", "精通"]

const defaultGradeMapping: GradeMapping[] = [
  { id: "grade-1", grade: "A", minScore: 90, maxScore: 100, color: "bg-green-500", remark: "表现卓越，完全超出预期要求，可作为标杆示范" },
  { id: "grade-2", grade: "B", minScore: 75, maxScore: 89, color: "bg-blue-500", remark: "表现良好，达到预期要求，仅有少量可改进之处" },
  { id: "grade-3", grade: "C", minScore: 60, maxScore: 74, color: "bg-yellow-500", remark: "基本达标，核心要求已满足，但存在明显不足" },
  { id: "grade-4", grade: "D", minScore: 0, maxScore: 59, color: "bg-red-500", remark: "未达标准，核心要求未完成，需要重新学习或训练" },
]

// 能力点数据应由父组件通过 abilityPoints 属性传入，默认空状态
const DEFAULT_ABILITY_POINTS: AbilityPointItem[] = []

type EvalSubType = "knowledge_mastery" | "operation_standard" | "task_completion" | "result_quality" | "communication" | "collaboration" | "professionalism" | "innovation" | "adaptability"

const evalSubTypeLabels: Record<EvalSubType, string> = {
  knowledge_mastery: "知识掌握",
  operation_standard: "操作规范",
  task_completion: "任务完成度",
  result_quality: "成果质量",
  communication: "沟通表达",
  collaboration: "协作能力",
  professionalism: "职业素养",
  innovation: "创新能力",
  adaptability: "应变能力",
}

const evalSubTypeColors: Record<EvalSubType, string> = {
  knowledge_mastery: "bg-blue-50 text-blue-600 border-blue-200",
  operation_standard: "bg-teal-50 text-teal-600 border-teal-200",
  task_completion: "bg-green-50 text-green-600 border-green-200",
  result_quality: "bg-cyan-50 text-cyan-600 border-cyan-200",
  communication: "bg-violet-50 text-violet-600 border-violet-200",
  collaboration: "bg-orange-50 text-orange-600 border-orange-200",
  professionalism: "bg-amber-50 text-amber-600 border-amber-200",
  innovation: "bg-indigo-50 text-indigo-600 border-indigo-200",
  adaptability: "bg-rose-50 text-rose-600 border-rose-200",
}

const defaultEvalSubjects: EvalSubjectConfig[] = [
  { type: "teacher", enabled: true, params: { teacherBackground: "计算机/软件工程相关专业", scorerCount: 2, weightPercent: 50, scoringDimensions: ["knowledge_mastery", "operation_standard", "task_completion", "result_quality"], minTeachingYears: 3 } },
  { type: "enterprise_mentor", enabled: true, params: { expertise: "网络安全 / 渗透测试", minYears: 5, scorerCount: 1, weightPercent: 20, companyType: "互联网/科技公司" } },
  { type: "self", enabled: true, params: { requiresReflection: true, weightPercent: 10, reflectionMinLength: 500 } },
  { type: "peer", enabled: false, params: { peerCount: 4, peerRule: "随机分配", anonymous: true, weightPercent: 15 } },
  { type: "ai", enabled: false, params: { aiModel: "GPT-4", weightPercent: 5, confidenceThreshold: 85, autoReview: true } },
  { type: "service_target", enabled: false, params: { serviceMethod: "满意度问卷", sampleSize: 20, weightPercent: 5 } },
]

// 默认评价点与试卷数据应由真实题库/试卷 API 提供，默认空状态
const defaultEvalPoints: EvalPoint[] = []

const paperMocks: { id: string; name: string; questionCount: number; totalScore: number }[] = []

const questionBankLabels: Record<string, string> = {
  frontend: "前端开发题库",
  backend: "后端开发题库",
  draft: "草稿库",
  public: "公共基础题库",
  professional: "专业技能题库",
}

type QuestionItem = {
  id: string
  name: string
  type: string
  difficulty: string
  score: number
  questionBank: string
  source: string
  content: string
}

// 题目数据应由真实题库 API 提供，默认空状态
const allQuestions: QuestionItem[] = []

type ScoreRuleItem = { id: string; name: string; desc: string; rule: string; weight: number }
type RubricScheme = { id: string; name: string; types: EvalSubType[]; desc: string; points: EvalPoint[]; mode: "rubric" | "score_rule"; scoreRuleItems?: ScoreRuleItem[] }

const initialRubricLibrary: RubricScheme[] = []

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`
}

function makeDefaultConfig(methods: string[]): CourseEvalRulesConfig {
  return {
    evaluationMethods: methods,
    methodWeights: methods.reduce((acc, m, i, arr) => {
      const base = Math.floor(100 / arr.length)
      acc[m] = base + (i < 100 % arr.length ? 1 : 0)
      return acc
    }, {} as Record<string, number>),
    evalObject: "individual",
    methodEvalObjects: {},
    evalSubjects: JSON.parse(JSON.stringify(defaultEvalSubjects)),
    methodEvalSubjects: {},
    randomDrawQuestions: allQuestions.slice(0, 2).map(q => q.id),
    randomDrawCustomQuestions: [],
    randomDrawSelectedIds: [],
    randomDrawEvalPoints: [],
    randomDrawScoreType: "eval_points",
    randomDrawRubricId: null,
    reviewEvalPoints: [],
    reviewScoreType: "eval_points",
    reviewRubricId: null,
    paperIds: [],
    paperWeights: {},
    paperEvalPoints: [],
    questionBankQuestions: [],
    questionBankEvalPoints: [],
    outcomeEvalPoints: [],
    outcomeScoreType: "eval_points",
    outcomeRubricId: null,
    homeworkEvalPoints: [],
    homeworkScoreType: "eval_points",
    homeworkRubricId: null,
    quizQuestions: [],
    quizEvalPoints: [],
    gradeMapping: JSON.parse(JSON.stringify(defaultGradeMapping)),
  }
}


export function CourseEvaluationRulesDialog({
  open,
  onOpenChange,
  inline,
  evaluationMethods,
  initialConfig,
  onChange,
  title = "配置课程评价规则",
  knowledgePoints: kpProp,
  abilityPoints: abProp,
}: CourseEvaluationRulesDialogProps) {
  const knowledgePoints = useMemo(() => kpProp || [], [kpProp])
  const abilityPoints = useMemo(() => abProp || DEFAULT_ABILITY_POINTS, [abProp])

  // Map "exam" (used by EvaluationMethodSelector in this project) to internal "homework" representation
  const normalizedEvalMethods = useMemo(() => evaluationMethods.map(m => m === "exam" ? "homework" : m), [evaluationMethods])

  const [config, setConfig] = useState<CourseEvalRulesConfig>(() => {
    const base = makeDefaultConfig(normalizedEvalMethods)
    return initialConfig ? { ...base, ...initialConfig, evaluationMethods: normalizedEvalMethods } : base
  })

  const updateConfig = (updates: Partial<CourseEvalRulesConfig>) => {
    setConfig(prev => {
      const next = { ...prev, ...updates }
      if (onChange) {
        const exportNext = { ...next, evaluationMethods: next.evaluationMethods.map(m => m === "homework" ? "exam" : m) }
        onChange(exportNext)
      }
      return next
    })
  }

  // Sync evaluationMethods from props
  if (JSON.stringify(config.evaluationMethods) !== JSON.stringify(normalizedEvalMethods)) {
    const next = makeDefaultConfig(normalizedEvalMethods)
    updateConfig(next)
  }

  // ============ Local UI states ============
  const [erDialogOpen, setErDialogOpen] = useState<"object" | "subject" | "resource" | "method" | null>(null)
  const [erDialogMethod, setErDialogMethod] = useState<string | null>(null)
  const [isOrderConfigOpen, setIsOrderConfigOpen] = useState(false)
  const [isWeightConfigOpen, setIsWeightConfigOpen] = useState(false)
  const [methodInstanceCounts, setMethodInstanceCounts] = useState<Record<string, number>>({})

  const [questionTab, setQuestionTab] = useState<"my" | "collab" | "public">("public")
  const [questionSearch, setQuestionSearch] = useState("")
  const [showAddQuestion, setShowAddQuestion] = useState(false)
  const [selectedQuestionForDetail, setSelectedQuestionForDetail] = useState<string | null>(null)
  const [questionDetailOpen, setQuestionDetailOpen] = useState(false)

  const [rdqSearch, setRdqSearch] = useState("")
  const [rdqActionOpen, setRdqActionOpen] = useState(false)
  const [rdqActionMode, setRdqActionMode] = useState<"add" | "edit">("add")
  const [rdqActionTarget, setRdqActionTarget] = useState<{ id: string; name: string; description: string; answer: string; major: string } | null>(null)
  const [newRdqForm, setNewRdqForm] = useState({ name: "", description: "", answer: "", major: "" })
  const [rdqDetailOpen, setRdqDetailOpen] = useState(false)
  const [selectedRdqForDetail, setSelectedRdqForDetail] = useState<string | null>(null)

  const [paperDetailOpen, setPaperDetailOpen] = useState(false)
  const [selectedPaperForDetail, setSelectedPaperForDetail] = useState<string | null>(null)
  const [showCreatePaper, setShowCreatePaper] = useState(false)
  const [newPaperName, setNewPaperName] = useState("")
  const [newPaperQuestionCount, setNewPaperQuestionCount] = useState(10)
  const [newPaperTotalScore, setNewPaperTotalScore] = useState(100)

  const [rubricKpDialogOpen, setRubricKpDialogOpen] = useState(false)
  const [rubricKpTargetPointId, setRubricKpTargetPointId] = useState<string | null>(null)
  const [rubricKpTargetField, setRubricKpTargetField] = useState<string | null>(null)
  const [rubricKpSearch, setRubricKpSearch] = useState("")
  const [rubricAbDialogOpen, setRubricAbDialogOpen] = useState(false)
  const [rubricAbTargetPointId, setRubricAbTargetPointId] = useState<string | null>(null)
  const [rubricAbTargetField, setRubricAbTargetField] = useState<string | null>(null)
  const [rubricAbSearch, setRubricAbSearch] = useState("")

  const [newPointName, setNewPointName] = useState("")
  const [editingRubricId, setEditingRubricId] = useState<string | null>(null)
  const [methodDialogViews, setMethodDialogViews] = useState<Record<string, "list" | "edit" | "template">>({})
  const [rubricLibrary, setRubricLibrary] = useState<RubricScheme[]>(initialRubricLibrary)

  const [reviewSteps, setReviewSteps] = useState([
    { id: "rs-1", label: "学生自评", desc: "学生根据量规进行自我评价", enabled: true, subjectType: "self", weight: 20 },
    { id: "rs-2", label: "小组互评", desc: "小组内成员互相评价", enabled: false, subjectType: "peer", weight: 0 },
    { id: "rs-3", label: "教师评审", desc: "教师根据提交材料和表现评分", enabled: true, subjectType: "teacher", weight: 80 },
  ])
  const [showAddStep, setShowAddStep] = useState(false)
  const [newStepLabel, setNewStepLabel] = useState("")
  const [newStepDesc, setNewStepDesc] = useState("")
  const [newStepSubjectType, setNewStepSubjectType] = useState("")
  const [editingReviewStepId, setEditingReviewStepId] = useState<string | null>(null)
  const [editingStepLabel, setEditingStepLabel] = useState("")
  const [editingStepDesc, setEditingStepDesc] = useState("")

  const [mockResReview, setMockResReview] = useState({ requiresMaterial: true, deadlineDays: 3, submitFormatDesc: "", venueResources: "", allowResubmit: false })
  const [mockResPaper, setMockResPaper] = useState({ duration: 60, allowRetake: false, retakeCount: 1, shuffleQuestions: true, showResult: true, activationMode: "manual" as "manual" | "scheduled" | "always", scheduledTime: "" })
  const [mockResQuestionBank, setMockResQuestionBank] = useState({ timeLimit: 30, allowRetake: true, retakeCount: 3, shuffleQuestions: true, showResult: true, questionScores: {} as Record<string, number> })

  // ============ Helpers ============
  const getMethodInstances = () => {
    const instances: { methodKey: string; instanceIndex: number }[] = []
    config.evaluationMethods.forEach(methodKey => {
      const count = methodInstanceCounts[methodKey] || 1
      for (let i = 0; i < count; i++) instances.push({ methodKey, instanceIndex: i })
    })
    return instances
  }

  const subjectLabels: Record<string, string> = {
    teacher: "教师", enterprise_mentor: "企业导师", self: "自评", peer: "互评", ai: "AI 评价", service_target: "服务对象",
  }

  const getMethodConfigSummary = (methodKey: string) => {
    switch (methodKey) {
      case "random_draw": return { title: "现场问答", summary: `${config.randomDrawSelectedIds.length} 题 / ${config.randomDrawEvalPoints.length} 个评价点`, configured: config.randomDrawSelectedIds.length > 0 || config.randomDrawEvalPoints.length > 0 }
      case "review": return { title: "现场评审", summary: `${config.reviewEvalPoints.length} 个评价点`, configured: config.reviewEvalPoints.length > 0 }
      case "paper": return { title: "试卷", summary: config.paperIds.length > 0 ? `已选 ${config.paperIds.length} 张试卷` : "未选择", configured: config.paperIds.length > 0 }
      case "question_bank": return { title: "题库", summary: `${config.questionBankQuestions.length} 题`, configured: config.questionBankQuestions.length > 0 }
      case "outcome": return { title: "成果评价", summary: `${config.outcomeEvalPoints.length} 个评价点`, configured: config.outcomeEvalPoints.length > 0 }
      case "homework": return { title: "作业", summary: `${config.homeworkEvalPoints.length} 个评价点`, configured: config.homeworkEvalPoints.length > 0 }
      case "quiz": return { title: "随堂测", summary: `${config.quizQuestions.length} 题`, configured: config.quizQuestions.length > 0 }
      default: return { title: "", summary: "", configured: false }
    }
  }

  const updateEvalSubject = (idx: number, updates: Partial<EvalSubjectConfig>) => {
    const newSubjects = [...config.evalSubjects]
    newSubjects[idx] = { ...newSubjects[idx], ...updates }
    updateConfig({ evalSubjects: newSubjects })
  }

  const updateMethodEvalSubject = (methodKey: string, idx: number, updates: Partial<EvalSubjectConfig>) => {
    const baseSubjects = config.methodEvalSubjects[methodKey] || config.evalSubjects
    const newSubjects = [...baseSubjects]
    newSubjects[idx] = { ...newSubjects[idx], ...updates }
    updateConfig({ methodEvalSubjects: { ...config.methodEvalSubjects, [methodKey]: newSubjects } })
  }

  type EvalPointField = "randomDrawEvalPoints" | "reviewEvalPoints" | "paperEvalPoints" | "questionBankEvalPoints" | "outcomeEvalPoints" | "homeworkEvalPoints" | "quizEvalPoints"

  const getEvalPoints = (field: EvalPointField) => {
    switch (field) {
      case "randomDrawEvalPoints": return config.randomDrawEvalPoints
      case "reviewEvalPoints": return config.reviewEvalPoints
      case "paperEvalPoints": return config.paperEvalPoints
      case "questionBankEvalPoints": return config.questionBankEvalPoints
      case "outcomeEvalPoints": return config.outcomeEvalPoints
      case "homeworkEvalPoints": return config.homeworkEvalPoints
      case "quizEvalPoints": return config.quizEvalPoints
    }
  }

  const setEvalPoints = (field: EvalPointField, points: EvalPoint[]) => {
    switch (field) {
      case "randomDrawEvalPoints": updateConfig({ randomDrawEvalPoints: points }); break
      case "reviewEvalPoints": updateConfig({ reviewEvalPoints: points }); break
      case "paperEvalPoints": updateConfig({ paperEvalPoints: points }); break
      case "questionBankEvalPoints": updateConfig({ questionBankEvalPoints: points }); break
      case "outcomeEvalPoints": updateConfig({ outcomeEvalPoints: points }); break
      case "homeworkEvalPoints": updateConfig({ homeworkEvalPoints: points }); break
      case "quizEvalPoints": updateConfig({ quizEvalPoints: points }); break
    }
  }

  const addEvalPoint = (field: EvalPointField, preset?: Partial<EvalPoint>) => {
    const name = preset ? (preset.name ?? newPointName.trim()) : newPointName.trim()
    if (!name && !preset) return
    const newPoint: EvalPoint = {
      id: uid("ep"),
      name: name || "未命名评价点",
      desc: preset?.desc || "",
      subType: preset?.subType,
      types: preset?.types,
      knowledgePointIds: preset?.knowledgePointIds,
      abilityPointIds: preset?.abilityPointIds,
      scoringMethod: preset?.scoringMethod || "level",
      gradeMapping: preset?.gradeMapping !== undefined ? preset.gradeMapping : (preset?.name === "" ? [] : JSON.parse(JSON.stringify(defaultGradeMapping))),
    }
    setEvalPoints(field, [...getEvalPoints(field), newPoint])
    setNewPointName("")
  }

  const removeEvalPoint = (field: EvalPointField, id: string) => {
    setEvalPoints(field, getEvalPoints(field).filter(p => p.id !== id))
  }

  const updateEvalPoint = (field: EvalPointField, id: string, updates: Partial<EvalPoint>) => {
    setEvalPoints(field, getEvalPoints(field).map(p => p.id === id ? { ...p, ...updates } : p))
  }

  const toggleQuestion = (qid: string, field: "randomDrawQuestions" | "questionBankQuestions" | "quizQuestions") => {
    const arr = field === "randomDrawQuestions" ? config.randomDrawQuestions : field === "quizQuestions" ? config.quizQuestions : config.questionBankQuestions
    const exists = arr.includes(qid)
    const newArr = exists ? arr.filter(x => x !== qid) : [...arr, qid]
    if (field === "randomDrawQuestions") updateConfig({ randomDrawQuestions: newArr })
    else if (field === "quizQuestions") updateConfig({ quizQuestions: newArr })
    else updateConfig({ questionBankQuestions: newArr })
  }

  const addEvalPointFromAbility = (field: EvalPointField, abilityId: string, subType?: EvalSubType) => {
    const ab = abilityPoints.find(a => a.id === abilityId)
    if (!ab) return
    addEvalPoint(field, { name: ab.name, desc: ab.description || "", abilityPointIds: [ab.id], subType, scoringMethod: "level" })
  }

  const addEvalPointFromKnowledge = (field: EvalPointField, kpId: string, subType?: EvalSubType) => {
    const kp = knowledgePoints.find(k => k.id === kpId)
    if (!kp) return
    addEvalPoint(field, { name: kp.name, desc: kp.description || "", knowledgePointIds: [kp.id], subType, scoringMethod: "level" })
  }

  const openDialog = (type: "object" | "subject" | "resource" | "method", methodKey: string) => {
    setErDialogMethod(methodKey)
    setErDialogOpen(type)
  }

  const methodWeightTotal = config.evaluationMethods.reduce((sum, m) => sum + (config.methodWeights[m] || 0), 0)

  const updateMethodWeight = (methodKey: string, value: number) => {
    updateConfig({ methodWeights: { ...config.methodWeights, [methodKey]: Math.max(0, Math.min(100, value)) } })
  }

  const distributeMethodWeights = () => {
    const count = config.evaluationMethods.length
    if (count === 0) return
    const base = Math.floor(100 / count)
    const remainder = 100 % count
    const newWeights: Record<string, number> = {}
    config.evaluationMethods.forEach((m, i) => { newWeights[m] = base + (i < remainder ? 1 : 0) })
    updateConfig({ methodWeights: newWeights })
  }

  const moveMethodUp = (index: number) => {
    if (index <= 0) return
    const newMethods = [...config.evaluationMethods]
    const temp = newMethods[index]
    newMethods[index] = newMethods[index - 1]
    newMethods[index - 1] = temp
    updateConfig({ evaluationMethods: newMethods })
  }

  const moveMethodDown = (index: number) => {
    if (index >= config.evaluationMethods.length - 1) return
    const newMethods = [...config.evaluationMethods]
    const temp = newMethods[index]
    newMethods[index] = newMethods[index + 1]
    newMethods[index + 1] = temp
    updateConfig({ evaluationMethods: newMethods })
  }

  // ============ Sub components ============

  const LevelRuleEditor = ({ gradeMapping, onChange }: { gradeMapping: GradeMapping[]; onChange: (gm: GradeMapping[]) => void }) => {
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
          {[...gradeMapping].sort((a, b) => a.minScore - b.minScore).map(g => {
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
                  <Input value={g.grade} onChange={e => onChange(gradeMapping.map(x => x.id === g.id ? { ...x, grade: e.target.value } : x))} className="w-14 h-6 text-center text-xs font-semibold" />
                  <div className={cn("w-3 h-3 rounded-full", c.dot)} />
                </div>
                <div className="flex items-center gap-1">
                  <Input type="number" value={g.minScore} onChange={e => onChange(gradeMapping.map(x => x.id === g.id ? { ...x, minScore: parseInt(e.target.value) || 0 } : x))} className="w-16 h-6 text-center text-xs" min={0} max={100} />
                  <span className="text-gray-500 text-xs">-</span>
                  <Input type="number" value={g.maxScore} onChange={e => onChange(gradeMapping.map(x => x.id === g.id ? { ...x, maxScore: parseInt(e.target.value) || 0 } : x))} className="w-16 h-6 text-center text-xs" min={0} max={100} />
                  <span className="text-xs text-gray-500">分</span>
                </div>
                <div className="mt-1.5">
                  <Input value={g.remark || ""} onChange={e => onChange(gradeMapping.map(x => x.id === g.id ? { ...x, remark: e.target.value } : x))} className="h-7 text-[10px] bg-white/70" placeholder="等级备注说明" />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const EvalPointCard = ({ ep, field }: { ep: EvalPoint; field: EvalPointField }) => (
    <div className="p-3 bg-white rounded-lg border">
      <div className="flex items-center gap-2 mb-2">
        <Input value={ep.name} onChange={e => updateEvalPoint(field, ep.id, { name: e.target.value })} className="flex-1 h-8 text-sm" />
        <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-red-500" onClick={() => removeEvalPoint(field, ep.id)}><Trash2 className="h-4 w-4" /></Button>
      </div>
      <div className="flex items-center gap-2 flex-wrap mb-2">
        <Badge variant="outline" className={cn("text-[10px]", evalSubTypeColors[ep.subType as EvalSubType])}>{ep.subType ? evalSubTypeLabels[ep.subType as EvalSubType] : "未分类"}</Badge>
        <Select value={ep.scoringMethod || "level"} onValueChange={v => updateEvalPoint(field, ep.id, { scoringMethod: v as "score" | "level" | "rubric" })}>
          <SelectTrigger className="h-7 text-[10px] w-28"><SelectValue placeholder="评分方式" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="score" disabled>分值制</SelectItem>
            <SelectItem value="level">等级制</SelectItem>
            <SelectItem value="rubric" disabled>rubric量表</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="mb-2">
        <p className="text-xs text-gray-500 mb-1">关联能力点</p>
        <div className="flex flex-wrap gap-1">
          {(ep.abilityPointIds || []).map(abId => {
            const ab = abilityPoints.find(a => a.id === abId)
            return ab ? (
              <Badge key={abId} variant="secondary" className="text-[10px] font-normal">
                {ab.name}
                <button onClick={() => updateEvalPoint(field, ep.id, { abilityPointIds: (ep.abilityPointIds || []).filter(id => id !== abId) })} className="ml-1 text-gray-400 hover:text-red-500">×</button>
              </Badge>
            ) : null
          })}
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2 text-gray-400 hover:text-primary">+ 添加能力点</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle>关联能力点</DialogTitle></DialogHeader>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input placeholder="搜索能力点..." className="pl-9" />
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {abilityPoints.map(a => {
                  const alreadyLinked = (ep.abilityPointIds || []).includes(a.id)
                  return (
                    <div key={a.id} onClick={() => { if (!alreadyLinked) updateEvalPoint(field, ep.id, { abilityPointIds: [...(ep.abilityPointIds || []), a.id] }) }} className={cn("p-2 rounded-lg border cursor-pointer text-sm", alreadyLinked ? "border-primary bg-primary/5 opacity-50" : "hover:border-gray-300")}>
                      <div className="flex items-center gap-2"><span className="flex-1">{a.name}</span>{alreadyLinked && <CheckCircle2 className="h-4 w-4 text-primary" />}</div>
                    </div>
                  )
                })}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      <div className="mb-2">
        <p className="text-xs text-gray-500 mb-1">关联知识点</p>
        <div className="flex flex-wrap gap-1">
          {(ep.knowledgePointIds || []).map(kpid => {
            const kp = knowledgePoints.find(k => k.id === kpid)
            return kp ? (
              <Badge key={kpid} variant="secondary" className="text-[10px] font-normal">
                {kp.name}
                <button onClick={() => updateEvalPoint(field, ep.id, { knowledgePointIds: (ep.knowledgePointIds || []).filter(id => id !== kpid) })} className="ml-1 text-gray-400 hover:text-red-500">×</button>
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
                <Input placeholder="搜索知识点..." className="pl-9" />
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {knowledgePoints.map(k => {
                  const alreadyLinked = (ep.knowledgePointIds || []).includes(k.id)
                  return (
                    <div key={k.id} onClick={() => { if (!alreadyLinked) updateEvalPoint(field, ep.id, { knowledgePointIds: [...(ep.knowledgePointIds || []), k.id] }) }} className={cn("p-2 rounded-lg border cursor-pointer text-sm", alreadyLinked ? "border-primary bg-primary/5 opacity-50" : "hover:border-gray-300")}>
                      <div className="flex items-center gap-2"><span className="flex-1">{k.name}</span>{alreadyLinked && <CheckCircle2 className="h-4 w-4 text-primary" />}</div>
                    </div>
                  )
                })}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      {ep.scoringMethod === "level" && ep.gradeMapping && (
        <LevelRuleEditor gradeMapping={ep.gradeMapping} onChange={gm => updateEvalPoint(field, ep.id, { gradeMapping: gm })} />
      )}
    </div>
  )

  const openRubricKpDialog = (pointId: string, field: EvalPointField) => {
    setRubricKpTargetPointId(pointId)
    setRubricKpTargetField(field)
    setRubricKpSearch("")
    setRubricKpDialogOpen(true)
  }

  const openRubricAbDialog = (pointId: string, field: EvalPointField) => {
    setRubricAbTargetPointId(pointId)
    setRubricAbTargetField(field)
    setRubricAbSearch("")
    setRubricAbDialogOpen(true)
  }

  const RubricEvalPointCard = ({ ep, field }: { ep: EvalPoint; field: EvalPointField }) => {
    const [expanded, setExpanded] = useState(false)
    const pointTypes = ep.types?.length ? ep.types : ep.subType ? [ep.subType] : []
    return (
      <div className="bg-white rounded-lg border overflow-hidden">
        <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-gray-50 transition-colors">
          {expanded ? <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" /> : <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />}
          <div className="flex items-center gap-1 shrink-0">
            {pointTypes.length > 0 ? pointTypes.map(t => (
              <Badge key={t} variant="outline" className={cn("text-[10px]", evalSubTypeColors[t as EvalSubType])}>{evalSubTypeLabels[t as EvalSubType]}</Badge>
            )) : <Badge variant="outline" className="text-[10px]">未分类</Badge>}
          </div>
          <span className="text-sm text-gray-700 flex-1 truncate">{ep.name || "未命名评价点"}</span>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-red-500 shrink-0" onClick={e => { e.stopPropagation(); removeEvalPoint(field, ep.id); }}><Trash2 className="h-3.5 w-3.5" /></Button>
        </button>
        {expanded && (
          <div className="px-3 pb-3 border-t">
            <div className="mt-2"><Label className="text-xs text-gray-500">评价点内容</Label><Input value={ep.name} onChange={e => updateEvalPoint(field, ep.id, { name: e.target.value })} className="mt-1 h-8 text-sm" placeholder="输入评价点内容" /></div>
            <div className="mt-2">
              <Label className="text-xs text-gray-500">量规类型</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {(Object.keys(evalSubTypeLabels) as EvalSubType[]).map(type => {
                  const selected = pointTypes.includes(type)
                  return (
                    <button key={type} onClick={() => {
                      const current = ep.types || (ep.subType ? [ep.subType] : [])
                      const has = current.includes(type)
                      const newTypes = has ? current.filter(t => t !== type) : [...current, type]
                      updateEvalPoint(field, ep.id, { types: newTypes, subType: undefined })
                    }} className={cn("px-2 py-0.5 rounded-full text-[10px] border transition-all", selected ? cn(evalSubTypeColors[type], "border-current") : "bg-white text-gray-500 border-gray-200 hover:border-gray-300")}>
                      {evalSubTypeLabels[type]}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="mt-2">
              <Label className="text-xs text-gray-500">关联能力点</Label>
              <div className="flex items-center gap-2 flex-wrap mt-1">
                {(ep.abilityPointIds || []).map(abId => {
                  const ab = abilityPoints.find(a => a.id === abId)
                  return ab ? <Badge key={abId} variant="secondary" className="text-[10px] font-normal">{ab.name}<button onClick={() => updateEvalPoint(field, ep.id, { abilityPointIds: (ep.abilityPointIds || []).filter(id => id !== abId) })} className="ml-1 text-gray-400 hover:text-red-500">×</button></Badge> : null
                })}
                <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2 text-gray-400 hover:text-primary" onClick={() => openRubricAbDialog(ep.id, field)}>+ 关联能力点</Button>
              </div>
            </div>
            <div className="mt-2">
              <Label className="text-xs text-gray-500">关联知识点</Label>
              <div className="flex items-center gap-2 flex-wrap mt-1">
                {(ep.knowledgePointIds || []).map(kpid => {
                  const kp = knowledgePoints.find(k => k.id === kpid)
                  return kp ? <Badge key={kpid} variant="secondary" className="text-[10px] font-normal">{kp.name}<button onClick={() => updateEvalPoint(field, ep.id, { knowledgePointIds: (ep.knowledgePointIds || []).filter(id => id !== kpid) })} className="ml-1 text-gray-400 hover:text-red-500">×</button></Badge> : null
                })}
                <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2 text-gray-400 hover:text-primary" onClick={() => openRubricKpDialog(ep.id, field)}>+ 关联知识点</Button>
              </div>
            </div>
            <div className="mt-2">
              <Label className="text-xs text-gray-500">评分规则</Label>
              <div className="flex items-center gap-2 mt-1">
                <Select value={ep.scoringMethod || "level"} onValueChange={v => updateEvalPoint(field, ep.id, { scoringMethod: v as "score" | "level" | "rubric" })}>
                  <SelectTrigger className="h-7 text-[10px] w-32"><SelectValue placeholder="评分方式" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="score">分值制</SelectItem>
                    <SelectItem value="level">等级制</SelectItem>
                    <SelectItem value="rubric">rubric量表</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {ep.scoringMethod === "level" && ep.gradeMapping && (
                <LevelRuleEditor gradeMapping={ep.gradeMapping} onChange={gm => updateEvalPoint(field, ep.id, { gradeMapping: gm })} />
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  const EvalPointConfigPanel = ({ points, field }: { points: EvalPoint[]; field: EvalPointField }) => {
    const [expandedTypes, setExpandedTypes] = useState<Record<string, boolean>>({})
    const grouped = points.reduce((acc, ep) => {
      const key = ep.subType || "uncategorized"
      if (!acc[key]) acc[key] = []
      acc[key].push(ep)
      return acc
    }, {} as Record<string, EvalPoint[]>)
    const subTypeKeys = Object.keys(evalSubTypeLabels) as EvalSubType[]
    const usedSubTypes = subTypeKeys.filter(st => grouped[st]?.length > 0)
    const toggleType = (st: string) => setExpandedTypes(prev => ({ ...prev, [st]: !prev[st] }))

    return (
      <div className="border rounded-xl p-4">
        <p className="text-sm font-medium mb-3">评价点配置</p>
        <div className="mb-4">
          <p className="text-xs text-gray-500 mb-2">选择细分类型并添加评价点</p>
          <div className="flex flex-wrap gap-1.5">
            {subTypeKeys.map(st => {
              const count = grouped[st]?.length || 0
              const active = count > 0
              return (
                <button key={st} onClick={() => { if (!active) addEvalPoint(field, { subType: st, name: `${evalSubTypeLabels[st]}评价点` }); toggleType(st); }} className={cn("px-2.5 py-1 rounded-full text-xs border transition-all", active ? cn(evalSubTypeColors[st], "border-current") : "bg-white text-gray-500 border-gray-200 hover:border-gray-300")}>
                  {evalSubTypeLabels[st]}{count > 0 && <span className="ml-1 font-medium">({count})</span>}
                </button>
              )
            })}
          </div>
        </div>
        <div className="space-y-3">
          {usedSubTypes.map(st => {
            const expanded = expandedTypes[st] !== false
            const eps = grouped[st]
            return (
              <div key={st} className="border rounded-lg overflow-hidden">
                <button onClick={() => toggleType(st)} className={cn("w-full flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors", expanded ? "bg-gray-50" : "bg-white hover:bg-gray-50")}>
                  {expanded ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
                  <Badge variant="outline" className={cn("text-[10px]", evalSubTypeColors[st])}>{evalSubTypeLabels[st]}</Badge>
                  <span className="flex-1 text-left text-gray-600">{eps.length} 个评价点</span>
                  <div className="flex items-center gap-1">
                    <Dialog>
                      <DialogTrigger asChild><Button variant="ghost" size="sm" className="h-6 text-[10px] px-2 text-gray-400 hover:text-primary" onClick={e => e.stopPropagation()}><Award className="h-3 w-3 mr-1" />能力点</Button></DialogTrigger>
                      <DialogContent className="sm:max-w-md">
                        <DialogHeader><DialogTitle>从能力点创建 — {evalSubTypeLabels[st]}</DialogTitle></DialogHeader>
                        <div className="space-y-2 max-h-80 overflow-y-auto mt-2">
                          {abilityPoints.map(a => (
                            <div key={a.id} onClick={() => addEvalPointFromAbility(field, a.id, st)} className="p-2.5 rounded-lg border cursor-pointer hover:border-gray-300 text-sm">
                              <div className="flex items-center gap-2"><span className="flex-1 font-medium">{a.name}</span>{a.code && <Badge variant="outline" className="text-[10px]">{a.code}</Badge>}</div>
                              <p className="text-xs text-gray-500 mt-1 line-clamp-1">{a.description}</p>
                            </div>
                          ))}
                        </div>
                      </DialogContent>
                    </Dialog>
                    <Dialog>
                      <DialogTrigger asChild><Button variant="ghost" size="sm" className="h-6 text-[10px] px-2 text-gray-400 hover:text-primary" onClick={e => e.stopPropagation()}><Lightbulb className="h-3 w-3 mr-1" />知识点</Button></DialogTrigger>
                      <DialogContent className="sm:max-w-md">
                        <DialogHeader><DialogTitle>从知识点创建 — {evalSubTypeLabels[st]}</DialogTitle></DialogHeader>
                        <div className="space-y-2 max-h-80 overflow-y-auto mt-2">
                          {knowledgePoints.map(k => (
                            <div key={k.id} onClick={() => addEvalPointFromKnowledge(field, k.id, st)} className="p-2.5 rounded-lg border cursor-pointer hover:border-gray-300 text-sm">
                              <div className="flex items-center gap-2"><span className="flex-1 font-medium">{k.name}</span>{k.code && <Badge variant="outline" className="text-[10px]">{k.code}</Badge>}</div>
                              <p className="text-xs text-gray-500 mt-1 line-clamp-1">{k.description}</p>
                            </div>
                          ))}
                        </div>
                      </DialogContent>
                    </Dialog>
                    <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2 text-gray-400 hover:text-primary" onClick={e => { e.stopPropagation(); addEvalPoint(field, { subType: st, name: "" }); }}><Plus className="h-3 w-3 mr-1" />手动添加</Button>
                  </div>
                </button>
                {expanded && <div className="p-3 space-y-2 border-t">{eps.map(ep => <EvalPointCard key={ep.id} ep={ep} field={field} />)}</div>}
              </div>
            )
          })}
          {grouped["uncategorized"]?.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <button onClick={() => toggleType("uncategorized")} className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium bg-white hover:bg-gray-50 transition-colors">
                {expandedTypes["uncategorized"] !== false ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
                <span className="text-gray-600">未分类评价点</span><span className="text-gray-400">({grouped["uncategorized"].length})</span>
              </button>
              {expandedTypes["uncategorized"] !== false && <div className="p-3 space-y-2 border-t">{grouped["uncategorized"].map(ep => <EvalPointCard key={ep.id} ep={ep} field={field} />)}</div>}
            </div>
          )}
        </div>
      </div>
    )
  }

  const questionTypeLabels: Record<string, string> = { single: "单选", multiple: "多选", judgment: "判断", short_answer: "简答", essay: "论述", fill_blank: "填空" }
  const difficultyLabels: Record<string, string> = { easy: "简单", medium: "中等", hard: "困难" }

  const QuestionSelectorPanel = ({ field, selectedIds, showAutoSelect = false, maxCount }: { field: "randomDrawQuestions" | "questionBankQuestions" | "quizQuestions", selectedIds: string[], showAutoSelect?: boolean, maxCount?: number }) => {
    const filteredQuestions = allQuestions.filter(q => {
      const matchTab = questionTab === "my" ? q.source === "my" : questionTab === "collab" ? q.source === "collab" : q.source === "public"
      const matchSearch = !questionSearch || q.name.includes(questionSearch) || q.content.includes(questionSearch)
      return matchTab && matchSearch
    })

    return (
      <div className="flex gap-4 h-[60vh] min-h-[480px]">
        <div className="w-3/5 flex flex-col min-h-0 border rounded-xl p-3">
          <Tabs value={questionTab} onValueChange={v => setQuestionTab(v as "my" | "collab" | "public")} className="mb-3">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="my">我的</TabsTrigger>
              <TabsTrigger value="collab">共建</TabsTrigger>
              <TabsTrigger value="public">公共题库</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex items-center gap-3 mb-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input value={questionSearch} onChange={e => setQuestionSearch(e.target.value)} placeholder="搜索题目名称..." className="pl-9" />
            </div>
            <Button onClick={() => setShowAddQuestion(true)}><Plus className="h-4 w-4 mr-1" />新增题目</Button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filteredQuestions.length === 0 ? (
              <div className="text-center text-gray-400 py-8"><FileQuestion className="h-8 w-8 mx-auto mb-2 opacity-50" /><p className="text-sm">暂无题目</p></div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr><th className="text-left text-xs font-medium text-gray-500 px-3 py-2 w-[30%]">题目名称</th><th className="text-left text-xs font-medium text-gray-500 px-3 py-2 w-[12%]">题目类型</th><th className="text-left text-xs font-medium text-gray-500 px-3 py-2 w-[12%]">题目难度</th><th className="text-left text-xs font-medium text-gray-500 px-3 py-2 w-[15%]">所属题库</th><th className="text-right text-xs font-medium text-gray-500 px-3 py-2 w-[31%]">操作</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredQuestions.map(q => {
                    const isSelected = selectedIds.includes(q.id)
                    return (
                      <tr key={q.id} className={cn("hover:bg-gray-50 transition-colors cursor-pointer", isSelected ? "bg-primary/[0.03]" : "")} onClick={() => toggleQuestion(q.id, field)}>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <div className={cn("w-4 h-4 rounded border flex items-center justify-center shrink-0", isSelected ? "bg-primary border-primary" : "border-gray-300")}>{isSelected && <Check className="h-3 w-3 text-white" />}</div>
                            <span className="text-sm font-medium text-gray-800 line-clamp-1">{q.name}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2"><Badge variant="secondary" className="text-xs">{questionTypeLabels[q.type] || q.type}</Badge></td>
                        <td className="px-3 py-2"><span className="text-xs text-gray-500">{difficultyLabels[q.difficulty] || q.difficulty}</span></td>
                        <td className="px-3 py-2"><span className="text-xs text-gray-500">{questionBankLabels[q.questionBank as string] || q.questionBank || "-"}</span></td>
                        <td className="px-3 py-2">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="sm" className="h-6 text-[11px] px-1.5 text-gray-500 hover:text-primary" onClick={e => { e.stopPropagation(); setSelectedQuestionForDetail(q.id); setQuestionDetailOpen(true); }}>查看详情</Button>
                            {isSelected ? (
                              <Button size="sm" variant="outline" className="h-6 text-[11px] px-2" onClick={e => { e.stopPropagation(); toggleQuestion(q.id, field); }}>取消</Button>
                            ) : (
                              <Button size="sm" className="h-6 text-[11px] px-2" onClick={e => { e.stopPropagation(); toggleQuestion(q.id, field); }}>使用</Button>
                            )}
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
        <div className="w-2/5 border rounded-xl p-3 flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-gray-700">已选择题目 ({selectedIds.length}{maxCount ? `/${maxCount}` : ""})</p>
            {showAutoSelect && <Button variant="outline" size="sm" className="h-7 text-[11px] px-2" disabled title="自动抽题功能开发中">自动选择</Button>}
          </div>
          <div className="flex-1 overflow-y-auto">
            {selectedIds.length === 0 ? (
              <div className="text-center text-gray-400 py-8"><FileQuestion className="h-8 w-8 mx-auto mb-2 opacity-50" /><p className="text-xs">从左侧搜索并选择题目</p></div>
            ) : (
              <div className="space-y-2">
                {selectedIds.map(qid => {
                  const q = allQuestions.find(aq => aq.id === qid)
                  if (!q) return null
                  return (
                    <div key={qid} className="p-2.5 rounded-lg border border-primary/20 bg-primary/5 relative">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium flex-1 truncate">{q.name}</span>
                        <Button variant="ghost" size="icon" className="h-5 w-5 text-gray-400 -mr-1 -mt-1" onClick={() => toggleQuestion(qid, field)}><X className="h-3 w-3" /></Button>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Badge variant="secondary" className="text-[10px]">{questionTypeLabels[q.type] || q.type}</Badge>
                        <span className="text-[10px] text-gray-400">{difficultyLabels[q.difficulty] || q.difficulty}</span>
                        {field === "questionBankQuestions" ? (
                          <div className="flex items-center gap-1 ml-auto">
                            <span className="text-[10px] text-gray-400">分值</span>
                            <Input type="number" value={mockResQuestionBank.questionScores[qid] ?? q.score} onChange={e => { const val = Math.max(0, Math.min(100, parseInt(e.target.value) || 0)); setMockResQuestionBank(prev => ({ ...prev, questionScores: { ...prev.questionScores, [qid]: val } })); }} className="w-14 h-5 text-[10px] px-1 py-0" min={0} max={100} />
                          </div>
                        ) : <span className="text-[10px] text-gray-400">{q.score}分</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  const EvalResourceOnlyPanel = ({ methodKey }: { methodKey: string }) => {
    if (methodKey === "random_draw") {
      const rdqMajorOptions = ["全部", "经济学", "物流管理", "机械工程", "计算机科学", "电子信息", "工商管理", "会计学", "市场营销", "土木工程", "英语", "法学"]
      const [rdqMajorTab, setRdqMajorTab] = useState("全部")
      const [rdqDrawMode, setRdqDrawMode] = useState<"random" | "manual">("random")
      const [rdqDrawCount, setRdqDrawCount] = useState(5)
      const filteredRdq = config.randomDrawCustomQuestions.filter(q => {
        const matchMajor = rdqMajorTab === "全部" || q.major === rdqMajorTab
        const matchSearch = !rdqSearch || q.name.includes(rdqSearch) || q.description.includes(rdqSearch) || q.major.includes(rdqSearch)
        return matchMajor && matchSearch
      })

      const handleAddRdq = () => { setNewRdqForm({ name: "", description: "", answer: "", major: "" }); setRdqActionMode("add"); setRdqActionTarget(null); setRdqActionOpen(true); }
      const handleEditRdq = (q: typeof config.randomDrawCustomQuestions[0]) => { setNewRdqForm({ name: q.name, description: q.description, answer: q.answer, major: q.major }); setRdqActionMode("edit"); setRdqActionTarget(q); setRdqActionOpen(true); }
      const handleSaveRdq = () => {
        if (!newRdqForm.name.trim()) return
        if (rdqActionMode === "edit" && rdqActionTarget) {
          updateConfig({ randomDrawCustomQuestions: config.randomDrawCustomQuestions.map(q => q.id === rdqActionTarget.id ? { ...q, name: newRdqForm.name.trim(), description: newRdqForm.description.trim(), answer: newRdqForm.answer.trim(), major: newRdqForm.major.trim() } : q) })
          setRdqActionOpen(false)
          return
        }
        const newQ = { id: uid("rdq"), name: newRdqForm.name.trim(), description: newRdqForm.description.trim(), answer: newRdqForm.answer.trim(), major: newRdqForm.major.trim() }
        updateConfig({ randomDrawCustomQuestions: [...config.randomDrawCustomQuestions, newQ] })
        setRdqActionOpen(false)
        setRdqSearch("")
      }
      const handleDeleteRdq = (id: string) => { updateConfig({ randomDrawCustomQuestions: config.randomDrawCustomQuestions.filter(q => q.id !== id), randomDrawSelectedIds: config.randomDrawSelectedIds.filter(sid => sid !== id) }) }
      const handleToggleSelect = (id: string) => {
        const isSelected = config.randomDrawSelectedIds.includes(id)
        updateConfig({ randomDrawSelectedIds: isSelected ? config.randomDrawSelectedIds.filter(sid => sid !== id) : [...config.randomDrawSelectedIds, id] })
      }
      const selectedRdqList = config.randomDrawSelectedIds.map(id => config.randomDrawCustomQuestions.find(q => q.id === id)).filter(Boolean) as typeof config.randomDrawCustomQuestions

      return (
        <div className="h-[calc(92vh-180px)] flex flex-col">
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input value={rdqSearch} onChange={e => setRdqSearch(e.target.value)} placeholder="搜索现场问答题名称、描述或适用专业..." className="pl-9" />
            </div>
            <Button onClick={handleAddRdq}><Plus className="h-4 w-4 mr-1" />新增现场问答题</Button>
          </div>
          <div className="flex gap-4 flex-1 min-h-0">
            <div className="w-3/5 flex flex-col min-h-0 border rounded-xl p-3">
              <div className="flex items-center gap-1 mb-2">
                {rdqMajorOptions.map(opt => (
                  <button key={opt} onClick={() => setRdqMajorTab(opt)} className={cn("px-2.5 py-1 rounded-md text-[11px] transition-all", rdqMajorTab === opt ? "bg-primary/10 text-primary font-medium" : "text-gray-500 hover:bg-gray-100")}>{opt}</button>
                ))}
              </div>
              <p className="text-sm font-medium mb-2 text-gray-700">{rdqSearch ? `搜索结果 (${filteredRdq.length})` : (rdqMajorTab === "全部" ? "全部现场问答题" : `${rdqMajorTab}相关现场问答题`)}</p>
              <div className="flex-1 overflow-y-auto pr-1">
                {filteredRdq.length === 0 ? (
                  <div className="text-center text-gray-400 py-8"><FileQuestion className="h-8 w-8 mx-auto mb-2 opacity-50" /><p className="text-sm">{rdqSearch ? "未找到匹配的现场问答题" : "暂无现场问答题，请点击上方按钮新增"}</p></div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0 z-10"><tr><th className="text-left text-xs font-medium text-gray-500 px-3 py-2 w-[26%]">题目名称</th><th className="text-left text-xs font-medium text-gray-500 px-3 py-2 w-[30%]">题目描述</th><th className="text-left text-xs font-medium text-gray-500 px-3 py-2 w-[14%]">适用专业</th><th className="text-right text-xs font-medium text-gray-500 px-3 py-2 w-[30%]">操作</th></tr></thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredRdq.map(q => {
                        const isSelected = config.randomDrawSelectedIds.includes(q.id)
                        return (
                          <tr key={q.id} className={cn("hover:bg-gray-50 transition-colors", isSelected ? "bg-primary/[0.03]" : "")}>
                            <td className="px-3 py-2"><span className="text-sm font-medium text-gray-800">{q.name}</span></td>
                            <td className="px-3 py-2"><p className="text-xs text-gray-500 line-clamp-1" title={q.description}>{q.description || "-"}</p></td>
                            <td className="px-3 py-2"><Badge variant="secondary" className="text-[10px]">{q.major || "-"}</Badge></td>
                            <td className="px-3 py-2">
                              <div className="flex items-center justify-end gap-1">
                                <Button variant="ghost" size="sm" className="h-6 text-[11px] px-1.5 text-gray-500 hover:text-primary" onClick={() => { setSelectedRdqForDetail(q.id); setRdqDetailOpen(true); }}>详情</Button>
                                <Button variant="ghost" size="sm" className="h-6 text-[11px] px-1.5 text-gray-500 hover:text-primary" onClick={() => handleEditRdq(q)}>编辑</Button>
                                {isSelected ? <Button size="sm" variant="outline" className="h-6 text-[11px] px-2" onClick={() => handleToggleSelect(q.id)}>取消</Button> : <Button size="sm" className="h-6 text-[11px] px-2" onClick={() => handleToggleSelect(q.id)}>选择</Button>}
                                <Button variant="ghost" size="sm" className="h-6 text-[11px] px-1.5 text-red-400 hover:text-red-600" onClick={() => handleDeleteRdq(q.id)}>删除</Button>
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
            <div className="w-2/5 border rounded-xl p-3 flex flex-col min-h-0">
              <p className="text-sm font-medium mb-3 text-gray-700">已配置现场问答题 ({selectedRdqList.length})</p>
              <div className="flex-1 overflow-y-auto">
                {selectedRdqList.length === 0 ? (
                  <div className="text-center text-gray-400 py-8"><FileQuestion className="h-8 w-8 mx-auto mb-2 opacity-50" /><p className="text-xs">请从左侧选择现场问答题</p></div>
                ) : (
                  <div className="space-y-2">
                    {selectedRdqList.map(q => (
                      <div key={q.id} className="p-2.5 rounded-lg border border-primary/20 bg-primary/5 relative">
                        <div className="flex items-center gap-2 mb-1"><span className="text-xs font-medium flex-1 truncate">{q.name}</span><Button variant="ghost" size="icon" className="h-5 w-5 text-gray-400 -mr-1 -mt-1" onClick={() => handleToggleSelect(q.id)}><X className="h-3 w-3" /></Button></div>
                        <p className="text-[11px] text-gray-500 line-clamp-1">{q.description || "暂无描述"}</p>
                        <Badge variant="outline" className="text-[9px] mt-1 font-normal px-1 py-0 h-4">{q.major || "通用"}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="border rounded-xl p-4 mt-4">
            <p className="text-sm font-medium mb-3">抽题规则</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-gray-500">抽题方式</Label>
                <Select value={rdqDrawMode} onValueChange={v => setRdqDrawMode(v as "random" | "manual")}>
                  <SelectTrigger className="mt-1 text-sm h-9"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="random">系统随机分配</SelectItem><SelectItem value="manual">老师手动选择</SelectItem></SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-gray-500">抽题数量</Label>
                <Input type="number" value={rdqDrawCount} onChange={e => setRdqDrawCount(Math.max(1, parseInt(e.target.value) || 1))} className="mt-1 text-sm" min={1} />
              </div>
            </div>
          </div>
          <Dialog open={rdqActionOpen} onOpenChange={setRdqActionOpen}>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader><DialogTitle>{rdqActionMode === "add" ? "新增现场问答题" : "编辑现场问答题"}</DialogTitle><DialogDescription>{rdqActionMode === "add" ? "创建一个新的现场问答题" : "修改现场问答题信息"}</DialogDescription></DialogHeader>
              <div className="space-y-4 py-4">
                <div><Label>题目名称</Label><Input value={newRdqForm.name} onChange={e => setNewRdqForm({ ...newRdqForm, name: e.target.value })} placeholder="输入题目名称" className="mt-1.5" /></div>
                <div><Label>适用专业</Label><Select value={newRdqForm.major} onValueChange={v => setNewRdqForm({ ...newRdqForm, major: v })}><SelectTrigger className="mt-1.5"><SelectValue placeholder="选择适用专业" /></SelectTrigger><SelectContent>{rdqMajorOptions.map(m => m !== "全部" && <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></div>
                <div><Label>题目描述</Label><Textarea value={newRdqForm.description} onChange={e => setNewRdqForm({ ...newRdqForm, description: e.target.value })} placeholder="输入题目描述" className="mt-1.5" rows={3} /></div>
                <div><Label>题目答案</Label><Textarea value={newRdqForm.answer} onChange={e => setNewRdqForm({ ...newRdqForm, answer: e.target.value })} placeholder="输入题目答案" className="mt-1.5" rows={3} /></div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setRdqActionOpen(false)}>取消</Button>
                <Button onClick={handleSaveRdq} disabled={!newRdqForm.name.trim()}>{rdqActionMode === "add" ? "新增" : "保存修改"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={rdqDetailOpen} onOpenChange={setRdqDetailOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle>现场问答题详情</DialogTitle></DialogHeader>
              {(() => {
                const q = config.randomDrawCustomQuestions.find(x => x.id === selectedRdqForDetail)
                if (!q) return null
                return (
                  <div className="space-y-4 py-2">
                    <div><Label className="text-xs text-gray-500">题目名称</Label><p className="text-sm font-medium mt-1">{q.name}</p></div>
                    <div><Label className="text-xs text-gray-500">适用专业</Label><Badge variant="secondary" className="text-[10px] mt-1">{q.major || "通用"}</Badge></div>
                    <div><Label className="text-xs text-gray-500">题目描述</Label><p className="text-sm mt-1 text-gray-700 whitespace-pre-wrap">{q.description || "-"}</p></div>
                    <div><Label className="text-xs text-gray-500">题目答案</Label><p className="text-sm mt-1 text-gray-700 whitespace-pre-wrap">{q.answer || "-"}</p></div>
                  </div>
                )
              })()}
              <DialogFooter><Button variant="outline" onClick={() => setRdqDetailOpen(false)}>关闭</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )
    }
    if (methodKey === "review") {
      return (
        <div className="space-y-4">
          <div className="p-4 bg-amber-50 rounded-lg border border-amber-100 text-sm text-amber-700">
            <div className="flex items-center gap-2 mb-2"><Info className="h-4 w-4" /><span className="font-medium">评审说明</span></div>
            <p>评审时教师根据学生现场表现或提交的材料进行打分。评价点配置请在「评价标准配置」卡片中设置。</p>
          </div>
          <div className="border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium">评审材料要求</p>
              <div className="flex items-center gap-2"><Switch checked={mockResReview.requiresMaterial} onCheckedChange={v => setMockResReview({ ...mockResReview, requiresMaterial: v })} /><span className="text-xs text-gray-600">是否需要提交评审材料</span></div>
            </div>
            {mockResReview.requiresMaterial && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs text-gray-500">预估提交天数</Label><Input type="number" value={mockResReview.deadlineDays} onChange={e => setMockResReview({ ...mockResReview, deadlineDays: Math.max(1, parseInt(e.target.value) || 1) })} className="mt-1 text-sm" min={1} /></div>
                </div>
                <div className="mt-3"><Label className="text-xs text-gray-500 mb-1.5">提交材料要求</Label><Textarea value={mockResReview.submitFormatDesc} onChange={e => setMockResReview({ ...mockResReview, submitFormatDesc: e.target.value })} placeholder="请用一句话说明学生需要提交的材料要求..." rows={2} className="text-sm" /></div>
              </>
            )}
            <div className="mt-3"><Label className="text-xs text-gray-500 mb-1.5">评审场地/环境资源准备</Label><Textarea value={mockResReview.venueResources} onChange={e => setMockResReview({ ...mockResReview, venueResources: e.target.value })} placeholder="请描述评审所需的场地、设备及环境资源准备要求..." rows={2} className="text-sm" /></div>
            <div className="mt-3"><div className="flex items-center gap-2"><Switch checked={mockResReview.allowResubmit} onCheckedChange={v => setMockResReview({ ...mockResReview, allowResubmit: v })} /><span className="text-xs text-gray-600">允许重新提交</span></div></div>
          </div>
          <div className="border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <p className="text-sm font-medium">评审流程设置</p>
                {(() => {
                  const enabledSteps = reviewSteps.filter(s => s.enabled)
                  const totalWeight = enabledSteps.reduce((sum, s) => sum + (s.weight || 0), 0)
                  return enabledSteps.length > 0 && (
                    <div className={cn("flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full font-medium", totalWeight === 100 ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600")}>
                      <span>权重合计 {totalWeight}%</span>{totalWeight !== 100 && <span className="text-[10px]">(需等于100%)</span>}
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
                  const newSteps = reviewSteps.map(s => !s.enabled ? s : { ...s, weight: base + (enabled.findIndex(e => e.id === s.id) < remainder ? 1 : 0) })
                  setReviewSteps(newSteps)
                }}><RotateCcw className="h-3.5 w-3.5 mr-1" />一键平均权重</Button>
                <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => { setShowAddStep(true); setNewStepLabel(""); setNewStepDesc(""); }}><Plus className="h-3.5 w-3.5 mr-1" />新增步骤</Button>
              </div>
            </div>
            <div className="space-y-2">
              {reviewSteps.map(step => (
                <div key={step.id} className="p-3 rounded-lg border">
                  {editingReviewStepId === step.id ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <Input value={editingStepLabel} onChange={e => setEditingStepLabel(e.target.value)} placeholder="步骤名称" className="text-sm h-8" />
                        <Select value={step.subjectType || ""} onValueChange={v => setReviewSteps(reviewSteps.map(s => s.id === step.id ? { ...s, subjectType: v } : s))}>
                          <SelectTrigger className="text-sm h-8"><SelectValue placeholder="请选择评价主体" /></SelectTrigger>
                          <SelectContent>
                            {Object.entries(subjectLabels).map(([k, label]) => <SelectItem key={k} value={k}>{label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <Input value={editingStepDesc} onChange={e => setEditingStepDesc(e.target.value)} placeholder="步骤描述" className="text-sm h-8" />
                      <div className="flex items-center gap-2">
                        <Button size="sm" className="h-7 text-xs" onClick={() => { setReviewSteps(reviewSteps.map(s => s.id === step.id ? { ...s, label: editingStepLabel || s.label, desc: editingStepDesc || s.desc } : s)); setEditingReviewStepId(null); }}>保存</Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditingReviewStepId(null)}>取消</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <Switch checked={step.enabled} onCheckedChange={v => { if (v && !step.subjectType) setReviewSteps(reviewSteps.map(s => s.id === step.id ? { ...s, enabled: v, subjectType: "teacher" } : s)); else setReviewSteps(reviewSteps.map(s => s.id === step.id ? { ...s, enabled: v } : s)); }} />
                          <div><p className="text-sm font-medium">{step.label}</p><p className="text-xs text-gray-400">{step.desc}</p></div>
                        </div>
                        <Badge variant={step.subjectType ? "secondary" : "outline"} className="text-[10px]">{step.subjectType ? (subjectLabels[step.subjectType] || step.subjectType) : "未绑定"}</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        {step.enabled && <div className="flex items-center gap-1"><Input type="number" value={step.weight || 0} onChange={e => setReviewSteps(reviewSteps.map(s => s.id === step.id ? { ...s, weight: Math.max(0, Math.min(100, parseInt(e.target.value) || 0)) } : s))} className="h-7 text-xs w-14 text-center" min={0} max={100} /><span className="text-xs text-gray-400">%</span></div>}
                        <Button variant="ghost" size="sm" className="h-6 text-[11px] px-1.5 text-gray-400 hover:text-primary" onClick={() => { setEditingReviewStepId(step.id); setEditingStepLabel(step.label); setEditingStepDesc(step.desc); }}><PenTool className="h-3 w-3" /></Button>
                        {reviewSteps.length > 1 && <Button variant="ghost" size="sm" className="h-6 text-[11px] px-1.5 text-gray-400 hover:text-red-500" onClick={() => setReviewSteps(reviewSteps.filter(s => s.id !== step.id))}><Trash2 className="h-3 w-3" /></Button>}
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
                    <SelectContent>{Object.entries(subjectLabels).map(([k, label]) => <SelectItem key={k} value={k}>{label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <Input value={newStepDesc} onChange={e => setNewStepDesc(e.target.value)} placeholder="步骤描述" className="text-sm h-8" />
                <div className="flex items-center gap-2">
                  <Button size="sm" className="h-7 text-xs" onClick={() => { if (!newStepLabel.trim() || !newStepSubjectType) return; setReviewSteps([...reviewSteps, { id: uid("rs"), label: newStepLabel, desc: newStepDesc, enabled: true, subjectType: newStepSubjectType, weight: 0 }]); setShowAddStep(false); setNewStepLabel(""); setNewStepDesc(""); setNewStepSubjectType(""); }}>添加</Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setShowAddStep(false); setNewStepLabel(""); setNewStepDesc(""); setNewStepSubjectType(""); }}>取消</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )
    }
    if (methodKey === "paper") {
      const [paperEndTime, setPaperEndTime] = useState("")
      const selectPaper = (paperId: string) => { updateConfig({ paperIds: [paperId], paperWeights: { [paperId]: 100 } }) }
      return (
        <div className="space-y-4">
          <div className="border rounded-xl p-4">
            <p className="text-sm font-medium mb-3">选择已有试卷</p>
            <div className="flex items-center gap-3 mb-3">
              <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" /><Input placeholder="搜索试卷..." className="pl-9" /></div>
              <Button variant="outline" size="sm" className="h-9 text-xs" onClick={() => { setShowCreatePaper(true); setNewPaperName(""); setNewPaperQuestionCount(10); setNewPaperTotalScore(100); }}><Plus className="h-3.5 w-3.5 mr-1" />新建试卷</Button>
            </div>
            <div className="space-y-2">
              {paperMocks.map(paper => {
                const selected = config.paperIds.includes(paper.id)
                return (
                  <div key={paper.id} onClick={() => selectPaper(paper.id)} className={cn("p-4 rounded-lg border cursor-pointer", selected ? "border-primary bg-primary/5" : "hover:border-gray-300")}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn("w-4 h-4 rounded-full border flex items-center justify-center shrink-0", selected ? "bg-primary border-primary" : "border-gray-300")}>{selected && <div className="w-2 h-2 rounded-full bg-white" />}</div>
                        <div>
                          <p className="text-sm font-medium">{paper.name}</p>
                          <div className="flex items-center gap-1.5 mt-1">
                            <Badge className="text-[10px] bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-50">{paper.questionCount} 题</Badge>
                            <Badge className="text-[10px] bg-green-50 text-green-600 border-green-200 hover:bg-green-50">总分 {paper.totalScore}</Badge>
                          </div>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" className="h-7 text-[11px] px-2 text-gray-400 hover:text-primary" onClick={e => { e.stopPropagation(); setSelectedPaperForDetail(paper.id); setPaperDetailOpen(true); }}>查看详情</Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          <div className="border rounded-xl p-4">
            <p className="text-sm font-medium mb-3">考卷设置</p>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs text-gray-500">考试时长（分钟）</Label><Input type="number" value={mockResPaper.duration} onChange={e => setMockResPaper({ ...mockResPaper, duration: Math.max(5, parseInt(e.target.value) || 5) })} className="mt-1 text-sm" min={5} /></div>
              <div><Label className="text-xs text-gray-500">允许重考</Label><div className="mt-2 flex items-center gap-2"><Switch checked={mockResPaper.allowRetake} onCheckedChange={v => setMockResPaper({ ...mockResPaper, allowRetake: v })} /><span className="text-xs text-gray-600">{mockResPaper.allowRetake ? "是" : "否"}</span></div></div>
              {mockResPaper.allowRetake && <div><Label className="text-xs text-gray-500">最多重考次数</Label><Input type="number" value={mockResPaper.retakeCount} onChange={e => setMockResPaper({ ...mockResPaper, retakeCount: Math.max(1, parseInt(e.target.value) || 1) })} className="mt-1 text-sm" min={1} /></div>}
            </div>
            <div className="mt-3 flex items-center gap-4">
              <div className="flex items-center gap-2"><Switch checked={mockResPaper.shuffleQuestions} onCheckedChange={v => setMockResPaper({ ...mockResPaper, shuffleQuestions: v })} /><span className="text-xs text-gray-600">题目乱序</span></div>
              <div className="flex items-center gap-2"><Switch checked={mockResPaper.showResult} onCheckedChange={v => setMockResPaper({ ...mockResPaper, showResult: v })} /><span className="text-xs text-gray-600">交卷后显示成绩</span></div>
            </div>
            <div className="mt-4 pt-4 border-t">
              <Label className="text-xs text-gray-500 mb-2">试卷启用条件</Label>
              <div className="space-y-2 mt-1">
                {[
                  { key: "manual", label: "后台手动启用", desc: `老师手动开启试卷后，学生才能进入作答。` },
                  { key: "scheduled", label: "定时启用", desc: "提前预设考试的开始、结束时间。" },
                  { key: "always", label: "随时作答", desc: "试卷创建完成后立即开放，学生可随时进入作答。" },
                ].map(mode => (
                  <button key={mode.key} onClick={() => setMockResPaper({ ...mockResPaper, activationMode: mode.key as "manual" | "scheduled" | "always" })} className={cn("w-full text-left p-3 rounded-lg border transition-all", mockResPaper.activationMode === mode.key ? "border-primary bg-primary/5 text-primary" : "border-gray-200 text-gray-600 hover:border-gray-300")}>
                    <div className="flex items-center gap-2">
                      <div className={cn("w-4 h-4 rounded-full border flex items-center justify-center shrink-0", mockResPaper.activationMode === mode.key ? "bg-primary border-primary" : "border-gray-300")}>{mockResPaper.activationMode === mode.key && <div className="w-2 h-2 rounded-full bg-white" />}</div>
                      <span className="text-xs font-medium">{mode.label}</span>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1 ml-6">{mode.desc}</p>
                  </button>
                ))}
              </div>
              {mockResPaper.activationMode === "scheduled" && (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div><Label className="text-xs text-gray-500">启用时间</Label><Input type="datetime-local" value={mockResPaper.scheduledTime} onChange={e => setMockResPaper({ ...mockResPaper, scheduledTime: e.target.value })} className="mt-1 text-sm" /></div>
                  <div><Label className="text-xs text-gray-500">停用时间</Label><Input type="datetime-local" value={paperEndTime} onChange={e => setPaperEndTime(e.target.value)} className="mt-1 text-sm" /></div>
                </div>
              )}
            </div>
          </div>
        </div>
      )
    }
    if (methodKey === "question_bank") {
      const [qbDrawMode, setQbDrawMode] = useState<"all" | "practice">("all")
      const [qbPassRate, setQbPassRate] = useState(60)
      return (
        <div className="space-y-4">
          <QuestionSelectorPanel field="questionBankQuestions" selectedIds={config.questionBankQuestions} showAutoSelect={true} />
          <div className="border rounded-xl p-4">
            <p className="text-sm font-medium mb-3">答题规则</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-gray-500">答题方式</Label>
                <Select value={qbDrawMode} onValueChange={v => setQbDrawMode(v as "all" | "practice")}>
                  <SelectTrigger className="mt-1 text-sm h-9"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="all">全部作答</SelectItem><SelectItem value="practice">自由刷题</SelectItem></SelectContent>
                </Select>
              </div>
              {qbDrawMode === "practice" && <div><Label className="text-xs text-gray-500">正确率（%）</Label><Input type="number" value={qbPassRate} onChange={e => setQbPassRate(Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))} className="mt-1 text-sm" min={0} max={100} /><p className="text-[10px] text-gray-400 mt-1">超过正确率则得分 100，低于正确率得分 0</p></div>}
              <div><Label className="text-xs text-gray-500">时间限制（分钟）</Label><Input type="number" value={mockResQuestionBank.timeLimit} onChange={e => setMockResQuestionBank({ ...mockResQuestionBank, timeLimit: Math.max(5, parseInt(e.target.value) || 5) })} className="mt-1 text-sm" min={5} /></div>
            </div>
            <div className="mt-3 flex items-center gap-4">
              <div className="flex items-center gap-2"><Switch checked={mockResQuestionBank.allowRetake} onCheckedChange={v => setMockResQuestionBank({ ...mockResQuestionBank, allowRetake: v })} /><span className="text-xs text-gray-600">允许重复测评</span></div>
              <div className="flex items-center gap-2"><Switch checked={mockResQuestionBank.shuffleQuestions} onCheckedChange={v => setMockResQuestionBank({ ...mockResQuestionBank, shuffleQuestions: v })} /><span className="text-xs text-gray-600">题目乱序</span></div>
              <div className="flex items-center gap-2"><Switch checked={mockResQuestionBank.showResult} onCheckedChange={v => setMockResQuestionBank({ ...mockResQuestionBank, showResult: v })} /><span className="text-xs text-gray-600">提交后展示成绩</span></div>
            </div>
            {mockResQuestionBank.allowRetake && <div className="mt-3 grid grid-cols-2 gap-3"><div><Label className="text-xs text-gray-500">最多重考次数</Label><Input type="number" value={mockResQuestionBank.retakeCount} onChange={e => setMockResQuestionBank({ ...mockResQuestionBank, retakeCount: Math.max(1, parseInt(e.target.value) || 1) })} className="mt-1 text-sm" min={1} /></div></div>}
          </div>
        </div>
      )
    }
    if (methodKey === "outcome") {
      return (
        <div className="space-y-4">
          <div className="p-4 bg-cyan-50 rounded-lg border border-cyan-100 text-sm text-cyan-700"><div className="flex items-center gap-2 mb-2"><Info className="h-4 w-4" /><span className="font-medium">成果评价说明</span></div><p>成果评价时教师根据学生提交的成果材料进行打分。评价点配置请在「评价标准配置」卡片中设置。</p></div>
          <div className="border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3"><p className="text-sm font-medium">成果材料要求</p><div className="flex items-center gap-2"><Switch checked={mockResReview.requiresMaterial} onCheckedChange={v => setMockResReview({ ...mockResReview, requiresMaterial: v })} /><span className="text-xs text-gray-600">是否需要提交成果材料</span></div></div>
            {mockResReview.requiresMaterial && (<><div className="grid grid-cols-2 gap-3"><div><Label className="text-xs text-gray-500">预估提交天数</Label><Input type="number" value={mockResReview.deadlineDays} onChange={e => setMockResReview({ ...mockResReview, deadlineDays: Math.max(1, parseInt(e.target.value) || 1) })} className="mt-1 text-sm" min={1} /></div></div><div className="mt-3"><Label className="text-xs text-gray-500 mb-1.5">提交材料要求</Label><Textarea value={mockResReview.submitFormatDesc} onChange={e => setMockResReview({ ...mockResReview, submitFormatDesc: e.target.value })} placeholder="请用一句话说明学生需要提交的成果材料要求..." rows={2} className="text-sm" /></div></>)}
            <div className="mt-3"><Label className="text-xs text-gray-500 mb-1.5">评价场地/环境资源准备</Label><Textarea value={mockResReview.venueResources} onChange={e => setMockResReview({ ...mockResReview, venueResources: e.target.value })} placeholder="请描述评价所需的场地、设备及环境资源准备要求..." rows={2} className="text-sm" /></div>
            <div className="mt-3"><div className="flex items-center gap-2"><Switch checked={mockResReview.allowResubmit} onCheckedChange={v => setMockResReview({ ...mockResReview, allowResubmit: v })} /><span className="text-xs text-gray-600">允许重新提交</span></div></div>
          </div>
        </div>
      )
    }
    if (methodKey === "homework") {
      return (
        <div className="space-y-4">
          <div className="p-4 bg-pink-50 rounded-lg border border-pink-100 text-sm text-pink-700"><div className="flex items-center gap-2 mb-2"><Info className="h-4 w-4" /><span className="font-medium">作业说明</span></div><p>学生提交作业后，教师按评分规则进行打分。评价点配置请在「评价标准配置」卡片中设置。</p></div>
          <div className="border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3"><p className="text-sm font-medium">作业提交要求</p><div className="flex items-center gap-2"><Switch checked={mockResReview.requiresMaterial} onCheckedChange={v => setMockResReview({ ...mockResReview, requiresMaterial: v })} /><span className="text-xs text-gray-600">是否需要提交作业材料</span></div></div>
            {mockResReview.requiresMaterial && (<><div className="grid grid-cols-2 gap-3"><div><Label className="text-xs text-gray-500">预估提交天数</Label><Input type="number" value={mockResReview.deadlineDays} onChange={e => setMockResReview({ ...mockResReview, deadlineDays: Math.max(1, parseInt(e.target.value) || 1) })} className="mt-1 text-sm" min={1} /></div></div><div className="mt-3"><Label className="text-xs text-gray-500 mb-1.5">作业格式要求</Label><Textarea value={mockResReview.submitFormatDesc} onChange={e => setMockResReview({ ...mockResReview, submitFormatDesc: e.target.value })} placeholder="请用一句话说明学生需要提交的作业格式要求..." rows={2} className="text-sm" /></div></>)}
            <div className="mt-3"><div className="flex items-center gap-2"><Switch checked={mockResReview.allowResubmit} onCheckedChange={v => setMockResReview({ ...mockResReview, allowResubmit: v })} /><span className="text-xs text-gray-600">允许重新提交</span></div></div>
          </div>
        </div>
      )
    }
    if (methodKey === "quiz") {
      const quizPresetTimes = [5, 10, 15, 20, 30]
      const quizIsPreset = quizPresetTimes.includes(mockResQuestionBank.timeLimit)
      return (
        <div className="space-y-4">
          <QuestionSelectorPanel field="quizQuestions" selectedIds={config.quizQuestions} showAutoSelect={true} maxCount={30} />
          <div className="border rounded-xl p-4">
            <p className="text-sm font-medium mb-3">答题规则</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-gray-500">时间限制</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {quizPresetTimes.map(min => <button key={min} onClick={() => setMockResQuestionBank({ ...mockResQuestionBank, timeLimit: min })} className={cn("px-3 py-1.5 rounded-lg text-xs border transition-all", mockResQuestionBank.timeLimit === min && quizIsPreset ? "border-primary bg-primary/5 text-primary" : "border-gray-200 text-gray-600 hover:border-gray-300")}>{min} 分钟</button>)}
                  <button onClick={() => setMockResQuestionBank({ ...mockResQuestionBank, timeLimit: quizIsPreset ? 1 : mockResQuestionBank.timeLimit })} className={cn("px-3 py-1.5 rounded-lg text-xs border transition-all", !quizIsPreset && mockResQuestionBank.timeLimit > 0 ? "border-primary bg-primary/5 text-primary" : "border-gray-200 text-gray-600 hover:border-gray-300")}>自定义</button>
                </div>
                {!quizIsPreset && <div className="mt-2"><Input type="number" value={mockResQuestionBank.timeLimit} onChange={e => setMockResQuestionBank({ ...mockResQuestionBank, timeLimit: Math.max(1, parseInt(e.target.value) || 1) })} className="w-32 text-sm" min={1} placeholder="输入分钟数" /></div>}
              </div>
            </div>
            <div className="mt-3 flex items-center gap-4">
              <div className="flex items-center gap-2"><Switch checked={mockResQuestionBank.allowRetake} onCheckedChange={v => setMockResQuestionBank({ ...mockResQuestionBank, allowRetake: v })} /><span className="text-xs text-gray-600">允许重复测评</span></div>
              <div className="flex items-center gap-2"><Switch checked={mockResQuestionBank.shuffleQuestions} onCheckedChange={v => setMockResQuestionBank({ ...mockResQuestionBank, shuffleQuestions: v })} /><span className="text-xs text-gray-600">题目乱序</span></div>
              <div className="flex items-center gap-2"><Switch checked={mockResQuestionBank.showResult} onCheckedChange={v => setMockResQuestionBank({ ...mockResQuestionBank, showResult: v })} /><span className="text-xs text-gray-600">提交后展示成绩</span></div>
            </div>
          </div>
        </div>
      )
    }
    return null
  }

  const getMethodEvalInfo = (methodKey: string) => {
    switch (methodKey) {
      case "random_draw": return { points: config.randomDrawEvalPoints, field: "randomDrawEvalPoints" as const }
      case "review": return { points: config.reviewEvalPoints, field: "reviewEvalPoints" as const }
      case "paper": return { points: config.paperEvalPoints, field: "paperEvalPoints" as const }
      case "question_bank": return { points: config.questionBankEvalPoints, field: "questionBankEvalPoints" as const }
      case "outcome": return { points: config.outcomeEvalPoints, field: "outcomeEvalPoints" as const }
      case "homework": return { points: config.homeworkEvalPoints, field: "homeworkEvalPoints" as const }
      case "quiz": return { points: config.quizEvalPoints, field: "quizEvalPoints" as const }
      default: return { points: [] as EvalPoint[], field: "randomDrawEvalPoints" as const }
    }
  }

  function MixedTagEditor({ text, knowledgePointIds, abilityPointIds, onChange, onOpenKpDialog, onOpenAbDialog }: { text: string; knowledgePointIds: string[]; abilityPointIds: string[]; onChange: (updates: { name?: string; knowledgePointIds?: string[]; abilityPointIds?: string[] }) => void; onOpenKpDialog: () => void; onOpenAbDialog: () => void; }) {
    const ref = useRef<HTMLDivElement>(null)
    const isComposing = useRef(false)
    const onChangeRef = useRef(onChange)
    onChangeRef.current = onChange

    const createTagSpan = (type: 'kp' | 'ab', id: string): HTMLSpanElement | null => {
      const span = document.createElement('span')
      span.contentEditable = 'false'
      span.dataset.tag = 'true'
      span.dataset.type = type
      span.dataset.id = id
      if (type === 'kp') {
        const kp = knowledgePoints.find(k => k.id === id)
        if (!kp) return null
        span.className = 'inline-flex items-center px-1 py-0.5 rounded text-[10px] font-normal bg-blue-50 text-blue-600 border border-blue-200 mx-0.5 align-middle cursor-default'
        span.innerHTML = `${kp.name}<button class="ml-0.5 text-blue-400 hover:text-red-500 leading-none">×</button>`
        span.querySelector('button')!.onclick = (e) => { e.stopPropagation(); span.remove(); onChangeRef.current({ knowledgePointIds: knowledgePointIds.filter(i => i !== id) }) }
      } else {
        const ab = abilityPoints.find(a => a.id === id)
        if (!ab) return null
        span.className = 'inline-flex items-center px-1 py-0.5 rounded text-[10px] font-normal bg-amber-50 text-amber-600 border border-amber-200 mx-0.5 align-middle cursor-default'
        span.innerHTML = `${ab.name}<button class="ml-0.5 text-amber-400 hover:text-red-500 leading-none">×</button>`
        span.querySelector('button')!.onclick = (e) => { e.stopPropagation(); span.remove(); onChangeRef.current({ abilityPointIds: abilityPointIds.filter(i => i !== id) }) }
      }
      return span
    }

    useLayoutEffect(() => {
      const el = ref.current
      if (!el) return
      if (text) el.textContent = text
      else el.innerHTML = ''
      knowledgePointIds.forEach(kpid => { const span = createTagSpan('kp', kpid); if (span) el.appendChild(span); })
      abilityPointIds.forEach(abId => { const span = createTagSpan('ab', abId); if (span) el.appendChild(span); })
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const handleBlur = () => {
      if (isComposing.current) return
      const el = ref.current
      if (!el) return
      let newText = ''
      const newKpIds: string[] = []
      const newAbIds: string[] = []
      el.childNodes.forEach(node => {
        if (node.nodeType === Node.TEXT_NODE) newText += node.textContent || ''
        else if (node.nodeType === Node.ELEMENT_NODE) {
          const dataset = (node as HTMLElement).dataset
          if (dataset.tag) { if (dataset.type === 'kp' && dataset.id) newKpIds.push(dataset.id); if (dataset.type === 'ab' && dataset.id) newAbIds.push(dataset.id); }
        }
      })
      onChangeRef.current({ name: newText, knowledgePointIds: newKpIds, abilityPointIds: newAbIds })
    }

    return (
      <div className="min-h-[32px] rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-sm flex flex-wrap gap-1 items-center">
        <div ref={ref} contentEditable suppressContentEditableWarning className="flex-1 outline-none min-w-[80px] text-sm leading-6 empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400" data-placeholder="输入评价维度" onBlur={handleBlur} onCompositionStart={() => { isComposing.current = true }} onCompositionEnd={() => { isComposing.current = false }} onPaste={(e) => { e.preventDefault(); const pasted = e.clipboardData.getData('text/plain'); document.execCommand('insertText', false, pasted); }} />
        <Button variant="ghost" size="sm" className="h-5 text-[10px] px-1 text-gray-400 hover:text-primary shrink-0" onClick={onOpenKpDialog}>关联考查知识点</Button>
        <Button variant="ghost" size="sm" className="h-5 text-[10px] px-1 text-gray-400 hover:text-primary shrink-0" onClick={onOpenAbDialog}>关联考查能力点</Button>
      </div>
    )
  }

  const MethodDialogContent = ({ methodKey }: { methodKey: string }) => {
    const info = getMethodEvalInfo(methodKey)
    const [gradeMappingDialogOpen, setGradeMappingDialogOpen] = useState(false)
    const [editingGradeMappingPointId, setEditingGradeMappingPointId] = useState<string | null>(null)
    const [localDraft, setLocalDraft] = useState<{ name: string; mode: "rubric" | "score_rule"; types: EvalSubType[]; scoreRuleItems: ScoreRuleItem[] }>({ name: "", mode: "rubric", types: [], scoreRuleItems: [] })
    const [saveTemplateDialogOpen, setSaveTemplateDialogOpen] = useState(false)
    const [saveTemplateMode, setSaveTemplateMode] = useState<"new" | "replace">("new")
    const [selectedReplaceTemplateId, setSelectedReplaceTemplateId] = useState<string | null>(null)
    const rubricIdField = methodKey === "random_draw" ? "randomDrawRubricId" : methodKey === "review" ? "reviewRubricId" : methodKey === "outcome" ? "outcomeRubricId" : methodKey === "homework" ? "homeworkRubricId" : "reviewRubricId"
    const currentRubricId = (config as any)[rubricIdField] as string | null
    const view = methodDialogViews[methodKey] || "list"
    const setView = (v: "list" | "edit" | "template") => setMethodDialogViews(prev => ({ ...prev, [methodKey]: v }))
    const currentScheme = rubricLibrary.find(s => s.id === currentRubricId)

    const applyScheme = (schemeId: string) => {
      const scheme = rubricLibrary.find(s => s.id === schemeId)
      if (!scheme) return
      updateConfig({ [rubricIdField]: schemeId } as any)
      if (scheme.mode === "rubric") setEvalPoints(info.field, scheme.points.map(p => ({ ...p, id: uid("ep") })))
      else setEvalPoints(info.field, [])
      setEditingRubricId(schemeId)
    }

    const enterEdit = (schemeId: string | null) => {
      if (schemeId) {
        const scheme = rubricLibrary.find(s => s.id === schemeId)
        if (scheme) { setEvalPoints(info.field, JSON.parse(JSON.stringify(scheme.points))); setLocalDraft({ name: scheme.name, mode: scheme.mode, types: scheme.types, scoreRuleItems: scheme.scoreRuleItems || [] }) }
      } else { setEvalPoints(info.field, []); setLocalDraft({ name: "", mode: "rubric", types: [], scoreRuleItems: [] }) }
      setEditingRubricId(schemeId)
      setView("edit")
    }

    const saveRubricToLibrary = (schemeId: string | null, updates: Partial<RubricScheme>) => {
      if (schemeId) setRubricLibrary(prev => prev.map(s => s.id === schemeId ? { ...s, ...updates } as RubricScheme : s))
      else {
        const newId = uid("scheme")
        const newScheme: RubricScheme = { id: newId, name: updates.name || "新建评价标准", types: updates.types || [], desc: updates.desc || "", points: info.points.map(p => ({ ...p, id: uid("ep") })), mode: updates.mode || "rubric", scoreRuleItems: updates.scoreRuleItems || [] }
        setRubricLibrary(prev => [...prev, newScheme])
        updateConfig({ [rubricIdField]: newId } as any)
      }
    }

    const editingScheme = editingRubricId ? rubricLibrary.find(s => s.id === editingRubricId) : null
    const draftScheme = editingScheme ? { name: editingScheme.name, types: editingScheme.types, mode: editingScheme.mode, scoreRuleItems: editingScheme.scoreRuleItems || [] } : localDraft

    if (view === "edit") {
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-end mb-2"><Button variant="outline" size="sm" className="text-xs h-8" onClick={() => { setView("template"); setEditingRubricId(null); }}><BookOpen className="h-3.5 w-3.5 mr-1" />选择评价标准模板覆盖</Button></div>
          <div className="border rounded-xl p-4 bg-gray-50/50">
            <p className="text-sm font-medium mb-3">评价标准信息</p>
            <div className="space-y-3">
              <div><Label className="text-xs text-gray-500">评价标准名称</Label><Input value={draftScheme.name} onChange={e => { if (editingRubricId) setRubricLibrary(prev => prev.map(s => s.id === editingRubricId ? { ...s, name: e.target.value } : s)); else setLocalDraft(prev => ({ ...prev, name: e.target.value })); }} className="mt-1 text-sm" placeholder="输入评价标准名称" /></div>
              <div>
                <Label className="text-xs text-gray-500">评价标准类型</Label>
                <div className="flex gap-3 mt-1">
                  {methodKey !== "homework" && <button onClick={() => { if (editingRubricId) setRubricLibrary(prev => prev.map(s => s.id === editingRubricId ? { ...s, mode: "rubric" } : s)); else setLocalDraft(prev => ({ ...prev, mode: "rubric" })); }} className={cn("px-3 py-1.5 rounded-lg text-xs border transition-all flex items-center gap-1.5", draftScheme.mode === "rubric" ? "bg-primary/10 text-primary border-primary" : "bg-white text-gray-500 border-gray-200 hover:border-gray-300")}><div className={cn("w-3.5 h-3.5 rounded-full border flex items-center justify-center", draftScheme.mode === "rubric" ? "border-primary" : "border-gray-300")}>{draftScheme.mode === "rubric" && <div className="w-2 h-2 rounded-full bg-primary" />}</div>评价量规</button>}
                  <button onClick={() => { if (editingRubricId) setRubricLibrary(prev => prev.map(s => s.id === editingRubricId ? { ...s, mode: "score_rule", scoreRuleItems: s.scoreRuleItems?.length ? s.scoreRuleItems : [{ id: uid("sr"), name: "", desc: "", rule: "", weight: 0 }] } : s)); else setLocalDraft(prev => ({ ...prev, mode: "score_rule", scoreRuleItems: prev.scoreRuleItems?.length ? prev.scoreRuleItems : [{ id: uid("sr"), name: "", desc: "", rule: "", weight: 0 }] })); }} className={cn("px-3 py-1.5 rounded-lg text-xs border transition-all flex items-center gap-1.5", draftScheme.mode === "score_rule" ? "bg-primary/10 text-primary border-primary" : "bg-white text-gray-500 border-gray-200 hover:border-gray-300")}><div className={cn("w-3.5 h-3.5 rounded-full border flex items-center justify-center", draftScheme.mode === "score_rule" ? "border-primary" : "border-gray-300")}>{draftScheme.mode === "score_rule" && <div className="w-2 h-2 rounded-full bg-primary" />}</div>评分规则</button>
                </div>
                {methodKey === "homework" && <p className="text-[10px] text-gray-400 mt-1">作业测评仅需使用评分规则即可</p>}
              </div>
            </div>
          </div>
          {draftScheme.mode === "rubric" ? (
            <div className="border rounded-xl p-4 overflow-hidden">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium">评价量规配置表</p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => { const count = info.points.length; if (count === 0) return; const base = Math.floor(100 / count); const remainder = 100 % count; const newPoints = info.points.map((p, i) => ({ ...p, weight: base + (i < remainder ? 1 : 0) })); setEvalPoints(info.field, newPoints); }}><RotateCcw className="h-3.5 w-3.5 mr-1" />一键均分</Button>
                  <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => addEvalPoint(info.field, { name: "", types: draftScheme.types.length ? draftScheme.types : undefined })}><Plus className="h-3.5 w-3.5 mr-1" />添加评价维度</Button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse min-w-[900px]">
                  <thead><tr className="border-b bg-gray-50 text-gray-500 text-xs"><th className="py-2.5 px-2 text-left w-12">序号</th><th className="py-2.5 px-2 text-left min-w-[360px]">评价维度名称/关联知识点/能力点</th><th className="py-2.5 px-2 text-left min-w-[440px]">评价等级</th><th className="py-2.5 px-2 text-center w-16">权重(%)</th><th className="py-2.5 px-2 text-center w-14">操作</th></tr></thead>
                  <tbody>
                    {info.points.map((ep, idx) => (
                      <tr key={ep.id} className="border-b hover:bg-gray-50/50 transition-colors">
                        <td className="py-3 px-2"><span className="text-gray-600 align-middle">{idx + 1}</span></td>
                        <td className="py-3 px-2"><MixedTagEditor text={ep.name} knowledgePointIds={ep.knowledgePointIds || []} abilityPointIds={ep.abilityPointIds || []} onChange={updates => updateEvalPoint(info.field, ep.id, updates)} onOpenKpDialog={() => openRubricKpDialog(ep.id, info.field)} onOpenAbDialog={() => openRubricAbDialog(ep.id, info.field)} /></td>
                        <td className="py-3 px-2"><button onClick={() => { setEditingGradeMappingPointId(ep.id); setGradeMappingDialogOpen(true); }} className="text-xs text-left text-primary hover:underline w-full block">{ep.gradeMapping?.map(gm => <div key={gm.id} className="truncate leading-relaxed" title={`${gm.grade} (${gm.minScore}-${gm.maxScore}分) ${gm.remark}`}>{gm.grade} ({gm.minScore}-{gm.maxScore}分) {gm.remark}</div>)}{!ep.gradeMapping?.length && "点击配置评价等级"}</button></td>
                        <td className="py-3 px-2"><Input type="number" value={ep.weight || 0} onChange={e => updateEvalPoint(info.field, ep.id, { weight: Math.max(0, Math.min(100, parseInt(e.target.value) || 0)) })} className="h-8 text-sm text-center" /></td>
                        <td className="py-3 px-2 text-center"><button className="text-red-500 hover:text-red-600 text-xs" onClick={() => removeEvalPoint(info.field, ep.id)}>删除</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 space-y-2">
                <button onClick={() => addEvalPoint(info.field, { name: "", types: draftScheme.types.length ? draftScheme.types : undefined })} className="w-full py-3 border-2 border-dashed border-gray-200 rounded-lg text-sm text-gray-500 hover:border-primary/40 hover:text-primary transition-colors flex items-center justify-center gap-1"><Plus className="h-4 w-4" />添加评价维度</button>
                {info.points.length > 0 && <div className="flex justify-end text-xs items-center gap-1"><span className="text-gray-500">维度权重合计：</span><span className={cn("font-semibold", info.points.reduce((sum, p) => sum + (p.weight || 0), 0) === 100 ? "text-green-600" : "text-red-500")}>{info.points.reduce((sum, p) => sum + (p.weight || 0), 0)}%</span>{info.points.reduce((sum, p) => sum + (p.weight || 0), 0) !== 100 && <span className="text-red-500">⚠️（需等于100%）</span>}</div>}
              </div>
              {info.points.length === 0 && <div className="text-center text-gray-400 py-8"><Target className="h-8 w-8 mx-auto mb-2 opacity-50" /><p className="text-sm">尚未添加评价点</p><p className="text-xs mt-1">点击上方按钮添加第一个评价点</p></div>}
            </div>
          ) : (
            <div className="border rounded-xl p-4 overflow-hidden">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium">评分规则配置表</p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => { const items = draftScheme.scoreRuleItems || []; const count = items.length; if (count === 0) return; const base = Math.floor(100 / count); const remainder = 100 % count; const newItems = items.map((it, i) => ({ ...it, weight: base + (i < remainder ? 1 : 0) })); if (editingRubricId) setRubricLibrary(prev => prev.map(s => s.id === editingRubricId ? { ...s, scoreRuleItems: newItems } : s)); else setLocalDraft(prev => ({ ...prev, scoreRuleItems: newItems })); }}><RotateCcw className="h-3.5 w-3.5 mr-1" />一键均分</Button>
                  <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => { const newItem: ScoreRuleItem = { id: uid("sr"), name: "", desc: "", rule: "", weight: 0 }; if (editingRubricId) setRubricLibrary(prev => prev.map(s => s.id === editingRubricId ? { ...s, scoreRuleItems: [...(s.scoreRuleItems || []), newItem] } : s)); else setLocalDraft(prev => ({ ...prev, scoreRuleItems: [...(prev.scoreRuleItems || []), newItem] })); }}><Plus className="h-3.5 w-3.5 mr-1" />添加评价项</Button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse min-w-[700px]">
                  <thead><tr className="border-b bg-gray-50 text-gray-500 text-xs"><th className="py-2.5 px-2 text-left w-16">序号</th><th className="py-2.5 px-2 text-left min-w-[300px]">评价项/评分标准描述</th><th className="py-2.5 px-2 text-left min-w-[200px]">加减分规则</th><th className="py-2.5 px-2 text-center w-20">分值</th><th className="py-2.5 px-2 text-center w-16">操作</th></tr></thead>
                  <tbody>
                    {(draftScheme.scoreRuleItems || []).map((item, idx) => (
                      <tr key={item.id} className="border-b hover:bg-gray-50/50 transition-colors">
                        <td className="py-3 px-2"><span className="text-gray-600 align-middle">{idx + 1}</span></td>
                        <td className="py-3 px-2"><Textarea value={item.name + (item.desc ? `\n${item.desc}` : "")} onChange={e => { const lines = e.target.value.split('\n'); const newName = lines[0] || ""; const newDesc = lines.slice(1).join('\n'); if (editingRubricId) setRubricLibrary(prev => prev.map(s => s.id === editingRubricId ? { ...s, scoreRuleItems: (s.scoreRuleItems || []).map(it => it.id === item.id ? { ...it, name: newName, desc: newDesc } : it) } : s)); else setLocalDraft(prev => ({ ...prev, scoreRuleItems: (prev.scoreRuleItems || []).map(it => it.id === item.id ? { ...it, name: newName, desc: newDesc } : it) })); }} className="text-sm min-h-[60px]" placeholder="请输入评分描述" rows={2} /></td>
                        <td className="py-3 px-2"><Textarea value={item.rule} onChange={e => { if (editingRubricId) setRubricLibrary(prev => prev.map(s => s.id === editingRubricId ? { ...s, scoreRuleItems: (s.scoreRuleItems || []).map(it => it.id === item.id ? { ...it, rule: e.target.value } : it) } : s)); else setLocalDraft(prev => ({ ...prev, scoreRuleItems: (prev.scoreRuleItems || []).map(it => it.id === item.id ? { ...it, rule: e.target.value } : it) })); }} className="text-sm min-h-[60px]" placeholder="输入加减分规则" rows={2} /></td>
                        <td className="py-3 px-2"><Input type="number" value={item.weight || 0} onChange={e => { const val = Math.max(0, Math.min(100, parseInt(e.target.value) || 0)); if (editingRubricId) setRubricLibrary(prev => prev.map(s => s.id === editingRubricId ? { ...s, scoreRuleItems: (s.scoreRuleItems || []).map(it => it.id === item.id ? { ...it, weight: val } : it) } : s)); else setLocalDraft(prev => ({ ...prev, scoreRuleItems: (prev.scoreRuleItems || []).map(it => it.id === item.id ? { ...it, weight: val } : it) })); }} className="h-8 text-sm text-center" /></td>
                        <td className="py-3 px-2 text-center"><button className="text-red-500 hover:text-red-600 text-xs" onClick={() => { if (editingRubricId) setRubricLibrary(prev => prev.map(s => s.id === editingRubricId ? { ...s, scoreRuleItems: (s.scoreRuleItems || []).filter(it => it.id !== item.id) } : s)); else setLocalDraft(prev => ({ ...prev, scoreRuleItems: (prev.scoreRuleItems || []).filter(it => it.id !== item.id) })); }}>删除</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 space-y-2">
                <button onClick={() => { const newItem: ScoreRuleItem = { id: uid("sr"), name: "", desc: "", rule: "", weight: 0 }; if (editingRubricId) setRubricLibrary(prev => prev.map(s => s.id === editingRubricId ? { ...s, scoreRuleItems: [...(s.scoreRuleItems || []), newItem] } : s)); else setLocalDraft(prev => ({ ...prev, scoreRuleItems: [...(prev.scoreRuleItems || []), newItem] })); }} className="w-full py-3 border-2 border-dashed border-gray-200 rounded-lg text-sm text-gray-500 hover:border-primary/40 hover:text-primary transition-colors flex items-center justify-center gap-1"><Plus className="h-4 w-4" />添加评价项</button>
                {(draftScheme.scoreRuleItems || []).length > 0 && <div className="flex justify-end text-xs items-center gap-1"><span className="text-gray-500">分值合计：</span><span className={cn("font-semibold", (draftScheme.scoreRuleItems || []).reduce((sum, it) => sum + (it.weight || 0), 0) === 100 ? "text-green-600" : "text-red-500")}>{(draftScheme.scoreRuleItems || []).reduce((sum, it) => sum + (it.weight || 0), 0)}%</span>{(draftScheme.scoreRuleItems || []).reduce((sum, it) => sum + (it.weight || 0), 0) !== 100 && <span className="text-red-500">⚠️（需等于100%）</span>}</div>}
              </div>
              {(draftScheme.scoreRuleItems || []).length === 0 && <div className="text-center text-gray-400 py-8"><Target className="h-8 w-8 mx-auto mb-2 opacity-50" /><p className="text-sm">尚未添加评价项</p><p className="text-xs mt-1">点击上方按钮添加第一个评价项</p></div>}
            </div>
          )}
          <div className="flex items-center gap-2">
            <Button size="sm" className="text-xs h-8" onClick={() => { if (editingRubricId) setRubricLibrary(prev => prev.map(s => s.id === editingRubricId ? { ...s, points: info.points.map(p => ({ ...p })) } : s)); else saveRubricToLibrary(null, { name: draftScheme.name || "新建评价标准", types: draftScheme.types, desc: "", mode: draftScheme.mode, scoreRuleItems: draftScheme.scoreRuleItems }); setView("list"); setEditingRubricId(null); }}>保存</Button>
            <Button size="sm" variant="outline" className="text-xs h-8" onClick={() => { setSaveTemplateDialogOpen(true); setSaveTemplateMode("new"); setSelectedReplaceTemplateId(null); }}>保存到模板</Button>
          </div>
          <Dialog open={saveTemplateDialogOpen} onOpenChange={setSaveTemplateDialogOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle>保存到模板</DialogTitle></DialogHeader>
              <div className="space-y-4 py-2">
                <div className="flex items-center gap-2">
                  <button onClick={() => setSaveTemplateMode("new")} className={cn("flex-1 px-3 py-2 rounded-lg text-xs border transition-all", saveTemplateMode === "new" ? "border-primary bg-primary/5 text-primary" : "border-gray-200 text-gray-500 hover:border-gray-300")}>新增模板</button>
                  <button onClick={() => setSaveTemplateMode("replace")} className={cn("flex-1 px-3 py-2 rounded-lg text-xs border transition-all", saveTemplateMode === "replace" ? "border-primary bg-primary/5 text-primary" : "border-gray-200 text-gray-500 hover:border-gray-300")}>替换现有模板</button>
                </div>
                {saveTemplateMode === "new" ? <div><Label className="text-xs text-gray-500">模板名称</Label><Input value={draftScheme.name} onChange={e => { if (editingRubricId) setRubricLibrary(prev => prev.map(s => s.id === editingRubricId ? { ...s, name: e.target.value } : s)); else setLocalDraft(prev => ({ ...prev, name: e.target.value })); }} className="mt-1 text-sm" placeholder="输入模板名称" /></div> : <div className="space-y-2"><Label className="text-xs text-gray-500">选择要替换的模板</Label><div className="space-y-2 max-h-[200px] overflow-y-auto">{rubricLibrary.map(scheme => <div key={scheme.id} onClick={() => setSelectedReplaceTemplateId(scheme.id)} className={cn("p-3 rounded-lg border cursor-pointer transition-all", selectedReplaceTemplateId === scheme.id ? "border-primary bg-primary/5" : "border-gray-200 hover:border-gray-300")}><p className="text-sm font-medium">{scheme.name}</p><p className="text-xs text-gray-400 mt-0.5">{scheme.mode === "rubric" ? "评价量规" : "评分规则"}</p></div>)}</div></div>}
              </div>
              <DialogFooter>
                <Button variant="outline" size="sm" className="text-xs" onClick={() => setSaveTemplateDialogOpen(false)}>取消</Button>
                <Button size="sm" className="text-xs" onClick={() => { if (saveTemplateMode === "new") saveRubricToLibrary(null, { name: draftScheme.name || "新建评价标准", types: draftScheme.types, desc: "", mode: draftScheme.mode, scoreRuleItems: draftScheme.scoreRuleItems }); else if (selectedReplaceTemplateId) setRubricLibrary(prev => prev.map(s => s.id === selectedReplaceTemplateId ? { ...s, points: info.points.map(p => ({ ...p })), mode: draftScheme.mode, scoreRuleItems: draftScheme.scoreRuleItems || [] } : s)); setSaveTemplateDialogOpen(false); setView("list"); setEditingRubricId(null); }} disabled={saveTemplateMode === "replace" && !selectedReplaceTemplateId}>确认保存</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={gradeMappingDialogOpen} onOpenChange={v => !v && setGradeMappingDialogOpen(false)}>
            <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>编辑评分等级</DialogTitle></DialogHeader>
              {(() => {
                const ep = info.points.find(p => p.id === editingGradeMappingPointId)
                if (!ep || !ep.gradeMapping) return null
                const gm = ep.gradeMapping
                return (
                  <div className="space-y-3 py-2">
                    {gm.map(g => (
                      <div key={g.id} className="flex items-start gap-2 p-3 rounded-lg border bg-gray-50/50">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <Input value={g.grade} onChange={e => { const newGm = gm.map(x => x.id === g.id ? { ...x, grade: e.target.value } : x); updateEvalPoint(info.field, ep.id, { gradeMapping: newGm }); }} className="w-14 h-7 text-center text-xs font-semibold" placeholder="等级" />
                            <Input type="number" value={g.minScore} onChange={e => { const newGm = gm.map(x => x.id === g.id ? { ...x, minScore: parseInt(e.target.value) || 0 } : x); updateEvalPoint(info.field, ep.id, { gradeMapping: newGm }); }} className="w-16 h-7 text-center text-xs" min={0} max={100} />
                            <span className="text-gray-500 text-xs">-</span>
                            <Input type="number" value={g.maxScore} onChange={e => { const newGm = gm.map(x => x.id === g.id ? { ...x, maxScore: parseInt(e.target.value) || 0 } : x); updateEvalPoint(info.field, ep.id, { gradeMapping: newGm }); }} className="w-16 h-7 text-center text-xs" min={0} max={100} />
                            <span className="text-xs text-gray-500">分</span>
                          </div>
                          <Input value={g.remark || ""} onChange={e => { const newGm = gm.map(x => x.id === g.id ? { ...x, remark: e.target.value } : x); updateEvalPoint(info.field, ep.id, { gradeMapping: newGm }); }} className="h-7 text-xs" placeholder="等级描述" />
                        </div>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-gray-400 hover:text-red-500" onClick={() => { const newGm = gm.filter(x => x.id !== g.id); updateEvalPoint(info.field, ep.id, { gradeMapping: newGm }); }}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => { const colors = ["bg-green-500", "bg-blue-500", "bg-yellow-500", "bg-red-500", "bg-purple-500", "bg-orange-500"]; const newGm = [...gm, { id: uid("grade"), grade: "新等级", minScore: 0, maxScore: 100, color: colors[gm.length % colors.length], remark: "" }]; updateEvalPoint(info.field, ep.id, { gradeMapping: newGm }); }}><Plus className="h-3.5 w-3.5 mr-1" />新增等级</Button>
                  </div>
                )
              })()}
              <DialogFooter><Button variant="outline" size="sm" onClick={() => setGradeMappingDialogOpen(false)}>关闭</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )
    }

    if (view === "template") {
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between"><Button variant="ghost" size="sm" className="text-xs h-8" onClick={() => setView("edit")}><ChevronLeft className="h-3.5 w-3.5 mr-1" />返回评价标准编辑</Button></div>
          <p className="text-sm font-medium">选择评价标准模板进行覆盖</p>
          <div className="grid grid-cols-1 gap-3">
            {rubricLibrary.map(scheme => (
              <div key={scheme.id} className="p-4 rounded-xl border border-gray-200 bg-white hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer" onClick={() => { applyScheme(scheme.id); setView("edit"); }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5"><p className="text-sm font-semibold">{scheme.name}</p><Badge variant="outline" className={cn("text-[10px]", scheme.mode === "rubric" ? "bg-purple-50 text-purple-600 border-purple-200" : "bg-blue-50 text-blue-600 border-blue-200")}>{scheme.mode === "rubric" ? "评价量规" : "评分规则"}</Badge></div>
                    <p className="text-xs text-gray-400 mb-2">{scheme.desc}</p>
                    <div className="flex flex-wrap gap-1.5">{scheme.types.map(type => <Badge key={type} variant="outline" className={cn("text-[10px]", evalSubTypeColors[type])}>{evalSubTypeLabels[type]}</Badge>)}</div>
                    <p className="text-xs text-gray-400 mt-1.5">{scheme.mode === "rubric" ? `${scheme.points.length} 个评价点` : `${scheme.scoreRuleItems?.length || 0} 个评价项`}</p>
                  </div>
                  <Button size="sm" className="h-7 text-[11px] px-2.5 shrink-0 mt-0.5" onClick={e => { e.stopPropagation(); applyScheme(scheme.id); setView("edit"); }}>使用此模板</Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )
    }

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">选择评价标准方案</p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => { setView("template"); setEditingRubricId(null); }}><BookOpen className="h-3.5 w-3.5 mr-1" />选择评价标准模板覆盖</Button>
            <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => enterEdit(null)}><Plus className="h-3.5 w-3.5 mr-1" />添加评价标准</Button>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3">
          {rubricLibrary.map(scheme => {
            const isSelected = currentRubricId === scheme.id
            return (
              <div key={scheme.id} className={cn("p-4 rounded-xl border transition-all cursor-pointer", isSelected ? "border-primary bg-white ring-1 ring-primary/20 shadow-sm" : "border-gray-200 bg-white hover:border-primary/40 hover:shadow-sm")} onClick={() => { if (isSelected) { updateConfig({ [rubricIdField]: null } as any); setEvalPoints(info.field, []); } else applyScheme(scheme.id); }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5"><p className="text-sm font-semibold">{scheme.name}</p><Badge variant="outline" className={cn("text-[10px]", scheme.mode === "rubric" ? "bg-purple-50 text-purple-600 border-purple-200" : "bg-blue-50 text-blue-600 border-blue-200")}>{scheme.mode === "rubric" ? "评价量规" : "评分规则"}</Badge>{isSelected && <div className="flex items-center gap-1 text-primary text-xs font-medium bg-primary/5 px-2 py-0.5 rounded-full"><CheckCircle2 className="h-3 w-3" />已选用</div>}</div>
                    <p className="text-xs text-gray-400 mb-2">{scheme.desc}</p>
                    <div className="flex flex-wrap gap-1.5">{scheme.types.map(type => <Badge key={type} variant="outline" className={cn("text-[10px]", evalSubTypeColors[type])}>{evalSubTypeLabels[type]}</Badge>)}</div>
                    <p className="text-xs text-gray-400 mt-1.5">{scheme.mode === "rubric" ? `${scheme.points.length} 个评价点` : `${scheme.scoreRuleItems?.length || 0} 个评价项`}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                    <Button size="sm" variant={isSelected ? "outline" : "default"} className="h-7 text-[11px] px-2.5" onClick={e => { e.stopPropagation(); if (isSelected) { updateConfig({ [rubricIdField]: null } as any); setEvalPoints(info.field, []); } else applyScheme(scheme.id); }}>{isSelected ? "取消选用" : "选用"}</Button>
                    <Button variant="outline" size="sm" className="h-7 text-[11px] px-2.5" onClick={e => { e.stopPropagation(); enterEdit(scheme.id); }}>编辑</Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        {!currentRubricId && <div className="text-center text-gray-400 py-6"><Target className="h-8 w-8 mx-auto mb-2 opacity-50" /><p className="text-sm">尚未选用评价标准</p><p className="text-xs mt-1">请从上方列表中选用一个评价标准方案</p></div>}
      </div>
    )
  }

  const ResourceCard = ({ methodKey, onClick }: { methodKey: string; onClick: () => void }) => {
    const summary = getMethodConfigSummary(methodKey)
    return (
      <button onClick={onClick} className="relative p-4 rounded-xl border text-left transition-all hover:border-blue-400 hover:bg-blue-50/30 bg-white group h-full">
        <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-blue-50 text-blue-600 text-[10px] flex items-center justify-center font-medium border border-blue-100">1</div>
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 rounded-md bg-blue-50 text-blue-600 group-hover:bg-blue-100 transition-colors">
            <Database className="h-4 w-4" />
          </div>
          <span className="text-xs font-medium text-gray-600">测评资源</span>
          {summary.configured && <CheckCircle2 className="h-3.5 w-3.5 text-blue-500 ml-auto" />}
        </div>
        <p className="text-sm font-semibold truncate pr-6">{summary.summary || "未配置"}</p>
        <p className="text-xs text-gray-400 mt-1">{summary.configured ? "点击修改测评资源" : "点击配置测评资源"}</p>
      </button>
    )
  }

  const MethodCard = ({ methodKey, onClick }: { methodKey: string; onClick: () => void }) => {
    const info = getMethodEvalInfo(methodKey)
    const subTypeCount = Object.entries(info.points.reduce((acc, p) => { if (p.subType) acc[p.subType] = (acc[p.subType] || 0) + 1; return acc; }, {} as Record<string, number>)).map(([k, v]) => `${evalSubTypeLabels[k as EvalSubType]}${v}`)
    return (
      <button onClick={onClick} className="relative p-4 rounded-xl border text-left transition-all hover:border-purple-400 hover:bg-purple-50/30 bg-white group h-full">
        <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-purple-50 text-purple-600 text-[10px] flex items-center justify-center font-medium border border-purple-100">2</div>
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 rounded-md bg-purple-50 text-purple-600 group-hover:bg-purple-100 transition-colors">
            <Target className="h-4 w-4" />
          </div>
          <span className="text-xs font-medium text-gray-600">评价标准配置</span>
          {info.points.length > 0 && <Badge variant="outline" className="text-[10px] ml-auto">{info.points.length} 点</Badge>}
        </div>
        <p className="text-sm font-semibold truncate pr-6">{info.points.length === 0 ? "未配置评价点" : `${info.points.length} 个评价点`}</p>
        <p className="text-xs text-gray-400 mt-1">{subTypeCount.length === 0 ? "点击配置评价标准" : subTypeCount.join(" · ")}</p>
      </button>
    )
  }

  const BodyContent = () => (
    <>
      {config.evaluationMethods.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-gray-400 py-12">
          <Target className="h-12 w-12 mb-3 opacity-50" />
          <p className="text-sm">尚未配置评价方式</p>
          <p className="text-xs mt-1">请先在「配置课程测评方式」中选择评价类型</p>
        </div>
      ) : (
        <div className="space-y-5 p-1">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" className="text-xs h-9" onClick={() => setIsOrderConfigOpen(true)}><ListOrdered className="h-3.5 w-3.5 mr-1.5" />配置评价顺序</Button>
            <Button variant="outline" size="sm" className="text-xs h-9" onClick={() => setIsWeightConfigOpen(true)}><Scale className="h-3.5 w-3.5 mr-1.5" />配置评价权重<span className={cn("ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium", methodWeightTotal === 100 ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600")}>{methodWeightTotal}%</span></Button>
          </div>

          <Dialog open={isOrderConfigOpen} onOpenChange={setIsOrderConfigOpen}>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader><DialogTitle>评价方式顺序配置</DialogTitle><DialogDescription>点击箭头调整评价方式的执行顺序</DialogDescription></DialogHeader>
              <div className="space-y-1.5 py-4">
                {getMethodInstances().map(({ methodKey, instanceIndex }, index) => {
                  const method = evaluationMethodOptions.find(o => o.key === methodKey)
                  if (!method) return null
                  const instanceCount = methodInstanceCounts[methodKey] || 1
                  const displayLabel = instanceCount > 1 ? `${method.label} ${instanceIndex + 1}` : method.label
                  return (
                    <div key={`${methodKey}-${instanceIndex}`} className="flex items-center gap-3 p-2.5 rounded-lg border border-gray-100 bg-gray-50/50">
                      <span className="w-5 h-5 rounded-full bg-gray-200 text-gray-500 text-[10px] flex items-center justify-center font-medium">{index + 1}</span>
                      <div className={cn("p-1.5 rounded-md", method.color)}>{method.icon}</div>
                      <span className="text-sm font-medium flex-1">{displayLabel}</span>
                      <div className="flex items-center gap-0.5">
                        <button onClick={() => moveMethodUp(index)} disabled={index === 0} className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-200/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"><ChevronUp className="h-3.5 w-3.5" /></button>
                        <button onClick={() => moveMethodDown(index)} disabled={index === getMethodInstances().length - 1} className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-200/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"><ChevronDown className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                  )
                })}
              </div>
              <DialogFooter><Button onClick={() => setIsOrderConfigOpen(false)}>完成</Button></DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isWeightConfigOpen} onOpenChange={setIsWeightConfigOpen}>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader><DialogTitle>评价方式权重配置</DialogTitle><DialogDescription>配置各评价方式的权重占比，合计需等于 100%</DialogDescription></DialogHeader>
              <div className="py-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className={cn("flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium", methodWeightTotal === 100 ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600")}><span>合计</span><span>{methodWeightTotal}%</span>{methodWeightTotal !== 100 && <span className="text-[10px]">(需等于100%)</span>}</div>
                  <Button variant="outline" size="sm" className="text-xs h-8" onClick={distributeMethodWeights}><RotateCcw className="h-3.5 w-3.5 mr-1" />一键平均</Button>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {getMethodInstances().map(({ methodKey, instanceIndex }) => {
                    const method = evaluationMethodOptions.find(o => o.key === methodKey)
                    if (!method) return null
                    const instanceCount = methodInstanceCounts[methodKey] || 1
                    const displayLabel = instanceCount > 1 ? `${method.label} ${instanceIndex + 1}` : method.label
                    const weight = config.methodWeights[methodKey] || 0
                    return (
                      <div key={`${methodKey}-${instanceIndex}`} className="flex items-center gap-2.5 p-3 rounded-lg border border-gray-100 bg-gray-50/50">
                        <div className={cn("p-1.5 rounded-md shrink-0", method.color)}>{method.icon}</div>
                        <div className="flex-1 min-w-0"><p className="text-xs font-medium text-gray-700 truncate">{displayLabel}</p><div className="flex items-center gap-1 mt-1"><Input type="number" value={weight} onChange={e => updateMethodWeight(methodKey, parseInt(e.target.value) || 0)} className="h-7 text-xs w-16 text-center" min={0} max={100} /><span className="text-xs text-gray-400">%</span></div></div>
                      </div>
                    )
                  })}
                </div>
              </div>
              <DialogFooter><Button onClick={() => setIsWeightConfigOpen(false)}>完成</Button></DialogFooter>
            </DialogContent>
          </Dialog>

          {getMethodInstances().map(({ methodKey, instanceIndex }) => {
            const method = evaluationMethodOptions.find(o => o.key === methodKey)
            if (!method) return null
            const instanceCount = methodInstanceCounts[methodKey] || 1
            const displayLabel = instanceCount > 1 ? `${method.label} ${instanceIndex + 1}` : method.label
            return (
              <div key={`${methodKey}-${instanceIndex}`} className="border rounded-xl overflow-hidden bg-white">
                <div className={cn("flex items-center gap-3 px-4 py-3 border-b bg-gray-50/80")}>
                  <div className={cn("p-1.5 rounded-md", method.color)}>{method.icon}</div>
                  <div className="flex-1 min-w-0"><p className="text-sm font-semibold">{displayLabel}</p><p className="text-xs text-gray-400">{method.desc}</p></div>
                </div>
                <div className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 relative">
                    <ResourceCard methodKey={methodKey} onClick={() => openDialog("resource", methodKey)} />
                    <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-gray-100 border border-gray-200 text-gray-400 text-xs items-center justify-center z-10">→</div>
                    {(methodKey === "question_bank" || methodKey === "paper" || methodKey === "quiz") ? (
                      <div className="relative p-4 rounded-xl border text-left bg-green-50/50 border-green-100 hover:border-green-200 transition-colors h-full">
                        <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-green-100 text-green-600 text-[10px] flex items-center justify-center font-medium border border-green-200">2</div>
                        <div className="flex items-center gap-2 mb-3">
                          <div className="p-1.5 rounded-md bg-green-100 text-green-600">
                            <Target className="h-4 w-4" />
                          </div>
                          <span className="text-xs font-medium text-green-700">评价标准配置</span>
                        </div>
                        <p className="text-sm font-semibold text-green-700">自动读取得分</p>
                        <p className="text-xs text-green-500 mt-1">系统将自动读取测评资源的得分</p>
                      </div>
                    ) : <MethodCard methodKey={methodKey} onClick={() => openDialog("method", methodKey)} />}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )

  const SubDialogs = () => (
    <>
      <Dialog open={erDialogOpen === "resource"} onOpenChange={v => !v && setErDialogOpen(null)}>
        <DialogContent className="sm:max-w-[85vw] max-w-[85vw] h-[92vh] overflow-y-auto">
          <DialogHeader><DialogTitle>测评资源配置</DialogTitle><DialogDescription>配置 {erDialogMethod ? evaluationMethodOptions.find(o => o.key === erDialogMethod)?.label : ""} 的测评资源</DialogDescription></DialogHeader>
          {erDialogMethod && <EvalResourceOnlyPanel methodKey={erDialogMethod} />}
        </DialogContent>
      </Dialog>

      <Dialog open={erDialogOpen === "method"} onOpenChange={v => !v && setErDialogOpen(null)}>
        <DialogContent className="sm:max-w-[90vw] max-w-[90vw] h-[92vh] overflow-y-auto">
          <DialogHeader><DialogTitle>评价标准配置</DialogTitle><DialogDescription>配置 {erDialogMethod ? evaluationMethodOptions.find(o => o.key === erDialogMethod)?.label : ""} 的评价点与评分规则</DialogDescription></DialogHeader>
          {erDialogMethod && <MethodDialogContent methodKey={erDialogMethod} />}
        </DialogContent>
      </Dialog>

      <Dialog open={questionDetailOpen} onOpenChange={setQuestionDetailOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>题目详情</DialogTitle></DialogHeader>
          {(() => {
            const q = allQuestions.find(aq => aq.id === selectedQuestionForDetail)
            if (!q) return null
            return (
              <div className="space-y-3 py-2">
                <div><Label className="text-xs text-gray-500">题目名称</Label><p className="text-sm font-medium mt-1">{q.name}</p></div>
                <div><Label className="text-xs text-gray-500">题目内容</Label><p className="text-sm mt-1">{q.content}</p></div>
                <div className="flex items-center gap-4"><div><Label className="text-xs text-gray-500">题型</Label><p className="text-sm mt-1">{questionTypeLabels[q.type] || q.type}</p></div><div><Label className="text-xs text-gray-500">难度</Label><p className="text-sm mt-1">{difficultyLabels[q.difficulty] || q.difficulty}</p></div><div><Label className="text-xs text-gray-500">分值</Label><p className="text-sm mt-1">{q.score}分</p></div><div><Label className="text-xs text-gray-500">所属题库</Label><p className="text-sm mt-1">{questionBankLabels[q.questionBank as string] || q.questionBank || "-"}</p></div></div>
              </div>
            )
          })()}
          <DialogFooter><Button variant="outline" onClick={() => setQuestionDetailOpen(false)}>关闭</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddQuestion} onOpenChange={setShowAddQuestion}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>新增题目</DialogTitle></DialogHeader>
          <div className="py-8 text-center text-gray-500">请前往题库管理添加题目</div>
          <DialogFooter><Button onClick={() => setShowAddQuestion(false)}>知道了</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={paperDetailOpen} onOpenChange={setPaperDetailOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>试卷详情</DialogTitle></DialogHeader>
          {(() => {
            const paper = paperMocks.find(p => p.id === selectedPaperForDetail)
            if (!paper) return null
            return (
              <div className="space-y-3 py-2">
                <div><Label className="text-xs text-gray-500">试卷名称</Label><p className="text-sm font-medium mt-1">{paper.name}</p></div>
                <div className="flex items-center gap-4"><div><Label className="text-xs text-gray-500">题目数量</Label><p className="text-sm mt-1">{paper.questionCount} 题</p></div><div><Label className="text-xs text-gray-500">总分</Label><p className="text-sm mt-1">{paper.totalScore} 分</p></div></div>
                <div><Label className="text-xs text-gray-500">包含题型</Label><div className="flex flex-wrap gap-1 mt-1"><Badge variant="secondary" className="text-[10px]">单选题</Badge><Badge variant="secondary" className="text-[10px]">多选题</Badge><Badge variant="secondary" className="text-[10px]">判断题</Badge></div></div>
              </div>
            )
          })()}
          <DialogFooter><Button variant="outline" onClick={() => setPaperDetailOpen(false)}>关闭</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCreatePaper} onOpenChange={setShowCreatePaper}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>新建试卷</DialogTitle><DialogDescription>创建新的试卷</DialogDescription></DialogHeader>
          <div className="space-y-4 py-2">
            <div><Label className="text-xs text-gray-500">试卷名称</Label><Input value={newPaperName} onChange={e => setNewPaperName(e.target.value)} placeholder="输入试卷名称" className="mt-1 text-sm" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs text-gray-500">题目数量</Label><Input type="number" value={newPaperQuestionCount} onChange={e => setNewPaperQuestionCount(Math.max(1, parseInt(e.target.value) || 1))} className="mt-1 text-sm" min={1} /></div>
              <div><Label className="text-xs text-gray-500">总分</Label><Input type="number" value={newPaperTotalScore} onChange={e => setNewPaperTotalScore(Math.max(1, parseInt(e.target.value) || 1))} className="mt-1 text-sm" min={1} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreatePaper(false)}>取消</Button>
            <Button onClick={() => { if (!newPaperName.trim()) return; const newId = uid("paper"); (paperMocks as any).push({ id: newId, name: newPaperName.trim(), questionCount: newPaperQuestionCount, totalScore: newPaperTotalScore }); updateConfig({ paperIds: [...config.paperIds, newId], paperWeights: { ...config.paperWeights, [newId]: config.paperIds.length === 0 ? 100 : 0 } }); setShowCreatePaper(false); setNewPaperName(""); setNewPaperQuestionCount(10); setNewPaperTotalScore(100); }}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rubricKpDialogOpen} onOpenChange={v => { if (!v) setRubricKpDialogOpen(false); }}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
          <DialogHeader><DialogTitle>关联考查知识点</DialogTitle><DialogDescription>此处仅可选择任务关联的知识点/能力点，请先在任务中配置后选择。</DialogDescription></DialogHeader>
          {(() => {
            const field = rubricKpTargetField as EvalPointField | null
            const pointId = rubricKpTargetPointId
            const ep = field && pointId ? getEvalPoints(field).find(p => p.id === pointId) : null
            const selectedIds = ep?.knowledgePointIds || []
            const filteredKp = knowledgePoints.filter(k => !rubricKpSearch || k.name.includes(rubricKpSearch) || k.description?.includes(rubricKpSearch) || (k.code && k.code.includes(rubricKpSearch)))
            const toggleKp = (kpId: string) => { if (!field || !pointId) return; const newIds = selectedIds.includes(kpId) ? selectedIds.filter(id => id !== kpId) : [...selectedIds, kpId]; updateEvalPoint(field, pointId, { knowledgePointIds: newIds }); }
            return (
              <div className="flex gap-4 flex-1 min-h-0 py-2">
                <div className="w-3/5 flex flex-col min-h-0 border rounded-xl p-3">
                  <div className="relative mb-3"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" /><Input value={rubricKpSearch} onChange={e => setRubricKpSearch(e.target.value)} placeholder="搜索知识点名称、描述或编码..." className="pl-9" /></div>
                  <div className="flex-1 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0 z-10"><tr><th className="text-left text-xs font-medium text-gray-500 px-3 py-2 w-[30%]">知识点名称</th><th className="text-left text-xs font-medium text-gray-500 px-3 py-2 w-[20%]">编码</th><th className="text-left text-xs font-medium text-gray-500 px-3 py-2 w-[35%]">描述</th><th className="text-right text-xs font-medium text-gray-500 px-3 py-2 w-[15%]">操作</th></tr></thead>
                      <tbody className="divide-y divide-gray-100">
                        {filteredKp.map(kp => {
                          const isSelected = selectedIds.includes(kp.id)
                          return (
                            <tr key={kp.id} className={cn("hover:bg-gray-50 cursor-pointer", isSelected ? "bg-primary/[0.03]" : "")} onClick={() => toggleKp(kp.id)}>
                              <td className="px-3 py-2"><div className="flex items-center gap-2"><div className={cn("w-4 h-4 rounded border flex items-center justify-center shrink-0", isSelected ? "bg-primary border-primary" : "border-gray-300")}>{isSelected && <Check className="h-3 w-3 text-white" />}</div><span className="text-sm font-medium text-gray-800">{kp.name}</span></div></td>
                              <td className="px-3 py-2">{kp.code ? <Badge variant="outline" className="text-[10px] h-5 px-1.5">{kp.code}</Badge> : <span className="text-xs text-gray-400">-</span>}</td>
                              <td className="px-3 py-2"><p className="text-xs text-gray-500 line-clamp-1">{kp.description}</p></td>
                              <td className="px-3 py-2 text-right">{isSelected ? <Button size="sm" variant="outline" className="h-6 text-[11px] px-2" onClick={e => { e.stopPropagation(); toggleKp(kp.id); }}>取消</Button> : <Button size="sm" className="h-6 text-[11px] px-2" onClick={e => { e.stopPropagation(); toggleKp(kp.id); }}>选择</Button>}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="w-2/5 border rounded-xl p-3 flex flex-col min-h-0">
                  <p className="text-sm font-medium mb-3 text-gray-700">已选择知识点 ({selectedIds.length})</p>
                  <div className="flex-1 overflow-y-auto space-y-2">
                    {selectedIds.length === 0 && <div className="text-center text-gray-400 py-8"><Lightbulb className="h-8 w-8 mx-auto mb-2 opacity-50" /><p className="text-xs">从左侧选择知识点</p></div>}
                    {selectedIds.map(kpId => {
                      const kp = knowledgePoints.find(k => k.id === kpId)
                      if (!kp) return null
                      return <div key={kpId} className="p-2 rounded-lg border border-primary/20 bg-primary/5"><div className="flex items-center gap-2"><span className="text-xs font-medium flex-1 truncate">{kp.name}</span><Button variant="ghost" size="icon" className="h-5 w-5 text-gray-400" onClick={() => toggleKp(kpId)}><X className="h-3 w-3" /></Button></div><p className="text-[10px] text-gray-500 line-clamp-1">{kp.description}</p></div>
                    })}
                  </div>
                </div>
              </div>
            )
          })()}
          <DialogFooter><Button onClick={() => setRubricKpDialogOpen(false)}>完成</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rubricAbDialogOpen} onOpenChange={v => { if (!v) setRubricAbDialogOpen(false); }}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader><DialogTitle>关联考查能力点</DialogTitle><DialogDescription>此处仅可选择任务关联的知识点/能力点，请先在任务中配置后选择。</DialogDescription></DialogHeader>
          {(() => {
            const field = rubricAbTargetField as EvalPointField | null
            const pointId = rubricAbTargetPointId
            const ep = field && pointId ? getEvalPoints(field).find(p => p.id === pointId) : null
            const selectedIds = ep?.abilityPointIds || []
            const filteredAb = abilityPoints.filter(a => !rubricAbSearch || a.name.includes(rubricAbSearch) || a.description?.includes(rubricAbSearch) || (a.code && a.code.includes(rubricAbSearch)))
            const toggleAb = (abId: string) => { if (!field || !pointId) return; const newIds = selectedIds.includes(abId) ? selectedIds.filter(id => id !== abId) : [...selectedIds, abId]; updateEvalPoint(field, pointId, { abilityPointIds: newIds }); }
            return (
              <div className="flex gap-4 flex-1 min-h-0 py-2">
                <div className="w-3/5 flex flex-col min-h-0 border rounded-xl p-3">
                  <div className="relative mb-3"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" /><Input value={rubricAbSearch} onChange={e => setRubricAbSearch(e.target.value)} placeholder="搜索能力点名称、描述或编码..." className="pl-9" /></div>
                  <div className="flex-1 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0 z-10"><tr><th className="text-left text-xs font-medium text-gray-500 px-3 py-2 w-[30%]">能力点名称</th><th className="text-left text-xs font-medium text-gray-500 px-3 py-2 w-[20%]">编码</th><th className="text-left text-xs font-medium text-gray-500 px-3 py-2 w-[35%]">描述</th><th className="text-right text-xs font-medium text-gray-500 px-3 py-2 w-[15%]">操作</th></tr></thead>
                      <tbody className="divide-y divide-gray-100">
                        {filteredAb.map(ab => {
                          const isSelected = selectedIds.includes(ab.id)
                          return (
                            <tr key={ab.id} className={cn("hover:bg-gray-50 cursor-pointer", isSelected ? "bg-primary/[0.03]" : "")} onClick={() => toggleAb(ab.id)}>
                              <td className="px-3 py-2"><div className="flex items-center gap-2"><div className={cn("w-4 h-4 rounded border flex items-center justify-center shrink-0", isSelected ? "bg-primary border-primary" : "border-gray-300")}>{isSelected && <Check className="h-3 w-3 text-white" />}</div><span className="text-sm font-medium text-gray-800">{ab.name}</span></div></td>
                              <td className="px-3 py-2">{ab.code ? <Badge variant="outline" className="text-[10px] h-5 px-1.5">{ab.code}</Badge> : <span className="text-xs text-gray-400">-</span>}</td>
                              <td className="px-3 py-2"><p className="text-xs text-gray-500 line-clamp-1">{ab.description}</p></td>
                              <td className="px-3 py-2 text-right">{isSelected ? <Button size="sm" variant="outline" className="h-6 text-[11px] px-2" onClick={e => { e.stopPropagation(); toggleAb(ab.id); }}>取消</Button> : <Button size="sm" className="h-6 text-[11px] px-2" onClick={e => { e.stopPropagation(); toggleAb(ab.id); }}>选择</Button>}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="w-2/5 border rounded-xl p-3 flex flex-col min-h-0">
                  <p className="text-sm font-medium mb-3 text-gray-700">已选择能力点 ({selectedIds.length})</p>
                  <div className="flex-1 overflow-y-auto space-y-2">
                    {selectedIds.length === 0 && <div className="text-center text-gray-400 py-8"><Award className="h-8 w-8 mx-auto mb-2 opacity-50" /><p className="text-xs">从左侧选择能力点</p></div>}
                    {selectedIds.map(abId => {
                      const ab = abilityPoints.find(a => a.id === abId)
                      if (!ab) return null
                      return <div key={abId} className="p-2 rounded-lg border border-primary/20 bg-primary/5"><div className="flex items-center gap-2"><span className="text-xs font-medium flex-1 truncate">{ab.name}</span><Button variant="ghost" size="icon" className="h-5 w-5 text-gray-400" onClick={() => toggleAb(abId)}><X className="h-3 w-3" /></Button></div><p className="text-[10px] text-gray-500 line-clamp-1">{ab.description}</p></div>
                    })}
                  </div>
                </div>
              </div>
            )
          })()}
          <DialogFooter><Button onClick={() => setRubricAbDialogOpen(false)}>完成</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )

  if (inline) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-primary/10 rounded"><Award className="h-5 w-5 text-primary" /></div>
          <div>
            <h3 className="text-base font-semibold">{title}</h3>
            <p className="text-xs text-gray-500">配置各评价方式的测评对象、评价主体、测评资源与评价标准</p>
          </div>
        </div>
        <div className="border rounded-xl p-4 bg-white">
          <BodyContent />
        </div>
        <SubDialogs />
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[95vw] max-h-[95vh] h-[95vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><div className="p-1.5 bg-primary/10 rounded"><Award className="h-5 w-5" /></div>{title}</DialogTitle>
          <DialogDescription>配置各评价方式的测评对象、评价主体、测评资源与评价标准</DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-hidden py-4">
          <BodyContent />
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange?.(false)}>取消</Button><Button onClick={() => onOpenChange?.(false)}>保存</Button></DialogFooter>
      </DialogContent>
      <SubDialogs />
    </Dialog>
  )
}

export default CourseEvaluationRulesDialog
