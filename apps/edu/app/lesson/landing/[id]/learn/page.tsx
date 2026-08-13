'use client'

import { useEffect, useRef, useState, useMemo } from 'react'
import { useParams, useSearchParams } from 'next/navigation'

import { evalRuleConfigToMethods } from '@/lib/types'
import { reportError } from '@/lib/error-handling'
import { useT } from '@/lib/i18n/locale-provider'
import { useToast } from '@zhiyu/ui'
import { useAuth } from '@/components/auth-provider'
import {
  EvalMethodSubmitDialog,
  EvalMethodSubmitPayload,
  EvalMethodViewModel,
} from '@/components/shared/eval-method-card'
import {
  LearnPage,
  type LearnPageLabels,
  type LearnUnit,
} from '@/components/shared/learn-page'
import { LESSON_RESOURCE_TYPE_ICONS } from '@/lib/resource-type-constants'
import { HybridModulesView } from '@/components/lesson/student/hybrid-modules-view'

import {
  courseApi,
  courseNodeApi,
  hybridModuleApi,
  nodeEvaluationResultApi,
  knowledgeApi,
} from '@/lib/api'
import { fetchAllPages } from '@zhiyu/api-client'
import type { Course, CourseSnapshot, KnowledgePoint } from '@/lib/types'
import type {
  SystemCourseNode,
  KnowledgePoint as NodeKnowledgePoint,
  NodeResource,
} from '@/lib/types/lesson-source'
import type { NodeEvaluationResult, HybridNodeModule } from '@zhiyu/api-client'
import { examHref, lessonLandingHref } from '@/lib/learn-links'
import {
  courseSnapshotHybridModules,
  courseSnapshotNodes,
  mergeCourseSnapshot,
  snapshotKnowledgeMap,
} from '@/lib/snapshot-converters'

/** 教师/管理员预览 draft 走 live 多接口（文档 8.5）；学生等角色走单次快照 bundle */
const EDITOR_PREVIEW_ROLES = ['teacher', 'school_admin', 'platform_admin']

/* ---------- page ---------- */

