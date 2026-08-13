'use client'

import { Suspense, useEffect, useMemo, useState, useRef } from 'react'
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
  PenLine,
  Users,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import { courseApi, courseNodeApi, userManagementApi, nodeEvaluationResultApi } from '@/lib/api'
import type { Course } from '@/lib/types'
import type { SystemCourseNode } from '@/lib/types/lesson-source'
import type { NodeEvaluationResult } from '@zhiyu/api-client'
import { EVAL_METHOD_LABELS_GRADING } from '@/lib/types'
import { getHybridMethodLabel, hybridMethodCompare } from '@/lib/hybrid-eval'
import { SearchInput } from '@/components/shared/search-input'
import { EmptyState } from '@zhiyu/ui'
import { useT } from '@/lib/i18n/locale-provider'

interface NodeStudent {
  studentId: string
  studentName: string
  studentNumber: string
  className: string
  enrollmentYear: number
  result: NodeEvaluationResult
}

interface NodeMethodGroup {
  methodKey: string
  students: NodeStudent[]
  pendingCount: number
  gradedCount: number
}

interface NodeGroup {
  nodeId: string
  nodeName: string
  methods: NodeMethodGroup[]
}

export default function LessonResultsPage() {
  return (
    <Suspense fallback={null}>
      <LessonResultsPageContent />
    </Suspense>
  )
}

