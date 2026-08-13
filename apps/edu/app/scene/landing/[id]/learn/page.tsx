'use client'

import { useEffect, useState, useMemo } from 'react'
import { useParams, useSearchParams } from 'next/navigation'

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
  TaskResource,
  KnowledgePoint,
  AbilityPoint,
  TaskEvaluationMethod,
  SceneEvaluationResult,
  Course,
} from '@/lib/types'

/* ---------- page ---------- */

export default function SceneLearnPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const id = params.id as string
  const targetTaskId = searchParams.get('task')
  const { toast } = useToast()
  const { user } = useAuth()
  const t = useT()

  const [scenario, setScenario] = useState<Scenario | null>(null)
  const [tasks, setTasks] = useState<ScenarioTask[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTaskId, setActiveTaskId] = useState<string | null>(targetTaskId || null)

  const [resourceMap, setResourceMap] = useState<Map<string, TaskResource>>(new Map())
  const [knowledgeMap, setKnowledgeMap] = useState<Map<string, KnowledgePoint>>(new Map())
  const [abilityMap, setAbilityMap] = useState<Map<string, AbilityPoint>>(new Map())
  const [granularCourseMap, setGranularCourseMap] = useState<Map<string, Course>>(new Map())
  const [evalMethods, setEvalMethods] = useState<TaskEvaluationMethod[]>([])
  const [myResults, setMyResults] = useState<SceneEvaluationResult[]>([])

  useEffect(() => {
    ;(async () => {
      if (!id) return
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
  }, [id])

  useEffect(() => {
    if (!id || !scenario) return
    taskApi
      .list({ scenarioId: id, limit: 1000 })
      .then((res) => {
        const tList = res.items || []
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
  }, [id, scenario, targetTaskId])

  useEffect(() => {
    if (!id || !scenario) return
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
      knowledgeApi.list({ limit: 1000 }).catch(() => ({ items: [] as KnowledgePoint[], total: 0 })),
      abilityApi.list({ limit: 1000 }).catch(() => ({ items: [] as AbilityPoint[], total: 0 })),
      courseApi
        .list({ type: 'granular', limit: 1000 })
        .catch(() => ({ items: [] as Course[], total: 0 })),
    ])
      .then(([kRes, aRes, gRes]) => {
        const kMap = new Map<string, KnowledgePoint>()
        ;(kRes.items || []).forEach((k) => kMap.set(k.id, k))
        setKnowledgeMap(kMap)
        const aMap = new Map<string, AbilityPoint>()
        ;(aRes.items || []).forEach((a) => aMap.set(a.id, a))
        setAbilityMap(aMap)
        const gMap = new Map<string, Course>()
        ;(gRes.items || []).forEach((c) => gMap.set(c.id, c))
        setGranularCourseMap(gMap)
      })
      .catch((err) => {
        reportError(err, '加载知识点/能力点数据')
        toast({ title: t('部分数据加载失败'), variant: 'destructive' })
      })
  }, [id, scenario, toast, t])

  useEffect(() => {
    ;(async () => {
      if (!activeTaskId) return
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
  }, [activeTaskId])

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
    return `/evaluation/landing/exams/${examId}?task=${activeTaskId}&scene=${id}&method=${m.methodKey}&usage=${usageId || ''}`
  }

  const handleSubmitMethod = async (payload: EvalMethodSubmitPayload) => {
    if (!user?.id || !activeTaskId) return
    try {
      await evaluationResultApi.submit({
        taskId: activeTaskId,
        sceneId: id,
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
      detailHref={`/scene/landing/${id}`}
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
