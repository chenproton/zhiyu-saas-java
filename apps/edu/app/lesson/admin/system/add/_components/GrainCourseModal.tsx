'use client'

import { useState, useMemo, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Search } from 'lucide-react'
import { courseApi } from '@/lib/api'
import type { Course } from '@/lib/types/lesson'
import { StatusBadge } from '@zhiyu/ui'

interface GrainCourseModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'clone' | 'quote'
  onSelect: (course: Course, mode: 'clone' | 'quote') => void
}

export default function GrainCourseModal({
  open,
  onOpenChange,
  mode,
  onSelect,
}: GrainCourseModalProps) {
  const [searchName, setSearchName] = useState('')
  const [searchCode, setSearchCode] = useState('')
  const [searchCreator, setSearchCreator] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [courses, setCourses] = useState<Course[]>([])
  const pageSize = 5

  useEffect(() => {
    courseApi
      .list({ type: 'granular' })
      .then((res) => {
        setCourses(res.items || [])
      })
      .catch(() => setCourses([]))
  }, [])

  const filtered = useMemo(() => {
    let result = [...courses]
    if (searchName.trim()) {
      result = result.filter((c) => c.name.toLowerCase().includes(searchName.trim().toLowerCase()))
    }
    if (searchCode.trim()) {
      result = result.filter((c) =>
        (c.code || '').toLowerCase().includes(searchCode.trim().toLowerCase()),
      )
    }
    if (searchCreator.trim()) {
      result = result.filter((c) =>
        (c.teacherId || '').toLowerCase().includes(searchCreator.trim().toLowerCase()),
      )
    }
    return result
  }, [searchName, searchCode, searchCreator, courses])

  const totalPages = Math.ceil(filtered.length / pageSize)
  const pageData = filtered.slice((page - 1) * pageSize, page * pageSize)

  const handleConfirm = () => {
    if (!selectedId) return
    const course = courses.find((c) => c.id === selectedId)
    if (!course) return
    onSelect(course, mode)
    onOpenChange(false)
    setSelectedId(null)
    setPage(1)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{mode === 'clone' ? '克隆（可编辑）' : '引用（只读）'}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-4 mb-4">
          <div>
            <Label className="text-xs text-gray-500">节点名称</Label>
            <Input
              placeholder="请输入"
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs text-gray-500">课程编码</Label>
            <Input
              placeholder="请输入"
              value={searchCode}
              onChange={(e) => setSearchCode(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs text-gray-500">创建人</Label>
            <Input
              placeholder="请输入"
              value={searchCreator}
              onChange={(e) => setSearchCreator(e.target.value)}
              className="mt-1"
            />
          </div>
        </div>

        <div className="flex justify-end mb-2">
          <Button size="sm" onClick={() => setPage(1)}>
            <Search className="w-3.5 h-3.5 mr-1" />
            查询
          </Button>
        </div>

        <div className="flex-1 overflow-auto border rounded-lg">
          <Table>
            <TableHeader className="bg-gray-50 sticky top-0">
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>节点名称</TableHead>
                <TableHead>课程编码</TableHead>
                <TableHead>创建人</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>课时</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageData.length > 0 ? (
                pageData.map((course) => (
                  <TableRow
                    key={course.id}
                    className={`cursor-pointer ${selectedId === course.id ? 'bg-blue-50' : ''}`}
                    onClick={() => setSelectedId(course.id)}
                  >
                    <TableCell>
                      <input
                        type="radio"
                        name="grain-course"
                        checked={selectedId === course.id}
                        onChange={() => setSelectedId(course.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{course.name}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{course.code}</TableCell>
                    <TableCell>{course.teacherId}</TableCell>
                    <TableCell>
                      <StatusBadge status={course.status} />
                    </TableCell>
                    <TableCell>{course.nodeCount}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    暂无符合条件的颗粒课
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex justify-between items-center text-xs text-gray-500 mt-2">
          <span>
            共 {filtered.length} 条记录，第 {page}/{totalPages || 1} 页
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              上一页
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              下一页
            </Button>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleConfirm} disabled={!selectedId}>
            确定
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
