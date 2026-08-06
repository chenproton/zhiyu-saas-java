'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Eye,
  FileText,
  GraduationCap,
  PenLine,
  Search,
  Users,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@zhiyu/ui'
import { Card, CardContent } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { portalApi } from '@/lib/api'
import { reportError } from '@/lib/error-handling'
import type { WorkspaceClassPlan, WorkspaceClassSession } from '@/lib/types'
import { useT } from '@/lib/i18n/locale-provider'

interface HybridGradingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sessionTitle: string
  className?: string
}

interface CourseStudent {
  studentId: string
  studentName: string
  studentNumber: string
  className: string
  enrollmentYear: number
  status: 'pending' | 'graded'
  submittedAt: string
}

interface SessionGroup {
  sessionId: string
  sessionLabel: string
  venue: string
  students: CourseStudent[]
  pendingCount: number
  gradedCount: number
}

interface CourseGroup {
  planId: string
  courseName: string
  className: string
  studentCount: number
  sessions: SessionGroup[]
  pendingCount: number
  gradedCount: number
}

function buildCourseGroups(
  classPlans: WorkspaceClassPlan[],
  classSessions: WorkspaceClassSession[],
  sessionLabelBuilder: (sess: WorkspaceClassSession) => string,
): CourseGroup[] {
  return classPlans.map((plan) => {
    const sessions = classSessions
      .filter((s) => s.courseId === plan.id)
      .sort((a, b) => a.week - b.week)
    const sessionGroups: SessionGroup[] = sessions.map((sess) => ({
      sessionId: sess.id,
      sessionLabel: sessionLabelBuilder(sess),
      venue: sess.venue,
      students: [],
      pendingCount: 0,
      gradedCount: 0,
    }))
    return {
      planId: plan.id,
      courseName: plan.course,
      className: plan.name,
      studentCount: plan.students,
      sessions: sessionGroups,
      pendingCount: 0,
      gradedCount: 0,
    }
  })
}

