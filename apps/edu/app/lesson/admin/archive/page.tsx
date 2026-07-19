"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Search,
  Archive,
  GraduationCap,
  Building2,
  MoreHorizontal,
} from "lucide-react"
import { courseApi, lessonBatchApi } from "@/lib/api"
import type { Course, LessonBatch } from "@/lib/types/lesson"
import { COURSE_STATUS_LABELS, COURSE_STATUS_COLORS } from "@/lib/types/lesson-source"
import { useToast } from "@/hooks/use-toast"

export default function LessonArchivePage() {
  const { toast } = useToast()
  const [courses, setCourses] = useState<Course[]>([])
  const [batches, setBatches] = useState<LessonBatch[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState("")
  const [selectedMajor, setSelectedMajor] = useState<string | null>(null)

  const loadData = async () => {
    setLoading(true)
    try {
      const [courseRes, batchRes] = await Promise.all([
        courseApi.list({ status: "archived", limit: 1000 }),
        lessonBatchApi.list({ limit: 1000 }),
      ])
      setCourses(courseRes.items)
      setBatches(batchRes.items)
    } catch (err: any) {
      toast({ variant: "destructive", title: "加载失败", description: err.message || "无法获取归档数据" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const majors = useMemo(() => {
    const set = new Set<string>()
    courses.forEach((c) => {
      if (c.majorName) set.add(c.majorName)
    })
    return Array.from(set).sort()
  }, [courses])

  const filtered = useMemo(() => {
    let result = courses
    if (selectedMajor) {
      result = result.filter((c) => c.majorName === selectedMajor)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.code.toLowerCase().includes(q) ||
          (c.majorName || "").toLowerCase().includes(q) ||
          (c.category || "").toLowerCase().includes(q)
      )
    }
    return result
  }, [courses, selectedMajor, search])

  const batchMap = useMemo(() => new Map(batches.map((b) => [b.id, b])), [batches])

  const handleRestore = async (course: Course) => {
    try {
      await courseApi.saveDraft(course.id)
      await loadData()
      toast({ title: "已恢复" })
    } catch (err: any) {
      toast({ variant: "destructive", title: "恢复失败", description: err.message || "请稍后重试" })
    }
  }

  const editHref = (type: Course["type"], id: string) => {
    if (type === "system") return `/lesson/admin/system/add?id=${id}`
    if (type === "granular") return `/lesson/admin/granular/add?id=${id}`
    return `/lesson/admin/hybrid/add?id=${id}`
  }

  return (
    <div className="flex gap-6 h-full -m-6">
      {/* Left Sidebar */}
      <div className="w-60 shrink-0 border-r border-gray-200 bg-white flex flex-col">
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Archive className="h-4 w-4 text-primary" />
            <h2 className="font-medium text-sm text-gray-800">按专业归档</h2>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-0.5">
          <div
            onClick={() => setSelectedMajor(null)}
            className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md cursor-pointer text-sm transition-colors ${
              selectedMajor === null
                ? "bg-primary/10 text-primary font-medium"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <span className="truncate">全部专业</span>
          </div>
          {majors.map((major) => (
            <div
              key={major}
              onClick={() => setSelectedMajor(major)}
              className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md cursor-pointer text-sm transition-colors ${
                selectedMajor === major
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <span className="truncate">{major}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right Content */}
      <div className="flex-1 min-w-0 p-6 pl-0 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">课程历史档案库</h1>
          <p className="text-muted-foreground mt-1">
            查看已归档的课程记录，支持恢复为草稿继续编辑
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">归档课程总数</p>
                  <p className="text-2xl font-bold mt-1">{courses.length}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-purple-100 text-purple-600">
                  <Archive className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">覆盖专业</p>
                  <p className="text-2xl font-bold mt-1">{majors.length}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-blue-100 text-blue-600">
                  <Building2 className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">课程类型</p>
                  <p className="text-2xl font-bold mt-1">
                    {new Set(courses.map((c) => c.type)).size}
                  </p>
                </div>
                <div className="p-2.5 rounded-lg bg-green-100 text-green-600">
                  <GraduationCap className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search + Table */}
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="flex flex-col gap-4 p-5">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索课程名称 / 编码 / 专业 / 分类"
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </CardContent>

          <CardContent className="pt-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>课程名称</TableHead>
                  <TableHead>课程编码</TableHead>
                  <TableHead>课程类型</TableHead>
                  <TableHead>版本</TableHead>
                  <TableHead>适用专业</TableHead>
                  <TableHead>所属批次分组</TableHead>
                  <TableHead>归档时间</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-10 text-muted-foreground">
                      加载中...
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-10 text-muted-foreground">
                      暂无归档课程
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((course) => (
                    <TableRow key={course.id}>
                      <TableCell>
                        <div>
                          <span className="font-medium">{course.name}</span>
                          <p className="text-xs text-muted-foreground">
                            {course.category || "-"} · {course.majorName || "-"}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{course.code}</TableCell>
                      <TableCell className="text-sm">{course.type === "system" ? "体系课" : course.type === "granular" ? "颗粒课" : "混合课"}</TableCell>
                      <TableCell className="text-sm">{course.version || "-"}</TableCell>
                      <TableCell className="text-sm">{course.majorName || "-"}</TableCell>
                      <TableCell className="text-sm">{course.batchId ? batchMap.get(course.batchId)?.name || course.batchId : "-"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(course.updatedAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${COURSE_STATUS_COLORS[course.status]}`}>
                          {COURSE_STATUS_LABELS[course.status]}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={editHref(course.type, course.id)}>
                                查看
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleRestore(course)} className="text-blue-600">
                              恢复
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
