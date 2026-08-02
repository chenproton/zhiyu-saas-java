'use client'

import { useState, useMemo, useEffect } from 'react'
import {
  User,
  Search,
  ChevronLeft,
  GraduationCap,
  Users,
  Eye,
  BarChart3,
  FileText,
  Target,
  Loader2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { SectionCard } from './section-card'
import { PortraitTab } from './portrait-tab'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { jobAbilityResultApi } from '@/lib/api'
import type { JobAbilityResult, JobAbilityPointDetail } from '@/lib/api'

const gradeColorMap: Record<string, string> = {
  卓越: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  优秀: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  良好: 'bg-blue-100 text-blue-700 border-blue-200',
  达标: 'bg-blue-100 text-blue-700 border-blue-200',
  未达标: 'bg-amber-100 text-amber-700 border-amber-200',
}

const gradeBgMap: Record<string, string> = {
  卓越: 'from-emerald-500 to-emerald-600',
  优秀: 'from-emerald-500 to-emerald-600',
  良好: 'from-blue-500 to-blue-600',
  达标: 'from-blue-500 to-blue-600',
  未达标: 'from-amber-500 to-amber-600',
}

interface StudentRow {
  userId: string
  name: string
  studentNo: string
  className: string
  majorName: string
  grade?: string
  achievementRate: number
  totalPoints: number
  achievedPoints: number
  abilities: { name: string; score: number }[]
}

function getGradeBg(grade?: string) {
  return gradeBgMap[grade || ''] || 'from-gray-400 to-gray-500'
}

function getGradeColor(grade?: string) {
  return gradeColorMap[grade || ''] || 'bg-gray-100 text-gray-700'
}

export function TeacherPortraitsTab() {
  const [searchTerm, setSearchTerm] = useState('')
  const [navSearch, setNavSearch] = useState('')
  const [selectedClass, setSelectedClass] = useState<string>('all')
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [gradeReportOpen, setGradeReportOpen] = useState(false)
  const [abilityProfileOpen, setAbilityProfileOpen] = useState(false)
  const [activeStudent, setActiveStudent] = useState<StudentRow | null>(null)
  const [allResults, setAllResults] = useState<JobAbilityResult[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    jobAbilityResultApi
      .list({ limit: 200 })
      .then((res) => {
        if (!cancelled) {
          setAllResults(res.items || [])
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAllResults([])
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  const students = useMemo(() => {
    const map = new Map<string, StudentRow>()
    allResults.forEach((r) => {
      const uid = r.userId
      if (!uid) return
      const existing = map.get(uid)
      if (existing && existing.achievementRate >= r.achievementRate) return
      const abilities: { name: string; score: number }[] = Array.isArray(r.abilityPointDetails)
        ? (r.abilityPointDetails as unknown as JobAbilityPointDetail[]).map((a) => ({
            name: a.abilityPointName || '',
            score: a.score || 0,
          }))
        : []
      map.set(uid, {
        userId: uid,
        name: r.studentName,
        studentNo: r.studentId || '',
        className: r.className || '',
        majorName: r.majorName || '',
        grade: r.grade || undefined,
        achievementRate: r.achievementRate,
        totalPoints: r.totalAbilityPoints,
        achievedPoints: r.achievedAbilityPoints,
        abilities,
      })
    })
    return Array.from(map.values())
  }, [allResults])

  const groupedByClass = useMemo(() => {
    const majorMap = new Map<string, Map<string, string[]>>()
    students.forEach((s) => {
      const major = s.majorName || '未分类'
      if (!majorMap.has(major)) majorMap.set(major, new Map())
      const gradeMap = majorMap.get(major)!
      const cls = s.className || '未分班'
      if (!gradeMap.has(cls)) gradeMap.set(cls, [])
      const q = navSearch.trim().toLowerCase()
      if (
        q &&
        !major.toLowerCase().includes(q) &&
        !cls.toLowerCase().includes(q) &&
        !s.name.toLowerCase().includes(q) &&
        !s.studentNo.toLowerCase().includes(q)
      )
        return
      gradeMap.get(cls)!.push(s.userId)
    })
    const result: { major: string; classes: { className: string; count: number }[] }[] = []
    majorMap.forEach((classMap, major) => {
      const classes = Array.from(classMap.entries())
        .map(([className, userIds]) => ({ className, count: userIds.length }))
        .sort((a, b) => a.className.localeCompare(b.className))
      if (classes.length > 0) result.push({ major, classes })
    })
    return result.sort((a, b) => a.major.localeCompare(b.major))
  }, [students, navSearch])

  const filteredStudents = useMemo(() => {
    let list = students
    if (selectedClass !== 'all') {
      list = list.filter((s) => s.className === selectedClass)
    }
    if (searchTerm) {
      const q = searchTerm.toLowerCase()
      list = list.filter(
        (s) => s.name.toLowerCase().includes(q) || s.studentNo.toLowerCase().includes(q),
      )
    }
    return list
  }, [students, selectedClass, searchTerm])

  const selectedClassName = selectedClass === 'all' ? '全部班级' : selectedClass

  if (selectedUserId) {
    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSelectedUserId(null)}
          className="text-sm text-gray-500 hover:text-gray-900 -ml-2"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          返回学生列表
        </Button>
        <PortraitTab userId={selectedUserId} />
      </div>
    )
  }

  if (loading) {
    return (
      <SectionCard title="我的学生" icon={User} iconColor="blue">
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          <span className="ml-3 text-sm text-gray-500">正在加载学生数据...</span>
        </div>
      </SectionCard>
    )
  }

  return (
    <>
      <SectionCard title="我的学生" icon={User} iconColor="blue">
        <div className="grid grid-cols-3 gap-4 mb-5">
          <div className="rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 p-3.5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-sm">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-[11px] text-blue-500 font-medium">总学生数</p>
              <p className="text-lg font-bold text-blue-700">{students.length}</p>
            </div>
          </div>
          <div className="rounded-lg bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 p-3.5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-sm">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-[11px] text-purple-500 font-medium">当前筛选</p>
              <p className="text-lg font-bold text-purple-700">{selectedClassName}</p>
            </div>
          </div>
          <div className="rounded-lg bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-200 p-3.5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-sm">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-[11px] text-amber-500 font-medium">匹配结果</p>
              <p className="text-lg font-bold text-amber-700">{filteredStudents.length} 人</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-3">
            <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
              <div className="border-b bg-gradient-to-r from-gray-50 to-white p-3">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-gray-400" />
                  <Input
                    placeholder="搜索姓名或学号..."
                    value={navSearch}
                    onChange={(e) => setNavSearch(e.target.value)}
                    className="h-9 pl-8 text-xs border-gray-200 bg-white focus:border-blue-300"
                  />
                </div>
              </div>
              <div className="max-h-[calc(100vh-520px)] overflow-y-auto p-2">
                <button
                  onClick={() => setSelectedClass('all')}
                  className={`flex w-full items-center rounded-lg px-3 py-2 text-left text-sm transition-all ${
                    selectedClass === 'all'
                      ? 'bg-gradient-to-r from-blue-50 to-blue-100/50 text-blue-700 font-semibold shadow-sm border border-blue-200'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <div
                    className={`w-1.5 h-1.5 rounded-full mr-2.5 ${selectedClass === 'all' ? 'bg-blue-500' : 'bg-gray-300'}`}
                  />
                  <span>全部班级</span>
                  <span
                    className={`ml-auto text-xs font-medium ${selectedClass === 'all' ? 'text-blue-500' : 'text-gray-400'}`}
                  >
                    {students.length}
                  </span>
                </button>
                <div className="mt-1 border-t border-gray-100 pt-1">
                  {groupedByClass.map(({ major, classes }) => (
                    <div key={major} className="mb-0.5">
                      <div className="flex items-center rounded-lg px-3 py-2 text-xs font-semibold text-gray-500">
                        {major}
                      </div>
                      <div className="ml-3 space-y-0.5 border-l-2 border-gray-100 pl-2">
                        {classes.map(({ className, count }) => {
                          const isActive = selectedClass === className
                          return (
                            <button
                              key={className}
                              onClick={() => setSelectedClass(className)}
                              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-all ${
                                isActive
                                  ? 'bg-gradient-to-r from-blue-50 to-blue-100/50 text-blue-700 font-semibold border border-blue-200 shadow-sm'
                                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                <div
                                  className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-blue-500' : 'bg-gray-300'}`}
                                />
                                <span>{className}</span>
                              </div>
                              <span
                                className={`text-xs font-medium ${isActive ? 'text-blue-500' : 'text-gray-400'}`}
                              >
                                {count}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-9">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="搜索姓名或学号..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-10 text-sm border-gray-200 bg-white focus:border-blue-300 rounded-xl"
              />
            </div>

            {filteredStudents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <Search className="w-12 h-12 mb-3 text-gray-200" />
                <p className="text-sm font-medium">暂无匹配的学生</p>
                <p className="text-xs mt-1">请尝试调整搜索条件或筛选班级</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[60vh] overflow-auto pr-1">
                {filteredStudents.map((student) => {
                  const gradeColors = getGradeColor(student.grade)
                  return (
                    <div
                      key={student.userId}
                      className="group relative rounded-xl border border-gray-100 bg-white hover:border-blue-200 hover:shadow-md transition-all cursor-pointer overflow-hidden"
                    >
                      <div
                        className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${getGradeBg(student.grade)}`}
                      />
                      <div className="p-4 pl-5">
                        <div className="flex items-center gap-4">
                          <Avatar className="w-11 h-11 ring-2 ring-white shadow-sm">
                            <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-600 text-white text-sm font-bold">
                              {student.name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-gray-900">
                                  {student.name}
                                </span>
                                {student.grade && (
                                  <Badge
                                    className={`text-[10px] font-semibold border ${gradeColors}`}
                                  >
                                    {student.grade}
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Button
                                  size="sm"
                                  className="h-8 gap-1.5 text-xs bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-sm"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setSelectedUserId(student.userId)
                                  }}
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  查看画像
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 gap-1.5 text-xs border-amber-200 text-amber-600 hover:bg-amber-50"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setActiveStudent(student)
                                    setGradeReportOpen(true)
                                  }}
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                  学业成绩
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 gap-1.5 text-xs border-purple-200 text-purple-600 hover:bg-purple-50"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setActiveStudent(student)
                                    setAbilityProfileOpen(true)
                                  }}
                                >
                                  <Target className="w-3.5 h-3.5" />
                                  能力档案
                                </Button>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                              <Badge
                                variant="outline"
                                className="text-[11px] text-gray-500 border-gray-200 bg-gray-50/50"
                              >
                                {student.studentNo}
                              </Badge>
                              <span className="text-[11px] text-gray-400">|</span>
                              <span className="text-xs text-gray-500">{student.className}</span>
                              <span className="text-[11px] text-gray-400">|</span>
                              <span className="text-xs text-gray-500">{student.majorName}</span>
                              <span className="text-[11px] text-gray-400">|</span>
                              <span className="text-xs text-gray-500">
                                达成率 {student.achievementRate.toFixed(1)}%
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </SectionCard>
      <Dialog open={gradeReportOpen} onOpenChange={setGradeReportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-amber-600" />
              查看学生成绩单
            </DialogTitle>
            <DialogDescription>
              {activeStudent?.name} · {activeStudent?.studentNo} · {activeStudent?.className}
            </DialogDescription>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="text-xs">指标</TableHead>
                <TableHead className="text-xs">数值</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="text-sm font-medium">总能力点</TableCell>
                <TableCell className="text-sm">{activeStudent?.totalPoints ?? '-'}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="text-sm font-medium">已达成能力点</TableCell>
                <TableCell className="text-sm">{activeStudent?.achievedPoints ?? '-'}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="text-sm font-medium">达标率</TableCell>
                <TableCell className="text-sm">
                  {activeStudent?.achievementRate.toFixed(1) ?? '-'}%
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="text-sm font-medium">认定等级</TableCell>
                <TableCell>
                  <Badge className={`text-xs ${getGradeColor(activeStudent?.grade)}`}>
                    {activeStudent?.grade || '-'}
                  </Badge>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>
      <Dialog open={abilityProfileOpen} onOpenChange={setAbilityProfileOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-purple-600" />
              查看学生能力报告
            </DialogTitle>
            <DialogDescription>
              {activeStudent?.name} · {activeStudent?.majorName} · {activeStudent?.className}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {activeStudent?.abilities?.length ? (
              activeStudent.abilities.map((a, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600 font-medium">{a.name}</span>
                    <span className="text-gray-900 font-semibold">{a.score.toFixed(1)}/100</span>
                  </div>
                  <Progress value={Math.min(a.score, 100)} className="h-2" />
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-400 text-center py-4">暂无能力点数据</p>
            )}
            <div className="pt-2 border-t border-gray-100">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">综合评级</span>
                <Badge className={`text-xs font-bold ${getGradeColor(activeStudent?.grade)}`}>
                  {activeStudent?.grade || '-'}
                </Badge>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