export function HybridGradingDialog({
  open,
  onOpenChange,
  sessionTitle,
  className,
}: HybridGradingDialogProps) {
  const t = useT()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set())
  const [classPlans, setClassPlans] = useState<WorkspaceClassPlan[]>([])
  const [classSessions, setClassSessions] = useState<WorkspaceClassSession[]>([])

  useEffect(() => {
    portalApi
      .workspaceDashboard({ role: 'teacher' })
      .then((res) => {
        setClassPlans(res.classPlans || [])
        setClassSessions(res.classSessions || [])
      })
      .catch((err) => reportError(err, '加载工作台班级/课时数据'))
  }, [])

  const courseGroups = useMemo(
    () =>
      buildCourseGroups(classPlans, classSessions, (sess) =>
        t('第 {week} 周 · {weekday} {period}', {
          week: sess.week,
          weekday: sess.weekday,
          period: sess.period,
        }),
      ),
    [classPlans, classSessions, t],
  )

  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return courseGroups
    const q = searchQuery.trim().toLowerCase()
    return courseGroups.filter(
      (g) => g.courseName.toLowerCase().includes(q) || g.className.toLowerCase().includes(q),
    )
  }, [courseGroups, searchQuery])

  const selectedCourse = useMemo(
    () => courseGroups.find((g) => g.planId === selectedPlanId),
    [courseGroups, selectedPlanId],
  )

  const toggleSession = (sessionId: string) => {
    setExpandedSessions((prev) => {
      const next = new Set(prev)
      if (next.has(sessionId)) next.delete(sessionId)
      else next.add(sessionId)
      return next
    })
  }

  const innerOpenChange = (v: boolean) => {
    if (v) {
      setSelectedPlanId(courseGroups[0]?.planId || null)
      setExpandedSessions(new Set())
    }
    onOpenChange(v)
  }

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
              <div className="relative w-full">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  placeholder={t('搜索课程...')}
                  className="pl-9 text-sm"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-1">
              {filteredGroups.map((group) => (
                <button
                  key={group.planId}
                  onClick={() => {
                    setSelectedPlanId(group.planId)
                    setExpandedSessions(new Set())
                  }}
                  className={cn(
                    'w-full text-left rounded-lg p-2.5 transition-all border',
                    selectedPlanId === group.planId
                      ? 'bg-amber-50 border-amber-300 shadow-sm'
                      : 'bg-white border-transparent hover:bg-gray-50 hover:border-gray-200',
                  )}
                >
                  <div className="flex items-start gap-2">
                    <BookOpen
                      className={cn(
                        'h-4 w-4 mt-0.5 shrink-0',
                        selectedPlanId === group.planId ? 'text-amber-600' : 'text-gray-400',
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <p
                        className={cn(
                          'text-sm font-medium truncate',
                          selectedPlanId === group.planId ? 'text-amber-700' : 'text-gray-700',
                        )}
                      >
                        {group.courseName}
                      </p>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {t('{className} · {count}人', {
                          className: group.className,
                          count: group.studentCount,
                        })}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5">
                        {group.pendingCount > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 font-medium">
                            {t('待评 {count}', { count: group.pendingCount })}
                          </span>
                        )}
                        {group.gradedCount > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-50 text-green-600 font-medium">
                            {t('已评 {count}', { count: group.gradedCount })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Right content — Session list with students */}
          <div className="flex-1 overflow-y-auto bg-gray-50">
            {selectedCourse ? (
              <div className="p-6 space-y-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">
                    {selectedCourse.courseName}
                  </h2>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-xs font-normal text-gray-500">
                      {selectedCourse.className}
                    </Badge>
                    <Badge variant="secondary" className="text-xs font-normal">
                      {t('{count}人', { count: selectedCourse.studentCount })}
                    </Badge>
                  </div>
                </div>

                {selectedCourse.sessions.length === 0 ? (
                  <Card>
                    <CardContent className="py-12 text-center text-gray-400">
                      <FileText className="h-10 w-10 mx-auto mb-3 opacity-50" />
                      <p className="text-sm">{t('该课程暂无节次数据')}</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {selectedCourse.sessions.map((session) => {
                      const isExpanded = expandedSessions.has(session.sessionId)
                      const groupedByClass = session.students.reduce<
                        Record<string, CourseStudent[]>
                      >((acc, s) => {
                        if (!acc[s.className]) acc[s.className] = []
                        acc[s.className].push(s)
                        return acc
                      }, {})

                      return (
                        <Collapsible
                          key={session.sessionId}
                          open={isExpanded}
                          onOpenChange={() => toggleSession(session.sessionId)}
                        >
                          <Card className="overflow-hidden">
                            <CollapsibleTrigger asChild>
                              <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50/50 transition-colors">
                                <div className="flex items-center gap-3">
                                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100">
                                    <FileText className="h-4 w-4 text-amber-600" />
                                  </div>
                                  <div>
                                    <p className="text-sm font-semibold text-gray-800">
                                      {session.sessionLabel}
                                    </p>
                                    <div className="flex items-center gap-3 mt-1">
                                      <span className="text-xs text-gray-500">{session.venue}</span>
                                      <span className="text-xs text-gray-400">
                                        {t('{count} 位学生', { count: session.students.length })}
                                      </span>
                                      {session.pendingCount > 0 && (
                                        <span className="text-xs text-amber-600 font-medium">
                                          {t('待评分 {count}', { count: session.pendingCount })}
                                        </span>
                                      )}
                                      {session.gradedCount > 0 && (
                                        <span className="text-xs text-green-600 font-medium">
                                          {t('已评分 {count}', { count: session.gradedCount })}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
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
                                  {Object.entries(groupedByClass).map(([cls, students]) => (
                                    <div key={cls}>
                                      <div className="flex items-center gap-1.5 mb-1.5 px-1">
                                        <Users className="h-3 w-3 text-gray-400" />
                                        <span className="text-xs text-gray-500">{cls}</span>
                                        <span className="text-[10px] text-gray-400">
                                          {t('({count}人)', { count: students.length })}
                                        </span>
                                      </div>
                                      <div className="rounded-lg border border-slate-200 divide-y divide-slate-100">
                                        {students.map((item) => (
                                          <div
                                            key={item.studentId}
                                            className="flex items-center justify-between p-2.5 hover:bg-slate-50/50 transition-colors"
                                          >
                                            <div className="flex items-center gap-3">
                                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-600 text-xs font-medium">
                                                {item.studentName.charAt(0)}
                                              </div>
                                              <div>
                                                <div className="flex items-center gap-2">
                                                  <span className="font-medium text-gray-800 text-sm">
                                                    {item.studentName}
                                                  </span>
                                                  <span className="text-xs text-gray-400">
                                                    {item.studentNumber}
                                                  </span>
                                                  <StatusBadge
                                                    status={
                                                      item.status === 'pending'
                                                        ? 'pending'
                                                        : 'graded'
                                                    }
                                                    label={
                                                      item.status === 'pending'
                                                        ? t('待评分')
                                                        : t('已评分')
                                                    }
                                                    className="text-[10px] border"
                                                  />
                                                </div>
                                                <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
                                                  <Clock className="h-3 w-3" />
                                                  {item.submittedAt}
                                                </div>
                                              </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                              <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-7 text-xs"
                                              >
                                                <Eye className="mr-1 h-3 w-3" />
                                                {t('查看')}
                                              </Button>
                                              {item.status === 'pending' ? (
                                                <Button size="sm" className="h-7 text-xs">
                                                  <PenLine className="mr-1 h-3 w-3" />
                                                  {t('评分')}
                                                </Button>
                                              ) : (
                                                <Button
                                                  variant="ghost"
                                                  size="sm"
                                                  className="h-7 text-xs text-green-600"
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
              <div className="h-full flex flex-col items-center justify-center text-gray-400">
                <GraduationCap className="h-12 w-12 mb-3 opacity-50" />
                <p className="text-sm">{t('请在左侧选择一个课程')}</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
