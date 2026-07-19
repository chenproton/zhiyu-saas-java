"use client"

import { Suspense, useState, useRef, useCallback, useMemo, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Info, Plus, X, BookOpen, Layers, BookMarked, Microscope, Briefcase, Database, FileStack, Monitor, CheckCircle2, BarChart3, ClipboardList, Zap, Shuffle, MessageSquare, HelpCircle, ChevronDown, ChevronRight, Bold, Italic, Underline, List, ListOrdered, Image as ImageIcon, ImageUp, Link as LinkIcon, AlignLeft } from "lucide-react"
import { toast, Toaster } from "sonner"
import { courseApi, approvalApi, majorApi, fileApi } from "@/lib/api"
import type { Course } from "@/lib/types/lesson"
import type { SystemCourseNode, NodeRefType } from "@/lib/types/lesson-source"
import CourseNodeTree from "../../system/add/_components/CourseNodeTree"
import { EditorShell } from "@/components/shared/editor-shell"
import { WEB_FRONTEND_SEMESTER_NODES } from "./_mock/semester-nodes"
import {
  ATOMIC_MODULES,
  ATOMIC_MODULES_BY_KEY,
  COURSE_CATEGORIES,
  DEFAULT_MODULES,
  createDefaultNodeModuleData,
  type AtomicModuleKey,
  type AtomicModuleCategory,
  type NodeModuleData,
  type CourseBasicForm,
} from "./_components/atomic-modules"

const FIRST_NODE_ID = "hybrid-node-1"