export default function LessonLearnPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const id = params.id as string
  const targetNodeId = searchParams.get('node')
  const versionParam = searchParams.get('v') || undefined
  const t = useT()
  const { toast } = useToast()
  const { user, activeRoleCode, loading: authLoading } = useAuth()
  // 教师/管理员预览 draft 走 live（原路径）；学生等角色走单次快照 bundle
  const isEditorPreview = !!activeRoleCode && EDITOR_PREVIEW_ROLES.includes(activeRoleCode)

  // 节点测评结果加载请求序号：快速切换节点时丢弃过期响应
  const nodeResultSeqRef = useRef(0)
  const [course, setCourse] = useState<Course | null>(null)
  const [snapshot, setSnapshot] = useState<CourseSnapshot | null>(null)
  const [nodes, setNodes] = useState<SystemCourseNode[]>([])
  const [loading, setLoading] = useState(true)
  const [activeNodeId, setActiveNodeId] = useState<string | null>(targetNodeId || null)

  const [hybridModules, setHybridModules] = useState<HybridNodeModule[]>([])
  const [myResults, setMyResults] = useState<NodeEvaluationResult[]>([])

  const [knowledgeMap, setKnowledgeMap] = useState<Map<string, KnowledgePoint>>(new Map())
  const [granularCourseMap, setGranularCourseMap] = useState<Map<string, Course>>(new Map())

  // 快照 bundle 路径（学生等）：单次 getSnapshot，节点/混合模块/知识点映射全部从 bundle 组装
  useEffect(() => {
    ;(async () => {
      if (!id || authLoading || isEditorPreview) return
      setLoading(true)
      try {
        const snap = await courseApi.getSnapshot(id, { version: versionParam })
        setSnapshot(snap)
        setCourse(mergeCourseSnapshot(null, snap.course))
        const list = courseSnapshotNodes(snap).sort((a, b) => (a.order || 0) - (b.order || 0))
        setNodes(list)
        setKnowledgeMap(snapshotKnowledgeMap(snap.knowledge_points))
        if (snap.course.type === 'hybrid') {
          setHybridModules(courseSnapshotHybridModules(snap))
        }
        setActiveNodeId((prev) => {
          if (targetNodeId && list.find((n) => n.id === targetNodeId)) {
            return targetNodeId
          }
          if (list.length > 0 && !prev) {
            return list[0].id
          }
          return prev
        })
      } catch {
        setCourse(null)
      } finally {
        setLoading(false)
      }
    })()
  }, [id, authLoading, isEditorPreview, versionParam, targetNodeId])

  // live 路径（教师/管理员预览）：保持原多接口组装
  useEffect(() => {
    ;(async () => {
      if (!id || authLoading || !isEditorPreview) return
      setLoading(true)
      try {
        const c = await courseApi.get(id)
        setCourse(c)
      } catch {
        setCourse(null)
      } finally {
        setLoading(false)
      }
    })()
  }, [id, authLoading, isEditorPreview])

  useEffect(() => {
    if (!id || !course || !isEditorPreview) return
    courseNodeApi
      .list({ courseId: id, limit: 1000 })
      .then((res) => {
        const list = (res.items || []).sort((a, b) => (a.order || 0) - (b.order || 0))
        setNodes(list)
        setActiveNodeId((prev) => {
          if (targetNodeId && list.find((n) => n.id === targetNodeId)) {
            return targetNodeId
          }
          if (list.length > 0 && !prev) {
            return list[0].id
          }
          return prev
        })
      })
      .catch(() => setNodes([]))
    if (course.type === 'hybrid') {
      hybridModuleApi
        .list({ courseId: id, limit: 1000 })
        .then((res) => setHybridModules(res.items || []))
        .catch(() => setHybridModules([]))
    }
  }, [id, course, isEditorPreview, targetNodeId])

  const hybridModulesByNode = useMemo(() => {
    const map = new Map<string, HybridNodeModule[]>()
    hybridModules.forEach((m) => {
      const list = map.get(m.nodeId) || []
      list.push(m)
      map.set(m.nodeId, list)
    })
    return map
  }, [hybridModules])

  const activeNode = useMemo(() => nodes.find((n) => n.id === activeNodeId), [nodes, activeNodeId])

  const evalMethods = useMemo(() => {
    const config = activeNode?.evalData?.evalRuleConfig
    if (!config || !Array.isArray(config.evaluationMethods)) return []
    try {
      return evalRuleConfigToMethods(config as any).filter((m) => m.isEnabled !== false)
    } catch (err) {
      reportError(err, '解析节点测评配置')
      return []
    }
  }, [activeNode])

  useEffect(() => {
    if (!activeNodeId) return
    // 快速切换节点时丢弃过期响应，防止旧节点结果覆盖新节点
    const seq = ++nodeResultSeqRef.current
    nodeEvaluationResultApi
      .list({ nodeId: activeNodeId, evaluateeId: user?.id, limit: 50 })
      .then((res) => {
        if (seq !== nodeResultSeqRef.current) return
        setMyResults(res.items || [])
      })
      .catch((err) => {
        if (seq !== nodeResultSeqRef.current) return
        reportError(err, '加载我的测评结果')
        toast({ title: t('测评结果加载失败'), variant: 'destructive' })
      })
  }, [activeNodeId, user?.id, toast, t])

  useEffect(() => {
    if (!id || !course || !isEditorPreview || course.type === 'hybrid') return
    Promise.all([
      fetchAllPages((page, pageSize) => knowledgeApi.list({ limit: pageSize, offset: page * pageSize })).catch(() => [] as KnowledgePoint[]),
      courseApi
        .list({ type: 'granular', limit: 1000 })
        .catch(() => ({ items: [] as Course[], total: 0 })),
    ])
      .then(([kRes, gRes]) => {
        const kMap = new Map<string, KnowledgePoint>()
        ;(kRes || []).forEach((k) => kMap.set(k.id, k))
        setKnowledgeMap(kMap)
        const gMap = new Map<string, Course>()
        ;(gRes.items || []).forEach((c) => gMap.set(c.id, c))
        setGranularCourseMap(gMap)
      })
      .catch((err) => {
        reportError(err, '加载知识点/颗粒课数据')
        toast({ title: t('部分数据加载失败'), variant: 'destructive' })
      })
  }, [id, course, isEditorPreview, toast, t])

  /* ---------- hybrid eval submit state ---------- */
  const [hybridSubmitOpen, setHybridSubmitOpen] = useState(false)
  const [hybridActiveModuleKey, setHybridActiveModuleKey] = useState<string | null>(null)
  const [hybridActiveMethod, setHybridActiveMethod] = useState<EvalMethodViewModel | null>(null)
  const [hybridSubmittedKeys, setHybridSubmittedKeys] = useState<Set<string>>(new Set())

  const toEvalMethodView = (m: any): EvalMethodViewModel => ({
    methodKey: m.methodKey,
    weight: m.weight,
    resourceConfig: m.resourceConfig,
    reviewSteps: m.reviewSteps,
    evalPoints: m.evalPoints,
  })

  const evalMethodViews = useMemo(() => evalMethods.map(toEvalMethodView), [evalMethods])

  const units: LearnUnit[] = useMemo(
    () =>
      nodes.map((n) => ({
        id: n.id,
        name: n.name,
        difficulty: n.difficulty ?? 3,
        estimatedHours: n.estimatedHours,
        background: n.background,
        descriptionPdf: n.descriptionPdf,
        description: n.detailedDescription,
        knowledgePoints: ((n.knowledgePoints || []) as NodeKnowledgePoint[]).map(
          (kp) =>
            knowledgeMap.get(kp.id) ||
            ({ ...kp, granularLessonIds: [] } as unknown as KnowledgePoint),
        ),
        resources: (n.resources || []) as NodeResource[],
      })),
    [nodes, knowledgeMap],
  )

  const labels: LearnPageLabels = {
    notFoundText: t('课程不存在'),
    backText: t('返回课程列表'),
    sidebarExpandTitle: t('展开节点列表'),
    sidebarCollapseTitle: t('折叠节点列表'),
    emptyTitle: t('选择一个节点开始学习'),
    emptyHint: t('从左侧节点列表中点击节点'),
    descriptionTitle: t('节点说明书'),
    descriptionPdfName: t('节点说明书 PDF'),
    noDescriptionText: t('暂无节点说明书'),
    evalTitle: t('节点测评'),
    noEvalMethodsText: t('该节点暂未设置评价方式'),
    formatUnitCount: (n) => t('{n} 个节点', { n }),
    formatUnitTooltip: (idx, name, diffLabel, hours) =>
      `${idx + 1}. ${name} (${t(diffLabel)}, ${hours}h)`,
    formatEvaluatedCount: (evaluated, total) =>
      t('已评分 {evaluated}/{total}', { evaluated, total }),
    formatAggregateScore: (score, max) => t('综合 {score}/{max}', { score, max }),
    formatKnowledgeCode: (code) => t('编码：{n}', { n: code }),
  }

  const getExamHref = (m: EvalMethodViewModel) => {
    const isExamMethod = ['paper', 'question_bank', 'quiz'].includes(m.methodKey)
    if (!isExamMethod) return undefined
    const examId = m.methodKey === 'paper' ? m.resourceConfig?.paperId : m.resourceConfig?.examId
    const usageId = m.resourceConfig?.usageId
    if (!examId) return undefined
    // 考试作答页只消费 node/method/usage/course；试卷版本由对端按 usage.examVersion 解析
    return examHref(examId, { node: activeNodeId, method: m.methodKey, usage: usageId, course: id })
  }

  // 页面加载使用的课程版本（URL ?v= 优先，缺省取 bundle/live 主表版本）；提交时作 expectedVersion 提示
  const pageVersion = versionParam || snapshot?.course.version || course?.version || undefined

  const handleSubmitMethod = async (payload: EvalMethodSubmitPayload) => {
    if (!user?.id || !activeNodeId) return
    await nodeEvaluationResultApi.submit({
      nodeId: activeNodeId,
      expectedVersion: pageVersion,
      methodKey: payload.methodKey,
      evaluateeId: user.id,
      maxScore: payload.maxScore,
      subjectiveContent: payload.subjectiveContent,
    })
  }

  const handleHybridEvalAction = (moduleKey: string, method: EvalMethodViewModel) => {
    setHybridActiveModuleKey(moduleKey)
    setHybridActiveMethod(method)
    setHybridSubmitOpen(true)
  }

  const handleHybridSubmit = async (payload: EvalMethodSubmitPayload) => {
    if (!user?.id || !activeNodeId || !hybridActiveModuleKey) return
    const compositeKey = `${hybridActiveModuleKey}:${payload.methodKey}`
    await nodeEvaluationResultApi.submit({
      nodeId: activeNodeId,
      expectedVersion: pageVersion,
      methodKey: compositeKey,
      evaluateeId: user.id,
      maxScore: payload.maxScore,
      subjectiveContent: payload.subjectiveContent,
    })
    setHybridSubmittedKeys((prev) => new Set([...Array.from(prev), compositeKey]))
  }

  const isHybrid = course?.type === 'hybrid'

  return (
    <LearnPage
      loading={loading}
      notFound={!course}
      entityName={course?.name}
      detailHref={lessonLandingHref(id, pageVersion)}
      backHref="/lesson/landing"
      units={units}
      activeUnitId={activeNodeId}
      onSelectUnit={setActiveNodeId}
      labels={labels}
      evalMethods={evalMethodViews}
      evalResults={myResults}
      getExamHref={getExamHref}
      onSubmit={handleSubmitMethod}
      granularCourseMap={granularCourseMap}
      resourceTypeIcons={LESSON_RESOURCE_TYPE_ICONS}
      activeIndicatorGlowClass="shadow-[0_0_8px_rgba(245,158,11,0.4)]"
      hideRightPanel={isHybrid}
      mainOverride={
        isHybrid && activeNode ? (
          <HybridModulesView
            node={activeNode}
            modules={hybridModulesByNode.get(activeNode.id) || []}
            courseId={id}
            myResults={myResults}
            submittedKeys={hybridSubmittedKeys}
            onEvalAction={handleHybridEvalAction}
          />
        ) : undefined
      }
      renderExtraDialogs={(helpers) =>
        hybridActiveMethod && (
          <EvalMethodSubmitDialog
            open={hybridSubmitOpen}
            onOpenChange={setHybridSubmitOpen}
            method={{
              ...hybridActiveMethod,
              label: t('提交测评'),
            }}
            uploading={helpers.uploading}
            onFileUpload={helpers.onFileUpload}
            onSubmit={handleHybridSubmit}
            onSubmitted={() => {
              if (hybridActiveModuleKey) {
                setHybridSubmittedKeys((prev) =>
                  new Set([...Array.from(prev), `${hybridActiveModuleKey}:${hybridActiveMethod.methodKey}`]),
                )
              }
            }}
          />
        )
      }
      expandSidebar={isHybrid}
    />
  )
}
