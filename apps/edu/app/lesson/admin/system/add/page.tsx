'use client'

import { useState, useRef, Suspense, useMemo, useCallback, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  BookOpen,
  GraduationCap,
  ClipboardList,
  ChevronDown,
  ChevronRight,
  Info,
  Upload,
  Copy,
  Link2,
  Search,
  CheckCircle2,
  Sparkles,
} from 'lucide-react'
import { toast } from '@zhiyu/ui'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FormFieldRow } from '@/components/shared/form-field-row'

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type { SystemCourseNode, NodeResource, NodeRefType } from '@/lib/types/lesson-source'

import { KnowledgeSelector } from '@/components/shared/knowledge-selector'
import { AbilityPointSelector } from '../../_components/ability/ability-point-selector'
import { EvalMethodConfigModule } from '@/components/shared/eval-method-config-module'
import { TaskInfoCard } from '@/app/scene/scenarios/[id]/edit/tasks/_components/task-info-card'
import { TaskDescriptionCard } from '@/app/scene/scenarios/[id]/edit/tasks/_components/task-description-card'
import type { EvalRuleConfig } from '@/lib/types/evaluation'
import { ResourceSelector, type ResourceItem } from '@/components/shared/resource-selector'
import { RichTextEditor } from '../../_components/common/rich-text-editor'
import { EditorShell } from '@/components/shared/editor-shell'
import { BatchSelector } from '@/components/shared/batch-selector'
import { MajorSelect } from '@/components/shared/major-select'
import { CoverImageUpload } from '@/components/shared/cover-image-upload'

import CourseNodeTree from './_components/CourseNodeTree'
import PublishCheckPanel from './_components/PublishCheckPanel'

import type { KnowledgePointItem } from '@/lib/types/lesson'
import type { Major } from '@/lib/types/backend'
import {
  type NodeDraft,
  buildNodeSavePayload,
  resolveKnowledgePointIds,
  resolveResourceIds,
} from './_components/lesson-save-utils'
import { reportError } from '@/lib/error-handling'
import { useT } from '@/lib/i18n/locale-provider'
import {
  courseApi,
  courseNodeApi,
  knowledgeApi,
  abilityApi,
  majorApi,
  lessonBatchApi,
  nodeResourceApi,
  resourceLibraryApi,
  fileApi,
} from '@/lib/api'

/* ---------- node editing mode ---------- */

type AddMode = 'upload' | 'clone' | 'quote'

interface GrainCourseOption {
  id: string
  name: string
  description: string
  source: string
  duration: number
  difficulty: number
}

/* ---------- main component ---------- */

function AddSystemPageInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const t = useT()
  const editId = searchParams.get('id')
  const isEdit = !!editId
  const isNewCourse = searchParams.get('new') === 'true'

  /* ========== global config (collapsible) ========== */
  const [globalInfoOpen, setGlobalInfoOpen] = useState(false)
  const [courseId, setCourseId] = useState(editId || '')
  const [courseName, setCourseName] = useState('')
  // 内容（课程）编码：新建自动生成，编辑回填真实编码
  const [contentCode, setContentCode] = useState(
    () => `CNT-${Date.now().toString(36).toUpperCase()}`,
  )
  const [major, setMajor] = useState('')
  const [majors, setMajors] = useState<Major[]>([])
  const [courseDescription, setCourseDescription] = useState('')
  const [coverImage, setCoverImage] = useState('')
  const [coverUploading, setCoverUploading] = useState(false)
  const [batchId, setBatchId] = useState('')
  const [originalStatus, setOriginalStatus] = useState('draft')
  const [courseDescriptionPdf, setCourseDescriptionPdf] = useState<string | null>(null)

  const hasSavedRef = useRef(false)
  const [, setLoadingEdit] = useState(false)

  /* ========== course node tree ========== */
  const [nodes, setNodes] = useState<SystemCourseNode[]>([])
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [nodeModes, setNodeModes] = useState<Record<string, AddMode>>({})
  const [resourcePool, setResourcePool] = useState<ResourceItem[]>([])
  // 当前选中节点 ref：异步回填前校验节点是否已切换
  const selectedNodeIdRef = useRef<string | null>(null)
  useEffect(() => {
    selectedNodeIdRef.current = selectedNodeId
  }, [selectedNodeId])

  /* module 2b: ability points (course-level, for job ability aggregation) */
  const [abilityPoints, setAbilityPoints] = useState<
    { id: string; name: string; code?: string; description?: string }[]
  >([])
  const [abilityPool, setAbilityPool] = useState<
    { id: string; name: string; code?: string; description?: string }[]
  >([])
  // 池渲染期同步到 ref：课程加载 effect 不依赖池变化，避免池加载完成后重跑重置用户编辑
  const abilityPoolRef = useRef(abilityPool)
  useEffect(() => {
    abilityPoolRef.current = abilityPool
  }, [abilityPool])

  /* module 4: per-node assessment */
  const [nodeEvalRuleConfig, setNodeEvalRuleConfig] = useState<EvalRuleConfig | undefined>(
    undefined,
  )
  const nodeEvalMethods = useMemo(
    () => nodeEvalRuleConfig?.evaluationMethods || [],
    [nodeEvalRuleConfig?.evaluationMethods],
  )

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

  useEffect(() => {
    majorApi
      .list({ limit: 1000 })
      .then((res) => {
        setMajors((res.items || []).filter((m: Major) => m.enabled))
      })
      .catch(() => setMajors([]))
  }, [])

  useEffect(() => {
    if (!editId) return
    let cancelled = false
    Promise.resolve()
      .then(() => {
        setLoadingEdit(true)
        return Promise.all([
          courseApi.get(editId),
          courseNodeApi.list({ courseId: editId }),
          nodeResourceApi.list({ courseId: editId, limit: 200 }),
        ])
      })
      .then(([course, nodeRes, resRes]) => {
        if (cancelled) return
        setCourseId(course.id)
        setCourseName(course.name || '')
        if (course.code) setContentCode(course.code)
        if (course.description) setCourseDescription(course.description)
        setCourseDescriptionPdf((course as any).evalData?.descriptionPdf || null)
        if (course.coverImage) setCoverImage(course.coverImage)
        if (course.majorId) setMajor(course.majorId)
        if (course.batchId) setBatchId(course.batchId)
        setOriginalStatus(course.status || 'draft')
        setAbilityPoints(
          (course.abilityPointIds || []).map((id: string) => {
            const found = abilityPoolRef.current.find((a) => a.id === id)
            return found || { id, name: id }
          }),
        )
        setResourcePool(
          (resRes.items || []).map((r: any) => ({
            id: r.id,
            name: r.name,
            type: r.type,
            url: r.url || r.URL,
            description: r.description,
            size: r.size,
            uploadedBy: r.uploadedBy,
            uploadedAt: r.uploadedAt,
          })),
        )
        const loadedNodes = (nodeRes.items || []) as SystemCourseNode[]
        setNodes(loadedNodes)
        if (loadedNodes.length > 0) {
          setSelectedNodeId(loadedNodes[0].id)
        }
        const initialModes: Record<string, AddMode> = {}
        loadedNodes.forEach((n) => {
          if (n.type === 'original') {
            initialModes[n.id] = 'quote'
          } else {
            initialModes[n.id] = 'upload'
          }
        })
        setNodeModes((prev) => ({ ...prev, ...initialModes }))
      })
      .catch((e: any) => {
        if (cancelled) return
        toast({ title: e.message || t('加载课程失败'), variant: 'destructive' })
      })
      .finally(() => {
        if (!cancelled) setLoadingEdit(false)
      })
    return () => {
      cancelled = true
    }
  }, [editId, t])

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
        courseId: courseId || 'course-1',
        parentId,
        name,
        order,
        type: type || 'normal',
        status: 'draft',
        sourceId,
        sourceName,
      }
      setNodes((prev) => [...prev, newNode])
      setSelectedNodeId(newNode.id)
    },
    [courseId],
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
        return prev.filter((n) => !deleteIds.has(n.id))
      })
      if (selectedNodeId === nodeId) {
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
        const orderOffset = position === 'before' ? -0.5 : 0.5
        const newNodes = prev.map((n) => {
          if (n.id === nodeId) {
            return { ...n, parentId: target.parentId, order: target.order + orderOffset }
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
    },
    [],
  )

  /* ========== current node form state ========== */
  const selectedNode = nodes.find((n) => n.id === selectedNodeId)

  /* node editing mode */
  const [showGrainSelector, setShowGrainSelector] = useState(false)
  const [grainSelectorMode, setGrainSelectorMode] = useState<AddMode>('clone')
  const [grainSearch, setGrainSearch] = useState('')
  const [grainSelectedId, setGrainSelectedId] = useState<string | null>(null)
  const [grainCourses, setGrainCourses] = useState<GrainCourseOption[]>([])

  useEffect(() => {
    let cancelled = false
    courseApi
      .list({ type: 'granular' })
      .then((res) => {
        if (cancelled) return
        setGrainCourses(
          (res.items || []).map((c) => ({
            id: c.id,
            name: c.name,
            description: c.description || c.category || '',
            source: c.majorName || c.creatorId || 'unknown',
            duration: c.onlineHours ?? c.nodeCount ?? 0,
            difficulty: c.difficulty ?? 0,
          })),
        )
      })
      .catch(() => {
        if (!cancelled) setGrainCourses([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  const filteredGrainCourses = useMemo(() => {
    const kw = grainSearch.trim()
    if (!kw) return grainCourses
    return grainCourses.filter(
      (g) => g.name.includes(kw) || g.description.includes(kw) || g.source.includes(kw),
    )
  }, [grainSearch, grainCourses])

  /* per-node draft cache */
  const [nodeDrafts, setNodeDrafts] = useState<Record<string, NodeDraft>>({})
  const nodeDraftsRef = useRef(nodeDrafts)
  const nodesRef = useRef(nodes)

  useEffect(() => {
    nodeDraftsRef.current = nodeDrafts
    nodesRef.current = nodes
  }, [nodeDrafts, nodes])

  /* module 1: basic info */

  const [hours, setHours] = useState('')
  const [learningGoal, setLearningGoal] = useState('')
  const [difficulty, setDifficulty] = useState<number>(0)
  const [background, setBackground] = useState('')
  const [detailedDescription, setDetailedDescription] = useState('')
  const [estimatedHours, setEstimatedHours] = useState('')
  const [learningGoalPdf, setLearningGoalPdf] = useState<string | null>(null)

  /* module 2: knowledge points */
  const [knowledgePoints, setKnowledgePoints] = useState<KnowledgePointItem[]>([])
  const [knowledgePool, setKnowledgePool] = useState<KnowledgePointItem[]>([])
  const customKnowledgePointIdsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    let cancelled = false
    knowledgeApi
      .list({ limit: 200 })
      .then((res) => {
        if (cancelled) return
        const customIds = new Set<string>()
        ;(res.items || []).forEach((k) => {
          if (k.sourceType === 'course' && k.sourceId === editId) {
            customIds.add(k.id)
          }
        })
        setKnowledgePool(
          (res.items || []).map((k) => ({
            id: k.id,
            name: k.name,
            code: k.code,
            description: k.description,
            linked: !customIds.has(k.id),
          })),
        )
      })
      .catch(() => {
        if (!cancelled) setKnowledgePool([])
      })
    return () => {
      cancelled = true
    }
  }, [editId])

  /* module 3: resources */
  const [selectedResourceIds, setSelectedResourceIds] = useState<string[]>([])

  /* module 5: evaluation rules */

  const resetFormFromNode = useCallback((node: SystemCourseNode | undefined) => {
    if (!node) {
      setHours('')
      setLearningGoal('')
      setLearningGoalPdf(null)
      setKnowledgePoints([])
      setSelectedResourceIds([])
      setDifficulty(0)
      setNodeEvalRuleConfig(undefined)
      return
    }
    setHours(String(node.duration || ''))
    setLearningGoal(node.teachingGoals || '')
    setLearningGoalPdf((node as any).descriptionPdf || null)
    setDetailedDescription(node.detailedDescription || '')
    setBackground(node.background || '')
    setEstimatedHours(node.estimatedHours ? String(node.estimatedHours) : '')
    setKnowledgePoints(
      (node.knowledgePoints || []).map((kp) => ({
        id: kp.id,
        name: kp.name,
        code: kp.code,
        description: kp.description,
        linked: true,
      })),
    )
    setSelectedResourceIds((node.resources || []).map((r) => r.id))
    setDifficulty(node.difficulty || 0)
    const nodeEvalData = (node.evalData || {}) as {
      methods?: string[]
      evalRuleConfig?: EvalRuleConfig
    }
    setNodeEvalRuleConfig(nodeEvalData.evalRuleConfig)
  }, [])

  /* load draft when selected node changes */
  useEffect(() => {
    const draft = selectedNodeId ? nodeDraftsRef.current[selectedNodeId] : undefined
    const node = selectedNodeId ? nodesRef.current.find((n) => n.id === selectedNodeId) : undefined
    if (draft) {
      setHours(draft.hours)
      setLearningGoal(draft.learningGoal)
      setLearningGoalPdf(draft.learningGoalPdf)
      setDetailedDescription(draft.detailedDescription)
      setBackground(draft.background)
      setEstimatedHours(draft.estimatedHours)
      setKnowledgePoints(draft.knowledgePoints)
      setSelectedResourceIds(draft.selectedResourceIds)
      setDifficulty(draft.difficulty)
      setNodeEvalRuleConfig(draft.evalData?.evalRuleConfig)
    } else if (node) {
      resetFormFromNode(node)
    } else {
      resetFormFromNode(undefined)
    }
  }, [selectedNodeId, resetFormFromNode])

  /* save draft when form changes */
  useEffect(() => {
    if (!selectedNodeId) return
    ;(async () => {
      setNodeDrafts((prev) => ({
        ...prev,
        [selectedNodeId]: {
          hours,
          learningGoal,
          learningGoalPdf,
          detailedDescription,
          background,
          estimatedHours,
          knowledgePoints,
          selectedResourceIds,
          selectedEvalMethods: nodeEvalMethods,
          evalData: {
            methods: nodeEvalMethods,
            evalRuleConfig: nodeEvalRuleConfig,
          },
          difficulty,
        },
      }))
    })()
  }, [
    selectedNodeId,
    hours,
    learningGoal,
    learningGoalPdf,
    detailedDescription,
    background,
    estimatedHours,
    knowledgePoints,
    selectedResourceIds,
    nodeEvalMethods,
    nodeEvalRuleConfig,
    difficulty,
  ])

  /* ---------- node mode selection handlers ---------- */
  const openGrainSelector = useCallback((mode: AddMode) => {
    setGrainSelectorMode(mode)
    setGrainSearch('')
    setGrainSelectedId(null)
    setShowGrainSelector(true)
  }, [])

  const handleSelectUploadMode = useCallback(() => {
    if (!selectedNodeId) return
    setNodeModes((prev) => ({ ...prev, [selectedNodeId]: 'upload' }))
  }, [selectedNodeId, setNodeModes])

  const handleGrainConfirm = useCallback(async () => {
    if (!grainSelectedId || !selectedNodeId) return
    const grain = grainCourses.find((g) => g.id === grainSelectedId)
    if (!grain) return

    const isQuote = grainSelectorMode === 'quote'
    const updates: Partial<SystemCourseNode> = {
      name: grain.name,
      sourceId: grain.id,
      sourceName: grain.name,
      duration: grain.duration,
      difficulty: grain.difficulty,
      teachingGoals: grain.description,
      type: isQuote ? 'original' : 'normal',
    }
    // 记录发起时的目标节点，异步回填前校验节点未切换，防止颗粒课数据写入错误节点
    const confirmNodeId = selectedNodeId
    handleUpdateNode(selectedNodeId, updates)
    setNodeModes((prev) => ({ ...prev, [selectedNodeId]: grainSelectorMode }))
    setHours(String(grain.duration))
    setLearningGoal(grain.description)
    setDifficulty(grain.difficulty)
    setShowGrainSelector(false)

    // Fetch full grain data for KPs and resources
    try {
      const grainFull = await courseApi.get(`${grain.id}?_t=${Date.now()}` as any)
      if (confirmNodeId !== selectedNodeIdRef.current) return
      setLearningGoalPdf((grainFull as any).evalData?.descriptionPdf || null)
      const grainKpIds = new Set((grainFull.knowledgePointIds || []).filter((id: any) => !!id))
      setKnowledgePoints(knowledgePool.filter((k: any) => grainKpIds.has(k.id)))
      const grainResIds = new Set((grainFull.resourceIds || []).filter((id: any) => !!id))
      setSelectedResourceIds(Array.from(grainResIds) as string[])
      if (grainResIds.size > 0 && !isQuote) {
        try {
          const libRes = await resourceLibraryApi.list({ limit: 1000, _nocache: Date.now() } as any)
          const grainResources: ResourceItem[] = ((libRes.items || []) as any[])
            .filter((r: any) => grainResIds.has(r.id))
            .map((r: any) => ({
              id: r.id,
              name: r.name,
              type: r.resourceType || r.type,
              url: r.url,
              description: r.description,
              size: r.fileSize !== undefined ? r.fileSize : r.size,
            }))
          setResourcePool((prev) => {
            const existing = new Set(prev.map((x) => x.id))
            const toAdd = grainResources.filter((r) => !existing.has(r.id))
            return [...prev, ...toAdd]
          })
        } catch (err) {
          reportError(err, '加载颗粒课资源')
        }
      }
    } catch (err) {
      reportError(err, '加载知识点')
      if (confirmNodeId === selectedNodeIdRef.current) {
        setKnowledgePoints([])
        setSelectedResourceIds([])
        setNodeEvalRuleConfig(undefined)
      }
    }
  }, [
    grainSelectedId,
    selectedNodeId,
    grainSelectorMode,
    handleUpdateNode,
    grainCourses,
    setNodeModes,
    knowledgePool,
  ])

  const [saving, setSaving] = useState(false)

  const saveNodes = useCallback(
    async (effectiveCourseId: string) => {
      // 收集当前所有草稿状态
      const allDrafts = { ...nodeDraftsRef.current }

      // 删除在后端存在但本地已删除的节点
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

      // 临时 ID -> 真实 ID
      const idMapping = new Map<string, string>()

      for (const node of sortedNodes) {
        const draft = allDrafts[node.id]
        const isTempId = node.id.startsWith('node-')
        const realParentId = node.parentId
          ? idMapping.get(node.parentId) || node.parentId
          : undefined

        // 知识点
        const kpList = draft?.knowledgePoints || node.knowledgePoints || []
        // 自定义知识点：先持久化创建，用真实 ID 替换临时 ID（否则保存时被过滤丢失）
        const kpIdMapping = new Map<string, string>()
        for (const kp of kpList) {
          if (!kp.id.startsWith('kp-custom-')) continue
          try {
            const created = await knowledgeApi.create({
              name: kp.name,
              code: undefined,
              description: kp.description,
              linked: false,
              granularLessonIds: [],
              sourceType: 'course_node',
            } as any)
            kpIdMapping.set(kp.id, created.id)
          } catch (createErr) {
            // 创建失败即中止保存：继续会导致该知识点被过滤静默丢失（无提示的数据缺失）
            reportError(createErr, '创建自定义知识点')
            throw new Error(t('创建自定义知识点「{name}」失败', { name: kp.name }))
          }
        }
        const knowledgePointIds = resolveKnowledgePointIds(kpList, kpIdMapping)

        // 资源：已入库的资源直接走绑定，本地临时资源等节点创建后再上传
        const resIds = draft?.selectedResourceIds || node.resources?.map((r) => r.id) || []
        const { existingResourceIds, localResources } = resolveResourceIds(
          resIds,
          resourcePool,
          node.id,
        )

        const nodePayload = buildNodeSavePayload({
          node,
          draft,
          effectiveCourseId,
          parentId: realParentId,
          contentCode,
          resolvedKnowledgePointIds: knowledgePointIds,
          existingResourceIds,
        })

        let realNodeId = node.id
        if (isTempId) {
          const created = await courseNodeApi.create(nodePayload)
          realNodeId = created.id
          idMapping.set(node.id, created.id)
        } else {
          await courseNodeApi.update(node.id, nodePayload)
          idMapping.set(node.id, node.id)
        }

        // 上传本地资源并绑定到真实节点
        if (realNodeId && !realNodeId.startsWith('node-')) {
          for (const localRes of localResources) {
            try {
              const created = await nodeResourceApi.create({
                nodeId: realNodeId,
                name: localRes.name,
                type: localRes.type,
                url: localRes.url || '',
                description: localRes.description,
                size: localRes.size != null ? Number(localRes.size) : undefined,
              })
              await nodeResourceApi.bind({ nodeId: realNodeId, resourceId: created.id })
            } catch (err) {
              // 忽略失败，继续
              reportError(err, '绑定节点资源')
            }
          }
        }
      }

      // 刷新 nodes
      const refreshed = await courseNodeApi.list({ courseId: effectiveCourseId })
      const refreshedNodes = refreshed.items || []
      setNodes(refreshedNodes)
      // 重映射选中节点：本地 temp id → 后端真实 id（与 hybrid 版行为一致）
      if (selectedNodeIdRef.current && !refreshedNodes.some((n) => n.id === selectedNodeIdRef.current)) {
        const prevName = nodesRef.current.find((x) => x.id === selectedNodeIdRef.current)?.name
        const created = refreshedNodes.find((n) => n.name === prevName && !n.id.startsWith('node-'))
        if (created) setSelectedNodeId(created.id)
      }
      const newModes: Record<string, AddMode> = {}
      refreshedNodes.forEach((n) => {
        if (n.type !== 'original') newModes[n.id] = 'upload'
      })
      setNodeModes((prev) => ({ ...prev, ...newModes }))
    },
    [resourcePool, setNodes, setNodeModes, contentCode, t],
  )

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      const payload = {
        name: courseName,
        majorId: major || undefined,
        description: courseDescription || undefined,
        coverImage: coverImage || undefined,
        batchId: batchId || undefined,
        type: 'system' as const,
        status: 'draft' as const,
        category: 'system',
        creatorId: '',
        coCreatorIds: [] as string[],
        evalData: {
          descriptionPdf: courseDescriptionPdf || undefined,
        },
        abilityPointIds: abilityPoints.map((a) => a.id),
      }
      let effectiveCourseId = courseId
      if (isEdit && courseId) {
        await courseApi.update(courseId, payload)
        if (originalStatus !== 'draft') {
          await courseApi.saveDraft(courseId)
          setOriginalStatus('draft')
        }
      } else {
        const created = await courseApi.create(payload)
        setCourseId(created.id)
        effectiveCourseId = created.id
      }

      // 保存节点树；成功后才标记已保存（节点失败时 handleFinish 不得跳转）
      if (effectiveCourseId) {
        await saveNodes(effectiveCourseId)
      }
      hasSavedRef.current = true

      toast({ title: t('草稿已保存') })
    } catch (e: any) {
      toast({ title: e.message || t('保存失败'), variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }, [
    courseName,
    major,
    courseDescription,
    courseDescriptionPdf,
    coverImage,
    batchId,
    isEdit,
    courseId,
    originalStatus,
    saveNodes,
    abilityPoints,
    t,
  ])

  const handleFinish = useCallback(async () => {
    await handleSave()
    if (!hasSavedRef.current) return
    router.push('/lesson/admin/system')
  }, [handleSave, router])

  const currentCheckNode: SystemCourseNode | undefined = useMemo(() => {
    if (!selectedNodeId) return undefined
    const node = nodes.find((n) => n.id === selectedNodeId)
    if (!node) return undefined

    // Map knowledgePoints
    const kpForCheck = knowledgePoints.map((kp) => ({
      id: kp.id,
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

    // Map quizzes from current node eval config
    const nodeEvalMethodsForCheck =
      nodeEvalMethods.length > 0
        ? nodeEvalMethods
        : (node.evalData as { methods?: string[] } | undefined)?.methods || []
    const quizzesForCheck =
      nodeEvalMethodsForCheck.length > 0
        ? nodeEvalMethodsForCheck.map((method, i) => ({
            id: `qz-${i}`,
            title:
              String(method) === 'exam' || method === 'homework'
                ? t('作业测评')
                : method === 'question_bank'
                  ? t('题库测验')
                  : method === 'paper'
                    ? t('试卷测验')
                    : t('现场问答'),
            type: method === 'question_bank' ? ('question_bank' as const) : ('paper' as const),
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
  }, [
    selectedNodeId,
    nodes,
    learningGoal,
    hours,
    knowledgePoints,
    selectedResourceIds,
    resourcePool,
    nodeEvalMethods,
    t,
  ])

  return (
    <EditorShell
      mode="fullscreen"
      backText={t('取消')}
      onBack={async () => {
        if (isNewCourse && courseId && !hasSavedRef.current) {
          try {
            await courseApi.delete(courseId)
          } catch (err) {
            reportError(err, '删除未保存的课程草稿')
          }
        }
        router.push('/lesson/admin/system')
      }}
      onSaveDraft={handleSave}
      isSaving={saving}
      onSubmit={handleFinish}
      submitText={t('完成配置')}
      title={isEdit ? t('编辑体系课') : t('新建体系课')}
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
                    {t('全局课程信息')}
                    <span className="text-xs font-normal text-gray-400">
                      {courseName ? t('《{name}》', { name: courseName }) : t('未填写课程名称')}
                    </span>
                    {major && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                        {majors.find((m) => m.id === major)?.name || major}
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
                {!globalInfoOpen && courseDescription && (
                  <p className="text-xs text-gray-400 mt-1 pl-6 text-left line-clamp-2">
                    {courseDescription}
                  </p>
                )}
              </CardHeader>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left: 课程名称 + 课程简介 */}
                <div className="space-y-4 min-w-0">
                  <FormFieldRow label={t('课程名称')} labelClassName="text-xs">
                    <Input
                      value={courseName}
                      onChange={(e) => setCourseName(e.target.value)}
                      placeholder={t('请输入课程名称')}
                      className="h-9 text-sm"
                    />
                  </FormFieldRow>
                  <div className="space-y-1.5">
                    <Label className="text-xs">{t('课程简介')}</Label>
                    <RichTextEditor
                      value={courseDescription}
                      onChange={setCourseDescription}
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
                      imageUrl={coverImage}
                      uploading={coverUploading}
                      label={t('课程封面')}
                      alt={t('课程封面')}
                      onUpload={async (file) => {
                        setCoverUploading(true)
                        try {
                          const res = await fileApi.upload(file)
                          setCoverImage(res.url)
                        } catch (err: any) {
                          toast({ title: err?.message || t('封面上传失败'), variant: 'destructive' })
                        } finally {
                          setCoverUploading(false)
                        }
                      }}
                      onRemove={() => setCoverImage('')}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs">{t('适用专业')}</Label>
                      <MajorSelect
                        value={major}
                        onChange={(v) => setMajor(v || '')}
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
                          const real = {
                            id: created.id,
                            name: created.name,
                            code: created.code,
                            description: created.description,
                          }
                          setAbilityPoints((prev) => [...prev, real])
                          setAbilityPool((prev) => [...prev, real])
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

      {/* ========== Three-column layout ========== */}
      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr_260px] gap-6">
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
          {selectedNode?.type === 'original' && (
            <div className="bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-100 rounded-xl px-4 py-3 mt-5 relative z-20 flex items-center gap-3 shadow-sm">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4 text-blue-600" />
              </div>
              <p className="text-sm text-blue-800">
                {t('当前节点的课程内容将被纳入颗粒课管理体系，支持跨课程复用。')}
              </p>
            </div>
          )}

          <main className="space-y-5 min-w-0">
            {!selectedNode && (
              <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-400">
                <Info className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">{t('请从左侧目录选择一个节点进行编辑')}</p>
              </div>
            )}

            {selectedNode && selectedNode.type !== 'original' && !nodeModes[selectedNode.id] && (
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-[#1890ff]" />
                    {t('选择编辑方式')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                      {
                        key: 'upload' as const,
                        label: t('自定义编排节点资源'),
                        desc: t('自行上传并编辑课程资源'),
                        icon: Upload,
                        color: 'bg-blue-500',
                        border: 'border-blue-500',
                        bg: 'bg-blue-50/50',
                      },
                      {
                        key: 'clone' as const,
                        label: t('克隆颗粒课'),
                        desc: t('复制颗粒课内容生成独立节点'),
                        icon: Copy,
                        color: 'bg-amber-500',
                        border: 'border-amber-500',
                        bg: 'bg-amber-50/50',
                      },
                      {
                        key: 'quote' as const,
                        label: t('引用已有颗粒课'),
                        desc: t('引用颗粒课内容，关联可同步编辑'),
                        icon: Link2,
                        color: 'bg-purple-500',
                        border: 'border-purple-500',
                        bg: 'bg-purple-50/50',
                      },
                    ].map((opt) => (
                      <button
                        key={opt.key}
                        onClick={() =>
                          opt.key === 'upload'
                            ? handleSelectUploadMode()
                            : openGrainSelector(opt.key)
                        }
                        className={cn(
                          'group flex flex-col items-center gap-3 p-5 rounded-xl border-2 bg-white text-center transition-all',
                          'hover:-translate-y-0.5 hover:shadow-md',
                          `hover:${opt.border} hover:${opt.bg}`,
                        )}
                      >
                        <div
                          className={cn(
                            'w-12 h-12 rounded-full flex items-center justify-center text-white shadow-sm transition-transform group-hover:scale-110',
                            opt.color,
                          )}
                        >
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

            {selectedNode && (selectedNode.type === 'original' || nodeModes[selectedNode.id]) && (
              <>
                {(() => {
                  const isQuoteMode =
                    nodeModes[selectedNode?.id || ''] === 'quote' ||
                    selectedNode?.type === 'original'
                  return (
                    <>
                      {/* Module 1: Basic Info */}
                      <Card className="border-0 shadow-sm">
                        <CardHeader className="pb-3 flex flex-row items-center justify-between">
                          <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <BookOpen className="w-4 h-4 text-[#1890ff]" />
                            {t('基本信息配置')}
                            {isQuoteMode && (
                              <span className="text-xs text-gray-400 font-normal ml-2">
                                {t('（引用模式，不可编辑）')}
                              </span>
                            )}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <fieldset
                            disabled={isQuoteMode}
                            className={isQuoteMode ? 'opacity-70' : ''}
                          >
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <FormFieldRow label={t('内容名称')} labelClassName="text-xs">
                                <Input
                                  value={selectedNode?.name || ''}
                                  onChange={(e) => {
                                    if (selectedNodeId) {
                                      handleUpdateNode(selectedNodeId, { name: e.target.value })
                                    }
                                  }}
                                  placeholder={t('请输入内容名称')}
                                  className="h-9 text-sm"
                                />
                              </FormFieldRow>
                              <div className="space-y-1.5">
                                <Label className="text-xs">{t('节点编码')}</Label>
                                <Input
                                  value={contentCode}
                                  disabled
                                  className="h-9 text-sm bg-gray-50 text-gray-500"
                                />
                                <p className="text-[10px] text-gray-400">{t('系统自动生成，不可修改')}</p>
                              </div>
                              <div className="md:col-span-2">
                                <TaskInfoCard
                                  name=""
                                  onNameChange={() => {}}
                                  type="training"
                                  onTypeChange={() => {}}
                                  difficulty={difficulty}
                                  onDifficultyChange={setDifficulty}
                                  hours={parseInt(hours) || 0}
                                  onHoursChange={(v) => setHours(String(v))}
                                  showBackground={false}
                                  showName={false}
                                  showType={false}
                                  hoursLabel={t('课时数')}
                                />
                              </div>
                              <div className="md:col-span-2 space-y-1.5">
                                <Label className="text-xs">{t('节点详细说明')}</Label>
                                <TaskDescriptionCard
                                  description={detailedDescription}
                                  onDescriptionChange={setDetailedDescription}
                                  descriptionPdf={learningGoalPdf}
                                  onDescriptionPdfChange={setLearningGoalPdf}
                                  toast={toast}
                                />
                              </div>
                            </div>
                          </fieldset>
                        </CardContent>
                      </Card>

                      {/* Module 2: Knowledge Points */}
                      <Card className="border-0 shadow-sm">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <GraduationCap className="w-4 h-4 text-[#1890ff]" />
                            {t('关联知识点')}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <fieldset
                            disabled={isQuoteMode}
                            className={isQuoteMode ? 'opacity-70' : ''}
                          >
                            <KnowledgeSelector
                              selected={knowledgePoints}
                              pool={knowledgePool}
                              onChange={setKnowledgePoints}
                              onAddCustom={(name, description) => {
                                const newId = `kp-custom-${Date.now()}`
                                customKnowledgePointIdsRef.current.add(newId)
                                const newKp: KnowledgePointItem = {
                                  id: newId,
                                  name,
                                  description,
                                  linked: false,
                                }
                                setKnowledgePoints((prev) => [...prev, newKp])
                              }}
                            />
                          </fieldset>
                        </CardContent>
                      </Card>

                      {/* Module 3: Resources */}
                      <Card className="border-0 shadow-sm">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <BookOpen className="w-4 h-4 text-[#1890ff]" />
                            {t('配置课程资源')}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <fieldset
                            disabled={isQuoteMode}
                            className={isQuoteMode ? 'opacity-70' : ''}
                          >
                            <ResourceSelector
                              pool={resourcePool}
                              selectedIds={selectedResourceIds}
                              onChange={setSelectedResourceIds}
                              onUpload={(r) => {
                                setResourcePool((prev) =>
                                  prev.some((x) => x.id === r.id) ? prev : [r, ...prev],
                                )
                              }}
                              courseId={courseId || editId || undefined}
                              nodeId={selectedNodeId || undefined}
                            />
                          </fieldset>
                        </CardContent>
                      </Card>

                      {/* Module 4: Node Assessment (always editable) */}
                      <Card className="border-0 shadow-sm">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <ClipboardList className="w-4 h-4 text-[#1890ff]" />
                            {t('配置节点测评')}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <EvalMethodConfigModule
                            value={nodeEvalRuleConfig}
                            onChange={(config) => setNodeEvalRuleConfig(config)}
                            knowledgePoints={knowledgePoints}
                            abilityPoints={abilityPoints}
                            methodTitle={t('配置节点测评方式')}
                            rulesTitle={t('配置节点评价规则')}
                          />
                        </CardContent>
                      </Card>
                    </>
                  )
                })()}
              </>
            )}

            {/* Bottom spacer */}
            <div className="h-12" />
          </main>
        </div>

        {/* Right: Publish Check Panel */}
        <PublishCheckPanel node={currentCheckNode} />
      </div>

      {/* Convert complete nodes to grain course dialog */}

      {/* Grain course selector dialog for clone / quote */}
      <Dialog open={showGrainSelector} onOpenChange={setShowGrainSelector}>
        <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {grainSelectorMode === 'clone'
                ? t('选择要克隆的颗粒课')
                : t('选择要引用的颗粒课')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                value={grainSearch}
                onChange={(e) => setGrainSearch(e.target.value)}
                placeholder={t('搜索颗粒课名称、来源...')}
                className="pl-9 text-sm h-9"
              />
            </div>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {filteredGrainCourses.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">{t('未找到匹配的颗粒课')}</p>
              ) : (
                filteredGrainCourses.map((g) => {
                  const selected = grainSelectedId === g.id
                  return (
                    <button
                      key={g.id}
                      onClick={() => setGrainSelectedId(g.id)}
                      className={cn(
                        'w-full text-left p-3 rounded-lg border transition-all',
                        selected
                          ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-200'
                          : 'border-gray-200 hover:border-gray-300 bg-white',
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div
                            className={cn(
                              'w-5 h-5 rounded-full border flex items-center justify-center',
                              selected ? 'bg-blue-500 border-blue-500' : 'border-gray-300',
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
                      <p className="text-[10px] text-gray-400 mt-0.5 pl-7">
                        {t('{n} 课时', { n: g.duration })}
                      </p>
                    </button>
                  )
                })
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGrainSelector(false)}>
              {t('取消')}
            </Button>
            <Button onClick={handleGrainConfirm} disabled={!grainSelectedId}>
              {t('确认选择')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </EditorShell>
  )
}

export default function AddSystemPage() {
  const t = useT()
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">
          {t('加载中...')}
        </div>
      }
    >
      <AddSystemPageInner />
    </Suspense>
  )
}
