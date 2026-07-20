"use client"

import { useState, useMemo, useEffect } from "react"
import { Search, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { StudentPortraitModal } from "@/components/shared/student-portrait-modal"
import { portraitApi } from "@/lib/api"
import type { StudentAbilityPortrait } from "@/lib/types"

export default function LearningPortraitPage() {
  const [studentAbilityPortraits, setStudentAbilityPortraits] = useState<StudentAbilityPortrait[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await portraitApi.list()
        if (!cancelled) {
          setStudentAbilityPortraits(res.items.map((p) => ({
            ...p,
            updatedAt: p.updatedAt ? new Date(p.updatedAt) : new Date(),
          })))
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to load student portraits", err)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const [search, setSearch] = useState("")
  const [gradeFilter, setGradeFilter] = useState<string>("all")
  const [selectedClass, setSelectedClass] = useState<string>("all")
  const [navSearch, setNavSearch] = useState("")

  const [portraitModalOpen, setPortraitModalOpen] = useState(false)

  const filteredPortraits = useMemo(() => {
    let list = [...studentAbilityPortraits]
    if (gradeFilter !== "all") list = list.filter((p) => p.overallGrade === gradeFilter)
    if (selectedClass !== "all") list = list.filter((p) => p.className === selectedClass)
    if (search.trim()) { const q = search.toLowerCase(); list = list.filter((p) => p.studentName.toLowerCase().includes(q) || p.studentId.toLowerCase().includes(q) || p.className.toLowerCase().includes(q) || p.positionName.toLowerCase().includes(q)) }
    return list
  }, [studentAbilityPortraits, gradeFilter, selectedClass, search])

  const groupedMajors = useMemo(() => {
    const majorMap = new Map<string, Set<string>>()
    studentAbilityPortraits.forEach((p) => {
      if (!majorMap.has(p.majorName)) majorMap.set(p.majorName, new Set())
      majorMap.get(p.majorName)!.add(p.className)
    })
    const result: { major: string; classes: string[] }[] = []
    majorMap.forEach((classes, major) => {
      if (!navSearch.trim() || major.toLowerCase().includes(navSearch.toLowerCase()) || Array.from(classes).some((c) => c.toLowerCase().includes(navSearch.toLowerCase()))) {
        result.push({ major, classes: Array.from(classes).sort() })
      }
    })
    return result.sort((a, b) => a.major.localeCompare(b.major))
  }, [studentAbilityPortraits, navSearch])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">我的学生画像</h1>
        <p className="text-muted-foreground mt-1">基于课程任务、实践场景、毕设评价、档案材料等全量数据，自动生成学生能力画像</p>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* 左侧专业-班级导航 */}
        <div className="col-span-3">
          <div className="rounded-lg border bg-white">
            <div className="border-b p-3">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="搜索专业或班级..." value={navSearch} onChange={(e) => setNavSearch(e.target.value)} className="h-8 pl-7 text-xs" />
              </div>
            </div>
            <div className="max-h-[calc(100vh-280px)] overflow-y-auto p-2">
              <button
                onClick={() => setSelectedClass("all")}
                className={`flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm transition-colors ${selectedClass === 'all' ? 'bg-blue-50 text-blue-700 font-medium' : 'hover:bg-muted'}`}
              >
                <span>全部班级</span>
                <span className="ml-auto text-xs text-muted-foreground">{studentAbilityPortraits.length}</span>
              </button>
              {groupedMajors.map(({ major, classes }) => (
                <div key={major} className="mb-2">
                  <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">{major}</div>
                  <div className="space-y-1">
                    {classes.map((cls) => {
                      const count = studentAbilityPortraits.filter((p) => p.className === cls).length
                      const isActive = selectedClass === cls
                      return (
                        <button
                          key={cls}
                          onClick={() => setSelectedClass(cls)}
                          className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm transition-colors ${isActive ? 'bg-blue-50 text-blue-700 font-medium' : 'hover:bg-muted'}`}
                        >
                          <span>{cls}</span>
                          <span className="text-xs text-muted-foreground">{count}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 右侧学生列表 */}
        <div className="col-span-9 space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1 sm:max-w-xs"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input placeholder="搜索姓名、学号、班级或岗位..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" /></div>
            <Select value={gradeFilter} onValueChange={setGradeFilter}><SelectTrigger className="w-[140px]"><SelectValue placeholder="全部等级" /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="all">全部等级</SelectItem><SelectItem value="A">A - 优秀</SelectItem><SelectItem value="B">B - 良好</SelectItem><SelectItem value="C">C - 中等</SelectItem><SelectItem value="D">D - 及格</SelectItem><SelectItem value="E">E - 不及格</SelectItem></SelectGroup></SelectContent></Select>
          </div>
          <div className="rounded-lg border bg-white px-4 py-3">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead className="w-[100px]">学号</TableHead><TableHead className="w-[100px]">姓名</TableHead><TableHead className="w-[160px]">班级</TableHead><TableHead className="w-[140px]">专业</TableHead><TableHead className="sticky right-0 w-[140px] bg-white text-right">操作</TableHead></TableRow></TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">加载中...</TableCell></TableRow>
                  ) : filteredPortraits.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">暂无画像记录</TableCell></TableRow>
                  ) : (
                    filteredPortraits.map((portrait) => (
                      <TableRow key={portrait.id}>
                        <TableCell><span className="text-sm text-muted-foreground">{portrait.studentId}</span></TableCell>
                        <TableCell><span className="text-sm font-medium">{portrait.studentName}</span></TableCell>
                        <TableCell><span className="text-sm">{portrait.className}</span></TableCell>
                        <TableCell><span className="text-sm text-muted-foreground">{portrait.majorName}</span></TableCell>
                        <TableCell className="sticky right-0 bg-white text-right">
                          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => setPortraitModalOpen(true)}><Eye className="size-3" />查看学生画像</Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </div>

      {/* 学生画像详情弹窗 */}
      <StudentPortraitModal
        open={portraitModalOpen}
        onOpenChange={setPortraitModalOpen}
      />
    </div>
  )
}