function MockRichEditor({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const toolbarBtn = (icon: React.ReactNode, title: string) => (
    <button
      type="button"
      title={title}
      disabled
      className="p-1 rounded text-gray-400 cursor-not-allowed transition-colors"
    >
      {icon}
    </button>
  )

  return (
    <div className="border rounded-md bg-white overflow-hidden">
      <div className="flex items-center gap-1 px-2 py-1.5 border-b bg-gray-50/50">
        {toolbarBtn(<Bold className="h-3.5 w-3.5" />, "加粗")}
        {toolbarBtn(<Italic className="h-3.5 w-3.5" />, "斜体")}
        {toolbarBtn(<Underline className="h-3.5 w-3.5" />, "下划线")}
        <div className="w-px h-3.5 bg-gray-200 mx-1" />
        {toolbarBtn(<AlignLeft className="h-3.5 w-3.5" />, "左对齐")}
        {toolbarBtn(<List className="h-3.5 w-3.5" />, "无序列表")}
        {toolbarBtn(<ListOrdered className="h-3.5 w-3.5" />, "有序列表")}
        <div className="w-px h-3.5 bg-gray-200 mx-1" />
        {toolbarBtn(<LinkIcon className="h-3.5 w-3.5" />, "插入链接")}
        {toolbarBtn(<ImageIcon className="h-3.5 w-3.5" />, "插入图片")}
      </div>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="border-0 rounded-none shadow-none focus-visible:ring-0 text-sm min-h-[100px] resize-y"
      />
    </div>
  )
}

function HybridCourseAddForm() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const editId = searchParams.get("id")
  const hasSavedRef = useRef(false)
  const isNewCourse = searchParams.get("new") === "true"
  const claimCourse = searchParams.get("claimCourse")
  const claimSessionsParam = searchParams.get("claimSessions")
  const [existing, setExisting] = useState<Course | null>(null)
  const [majorNames, setMajorNames] = useState<string[]>([])
  const majorMapRef = useRef<Map<string, string>>(new Map())

  useEffect(() => {
    if (!editId) {
      setExisting(null)
      return
    }
    courseApi.get(editId).then((c) => setExisting(c)).catch(() => setExisting(null))
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

  interface ClaimPayload {
    course?: string
    teacher?: string
    className?: string
    sessions: Array<{ week: number; weekday: string; period: string; venue?: string }>
  }

  const claimPayload = useMemo<ClaimPayload | null>(() => {
    if (!claimSessionsParam) return null
    try {
      const decoded = decodeURIComponent(atob(claimSessionsParam))
      const parsed = JSON.parse(decoded)
      if (Array.isArray(parsed)) {
        return { sessions: parsed }
      }
      return {
        course: parsed.course,
        teacher: parsed.teacher,
        className: parsed.className,
        sessions: parsed.sessions || [],
      }
    } catch {
      return null
    }
  }, [claimSessionsParam])

  const claimSessionNames = useMemo<string[]>(() => {
    return (claimPayload?.sessions || []).map((s) => `第 ${s.week} 周 · ${s.weekday} · ${s.period}`)
  }, [claimPayload])

  /* ========== course node tree ========== */
  const initialNodes = useMemo<SystemCourseNode[]>(() => {
    if (editId === "hybrid-1") {
      return WEB_FRONTEND_SEMESTER_NODES
    }

    const rootName = claimCourse || existing?.name || "混合课程"
    const rootNode: SystemCourseNode = {
      id: FIRST_NODE_ID,
      courseId: editId || "hybrid-new",
      parentId: null,
      name: rootName,
      order: 1,
      type: "normal",
      status: "draft",
    }

    if (claimSessionNames.length === 0) {
      return [rootNode]
    }

    const childNodes: SystemCourseNode[] = claimSessionNames.map((name, idx) => ({
      id: `hybrid-node-child-${idx + 1}`,
      courseId: editId || "hybrid-new",
      parentId: FIRST_NODE_ID,
      name,
      order: idx + 1,
      type: "normal",
      status: "draft",
    }))

    return [rootNode, ...childNodes]
  }, [editId, existing?.name, claimCourse, claimSessionNames])

  const [nodes, setNodes] = useState<SystemCourseNode[]>(initialNodes)
  const [selectedNodeId, setSelectedNodeId] = useState<string>(FIRST_NODE_ID)

  /* ========== atomic module assignments per node ========== */
  const [moduleAssignments, setModuleAssignments] = useState<Record<string, AtomicModuleKey[]>>(() => ({
    [FIRST_NODE_ID]: [...DEFAULT_MODULES],
  }))

  /* ========== independent data per node ========== */
  const [nodeDataMap, setNodeDataMap] = useState<Record<string, NodeModuleData>>(() => ({
    [FIRST_NODE_ID]: createDefaultNodeModuleData({
      name: claimCourse || existing?.name,
      code: existing?.code,
      majorId: existing?.majorId,
      semester: existing?.semester,
      category: existing?.category as CourseBasicForm["category"],
    }),
  }))

  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [addDialogCategory, setAddDialogCategory] = useState<AtomicModuleCategory | null>(null)
  const [shareDialogOpen, setShareDialogOpen] = useState(false)
  const [shareSelectedIds, setShareSelectedIds] = useState<string[]>([])
  const [globalInfoOpen, setGlobalInfoOpen] = useState(true)
  const [saving, setSaving] = useState(false)

  const rootForm = nodeDataMap[FIRST_NODE_ID]?.form || createDefaultNodeModuleData().form

  const updateRootForm = useCallback((patch: Partial<CourseBasicForm>) => {
    setNodeDataMap((prev) => ({
      ...prev,
      [FIRST_NODE_ID]: {
        ...prev[FIRST_NODE_ID],
        form: { ...prev[FIRST_NODE_ID].form, ...patch },
      },
    }))
  }, [])

  const handleAddNode = useCallback((parentId: string | null, name: string, order: number, type?: NodeRefType, sourceId?: string, sourceName?: string) => {
    const newNode: SystemCourseNode = {
      id: `node-${Date.now()}`,
      courseId: editId || "hybrid-new",
      parentId,
      name,
      order,
      type: type || "normal",
      status: "draft",
      sourceId,
      sourceName,
    }
    setNodes((prev) => [...prev, newNode])
    setModuleAssignments((prev) => ({
      ...prev,
      [newNode.id]: [...DEFAULT_MODULES],
    }))
    setNodeDataMap((prev) => ({
      ...prev,
      [newNode.id]: createDefaultNodeModuleData({
        name: claimCourse || existing?.name,
        code: existing?.code,
        majorId: existing?.majorId,
        semester: existing?.semester,
        category: existing?.category as CourseBasicForm["category"],
      }),
    }))
  }, [editId, existing, claimCourse])

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
      const next = prev.filter((n) => !deleteIds.has(n.id))
      return next
    })
    setModuleAssignments((prev) => {
      const next = { ...prev }
      delete next[nodeId]
      return next
    })
    setNodeDataMap((prev) => {
      const next = { ...prev }
      delete next[nodeId]
      return next
    })
    if (selectedNodeId === nodeId) {
      setSelectedNodeId(FIRST_NODE_ID)
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

  const selectedNode = nodes.find((n) => n.id === selectedNodeId)

  const ensureNodeData = (nodeId: string): NodeModuleData => {
    if (!nodeDataMap[nodeId]) {
      const next = createDefaultNodeModuleData({
        name: claimCourse || existing?.name,
        code: existing?.code,
        majorId: existing?.majorId,
        semester: existing?.semester,
        category: existing?.category as CourseBasicForm["category"],
      })
      setNodeDataMap((prev) => ({ ...prev, [nodeId]: next }))
      return next
    }
    return nodeDataMap[nodeId]
  }

  const currentModules = selectedNodeId ? (moduleAssignments[selectedNodeId] || []) : []
  const currentData = selectedNodeId ? ensureNodeData(selectedNodeId) : null

  const relatedDesignNodeIds = useMemo(() => {
    if (!selectedNodeId || !currentData) return []
    const related = new Set<string>(currentData.teachingDesignSharedNodeIds || [])
    nodes.forEach((n) => {
      if (n.id === selectedNodeId) return
      const other = nodeDataMap[n.id]
      if (other?.teachingDesignSharedNodeIds?.includes(selectedNodeId)) {
        related.add(n.id)
      }
    })
    return Array.from(related)
  }, [selectedNodeId, currentData, nodes, nodeDataMap])

  const addModule = (key: AtomicModuleKey) => {
    if (!selectedNodeId) return
    setModuleAssignments((prev) => {
      const list = prev[selectedNodeId] || []
      if (list.includes(key)) return prev
      return { ...prev, [selectedNodeId]: [...list, key] }
    })
    setAddDialogOpen(false)
    setAddDialogCategory(null)
  }

  const openAddDialog = (category: AtomicModuleCategory) => {
    setAddDialogCategory(category)
    setAddDialogOpen(true)
  }

  const removeModule = (key: AtomicModuleKey) => {
    if (!selectedNodeId) return
    setModuleAssignments((prev) => ({
      ...prev,
      [selectedNodeId]: (prev[selectedNodeId] || []).filter((k) => k !== key),
    }))
  }

  const updateNodeData = (patch: Partial<NodeModuleData>) => {
    if (!selectedNodeId || !currentData) return
    setNodeDataMap((prev) => ({
      ...prev,
      [selectedNodeId]: { ...prev[selectedNodeId], ...patch },
    }))
  }

  const updateTeachingDesignContent = (value: string) => {
    if (!selectedNodeId || !currentData) return
    setNodeDataMap((prev) => {
      const next = { ...prev }
      next[selectedNodeId] = { ...next[selectedNodeId], teachingDesignContent: value }
      relatedDesignNodeIds.forEach((id) => {
        if (next[id]) {
          next[id] = { ...next[id], teachingDesignContent: value }
        }
      })
      return next
    })
  }

  const openShareDialog = () => {
    if (!currentData) return
    setShareSelectedIds(relatedDesignNodeIds)
    setShareDialogOpen(true)
  }

  const toggleShareNode = (nodeId: string) => {
    setShareSelectedIds((prev) =>
      prev.includes(nodeId) ? prev.filter((id) => id !== nodeId) : [...prev, nodeId]
    )
  }

  const confirmShareNodes = () => {
    if (!selectedNodeId || !currentData) return
    const nextSharedIds = shareSelectedIds.filter((id) => id !== selectedNodeId)

    setNodeDataMap((prev) => {
      const next = { ...prev }
      const currentContent = next[selectedNodeId]?.teachingDesignContent || ""

      // 从所有已有相关节点中移除当前节点
      relatedDesignNodeIds.forEach((id) => {
        if (next[id]) {
          next[id] = {
            ...next[id],
            teachingDesignSharedNodeIds: (next[id].teachingDesignSharedNodeIds || []).filter(
              (sid) => sid !== selectedNodeId
            ),
          }
        }
      })

      // 添加到新关联中（双向），并将内容同步为当前节点内容
      nextSharedIds.forEach((id) => {
        if (next[id]) {
          next[id] = {
            ...next[id],
            teachingDesignSharedNodeIds: Array.from(
              new Set([...(next[id].teachingDesignSharedNodeIds || []), selectedNodeId])
            ),
            teachingDesignContent: currentContent,
          }
        }
      })

      next[selectedNodeId] = {
        ...next[selectedNodeId],
        teachingDesignSharedNodeIds: nextSharedIds,
      }

      return next
    })

    setShareDialogOpen(false)
  }

  const buildCoursePayload = (): Omit<Course, "id" | "nodeCount" | "resourceCount" | "studyCount" | "createdAt" | "updatedAt"> => ({
    code: rootForm.code || "",
    name: rootForm.name || "",
    type: "hybrid",
    category: rootForm.category || "专业核心课程",
    majorId: rootForm.majorId || existing?.majorId || undefined,
    majorName: rootForm.majorName || existing?.majorName || undefined,
    semester: rootForm.semester || existing?.semester || undefined,
    className: existing?.className || "",
    coverImage: rootForm.coverImage || undefined,
    status: "draft",
    creatorId: existing?.creatorId || "",
    coCreatorIds: existing?.coCreatorIds || [],
  })

  const handleSave = async () => {
    if (!rootForm.name || !rootForm.code) {
      toast.error("请填写课程名称和课程编码")
      return
    }
    setSaving(true)
    try {
      const payload = buildCoursePayload()
      if (editId) {
        const updated = await courseApi.update(editId, payload)
        hasSavedRef.current = true
        if (existing?.status === "approved" || existing?.status === "published") {
          await courseApi.saveDraft(editId)
          setExisting({ ...updated, status: "draft" as const })
          toast.success(`已更新混合课程：${updated.name}，课程已退回草稿状态`)
        } else {
          setExisting(updated)
          toast.success(`已更新混合课程：${updated.name}`)
        }
      } else {
        const created = await courseApi.create(payload)
        setExisting(created)
        hasSavedRef.current = true
        toast.success(`已保存混合课程：${created.name}`)
        router.replace(`/lesson/admin/hybrid/add?id=${created.id}`)
      }
    } catch (e: any) {
      toast.error(e?.message || "保存失败，请检查表单后重试")
    } finally {
      setSaving(false)
    }
  }

  const handleSubmit = async () => {
    if (!rootForm.name || !rootForm.code) {
      toast.error("请填写课程名称和课程编码")
      return
    }
    setSaving(true)
    try {
      let courseId = editId || existing?.id
      if (!courseId) {
        const created = await courseApi.create(buildCoursePayload())
        setExisting(created)
        courseId = created.id
      }
      await courseApi.submit(courseId)
      hasSavedRef.current = true
      await approvalApi.create({ targetType: "course", targetId: courseId })
      toast.success(`已提交混合课程审批：${rootForm.name}`)
      router.push("/lesson/admin/hybrid")
    } catch (e) {
      toast.error("提交失败，请重试")
    } finally {
      setSaving(false)
    }
  }

  const availableModules = ATOMIC_MODULES.filter(
    (m) => !currentModules.includes(m.key)
  )

  const renderModuleCard = (key: AtomicModuleKey, data: NodeModuleData) => {
    const meta = ATOMIC_MODULES_BY_KEY[key]
    const Icon = meta.icon
    const Component = meta.component
    const mode = data.moduleModes?.[key] ?? "online"
    return (
      <Card key={key} className="overflow-visible">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Icon className="h-4 w-4 text-blue-500" />
            {meta.label}
          </CardTitle>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch
                id={`module-mode-${selectedNodeId}-${key}`}
                checked={mode === "online"}
                onCheckedChange={(checked) =>
                  updateNodeData({
                    moduleModes: { ...data.moduleModes, [key]: checked ? "online" : "offline" },
                  })
                }
              />
              <Label
                htmlFor={`module-mode-${selectedNodeId}-${key}`}
                className="text-xs text-gray-500 cursor-pointer"
              >
                {mode === "online" ? "线上" : "线下"}
              </Label>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-gray-400 hover:text-red-500"
              onClick={() => removeModule(key)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <Component nodeId={selectedNodeId} data={data} onChange={updateNodeData} />
      </Card>
    )
  }

  const processCategories: { key: AtomicModuleCategory; label: string }[] = [
    { key: "pre-class", label: "课前" },
    { key: "in-class", label: "课中" },
    { key: "post-class", label: "课后" },
  ]

  const dialogModules = addDialogCategory
    ? availableModules.filter((m) => m.category === addDialogCategory)
    : []

  return (
    <EditorShell
      mode="fullscreen"
      backText="取消"
      onBack={async () => {
        if (isNewCourse && editId && !hasSavedRef.current) {
          try { await courseApi.delete(editId) } catch {}
        }
        router.push("/lesson/admin/hybrid")
      }}
      onSaveDraft={handleSave}
      isSaving={saving}
      onSubmit={handleSubmit}
      submitText="提交审批"
      title={editId ? "编辑混合课程" : "新建混合课程"}
    >
        {/* ========== Global Course Info (collapsible, spans full width) ========== */}
        <Collapsible open={globalInfoOpen} onOpenChange={setGlobalInfoOpen} className="mb-6">
          <Card className="border-0 shadow-sm">
            <CollapsibleTrigger asChild>
              <button className="w-full">
                <CardHeader className="pb-3 cursor-pointer">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-[#1890ff]" />
                      课程基本信息
                      <span className="text-xs font-normal text-gray-400">
                        {rootForm.name ? `《${rootForm.name}》` : "未填写课程名称"}
                      </span>
                      {rootForm.majorName && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                          {rootForm.majorName}
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
                </CardHeader>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">课程名称</Label>
                    <Input
                      value={rootForm.name}
                      onChange={(e) => updateRootForm({ name: e.target.value })}
                      placeholder="请输入课程名称"
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">课程编码</Label>
                    <Input
                      value={rootForm.code}
                      onChange={(e) => updateRootForm({ code: e.target.value })}
                      placeholder="请输入课程编码"
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">所属专业</Label>
                    <Select value={rootForm.majorName} onValueChange={(v) => updateRootForm({ majorName: v, majorId: majorMapRef.current.get(v) || "" })}>
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="请选择所属专业" />
                      </SelectTrigger>
                      <SelectContent>
                        {majorNames.map((m) => (
                          <SelectItem key={m} value={m}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">课程分类</Label>
                    <Select value={rootForm.category} onValueChange={(v) => updateRootForm({ category: v as CourseBasicForm["category"] })}>
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="请选择课程分类" />
                      </SelectTrigger>
                      <SelectContent>
                        {COURSE_CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">学期</Label>
                    <Input
                      value={rootForm.semester}
                      onChange={(e) => updateRootForm({ semester: e.target.value })}
                      placeholder="如：2026-2027-1"
                      className="h-9 text-sm"
                    />
                  </div>
                </div>
                <div className="mt-5 space-y-1.5">
                  <Label className="text-xs">课程目标</Label>
                  <MockRichEditor
                    value={rootForm.courseObjectives}
                    onChange={(v) => updateRootForm({ courseObjectives: v })}
                    placeholder="请输入课程目标，可填写多条，按回车分隔"
                  />
                </div>
                <div className="mt-5 space-y-1.5">
                  <Label className="text-xs">封面图片</Label>
                  <div className="flex items-start gap-4">
                    {rootForm.coverImage ? (
                      <div className="relative w-[200px] h-[120px] rounded-lg overflow-hidden border border-gray-200">
                        <img src={rootForm.coverImage} alt="封面预览" className="w-full h-full object-cover" />
                        <button
                          onClick={() => updateRootForm({ coverImage: "" })}
                          className="absolute top-1 right-1 w-6 h-6 bg-black/50 text-white rounded-full text-xs flex items-center justify-center hover:bg-black/70"
                        >✕</button>
                      </div>
                    ) : (
                      <div
                        onClick={() => document.getElementById("hybrid-cover-input")?.click()}
                        className="w-[200px] h-[120px] rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors"
                      >
                        <ImageUp className="w-8 h-8 text-gray-400" />
                        <span className="text-xs text-gray-400 mt-1">点击上传封面</span>
                      </div>
                    )}
                    <input
                      id="hybrid-cover-input"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        try {
                          const res = await fileApi.upload(file)
                          updateRootForm({ coverImage: res.url })
                          toast.success("封面上传成功")
                        } catch (err: any) {
                          toast.error(err?.message || "封面上传失败")
                        }
                      }}
                    />
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* ========== Two-column layout ========== */}
        <div className="grid grid-cols-[260px_1fr] gap-6">

          {/* Left: Course Node Tree */}
          <CourseNodeTree
            nodes={nodes}
            selectedNodeId={selectedNodeId}
            onSelect={setSelectedNodeId}
            onAddNode={handleAddNode}
            onUpdateNode={handleUpdateNode}
            onDeleteNode={handleDeleteNode}
            onReorderNodes={handleReorderNodes}
            disableCloneQuote
          />

          {/* Center: Content modules */}
          <div className="relative min-w-0">
            <main className="space-y-5 min-w-0">
              {/* Node info bar */}
              {selectedNode && (
                <div className="flex items-center bg-white rounded-xl border border-gray-100 px-5 py-3">
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span className="w-1.5 h-1.5 bg-amber-400 rounded-full" />
                    <span>当前编辑节点：<span className="font-medium text-gray-700">{selectedNode.name}</span></span>
                  </div>
                </div>
              )}

              {!selectedNode && (
                <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-400">
                  <Info className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">请从左侧目录选择一个节点进行编辑</p>
                </div>
              )}

              {selectedNode && currentData && (
                <Tabs defaultValue="design" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="design">教学设计</TabsTrigger>
                    <TabsTrigger value="process">教学过程</TabsTrigger>
                    <TabsTrigger value="review">课后复盘</TabsTrigger>
                  </TabsList>

                  <TabsContent value="design" className="space-y-4 pt-4">
                    <Card>
                      <CardHeader className="pb-3 flex flex-row items-start justify-between gap-4">
                        <div className="space-y-1">
                          <CardTitle className="text-base flex items-center gap-2">
                            <BookOpen className="h-4 w-4 text-blue-500" />
                            教学设计
                          </CardTitle>
                          {relatedDesignNodeIds.length > 0 && (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs text-gray-400">已关联节点：</span>
                              {relatedDesignNodeIds.map((id) => {
                                const node = nodes.find((n) => n.id === id)
                                return (
                                  <Badge key={id} variant="secondary" className="text-xs font-normal">
                                    {node?.name || id}
                                  </Badge>
                                )
                              })}
                            </div>
                          )}
                        </div>
                        <Button size="sm" variant="outline" onClick={openShareDialog}>
                          <Layers className="h-4 w-4 mr-1" />
                          复用节点
                        </Button>
                      </CardHeader>
                      <CardContent>
                        <MockRichEditor
                          value={currentData.teachingDesignContent}
                          onChange={updateTeachingDesignContent}
                          placeholder="请输入教学设计内容"
                        />
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="process" className="space-y-6 pt-4">
                    {processCategories.map(({ key: category, label }) => {
                      const categoryModules = currentModules.filter((k) => ATOMIC_MODULES_BY_KEY[k]?.category === category)
                      return (
                        <div key={category} className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium text-gray-700">{label}</h3>
                            <Button size="sm" variant="outline" onClick={() => openAddDialog(category)}>
                              <Plus className="h-4 w-4 mr-1" />
                              添加教学活动
                            </Button>
                          </div>
                          <div className="space-y-4">
                            {categoryModules.length === 0 && (
                              <div className="bg-white rounded-xl border border-gray-100 p-6 text-center text-gray-400 text-sm">
                                暂无{label}教学活动，点击上方按钮添加
                              </div>
                            )}
                            {categoryModules.map((key) => renderModuleCard(key, currentData))}
                          </div>
                        </div>
                      )
                    })}
                  </TabsContent>

                  <TabsContent value="review" className="space-y-4 pt-4">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <ClipboardList className="h-4 w-4 text-blue-500" />
                          课后复盘
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <MockRichEditor
                          value={currentData.postLessonReviewContent}
                          onChange={(v) => updateNodeData({ postLessonReviewContent: v })}
                          placeholder="请输入课后总结内容"
                        />
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              )}

              {/* Bottom spacer */}
              <div className="h-12" />
            </main>
          </div>
        </div>

      {/* Add module dialog */}
      <Dialog
        open={addDialogOpen}
        onOpenChange={(open) => {
          setAddDialogOpen(open)
          if (!open) setAddDialogCategory(null)
        }}
      >
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              添加{addDialogCategory ? processCategories.find((c) => c.key === addDialogCategory)?.label : ""}教学活动
            </DialogTitle>
          </DialogHeader>
          {dialogModules.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">该分组下所有教学活动已挂载</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 py-4">
              {dialogModules.map((m) => {
                const Icon = m.icon
                return (
                  <button
                    key={m.key}
                    onClick={() => addModule(m.key)}
                    className="flex items-center gap-2 p-3 border rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors text-left"
                  >
                    <Icon className="h-4 w-4 text-blue-500 shrink-0" />
                    <span className="text-sm">{m.label}</span>
                  </button>
                )
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Share design nodes dialog */}
      <Dialog
        open={shareDialogOpen}
        onOpenChange={(open) => {
          setShareDialogOpen(open)
          if (!open) setShareSelectedIds([])
        }}
      >
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>复用节点（教学设计同步）</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-2">
            <p className="text-xs text-gray-400">选择要与当前节点同步教学设计的节点</p>
            {nodes
              .filter((n) => n.id !== selectedNodeId)
              .map((n) => {
                const checked = shareSelectedIds.includes(n.id)
                return (
                  <label
                    key={n.id}
                    onClick={() => toggleShareNode(n.id)}
                    className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${checked ? "bg-blue-50 border-blue-300" : "hover:bg-gray-50"}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleShareNode(n.id)}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm">{n.name}</span>
                  </label>
                )
              })}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setShareDialogOpen(false)}>
              取消
            </Button>
            <Button size="sm" className="bg-[#1890ff] hover:bg-[#40a9ff]" onClick={confirmShareNodes}>
              确认关联
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Toaster />
    </EditorShell>
  )
}

export default function HybridCourseAddPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">加载中...</div>}>
      <HybridCourseAddForm />
    </Suspense>
  )
}
