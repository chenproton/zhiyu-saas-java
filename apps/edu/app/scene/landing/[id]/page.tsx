'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
  PlayCircle,
  ListChecks,
  FolderOpen,
  Lightbulb,
  Target,
  GitBranch,
  Layers,
  Clock,
  BarChart3,
  BookOpen,
  Users,
  Eye,
  Share2,
  Sparkles,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatFileSize } from '@/lib/utils'
import { reportError } from '@/lib/error-handling'
import { useToast } from '@zhiyu/ui'
import {
  scenarioApi,
  taskApi,
  resourceLibraryApi,
  knowledgeApi,
  abilityApi,
  courseApi,
} from '@/lib/api'
import type {
  Scenario,
  ScenarioTask,
  TaskResource,
  KnowledgePoint,
  AbilityPoint,
  Course,
} from '@/lib/types'
import {
  SCENE_DIFFICULTY,
  RESOURCE_TYPE_SHORT_LABELS,
  EVAL_METHOD_LABELS,
  EVAL_METHOD_COLORS,
} from '@/lib/types'
import { Footer } from '@/components/portal/footer'
import { MobileAccessDialog } from '@/components/portal/mobile-access-dialog'
import { SceneKnowledgeGraph } from '@/components/scene/student/knowledge-graph'
import {
  ResourcePreviewModal,
  usePreviewResources,
} from '@/components/shared/resource-preview-modal'
import { formatDate } from '@/lib/format-utils'
import { coverGradientFor } from '@/lib/cover-gradients'
import { FavoriteButton } from '@/components/shared/favorite-button'
import { MobileTabDropdown } from '@/components/shared/mobile-tab-dropdown'
import { useT } from '@/lib/i18n/locale-provider'

const TABS = [
  { value: 'tasks', label: '任务概览', icon: ListChecks },
  { value: 'resources', label: '资源中心', icon: FolderOpen },
  { value: 'abilities', label: '能力模型', icon: Lightbulb },
  { value: 'evaluation', label: '评价标准', icon: Target },
  { value: 'knowledge', label: '知识图谱', icon: GitBranch },
]

interface AbilitiesTabProps {
  tasks: ScenarioTask[]
  abilityMap: Map<string, AbilityPoint>
  uniqueAbilityIds: Set<string>
  abilityDomainMap: Map<string, string>
}

const ATTRIBUTE_COLORS: Record<string, [string, string]> = {
  知识: ['#3b82f6', '#60a5fa'],
  素养: ['#f59e0b', '#fbbf24'],
  技能: ['#10b981', '#34d399'],
}

