'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useAuth } from '@/components/auth-provider'
import {
  knowledgeApi,
  abilityApi,
  resourceLibraryApi,
  examApi,
  taskEvaluationApi,
  userManagementApi,
  scenarioApi,
  taskApi,
  courseApi,
} from '@/lib/api'
import type { KnowledgePointItem, Course } from '@/lib/types/lesson'
import type { ResourceItem } from '@/components/shared/resource-selector'
import type { RubricScheme } from '@/components/evaluation-rules/types'
import { setLoadedExams, type LoadedExam } from '../shared-defs'

export type { RubricScheme }

export interface TaskKnowledgePointItem extends KnowledgePointItem {
  creatorId?: string
  granularLessons?: string[]
}

export interface TaskResourceItem extends ResourceItem {
  knowledgePoints?: string[]
  knowledgePointIds?: string[]
  extraData?: Record<string, unknown>
  uploadedBy?: string
  uploadedAt?: string
  thumbnail?: string
  size?: string | number
}

export interface TaskStateRubricRefs {
  randomDrawRubricId?: string | null
  reviewRubricId?: string | null
  outcomeRubricId?: string | null
  homeworkRubricId?: string | null
}

export interface LoadDatasetsContext {
  taskStatesRef?: React.MutableRefObject<Record<string, TaskStateRubricRefs>>
  setExistingScenario?: React.Dispatch<React.SetStateAction<unknown>>
  scenarioDataRef?: React.MutableRefObject<unknown>
}

export interface UseTaskDatasetsResult {
  knowledgePoints: TaskKnowledgePointItem[]
  setKnowledgePoints: React.Dispatch<React.SetStateAction<TaskKnowledgePointItem[]>>
  learningResources: TaskResourceItem[]
  setLearningResources: React.Dispatch<React.SetStateAction<TaskResourceItem[]>>
  abilityPoints: unknown[]
  setAbilityPoints: React.Dispatch<React.SetStateAction<unknown[]>>
  granularLessons: Course[]
  setGranularLessons: React.Dispatch<React.SetStateAction<Course[]>>
  users: unknown[]
  setUsers: React.Dispatch<React.SetStateAction<unknown[]>>
  rubricLibrary: RubricScheme[]
  setRubricLibrary: React.Dispatch<React.SetStateAction<RubricScheme[]>>
  positionAbilityBindings: unknown[]
  setPositionAbilityBindings: React.Dispatch<React.SetStateAction<unknown[]>>
  scenarios: unknown[]
  setScenarios: React.Dispatch<React.SetStateAction<unknown[]>>
  cloneDataVersion: number
  bumpCloneDataVersion: () => void
  customKnowledgePointIds: Set<string>
  setCustomKnowledgePointIds: React.Dispatch<React.SetStateAction<Set<string>>>
  markKnowledgePointCustom: (id: string, persisted?: boolean) => void
  customResourceIds: Set<string>
  setCustomResourceIds: React.Dispatch<React.SetStateAction<Set<string>>>
  markResourceCustom: (id: string) => void
  persistedCustomKnowledgePointIds: React.MutableRefObject<Set<string>>
  customAbilityPointIds: React.MutableRefObject<Set<string>>
  loadDatasets: (keys: string[], ctx?: LoadDatasetsContext) => Promise<void>
}

