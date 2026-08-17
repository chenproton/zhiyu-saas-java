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
import { useT } from '@/lib/i18n/locale-provider'

interface CourseListProps {
  activeTab?: 'my' | 'collab' | 'public' | 'all'
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
  activeTab,
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
  const t = useT()
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
        <Table resizable storageKey="lesson.courses.list">
          <TableHeader>
            <TableRow className="bg-slate-50 border-b border-slate-100 hover:bg-slate-50">
              <TableHead
                columnKey="select"
                defaultWidth={40}
                minWidth={40}
                resizable={false}
                className="px-3"
              >
                <Checkbox
                  checked={someSelected ? 'indeterminate' : allSelected}
                  onCheckedChange={(checked) => onSelectAll?.(checked === true)}
                  aria-label={t('全选')}
                />
              </TableHead>
              <TableHead
                columnKey="name"
                defaultWidth={160}
                minWidth={96}
                className="text-xs font-medium text-slate-500"
              >
                {t('课程名称')}
              </TableHead>
              <TableHead
                columnKey="code"
                defaultWidth={96}
                minWidth={64}
                className="text-xs font-medium text-slate-500"
              >
                {t('课程编码')}
              </TableHead>
              <TableHead
                columnKey="version"
                defaultWidth={64}
                minWidth={48}
                className="text-center text-xs font-medium text-slate-500"
              >
                {t('版本')}
              </TableHead>
              <TableHead
                columnKey="industry"
                defaultWidth={112}
                minWidth={72}
                className="text-xs font-medium text-slate-500"
              >
                {t('所属行业')}
              </TableHead>
              <TableHead
                columnKey="major"
                defaultWidth={112}
                minWidth={72}
                className="text-xs font-medium text-slate-500"
              >
                {t('适用专业')}
              </TableHead>
              <TableHead
                columnKey="batch"
                defaultWidth={128}
                minWidth={96}
                className="text-xs font-medium text-slate-500"
              >
                {t('所属批次分组')}
              </TableHead>
              <TableHead
                columnKey="creator"
                defaultWidth={96}
                minWidth={64}
                className="text-xs font-medium text-slate-500"
              >
                {t('创建人')}
              </TableHead>
              <TableHead
                columnKey="status"
                defaultWidth={64}
                minWidth={48}
                className="text-center text-xs font-medium text-slate-500"
              >
                {t('状态')}
              </TableHead>
              <TableHead
                columnKey="actions"
                defaultWidth={64}
                minWidth={40}
                className="text-right text-xs font-medium text-slate-500"
              >
                {t('操作')}
              </TableHead>
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
                      aria-label={t('选择 {name}', { name: course.name })}
                    />
                  </TableCell>
                  <TableCell>
                    <Link href={editPath(course.id)} className="block">
                      <p className="text-sm font-medium text-slate-900 line-clamp-1 max-w-full hover:text-primary">
                        {course.name}
                      </p>
                    </Link>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      <StatusBadge status={course.status} />
                    </div>
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
                      isPublicPool={activeTab === 'public'}
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
