"use client"

import { useState, useMemo, useEffect } from "react"
import {
  User, Search, ChevronRight, ChevronDown, ChevronLeft, GraduationCap,
  BookOpen, Users, Eye, BarChart3, FileText, Target,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { SectionCard } from "./section-card"
import { PortraitTab } from "./portrait-tab"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { mockStudentPortraits } from "../_data/mock-teacher-data"

const gradeColorMap: Record<string, string> = {
  A: "bg-emerald-100 text-emerald-700 border-emerald-200",
  B: "bg-blue-100 text-blue-700 border-blue-200",
  C: "bg-amber-100 text-amber-700 border-amber-200",
}

const gradeBgMap: Record<string, string> = {
  A: "from-emerald-500 to-emerald-600",
  B: "from-blue-500 to-blue-600",
  C: "from-amber-500 to-amber-600",
}

interface GradeGroup {
  grade: string
  classes: string[]
}

interface MajorGroup {
  major: string
  grades: GradeGroup[]
}

export function TeacherPortraitsTab() {
  const [searchTerm, setSearchTerm] = useState("")
  const [navSearch, setNavSearch] = useState("")
  const [selectedClass, setSelectedClass] = useState<string>("all")
  const [expandedMajors, setExpandedMajors] = useState<Set<string>>(new Set())
  const [expandedGrades, setExpandedGrades] = useState<Set<string>>(new Set())
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null)
  const [gradeReportOpen, setGradeReportOpen] = useState(false)
  const [abilityProfileOpen, setAbilityProfileOpen] = useState(false)
  const [activeStudent, setActiveStudent] = useState<typeof mockStudentPortraits[0] | null>(null)

  const groupedMajors = useMemo(() => {
    const majorMap = new Map<string, Map<string, Set<string>>>()
    mockStudentPortraits.forEach((s) => {
      if (!majorMap.has(s.major)) majorMap.set(s.major, new Map())
      const gradeMap = majorMap.get(s.major)!
      if (!gradeMap.has(s.grade)) gradeMap.set(s.grade, new Set())
      gradeMap.get(s.grade)!.add(s.className)
    })
    const result: MajorGroup[] = []
    const q = navSearch.trim().toLowerCase()
    majorMap.forEach((gradeMap, major) => {
      const grades: GradeGroup[] = []
      gradeMap.forEach((classes, grade) => {
        const matchedClasses = Array.from(classes).filter((cls) => {
          if (!q) return true
          if (major.toLowerCase().includes(q)) return true
          if (grade.toLowerCase().includes(q)) return true
          if (cls.toLowerCase().includes(q)) return true
          return mockStudentPortraits.some(
            (s) =>
              s.className === cls &&
              (s.name.toLowerCase().includes(q) || s.studentNo.toLowerCase().includes(q))
          )
        })
        if (matchedClasses.length > 0) {
          grades.push({ grade, classes: matchedClasses.sort() })
        }
      })
      if (grades.length > 0) {
        result.push({ major, grades: grades.sort((a, b) => b.grade.localeCompare(a.grade)) })
      }
    })
    return result.sort((a, b) => a.major.localeCompare(b.major))
  }, [navSearch])

  const filteredStudents = useMemo(() => {
    let list = [...mockStudentPortraits]
    if (selectedClass !== "all") {
      list = list.filter((s) => s.className === selectedClass)
    }
    if (searchTerm) {
      const q = searchTerm.toLowerCase()
      list = list.filter((s) => s.name.toLowerCase().includes(q) || s.studentNo.toLowerCase().includes(q))
    }
    return list
  }, [selectedClass, searchTerm])

  const getClassCount = (cls: string) => mockStudentPortraits.filter((s) => s.className === cls).length

  const selectedClassName = selectedClass === "all" ? "全部班级" : selectedClass

  const toggleMajor = (major: string) => {
    setExpandedMajors((prev) => {
      const next = new Set(prev)
      if (next.has(major)) next.delete(major)
      else next.add(major)
      return next
    })
  }

  const toggleGrade = (key: string) => {
    setExpandedGrades((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  useEffect(() => {
    groupedMajors.forEach((m) => {
      setExpandedMajors((prev) => {
        const next = new Set(prev)
        next.add(m.major)
        return next
      })
    })
  }, [groupedMajors])

  if (selectedStudent) {
    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSelectedStudent(null)}
          className="text-sm text-gray-500 hover:text-gray-900 -ml-2"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          返回学生列表
        </Button>
        <PortraitTab />
      </div>
    )
  }

  return (
    <>
    <SectionCard title="我的学生" icon={User} iconColor="blue">
      {/* 顶部统计条 */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        <div className="rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 p-3.5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-sm">
            <Users className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-[11px] text-blue-500 font-medium">总学生数</p>
            <p className="text-lg font-bold text-blue-700">{mockStudentPortraits.length}</p>
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

      <div className="grid grid-cols-12 gap-6">
        {/* 左侧导航 */}
        <div className="col-span-3">
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
                onClick={() => setSelectedClass("all")}
                className={`flex w-full items-center rounded-lg px-3 py-2 text-left text-sm transition-all ${
                  selectedClass === "all"
                    ? "bg-gradient-to-r from-blue-50 to-blue-100/50 text-blue-700 font-semibold shadow-sm border border-blue-200"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <div className={`w-1.5 h-1.5 rounded-full mr-2.5 ${selectedClass === "all" ? "bg-blue-500" : "bg-gray-300"}`} />
                <span>全部班级</span>
                <span className={`ml-auto text-xs font-medium ${selectedClass === "all" ? "text-blue-500" : "text-gray-400"}`}>
                  {mockStudentPortraits.length}
                </span>
              </button>

              <div className="mt-1 border-t border-gray-100 pt-1">
                {groupedMajors.map(({ major, grades }) => (
                  <div key={major} className="mb-0.5">
                    <button
                      onClick={() => toggleMajor(major)}
                      className="flex w-full items-center rounded-lg px-3 py-2 text-left text-xs font-semibold text-gray-500 hover:bg-gray-50 transition-colors"
                    >
                      {expandedMajors.has(major) ? (
                        <ChevronDown className="size-3 mr-1.5 shrink-0 text-gray-400" />
                      ) : (
                        <ChevronRight className="size-3 mr-1.5 shrink-0 text-gray-400" />
                      )}
                      {major}
                    </button>
                    {expandedMajors.has(major) && (
                      <div className="ml-3 space-y-0.5 border-l-2 border-gray-100 pl-2">
                        {grades.map(({ grade, classes }) => {
                          const gradeKey = `${major}::${grade}`
                          return (
                            <div key={gradeKey}>
                              <button
                                onClick={() => toggleGrade(gradeKey)}
                                className="flex w-full items-center rounded-md px-2 py-1.5 text-left text-xs text-gray-400 hover:bg-gray-50 transition-colors"
                              >
                                {expandedGrades.has(gradeKey) ? (
                                  <ChevronDown className="size-2.5 mr-1.5 shrink-0" />
                                ) : (
                                  <ChevronRight className="size-2.5 mr-1.5 shrink-0" />
                                )}
                                {grade}
                              </button>
                              {expandedGrades.has(gradeKey) && (
                                <div className="ml-3 space-y-0.5">
                                  {classes.map((cls) => {
                                    const count = getClassCount(cls)
                                    const isActive = selectedClass === cls
                                    return (
                                      <button
                                        key={cls}
                                        onClick={() => setSelectedClass(cls)}
                                        className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-all ${
                                          isActive
                                            ? "bg-gradient-to-r from-blue-50 to-blue-100/50 text-blue-700 font-semibold border border-blue-200 shadow-sm"
                                            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                                        }`}
                                      >
                                        <div className="flex items-center gap-2.5">
                                          <div className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-blue-500" : "bg-gray-300"}`} />
                                          <span>{cls}</span>
                                        </div>
                                        <span className={`text-xs font-medium ${isActive ? "text-blue-500" : "text-gray-400"}`}>
                                          {count}
                                        </span>
                                      </button>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 右侧学生列表 */}
        <div className="col-span-9">
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
                const gradeColors = gradeColorMap[student.overallGrade] || "bg-gray-100 text-gray-700"
                return (
                  <div
                    key={student.id}
                    onClick={() => setSelectedStudent(student.id)}
                    className="group relative rounded-xl border border-gray-100 bg-white hover:border-blue-200 hover:shadow-md transition-all cursor-pointer overflow-hidden"
                  >
                    <div className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${gradeBgMap[student.overallGrade] || "from-gray-400 to-gray-500"}`} />
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
                              <span className="text-sm font-semibold text-gray-900">{student.name}</span>
                              <Badge className={`text-[10px] font-semibold border ${gradeColors}`}>
                                {student.overallGrade}级
                              </Badge>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Button
                                size="sm"
                                className="h-8 gap-1.5 text-xs bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-sm"
                                onClick={(e) => { e.stopPropagation(); setSelectedStudent(student.id) }}
                              >
                                <Eye className="w-3.5 h-3.5" />
                                查看画像
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 gap-1.5 text-xs border-amber-200 text-amber-600 hover:bg-amber-50"
                                onClick={(e) => { e.stopPropagation(); setActiveStudent(student); setGradeReportOpen(true) }}
                              >
                                <FileText className="w-3.5 h-3.5" />
                                学业成绩
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 gap-1.5 text-xs border-purple-200 text-purple-600 hover:bg-purple-50"
                                onClick={(e) => { e.stopPropagation(); setActiveStudent(student); setAbilityProfileOpen(true) }}
                              >
                                <Target className="w-3.5 h-3.5" />
                                能力档案
                              </Button>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <Badge variant="outline" className="text-[11px] text-gray-500 border-gray-200 bg-gray-50/50">
                              {student.studentNo}
                            </Badge>
                            <span className="text-[11px] text-gray-400">|</span>
                            <span className="text-xs text-gray-500">{student.className}</span>
                            <span className="text-[11px] text-gray-400">|</span>
                            <span className="text-xs text-gray-500">{student.major}</span>
                            <span className="text-[11px] text-gray-400">|</span>
                            <span className="text-xs text-gray-500">{student.grade}</span>
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
              <TableHead className="text-xs">课程</TableHead>
              <TableHead className="text-xs">出勤率</TableHead>
              <TableHead className="text-xs">课堂表现</TableHead>
              <TableHead className="text-xs">作业均分</TableHead>
              <TableHead className="text-xs">期末成绩</TableHead>
              <TableHead className="text-xs">总评</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="text-sm font-medium">网络基础</TableCell>
              <TableCell className="text-sm">{activeStudent?.attendance ?? 90}%</TableCell>
              <TableCell className="text-sm">{activeStudent?.abilities?.[0]?.score ?? 82}</TableCell>
              <TableCell className="text-sm">88</TableCell>
              <TableCell className="text-sm">85</TableCell>
              <TableCell><Badge className="bg-emerald-100 text-emerald-700 text-xs">{activeStudent?.overallGrade || "B"}</Badge></TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="text-sm font-medium">Linux系统管理</TableCell>
              <TableCell className="text-sm">92%</TableCell>
              <TableCell className="text-sm">78</TableCell>
              <TableCell className="text-sm">82</TableCell>
              <TableCell className="text-sm">80</TableCell>
              <TableCell><Badge className="bg-blue-100 text-blue-700 text-xs">B</Badge></TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="text-sm font-medium">路由交换技术</TableCell>
              <TableCell className="text-sm">88%</TableCell>
              <TableCell className="text-sm">75</TableCell>
              <TableCell className="text-sm">79</TableCell>
              <TableCell className="text-sm">78</TableCell>
              <TableCell><Badge className="bg-blue-100 text-blue-700 text-xs">B</Badge></TableCell>
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
            {activeStudent?.name} · {activeStudent?.major} · {activeStudent?.grade}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {activeStudent?.abilities?.map((a) => (
            <div key={a.name} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600 font-medium">{a.name}</span>
                <span className="text-gray-900 font-semibold">{a.score}/100</span>
              </div>
              <Progress value={a.score} className="h-2" />
            </div>
          )) || null}
          <div className="pt-2 border-t border-gray-100">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">综合评级</span>
              <Badge className={`text-xs font-bold ${activeStudent?.overallGrade === "A" ? "bg-emerald-100 text-emerald-700" : activeStudent?.overallGrade === "B" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>
                {activeStudent?.overallGrade}级
              </Badge>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  )
}
