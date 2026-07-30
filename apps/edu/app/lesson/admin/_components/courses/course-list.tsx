"use client"

import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import { StatusBadge } from "@zhiyu/ui"
import { StatusActionBar } from "@/components/shared/status-action-bar"
import type { Course, CourseType } from "@/lib/types/lesson-source"

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

  const editPath = (courseId: string) => courseType === "system"
    ? `/lesson/admin/system/add?id=${courseId}`
    : courseType === "granular"
      ? `/lesson/admin/granular/add?id=${courseId}`
      : `/lesson/admin/hybrid/add?id=${courseId}`

  return (
    <div className={cn("rounded-lg border border-slate-200 bg-white overflow-hidden", className)}>
      {/* Header */}
      <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-slate-50 text-xs font-medium text-slate-500 border-b border-slate-100 items-center">
        <div className="col-span-1 flex justify-center">
          <Checkbox
            checked={someSelected ? "indeterminate" : allSelected}
            onCheckedChange={(checked) => onSelectAll?.(checked === true)}
            aria-label="全选"
          />
        </div>
        <div className="col-span-2">课程名称</div>
        <div className="col-span-1">课程编码</div>
        <div className="col-span-1 text-center">版本</div>
        <div className="col-span-1">所属行业</div>
        <div className="col-span-1">适用专业</div>
        <div className="col-span-1">所属批次分组</div>
        <div className="col-span-1">创建人</div>
        <div className="col-span-1 text-center">状态</div>
        <div className="col-span-1 text-right">操作</div>
      </div>

      {/* Body */}
      <div className="divide-y divide-slate-100">
        {courses.map((course) => {
          const isSelected = selectedIds.includes(course.id)

          return (
            <div
              key={course.id}
              className={cn(
                "grid grid-cols-12 gap-4 px-4 py-3 items-center hover:bg-slate-50 transition-colors group relative",
                isSelected && "bg-primary/5"
              )}
            >
              <div className="col-span-1 flex justify-center">
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={(checked) => onSelectId?.(course.id, checked === true)}
                  aria-label={`选择 ${course.name}`}
                />
              </div>
              <div className="col-span-2">
                <Link href={editPath(course.id)} className="block">
                  <p className="text-sm font-medium text-slate-900 line-clamp-1 hover:text-primary">{course.name}</p>
                </Link>
                <StatusBadge status={course.status} />
              </div>
              <div className="col-span-1 text-sm text-slate-600 truncate">{course.code}</div>
              <div className="col-span-1 text-center text-sm text-slate-600">{course.version}</div>
              <div className="col-span-1 text-sm text-slate-600 truncate">{course.industry || "-"}</div>
              <div className="col-span-1 text-sm text-slate-600 truncate">{course.major || "-"}</div>
              <div className="col-span-1 text-sm text-slate-600 truncate">{course.batchName || "-"}</div>
              <div className="col-span-1 text-xs text-slate-500 truncate">{course.creator || "-"}</div>
              <div className="col-span-1 text-center">
                <StatusBadge status={course.status} />
              </div>
              <div className="col-span-1 text-right relative">
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
                  onViewRejectReason={onViewRejectReason ? () => onViewRejectReason(course) : undefined}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
