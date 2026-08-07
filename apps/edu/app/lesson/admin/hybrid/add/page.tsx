'use client'

import { Suspense, useState, useRef, useCallback, useMemo, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FormFieldRow } from '@/components/shared/form-field-row'
import { Textarea } from '@/components/ui/textarea'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Info,
  Plus,
  X,
  BookOpen,
  Layers,
  ClipboardList,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { toast } from '@zhiyu/ui'
import { courseApi, courseNodeApi, hybridModuleApi, fileApi, lessonBatchApi, abilityApi } from '@/lib/api'
import type { HybridNodeModule } from '@zhiyu/api-client'
import { MajorSelect } from '@/components/shared/major-select'
import { CoverImageUpload } from '@/components/shared/cover-image-upload'
import { AbilityPointSelector } from '../../_components/ability/ability-point-selector'
import { RichTextEditor } from '../../_components/common/rich-text-editor'
import type { Course } from '@/lib/types/lesson'
import type { SystemCourseNode, NodeRefType } from '@/lib/types/lesson-source'
import CourseNodeTree from '../../system/add/_components/CourseNodeTree'
import { EditorShell } from '@/components/shared/editor-shell'
import { BatchSelector } from '@/components/shared/batch-selector'
// 演示数据：以下 import 来自占位 mock 文件，后续应替换为真实 API（详见该文件头部说明）
import { reportError } from '@/lib/error-handling'
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
} from './_components/atomic-modules'
import {
  applyModuleData,
  buildModulesForNode,
  TEACHING_DESIGN_KEY,
} from './_components/module-serialize'

const FIRST_NODE_ID = 'hybrid-node-1'

function MockRichEditor({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <Textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="border rounded-md text-sm min-h-[100px] resize-y"
    />
  )
}

