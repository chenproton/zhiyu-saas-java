'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Eye,
  FileText,
  GraduationCap,
  Layers,
  PenLine,
  Users,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import {
  scenarioApi,
  evaluationResultApi,
  userManagementApi,
  positionApi,
  taskApi,
} from '@/lib/api'
import type { SceneEvaluationResult } from '@/lib/types'
import { EVAL_METHOD_LABELS_GRADING } from '@/lib/types'
import { SearchInput } from '@/components/shared/search-input'
import { useT } from '@/lib/i18n/locale-provider'
import { fetchAllPages } from '@/lib/fetch-all'

interface TaskStudent {
  studentId: string
  studentName: string
  studentNumber: string
  className: string
  enrollmentYear: number
  result: SceneEvaluationResult
}

interface TaskMethodGroup {
  methodKey: string
  students: TaskStudent[]
  pendingCount: number
  gradedCount: number
  weight: number
}

interface TaskGroup {
  taskId: string
  taskName: string
  methods: TaskMethodGroup[]
}

interface ScenarioGroup {
  positionName: string
  scenarios: {
    scenarioId: string
    scenarioName: string
    scenarioCode: string
    taskCount: number
    pendingCount: number
    gradedCount: number
    studentCount: number
  }[]
}

export default function GradingPage() {
  return (
    <Suspense fallback={null}>
      <GradingPageContent />
    </Suspense>
  )
}

