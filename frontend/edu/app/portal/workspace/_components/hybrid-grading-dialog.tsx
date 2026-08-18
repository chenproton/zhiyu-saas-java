'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import {
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Eye,
  FileText,
  GraduationCap,
  PenLine,
  Users,
  Loader2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { SearchInput } from '@/components/shared/search-input'
import { cn } from '@/lib/utils'
import { portalApi, courseNodeApi, nodeEvaluationResultApi, userManagementApi } from '@/lib/api'
import { reportError } from '@/lib/error-handling'
import type { WorkspaceClassPlan } from '@/lib/types'
import type { SystemCourseNode } from '@/lib/types/lesson-source'
import type { NodeEvaluationResult } from '@zhiyu/api-client'
import { EVAL_METHOD_LABELS_GRADING } from '@/lib/types'
import { getHybridMethodLabel } from '@/lib/hybrid-eval'
import { EmptyState } from '@zhiyu/ui'
import { useT } from '@/lib/i18n/locale-provider'

interface HybridGradingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sessionTitle: string
  className?: string
  courseId?: string
}

interface StudentInfo {
  studentId: string
  studentName: string
  studentNumber: string
  className: string
  enrollmentYear: number
}

interface StudentEvalGroup {
  student: StudentInfo
  results: NodeEvaluationResult[]
}

interface NodeEvalGroup {
  nodeId: string
  nodeName: string
  pendingCount: number
  gradedCount: number
  students: StudentEvalGroup[]
}

