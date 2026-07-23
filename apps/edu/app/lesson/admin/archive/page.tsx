"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import {
  Search,
  GraduationCap,
  Eye,
  Power,
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">课程历史档案库</h1>
        <p className="text-muted-foreground mt-1">
          查看已归档的课程记录，支持恢复为草稿继续编辑
        </p>
      </div>

      <div className="flex gap-4 items-start">
        <div className="w-64 shrink-0 rounded-lg border border-gray-100 bg-white shadow-sm p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
            <GraduationCap className="h-4 w-4 text-primary" />按专业归档
          </h3>
          <ScrollArea className="h-[500px]">
            <div className="space-y-1">
              <button
                onClick={() => setSelectedMajor(null)}
                className={cn(
                  "w-full text-left px-2 py-1.5 text-sm rounded-md transition-colors",
                  selectedMajor === null ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                )}
              >
                全部专业
              </button>
              {majors.map((major) => (
                <button
                  key={major}
                  onClick={() => setSelectedMajor(major)}
                  className={cn(
                    "w-full text-left px-2 py-1.5 text-sm rounded-md transition-colors",
                    selectedMajor === major ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                  )}
                >
                  {major}
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>

        <div className="flex-1 space-y-4">
          <div className="rounded-lg border border-gray-100 bg-white shadow-sm p-4">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索课程名称 / 编码 / 专业 / 分类"
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="rounded-lg border border-gray-100 bg-white shadow-sm">
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
                    <TableRow key={course.id} className="group">
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
                      <TableCell className="text-right relative">
                        <div className="flex items-center justify-end gap-1 absolute right-0 top-1/2 -translate-y-1/2 bg-white/95 backdrop-blur-sm z-10 px-2 py-1 rounded-lg shadow-sm border border-slate-100 opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            asChild
                          >
                            <Link href={editHref(course.type, course.id)}>
                              <Eye className="mr-1 h-3 w-3" />
                              查看
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-blue-600 hover:text-blue-700"
                            onClick={() => handleRestore(course)}
                          >
                            <Power className="mr-1 h-3 w-3" />
                            恢复
                          </Button>
                        </div>
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
  )
}