function HybridCourseAddForm() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const editId = searchParams.get('id')
  const hasSavedRef = useRef(false)
  const isNewCourse = searchParams.get('new') === 'true'
  const claimCourse = searchParams.get('claimCourse')
  const claimSessionsParam = searchParams.get('claimSessions')
  const [existing, setExisting] = useState<Course | null>(null)
  const [batchId, setBatchId] = useState('')
  const [courseDescriptionPdf, setCourseDescriptionPdf] = useState<string | null>(null)
  const [abilityPoints, setAbilityPoints] = useState<
    { id: string; name: string; code?: string; description?: string }[]
  >([])
  const [abilityPool, setAbilityPool] = useState<
    { id: string; name: string; code?: string; description?: string }[]
  >([])

  useEffect(() => {
    abilityApi
      .list({ limit: 1000 })
      .then((res) => {
        setAbilityPool(
          (res.items || []).map((a: any) => ({
            id: a.id,
            name: a.name,
            code: a.code,
            description: a.description,
          })),
        )
      })
      .catch(() => setAbilityPool([]))
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
    } catch (err) {
      reportError(err, '解析排课会话参数')
      return null
    }
  }, [claimSessionsParam])

  const claimSessionNames = useMemo<string[]>(() => {
    return (claimPayload?.sessions || []).map((s) => `第 ${s.week} 周 · ${s.weekday} · ${s.period}`)
  }, [claimPayload])

  /* ========== course node tree ========== */
  const [nodes, setNodes] = useState<SystemCourseNode[]>([])
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)

  /* ========== atomic module assignments per node ========== */
  const [moduleAssignments, setModuleAssignments] = useState<Record<string, AtomicModuleKey[]>>({})

  /* ========== independent data per node ========== */
  const [nodeDataMap, setNodeDataMap] = useState<Record<string, NodeModuleData>>({})

  // ref 同步，供保存函数读取最新状态
  const nodesRef = useRef(nodes)
  const nodeDataMapRef = useRef(nodeDataMap)
  const moduleAssignmentsRef = useRef(moduleAssignments)
  const selectedNodeIdRef = useRef(selectedNodeId)

  // 课程基本信息独立 state（与节点无关，对齐体系课编辑结构）
  const [courseForm, setCourseForm] = useState<CourseBasicForm>(
    () => createDefaultNodeModuleData().form,
  )
  const courseFormRef = useRef(courseForm)

  useEffect(() => {
    courseFormRef.current = courseForm
  }, [courseForm])

  // 加载后同步节点列表与模块数据到 ref
  useEffect(() => {
    nodesRef.current = nodes
    nodeDataMapRef.current = nodeDataMap
    moduleAssignmentsRef.current = moduleAssignments
    selectedNodeIdRef.current = selectedNodeId
  }, [nodes, nodeDataMap, moduleAssignments, selectedNodeId])

  // 编辑模式：加载课程 + 节点树 + 各节点模块内容；新建：按排课会话生成初始节点树
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (editId) {
        try {
          const [c, nodeRes, moduleRes] = await Promise.all([
            courseApi.get(editId),
            courseNodeApi.list({ courseId: editId }),
            hybridModuleApi.list({ courseId: editId }),
          ])
          if (cancelled) return
          setExisting(c)
          if (c.batchId) setBatchId(c.batchId)
          // 回填课程基本信息
          const courseEvalData = (c.evalData as any) || {}
          setCourseForm({
            name: c.name || '',
            code: c.code || '',
            majorId: c.majorId || '',
            majorName: c.majorName || '',
            semester: c.semester || '',
            category: (c.category as CourseBasicForm['category']) || '专业核心课程',
            courseObjectives: courseEvalData.learningGoal || '',
            detailedDescription: c.description || '',
            background: courseEvalData.background || '',
            estimatedHours: courseEvalData.estimatedHours
              ? String(courseEvalData.estimatedHours)
              : '',
            coverImage: c.coverImage || '',
          })
          setCourseDescriptionPdf(courseEvalData.descriptionPdf || null)
          const loadedNodes = (nodeRes.items || []) as SystemCourseNode[]
          // 旧课程可能没有节点：生成内存根节点，保证课程基本信息可编辑，保存时自动落库
          if (loadedNodes.length === 0) {
            loadedNodes.push({
              id: `node-${Date.now()}`,
              courseId: editId,
              parentId: null,
              name: c.name || '混合课程',
              order: 1,
              type: 'normal',
              status: 'draft',
            })
          }
          setNodes(loadedNodes)
          setAbilityPoints(
            (c.abilityPointIds || []).map((id: string) => {
              const found = abilityPool.find((a) => a.id === id)
              return found || { id, name: id }
            }),
          )
          const modulesByNode = new Map<string, HybridNodeModule[]>()
          ;(moduleRes.items || []).forEach((m) => {
            const list = modulesByNode.get(m.nodeId) || []
            list.push(m)
            modulesByNode.set(m.nodeId, list)
          })
          const assignments: Record<string, AtomicModuleKey[]> = {}
          const dataMap: Record<string, NodeModuleData> = {}
          loadedNodes.forEach((n) => {
            const modules = modulesByNode.get(n.id) || []
            const keys: AtomicModuleKey[] = []
            const modes: NodeModuleData['moduleModes'] = {}
            const d = createDefaultNodeModuleData({
              name: n.name,
              code: c.code,
              majorId: c.majorId,
              majorName: c.majorName,
              semester: c.semester,
              category: c.category as CourseBasicForm['category'],
              coverImage: c.coverImage,
            })
            modules.forEach((m) => {
              if (
                m.moduleKey === TEACHING_DESIGN_KEY ||
                m.moduleKey === 'postLessonReview'
              ) {
                applyModuleData(d, m)
                return
              }
              if (!(m.moduleKey in ATOMIC_MODULES_BY_KEY)) return
              keys.push(m.moduleKey as AtomicModuleKey)
              modes[m.moduleKey as AtomicModuleKey] = m.mode
              applyModuleData(d, m)
            })
            d.moduleModes = modes
            assignments[n.id] = keys
            dataMap[n.id] = d
          })
          setModuleAssignments(assignments)
          setNodeDataMap(dataMap)
          setSelectedNodeId(loadedNodes[0]?.id || null)
        } catch (err) {
          reportError(err, '加载课程信息')
          setExisting(null)
        }
        return
      }

      // 新建：根节点 + 排课会话生成的节次子节点
      const rootNode: SystemCourseNode = {
        id: FIRST_NODE_ID,
        courseId: 'hybrid-new',
        parentId: null,
        name: claimCourse || '混合课程',
        order: 1,
        type: 'normal',
        status: 'draft',
      }
      const childNodes: SystemCourseNode[] = claimSessionNames.map((name, idx) => ({
        id: `hybrid-node-child-${idx + 1}`,
        courseId: 'hybrid-new',
        parentId: FIRST_NODE_ID,
        name,
        order: idx + 1,
        type: 'normal',
        status: 'draft',
      }))
      if (cancelled) return
      setNodes([rootNode, ...childNodes])
      setSelectedNodeId(FIRST_NODE_ID)
      setModuleAssignments({ [FIRST_NODE_ID]: [...DEFAULT_MODULES] })
      setNodeDataMap({
        [FIRST_NODE_ID]: createDefaultNodeModuleData({
          name: claimCourse || undefined,
        }),
      })
    })()
    return () => {
      cancelled = true
    }
  }, [editId, claimCourse, claimSessionNames, abilityPool])

  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [addDialogCategory, setAddDialogCategory] = useState<AtomicModuleCategory | null>(null)
  const [shareDialogOpen, setShareDialogOpen] = useState(false)
  const [shareSelectedIds, setShareSelectedIds] = useState<string[]>([])
  const [globalInfoOpen, setGlobalInfoOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [coverUploading, setCoverUploading] = useState(false)

  const updateCourseForm = useCallback((patch: Partial<CourseBasicForm>) => {
    setCourseForm((prev) => ({ ...prev, ...patch }))
  }, [])

  const handleAddNode = useCallback(
    (
      parentId: string | null,
      name: string,
      order: number,
      type?: NodeRefType,
      sourceId?: string,
      sourceName?: string,
    ) => {
      const newNode: SystemCourseNode = {
        id: `node-${Date.now()}`,
        courseId: editId || 'hybrid-new',
        parentId,
        name,
        order,
        type: type || 'normal',
        status: 'draft',
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
          category: existing?.category as CourseBasicForm['category'],
        }),
      }))
    },
    [editId, existing, claimCourse],
  )

  const handleUpdateNode = useCallback((nodeId: string, updates: Partial<SystemCourseNode>) => {
    setNodes((prev) => prev.map((n) => (n.id === nodeId ? { ...n, ...updates } : n)))
  }, [])

  const handleDeleteNode = useCallback(
    (nodeId: string) => {
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
        setSelectedNodeId(null)
      }
    },
    [selectedNodeId],
  )

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

  const defaultNodeData = (): NodeModuleData =>
    createDefaultNodeModuleData({
      name: claimCourse || existing?.name,
      code: existing?.code,
      majorId: existing?.majorId,
      semester: existing?.semester,
      category: existing?.category as CourseBasicForm['category'],
    })

  // 选中节点缺省数据在 effect 中落 state（不在渲染期 setState）
  useEffect(() => {
    if (!selectedNodeId || nodeDataMap[selectedNodeId]) return
    const next = defaultNodeData()
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNodeDataMap((prev) => (prev[selectedNodeId] ? prev : { ...prev, [selectedNodeId]: next }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNodeId])

  const currentModules = selectedNodeId ? moduleAssignments[selectedNodeId] || [] : []
  const currentData = selectedNodeId ? (nodeDataMap[selectedNodeId] ?? defaultNodeData()) : null

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
      prev.includes(nodeId) ? prev.filter((id) => id !== nodeId) : [...prev, nodeId],
    )
  }

  const confirmShareNodes = () => {
    if (!selectedNodeId || !currentData) return
    const nextSharedIds = shareSelectedIds.filter((id) => id !== selectedNodeId)

    setNodeDataMap((prev) => {
      const next = { ...prev }
      const currentContent = next[selectedNodeId]?.teachingDesignContent || ''

      // 从所有已有相关节点中移除当前节点
      relatedDesignNodeIds.forEach((id) => {
        if (next[id]) {
          next[id] = {
            ...next[id],
            teachingDesignSharedNodeIds: (next[id].teachingDesignSharedNodeIds || []).filter(
              (sid) => sid !== selectedNodeId,
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
              new Set([...(next[id].teachingDesignSharedNodeIds || []), selectedNodeId]),
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

  // 混合课节点评价规则持久化到节点级 eval_data（发布时 GenerateCourseAssessments 读取生成测评）
  const buildNodeHybridEvalRules = (d: NodeModuleData): Record<string, any> => {
    return {
      preQuiz: { methods: d.preQuizEvalMethods || [], evalRuleConfig: d.preQuizEvalRules },
      inClassQuiz: {
        methods: d.inClassQuizEvalMethods || [],
        evalRuleConfig: d.inClassQuizEvalRules,
      },
      homework: { methods: d.homeworkEvalMethods || [], evalRuleConfig: d.homeworkEvalRules },
    }
  }

  const buildCoursePayload = (): Omit<
    Course,
    'id' | 'nodeCount' | 'resourceCount' | 'studyCount' | 'createdAt' | 'updatedAt'
  > =>
    ({
      code: courseForm.code || '',
      name: courseForm.name || '',
      type: 'hybrid',
      category: courseForm.category || '专业核心课程',
      majorId: courseForm.majorId || existing?.majorId || undefined,
      majorName: courseForm.majorName || existing?.majorName || undefined,
      semester: existing?.semester || undefined,
      className: existing?.className || '',
      coverImage: courseForm.coverImage || undefined,
      batchId: batchId || undefined,
      status: 'draft',
      creatorId: existing?.creatorId || '',
      coCreatorIds: existing?.coCreatorIds || [],
      description: courseForm.detailedDescription || undefined,
      abilityPointIds: abilityPoints.map((a) => a.id),
      evalData: {
        descriptionPdf: courseDescriptionPdf || undefined,
      },
    }) as any

  const saveNodes = useCallback(
    async (effectiveCourseId: string) => {
      // 删除在后端存在但本地已删除的节点（级联删除其混合模块）
      const currentBackendNodes = await courseNodeApi.list({ courseId: effectiveCourseId })
      const backendNodeIds = new Set((currentBackendNodes.items || []).map((n: any) => n.id))
      const localNodeIds = new Set(
        nodesRef.current.map((n) => n.id).filter((id) => !id.startsWith('node-')),
      )
      for (const backendId of backendNodeIds) {
        if (!localNodeIds.has(backendId)) {
          try {
            await courseNodeApi.delete(backendId)
          } catch (err) {
            reportError(err, '删除多余课程节点')
          }
        }
      }

      const sortedNodes = [...nodesRef.current].sort((a, b) => a.order - b.order)
      const idMapping = new Map<string, string>()
      const courseCode = courseFormRef.current?.code || existing?.code || ''

      for (const node of sortedNodes) {
        const d = nodeDataMapRef.current[node.id]
        if (!d) continue
        const isTempId = node.id.startsWith('node-') || node.id.startsWith('hybrid-node-')
        const realParentId = node.parentId
          ? idMapping.get(node.parentId) || node.parentId
          : undefined

        const nodePayload = {
          courseId: effectiveCourseId,
          parentId: realParentId,
          name: node.name,
          code: node.code || courseCode,
          sortOrder: Math.round(node.order),
          refType: 'normal' as const,
          evalData: { hybridEvalRules: buildNodeHybridEvalRules(d) },
          status: 'draft',
        }

        let realNodeId = node.id
        if (isTempId) {
          const created = await courseNodeApi.create(nodePayload)
          realNodeId = created.id
          idMapping.set(node.id, created.id)
        } else {
          await courseNodeApi.update(node.id, nodePayload)
          idMapping.set(node.id, node.id)
        }

        // 保存节点模块（全量替换）
        const modules = buildModulesForNode(d, moduleAssignmentsRef.current[node.id] || [])
        try {
          await hybridModuleApi.batchSave(realNodeId, modules)
        } catch (err) {
          reportError(err, '保存节点模块')
        }
      }

      // 刷新节点列表（临时 ID 已映射为真实 ID），并迁移编辑态缓存 key
      const refreshed = await courseNodeApi.list({ courseId: effectiveCourseId })
      const refreshedNodes = (refreshed.items || []) as SystemCourseNode[]
      setNodes(refreshedNodes)
      setNodeDataMap((prev) => {
        const next: Record<string, NodeModuleData> = {}
        Object.entries(prev).forEach(([k, v]) => {
          next[idMapping.get(k) || k] = v
        })
        return next
      })
      setModuleAssignments((prev) => {
        const next: Record<string, AtomicModuleKey[]> = {}
        Object.entries(prev).forEach(([k, v]) => {
          next[idMapping.get(k) || k] = v
        })
        return next
      })
      if (selectedNodeIdRef.current) {
        const mapped = idMapping.get(selectedNodeIdRef.current)
        if (mapped) setSelectedNodeId(mapped)
      }
    },
    [existing?.code],
  )

  const handleSave = async () => {
    if (!courseForm.name || !courseForm.code) {
      toast({ title: '请填写课程名称和课程编码', variant: 'destructive' })
      return false
    }
    setSaving(true)
    try {
      const payload = buildCoursePayload()
      let effectiveCourseId = editId
      if (editId) {
        const updated = await courseApi.update(editId, payload)
        hasSavedRef.current = true
        if (existing?.status !== 'draft') {
          await courseApi.saveDraft(editId)
          setExisting({ ...updated, status: 'draft' as const })
        } else {
          setExisting(updated)
        }
      } else {
        const created = await courseApi.create(payload)
        setExisting(created)
        effectiveCourseId = created.id
        hasSavedRef.current = true
      }

      if (effectiveCourseId) {
        await saveNodes(effectiveCourseId)
      }

      toast({ title: '草稿已保存' })
      if (!editId && effectiveCourseId) {
        router.replace(`/lesson/admin/hybrid/add?id=${effectiveCourseId}`)
      }
      return true
    } catch (e: any) {
      toast({ title: e?.message || '保存失败，请检查表单后重试', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
    return false
  }

  const handleFinish = async () => {
    const ok = await handleSave()
    if (ok) {
      router.push('/lesson/admin/hybrid')
    }
  }

  const availableModules = ATOMIC_MODULES.filter((m) => !currentModules.includes(m.key))

  const renderModuleCard = (key: AtomicModuleKey, data: NodeModuleData) => {
    if (!selectedNodeId) return null
    const meta = ATOMIC_MODULES_BY_KEY[key]
    const Icon = meta.icon
    const Component = meta.component
    const mode = data.moduleModes?.[key] ?? 'online'
    return (
      <Card key={key} className="overflow-visible">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Icon className="h-4 w-4 text-primary" />
            {meta.label}
          </CardTitle>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch
                id={`module-mode-${selectedNodeId}-${key}`}
                checked={mode === 'online'}
                onCheckedChange={(checked) =>
                  updateNodeData({
                    moduleModes: { ...data.moduleModes, [key]: checked ? 'online' : 'offline' },
                  })
                }
              />
              <Label
                htmlFor={`module-mode-${selectedNodeId}-${key}`}
                className="text-xs text-gray-500 cursor-pointer"
              >
                {mode === 'online' ? '线上' : '线下'}
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
    { key: 'pre-class', label: '课前' },
    { key: 'in-class', label: '课中' },
    { key: 'post-class', label: '课后' },
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
          try {
            await courseApi.delete(editId)
          } catch (err) {
            reportError(err, '删除未保存的课程草稿')
          }
        }
        router.push('/lesson/admin/hybrid')
      }}
      onSaveDraft={handleSave}
      isSaving={saving}
      onSubmit={handleFinish}
      submitText="完成配置"
      title={editId ? '编辑混合课程' : '新建混合课程'}
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
                      {courseForm.name ? `《${courseForm.name}》` : '未填写课程名称'}
                    </span>
                    {courseForm.majorName && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                        {courseForm.majorName}
                      </span>
                    )}
                  </CardTitle>
                  <div className="flex items-center gap-2 text-gray-400">
                    <span className="text-xs">{globalInfoOpen ? '收起' : '展开编辑'}</span>
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
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left: 课程名称 + 课程分类 + 课程简介 */}
                <div className="space-y-4 min-w-0">
                  <FormFieldRow label="课程名称" labelClassName="text-xs">
                    <Input
                      value={courseForm.name}
                      onChange={(e) => updateCourseForm({ name: e.target.value })}
                      placeholder="请输入课程名称"
                      className="h-9 text-sm"
                    />
                  </FormFieldRow>
                  <FormFieldRow label="课程分类" labelClassName="text-xs">
                    <Select
                      value={courseForm.category}
                      onValueChange={(v) =>
                        updateCourseForm({ category: v as CourseBasicForm['category'] })
                      }
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="请选择课程分类" />
                      </SelectTrigger>
                      <SelectContent>
                        {COURSE_CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormFieldRow>
                  <div className="space-y-1.5">
                    <Label className="text-xs">课程简介</Label>
                    <RichTextEditor
                      value={courseForm.detailedDescription}
                      onChange={(v) => updateCourseForm({ detailedDescription: v })}
                      placeholder="请输入课程简介..."
                      minHeight={280}
                      pdfUrl={courseDescriptionPdf}
                      onPdfChange={setCourseDescriptionPdf}
                    />
                  </div>
                </div>
                {/* Right: 封面图片 + 适用专业 + 所属批次 + 关联能力点 */}
                <div className="space-y-4 min-w-0">
                  <div className="max-w-[400px]">
                    <CoverImageUpload
                      imageUrl={courseForm.coverImage}
                      uploading={coverUploading}
                      label="课程封面"
                      alt="课程封面"
                      onUpload={async (file) => {
                        setCoverUploading(true)
                        try {
                          const res = await fileApi.upload(file)
                          updateCourseForm({ coverImage: res.url })
                          toast({ title: '封面上传成功' })
                        } catch (err: any) {
                          toast({ title: err?.message || '封面上传失败', variant: 'destructive' })
                        } finally {
                          setCoverUploading(false)
                        }
                      }}
                      onRemove={() => updateCourseForm({ coverImage: '' })}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs">适用专业</Label>
                      <MajorSelect
                        value={courseForm.majorId}
                        onChange={(v, m) =>
                          updateCourseForm({ majorId: v || '', majorName: m?.name || '' })
                        }
                        placeholder="请选择适用专业"
                        className="h-9 text-sm"
                      />
                    </div>
                    <BatchSelector
                      value={batchId}
                      onChange={setBatchId}
                      batchApi={lessonBatchApi}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">关联能力点（用于岗位能力汇聚）</Label>
                    <AbilityPointSelector
                      selected={abilityPoints}
                      pool={abilityPool}
                      onChange={setAbilityPoints}
                      onAddCustom={(name, description) => {
                        const newAp = { id: `ap-custom-${Date.now()}`, name, description }
                        setAbilityPoints((prev) => [...prev, newAp])
                        setAbilityPool((prev) => [...prev, newAp])
                      }}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* ========== Two-column layout ========== */}
      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
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
                  <span>
                    当前编辑节点：
                    <span className="font-medium text-gray-700">{selectedNode.name}</span>
                  </span>
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
                          <BookOpen className="h-4 w-4 text-primary" />
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
                    const categoryModules = currentModules.filter(
                      (k) => ATOMIC_MODULES_BY_KEY[k]?.category === category,
                    )
                    return (
                      <div key={category} className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-medium text-gray-700">{label}</h3>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openAddDialog(category)}
                          >
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
                        <ClipboardList className="h-4 w-4 text-primary" />
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
              添加
              {addDialogCategory
                ? processCategories.find((c) => c.key === addDialogCategory)?.label
                : ''}
              教学活动
            </DialogTitle>
          </DialogHeader>
          {dialogModules.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              该分组下所有教学活动已挂载
            </p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 py-4">
              {dialogModules.map((m) => {
                const Icon = m.icon
                return (
                  <button
                    key={m.key}
                    onClick={() => addModule(m.key)}
                    className="flex items-center gap-2 p-3 border rounded-lg hover:bg-primary/5 hover:border-primary/30 transition-colors text-left"
                  >
                    <Icon className="h-4 w-4 text-primary shrink-0" />
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
                    className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${checked ? 'bg-primary/5 border-primary/30' : 'hover:bg-gray-50'}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleShareNode(n.id)}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
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
            <Button
              size="sm"
              className="bg-[#1890ff] hover:bg-[#40a9ff]"
              onClick={confirmShareNodes}
            >
              确认关联
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </EditorShell>
  )
}

export default function HybridCourseAddPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">
          加载中...
        </div>
      }
    >
      <HybridCourseAddForm />
    </Suspense>
  )
}
