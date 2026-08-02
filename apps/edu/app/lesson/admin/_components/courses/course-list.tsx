'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { StatusBadge } from '@zhiyu/ui'
import { StatusActionBar } from '@/components/shared/status-action-bar'
import type { Course, CourseType } from '@/lib/types/lesson-source'

interface CourseListProps {
  courses: Course[]
  courseType: CourseType
  selectedIds?: string[]
  onSelectId?: (id: string, checked: boolean) => void
  onSelectAll?: (checked: boolean) => void
  onClone?: (course: Course) => void
  onDelete?: (course: Course) => void
  onSubmitApproval?: (course: Course) => void
  onWithdrawApproval?: (course: Course) => void
  onPublish?: (course: Course) => void
  onUnpublish?: (course: Course) => void
  onArchive?: (course: Course) => void
  onViewRejectReason?: (course: Course) => void
  onInviteCoBuild?: (course: Course) => void
  className?: string
  viewHref?: (course: Course) => string
}

export function CourseList({
  courses,
  courseType,
  selectedIds = [],
  onSelectId,
  onSelectAll,
  onClone,
  onDelete,
  onSubmitApproval,
  onWithdrawApproval,
  onPublish,
  onUnpublish,
  onArchive,
  onViewRejectReason,
  onInviteCoBuild,
  className,
  viewHref,
}: CourseListProps) {
  const router = useRouter()
  if (courses.length === 0) return null

  const allSelected = courses.length > 0 && courses.every((c) => selectedIds.includes(c.id))
  const someSelected = courses.some((c) => selectedIds.includes(c.id)) && !allSelected

  const editPath = (courseId: string) =>
    courseType === 'system'
      ? `/lesson/admin/system/add?id=${courseId}`
      : courseType === 'granular'
        ? `/lesson/admin/granular/add?id=${courseId}`
        : `/lesson/admin/hybrid/add?id=${courseId}`

  return (
    <div className={cn('rounded-lg border border-slate-200 bg-white overflow-hidden', className)}>
      <div className="overflow-x-auto">
        <Table className="min-w-[900px]">
          <TableHeader>
            <TableRow className="bg-slate-50 border-b border-slate-100 hover:bg-slate-50">
              <TableHead className="w-10 px-3">
                <Checkbox
                  checked={someSelected ? 'indeterminate' : allSelected}
                  onCheckedChange={(checked) => onSelectAll?.(checked === true)}
                  aria-label="全选"
                />
              </TableHead>
              <TableHead className="w-40 text-xs font-medium text-slate-500">课程名称</TableHead>
              <TableHead className="w-24 text-xs font-medium text-slate-500">课程编码</TableHead>
              <TableHead className="w-16 text-center text-xs font-medium text-slate-500">
                版本
              </TableHead>
              <TableHead className="w-28 text-xs font-medium text-slate-500">所属行业</TableHead>
              <TableHead className="w-28 text-xs font-medium text-slate-500">适用专业</TableHead>
              <TableHead className="w-32 text-xs font-medium text-slate-500">
                所属批次分组
              </TableHead>
              <TableHead className="w-24 text-xs font-medium text-slate-500">创建人</TableHead>
              <TableHead className="w-16 text-center text-xs font-medium text-slate-500">
                状态
              </TableHead>
              <TableHead className="text-right text-xs font-medium text-slate-500">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {courses.map((course) => {
              const isSelected = selectedIds.includes(course.id)

              return (
                <TableRow
                  key={course.id}
                  className={cn(
                    'group border-slate-100 hover:bg-slate-50 transition-colors',
                    isSelected && 'bg-primary/5 hover:bg-primary/5',
                  )}
                >
                  <TableCell className="px-3">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(checked) => onSelectId?.(course.id, checked === true)}
                      aria-label={`选择 ${course.name}`}
                    />
                  </TableCell>
                  <TableCell>
                    <Link href={editPath(course.id)} className="block">
                      <p className="text-sm font-medium text-slate-900 line-clamp-1 max-w-40 hover:text-primary">
                        {course.name}
                      </p>
                    </Link>
                    <StatusBadge status={course.status} />
                  </TableCell>
                  <TableCell className="text-sm text-slate-600 truncate max-w-24">
                    {course.code}
                  </TableCell>
                  <TableCell className="text-center text-sm text-slate-600">
                    {course.version}
                  </TableCell>
                  <TableCell className="text-sm text-slate-600 truncate max-w-28">
                    {course.industry || '-'}
                  </TableCell>
                  <TableCell className="text-sm text-slate-600 truncate max-w-28">
                    {course.major || '-'}
                  </TableCell>
                  <TableCell className="text-sm text-slate-600 truncate max-w-32">
                    {course.batchName || '-'}
                  </TableCell>
                  <TableCell className="text-xs text-slate-500 truncate max-w-24">
                    {course.creator || '-'}
                  </TableCell>
                  <TableCell className="text-center">
                    <StatusBadge status={course.status} />
                  </TableCell>
                  <TableCell className="text-right relative">
                    <StatusActionBar
                      status={course.status}
                      onView={() => router.push(viewHref?.(course) || editPath(course.id))}
                      onEdit={() => router.push(editPath(course.id))}
                      onClone={onClone ? () => onClone(course) : undefined}
                      onSubmit={onSubmitApproval ? () => onSubmitApproval(course) : undefined}
                      onWithdraw={onWithdrawApproval ? () => onWithdrawApproval(course) : undefined}
                      onPublish={onPublish ? () => onPublish(course) : undefined}
                      onUnpublish={onUnpublish ? () => onUnpublish(course) : undefined}
                      onArchive={onArchive ? () => onArchive(course) : undefined}
                      onDelete={onDelete ? () => onDelete(course) : undefined}
                      onInvite={onInviteCoBuild ? () => onInviteCoBuild(course) : undefined}
                      onViewRejectReason={
                        onViewRejectReason ? () => onViewRejectReason(course) : undefined
                      }
                    />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
