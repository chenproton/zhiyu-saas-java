"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Eye,
  FileText,
  GraduationCap,
  Layers,
  PenLine,
  Search,
  Users,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { scenarioApi, evaluationResultApi, userManagementApi, positionApi, taskApi } from "@/lib/api"
import type { SceneEvaluationResult } from "@/lib/types"

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

type ActivationMode = "manual" | "scheduled"

const evalMethodLabels: Record<string, string> = {
  random_draw: "现场问答", review: "现场评审", paper: "试卷",
  question_bank: "题库", outcome: "成果评价", homework: "作业", quiz: "随堂测",
}

export default function GradingPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null)
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set())
  const [taskActivation, setTaskActivation] = useState<Record<string, { mode: ActivationMode; enabled: boolean }>>({})

  const [scenarios, setScenarios] = useState<any[]>([])
  const [results, setResults] = useState<SceneEvaluationResult[]>([])
  const [userMap, setUserMap] = useState<Map<string, any>>(new Map())
  const [positionMap, setPositionMap] = useState<Map<string, string>>(new Map())
  const [taskNameMap, setTaskNameMap] = useState<Map<string, any>>(new Map())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const [scRes, userRes, posRes, taskRes] = await Promise.all([
          scenarioApi.list({ limit: 200 }).catch(() => ({ items: [] as any[] })),
          userManagementApi.list({ limit: 1000 }).catch(() => ({ items: [] as any[] })),
          positionApi.list({ limit: 500 }).catch(() => ({ items: [] as any[] })),
          taskApi.list({ limit: 10000 }).catch(() => ({ items: [] as any[] })),
        ])

        const pMap = new Map<string, string>()
        ;(posRes.items || []).forEach((p: any) => pMap.set(p.id, p.name))
        setPositionMap(pMap)

        setScenarios((scRes.items || []).map((s: any) => ({
          ...s,
          positionName: pMap.get(s.careerPositionId) || "未分类",
        })))

        const uMap = new Map<string, any>()
        ;(userRes.items || []).forEach((u: any) => uMap.set(u.id, u))
        setUserMap(uMap)

        const tMap = new Map<string, any>()
        ;(taskRes.items || []).forEach((t: any) => tMap.set(t.id, t))
        setTaskNameMap(tMap)
      } catch { /* ignore */ }
      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    if (!selectedScenarioId) { setResults([]); return }
    evaluationResultApi.list({ sceneId: selectedScenarioId, limit: 500 })
      .then((res) => setResults(res.items || []))
      .catch(() => setResults([]))
  }, [selectedScenarioId])

  const scenarioGroups = useMemo<ScenarioGroup[]>(() => {
    const map = new Map<string, ScenarioGroup>()
    for (const scenario of scenarios) {
      const subs = results.filter((s) => s.taskId)
      const pending = subs.filter((s) => s.status === "pending").length
      const graded = subs.filter((s) => s.status === "evaluated").length

      const item = {
        scenarioId: scenario.id,
        scenarioName: scenario.name,
        scenarioCode: scenario.code,
        taskCount: new Set(subs.map((s) => s.taskId)).size,
        pendingCount: pending,
        gradedCount: graded,
        studentCount: new Set(subs.map((s) => s.evaluateeId)).size,
      }

      const pos = scenario.positionName || "未分类"
      if (!map.has(pos)) {
        map.set(pos, { positionName: pos, scenarios: [] })
      }
      map.get(pos)!.scenarios.push(item)
    }
    return Array.from(map.values())
  }, [scenarios, results])

  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return scenarioGroups
    const q = searchQuery.trim().toLowerCase()
    return scenarioGroups
      .map((g) => ({
        ...g,
        scenarios: g.scenarios.filter(
          (s) => s.scenarioName.toLowerCase().includes(q) || s.scenarioCode.toLowerCase().includes(q)
        ),
      }))
      .filter((g) => g.scenarios.length > 0)
  }, [scenarioGroups, searchQuery])

  const selectedScenario = useMemo(
    () => scenarios.find((s) => s.id === selectedScenarioId),
    [selectedScenarioId, scenarios]
  )

  const taskGroups = useMemo<TaskGroup[]>(() => {
    if (!selectedScenarioId) return []
    const scenarioSubs = results
    const taskMap = new Map<string, TaskGroup>()

    for (const sub of scenarioSubs) {
      const user = userMap.get(sub.evaluateeId)
      const taskStudent: TaskStudent = {
        studentId: sub.evaluateeId,
        studentName: user?.name || "未知",
        studentNumber: user?.studentNo || "-",
        className: user?.className || "-",
        enrollmentYear: user?.enrollmentYear || 0,
        result: sub,
      }

      const existing = taskMap.get(sub.taskId)
      if (existing) {
        const method = existing.methods.find((f) => f.methodKey === sub.methodKey)
        if (method) {
          method.students.push(taskStudent)
          method.pendingCount += sub.status === "pending" ? 1 : 0
          method.gradedCount += sub.status === "evaluated" ? 1 : 0
        } else {
          existing.methods.push({
            methodKey: sub.methodKey,
            students: [taskStudent],
            pendingCount: sub.status === "pending" ? 1 : 0,
            gradedCount: sub.status === "evaluated" ? 1 : 0,
          })
        }
      } else {
        const taskInfo = taskNameMap.get(sub.taskId)
        taskMap.set(sub.taskId, {
          taskId: sub.taskId,
          taskName: taskInfo?.name || sub.taskId,
          methods: [{
            methodKey: sub.methodKey,
            students: [taskStudent],
            pendingCount: sub.status === "pending" ? 1 : 0,
            gradedCount: sub.status === "evaluated" ? 1 : 0,
          }],
        })
      }
    }

    return Array.from(taskMap.values())
  }, [selectedScenarioId, results, userMap, taskNameMap])

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
      classes.sort((a, b) => a.className.localeCompare(b.className, "zh-CN"))
      groups.push({ year, classes })
    }
    groups.sort((a, b) => b.year - a.year)
    return groups
  }

  function TaskMethodTabs({ task }: { task: TaskGroup }) {
    const [activeMethod, setActiveMethod] = useState(task.methods[0]?.methodKey || "")
    const activeMethodData = task.methods.find((f) => f.methodKey === activeMethod)
    const yearGroups = activeMethodData ? groupStudents(activeMethodData.students) : []

    return (
      <div className="px-4 pb-4 border-t border-gray-100">
        {task.methods.length > 1 && (
          <div className="flex items-center gap-2 pt-3 mb-3">
            {task.methods.map((m) => (
              <button
                key={m.methodKey}
                onClick={() => setActiveMethod(m.methodKey)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                  activeMethod === m.methodKey
                    ? "bg-primary/10 text-primary border border-primary/30"
                    : "bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100"
                )}
              >
                {evalMethodLabels[m.methodKey] || m.methodKey}
                <span className="text-[10px] opacity-70">({m.students.length})</span>
              </button>
            ))}
          </div>
        )}
        {activeMethodData && activeMethodData.students.length === 0 ? (
          <div className="py-6 text-center text-gray-400 text-sm">暂无学生提交记录</div>
        ) : (
          <div className="space-y-4">
            {yearGroups.map((yearGroup) => (
              <div key={yearGroup.year}>
                <div className="flex items-center gap-2 mb-2">
                  <GraduationCap className="h-3.5 w-3.5 text-gray-400" />
                  <span className="text-xs font-medium text-gray-600">{yearGroup.year} 届</span>
                  <Badge variant="outline" className="text-[10px] font-normal text-gray-400">
                    {yearGroup.classes.reduce((s, c) => s + c.students.length, 0)} 人
                  </Badge>
                </div>
                <div className="space-y-3">
                  {yearGroup.classes.map((classGroup) => (
                    <div key={classGroup.className}>
                      <div className="flex items-center gap-1.5 mb-1.5 px-1">
                        <Users className="h-3 w-3 text-gray-400" />
                        <span className="text-xs text-gray-500">{classGroup.className}</span>
                        <span className="text-[10px] text-gray-400">({classGroup.students.length} 人)</span>
                      </div>
                      <div className="rounded-lg border border-slate-200 divide-y divide-slate-100">
                        {classGroup.students.map((item) => (
                          <div
                            key={item.studentId}
                            className="flex items-center justify-between p-2.5 hover:bg-slate-50/50 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-medium">
                                {item.studentName.charAt(0)}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-gray-800 text-sm">{item.studentName}</span>
                                  <span className="text-xs text-gray-400">{item.studentNumber}</span>
                                  <Badge variant="outline" className={cn("text-[10px]", item.result.status === "pending" ? "bg-amber-50 text-amber-600 border-amber-200" : "bg-green-50 text-green-600 border-green-200")}>
                                    {item.result.status === "pending" ? "待评分" : "已评分"}
                                  </Badge>
                                </div>
                                {item.result.totalScore != null && (
                                  <span className="text-xs text-gray-600">得分: {item.result.totalScore}/{item.result.maxScore}</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
                                <Link href={`/evaluation/scene-results/${item.result.id}`}>
                                  <Eye className="mr-1 h-3 w-3" />查看
                                </Link>
                              </Button>
                              {item.result.status === "pending" ? (
                                <Button size="sm" className="h-7 text-xs" asChild>
                                  <Link href={`/evaluation/scene-results/${item.result.id}`}>
                                    <PenLine className="mr-1 h-3 w-3" />评分
                                  </Link>
                                </Button>
                              ) : (
                                <Button variant="ghost" size="sm" className="h-7 text-xs text-green-600" disabled>
                                  <CheckCircle2 className="mr-1 h-3 w-3" />已评分
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  if (loading) return <div className="h-screen flex items-center justify-center text-gray-400">加载中...</div>

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <div className="bg-white border-b border-gray-200 shrink-0">
        <div className="max-w-[1600px] mx-auto px-6 py-4">
          <h1 className="text-xl font-semibold text-gray-800">场景任务评价</h1>
          <p className="text-sm text-gray-500 mt-0.5">选择场景与任务，查看学生提交并进行评分</p>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden max-w-[1600px] mx-auto w-full">
        <div className="w-72 shrink-0 bg-white border-r border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-100">
            <div className="relative w-full">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
              <Input placeholder="搜索场景..." className="pl-9 text-sm" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-4">
            {filteredGroups.map((group) => (
              <div key={group.positionName}>
                <div className="flex items-center gap-1.5 px-2 mb-2">
                  <Layers className="h-3.5 w-3.5 text-gray-400" />
                  <span className="text-xs font-semibold text-gray-600">{group.positionName}</span>
                </div>
                <div className="space-y-1">
                  {group.scenarios.map((sc) => (
                    <button
                      key={sc.scenarioId}
                      onClick={() => setSelectedScenarioId(sc.scenarioId)}
                      className={cn(
                        "w-full text-left rounded-lg p-2.5 transition-all border",
                        selectedScenarioId === sc.scenarioId
                          ? "bg-primary/[0.04] border-primary/30 shadow-sm"
                          : "bg-white border-transparent hover:bg-gray-50 hover:border-gray-200"
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <BookOpen className={cn("h-4 w-4 mt-0.5 shrink-0", selectedScenarioId === sc.scenarioId ? "text-primary" : "text-gray-400")} />
                        <div className="flex-1 min-w-0">
                          <p className={cn("text-sm font-medium truncate", selectedScenarioId === sc.scenarioId ? "text-primary" : "text-gray-700")}>{sc.scenarioName}</p>
                          <p className="text-[11px] text-gray-400 mt-0.5">{sc.scenarioCode}</p>
                          <div className="flex items-center gap-2 mt-1.5">
                            {sc.pendingCount > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 font-medium">待评 {sc.pendingCount}</span>}
                            {sc.gradedCount > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-50 text-green-600 font-medium">已评 {sc.gradedCount}</span>}
                          </div>
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
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">{selectedScenario.name}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-xs font-normal text-gray-500">{selectedScenario.code}</Badge>
                  </div>
                </div>
              </div>

              {taskGroups.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center text-gray-400">
                    <FileText className="h-10 w-10 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">该场景下暂无学生提交记录</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {taskGroups.map((task) => {
                    const isExpanded = expandedTasks.has(task.taskId)
                    const totalStudents = task.methods.reduce((s, f) => s + f.students.length, 0)
                    const totalPending = task.methods.reduce((s, f) => s + f.pendingCount, 0)
                    const totalGraded = task.methods.reduce((s, f) => s + f.gradedCount, 0)

                    return (
                      <Collapsible key={task.taskId} open={isExpanded} onOpenChange={() => toggleTask(task.taskId)}>
                        <Card className="overflow-hidden">
                          <CollapsibleTrigger asChild>
                            <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50/50 transition-colors">
                              <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                                  <FileText className="h-4 w-4 text-primary" />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm font-semibold text-gray-800">{task.taskName}</p>
                                    {task.methods.map((m) => (
                                      <Badge key={m.methodKey} variant="outline" className="text-[10px] font-normal">{evalMethodLabels[m.methodKey] || m.methodKey}</Badge>
                                    ))}
                                  </div>
                                  <div className="flex items-center gap-3 mt-1">
                                    <span className="text-xs text-gray-500">{totalStudents} 位学生</span>
                                    {totalPending > 0 && <span className="text-xs text-amber-600 font-medium">待评分 {totalPending}</span>}
                                    {totalGraded > 0 && <span className="text-xs text-green-600 font-medium">已评分 {totalGraded}</span>}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
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
              <p className="text-sm">请在左侧选择一个场景</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
