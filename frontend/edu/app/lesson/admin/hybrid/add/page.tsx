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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Info,
  Plus,
  BookOpen,
  Layers,
  ClipboardList,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { toast } from '@zhiyu/ui'
import { courseApi, courseNodeApi, hybridModuleApi, fileApi, lessonBatchApi, abilityApi } from '@/lib/api'
import { fetchAllPages } from '@zhiyu/api-client'
import type { HybridNodeModule } from '@zhiyu/api-client'
import { MajorSelect } from '@/components/shared/major-select'
import { CoverImageUpload } from '@/components/shared/cover-image-upload'
import { AbilityPointSelector } from '../../_components/ability/ability-point-selector'
import { RichTextEditor } from '../../_components/common/rich-text-editor'
import type { Course } from '@/lib/types/lesson'
import type { SystemCourseNode, NodeRefType } from '@/lib/types/lesson-source'
import CourseNodeTree, { wouldCreateCycle } from '../../system/add/_components/CourseNodeTree'
import { EditorShell } from '@/components/shared/editor-shell'
import { BatchSelector } from '@/components/shared/batch-selector'
import { reportError } from '@/lib/error-handling'
import { useT } from '@/lib/i18n/locale-provider'
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
import { ModuleEditDialog, ModulePreviewCard } from './_components/module-preview'

const FIRST_NODE_ID = 'hybrid-node-1'