function GradingPageContent() {
  const searchParams = useSearchParams()
  const t = useT()
  const urlSceneId = searchParams.get('sceneId')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null)
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set())

  const [scenarios, setScenarios] = useState<any[]>([])
  const [results, setResults] = useState<SceneEvaluationResult[]>([])
  const [userMap, setUserMap] = useState<Map<string, any>>(new Map())
  const [taskNameMap, setTaskNameMap] = useState<Map<string, any>>(new Map())
  const [loading, setLoading] = useState(true)

  // 场景列表、用户、岗位、任务等基础数据只加载一次，与选中场景无关
  useEffect(() => {
    const load = async () => {
      try {
        const [scRes, userRes, posRes, taskRes] = await Promise.all([
          scenarioApi.list({ limit: 200 }).catch(() => ({ items: [] as any[] })),
          userManagementApi.list({ limit: 1000 }).catch(() => ({ items: [] as any[] })),
          positionApi.list({ limit: 500 }).catch(() => ({ items: [] as any[] })),
          fetchAllPages((page, pageSize) => taskApi.list({ limit: pageSize, offset: page * pageSize })).catch(() => []),
        ])

        const pMap = new Map<string, string>()
        ;(posRes.items || []).forEach((p: any) => pMap.set(p.id, p.name))

        const loadedScenarios = (scRes.items || [])
          .filter((s: any) => s.status === 'published')
          .map((s: any) => ({
            ...s,
            positionName: pMap.get(s.careerPositionId) || t('未分类'),
          }))
        setScenarios(loadedScenarios)
        setSelectedScenarioId((prev) => {
          if (prev) return prev
          // 优先恢复 URL 中 sceneId 指定的场景（评分详情页返回时携带），否则默认第一个
          const fromUrl =
            urlSceneId && loadedScenarios.some((s) => s.id === urlSceneId) ? urlSceneId : null
          return fromUrl ?? loadedScenarios[0]?.id ?? null
        })

        const uMap = new Map<string, any>()
        ;(userRes.items || []).forEach((u: any) => uMap.set(u.id, u))
        setUserMap(uMap)

        const tMap = new Map<string, any>()
        taskRes.forEach((t: any) => tMap.set(t.id, t))
        setTaskNameMap(tMap)
      } catch {
        /* ignore */
      }
      setLoading(false)
    }
    load()
  }, [urlSceneId, t])

  useEffect(() => {
    if (!selectedScenarioId) return
    evaluationResultApi
      .list({ sceneId: selectedScenarioId, limit: 500 })
      .then((res) => setResults(res.items || []))
      .catch(() => setResults([]))
  }, [selectedScenarioId])

  const scenarioGroups = useMemo<ScenarioGroup[]>(() => {
    const map = new Map<string, ScenarioGroup>()
    for (const scenario of scenarios) {
      // results 只包含当前选中场景的数据，非选中场景无法获得统计，置空避免串数据
      const subs = scenario.id === selectedScenarioId ? results.filter((s) => s.taskId) : []
      const pending = subs.filter((s) => s.status === 'pending').length
      const graded = subs.filter((s) => s.status === 'evaluated').length

      const item = {
        scenarioId: scenario.id,
        scenarioName: scenario.name,
        scenarioCode: scenario.code,
        taskCount: new Set(subs.map((s) => s.taskId)).size,
        pendingCount: pending,
        gradedCount: graded,
        studentCount: new Set(subs.map((s) => s.evaluateeId)).size,
      }

      const pos = scenario.positionName || t('未分类')
      if (!map.has(pos)) {
        map.set(pos, { positionName: pos, scenarios: [] })
      }
      map.get(pos)!.scenarios.push(item)
    }
    return Array.from(map.values())
  }, [scenarios, results, selectedScenarioId, t])

  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return scenarioGroups
    const q = searchQuery.trim().toLowerCase()
    return scenarioGroups
      .map((g) => ({
        ...g,
        scenarios: g.scenarios.filter(
          (s) =>
            s.scenarioName.toLowerCase().includes(q) || s.scenarioCode.toLowerCase().includes(q),
        ),
      }))
      .filter((g) => g.scenarios.length > 0)
  }, [scenarioGroups, searchQuery])

  const selectedScenario = useMemo(
    () => scenarios.find((s) => s.id === selectedScenarioId),
    [selectedScenarioId, scenarios],
  )

  const taskGroups = useMemo<TaskGroup[]>(() => {
    if (!selectedScenarioId) return []
    const scenarioSubs = results
    const taskMap = new Map<string, TaskGroup>()

    const getMethodWeight = (
      taskInfo: any,
      methodKey: string,
      knownMethodCount: number,
    ): number => {
      const configured = taskInfo?.evalData?.methodWeights?.[methodKey]
      if (typeof configured === 'number') return configured
      return knownMethodCount > 0 ? 100 / knownMethodCount : 100
    }

    for (const sub of scenarioSubs) {
      const user = userMap.get(sub.evaluateeId)
      const taskStudent: TaskStudent = {
        studentId: sub.evaluateeId,
        studentName: user?.name || t('未知'),
        studentNumber: user?.studentNo || '-',
        className: user?.className || '-',
        enrollmentYear: user?.enrollmentYear || 0,
        result: sub,
      }

      const existing = taskMap.get(sub.taskId)
      const taskInfo = taskNameMap.get(sub.taskId)
      const evalMethods: string[] = taskInfo?.evalData?.evaluationMethods || []
      if (existing) {
        const method = existing.methods.find((f) => f.methodKey === sub.methodKey)
        if (method) {
          method.students.push(taskStudent)
          method.pendingCount += sub.status === 'pending' ? 1 : 0
          method.gradedCount += sub.status === 'evaluated' ? 1 : 0
        } else {
          const knownCount = evalMethods.length || existing.methods.length + 1
          existing.methods.push({
            methodKey: sub.methodKey,
            students: [taskStudent],
            pendingCount: sub.status === 'pending' ? 1 : 0,
            gradedCount: sub.status === 'evaluated' ? 1 : 0,
            weight: getMethodWeight(taskInfo, sub.methodKey, knownCount),
          })
        }
      } else {
        const knownCount = evalMethods.length || 1
        taskMap.set(sub.taskId, {
          taskId: sub.taskId,
          taskName: taskInfo?.name || sub.taskId,
          methods: [
            {
              methodKey: sub.methodKey,
              students: [taskStudent],
              pendingCount: sub.status === 'pending' ? 1 : 0,
              gradedCount: sub.status === 'evaluated' ? 1 : 0,
              weight: getMethodWeight(taskInfo, sub.methodKey, knownCount),
            },
          ],
        })
      }
    }

    return Array.from(taskMap.values())
  }, [selectedScenarioId, results, userMap, taskNameMap, t])

  const toggleTask = (taskId: string) => {
    setExpandedTasks((prev) => {
      const next = new Set(prev)
      if (next.has(taskId)) next.delete(taskId)
      else next.add(taskId)
      return next
    })
  }

  const groupStudents = (students: TaskStudent[]) => {
    const yearMap = new Map<number, Map<string, TaskStudent[]>>()
    for (const s of students) {
      if (!yearMap.has(s.enrollmentYear)) yearMap.set(s.enrollmentYear, new Map())
      const classMap = yearMap.get(s.enrollmentYear)!
      if (!classMap.has(s.className)) classMap.set(s.className, [])
      classMap.get(s.className)!.push(s)
    }
    const groups: { year: number; classes: { className: string; students: TaskStudent[] }[] }[] = []
    for (const [year, classMap] of yearMap) {
      const classes: { className: string; students: TaskStudent[] }[] = []
      for (const [className, classStudents] of classMap) {
        classes.push({ className, students: classStudents })
      }
      classes.sort((a, b) => a.className.localeCompare(b.className, 'zh-CN'))
      groups.push({ year, classes })
    }
    groups.sort((a, b) => b.year - a.year)
    return groups
  }

  const expandAll = () => setExpandedTasks(new Set(taskGroups.map((t) => t.taskId)))
  const collapseAll = () => setExpandedTasks(new Set())

  function TaskMethodTabs({ task }: { task: TaskGroup }) {
    const [activeMethod, setActiveMethod] = useState(task.methods[0]?.methodKey || '')
    const activeMethodData = task.methods.find((f) => f.methodKey === activeMethod)
    const yearGroups = activeMethodData ? groupStudents(activeMethodData.students) : []

    return (
      <div className="px-4 pb-4 border-t border-gray-100 bg-gray-50/30">
        {task.methods.length > 1 && (
          <div className="flex items-center gap-2 pt-3 mb-3 overflow-x-auto scrollbar-hide">
            {task.methods.map((m) => (
              <button
                key={m.methodKey}
                onClick={() => setActiveMethod(m.methodKey)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all shrink-0',
                  activeMethod === m.methodKey
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300 hover:bg-gray-50',
                )}
              >
                {t(EVAL_METHOD_LABELS_GRADING[m.methodKey] || m.methodKey)}
                <span className="ml-1 flex items-center gap-1">
                  {m.pendingCount > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-400/20 text-amber-700 font-medium">
                      {m.pendingCount}
                    </span>
                  )}
                  {m.gradedCount > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-400/20 text-green-700 font-medium">
                      {m.gradedCount}
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>
        )}
        {activeMethodData && activeMethodData.students.length === 0 ? (
          <div className="py-8 text-center text-gray-400 text-sm bg-white rounded-lg border border-dashed border-gray-200 mt-3">
            {t('暂无学生提交记录')}
          </div>
        ) : (
          <div className="space-y-3 mt-3">
            {yearGroups.map((yearGroup) => (
              <Card key={yearGroup.year} className="overflow-hidden border-gray-200">
                <div className="px-3 py-2 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
                  <GraduationCap className="h-3.5 w-3.5 text-gray-500" />
                  <span className="text-xs font-semibold text-gray-700">
                    {t('{n} 届', { n: yearGroup.year })}
                  </span>
                  <span className="text-[10px] text-gray-400">
                    {t('{n} 人', {
                      n: yearGroup.classes.reduce((s, c) => s + c.students.length, 0),
                    })}
                  </span>
                </div>
                <div className="p-3 space-y-3">
                  {yearGroup.classes.map((classGroup) => (
                    <div key={classGroup.className}>
                      <div className="flex items-center gap-1.5 mb-2">
                        <Users className="h-3 w-3 text-gray-400" />
                        <span className="text-xs font-medium text-gray-600">
                          {classGroup.className}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          {t('{n} 人', { n: classGroup.students.length })}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
                        {classGroup.students.map((item) => (
                          <div
                            key={item.studentId}
                            className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-gray-100 hover:border-primary/20 hover:shadow-sm transition-all"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5 text-primary text-xs font-bold">
                                {item.studentName.charAt(0)}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-medium text-gray-800 text-sm truncate">
                                    {item.studentName}
                                  </span>
                                  <span className="text-[10px] text-gray-400">
                                    {item.studentNumber}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  {item.result.status === 'pending' ? (
                                    <span className="text-[10px] text-amber-600 font-medium">
                                      {t('待评分')}
                                    </span>
                                  ) : item.result.totalScore != null ? (
                                    <span className="text-[10px] text-gray-500 font-medium">
                                      {t('得分 {score}/{max}', {
                                        score: item.result.totalScore,
                                        max: item.result.maxScore,
                                      })}
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs px-2"
                                asChild
                              >
                                <Link href={`/evaluation/scene-results/${item.result.id}`}>
                                  <Eye className="mr-1 h-3 w-3" />
                                  {t('查看')}
                                </Link>
                              </Button>
                              {item.result.status === 'pending' ? (
                                <Button size="sm" className="h-7 text-xs px-2" asChild>
                                  <Link href={`/evaluation/scene-results/${item.result.id}`}>
                                    <PenLine className="mr-1 h-3 w-3" />
                                    {t('评分')}
                                  </Link>
                                </Button>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs text-green-600 px-2"
                                  disabled
                                >
                                  <CheckCircle2 className="mr-1 h-3 w-3" />
                                  {t('已评分')}
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    )
  }

  if (loading)
    return (
      <div className="h-screen flex items-center justify-center text-gray-400">{t('加载中...')}</div>
    )

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <div className="bg-white border-b border-gray-200 shrink-0">
        <div className="max-w-[1600px] mx-auto px-6 py-4">
          <h1 className="text-xl font-semibold text-foreground">{t('场景任务评价')}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{t('选择场景与任务，查看学生提交并进行评分')}</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden max-w-[1600px] mx-auto w-full">
        <div className="w-full md:w-80 shrink-0 bg-white border-r border-gray-200 flex flex-col max-h-[50vh] md:max-h-none">
          <div className="p-4 border-b border-gray-100">
            <SearchInput
              wrapperClassName="w-full"
              iconClassName="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400"
              placeholder={t('搜索场景...')}
              inputClassName="pl-9 text-sm"
              value={searchQuery}
              onChange={setSearchQuery}
            />
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-5">
            {filteredGroups.map((group) => (
              <div key={group.positionName}>
                <div className="flex items-center gap-1.5 px-2 mb-2">
                  <Layers className="h-3.5 w-3.5 text-gray-400" />
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {group.positionName}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {group.scenarios.map((sc) => (
                    <button
                      key={sc.scenarioId}
                      onClick={() => setSelectedScenarioId(sc.scenarioId)}
                      className={cn(
                        'w-full text-left rounded-xl p-3 transition-all border',
                        selectedScenarioId === sc.scenarioId
                          ? 'bg-primary/[0.06] border-primary/30 shadow-sm ring-1 ring-primary/10'
                          : 'bg-white border-gray-100 hover:border-gray-300 hover:shadow-sm',
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p
                            className={cn(
                              'text-sm font-semibold truncate',
                              selectedScenarioId === sc.scenarioId
                                ? 'text-primary'
                                : 'text-gray-800',
                            )}
                          >
                            {sc.scenarioName}
                          </p>
                          <p className="text-[11px] text-gray-400 mt-0.5">{sc.scenarioCode}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          {sc.pendingCount > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 font-medium border border-amber-100">
                              {sc.pendingCount}
                            </span>
                          )}
                          {sc.gradedCount > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-50 text-green-600 font-medium border border-green-100">
                              {sc.gradedCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {selectedScenario ? (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-800">{selectedScenario.name}</h2>
                  <div className="flex items-center gap-2 mt-1.5">
                    <Badge variant="outline" className="text-xs font-normal text-gray-500">
                      {selectedScenario.code}
                    </Badge>
                    <span className="text-xs text-gray-400">
                      {t('{n} 条提交记录', { n: results.length })}
                    </span>
                  </div>
                </div>
                {taskGroups.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="h-8 text-xs" onClick={expandAll}>
                      {t('全部展开')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={collapseAll}
                    >
                      {t('全部收起')}
                    </Button>
                  </div>
                )}
              </div>

              {taskGroups.length === 0 ? (
                <Card className="border-dashed border-gray-200">
                  <CardContent className="py-12 text-center text-gray-400">
                    <FileText className="h-10 w-10 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">{t('该场景下暂无学生提交记录')}</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {taskGroups.map((task) => {
                    const isExpanded = expandedTasks.has(task.taskId)
                    const taskResults = results.filter((r) => r.taskId === task.taskId)
                    const totalStudents = new Set(taskResults.map((r) => r.evaluateeId)).size
                    const totalPending = task.methods.reduce((s, f) => s + f.pendingCount, 0)
                    const totalGraded = task.methods.reduce((s, f) => s + f.gradedCount, 0)

                    const taskScore = task.methods.reduce((sum, m) => {
                      const graded = m.students.filter((s) => s.result.status === 'evaluated')
                      if (graded.length === 0) return sum
                      const methodScore =
                        graded.reduce(
                          (acc, s) =>
                            acc + ((s.result.totalScore ?? 0) / (s.result.maxScore || 1)) * 100,
                          0,
                        ) / graded.length
                      return sum + (methodScore * (m.weight || 0)) / 100
                    }, 0)

                    return (
                      <Collapsible
                        key={task.taskId}
                        open={isExpanded}
                        onOpenChange={() => toggleTask(task.taskId)}
                      >
                        <Card className="overflow-hidden border-gray-200 shadow-sm">
                          <CollapsibleTrigger asChild>
                            <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50/60 transition-colors">
                              <div className="flex items-center gap-4 min-w-0">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 text-primary">
                                  <FileText className="h-5 w-5" />
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="text-sm font-bold text-gray-800 truncate">
                                      {task.taskName}
                                    </p>
                                    {totalGraded > 0 && (
                                      <Badge
                                        variant="outline"
                                        className="text-[10px] font-normal bg-primary/5 text-primary border-primary/20"
                                      >
                                        {t('均分 {n}', { n: taskScore.toFixed(1) })}
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                    {task.methods.map((m) => (
                                      <Badge
                                        key={m.methodKey}
                                        variant="outline"
                                        className="text-[10px] font-normal bg-gray-50 text-gray-600 border-gray-200"
                                      >
                                        {t(EVAL_METHOD_LABELS_GRADING[m.methodKey] || m.methodKey)}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-4 shrink-0">
                                <div className="flex items-center gap-3 text-xs">
                                  <div className="text-center min-w-[48px]">
                                    <p className="font-semibold text-gray-800">{totalStudents}</p>
                                    <p className="text-[10px] text-gray-400">{t('学生')}</p>
                                  </div>
                                  <div className="w-px h-6 bg-gray-200" />
                                  <div className="text-center min-w-[48px]">
                                    <p
                                      className={cn(
                                        'font-semibold',
                                        totalPending > 0 ? 'text-amber-600' : 'text-gray-800',
                                      )}
                                    >
                                      {totalPending}
                                    </p>
                                    <p className="text-[10px] text-gray-400">{t('待评')}</p>
                                  </div>
                                  <div className="text-center min-w-[48px]">
                                    <p className="font-semibold text-green-600">{totalGraded}</p>
                                    <p className="text-[10px] text-gray-400">{t('已评')}</p>
                                  </div>
                                </div>
                                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-50">
                                  {isExpanded ? (
                                    <ChevronUp className="h-4 w-4 text-gray-500" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4 text-gray-500" />
                                  )}
                                </div>
                              </div>
                            </div>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <TaskMethodTabs task={task} />
                          </CollapsibleContent>
                        </Card>
                      </Collapsible>
                    )
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-400">
              <BookOpen className="h-12 w-12 mb-3 opacity-50" />
              <p className="text-sm">{t('请在左侧选择一个场景')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
