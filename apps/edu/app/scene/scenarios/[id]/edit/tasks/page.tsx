"use client"

import {
  ArrowRight,
  Book,
  CheckCircle2,
  Clock,
  Copy,
  FileText,
  GripVertical,
  Lightbulb,
  Link2,
  Plus,
  Scale,
  Search,
  Settings,
  Star,
  Target,
  Trash2,
  Eye,
  X,
  Check,
  Play,
  Upload,
  Image,
  Video,
  Globe,
  MapPin,
  Package,
  Award,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Quote,
  Code,
  Minus,
  Link as LinkIcon,
  Table,
  Strikethrough,
  Palette,
  Type,
  Rows3,
  Gavel,
  ClipboardList,
  Database,
  MessageSquare,
  PenTool,
  Presentation,
  FileQuestion,
  MonitorPlay,
  User,
  Users,
  Bot,
  FolderCheck,
  Wrench,
  UserCheck,
  Lock,
  Unlock,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Info,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  File,
  PieChart as PieChartIcon,
  Headphones,
  Loader2,
  Download,
  Archive,
  Building2,
  RotateCcw,
  Shield,
  Server,
  Layers,
  BookOpen,
  Pencil,
  SlidersHorizontal,
} from "lucide-react"
import { useParams, useRouter } from "next/navigation"
import { useState, useMemo, useRef, useCallback, useLayoutEffect, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import { Slider } from "@/components/ui/slider"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { PrdAnnotation } from "@/components/prd-annotation"
import { getAnnotation } from "@/lib/prd-annotations"
import { ScoreConfigDialog } from "@/components/evaluation/score-config-dialog"
import { ExamFormDialog } from "@/components/evaluation/exam-form-dialog"
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts"
import { scenarioApi, taskApi, knowledgeApi, abilityApi, positionApi, industryApi, majorApi, userManagementApi, fileApi, taskResourceApi, questionBankApi, questionApi, examApi, examUsageApi, taskEvaluationApi, randomDrawQuestionApi } from "@/lib/api"
import type { RandomDrawQuestion } from "@/lib/types"
import type { ScenarioTask as ApiScenarioTask } from "@/lib/types/scene"
import type { TaskEvaluationMethod } from "@/lib/types/scene"
import { useToast } from "@/hooks/use-toast"
import { Toaster } from "@/components/ui/toaster"
import { EditorShell } from "@/components/shared/editor-shell"
import { MajorSelect } from "@/components/shared/major-select"
import { useAuth } from "@/components/auth-provider"
import type {
  Task, PositionAbility, GradeMapping,
} from "@/lib/mock-data"
import { COMPETENCY_LEVEL_LABELS } from "@/lib/types/job-source"

// Module-level mutable arrays — populated from APIs on mount, zero mock data
const scenarios: any[] = []
const knowledgePoints: any[] = []
const abilityPoints: any[] = []
const learningResources: any[] = []
const positionAbilities: any[] = []
const questionBank: Record<string, any[]> = { frontend: [], backend: [], draft: [] }
const granularLessons: any[] = []
const professions: any[] = []

// Generate a valid v4 UUID for custom items so they can be stored in backend UUID[] columns
function generateUUID(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0
    const v = c === "x" ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

// ============ Types & Configs ============

type CardType = "info" | "description" | "knowledge" | "ability" | "resources" | "evaluation" | "evaluationRules" | "weight"

const cardConfigs: { type: CardType; title: string; icon: React.ReactNode }[] = [
  { type: "info", title: "配置任务基础信息", icon: <FileText className="h-4 w-4" /> },
  { type: "description", title: "配置任务说明", icon: <Book className="h-4 w-4" /> },
  { type: "knowledge", title: "考查知识点", icon: <Lightbulb className="h-4 w-4" /> },
  { type: "ability", title: "考查能力点", icon: <Award className="h-4 w-4" /> },
  { type: "resources", title: "配置任务资源", icon: <Link2 className="h-4 w-4" /> },
  { type: "evaluation", title: "配置任务测评形式", icon: <CheckCircle2 className="h-4 w-4" /> },
  { type: "evaluationRules", title: "配置任务评价规则", icon: <Gavel className="h-4 w-4" /> },
  { type: "weight", title: "配置任务权重", icon: <Scale className="h-4 w-4" /> },
]

const resourceTypeIcons: Record<string, React.ReactNode> = {
  document: <FileText className="h-4 w-4 text-blue-500" />,
  spreadsheet: <Table className="h-4 w-4 text-teal-500" />,
  image: <Image className="h-4 w-4 text-green-500" />,
  link: <Link2 className="h-4 w-4 text-cyan-500" />,
  audio: <Headphones className="h-4 w-4 text-violet-500" />,
  video: <Video className="h-4 w-4 text-red-500" />,
  archive: <Archive className="h-4 w-4 text-amber-500" />,
  venue: <MapPin className="h-4 w-4 text-orange-500" />,
  facility: <Building2 className="h-4 w-4 text-rose-500" />,
  software: <Globe className="h-4 w-4 text-purple-500" />,
  other: <Package className="h-4 w-4 text-gray-500" />,
}

const resourceTypeLabels: Record<string, string> = {
  all: "全部",
  document: "文档资源",
  spreadsheet: "表格资源",
  image: "图片资源",
  link: "链接资源",
  audio: "音频资源",
  video: "视频资源",
  archive: "压缩包资源",
  venue: "场地资源",
  facility: "设施设备资源",
  software: "软件资源",
  other: "其他资源",
}

const resourceTypeColors: Record<string, string> = {
  document: "bg-blue-50 text-blue-600 border-blue-200",
  spreadsheet: "bg-teal-50 text-teal-600 border-teal-200",
  image: "bg-green-50 text-green-600 border-green-200",
  link: "bg-cyan-50 text-cyan-600 border-cyan-200",
  audio: "bg-violet-50 text-violet-600 border-violet-200",
  video: "bg-red-50 text-red-600 border-red-200",
  archive: "bg-amber-50 text-amber-600 border-amber-200",
  venue: "bg-orange-50 text-orange-600 border-orange-200",
  facility: "bg-rose-50 text-rose-600 border-rose-200",
  software: "bg-purple-50 text-purple-600 border-purple-200",
  other: "bg-gray-50 text-gray-600 border-gray-200",
}

const resourceTypeAccept: Record<string, string> = {
  document: ".pdf,.doc,.docx,.txt,.ppt,.pptx,.md",
  spreadsheet: ".xls,.xlsx,.csv",
  image: ".jpg,.jpeg,.png,.gif,.webp,.svg,.bmp",
  audio: ".mp3,.wav,.ogg,.m4a,.flac,.aac",
  video: ".mp4,.webm,.mov,.avi,.mkv,.flv",
  archive: ".zip,.rar,.7z,.tar,.gz,.bz2",
  other: "",
  software: ".exe,.dmg,.pkg,.deb,.rpm,.zip,.msi,.apk",
}

const resourceTypeExtensionMap: Record<string, string[]> = {
  document: ["pdf", "doc", "docx", "txt", "ppt", "pptx", "md"],
  spreadsheet: ["xls", "xlsx", "csv"],
  image: ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"],
  audio: ["mp3", "wav", "ogg", "m4a", "flac", "aac"],
  video: ["mp4", "webm", "mov", "avi", "mkv", "flv"],
  archive: ["zip", "rar", "7z", "tar", "gz", "bz2"],
  other: [],
  software: ["exe", "dmg", "pkg", "deb", "rpm", "zip", "msi", "apk"],
}

const RESOURCE_MAX_FILE_SIZE = 100 * 1024 * 1024

const evaluationMethodOptions = [
  // 平台通用 - 知识评价
  { key: "question_bank", label: "题库", icon: <Database className="h-5 w-5" />, color: "bg-orange-50 text-orange-600 border-orange-200", available: true, desc: "从题库选题组成测评资源", primaryCategory: "platform", secondaryCategory: "知识评价" },
  { key: "paper", label: "试卷", icon: <ClipboardList className="h-5 w-5" />, color: "bg-green-50 text-green-600 border-green-200", available: true, desc: "使用固定试卷进行考核", primaryCategory: "platform", secondaryCategory: "知识评价" },
  { key: "quiz", label: "随堂测", icon: <FileQuestion className="h-5 w-5" />, color: "bg-red-50 text-red-600 border-red-200", available: true, desc: "课堂即时测验", primaryCategory: "platform", secondaryCategory: "知识评价" },
  // 平台通用 - 过程评价
  { key: "random_draw", label: "现场问答", icon: <FileQuestion className="h-5 w-5" />, color: "bg-blue-50 text-blue-600 border-blue-200", available: true, desc: "从题库抽取题目，教师现场提问", primaryCategory: "platform", secondaryCategory: "过程评价" },
  // 平台通用 - 成果评价
  { key: "review", label: "现场评审", icon: <Gavel className="h-5 w-5" />, color: "bg-purple-50 text-purple-600 border-purple-200", available: true, desc: "教师根据表现/材料给评价点打分", primaryCategory: "platform", secondaryCategory: "成果评价" },
  { key: "outcome", label: "成果评价", icon: <FolderCheck className="h-5 w-5" />, color: "bg-cyan-50 text-cyan-600 border-cyan-200", available: true, desc: "对学生成果进行评价", primaryCategory: "platform", secondaryCategory: "成果评价" },
  { key: "homework", label: "作业", icon: <BookOpen className="h-5 w-5" />, color: "bg-pink-50 text-pink-600 border-pink-200", available: true, desc: "学生提交作业进行评价", primaryCategory: "platform", secondaryCategory: "成果评价" },
  // 行业专属 - 智慧物流
  { key: "wms_inbound", label: "WMS(入库单)自动化评分", icon: <Package className="h-5 w-5" />, color: "bg-indigo-50 text-indigo-600 border-indigo-200", available: false, desc: "基于 WMS 入库单操作的自动化评分", primaryCategory: "industry", secondaryCategory: "智慧物流" },
  { key: "wms_outbound", label: "WMS(出库单)自动化评分", icon: <Package className="h-5 w-5" />, color: "bg-indigo-50 text-indigo-600 border-indigo-200", available: false, desc: "基于 WMS 出库单操作的自动化评分", primaryCategory: "industry", secondaryCategory: "智慧物流" },
  { key: "wms_wave", label: "WMS(波次分拣)自动化评分", icon: <Package className="h-5 w-5" />, color: "bg-indigo-50 text-indigo-600 border-indigo-200", available: false, desc: "基于 WMS 波次分拣操作的自动化评分", primaryCategory: "industry", secondaryCategory: "智慧物流" },
  // 行业专属 - 网络安全
  { key: "network_traffic", label: "网络流量分析自助评价", icon: <Shield className="h-5 w-5" />, color: "bg-emerald-50 text-emerald-600 border-emerald-200", available: false, desc: "基于网络流量分析的自助评价", primaryCategory: "industry", secondaryCategory: "网络安全" },
  { key: "cyber_range", label: "网络靶场自助评价", icon: <Shield className="h-5 w-5" />, color: "bg-emerald-50 text-emerald-600 border-emerald-200", available: false, desc: "基于网络靶场环境的自助评价", primaryCategory: "industry", secondaryCategory: "网络安全" },
]

const abilityLevels = ["了解", "理解", "掌握", "熟练", "精通"]

const defaultDescriptionTemplate = `任务描述

你需要完成[具体任务]。该任务基于[背景/前提],要求你[核/心动作]。执行时请注意[关键约束],确保理解需求后再开始。

任务目标

·核心目标:[一句话概括最终成果]
·目标一:[具体子目标]
·目标二:[具体子目标]
·目标三:[具体子目标]
·成功标准:[任务完成的具体标志]

任务结果

请提交以下内容:

·主交付物:[如报告/代码/方案]
格式要求:[如Markdown/JSON/纯文本]
·附属说明:[假设、来源、取舍等]
篇幅要求:[如不少于500字/代码100行内]

测评要求

·准确性(30%):内容正确,逻辑清晰,来源可靠
·完整性(25%):覆盖所有子目标,无遗漏
清晰度(20%):结构分明,表达简洁
·实用性(15%):结论可操作,建议可落地
规范性(10%):符合格式,术语统一,无明显错误

一票否决项:若出现[如抄袭/泄密/核心事实错误],视为未通过。`

const defaultGradeMapping: GradeMapping[] = [
  { id: "grade-1", grade: "A", minScore: 90, maxScore: 100, color: "bg-green-500", remark: "表现卓越" },
  { id: "grade-2", grade: "B", minScore: 75, maxScore: 89, color: "bg-blue-500", remark: "表现良好" },
  { id: "grade-3", grade: "C", minScore: 60, maxScore: 74, color: "bg-yellow-500", remark: "基本达标" },
  { id: "grade-4", grade: "D", minScore: 0, maxScore: 59, color: "bg-red-500", remark: "未达标" },
]

const questionBankLabels: Record<string, string> = {
  frontend: "前端开发题库",
  backend: "后端开发题库",
  draft: "草稿库",
  public: "公共基础题库",
  professional: "专业技能题库",
}

const allQuestions: any[] = []

const loadedExams: any[] = []

type EvalObjectType = "individual" | "group"

interface EvalSubjectConfig {
  type: "teacher" | "enterprise_mentor" | "peer" | "self"
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
  }
}

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

interface EvalPoint {
  id: string
  name: string
  desc: string
  subType?: EvalSubType
  types?: EvalSubType[]
  knowledgePointIds?: string[]
  abilityPointIds?: string[]
  scoringMethod?: "score" | "level" | "rubric"
  gradeMapping?: GradeMapping[]
  weight?: number
}

interface ScoringConfig {
  teacherBackground: string
  scorerCount: number
  requiresEnterpriseMentor: boolean
}

interface TaskState {
  description: string
  descriptionPdf: string | null
  knowledgePoints: string[]
  knowledgeAutoResources: string[]
  abilityPoints: string[]
  abilityLevelMappings: { abilityId: string; level: number }[]
  resources: string[]
  evaluationMethods: string[]
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
  weight: number
  locked: boolean
  gradeMapping: GradeMapping[]
  scoringConfig: ScoringConfig
  evalObject: EvalObjectType
  evalSubjects: EvalSubjectConfig[]
  methodEvalObjects: Record<string, EvalObjectType>
  methodEvalSubjects: Record<string, EvalSubjectConfig[]>
  methodWeights: Record<string, number>
  reviewSteps: any[]
  methodResourceConfigs: Record<string, any>
}

function makeDefaultTaskState(count: number, index: number): TaskState {
  return {
    description: "",
    descriptionPdf: null,
    knowledgePoints: [],
    knowledgeAutoResources: [],
    abilityPoints: [],
    abilityLevelMappings: [],
    resources: [],
    evaluationMethods: [],
    methodWeights: {},
    randomDrawQuestions: [],
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
    weight: count > 0 ? Math.floor(100 / count) + (index < 100 % count ? 1 : 0) : 0,
    locked: false,
    gradeMapping: JSON.parse(JSON.stringify(defaultGradeMapping)),
    scoringConfig: { teacherBackground: "", scorerCount: 1, requiresEnterpriseMentor: false },
    evalObject: "individual",
    evalSubjects: JSON.parse(JSON.stringify(defaultEvalSubjects)),
    methodEvalObjects: {},
    methodEvalSubjects: {},
    reviewSteps: [],
    methodResourceConfigs: {},
  }
}

const defaultEvalSubjects: EvalSubjectConfig[] = [
  { type: "teacher", enabled: true, params: { weightPercent: 50, scorerCount: 1 } },
  { type: "enterprise_mentor", enabled: false, params: { weightPercent: 20 } },
  { type: "self", enabled: false, params: { weightPercent: 10 } },
  { type: "peer", enabled: false, params: { weightPercent: 20, peerCount: 3 } },
]

function taskStateFromMethods(task: any, methods: TaskEvaluationMethod[]): TaskState {
  const state = makeDefaultTaskState(0, 0)
  if (!methods || methods.length === 0) return state
  state.evaluationMethods = methods.map(m => m.methodKey)
  methods.forEach(m => {
    state.methodWeights[m.methodKey] = m.weight
    state.methodEvalObjects[m.methodKey] = m.evalObject as EvalObjectType
    state.methodEvalSubjects[m.methodKey] = (m.evalSubjects || []) as EvalSubjectConfig[]
    state.methodResourceConfigs[m.methodKey] = m.resourceConfig || {}
    const toLocalEvalPoint = (ep: any): EvalPoint => ({
      id: ep.id,
      name: ep.name,
      desc: ep.description || "",
      subType: ep.subType,
      types: ep.types,
      knowledgePointIds: ep.knowledgePointIds,
      abilityPointIds: ep.abilityPointIds,
      scoringMethod: ep.scoringMethod,
      gradeMapping: ep.gradeMapping,
      weight: ep.weight,
    })
    switch (m.methodKey) {
      case "random_draw":
        state.randomDrawEvalPoints = (m.evalPoints || []).map(toLocalEvalPoint)
        state.randomDrawScoreType = m.scoreType === "ability_levels" ? "ability_levels" : "eval_points"
        state.randomDrawRubricId = m.rubricTemplateId || null
        if (m.resourceConfig?.selectedQuestionIds) state.randomDrawSelectedIds = m.resourceConfig.selectedQuestionIds
        break
      case "review":
        state.reviewEvalPoints = (m.evalPoints || []).map(toLocalEvalPoint)
        state.reviewScoreType = m.scoreType === "ability_levels" ? "ability_levels" : "eval_points"
        state.reviewRubricId = m.rubricTemplateId || null
        state.reviewSteps = (m.reviewSteps || []).map((rs: any) => ({
          id: rs.id, label: rs.label, desc: rs.description || "",
          enabled: rs.enabled, subjectType: rs.subjectType, weight: rs.weight,
        }))
        break
      case "paper":
        state.paperEvalPoints = (m.evalPoints || []).map(toLocalEvalPoint)
        if (m.resourceConfig?.paperId) state.paperIds = [m.resourceConfig.paperId]
        if (m.resourceConfig?.paperWeight) state.paperWeights = { [m.resourceConfig.paperId]: m.resourceConfig.paperWeight }
        state.methodResourceConfigs.paper = m.resourceConfig || {}
        break
      case "question_bank":
        state.questionBankEvalPoints = (m.evalPoints || []).map(toLocalEvalPoint)
        if (m.resourceConfig?.questionIds) state.questionBankQuestions = m.resourceConfig.questionIds
        state.methodResourceConfigs.question_bank = m.resourceConfig || {}
        break
      case "outcome":
        state.outcomeEvalPoints = (m.evalPoints || []).map(toLocalEvalPoint)
        state.outcomeScoreType = m.scoreType === "ability_levels" ? "ability_levels" : "eval_points"
        state.outcomeRubricId = m.rubricTemplateId || null
        break
      case "homework":
        state.homeworkEvalPoints = (m.evalPoints || []).map(toLocalEvalPoint)
        state.homeworkScoreType = m.scoreType === "ability_levels" ? "ability_levels" : "eval_points"
        state.homeworkRubricId = m.rubricTemplateId || null
        break
      case "quiz":
        state.quizEvalPoints = (m.evalPoints || []).map(toLocalEvalPoint)
        if (m.resourceConfig?.questionIds) state.quizQuestions = m.resourceConfig.questionIds
        state.methodResourceConfigs.quiz = m.resourceConfig || {}
        break
    }
  })
  return state
}

function taskStateToMethodsInput(ts: TaskState, extra?: { reviewSteps?: any[] }): any[] {
  const methods: any[] = []
  const evalPointFieldMap: Record<string, string> = {
    random_draw: "randomDrawEvalPoints",
    review: "reviewEvalPoints",
    paper: "paperEvalPoints",
    question_bank: "questionBankEvalPoints",
    outcome: "outcomeEvalPoints",
    homework: "homeworkEvalPoints",
    quiz: "quizEvalPoints",
  }
  const scoreTypeFieldMap: Record<string, string> = {
    random_draw: "randomDrawScoreType",
    review: "reviewScoreType",
    outcome: "outcomeScoreType",
    homework: "homeworkScoreType",
  }
  const rubricFieldMap: Record<string, string> = {
    random_draw: "randomDrawRubricId",
    review: "reviewRubricId",
    outcome: "outcomeRubricId",
    homework: "homeworkRubricId",
  }
  ts.evaluationMethods.forEach((mk: string) => {
    const fromLocalEvalPoint = (p: EvalPoint): any => ({
      name: p.name,
      description: p.desc || null,
      subType: p.subType || null,
      types: p.types || [],
      weight: p.weight || 0,
      scoringMethod: p.scoringMethod || "level",
      gradeMapping: p.gradeMapping || [],
      knowledgePointIds: p.knowledgePointIds || [],
      abilityPointIds: p.abilityPointIds || [],
      sortOrder: 0,
    })
    const evalField = evalPointFieldMap[mk]
    const evalPoints = evalField ? ((ts as any)[evalField] as EvalPoint[] || []).map((p, i) => ({ ...fromLocalEvalPoint(p), sortOrder: i })) : []
    const scoreType = (scoreTypeFieldMap[mk] ? (ts as any)[scoreTypeFieldMap[mk]] : null) || null
    const rubricId = rubricFieldMap[mk] ? (ts as any)[rubricFieldMap[mk]] as string | null : null

    let resourceConfig: any = ts.methodResourceConfigs[mk] || {}
    // Merge legacy fields into resourceConfig
    if (mk === "paper") {
      resourceConfig = {
        ...(ts.methodResourceConfigs?.paper || {}),
        paperId: ts.paperIds?.[0] || null,
        paperWeight: ts.paperIds?.[0] ? ts.paperWeights[ts.paperIds[0]] : null,
      }
    }
    if (mk === "question_bank") {
      resourceConfig = {
        ...(ts.methodResourceConfigs?.question_bank || {}),
        questionIds: ts.questionBankQuestions,
      }
    }
    if (mk === "quiz") {
      resourceConfig = {
        ...(ts.methodResourceConfigs?.quiz || {}),
        questionIds: ts.quizQuestions,
      }
    }
    if (mk === "random_draw") resourceConfig = { ...resourceConfig, customQuestions: ts.randomDrawCustomQuestions, selectedQuestionIds: ts.randomDrawSelectedIds }

    methods.push({
      methodKey: mk,
      weight: ts.methodWeights[mk] || 0,
      evalObject: ts.methodEvalObjects[mk] || "individual",
      scoreType,
      evalSubjects: ts.methodEvalSubjects[mk] || [],
      rubricTemplateId: rubricId || null,
      evalPoints,
      reviewSteps: mk === "review" ? (ts.reviewSteps || []).map((rs: any) => ({
        label: rs.label, description: rs.desc || null,
        enabled: rs.enabled, subjectType: rs.subjectType, weight: rs.weight, sortOrder: 0,
      })) : [],
      resourceConfig,
    })
  })
  return methods
}

function normalizeEvalPoints(points: unknown): EvalPoint[] {
  if (!Array.isArray(points)) return []
  return points.filter((p): p is EvalPoint => p && typeof p === "object" && typeof p.id === "string" && typeof p.name === "string")
}

function normalizeStringArray(arr: unknown): string[] {
  if (!Array.isArray(arr)) return []
  return arr.filter((v): v is string => typeof v === "string")
}

function normalizeEvalSubjects(subjects: unknown): EvalSubjectConfig[] {
  if (!Array.isArray(subjects)) return []
  return subjects.filter((s): s is EvalSubjectConfig => s && typeof s === "object" && typeof s.type === "string" && typeof s.enabled === "boolean")
}

// ============ Main Page ============

export default function TasksEditPage() {
  const params = useParams()
  const router = useRouter()
  const scenarioId = params.id as string
  const { toast } = useToast()
  const { tenantId, orgNodeId, user } = useAuth()

  const [existingScenario, setExistingScenario] = useState<any>(null)
  const [dataLoaded, setDataLoaded] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const [tasks, setTasks] = useState<Task[]>([])
  const [taskStates, setTaskStates] = useState<Record<string, TaskState>>({})
  const [positions, setPositions] = useState<any[]>([])
  const [industries, setIndustries] = useState<any[]>([])
  const [majors, setMajors] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [positionAbilityBindings, setPositionAbilityBindings] = useState<any[]>([])
  const [rubricLibrary, setRubricLibrary] = useState<any[]>([])

  const userNameMap = useMemo(() => {
    const map: Record<string, string> = {}
    users.forEach((u: any) => { map[u.id] = u.name || u.id })
    return map
  }, [users])

  // Load all data from APIs on mount
  useEffect(() => {
    const load = async () => {
      try {
        const [scenarioData, tasksRes, kpRes, apRes, resRes, posRes, indRes, majRes, userRes, examRes] = await Promise.all([
          scenarioApi.get(scenarioId),
          taskApi.list({ scenarioId, limit: 1000 }),
          knowledgeApi.list({ limit: 1000 }),
          abilityApi.list({ limit: 1000 }),
          taskResourceApi.listResources({ limit: 1000 }),
          positionApi.list({ limit: 1000 }),
          industryApi.list({ limit: 1000 }),
          majorApi.list({ limit: 1000 }),
          userManagementApi.list({ limit: 1000 }),
          examApi.list({ limit: 1000 }),
        ])

        // Populate module-level arrays with API data (scenarios array populated below with clone candidates)
        setPositions(posRes.items)
        setIndustries(indRes.items)
        setMajors(majRes.items)
        setUsers(userRes.items)

        // Load position-ability bindings for the target position
        if (scenarioData.careerPositionId) {
          try {
            const bindingsRes = await abilityApi.listBindings({ careerPositionId: scenarioData.careerPositionId })
            setPositionAbilityBindings(bindingsRes.items)
          } catch (err) {
            console.error("Failed to load position ability bindings", err)
            setPositionAbilityBindings([])
          }
        } else {
          setPositionAbilityBindings([])
        }

        const positionName = posRes.items.find((p: any) => p.id === scenarioData.careerPositionId)?.name || scenarioData.careerPositionId
        const industryName = (scenarioData.industryNames || []).join("、") ||
          (scenarioData.industryIds || []).map((id: string) => indRes.items.find((i: any) => i.id === id)?.name).filter(Boolean).join("、") ||
          (scenarioData.industryIds || []).join("、")
        const professionName = (scenarioData.professionNames || []).join("、") ||
          (scenarioData.professionIds || []).map((id: string) => majRes.items.find((m: any) => m.id === id)?.name).filter(Boolean).join("、") ||
          (scenarioData.professionIds || []).join("、")
        const coBuilderMap = new Map((userRes.items || []).map((u: any) => [u.id, u.name]))
        setExistingScenario({
          ...scenarioData,
          positionId: scenarioData.careerPositionId,
          positionName,
          industryName,
          professionName,
          coBuilders: (scenarioData.coBuilderIds || []).map((id: string) => ({ id, name: coBuilderMap.get(id) || id })),
        })

        knowledgePoints.length = 0
        kpRes.items.forEach((kp: any) => knowledgePoints.push(kp))

        abilityPoints.length = 0
        apRes.items.forEach((ap: any) => abilityPoints.push(ap))

        learningResources.length = 0
        resRes.items.forEach((res: any) => learningResources.push(res))

        professions.length = 0
        posRes.items.forEach((p: any) => {
          const prof = professions.find((pr: any) => pr.name === (p.industryName || "其他"))
          if (prof) {
            prof.positions.push({ id: p.id, name: p.name, professionId: prof.id })
          } else {
            professions.push({ id: `prof-${professions.length + 1}`, name: p.industryName || "其他", positions: [{ id: p.id, name: p.name, professionId: `prof-${professions.length + 1}` }] })
          }
        })

        // Question bank data stays from mock for now (evaluation module not yet migrated)

        loadedExams.length = 0
        ;(examRes.items || []).forEach((e: any) => loadedExams.push(e))

        // Convert API tasks to mock Task format
        const apiTasks = tasksRes.items
        const mockTasks: Task[] = apiTasks.map((at: ApiScenarioTask, idx: number) => ({
          id: at.id,
          name: at.name,
          code: at.code,
          order: at.sortOrder,
          description: at.description || "",
          detailedDescription: at.detailedDescription || undefined,
          descriptionPdf: at.descriptionPdf || undefined,
          estimatedHours: at.estimatedHours,
          taskType: at.taskType as "assessment" | "training",
          difficulty: (at.difficulty || 3) as 1 | 2 | 3 | 4 | 5,
          background: at.background || "",
          dependencies: at.dependencyIds || [],
          resources: at.resourceIds || [],
          deliverables: [],
          knowledgePoints: at.knowledgePointIds || [],
          abilityPoints: at.abilityPointIds || [],
          assessment: null,
          isReferenced: at.isReferenced || false,
          sourceScenarioId: at.sourceScenarioId || undefined,
          sourceScenarioName: undefined,

        }))

        setTasks(mockTasks)

        // Fetch evaluation methods for all tasks + rubric templates
        const methodsPromises = mockTasks.map(t => taskEvaluationApi.listMethods(t.id).catch(() => ({ methods: [] })))
        const [allMethods, rubricRes] = await Promise.all([
          Promise.all(methodsPromises),
          taskEvaluationApi.listTemplates({ limit: 200 }).catch(() => ({ items: [], total: 0 })),
        ])

        // Populate rubric library from API
        setRubricLibrary((rubricRes.items || []).map((rt: any) => ({
          id: rt.id,
          name: rt.name,
          types: (rt.types || []) as EvalSubType[],
          desc: rt.description || "",
          points: rt.mode === "rubric" ? (rt.data?.points || []).map((p: any) => ({
            ...p,
            id: p.id || `ep-${Math.random().toString(36).slice(2, 9)}`,
            desc: p.description || "",
          })) : [],
          mode: (rt.mode || "rubric") as "rubric" | "score_rule",
          scoreRuleItems: rt.mode === "score_rule" ? (rt.data?.scoreRuleItems || []) : undefined,
        })))

        // Initialize taskStates from API method data
        const count = mockTasks.length
        const states: Record<string, TaskState> = {}
        mockTasks.forEach((t, i) => {
          const methods = allMethods[i]?.methods || []
          let ts = taskStateFromMethods(t, methods)
          if (t.knowledgePoints) ts.knowledgePoints = t.knowledgePoints
          if (t.abilityPoints) ts.abilityPoints = t.abilityPoints
          if (t.resources) ts.resources = t.resources
          if (t.detailedDescription) ts.description = t.detailedDescription
          if (t.descriptionPdf) ts.descriptionPdf = t.descriptionPdf
          ts.weight = count > 0 ? Math.floor(100 / count) + (i < 100 % count ? 1 : 0) : 0
          ts.gradeMapping = JSON.parse(JSON.stringify(defaultGradeMapping))
          states[t.id] = ts
        })
        setTaskStates(states)
        // Fetch all scenarios and their tasks for the clone dialog
        try {
          const allScenariosRes = await scenarioApi.list({ limit: 1000 })
          const allTasksRes = await taskApi.list({ limit: 1000 })
          const scenarioNameMap = new Map<string, string>()
          const scenarioMetaMap = new Map<string, { creatorId: string; coBuilderIds: string[]; status: string }>()
          for (const s of allScenariosRes.items) {
            scenarioNameMap.set(s.id, s.name)
            scenarioMetaMap.set(s.id, { creatorId: s.creatorId, coBuilderIds: s.coBuilderIds || [], status: s.status })
          }
          const tasksByScenarioId = new Map<string, any[]>()
          for (const t of allTasksRes.items) {
            const sName = scenarioNameMap.get(t.scenarioId) || "未知场景"
            const sMeta = scenarioMetaMap.get(t.scenarioId) || { creatorId: "", coBuilderIds: [], status: "" }
            const enhanced = { ...t, scenarioName: sName, scenarioCreatorId: sMeta.creatorId, scenarioCoBuilderIds: sMeta.coBuilderIds, scenarioStatus: sMeta.status }
            if (!tasksByScenarioId.has(t.scenarioId)) tasksByScenarioId.set(t.scenarioId, [])
            tasksByScenarioId.get(t.scenarioId)!.push(enhanced)
          }
          scenarios.length = 0
          scenarios.push(scenarioData as any)
          for (const s of allScenariosRes.items) {
            const tasksForScenario = tasksByScenarioId.get(s.id) || []
            if (tasksForScenario.length > 0) {
              scenarios.push({ ...s, tasks: tasksForScenario })
            }
          }
        } catch (cloneLoadErr) {
          console.error("Failed to load clone candidate tasks", cloneLoadErr)
        }
        setCloneDataVersion(v => v + 1)

        setDataLoaded(true)
      } catch (err) {
        console.error("Failed to load task data", err)
      }
    }
    load()
  }, [scenarioId])

  const [editingCard, setEditingCard] = useState<{ taskId: string; type: CardType } | null>(null)
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false)
  const [isCloneOpen, setIsCloneOpen] = useState(false)

  const [newTask, setNewTask] = useState({
    name: "",
    hours: 4,
    type: "training" as "assessment" | "training",
    difficulty: 3,
    background: "",
  })

  const [cloneSearch, setCloneSearch] = useState("")
  const [cloneMode, setCloneMode] = useState<"clone" | "reference">("clone")
  const [cloneTab, setCloneTab] = useState<"my" | "collab" | "public">("my")
  const [selectedClone, setSelectedClone] = useState<string[]>([])
  const [isCloning, setIsCloning] = useState(false)
  const [cloneDataVersion, setCloneDataVersion] = useState(0)
  const [isWeightConfigOpen, setIsWeightConfigOpen] = useState(false)
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null)
  const [deleteConfirmTask, setDeleteConfirmTask] = useState<{ id: string; name: string } | null>(null)

  const posAbilities = useMemo(() =>
    positionAbilities.filter(a => a.positionId === existingScenario?.positionId),
    [existingScenario?.positionId]
  )

  const allTasks = useMemo(() =>
    (scenarios as any[]).flatMap((s: any) =>
      (s.tasks || []).map((t: any) => ({
        ...t,
        scenarioName: s.name,
        scenarioCreatorId: t.scenarioCreatorId || s.creatorId || "",
        scenarioCoBuilderIds: t.scenarioCoBuilderIds || s.coBuilderIds || [],
        scenarioStatus: t.scenarioStatus || s.status || "",
      }))
    ),
    [scenarioId, cloneDataVersion]
  )

  const totalWeight = Object.values(taskStates).reduce((sum, s) => sum + s.weight, 0)

  const getState = (id: string): TaskState => taskStates[id] || makeDefaultTaskState(0, 0)

  const updateState = (id: string, updates: Partial<TaskState>) => {
    setTaskStates(prev => ({ ...prev, [id]: { ...getState(id), ...updates } }))
  }

  const getSummary = (taskId: string, type: CardType): string => {
    const task = tasks.find(t => t.id === taskId)
    const state = getState(taskId)
    if (!task) return ""

    switch (type) {
      case "info":
        return `任务名称：${task.name}\n编码：${task.code || "-"}\n任务类型：${task.taskType === "assessment" ? "考核" : "训练"}\n难度：${task.difficulty}星\n预估学时：${task.estimatedHours}小时`
      case "description":
        return state.description ? `${state.description.replace(/<[^>]*>/g, "").slice(0, 50)}...` : "未填写"
      case "knowledge":
        if (state.knowledgePoints.length === 0) return "未配置"
        const kpNames = state.knowledgePoints.map(id => knowledgePoints.find(k => k.id === id)?.name).filter(Boolean)
        return kpNames.slice(0, 3).join("、") + (kpNames.length > 3 ? ` 等${state.knowledgePoints.length}个` : "")
      case "ability":
        if (state.abilityPoints.length === 0) return "未配置"
        const abNames = state.abilityPoints.map(id => abilityPoints.find(a => a.id === id)?.name).filter(Boolean)
        return abNames.slice(0, 3).join("、") + (abNames.length > 3 ? ` 等${state.abilityPoints.length}个` : "")
      case "resources":
        if (state.resources.length === 0) return "未配置"
        const resNames = state.resources.map(id => learningResources.find(r => r.id === id)?.name).filter(Boolean)
        return resNames.slice(0, 3).join("、") + (resNames.length > 3 ? ` 等${state.resources.length}个` : "")
      case "evaluation":
        if (state.evaluationMethods.length === 0) return "未配置"
        return state.evaluationMethods.map(m => evaluationMethodOptions.find(o => o.key === m)?.label).filter(Boolean).join("、")
      case "evaluationRules":
        if (state.evaluationMethods.length === 0) return "未配置评价方式"
        const configuredMethods = state.evaluationMethods.filter(m => {
          if (m === "random_draw") return state.randomDrawSelectedIds.length > 0 || state.randomDrawEvalPoints.length > 0
          if (m === "review") return state.reviewEvalPoints.length > 0
          if (m === "paper") return state.paperIds.length > 0
          if (m === "question_bank") return state.questionBankQuestions.length > 0
          if (m === "outcome") return state.outcomeEvalPoints.length > 0
          if (m === "homework") return state.homeworkEvalPoints.length > 0
          if (m === "quiz") return state.quizQuestions.length > 0
          return false
        })
        const methodWeightTotal2 = state.evaluationMethods.reduce((sum, m) => sum + (state.methodWeights[m] || 0), 0)
        if (configuredMethods.length === 0) return "待配置"
        const weightSummary = state.evaluationMethods.map(m => {
          const label = evaluationMethodOptions.find(o => o.key === m)?.label || m
          return `${label}${state.methodWeights[m] || 0}%`
        }).join("、")
        return `${weightSummary}\n权重合计 ${methodWeightTotal2}%${methodWeightTotal2 !== 100 ? " (需等于100%)" : ""}`
      case "weight":
        return `${state.weight}%`
    }
  }

  const isConfigured = (taskId: string, type: CardType): boolean => {
    const state = getState(taskId)
    switch (type) {
      case "info": return true
      case "description": return !!state.description
      case "knowledge": return state.knowledgePoints.length > 0
      case "ability": return state.abilityPoints.length > 0
      case "resources": return state.resources.length > 0
      case "evaluation": return state.evaluationMethods.length > 0
      case "evaluationRules": return state.evaluationMethods.length > 0
      case "weight": return state.weight > 0
    }
  }

  const handleAddTask = async () => {
    if (!newTask.name.trim()) return
    try {
      const payload: any = {
        scenarioId,
        name: newTask.name.trim(),
        code: `TK-${Date.now().toString().slice(-6)}`,
        sortOrder: tasks.length + 1,
        estimatedHours: newTask.hours,
        taskType: newTask.type,
        difficulty: newTask.difficulty,
        background: newTask.background,
        dependencyIds: [],
        isReferenced: false,
        knowledgePointIds: [],
        abilityPointIds: [],
        resourceIds: [],
      }
      const created = await taskApi.create(payload)
      const mkTask: Task = {
        ...created as any,
        order: created.sortOrder,
        deliverables: [],
        knowledgePoints: [],
        abilityPoints: [],
        resources: [],
        dependencies: [],
        assessment: null,
      }
      const newTasks = [...tasks, mkTask]
      setTasks(newTasks)
      const count = newTasks.length
      const weight = Math.floor(100 / count)
      const newStates = { ...taskStates }
      Object.keys(newStates).forEach(id => { newStates[id] = { ...newStates[id], weight } })
      newStates[created.id] = makeDefaultTaskState(count, count - 1)
      newStates[created.id].weight = 100 - weight * (count - 1)
      setTaskStates(newStates)
      setIsAddTaskOpen(false)
      setNewTask({ name: "", hours: 4, type: "training", difficulty: 3, background: "" })
      toast({ title: "已添加任务" })
    } catch (err: any) {
      toast({ variant: "destructive", title: "添加失败", description: err.message })
    }
  }

  const handleClone = async () => {
    setIsCloning(true)
    try {
      const selected = allTasks.filter(t => selectedClone.includes(t.id))
      const count = tasks.length + selected.length

      const newTasks = selected.map((t, i) => ({
        ...t,
        id: `task-${cloneMode}-${Date.now()}-${i}`,
        order: tasks.length + i + 1,
        isReferenced: cloneMode === "reference",
        sourceScenarioId: t.scenarioId,
        sourceScenarioName: cloneMode === "reference" ? t.scenarioName : undefined,
      }))

      const methodsResults = await Promise.all(
        selected.map(t => taskEvaluationApi.listMethods(t.id).catch(() => ({ methods: [] })))
      )

      const newStates: Record<string, TaskState> = {}
      selected.forEach((t, i) => {
        const methods = methodsResults[i]?.methods || []
        let ts = taskStateFromMethods(t, methods)
        if (t.knowledgePointIds) ts.knowledgePoints = [...t.knowledgePointIds]
        if (t.abilityPointIds) ts.abilityPoints = [...t.abilityPointIds]
        if (t.resourceIds) ts.resources = [...t.resourceIds]
        if (t.detailedDescription) ts.description = t.detailedDescription
        if (t.descriptionPdf) ts.descriptionPdf = t.descriptionPdf
        ts.weight = count > 0 ? Math.floor(100 / count) + ((tasks.length + i) < 100 % count ? 1 : 0) : 0
        newStates[newTasks[i].id] = ts
      })

      setTasks([...tasks, ...newTasks])
      setTaskStates(prev => ({ ...prev, ...newStates }))
      setIsCloneOpen(false)
      setSelectedClone([])
    } catch (err: any) {
      console.error("Clone failed", err)
      toast({ variant: "destructive", title: "克隆失败", description: err.message })
    } finally {
      setIsCloning(false)
    }
  }

  const handleDeleteTask = async (id: string) => {
    try {
      await taskApi.delete(id)
      setTasks(tasks.filter(t => t.id !== id))
      const newStates = { ...taskStates }
      delete newStates[id]
      setTaskStates(newStates)
      setDeleteConfirmTask(null)
      toast({ title: "已删除任务" })
    } catch (err: any) {
      toast({ variant: "destructive", title: "删除失败", description: err.message })
    }
  }

  const saveTasksToBackend = async () => {
    // Persist custom knowledge points added in this session and map their IDs
    const kpIdMapping: Record<string, string> = {}
    for (const kpId of Array.from(customKnowledgePointIds)) {
      const kp = knowledgePoints.find(k => k.id === kpId)
      if (!kp) continue
      try {
        const created = await knowledgeApi.create({
          name: kp.name,
          code: kp.code,
          description: kp.description,
          linked: false,
          granularLessonIds: kp.granularLessons || [],
        } as any)
        kpIdMapping[kpId] = created.id
        const idx = knowledgePoints.findIndex(k => k.id === kpId)
        if (idx >= 0) knowledgePoints[idx] = { ...knowledgePoints[idx], id: created.id }
        customKnowledgePointIds.delete(kpId)
      } catch (err: any) {
        console.error("Failed to persist custom knowledge point", kpId, err)
      }
    }

    // Persist custom ability points added in this session and map their IDs
    const abIdMapping: Record<string, string> = {}
    for (const abId of Array.from(customAbilityPointIds)) {
      const ap = abilityPoints.find(a => a.id === abId)
      if (!ap) continue
      try {
        const created = await abilityApi.create({
          name: ap.name,
          description: ap.description,
          category: ap.category,
          attributes: [],
          isPublic: false,
        } as any)
        abIdMapping[abId] = created.id
        const idx = abilityPoints.findIndex(a => a.id === abId)
        if (idx >= 0) abilityPoints[idx] = { ...abilityPoints[idx], id: created.id }
        customAbilityPointIds.delete(abId)
      } catch (err: any) {
        console.error("Failed to persist custom ability point", abId, err)
      }
    }

    // Persist custom resources added in this session and map their IDs
    const resourceIdMapping: Record<string, string> = {}
    for (const resId of Array.from(customResourceIds)) {
      const res = learningResources.find(r => r.id === resId)
      if (!res) continue
      try {
        const created = await taskResourceApi.create({
          name: res.name,
          type: res.type,
          url: res.url,
          description: res.description,
          thumbnail: res.thumbnail,
          size: res.size,
          knowledgePointIds: res.knowledgePoints || res.knowledgePointIds || [],
          extraData: res.extraData,
          uploadedBy: res.uploadedBy,
        } as any)
        resourceIdMapping[resId] = created.id
        const idx = learningResources.findIndex(r => r.id === resId)
        if (idx >= 0) learningResources[idx] = { ...learningResources[idx], id: created.id }
        customResourceIds.delete(resId)
      } catch (err: any) {
        console.error("Failed to persist custom resource", resId, err)
      }
    }

    // Replace temporary custom IDs with persisted IDs across all task states
    const replaceIds = (ids: string[]) => ids.map(id => kpIdMapping[id] || abIdMapping[id] || resourceIdMapping[id] || id)
    const replaceEvalPoints = (points: EvalPoint[]) =>
      points.map(p => ({
        ...p,
        knowledgePointIds: p.knowledgePointIds ? replaceIds(p.knowledgePointIds) : p.knowledgePointIds,
        abilityPointIds: p.abilityPointIds ? replaceIds(p.abilityPointIds) : p.abilityPointIds,
      }))

    const updatedTaskStates: Record<string, TaskState> = { ...taskStates }
    Object.keys(updatedTaskStates).forEach(tid => {
      const s = updatedTaskStates[tid]
      if (Object.keys(kpIdMapping).length === 0 && Object.keys(abIdMapping).length === 0 && Object.keys(resourceIdMapping).length === 0) return
      updatedTaskStates[tid] = {
        ...s,
        knowledgePoints: replaceIds(s.knowledgePoints),
        abilityPoints: replaceIds(s.abilityPoints),
        resources: replaceIds(s.resources),
        randomDrawEvalPoints: replaceEvalPoints(s.randomDrawEvalPoints),
        reviewEvalPoints: replaceEvalPoints(s.reviewEvalPoints),
        paperEvalPoints: replaceEvalPoints(s.paperEvalPoints),
        questionBankEvalPoints: replaceEvalPoints(s.questionBankEvalPoints),
        outcomeEvalPoints: replaceEvalPoints(s.outcomeEvalPoints),
        homeworkEvalPoints: replaceEvalPoints(s.homeworkEvalPoints),
        quizEvalPoints: replaceEvalPoints(s.quizEvalPoints),
      }
    })
    setTaskStates(updatedTaskStates)

    for (let i = 0; i < tasks.length; i++) {
      const t = tasks[i]
      const ts = updatedTaskStates[t.id] || makeDefaultTaskState(0, 0)
      const payload: any = {
        scenarioId,
        name: t.name,
        code: t.code,
        sortOrder: i,
        description: t.description,
        detailedDescription: ts.description || t.detailedDescription,
        descriptionPdf: ts.descriptionPdf || t.descriptionPdf || null,
        estimatedHours: t.estimatedHours,
        taskType: t.taskType,
        difficulty: t.difficulty,
        background: t.background,
        dependencyIds: t.dependencies || [],
        isReferenced: !!t.isReferenced,
        sourceScenarioId: t.sourceScenarioId || null,
        knowledgePointIds: ts.knowledgePoints || [],
        abilityPointIds: ts.abilityPoints || [],
        resourceIds: ts.resources || [],
      }
      if (t.id.startsWith("task-")) {
        const created = await taskApi.create(payload)
        t.id = created.id
        await taskEvaluationApi.saveMethods(created.id, { methods: taskStateToMethodsInput(ts) })
      } else {
        await taskApi.update(t.id, payload)
        const methodsInput = taskStateToMethodsInput(ts)
        if (methodsInput.length > 0) {
          await taskEvaluationApi.saveMethods(t.id, { methods: methodsInput })
        }
      }
    }
  }

  const handleSaveDraft = async () => {
    setIsSaving(true)
    try {
      await saveTasksToBackend()
      if (existingScenario?.status !== "draft") {
        await scenarioApi.saveDraft(scenarioId)
        setExistingScenario((prev: any) => (prev ? { ...prev, status: "draft" } : prev))
        toast({ title: "草稿已保存", description: "场景已退回草稿状态" })
      } else {
        toast({ title: "草稿已保存" })
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "保存失败", description: err.message })
    } finally {
      setIsSaving(false)
    }
  }

  const handleFinish = async () => {
    setIsSaving(true)
    try {
      await saveTasksToBackend()
      if (existingScenario?.status !== "draft") {
        await scenarioApi.saveDraft(scenarioId)
        setExistingScenario((prev: any) => (prev ? { ...prev, status: "draft" } : prev))
        toast({ title: "配置已保存", description: "场景已退回草稿状态" })
      } else {
        toast({ title: "配置已保存" })
      }
      router.push("/scene")
    } catch (err: any) {
      toast({ variant: "destructive", title: "保存失败", description: err.message })
    } finally {
      setIsSaving(false)
    }
  }

  const distributeWeights = () => {
    const unlocked = tasks.filter(t => !getState(t.id).locked)
    const lockedWeight = tasks.filter(t => getState(t.id).locked).reduce((s, t) => s + getState(t.id).weight, 0)
    const remaining = 100 - lockedWeight
    const each = Math.floor(remaining / unlocked.length)
    const newStates = { ...taskStates }
    unlocked.forEach((t, i) => {
      newStates[t.id] = { ...newStates[t.id], weight: each + (i < remaining % unlocked.length ? 1 : 0) }
    })
    setTaskStates(newStates)
  }

  return (
    <EditorShell
      mode="fullscreen"
      backText="取消"
      onBack={() => router.push("/scene")}
      step={2}
      stepLabel="任务链配置"
      onSaveDraft={handleSaveDraft}
      isSaving={isSaving}
      onPrev={() => router.push(`/scene/scenarios/${scenarioId}/edit`)}
      onSubmit={handleFinish}
      submitText="完成配置"
      contentMaxWidth="max-w-[1400px]"
    >
        {/* Scenario Info */}
        <PrdAnnotation data={getAnnotation("editor-scenario-summary")} className="block">
          <Card>
            <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <CardTitle className="text-lg truncate">{existingScenario?.name || "新建场景"}</CardTitle>
                  {existingScenario && existingScenario.coBuilders.length > 0 && (
                    <Badge variant="secondary" className="text-[10px]">共建</Badge>
                  )}
                </div>
                <CardDescription className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="truncate">
                    {existingScenario?.positionName || existingScenario?.positionId || "未选择岗位"}
                    {" | "}
                    {existingScenario?.industryName || existingScenario?.industryId || "未选择行业"}
                    {" | "}
                    {existingScenario?.professionName || existingScenario?.professionId || "未选择专业"}
                  </span>
                  {existingScenario && existingScenario.coBuilders.length > 0 && (
                    <span className="flex flex-wrap items-center gap-1">
                      <span className="text-gray-400">|</span>
                      <span>共建人：</span>
                      {existingScenario.coBuilders.map((cb: { id: string; name: string }) => (
                        <Badge key={cb.id} variant="outline" className="text-[10px]">
                          {cb.name}
                        </Badge>
                      ))}
                    </span>
                  )}
                </CardDescription>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="flex items-center gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className={cn("h-4 w-4", i < (existingScenario?.difficulty || 3) ? "fill-amber-400 text-amber-400" : "text-gray-200")} />
                  ))}
                </div>
                <Badge variant="outline">{existingScenario?.version}</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0 border-t">
            <p className="text-sm text-gray-600 pt-3">{existingScenario?.background || "暂无介绍"}</p>
          </CardContent>
        </Card>
        </PrdAnnotation>

        {/* Tasks Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mt-6">
          <div className="flex flex-wrap items-center gap-3">
            <PrdAnnotation data={getAnnotation("editor-task-list-title")}>
              <h2 className="font-semibold text-lg">任务列表</h2>
            </PrdAnnotation>
            <Badge variant="secondary">{tasks.length} 个任务</Badge>
            <PrdAnnotation data={getAnnotation("editor-task-weight-hint")}>
              <div className={cn(
                "flex items-center gap-1 text-sm px-2 py-1 rounded",
                totalWeight === 100 ? "bg-green-50 text-green-600" : "bg-amber-50 text-amber-600"
              )}>
                <Scale className="h-3.5 w-3.5" />
                权重: {totalWeight}%
              </div>
            </PrdAnnotation>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <PrdAnnotation data={getAnnotation("editor-add-task")}>
              <Button size="sm" onClick={() => setIsAddTaskOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                添加任务
              </Button>
            </PrdAnnotation>
            <PrdAnnotation data={getAnnotation("editor-clone-task")}>
              <Button variant="outline" size="sm" onClick={() => setIsCloneOpen(true)}>
                <Copy className="mr-2 h-4 w-4" />
                克隆/引用
              </Button>
            </PrdAnnotation>
            <PrdAnnotation data={getAnnotation("editor-config-weight")}>
              <Button variant="outline" size="sm" onClick={() => setIsWeightConfigOpen(true)}>
                <PieChartIcon className="mr-2 h-4 w-4" />
                配置任务权重
              </Button>
            </PrdAnnotation>
          </div>
        </div>

        {/* Task List with unified horizontal scroll */}
        <div className="overflow-x-auto pb-2 -mx-2 px-2">
          {/* Column Headers — mirror row structure for precise alignment */}
          <div className="flex items-start gap-3 min-w-max pr-2">
            <div className="w-8 shrink-0" />
            {cardConfigs.map(c => (
              <PrdAnnotation key={c.type} data={getAnnotation(`editor-card-${c.type}`)} className="w-52 shrink-0">
                <div className="w-52 shrink-0 text-xs text-gray-500 text-center whitespace-pre-line leading-tight py-2">
                  {c.title}
                </div>
              </PrdAnnotation>
            ))}
            <div className="w-8 shrink-0" />
          </div>

          {/* Task Rows */}
          <div className="space-y-4 min-w-max pr-2">
            {tasks.map((task, idx) => (
              <div
                key={task.id}
                draggable
                onDragStart={() => setDraggedIdx(idx)}
                onDragOver={(e) => {
                  e.preventDefault()
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  if (draggedIdx === null || draggedIdx === idx) {
                    setDraggedIdx(null)
                    return
                  }
                  const newTasks = [...tasks]
                  const [removed] = newTasks.splice(draggedIdx, 1)
                  newTasks.splice(idx, 0, removed)
                  const reordered = newTasks.map((t, i) => ({ ...t, order: i + 1 }))
                  setTasks(reordered)
                  setDraggedIdx(null)
                  taskApi.reorder(scenarioId, reordered.map(t => t.id)).catch(() => {})
                }}
                className={cn(
                  "flex items-center gap-3 p-4 bg-white rounded-xl border shadow-sm hover:shadow-md hover:border-primary/30 transition-all group",
                  draggedIdx === idx && "opacity-50 border-dashed border-primary"
                )}
              >
                {/* Order */}
                <div className="flex items-center justify-center gap-1 shrink-0 w-8 cursor-grab rounded-md hover:bg-gray-100 py-4">
                  <GripVertical className="h-4 w-4 text-gray-400" />
                  <span className="text-xs text-gray-400 font-medium">{idx + 1}</span>
                </div>

                {/* Cards */}
                <div className="flex items-center gap-3 flex-1">
                  {cardConfigs.map(config => {
                    const configured = isConfigured(task.id, config.type)
                    const summary = getSummary(task.id, config.type)
                    const isRef = task.isReferenced && config.type !== "weight"
                    const isWeightReadonly = config.type === "weight"

                    return (
                      <button
                        key={config.type}
                        onClick={() => !isRef && !isWeightReadonly && setEditingCard({ taskId: task.id, type: config.type })}
                        disabled={isRef || isWeightReadonly}
                        className={cn(
                          "w-52 h-40 shrink-0 rounded-lg border p-3.5 text-left transition-all flex flex-col",
                          isRef || isWeightReadonly
                            ? "bg-gray-100 border-gray-200 cursor-not-allowed opacity-60"
                            : configured
                              ? "bg-white border-gray-200 hover:border-primary hover:shadow-sm"
                              : "bg-gray-50/70 border-dashed border-gray-300 hover:border-primary hover:bg-gray-50"
                        )}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <div className={cn(
                            "p-1.5 rounded-md",
                            configured ? "bg-primary/10 text-primary" : "bg-gray-100 text-gray-400"
                          )}>
                            {config.icon}
                          </div>
                          <span className="text-xs font-medium truncate flex-1">{config.title}</span>
                          {isRef && <Badge variant="outline" className="text-[10px] px-1 py-0">引用</Badge>}
                        </div>
                        <p className={cn(
                          "text-xs line-clamp-5 flex-1 leading-relaxed whitespace-pre-line",
                          configured ? "text-gray-600" : "text-gray-400"
                        )}>
                          {summary}
                        </p>
                      </button>
                    )
                  })}
                </div>

                {/* Delete */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-gray-400 hover:text-red-500"
                  onClick={() => setDeleteConfirmTask({ id: task.id, name: task.name })}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}

            {tasks.length === 0 && (
              <div className="py-16 text-center">
                <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 mb-4">暂无任务，点击添加第一个任务</p>
                <Button onClick={() => setIsAddTaskOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  添加任务
                </Button>
              </div>
            )}
          </div>
        </div>

      {/* Add Task Dialog */}
      <Dialog open={isAddTaskOpen} onOpenChange={setIsAddTaskOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <PrdAnnotation data={getAnnotation("editor-add-task")}>
              <DialogTitle>添加任务</DialogTitle>
            </PrdAnnotation>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>任务名称</Label>
              <Input value={newTask.name} onChange={e => setNewTask({ ...newTask, name: e.target.value })} placeholder="输入任务名称" className="mt-1.5" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>任务类型</Label>
                <Select value={newTask.type} onValueChange={v => setNewTask({ ...newTask, type: v as "assessment" | "training" })}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="training">训练任务</SelectItem>
                    <SelectItem value="assessment">考核任务</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <Label>预估学时</Label>
                  <span className="text-xs text-gray-400">学生完成任务的预估时长</span>
                </div>
                <Input type="number" value={newTask.hours} onChange={e => setNewTask({ ...newTask, hours: +e.target.value })} className="mt-1.5" />
              </div>
            </div>
            <div>
              <Label>难度</Label>
              <div className="flex gap-1 mt-1.5">
                {[1,2,3,4,5].map(n => (
                  <button key={n} onClick={() => setNewTask({ ...newTask, difficulty: n })}>
                    <Star className={cn("h-6 w-6", n <= newTask.difficulty ? "fill-amber-400 text-amber-400" : "text-gray-200")} />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>背景介绍</Label>
              <Textarea value={newTask.background} onChange={e => setNewTask({ ...newTask, background: e.target.value })} placeholder="简述任务背景" className="mt-1.5" rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddTaskOpen(false)}>取消</Button>
            <Button onClick={handleAddTask} disabled={!newTask.name}>添加</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clone Dialog */}
      <Dialog open={isCloneOpen} onOpenChange={setIsCloneOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <PrdAnnotation data={getAnnotation("editor-clone-task")}>
              <DialogTitle>克隆/引用任务</DialogTitle>
            </PrdAnnotation>
            <DialogDescription>从其他场景选择任务进行克隆或引用</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 flex-1 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <Button variant={cloneMode === "clone" ? "default" : "outline"} size="sm" onClick={() => setCloneMode("clone")}>克隆（可编辑）</Button>
                <Button variant={cloneMode === "reference" ? "default" : "outline"} size="sm" onClick={() => setCloneMode("reference")}>引用（只读）</Button>
              </div>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input value={cloneSearch} onChange={e => setCloneSearch(e.target.value)} placeholder="搜索任务名称、编码..." className="pl-9" />
              </div>
            </div>
            <Tabs value={cloneTab} onValueChange={v => setCloneTab(v as "my" | "collab" | "public")}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="my">我的</TabsTrigger>
                <TabsTrigger value="collab">共建</TabsTrigger>
                <TabsTrigger value="public">公共库</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="flex-1 overflow-y-auto border rounded-lg">
              {/* Table Header */}
              <div className="grid grid-cols-[48px_1fr_120px_140px_120px] gap-3 px-4 py-2 bg-gray-50 text-xs font-medium text-gray-500 border-b sticky top-0">
                <div></div>
                <div>任务名称</div>
                <div>任务编码</div>
                <div>关联场景</div>
                <div>关联岗位</div>
              </div>
              {allTasks
                .filter(t => {
                  if (cloneTab === "my") return t.scenarioCreatorId === (user?.id || "")
                  if (cloneTab === "collab") return Array.isArray(t.scenarioCoBuilderIds) && t.scenarioCoBuilderIds.includes(user?.id || "")
                  if (cloneTab === "public") return t.scenarioStatus === "published" && t.scenarioCreatorId !== (user?.id || "")
                  return true
                })
                .filter(t => !cloneSearch || t.name.includes(cloneSearch) || t.code?.includes(cloneSearch) || t.scenarioName?.includes(cloneSearch))
                .map(t => {
                  const selected = selectedClone.includes(t.id)
                  return (
                    <div key={t.id} onClick={() => setSelectedClone(prev => prev.includes(t.id) ? prev.filter(x => x !== t.id) : [...prev, t.id])} className={cn("grid grid-cols-[48px_1fr_120px_140px_120px] gap-3 px-4 py-3 border-b cursor-pointer items-center text-sm hover:bg-gray-50", selected ? "bg-primary/5" : "")}>
                      <div className="flex justify-center">
                        <div className={cn("w-4 h-4 rounded border flex items-center justify-center", selected ? "bg-primary border-primary" : "border-gray-300")}>
                          {selected && <CheckCircle2 className="h-3 w-3 text-white" />}
                        </div>
                      </div>
                      <div className="font-medium">{t.name}</div>
                      <div className="text-gray-500 text-xs">{t.code}</div>
                      <div className="text-gray-500 text-xs truncate">{t.scenarioName}</div>
                      <div className="text-gray-500 text-xs">{existingScenario?.positionName || "-"}</div>
                    </div>
                  )
                })}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCloneOpen(false)}>取消</Button>
            <Button onClick={handleClone} disabled={selectedClone.length === 0 || isCloning}>
              {isCloning ? "克隆中..." : `确定 (${selectedClone.length})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Card Dialog */}
      {editingCard && (
        <EditCardDialog
          allTasks={tasks}
          taskId={editingCard.taskId}
          cardType={editingCard.type}
          task={tasks.find(t => t.id === editingCard.taskId)!}
          state={getState(editingCard.taskId)}
          updateState={(updates) => updateState(editingCard.taskId, updates)}
          updateTask={(updates) => setTasks(tasks.map(t => t.id === editingCard.taskId ? { ...t, ...updates } : t))}
          allTaskStates={taskStates}
          updateAnyState={(id, updates) => updateState(id, updates)}
          onClose={() => setEditingCard(null)}
          positionId={existingScenario?.positionId}
          toast={toast}
          positionAbilityBindings={positionAbilityBindings}
          userNameMap={userNameMap}
          tenantId={tenantId}
          orgNodeId={orgNodeId}
        />
      )}

      {/* Weight Config Dialog */}
      <WeightConfigDialog
        open={isWeightConfigOpen}
        onOpenChange={setIsWeightConfigOpen}
        tasks={tasks}
        taskStates={taskStates}
        updateAnyState={(id, updates) => updateState(id, updates)}
      />

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteConfirmTask} onOpenChange={(open) => !open && setDeleteConfirmTask(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <PrdAnnotation data={getAnnotation("row-action-delete")}>
              <DialogTitle>确认删除</DialogTitle>
            </PrdAnnotation>
            <DialogDescription>
              确定要删除任务「{deleteConfirmTask?.name}」吗？删除后不可恢复。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmTask(null)}>取消</Button>
            <Button variant="destructive" onClick={() => deleteConfirmTask && handleDeleteTask(deleteConfirmTask.id)}>
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Toaster />
    </EditorShell>
  )
}

const questionTypeLabels: Record<string, string> = {
  single: "单选",
  multiple: "多选",
  judgment: "判断",
  judge: "判断",
  short_answer: "简答",
  essay: "论述",
  fill_blank: "填空",
  fill: "填空",
}

const difficultyLabels: Record<string, string> = {
  easy: "简单",
  medium: "中等",
  hard: "困难",
}

// Module-level sets to track custom (added/cloned) points/resources across dialog re-opens
const customKnowledgePointIds = new Set<string>()
const customAbilityPointIds = new Set<string>()
const customResourceIds = new Set<string>()

function PaperDetailWrapper({ paperId, open, onOpenChange }: { paperId: string | null, open: boolean, onOpenChange: (v: boolean) => void }) {
  const [paper, setPaper] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open && paperId) {
      const cached = loadedExams.find(e => e.id === paperId)
      if (cached?.questions?.length) {
        setPaper(cached)
      } else {
        setLoading(true)
        examApi.get(paperId).then((data: any) => {
          const idx = loadedExams.findIndex(e => e.id === paperId)
          if (idx >= 0) loadedExams[idx] = { ...loadedExams[idx], ...data }
          else loadedExams.push(data)
          setPaper(data)
        }).catch(() => {
          setPaper(cached || null)
        }).finally(() => setLoading(false))
      }
    }
  }, [open, paperId])

  const questions = paper?.questions || []
  const typeCounts: Record<string, number> = {}
  questions.forEach((q: any) => { typeCounts[q.type] = (typeCounts[q.type] || 0) + 1 })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <PrdAnnotation data={getAnnotation("dialog-paper-detail")}><DialogTitle>试卷详情</DialogTitle></PrdAnnotation>
        </DialogHeader>
        {loading ? (
          <div className="text-center py-8 text-gray-400">
            <Loader2 className="h-6 w-6 mx-auto animate-spin" />
            <p className="text-sm mt-2">加载中...</p>
          </div>
        ) : !paper ? (
          <div className="text-center py-8 text-gray-400">
            <p className="text-sm">未找到试卷</p>
          </div>
        ) : (
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs text-gray-500">试卷名称</Label>
              <p className="text-sm font-medium mt-1">{paper.name}</p>
            </div>
            {paper.description && (
              <div>
                <Label className="text-xs text-gray-500">试卷描述</Label>
                <p className="text-sm mt-1 text-gray-600">{paper.description}</p>
              </div>
            )}
            <div className="flex items-center gap-4">
              <div>
                <Label className="text-xs text-gray-500">题目数量</Label>
                <p className="text-sm mt-1">{questions.length} 题</p>
              </div>
              <div>
                <Label className="text-xs text-gray-500">总分</Label>
                <p className="text-sm mt-1">{paper.totalScore ?? questions.reduce((s: number, q: any) => s + (q.score || 0), 0)} 分</p>
              </div>
            </div>
            <div>
              <Label className="text-xs text-gray-500">包含题型</Label>
              <div className="flex flex-wrap gap-1 mt-1">
                {Object.keys(typeCounts).length > 0 ? (
                  Object.entries(typeCounts).map(([type, count]) => (
                    <Badge key={type} className={`text-[10px] text-white hover:opacity-90 ${typeColorMap[type] || ""}`}>
                      {questionTypeLabels[type] || type} ×{count}
                    </Badge>
                  ))
                ) : (
                  <span className="text-xs text-gray-400">暂无题目</span>
                )}
              </div>
            </div>
            {questions.length > 0 && (
              <div>
                <Label className="text-xs text-gray-500">题目列表</Label>
                <div className="space-y-1.5 mt-1 max-h-48 overflow-y-auto">
                  {questions.map((q: any, i: number) => (
                    <div key={q.id || i} className="flex items-center gap-2 text-xs p-1.5 rounded bg-gray-50">
                      <span className="text-gray-400 w-5 text-right">{i + 1}.</span>
                      <span className="flex-1 truncate">{q.content || "未命名题目"}</span>
                      <Badge className={`text-[10px] text-white hover:opacity-90 ${typeColorMap[q.type] || ""}`}>{questionTypeLabels[q.type] || q.type}</Badge>
                      <span className="text-gray-400">{q.score || 0}分</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>关闭</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const typeColorMap: Record<string, string> = {
  single: "bg-blue-500",
  multiple: "bg-indigo-500",
  judgment: "bg-amber-500",
  judge: "bg-amber-500",
  fill_blank: "bg-purple-500",
  fill: "bg-purple-500",
  essay: "bg-rose-500",
  short_answer: "bg-teal-500",
}

// Module-level question cache — persists across bank switches so selected questions
// remain visible in the right panel regardless of which bank is currently open.
const questionCache = new Map<string, any>()

function BankQuestionSelectorPanel({
  field,
  selectedIds,
  maxCount,
  onToggleQuestion,
  questionScores,
  onUpdateQuestionScore,
  onUpdateQuestionScores,
}: {
  field: "questionBankQuestions" | "quizQuestions"
  selectedIds: string[]
  maxCount?: number
  onToggleQuestion: (qid: string) => void
  questionScores?: Record<string, number>
  onUpdateQuestionScore?: (qid: string, score: number) => void
  onUpdateQuestionScores?: (scores: Record<string, number>) => void
}) {
  const [banks, setBanks] = useState<any[]>([])
  const [bankQuestions, setBankQuestions] = useState<any[]>([])
  const [selectedBankId, setSelectedBankId] = useState<string | null>(null)
  const [selectedBankName, setSelectedBankName] = useState("")
  const [loadingBanks, setLoadingBanks] = useState(false)
  const [loadingQuestions, setLoadingQuestions] = useState(false)
  const [bankTab, setBankTab] = useState<"my" | "collab" | "public">("my")
  const [bankSearch, setBankSearch] = useState("")
  const [questionSearch, setQuestionSearch] = useState("")
  const [scoreDialogOpen, setScoreDialogOpen] = useState(false)
  const [preloadedQuestions, setPreloadedQuestions] = useState<any[]>([])

  useEffect(() => { loadBanks() }, [])

  useEffect(() => {
    const missingIds = selectedIds.filter(qid => !questionCache.has(qid) && !preloadedQuestions.some(q => q.id === qid))
    if (missingIds.length === 0) return
    Promise.all(
      missingIds.map(async (qid) => {
        try {
          return await questionApi.get(qid) as unknown as any
        } catch (_) { return null }
      })
    ).then(results => {
      const loaded = results.filter(Boolean)
      loaded.forEach(q => questionCache.set(q.id, q))
      setPreloadedQuestions(prev => [...prev, ...loaded])
    })
  }, [selectedIds, preloadedQuestions])

  const loadBanks = async () => {
    setLoadingBanks(true)
    try {
      const res = await questionBankApi.list({ limit: 1000 }) as unknown as { items: any[] }
      setBanks(res.items)
    } catch (_) {} finally { setLoadingBanks(false) }
  }

  const loadQuestions = async (bankId: string) => {
    setLoadingQuestions(true)
    try {
      const res = await questionApi.list({ bankId, limit: 1000 }) as unknown as { items: any[] }
      for (const q of res.items) questionCache.set(q.id, q)
      setBankQuestions(res.items)
    } catch (_) {} finally { setLoadingQuestions(false) }
  }

  const handleSelectBank = (bankId: string, bankName: string) => {
    setSelectedBankId(bankId)
    setSelectedBankName(bankName)
    loadQuestions(bankId)
  }

  const handleBackToBanks = () => {
    setSelectedBankId(null)
    setSelectedBankName("")
    setBankQuestions([])
    setQuestionSearch("")
  }

  const tabBanks = useMemo(() => {
    switch (bankTab) {
      case "my": return banks.filter((b: any) => b.ownerType === "mine" || !b.ownerType)
      case "collab": return banks.filter((b: any) => (b.collaboratorIds || []).length > 0)
      case "public": return banks.filter((b: any) => b.status === "published")
    }
  }, [banks, bankTab])

  const filteredBanks = useMemo(() => {
    const q = bankSearch.trim().toLowerCase()
    if (!q) return tabBanks
    return tabBanks.filter((b: any) => b.name.toLowerCase().includes(q) || (b.description || "").toLowerCase().includes(q))
  }, [tabBanks, bankSearch])

  const filteredQuestions = useMemo(() => {
    const q = questionSearch.trim().toLowerCase()
    if (!q) return bankQuestions
    return bankQuestions.filter((qu: any) => (qu.content || "").toLowerCase().includes(q) || (qu.name || "").toLowerCase().includes(q))
  }, [bankQuestions, questionSearch])

  const handleEvenDistribution = () => {
    if (selectedIds.length === 0) return
    const n = selectedIds.length
    const base = Math.floor(100 / n)
    const remainder = 100 - base * n
    const scores: Record<string, number> = {}
    selectedIds.forEach((qid, idx) => { scores[qid] = base + (idx < remainder ? 1 : 0) })
    if (onUpdateQuestionScores) {
      onUpdateQuestionScores(scores)
    } else if (onUpdateQuestionScore) {
      selectedIds.forEach((qid, idx) => { onUpdateQuestionScore(qid, scores[qid]) })
    }
  }

  const handleTypeDistribution = (scores: Record<string, number>) => {
    if (onUpdateQuestionScores) {
      onUpdateQuestionScores(scores)
    } else if (onUpdateQuestionScore) {
      Object.entries(scores).forEach(([qid, score]) => { onUpdateQuestionScore(qid, score) })
    }
  }

  // Resolve a question by id — first from current bank, then preloaded/cache, then allQuestions
  const resolveQuestion = useCallback((qid: string) => {
    return bankQuestions.find((bq: any) => bq.id === qid)
      || preloadedQuestions.find((q: any) => q.id === qid)
      || questionCache.get(qid)
      || allQuestions.find((aq: any) => aq.id === qid)
  }, [bankQuestions, preloadedQuestions])

  // Build minimal ExamQuestion-like objects for ScoreConfigDialog
  const selectedQuestionItems = useMemo(() => {
    return selectedIds.map(qid => {
      const q = resolveQuestion(qid)
      return {
        id: qid,
        questionId: qid,
        type: q?.type ?? "single",
        content: q?.content ?? "",
        answer: "",
        score: questionScores?.[qid] ?? q?.score ?? 0,
        order: 0,
      }
    })
  }, [selectedIds, questionScores, resolveQuestion])

  return (
    <>
    <div className="flex gap-4 flex-1 min-h-0">
      <div className="w-3/5 flex flex-col min-h-0 border rounded-xl p-3">
        {selectedBankId ? (
          <>
            <div className="flex items-center gap-2 mb-3">
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleBackToBanks}>
                <ChevronLeft className="h-3.5 w-3.5 mr-0.5" />返回题库列表
              </Button>
              <span className="text-sm font-medium text-gray-700">{selectedBankName}</span>
            </div>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input value={questionSearch} onChange={e => setQuestionSearch(e.target.value)} placeholder="搜索题目内容..." className="pl-9" />
            </div>
            <div className="flex-1 overflow-y-auto">
              {loadingQuestions ? (
                <div className="text-center text-gray-400 py-8">
                  <Loader2 className="h-6 w-6 mx-auto animate-spin" />
                  <p className="text-sm mt-2">加载中...</p>
                </div>
              ) : filteredQuestions.length === 0 ? (
                <div className="text-center text-gray-400 py-8">
                  <FileQuestion className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">{bankQuestions.length === 0 ? "该题库暂无题目" : "没有找到匹配的题目"}</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                      <th className="text-left text-xs font-medium text-gray-500 px-3 py-2 w-[40%]">题目内容</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-3 py-2 w-[12%]">题型</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-3 py-2 w-[12%]">难度</th>
                      <th className="text-right text-xs font-medium text-gray-500 px-3 py-2 w-[36%]">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredQuestions.map((q: any) => {
                      const isSelected = selectedIds.includes(q.id)
                      return (
                        <tr key={q.id} className={cn("hover:bg-gray-50 transition-colors cursor-pointer", isSelected ? "bg-primary/[0.03]" : "")} onClick={() => onToggleQuestion(q.id)}>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <div className={cn("w-4 h-4 rounded border flex items-center justify-center shrink-0", isSelected ? "bg-primary border-primary" : "border-gray-300")}>
                                {isSelected && <Check className="h-3 w-3 text-white" />}
                              </div>
                              <span className="text-sm text-gray-800 line-clamp-1">{q.content || q.name || "未命名题目"}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <Badge className={`text-xs text-white hover:opacity-90 ${typeColorMap[q.type] || ""}`}>{questionTypeLabels[q.type] || q.type}</Badge>
                          </td>
                          <td className="px-3 py-2">
                            <span className="text-xs text-gray-500">{difficultyLabels[q.difficulty] || q.difficulty}</span>
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center justify-end gap-1">
                              {isSelected ? (
                                <Button size="sm" variant="outline" className="h-6 text-[11px] px-2" onClick={e => { e.stopPropagation(); onToggleQuestion(q.id) }}>
                                  取消
                                </Button>
                              ) : (
                                <Button size="sm" className="h-6 text-[11px] px-2" onClick={e => { e.stopPropagation(); onToggleQuestion(q.id) }}>
                                  使用
                                </Button>
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
          </>
        ) : (
          <>
            <Tabs value={bankTab} onValueChange={v => setBankTab(v as "my" | "collab" | "public")} className="mb-3">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="my">我的</TabsTrigger>
                <TabsTrigger value="collab">共建</TabsTrigger>
                <TabsTrigger value="public">公共题库</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input value={bankSearch} onChange={e => setBankSearch(e.target.value)} placeholder="搜索题库名称..." className="pl-9" />
            </div>
            <div className="flex-1 overflow-y-auto">
              {loadingBanks ? (
                <div className="text-center text-gray-400 py-8">
                  <Loader2 className="h-6 w-6 mx-auto animate-spin" />
                  <p className="text-sm mt-2">加载中...</p>
                </div>
              ) : filteredBanks.length === 0 ? (
                <div className="text-center text-gray-400 py-8">
                  <Database className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">暂无题库</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredBanks.map((bank: any) => (
                    <div
                      key={bank.id}
                      onClick={() => handleSelectBank(bank.id, bank.name)}
                      className="p-3 rounded-lg border cursor-pointer hover:border-primary/50 hover:bg-primary/[0.02] transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Database className="h-4 w-4 text-gray-400" />
                          <span className="text-sm font-medium">{bank.name}</span>
                          <Badge variant="outline" className="text-[10px]">{bank.questionCount ?? 0} 题</Badge>
                        </div>
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                      </div>
                      {bank.description && (
                        <p className="text-xs text-gray-400 mt-1.5 line-clamp-1">{bank.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
      <div className="w-2/5 border rounded-xl p-3 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-gray-700">已选择题目 ({selectedIds.length}{maxCount ? `/${maxCount}` : ""})</p>
          {(field === "questionBankQuestions" || field === "quizQuestions") && selectedIds.length > 0 && onUpdateQuestionScore && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 text-[11px] px-2">
                  <SlidersHorizontal className="h-3 w-3 mr-1" />
                  分数配置
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuItem onClick={handleEvenDistribution}>
                  均匀分配 — 将 100 分均匀分给每道题，余数从第一题起加 1 分
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setScoreDialogOpen(true)}>
                  题型分配 — 为每种题型分配总分（合计 100），各题型内均匀分配
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        <div className="flex-1 overflow-y-auto">
          {selectedIds.length === 0 ? (
            <div className="text-center text-gray-400 py-8">
              <FileQuestion className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-xs">从左侧搜索并选择题目</p>
            </div>
          ) : (
            <div className="space-y-2">
              {selectedIds.map(qid => {
                const q = resolveQuestion(qid)
                if (!q) return null
                return (
                  <div key={qid} className="p-2.5 rounded-lg border border-primary/20 bg-primary/5 relative">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium flex-1 truncate">{q.content || q.name || "未命名题目"}</span>
                      <Button variant="ghost" size="icon" className="h-5 w-5 text-gray-400 -mr-1 -mt-1" onClick={() => onToggleQuestion(qid)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Badge className={`text-[10px] text-white hover:opacity-90 ${typeColorMap[q.type] || ""}`}>{questionTypeLabels[q.type] || q.type}</Badge>
                      <span className="text-[10px] text-gray-400">{difficultyLabels[q.difficulty] || q.difficulty}</span>
                      {(field === "questionBankQuestions" || field === "quizQuestions") && onUpdateQuestionScore ? (
                        <div className="flex items-center gap-1 ml-auto">
                          <span className="text-[10px] text-gray-400">分值</span>
                          <Input
                            type="number"
                            value={questionScores?.[qid] ?? q.score ?? 0}
                            onChange={e => {
                              const val = Math.max(0, Math.min(100, parseInt(e.target.value) || 0))
                              onUpdateQuestionScore(qid, val)
                            }}
                            className="w-14 h-5 text-[10px] px-1 py-0"
                            min={0}
                            max={100}
                          />
                        </div>
                      ) : (
                        <span className="text-[10px] text-gray-400">{q.score ?? 0}分</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
    {(field === "questionBankQuestions" || field === "quizQuestions") && onUpdateQuestionScore && (
      <ScoreConfigDialog
        open={scoreDialogOpen}
        onOpenChange={setScoreDialogOpen}
        questions={selectedQuestionItems}
        onApply={handleTypeDistribution}
      />
    )}
    </>
  )
}

// ============ RandomDrawResourcePanel (extracted to module level for stable component identity) ============

interface RandomDrawResourcePanelProps {
  state: TaskState
  updateState: (u: Partial<TaskState>) => void
  rdqSearch: string
  setRdqSearch: (v: string) => void
  rdqActionOpen: boolean
  setRdqActionOpen: (v: boolean) => void
  rdqActionMode: "add" | "edit" | null
  setRdqActionMode: (v: "add" | "edit" | null) => void
  rdqActionTarget: { id: string; name: string; description: string; answer: string } | null
  setRdqActionTarget: (v: { id: string; name: string; description: string; answer: string } | null) => void
  newRdqForm: { name: string; description: string; answer: string; major: string }
  setNewRdqForm: (v: { name: string; description: string; answer: string; major: string }) => void
  rdqDetailOpen: boolean
  setRdqDetailOpen: (v: boolean) => void
  selectedRdqForDetail: string | null
  setSelectedRdqForDetail: (v: string | null) => void
}

function RandomDrawResourcePanel({
  state,
  updateState,
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
  const rdqMajorOptions = ["全部", "经济学", "物流管理", "机械工程", "计算机科学", "电子信息", "工商管理", "会计学", "市场营销", "土木工程", "英语", "法学"]
  const [rdqMajorTab, setRdqMajorTab] = useState("全部")
  const [rdqDrawMode, setRdqDrawMode] = useState<"random" | "manual">("random")
  const [rdqDrawCount, setRdqDrawCount] = useState(5)
  const [allQuestions, setAllQuestions] = useState<RandomDrawQuestion[]>([])
  const [loading, setLoading] = useState(true)

  const rdCfg = state.methodResourceConfigs.random_draw || {}
  const [submitFormatDesc, setSubmitFormatDesc] = useState<string>(rdCfg.submitFormatDesc || "")
  const [venueResources, setVenueResources] = useState<string>(rdCfg.venueResources || "")

  useEffect(() => {
    setSubmitFormatDesc(rdCfg.submitFormatDesc || "")
    setVenueResources(rdCfg.venueResources || "")
  }, [rdCfg.submitFormatDesc, rdCfg.venueResources])

  const loadQuestions = useCallback(async () => {
    try {
      const res = await randomDrawQuestionApi.list({ limit: 9999 })
      setAllQuestions(res.items)
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  useEffect(() => { loadQuestions() }, [loadQuestions])

  const filteredRdq = allQuestions.filter(q => {
    const matchMajor = rdqMajorTab === "全部" || (q.major || "") === rdqMajorTab
    const matchSearch = !rdqSearch || q.name.includes(rdqSearch) || (q.description || "").includes(rdqSearch) || (q.major || "").includes(rdqSearch)
    return matchMajor && matchSearch
  })

  const handleAddRdq = () => {
    setNewRdqForm({ name: "", description: "", answer: "", major: "" })
    setRdqActionMode("add")
    setRdqActionTarget(null)
    setRdqActionOpen(true)
  }

  const handleEditRdq = (q: typeof allQuestions[0]) => {
    setNewRdqForm({ name: q.name, description: q.description || "", answer: q.answer || "", major: q.major || "" })
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
          major: newRdqForm.major.trim() || undefined,
        } as any)
      } else {
        await randomDrawQuestionApi.create({
          name: newRdqForm.name.trim(),
          description: newRdqForm.description.trim() || undefined,
          answer: newRdqForm.answer.trim() || undefined,
          major: newRdqForm.major.trim() || undefined,
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
      updateState({ randomDrawSelectedIds: state.randomDrawSelectedIds.filter(sid => sid !== id) })
      await loadQuestions()
    } catch { /* ignore */ }
  }

  const handleToggleSelect = (id: string) => {
    const isSelected = state.randomDrawSelectedIds.includes(id)
    if (isSelected) {
      updateState({ randomDrawSelectedIds: state.randomDrawSelectedIds.filter(sid => sid !== id) })
    } else {
      updateState({ randomDrawSelectedIds: [...state.randomDrawSelectedIds, id] })
    }
  }

  const selectedRdqList = state.randomDrawSelectedIds.map(id => allQuestions.find(q => q.id === id)).filter(Boolean) as typeof allQuestions

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input value={rdqSearch} onChange={e => setRdqSearch(e.target.value)} placeholder="搜索现场问答题名称、描述或适用专业..." className="pl-9" />
        </div>
        <Button onClick={handleAddRdq}>
          <Plus className="h-4 w-4 mr-1" />新增现场问答题
        </Button>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Left: All questions */}
        <div className="w-3/5 flex flex-col min-h-0 border rounded-xl p-3">
          <div className="flex items-center gap-1 mb-2">
            {rdqMajorOptions.map(opt => (
              <button
                key={opt}
                onClick={() => setRdqMajorTab(opt)}
                className={cn(
                  "px-2.5 py-1 rounded-md text-[11px] transition-all",
                  rdqMajorTab === opt
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-gray-500 hover:bg-gray-100"
                )}
              >
                {opt}
              </button>
            ))}
          </div>
          <p className="text-sm font-medium mb-2 text-gray-700">
            {rdqSearch ? `搜索结果 (${filteredRdq.length})` : (rdqMajorTab === "全部" ? "全部现场问答题" : `${rdqMajorTab}相关现场问答题`)}
          </p>
          <div className="flex-1 overflow-y-auto pr-1">
            {filteredRdq.length === 0 ? (
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
                          <Badge variant="secondary" className="text-[10px]">{q.major || "-"}</Badge>
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
        <div className="w-2/5 border rounded-xl p-3 flex flex-col min-h-0">
          <p className="text-sm font-medium mb-3 text-gray-700">已配置现场问答题 ({selectedRdqList.length})</p>
          <div className="flex-1 overflow-y-auto">
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
                    <Badge variant="outline" className="text-[9px] mt-1 font-normal px-1 py-0 h-4">{q.major || "通用"}</Badge>
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
            <Select value={rdqDrawMode} onValueChange={v => setRdqDrawMode(v as "random" | "manual")}>
              <SelectTrigger className="mt-1 text-sm h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="random">系统随机分配</SelectItem>
                <SelectItem value="manual">老师手动选择</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-gray-500">抽题数量</Label>
            <Input type="number" value={rdqDrawCount} onChange={e => setRdqDrawCount(Math.max(1, parseInt(e.target.value) || 1))} className="mt-1 text-sm" min={1} />
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
              onChange={e => setSubmitFormatDesc(e.target.value)}
              onBlur={() => updateState({ methodResourceConfigs: { ...state.methodResourceConfigs, random_draw: { ...rdCfg, submitFormatDesc } } })}
              placeholder="请用一句话说明学生需要准备的材料要求..."
              rows={2}
              className="text-sm"
            />
          </div>
          <div>
            <Label className="text-xs text-gray-500 mb-1.5">评审场地/环境资源准备</Label>
            <Textarea
              value={venueResources}
              onChange={e => setVenueResources(e.target.value)}
              onBlur={() => updateState({ methodResourceConfigs: { ...state.methodResourceConfigs, random_draw: { ...rdCfg, venueResources } } })}
              placeholder="请描述现场问答所需的场地、设备及环境资源准备要求..."
              rows={2}
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
              <Select value={newRdqForm.major} onValueChange={v => setNewRdqForm({ ...newRdqForm, major: v })}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="选择适用专业" /></SelectTrigger>
                <SelectContent>
                  {rdqMajorOptions.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
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
            const q = state.randomDrawCustomQuestions.find(x => x.id === selectedRdqForDetail)
            if (!q) return null
            return (
              <div className="space-y-4 py-2">
                <div>
                  <Label className="text-xs text-gray-500">题目名称</Label>
                  <p className="text-sm font-medium mt-1">{q.name}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">适用专业</Label>
                  <Badge variant="secondary" className="text-[10px] mt-1">{q.major || "通用"}</Badge>
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

// ============ Edit Card Dialog ============

function EditCardDialog({
  allTasks,
  taskId,
  cardType,
  task,
  state,
  updateState,
  updateTask,
  allTaskStates,
  updateAnyState,
  onClose,
  positionId,
  toast,
  positionAbilityBindings,
  userNameMap,
  tenantId,
  orgNodeId,
}: {
  allTasks: Task[]
  taskId: string
  cardType: CardType
  task: Task
  state: TaskState
  updateState: (u: Partial<TaskState>) => void
  updateTask: (u: Partial<Task>) => void
  allTaskStates: Record<string, TaskState>
  updateAnyState: (id: string, u: Partial<TaskState>) => void
  onClose: () => void
  positionId?: string
  toast: (opts: { title?: string; description?: string; variant?: "default" | "destructive" }) => void
  positionAbilityBindings: any[]
  userNameMap: Record<string, string>
  tenantId?: string
  orgNodeId?: string
}) {
  const config = cardConfigs.find(c => c.type === cardType)!
  const [localTask, setLocalTask] = useState({ name: task.name, type: task.taskType, difficulty: task.difficulty, hours: task.estimatedHours, background: task.background })

  // For knowledge / ability "create new"
  const [showAddKnowledge, setShowAddKnowledge] = useState(false)
  const [newKnowledgeName, setNewKnowledgeName] = useState("")
  const [newKnowledgeDesc, setNewKnowledgeDesc] = useState("")
  const [newKnowledgeCategory, setNewKnowledgeCategory] = useState("通用")

  const [showAddAbility, setShowAddAbility] = useState(false)
  const [newAbilityName, setNewAbilityName] = useState("")
  const [newAbilityDesc, setNewAbilityDesc] = useState("")
  const [newAbilityCategory, setNewAbilityCategory] = useState("通用")

  // For evaluation full-screen dialog
  const [evalDialogOpen, setEvalDialogOpen] = useState(false)

  // For scoring config
  const [selectedGradeTaskId, setSelectedGradeTaskId] = useState(taskId)

  // For resources filter
  const [resType, setResType] = useState("all")

  // For ability search
  const [abilitySearch, setAbilitySearch] = useState("")
  const [abilityDetailOpen, setAbilityDetailOpen] = useState(false)
  const [selectedAbilityForDetail, setSelectedAbilityForDetail] = useState<string | null>(null)
  const [expandedDomains, setExpandedDomains] = useState<Record<string, boolean>>({})

  // For knowledge
  const [kpSearch, setKpSearch] = useState("")
  const [kpDetailOpen, setKpDetailOpen] = useState(false)
  const [selectedKpForDetail, setSelectedKpForDetail] = useState<string | null>(null)
  const [kpActionOpen, setKpActionOpen] = useState(false)
  const [kpActionMode, setKpActionMode] = useState<"add" | "clone" | "edit" | null>(null)
  const [kpActionTarget, setKpActionTarget] = useState<(typeof knowledgePoints)[0] | null>(null)
  const [newKpForm, setNewKpForm] = useState({ name: "", description: "", code: "", granularLessons: [] as string[] })
  const [glSelectOpen, setGlSelectOpen] = useState(false)
  const [glSelectTargetKp, setGlSelectTargetKp] = useState<string | null>(null)
  const [glSearch, setGlSearch] = useState("")

  // Determine if a knowledge point is reference (original library) or custom (added/cloned)
  const isReferenceKp = (kpId: string) => !customKnowledgePointIds.has(kpId)

  // For random draw custom questions (现场问答题)
  const [rdqSearch, setRdqSearch] = useState("")
  const [rdqActionOpen, setRdqActionOpen] = useState(false)
  const [rdqActionMode, setRdqActionMode] = useState<"add" | "edit" | null>(null)
  const [rdqActionTarget, setRdqActionTarget] = useState<{ id: string; name: string; description: string; answer: string } | null>(null)
  const [newRdqForm, setNewRdqForm] = useState({ name: "", description: "", answer: "", major: "" })
  const [rdqDetailOpen, setRdqDetailOpen] = useState(false)
  const [selectedRdqForDetail, setSelectedRdqForDetail] = useState<string | null>(null)

  // For resources search & upload
  const [resSearchName, setResSearchName] = useState("")
  const [resSearchProvider, setResSearchProvider] = useState("")
  const [showUploadRes, setShowUploadRes] = useState(false)
  const [newResName, setNewResName] = useState("")
  const [newResType, setNewResType] = useState("document")
  const [newResUrl, setNewResUrl] = useState("")
  const [newResDescription, setNewResDescription] = useState("")
  const [newResAddress, setNewResAddress] = useState("")
  const [newResOpenTime, setNewResOpenTime] = useState("")
  const [newResCapacity, setNewResCapacity] = useState("")
  const [newResContact, setNewResContact] = useState("")
  const [newResLocation, setNewResLocation] = useState("")
  const [newResQuantity, setNewResQuantity] = useState("")
  const [newResVersion, setNewResVersion] = useState("")
  const [newResLicense, setNewResLicense] = useState("")
  const [newResFile, setNewResFile] = useState<File | null>(null)
  const [newResUploading, setNewResUploading] = useState(false)
  const [showUploadTypePicker, setShowUploadTypePicker] = useState(false)
  const [previewRes, setPreviewRes] = useState<any | null>(null)

  // For question bank config
  const [questionTab, setQuestionTab] = useState<"my" | "collab" | "public">("my")
  const [questionSearch, setQuestionSearch] = useState("")
  const [showAddQuestion, setShowAddQuestion] = useState(false)
  const [newQuestionType, setNewQuestionType] = useState<"single" | "multiple" | "judgment" | "short_answer" | "essay" | "fill_blank">("single")
  const [newQuestionName, setNewQuestionName] = useState("")
  const [newQuestionContent, setNewQuestionContent] = useState("")
  const [newQuestionDifficulty, setNewQuestionDifficulty] = useState<"easy" | "medium" | "hard">("easy")
  const [newQuestionScore, setNewQuestionScore] = useState(10)
  const [newQuestionOptions, setNewQuestionOptions] = useState(["", "", "", ""])
  const [newQuestionAnswer, setNewQuestionAnswer] = useState("")
  const [newQuestionMultipleAnswer, setNewQuestionMultipleAnswer] = useState<string[]>([])
  const [newQuestionJudgmentAnswer, setNewQuestionJudgmentAnswer] = useState<"true" | "false">("true")
  const [newQuestionBank, setNewQuestionBank] = useState("draft")
  const [questionDetailOpen, setQuestionDetailOpen] = useState(false)
  const [selectedQuestionForDetail, setSelectedQuestionForDetail] = useState<string | null>(null)

  // For assessment config
  const [assessActiveTab, setAssessActiveTab] = useState<string | null>(state.evaluationMethods[0] || null)

  // For method dialog view mode (scheme list / scheme edit) — persisted across remounts
  const [methodDialogViews, setMethodDialogViews] = useState<Record<string, "list" | "edit" | "template">>({})
  const [newPointName, setNewPointName] = useState("")

  // Score rule item type
  interface ScoreRuleItem {
    id: string
    name: string
    desc: string
    rule: string
    weight: number
  }

  // Rubric library — shared across all methods
  type RubricScheme = { id: string; name: string; types: EvalSubType[]; desc: string; points: EvalPoint[]; mode: "rubric" | "score_rule"; scoreRuleItems?: ScoreRuleItem[] }
  const [rubricLibrary, setRubricLibrary] = useState<RubricScheme[]>([])
  const [editingRubricId, setEditingRubricId] = useState<string | null>(null)

  // For evaluation rules
  const [erQSearch, setErQSearch] = useState("")
  const [erPSearch, setErPSearch] = useState("")
  const [erKpSearch, setErKpSearch] = useState("")
  const [erAbSearch, setErAbSearch] = useState("")

  // Dialog states for evaluation rules card layout
  const [erDialogOpen, setErDialogOpen] = useState<"object" | "subject" | "resource" | "method" | null>(null)
  const [erDialogMethod, setErDialogMethod] = useState<string | null>(null)

  // For rubric knowledge/ability multi-select dialogs
  const [rubricKpDialogOpen, setRubricKpDialogOpen] = useState(false)
  const [rubricKpSearch, setRubricKpSearch] = useState("")
  const [rubricKpTargetPointId, setRubricKpTargetPointId] = useState<string | null>(null)
  const [rubricKpTargetField, setRubricKpTargetField] = useState<string | null>(null)
  const [rubricAbDialogOpen, setRubricAbDialogOpen] = useState(false)
  const [rubricAbSearch, setRubricAbSearch] = useState("")
  const [rubricAbTargetPointId, setRubricAbTargetPointId] = useState<string | null>(null)
  const [rubricAbTargetField, setRubricAbTargetField] = useState<string | null>(null)

  // Mock resource config states
  const [mockResRandomDraw, setMockResRandomDraw] = useState({ questionCount: 5, difficulty: "mixed", types: { single: true, multiple: true, judge: true }, autoDraw: true, submitFormatDesc: "", venueResources: "" })
  const [selectedPaperForDetail, setSelectedPaperForDetail] = useState<string | null>(null)
  const [paperDetailOpen, setPaperDetailOpen] = useState(false)
  const [showCreatePaper, setShowCreatePaper] = useState(false)
  const [configPaperId, setConfigPaperId] = useState<string | null>(null)
  const [configSelectedIds, setConfigSelectedIds] = useState<string[]>([])
  const [newPaperName, setNewPaperName] = useState("")
  const [newPaperQuestionCount, setNewPaperQuestionCount] = useState(10)
  const [newPaperTotalScore, setNewPaperTotalScore] = useState(100)

  const [mockResReview, setMockResReview] = useState({ materialType: "project_report", submitFormatDesc: "请提交 PDF 格式的项目报告，包含完整的项目背景、实现方案、测试结果和总结反思。", deadlineDays: 7, allowResubmit: false, venueResources: "多媒体教室（容纳30人）、投影仪、白板、评委席桌椅、计时器、签到表、评分表及文具。", requiresMaterial: true })
  const [mockResOutcome, setMockResOutcome] = useState({ materialType: "project_report", submitFormatDesc: "请提交 PDF 格式的成果材料，包含完整的项目背景、实现方案、测试结果和总结反思。", deadlineDays: 7, allowResubmit: false, venueResources: "多媒体教室（容纳30人）、投影仪、白板、评委席桌椅、计时器、签到表、评分表及文具。", requiresMaterial: true })
  const [mockResHomework, setMockResHomework] = useState({ materialType: "homework_file", submitFormatDesc: "请提交 PDF 或 DOCX 格式的作业文件。", deadlineDays: 7, allowResubmit: false, venueResources: "", requiresMaterial: true })
  const [reviewSteps, setReviewSteps] = useState([
    { id: "rs-1", label: "初评", desc: "由指导教师进行第一轮评审", enabled: true, subjectType: "teacher" as string | null, weight: 40 },
    { id: "rs-2", label: "复评", desc: "由专家组进行第二轮复核", enabled: false, subjectType: null as string | null, weight: 30 },
    { id: "rs-3", label: "终评", desc: "答辩委员会最终评定", enabled: false, subjectType: null as string | null, weight: 30 },
  ])
  const [editingReviewStepId, setEditingReviewStepId] = useState<string | null>(null)
  const [editingStepLabel, setEditingStepLabel] = useState("")
  const [editingStepDesc, setEditingStepDesc] = useState("")
  const [showAddStep, setShowAddStep] = useState(false)
  const [newStepLabel, setNewStepLabel] = useState("")
  const [newStepDesc, setNewStepDesc] = useState("")
  const [newStepSubjectType, setNewStepSubjectType] = useState("")

  const ensureTempExam = async (mk: "question_bank" | "quiz", currentCfg: any): Promise<string | null> => {
    const questionIds = mk === "question_bank" ? state.questionBankQuestions : state.quizQuestions
    const existingExamId = currentCfg?.examId
    const questionScores = currentCfg?.questionScores || {}
    const existingQuestionIds = currentCfg?.examQuestionIds || []
    if (!questionIds || questionIds.length === 0) {
      if (existingExamId) {
        try {
          const usages = await examUsageApi.list({ examId: existingExamId })
          for (const u of usages.items || []) await examUsageApi.delete(u.id)
          await examApi.delete(existingExamId)
        } catch { /* ignore */ }
      }
      return null
    }
    const sortedNew = [...questionIds].sort().join(",")
    const sortedOld = [...existingQuestionIds].sort().join(",")
    if (existingExamId && sortedNew === sortedOld) return existingExamId
    if (existingExamId) {
      try {
        const usages = await examUsageApi.list({ examId: existingExamId })
        for (const u of usages.items || []) await examUsageApi.delete(u.id)
        await examApi.delete(existingExamId)
      } catch { /* ignore */ }
    }
    const label = mk === "question_bank" ? "题库" : "随堂测"
    const exam = await examApi.create({ name: `${task.name}-${label}临时试卷`, duration: currentCfg?.timeLimit || 90 } as any)
    for (const qid of questionIds) {
      await examApi.addQuestion(exam.id, qid, questionScores[qid] || 10)
    }
    await examApi.publish(exam.id)
    await examUsageApi.create({ examId: exam.id, name: `${exam.name} 默认安排`, targetType: "public", targetIds: [taskId] } as any)
    return exam.id
  }

  const handleSave = async () => {
    if (cardType === "info") {
      updateTask({ name: localTask.name, taskType: localTask.type as "assessment"|"training", difficulty: localTask.difficulty as 1|2|3|4|5, estimatedHours: localTask.hours, background: localTask.background })
    } else if (cardType === "evaluationRules") {
      const toTaskEvalPoint = (ep: EvalPoint): import("@/lib/mock-data").TaskEvalPoint => {
        const gmMax = ep.gradeMapping && ep.gradeMapping.length > 0
          ? Math.max(...ep.gradeMapping.map(g => g.maxScore))
          : 100
        return {
          id: ep.id,
          name: ep.name,
          desc: ep.desc,
          weight: ep.weight || 0,
          maxScore: ep.weight || gmMax,
          scoringMethod: ep.scoringMethod,
          gradeMapping: ep.gradeMapping,
          subType: ep.subType,
          types: ep.types,
          knowledgePointIds: ep.knowledgePointIds,
          abilityPointIds: ep.abilityPointIds,
        }
      }
      updateTask({
        evalPoints: {
          randomDraw: state.randomDrawEvalPoints.map(toTaskEvalPoint),
          review: state.reviewEvalPoints.map(toTaskEvalPoint),
          paper: state.paperEvalPoints.map(toTaskEvalPoint),
          questionBank: state.questionBankEvalPoints.map(toTaskEvalPoint),
        },
        reviewSteps: reviewSteps.filter(s => s.enabled).map(s => ({
          id: s.id,
          label: s.label,
          desc: s.desc,
          enabled: s.enabled,
          subjectType: s.subjectType,
          weight: s.weight,
        })),
      })
      // Sync mock resource configs to TaskState before saving
      const updatedRC = { ...state.methodResourceConfigs }
      state.evaluationMethods.forEach(mk => {
        if (mk === "random_draw") updatedRC[mk] = { ...mockResRandomDraw, ...updatedRC[mk] }
        if (mk === "review") updatedRC[mk] = { ...updatedRC[mk], ...mockResReview }
        if (mk === "outcome") updatedRC[mk] = { ...updatedRC[mk], ...mockResOutcome }
        if (mk === "homework") updatedRC[mk] = { ...updatedRC[mk], ...mockResHomework }
      })
      updateState({ methodResourceConfigs: updatedRC })
      // Persist evaluation methods (including resource config) to backend immediately
      let methodsInput = taskStateToMethodsInput({ ...state, methodResourceConfigs: updatedRC })
      if (methodsInput.length > 0) {
        try {
          await taskEvaluationApi.saveMethods(taskId, { methods: methodsInput })
        } catch (err: any) {
          toast({ variant: "destructive", title: "评价规则保存失败", description: err.message })
          return
        }
      }
      // Generate temp exams for question_bank / quiz and persist examId back
      const tempExamMethods = methodsInput.filter(m => m.methodKey === "question_bank" || m.methodKey === "quiz")
      if (tempExamMethods.length > 0) {
        for (const m of tempExamMethods) {
          const mk = m.methodKey as "question_bank" | "quiz"
          const examId = await ensureTempExam(mk, updatedRC[mk])
          if (examId) {
            updatedRC[mk] = { ...updatedRC[mk], examId, examQuestionIds: mk === "question_bank" ? state.questionBankQuestions : state.quizQuestions }
          } else {
            const { examId: _, examQuestionIds: __, ...rest } = updatedRC[mk] || {}
            updatedRC[mk] = rest
          }
        }
        updateState({ methodResourceConfigs: updatedRC })
        methodsInput = taskStateToMethodsInput({ ...state, methodResourceConfigs: updatedRC })
        try {
          await taskEvaluationApi.saveMethods(taskId, { methods: methodsInput })
        } catch (err: any) {
          toast({ variant: "destructive", title: "临时考试保存失败", description: err.message })
          return
        }
      }
    }
    onClose()
  }

  const handleAddKnowledge = () => {
    if (!newKnowledgeName.trim()) return
    const newId = generateUUID()
    customKnowledgePointIds.add(newId)
    knowledgePoints.push({ id: newId, name: newKnowledgeName.trim(), description: newKnowledgeDesc.trim(), category: newKnowledgeCategory })
    updateState({ knowledgePoints: [...state.knowledgePoints, newId] })
    setNewKnowledgeName("")
    setNewKnowledgeDesc("")
    setShowAddKnowledge(false)
  }

  const handleAddAbility = () => {
    if (!newAbilityName.trim()) return
    const newId = generateUUID()
    customAbilityPointIds.add(newId)
    abilityPoints.push({ id: newId, name: newAbilityName.trim(), description: newAbilityDesc.trim(), category: newAbilityCategory })
    updateState({ abilityPoints: [...state.abilityPoints, newId] })
    setNewAbilityName("")
    setNewAbilityDesc("")
    setShowAddAbility(false)
  }

  const validateResourceFile = (file: File, type: string): string | null => {
    if (file.size > RESOURCE_MAX_FILE_SIZE) {
      return "文件大小超过 100MB"
    }
    const allowed = resourceTypeExtensionMap[type] || []
    if (allowed.length === 0) return null
    const ext = file.name.split(".").pop()?.toLowerCase() || ""
    if (!allowed.includes(ext)) {
      return `不支持的文件格式，请上传 ${allowed.map(e => `.${e}`).join("、")} 文件`
    }
    return null
  }

  const handleUploadResource = async () => {
    if (!newResName.trim()) return

    const fileTypes = ["document", "spreadsheet", "image", "audio", "video", "archive", "other", "software"]
    const isFileType = fileTypes.includes(newResType)
    let fileUrl = newResUrl.trim()
    let uploadedSize: number | undefined

    if (isFileType && newResFile) {
      const err = validateResourceFile(newResFile, newResType)
      if (err) {
        toast({ variant: "destructive", title: "文件校验失败", description: err })
        return
      }
      setNewResUploading(true)
      try {
        const res = await fileApi.upload(newResFile)
        fileUrl = res.url
        uploadedSize = res.size
      } catch (err: any) {
        toast({ variant: "destructive", title: "上传失败", description: err.message })
        return
      } finally {
        setNewResUploading(false)
      }
    }

    if (newResType === "link" && !fileUrl) {
      toast({ variant: "destructive", title: "请填写链接地址" })
      return
    }

    const newId = `lr-upload-${Date.now()}`
    let extraData: Record<string, any> = {}
    switch (newResType) {
      case "link":
        extraData = { url: fileUrl, description: newResDescription.trim() }
        break
      case "venue":
        extraData = { address: newResAddress.trim(), openTime: newResOpenTime.trim(), capacity: newResCapacity.trim(), contact: newResContact.trim(), description: newResDescription.trim() }
        break
      case "facility":
        extraData = { location: newResLocation.trim(), quantity: newResQuantity.trim(), description: newResDescription.trim() }
        break
      case "software":
        extraData = { version: newResVersion.trim(), url: fileUrl, license: newResLicense.trim(), description: newResDescription.trim() }
        break
      default:
        extraData = { description: newResDescription.trim() }
        break
    }

    const thumbnail = newResType === "image" && fileUrl ? fileUrl : "/placeholder.svg"
    const newRes = {
      id: newId,
      name: newResName.trim(),
      type: newResType as any,
      url: fileUrl,
      description: newResDescription.trim(),
      knowledgePoints: [],
      size: uploadedSize !== undefined ? `${uploadedSize}` : undefined,
      uploadedAt: new Date().toISOString().slice(0, 10),
      uploadedBy: "当前用户",
      thumbnail,
      extraData,
      ...extraData,
    }
    customResourceIds.add(newId)
    learningResources.push(newRes as any)
    updateState({ resources: [...state.resources, newId] })
    setNewResName("")
    setNewResType("document")
    setNewResUrl("")
    setNewResFile(null)
    setNewResUploading(false)
    setNewResDescription("")
    setNewResAddress("")
    setNewResOpenTime("")
    setNewResCapacity("")
    setNewResContact("")
    setNewResLocation("")
    setNewResQuantity("")
    setNewResVersion("")
    setNewResLicense("")
    setShowUploadRes(false)
    toast({ title: "资源已上传并选中" })
  }

  // Rich text editor mock toolbar items
  const toolbarItems = [
    [{ icon: <Heading1 className="h-4 w-4" />, label: "H1" }, { icon: <Heading2 className="h-4 w-4" />, label: "H2" }],
    [{ icon: <Type className="h-4 w-4" />, label: "正文" }],
    [{ icon: <b className="text-xs">B</b>, label: "加粗" }, { icon: <i className="text-xs">I</i>, label: "斜体" }, { icon: <u className="text-xs">U</u>, label: "下划线" }, { icon: <Strikethrough className="h-4 w-4" />, label: "删除线" }],
    [{ icon: <AlignLeft className="h-4 w-4" />, label: "左对齐" }, { icon: <AlignCenter className="h-4 w-4" />, label: "居中" }, { icon: <AlignRight className="h-4 w-4" />, label: "右对齐" }],
    [{ icon: <List className="h-4 w-4" />, label: "无序列表" }, { icon: <ListOrdered className="h-4 w-4" />, label: "有序列表" }],
    [{ icon: <Quote className="h-4 w-4" />, label: "引用" }, { icon: <Code className="h-4 w-4" />, label: "代码" }],
    [{ icon: <LinkIcon className="h-4 w-4" />, label: "链接" }, { icon: <Image className="h-4 w-4" />, label: "图片" }, { icon: <Video className="h-4 w-4" />, label: "视频" }],
    [{ icon: <Table className="h-4 w-4" />, label: "表格" }, { icon: <Minus className="h-4 w-4" />, label: "分割线" }],
    [{ icon: <Palette className="h-4 w-4" />, label: "字体颜色" }, { icon: <Sparkles className="h-4 w-4" />, label: "背景色" }],
  ]

  const renderContent = () => {
    switch (cardType) {
      case "info":
        return (
          <div className="space-y-4">
            <div><Label>任务名称</Label><Input value={localTask.name} onChange={e => setLocalTask({ ...localTask, name: e.target.value })} className="mt-1.5" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>任务类型</Label><Select value={localTask.type} onValueChange={v => setLocalTask({ ...localTask, type: v as "assessment"|"training" })}><SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="training">训练</SelectItem><SelectItem value="assessment">考核</SelectItem></SelectContent></Select></div>
              <div>
                <div className="flex items-center gap-2">
                  <Label>预估学时</Label>
                  <span className="text-xs text-gray-400">学生完成任务的预估时长</span>
                </div>
                <Input type="number" value={localTask.hours} onChange={e => setLocalTask({ ...localTask, hours: +e.target.value })} className="mt-1.5" />
              </div>
            </div>
            <div><Label>难度</Label><div className="flex gap-1 mt-1.5">{([1,2,3,4,5] as const).map(n => <button key={n} onClick={() => setLocalTask({ ...localTask, difficulty: n })}><Star className={cn("h-6 w-6", n <= localTask.difficulty ? "fill-amber-400 text-amber-400" : "text-gray-200")} /></button>)}</div></div>
            <div><Label>背景</Label><Textarea value={localTask.background} onChange={e => setLocalTask({ ...localTask, background: e.target.value })} className="mt-1.5" rows={3} /></div>
          </div>
        )

      case "description": {
        const [descMode, setDescMode] = useState<"rich_text" | "pdf">("rich_text")
        const [pdfUploading, setPdfUploading] = useState(false)
        const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false)
        const pdfInputRef = useRef<HTMLInputElement>(null)

        const pdfFileName = state.descriptionPdf ? state.descriptionPdf.split('/').pop() || state.descriptionPdf : ""

        const handlePdfUpload = async (file: File) => {
          if (!file) return
          if (file.type !== "application/pdf") {
            toast({ variant: "destructive", title: "请上传 PDF 文件" })
            return
          }
          if (file.size > 20 * 1024 * 1024) {
            toast({ variant: "destructive", title: "文件大小超过 20MB" })
            return
          }
          setPdfUploading(true)
          try {
            const res = await fileApi.upload(file)
            updateState({ descriptionPdf: res.url })
            toast({ title: "上传成功" })
          } catch (err: any) {
            toast({ variant: "destructive", title: "上传失败", description: err.message })
          } finally {
            setPdfUploading(false)
          }
        }

        const onPdfDrop: React.DragEventHandler<HTMLDivElement> = (e) => {
          e.preventDefault()
          e.stopPropagation()
          const file = e.dataTransfer.files?.[0]
          if (file) handlePdfUpload(file)
        }

        return (
          <div className="space-y-3 h-full flex flex-col">
            <Tabs value={descMode} onValueChange={v => setDescMode(v as "rich_text" | "pdf")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="rich_text">富文本编辑</TabsTrigger>
                <TabsTrigger value="pdf">上传任务说明书</TabsTrigger>
              </TabsList>
            </Tabs>
            {descMode === "rich_text" ? (
              <div className="flex-1 flex flex-col min-h-0">
                <p className="text-xs text-gray-500 mb-2">可编写详细的操作手册，支持图文混排</p>
                <div className="border rounded-lg overflow-hidden flex-1 flex flex-col min-h-[450px]">
                  {/* Mock Toolbar */}
                  <div className="bg-gray-50 border-b px-3 py-2 flex flex-wrap gap-1">
                    {toolbarItems.map((group, gi) => (
                      <div key={gi} className="flex items-center gap-0.5 mr-2">
                        {group.map((item, ii) => (
                          <Button key={ii} variant="ghost" size="sm" className="h-8 w-8 p-0 text-gray-600 hover:text-primary hover:bg-primary/5" title={item.label}>
                            {item.icon}
                          </Button>
                        ))}
                      </div>
                    ))}
                  </div>
                  {/* Mock Editor Area */}
                  <div className="p-4 flex-1 bg-white">
                    <Textarea
                      value={state.description}
                      onChange={e => updateState({ description: e.target.value })}
                      placeholder={`任务描述

你需要完成 [具体任务]。该任务基于 [背景/前提]，要求你 [核心动作]。执行时请注意 [关键约束]，确保理解需求后再开始。

任务目标

• 核心目标：[一句话概括最终成果]
• 目标一：[具体子目标]
• 目标二：[具体子目标]
• 目标三：[具体子目标]
• 成功标准：[任务完成的具体标志]

任务结果

请提交以下内容：

• 主交付物：[如报告/代码/方案]
• 格式要求：[如 Markdown/JSON/纯文本]
• 附属说明：[假设、来源、取舍等]
• 篇幅要求：[如不少于 500 字/代码 100 行内]

测评要求

• 准确性（30%）：内容正确，逻辑清晰，来源可靠
• 完整性（25%）：覆盖所有子目标，无遗漏
• 清晰度（20%）：结构分明，表达简洁
• 实用性（15%）：结论可操作，建议可落地
• 规范性（10%）：符合格式，术语统一，无明显错误

一票否决项：若出现 [如抄袭/泄密/核心事实错误]，视为未通过。`}
                      className="border-0 min-h-full w-full focus-visible:ring-0 resize-none text-sm leading-relaxed"
                    />
                  </div>
                  {/* Mock Status Bar */}
                  <div className="bg-gray-50 border-t px-3 py-1.5 flex items-center justify-between text-xs text-gray-400">
                    <span>纯文本模式</span>
                    <span>{state.description.length} 字符</span>
                  </div>
                </div>
                {state.description.includes('<img') || state.description.includes('<video') ? (
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 text-sm text-blue-700 flex items-center gap-2 mt-2">
                    <Image className="h-4 w-4" />
                    检测到已插入多媒体内容
                  </div>
                ) : null}
              </div>
            ) : (
              <div
                className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-xl p-8 space-y-4 cursor-pointer hover:border-primary/30 hover:bg-gray-50/50 transition-colors"
                onClick={() => !pdfUploading && pdfInputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); e.stopPropagation() }}
                onDrop={onPdfDrop}
              >
                <input
                  ref={pdfInputRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0]
                    if (file) handlePdfUpload(file)
                    e.target.value = ""
                  }}
                />
                {state.descriptionPdf ? (
                  <div className="text-center space-y-3 pointer-events-none">
                    <div className="w-24 h-32 bg-red-50 border border-red-200 rounded-lg flex flex-col items-center justify-center mx-auto">
                      <File className="h-10 w-10 text-red-500 mb-2" />
                      <span className="text-[10px] text-red-600 font-medium">PDF</span>
                    </div>
                    <p className="text-sm font-medium text-gray-700 max-w-xs truncate">{pdfFileName}</p>
                  </div>
                ) : (
                  <>
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center">
                      {pdfUploading ? <Loader2 className="h-8 w-8 text-gray-400 animate-spin" /> : <Upload className="h-8 w-8 text-gray-400" />}
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium text-gray-700">点击或拖拽上传任务说明书</p>
                      <p className="text-xs text-gray-500 mt-1">支持 PDF 格式，最大 20MB</p>
                    </div>
                  </>
                )}
                {state.descriptionPdf && (
                  <div className="flex items-center gap-2 pointer-events-auto" onClick={e => e.stopPropagation()}>
                    <Button variant="outline" size="sm" onClick={() => setPdfPreviewOpen(true)}>
                      <Eye className="h-4 w-4 mr-1" />预览
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <a href={state.descriptionPdf} download={pdfFileName} target="_blank" rel="noreferrer">
                        <Download className="h-4 w-4 mr-1" />下载
                      </a>
                    </Button>
                    <Button variant="outline" size="sm" disabled={pdfUploading} onClick={() => pdfInputRef.current?.click()}>
                      <Upload className="h-4 w-4 mr-1" />重新上传
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => updateState({ descriptionPdf: null })}>
                      <Trash2 className="h-4 w-4 mr-1" />移除文件
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* PDF Preview Dialog */}
            <Dialog open={pdfPreviewOpen} onOpenChange={setPdfPreviewOpen}>
              <DialogContent className="sm:max-w-4xl h-[80vh] flex flex-col">
                <DialogHeader className="shrink-0">
                  <DialogTitle className="flex items-center gap-2">
                    <File className="h-5 w-5 text-red-500" />
                    <span className="truncate">{pdfFileName || "任务说明书预览"}</span>
                  </DialogTitle>
                </DialogHeader>
                <div className="flex-1 min-h-0 border rounded-lg overflow-hidden bg-gray-50">
                  {state.descriptionPdf ? (
                    <iframe
                      src={state.descriptionPdf}
                      title={pdfFileName || "PDF 预览"}
                      className="w-full h-full"
                    />
                  ) : (
                    <div className="h-full flex items-center justify-center text-gray-400">暂无文件</div>
                  )}
                </div>
                <DialogFooter className="shrink-0 gap-2">
                  <Button variant="outline" onClick={() => setPdfPreviewOpen(false)}>关闭</Button>
                  <Button asChild>
                    <a href={state.descriptionPdf || undefined} download={pdfFileName} target="_blank" rel="noreferrer">
                      <Download className="h-4 w-4 mr-1" />下载
                    </a>
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )
      }

      case "knowledge": {
        const filteredKp = knowledgePoints.filter(k => !kpSearch || (k.name || "").includes(kpSearch) || (k.description || "").includes(kpSearch) || (k.code || "").includes(kpSearch))
        const hasResults = kpSearch ? filteredKp.length > 0 : false

        const generateKpCode = () => `KP-${Date.now().toString().slice(-6)}`

        const handleReferenceKp = (kpId: string) => {
          if (state.knowledgePoints.includes(kpId)) return
          updateState({ knowledgePoints: [...state.knowledgePoints, kpId] })
        }

        const handleRemoveKp = (kpId: string) => {
          updateState({ knowledgePoints: state.knowledgePoints.filter(x => x !== kpId) })
        }

        const openAddKp = () => {
          setNewKpForm({ name: kpSearch, description: "", code: generateKpCode(), granularLessons: [] })
          setKpActionMode("add")
          setKpActionTarget(null)
          setKpActionOpen(true)
        }

        const openCloneKp = (kp: (typeof knowledgePoints)[0]) => {
          setNewKpForm({ name: `${kp.name}（克隆）`, description: kp.description, code: generateKpCode(), granularLessons: kp.granularLessons || [] })
          setKpActionMode("clone")
          setKpActionTarget(kp)
          setKpActionOpen(true)
        }

        const openEditKp = (kp: (typeof knowledgePoints)[0]) => {
          setNewKpForm({ name: kp.name, description: kp.description, code: kp.code || generateKpCode(), granularLessons: kp.granularLessons || [] })
          setKpActionMode("edit")
          setKpActionTarget(kp)
          setKpActionOpen(true)
        }

        const handleSaveKp = () => {
          if (!newKpForm.name.trim()) return
          if (kpActionMode === "edit" && kpActionTarget) {
            // Update existing custom knowledge point in place
            const kp = knowledgePoints.find(k => k.id === kpActionTarget.id)
            if (kp) {
              kp.name = newKpForm.name.trim()
              kp.description = newKpForm.description.trim()
              kp.code = newKpForm.code
              kp.granularLessons = newKpForm.granularLessons
            }
            setKpActionOpen(false)
            return
          }
          const newId = generateUUID()
          const newKp = {
            id: newId,
            name: newKpForm.name.trim(),
            description: newKpForm.description.trim(),
            code: newKpForm.code,
            granularLessons: newKpForm.granularLessons,
          }
          knowledgePoints.push(newKp as any)
          customKnowledgePointIds.add(newId)
          updateState({ knowledgePoints: [...state.knowledgePoints, newId] })
          setKpActionOpen(false)
          setKpSearch("")
        }

        const openGlSelect = (kpId: string) => {
          setGlSelectTargetKp(kpId)
          setGlSearch("")
          setGlSelectOpen(true)
        }

        const handleToggleGlForKp = (glId: string) => {
          const kp = knowledgePoints.find(k => k.id === glSelectTargetKp)
          if (!kp) return
          const current = kp.granularLessons || []
          const updated = current.includes(glId) ? current.filter((x: any) => x !== glId) : [...current, glId]
          kp.granularLessons = updated
          updateState({ knowledgePoints: [...state.knowledgePoints] })
        }

        const detailKp = selectedKpForDetail ? knowledgePoints.find(k => k.id === selectedKpForDetail) : null
        const detailGranularLessons = detailKp?.granularLessons?.map((gid: any) => granularLessons.find((g: any) => g.id === gid)).filter(Boolean) || []

        const glFiltered = granularLessons.filter(g => !glSearch || g.name.includes(glSearch) || (g.code && g.code.includes(glSearch)))
        const glTargetKp = glSelectTargetKp ? knowledgePoints.find(k => k.id === glSelectTargetKp) : null
        const glSelectedIds = glTargetKp?.granularLessons || []

        return (
          <div className="h-full flex flex-col">
            {/* Search Bar + Add Button */}
            <div className="flex items-center gap-3 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  value={kpSearch}
                  onChange={e => setKpSearch(e.target.value)}
                  placeholder="搜索知识点名称、描述或编码..."
                  className="pl-9"
                />
              </div>
              <Button onClick={openAddKp}>
                <Plus className="h-4 w-4 mr-1" />新增知识点
              </Button>
            </div>

            <div className="flex gap-4 flex-1 min-h-0">
              {/* Left: Search Results */}
              <div className="w-3/5 flex flex-col min-h-0 border rounded-xl p-3">
                <p className="text-sm font-medium mb-3 text-gray-700">
                  {kpSearch ? `搜索结果 (${filteredKp.length})` : "全部知识点"}
                </p>
                <div className="flex-1 overflow-y-auto pr-1">
                  {!kpSearch && filteredKp.length === 0 && (
                    <div className="text-center text-gray-400 py-8">
                      <Lightbulb className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">请输入关键词搜索知识点</p>
                    </div>
                  )}
                  {kpSearch && !hasResults && (
                    <div className="p-6 text-center text-gray-500 text-sm border border-dashed rounded-lg">
                      <p className="mb-2">未找到 "{kpSearch}" 相关的知识点</p>
                      <Button variant="outline" size="sm" onClick={openAddKp}>
                        <Plus className="h-3 w-3 mr-1" />新增此知识点
                      </Button>
                    </div>
                  )}
                  {filteredKp.length > 0 && (
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0 z-10">
                        <tr>
                          <th className="text-left text-xs font-medium text-gray-500 px-3 py-2 w-[28%]">知识点名称</th>
                          <th className="text-left text-xs font-medium text-gray-500 px-3 py-2 w-[18%]">知识点编码</th>
                          <th className="text-left text-xs font-medium text-gray-500 px-3 py-2 w-[34%]">知识点描述</th>
                          <th className="text-right text-xs font-medium text-gray-500 px-3 py-2 w-[20%]">操作</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {filteredKp.map(kp => {
                          const isSelected = state.knowledgePoints.includes(kp.id)
                          return (
                            <tr key={kp.id} className={cn("hover:bg-gray-50 transition-colors", isSelected ? "bg-primary/[0.03]" : "")}>
                              <td className="px-3 py-2">
                                <span className="text-sm font-medium text-gray-800">{kp.name}</span>
                              </td>
                              <td className="px-3 py-2">
                                {kp.code ? (
                                  <Badge variant="outline" className="text-[10px] h-5 px-1.5">{kp.code}</Badge>
                                ) : (
                                  <span className="text-xs text-gray-400">-</span>
                                )}
                              </td>
                              <td className="px-3 py-2">
                                <p className="text-xs text-gray-500 line-clamp-1" title={kp.description}>{kp.description}</p>
                              </td>
                              <td className="px-3 py-2">
                                <div className="flex items-center justify-end gap-1">
                                  <PrdAnnotation data={getAnnotation("kp-action-detail")}>
                                    <Button variant="ghost" size="sm" className="h-6 text-[11px] px-1.5 text-gray-500 hover:text-primary" onClick={() => { setSelectedKpForDetail(kp.id); setKpDetailOpen(true) }}>
                                      详情
                                    </Button>
                                  </PrdAnnotation>
                                  {isSelected ? (
                                    <PrdAnnotation data={getAnnotation("kp-action-cancel")}>
                                      <Button size="sm" variant="outline" className="h-6 text-[11px] px-2" onClick={() => handleRemoveKp(kp.id)}>
                                        取消
                                      </Button>
                                    </PrdAnnotation>
                                  ) : (
                                    <>
                                      <Button size="sm" className="h-6 text-[11px] px-2" onClick={() => handleReferenceKp(kp.id)}>
                                        引用
                                      </Button>
                                      <Button size="sm" variant="outline" className="h-6 text-[11px] px-2" onClick={() => openCloneKp(kp)}>
                                        克隆
                                      </Button>
                                    </>
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

              {/* Right: Selected Knowledge Points - Compact Grid */}
              <div className="w-2/5 border rounded-xl p-3 flex flex-col min-h-0">
                <p className="text-sm font-medium mb-3 text-gray-700">已选择知识点 ({state.knowledgePoints.length})</p>
                <div className="flex-1 overflow-y-auto">
                  {state.knowledgePoints.length === 0 ? (
                    <div className="text-center text-gray-400 py-8">
                      <Lightbulb className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-xs">从左侧搜索并选择知识点</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {state.knowledgePoints.map(kpId => {
                        const kp = knowledgePoints.find(k => k.id === kpId)
                        if (!kp) return null
                        const isReference = !customKnowledgePointIds.has(kpId)
                        const kpGlNames = kp.granularLessons?.map((gid: any) => granularLessons.find((g: any) => g.id === gid)?.name).filter(Boolean) || []
                        return (
                          <div key={kpId} className={cn(
                            "p-2 rounded-lg border cursor-pointer transition-colors relative overflow-hidden",
                            isReference
                              ? "border-gray-200 bg-gray-50 hover:bg-gray-100"
                              : "border-primary/20 bg-primary/5 hover:bg-primary/10"
                          )} onClick={() => {
                            if (isReference) {
                              setSelectedKpForDetail(kp.id)
                              setKpDetailOpen(true)
                            } else {
                              openEditKp(kp)
                            }
                          }}>
                            <div className="flex items-center gap-1 mb-1">
                              <span className="text-xs font-medium flex-1 truncate">{kp.name}</span>
                              <Button variant="ghost" size="icon" className="h-5 w-5 text-gray-400 -mr-1 -mt-1" onClick={(e) => { e.stopPropagation(); handleRemoveKp(kpId) }}>
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                            <p className="text-[11px] text-gray-500 line-clamp-1 mb-1">{kp.description}</p>
                            {kpGlNames.length > 0 && (
                              <div className="flex items-center gap-0.5 flex-wrap">
                                {kpGlNames.slice(0, 2).map((name: any, i: number) => (
                                  <Badge key={i} variant="outline" className="text-[9px] font-normal px-1 py-0 h-4">{name}</Badge>
                                ))}
                                {kpGlNames.length > 2 && <span className="text-[9px] text-gray-400">+{kpGlNames.length - 2}</span>}
                              </div>
                            )}
                            {/* Reference badge — corner mark at bottom-right */}
                            {isReference && (
                              <div className="absolute bottom-0 right-0">
                                <div className="bg-gray-200 text-gray-600 text-[9px] px-1.5 py-0.5 rounded-tl-md border-t border-l border-white/80">
                                  引用
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Add / Clone Knowledge Dialog */}
            <Dialog open={kpActionOpen} onOpenChange={setKpActionOpen}>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <PrdAnnotation data={getAnnotation("dialog-knowledge-form")}>
                    <DialogTitle>{kpActionMode === "add" ? "新增知识点" : kpActionMode === "clone" ? "克隆知识点" : "编辑知识点"}</DialogTitle>
                  </PrdAnnotation>
                  <DialogDescription>
                    {kpActionMode === "add" ? "创建一个新的知识点" : kpActionMode === "clone" ? `基于「${kpActionTarget?.name}」创建副本` : "修改知识点信息"}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div>
                    <Label>知识点名称</Label>
                    <Input
                      value={newKpForm.name}
                      onChange={e => setNewKpForm({ ...newKpForm, name: e.target.value })}
                      placeholder="输入知识点名称"
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label>描述</Label>
                    <Textarea
                      value={newKpForm.description}
                      onChange={e => setNewKpForm({ ...newKpForm, description: e.target.value })}
                      placeholder="输入知识点描述"
                      className="mt-1.5 max-h-[120px] overflow-y-auto resize-none"
                      rows={3}
                    />
                  </div>
                  <div>
                    <Label>编码</Label>
                    <Input
                      value={newKpForm.code}
                      disabled={kpActionMode !== "edit"}
                      onChange={e => setNewKpForm({ ...newKpForm, code: e.target.value })}
                      className={cn("mt-1.5", kpActionMode !== "edit" && "bg-gray-50")}
                    />
                    <p className="text-xs text-gray-400 mt-1">{kpActionMode === "edit" ? "可修改编码" : "系统自动生成，不可修改"}</p>
                  </div>
                  <div>
                    <Label>关联颗粒课</Label>
                    <div className="mt-1.5">
                      {newKpForm.granularLessons.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {newKpForm.granularLessons.map(gid => {
                            const gl = granularLessons.find((g: any) => g.id === gid)
                            return gl ? (
                              <Badge key={gid} variant="secondary" className="text-xs gap-1">
                                {gl.name}
                                <X className="h-3 w-3 cursor-pointer" onClick={() => setNewKpForm({ ...newKpForm, granularLessons: newKpForm.granularLessons.filter(x => x !== gid) })} />
                              </Badge>
                            ) : null
                          })}
                        </div>
                      ) : null}
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1" onClick={() => { setGlSelectTargetKp("new-kp"); setGlSearch(""); setGlSelectOpen(true) }}>
                          <Plus className="h-3 w-3 mr-1" />选择颗粒课
                        </Button>
                        <Button variant="outline" size="sm" className="flex-1" onClick={() => window.open("/granular-lessons/new", "_blank")}>
                          <Plus className="h-3 w-3 mr-1" />新建颗粒课
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setKpActionOpen(false)}>取消</Button>
                  <Button onClick={handleSaveKp} disabled={!newKpForm.name.trim()}>
                    {kpActionMode === "add" ? "新增并选中" : kpActionMode === "clone" ? "克隆并选中" : "保存修改"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Granular Lesson Selection Dialog */}
            <Dialog open={glSelectOpen} onOpenChange={setGlSelectOpen}>
              <DialogContent className="sm:max-w-[800px] max-h-[80vh] h-[80vh] flex flex-col">
                <DialogHeader>
                  <PrdAnnotation data={getAnnotation("dialog-link-knowledge")}>
                    <DialogTitle>
                      {glTargetKp ? `为「${glTargetKp.name}」选择颗粒课` : "选择颗粒课"}
                    </DialogTitle>
                  </PrdAnnotation>
                </DialogHeader>
                <div className="flex gap-4 flex-1 min-h-0 py-4">
                  {/* Left: All granular lessons */}
                  <div className="w-3/5 flex flex-col min-h-0 border rounded-xl p-3">
                    <div className="relative mb-3">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        value={glSearch}
                        onChange={e => setGlSearch(e.target.value)}
                        placeholder="搜索颗粒课名称或编码..."
                        className="pl-9"
                      />
                    </div>
                    <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                      {glFiltered.map(gl => {
                        const isSelected = glSelectedIds.includes(gl.id)
                        return (
                          <div key={gl.id} className={cn("p-3 rounded-lg border cursor-pointer transition-all", isSelected ? "border-primary bg-primary/5" : "border-gray-200 hover:border-gray-300")} onClick={() => {
                            if (glSelectTargetKp === "new-kp") {
                              setNewKpForm(prev => {
                                const current = prev.granularLessons
                                const updated = current.includes(gl.id) ? current.filter(x => x !== gl.id) : [...current, gl.id]
                                return { ...prev, granularLessons: updated }
                              })
                            } else {
                              handleToggleGlForKp(gl.id)
                            }
                          }}>
                            <div className="flex items-center gap-2">
                              <div className={cn("w-4 h-4 rounded border flex items-center justify-center", isSelected ? "bg-primary border-primary" : "border-gray-300")}>
                                {isSelected && <Check className="h-3 w-3 text-white" />}
                              </div>
                              <span className="text-sm font-medium flex-1">{gl.name}</span>
                              {gl.code && <Badge variant="outline" className="text-[10px]">{gl.code}</Badge>}
                            </div>
                            <p className="text-xs text-gray-500 mt-1 ml-6">{gl.description}</p>
                          </div>
                        )
                      })}
                      {glFiltered.length === 0 && (
                        <div className="text-center text-gray-400 py-8">
                          <p className="text-sm">未找到匹配的颗粒课</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Selected */}
                  <div className="w-2/5 border rounded-xl p-3 flex flex-col min-h-0">
                    <p className="text-sm font-medium mb-3 text-gray-700">已选择 ({glSelectedIds.length})</p>
                    <div className="flex-1 overflow-y-auto space-y-2">
                      {glSelectedIds.length === 0 ? (
                        <div className="text-center text-gray-400 py-8">
                          <p className="text-xs">从左侧选择颗粒课</p>
                        </div>
                      ) : (
                        glSelectedIds.map((gid: any) => {
                          const gl = granularLessons.find((g: any) => g.id === gid)
                          if (!gl) return null
                          return (
                            <div key={gid} className="flex items-center gap-2 p-2 rounded border bg-gray-50">
                              <span className="text-sm flex-1 truncate">{gl.name}</span>
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400" onClick={() => {
                                if (glSelectTargetKp === "new-kp") {
                                  setNewKpForm(prev => ({ ...prev, granularLessons: prev.granularLessons.filter(x => x !== gid) }))
                                } else {
                                  handleToggleGlForKp(gid)
                                }
                              }}>
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={() => setGlSelectOpen(false)}>确定</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Knowledge Point Detail Dialog */}
            <Dialog open={kpDetailOpen} onOpenChange={setKpDetailOpen}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <PrdAnnotation data={getAnnotation("dialog-knowledge-detail")}>
                    <DialogTitle>知识点详情</DialogTitle>
                  </PrdAnnotation>
                </DialogHeader>
                {detailKp && (
                  <div className="space-y-4 py-2">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-gray-500">知识点名称</Label>
                      {!customKnowledgePointIds.has(detailKp.id) && (
                        <Badge variant="secondary" className="text-[10px] h-5">引用（不可编辑）</Badge>
                      )}
                      {customKnowledgePointIds.has(detailKp.id) && (
                        <Badge variant="outline" className="text-[10px] h-5 border-primary/30 text-primary">自定义（可编辑）</Badge>
                      )}
                    </div>
                    <p className="text-sm font-medium">{detailKp.name}</p>
                    <div>
                      <Label className="text-xs text-gray-500">知识点描述</Label>
                      <p className="text-sm text-gray-700 mt-1">{detailKp.description}</p>
                    </div>
                    {detailKp.code && (
                      <div>
                        <Label className="text-xs text-gray-500">编码</Label>
                        <p className="text-sm text-gray-700 mt-1">{detailKp.code}</p>
                      </div>
                    )}
                    <div>
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-gray-500">关联颗粒课</Label>
                        {customKnowledgePointIds.has(detailKp.id) && (
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="sm" className="h-6 text-[11px] px-2 text-primary" onClick={() => { setKpDetailOpen(false); openGlSelect(detailKp.id) }}>
                              引用颗粒课
                            </Button>
                            <Button variant="ghost" size="sm" className="h-6 text-[11px] px-2 text-primary" onClick={() => window.open("/granular-lessons/new", "_blank")}>
                              新增颗粒课
                            </Button>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {detailGranularLessons.length > 0 ? detailGranularLessons.map((gl: any) => (
                          <Badge key={gl!.id} variant="outline" className="text-xs">{gl!.name}</Badge>
                        )) : <p className="text-sm text-gray-400">暂无关联颗粒课</p>}
                      </div>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </div>
        )
      }

      case "ability": {
        // abilityDetailOpen, selectedAbilityForDetail, expandedDomains, abilitySearch are defined at component top level

        // If no position is associated, show warning instead of ability list
        if (!positionId) {
          return (
            <div className="h-full flex flex-col items-center justify-center text-center text-gray-400 py-16">
              <AlertCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm font-medium text-gray-600">请先关联岗位后，再选择考察能力点</p>
            </div>
          )
        }

        // Build position name map
        const positionNameMap: Record<string, string> = {}
        professions.forEach((p: any) => p.positions.forEach((pos: any) => { positionNameMap[pos.id] = pos.name }))

        // Build abilities related to current position from bindings
        const bindings = positionAbilityBindings.filter((b: any) => b.careerPositionId === positionId)
        const bindingMap = new Map(bindings.map((b: any) => [b.abilityPointId, b]))
        const relatedAbilities = abilityPoints
          .filter((ab: any) => bindingMap.has(ab.id))
          .map((ab: any) => {
            const binding = bindingMap.get(ab.id)
            return {
              ...ab,
              positionIds: [positionId],
              domain: binding?.domain || ab.domain || "其他",
              requiredLevel: binding?.requiredLevel || ab.requiredLevel,
              proficiencyDesc: binding?.rubricDescription || ab.proficiencyDesc,
            }
          })

        if (relatedAbilities.length === 0) {
          return (
            <div className="h-full flex flex-col items-center justify-center text-center text-gray-400 py-16">
              <Award className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm font-medium text-gray-600 mb-1">目标岗位暂无关联能力点</p>
              <p className="text-xs text-gray-400 mb-4">请先去岗位配置页关联能力点后，再回到本页面选择</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => positionId && window.open(`/job/positions/${positionId}/edit`, "_blank")}
              >
                去岗位配置页关联
                <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
          )
        }

        const toggleAbility = (abId: string) => {
          const selected = state.abilityPoints.includes(abId)
          updateState({ abilityPoints: selected ? state.abilityPoints.filter(x => x !== abId) : [...state.abilityPoints, abId] })
        }

        // Group by domain
        const domainGroups = relatedAbilities.reduce((acc, ab) => {
          const domain = ab.domain || "其他"
          if (!acc[domain]) acc[domain] = []
          acc[domain].push(ab)
          return acc
        }, {} as Record<string, typeof relatedAbilities>)

        const detailAb = selectedAbilityForDetail ? abilityPoints.find(a => a.id === selectedAbilityForDetail) : null

        const requiredLevelColors: Record<string, string> = {
          "了解": "bg-gray-100 text-gray-600 border-gray-200",
          "理解": "bg-blue-50 text-blue-600 border-blue-200",
          "掌握": "bg-green-50 text-green-600 border-green-200",
          "熟练": "bg-orange-50 text-orange-600 border-orange-200",
          "精通": "bg-purple-50 text-purple-600 border-purple-200",
        }

        const domainIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
          "前端工程化": Code,
          "系统设计": Database,
          "质量保障": Shield,
          "职业素养": Users,
          "服务端开发": Server,
          "运维部署": Wrench,
          "数据分析": BookOpen,
        }

        const categoryColors: Record<string, string> = {
          "开发能力": "bg-blue-50 text-blue-600 border-blue-200",
          "设计能力": "bg-purple-50 text-purple-600 border-purple-200",
          "优化能力": "bg-green-50 text-green-600 border-green-200",
          "软技能": "bg-orange-50 text-orange-600 border-orange-200",
          "分析能力": "bg-cyan-50 text-cyan-600 border-cyan-200",
          "工程能力": "bg-indigo-50 text-indigo-600 border-indigo-200",
        }

        return (
          <div className="h-full flex flex-col">
            {/* Header bar */}
            <div className="flex items-center gap-4 mb-4 shrink-0">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input value={abilitySearch} onChange={e => setAbilitySearch(e.target.value)} placeholder="搜索能力点名称、编码或描述..." className="pl-9" />
              </div>
              <div className="text-sm text-gray-500 shrink-0">
                共 <span className="font-medium text-gray-800">{relatedAbilities.length}</span> 个关联能力点，已选 <span className="font-medium text-primary">{state.abilityPoints.length}</span> 个
              </div>
            </div>

            <div className="flex-1 min-h-0 border rounded-xl overflow-hidden">
              <div className="h-full overflow-y-auto p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 content-start">
                {Object.entries(domainGroups).map(([domain, abilities]: [string, any]) => {
                  const filtered = abilities.filter((a: any) =>
                    !abilitySearch ||
                    (a.name || "").includes(abilitySearch) ||
                    (a.description || "").includes(abilitySearch) ||
                    (a.code || "").includes(abilitySearch)
                  )
                  if (filtered.length === 0) return null
                  const expanded = expandedDomains[domain] !== false
                  const DomainIcon = domainIconMap[domain] || Award
                  return (
                    <div key={domain} className="border rounded-xl overflow-hidden bg-white flex flex-col">
                      <button
                        className="w-full flex items-center gap-2 px-4 py-2.5 bg-sky-50 text-sm font-semibold text-sky-700 hover:bg-sky-100 transition-colors shrink-0"
                        onClick={() => setExpandedDomains(prev => ({ ...prev, [domain]: !expanded }))}
                      >
                        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        <DomainIcon className="h-4 w-4" />
                        <span className="flex-1 text-left truncate">{domain}</span>
                        <Badge className="text-[10px] bg-white text-sky-600 border-sky-200 shrink-0">{filtered.length} 个能力点</Badge>
                      </button>
                      {expanded && (
                        <div className="divide-y divide-gray-100 max-h-[180px] overflow-y-auto">
                          {filtered.map((ab: any) => {
                            const selected = state.abilityPoints.includes(ab.id)
                            const levelLabel = ab.requiredLevel
                              ? (COMPETENCY_LEVEL_LABELS[ab.requiredLevel as keyof typeof COMPETENCY_LEVEL_LABELS] || ab.requiredLevel)
                              : undefined
                            return (
                              <div
                                key={ab.id}
                                onClick={() => toggleAbility(ab.id)}
                                className={cn(
                                  "px-4 py-2.5 cursor-pointer transition-colors group",
                                  selected
                                    ? "bg-primary/[0.03] border-l-2 border-l-primary"
                                    : "hover:bg-gray-50 border-l-2 border-l-transparent"
                                )}
                              >
                                {/* Row 1: checkbox + name + code + badges */}
                                <div className="flex items-center gap-2">
                                  <div className={cn(
                                    "w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                                    selected ? "bg-primary border-primary" : "border-gray-300 group-hover:border-gray-400"
                                  )}>
                                    {selected && <Check className="h-3 w-3 text-white" />}
                                  </div>
                                  <span className="text-sm font-medium text-gray-800 truncate">{ab.name}</span>
                                  {ab.code && <span className="text-[11px] text-gray-400 font-mono shrink-0">{ab.code}</span>}
                                  <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                                    {levelLabel && (
                                      <Badge variant="outline" className={cn("text-[10px] font-medium h-5 px-1", requiredLevelColors[levelLabel] || "")}>
                                        胜任标准：{levelLabel}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                                {/* Row 2: description + standard description */}
                                <div className="flex items-center gap-2 mt-1 ml-6">
                                  <p className="text-xs text-gray-500 line-clamp-1 flex-1">{ab.description}</p>
                                  <span
                                    className="text-[10px] text-gray-500 shrink-0 line-clamp-1 max-w-[50%] text-right"
                                    title={ab.proficiencyDesc || undefined}
                                  >
                                    {ab.proficiencyDesc || "岗位胜任标准描述"}
                                  </span>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
                {Object.entries(domainGroups).filter(([_, abilities]: [string, any]) =>
                  abilities.some((a: any) =>
                    !abilitySearch ||
                    (a.name || "").includes(abilitySearch) ||
                    (a.description || "").includes(abilitySearch) ||
                    (a.code || "").includes(abilitySearch)
                  )
                ).length === 0 && (
                  <div className="col-span-full text-center text-gray-400 py-16">
                    <Award className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">未找到匹配的能力点</p>
                  </div>
                )}
              </div>
            </div>

            {/* Ability Detail Dialog */}
            <Dialog open={abilityDetailOpen} onOpenChange={setAbilityDetailOpen}>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <PrdAnnotation data={getAnnotation("dialog-ability-detail")}>
                    <DialogTitle>能力点详情</DialogTitle>
                  </PrdAnnotation>
                </DialogHeader>
                {detailAb && (
                  <div className="space-y-4 py-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-base font-semibold">{detailAb.name}</p>
                      {detailAb.code && <Badge variant="outline" className="font-mono">{detailAb.code}</Badge>}
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">能力点描述</Label>
                      <p className="text-sm text-gray-700 mt-1">{detailAb.description}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">所属能力领域</Label>
                      <p className="text-sm text-gray-700 mt-1">{detailAb.domain || "-"}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">关联岗位</Label>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {(detailAb.positionIds?.map((pid: any) => positionNameMap[pid]).filter(Boolean) || []).map((name: any, i: number) => (
                          <Badge key={i} variant="secondary">{name}</Badge>
                        ))}
                        {(!detailAb.positionIds || detailAb.positionIds.length === 0) && <span className="text-sm text-gray-400">-</span>}
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">胜任标准</Label>
                      <p className="text-sm text-gray-700 mt-1">
                        {detailAb.requiredLevel
                          ? (COMPETENCY_LEVEL_LABELS[detailAb.requiredLevel as keyof typeof COMPETENCY_LEVEL_LABELS] || detailAb.requiredLevel)
                          : "-"}
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">岗位胜任标准描述</Label>
                      <p className="text-sm text-gray-700 mt-1 whitespace-pre-line">{detailAb.proficiencyDesc || "-"}</p>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </div>
        )
      }

      case "resources": {
        const resFileInputRef = useRef<HTMLInputElement>(null)
        const types = ["all", "document", "spreadsheet", "image", "link", "audio", "video", "archive", "venue", "facility", "software", "other"]
        const getUploaderName = (uploadedBy?: string) => {
          if (!uploadedBy) return "-"
          return userNameMap[uploadedBy] || uploadedBy
        }
        const formatDate = (dateStr?: string) => {
          if (!dateStr) return "-"
          const d = new Date(dateStr)
          return isNaN(d.getTime()) ? dateStr : d.toISOString().slice(0, 10)
        }
        const filteredRes = learningResources.filter(r => {
          const matchType = resType === "all" || r.type === resType
          const matchName = !resSearchName || r.name.includes(resSearchName)
          const uploaderName = getUploaderName(r.uploadedBy)
          const matchProvider = !resSearchProvider || uploaderName.includes(resSearchProvider)
          return matchType && matchName && matchProvider
        })

        const toggleResource = (rid: string) => {
          const selected = state.resources.includes(rid)
          updateState({ resources: selected ? state.resources.filter(x => x !== rid) : [...state.resources, rid] })
        }

        const resetFilters = () => {
          setResType("all")
          setResSearchName("")
          setResSearchProvider("")
        }

        const handleResFileSelect = (file: File) => {
          const err = validateResourceFile(file, newResType)
          if (err) {
            toast({ variant: "destructive", title: "文件校验失败", description: err })
            return
          }
          setNewResFile(file)
        }

        const onResFileDrop: React.DragEventHandler<HTMLDivElement> = (e) => {
          e.preventDefault()
          e.stopPropagation()
          const file = e.dataTransfer.files?.[0]
          if (file) handleResFileSelect(file)
        }

        const fileTypesWithUpload = ["document", "spreadsheet", "image", "audio", "video", "archive", "other", "software"]
        const canPreview = (r: any) => r?.url && r.url !== "#"
        const canDownload = (r: any) => r?.url && r.url !== "#"

        const getPreviewContent = (r: any) => {
          if (!r?.url) return null
          if (r.type === "image") {
            return <img src={r.url} alt={r.name} className="max-w-full max-h-full object-contain" />
          }
          if (r.type === "audio") {
            return <audio controls src={r.url} className="w-full" />
          }
          if (r.type === "video") {
            return <video controls src={r.url} className="max-w-full max-h-full" />
          }
          return <iframe src={r.url} title={r.name} className="w-full h-full" />
        }

        const isPreviewableInline = (r: any) => ["image", "audio", "video"].includes(r?.type)

        return (
          <div className="h-full flex flex-col">
            {/* Toolbar */}
            <div className="shrink-0 space-y-3 mb-4">
              {/* Type filters */}
              <div className="flex gap-1.5 flex-wrap">
                {types.map(t => (
                  <Button
                    key={t}
                    variant={resType === t ? "default" : "outline"}
                    size="sm"
                    className={cn("text-xs h-7", resType === t ? "" : "bg-white")}
                    onClick={() => setResType(t)}
                  >
                    {resourceTypeIcons[t] && <span className="mr-1.5">{resourceTypeIcons[t]}</span>}
                    {resourceTypeLabels[t] || t}
                  </Button>
                ))}
              </div>
              {/* Search & Actions */}
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    value={resSearchName}
                    onChange={e => setResSearchName(e.target.value)}
                    placeholder="搜索资源名称..."
                    className="pl-9 text-sm"
                  />
                </div>
                <div className="relative flex-1">
                  <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    value={resSearchProvider}
                    onChange={e => setResSearchProvider(e.target.value)}
                    placeholder="搜索资源提供者..."
                    className="pl-9 text-sm"
                  />
                </div>
                <Button variant="outline" size="sm" className="h-9 text-xs" onClick={resetFilters}>
                  <RotateCcw className="h-3.5 w-3.5 mr-1" />重置
                </Button>
                <Button size="sm" className="h-9 text-xs" onClick={() => {
                  if (resType === "all") {
                    setShowUploadTypePicker(true)
                  } else {
                    setNewResType(resType)
                    setShowUploadRes(true)
                  }
                }}>
                  <Upload className="h-3.5 w-3.5 mr-1" />上传资源
                </Button>
              </div>
            </div>

            <div className="flex gap-4 flex-1 min-h-0">
              {/* Left: Resource cards grid */}
              <div className="flex-1 flex flex-col min-h-0 border rounded-xl p-4 overflow-hidden">
                <div className="flex items-center justify-between mb-3 shrink-0">
                  <p className="text-sm font-medium text-gray-700">
                    资源列表 <span className="text-gray-400 font-normal">({filteredRes.length})</span>
                  </p>
                </div>
                <div className="flex-1 overflow-y-auto pr-1">
                  {filteredRes.length === 0 ? (
                    <div className="text-center text-gray-400 py-16">
                      <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p className="text-sm">未找到匹配的资源</p>
                      <p className="text-xs mt-1">尝试调整筛选条件</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {filteredRes.map(r => {
                        const selected = state.resources.includes(r.id)
                        return (
                          <div
                            key={r.id}
                            className={cn(
                              "relative rounded-lg border overflow-hidden transition-all cursor-pointer group",
                              selected
                                ? "border-primary shadow-sm ring-1 ring-primary/10"
                                : "border-gray-200 hover:border-gray-300 hover:shadow-sm bg-white"
                            )}
                          >
                            {/* Thumbnail area */}
                            <div className="relative h-20 bg-gray-50 border-b border-gray-100 overflow-hidden">
                              {r.thumbnail && r.type === "image" ? (
                                <img src={r.thumbnail} alt={r.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <div className={cn("p-2 rounded-lg border", resourceTypeColors[r.type] || "bg-gray-50 border-gray-200")}>
                                    {resourceTypeIcons[r.type] || <Package className="h-5 w-5 text-gray-400" />}
                                  </div>
                                </div>
                              )}
                              {selected && (
                                <div className="absolute top-1.5 right-1.5 bg-primary text-white rounded-full p-0.5 shadow-sm">
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                </div>
                              )}
                              {/* Type badge */}
                              <div className="absolute bottom-1.5 left-1.5">
                                <Badge className={cn("text-[9px] border", resourceTypeColors[r.type] || "")}>
                                  {resourceTypeLabels[r.type] || r.type}
                                </Badge>
                              </div>
                            </div>
                            {/* Info */}
                            <div className="p-2" onClick={() => toggleResource(r.id)}>
                              <p className="text-xs font-medium text-gray-800 truncate mb-1">{r.name}</p>
                              <div className="flex items-center justify-between text-[11px] text-gray-500">
                                <span className="flex items-center gap-1 truncate max-w-[80px]">
                                  <Users className="h-3 w-3 shrink-0" />{getUploaderName(r.uploadedBy)}
                                </span>
                                <span className="shrink-0">{formatDate(r.uploadedAt)}</span>
                              </div>
                            </div>
                            {/* Actions */}
                            <div className="px-2 pb-2 flex items-center gap-1">
                              <PrdAnnotation data={getAnnotation("resource-action-preview")}>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 text-[10px] px-1 flex-1 text-gray-500 hover:text-primary"
                                  onClick={(e) => { e.stopPropagation(); canPreview(r) ? setPreviewRes(r) : window.open(r.url || "#", "_blank") }}
                                >
                                  <Eye className="h-3 w-3 mr-0.5" />预览
                                </Button>
                              </PrdAnnotation>
                              {canDownload(r) && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 text-[10px] px-1 flex-1 text-gray-500 hover:text-primary"
                                  asChild
                                >
                                  <a href={r.url} download={r.name} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                                    <Download className="h-3 w-3 mr-0.5" />下载
                                  </a>
                                </Button>
                              )}
                              <PrdAnnotation data={selected ? getAnnotation("resource-action-cancel") : getAnnotation("resource-action-select")}>
                                <Button
                                  variant={selected ? "outline" : "default"}
                                  size="sm"
                                  className="h-6 text-[10px] px-1.5 flex-1"
                                  onClick={(e) => { e.stopPropagation(); toggleResource(r.id) }}
                                >
                                  {selected ? "取消" : "选择"}
                                </Button>
                              </PrdAnnotation>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Selected resources sidebar */}
              <div className="w-72 shrink-0 flex flex-col min-h-0 border rounded-xl p-4 bg-gray-50/50 overflow-hidden">
                <div className="flex items-center justify-between mb-3 shrink-0">
                  <p className="text-sm font-semibold text-gray-700">已选资源</p>
                  <Badge variant="secondary" className="text-[10px]">{state.resources.length}</Badge>
                </div>
                <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
                  {state.resources.length === 0 ? (
                    <div className="text-center text-gray-400 py-8">
                      <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-xs">请从左侧选择资源</p>
                    </div>
                  ) : (
                    state.resources.map(rid => {
                      const r = learningResources.find(res => res.id === rid)
                      if (!r) return null
                      return (
                        <div key={rid} className="flex items-center gap-2.5 p-2.5 rounded-lg border border-primary/20 bg-white shadow-sm">
                          <div className={cn("w-9 h-9 rounded-lg border flex items-center justify-center shrink-0", resourceTypeColors[r.type] || "bg-gray-50")}>
                            {resourceTypeIcons[r.type] || <Package className="h-4 w-4 text-gray-400" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate text-gray-800">{r.name}</p>
                            <p className="text-[10px] text-gray-400 truncate">{getUploaderName(r.uploadedBy)} · {formatDate(r.uploadedAt)}</p>
                          </div>
                          <PrdAnnotation data={getAnnotation("resource-action-cancel")}>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400 hover:text-red-500 shrink-0" onClick={() => toggleResource(rid)}>
                              <X className="h-3 w-3" />
                            </Button>
                          </PrdAnnotation>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Upload Type Picker Dialog */}
            <Dialog open={showUploadTypePicker} onOpenChange={setShowUploadTypePicker}>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <PrdAnnotation data={getAnnotation("dialog-resource-type-select")}>
                    <DialogTitle>选择资源类型</DialogTitle>
                  </PrdAnnotation>
                  <DialogDescription>请选择要上传的资源类型</DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-3 gap-3 py-4">
                  {types.filter(t => t !== "all").map(t => (
                    <button
                      key={t}
                      onClick={() => {
                        setNewResType(t)
                        setShowUploadTypePicker(false)
                        setShowUploadRes(true)
                      }}
                      className="flex flex-col items-center gap-2 p-4 rounded-xl border border-gray-200 hover:border-primary hover:bg-primary/5 transition-all text-center"
                    >
                      <div className={cn("p-2 rounded-lg border", resourceTypeColors[t] || "bg-gray-50 border-gray-200")}>
                        {resourceTypeIcons[t] || <Package className="h-5 w-5 text-gray-400" />}
                      </div>
                      <span className="text-xs font-medium text-gray-700">{resourceTypeLabels[t] || t}</span>
                    </button>
                  ))}
                </div>
              </DialogContent>
            </Dialog>

            {/* Upload Resource Dialog */}
            <Dialog open={showUploadRes} onOpenChange={setShowUploadRes}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <PrdAnnotation data={getAnnotation("dialog-resource-upload")}>
                    <DialogTitle>上传资源到公共库</DialogTitle>
                  </PrdAnnotation>
                  <DialogDescription>补充本地资源，上传后将加入资源公共库并自动选中</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto pr-1">
                  <div>
                    <Label>资源名称</Label>
                    <Input value={newResName} onChange={e => setNewResName(e.target.value)} placeholder="输入资源名称" className="mt-1.5" />
                  </div>
                  {newResType === "all" && (
                    <div>
                      <Label>资源类型</Label>
                      <Select value={newResType} onValueChange={v => setNewResType(v)}>
                        <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="document">文档资源</SelectItem>
                          <SelectItem value="spreadsheet">表格资源</SelectItem>
                          <SelectItem value="image">图片资源</SelectItem>
                          <SelectItem value="link">链接资源</SelectItem>
                          <SelectItem value="audio">音频资源</SelectItem>
                          <SelectItem value="video">视频资源</SelectItem>
                          <SelectItem value="archive">压缩包资源</SelectItem>
                          <SelectItem value="venue">场地资源</SelectItem>
                          <SelectItem value="facility">设施设备资源</SelectItem>
                          <SelectItem value="software">软件资源</SelectItem>
                          <SelectItem value="other">其他资源</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Link type: URL */}
                  {newResType === "link" && (
                    <div>
                      <Label>URL 地址</Label>
                      <Input value={newResUrl} onChange={e => setNewResUrl(e.target.value)} placeholder="https://..." className="mt-1.5" />
                    </div>
                  )}

                  {/* Venue type: address, open time, capacity, contact */}
                  {newResType === "venue" && (
                    <>
                      <div>
                        <Label>场地地址</Label>
                        <Input value={newResAddress} onChange={e => setNewResAddress(e.target.value)} placeholder="输入场地详细地址" className="mt-1.5" />
                      </div>
                      <div>
                        <Label>开放时间</Label>
                        <Input value={newResOpenTime} onChange={e => setNewResOpenTime(e.target.value)} placeholder="例如：周一至周五 09:00-18:00" className="mt-1.5" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>容纳人数</Label>
                          <Input value={newResCapacity} onChange={e => setNewResCapacity(e.target.value)} placeholder="例如：50人" className="mt-1.5" />
                        </div>
                        <div>
                          <Label>联系人/电话</Label>
                          <Input value={newResContact} onChange={e => setNewResContact(e.target.value)} placeholder="输入联系人或电话" className="mt-1.5" />
                        </div>
                      </div>
                    </>
                  )}

                  {/* Facility type: location, quantity */}
                  {newResType === "facility" && (
                    <>
                      <div>
                        <Label>所在位置</Label>
                        <Input value={newResLocation} onChange={e => setNewResLocation(e.target.value)} placeholder="输入设施所在位置" className="mt-1.5" />
                      </div>
                      <div>
                        <Label>数量</Label>
                        <Input value={newResQuantity} onChange={e => setNewResQuantity(e.target.value)} placeholder="输入设施数量" className="mt-1.5" />
                      </div>
                    </>
                  )}

                  {/* Tool / Software type: version, url, license */}
                  {newResType === "software" && (
                    <>
                      <div>
                        <Label>版本号</Label>
                        <Input value={newResVersion} onChange={e => setNewResVersion(e.target.value)} placeholder="例如：v2.1.0" className="mt-1.5" />
                      </div>
                      <div>
                        <Label>下载链接</Label>
                        <Input value={newResUrl} onChange={e => setNewResUrl(e.target.value)} placeholder="https://..." className="mt-1.5" />
                      </div>
                      {newResType === "software" && (
                        <div>
                          <Label>授权信息</Label>
                          <Input value={newResLicense} onChange={e => setNewResLicense(e.target.value)} placeholder="例如：MIT / 商业授权 / 校内授权" className="mt-1.5" />
                        </div>
                      )}
                    </>
                  )}

                  {/* Description for all types */}
                  <div>
                    <Label>资源描述</Label>
                    <Textarea value={newResDescription} onChange={e => setNewResDescription(e.target.value)} placeholder="输入资源简介、用途说明等" className="mt-1.5" rows={2} />
                  </div>

                  {/* File upload for file-based types */}
                  {fileTypesWithUpload.includes(newResType) && (
                    <div
                      className={cn(
                        "border-2 border-dashed rounded-xl p-6 text-center space-y-3 transition-colors",
                        newResUploading ? "border-primary/30 bg-gray-50/50" : "border-gray-200 hover:border-primary/30 hover:bg-gray-50/50 cursor-pointer"
                      )}
                      onClick={() => !newResUploading && resFileInputRef.current?.click()}
                      onDragOver={e => { e.preventDefault(); e.stopPropagation() }}
                      onDrop={onResFileDrop}
                    >
                      <input
                        ref={resFileInputRef}
                        type="file"
                        accept={resourceTypeAccept[newResType]}
                        className="hidden"
                        onChange={e => {
                          const file = e.target.files?.[0]
                          if (file) handleResFileSelect(file)
                          e.target.value = ""
                        }}
                      />
                      {newResFile ? (
                        <div className="text-center space-y-2 pointer-events-none">
                          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                            <File className="h-6 w-6 text-primary" />
                          </div>
                          <p className="text-sm font-medium text-gray-700">{newResFile.name}</p>
                          <p className="text-xs text-gray-500">{(newResFile.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                      ) : (
                        <>
                          <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto">
                            {newResUploading ? <Loader2 className="h-6 w-6 text-gray-400 animate-spin" /> : <Upload className="h-6 w-6 text-gray-400" />}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-700">点击或拖拽上传文件</p>
                            <p className="text-xs text-gray-500 mt-1">
                              {resourceTypeAccept[newResType]
                                ? `支持 ${resourceTypeAccept[newResType]}，最大 100MB`
                                : "支持多种格式，最大 100MB"}
                            </p>
                          </div>
                        </>
                      )}
                      {newResFile && !newResUploading && (
                        <div className="flex items-center justify-center gap-2 pointer-events-auto" onClick={e => e.stopPropagation()}>
                          <Button variant="outline" size="sm" onClick={() => resFileInputRef.current?.click()}>
                            <Upload className="h-3.5 w-3.5 mr-1" />重新选择
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => setNewResFile(null)}>
                            <X className="h-3.5 w-3.5 mr-1" />清除
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowUploadRes(false)}>取消</Button>
                  <Button
                    onClick={handleUploadResource}
                    disabled={
                      !newResName.trim() ||
                      newResUploading ||
                      (newResType === "link" && !newResUrl.trim()) ||
                      (fileTypesWithUpload.includes(newResType) && !newResFile && !newResUrl.trim())
                    }
                  >
                    {newResUploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                    上传并选中
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Resource Preview Dialog */}
            <Dialog open={!!previewRes} onOpenChange={open => !open && setPreviewRes(null)}>
              <DialogContent className={cn("flex flex-col", isPreviewableInline(previewRes) ? "sm:max-w-2xl" : "sm:max-w-4xl h-[80vh]")}>
                <DialogHeader className="shrink-0">
                  <DialogTitle className="flex items-center gap-2">
                    {previewRes && resourceTypeIcons[previewRes.type]}
                    <span className="truncate">{previewRes?.name || "资源预览"}</span>
                  </DialogTitle>
                </DialogHeader>
                <div className={cn(
                  "flex-1 min-h-0 border rounded-lg overflow-hidden bg-gray-50 flex items-center justify-center",
                  isPreviewableInline(previewRes) ? "p-4" : ""
                )}>
                  {previewRes ? getPreviewContent(previewRes) : <div className="text-gray-400">暂无预览</div>}
                </div>
                <DialogFooter className="shrink-0 gap-2">
                  <Button variant="outline" onClick={() => setPreviewRes(null)}>关闭</Button>
                  {canDownload(previewRes) && (
                    <Button asChild>
                      <a href={previewRes.url} download={previewRes.name} target="_blank" rel="noreferrer">
                        <Download className="h-4 w-4 mr-1" />下载
                      </a>
                    </Button>
                  )}
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )
      }

      case "evaluation": {
        const [primaryTab, setPrimaryTab] = useState<"platform" | "industry">("platform")
        const [secondaryTab, setSecondaryTab] = useState("全部")

        const primaryTabs = [
          { key: "platform" as const, label: "平台通用" },
          { key: "industry" as const, label: "行业专属" },
        ]

        const secondaryTabsMap: Record<string, string[]> = {
          platform: ["全部", "知识评价", "过程评价", "成果评价"],
          industry: ["全部", "智慧物流", "网络安全"],
        }

        const secondaryTabs = secondaryTabsMap[primaryTab]

        const toggleMethod = (key: string) => {
          const opts = evaluationMethodOptions.find(o => o.key === key)
          if (!opts || !opts.available) return
          const enabled = state.evaluationMethods.includes(key)
          const newMethods = enabled ? state.evaluationMethods.filter(m => m !== key) : [...state.evaluationMethods, key]
          updateState({ evaluationMethods: newMethods })
        }

        const filteredMethods = evaluationMethodOptions.filter(m => {
          if (m.primaryCategory !== primaryTab) return false
          if (secondaryTab === "全部") return true
          return m.secondaryCategory === secondaryTab
        })

        return (
          <div className="h-full overflow-y-auto pr-2 space-y-4">
            {/* 一级分类 */}
            <div className="flex items-center gap-2 border-b pb-2">
              {primaryTabs.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => {
                    setPrimaryTab(tab.key)
                    setSecondaryTab("全部")
                  }}
                  className={cn(
                    "px-4 py-1.5 rounded-full text-sm font-medium transition-colors",
                    primaryTab === tab.key
                      ? "bg-primary text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  )}
                >
                  {tab.label}
                </button>
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
                    secondaryTab === tab
                      ? "border-primary text-primary bg-primary/5"
                      : "border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50"
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* 测评方式网格 */}
            <div className="grid grid-cols-2 gap-2">
              {filteredMethods.map(method => {
                const enabled = state.evaluationMethods.includes(method.key)
                return (
                  <button
                    key={method.key}
                    disabled={!method.available}
                    onClick={() => toggleMethod(method.key)}
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
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            已开通
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

            {state.evaluationMethods.length === 0 && (
              <div className="p-12 text-center text-gray-400 border border-dashed rounded-xl">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">请选择至少一种评价方式</p>
              </div>
            )}
          </div>
        )
      }

      case "evaluationRules": {
        const qSearch = erQSearch
        const setQSearch = setErQSearch
        const pSearch = erPSearch
        const setPSearch = setErPSearch
        const kpSearchForEval = erKpSearch
        const setKpSearchForEval = setErKpSearch
        const abSearchForEval = erAbSearch
        const setAbSearchForEval = setErAbSearch

        const [isOrderConfigOpen, setIsOrderConfigOpen] = useState(false)
        const [isWeightConfigOpen, setIsWeightConfigOpen] = useState(false)

        // 测评方式实例计数（纯 UI 模拟，不持久化）
        const [methodInstanceCounts, setMethodInstanceCounts] = useState<Record<string, number>>({})

        const getMethodInstances = () => {
          const instances: { methodKey: string; instanceIndex: number }[] = []
          state.evaluationMethods.forEach(methodKey => {
            const count = methodInstanceCounts[methodKey] || 1
            for (let i = 0; i < count; i++) {
              instances.push({ methodKey, instanceIndex: i })
            }
          })
          return instances
        }

        const duplicateMethod = (methodKey: string) => {
          setMethodInstanceCounts(prev => ({
            ...prev,
            [methodKey]: (prev[methodKey] || 1) + 1
          }))
        }

        const subjectLabels: Record<string, string> = {
          teacher: "教师",
          enterprise_mentor: "企业导师",
          self: "自评",
          peer: "互评",
        }

        const getMethodConfigSummary = (methodKey: string) => {
          switch (methodKey) {
            case "random_draw":
              return { title: "现场问答", summary: `${state.randomDrawSelectedIds.length} 题 / ${state.randomDrawEvalPoints.length} 个评价点`, configured: state.randomDrawSelectedIds.length > 0 || state.randomDrawEvalPoints.length > 0 }
            case "review":
              return { title: "现场评审", summary: `${state.reviewEvalPoints.length} 个评价点`, configured: state.reviewEvalPoints.length > 0 }
            case "paper":
              return { title: "试卷", summary: state.paperIds.length > 0 ? `已选 ${state.paperIds.length} 张试卷` : "未选择", configured: state.paperIds.length > 0 }
            case "question_bank":
              return { title: "题库", summary: `${state.questionBankQuestions.length} 题`, configured: state.questionBankQuestions.length > 0 }
            case "outcome":
              return { title: "成果评价", summary: `${state.outcomeEvalPoints.length} 个评价点`, configured: state.outcomeEvalPoints.length > 0 }
            case "homework":
              return { title: "作业", summary: `${state.homeworkEvalPoints.length} 个评价点`, configured: state.homeworkEvalPoints.length > 0 }
            case "quiz":
              return { title: "随堂测", summary: `${state.quizQuestions.length} 题`, configured: state.quizQuestions.length > 0 }
            default: return { title: "", summary: "", configured: false }
          }
        }

        const updateEvalSubject = (idx: number, updates: Partial<EvalSubjectConfig>) => {
          const newSubjects = [...state.evalSubjects]
          newSubjects[idx] = { ...newSubjects[idx], ...updates }
          updateState({ evalSubjects: newSubjects })
        }

        const updateMethodEvalSubject = (methodKey: string, idx: number, updates: Partial<EvalSubjectConfig>) => {
          const baseSubjects = state.methodEvalSubjects[methodKey] || state.evalSubjects
          const newSubjects = [...baseSubjects]
          newSubjects[idx] = { ...newSubjects[idx], ...updates }
          updateState({ methodEvalSubjects: { ...state.methodEvalSubjects, [methodKey]: newSubjects } })
        }

        type EvalPointField = "randomDrawEvalPoints" | "reviewEvalPoints" | "paperEvalPoints" | "questionBankEvalPoints" | "outcomeEvalPoints" | "homeworkEvalPoints" | "quizEvalPoints"

        const getEvalPoints = (field: EvalPointField) => {
          switch (field) {
            case "randomDrawEvalPoints": return state.randomDrawEvalPoints
            case "reviewEvalPoints": return state.reviewEvalPoints
            case "paperEvalPoints": return state.paperEvalPoints
            case "questionBankEvalPoints": return state.questionBankEvalPoints
            case "outcomeEvalPoints": return state.outcomeEvalPoints
            case "homeworkEvalPoints": return state.homeworkEvalPoints
            case "quizEvalPoints": return state.quizEvalPoints
          }
        }

        const setEvalPoints = (field: EvalPointField, points: EvalPoint[]) => {
          switch (field) {
            case "randomDrawEvalPoints": updateState({ randomDrawEvalPoints: points }); break
            case "reviewEvalPoints": updateState({ reviewEvalPoints: points }); break
            case "paperEvalPoints": updateState({ paperEvalPoints: points }); break
            case "questionBankEvalPoints": updateState({ questionBankEvalPoints: points }); break
            case "outcomeEvalPoints": updateState({ outcomeEvalPoints: points }); break
            case "homeworkEvalPoints": updateState({ homeworkEvalPoints: points }); break
            case "quizEvalPoints": updateState({ quizEvalPoints: points }); break
          }
        }

        const addEvalPoint = (field: EvalPointField, preset?: Partial<EvalPoint>) => {
          const name = preset ? (preset.name ?? newPointName.trim()) : newPointName.trim()
          if (!name && !preset) return
          const newPoint: EvalPoint = {
            id: `ep-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
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
          const arr = field === "randomDrawQuestions" ? state.randomDrawQuestions : field === "quizQuestions" ? state.quizQuestions : state.questionBankQuestions
          const exists = arr.includes(qid)
          const newArr = exists ? arr.filter(x => x !== qid) : [...arr, qid]
          if (field === "randomDrawQuestions") updateState({ randomDrawQuestions: newArr })
          else if (field === "quizQuestions") updateState({ quizQuestions: newArr })
          else updateState({ questionBankQuestions: newArr })
        }

        const addEvalPointFromAbility = (field: EvalPointField, abilityId: string, subType?: EvalSubType) => {
          const ab = abilityPoints.find(a => a.id === abilityId)
          if (!ab) return
          addEvalPoint(field, {
            name: ab.name,
            desc: ab.description || "",
            abilityPointIds: [ab.id],
            subType,
            scoringMethod: "level",
          })
        }

        const addEvalPointFromKnowledge = (field: EvalPointField, kpId: string, subType?: EvalSubType) => {
          const kp = knowledgePoints.find(k => k.id === kpId)
          if (!kp) return
          addEvalPoint(field, {
            name: kp.name,
            desc: kp.description || "",
            knowledgePointIds: [kp.id],
            subType,
            scoringMethod: "level",
          })
        }

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
                        <Input value={g.remark || ""} onChange={e => onChange(gradeMapping.map(x => x.id === g.id ? { ...x, remark: e.target.value } : x))} className="h-7 text-[10px] bg-white/70" placeholder="等级备注说明（一句话辅助教师参考）" />
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
                <SelectTrigger className="h-7 text-[10px] w-28">
                  <SelectValue placeholder="评分方式" />
                </SelectTrigger>
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
                    <DialogHeader><PrdAnnotation data={getAnnotation("dialog-link-ability")}><DialogTitle>关联能力点</DialogTitle></PrdAnnotation></DialogHeader>
                    <div className="relative mb-3">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input value={abSearchForEval} onChange={e => setAbSearchForEval(e.target.value)} placeholder="搜索能力点..." className="pl-9" />
                    </div>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {abilityPoints.filter(a => !abSearchForEval || a.name.includes(abSearchForEval)).map(a => {
                        const alreadyLinked = (ep.abilityPointIds || []).includes(a.id)
                        return (
                          <div key={a.id} onClick={() => {
                            if (alreadyLinked) return
                            updateEvalPoint(field, ep.id, { abilityPointIds: [...(ep.abilityPointIds || []), a.id] })
                          }} className={cn("p-2 rounded-lg border cursor-pointer text-sm", alreadyLinked ? "border-primary bg-primary/5 opacity-50" : "hover:border-gray-300")}>
                            <div className="flex items-center gap-2">
                              <span className="flex-1">{a.name}</span>
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
                    <DialogHeader><PrdAnnotation data={getAnnotation("dialog-link-knowledge")}><DialogTitle>关联知识点</DialogTitle></PrdAnnotation></DialogHeader>
                    <div className="relative mb-3">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input value={kpSearchForEval} onChange={e => setKpSearchForEval(e.target.value)} placeholder="搜索知识点..." className="pl-9" />
                    </div>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {knowledgePoints.filter(k => !kpSearchForEval || k.name.includes(kpSearchForEval)).map(k => {
                        const alreadyLinked = (ep.knowledgePointIds || []).includes(k.id)
                        return (
                          <div key={k.id} onClick={() => {
                            if (alreadyLinked) return
                            updateEvalPoint(field, ep.id, { knowledgePointIds: [...(ep.knowledgePointIds || []), k.id] })
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
              <LevelRuleEditor
                gradeMapping={ep.gradeMapping}
                onChange={gm => updateEvalPoint(field, ep.id, { gradeMapping: gm })}
              />
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
              {/* Collapsed header - always visible */}
              <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-gray-50 transition-colors"
              >
                {expanded ? <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" /> : <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />}
                <div className="flex items-center gap-1 shrink-0">
                  {pointTypes.length > 0 ? pointTypes.map(t => (
                    <Badge key={t} variant="outline" className={cn("text-[10px]", evalSubTypeColors[t])}>{evalSubTypeLabels[t]}</Badge>
                  )) : <Badge variant="outline" className="text-[10px]">未分类</Badge>}
                </div>
                <span className="text-sm text-gray-700 flex-1 truncate">{ep.name || "未命名评价点"}</span>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-red-500 shrink-0" onClick={e => { e.stopPropagation(); removeEvalPoint(field, ep.id); }}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </button>

              {/* Expanded content */}
              {expanded && (
                <div className="px-3 pb-3 border-t">
                  {/* 1. 评价点内容 */}
                  <div className="mt-2">
                    <Label className="text-xs text-gray-500">评价点内容</Label>
                    <Input value={ep.name} onChange={e => updateEvalPoint(field, ep.id, { name: e.target.value })} className="mt-1 h-8 text-sm" placeholder="输入评价点内容" />
                  </div>

                  {/* 2. 量规类型 */}
                  <div className="mt-2">
                    <Label className="text-xs text-gray-500">量规类型</Label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {(Object.keys(evalSubTypeLabels) as EvalSubType[]).map(type => {
                        const selected = pointTypes.includes(type)
                        return (
                          <button
                            key={type}
                            onClick={() => {
                              const current = ep.types || (ep.subType ? [ep.subType] : [])
                              const has = current.includes(type)
                              const newTypes = has ? current.filter(t => t !== type) : [...current, type]
                              updateEvalPoint(field, ep.id, { types: newTypes, subType: undefined })
                            }}
                            className={cn(
                              "px-2 py-0.5 rounded-full text-[10px] border transition-all",
                              selected ? cn(evalSubTypeColors[type], "border-current") : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                            )}
                          >
                            {evalSubTypeLabels[type]}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* 3. 关联能力点 */}
                  <div className="mt-2">
                    <Label className="text-xs text-gray-500">关联能力点</Label>
                    <div className="flex items-center gap-2 flex-wrap mt-1">
                      {(ep.abilityPointIds || []).map(abId => {
                        const ab = abilityPoints.find(a => a.id === abId)
                        return ab ? (
                          <Badge key={abId} variant="secondary" className="text-[10px] font-normal">
                            {ab.name}
                            <button onClick={() => updateEvalPoint(field, ep.id, { abilityPointIds: (ep.abilityPointIds || []).filter(id => id !== abId) })} className="ml-1 text-gray-400 hover:text-red-500">×</button>
                          </Badge>
                        ) : null
                      })}
                      <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2 text-gray-400 hover:text-primary" onClick={() => openRubricAbDialog(ep.id, field)}>+ 关联能力点</Button>
                    </div>
                  </div>

                  {/* 4. 关联知识点 */}
                  <div className="mt-2">
                    <Label className="text-xs text-gray-500">关联知识点</Label>
                    <div className="flex items-center gap-2 flex-wrap mt-1">
                      {(ep.knowledgePointIds || []).map(kpid => {
                        const kp = knowledgePoints.find(k => k.id === kpid)
                        return kp ? (
                          <Badge key={kpid} variant="secondary" className="text-[10px] font-normal">
                            {kp.name}
                            <button onClick={() => updateEvalPoint(field, ep.id, { knowledgePointIds: (ep.knowledgePointIds || []).filter(id => id !== kpid) })} className="ml-1 text-gray-400 hover:text-red-500">×</button>
                          </Badge>
                        ) : null
                      })}
                      <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2 text-gray-400 hover:text-primary" onClick={() => openRubricKpDialog(ep.id, field)}>+ 关联知识点</Button>
                    </div>
                  </div>

                  {/* 5. 评分规则 + 等级转换规则 */}
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

          // Group points by subType
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

              {/* Sub-type selector */}
              <div className="mb-4">
                <p className="text-xs text-gray-500 mb-2">选择细分类型并添加评价点</p>
                <div className="flex flex-wrap gap-1.5">
                  {subTypeKeys.map(st => {
                    const count = grouped[st]?.length || 0
                    const active = count > 0
                    return (
                      <button
                        key={st}
                        onClick={() => {
                          if (!active) {
                            // Add a blank eval point of this type
                            addEvalPoint(field, { subType: st, name: `${evalSubTypeLabels[st]}评价点` })
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
                {usedSubTypes.map(st => {
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
                        <div className="flex items-center gap-1">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2 text-gray-400 hover:text-primary" onClick={e => e.stopPropagation()}>
                                <Award className="h-3 w-3 mr-1" />能力点
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-md">
                              <DialogHeader><PrdAnnotation data={getAnnotation("dialog-eval-from-ability")}><DialogTitle>从能力点创建 — {evalSubTypeLabels[st]}</DialogTitle></PrdAnnotation></DialogHeader>
                              <div className="space-y-2 max-h-80 overflow-y-auto mt-2">
                                {abilityPoints.map(a => (
                                  <div key={a.id} onClick={() => addEvalPointFromAbility(field, a.id, st)} className="p-2.5 rounded-lg border cursor-pointer hover:border-gray-300 text-sm">
                                    <div className="flex items-center gap-2">
                                      <span className="flex-1 font-medium">{a.name}</span>
                                      {a.code && <Badge variant="outline" className="text-[10px]">{a.code}</Badge>}
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1 line-clamp-1">{a.description}</p>
                                  </div>
                                ))}
                              </div>
                            </DialogContent>
                          </Dialog>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2 text-gray-400 hover:text-primary" onClick={e => e.stopPropagation()}>
                                <Lightbulb className="h-3 w-3 mr-1" />知识点
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-md">
                              <DialogHeader><PrdAnnotation data={getAnnotation("dialog-eval-from-knowledge")}><DialogTitle>从知识点创建 — {evalSubTypeLabels[st]}</DialogTitle></PrdAnnotation></DialogHeader>
                              <div className="space-y-2 max-h-80 overflow-y-auto mt-2">
                                {knowledgePoints.map(k => (
                                  <div key={k.id} onClick={() => addEvalPointFromKnowledge(field, k.id, st)} className="p-2.5 rounded-lg border cursor-pointer hover:border-gray-300 text-sm">
                                    <div className="flex items-center gap-2">
                                      <span className="flex-1 font-medium">{k.name}</span>
                                      {k.code && <Badge variant="outline" className="text-[10px]">{k.code}</Badge>}
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1 line-clamp-1">{k.description}</p>
                                  </div>
                                ))}
                              </div>
                            </DialogContent>
                          </Dialog>
                          <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2 text-gray-400 hover:text-primary" onClick={e => { e.stopPropagation(); addEvalPoint(field, { subType: st, name: "" }); }}>
                            <Plus className="h-3 w-3 mr-1" />手动添加
                          </Button>
                        </div>
                      </button>
                      {expanded && (
                        <div className="p-3 space-y-2 border-t">
                          {eps.map(ep => <EvalPointCard key={ep.id} ep={ep} field={field} />)}
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
                        {grouped["uncategorized"].map(ep => <EvalPointCard key={ep.id} ep={ep} field={field} />)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        }

        const questionTypeLabels: Record<string, string> = {
          single: "单选",
          multiple: "多选",
          judgment: "判断",
          short_answer: "简答",
          essay: "问答题",
          fill_blank: "填空",
        }

        const difficultyLabels: Record<string, string> = {
          easy: "简单",
          medium: "中等",
          hard: "困难",
        }

        const QuestionSelectorPanel = ({ field, selectedIds, showAutoSelect = false, maxCount, questionScores, onUpdateQuestionScore }: { field: "randomDrawQuestions" | "questionBankQuestions" | "quizQuestions", selectedIds: string[], showAutoSelect?: boolean, maxCount?: number, questionScores?: Record<string, number>, onUpdateQuestionScore?: (qid: string, score: number) => void }) => {
          const filteredQuestions = allQuestions.filter(q => {
            const matchTab = questionTab === "my" ? q.source === "my" : questionTab === "collab" ? q.source === "collab" : q.source === "public"
            const matchSearch = !questionSearch || q.name.includes(questionSearch) || q.content.includes(questionSearch)
            return matchTab && matchSearch
          })

          return (
            <div className="flex gap-4 flex-1 min-h-0">
              {/* Left column */}
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
                  <Button onClick={() => setShowAddQuestion(true)}>
                    <Plus className="h-4 w-4 mr-1" />新增题目
                  </Button>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {filteredQuestions.length === 0 ? (
                    <div className="text-center text-gray-400 py-8">
                      <FileQuestion className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">暂无题目</p>
                    </div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0 z-10">
                        <tr>
                          <th className="text-left text-xs font-medium text-gray-500 px-3 py-2 w-[30%]">题目名称</th>
                          <th className="text-left text-xs font-medium text-gray-500 px-3 py-2 w-[12%]">题目类型</th>
                          <th className="text-left text-xs font-medium text-gray-500 px-3 py-2 w-[12%]">题目难度</th>
                          <th className="text-left text-xs font-medium text-gray-500 px-3 py-2 w-[15%]">所属题库</th>
                          <th className="text-right text-xs font-medium text-gray-500 px-3 py-2 w-[31%]">操作</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {filteredQuestions.map(q => {
                          const isSelected = selectedIds.includes(q.id)
                          return (
                            <tr key={q.id} className={cn("hover:bg-gray-50 transition-colors cursor-pointer", isSelected ? "bg-primary/[0.03]" : "")} onClick={() => toggleQuestion(q.id, field)}>
                              <td className="px-3 py-2">
                                <div className="flex items-center gap-2">
                                  <div className={cn("w-4 h-4 rounded border flex items-center justify-center shrink-0", isSelected ? "bg-primary border-primary" : "border-gray-300")}>
                                    {isSelected && <Check className="h-3 w-3 text-white" />}
                                  </div>
                                  <span className="text-sm font-medium text-gray-800 line-clamp-1">{q.name}</span>
                                </div>
                              </td>
                              <td className="px-3 py-2">
                                <Badge className={`text-xs text-white hover:opacity-90 ${typeColorMap[q.type] || ""}`}>{questionTypeLabels[q.type] || q.type}</Badge>
                              </td>
                              <td className="px-3 py-2">
                                <span className="text-xs text-gray-500">{difficultyLabels[q.difficulty] || q.difficulty}</span>
                              </td>
                              <td className="px-3 py-2">
                                <span className="text-xs text-gray-500">{questionBankLabels[(q as any).questionBank] || (q as any).questionBank || "-"}</span>
                              </td>
                              <td className="px-3 py-2">
                                <div className="flex items-center justify-end gap-1">
                                  <PrdAnnotation data={getAnnotation("dialog-question-detail")}>
                                    <Button variant="ghost" size="sm" className="h-6 text-[11px] px-1.5 text-gray-500 hover:text-primary" onClick={e => { e.stopPropagation(); setSelectedQuestionForDetail(q.id); setQuestionDetailOpen(true) }}>
                                      查看详情
                                    </Button>
                                  </PrdAnnotation>
                                  {isSelected ? (
                                    <PrdAnnotation data={getAnnotation("qb-action-cancel")}>
                                      <Button size="sm" variant="outline" className="h-6 text-[11px] px-2" onClick={e => { e.stopPropagation(); toggleQuestion(q.id, field) }}>
                                        取消
                                      </Button>
                                    </PrdAnnotation>
                                  ) : (
                                    <PrdAnnotation data={getAnnotation("qb-action-select")}>
                                      <Button size="sm" className="h-6 text-[11px] px-2" onClick={e => { e.stopPropagation(); toggleQuestion(q.id, field) }}>
                                        使用
                                      </Button>
                                    </PrdAnnotation>
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

              {/* Right column */}
              <div className="w-2/5 border rounded-xl p-3 flex flex-col min-h-0">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium text-gray-700">已选择题目 ({selectedIds.length}{maxCount ? `/${maxCount}` : ""})</p>
                  {showAutoSelect && (
                    <Button variant="outline" size="sm" className="h-7 text-[11px] px-2" onClick={() => alert("参考测评认证中心-试卷管理-自动抽题功能即可")}>
                      自动选择
                    </Button>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto">
                  {selectedIds.length === 0 ? (
                    <div className="text-center text-gray-400 py-8">
                      <FileQuestion className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-xs">从左侧搜索并选择题目</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {selectedIds.map(qid => {
                        const q = allQuestions.find(aq => aq.id === qid)
                        if (!q) return null
                        return (
                          <div key={qid} className="p-2.5 rounded-lg border border-primary/20 bg-primary/5 relative">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-medium flex-1 truncate">{q.name}</span>
                              <Button variant="ghost" size="icon" className="h-5 w-5 text-gray-400 -mr-1 -mt-1" onClick={() => toggleQuestion(qid, field)}>
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                            <div className="flex items-center gap-1.5">
                      <Badge className={`text-[10px] text-white hover:opacity-90 ${typeColorMap[q.type] || ""}`}>{questionTypeLabels[q.type] || q.type}</Badge>
                              <span className="text-[10px] text-gray-400">{difficultyLabels[q.difficulty] || q.difficulty}</span>
                              {onUpdateQuestionScore ? (
                                <div className="flex items-center gap-1 ml-auto">
                                  <span className="text-[10px] text-gray-400">分值</span>
                                  <Input
                                    type="number"
                                    value={questionScores?.[qid] ?? q.score}
                                    onChange={e => {
                                      const val = Math.max(0, Math.min(100, parseInt(e.target.value) || 0))
                                      onUpdateQuestionScore(qid, val)
                                    }}
                                    className="w-14 h-5 text-[10px] px-1 py-0"
                                    min={0}
                                    max={100}
                                  />
                                </div>
                              ) : (
                                <span className="text-[10px] text-gray-400">{q.score}分</span>
                              )}
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

        // Local-textarea: prevents parent re-render on keystroke, syncs on blur
        const LocalTextarea = ({ id, defaultValue, onBlurSync, ...rest }: any) => {
          const ref = useRef<HTMLTextAreaElement>(null)
          useEffect(() => { if (ref.current && defaultValue != null) ref.current.value = defaultValue }, [id])
          return (
            <textarea
              ref={ref}
              defaultValue={defaultValue}
              className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              onBlur={() => { if (ref.current && onBlurSync) onBlurSync(ref.current.value) }}
              {...rest}
            />
          )
        }

        // Resource-only panel (no eval points)
        const EvalResourceOnlyPanel = ({ methodKey }: { methodKey: string }) => {
          if (methodKey === "random_draw") {
            const rdqMajorOptions = ["全部", "经济学", "物流管理", "机械工程", "计算机科学", "电子信息", "工商管理", "会计学", "市场营销", "土木工程", "英语", "法学"]
            const [rdqMajorTab, setRdqMajorTab] = useState("全部")
            const [rdqDrawMode, setRdqDrawMode] = useState<"random" | "manual">("random")
            const [rdqDrawCount, setRdqDrawCount] = useState(5)
            const filteredRdq = state.randomDrawCustomQuestions.filter(q => {
              const matchMajor = rdqMajorTab === "全部" || q.major === rdqMajorTab
              const matchSearch = !rdqSearch || q.name.includes(rdqSearch) || q.description.includes(rdqSearch) || q.major.includes(rdqSearch)
              return matchMajor && matchSearch
            })

            const handleAddRdq = () => {
              setNewRdqForm({ name: "", description: "", answer: "", major: "" })
              setRdqActionMode("add")
              setRdqActionTarget(null)
              setRdqActionOpen(true)
            }

            const handleEditRdq = (q: typeof state.randomDrawCustomQuestions[0]) => {
              setNewRdqForm({ name: q.name, description: q.description, answer: q.answer, major: q.major })
              setRdqActionMode("edit")
              setRdqActionTarget(q)
              setRdqActionOpen(true)
            }

            const handleSaveRdq = () => {
              if (!newRdqForm.name.trim()) return
              if (rdqActionMode === "edit" && rdqActionTarget) {
                updateState({
                  randomDrawCustomQuestions: state.randomDrawCustomQuestions.map(q =>
                    q.id === rdqActionTarget.id ? { ...q, name: newRdqForm.name.trim(), description: newRdqForm.description.trim(), answer: newRdqForm.answer.trim(), major: newRdqForm.major.trim() } : q
                  )
                })
                setRdqActionOpen(false)
                return
              }
              const newId = `rdq-${Date.now()}`
              const newQ = {
                id: newId,
                name: newRdqForm.name.trim(),
                description: newRdqForm.description.trim(),
                answer: newRdqForm.answer.trim(),
                major: newRdqForm.major.trim(),
              }
              updateState({ randomDrawCustomQuestions: [...state.randomDrawCustomQuestions, newQ] })
              setRdqActionOpen(false)
              setRdqSearch("")
            }

            const handleDeleteRdq = (id: string) => {
              updateState({
                randomDrawCustomQuestions: state.randomDrawCustomQuestions.filter(q => q.id !== id),
                randomDrawSelectedIds: state.randomDrawSelectedIds.filter(sid => sid !== id)
              })
            }

            const handleToggleSelect = (id: string) => {
              const isSelected = state.randomDrawSelectedIds.includes(id)
              if (isSelected) {
                updateState({ randomDrawSelectedIds: state.randomDrawSelectedIds.filter(sid => sid !== id) })
              } else {
                updateState({ randomDrawSelectedIds: [...state.randomDrawSelectedIds, id] })
              }
            }

            const selectedRdqList = state.randomDrawSelectedIds.map(id => state.randomDrawCustomQuestions.find(q => q.id === id)).filter(Boolean) as typeof state.randomDrawCustomQuestions

            return (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex items-center gap-3 mb-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input value={rdqSearch} onChange={e => setRdqSearch(e.target.value)} placeholder="搜索现场问答题名称、描述或适用专业..." className="pl-9" />
                  </div>
                  <Button onClick={handleAddRdq}>
                    <Plus className="h-4 w-4 mr-1" />新增现场问答题
                  </Button>
                </div>

                <div className="flex gap-4 flex-1 min-h-0">
                  {/* Left: All questions */}
                  <div className="w-3/5 flex flex-col min-h-0 border rounded-xl p-3">
                    <div className="flex items-center gap-1 mb-2">
                      {rdqMajorOptions.map(opt => (
                        <button
                          key={opt}
                          onClick={() => setRdqMajorTab(opt)}
                          className={cn(
                            "px-2.5 py-1 rounded-md text-[11px] transition-all",
                            rdqMajorTab === opt
                              ? "bg-primary/10 text-primary font-medium"
                              : "text-gray-500 hover:bg-gray-100"
                          )}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                    <p className="text-sm font-medium mb-2 text-gray-700">
                      {rdqSearch ? `搜索结果 (${filteredRdq.length})` : (rdqMajorTab === "全部" ? "全部现场问答题" : `${rdqMajorTab}相关现场问答题`)}
                    </p>
                    <div className="flex-1 overflow-y-auto pr-1">
                      {filteredRdq.length === 0 ? (
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
                                    <Badge variant="secondary" className="text-[10px]">{q.major || "-"}</Badge>
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
                  <div className="w-2/5 border rounded-xl p-3 flex flex-col min-h-0">
                    <p className="text-sm font-medium mb-3 text-gray-700">已配置现场问答题 ({selectedRdqList.length})</p>
                    <div className="flex-1 overflow-y-auto">
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
                              <Badge variant="outline" className="text-[9px] mt-1 font-normal px-1 py-0 h-4">{q.major || "通用"}</Badge>
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
                      <Select value={rdqDrawMode} onValueChange={v => setRdqDrawMode(v as "random" | "manual")}>
                        <SelectTrigger className="mt-1 text-sm h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="random">系统随机分配</SelectItem>
                          <SelectItem value="manual">老师手动选择</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">抽题数量</Label>
                      <Input type="number" value={rdqDrawCount} onChange={e => setRdqDrawCount(Math.max(1, parseInt(e.target.value) || 1))} className="mt-1 text-sm" min={1} />
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
                        <Select value={newRdqForm.major} onValueChange={v => setNewRdqForm({ ...newRdqForm, major: v })}>
                          <SelectTrigger className="mt-1.5"><SelectValue placeholder="选择适用专业" /></SelectTrigger>
                          <SelectContent>
                            {rdqMajorOptions.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
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
                            <Badge variant="secondary" className="text-[10px] mt-1">{q.major || "通用"}</Badge>
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
                      <Switch checked={mockResReview.requiresMaterial} onCheckedChange={v => setMockResReview({ ...mockResReview, requiresMaterial: v })} />
                      <span className="text-xs text-gray-600">是否需要提交评审材料</span>
                    </div>
                  </div>
                  {mockResReview.requiresMaterial && (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs text-gray-500">预估提交天数</Label>
                          <Input type="number" value={mockResReview.deadlineDays} onChange={e => setMockResReview({ ...mockResReview, deadlineDays: Math.max(1, parseInt(e.target.value) || 1) })} className="mt-1 text-sm" min={1} />
                        </div>
                      </div>
                      <div className="mt-3">
                        <Label className="text-xs text-gray-500 mb-1.5">提交材料要求</Label>
                        <LocalTextarea
                            id="review-desc-' + '{methodKey}' + '"
                            defaultValue={mockResReview.submitFormatDesc}
                            placeholder="请用一句话说明学生需要提交的材料要求..."
                            rows={2}
                            onBlurSync={(v: string) => setMockResReview({ ...mockResReview, submitFormatDesc: v })}
                        />
                      </div>
                    </>
                  )}
                  <div className="mt-3">
                    <Label className="text-xs text-gray-500 mb-1.5">评审场地/环境资源准备</Label>
                    <LocalTextarea
                      defaultValue={mockResReview.venueResources}
                      onBlurSync={(v: string) => setMockResReview({ ...mockResReview, venueResources: v })}
                      placeholder="请描述评审所需的场地、设备及环境资源准备要求..."
                      rows={2}
                      className="text-sm"
                    />
                  </div>
                  <div className="mt-3">
                    <div className="flex items-center gap-2">
                      <Switch checked={mockResReview.allowResubmit} onCheckedChange={v => setMockResReview({ ...mockResReview, allowResubmit: v })} />
                      <span className="text-xs text-gray-600">允许重新提交</span>
                    </div>
                  </div>
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
                    {reviewSteps.map((step, i) => (
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
          if (methodKey === "paper") {
            const paperCfg = state.methodResourceConfigs.paper || {}
            const setPaperCfg = (patch: any) => updateState({ methodResourceConfigs: { ...state.methodResourceConfigs, paper: { ...paperCfg, ...patch } } })

            const selectPaper = (paperId: string) => {
              updateState({ paperIds: [paperId], paperWeights: { [paperId]: 100 } })
            }

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
                    {loadedExams.filter(p => !pSearch || p.name.includes(pSearch)).map(paper => {
                      const selected = state.paperIds.includes(paper.id)
                      const questionCount = paper.questions?.length ?? paper.questionCount ?? 0
                      const totalScore = paper.totalScore ?? 100
                      return (
                        <div key={paper.id} onClick={() => selectPaper(paper.id)} className={cn("p-4 rounded-lg border cursor-pointer", selected ? "border-primary bg-primary/5" : "hover:border-gray-300")}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={cn("w-4 h-4 rounded-full border flex items-center justify-center shrink-0", selected ? "bg-primary border-primary" : "border-gray-300")}>{selected && <div className="w-2 h-2 rounded-full bg-white" />}</div>
                              <div>
                                <p className="text-sm font-medium">{paper.name}</p>
                                <div className="flex items-center gap-1.5 mt-1">
                                  <Badge className="text-[10px] bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-50">{questionCount} 题</Badge>
                                  <Badge className="text-[10px] bg-green-50 text-green-600 border-green-200 hover:bg-green-50">总分 {totalScore}</Badge>
                                </div>
                              </div>
                            </div>
                            <Button variant="ghost" size="sm" className="h-7 text-[11px] px-2 text-gray-400 hover:text-primary" onClick={e => { e.stopPropagation(); setSelectedPaperForDetail(paper.id); setPaperDetailOpen(true); }}>
                              查看详情
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                    {loadedExams.length === 0 && !pSearch && (
                      <div className="text-center py-8 text-gray-400">
                        <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">暂无可选试卷</p>
                        <p className="text-xs mt-1">请点击「新建试卷」创建试卷，或在测评中心准备试卷后刷新</p>
                      </div>
                    )}
                    {loadedExams.length > 0 && loadedExams.filter(p => !pSearch || p.name.includes(pSearch)).length === 0 && (
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
                      <Input type="number" value={paperCfg.duration ?? 60} onChange={e => setPaperCfg({ duration: Math.max(5, parseInt(e.target.value) || 5) })} className="mt-1 text-sm" min={5} />
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
                            className="mt-1 text-sm"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-gray-500">停用时间</Label>
                          <Input
                            type="datetime-local"
                            value={paperCfg.scheduledEndTime ?? ""}
                            onChange={e => setPaperCfg({ scheduledEndTime: e.target.value })}
                            className="mt-1 text-sm"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {/* Exam Question Config Dialog */}
              <Dialog open={!!configPaperId} onOpenChange={(v) => { if (!v) { setConfigPaperId(null); setConfigSelectedIds([]) } }}>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>试卷创建成功</DialogTitle>
                    <DialogDescription>
                      试卷「{loadedExams.find(e => e.id === configPaperId)?.name || ""}」已创建并选中。
                      你可以在试卷管理页面中配置题目、分数等。
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-4 text-center text-gray-500 text-sm">
                    前往试卷管理页面配置题目（自动抽题、手动抽题、新增题目、分数配置）
                  </div>
                  <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => { setConfigPaperId(null); setConfigSelectedIds([]) }}>
                      稍后配置
                    </Button>
                    <Button onClick={() => {
                      const id = configPaperId
                      setConfigPaperId(null)
                      setConfigSelectedIds([])
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
          if (methodKey === "question_bank") {
            const qbCfg = state.methodResourceConfigs.question_bank || {}
            const setQbCfg = (patch: any) => updateState({ methodResourceConfigs: { ...state.methodResourceConfigs, question_bank: { ...qbCfg, ...patch } } })
            const [qbDrawMode, setQbDrawMode] = useState<"all" | "practice">((qbCfg.drawMode as "all" | "practice") ?? "all")
            const [qbPassRate, setQbPassRate] = useState(qbCfg.passRate ?? 60)

            return (
              <div className="space-y-4">
                <BankQuestionSelectorPanel
                  field="questionBankQuestions"
                  selectedIds={state.questionBankQuestions}
                  onToggleQuestion={(qid) => toggleQuestion(qid, "questionBankQuestions")}
                  questionScores={state.methodResourceConfigs?.question_bank?.questionScores || {}}
                  onUpdateQuestionScore={(qid, score) => updateState({ methodResourceConfigs: { ...state.methodResourceConfigs, question_bank: { ...(state.methodResourceConfigs.question_bank || {}), questionScores: { ...(state.methodResourceConfigs.question_bank?.questionScores || {}), [qid]: score } } } })}
                  onUpdateQuestionScores={(scores) => updateState({ methodResourceConfigs: { ...state.methodResourceConfigs, question_bank: { ...(state.methodResourceConfigs.question_bank || {}), questionScores: { ...(state.methodResourceConfigs.question_bank?.questionScores || {}), ...scores } } } })}
                />
                <div className="border rounded-xl p-4">
                  <p className="text-sm font-medium mb-3">答题规则</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-gray-500">答题方式</Label>
                      <Select value={qbDrawMode} onValueChange={v => { setQbDrawMode(v as "all" | "practice"); setQbCfg({ drawMode: v }) }}>
                        <SelectTrigger className="mt-1 text-sm h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">全部作答</SelectItem>
                          <SelectItem value="practice">自由刷题</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {qbDrawMode === "practice" && (
                      <div>
                        <Label className="text-xs text-gray-500">正确率（%）</Label>
                        <Input type="number" value={qbPassRate} onChange={e => { const val = Math.max(0, Math.min(100, parseInt(e.target.value) || 0)); setQbPassRate(val); setQbCfg({ passRate: val }) }} className="mt-1 text-sm" min={0} max={100} />
                        <p className="text-[10px] text-gray-400 mt-1">超过正确率则得分 100，低于正确率得分 0</p>
                      </div>
                    )}
                    <div>
                      <Label className="text-xs text-gray-500">时间限制（分钟）</Label>
                      <Input type="number" value={qbCfg.timeLimit ?? 90} onChange={e => setQbCfg({ timeLimit: Math.max(5, parseInt(e.target.value) || 5) })} className="mt-1 text-sm" min={5} />
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Switch checked={qbCfg.allowRetake ?? false} onCheckedChange={v => setQbCfg({ allowRetake: v })} />
                      <span className="text-xs text-gray-600">允许重复测评</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={qbCfg.shuffleQuestions ?? true} onCheckedChange={v => setQbCfg({ shuffleQuestions: v })} />
                      <span className="text-xs text-gray-600">题目乱序</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={qbCfg.showResult ?? true} onCheckedChange={v => setQbCfg({ showResult: v })} />
                      <span className="text-xs text-gray-600">提交后展示成绩</span>
                    </div>
                  </div>
                  {(qbCfg.allowRetake ?? false) && (
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-gray-500">最多重考次数</Label>
                        <Input type="number" value={qbCfg.retakeCount ?? 1} onChange={e => setQbCfg({ retakeCount: Math.max(1, parseInt(e.target.value) || 1) })} className="mt-1 text-sm" min={1} />
                      </div>
                    </div>
                  )}
                  <div className="mt-4 pt-4 border-t">
                    <Label className="text-xs text-gray-500 mb-2">测评启用条件</Label>
                    <div className="space-y-2 mt-1">
                      {[
                        { key: "manual", label: "后台手动启用", desc: `老师手动开启后，学生才能进入作答。每位学生从点击「开始答题」时起，计时 ${qbCfg.timeLimit ?? 90} 分钟，时间结束系统将自动提交。` },
                        { key: "scheduled", label: "定时启用", desc: "提前预设测评的开始、结束时间。到开始时间后，学生方可进入作答；从开始时间起按测评时长计时，到预设结束时间自动关闭并提交。" },
                        { key: "always", label: "随时作答", desc: "测评创建完成后立即开放，学生可随时进入作答。学生从点击「开始答题」时起按设定时长计时，时间结束系统将自动提交。" },
                      ].map(mode => (
                        <button
                          key={mode.key}
                          onClick={() => setQbCfg({ activationMode: mode.key })}
                          className={cn(
                            "w-full text-left p-3 rounded-lg border transition-all",
                            (qbCfg.activationMode ?? "manual") === mode.key
                              ? "border-primary bg-primary/5 text-primary"
                              : "border-gray-200 text-gray-600 hover:border-gray-300"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <div className={cn("w-4 h-4 rounded-full border flex items-center justify-center shrink-0", (qbCfg.activationMode ?? "manual") === mode.key ? "bg-primary border-primary" : "border-gray-300")}>
                              {(qbCfg.activationMode ?? "manual") === mode.key && <div className="w-2 h-2 rounded-full bg-white" />}
                            </div>
                            <span className="text-xs font-medium">{mode.label}</span>
                          </div>
                          <p className="text-[11px] text-gray-400 mt-1 ml-6">{mode.desc}</p>
                        </button>
                      ))}
                    </div>
                    {(qbCfg.activationMode ?? "manual") === "scheduled" && (
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs text-gray-500">启用时间</Label>
                          <Input type="datetime-local" value={qbCfg.scheduledTime ?? ""} onChange={e => setQbCfg({ scheduledTime: e.target.value })} className="mt-1 text-sm" />
                        </div>
                        <div>
                          <Label className="text-xs text-gray-500">停用时间</Label>
                          <Input type="datetime-local" value={qbCfg.scheduledEndTime ?? ""} onChange={e => setQbCfg({ scheduledEndTime: e.target.value })} className="mt-1 text-sm" />
                        </div>
                      </div>
                    )}
                  </div>
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
                      <Switch checked={mockResOutcome.requiresMaterial} onCheckedChange={v => setMockResOutcome({ ...mockResOutcome, requiresMaterial: v })} />
                      <span className="text-xs text-gray-600">是否需要提交成果材料</span>
                    </div>
                  </div>
                  {mockResOutcome.requiresMaterial && (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs text-gray-500">预估提交天数</Label>
                          <Input type="number" value={mockResOutcome.deadlineDays} onChange={e => setMockResOutcome({ ...mockResOutcome, deadlineDays: Math.max(1, parseInt(e.target.value) || 1) })} className="mt-1 text-sm" min={1} />
                        </div>
                      </div>
                      <div className="mt-3">
                        <Label className="text-xs text-gray-500 mb-1.5">提交材料要求</Label>
                        <LocalTextarea
                          defaultValue={mockResOutcome.submitFormatDesc}
                          onBlurSync={(v: string) => setMockResOutcome({ ...mockResOutcome, submitFormatDesc: v })}
                          placeholder="请用一句话说明学生需要提交的成果材料要求..."
                          rows={2}
                          className="text-sm"
                        />
                      </div>
                    </>
                  )}
                  <div className="mt-3">
                    <Label className="text-xs text-gray-500 mb-1.5">评价场地/环境资源准备</Label>
                    <LocalTextarea
                      defaultValue={mockResOutcome.venueResources}
                      onBlurSync={(v: string) => setMockResOutcome({ ...mockResOutcome, venueResources: v })}
                      placeholder="请描述评价所需的场地、设备及环境资源准备要求..."
                      rows={2}
                      className="text-sm"
                    />
                  </div>
                  <div className="mt-3">
                    <div className="flex items-center gap-2">
                      <Switch checked={mockResOutcome.allowResubmit} onCheckedChange={v => setMockResOutcome({ ...mockResOutcome, allowResubmit: v })} />
                      <span className="text-xs text-gray-600">允许重新提交</span>
                    </div>
                  </div>
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
                      <Switch checked={mockResHomework.requiresMaterial} onCheckedChange={v => setMockResHomework({ ...mockResHomework, requiresMaterial: v })} />
                      <span className="text-xs text-gray-600">是否需要提交作业材料</span>
                    </div>
                  </div>
                  {mockResHomework.requiresMaterial && (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs text-gray-500">预估提交天数</Label>
                          <Input type="number" value={mockResHomework.deadlineDays} onChange={e => setMockResHomework({ ...mockResHomework, deadlineDays: Math.max(1, parseInt(e.target.value) || 1) })} className="mt-1 text-sm" min={1} />
                        </div>
                      </div>
                      <div className="mt-3">
                        <Label className="text-xs text-gray-500 mb-1.5">作业格式要求</Label>
                        <LocalTextarea
                          defaultValue={mockResHomework.submitFormatDesc}
                          onBlurSync={(v: string) => setMockResHomework({ ...mockResHomework, submitFormatDesc: v })}
                          placeholder="请用一句话说明学生需要提交的作业格式要求..."
                          rows={2}
                          className="text-sm"
                        />
                      </div>
                    </>
                  )}
                  <div className="mt-3">
                    <Label className="text-xs text-gray-500 mb-1.5">作业场地/环境资源准备</Label>
                    <LocalTextarea
                      defaultValue={mockResHomework.venueResources}
                      onBlurSync={(v: string) => setMockResHomework({ ...mockResHomework, venueResources: v })}
                      placeholder="请描述作业所需的场地、设备及环境资源准备要求..."
                      rows={2}
                      className="text-sm"
                    />
                  </div>
                  <div className="mt-3">
                    <div className="flex items-center gap-2">
                      <Switch checked={mockResHomework.allowResubmit} onCheckedChange={v => setMockResHomework({ ...mockResHomework, allowResubmit: v })} />
                      <span className="text-xs text-gray-600">允许重新提交</span>
                    </div>
                  </div>
                </div>
              </div>
            )
          }
          if (methodKey === "quiz") {
            const quizCfg = state.methodResourceConfigs.quiz || {}
            const setQuizCfg = (patch: any) => updateState({ methodResourceConfigs: { ...state.methodResourceConfigs, quiz: { ...quizCfg, ...patch } } })
            const quizPresetTimes = [5, 10, 15, 20, 30]
            const quizTimeLimit = quizCfg.timeLimit ?? 90
            const quizIsPreset = quizPresetTimes.includes(quizTimeLimit)
            return (
              <div className="space-y-4">
                <BankQuestionSelectorPanel
                  field="quizQuestions"
                  selectedIds={state.quizQuestions}
                  maxCount={30}
                  onToggleQuestion={(qid) => toggleQuestion(qid, "quizQuestions")}
                  questionScores={state.methodResourceConfigs?.quiz?.questionScores || {}}
                  onUpdateQuestionScore={(qid, score) => updateState({ methodResourceConfigs: { ...state.methodResourceConfigs, quiz: { ...(state.methodResourceConfigs.quiz || {}), questionScores: { ...(state.methodResourceConfigs.quiz?.questionScores || {}), [qid]: score } } } })}
                  onUpdateQuestionScores={(scores) => updateState({ methodResourceConfigs: { ...state.methodResourceConfigs, quiz: { ...(state.methodResourceConfigs.quiz || {}), questionScores: { ...(state.methodResourceConfigs.quiz?.questionScores || {}), ...scores } } } })}
                />
                <div className="border rounded-xl p-4">
                  <p className="text-sm font-medium mb-3">答题规则</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-gray-500">时间限制</Label>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {quizPresetTimes.map(min => (
                          <button
                            key={min}
                            onClick={() => setQuizCfg({ timeLimit: min })}
                            className={cn(
                              "px-3 py-1.5 rounded-lg text-xs border transition-all",
                              quizTimeLimit === min && quizIsPreset
                                ? "border-primary bg-primary/5 text-primary"
                                : "border-gray-200 text-gray-600 hover:border-gray-300"
                            )}
                          >
                            {min} 分钟
                          </button>
                        ))}
                        <button
                          onClick={() => setQuizCfg({ timeLimit: quizIsPreset ? 1 : quizTimeLimit })}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-xs border transition-all",
                            !quizIsPreset && quizTimeLimit > 0
                              ? "border-primary bg-primary/5 text-primary"
                              : "border-gray-200 text-gray-600 hover:border-gray-300"
                          )}
                        >
                          自定义
                        </button>
                      </div>
                      {!quizIsPreset && (
                        <div className="mt-2">
                          <Input
                            type="number"
                            value={quizTimeLimit}
                            onChange={e => {
                              const val = Math.max(1, parseInt(e.target.value) || 1)
                              setQuizCfg({ timeLimit: val })
                            }}
                            className="w-32 text-sm"
                            min={1}
                            placeholder="输入分钟数"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Switch checked={quizCfg.allowRetake ?? false} onCheckedChange={v => setQuizCfg({ allowRetake: v })} />
                      <span className="text-xs text-gray-600">允许重复测评</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={quizCfg.shuffleQuestions ?? true} onCheckedChange={v => setQuizCfg({ shuffleQuestions: v })} />
                      <span className="text-xs text-gray-600">题目乱序</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={quizCfg.showResult ?? true} onCheckedChange={v => setQuizCfg({ showResult: v })} />
                      <span className="text-xs text-gray-600">提交后展示成绩</span>
                    </div>
                  </div>
                  {(quizCfg.allowRetake ?? false) && (
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-gray-500">最多重考次数</Label>
                        <Input type="number" value={quizCfg.retakeCount ?? 1} onChange={e => setQuizCfg({ retakeCount: Math.max(1, parseInt(e.target.value) || 1) })} className="mt-1 text-sm" min={1} />
                      </div>
                    </div>
                  )}
                  <div className="mt-4 pt-4 border-t">
                    <Label className="text-xs text-gray-500 mb-2">测评启用条件</Label>
                    <div className="space-y-2 mt-1">
                      {[
                        { key: "manual", label: "后台手动启用", desc: `老师手动开启后，学生才能进入作答。每位学生从点击「开始答题」时起，计时 ${quizCfg.timeLimit ?? 90} 分钟，时间结束系统将自动提交。` },
                        { key: "scheduled", label: "定时启用", desc: "提前预设测评的开始、结束时间。到开始时间后，学生方可进入作答；从开始时间起按测评时长计时，到预设结束时间自动关闭并提交。" },
                        { key: "always", label: "随时作答", desc: "测评创建完成后立即开放，学生可随时进入作答。学生从点击「开始答题」时起按设定时长计时，时间结束系统将自动提交。" },
                      ].map(mode => (
                        <button
                          key={mode.key}
                          onClick={() => setQuizCfg({ activationMode: mode.key })}
                          className={cn(
                            "w-full text-left p-3 rounded-lg border transition-all",
                            (quizCfg.activationMode ?? "manual") === mode.key
                              ? "border-primary bg-primary/5 text-primary"
                              : "border-gray-200 text-gray-600 hover:border-gray-300"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <div className={cn("w-4 h-4 rounded-full border flex items-center justify-center shrink-0", (quizCfg.activationMode ?? "manual") === mode.key ? "bg-primary border-primary" : "border-gray-300")}>
                              {(quizCfg.activationMode ?? "manual") === mode.key && <div className="w-2 h-2 rounded-full bg-white" />}
                            </div>
                            <span className="text-xs font-medium">{mode.label}</span>
                          </div>
                          <p className="text-[11px] text-gray-400 mt-1 ml-6">{mode.desc}</p>
                        </button>
                      ))}
                    </div>
                    {(quizCfg.activationMode ?? "manual") === "scheduled" && (
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs text-gray-500">启用时间</Label>
                          <Input type="datetime-local" value={quizCfg.scheduledTime ?? ""} onChange={e => setQuizCfg({ scheduledTime: e.target.value })} className="mt-1 text-sm" />
                        </div>
                        <div>
                          <Label className="text-xs text-gray-500">停用时间</Label>
                          <Input type="datetime-local" value={quizCfg.scheduledEndTime ?? ""} onChange={e => setQuizCfg({ scheduledEndTime: e.target.value })} className="mt-1 text-sm" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          }
          return null
        }

        const getMethodEvalInfo = (methodKey: string) => {
          switch (methodKey) {
            case "random_draw": return { points: state.randomDrawEvalPoints, field: "randomDrawEvalPoints" as const }
            case "review": return { points: state.reviewEvalPoints, field: "reviewEvalPoints" as const }
            case "paper": return { points: state.paperEvalPoints, field: "paperEvalPoints" as const }
            case "question_bank": return { points: state.questionBankEvalPoints, field: "questionBankEvalPoints" as const }
            case "outcome": return { points: state.outcomeEvalPoints, field: "outcomeEvalPoints" as const }
            case "homework": return { points: state.homeworkEvalPoints, field: "homeworkEvalPoints" as const }
            case "quiz": return { points: state.quizEvalPoints, field: "quizEvalPoints" as const }
            default: return { points: [] as EvalPoint[], field: "randomDrawEvalPoints" as const }
          }
        }

        const openDialog = (type: "object" | "subject" | "resource" | "method", methodKey: string) => {
          // When opening resource config, sync persisted config to mock state
          if (type === "resource") {
            const rc = state.methodResourceConfigs[methodKey] || {}
            if (methodKey === "random_draw" && Object.keys(rc).length > 0) setMockResRandomDraw(prev => ({ ...prev, ...rc }))
            if (methodKey === "review" && Object.keys(rc).length > 0) setMockResReview(prev => ({ ...prev, ...rc }))
            if (methodKey === "outcome" && Object.keys(rc).length > 0) setMockResOutcome(prev => ({ ...prev, ...rc }))
            if (methodKey === "homework" && Object.keys(rc).length > 0) setMockResHomework(prev => ({ ...prev, ...rc }))
          }
          setErDialogMethod(methodKey)
          setErDialogOpen(type)
        }

        const ObjectDialogContent = ({ methodKey }: { methodKey: string }) => {
          const currentObject = state.methodEvalObjects[methodKey] || state.evalObject
          return (
            <div className="space-y-4">
              <p className="text-sm text-gray-500 mb-4">选择本评价方式的测评对象类型</p>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { key: "individual", label: "个人", desc: "以学生个人为单位进行测评", icon: <User className="h-6 w-6" /> },
                  { key: "group", label: "小组", desc: "以小组为单位进行测评", icon: <Users className="h-6 w-6" /> },
                ].map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => updateState({ methodEvalObjects: { ...state.methodEvalObjects, [methodKey]: opt.key as EvalObjectType } })}
                    className={cn("p-5 rounded-xl border text-left transition-all flex items-center gap-4", currentObject === opt.key ? "border-primary bg-primary/[0.03] ring-1 ring-primary/20" : "border-gray-200 hover:border-gray-300 bg-white")}
                  >
                    <div className={cn("p-3 rounded-lg", currentObject === opt.key ? "bg-primary/10 text-primary" : "bg-gray-100 text-gray-400")}>
                      {opt.icon}
                    </div>
                    <div>
                      <p className="text-sm font-semibold mb-1">{opt.label}</p>
                      <p className="text-xs text-gray-400">{opt.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )
        }

        const SubjectDialogContent = ({ methodKey }: { methodKey: string }) => {
          const currentSubjects = state.methodEvalSubjects[methodKey] || state.evalSubjects
          const evalObject = state.methodEvalObjects[methodKey] || state.evalObject
          const displayTypes = ["teacher", "enterprise_mentor", "self", "peer"] as const

          const handleDistributeWeights = () => {
            const enabled = currentSubjects.filter(s => s.enabled && displayTypes.includes(s.type as typeof displayTypes[number]))
            const count = enabled.length
            if (count === 0) return
            const base = Math.floor(100 / count)
            const remainder = 100 % count
            const enabledIdxMap = new Map(enabled.map((s, i) => [s.type, i]))
            const newSubjects = currentSubjects.map(s => {
              if (!s.enabled || !displayTypes.includes(s.type as typeof displayTypes[number])) return s
              const idx = enabledIdxMap.get(s.type) ?? 0
              return { ...s, params: { ...s.params, weightPercent: base + (idx < remainder ? 1 : 0) } }
            })
            updateState({ methodEvalSubjects: { ...state.methodEvalSubjects, [methodKey]: newSubjects } })
          }

          const allowedSubjectsForMethod: Record<string, string[]> = {
            paper: ["teacher", "enterprise_mentor"],
            question_bank: ["teacher", "enterprise_mentor"],
            random_draw: ["teacher", "enterprise_mentor", "self", "peer"],
            review: ["teacher", "enterprise_mentor", "self", "peer"],
          }

          return (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">配置参与评价的主体及其参数</p>
                <Button variant="outline" size="sm" className="text-xs h-8" onClick={handleDistributeWeights}>
                  <Scale className="h-3.5 w-3.5 mr-1" />一键平均权重
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {currentSubjects.filter(s => displayTypes.includes(s.type as typeof displayTypes[number])).map(subject => {
                  const originalIdx = currentSubjects.findIndex(s => s.type === subject.type)
                  const methodAllowed = (allowedSubjectsForMethod[methodKey] || []).includes(subject.type)
                  const peerAllowed = subject.type !== "peer" || evalObject === "group"
                  const allowed = methodAllowed && peerAllowed
                  return (
                    <div key={subject.type} className={cn("p-3 rounded-lg border transition-all", !allowed ? "opacity-50 bg-gray-50 border-gray-200" : subject.enabled ? "border-primary bg-primary/[0.03]" : "border-gray-200 bg-white")}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Switch checked={subject.enabled} disabled={!allowed} onCheckedChange={v => updateMethodEvalSubject(methodKey, originalIdx, { enabled: v })} />
                          <span className={cn("text-xs font-medium", !allowed && "text-gray-400")}>{subjectLabels[subject.type]}</span>
                        </div>
                        {subject.enabled && allowed && subject.params?.weightPercent !== undefined && (
                          <Badge variant="outline" className="text-[10px]">权重 {subject.params.weightPercent}%</Badge>
                        )}
                      </div>
                      {subject.enabled && (
                        <div className="pl-8 space-y-2">
                          {subject.type === "teacher" && (
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <Label className="text-[11px] text-gray-500">专业背景要求</Label>
                                <MajorSelect
                                  tenantId={tenantId}
                                  orgNodeId={orgNodeId}
                                  value={subject.params?.teacherBackground || ""}
                                  onChange={v => updateMethodEvalSubject(methodKey, originalIdx, { params: { ...subject.params, teacherBackground: v || "" } })}
                                  placeholder="选择专业背景"
                                  className="mt-0.5 text-xs h-8"
                                />
                              </div>
                              <div>
                                <Label className="text-[11px] text-gray-500">评分人数</Label>
                                <Input type="number" value={subject.params?.scorerCount || 1} onChange={e => updateMethodEvalSubject(methodKey, originalIdx, { params: { ...subject.params, scorerCount: Math.max(1, parseInt(e.target.value) || 1) } })} className="mt-0.5 text-xs h-8" min={1} />
                                {(subject.params?.scorerCount || 1) > 1 && (
                                  <div className="mt-1">
                                    <Label className="text-[11px] text-gray-500">统计规则</Label>
                                    <Select value={subject.params?.aggregationRule || "average"} onValueChange={v => updateMethodEvalSubject(methodKey, originalIdx, { params: { ...subject.params, aggregationRule: v as "average" | "median" | "max" | "min" } })}>
                                      <SelectTrigger className="mt-0.5 text-xs h-8">
                                        <SelectValue placeholder="选择统计规则" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="average">平均值</SelectItem>
                                        <SelectItem value="median">中位数</SelectItem>
                                        <SelectItem value="max">最高分</SelectItem>
                                        <SelectItem value="min">最低分</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                )}
                              </div>
                              <div>
                                <Label className="text-[11px] text-gray-500">评分权重 (%)</Label>
                                <Input type="number" value={subject.params?.weightPercent || 0} onChange={e => updateMethodEvalSubject(methodKey, originalIdx, { params: { ...subject.params, weightPercent: Math.max(0, Math.min(100, parseInt(e.target.value) || 0)) } })} className="mt-0.5 text-xs h-8" min={0} max={100} />
                              </div>
                              <div>
                                <Label className="text-[11px] text-gray-500">最低教龄 (年)</Label>
                                <Input type="number" value={subject.params?.minTeachingYears || 0} onChange={e => updateMethodEvalSubject(methodKey, originalIdx, { params: { ...subject.params, minTeachingYears: Math.max(0, parseInt(e.target.value) || 0) } })} className="mt-0.5 text-xs h-8" min={0} />
                              </div>
                            </div>
                          )}
                          {subject.type === "enterprise_mentor" && (
                            <>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <Label className="text-[11px] text-gray-500">专业领域</Label>
                                  <MajorSelect
                                    tenantId={tenantId}
                                    orgNodeId={orgNodeId}
                                    value={subject.params?.expertise || ""}
                                    onChange={v => updateMethodEvalSubject(methodKey, originalIdx, { params: { ...subject.params, expertise: v || "" } })}
                                    placeholder="选择专业领域"
                                    className="mt-0.5 text-xs h-8"
                                  />
                                </div>
                                <div>
                                  <Label className="text-[11px] text-gray-500">工作年限要求 (年)</Label>
                                  <Input type="number" value={subject.params?.minYears || 0} onChange={e => updateMethodEvalSubject(methodKey, originalIdx, { params: { ...subject.params, minYears: Math.max(0, parseInt(e.target.value) || 0) } })} className="mt-0.5 text-xs h-8" min={0} />
                                </div>
                                <div>
                                  <Label className="text-[11px] text-gray-500">评分人数</Label>
                                  <Input type="number" value={subject.params?.scorerCount || 1} onChange={e => updateMethodEvalSubject(methodKey, originalIdx, { params: { ...subject.params, scorerCount: Math.max(1, parseInt(e.target.value) || 1) } })} className="mt-0.5 text-xs h-8" min={1} />
                                  {(subject.params?.scorerCount || 1) > 1 && (
                                    <div className="mt-1">
                                      <Label className="text-[11px] text-gray-500">统计规则</Label>
                                      <Select value={subject.params?.aggregationRule || "average"} onValueChange={v => updateMethodEvalSubject(methodKey, originalIdx, { params: { ...subject.params, aggregationRule: v as "average" | "median" | "max" | "min" } })}>
                                        <SelectTrigger className="mt-0.5 text-xs h-8">
                                          <SelectValue placeholder="选择统计规则" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="average">平均值</SelectItem>
                                          <SelectItem value="median">中位数</SelectItem>
                                          <SelectItem value="max">最高分</SelectItem>
                                          <SelectItem value="min">最低分</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  )}
                                </div>
                                <div>
                                  <Label className="text-[11px] text-gray-500">评分权重 (%)</Label>
                                  <Input type="number" value={subject.params?.weightPercent || 0} onChange={e => updateMethodEvalSubject(methodKey, originalIdx, { params: { ...subject.params, weightPercent: Math.max(0, Math.min(100, parseInt(e.target.value) || 0)) } })} className="mt-0.5 text-xs h-8" min={0} max={100} />
                                </div>
                              </div>
                              <div>
                                <Label className="text-[11px] text-gray-500">岗位工作经历</Label>
                                <Input value={subject.params?.jobExperience || ""} onChange={e => updateMethodEvalSubject(methodKey, originalIdx, { params: { ...subject.params, jobExperience: e.target.value } })} placeholder="请填写岗位工作经历要求" className="mt-0.5 text-xs h-8" />
                              </div>
                            </>
                          )}
                          {subject.type === "peer" && (
                            <>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <Label className="text-[11px] text-gray-500">互评人数</Label>
                                  <Input type="number" value={subject.params?.peerCount || 3} onChange={e => updateMethodEvalSubject(methodKey, originalIdx, { params: { ...subject.params, peerCount: Math.max(1, parseInt(e.target.value) || 1) } })} className="mt-0.5 text-xs h-8" min={1} />
                                  {(subject.params?.peerCount || 3) > 1 && (
                                    <div className="mt-1">
                                      <Label className="text-[11px] text-gray-500">统计规则</Label>
                                      <Select value={subject.params?.aggregationRule || "average"} onValueChange={v => updateMethodEvalSubject(methodKey, originalIdx, { params: { ...subject.params, aggregationRule: v as "average" | "median" | "max" | "min" } })}>
                                        <SelectTrigger className="mt-0.5 text-xs h-8">
                                          <SelectValue placeholder="选择统计规则" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="average">平均值</SelectItem>
                                          <SelectItem value="median">中位数</SelectItem>
                                          <SelectItem value="max">最高分</SelectItem>
                                          <SelectItem value="min">最低分</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  )}
                                </div>
                                <div>
                                  <Label className="text-[11px] text-gray-500">评分权重 (%)</Label>
                                  <Input type="number" value={subject.params?.weightPercent || 0} onChange={e => updateMethodEvalSubject(methodKey, originalIdx, { params: { ...subject.params, weightPercent: Math.max(0, Math.min(100, parseInt(e.target.value) || 0)) } })} className="mt-0.5 text-xs h-8" min={0} max={100} />
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <Label className="text-[11px] text-gray-500">互评规则</Label>
                                  <Select value={subject.params?.peerRule || ""} onValueChange={v => updateMethodEvalSubject(methodKey, originalIdx, { params: { ...subject.params, peerRule: v } })}>
                                    <SelectTrigger className="mt-0.5 text-xs h-8">
                                      <SelectValue placeholder="选择互评规则" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="随机分配">随机分配</SelectItem>
                                      <SelectItem value="相邻座位">相邻座位</SelectItem>
                                      <SelectItem value="自由组合">自由组合</SelectItem>
                                      <SelectItem value="指定分组">指定分组</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="flex items-end pb-1">
                                  <div className="flex items-center gap-1.5">
                                    <Switch checked={subject.params?.anonymous || false} onCheckedChange={v => updateMethodEvalSubject(methodKey, originalIdx, { params: { ...subject.params, anonymous: v } })} />
                                    <span className="text-[11px] text-gray-600">匿名评价</span>
                                  </div>
                                </div>
                              </div>
                            </>
                          )}
                          {subject.type === "self" && (
                            <>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <Label className="text-[11px] text-gray-500">评分权重 (%)</Label>
                                  <Input type="number" value={subject.params?.weightPercent || 0} onChange={e => updateMethodEvalSubject(methodKey, originalIdx, { params: { ...subject.params, weightPercent: Math.max(0, Math.min(100, parseInt(e.target.value) || 0)) } })} className="mt-0.5 text-xs h-8" min={0} max={100} />
                                </div>
                                <div className="flex items-end pb-1">
                                  <div className="flex items-center gap-1.5">
                                    <Switch checked={subject.params?.requiresReflection || false} onCheckedChange={v => updateMethodEvalSubject(methodKey, originalIdx, { params: { ...subject.params, requiresReflection: v } })} />
                                    <span className="text-[11px] text-gray-600">需要提交反思报告</span>
                                  </div>
                                </div>
                              </div>
                              {subject.params?.requiresReflection && (
                                <div>
                                  <Label className="text-[11px] text-gray-500">反思报告最少字数</Label>
                                  <Input type="number" value={subject.params?.reflectionMinLength || 300} onChange={e => updateMethodEvalSubject(methodKey, originalIdx, { params: { ...subject.params, reflectionMinLength: Math.max(100, parseInt(e.target.value) || 100) } })} className="mt-0.5 text-xs h-8 w-28" min={100} />
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        }

        function MixedTagEditor({
          text,
          knowledgePointIds,
          abilityPointIds,
          onChange,
          onOpenKpDialog,
          onOpenAbDialog,
        }: {
          text: string
          knowledgePointIds: string[]
          abilityPointIds: string[]
          onChange: (updates: { name?: string; knowledgePointIds?: string[]; abilityPointIds?: string[] }) => void
          onOpenKpDialog: () => void
          onOpenAbDialog: () => void
        }) {
          const ref = useRef<HTMLDivElement>(null)
          const isComposing = useRef(false)
          const onChangeRef = useRef(onChange)
          onChangeRef.current = onChange
          const kpIdsRef = useRef(knowledgePointIds)
          kpIdsRef.current = knowledgePointIds
          const abIdsRef = useRef(abilityPointIds)
          abIdsRef.current = abilityPointIds
          const prevTags = useRef({ kp: [] as string[], ab: [] as string[] })
          const cursorOffsetRef = useRef<number | null>(null)

          const updateCursorOffset = () => {
            const el = ref.current
            if (!el) return
            const selection = document.getSelection()
            if (!selection || !selection.rangeCount) return
            const range = selection.getRangeAt(0)
            if (!el.contains(range.startContainer) && range.startContainer !== el) return

            let offset = 0
            if (range.startContainer.nodeType === Node.TEXT_NODE) {
              const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
              let node
              while ((node = walker.nextNode())) {
                if (node === range.startContainer) {
                  offset += range.startOffset
                  break
                }
                offset += node.textContent?.length || 0
              }
            } else if (range.startContainer === el) {
              for (let i = 0; i < range.startOffset && i < el.childNodes.length; i++) {
                const child = el.childNodes[i]
                if (child.nodeType === Node.TEXT_NODE) {
                  offset += child.textContent?.length || 0
                }
              }
            }
            cursorOffsetRef.current = offset
          }

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
              span.querySelector('button')!.onclick = (e) => {
                e.stopPropagation()
                span.remove()
                onChangeRef.current({ knowledgePointIds: kpIdsRef.current.filter(i => i !== id) })
              }
            } else {
              const ab = abilityPoints.find(a => a.id === id)
              if (!ab) return null
              span.className = 'inline-flex items-center px-1 py-0.5 rounded text-[10px] font-normal bg-amber-50 text-amber-600 border border-amber-200 mx-0.5 align-middle cursor-default'
              span.innerHTML = `${ab.name}<button class="ml-0.5 text-amber-400 hover:text-red-500 leading-none">×</button>`
              span.querySelector('button')!.onclick = (e) => {
                e.stopPropagation()
                span.remove()
                onChangeRef.current({ abilityPointIds: abIdsRef.current.filter(i => i !== id) })
              }
            }
            return span
          }

          // Initial mount only
          useLayoutEffect(() => {
            const el = ref.current
            if (!el) return
            if (text) el.textContent = text
            else el.innerHTML = ''
            knowledgePointIds.forEach(kpid => {
              const span = createTagSpan('kp', kpid)
              if (span) el.appendChild(span)
            })
            abilityPointIds.forEach(abId => {
              const span = createTagSpan('ab', abId)
              if (span) el.appendChild(span)
            })
            prevTags.current = { kp: [...knowledgePointIds], ab: [...abilityPointIds] }
            // eslint-disable-next-line react-hooks/exhaustive-deps
          }, [])

          // Tag / text changes from parent
          useLayoutEffect(() => {
            const el = ref.current
            if (!el) return
            const kpChanged = JSON.stringify(prevTags.current.kp) !== JSON.stringify(knowledgePointIds)
            const abChanged = JSON.stringify(prevTags.current.ab) !== JSON.stringify(abilityPointIds)
            const domText = Array.from(el.childNodes)
              .filter(n => n.nodeType === Node.TEXT_NODE)
              .map(n => n.textContent)
              .join('')
            const textChanged = domText !== (text || '')
            if (!kpChanged && !abChanged && !textChanged) return

            if (el !== document.activeElement) {
              const newKpIds = knowledgePointIds.filter(id => !prevTags.current.kp.includes(id))
              const newAbIds = abilityPointIds.filter(id => !prevTags.current.ab.includes(id))
              const existingKpIds = knowledgePointIds.filter(id => prevTags.current.kp.includes(id))
              const existingAbIds = abilityPointIds.filter(id => prevTags.current.ab.includes(id))

              if ((newKpIds.length > 0 || newAbIds.length > 0) && cursorOffsetRef.current != null) {
                const offset = cursorOffsetRef.current
                const before = text?.slice(0, offset) || ''
                const after = text?.slice(offset) || ''
                el.textContent = ''
                if (before) el.appendChild(document.createTextNode(before))
                newKpIds.forEach(kpid => {
                  const span = createTagSpan('kp', kpid)
                  if (span) el.appendChild(span)
                })
                newAbIds.forEach(abId => {
                  const span = createTagSpan('ab', abId)
                  if (span) el.appendChild(span)
                })
                if (after) el.appendChild(document.createTextNode(after))
                existingKpIds.forEach(kpid => {
                  const span = createTagSpan('kp', kpid)
                  if (span) el.appendChild(span)
                })
                existingAbIds.forEach(abId => {
                  const span = createTagSpan('ab', abId)
                  if (span) el.appendChild(span)
                })
                cursorOffsetRef.current = null
              } else {
                if (text) el.textContent = text
                else el.innerHTML = ''
                knowledgePointIds.forEach(kpid => {
                  const span = createTagSpan('kp', kpid)
                  if (span) el.appendChild(span)
                })
                abilityPointIds.forEach(abId => {
                  const span = createTagSpan('ab', abId)
                  if (span) el.appendChild(span)
                })
              }
            } else if (kpChanged || abChanged) {
              const existingKp = new Set(Array.from(el.querySelectorAll('[data-type="kp"]')).map(el => (el as HTMLElement).dataset.id))
              const existingAb = new Set(Array.from(el.querySelectorAll('[data-type="ab"]')).map(el => (el as HTMLElement).dataset.id))
              knowledgePointIds.forEach(kpid => {
                if (!existingKp.has(kpid)) {
                  const span = createTagSpan('kp', kpid)
                  if (span) el.appendChild(span)
                }
              })
              abilityPointIds.forEach(abId => {
                if (!existingAb.has(abId)) {
                  const span = createTagSpan('ab', abId)
                  if (span) el.appendChild(span)
                }
              })
            }
            prevTags.current = { kp: [...knowledgePointIds], ab: [...abilityPointIds] }
          }, [knowledgePointIds, abilityPointIds, text])

          const handleBlur = () => {
            if (isComposing.current) return
            const el = ref.current
            if (!el) return
            let newText = ''
            const newKpIds: string[] = []
            const newAbIds: string[] = []
            el.childNodes.forEach(node => {
              if (node.nodeType === Node.TEXT_NODE) {
                newText += node.textContent || ''
              } else if (node.nodeType === Node.ELEMENT_NODE) {
                const dataset = (node as HTMLElement).dataset
                if (dataset.tag) {
                  if (dataset.type === 'kp' && dataset.id) newKpIds.push(dataset.id)
                  if (dataset.type === 'ab' && dataset.id) newAbIds.push(dataset.id)
                }
              }
            })
            onChangeRef.current({ name: newText, knowledgePointIds: newKpIds, abilityPointIds: newAbIds })
          }

          return (
            <div className="min-h-[32px] rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-sm flex flex-wrap gap-1 items-center">
              <div
                ref={ref}
                contentEditable
                suppressContentEditableWarning
                className="flex-1 outline-none min-w-[80px] text-sm leading-6 empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400"
                data-placeholder="输入评价维度"
                onBlur={handleBlur}
                onKeyUp={updateCursorOffset}
                onClick={updateCursorOffset}
                onCompositionStart={() => { isComposing.current = true }}
                onCompositionEnd={() => { isComposing.current = false }}
                onPaste={(e) => {
                  e.preventDefault()
                  const pasted = e.clipboardData.getData('text/plain')
                  document.execCommand('insertText', false, pasted)
                }}
              />
              <Button variant="ghost" size="sm" className="h-5 text-[10px] px-1 text-gray-400 hover:text-primary shrink-0" onMouseDown={updateCursorOffset} onClick={onOpenKpDialog}>关联考查知识点</Button>
              <Button variant="ghost" size="sm" className="h-5 text-[10px] px-1 text-gray-400 hover:text-primary shrink-0" onMouseDown={updateCursorOffset} onClick={onOpenAbDialog}>关联考查能力点</Button>
            </div>
          )
        }

        const MethodDialogContent = ({ methodKey }: { methodKey: string }) => {
          const info = getMethodEvalInfo(methodKey)
          const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
          const [gradeMappingDialogOpen, setGradeMappingDialogOpen] = useState(false)
          const [editingGradeMappingPointId, setEditingGradeMappingPointId] = useState<string | null>(null)
          const [localDraft, setLocalDraft] = useState<{ name: string; mode: "rubric" | "score_rule"; types: EvalSubType[]; scoreRuleItems: ScoreRuleItem[] }>({ name: "", mode: "rubric", types: [], scoreRuleItems: [] })
          const [saveTemplateDialogOpen, setSaveTemplateDialogOpen] = useState(false)
          const [saveTemplateMode, setSaveTemplateMode] = useState<"new" | "replace">("new")
          const [selectedReplaceTemplateId, setSelectedReplaceTemplateId] = useState<string | null>(null)
          const rubricIdField =
            methodKey === "random_draw" ? "randomDrawRubricId" :
            methodKey === "review" ? "reviewRubricId" :
            methodKey === "outcome" ? "outcomeRubricId" :
            methodKey === "homework" ? "homeworkRubricId" :
            "reviewRubricId"
          const currentRubricId = (state as any)[rubricIdField] as string | null
          const view = methodDialogViews[methodKey] || "edit"
          const setView = (v: "list" | "edit" | "template") => setMethodDialogViews(prev => ({ ...prev, [methodKey]: v }))

          const currentScheme = rubricLibrary.find(s => s.id === currentRubricId)

          const applyScheme = (schemeId: string) => {
            const scheme = rubricLibrary.find(s => s.id === schemeId)
            if (!scheme) return
            updateState({ [rubricIdField]: schemeId } as any)
            if (scheme.mode === "rubric") {
              setEvalPoints(info.field, scheme.points.map(p => ({ ...p, id: `ep-${Date.now()}-${Math.random().toString(36).slice(2, 5)}` })))
            } else {
              setEvalPoints(info.field, [])
            }
            setEditingRubricId(schemeId)
          }

          const enterEdit = (schemeId: string | null) => {
            if (schemeId) {
              const scheme = rubricLibrary.find(s => s.id === schemeId)
              if (scheme) {
                setEvalPoints(info.field, JSON.parse(JSON.stringify(scheme.points)))
                setLocalDraft({ name: scheme.name, mode: scheme.mode, types: scheme.types, scoreRuleItems: scheme.scoreRuleItems || [] })
              }
            } else {
              setEvalPoints(info.field, [])
              setLocalDraft({ name: "", mode: "rubric", types: [], scoreRuleItems: [] })
            }
            setEditingRubricId(schemeId)
            setView("edit")
          }

          const saveRubricToLibrary = async (schemeId: string | null, updates: Partial<RubricScheme>) => {
            try {
              if (schemeId) {
                const data = {
                  name: updates.name || "",
                  mode: updates.mode || "rubric",
                  types: updates.types || [],
                  description: updates.desc || "",
                  data: updates.mode === "score_rule"
                    ? { scoreRuleItems: updates.scoreRuleItems || [] }
                    : { points: info.points.map((p: EvalPoint) => ({
                        id: p.id, name: p.name, description: p.desc || "",
                        types: p.types || (p.subType ? [p.subType] : []),
                        weight: p.weight || 0, scoringMethod: p.scoringMethod || "level",
                        gradeMapping: p.gradeMapping || [],
                        knowledgePointIds: p.knowledgePointIds || [],
                        abilityPointIds: p.abilityPointIds || [],
                      })) },
                }
                await taskEvaluationApi.updateTemplate(schemeId, data).catch(() => {})
                setRubricLibrary(prev => prev.map(s => s.id === schemeId ? { ...s, ...updates } as RubricScheme : s))
              } else {
                const data = {
                  name: updates.name || "新建评价标准",
                  mode: updates.mode || "rubric",
                  types: updates.types || [],
                  description: updates.desc || "",
                  data: updates.mode === "score_rule"
                    ? { scoreRuleItems: updates.scoreRuleItems || [] }
                    : { points: info.points.map((p: EvalPoint) => ({
                        id: p.id, name: p.name, description: p.desc || "",
                        types: p.types || (p.subType ? [p.subType] : []),
                        weight: p.weight || 0, scoringMethod: p.scoringMethod || "level",
                        gradeMapping: p.gradeMapping || [],
                        knowledgePointIds: p.knowledgePointIds || [],
                        abilityPointIds: p.abilityPointIds || [],
                      })) },
                }
                const created = await taskEvaluationApi.createTemplate(data).catch(() => null)
                if (created) {
                  const newScheme: RubricScheme = {
                    id: created.id,
                    name: created.name,
                    types: (created.types || []) as EvalSubType[],
                    desc: created.description || "",
                    points: info.points.map(p => ({ ...p })),
                    mode: created.mode as "rubric" | "score_rule",
                    scoreRuleItems: updates.scoreRuleItems || [],
                  }
                  setRubricLibrary(prev => [...prev, newScheme])
                  updateState({ [rubricIdField]: created.id } as any)
                } else {
                  const newId = `scheme-${Date.now()}`
                  setRubricLibrary(prev => [...prev, {
                    id: newId, name: updates.name || "新建评价标准", types: updates.types || [],
                    desc: updates.desc || "", points: info.points.map(p => ({ ...p, id: `ep-${Date.now()}-${Math.random().toString(36).slice(2, 5)}` })),
                    mode: updates.mode || "rubric", scoreRuleItems: updates.scoreRuleItems || [],
                  } as RubricScheme])
                  updateState({ [rubricIdField]: newId } as any)
                }
              }
            } catch {
              if (schemeId) {
                setRubricLibrary(prev => prev.map(s => s.id === schemeId ? { ...s, ...updates } as RubricScheme : s))
              } else {
                const newId = `scheme-${Date.now()}`
                setRubricLibrary(prev => [...prev, {
                  id: newId, name: updates.name || "新建评价标准", types: updates.types || [],
                  desc: updates.desc || "", points: info.points.map(p => ({ ...p, id: `ep-${Date.now()}-${Math.random().toString(36).slice(2, 5)}` })),
                  mode: updates.mode || "rubric", scoreRuleItems: updates.scoreRuleItems || [],
                } as RubricScheme])
                updateState({ [rubricIdField]: newId } as any)
              }
            }
          }

          const editingScheme = editingRubricId ? rubricLibrary.find(s => s.id === editingRubricId) : null
          const draftScheme = editingScheme
            ? { name: editingScheme.name, types: editingScheme.types, mode: editingScheme.mode, scoreRuleItems: editingScheme.scoreRuleItems || [] }
            : localDraft

          if (view === "edit") {
            return (
              <div className="space-y-4">
                <div className="flex items-center justify-end mb-2">
                  <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => { setView("template"); setEditingRubricId(null); }}>
                    <BookOpen className="h-3.5 w-3.5 mr-1" />选择评价标准模板覆盖
                  </Button>
                </div>
                <div className="border border-border rounded-xl p-5 bg-white shadow-sm">
                  <p className="text-sm font-medium mb-3">评价标准信息</p>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs text-gray-500">评价标准名称</Label>
                      <Input value={draftScheme.name} onChange={e => {
                        if (editingRubricId) {
                          setRubricLibrary(prev => prev.map(s => s.id === editingRubricId ? { ...s, name: e.target.value } : s))
                        } else {
                          setLocalDraft(prev => ({ ...prev, name: e.target.value }))
                        }
                      }} className="mt-1 text-sm" placeholder="输入评价标准名称" />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">评价标准类型</Label>
                      <div className="flex gap-3 mt-1">
                        {methodKey !== "homework" && (
                          <button
                            onClick={() => {
                              if (editingRubricId) {
                                setRubricLibrary(prev => prev.map(s => s.id === editingRubricId ? { ...s, mode: "rubric" } : s))
                              } else {
                                setLocalDraft(prev => ({ ...prev, mode: "rubric" }))
                              }
                            }}
                            className={cn(
                              "px-3 py-1.5 rounded-lg text-xs border transition-all flex items-center gap-1.5",
                              draftScheme.mode === "rubric" ? "bg-primary/10 text-primary border-primary" : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                            )}
                          >
                            <div className={cn("w-3.5 h-3.5 rounded-full border flex items-center justify-center", draftScheme.mode === "rubric" ? "border-primary" : "border-gray-300")}>
                              {draftScheme.mode === "rubric" && <div className="w-2 h-2 rounded-full bg-primary" />}
                            </div>
                            评价量规
                          </button>
                        )}
                        <button
                          onClick={() => {
                            if (editingRubricId) {
                              setRubricLibrary(prev => prev.map(s => s.id === editingRubricId ? { ...s, mode: "score_rule", scoreRuleItems: s.scoreRuleItems?.length ? s.scoreRuleItems : [{ id: `sr-${Date.now()}`, name: "", desc: "", rule: "", weight: 0 }] } : s))
                            } else {
                              setLocalDraft(prev => ({ ...prev, mode: "score_rule", scoreRuleItems: prev.scoreRuleItems?.length ? prev.scoreRuleItems : [{ id: `sr-${Date.now()}`, name: "", desc: "", rule: "", weight: 0 }] }))
                            }
                          }}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-xs border transition-all flex items-center gap-1.5",
                            draftScheme.mode === "score_rule" ? "bg-primary/10 text-primary border-primary" : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                          )}
                        >
                          <div className={cn("w-3.5 h-3.5 rounded-full border flex items-center justify-center", draftScheme.mode === "score_rule" ? "border-primary" : "border-gray-300")}>
                            {draftScheme.mode === "score_rule" && <div className="w-2 h-2 rounded-full bg-primary" />}
                          </div>
                          评分规则
                        </button>
                      </div>
                      {methodKey === "homework" && (
                        <p className="text-[10px] text-gray-400 mt-1">作业测评仅需使用评分规则即可</p>
                      )}
                    </div>
                  </div>
                </div>
                {draftScheme.mode === "rubric" ? (
                  <div className="border rounded-xl p-4 overflow-hidden">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-medium">评价量规配置表</p>
                      <div className="flex items-center gap-2">
                        <PrdAnnotation data={getAnnotation("eval-rule-onekey-split")}>
                          <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => {
                            const count = info.points.length
                            if (count === 0) return
                            const base = Math.floor(100 / count)
                            const remainder = 100 % count
                            const newPoints = info.points.map((p, i) => ({ ...p, weight: base + (i < remainder ? 1 : 0) }))
                            setEvalPoints(info.field, newPoints)
                          }}>
                            <RotateCcw className="h-3.5 w-3.5 mr-1" />一键均分
                          </Button>
                        </PrdAnnotation>
                        <PrdAnnotation data={getAnnotation("eval-rule-add-dimension")}>
                          <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => addEvalPoint(info.field, { name: "", types: draftScheme.types.length ? draftScheme.types : undefined })}>
                            <Plus className="h-3.5 w-3.5 mr-1" />添加评价维度
                          </Button>
                        </PrdAnnotation>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm border-collapse min-w-[900px]">
                        <thead>
                          <tr className="border-b bg-gray-50 text-gray-500 text-xs">
                            <th className="py-2.5 px-2 text-left w-12">序号</th>
                            <th className="py-2.5 px-2 text-left min-w-[360px]">评价维度名称/关联知识点/能力点</th>
                            <th className="py-2.5 px-2 text-left min-w-[440px]">评价等级</th>
                            <th className="py-2.5 px-2 text-center w-16">权重(%)</th>
                            <th className="py-2.5 px-2 text-center w-14">操作</th>
                          </tr>
                        </thead>
                        <tbody>
                          {info.points.map((ep, idx) => (
                            <tr key={ep.id} className="border-b hover:bg-gray-50/50 transition-colors">
                              <td className="py-3 px-2">
                                <span className="text-gray-600 align-middle">{idx + 1}</span>
                              </td>
                              <td className="py-3 px-2">
                                <MixedTagEditor
                                  text={ep.name}
                                  knowledgePointIds={ep.knowledgePointIds || []}
                                  abilityPointIds={ep.abilityPointIds || []}
                                  onChange={updates => updateEvalPoint(info.field, ep.id, updates)}
                                  onOpenKpDialog={() => openRubricKpDialog(ep.id, info.field)}
                                  onOpenAbDialog={() => openRubricAbDialog(ep.id, info.field)}
                                />
                              </td>
                              <td className="py-3 px-2">
                                <button
                                  onClick={() => {
                                    setEditingGradeMappingPointId(ep.id)
                                    setGradeMappingDialogOpen(true)
                                  }}
                                  className="text-xs text-left text-primary hover:underline w-full block"
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
                                <Input type="number" value={ep.weight || 0} onChange={e => updateEvalPoint(info.field, ep.id, { weight: Math.max(0, Math.min(100, parseInt(e.target.value) || 0)) })} className="h-8 text-sm text-center" />
                              </td>
                              <td className="py-3 px-2 text-center">
                                <button className="text-red-500 hover:text-red-600 text-xs" onClick={() => removeEvalPoint(info.field, ep.id)}>删除</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="mt-3 space-y-2">
                      <button onClick={() => addEvalPoint(info.field, { name: "", types: draftScheme.types.length ? draftScheme.types : undefined })} className="w-full py-3 border-2 border-dashed border-gray-200 rounded-lg text-sm text-gray-500 hover:border-primary/40 hover:text-primary transition-colors flex items-center justify-center gap-1">
                        <Plus className="h-4 w-4" />添加评价维度
                      </button>
                      {info.points.length > 0 && (
                        <div className="flex justify-end text-xs items-center gap-1">
                          <span className="text-gray-500">维度权重合计：</span>
                          <span className={cn("font-semibold", (info.points.reduce((sum, p) => sum + (p.weight || 0), 0)) === 100 ? "text-green-600" : "text-red-500")}>
                            {info.points.reduce((sum, p) => sum + (p.weight || 0), 0)}%
                          </span>
                          {(info.points.reduce((sum, p) => sum + (p.weight || 0), 0)) !== 100 && (
                            <span className="text-red-500">⚠️（需等于100%）</span>
                          )}
                        </div>
                      )}
                    </div>
                    {info.points.length === 0 && (
                      <div className="text-center text-gray-400 py-8">
                        <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">尚未添加评价点</p>
                        <p className="text-xs mt-1">点击上方按钮添加第一个评价点</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="border rounded-xl p-4 overflow-hidden">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-medium">评分规则配置表</p>
                      <div className="flex items-center gap-2">
                        <PrdAnnotation data={getAnnotation("eval-rule-onekey-split")}>
                          <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => {
                            const items = draftScheme.scoreRuleItems || []
                            const count = items.length
                            if (count === 0) return
                            const base = Math.floor(100 / count)
                            const remainder = 100 % count
                            const newItems = items.map((it, i) => ({ ...it, weight: base + (i < remainder ? 1 : 0) }))
                            if (editingRubricId) {
                              setRubricLibrary(prev => prev.map(s => s.id === editingRubricId ? { ...s, scoreRuleItems: newItems } : s))
                            } else {
                              setLocalDraft(prev => ({ ...prev, scoreRuleItems: newItems }))
                            }
                          }}>
                            <RotateCcw className="h-3.5 w-3.5 mr-1" />一键均分
                          </Button>
                        </PrdAnnotation>
                        <PrdAnnotation data={getAnnotation("eval-rule-add-item")}>
                          <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => {
                            const newItem: ScoreRuleItem = { id: `sr-${Date.now()}`, name: "", desc: "", rule: "", weight: 0 }
                            if (editingRubricId) {
                              setRubricLibrary(prev => prev.map(s => s.id === editingRubricId ? { ...s, scoreRuleItems: [...(s.scoreRuleItems || []), newItem] } : s))
                            } else {
                              setLocalDraft(prev => ({ ...prev, scoreRuleItems: [...(prev.scoreRuleItems || []), newItem] }))
                            }
                          }}>
                            <Plus className="h-3.5 w-3.5 mr-1" />添加评价项
                          </Button>
                        </PrdAnnotation>
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
                          {(draftScheme.scoreRuleItems || []).map((item, idx) => (
                            <tr key={item.id} className="border-b hover:bg-gray-50/50 transition-colors">
                              <td className="py-3 px-2">
                                <span className="text-gray-600 align-middle">{idx + 1}</span>
                              </td>
                              <td className="py-3 px-2">
                                <Textarea value={item.name + (item.desc ? `\n${item.desc}` : "")} onChange={e => {
                                  const lines = e.target.value.split('\n')
                                  const newName = lines[0] || ""
                                  const newDesc = lines.slice(1).join('\n')
                                  if (editingRubricId) {
                                    setRubricLibrary(prev => prev.map(s => s.id === editingRubricId ? { ...s, scoreRuleItems: (s.scoreRuleItems || []).map(it => it.id === item.id ? { ...it, name: newName, desc: newDesc } : it) } : s))
                                  } else {
                                    setLocalDraft(prev => ({ ...prev, scoreRuleItems: (prev.scoreRuleItems || []).map(it => it.id === item.id ? { ...it, name: newName, desc: newDesc } : it) }))
                                  }
                                }} className="text-sm min-h-[60px]" placeholder="请输入评分描述" rows={2} />
                              </td>
                              <td className="py-3 px-2">
                                <Textarea value={item.rule} onChange={e => {
                                  if (editingRubricId) {
                                    setRubricLibrary(prev => prev.map(s => s.id === editingRubricId ? { ...s, scoreRuleItems: (s.scoreRuleItems || []).map(it => it.id === item.id ? { ...it, rule: e.target.value } : it) } : s))
                                  } else {
                                    setLocalDraft(prev => ({ ...prev, scoreRuleItems: (prev.scoreRuleItems || []).map(it => it.id === item.id ? { ...it, rule: e.target.value } : it) }))
                                  }
                                }} className="text-sm min-h-[60px]" placeholder="输入加减分规则" rows={2} />
                              </td>
                              <td className="py-3 px-2">
                                <Input type="number" value={item.weight || 0} onChange={e => {
                                  const val = Math.max(0, Math.min(100, parseInt(e.target.value) || 0))
                                  if (editingRubricId) {
                                    setRubricLibrary(prev => prev.map(s => s.id === editingRubricId ? { ...s, scoreRuleItems: (s.scoreRuleItems || []).map(it => it.id === item.id ? { ...it, weight: val } : it) } : s))
                                  } else {
                                    setLocalDraft(prev => ({ ...prev, scoreRuleItems: (prev.scoreRuleItems || []).map(it => it.id === item.id ? { ...it, weight: val } : it) }))
                                  }
                                }} className="h-8 text-sm text-center" />
                              </td>
                              <td className="py-3 px-2 text-center">
                                <button className="text-red-500 hover:text-red-600 text-xs" onClick={() => {
                                  if (editingRubricId) {
                                    setRubricLibrary(prev => prev.map(s => s.id === editingRubricId ? { ...s, scoreRuleItems: (s.scoreRuleItems || []).filter(it => it.id !== item.id) } : s))
                                  } else {
                                    setLocalDraft(prev => ({ ...prev, scoreRuleItems: (prev.scoreRuleItems || []).filter(it => it.id !== item.id) }))
                                  }
                                }}>删除</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="mt-3 space-y-2">
                      <button onClick={() => {
                        const newItem: ScoreRuleItem = { id: `sr-${Date.now()}`, name: "", desc: "", rule: "", weight: 0 }
                        if (editingRubricId) {
                          setRubricLibrary(prev => prev.map(s => s.id === editingRubricId ? { ...s, scoreRuleItems: [...(s.scoreRuleItems || []), newItem] } : s))
                        } else {
                          setLocalDraft(prev => ({ ...prev, scoreRuleItems: [...(prev.scoreRuleItems || []), newItem] }))
                        }
                      }} className="w-full py-3 border-2 border-dashed border-gray-200 rounded-lg text-sm text-gray-500 hover:border-primary/40 hover:text-primary transition-colors flex items-center justify-center gap-1">
                        <Plus className="h-4 w-4" />添加评价项
                      </button>
                      {(draftScheme.scoreRuleItems || []).length > 0 && (
                        <div className="flex justify-end text-xs items-center gap-1">
                          <span className="text-gray-500">分值合计：</span>
                          <span className={cn("font-semibold", ((draftScheme.scoreRuleItems || []).reduce((sum, it) => sum + (it.weight || 0), 0)) === 100 ? "text-green-600" : "text-red-500")}>
                            {(draftScheme.scoreRuleItems || []).reduce((sum, it) => sum + (it.weight || 0), 0)}%
                          </span>
                          {((draftScheme.scoreRuleItems || []).reduce((sum, it) => sum + (it.weight || 0), 0)) !== 100 && (
                            <span className="text-red-500">⚠️（需等于100%）</span>
                          )}
                        </div>
                      )}
                    </div>
                    {(draftScheme.scoreRuleItems || []).length === 0 && (
                      <div className="text-center text-gray-400 py-8">
                        <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">尚未添加评价项</p>
                        <p className="text-xs mt-1">点击上方按钮添加第一个评价项</p>
                      </div>
                    )}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Button size="sm" className="text-xs h-8" onClick={() => {
                    if (editingRubricId) {
                      setRubricLibrary(prev => prev.map(s => s.id === editingRubricId ? { ...s, points: info.points.map(p => ({ ...p })) } : s))
                    } else {
                      saveRubricToLibrary(null, { name: draftScheme.name || "新建评价标准", types: draftScheme.types, desc: "", mode: draftScheme.mode, scoreRuleItems: draftScheme.scoreRuleItems })
                    }
                    setView("list")
                    setEditingRubricId(null)
                  }}>
                    保存
                  </Button>
                  <Button size="sm" variant="outline" className="text-xs h-8" onClick={() => { setSaveTemplateDialogOpen(true); setSaveTemplateMode("new"); setSelectedReplaceTemplateId(null); }}>
                    保存到模板
                  </Button>
                </div>
                <Dialog open={saveTemplateDialogOpen} onOpenChange={setSaveTemplateDialogOpen}>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <PrdAnnotation data={getAnnotation("dialog-save-template")}><DialogTitle>保存到模板</DialogTitle></PrdAnnotation>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSaveTemplateMode("new")}
                          className={cn(
                            "flex-1 px-3 py-2 rounded-lg text-xs border transition-all",
                            saveTemplateMode === "new" ? "border-primary bg-primary/5 text-primary" : "border-gray-200 text-gray-500 hover:border-gray-300"
                          )}
                        >
                          新增模板
                        </button>
                        <button
                          onClick={() => setSaveTemplateMode("replace")}
                          className={cn(
                            "flex-1 px-3 py-2 rounded-lg text-xs border transition-all",
                            saveTemplateMode === "replace" ? "border-primary bg-primary/5 text-primary" : "border-gray-200 text-gray-500 hover:border-gray-300"
                          )}
                        >
                          替换现有模板
                        </button>
                      </div>
                      {saveTemplateMode === "new" ? (
                        <div>
                          <Label className="text-xs text-gray-500">模板名称</Label>
                          <Input value={draftScheme.name} onChange={e => {
                            if (editingRubricId) {
                              setRubricLibrary(prev => prev.map(s => s.id === editingRubricId ? { ...s, name: e.target.value } : s))
                            } else {
                              setLocalDraft(prev => ({ ...prev, name: e.target.value }))
                            }
                          }} className="mt-1 text-sm" placeholder="输入模板名称" />
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Label className="text-xs text-gray-500">选择要替换的模板</Label>
                          <div className="space-y-2 max-h-[200px] overflow-y-auto">
                            {rubricLibrary.map(scheme => (
                              <div
                                key={scheme.id}
                                onClick={() => setSelectedReplaceTemplateId(scheme.id)}
                                className={cn(
                                  "p-3 rounded-lg border cursor-pointer transition-all",
                                  selectedReplaceTemplateId === scheme.id ? "border-primary bg-primary/5" : "border-gray-200 hover:border-gray-300"
                                )}
                              >
                                <p className="text-sm font-medium">{scheme.name}</p>
                                <p className="text-xs text-gray-400 mt-0.5">{scheme.mode === "rubric" ? "评价量规" : "评分规则"}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <DialogFooter>
                      <Button variant="outline" size="sm" className="text-xs" onClick={() => setSaveTemplateDialogOpen(false)}>取消</Button>
                      <Button size="sm" className="text-xs" onClick={() => {
                        if (saveTemplateMode === "new") {
                          saveRubricToLibrary(null, { name: draftScheme.name || "新建评价标准", types: draftScheme.types, desc: "", mode: draftScheme.mode, scoreRuleItems: draftScheme.scoreRuleItems })
                        } else if (selectedReplaceTemplateId) {
                          setRubricLibrary(prev => prev.map(s => s.id === selectedReplaceTemplateId ? { ...s, points: info.points.map(p => ({ ...p })), mode: draftScheme.mode, scoreRuleItems: draftScheme.scoreRuleItems || [] } : s))
                        }
                        setSaveTemplateDialogOpen(false)
                        setView("list")
                        setEditingRubricId(null)
                      }} disabled={saveTemplateMode === "replace" && !selectedReplaceTemplateId}>
                        确认保存
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                <Dialog open={gradeMappingDialogOpen} onOpenChange={v => !v && setGradeMappingDialogOpen(false)}>
                  <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <PrdAnnotation data={getAnnotation("dialog-edit-grade-level")}><DialogTitle>编辑评分等级</DialogTitle></PrdAnnotation>
                    </DialogHeader>
                    {(() => {
                      const ep = info.points.find(p => p.id === editingGradeMappingPointId)
                      if (!ep || !ep.gradeMapping) return null
                      const gm = ep.gradeMapping
                      return (
                        <div className="space-y-3 py-2">
                          {gm.map((g, i) => (
                            <div key={g.id} className="flex items-start gap-2 p-3 rounded-lg border bg-gray-50/50">
                              <div className="flex-1 space-y-2">
                                <div className="flex items-center gap-2">
                                  <Input value={g.grade} onChange={e => {
                                    const newGm = gm.map(x => x.id === g.id ? { ...x, grade: e.target.value } : x)
                                    updateEvalPoint(info.field, ep.id, { gradeMapping: newGm })
                                  }} className="w-14 h-7 text-center text-xs font-semibold" placeholder="等级" />
                                  <Input type="number" value={g.minScore} onChange={e => {
                                    const newGm = gm.map(x => x.id === g.id ? { ...x, minScore: parseInt(e.target.value) || 0 } : x)
                                    updateEvalPoint(info.field, ep.id, { gradeMapping: newGm })
                                  }} className="w-16 h-7 text-center text-xs" min={0} max={100} />
                                  <span className="text-gray-500 text-xs">-</span>
                                  <Input type="number" value={g.maxScore} onChange={e => {
                                    const newGm = gm.map(x => x.id === g.id ? { ...x, maxScore: parseInt(e.target.value) || 0 } : x)
                                    updateEvalPoint(info.field, ep.id, { gradeMapping: newGm })
                                  }} className="w-16 h-7 text-center text-xs" min={0} max={100} />
                                  <span className="text-xs text-gray-500">分</span>
                                </div>
                                <Input value={g.remark || ""} onChange={e => {
                                  const newGm = gm.map(x => x.id === g.id ? { ...x, remark: e.target.value } : x)
                                  updateEvalPoint(info.field, ep.id, { gradeMapping: newGm })
                                }} className="h-7 text-xs" placeholder="等级描述" />
                              </div>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-gray-400 hover:text-red-500" onClick={() => {
                                const newGm = gm.filter(x => x.id !== g.id)
                                updateEvalPoint(info.field, ep.id, { gradeMapping: newGm })
                              }}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                          <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => {
                            const colors = ["bg-green-500", "bg-blue-500", "bg-yellow-500", "bg-red-500", "bg-purple-500", "bg-orange-500"]
                            const newId = `grade-${Date.now()}`
                            const newGm = [...gm, { id: newId, grade: "新等级", minScore: 0, maxScore: 100, color: colors[gm.length % colors.length], remark: "" }]
                            updateEvalPoint(info.field, ep.id, { gradeMapping: newGm })
                          }}>
                            <Plus className="h-3.5 w-3.5 mr-1" />新增等级
                          </Button>
                        </div>
                      )
                    })()}
                    <DialogFooter>
                      <Button variant="outline" size="sm" onClick={() => setGradeMappingDialogOpen(false)}>关闭</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            )
          }

          if (view === "template") {
            return (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Button variant="ghost" size="sm" className="text-xs h-8" onClick={() => setView("edit")}>
                    <ChevronLeft className="h-3.5 w-3.5 mr-1" />返回评价标准编辑
                  </Button>
                </div>
                <p className="text-sm font-medium">选择评价标准模板进行覆盖</p>
                <div className="grid grid-cols-1 gap-3">
                  {rubricLibrary.map(scheme => (
                    <div
                      key={scheme.id}
                      className="p-4 rounded-xl border border-gray-200 bg-white hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer"
                      onClick={() => {
                        applyScheme(scheme.id)
                        setView("edit")
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5">
                            <p className="text-sm font-semibold">{scheme.name}</p>
                            <Badge variant="outline" className={cn("text-[10px]", scheme.mode === "rubric" ? "bg-purple-50 text-purple-600 border-purple-200" : "bg-blue-50 text-blue-600 border-blue-200")}>
                              {scheme.mode === "rubric" ? "评价量规" : "评分规则"}
                            </Badge>
                          </div>
                          <p className="text-xs text-gray-400 mb-2">{scheme.desc}</p>
                          <div className="flex flex-wrap gap-1.5">
                            {scheme.types.map(type => (
                              <Badge key={type} variant="outline" className={cn("text-[10px]", evalSubTypeColors[type])}>{evalSubTypeLabels[type]}</Badge>
                            ))}
                          </div>
                          <p className="text-xs text-gray-400 mt-1.5">{scheme.mode === "rubric" ? `${scheme.points.length} 个评价点` : `${scheme.scoreRuleItems?.length || 0} 个评价项`}</p>
                        </div>
                        <Button size="sm" className="h-7 text-[11px] px-2.5 shrink-0 mt-0.5" onClick={(e) => { e.stopPropagation(); applyScheme(scheme.id); setView("edit"); }}>
                          使用此模板
                        </Button>
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
                  <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => { setView("template"); setEditingRubricId(null); }}>
                    <BookOpen className="h-3.5 w-3.5 mr-1" />选择评价标准模板覆盖
                  </Button>
                  <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => enterEdit(null)}>
                    <Plus className="h-3.5 w-3.5 mr-1" />添加评价标准
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {rubricLibrary.map(scheme => {
                  const isSelected = currentRubricId === scheme.id
                  return (
                    <div
                      key={scheme.id}
                      className={cn(
                        "p-4 rounded-xl border transition-all cursor-pointer",
                        isSelected
                          ? "border-primary bg-white ring-1 ring-primary/20 shadow-sm"
                          : "border-gray-200 bg-white hover:border-primary/40 hover:shadow-sm"
                      )}
                      onClick={() => {
                        if (isSelected) {
                          updateState({ [rubricIdField]: null } as any)
                          setEvalPoints(info.field, [])
                        } else {
                          applyScheme(scheme.id)
                        }
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5">
                            <p className="text-sm font-semibold">{scheme.name}</p>
                            <Badge variant="outline" className={cn("text-[10px]", scheme.mode === "rubric" ? "bg-purple-50 text-purple-600 border-purple-200" : "bg-blue-50 text-blue-600 border-blue-200")}>
                              {scheme.mode === "rubric" ? "评价量规" : "评分规则"}
                            </Badge>
                            {isSelected && (
                              <div className="flex items-center gap-1 text-primary text-xs font-medium bg-primary/5 px-2 py-0.5 rounded-full">
                                <CheckCircle2 className="h-3 w-3" />
                                已选用
                              </div>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 mb-2">{scheme.desc}</p>
                          <div className="flex flex-wrap gap-1.5">
                            {scheme.types.map(type => (
                              <Badge key={type} variant="outline" className={cn("text-[10px]", evalSubTypeColors[type])}>{evalSubTypeLabels[type]}</Badge>
                            ))}
                          </div>
                          <p className="text-xs text-gray-400 mt-1.5">{scheme.mode === "rubric" ? `${scheme.points.length} 个评价点` : `${scheme.scoreRuleItems?.length || 0} 个评价项`}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                          <Button
                            size="sm"
                            variant={isSelected ? "outline" : "default"}
                            className="h-7 text-[11px] px-2.5"
                            onClick={(e) => {
                              e.stopPropagation()
                              if (isSelected) {
                                updateState({ [rubricIdField]: null } as any)
                                setEvalPoints(info.field, [])
                              } else {
                                applyScheme(scheme.id)
                              }
                            }}
                          >
                            {isSelected ? "取消选用" : "选用"}
                          </Button>
                          <Button variant="outline" size="sm" className="h-7 text-[11px] px-2.5" onClick={(e) => { e.stopPropagation(); enterEdit(scheme.id); }}>
                            编辑
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
              {!currentRubricId && (
                <div className="text-center text-gray-400 py-6">
                  <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">尚未选用评价标准</p>
                  <p className="text-xs mt-1">请从上方列表中选用一个评价标准方案</p>
                </div>
              )}
            </div>
          )
        }

        const objectOptions = [
          { key: "individual", label: "个人", desc: "以个人为单位" },
          { key: "group", label: "小组", desc: "以小组为单位" },
        ] as const

        const ObjectCard = ({ methodKey, onClick }: { methodKey: string; onClick: () => void }) => {
          const currentObject = state.methodEvalObjects[methodKey] || state.evalObject
          const opt = objectOptions.find(o => o.key === currentObject)
          return (
            <button onClick={onClick} className="flex-1 min-w-0 p-4 rounded-xl border text-left transition-all hover:border-primary/50 hover:bg-primary/[0.02] bg-white group">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-4 w-4 text-gray-400 group-hover:text-primary" />
                <span className="text-xs font-medium text-gray-500">测评对象</span>
              </div>
              <p className="text-sm font-semibold truncate">{opt?.label || "未选择"}</p>
              <p className="text-xs text-gray-400 truncate mt-0.5">{opt?.desc || "点击配置"}</p>
            </button>
          )
        }

        const SubjectCard = ({ methodKey, onClick }: { methodKey: string; onClick: () => void }) => {
          const currentSubjects = state.methodEvalSubjects[methodKey] || state.evalSubjects
          const evalObject = state.methodEvalObjects[methodKey] || state.evalObject
          const enabledSubjects = currentSubjects.filter(s => s.enabled && !(s.type === "peer" && evalObject !== "group"))
          const totalWeight = enabledSubjects.reduce((s, sub) => s + (sub.params?.weightPercent || 0), 0)
          return (
            <button onClick={onClick} className="flex-1 min-w-0 p-4 rounded-xl border text-left transition-all hover:border-primary/50 hover:bg-primary/[0.02] bg-white group">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-gray-400 group-hover:text-primary" />
                  <span className="text-xs font-medium text-gray-500">评价主体</span>
                </div>
                {enabledSubjects.length > 0 && <Badge variant="outline" className="text-[10px]">{enabledSubjects.length} 类</Badge>}
              </div>
              <p className="text-sm font-semibold truncate">
                {enabledSubjects.length === 0 ? "未配置" : enabledSubjects.map(s => subjectLabels[s.type]).join("、")}
              </p>
              <p className="text-xs text-gray-400 truncate mt-0.5">
                {enabledSubjects.length === 0 ? "点击配置" : `总权重 ${totalWeight}%`}
              </p>
            </button>
          )
        }

        const ResourceCard = ({ methodKey, onClick }: { methodKey: string; onClick: () => void }) => {
          const summary = getMethodConfigSummary(methodKey)
          return (
            <button onClick={onClick} className="flex-1 min-w-0 p-4 rounded-xl border text-left transition-all hover:border-primary/50 hover:bg-primary/[0.02] bg-white group">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-gray-400 group-hover:text-primary" />
                  <span className="text-xs font-medium text-gray-500">测评资源</span>
                </div>
                {summary.configured && <CheckCircle2 className="h-3.5 w-3.5 text-primary" />}
              </div>
              <p className="text-sm font-semibold truncate">{summary.summary || "未配置"}</p>
              <p className="text-xs text-gray-400 truncate mt-0.5">&nbsp;</p>
            </button>
          )
        }

        const MethodCard = ({ methodKey, onClick }: { methodKey: string; onClick: () => void }) => {
          const info = getMethodEvalInfo(methodKey)
          const subTypeCount = Object.entries(
            info.points.reduce((acc, p) => {
              if (p.subType) acc[p.subType] = (acc[p.subType] || 0) + 1
              return acc
            }, {} as Record<string, number>)
          ).map(([k, v]) => `${evalSubTypeLabels[k as EvalSubType]}${v}`)
          return (
            <button onClick={onClick} className="flex-1 min-w-0 p-4 rounded-xl border text-left transition-all hover:border-primary/50 hover:bg-primary/[0.02] bg-white group">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-gray-400 group-hover:text-primary" />
                  <span className="text-xs font-medium text-gray-500">评价标准配置</span>
                </div>
                {info.points.length > 0 && <Badge variant="outline" className="text-[10px]">{info.points.length} 点</Badge>}
              </div>
              <p className="text-sm font-semibold truncate">
                {info.points.length === 0 ? "未配置评价点" : `${info.points.length} 个评价点`}
              </p>
              <p className="text-xs text-gray-400 truncate mt-0.5">
                {subTypeCount.length === 0 ? "点击配置" : subTypeCount.join(" · ")}
              </p>
            </button>
          )
        }

        const methodWeightTotal = state.evaluationMethods.reduce((sum, m) => sum + (state.methodWeights[m] || 0), 0)

        const updateMethodWeight = (methodKey: string, value: number) => {
          const clamped = Math.max(0, Math.min(100, value))
          updateState({ methodWeights: { ...state.methodWeights, [methodKey]: clamped } })
        }

        const distributeMethodWeights = () => {
          const count = state.evaluationMethods.length
          if (count === 0) return
          const base = Math.floor(100 / count)
          const remainder = 100 % count
          const newWeights: Record<string, number> = {}
          state.evaluationMethods.forEach((m, i) => {
            newWeights[m] = base + (i < remainder ? 1 : 0)
          })
          updateState({ methodWeights: newWeights })
        }

        const moveMethodUp = (index: number) => {
          if (index <= 0) return
          const newMethods = [...state.evaluationMethods]
          const temp = newMethods[index]
          newMethods[index] = newMethods[index - 1]
          newMethods[index - 1] = temp
          updateState({ evaluationMethods: newMethods })
        }

        const moveMethodDown = (index: number) => {
          if (index >= state.evaluationMethods.length - 1) return
          const newMethods = [...state.evaluationMethods]
          const temp = newMethods[index]
          newMethods[index] = newMethods[index + 1]
          newMethods[index + 1] = temp
          updateState({ evaluationMethods: newMethods })
        }

        return (
          <div className="h-full flex flex-col">
            {state.evaluationMethods.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                <Target className="h-12 w-12 mb-3 opacity-50" />
                <p className="text-sm">尚未配置评价方式</p>
                <p className="text-xs mt-1">请先在「配置任务测评形式」中选择评价类型</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-5 p-1">
                {/* 评价方式顺序和权重配置入口 */}
                <div className="flex items-center gap-3">
                  <Button variant="outline" size="sm" className="text-xs h-9" onClick={() => setIsOrderConfigOpen(true)}>
                    <ListOrdered className="h-3.5 w-3.5 mr-1.5" />
                    配置评价顺序
                  </Button>
                  <Button variant="outline" size="sm" className="text-xs h-9" onClick={() => setIsWeightConfigOpen(true)}>
                    <Scale className="h-3.5 w-3.5 mr-1.5" />
                    配置评价权重
                    <span className={cn(
                      "ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                      methodWeightTotal === 100 ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
                    )}>
                      {methodWeightTotal}%
                    </span>
                  </Button>
                </div>

                {/* 评价方式顺序配置弹窗 */}
                <Dialog open={isOrderConfigOpen} onOpenChange={setIsOrderConfigOpen}>
                  <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                      <PrdAnnotation data={getAnnotation("dialog-eval-order")}><DialogTitle>评价方式顺序配置</DialogTitle></PrdAnnotation>
                      <DialogDescription>点击箭头调整评价方式的执行顺序</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-1.5 py-4">
                      {getMethodInstances().map(({ methodKey, instanceIndex }, index) => {
                        const method = evaluationMethodOptions.find(o => o.key === methodKey)
                        if (!method) return null
                        const instanceCount = methodInstanceCounts[methodKey] || 1
                        const displayLabel = instanceCount > 1 ? `${method.label} ${instanceIndex + 1}` : method.label
                        const instanceKey = `${methodKey}-${instanceIndex}`
                        return (
                          <div
                            key={instanceKey}
                            className="flex items-center gap-3 p-2.5 rounded-lg border border-gray-100 bg-gray-50/50"
                          >
                            <span className="w-5 h-5 rounded-full bg-gray-200 text-gray-500 text-[10px] flex items-center justify-center font-medium">
                              {index + 1}
                            </span>
                            <div className={cn("p-1.5 rounded-md", method.color)}>{method.icon}</div>
                            <span className="text-sm font-medium flex-1">{displayLabel}</span>
                            <div className="flex items-center gap-0.5">
                              <button
                                onClick={() => moveMethodUp(index)}
                                disabled={index === 0}
                                className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-200/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                              >
                                <ChevronUp className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => moveMethodDown(index)}
                                disabled={index === getMethodInstances().length - 1}
                                className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-200/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                              >
                                <ChevronDown className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    <DialogFooter>
                      <Button onClick={() => setIsOrderConfigOpen(false)}>完成</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                {/* 评价方式权重配置弹窗 */}
                <Dialog open={isWeightConfigOpen} onOpenChange={setIsWeightConfigOpen}>
                  <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                      <PrdAnnotation data={getAnnotation("dialog-eval-weight")}><DialogTitle>评价方式权重配置</DialogTitle></PrdAnnotation>
                      <DialogDescription>
                        配置各评价方式的权重占比，合计需等于 100%
                      </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className={cn(
                          "flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium",
                          methodWeightTotal === 100 ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
                        )}>
                          <span>合计</span>
                          <span>{methodWeightTotal}%</span>
                          {methodWeightTotal !== 100 && <span className="text-[10px]">(需等于100%)</span>}
                        </div>
                        <Button variant="outline" size="sm" className="text-xs h-8" onClick={distributeMethodWeights}>
                          <RotateCcw className="h-3.5 w-3.5 mr-1" />一键平均
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        {getMethodInstances().map(({ methodKey, instanceIndex }) => {
                          const method = evaluationMethodOptions.find(o => o.key === methodKey)
                          if (!method) return null
                          const instanceCount = methodInstanceCounts[methodKey] || 1
                          const displayLabel = instanceCount > 1 ? `${method.label} ${instanceIndex + 1}` : method.label
                          const instanceKey = `${methodKey}-${instanceIndex}`
                          const weight = state.methodWeights[methodKey] || 0
                          return (
                            <div key={instanceKey} className="flex items-center gap-2.5 p-3 rounded-lg border border-gray-100 bg-gray-50/50">
                              <div className={cn("p-1.5 rounded-md shrink-0", method.color)}>
                                {method.icon}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-gray-700 truncate">{displayLabel}</p>
                                <div className="flex items-center gap-1 mt-1">
                                  <Input
                                    type="number"
                                    value={weight}
                                    onChange={e => updateMethodWeight(methodKey, parseInt(e.target.value) || 0)}
                                    className="h-7 text-xs w-16 text-center"
                                    min={0}
                                    max={100}
                                  />
                                  <span className="text-xs text-gray-400">%</span>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                    <DialogFooter>
                      <Button onClick={() => setIsWeightConfigOpen(false)}>完成</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                {getMethodInstances().map(({ methodKey, instanceIndex }) => {
                  const method = evaluationMethodOptions.find(o => o.key === methodKey)
                  if (!method) return null
                  const instanceCount = methodInstanceCounts[methodKey] || 1
                  const displayLabel = instanceCount > 1 ? `${method.label} ${instanceIndex + 1}` : method.label
                  const instanceKey = `${methodKey}-${instanceIndex}`
                  return (
                    <div key={instanceKey} className="border border-border rounded-xl p-5 bg-white shadow-sm">
                      <div className="flex items-center gap-3 mb-4">
                        <div className={cn("p-2 rounded-lg", method.color)}>{method.icon}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold">{displayLabel}</p>
                          <p className="text-xs text-gray-400">{method.desc}</p>
                        </div>
                        <button
                          onClick={() => {
                            if (confirm(`确定要复制「${method.label}」测评方式吗？`)) {
                              duplicateMethod(methodKey)
                            }
                          }}
                          className="flex items-center gap-1 px-2 py-1 rounded-md text-gray-400 hover:text-primary hover:bg-primary/10 transition-colors text-xs"
                          title="复制测评方式"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                          复制测评方式
                        </button>
                      </div>
                      <div className="flex items-center gap-1">
                        <ObjectCard methodKey={methodKey} onClick={() => openDialog("object", methodKey)} />
                        <div className="flex flex-col items-center justify-center text-gray-300 shrink-0 px-0.5">
                          <span className="text-[10px] font-medium">①</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </div>
                        <SubjectCard methodKey={methodKey} onClick={() => openDialog("subject", methodKey)} />
                        <div className="flex flex-col items-center justify-center text-gray-300 shrink-0 px-0.5">
                          <span className="text-[10px] font-medium">②</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </div>
                        <ResourceCard methodKey={methodKey} onClick={() => openDialog("resource", methodKey)} />
                        <div className="flex flex-col items-center justify-center text-gray-300 shrink-0 px-0.5">
                          <span className="text-[10px] font-medium">③</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </div>
                        {(methodKey === "question_bank" || methodKey === "paper" || methodKey === "quiz") ? (
                          <div className="flex-1 min-w-0 p-4 rounded-xl border text-left bg-green-50/50 border-green-100">
                            <div className="flex items-center gap-2 mb-2">
                              <Target className="h-4 w-4 text-green-500" />
                              <span className="text-xs font-medium text-green-600">评价标准配置</span>
                            </div>
                            <p className="text-sm font-semibold text-green-700">自动读取得分</p>
                            <p className="text-xs text-green-500 truncate mt-0.5">系统将自动读取上一步测评资源的得分</p>
                          </div>
                        ) : (
                          <MethodCard methodKey={methodKey} onClick={() => openDialog("method", methodKey)} />
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <Dialog open={erDialogOpen === "object"} onOpenChange={v => !v && setErDialogOpen(null)}>
              <DialogContent className="sm:max-w-[63vw] max-w-[63vw] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <PrdAnnotation data={getAnnotation("dialog-test-object")}><DialogTitle>测评对象配置</DialogTitle></PrdAnnotation>
                  <DialogDescription>
                    配置 {erDialogMethod ? evaluationMethodOptions.find(o => o.key === erDialogMethod)?.label : ""} 的测评对象
                  </DialogDescription>
                </DialogHeader>
                {erDialogMethod && <ObjectDialogContent methodKey={erDialogMethod} />}
              </DialogContent>
            </Dialog>

            <Dialog open={erDialogOpen === "subject"} onOpenChange={v => !v && setErDialogOpen(null)}>
              <DialogContent className="sm:max-w-[72vw] max-w-[72vw] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <PrdAnnotation data={getAnnotation("dialog-eval-subject")}><DialogTitle>评价主体配置</DialogTitle></PrdAnnotation>
                  <DialogDescription>
                    配置 {erDialogMethod ? evaluationMethodOptions.find(o => o.key === erDialogMethod)?.label : ""} 的评价主体
                  </DialogDescription>
                </DialogHeader>
                {erDialogMethod && <SubjectDialogContent methodKey={erDialogMethod} />}
              </DialogContent>
            </Dialog>

            <Dialog open={erDialogOpen === "resource"} onOpenChange={v => !v && setErDialogOpen(null)}>
              <DialogContent className="sm:max-w-[72vw] max-w-[72vw] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <PrdAnnotation data={getAnnotation("dialog-test-resource")}><DialogTitle>测评资源配置</DialogTitle></PrdAnnotation>
                  <DialogDescription>
                    配置 {erDialogMethod ? evaluationMethodOptions.find(o => o.key === erDialogMethod)?.label : ""} 的测评资源
                  </DialogDescription>
                </DialogHeader>
                {erDialogMethod === "question_bank" ? (
                  <BankQuestionSelectorPanel
                    field="questionBankQuestions"
                    selectedIds={state.questionBankQuestions}
                    onToggleQuestion={(qid) => toggleQuestion(qid, "questionBankQuestions")}
                    questionScores={state.methodResourceConfigs?.question_bank?.questionScores || {}}
                    onUpdateQuestionScore={(qid, score) => updateState({ methodResourceConfigs: { ...state.methodResourceConfigs, question_bank: { ...(state.methodResourceConfigs.question_bank || {}), questionScores: { ...(state.methodResourceConfigs.question_bank?.questionScores || {}), [qid]: score } } } })}
                    onUpdateQuestionScores={(scores) => updateState({ methodResourceConfigs: { ...state.methodResourceConfigs, question_bank: { ...(state.methodResourceConfigs.question_bank || {}), questionScores: { ...(state.methodResourceConfigs.question_bank?.questionScores || {}), ...scores } } } })}
                  />
                ) : erDialogMethod === "quiz" ? (
                  <BankQuestionSelectorPanel
                    field="quizQuestions"
                    selectedIds={state.quizQuestions}
                    maxCount={30}
                    onToggleQuestion={(qid) => toggleQuestion(qid, "quizQuestions")}
                    questionScores={state.methodResourceConfigs?.quiz?.questionScores || {}}
                    onUpdateQuestionScore={(qid, score) => updateState({ methodResourceConfigs: { ...state.methodResourceConfigs, quiz: { ...(state.methodResourceConfigs.quiz || {}), questionScores: { ...(state.methodResourceConfigs.quiz?.questionScores || {}), [qid]: score } } } })}
                    onUpdateQuestionScores={(scores) => updateState({ methodResourceConfigs: { ...state.methodResourceConfigs, quiz: { ...(state.methodResourceConfigs.quiz || {}), questionScores: { ...(state.methodResourceConfigs.quiz?.questionScores || {}), ...scores } } } })}
                  />
                ) : erDialogMethod === "random_draw" ? (
                  <RandomDrawResourcePanel
                    state={state}
                    updateState={updateState}
                    rdqSearch={rdqSearch}
                    setRdqSearch={setRdqSearch}
                    rdqActionOpen={rdqActionOpen}
                    setRdqActionOpen={setRdqActionOpen}
                    rdqActionMode={rdqActionMode}
                    setRdqActionMode={setRdqActionMode}
                    rdqActionTarget={rdqActionTarget}
                    setRdqActionTarget={setRdqActionTarget}
                    newRdqForm={newRdqForm}
                    setNewRdqForm={setNewRdqForm}
                    rdqDetailOpen={rdqDetailOpen}
                    setRdqDetailOpen={setRdqDetailOpen}
                    selectedRdqForDetail={selectedRdqForDetail}
                    setSelectedRdqForDetail={setSelectedRdqForDetail}
                  />
                ) : erDialogMethod ? (
                  <EvalResourceOnlyPanel methodKey={erDialogMethod} />
                ) : null}
              </DialogContent>
            </Dialog>

            <Dialog open={erDialogOpen === "method"} onOpenChange={v => !v && setErDialogOpen(null)}>
              <DialogContent className="sm:max-w-[72vw] max-w-[72vw] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <PrdAnnotation data={getAnnotation("dialog-eval-standard")}><DialogTitle>评价标准配置</DialogTitle></PrdAnnotation>
                  <DialogDescription>
                    配置 {erDialogMethod ? evaluationMethodOptions.find(o => o.key === erDialogMethod)?.label : ""} 的评价点与评分规则
                  </DialogDescription>
                </DialogHeader>
                {erDialogMethod && <MethodDialogContent methodKey={erDialogMethod} />}
              </DialogContent>
            </Dialog>

            <Dialog open={questionDetailOpen} onOpenChange={setQuestionDetailOpen}>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <PrdAnnotation data={getAnnotation("dialog-question-detail")}><DialogTitle>题目详情</DialogTitle></PrdAnnotation>
                </DialogHeader>
                {(() => {
                  const q = allQuestions.find(aq => aq.id === selectedQuestionForDetail) as any
                  if (!q) return null
                  return (
                    <div className="space-y-3 py-2">
                      <div>
                        <Label className="text-xs text-gray-500">题目名称</Label>
                        <p className="text-sm font-medium mt-1">{q.name}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">题目内容</Label>
                        <p className="text-sm mt-1">{q.content}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div>
                          <Label className="text-xs text-gray-500">题型</Label>
                          <p className="text-sm mt-1">{questionTypeLabels[q.type] || q.type}</p>
                        </div>
                        <div>
                          <Label className="text-xs text-gray-500">难度</Label>
                          <p className="text-sm mt-1">{difficultyLabels[q.difficulty] || q.difficulty}</p>
                        </div>
                        <div>
                          <Label className="text-xs text-gray-500">分值</Label>
                          <p className="text-sm mt-1">{q.score}分</p>
                        </div>
                        <div>
                          <Label className="text-xs text-gray-500">所属题库</Label>
                          <p className="text-sm mt-1">{questionBankLabels[q.questionBank] || q.questionBank || "-"}</p>
                        </div>
                      </div>
                      {q.options && q.options.length > 0 && (
                        <div>
                          <Label className="text-xs text-gray-500">选项</Label>
                          <div className="space-y-1 mt-1">
                            {q.options.map((opt: string, i: number) => (
                              <div key={i} className={cn("text-sm p-2 rounded border", Array.isArray(q.answer) ? q.answer.includes(opt) ? "border-green-300 bg-green-50" : "border-gray-200" : q.answer === opt ? "border-green-300 bg-green-50" : "border-gray-200")}>
                                {String.fromCharCode(65 + i)}. {opt}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {q.type === "judgment" && (
                        <div>
                          <Label className="text-xs text-gray-500">正确答案</Label>
                          <p className="text-sm mt-1">{q.answer === "true" ? "正确" : "错误"}</p>
                        </div>
                      )}
                      {q.type === "subjective" && q.answer && (
                        <div>
                          <Label className="text-xs text-gray-500">参考答案</Label>
                          <p className="text-sm mt-1">{q.answer}</p>
                        </div>
                      )}
                      {Array.isArray(q.answer) && q.type !== "judgment" && (
                        <div>
                          <Label className="text-xs text-gray-500">正确答案</Label>
                          <p className="text-sm mt-1">{q.answer.join(", ")}</p>
                        </div>
                      )}
                      {!Array.isArray(q.answer) && q.type !== "judgment" && q.type !== "subjective" && (
                        <div>
                          <Label className="text-xs text-gray-500">正确答案</Label>
                          <p className="text-sm mt-1">{q.answer}</p>
                        </div>
                      )}
                    </div>
                  )
                })()}
                <DialogFooter>
                  <Button variant="outline" onClick={() => setQuestionDetailOpen(false)}>关闭</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={showAddQuestion} onOpenChange={setShowAddQuestion}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>新增题目</DialogTitle>
                </DialogHeader>
                <div className="py-8 text-center text-gray-500">
                  此处参考 1.0 版本页面功能即可
                </div>
                <DialogFooter>
                  <Button onClick={() => setShowAddQuestion(false)}>知道了</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Paper Detail Dialog */}
            <PaperDetailWrapper
              paperId={selectedPaperForDetail}
              open={paperDetailOpen}
              onOpenChange={setPaperDetailOpen}
            />

            {/* Create Paper Dialog */}
            <ExamFormDialog
              open={showCreatePaper}
              onOpenChange={setShowCreatePaper}
              onSubmit={async (data) => {
                try {
                  const created = await examApi.create(data as any)
                  loadedExams.push(created)
                  updateState({ paperIds: [created.id], paperWeights: { [created.id]: 100 } })
                  setShowCreatePaper(false)
                  setConfigPaperId(created.id)
                  setConfigSelectedIds([])
                } catch (_) {
                  alert("创建试卷失败")
                }
              }}
            />

            {/* Rubric Knowledge Points Multi-Select Dialog */}
            <Dialog open={rubricKpDialogOpen} onOpenChange={v => { if (!v) setRubricKpDialogOpen(false) }}>
              <DialogContent
        className="sm:max-w-3xl max-h-[90vh] flex flex-col"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
                <DialogHeader>
                  <PrdAnnotation data={getAnnotation("dialog-link-knowledge-eval")}><DialogTitle>关联考查知识点</DialogTitle></PrdAnnotation>
                  <DialogDescription>此处仅可选择任务关联的知识点/能力点，请先在任务中配置后选择。</DialogDescription>
                </DialogHeader>
                {(() => {
                  const field = rubricKpTargetField
                  const pointId = rubricKpTargetPointId
                  const ep = field && pointId ? getEvalPoints(field as EvalPointField).find(p => p.id === pointId) : null
                  const selectedIds = ep?.knowledgePointIds || []
                  const filteredKp = knowledgePoints.filter(k => !rubricKpSearch || k.name.includes(rubricKpSearch) || k.description.includes(rubricKpSearch) || (k.code && k.code.includes(rubricKpSearch)))

                  const toggleKp = (kpId: string) => {
                    if (!field || !pointId) return
                    const newIds = selectedIds.includes(kpId) ? selectedIds.filter(id => id !== kpId) : [...selectedIds, kpId]
                    updateEvalPoint(field as EvalPointField, pointId, { knowledgePointIds: newIds })
                  }

                  return (
                    <div className="flex gap-4 flex-1 min-h-0 py-2">
                      <div className="w-3/5 flex flex-col min-h-0 border rounded-xl p-3">
                        <div className="relative mb-3">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <Input value={rubricKpSearch} onChange={e => setRubricKpSearch(e.target.value)} placeholder="搜索知识点名称、描述或编码..." className="pl-9" />
                        </div>
                        <div className="flex-1 overflow-y-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-gray-50 sticky top-0 z-10">
                              <tr>
                                <th className="text-left text-xs font-medium text-gray-500 px-3 py-2 w-[30%]">知识点名称</th>
                                <th className="text-left text-xs font-medium text-gray-500 px-3 py-2 w-[20%]">编码</th>
                                <th className="text-left text-xs font-medium text-gray-500 px-3 py-2 w-[35%]">描述</th>
                                <th className="text-right text-xs font-medium text-gray-500 px-3 py-2 w-[15%]">操作</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {filteredKp.map(kp => {
                                const isSelected = selectedIds.includes(kp.id)
                                return (
                                  <tr key={kp.id} className={cn("hover:bg-gray-50 cursor-pointer", isSelected ? "bg-primary/[0.03]" : "")} onClick={() => toggleKp(kp.id)}>
                                    <td className="px-3 py-2">
                                      <div className="flex items-center gap-2">
                                        <div className={cn("w-4 h-4 rounded border flex items-center justify-center shrink-0", isSelected ? "bg-primary border-primary" : "border-gray-300")}>
                                          {isSelected && <Check className="h-3 w-3 text-white" />}
                                        </div>
                                        <span className="text-sm font-medium text-gray-800">{kp.name}</span>
                                      </div>
                                    </td>
                                    <td className="px-3 py-2">{kp.code ? <Badge variant="outline" className="text-[10px] h-5 px-1.5">{kp.code}</Badge> : <span className="text-xs text-gray-400">-</span>}</td>
                                    <td className="px-3 py-2"><p className="text-xs text-gray-500 line-clamp-1">{kp.description}</p></td>
                                    <td className="px-3 py-2 text-right">
                                      {isSelected ? (
                                        <Button size="sm" variant="outline" className="h-6 text-[11px] px-2" onClick={e => { e.stopPropagation(); toggleKp(kp.id); }}>取消</Button>
                                      ) : (
                                        <Button size="sm" className="h-6 text-[11px] px-2" onClick={e => { e.stopPropagation(); toggleKp(kp.id); }}>选择</Button>
                                      )}
                                    </td>
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
                          {selectedIds.length === 0 && (
                            <div className="text-center text-gray-400 py-8">
                              <Lightbulb className="h-8 w-8 mx-auto mb-2 opacity-50" />
                              <p className="text-xs">从左侧选择知识点</p>
                            </div>
                          )}
                          {selectedIds.map(kpId => {
                            const kp = knowledgePoints.find(k => k.id === kpId)
                            if (!kp) return null
                            return (
                              <div key={kpId} className="p-2 rounded-lg border border-primary/20 bg-primary/5">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-medium flex-1 truncate">{kp.name}</span>
                                  <PrdAnnotation data={getAnnotation("kp-right-delete")}>
                                    <Button variant="ghost" size="icon" className="h-5 w-5 text-gray-400" onClick={() => toggleKp(kpId)}><X className="h-3 w-3" /></Button>
                                  </PrdAnnotation>
                                </div>
                                <p className="text-[10px] text-gray-500 line-clamp-1">{kp.description}</p>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  )
                })()}
                <DialogFooter>
                  <Button onClick={() => setRubricKpDialogOpen(false)}>完成</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Rubric Ability Points Multi-Select Dialog */}
            <Dialog open={rubricAbDialogOpen} onOpenChange={v => { if (!v) setRubricAbDialogOpen(false) }}>
              <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                  <PrdAnnotation data={getAnnotation("dialog-link-ability-eval")}><DialogTitle>关联考查能力点</DialogTitle></PrdAnnotation>
                  <DialogDescription>此处仅可选择任务关联的知识点/能力点，请先在任务中配置后选择。</DialogDescription>
                </DialogHeader>
                {(() => {
                  const field = rubricAbTargetField
                  const pointId = rubricAbTargetPointId
                  const ep = field && pointId ? getEvalPoints(field as EvalPointField).find(p => p.id === pointId) : null
                  const selectedIds = ep?.abilityPointIds || []
                  const filteredAb = abilityPoints.filter(a => !rubricAbSearch || (a.name || "").includes(rubricAbSearch) || (a.description || "").includes(rubricAbSearch) || (a.code || "").includes(rubricAbSearch))

                  const toggleAb = (abId: string) => {
                    if (!field || !pointId) return
                    const newIds = selectedIds.includes(abId) ? selectedIds.filter(id => id !== abId) : [...selectedIds, abId]
                    updateEvalPoint(field as EvalPointField, pointId, { abilityPointIds: newIds })
                  }

                  return (
                    <div className="flex gap-4 flex-1 min-h-0 py-2">
                      <div className="w-3/5 flex flex-col min-h-0 border rounded-xl p-3">
                        <div className="relative mb-3">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <Input value={rubricAbSearch} onChange={e => setRubricAbSearch(e.target.value)} placeholder="搜索能力点名称、描述或编码..." className="pl-9" />
                        </div>
                        <div className="flex-1 overflow-y-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-gray-50 sticky top-0 z-10">
                              <tr>
                                <th className="text-left text-xs font-medium text-gray-500 px-3 py-2 w-[30%]">能力点名称</th>
                                <th className="text-left text-xs font-medium text-gray-500 px-3 py-2 w-[20%]">编码</th>
                                <th className="text-left text-xs font-medium text-gray-500 px-3 py-2 w-[35%]">描述</th>
                                <th className="text-right text-xs font-medium text-gray-500 px-3 py-2 w-[15%]">操作</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {filteredAb.map(ab => {
                                const isSelected = selectedIds.includes(ab.id)
                                return (
                                  <tr key={ab.id} className={cn("hover:bg-gray-50 cursor-pointer", isSelected ? "bg-primary/[0.03]" : "")} onClick={() => toggleAb(ab.id)}>
                                    <td className="px-3 py-2">
                                      <div className="flex items-center gap-2">
                                        <div className={cn("w-4 h-4 rounded border flex items-center justify-center shrink-0", isSelected ? "bg-primary border-primary" : "border-gray-300")}>
                                          {isSelected && <Check className="h-3 w-3 text-white" />}
                                        </div>
                                        <span className="text-sm font-medium text-gray-800">{ab.name}</span>
                                      </div>
                                    </td>
                                    <td className="px-3 py-2">{ab.code ? <Badge variant="outline" className="text-[10px] h-5 px-1.5">{ab.code}</Badge> : <span className="text-xs text-gray-400">-</span>}</td>
                                    <td className="px-3 py-2"><p className="text-xs text-gray-500 line-clamp-1">{ab.description}</p></td>
                                    <td className="px-3 py-2 text-right">
                                      {isSelected ? (
                                        <Button size="sm" variant="outline" className="h-6 text-[11px] px-2" onClick={e => { e.stopPropagation(); toggleAb(ab.id); }}>取消</Button>
                                      ) : (
                                        <Button size="sm" className="h-6 text-[11px] px-2" onClick={e => { e.stopPropagation(); toggleAb(ab.id); }}>选择</Button>
                                      )}
                                    </td>
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
                          {selectedIds.length === 0 && (
                            <div className="text-center text-gray-400 py-8">
                              <Award className="h-8 w-8 mx-auto mb-2 opacity-50" />
                              <p className="text-xs">从左侧选择能力点</p>
                            </div>
                          )}
                          {selectedIds.map(abId => {
                            const ab = abilityPoints.find(a => a.id === abId)
                            if (!ab) return null
                            return (
                              <div key={abId} className="p-2 rounded-lg border border-primary/20 bg-primary/5">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-medium flex-1 truncate">{ab.name}</span>
                                  <PrdAnnotation data={getAnnotation("ability-action-cancel")}>
                                    <Button variant="ghost" size="icon" className="h-5 w-5 text-gray-400" onClick={() => toggleAb(abId)}><X className="h-3 w-3" /></Button>
                                  </PrdAnnotation>
                                </div>
                                <p className="text-[10px] text-gray-500 line-clamp-1">{ab.description}</p>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  )
                })()}
                <DialogFooter>
                  <Button onClick={() => setRubricAbDialogOpen(false)}>完成</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )
      }

      case "weight": {
        return (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <Scale className="h-12 w-12 mb-3 opacity-50" />
            <p className="text-sm">任务权重已在全局配置</p>
            <p className="text-xs mt-1">请点击顶部「配置任务权重」按钮进行设置</p>
          </div>
        )
      }
    }
  }

  const isFullScreen = cardType === "evaluationRules" || cardType === "weight" || cardType === "knowledge" || cardType === "ability" || cardType === "resources"
  const dialogSizeClass =
    isFullScreen
      ? "sm:max-w-[95vw] max-h-[95vh] h-[95vh]"
      : cardType === "evaluation"
        ? "sm:max-w-[720px] max-h-[85vh]"
        : cardType === "description"
          ? "sm:max-w-[900px] max-h-[90vh]"
          : cardType === "info"
            ? "sm:max-w-[650px] max-h-[85vh]"
            : "sm:max-w-[550px] max-h-[85vh]"

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className={cn(
        "flex flex-col overflow-hidden",
        dialogSizeClass
      )}>
        <DialogHeader>
          <PrdAnnotation data={getAnnotation(`editor-card-${config.type}`)}>
            <DialogTitle className="flex items-center gap-2">
              <div className="p-1.5 bg-primary/10 rounded">{config.icon}</div>
              {config.title}
            </DialogTitle>
          </PrdAnnotation>
          <DialogDescription>任务：{task.name}</DialogDescription>
        </DialogHeader>
        <div className={cn("flex-1 py-4", isFullScreen ? "overflow-hidden" : "overflow-y-auto")}>{renderContent()}</div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={handleSave}>保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============ Weight Config Dialog ============

function WeightConfigDialog({
  open,
  onOpenChange,
  tasks,
  taskStates,
  updateAnyState,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  tasks: Task[]
  taskStates: Record<string, TaskState>
  updateAnyState: (id: string, u: Partial<TaskState>) => void
}) {
  const colors = ["bg-blue-500", "bg-green-500", "bg-purple-500", "bg-orange-500", "bg-cyan-500", "bg-pink-500"]
  const pieColors = ["#3b82f6", "#22c55e", "#a855f7", "#f97316", "#06b6d4", "#ec4899"]

  const handleGlobalWeightChange = (tid: string, val: number) => {
    updateAnyState(tid, { weight: Math.max(0, Math.min(100, val)) })
  }

  const toggleGlobalLock = (tid: string) => {
    const s = taskStates[tid]
    updateAnyState(tid, { locked: !s?.locked })
  }

  const distributeGlobal = () => {
    const unlocked = tasks.filter(t => !taskStates[t.id]?.locked)
    const lockedWeight = tasks.filter(t => taskStates[t.id]?.locked).reduce((s, t) => s + (taskStates[t.id]?.weight || 0), 0)
    const remaining = 100 - lockedWeight
    const each = Math.floor(remaining / unlocked.length)
    unlocked.forEach((t, i) => {
      updateAnyState(t.id, { weight: each + (i < remaining % unlocked.length ? 1 : 0) })
    })
  }

  const totalW = tasks.reduce((sum, t) => sum + (taskStates[t.id]?.weight || 0), 0)

  const pieData = tasks.map((t, i) => ({
    name: t.name,
    value: taskStates[t.id]?.weight || 0,
    color: pieColors[i % pieColors.length],
  })).filter(d => d.value > 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-3xl max-h-[90vh] flex flex-col"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <PrdAnnotation data={getAnnotation("editor-config-weight")}>
            <DialogTitle className="flex items-center gap-2">
              <PieChartIcon className="h-5 w-5" />
              配置任务权重
            </DialogTitle>
          </PrdAnnotation>
          <DialogDescription>调整所有任务的权重分配，总权重应为 100%</DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto py-4 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className={cn("text-lg font-semibold", totalW === 100 ? "text-green-600" : "text-amber-600")}>总权重: {totalW}%</span>
              {totalW !== 100 && <span className="text-sm text-amber-600">{totalW > 100 ? `超出 ${totalW - 100}%` : `还需分配 ${100 - totalW}%`}</span>}
            </div>
            <Button variant="outline" size="sm" onClick={distributeGlobal}>
              <Scale className="mr-2 h-4 w-4" />
              一键平均分配
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-6">
            {/* Pie Chart */}
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `${value}%`} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Legend */}
            <div className="h-64 overflow-y-auto space-y-2">
              {tasks.map((t, i) => (
                <div key={t.id} className="flex items-center gap-2 text-sm">
                  <div className={cn("w-3 h-3 rounded-full shrink-0", colors[i % colors.length])} />
                  <span className="truncate flex-1">{t.name}</span>
                  <span className="text-gray-500 font-medium">{taskStates[t.id]?.weight || 0}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Progress Bar */}
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden flex">
            {tasks.map((t, i) => (
              <div key={t.id} className={cn("transition-all duration-300", colors[i % colors.length])} style={{ width: `${taskStates[t.id]?.weight || 0}%` }} />
            ))}
          </div>

          {/* Task List */}
          <div className="space-y-2">
            {tasks.map((t, i) => {
              const s = taskStates[t.id]
              return (
                <div key={t.id} className="flex items-center gap-4 p-3 rounded-lg border border-gray-100 bg-white hover:border-gray-200 transition-colors">
                  <div className={cn("w-3 h-8 rounded-full shrink-0", colors[i % colors.length])} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-xs font-medium text-gray-600">{i + 1}</span>
                      <span className="font-medium text-gray-700 truncate text-sm">{t.name}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Input type="number" value={s?.weight || 0} onChange={e => handleGlobalWeightChange(t.id, parseInt(e.target.value) || 0)} disabled={s?.locked} className={cn("w-20 text-center", s?.locked && "bg-gray-50")} min={0} max={100} />
                    <span className="text-gray-500 w-4">%</span>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => toggleGlobalLock(t.id)} className={cn("h-8 w-8", s?.locked ? "text-amber-500" : "text-gray-400")}>
                    {s?.locked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                  </Button>
                </div>
              )
            })}
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button
            disabled={totalW !== 100}
            onClick={() => onOpenChange(false)}
          >
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
