"use client"

import { Copy, Eye, Pencil, Rocket, Send, Trash2, Undo2, CheckCircle, XCircle, ArrowDownFromLine, UserPlus, Archive, MessageSquare } from "lucide-react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import { COURSE_STATUS_LABELS, COURSE_STATUS_COLORS } from "@/lib/types/lesson-source"
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
  onApprove?: (course: Course) => void
  onReject?: (course: Course) => void
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
  onApprove,
  onReject,
  onPublish,
  onUnpublish,
  onArchive,
  onViewRejectReason,
  onInviteCoBuild,
  className,
  viewHref,
}: CourseListProps) {
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
                <Badge variant="secondary" className={cn("text-xs mt-1", COURSE_STATUS_COLORS[course.status])}>
                  {COURSE_STATUS_LABELS[course.status]}
                </Badge>
              </div>
              <div className="col-span-1 text-sm text-slate-600 truncate">{course.code}</div>
              <div className="col-span-1 text-center text-sm text-slate-600">{course.version}</div>
              <div className="col-span-1 text-sm text-slate-600 truncate">{course.industry || "-"}</div>
              <div className="col-span-1 text-sm text-slate-600 truncate">{course.major || "-"}</div>
              <div className="col-span-1 text-sm text-slate-600 truncate">{course.batchName || "-"}</div>
              <div className="col-span-1 text-xs text-slate-500 truncate">{course.creator || "-"}</div>
              <div className="col-span-1 text-center">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${COURSE_STATUS_COLORS[course.status]}`}>
                  {COURSE_STATUS_LABELS[course.status]}
                </span>
              </div>
              <div className="col-span-1 text-right relative">
                <div className="flex items-center justify-end gap-1 absolute right-0 top-1/2 -translate-y-1/2 bg-white/95 backdrop-blur-sm z-10 px-2 py-1 rounded-lg shadow-sm border border-slate-100 opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" asChild>
                    <Link href={viewHref?.(course) || editPath(course.id)} className="flex items-center">
                      <Eye className="mr-1 h-3 w-3" />
                      查看详情
                    </Link>
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" asChild>
                    <Link href={editPath(course.id)} className="flex items-center">
                      <Pencil className="mr-1 h-3 w-3" />
                      编辑
                    </Link>
                  </Button>
                  {(course.status === "draft" || course.status === "rejected") && onSubmitApproval && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-blue-600 hover:text-blue-700"
                      onClick={(e) => {
                        e.stopPropagation()
                        onSubmitApproval(course)
                      }}
                    >
                      <Send className="mr-1 h-3 w-3" />
                      提交审批
                    </Button>
                  )}
                  {course.status === "pending" && onWithdrawApproval && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-amber-600 hover:text-amber-700"
                      onClick={(e) => {
                        e.stopPropagation()
                        onWithdrawApproval(course)
                      }}
                    >
                      <Undo2 className="mr-1 h-3 w-3" />
                      撤回审批
                    </Button>
                  )}
                  {course.status === "pending" && onApprove && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-emerald-600 hover:text-emerald-700"
                      onClick={(e) => {
                        e.stopPropagation()
                        onApprove(course)
                      }}
                    >
                      <CheckCircle className="mr-1 h-3 w-3" />
                      通过
                    </Button>
                  )}
                  {course.status === "pending" && onReject && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-red-500 hover:text-red-600"
                      onClick={(e) => {
                        e.stopPropagation()
                        onReject(course)
                      }}
                    >
                      <XCircle className="mr-1 h-3 w-3" />
                      驳回
                    </Button>
                  )}
                  {course.status === "rejected" && onViewRejectReason && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-red-500 hover:text-red-600"
                      onClick={(e) => {
                        e.stopPropagation()
                        onViewRejectReason(course)
                      }}
                    >
                      <MessageSquare className="mr-1 h-3 w-3" />
                      查看驳回原因
                    </Button>
                  )}
                  {course.status === "approved" && onPublish && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-indigo-600 hover:text-indigo-700"
                      onClick={(e) => {
                        e.stopPropagation()
                        onPublish(course)
                      }}
                    >
                      <Rocket className="mr-1 h-3 w-3" />
                      发布
                    </Button>
                  )}
                  {course.status === "published" && onUnpublish && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-red-500 hover:text-red-600"
                      onClick={(e) => {
                        e.stopPropagation()
                        onUnpublish(course)
                      }}
                    >
                      <ArrowDownFromLine className="mr-1 h-3 w-3" />
                      取消发布
                    </Button>
                  )}
                  {course.status !== "pending" && course.status !== "archived" && onArchive && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-purple-600 hover:text-purple-700"
                      onClick={(e) => {
                        e.stopPropagation()
                        onArchive(course)
                      }}
                    >
                      <Archive className="mr-1 h-3 w-3" />
                      归档
                    </Button>
                  )}
                  {onClone && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={(e) => {
                        e.stopPropagation()
                        onClone(course)
                      }}
                    >
                      <Copy className="mr-1 h-3 w-3" />
                      克隆
                    </Button>
                  )}
                  {onInviteCoBuild && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-indigo-600 hover:text-indigo-700"
                      onClick={(e) => {
                        e.stopPropagation()
                        onInviteCoBuild(course)
                      }}
                    >
                      <UserPlus className="mr-1 h-3 w-3" />
                      邀请共建
                    </Button>
                  )}
                  {onDelete && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-red-500 hover:text-red-600"
                      onClick={(e) => {
                        e.stopPropagation()
                        onDelete(course)
                      }}
                    >
                      <Trash2 className="mr-1 h-3 w-3" />
                      删除
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
