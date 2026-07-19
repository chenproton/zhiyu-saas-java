"use client"

import { useState, useRef, Suspense, useMemo, useCallback, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import {
  ArrowLeft,
  Save,
  Send,
  Star,
  BookOpen,
  GraduationCap,
  ClipboardList,
  Award,
  Database,
  ChevronDown,
  ChevronRight,
  Info,
  ImageUp,
  Upload,
  Copy,
  Link2,
  Search,
  CheckCircle2,
  Sparkles,
  X,
} from "lucide-react"
import { toast, Toaster } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import type { SystemCourseNode, NodeResource, NodeRefType } from "@/lib/types/lesson-source"

import { KnowledgeSelector } from "../../_components/knowledge/knowledge-selector"
import { ResourceSelector, type ResourceItem } from "../../_components/resources/resource-selector"
import { EvaluationMethodSelector } from "../../_components/assessment/evaluation-method-selector"
import { CourseEvaluationRulesDialog } from "../../_components/assessment/course-evaluation-rules-dialog"
import { RichTextEditor } from "../../_components/common/rich-text-editor"

import CourseNodeTree from "./_components/CourseNodeTree"
import PublishCheckPanel from "./_components/PublishCheckPanel"

import type { KnowledgePointItem } from "@/lib/types/lesson"
import { courseApi, courseNodeApi, knowledgeApi, approvalApi, majorApi, fileApi } from "@/lib/api"

/* ---------- node editing mode ---------- */

type AddMode = "upload" | "clone" | "quote"

interface NodeDraft {
  hours: string
  learningGoal: string
  knowledgePoints: KnowledgePointItem[]
  selectedResourceIds: string[]
  selectedEvalMethods: string[]
  difficulty: number
}

interface GrainCourseOption {
  id: string
  name: string
  description: string
  source: string
  duration: number
}

/* ---------- convert preview tree ---------- */

interface PreviewTreeItem {
  node: SystemCourseNode
  level: number
  children: PreviewTreeItem[]
}

function buildPreviewTree(nodes: SystemCourseNode[]): PreviewTreeItem[] {
  const map = new Map<string, PreviewTreeItem>()
  const roots: PreviewTreeItem[] = []
  const sorted = [...nodes].sort((a, b) => a.order - b.order)
  sorted.forEach((node) => {
    map.set(node.id, { node, level: 0, children: [] })
  })
  sorted.forEach((node) => {
    const item = map.get(node.id)!
    if (node.parentId && map.has(node.parentId)) {
      const parent = map.get(node.parentId)!
      item.level = parent.level + 1
      parent.children.push(item)
    } else {
      roots.push(item)
    }
  })
  return roots
}

function ConvertPreviewTree({
  nodes,
  convertedIds,
}: {
  nodes: SystemCourseNode[]
  convertedIds: Set<string>
}) {
  const tree = useMemo(() => buildPreviewTree(nodes), [nodes])

  const renderItem = (item: PreviewTreeItem) => {
    const { node, level, children } = item
    const isConverted = convertedIds.has(node.id)
    const isOriginal = node.type === "original"
    return (
      <div key={node.id} style={{ paddingLeft: `${level * 16}px` }}>
        <div className="flex items-center justify-between gap-2 py-1.5">
          <span className="text-sm text-gray-700 truncate">{node.name}</span>
          {isConverted || isOriginal ? (
            <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
          ) : (
            <X className="w-4 h-4 text-red-500 shrink-0" />
          )}
        </div>
        {children.length > 0 && (
          <div className="border-l border-gray-100 ml-1">
            {children.map(renderItem)}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="mt-3 max-h-[260px] overflow-y-auto border border-gray-200 rounded-lg p-3 bg-white">
      {tree.map(renderItem)}
    </div>
  )
}

/* ---------- main component ---------- */

function AddSystemPageInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const editId = searchParams.get("id")
  const isEdit = !!editId
  const hasSavedRef = useRef(false)
  const isNewCourse = searchParams.get("new") === "true"

  /* ========== global config (collapsible) ========== */
  const [globalInfoOpen, setGlobalInfoOpen] = useState(true)
  const [courseId, setCourseId] = useState(editId || "")
  const [courseName, setCourseName] = useState("")
  const [courseCode, setCourseCode] = useState(`AB8G-A1-${Math.floor(10000000 + Math.random() * 90000000)}`)
  const [major, setMajor] = useState("")
  const [majorId, setMajorId] = useState("")
  const [majorNames, setMajorNames] = useState<string[]>([])
  const majorMapRef = useRef<Map<string, string>>(new Map())
  const [courseDescription, setCourseDescription] = useState("")
  const [coverImage, setCoverImage] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [loadingEdit, setLoadingEdit] = useState(false)
  const [courseStatus, setCourseStatus] = useState<string>("draft")

  /* ========== course node tree ========== */
  const [nodes, setNodes] = useState<SystemCourseNode[]>([])
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)

  useEffect(() => {
    if (!editId) return
    setLoadingEdit(true)
    Promise.all([
      courseApi.get(editId),
      courseNodeApi.list({ courseId: editId }),
    ]).then(([course, nodeRes]) => {
      setCourseId(course.id)
      setCourseName(course.name || "")
      if (course.code) setCourseCode(course.code)
      if (course.description) setCourseDescription(course.description)
      if (course.coverImage) setCoverImage(course.coverImage)
      if (course.majorName) setMajor(course.majorName)
      if (course.majorId) setMajorId(course.majorId)
      setCourseStatus(course.status || "draft")
      if (nodeRes.items?.length) {
        setNodes(nodeRes.items as unknown as SystemCourseNode[])
        setSelectedNodeId(nodeRes.items[0]?.id || null)
      }
    }).catch(() => {}).finally(() => setLoadingEdit(false))
  }, [editId])

  useEffect(() => {
    majorApi.list({ limit: 1000 }).then((res) => {
      const enabled = res.items.filter((m) => m.enabled)
      setMajorNames(enabled.map((m) => m.name))
      const map = new Map<string, string>()
      enabled.forEach((m) => map.set(m.name, m.id))
      majorMapRef.current = map
    }).catch(() => {})
  }, [])

  const handleAddNode = useCallback((parentId: string | null, name: string, order: number, type?: NodeRefType, sourceId?: string, sourceName?: string) => {
    const newNode: SystemCourseNode = {
      id: `node-${Date.now()}`,
      courseId: "course-1",
      parentId,
      name,
      order,
      type: type || "normal",
      status: "draft",
      sourceId,
      sourceName,
    }
    setNodes((prev) => [...prev, newNode])
    setSelectedNodeId(newNode.id)
  }, [])

  const handleUpdateNode = useCallback((nodeId: string, updates: Partial<SystemCourseNode>) => {
    setNodes((prev) => prev.map((n) => (n.id === nodeId ? { ...n, ...updates } : n)))
  }, [])

  const handleDeleteNode = useCallback((nodeId: string) => {
    setNodes((prev) => {
      const deleteIds = new Set<string>()
      const collect = (id: string) => {
        deleteIds.add(id)
        prev.filter((n) => n.parentId === id).forEach((n) => collect(n.id))
      }
      collect(nodeId)
      return prev.filter((n) => !deleteIds.has(n.id))
    })
    if (selectedNodeId === nodeId) {
      setSelectedNodeId(null)
    }
  }, [selectedNodeId])

  const handleReorderNodes = useCallback((nodeId: string, targetNodeId: string) => {
    setNodes((prev) => {
      const dragged = prev.find((n) => n.id === nodeId)
      const target = prev.find((n) => n.id === targetNodeId)
      if (!dragged || !target) return prev
      const newNodes = prev.map((n) => {
        if (n.id === nodeId) {
          return { ...n, parentId: target.parentId, order: target.order + 0.5 }
        }
        return n
      })
      // Re-order siblings
      const siblings = newNodes
        .filter((n) => n.parentId === target.parentId)
        .sort((a, b) => a.order - b.order)
      siblings.forEach((n, idx) => {
        const idxInPrev = newNodes.findIndex((x) => x.id === n.id)
        if (idxInPrev >= 0) {
          newNodes[idxInPrev] = { ...newNodes[idxInPrev], order: idx + 1 }
        }
      })
      return [...newNodes]
    })
  }, [])

  /* ========== current node form state ========== */
  const selectedNode = nodes.find((n) => n.id === selectedNodeId)

  /* node editing mode */
  const [nodeModes, setNodeModes] = useState<Record<string, AddMode>>({})
  const [showGrainSelector, setShowGrainSelector] = useState(false)
  const [grainSelectorMode, setGrainSelectorMode] = useState<AddMode>("clone")
  const [grainSearch, setGrainSearch] = useState("")
  const [grainSelectedId, setGrainSelectedId] = useState<string | null>(null)
  const [grainCourses, setGrainCourses] = useState<GrainCourseOption[]>([])

  useEffect(() => {
    courseApi.list({ type: "granular" }).then((res) => {
      setGrainCourses((res.items || []).map((c) => ({
        id: c.id,
        name: c.name,
        description: c.category,
        source: c.majorName || c.creatorId || "",
        duration: c.nodeCount,
      })))
    }).catch(() => setGrainCourses([]))
  }, [])

  const filteredGrainCourses = useMemo(() => {
    const kw = grainSearch.trim()
    if (!kw) return grainCourses
    return grainCourses.filter(
      (g) =>
        g.name.includes(kw) ||
        g.description.includes(kw) ||
        g.source.includes(kw)
    )
  }, [grainSearch, grainCourses])

  /* per-node draft cache */
  const [nodeDrafts, setNodeDrafts] = useState<Record<string, NodeDraft>>({})
  const nodeDraftsRef = useRef(nodeDrafts)
  nodeDraftsRef.current = nodeDrafts
  const nodesRef = useRef(nodes)
  nodesRef.current = nodes

  /* module 1: basic info */
  const [contentCode] = useState(isEdit ? "CNT-SQL001" : `CNT-${Date.now().toString(36).toUpperCase()}`)
  const [hours, setHours] = useState("")
  const [learningGoal, setLearningGoal] = useState("")
  const [difficulty, setDifficulty] = useState<number>(0)

  /* module 2: knowledge points */
  const [knowledgePoints, setKnowledgePoints] = useState<KnowledgePointItem[]>([])
  const [knowledgePool, setKnowledgePool] = useState<KnowledgePointItem[]>([])

  useEffect(() => {
    knowledgeApi.list({ limit: 200 }).then((res) => {
      setKnowledgePool((res.items || []).map((k) => ({
        id: k.id,
        name: k.name,
        code: k.code,
        description: k.description,
        linked: k.linked,
      })))
    }).catch(() => setKnowledgePool([]))
  }, [])

  /* module 3: resources */
  const [resourcePool] = useState<ResourceItem[]>([])
  const [selectedResourceIds, setSelectedResourceIds] = useState<string[]>([])

  /* module 4: assessment */
  const [selectedEvalMethods, setSelectedEvalMethods] = useState<string[]>([])

  /* module 5: evaluation rules */

  const resetFormFromNode = useCallback((node: SystemCourseNode | undefined) => {
    if (!node) {
      setHours("")
      setLearningGoal("")
      setKnowledgePoints([])
      setSelectedResourceIds([])
      setSelectedEvalMethods([])
      setDifficulty(0)
      return
    }
    setHours(String(node.duration || ""))
    setLearningGoal(node.teachingGoals || "")
    setKnowledgePoints(
      (node.knowledgePoints || []).map((kp, i) => ({
        id: `kp-${node.id}-${i}`,
        name: kp.name,
        description: "",
        linked: kp.linked,
      }))
    )
    setSelectedResourceIds((node.resources || []).map((r) => r.id))
    const evalMethods: string[] = []
    node.quizzes?.forEach((q) => {
      if (q.type === "question_bank") evalMethods.push("question_bank")
      else if (q.type === "paper") evalMethods.push("paper")
    })
    if (node.homeworks && node.homeworks.length > 0) evalMethods.push("exam")
    setSelectedEvalMethods(Array.from(new Set(evalMethods)))
    setDifficulty(0)
  }, [])

  /* load draft when selected node changes */
  useEffect(() => {
    const draft = selectedNodeId ? nodeDraftsRef.current[selectedNodeId] : undefined
    const node = selectedNodeId ? nodesRef.current.find((n) => n.id === selectedNodeId) : undefined
    if (draft) {
      setHours(draft.hours)
      setLearningGoal(draft.learningGoal)
      setKnowledgePoints(draft.knowledgePoints)
      setSelectedResourceIds(draft.selectedResourceIds)
      setSelectedEvalMethods(draft.selectedEvalMethods)
      setDifficulty(draft.difficulty)
    } else if (node) {
      resetFormFromNode(node)
    } else {
      resetFormFromNode(undefined)
    }
  }, [selectedNodeId, resetFormFromNode])

  /* save draft when form changes */
  useEffect(() => {
    if (!selectedNodeId) return
    setNodeDrafts((prev) => ({
      ...prev,
      [selectedNodeId]: {
        hours,
        learningGoal,
        knowledgePoints,
        selectedResourceIds,
        selectedEvalMethods,
        difficulty,
      },
    }))
  }, [selectedNodeId, hours, learningGoal, knowledgePoints, selectedResourceIds, selectedEvalMethods, difficulty])

  /* ---------- node mode selection handlers ---------- */
  const openGrainSelector = useCallback((mode: AddMode) => {
    setGrainSelectorMode(mode)
    setGrainSearch("")
    setGrainSelectedId(null)
    setShowGrainSelector(true)
  }, [])

  const handleSelectUploadMode = useCallback(() => {
    if (!selectedNodeId) return
    setNodeModes((prev) => ({ ...prev, [selectedNodeId]: "upload" }))
  }, [selectedNodeId])

  const handleGrainConfirm = useCallback(() => {
    if (!grainSelectedId || !selectedNodeId) return
    const grain = grainCourses.find((g) => g.id === grainSelectedId)
    if (!grain) return

    const isQuote = grainSelectorMode === "quote"
    const updates: Partial<SystemCourseNode> = {
      name: grain.name,
      sourceId: grain.id,
      sourceName: grain.name,
      duration: grain.duration,
      teachingGoals: grain.description,
      type: isQuote ? "original" : "normal",
    }
    handleUpdateNode(selectedNodeId, updates)
    setNodeModes((prev) => ({ ...prev, [selectedNodeId]: grainSelectorMode }))
    setHours(String(grain.duration))
    setLearningGoal(grain.description)
    setSelectedResourceIds([])
    setSelectedEvalMethods([])
    setDifficulty(0)
    setShowGrainSelector(false)
  }, [grainSelectedId, selectedNodeId, grainSelectorMode, handleUpdateNode])

  /* ---------- submit: convert complete nodes to grain ---------- */
  const [convertDialogOpen, setConvertDialogOpen] = useState(false)
  const [convertedNodeIds, setConvertedNodeIds] = useState<Set<string>>(new Set())
  const [convertedNodeNames, setConvertedNodeNames] = useState<string[]>([])

  const checkNodeComplete = useCallback(
    (node: SystemCourseNode): boolean => {
      const name = node.id === selectedNodeId ? (selectedNode?.name || "").trim() : node.name.trim()
      const goals = node.id === selectedNodeId ? learningGoal.trim() : (node.teachingGoals || "").trim()
      const duration = node.id === selectedNodeId ? parseInt(hours) || 0 : node.duration || 0
      const resourceCount = node.id === selectedNodeId ? selectedResourceIds.length : (node.resources?.length || 0)
      const evalCount =
        node.id === selectedNodeId
          ? selectedEvalMethods.length
          : (node.quizzes?.length || 0) + (node.homeworks?.length || 0)
      return !!name && !!goals && duration > 0 && resourceCount > 0 && evalCount > 0
    },
    [selectedNodeId, selectedNode, learningGoal, hours, selectedResourceIds, selectedEvalMethods]
  )

  const [saving, setSaving] = useState(false)

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      const payload: any = {
        name: courseName,
        code: courseCode,
        majorId: majorId || undefined,
        majorName: major || undefined,
        description: courseDescription || undefined,
        coverImage: coverImage || undefined,
        type: "system",
        status: "draft",
        category: "system",
        creatorId: "",
        coCreatorIds: [],
      }
      if (isEdit && courseId) {
        await courseApi.update(courseId, payload)
        hasSavedRef.current = true
        if (courseStatus === "approved" || courseStatus === "published") {
          await courseApi.saveDraft(courseId)
          setCourseStatus("draft")
          toast.success("草稿已更新，课程已退回草稿状态")
        } else {
          toast.success("草稿已更新")
        }
      } else {
        const created = await courseApi.create(payload)
        setCourseId(created.id)
        hasSavedRef.current = true
        toast.success("草稿已保存")
      }
    } catch (e: any) {
      toast.error(e?.message || "保存失败")
    } finally {
      setSaving(false)
    }
  }, [courseName, courseCode, major, majorId, courseDescription, coverImage, isEdit, courseId, courseStatus])

  const handleSubmit = useCallback(async () => {
    const completeNodes = nodes.filter((n) => n.type !== "original" && checkNodeComplete(n))
    if (completeNodes.length > 0) {
      setConvertedNodeIds(new Set(completeNodes.map((n) => n.id)))
      setConvertedNodeNames(completeNodes.map((n) => n.name))
      setNodes((prev) =>
        prev.map((n) => (completeNodes.some((c) => c.id === n.id) ? { ...n, type: "original" } : n))
      )
      setConvertDialogOpen(true)
      return
    }
    if (!courseId) {
      toast.error("请先保存草稿")
      return
    }
    setSaving(true)
    try {
      await courseApi.submit(courseId)
      await approvalApi.create({ targetType: "course", targetId: courseId })
      toast.success("课程已提交审核")
    } catch {
      toast.error("提交失败")
    } finally {
      setSaving(false)
    }
  }, [nodes, checkNodeComplete, courseId])

  /* ---------- construct current node for publish check ---------- */
  const currentCheckNode: SystemCourseNode | undefined = useMemo(() => {
    if (!selectedNodeId) return undefined
    const node = nodes.find((n) => n.id === selectedNodeId)
    if (!node) return undefined

    // Map knowledgePoints
    const kpForCheck = knowledgePoints.map((kp) => ({
      name: kp.name,
      linked: kp.linked ?? false,
    }))

    // Map resources
    const resForCheck: NodeResource[] = selectedResourceIds
      .map((id) => {
        const r = resourcePool.find((x) => x.id === id)
        if (!r) return null
        return {
          id: r.id,
          name: r.name,
          type: r.type,
          size: 0,
          url: r.url,
        }
      })
      .filter(Boolean) as NodeResource[]

    // Map quizzes from eval methods
    const quizzesForCheck = selectedEvalMethods.length > 0
      ? selectedEvalMethods.map((method, i) => ({
          id: `qz-${i}`,
          title: method === "exam" ? "作业测评" : method === "question_bank" ? "题库测验" : method === "paper" ? "试卷测验" : "现场问答",
          type: method === "question_bank" ? "question_bank" as const : "paper" as const,
          questions: [] as any[],
        }))
      : []

    return {
      ...node,
      name: node.name,
      teachingGoals: learningGoal || node.teachingGoals,
      duration: parseInt(hours) || node.duration || 0,
      knowledgePoints: kpForCheck.length > 0 ? kpForCheck : node.knowledgePoints,
      resources: resForCheck.length > 0 ? resForCheck : node.resources,
      quizzes: quizzesForCheck.length > 0 ? quizzesForCheck : node.quizzes,
    }
  }, [selectedNodeId, nodes, learningGoal, hours, knowledgePoints, selectedResourceIds, resourcePool, selectedEvalMethods])

  return (
    <div className="min-h-screen bg-[#f5f7fa]">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-30">
        <div className="max-w-[1400px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={async () => {
                if (isNewCourse && courseId && !hasSavedRef.current) {
                  try { await courseApi.delete(courseId) } catch {}
                }
                router.push("/lesson/admin/system")
              }}>
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  返回列表
                </Button>
              <h1 className="text-lg font-semibold text-gray-900">
                {isEdit ? "编辑体系课" : "新建体系课"}
                {courseName && <span className="text-gray-400 font-normal ml-2">- {courseName}</span>}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-1" onClick={handleSave} disabled={saving}>
                <Save className="h-4 w-4" />
                {saving ? "保存中..." : "保存草稿"}
              </Button>
              <Button size="sm" className="bg-[#1890ff] hover:bg-[#40a9ff]" onClick={handleSubmit} disabled={saving}>
                <Send className="h-4 w-4" />
                提交
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-6 py-6">
        {/* ========== Global Course Info (collapsible, spans full width) ========== */}
        <Collapsible open={globalInfoOpen} onOpenChange={setGlobalInfoOpen} className="mb-6">
          <Card className="border-0 shadow-sm">
            <CollapsibleTrigger asChild>
              <button className="w-full">
                <CardHeader className="pb-3 cursor-pointer">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-[#1890ff]" />
                      全局课程信息
                      <span className="text-xs font-normal text-gray-400">
                        {courseName ? `《${courseName}》` : "未填写课程名称"}
                      </span>
                      {major && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                          {major}
                        </span>
                      )}
                    </CardTitle>
                    <div className="flex items-center gap-2 text-gray-400">
                      <span className="text-xs">
                        {globalInfoOpen ? "收起" : "展开编辑"}
                      </span>
                      {globalInfoOpen ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </div>
                  </div>
                  {!globalInfoOpen && courseDescription && (
                    <p className="text-xs text-gray-400 mt-1 pl-6 text-left">{courseDescription}</p>
                  )}
                </CardHeader>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                  <div className="space-y-1.5">
                    <Label className="text-xs">课程名称</Label>
                    <Input
                      value={courseName}
                      onChange={(e) => setCourseName(e.target.value)}
                      placeholder="请输入课程名称"
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">课程编码</Label>
                    <Input value={courseCode} disabled className="h-9 text-sm bg-gray-50 text-gray-500" />
                    <p className="text-[10px] text-gray-400">系统自动生成，不可修改</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">适用专业</Label>
                    <Select value={major} onValueChange={(v) => { setMajor(v); setMajorId(majorMapRef.current.get(v) || "") }}>
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="请选择适用专业" />
                      </SelectTrigger>
                      <SelectContent>
                        {majorNames.map((m) => (
                          <SelectItem key={m} value={m}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">封面图片</Label>
                    <div className="flex items-start gap-4">
                      {coverImage ? (
                        <div className="relative w-[200px] h-[120px] rounded-lg overflow-hidden border border-gray-200">
                          <img src={coverImage} alt="封面预览" className="w-full h-full object-cover" />
                          <button
                            onClick={() => setCoverImage("")}
                            className="absolute top-1 right-1 w-6 h-6 bg-black/50 text-white rounded-full text-xs flex items-center justify-center hover:bg-black/70"
                          >✕</button>
                        </div>
                      ) : (
                        <div
                          onClick={() => fileInputRef.current?.click()}
                          className="w-[200px] h-[120px] rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors"
                        >
                          <ImageUp className="w-8 h-8 text-gray-400" />
                          <span className="text-xs text-gray-400 mt-1">点击上传封面</span>
                        </div>
                      )}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0]
                          if (!file) return
                          try {
                            const res = await fileApi.upload(file)
                            setCoverImage(res.url)
                            toast.success("封面上传成功")
                          } catch (err: any) {
                            toast.error(err?.message || "封面上传失败")
                          }
                        }}
                      />
                    </div>
                  </div>
                  <div className="md:col-span-3 space-y-1.5">
                    <Label className="text-xs">课程简介</Label>
                    <RichTextEditor
                      value={courseDescription}
                      onChange={setCourseDescription}
                      placeholder="请输入课程简介..."
                      minHeight={280}
                    />
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* ========== Three-column layout ========== */}
        <div className="grid grid-cols-[260px_1fr_260px] gap-6">

          {/* Left: Course Node Tree */}
          <CourseNodeTree
            nodes={nodes}
            selectedNodeId={selectedNodeId}
            onSelect={setSelectedNodeId}
            onAddNode={handleAddNode}
            onUpdateNode={handleUpdateNode}
            onDeleteNode={handleDeleteNode}
            onReorderNodes={handleReorderNodes}
          />

          {/* Center: Content modules */}
          <div className="relative min-w-0">
            {/* Node type hint / selector */}
            {selectedNode?.type === "original" && (
              <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-100 rounded-xl px-4 py-3 mt-5 relative z-20 flex items-center gap-3 shadow-sm">
                <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                </div>
                <p className="text-sm text-purple-800">
                  当前节点的课程内容将被纳入颗粒课管理体系，支持跨课程复用。
                </p>
              </div>
            )}

            <main className="space-y-5 min-w-0">
              {!selectedNode && (
                <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-400">
                  <Info className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">请从左侧目录选择一个节点进行编辑</p>
                </div>
              )}

              {selectedNode && selectedNode.type !== "original" && !nodeModes[selectedNode.id] && (
                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-[#1890ff]" />
                      选择编辑方式
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {[
                        {
                          key: "upload" as const,
                          label: "自定义编排节点资源",
                          desc: "自行上传并编辑课程资源",
                          icon: Upload,
                          color: "bg-blue-500",
                          border: "border-blue-500",
                          bg: "bg-blue-50/50",
                        },
                        {
                          key: "clone" as const,
                          label: "克隆颗粒课",
                          desc: "复制颗粒课内容生成独立节点",
                          icon: Copy,
                          color: "bg-amber-500",
                          border: "border-amber-500",
                          bg: "bg-amber-50/50",
                        },
                        {
                          key: "quote" as const,
                          label: "引用已有颗粒课",
                          desc: "引用颗粒课内容，关联可同步编辑",
                          icon: Link2,
                          color: "bg-purple-500",
                          border: "border-purple-500",
                          bg: "bg-purple-50/50",
                        },
                      ].map((opt) => (
                        <button
                          key={opt.key}
                          onClick={() =>
                            opt.key === "upload" ? handleSelectUploadMode() : openGrainSelector(opt.key)
                          }
                          className={cn(
                            "group flex flex-col items-center gap-3 p-5 rounded-xl border-2 bg-white text-center transition-all",
                            "hover:-translate-y-0.5 hover:shadow-md",
                            `hover:${opt.border} hover:${opt.bg}`
                          )}
                        >
                          <div className={cn("w-12 h-12 rounded-full flex items-center justify-center text-white shadow-sm transition-transform group-hover:scale-110", opt.color)}>
                            <opt.icon className="w-6 h-6" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-800">{opt.label}</p>
                            <p className="text-xs text-gray-500 mt-1 leading-relaxed">{opt.desc}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {selectedNode && (selectedNode.type === "original" || nodeModes[selectedNode.id]) && (
                <>
                  {/* Module 1: Basic Info */}
                  <Card className="border-0 shadow-sm">
                    <CardHeader className="pb-3 flex flex-row items-center justify-between">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-[#1890ff]" />
                        基本信息配置
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs">内容名称</Label>
                          <Input
                            value={selectedNode?.name || ""}
                            onChange={(e) => {
                              if (selectedNodeId) {
                                handleUpdateNode(selectedNodeId, { name: e.target.value })
                              }
                            }}
                            placeholder="请输入内容名称"
                            className="h-9 text-sm"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">节点编码</Label>
                          <Input value={contentCode} disabled className="h-9 text-sm bg-gray-50 text-gray-500" />
                          <p className="text-[10px] text-gray-400">系统自动生成，不可修改</p>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">预计课时</Label>
                          <Input type="number" value={hours} onChange={(e) => setHours(e.target.value)} placeholder="请输入课时数" className="h-9 text-sm" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">难度等级</Label>
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <button key={star} onClick={() => setDifficulty(star)} className="p-1 transition-colors">
                                <Star className={`w-5 h-5 ${star <= difficulty ? "text-amber-400 fill-amber-400" : "text-gray-200"}`} />
                              </button>
                            ))}
                            <span className="text-xs text-gray-400 ml-2">{difficulty > 0 ? `${difficulty} 星` : "请选择难度"}</span>
                          </div>
                        </div>
                        <div className="md:col-span-2 space-y-1.5">
                          <Label className="text-xs">学习目标</Label>
                          <RichTextEditor
                            value={learningGoal}
                            onChange={setLearningGoal}
                            minHeight={280}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Module 2: Knowledge Points */}
                  <Card className="border-0 shadow-sm">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <GraduationCap className="w-4 h-4 text-[#1890ff]" />
                        关联知识点
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <KnowledgeSelector
                        selected={knowledgePoints}
                        pool={knowledgePool}
                        onChange={setKnowledgePoints}
                        onAddCustom={(name, description) => {
                          const newKp: KnowledgePointItem = {
                            id: `kp-custom-${Date.now()}`,
                            name,
                            description,
                            linked: false,
                          }
                          setKnowledgePoints((prev) => [...prev, newKp])
                        }}
                      />
                    </CardContent>
                  </Card>

                  {/* Module 3: Resources */}
                  <Card className="border-0 shadow-sm">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-[#1890ff]" />
                        配置课程资源
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <ResourceSelector
                        pool={resourcePool}
                        selectedIds={selectedResourceIds}
                        onChange={setSelectedResourceIds}
                        onUpload={(r) => {/* resourcePool is read-only in this simplified version */}}
                      />
                    </CardContent>
                  </Card>

                  {/* Module 4: Assessment */}
                  <Card className="border-0 shadow-sm">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <ClipboardList className="w-4 h-4 text-[#1890ff]" />
                        配置课程测评方式
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <EvaluationMethodSelector
                        selectedKeys={selectedEvalMethods}
                        onChange={setSelectedEvalMethods}
                      />
                    </CardContent>
                  </Card>

                  {/* Module 5: Evaluation Rules */}
                  <Card className="border-0 shadow-sm">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Award className="w-4 h-4 text-[#1890ff]" />
                        配置课程评价规则
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0 space-y-4">
                      {selectedEvalMethods.length === 0 ? (
                        <div className="flex flex-col items-center justify-center text-gray-400 py-12">
                          <Database className="h-12 w-12 mb-3 opacity-50" />
                          <p className="text-sm">尚未配置评价方式</p>
                          <p className="text-xs mt-1">请先在「配置课程测评方式」中选择评价类型</p>
                        </div>
                      ) : (
                        <CourseEvaluationRulesDialog
                          inline
                          evaluationMethods={selectedEvalMethods}
                          title="配置节点评价规则"
                          knowledgePoints={knowledgePoints}
                        />
                      )}
                    </CardContent>
                  </Card>
                </>
              )}

              {/* Bottom spacer */}
              <div className="h-12" />
            </main>
          </div>

          {/* Right: Publish Check Panel */}
          <PublishCheckPanel node={currentCheckNode} />
        </div>
      </div>

      {/* Convert complete nodes to grain course dialog */}
      <Dialog open={convertDialogOpen} onOpenChange={setConvertDialogOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>节点已转换为颗粒课</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                <p className="text-xs text-gray-700">
                  绿色的勾：通过节点完整度校验、提交后另存为颗粒课
                </p>
              </div>
              <div className="flex items-start gap-2">
                <X className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                <p className="text-xs text-gray-700">
                  红色的叉：节点未完成建设、提交后无法另外为颗粒课
                </p>
              </div>
            </div>
            <ConvertPreviewTree nodes={nodes} convertedIds={convertedNodeIds} />
          </div>
          <DialogFooter>
            <Button
              onClick={async () => {
                setConvertDialogOpen(false)
                if (!courseId) { toast.error("请先保存草稿"); return }
                setSaving(true)
                try {
      await courseApi.submit(courseId)
      hasSavedRef.current = true
      await approvalApi.create({ targetType: "course", targetId: courseId })
                  toast.success("课程已提交审核")
                } catch { toast.error("提交失败") }
                setSaving(false)
              }}
            >
              确认
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Grain course selector dialog for clone / quote */}
      <Dialog open={showGrainSelector} onOpenChange={setShowGrainSelector}>
        <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {grainSelectorMode === "clone" ? "选择要克隆的颗粒课" : "选择要引用的颗粒课"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                value={grainSearch}
                onChange={(e) => setGrainSearch(e.target.value)}
                placeholder="搜索颗粒课名称、来源..."
                className="pl-9 text-sm h-9"
              />
            </div>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {filteredGrainCourses.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">未找到匹配的颗粒课</p>
              ) : (
                filteredGrainCourses.map((g) => {
                  const selected = grainSelectedId === g.id
                  return (
                    <button
                      key={g.id}
                      onClick={() => setGrainSelectedId(g.id)}
                      className={cn(
                        "w-full text-left p-3 rounded-lg border transition-all",
                        selected
                          ? "border-blue-500 bg-blue-50 ring-1 ring-blue-200"
                          : "border-gray-200 hover:border-gray-300 bg-white"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div
                            className={cn(
                              "w-5 h-5 rounded-full border flex items-center justify-center",
                              selected ? "bg-blue-500 border-blue-500" : "border-gray-300"
                            )}
                          >
                            {selected && <CheckCircle2 className="w-3 h-3 text-white" />}
                          </div>
                          <span className="text-sm font-medium text-gray-800">{g.name}</span>
                        </div>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                          {g.source}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1 pl-7">{g.description}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5 pl-7">{g.duration} 课时</p>
                    </button>
                  )
                })
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGrainSelector(false)}>
              取消
            </Button>
            <Button onClick={handleGrainConfirm} disabled={!grainSelectedId}>
              确认选择
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Toaster />
    </div>
  )
}

export default function AddSystemPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">加载中...</div>}>
      <AddSystemPageInner />
    </Suspense>
  )
}