export function useTaskDatasets(): UseTaskDatasetsResult {
  const { user } = useAuth()
  const userId = user?.id

  const [knowledgePoints, setKnowledgePoints] = useState<TaskKnowledgePointItem[]>([])
  const [learningResources, setLearningResources] = useState<TaskResourceItem[]>([])
  const [abilityPoints, setAbilityPoints] = useState<unknown[]>([])
  const [granularLessons, setGranularLessons] = useState<Course[]>([])
  const [users, setUsers] = useState<unknown[]>([])
  const [rubricLibrary, setRubricLibrary] = useState<RubricScheme[]>([])
  const [positionAbilityBindings, setPositionAbilityBindings] = useState<unknown[]>([])
  const [scenarios, setScenarios] = useState<unknown[]>([])
  const [cloneDataVersion, setCloneDataVersion] = useState(0)
  const [customKnowledgePointIds, setCustomKnowledgePointIds] = useState<Set<string>>(new Set())
  const [customResourceIds, setCustomResourceIds] = useState<Set<string>>(new Set())
  const persistedCustomKnowledgePointIds = useRef<Set<string>>(new Set())
  const customAbilityPointIds = useRef<Set<string>>(new Set())
  const loadedDatasetsRef = useRef<Set<string>>(new Set())

  // Sync persisted custom knowledge points whenever auth/user becomes available.
  // The initial data load may run before useAuth resolves user, leaving the
  // custom set empty. This recompute ensures KPs created by the current user are
  // marked as custom without waiting for a full reload.
  useEffect(() => {
    if (!userId || knowledgePoints.length === 0) return
    setCustomKnowledgePointIds((prev: Set<string>) => {
      const next = new Set(prev)
      let changed = false
      knowledgePoints.forEach((kp) => {
        if (kp.creatorId && kp.creatorId === userId && !next.has(kp.id)) {
          next.add(kp.id)
          persistedCustomKnowledgePointIds.current.add(kp.id)
          changed = true
        }
      })
      return changed ? next : prev
    })
  }, [userId, knowledgePoints])

  const markKnowledgePointCustom = useCallback((id: string, persisted = false) => {
    setCustomKnowledgePointIds((prev) => {
      if (prev.has(id)) return prev
      const next = new Set(prev)
      next.add(id)
      return next
    })
    if (persisted) {
      persistedCustomKnowledgePointIds.current.add(id)
    }
  }, [])

  const markResourceCustom = useCallback((id: string) => {
    setCustomResourceIds((prev) => {
      if (prev.has(id)) return prev
      const next = new Set(prev)
      next.add(id)
      return next
    })
  }, [])

  const bumpCloneDataVersion = useCallback(() => {
    setCloneDataVersion((v) => v + 1)
  }, [])

  const loadDatasets = useCallback(
    async (keys: string[], ctx: LoadDatasetsContext = {}) => {
      const { taskStatesRef, setExistingScenario, scenarioDataRef } = ctx
      const pending = keys.filter((k) => !loadedDatasetsRef.current.has(k))
      if (pending.length === 0) return
      pending.forEach((k) => loadedDatasetsRef.current.add(k))

      const jobs = pending.map(async (key) => {
        try {
          if (key === 'knowledge') {
            const [kpRes, glRes] = await Promise.all([
              knowledgeApi.list({ limit: 1000 }),
              courseApi.list({ type: 'granular', limit: 1000 }),
            ])
            const nextKp: TaskKnowledgePointItem[] = []
            const creatorCustomIds = new Set<string>()
            ;(kpRes.items || []).forEach((kp: unknown) => {
              const item = kp as TaskKnowledgePointItem & { granularLessonIds?: string[] }
              nextKp.push({
                ...item,
                granularLessons: item.granularLessonIds || item.granularLessons || [],
              })
              if (item.creatorId && item.creatorId === userId) {
                creatorCustomIds.add(item.id)
              }
            })
            setKnowledgePoints(nextKp)
            setCustomKnowledgePointIds((prev) => {
              const next = new Set(prev)
              creatorCustomIds.forEach((id) => next.add(id))
              return next
            })
            setGranularLessons((glRes.items || []) as Course[])
          } else if (key === 'ability') {
            const apRes = await abilityApi.list({ limit: 1000 })
            setAbilityPoints(apRes.items || [])
            const scenarioData = scenarioDataRef?.current as
              { careerPositionId?: string } | undefined
            const positionId = scenarioData?.careerPositionId
            if (positionId) {
              try {
                const bindingsRes = await abilityApi.listBindings({ careerPositionId: positionId })
                setPositionAbilityBindings(bindingsRes.items || [])
              } catch {
                setPositionAbilityBindings([])
              }
            }
          } else if (key === 'resources') {
            const resRes = await resourceLibraryApi.list({ limit: 1000 })
            setLearningResources(
              (resRes.items || []).map((res: unknown) => {
                const item = res as TaskResourceItem & {
                  resourceType?: string
                  fileSize?: number | string
                  type?: string
                }
                return {
                  ...item,
                  type: item.resourceType || item.type,
                  size: item.fileSize !== undefined ? String(item.fileSize) : item.size,
                }
              }),
            )
          } else if (key === 'evaluation') {
            const [examRes, rubricRes] = await Promise.all([
              examApi.list({ limit: 1000 }),
              taskEvaluationApi
                .listTemplates({ limit: 200 })
                .catch(() => ({ items: [] as unknown[], total: 0 })),
            ])
            setLoadedExams((examRes.items || []) as LoadedExam[])
            const mapTemplate = (rt: unknown): RubricScheme => {
              const item = rt as {
                id: string
                name: string
                types?: RubricScheme['types']
                description?: string
                mode?: string
                data?: {
                  points?: RubricScheme['points']
                  scoreRuleItems?: RubricScheme['scoreRuleItems']
                }
                isDeleted?: boolean
              }
              return {
                id: item.id,
                name: item.name,
                types: item.types || [],
                desc: item.description || '',
                points: item.mode === 'rubric' ? item.data?.points || [] : [],
                mode: (item.mode || 'rubric') as RubricScheme['mode'],
                scoreRuleItems: item.mode === 'score_rule' ? item.data?.scoreRuleItems : undefined,
                isDeleted: item.isDeleted || false,
              }
            }
            setRubricLibrary((rubricRes.items || []).map(mapTemplate))
            // 补齐任务引用但已从库中删除的量规模板
            const referencedTemplateIds = new Set<string>()
            const taskStates = taskStatesRef?.current || {}
            Object.values(taskStates).forEach((ts) => {
              if (ts.randomDrawRubricId) referencedTemplateIds.add(ts.randomDrawRubricId)
              if (ts.reviewRubricId) referencedTemplateIds.add(ts.reviewRubricId)
              if (ts.outcomeRubricId) referencedTemplateIds.add(ts.outcomeRubricId)
              if (ts.homeworkRubricId) referencedTemplateIds.add(ts.homeworkRubricId)
            })
            const existingIds = new Set(
              (rubricRes.items || []).map((rt: unknown) => (rt as { id: string }).id),
            )
            const missingIds = Array.from(referencedTemplateIds).filter(
              (id) => id && !existingIds.has(id),
            )
            if (missingIds.length > 0) {
              const fetched = await Promise.all(
                missingIds.map((id) => taskEvaluationApi.getTemplate(id).catch(() => null)),
              )
              const newTemplates = fetched.filter(Boolean).map(mapTemplate)
              if (newTemplates.length > 0) {
                setRubricLibrary((prev) => [...prev, ...newTemplates])
              }
            }
          } else if (key === 'users') {
            const userRes = await userManagementApi.list({ limit: 1000 })
            setUsers(userRes.items || [])
            // 补齐头部共建人姓名（初始挂载时以 id 占位）
            if (setExistingScenario) {
              const nameMap = new Map(
                (userRes.items || []).map((u: unknown) => [
                  (u as { id: string }).id,
                  (u as { name: string }).name,
                ]),
              )
              setExistingScenario((prev: unknown) =>
                prev
                  ? {
                      ...(prev as Record<string, unknown>),
                      coBuilders: (
                        (prev as { coBuilders?: { id: string; name: string }[] }).coBuilders || []
                      ).map((cb) => ({
                        ...cb,
                        name: nameMap.get(cb.id) || cb.id,
                      })),
                    }
                  : prev,
              )
            }
          } else if (key === 'clone') {
            // 克隆对话框候选：全部场景及其任务
            try {
              const allScenariosRes = await scenarioApi.list({ limit: 1000 })
              const allTasksRes = await taskApi.list({ limit: 1000 })
              const scenarioNameMap = new Map<string, string>()
              const scenarioMetaMap = new Map<
                string,
                { creatorId: string; coBuilderIds: string[]; status: string }
              >()
              for (const s of allScenariosRes.items) {
                scenarioNameMap.set(s.id, s.name)
                scenarioMetaMap.set(s.id, {
                  creatorId: s.creatorId,
                  coBuilderIds: s.coBuilderIds || [],
                  status: s.status,
                })
              }
              const tasksByScenarioId = new Map<string, unknown[]>()
              for (const t of allTasksRes.items) {
                const sName = scenarioNameMap.get(t.scenarioId) || '未知场景'
                const sMeta = scenarioMetaMap.get(t.scenarioId) || {
                  creatorId: '',
                  coBuilderIds: [],
                  status: '',
                }
                const enhanced = {
                  ...t,
                  scenarioName: sName,
                  scenarioCreatorId: sMeta.creatorId,
                  scenarioCoBuilderIds: sMeta.coBuilderIds,
                  scenarioStatus: sMeta.status,
                }
                if (!tasksByScenarioId.has(t.scenarioId)) tasksByScenarioId.set(t.scenarioId, [])
                tasksByScenarioId.get(t.scenarioId)!.push(enhanced)
              }
              const nextScenarios: unknown[] = []
              const currentScenario = scenarioDataRef?.current
              if (currentScenario) nextScenarios.push(currentScenario)
              for (const s of allScenariosRes.items) {
                const tasksForScenario = tasksByScenarioId.get(s.id) || []
                if (tasksForScenario.length > 0) {
                  nextScenarios.push({ ...s, tasks: tasksForScenario })
                }
              }
              setScenarios(nextScenarios)
              setCloneDataVersion((v) => v + 1)
            } catch {
              // 克隆候选加载失败不影响主流程
            }
          }
        } catch (err) {
          console.error(`加载数据集 ${key} 失败`, err)
        }
      })
      await Promise.all(jobs)
    },
    [userId],
  )

  return {
    knowledgePoints,
    setKnowledgePoints,
    learningResources,
    setLearningResources,
    abilityPoints,
    setAbilityPoints,
    granularLessons,
    setGranularLessons,
    users,
    setUsers,
    rubricLibrary,
    setRubricLibrary,
    positionAbilityBindings,
    setPositionAbilityBindings,
    scenarios,
    setScenarios,
    cloneDataVersion,
    bumpCloneDataVersion,
    customKnowledgePointIds,
    setCustomKnowledgePointIds,
    markKnowledgePointCustom,
    customResourceIds,
    setCustomResourceIds,
    markResourceCustom,
    persistedCustomKnowledgePointIds,
    customAbilityPointIds,
    loadDatasets,
  }
}