export function HybridGradingDialog({
  open,
  onOpenChange,
  sessionTitle,
  className,
  courseId,
}: HybridGradingDialogProps) {
  const t = useT()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set())
  const [classPlans, setClassPlans] = useState<WorkspaceClassPlan[]>([])
  const [nodes, setNodes] = useState<SystemCourseNode[]>([])
  const [results, setResults] = useState<NodeEvaluationResult[]>([])
  const [userMap, setUserMap] = useState<Map<string, any>>(new Map())
  const [loading, setLoading] = useState(true)

  // 请求序号守卫：快速切换左侧课程时丢弃过期响应，避免旧课程数据覆盖新课程
  const courseSeqRef = useRef(0)
  const loadCourseData = (cid: string) => {
    const seq = ++courseSeqRef.current
    setLoading(true)
    Promise.all([
      courseNodeApi.list({ courseId: cid, limit: 1000 }).catch(() => ({ items: [] as any[] })),
      nodeEvaluationResultApi.listByCourse(cid).catch(() => ({ items: [] })),
      userManagementApi.list({ limit: 1000 }).catch(() => ({ items: [] as any[] })),
    ])
      .then(([nodeRes, resRes, userRes]) => {
        if (seq !== courseSeqRef.current) return
        setNodes((nodeRes.items || []) as SystemCourseNode[])
        setResults(resRes.items || [])
        const uMap = new Map<string, any>()
        ;(userRes.items || []).forEach((u: any) => uMap.set(u.id, u))
        setUserMap(uMap)
      })
      .catch(() => {
        if (seq !== courseSeqRef.current) return
        reportError(new Error('加载混合课测评数据失败'), '加载混合课测评数据')
      })
      .finally(() => {
        if (seq === courseSeqRef.current) setLoading(false)
      })
  }

  useEffect(() => {
    if (!open) return
    portalApi
      .workspaceDashboard({ role: 'teacher' })
      .then((res) => {
        const plans = (res.classPlans || []).filter((p) => p.courseId)
        setClassPlans(plans)
        // 未传 courseId 时默认选中第一个有排课计划的课程
        if (!courseId) {
          setSelectedPlanId((prev) => prev || plans[0]?.courseId || null)
        } else if (plans.some((p) => p.courseId === courseId)) {
          setSelectedPlanId((prev) => prev || courseId)
        }
      })
      .catch((err) => reportError(err, '加载工作台班级/课时数据'))
    if (courseId) {
      queueMicrotask(() => loadCourseData(courseId))
    } else {
      // 无 courseId 时由左侧课程选择驱动，先结束加载态
      queueMicrotask(() => setLoading(false))
    }
  }, [open, courseId])

  // 左侧课程列表（有 courseId 的排课计划）
  const filteredPlans = useMemo(() => {
    if (!searchQuery.trim()) return classPlans
    const q = searchQuery.trim().toLowerCase()
    return classPlans.filter(
      (p) => p.course.toLowerCase().includes(q) || p.name.toLowerCase().includes(q),
    )
  }, [classPlans, searchQuery])

  const selectedPlan = useMemo(
    () =>
      classPlans.find((p) => p.id === selectedPlanId) ||
      classPlans.find((p) => p.courseId === selectedPlanId),
    [classPlans, selectedPlanId],
  )

  // 右侧：节点（节次）→ 班级 → 学生 → 测评结果
  const nodeGroups = useMemo<NodeEvalGroup[]>(() => {
    const nodeNameMap = new Map(nodes.map((n) => [n.id, n.name]))
    const byNode = new Map<string, StudentEvalGroup[]>()
    for (const r of results) {
      const user = userMap.get(r.evaluateeId)
      const student: StudentInfo = {
        studentId: r.evaluateeId,
        studentName: user?.name || '未知',
        studentNumber: user?.studentNo || '-',
        className: user?.className || '-',
        enrollmentYear: user?.enrollmentYear || 0,
      }
      const list = byNode.get(r.nodeId) || []
      const existing = list.find((g) => g.student.studentId === r.evaluateeId)
      if (existing) {
        existing.results.push(r)
      } else {
        list.push({ student, results: [r] })
      }
      byNode.set(r.nodeId, list)
    }
    const groups: NodeEvalGroup[] = []
    byNode.forEach((students, nodeId) => {
      let pendingCount = 0
      let gradedCount = 0
      students.forEach((g) => {
        g.results.forEach((r) => {
          if (r.status === 'pending') pendingCount++
          else gradedCount++
        })
      })
      groups.push({
        nodeId,
        nodeName: nodeNameMap.get(nodeId) || nodeId,
        pendingCount,
        gradedCount,
        students: students.sort((a, b) =>
          (a.student.enrollmentYear || 0) !== (b.student.enrollmentYear || 0)
            ? (b.student.enrollmentYear || 0) - (a.student.enrollmentYear || 0)
            : a.student.className.localeCompare(b.student.className, 'zh-CN'),
        ),
      })
    })
    return groups.sort((a, b) => a.nodeName.localeCompare(b.nodeName, 'zh-CN'))
  }, [nodes, results, userMap])

  const toggleNode = (nodeId: string) => {
    setCollapsedNodes((prev) => {
      const next = new Set(prev)
      if (next.has(nodeId)) next.delete(nodeId)
      else next.add(nodeId)
      return next
    })
  }

  const innerOpenChange = (v: boolean) => {
    if (v) {
      setSelectedPlanId(courseId || classPlans[0]?.courseId || null)
      setCollapsedNodes(new Set())
    }
    onOpenChange(v)
  }

  const methodLabel = (key: string) =>
    getHybridMethodLabel(key, (k) => EVAL_METHOD_LABELS_GRADING[k] || k)

  return (
    <Dialog open={open} onOpenChange={innerOpenChange}>
      <DialogContent className="max-h-[95vh] h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-0 shrink-0">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <GraduationCap className="h-5 w-5 text-amber-600" />
            {t('混合课程评分')}
          </DialogTitle>
          <DialogDescription>
            {sessionTitle} · {className || t('全部学生')}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Left sidebar — Course list */}
          <div className="w-64 shrink-0 bg-white border-r border-gray-200 flex flex-col">
            <div className="p-3 border-b border-gray-100">
              <SearchInput
                wrapperClassName="w-full"
                iconClassName="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400"
                placeholder={t('搜索课程...')}
                inputClassName="pl-9 text-sm"
                value={searchQuery}
                onChange={setSearchQuery}
              />
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-1">
              {filteredPlans.map((plan) => {
                const active =
                  selectedPlanId === plan.courseId || selectedPlanId === plan.id
                return (
                  <button
                    key={plan.courseId || plan.id}
                    onClick={() => {
                      setSelectedPlanId(plan.courseId || plan.id)
                      // 切换课程时按新 courseId 重新拉取节点/结果/学生数据，防止展示错误课程数据
                      if (plan.courseId) {
                        loadCourseData(plan.courseId)
                      }
                      setCollapsedNodes(new Set())
                    }}
                    className={cn(
                      'w-full text-left rounded-lg p-2.5 transition-all border',
                      active
                        ? 'bg-amber-50 border-amber-300 shadow-sm'
                        : 'bg-white border-transparent hover:bg-gray-50 hover:border-gray-200',
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <BookOpen
                        className={cn(
                          'h-4 w-4 mt-0.5 shrink-0',
                          active ? 'text-amber-600' : 'text-gray-400',
                        )}
                      />
                      <div className="flex-1 min-w-0">
                        <p
                          className={cn(
                            'text-sm font-medium truncate',
                            active ? 'text-amber-700' : 'text-gray-700',
                          )}
                        >
                          {plan.course}
                        </p>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          {t('{className} · {count}人', {
                            className: plan.name,
                            count: plan.students,
                          })}
                        </p>
                      </div>
                    </div>
                  </button>
                )
              })}
              {filteredPlans.length === 0 && (
                <EmptyState
                  compact
                  className="py-8"
                  titleClassName="text-gray-400"
                  title={t('暂无混合课程计划')}
                />
              )}
            </div>
          </div>

          {/* Right content — nodes with student eval results */}
          <div className="flex-1 overflow-y-auto bg-gray-50">
            {loading ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-2">
                <Loader2 className="h-6 w-6 animate-spin" />
                <p className="text-sm">{t('加载测评数据中...')}</p>
              </div>
            ) : (
              <div className="p-6 space-y-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">
                    {selectedPlan?.course || courseId}
                  </h2>
                  <div className="flex items-center gap-2 mt-1">
                    {selectedPlan && (
                      <Badge variant="outline" className="text-xs font-normal text-gray-500">
                        {selectedPlan.name}
                      </Badge>
                    )}
                    <Badge variant="secondary" className="text-xs font-normal">
                      {t('{count} 条提交', { count: results.length })}
                    </Badge>
                  </div>
                </div>

                {nodeGroups.length === 0 ? (
                  <Card>
                    <EmptyState
                      icon={<FileText className="h-10 w-10 opacity-50" />}
                      title={t('该课程暂无学生测评提交记录')}
                      titleClassName="text-gray-400"
                      action={
                        <Link
                          to={
                            courseId
                              ? `/evaluation/lesson-results?courseId=${courseId}`
                              : '/evaluation/lesson-results'
                          }
                          className="inline-block text-xs text-primary hover:text-primary/80 transition-colors"
                        >
                          {t('前往课程节点评价页面 →')}
                        </Link>
                      }
                    />
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {nodeGroups.map((node) => {
                      const isExpanded = !collapsedNodes.has(node.nodeId)
                      const groupedByClass = node.students.reduce<
                        Record<string, StudentEvalGroup[]>
                      >((acc, g) => {
                        const key = g.student.className || '-'
                        if (!acc[key]) acc[key] = []
                        acc[key].push(g)
                        return acc
                      }, {})

                      return (
                        <Collapsible
                          key={node.nodeId}
                          open={!collapsedNodes.has(node.nodeId)}
                          onOpenChange={() => toggleNode(node.nodeId)}
                        >
                          <Card className="overflow-hidden">
                            <CollapsibleTrigger asChild>
                              <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50/50 transition-colors">
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 shrink-0">
                                    <FileText className="h-4 w-4 text-amber-600" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-sm font-semibold text-gray-800 truncate">
                                      {node.nodeName}
                                    </p>
                                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                                      <span className="text-xs text-gray-400">
                                        {t('{count} 位学生', { count: node.students.length })}
                                      </span>
                                      {node.pendingCount > 0 && (
                                        <span className="text-xs text-amber-600 font-medium">
                                          {t('待评分 {count}', { count: node.pendingCount })}
                                        </span>
                                      )}
                                      {node.gradedCount > 0 && (
                                        <span className="text-xs text-green-600 font-medium">
                                          {t('已评分 {count}', { count: node.gradedCount })}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  {isExpanded ? (
                                    <ChevronUp className="h-4 w-4 text-gray-400" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4 text-gray-400" />
                                  )}
                                </div>
                              </div>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <div className="px-4 pb-4 border-t border-gray-100">
                                <div className="space-y-4 pt-3">
                                  {Object.entries(groupedByClass).map(([cls, studentGroups]) => (
                                    <div key={cls}>
                                      <div className="flex items-center gap-1.5 mb-1.5 px-1">
                                        <Users className="h-3 w-3 text-gray-400" />
                                        <span className="text-xs text-gray-500">{cls}</span>
                                        <span className="text-[10px] text-gray-400">
                                          {t('({count}人)', { count: studentGroups.length })}
                                        </span>
                                      </div>
                                      <div className="rounded-lg border border-slate-200 divide-y divide-slate-100">
                                        {studentGroups.map((group) => (
                                          <div
                                            key={group.student.studentId}
                                            className="flex items-center justify-between p-2.5 hover:bg-slate-50/50 transition-colors flex-wrap gap-2"
                                          >
                                            <div className="flex items-center gap-3 min-w-0">
                                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-600 text-xs font-medium shrink-0">
                                                {group.student.studentName.charAt(0)}
                                              </div>
                                              <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                  <span className="font-medium text-gray-800 text-sm truncate">
                                                    {group.student.studentName}
                                                  </span>
                                                  <span className="text-xs text-gray-400">
                                                    {group.student.studentNumber}
                                                  </span>
                                                </div>
                                              </div>
                                            </div>
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                              {group.results.map((r) => {
                                                const pending = r.status === 'pending'
                                                return (
                                                  <Link
                                                    key={r.id}
                                                    to={`/evaluation/lesson-results/${r.id}`}
                                                    className={cn(
                                                      'inline-flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-full border font-medium transition-colors',
                                                      pending
                                                        ? 'bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100'
                                                        : 'bg-green-50 text-green-600 border-green-200 hover:bg-green-100',
                                                    )}
                                                  >
                                                    {pending ? (
                                                      <PenLine className="h-3 w-3" />
                                                    ) : (
                                                      <CheckCircle2 className="h-3 w-3" />
                                                    )}
                                                    {methodLabel(r.methodKey)} ·{' '}
                                                    {pending
                                                      ? t('待评分')
                                                      : t('已评 {score}/{max}', {
                                                          score: r.totalScore ?? 0,
                                                          max: r.maxScore ?? 100,
                                                        })}
                                                  </Link>
                                                )
                                              })}
                                              <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-7 text-xs px-2"
                                                asChild
                                              >
                                                <Link
                                                  to={`/evaluation/lesson-results/${group.results[0].id}`}
                                                >
                                                  <Eye className="mr-1 h-3 w-3" />
                                                  {t('查看')}
                                                </Link>
                                              </Button>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </CollapsibleContent>
                          </Card>
                        </Collapsible>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