function AbilitiesTab({
  tasks,
  abilityMap,
  uniqueAbilityIds,
  abilityDomainMap,
}: AbilitiesTabProps) {
  const t = useT()
  const [selectedAbility, setSelectedAbility] = useState<{
    ap: AbilityPoint
    taskNames: string[]
  } | null>(null)

  const groupedByDomain = useMemo(() => {
    const groups = new Map<string, { ap: AbilityPoint; taskNames: string[] }[]>()

    tasks.forEach((task) => {
      task.abilityPointIds?.forEach((aid) => {
        const ap = abilityMap.get(aid)
        if (!ap) return
        const domain = abilityDomainMap.get(aid) || t('其他')
        const list = groups.get(domain) || []
        const existing = list.find((item) => item.ap.id === ap.id)
        if (existing) {
          if (!existing.taskNames.includes(task.name)) existing.taskNames.push(task.name)
        } else {
          list.push({ ap, taskNames: [task.name] })
        }
        groups.set(domain, list)
      })
    })

    return Array.from(groups.entries())
      .map(([name, items]) => ({ name, items }))
      .filter((g) => g.items.length > 0)
  }, [tasks, abilityMap, abilityDomainMap, t])

  if (uniqueAbilityIds.size === 0) {
    return (
      <div className="text-center py-16 text-slate-400">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-50 flex items-center justify-center">
          <Lightbulb className="w-8 h-8 opacity-40" />
        </div>
        <div className="text-[15px] font-medium text-slate-600">{t('暂无考查能力点')}</div>
        <div className="text-[13px] mt-1">{t('该场景暂未关联能力点')}</div>
      </div>
    )
  }

  const groupLabel = t('能力领域')

  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-r from-primary/5 to-primary/10 rounded-xl p-5 border border-primary/10">
        <div className="flex items-center gap-2 text-primary font-bold mb-2">
          <Sparkles className="w-5 h-5" />
          {t('能力模型说明')}
        </div>
        <p className="text-sm text-[#475569]">
          {t('本场景基于真实企业场景标准，拆解为若干{group}，每个{group}下关联对应的能力点，帮助学生明确学习目标。', {
            group: groupLabel,
          })}
        </p>
      </div>

      <div className="text-sm text-[#64748b] mb-2">
        {t('共 {domains} 个{group}，{abilities} 个能力点', {
          domains: groupedByDomain.length,
          group: groupLabel,
          abilities: uniqueAbilityIds.size,
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {groupedByDomain.map(({ name, items }) => (
          <div key={name} className="border border-[#f5f5f4] rounded-xl overflow-hidden bg-white">
            <div className="bg-primary/5 px-4 py-3 font-medium text-primary flex items-center gap-2 text-sm">
              <Target className="w-4 h-4" />
              {name}
            </div>
            <div className="p-3 max-h-[300px] overflow-y-auto">
              {items.map(({ ap, taskNames }, i) => (
                <div
                  key={`${ap.id}-${i}`}
                  className="flex items-start justify-between py-2 px-2 border-b border-[#f5f5f5] last:border-b-0 rounded hover:bg-primary/5 cursor-pointer transition-colors gap-2"
                  onClick={() => setSelectedAbility({ ap, taskNames })}
                >
                  <div className="flex flex-col min-w-0 gap-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm text-[#1f2937] truncate">{ap.name}</span>
                      {ap.attributes?.length > 0 && (
                        <div className="flex flex-wrap gap-1 shrink-0">
                          {ap.attributes.map((attr) => {
                            const colors = ATTRIBUTE_COLORS[attr] || ['#64748b', '#94a3b8']
                            return (
                              <span
                                key={attr}
                                className="text-[10px] px-1.5 py-0.5 rounded border text-white"
                                style={{
                                  background: `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`,
                                  borderColor: colors[0],
                                }}
                              >
                                {attr}
                              </span>
                            )
                          })}
                        </div>
                      )}
                    </div>
                    <span className="text-[10px] text-[#94a3b8] truncate font-mono">
                      ID：{ap.code || ap.id}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {selectedAbility && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setSelectedAbility(null)}
        >
          <div
            className="bg-white rounded-2xl w-[520px] max-w-[95vw] p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="text-base font-semibold text-[#1f2937]">{t('能力点详情')}</div>
              <button
                className="text-[#94a3b8] hover:text-[#1f2937]"
                onClick={() => setSelectedAbility(null)}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="bg-white border border-[#e2e8f0] rounded-xl p-4 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-primary to-primary/60" />
              <div className="text-sm font-semibold text-[#1f2937] mb-3">
                {selectedAbility.ap.name}
              </div>
              {(selectedAbility.ap.code || selectedAbility.ap.id) && (
                <div className="text-xs text-[#94a3b8] mb-2 font-mono">
                  ID：{selectedAbility.ap.code || selectedAbility.ap.id}
                </div>
              )}
              <div className="space-y-2 text-xs">
                <div>
                  <span className="font-medium text-[#94a3b8]">{t('能力属性：')}</span>
                  <span className="text-[#475569]">
                    {selectedAbility.ap.attributes?.length
                      ? selectedAbility.ap.attributes.join('、')
                      : t('未配置')}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-[#94a3b8]">{t('关联任务：')}</span>
                  <span className="text-[#475569]">{selectedAbility.taskNames.join('、')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

interface EvaluationTabProps {
  tasks: ScenarioTask[]
  totalEvalConfigs: number
}

function EvaluationTab({ tasks, totalEvalConfigs }: EvaluationTabProps) {
  const t = useT()
  if (totalEvalConfigs === 0) {
    return (
      <div className="text-center py-16 text-slate-400">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-50 flex items-center justify-center">
          <Target className="w-8 h-8 opacity-40" />
        </div>
        <div className="text-[15px] font-medium text-slate-600">{t('暂未配置评价标准')}</div>
        <div className="text-[13px] mt-1">{t('该场景暂未设置评价方式')}</div>
      </div>
    )
  }

  const tasksWithEval = tasks.filter((t) => t.evalData?.evaluationMethods?.length > 0)

  return (
    <div>
      <div className="text-sm text-slate-500 mb-4">
        {t('共 {n} 个评价配置', { n: totalEvalConfigs })}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {tasksWithEval.map((task) => {
          const ed = task.evalData!
          const methods: string[] = ed.evaluationMethods || []
          const weights: Record<string, number> = ed.methodWeights || {}

          return (
            <div
              key={task.id}
              className="bg-white rounded-xl border border-slate-200 p-4 hover:border-primary/30 hover:shadow-md transition-all"
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/70 text-white flex items-center justify-center text-xs font-bold shrink-0">
                  <Target className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-800 truncate">{task.name}</div>
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                    style={{
                      backgroundColor: task.taskType === 'assessment' ? '#fef2f2' : 'color-mix(in srgb, var(--primary) 8%, white)',
                      color: task.taskType === 'assessment' ? '#dc2626' : 'var(--primary)',
                    }}
                  >
                    {task.taskType === 'assessment' ? t('考核') : t('训练')}
                  </span>
                </div>
              </div>

              {methods.length > 0 && (
                <div className="mb-3">
                  <div className="text-[11px] text-slate-400 mb-2 font-medium">
                    {t('评价方式')}
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {methods.map((m) => (
                      <span
                        key={m}
                        className="text-[11px] px-2 py-0.5 rounded-full font-medium text-white"
                        style={{ backgroundColor: EVAL_METHOD_COLORS[m] || '#94a3b8' }}
                      >
                        {EVAL_METHOD_LABELS[m] || m}
                      </span>
                    ))}
                  </div>
                  {methods.map((m) => (
                    <div key={m} className="flex items-center gap-2 mb-1.5">
                      <span className="text-[11px] text-slate-500 w-16 shrink-0 truncate">
                        {EVAL_METHOD_LABELS[m] || m}
                      </span>
                      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.round(weights[m] || 0)}%`,
                            backgroundColor: EVAL_METHOD_COLORS[m] || '#94a3b8',
                          }}
                        />
                      </div>
                      <span className="text-[11px] font-semibold text-slate-500 w-8 text-right">
                        {Math.round(weights[m] || 0)}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function SceneDetailPage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const { toast } = useToast()
  const t = useT()
  const tabsRef = useRef<HTMLDivElement>(null)

  const taskTypeLabels: Record<string, string> = {
    assessment: t('考核'),
    training: t('训练'),
  }

  const [scenario, setScenario] = useState<Scenario | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('tasks')

  const [tasks, setTasks] = useState<ScenarioTask[]>([])
  const [allResourceMap, setAllResourceMap] = useState<Map<string, TaskResource>>(new Map())
  const [knowledgeMap, setKnowledgeMap] = useState<Map<string, KnowledgePoint>>(new Map())
  const [courseMap, setCourseMap] = useState<Map<string, Course>>(new Map())
  const [abilityMap, setAbilityMap] = useState<Map<string, AbilityPoint>>(new Map())
  const [abilityDomainMap, setAbilityDomainMap] = useState<Map<string, string>>(new Map())
  const [previewResources, addPreviewResource, removePreviewResource] = usePreviewResources()
  const [mobileAccessOpen, setMobileAccessOpen] = useState(false)

  useEffect(() => {
    if (!id) return
    ;(async () => {
      setLoading(true)
      try {
        const sc = await scenarioApi.get(id)
        setScenario(sc)
      } catch {
        setScenario(null)
      } finally {
        setLoading(false)
      }
    })()
  }, [id])

  useEffect(() => {
    if (!id || !scenario) return

    // TODO: 列表接口后端上限 200，以下映射类数据超限时会缺失，需服务端分页或按需拉取
    taskApi
      .list({ scenarioId: id, limit: 200 })
      .then((res) => {
        const taskList = res.items || []
        setTasks(taskList)
      })
      .catch(() => setTasks([]))

    resourceLibraryApi
      .list({ limit: 200 })
      .then((res) => {
        const rMap = new Map<string, TaskResource>()
        ;(res.items || []).forEach((r: any) => {
          rMap.set(r.id, {
            ...r,
            type: r.resourceType || r.type,
            size: r.fileSize !== undefined ? String(r.fileSize) : r.size,
          } as TaskResource)
        })
        setAllResourceMap(rMap)
      })
      .catch(() => setAllResourceMap(new Map()))

    Promise.all([
      knowledgeApi.list({ limit: 200 }).catch(() => ({ items: [], total: 0 })),
      abilityApi.list({ limit: 200 }).catch(() => ({ items: [], total: 0 })),
      courseApi.list({ type: 'granular', limit: 1000 }).catch(() => ({ items: [], total: 0 })),
    ])
      .then(([kRes, aRes, cRes]) => {
        const kMap = new Map<string, KnowledgePoint>()
        ;(kRes.items || []).forEach((k) => kMap.set(k.id, k))
        setKnowledgeMap(kMap)
        const aMap = new Map<string, AbilityPoint>()
        ;(aRes.items || []).forEach((a) => aMap.set(a.id, a))
        setAbilityMap(aMap)
        const cMap = new Map<string, Course>()
        ;(cRes.items || []).forEach((c) => cMap.set(c.id, c))
        setCourseMap(cMap)
      })
      .catch((err) => {
        reportError(err, '加载知识点/能力点/颗粒课数据')
        toast({ title: t('部分数据加载失败'), variant: 'destructive' })
      })
  }, [id, scenario, toast, t])

  useEffect(() => {
    if (!scenario?.careerPositionId) return
    abilityApi
      .listBindings({ careerPositionId: scenario.careerPositionId })
      .then((res) => {
        const map = new Map<string, string>()
        ;(res.items || []).forEach((b) => {
          if (b.domain && b.abilityPointId) map.set(b.abilityPointId, b.domain)
        })
        setAbilityDomainMap(map)
      })
      .catch(() => setAbilityDomainMap(new Map()))
  }, [scenario?.careerPositionId])

  const assessmentHours = useMemo(
    () =>
      tasks
        .filter((t) => t.taskType === 'assessment')
        .reduce((s, t) => s + (t.estimatedHours || 0), 0),
    [tasks],
  )
  const trainingHours = useMemo(
    () =>
      tasks
        .filter((t) => t.taskType === 'training')
        .reduce((s, t) => s + (t.estimatedHours || 0), 0),
    [tasks],
  )
  const totalHours = assessmentHours + trainingHours
  const totalResources = useMemo(() => {
    let count = 0
    tasks.forEach((t) => {
      count += (t.resourceIds || []).length
    })
    return count
  }, [tasks])
  const uniqueAbilityIds = useMemo(() => {
    const ids = new Set<string>()
    tasks.forEach((t) => t.abilityPointIds?.forEach((aid) => ids.add(aid)))
    return ids
  }, [tasks])
  const totalEvalConfigs = useMemo(() => {
    let count = 0
    tasks.forEach((t) => {
      if (t.evalData?.evaluationMethods) {
        count += (t.evalData.evaluationMethods as string[]).length
      }
    })
    return count
  }, [tasks])

  function getTaskResources(task: ScenarioTask): TaskResource[] {
    return (task.resourceIds || [])
      .map((id) => allResourceMap.get(id))
      .filter(Boolean) as TaskResource[]
  }

  const diff = SCENE_DIFFICULTY[scenario?.difficulty ?? 3] || SCENE_DIFFICULTY[3]

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-[#f8fafc]">
        <Skeleton className="h-[320px] w-full" />
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 w-full flex-1">
          <Skeleton className="h-[500px] w-full rounded-xl" />
        </div>
        <Footer className="mt-auto" />
      </div>
    )
  }

  if (!scenario) {
    return (
      <div className="min-h-screen flex flex-col bg-[#f8fafc]">
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
          <div className="w-20 h-20 mb-5 rounded-3xl bg-slate-100 flex items-center justify-center">
            <Layers className="w-10 h-10 opacity-40" />
          </div>
          <div className="text-lg font-semibold text-slate-600">{t('场景不存在或暂未公开')}</div>
          <Link
            href="/scene/landing"
            className="text-primary hover:text-primary mt-3 text-sm font-medium"
          >
            {t('返回场景列表')}
          </Link>
        </div>
        <Footer className="mt-auto" />
      </div>
    )
  }

  const coverStyle = scenario.coverImage
    ? { backgroundImage: `url('${scenario.coverImage}')` }
    : { background: coverGradientFor(scenario.id) }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'tasks':
        return (
          <div>
            {tasks.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-50 flex items-center justify-center">
                  <ListChecks className="w-8 h-8 opacity-40" />
                </div>
                <div className="text-[15px] font-medium text-slate-600">{t('暂无任务')}</div>
                <div className="text-[13px] mt-1">{t('该场景暂未配置任务')}</div>
              </div>
            ) : (
              <div className="space-y-3">
                {tasks.map((task, idx) => {
                  const taskRes = getTaskResources(task)
                  const taskAbs = task.abilityPointIds?.length || 0
                  const taskKs = task.knowledgePointIds?.length || 0
                  return (
                    <div
                      key={task.id}
                      className="group bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:border-primary/30 transition-all"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-4 sm:p-5">
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-primary/70 text-white flex items-center justify-center text-sm font-bold shrink-0 shadow-lg shadow-primary/25">
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5">
                            <div className="text-[15px] font-semibold text-slate-800 truncate">
                              {task.name}
                            </div>
                            <span
                              className="text-[11px] px-2.5 py-0.5 rounded-full font-medium shrink-0 border"
                              style={{
                                backgroundColor:
                                  task.taskType === 'assessment' ? '#fef2f2' : 'color-mix(in srgb, var(--primary) 8%, white)',
                                color: task.taskType === 'assessment' ? '#dc2626' : 'var(--primary)',
                                borderColor: task.taskType === 'assessment' ? '#fecaca' : '#bfdbfe',
                              }}
                            >
                              {taskTypeLabels[task.taskType] || task.taskType}
                            </span>
                            {task.code && (
                              <span className="text-[11px] text-slate-400 shrink-0">
                                {task.code}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              {t('{n} 课时', { n: task.estimatedHours || 0 })}
                            </span>
                            <span className="flex items-center gap-1">
                              <BarChart3 className="w-3.5 h-3.5" />
                              Lv.{task.difficulty}
                            </span>
                            {taskRes.length > 0 && (
                              <span className="flex items-center gap-1">
                                <FolderOpen className="w-3.5 h-3.5" />
                                {t('{n} 个资源', { n: taskRes.length })}
                              </span>
                            )}
                            {taskAbs > 0 && (
                              <span className="flex items-center gap-1">
                                <Lightbulb className="w-3.5 h-3.5" />
                                {t('{n} 个能力点', { n: taskAbs })}
                              </span>
                            )}
                            {taskKs > 0 && (
                              <span className="flex items-center gap-1">
                                <GitBranch className="w-3.5 h-3.5" />
                                {t('{n} 个知识点', { n: taskKs })}
                              </span>
                            )}
                          </div>
                          {(task.description || task.detailedDescription) && (
                            <p className="text-xs text-slate-400 mt-2 line-clamp-2 leading-relaxed">
                              {task.detailedDescription || task.description}
                            </p>
                          )}
                          {task.evalData?.evaluationMethods?.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {(task.evalData!.evaluationMethods as string[]).map((m) => (
                                <span
                                  key={m}
                                  className="text-[10px] px-2 py-0.5 rounded-full font-medium text-white"
                                  style={{ backgroundColor: EVAL_METHOD_COLORS[m] || '#94a3b8' }}
                                >
                                  {EVAL_METHOD_LABELS[m] || m}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <Link
                          href={`/scene/landing/${id}/learn?task=${task.id}`}
                          className="shrink-0 sm:ml-auto"
                        >
                          <Button
                            size="sm"
                            className="rounded-lg h-9 px-4 text-xs bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 hover:-translate-y-0.5 transition-all w-full sm:w-auto"
                          >
                            <PlayCircle className="w-3.5 h-3.5 mr-1" /> {t('开始任务')}
                          </Button>
                        </Link>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )

      case 'resources':
        return (
          <div>
            <div className="text-sm text-slate-500 mb-4">
              {t('共 {n} 个资源', { n: totalResources })}
            </div>
            {totalResources === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-50 flex items-center justify-center">
                  <FolderOpen className="w-8 h-8 opacity-40" />
                </div>
                <div className="text-[15px] font-medium text-slate-600">{t('暂无关联资源')}</div>
                <div className="text-[13px] mt-1">{t('该场景暂未配置学习资源')}</div>
              </div>
            ) : (
              <div className="space-y-5">
                {tasks.map((task) => {
                  const resources = getTaskResources(task)
                  if (resources.length === 0) return null
                  return (
                    <div key={task.id}>
                      <div className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-primary" />
                        {task.name}
                        <span className="text-xs text-slate-400 font-normal">
                          ({resources.length})
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {resources.map((r) => {
                          const typeColors: Record<string, string> = {
                            document: 'bg-primary/5 text-primary border-primary/10',
                            video: 'bg-amber-50 text-amber-600 border-amber-100',
                            link: 'bg-purple-50 text-purple-600 border-purple-100',
                            file: 'bg-emerald-50 text-emerald-600 border-emerald-100',
                          }
                          return (
                            <div
                              key={r.id}
                              className="group bg-slate-50 rounded-xl p-3.5 border border-slate-100 hover:border-primary/30 hover:shadow-md hover:-translate-y-0.5 transition-all"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-semibold text-slate-800 mb-1.5 truncate">
                                    {r.name}
                                  </div>
                                  <div className="flex items-center gap-2 text-xs text-slate-400">
                                    <span
                                      className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${typeColors[r.type] || 'bg-slate-100 text-slate-500 border-slate-200'}`}
                                    >
                                      {RESOURCE_TYPE_SHORT_LABELS[r.type] || r.type}
                                    </span>
                                    {r.size && <span>{formatFileSize(r.size)}</span>}
                                  </div>
                                </div>
                                {r.url && (
                                  <button
                                    onClick={() => addPreviewResource(r)}
                                    className="shrink-0 mt-0.5 w-7 h-7 rounded-lg bg-primary/5 text-primary hover:bg-primary/10 flex items-center justify-center transition-colors"
                                    title={t('预览资源')}
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )

      case 'abilities':
        return (
          <AbilitiesTab
            tasks={tasks}
            abilityMap={abilityMap}
            uniqueAbilityIds={uniqueAbilityIds}
            abilityDomainMap={abilityDomainMap}
          />
        )

      case 'evaluation':
        return <EvaluationTab tasks={tasks} totalEvalConfigs={totalEvalConfigs} />

      case 'knowledge':
        return (
          <SceneKnowledgeGraph
            scenario={scenario}
            tasks={tasks}
            knowledgeMap={knowledgeMap}
            courseMap={courseMap}
          />
        )

      default:
        return null
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col bg-[#f8fafc]"
      style={{
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
      }}
    >
      {/* Header */}
      <div className="bg-white border-b border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-5">
          <div className="flex items-center gap-2 mb-5 text-sm text-slate-500">
            <button
              onClick={() => router.back()}
              className="hover:text-primary transition-colors flex items-center gap-1 cursor-pointer shrink-0"
            >
              <span className="w-5 h-5 rounded-md bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-primary/5 hover:text-primary transition-colors">
                ←
              </span>{' '}
              {t('返回上一页')}
            </button>
            <span className="text-slate-300 shrink-0">/</span>
            <span className="text-slate-800 font-medium truncate min-w-0">{scenario.name}</span>
          </div>

          <div className="flex flex-col lg:flex-row gap-6 items-stretch">
            {/* Left: Cover + Info */}
            <div className="flex-1 flex">
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.04)] w-full">
                <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 p-4 sm:p-6">
                  <div
                    className="w-full sm:w-[280px] h-[190px] rounded-2xl bg-cover bg-center flex items-center justify-center shrink-0 self-stretch shadow-[0_12px_40px_rgba(0,0,0,0.15)] relative overflow-hidden"
                    style={coverStyle}
                  >
                    {!scenario.coverImage && (
                      <Layers
                        className="w-16 h-16 text-white/85 drop-shadow-md relative z-10"
                        strokeWidth={1.5}
                      />
                    )}
                    <span className="absolute bottom-3 right-3 z-10 bg-[#0f172a]/40 backdrop-blur-sm text-white px-2.5 py-1 rounded-lg text-[11px] border border-white/20">
                      {scenario.id.slice(0, 8)}
                    </span>
                  </div>

                  <div className="flex-1 flex flex-col min-w-0">
                    <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                      <div className="flex items-center gap-2.5 flex-wrap min-w-0">
                        <h1 className="text-[26px] font-bold text-slate-900 truncate">
                          {scenario.name}
                        </h1>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600 font-medium shrink-0 border border-slate-200">
                          v{scenario.version}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-slate-400 mb-3">
                      <span className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5" />{' '}
                        {t('创建人：{id}', { id: scenario.creatorId.slice(0, 8) })}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" /> {t('更新于 {date}', { date: formatDate(scenario.updatedAt) })}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Eye className="w-3.5 h-3.5" /> {t('浏览 {n} 次', { n: scenario.viewCount ?? 0 })}
                      </span>
                    </div>

                    {scenario.background && (
                      <p className="text-sm text-slate-600 leading-relaxed mb-4 line-clamp-3">
                        {scenario.background}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs">
                      {scenario.industryNames && scenario.industryNames.length > 0 && (
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 shrink-0">{t('面向行业：')}</span>
                          <div className="flex flex-wrap gap-1.5">
                            {scenario.industryNames.slice(0, 3).map((n) => (
                              <span
                                key={n}
                                className="px-2.5 py-0.5 rounded-full text-[11px] bg-orange-50 text-orange-700 border border-orange-100 font-medium"
                              >
                                {n}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 shrink-0">{t('难度等级：')}</span>
                        <span
                          className="px-2.5 py-0.5 rounded-full text-[11px] border font-medium"
                          style={{
                            backgroundColor: diff.color + '15',
                            color: diff.color,
                            borderColor: diff.color + '30',
                          }}
                        >
                          {diff.label}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3 mt-auto pt-5">
                      <Link href={`/scene/landing/${id}/learn`}>
                        <Button className="rounded-xl px-7 h-11 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white font-semibold text-sm shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:-translate-y-0.5 transition-all">
                          <PlayCircle className="w-4 h-4 mr-1.5" /> {t('开始学习')}
                        </Button>
                      </Link>
                      <FavoriteButton
                        targetType="scene"
                        targetId={id}
                        label={t('收藏场景')}
                        className="h-11 rounded-xl"
                      />
                      <Button
                        variant="ghost"
                        className="rounded-xl h-11 w-11 p-0 text-slate-500 hover:text-primary border border-slate-200 hover:bg-primary/5 hover:border-primary/30 transition-all"
                        aria-label={t('分享')}
                        onClick={() => setMobileAccessOpen(true)}
                      >
                        <Share2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Stats Sidebar */}
            <div className="lg:w-[320px] shrink-0 flex">
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.04)] w-full">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-primary/5 flex items-center justify-center">
                    <BarChart3 className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-sm font-bold text-slate-800">{t('课时统计')}</span>
                </div>
                <div className="p-5">
                  <div className="flex items-center justify-center mb-5">
                    <div className="relative w-[140px] h-[140px]">
                      <svg className="w-full h-full -rotate-90" viewBox="0 0 140 140">
                        <circle
                          cx="70"
                          cy="70"
                          r="58"
                          fill="none"
                          stroke="#f1f5f9"
                          strokeWidth="10"
                        />
                        {totalHours > 0 && (
                          <circle
                            cx="70"
                            cy="70"
                            r="58"
                            fill="none"
                            stroke="var(--primary)"
                            strokeWidth="10"
                            strokeLinecap="round"
                            strokeDasharray={`${(assessmentHours / totalHours) * Math.PI * 116 || 0} ${Math.PI * 116}`}
                          />
                        )}
                        {totalHours > 0 && trainingHours > 0 && (
                          <circle
                            cx="70"
                            cy="70"
                            r="58"
                            fill="none"
                            stroke="#22c55e"
                            strokeWidth="10"
                            strokeLinecap="round"
                            strokeDasharray={`${(trainingHours / totalHours) * Math.PI * 116 || 0} ${Math.PI * 116}`}
                            strokeDashoffset={-1 * (assessmentHours / totalHours) * Math.PI * 116}
                          />
                        )}
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <div className="text-[32px] font-bold text-slate-800 leading-none">
                          {totalHours}
                        </div>
                        <div className="text-xs text-slate-400 mt-1">{t('总课时')}</div>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap justify-center gap-x-6 gap-y-1.5 text-xs">
                    <div className="flex items-center gap-2 text-slate-600">
                      <div className="w-2.5 h-2.5 rounded-full bg-primary/50" />
                      <span>{t('考核 {n} 课时', { n: assessmentHours })}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600">
                      <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                      <span>{t('训练 {n} 课时', { n: trainingHours })}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <main className="flex-1 max-w-[1400px] mx-auto px-4 sm:px-6 py-6 w-full">
        <div
          ref={tabsRef}
          className="bg-white rounded-2xl border border-slate-200 overflow-visible md:overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.04)]"
        >
          <MobileTabDropdown
            items={[
              { value: 'tasks', label: t('任务概览'), icon: ListChecks, count: tasks.length },
              { value: 'resources', label: t('资源中心'), icon: FolderOpen, count: totalResources },
              {
                value: 'abilities',
                label: t('能力模型'),
                icon: Lightbulb,
                count: uniqueAbilityIds.size,
              },
              { value: 'evaluation', label: t('评价标准'), icon: Target, count: totalEvalConfigs },
              { value: 'knowledge', label: t('知识图谱'), icon: GitBranch },
            ]}
            value={activeTab}
            onValueChange={setActiveTab}
            className="md:hidden m-4"
          />
          <div className="hidden md:flex overflow-x-auto border-b border-slate-100 px-4 sm:px-6">
            {TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={`
                  py-3.5 sm:py-4 px-3 sm:px-5 text-[14px] whitespace-nowrap relative transition-all cursor-pointer flex items-center gap-1.5
                  ${activeTab === tab.value ? 'text-primary font-semibold' : 'text-slate-500 hover:text-primary hover:bg-primary/5'}
                `}
              >
                <tab.icon
                  className={`w-4 h-4 ${activeTab === tab.value ? 'text-primary' : 'text-slate-400'}`}
                />
                {t(tab.label)}
                {tab.value === 'tasks' && tasks.length > 0 && (
                  <span
                    className={`ml-1 px-1.5 py-0.5 rounded-full text-[11px] leading-none ${activeTab === tab.value ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-500'}`}
                  >
                    {tasks.length}
                  </span>
                )}
                {tab.value === 'resources' && totalResources > 0 && (
                  <span
                    className={`ml-1 px-1.5 py-0.5 rounded-full text-[11px] leading-none ${activeTab === tab.value ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-500'}`}
                  >
                    {totalResources}
                  </span>
                )}
                {tab.value === 'abilities' && uniqueAbilityIds.size > 0 && (
                  <span
                    className={`ml-1 px-1.5 py-0.5 rounded-full text-[11px] leading-none ${activeTab === tab.value ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-500'}`}
                  >
                    {uniqueAbilityIds.size}
                  </span>
                )}
                {tab.value === 'evaluation' && totalEvalConfigs > 0 && (
                  <span
                    className={`ml-1 px-1.5 py-0.5 rounded-full text-[11px] leading-none ${activeTab === tab.value ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-500'}`}
                  >
                    {totalEvalConfigs}
                  </span>
                )}
                {activeTab === tab.value && (
                  <span className="absolute bottom-0 left-4 right-4 h-[2px] bg-primary/50 rounded-t-full" />
                )}
              </button>
            ))}
          </div>

          <div className="p-4 sm:p-6 min-h-[500px]">{renderTabContent()}</div>
        </div>
      </main>

      {previewResources.map((r, i) => (
        <ResourcePreviewModal
          key={r.id}
          resource={r}
          open
          index={i}
          onOpenChange={() => removePreviewResource(r.id)}
        />
      ))}

      <MobileAccessDialog open={mobileAccessOpen} onOpenChange={setMobileAccessOpen} />

      <Footer className="mt-auto" />
    </div>
  )
}
