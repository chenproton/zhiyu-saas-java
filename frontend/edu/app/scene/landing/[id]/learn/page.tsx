'use client'

import { useEffect, useState, useMemo } from 'react'
import { useParams, useSearchParams } from 'react-router'

import { Target } from 'lucide-react'

import { reportError } from '@/lib/error-handling'
import { fetchAllPages } from '@zhiyu/api-client'
import { useToast } from '@zhiyu/ui'
import { useAuth } from '@/components/auth-provider'
import { useT } from '@/lib/i18n/locale-provider'
import type { EvalMethodSubmitPayload, EvalMethodViewModel } from '@/components/shared/eval-method-card'
import {
  LearnPage,
  type LearnPageLabels,
  type LearnUnit,
} from '@/components/shared/learn-page'
import { SCENE_RESOURCE_TYPE_ICONS } from '@/lib/resource-type-constants'

import {
  scenarioApi,
  taskApi,
  resourceLibraryApi,
  knowledgeApi,
  abilityApi,
  taskEvaluationApi,
  evaluationResultApi,
  courseApi,
} from '@/lib/api'
import type {
  Scenario,
  ScenarioTask,
  ScenarioSnapshot,
  TaskResource,
  KnowledgePoint,
  AbilityPoint,
  TaskEvaluationMethod,
  SceneEvaluationResult,
  Course,
} from '@/lib/types'
import { examHref, sceneLandingHref } from '@/lib/learn-links'
import {
  mergeScenarioSnapshot,
  scenarioSnapshotEvalMethods,
  scenarioSnapshotTask,
  snapshotAbilityMap,
  snapshotKnowledgeMap,
  snapshotResourceMap,
} from '@/lib/snapshot-converters'

/** 教师/管理员预览 draft 走 live 多接口（文档 8.5）；学生等角色走单次快照 bundle */
const EDITOR_PREVIEW_ROLES = ['teacher', 'school_admin', 'platform_admin']

/* ---------- page ---------- */