function LessonResultsPageContent() {
  const searchParams = useSearchParams()
  const t = useT()
  const urlCourseId = searchParams.get('courseId')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null)
  // 课程结果请求序号：快速切换课程时丢弃过期响应
  const courseResultSeqRef = useRef(0)
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())

  const [courses, setCourses] = useState<Course[]>([])
  const [nodes, setNodes] = useState<SystemCourseNode[]>([])
  const [results, setResults] = useState<NodeEvaluationResult[]>([])
  const [userMap, setUserMap] = useState<Map<string, any>>(new Map())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const [courseRes, userRes] = await Promise.all([
          courseApi
            .list({ status: 'published', limit: 1000 } as any)
            .catch(() => ({ items: [] as any[] })),
          userManagementApi.list({ limit: 1000 }).catch(() => ({ items: [] as any[] })),
        ])
        const loadedCourses = (courseRes.items || []).filter(
          (c: any) => c.type === 'system' || c.type === 'hybrid',
        )
        setCourses(loadedCourses)
        setSelectedCourseId((prev) => {
          if (prev) return prev
          const fromUrl =
            urlCourseId && loadedCourses.some((c: any) => c.id === urlCourseId) ? urlCourseId : null
          return fromUrl ?? loadedCourses[0]?.id ?? null
        })
        const uMap = new Map<string, any>()
        ;(userRes.items || []).forEach((u: any) => uMap.set(u.id, u))
        setUserMap(uMap)
      } catch {
        /* ignore */
      }
      setLoading(false)
    }
    load()
  }, [urlCourseId])

  useEffect(() => {
    if (!selectedCourseId) return
    const seq = ++courseResultSeqRef.current
    courseNodeApi
      .list({ courseId: selectedCourseId, limit: 1000 } as any)
      .then((res) => {
        if (seq === courseResultSeqRef.current) setNodes((res.items || []) as any)
      })
      .catch(() => {
        if (seq === courseResultSeqRef.current) setNodes([])
      })
    nodeEvaluationResultApi
      .listByCourse(selectedCourseId)
      .then((res) => {
        if (seq === courseResultSeqRef.current) setResults(res.items || [])
      })
      .catch(() => {
        if (seq === courseResultSeqRef.current) setResults([])
      })
  }, [selectedCourseId])

  const filteredCourses = useMemo(() => {
    if (!searchQuery.trim()) return courses
    const q = searchQuery.trim().toLowerCase()
    return courses.filter(
      (c) => c.name.toLowerCase().includes(q) || (c.majorName || '').toLowerCase().includes(q),
    )
  }, [courses, searchQuery])

  const nodeGroups = useMemo<NodeGroup[]>(() => {
    const nodeMap = new Map<string, NodeGroup>()
    for (const res of results) {
      const user = userMap.get(res.evaluateeId)
      const student: NodeStudent = {
        studentId: res.evaluateeId,
        studentName: user?.name || t('未知'),
        studentNumber: user?.studentNo || '-',
        className: user?.className || '-',
        enrollmentYear: user?.enrollmentYear || 0,
        result: res,
      }
      const existing = nodeMap.get(res.nodeId)
      if (existing) {
        const method = existing.methods.find((m) => m.methodKey === res.methodKey)
        if (method) {
          method.students.push(student)
          method.pendingCount += res.status === 'pending' ? 1 : 0
          method.gradedCount += res.status === 'evaluated' ? 1 : 0
        } else {
          existing.methods.push({
            methodKey: res.methodKey,
            students: [student],
            pendingCount: res.status === 'pending' ? 1 : 0,
            gradedCount: res.status === 'evaluated' ? 1 : 0,
          })
        }
      } else {
        nodeMap.set(res.nodeId, {
          nodeId: res.nodeId,
          nodeName: res.nodeId,
          methods: [
            {
              methodKey: res.methodKey,
              students: [student],
              pendingCount: res.status === 'pending' ? 1 : 0,
              gradedCount: res.status === 'evaluated' ? 1 : 0,
            },
          ],
        })
      }
    }
    const nodeNameMap = new Map(nodes.map((n) => [n.id, n.name]))
    nodeMap.forEach((g) => {
      g.nodeName = nodeNameMap.get(g.nodeId) || g.nodeId
      g.methods.sort((a, b) => hybridMethodCompare(a.methodKey, b.methodKey))
    })
    return Array.from(nodeMap.values()).sort((a, b) =>
      a.nodeName.localeCompare(b.nodeName, 'zh-CN'),
    )
  }, [results, userMap, nodes, t])

  const toggleNode = (nodeId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev)
      if (next.has(nodeId)) next.delete(nodeId)
      else next.add(nodeId)
      return next
    })
  }

  const groupStudents = (students: NodeStudent[]) => {
    const yearMap = new Map<number, Map<string, NodeStudent[]>>()
    for (const s of students) {
      if (!yearMap.has(s.enrollmentYear)) yearMap.set(s.enrollmentYear, new Map())
      const classMap = yearMap.get(s.enrollmentYear)!
      if (!classMap.has(s.className)) classMap.set(s.className, [])
      classMap.get(s.className)!.push(s)
    }
    const groups: { year: number; classes: { className: string; students: NodeStudent[] }[] }[] = []
    for (const [year, classMap] of yearMap) {
      const classes: { className: string; students: NodeStudent[] }[] = []
      for (const [className, classStudents] of classMap) {
        classes.push({ className, students: classStudents })
      }
      classes.sort((a, b) => a.className.localeCompare(b.className, 'zh-CN'))
      groups.push({ year, classes })
    }
    groups.sort((a, b) => b.year - a.year)
    return groups
  }

  if (loading)
    return <div className="h-screen flex items-center justify-center text-gray-400">{t('加载中...')}</div>

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <div className="bg-white border-b border-gray-200 shrink-0">
        <div className="max-w-[1600px] mx-auto px-6 py-4">
          <h1 className="text-xl font-semibold text-foreground">{t('课程节点评价')}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{t('选择课程与节点，查看学生提交并进行评分')}</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden max-w-[1600px] mx-auto w-full">
        <div className="w-full md:w-80 shrink-0 bg-white border-r border-gray-200 flex flex-col max-h-[50vh] md:max-h-none">
          <div className="p-4 border-b border-gray-100">
            <SearchInput
              wrapperClassName="w-full"
              iconClassName="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400"
              placeholder={t('搜索课程...')}
              inputClassName="pl-9 text-sm"
              value={searchQuery}
              onChange={setSearchQuery}
            />
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
            {filteredCourses.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedCourseId(c.id)}
                className={cn(
                  'w-full text-left rounded-xl p-3 transition-all border',
                  selectedCourseId === c.id
                    ? 'bg-primary/[0.06] border-primary/30 shadow-sm ring-1 ring-primary/10'
                    : 'bg-white border-gray-100 hover:border-gray-300 hover:shadow-sm',
                )}
              >
                <p
                  className={cn(
                    'text-sm font-semibold truncate',
                    selectedCourseId === c.id ? 'text-primary' : 'text-gray-800',
                  )}
                >
                  {c.name}
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5 truncate">
                  {t('{type} · {n} 节点', {
                    type: c.type === 'system' ? t('体系课') : t('混合课'),
                    n: c.nodeCount || 0,
                  })}
                </p>
              </button>
            ))}
            {filteredCourses.length === 0 && (
              <EmptyState
                compact
                title={t('暂无已发布课程')}
                className="py-8"
                titleClassName="text-gray-400"
              />
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {selectedCourseId ? (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-800">
                    {courses.find((c) => c.id === selectedCourseId)?.name || t('课程')}
                  </h2>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-xs text-gray-400">
                      {t('{n} 条提交记录', { n: results.length })}
                    </span>
                  </div>
                </div>
                {nodeGroups.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => setExpandedNodes(new Set(nodeGroups.map((n) => n.nodeId)))}
                    >
                      {t('全部展开')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => setExpandedNodes(new Set())}
                    >
                      {t('全部收起')}
                    </Button>
                  </div>
                )}
              </div>

              {nodeGroups.length === 0 ? (
                <Card className="border-dashed border-gray-200">
                  <EmptyState
                    icon={<FileText className="h-10 w-10 opacity-50" />}
                    title={t('该课程下暂无学生测评提交记录')}
                    titleClassName="text-gray-400"
                  />
                </Card>
              ) : (
                <div className="space-y-3">
                  {nodeGroups.map((node) => {
                    const isExpanded = expandedNodes.has(node.nodeId)
                    const totalPending = node.methods.reduce((s, m) => s + m.pendingCount, 0)
                    const totalGraded = node.methods.reduce((s, m) => s + m.gradedCount, 0)
                    return (
                      <Collapsible
                        key={node.nodeId}
                        open={isExpanded}
                        onOpenChange={() => toggleNode(node.nodeId)}
                      >
                        <Card className="overflow-hidden border-gray-200 shadow-sm">
                          <CollapsibleTrigger asChild>
                            <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50/60 transition-colors">
                              <div className="flex items-center gap-4 min-w-0">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 text-primary">
                                  <FileText className="h-5 w-5" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-bold text-gray-800 truncate">
                                    {node.nodeName}
                                  </p>
                                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                    {node.methods.map((m) => (
                                      <Badge
                                        key={m.methodKey}
                                        variant="outline"
                                        className="text-[10px] font-normal bg-gray-50 text-gray-600 border-gray-200"
                                      >
                                        {getHybridMethodLabel(
                                          m.methodKey,
                                          (k) => t(EVAL_METHOD_LABELS_GRADING[k] || k),
                                        )}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-4 shrink-0">
                                <div className="flex items-center gap-3 text-xs">
                                  <div className="text-center min-w-[48px]">
                                    <p className="font-semibold text-gray-800">
                                      {node.methods.reduce((s, m) => s + m.students.length, 0)}
                                    </p>
                                    <p className="text-[10px] text-gray-400">{t('提交')}</p>
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
                            <div className="px-4 pb-4 border-t border-gray-100 bg-gray-50/30">
                              <div className="space-y-3 mt-3">
                                {node.methods.map((method) => (
                                  <div
                                    key={method.methodKey}
                                    className="bg-white rounded-lg border border-gray-200 p-3"
                                  >
                                    <div className="flex items-center gap-2 mb-3">
                                      <Badge className="text-[10px] font-normal bg-primary/10 text-primary border-primary/20">
                                        {getHybridMethodLabel(
                                          method.methodKey,
                                          (k) => t(EVAL_METHOD_LABELS_GRADING[k] || k),
                                        )}
                                      </Badge>
                                      {method.pendingCount > 0 && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 font-medium border border-amber-100">
                                          {t('待评 {n}', { n: method.pendingCount })}
                                        </span>
                                      )}
                                      {method.gradedCount > 0 && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-50 text-green-600 font-medium border border-green-100">
                                          {t('已评 {n}', { n: method.gradedCount })}
                                        </span>
                                      )}
                                    </div>
                                    {groupStudents(method.students).map((yearGroup) => (
                                      <div key={yearGroup.year} className="mb-3 last:mb-0">
                                        <div className="flex items-center gap-2 mb-2">
                                          <GraduationCap className="h-3.5 w-3.5 text-gray-500" />
                                          <span className="text-xs font-semibold text-gray-700">
                                            {t('{n} 届', { n: yearGroup.year })}
                                          </span>
                                          <span className="text-[10px] text-gray-400">
                                            {t('{n} 人', {
                                              n: yearGroup.classes.reduce(
                                                (s, c) => s + c.students.length,
                                                0,
                                              ),
                                            })}
                                          </span>
                                        </div>
                                        {yearGroup.classes.map((classGroup) => (
                                          <div
                                            key={classGroup.className}
                                            className="mb-2 last:mb-0"
                                          >
                                            <div className="flex items-center gap-1.5 mb-2">
                                              <Users className="h-3 w-3 text-gray-400" />
                                              <span className="text-xs font-medium text-gray-600">
                                                {classGroup.className}
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
                                                      <Link
                                                        href={`/evaluation/lesson-results/${item.result.id}`}
                                                      >
                                                        <Eye className="mr-1 h-3 w-3" />
                                                        {t('查看')}
                                                      </Link>
                                                    </Button>
                                                    {item.result.status === 'pending' ? (
                                                      <Button
                                                        size="sm"
                                                        className="h-7 text-xs px-2"
                                                        asChild
                                                      >
                                                        <Link
                                                          href={`/evaluation/lesson-results/${item.result.id}`}
                                                        >
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
                                    ))}
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
          ) : (
            <EmptyState
              className="h-full"
              icon={<BookOpen className="h-12 w-12 opacity-50" />}
              title={t('请在左侧选择一个课程')}
              titleClassName="text-gray-400"
            />
          )}
        </div>
      </div>
    </div>
  )
}