function uid(prefix = 'id') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

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
  const t = useT()
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
  // 池渲染期同步到 ref：加载 effect 不依赖池变化，避免池加载完成后重跑重置用户编辑
  const abilityPoolRef = useRef(abilityPool)
  useEffect(() => {
    abilityPoolRef.current = abilityPool
  }, [abilityPool])

  useEffect(() => {
    // 能力点池全量分页拉取，避免超过 1000 条时池内能力点缺失/回显截断
    fetchAllPages((page, pageSize) =>
      abilityApi.list({ limit: pageSize, offset: page * pageSize }),
    )
      .then((res) => {
        const pool = (res || []).map((a: any) => ({
          id: a.id,
          name: a.name,
          code: a.code,
          description: a.description,
        }))
        setAbilityPool(pool)
        // 能力点池晚于课程加载时，回填课程能力点名称（此前退化为原始 id 显示）
        setAbilityPoints((prev) =>
          prev.map((ap) => {
            if (ap.name !== ap.id) return ap
            const found = pool.find((a) => a.id === ap.id)
            return found || ap
          }),
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
        sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
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
    () => ({ ...createDefaultNodeModuleData().form, category: COURSE_CATEGORIES[0] }),
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
          const courseEvalData = c.evalData || {}
          setCourseForm({
            name: c.name || '',
            code: c.code || '',
            majorId: c.majorId || '',
            majorName: c.majorName || '',
            semester: c.semester || '',
            category: COURSE_CATEGORIES.includes(c.category as CourseBasicForm['category'])
              ? (c.category as CourseBasicForm['category'])
              : COURSE_CATEGORIES[0],
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
              id: uid('node'),
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
              const found = abilityPoolRef.current.find((a) => a.id === id)
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
  }, [editId, claimCourse, claimSessionNames])

  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [addDialogCategory, setAddDialogCategory] = useState<AtomicModuleCategory | null>(null)
  const [editingModuleKey, setEditingModuleKey] = useState<AtomicModuleKey | null>(null)
  const [shareDialogOpen, setShareDialogOpen] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [addMemberGroupId, setAddMemberGroupId] = useState('')
  const [addMemberGroupName, setAddMemberGroupName] = useState('')
  const [addMemberSelectedIds, setAddMemberSelectedIds] = useState<string[]>([])
  const [renamingGroupId, setRenamingGroupId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [disbandGroupId, setDisbandGroupId] = useState('')
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
        id: uid('node'),
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
      const deleteIds = new Set<string>()
      const collect = (id: string) => {
        deleteIds.add(id)
        nodesRef.current.filter((n) => n.parentId === id).forEach((n) => collect(n.id))
      }
      collect(nodeId)
      setNodes((prev) => prev.filter((n) => !deleteIds.has(n.id)))
      setModuleAssignments((prev) => {
        const next = { ...prev }
        deleteIds.forEach((id) => delete next[id])
        return next
      })
      setNodeDataMap((prev) => {
        const next = { ...prev }
        deleteIds.forEach((id) => delete next[id])
        return next
      })
      if (selectedNodeId && deleteIds.has(selectedNodeId)) {
        setSelectedNodeId(null)
      }
    },
    [selectedNodeId],
  )

  const handleReorderNodes = useCallback(
    (nodeId: string, targetNodeId: string, position: 'before' | 'after' = 'after') => {
      setNodes((prev) => {
        const dragged = prev.find((n) => n.id === nodeId)
        const target = prev.find((n) => n.id === targetNodeId)
        if (!dragged || !target) return prev
        // 拒绝把节点移动到自身或自身后代旁（否则 parentId 形成环，buildTree 自引用导致渲染崩溃）
        if (wouldCreateCycle(prev, nodeId, targetNodeId)) return prev
        const orderOffset = position === 'before' ? -0.5 : 0.5
        const newNodes = prev.map((n) => {
          if (n.id === nodeId) {
            return { ...n, parentId: target.parentId, order: target.order + orderOffset }
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
    },
    [],
  )

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
    const myGroupIds = new Set((currentData.teachingDesignGroups || []).map((g) => g.id))
    if (myGroupIds.size === 0) return []
    return nodes
      .filter((n) => n.id !== selectedNodeId)
      .filter((n) =>
        (nodeDataMap[n.id]?.teachingDesignGroups || []).some((g) => myGroupIds.has(g.id)),
      )
      .map((n) => n.id)
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
    setEditingModuleKey((prev) => (prev === key ? null : prev))
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

  // 全部分组（由成员节点推导，含成员列表）
  const allShareGroups = useMemo(() => {
    const map = new Map<string, { id: string; name: string; members: SystemCourseNode[] }>()
    nodes.forEach((n) => {
      ;(nodeDataMap[n.id]?.teachingDesignGroups || []).forEach((g) => {
        const entry = map.get(g.id) || { id: g.id, name: g.name, members: [] }
        entry.name = g.name
        entry.members.push(n)
        map.set(g.id, entry)
      })
    })
    return Array.from(map.values())
  }, [nodes, nodeDataMap])

  // 新建分组：当前选中节点作为首成员（保证组可见），随后可继续添加其他节点
  const createShareGroup = () => {
    const name = newGroupName.trim()
    if (!name) return
    const gid = uid('dg')
    setNodeDataMap((prev) => {
      const next = { ...prev }
      if (selectedNodeId && next[selectedNodeId]) {
        const groups = next[selectedNodeId].teachingDesignGroups || []
        if (!groups.some((g) => g.id === gid)) {
          next[selectedNodeId] = {
            ...next[selectedNodeId],
            teachingDesignGroups: [...groups, { id: gid, name }],
          }
        }
      }
      return next
    })
    setNewGroupName('')
    setAddMemberGroupId(gid)
    setAddMemberGroupName(name)
    setAddMemberSelectedIds([])
    toast({ title: t('已创建分组「{name}」，可继续添加其他节点', { name }) })
  }

  // 重命名分组（更新所有成员节点上的组名）
  const renameShareGroup = (gid: string) => {
    const name = renameValue.trim()
    if (!name) return
    setNodeDataMap((prev) => {
      const next = { ...prev }
      Object.keys(next).forEach((k) => {
        const groups = next[k].teachingDesignGroups || []
        if (groups.some((g) => g.id === gid)) {
          next[k] = {
            ...next[k],
            teachingDesignGroups: groups.map((g) => (g.id === gid ? { ...g, name } : g)),
          }
        }
      })
      return next
    })
    setRenamingGroupId(null)
    setRenameValue('')
  }

  // 解散分组（所有成员移出）
  const disbandShareGroup = (gid: string) => {
    setNodeDataMap((prev) => {
      const next = { ...prev }
      Object.keys(next).forEach((k) => {
        const groups = next[k].teachingDesignGroups || []
        if (groups.some((g) => g.id === gid)) {
          next[k] = { ...next[k], teachingDesignGroups: groups.filter((g) => g.id !== gid) }
        }
      })
      return next
    })
    if (addMemberGroupId === gid) setAddMemberGroupId('')
  }

  // 打开某分组的"添加节点"
  const openAddMember = (gid: string, gname: string) => {
    if (addMemberGroupId === gid) {
      setAddMemberGroupId('')
      return
    }
    setAddMemberGroupId(gid)
    setAddMemberGroupName(gname)
    setAddMemberSelectedIds([])
  }

  const toggleAddMember = (nodeId: string) => {
    setAddMemberSelectedIds((prev) =>
      prev.includes(nodeId) ? prev.filter((id) => id !== nodeId) : [...prev, nodeId],
    )
  }

  // 确认添加成员：新成员加入分组并同步组内基准内容
  const confirmAddMembers = () => {
    const gid = addMemberGroupId
    const gname = addMemberGroupName
    if (!gid || !gname) return
    const group = allShareGroups.find((g) => g.id === gid)
    // 基准内容：组内现有第一个有内容的成员，否则保持新成员自身内容
    const baseContent =
      group?.members.find((m) => nodeDataMap[m.id]?.teachingDesignContent)?.id
        ? nodeDataMap[group.members.find((m) => nodeDataMap[m.id]?.teachingDesignContent)!.id]
            .teachingDesignContent
        : undefined

    setNodeDataMap((prev) => {
      const next = { ...prev }
      addMemberSelectedIds.forEach((id) => {
        if (!next[id]) return
        const groups = next[id].teachingDesignGroups || []
        if (groups.some((g) => g.id === gid)) return
        next[id] = {
          ...next[id],
          teachingDesignGroups: [...groups, { id: gid, name: gname }],
          teachingDesignContent: baseContent !== undefined ? baseContent : next[id].teachingDesignContent,
        }
      })
      return next
    })
    setAddMemberGroupId('')
    setAddMemberSelectedIds([])
  }

  // 移除单个成员
  const removeGroupMember = (gid: string, nodeId: string) => {
    setNodeDataMap((prev) => {
      const cur = prev[nodeId]
      if (!cur) return prev
      return {
        ...prev,
        [nodeId]: {
          ...cur,
          teachingDesignGroups: (cur.teachingDesignGroups || []).filter((g) => g.id !== gid),
        },
      }
    })
  }

  const openShareDialog = () => {
    setShareDialogOpen(true)
    setNewGroupName('')
    setAddMemberGroupId('')
    setRenamingGroupId(null)
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
        // 编辑加载时从 evalData 读取 learningGoal/background/estimatedHours 回填表单，
        // 保存必须一并回写，否则后端整列覆盖时这三项会静默丢失
        descriptionPdf: courseDescriptionPdf || undefined,
        learningGoal: courseForm.courseObjectives || undefined,
        background: courseForm.background || undefined,
        estimatedHours: courseForm.estimatedHours ? Number(courseForm.estimatedHours) : undefined,
      },
    })

  const saveNodes = useCallback(
    async (effectiveCourseId: string) => {
      // 删除在后端存在但本地已删除的节点（级联删除其混合模块）
      const currentBackendNodes = await courseNodeApi.list({ courseId: effectiveCourseId })
      const backendNodeIds = new Set((currentBackendNodes.items || []).map((n: any) => n.id))
      // 临时 ID 判定与下方 isTempId 保持一致（node-* / hybrid-node-*），避免误删或漏删
      const isTempNodeId = (id: string) =>
        id.startsWith('node-') || id.startsWith('hybrid-node-')
      const localNodeIds = new Set(
        nodesRef.current.map((n) => n.id).filter((id) => !isTempNodeId(id)),
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

      // 父节点必须先于子节点创建（parent_id 外键）：按层级拓扑排序
      const sortedNodes = (() => {
        const all = [...nodesRef.current].sort((a, b) => a.order - b.order)
        const byId = new Map(all.map((n) => [n.id, n]))
        const out: typeof all = []
        const visited = new Set<string>()
        const visit = (n: (typeof all)[number]) => {
          if (visited.has(n.id)) return
          visited.add(n.id)
          if (n.parentId && byId.has(n.parentId)) {
            visit(byId.get(n.parentId)!)
          }
          out.push(n)
        }
        all.forEach(visit)
        return out
      })()
      const idMapping = new Map<string, string>()
      const courseCode = courseFormRef.current?.code || existing?.code || ''

      // 第一遍：创建/更新节点，建立临时 ID → 真实 ID 映射
      for (const node of sortedNodes) {
        const d = nodeDataMapRef.current[node.id]
        if (!d) continue
        const isTempId = isTempNodeId(node.id)
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

        if (isTempId) {
          const created = await courseNodeApi.create(nodePayload)
          idMapping.set(node.id, created.id)
        } else {
          await courseNodeApi.update(node.id, nodePayload)
          idMapping.set(node.id, node.id)
        }
      }

      // 第二遍：保存各节点模块（全量替换）；任一失败向上抛错，防止静默丢失教学内容
      for (const node of sortedNodes) {
        const d = nodeDataMapRef.current[node.id]
        const realNodeId = idMapping.get(node.id)
        if (!d || !realNodeId) continue
        const modules = buildModulesForNode(
          d,
          moduleAssignmentsRef.current[node.id] || [],
        )
        await hybridModuleApi.batchSave(realNodeId, modules)
      }

      // 刷新节点列表（临时 ID 已映射为真实 ID），并迁移编辑态缓存 key（含共享节点 ID）
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
      toast({ title: t('请填写课程名称和课程编码'), variant: 'destructive' })
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

      toast({ title: t('草稿已保存') })
      if (!editId && effectiveCourseId) {
        router.replace(`/lesson/admin/hybrid/add?id=${effectiveCourseId}`)
      }
      return true
    } catch (e: any) {
      toast({ title: e?.message || t('保存失败，请检查表单后重试'), variant: 'destructive' })
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
    return (
      <ModulePreviewCard
        key={key}
        moduleKey={key}
        data={data}
        onClick={() => setEditingModuleKey(key)}
      />
    )
  }

  const processCategories: { key: AtomicModuleCategory; label: string }[] = [
    { key: 'pre-class', label: t('课前') },
    { key: 'in-class', label: t('课中') },
    { key: 'post-class', label: t('课后') },
  ]

  const dialogModules = addDialogCategory
    ? availableModules.filter((m) => m.category === addDialogCategory)
    : []

  return (
    <EditorShell
      mode="fullscreen"
      backText={t('取消')}
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
      submitText={t('完成配置')}
      title={editId ? t('编辑混合课程') : t('新建混合课程')}
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
                    {t('课程基本信息')}
                    <span className="text-xs font-normal text-gray-400">
                      {courseForm.name ? t('《{name}》', { name: courseForm.name }) : t('未填写课程名称')}
                    </span>
                    {courseForm.majorName && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                        {courseForm.majorName}
                      </span>
                    )}
                  </CardTitle>
                  <div className="flex items-center gap-2 text-gray-400">
                    <span className="text-xs">{globalInfoOpen ? t('收起') : t('展开编辑')}</span>
                    {globalInfoOpen ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </div>
                </div>
                {!globalInfoOpen && courseForm.detailedDescription && (
                  <p className="text-xs text-gray-400 mt-1 pl-6 text-left line-clamp-2">
                    {courseForm.detailedDescription}
                  </p>
                )}
              </CardHeader>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left: 课程名称 + 课程分类 + 课程简介 */}
                <div className="space-y-4 min-w-0">
                  <FormFieldRow label={t('课程名称')} labelClassName="text-xs">
                    <Input
                      value={courseForm.name}
                      onChange={(e) => updateCourseForm({ name: e.target.value })}
                      placeholder={t('请输入课程名称')}
                      className="h-9 text-sm"
                    />
                  </FormFieldRow>
                  <FormFieldRow label={t('课程分类')} labelClassName="text-xs">
                    <Select
                      value={courseForm.category}
                      onValueChange={(v) =>
                        updateCourseForm({ category: v as CourseBasicForm['category'] })
                      }
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder={t('请选择课程分类')} />
                      </SelectTrigger>
                      <SelectContent>
                        {COURSE_CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {t(c)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormFieldRow>
                  <div className="space-y-1.5">
                    <Label className="text-xs">{t('课程简介')}</Label>
                    <RichTextEditor
                      value={courseForm.detailedDescription}
                      onChange={(v) => updateCourseForm({ detailedDescription: v })}
                      placeholder={t('请输入课程简介...')}
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
                      label={t('课程封面')}
                      alt={t('课程封面')}
                      onUpload={async (file) => {
                        setCoverUploading(true)
                        try {
                          const res = await fileApi.upload(file)
                          updateCourseForm({ coverImage: res.url })
                          toast({ title: t('封面上传成功') })
                        } catch (err: any) {
                          toast({
                            title: err?.message || t('封面上传失败'),
                            variant: 'destructive',
                          })
                        } finally {
                          setCoverUploading(false)
                        }
                      }}
                      onRemove={() => updateCourseForm({ coverImage: '' })}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs">{t('适用专业')}</Label>
                      <MajorSelect
                        value={courseForm.majorId}
                        onChange={(v, m) =>
                          updateCourseForm({ majorId: v || '', majorName: m?.name || '' })
                        }
                        placeholder={t('请选择适用专业')}
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
                    <Label className="text-xs">{t('关联能力点（用于岗位能力汇聚）')}</Label>
                    <AbilityPointSelector
                      selected={abilityPoints}
                      pool={abilityPool}
                      onChange={setAbilityPoints}
                      onAddCustom={async (name, description) => {
                        try {
                          // 先创建真实能力点换取 ID，避免 ap-custom-* 假 ID 随 abilityPointIds 入库
                          const created = await abilityApi.create({
                            name,
                            description,
                            attributes: [],
                            isPublic: false,
                          })
                          setAbilityPoints((prev) => [
                            ...prev,
                            {
                              id: created.id,
                              name: created.name,
                              code: created.code,
                              description: created.description,
                            },
                          ])
                        } catch (err) {
                          reportError(err, '创建能力点')
                          toast({ title: t('创建能力点失败'), variant: 'destructive' })
                        }
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
                    {t('当前编辑节点：')}
                    <span className="font-medium text-gray-700">{selectedNode.name}</span>
                  </span>
                </div>
              </div>
            )}

            {!selectedNode && (
              <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-400">
                <Info className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">{t('请从左侧目录选择一个节点进行编辑')}</p>
              </div>
            )}

            {selectedNode && currentData && (
              <Tabs defaultValue="design" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="design">{t('教学设计')}</TabsTrigger>
                  <TabsTrigger value="process">{t('教学过程')}</TabsTrigger>
                  <TabsTrigger value="review">{t('课后复盘')}</TabsTrigger>
                </TabsList>

                <TabsContent value="design" className="space-y-4 pt-4">
                  <Card>
                    <CardHeader className="pb-3 flex flex-row items-start justify-between gap-4">
                      <div className="space-y-1">
                        <CardTitle className="text-base flex items-center gap-2">
                          <BookOpen className="h-4 w-4 text-primary" />
                          {t('教学设计')}
                        </CardTitle>
                        {currentData.teachingDesignGroups?.length > 0 && (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs text-gray-400">{t('所属分组：')}</span>
                            {currentData.teachingDesignGroups.map((g) => (
                              <Badge
                                key={g.id}
                                variant="secondary"
                                className="text-xs font-normal cursor-pointer hover:bg-primary/10 hover:text-primary"
                                onClick={openShareDialog}
                              >
                                {g.name}（{relatedDesignNodeIds.length > 0 ? relatedDesignNodeIds.length + 1 : 1}）
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <Button size="sm" variant="outline" onClick={openShareDialog}>
                        <Layers className="h-4 w-4 mr-1" />
                        {t('复用教学设计')}
                      </Button>
                    </CardHeader>
                    <CardContent>
                      <MockRichEditor
                        value={currentData.teachingDesignContent}
                        onChange={updateTeachingDesignContent}
                        placeholder={t('请输入教学设计内容')}
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
                            {t('添加教学活动')}
                          </Button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                          {categoryModules.length === 0 && (
                            <div className="bg-white rounded-xl border border-gray-100 p-6 text-center text-gray-400 text-sm sm:col-span-2 xl:col-span-3">
                              {t('暂无{n}教学活动，点击上方按钮添加', { n: label })}
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
                        {t('课后复盘')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <MockRichEditor
                        value={currentData.postLessonReviewContent}
                        onChange={(v) => updateNodeData({ postLessonReviewContent: v })}
                        placeholder={t('请输入课后总结内容')}
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
              {t('添加{n}教学活动', {
                n: addDialogCategory
                  ? processCategories.find((c) => c.key === addDialogCategory)?.label || ''
                  : '',
              })}
            </DialogTitle>
          </DialogHeader>
          {dialogModules.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              {t('该分组下所有教学活动已挂载')}
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
                    <span className="text-sm">{t(m.label)}</span>
                  </button>
                )
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit module dialog */}
      {editingModuleKey &&
        selectedNodeId &&
        currentData &&
        currentModules.includes(editingModuleKey) && (
          <ModuleEditDialog
            nodeId={selectedNodeId}
            moduleKey={editingModuleKey}
            data={currentData}
            onChange={updateNodeData}
            onRemove={() => removeModule(editingModuleKey)}
            onClose={() => setEditingModuleKey(null)}
            courseId={editId || undefined}
          />
        )}

      {/* Share design groups dialog */}
      <Dialog
        open={shareDialogOpen}
        onOpenChange={(open) => {
          setShareDialogOpen(open)
          if (!open) {
            setNewGroupName('')
            setAddMemberGroupId('')
            setAddMemberSelectedIds([])
            setRenamingGroupId(null)
            setDisbandGroupId('')
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('教学设计复用分组')}</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-4">
            {/* 新建分组 */}
            <div className="flex items-center gap-2">
              <Input
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder={t('输入新分组名称（如：共用教学设计）')}
                className="h-9 text-sm"
              />
              <Button
                size="sm"
                disabled={!newGroupName.trim()}
                onClick={createShareGroup}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                {t('新建分组')}
              </Button>
            </div>

            {/* 分组列表 */}
            {allShareGroups.length === 0 ? (
              <p className="text-xs text-gray-300 py-6 text-center">{t('尚未创建分组')}</p>
            ) : (
              allShareGroups.map((g) => {
                const isAdding = addMemberGroupId === g.id
                const isRenaming = renamingGroupId === g.id
                const candidateNodes = nodes.filter(
                  (n) => !g.members.some((m) => m.id === n.id),
                )
                return (
                  <div key={g.id} className="border rounded-lg p-3">
                    {/* 分组头：名称/重命名 + 操作 */}
                    <div className="flex items-center justify-between gap-2">
                      {isRenaming ? (
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <Input
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            className="h-8 text-sm"
                            autoFocus
                          />
                          <Button
                            size="sm"
                            className="h-8 text-xs"
                            disabled={!renameValue.trim()}
                            onClick={() => renameShareGroup(g.id)}
                          >
                            {t('保存')}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs"
                            onClick={() => {
                              setRenamingGroupId('')
                              setRenameValue('')
                            }}
                          >
                            {t('取消')}
                          </Button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-sm font-medium text-gray-700 truncate">
                              {g.name}
                            </span>
                            <Badge variant="secondary" className="text-[11px] font-normal shrink-0">
                              {t('{n} 个节点', { n: g.members.length })}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-gray-500"
                              onClick={() => {
                                setRenamingGroupId(g.id)
                                setRenameValue(g.name)
                              }}
                            >
                              {t('重命名分组')}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => openAddMember(g.id, g.name)}
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              {t('加入复用分组')}
                            </Button>
                            {disbandGroupId === g.id ? (
                              <>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() => disbandShareGroup(g.id)}
                                >
                                  {t('确认删除')}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() => setDisbandGroupId('')}
                                >
                                  {t('取消')}
                                </Button>
                              </>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs text-red-500 hover:text-red-600"
                                onClick={() => setDisbandGroupId(g.id)}
                              >
                                {t('删除分组')}
                              </Button>
                            )}
                          </div>
                        </>
                      )}
                    </div>

                    {/* 成员列表 */}
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      {g.members.map((m) => (
                        <span
                          key={m.id}
                          className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full bg-primary/5 text-primary border border-primary/20"
                        >
                          {m.name}
                          <button
                            type="button"
                            className="text-primary/50 hover:text-red-500 transition-colors"
                            title={t('移出分组')}
                            onClick={() => removeGroupMember(g.id, m.id)}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                      {g.members.length === 0 && (
                        <span className="text-xs text-gray-300">{t('暂无成员')}</span>
                      )}
                    </div>

                    {/* 添加节点面板 */}
                    {isAdding && (
                      <div className="mt-3 border-t pt-3 space-y-2">
                        <p className="text-xs text-gray-400">
                          {t('勾选节点加入「{name}」，加入后与组内节点教学设计同步', {
                            name: g.name,
                          })}
                          {candidateNodes.length === 0 && t('（所有节点均已在该组中）')}
                        </p>
                        {candidateNodes.length > 0 && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-48 overflow-y-auto">
                            {candidateNodes.map((n) => {
                              const checked = addMemberSelectedIds.includes(n.id)
                              return (
                                <label
                                  key={n.id}
                                  onClick={() => toggleAddMember(n.id)}
                                  className={`flex items-center gap-2.5 p-2 border rounded-lg cursor-pointer transition-colors ${checked ? 'bg-primary/5 border-primary/30' : 'hover:bg-gray-50'}`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleAddMember(n.id)}
                                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                  />
                                  <span className="text-sm truncate">{n.name}</span>
                                </label>
                              )
                            })}
                          </div>
                        )}
                        {candidateNodes.length > 0 && (
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs"
                              onClick={() => {
                                setAddMemberGroupId('')
                                setAddMemberSelectedIds([])
                              }}
                            >
                              {t('取消')}
                            </Button>
                            <Button
                              size="sm"
                              className="h-8 text-xs"
                              disabled={addMemberSelectedIds.length === 0}
                              onClick={confirmAddMembers}
                            >
                              {t('确认加入（{n}）', { n: addMemberSelectedIds.length })}
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </EditorShell>
  )
}

export default function HybridCourseAddPage() {
  const t = useT()
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">
          {t('加载中...')}
        </div>
      }
    >
      <HybridCourseAddForm />
    </Suspense>
  )
}