export default function SceneLearnPage() {
  const params = useParams()
  const [searchParams] = useSearchParams()
  const id = params.id as string
  const targetTaskId = searchParams.get('task')
  const versionParam = searchParams.get('v') || undefined
  const { toast } = useToast()
  const { user, activeRoleCode, loading: authLoading } = useAuth()
  const t = useT()
  // 教师/管理员预览 draft 走 live（原路径）；学生等角色走单次快照 bundle
  const isEditorPreview = !!activeRoleCode && EDITOR_PREVIEW_ROLES.includes(activeRoleCode)

  const [scenario, setScenario] = useState<Scenario | null>(null)
  const [snapshot, setSnapshot] = useState<ScenarioSnapshot | null>(null)
  const [tasks, setTasks] = useState<ScenarioTask[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTaskId, setActiveTaskId] = useState<string | null>(targetTaskId || null)

  const [resourceMap, setResourceMap] = useState<Map<string, TaskResource>>(new Map())
  const [knowledgeMap, setKnowledgeMap] = useState<Map<string, KnowledgePoint>>(new Map())
  const [abilityMap, setAbilityMap] = useState<Map<string, AbilityPoint>>(new Map())
  const [granularCourseMap, setGranularCourseMap] = useState<Map<string, Course>>(new Map())
  const [liveEvalMethods, setEvalMethods] = useState<TaskEvaluationMethod[]>([])
  const [myResults, setMyResults] = useState<SceneEvaluationResult[]>([])

  // 快照 bundle 路径（学生等）：单次 getSnapshot，任务/知识点/能力点/资源映射全部从 bundle 组装
  useEffect(() => {
    if (!id || authLoading || isEditorPreview) return
    ;(async () => {
      setLoading(true)
      try {
        const snap = await scenarioApi.getSnapshot(id, { version: versionParam })
        setSnapshot(snap)
        setScenario(mergeScenarioSnapshot(null, snap.scenario))
        const tList = snap.scenario_tasks.map(scenarioSnapshotTask)
        setTasks(tList)
        setResourceMap(snapshotResourceMap(snap.resource_library))
        setKnowledgeMap(snapshotKnowledgeMap(snap.knowledge_points))
        setAbilityMap(snapshotAbilityMap(snap.ability_points))
        setActiveTaskId((prev) => {
          if (targetTaskId && tList.find((t) => t.id === targetTaskId)) {
            return targetTaskId
          }
          if (tList.length > 0 && !prev) {
            return tList[0].id
          }
          return prev
        })
      } catch {
        setScenario(null)
      } finally {
        setLoading(false)
      }
    })()
  }, [id, authLoading, isEditorPreview, versionParam, targetTaskId])

  // live 路径（教师/管理员预览）：保持原多接口组装
  useEffect(() => {
    ;(async () => {
      if (!id || authLoading || !isEditorPreview) return
      setLoading(true)
      try {
        const s = await scenarioApi.get(id)
        setScenario(s)
      } catch {
        setScenario(null)
      } finally {
        setLoading(false)
      }
    })()
  }, [id, authLoading, isEditorPreview])

  useEffect(() => {
    if (!id || !scenario || !isEditorPreview) return
    fetchAllPages((page, pageSize) =>
      taskApi.list({ scenarioId: id, limit: pageSize, offset: page * pageSize }),
    )
      .then((tList) => {
        setTasks(tList)
        setActiveTaskId((prev) => {
          if (targetTaskId && tList.find((t) => t.id === targetTaskId)) {
            return targetTaskId
          }
          if (tList.length > 0 && !prev) {
            return tList[0].id
          }
          return prev
        })
      })
      .catch(() => setTasks([]))
  }, [id, scenario, isEditorPreview, targetTaskId])

  useEffect(() => {
    if (!id || !scenario || !isEditorPreview) return
    fetchAllPages((page, pageSize) => resourceLibraryApi.list({ limit: pageSize, offset: page * pageSize }))
      .then((items) => {
        const rMap = new Map<string, TaskResource>()
        items.forEach((r: any) => {
          rMap.set(r.id, {
            ...r,
            type: r.resourceType || r.type,
            size: r.fileSize !== undefined ? String(r.fileSize) : r.size,
          } as TaskResource)
        })
        setResourceMap(rMap)
      })
      .catch(() => setResourceMap(new Map()))

    Promise.all([
      fetchAllPages((page, pageSize) =>
        knowledgeApi.list({ limit: pageSize, offset: page * pageSize }),
      ).catch(() => [] as KnowledgePoint[]),
      fetchAllPages((page, pageSize) =>
        abilityApi.list({ limit: pageSize, offset: page * pageSize }),
      ).catch(() => [] as AbilityPoint[]),
      fetchAllPages((page, pageSize) =>
        courseApi.list({ type: 'granular', limit: pageSize, offset: page * pageSize }),
      ).catch(() => [] as Course[]),
    ])
      .then(([kList, aList, gList]) => {
        const kMap = new Map<string, KnowledgePoint>()
        ;(kList || []).forEach((k) => kMap.set(k.id, k))
        setKnowledgeMap(kMap)
        const aMap = new Map<string, AbilityPoint>()
        ;(aList || []).forEach((a) => aMap.set(a.id, a))
        setAbilityMap(aMap)
        const gMap = new Map<string, Course>()
        ;(gList || []).forEach((c) => gMap.set(c.id, c))
        setGranularCourseMap(gMap)
      })
      .catch((err) => {
        reportError(err, '加载知识点/能力点数据')
        toast({ title: t('部分数据加载失败'), variant: 'destructive' })
      })
  }, [id, scenario, isEditorPreview, toast, t])

  // live 路径：切任务时按任务懒加载测评方法
  useEffect(() => {
    ;(async () => {
      if (!activeTaskId || !isEditorPreview) return
      setEvalMethods([])
      try {
        const res = await taskEvaluationApi.listMethods(activeTaskId)
        setEvalMethods(
          (res.methods || []).filter((m: TaskEvaluationMethod) => m.isEnabled !== false),
        )
      } catch {
        setEvalMethods([])
      }
    })()
  }, [activeTaskId, isEditorPreview])

  // bundle 路径：测评方法从快照按 config_id 组装（替代 listMethods 活读）
  const bundleEvalMethods = useMemo(
    () =>
      !isEditorPreview && snapshot && activeTaskId
        ? scenarioSnapshotEvalMethods(snapshot, activeTaskId)
        : [],
    [snapshot, activeTaskId, isEditorPreview],
  )
  const evalMethods = isEditorPreview ? liveEvalMethods : bundleEvalMethods

  useEffect(() => {
    if (!activeTaskId) return
    evaluationResultApi
      .list({ taskId: activeTaskId, evaluateeId: user?.id, limit: 50 })
      .then((res) => setMyResults(res.items || []))
      .catch((err) => {
        reportError(err, '加载我的评估结果')
        toast({ title: t('评估结果加载失败'), variant: 'destructive' })
      })
  }, [activeTaskId, user?.id, toast, t])

  const activeTask = useMemo(() => tasks.find((t) => t.id === activeTaskId), [tasks, activeTaskId])

  const toEvalMethodView = (m: TaskEvaluationMethod): EvalMethodViewModel => ({
    methodKey: m.methodKey,
    weight: m.weight,
    resourceConfig: m.resourceConfig,
    reviewSteps: m.reviewSteps,
    evalPoints: m.evalPoints,
  })

  const evalMethodViews = useMemo(() => evalMethods.map(toEvalMethodView), [evalMethods])

  const units: LearnUnit[] = useMemo(
    () =>
      tasks.map((task) => ({
        id: task.id,
        name: task.name,
        difficulty: task.difficulty,
        estimatedHours: task.estimatedHours,
        background: task.background,
        descriptionPdf: task.descriptionPdf,
        description: task.detailedDescription || task.description,
        knowledgePoints: (task.knowledgePointIds || [])
          .map((kid) => knowledgeMap.get(kid))
          .filter(Boolean) as KnowledgePoint[],
        abilityPoints: (task.abilityPointIds || [])
          .map((aid) => abilityMap.get(aid))
          .filter(Boolean) as AbilityPoint[],
        resources: (task.resourceIds || [])
          .map((rid) => resourceMap.get(rid))
          .filter(Boolean) as TaskResource[],
        taskType: task.taskType,
      })),
    [tasks, knowledgeMap, abilityMap, resourceMap],
  )

  const labels: LearnPageLabels = {
    notFoundText: t('场景不存在'),
    backText: t('返回场景列表'),
    sidebarExpandTitle: t('展开任务列表'),
    sidebarCollapseTitle: t('折叠任务列表'),
    emptyTitle: t('选择一个任务开始学习'),
    emptyHint: t('从左侧任务列表中点击任务'),
    descriptionTitle: t('任务说明书'),
    descriptionPdfName: t('任务说明书 PDF'),
    noDescriptionText: t('暂无任务说明书'),
    evalTitle: t('任务测评'),
    noEvalMethodsText: t('该任务暂未设置评价方式'),
    formatUnitCount: (n) => t('{n} 个任务', { n }),
    formatUnitTooltip: (idx, name, diffLabel, hours) => `${idx + 1}. ${name} (${diffLabel}, ${hours}h)`,
    formatEvaluatedCount: (evaluated, total) => t('已评分 {e}/{t}', { e: evaluated, t: total }),
    formatAggregateScore: (score, max) => t('综合 {s}/{m}', { s: score, m: max }),
    formatKnowledgeCode: (code) => t('编码：{code}', { code }),
  }

  const getExamHref = (m: EvalMethodViewModel) => {
    const isExamMethod = ['paper', 'question_bank', 'quiz'].includes(m.methodKey)
    if (!isExamMethod) return undefined
    const examId = m.methodKey === 'paper' ? m.resourceConfig?.paperId : m.resourceConfig?.examId
    const usageId = m.resourceConfig?.usageId
    if (!examId) return undefined
    // 考试作答页只消费 task/scene/method/usage；试卷版本由对端按 usage.examVersion 解析
    return examHref(examId, { task: activeTaskId, scene: id, method: m.methodKey, usage: usageId })
  }

  // 页面加载使用的场景版本（URL ?v= 优先，缺省取 bundle/live 主表版本）；提交时作 expectedVersion 提示
  const pageVersion = versionParam || snapshot?.scenario.version || scenario?.version || undefined

  const handleSubmitMethod = async (payload: EvalMethodSubmitPayload) => {
    if (!user?.id || !activeTaskId) return
    try {
      await evaluationResultApi.submit({
        taskId: activeTaskId,
        sceneId: id,
        expectedVersion: pageVersion,
        methodKey: payload.methodKey,
        evaluateeId: user.id,
        maxScore: payload.maxScore,
        subjectiveContent: payload.subjectiveContent,
      })
    } catch (err) {
      toast({
        variant: 'destructive',
        title: t('提交失败'),
        description: err instanceof Error ? err.message : t('请稍后重试'),
      })
      throw err
    }
  }

  return (
    <LearnPage
      loading={loading}
      notFound={!scenario}
      entityName={scenario?.name}
      detailHref={sceneLandingHref(id, pageVersion)}
      backHref="/scene/landing"
      units={units}
      activeUnitId={activeTaskId}
      onSelectUnit={setActiveTaskId}
      labels={labels}
      evalMethods={evalMethodViews}
      evalResults={myResults}
      getExamHref={getExamHref}
      onSubmit={handleSubmitMethod}
      granularCourseMap={granularCourseMap}
      resourceTypeIcons={SCENE_RESOURCE_TYPE_ICONS}
      activeIndicatorGlowClass="shadow-[0_0_8px_rgba(6,182,212,0.4)]"
      headerUnitBadges={
        activeTask && (
          <span className="flex items-center gap-1.5 text-xs font-medium text-gray-500 bg-primary/5 px-3 py-1.5 rounded-full border border-primary/10">
            <Target className="w-3.5 h-3.5 text-primary" />{' '}
            {activeTask.taskType === 'assessment' ? t('考核') : t('训练')}
          </span>
        )
      }
      renderUnitBadges={(unit) => (
        <span
          className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
          style={{
            backgroundColor: unit.taskType === 'assessment' ? '#fef2f2' : 'color-mix(in srgb, var(--primary) 8%, white)',
            color: unit.taskType === 'assessment' ? '#dc2626' : 'var(--primary)',
          }}
        >
          {unit.taskType === 'assessment' ? t('考核') : t('训练')}
        </span>
      )}
      previewModalBackdrop={false}
    />
  )
}
