"use client"

import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { StatusBadge } from "@/components/shared/status-badge"
import { courseApi, lessonBatchApi } from "@/lib/api"
import type { Course } from "@/lib/types/lesson"
import type { LessonBatch } from "@/lib/types/lesson"
import { useApprovals } from "@/hooks/use-approvals"
import { useSubmitterNames } from "@/hooks/use-submitter-names"
import { ApprovalListPage, type ApprovalColumn } from "@/components/shared/approval-list-page"
import type { ApprovalStepInfo } from "@/hooks/use-approvals"

const COURSE_TYPE_LABELS: Record<Course["type"], string> = {
  system: "体系课",
  granular: "颗粒课",
  hybrid: "混合课",
}

interface ApprovalView {
  id: string
  courseId: string
  courseName: string
  courseCode: string
  version: string
  courseType: Course["type"]
  major?: string
  batchName?: string
  submitterId: string
  status: string
  submittedAt: string
  stepInfo?: ApprovalStepInfo
  history?: any[]
}

export default function CourseApprovalsPage() {
  const { records, loading, approve, reject, batchApprove, batchReject, getStepInfo } = useApprovals({ targetType: "course" })
  const { getName } = useSubmitterNames()
  const [courseMap, setCourseMap] = useState<Map<string, Course>>(new Map())
  const [batchMap, setBatchMap] = useState<Map<string, LessonBatch>>(new Map())

  useEffect(() => {
    Promise.all([courseApi.list({ limit: 1000 }), lessonBatchApi.list({ limit: 1000 })]).then(
      ([courseRes, batchRes]) => {
        setCourseMap(new Map(courseRes.items.map((c) => [c.id, c])))
        setBatchMap(new Map(batchRes.items.map((b) => [b.id, b])))
      }
    ).catch(() => {})
  }, [])

  const columns: ApprovalColumn<ApprovalView>[] = [
    { header: "课程名称", cell: (i) => <span className="font-medium">{i.courseName}</span> },
    { header: "课程编码", cell: (i) => <span className="text-sm text-gray-600">{i.courseCode}</span> },
    { header: "版本", className: "text-center text-sm text-gray-600", cell: (i) => i.version },
    {
      header: "类型", className: "text-center",
      cell: (i) => <Badge variant="secondary" className="px-1.5 py-0 text-xs">{COURSE_TYPE_LABELS[i.courseType] || i.courseType}</Badge>,
    },
    { header: "专业", cell: (i) => <span className="text-sm text-gray-600">{i.major || "-"}</span> },
    { header: "所属批次", cell: (i) => <span className="text-sm text-gray-600">{i.batchName || "-"}</span> },
    { header: "创建人", cell: (i) => <span className="text-sm text-gray-600">{getName(i.submitterId)}</span> },
    { header: "提交审批日期", cell: (i) => <span className="text-sm text-gray-600">{i.submittedAt}</span> },
    {
      header: "状态", className: "text-center",
      cell: (i) => <StatusBadge status={i.status} />,
    },
    {
      header: "当前步骤", className: "text-center",
      cell: (i) => i.stepInfo ? (
        <Badge variant="outline" className="text-xs">
          {i.stepInfo.currentStepName}
          {i.stepInfo.totalSteps > 1 && (
            <span className="ml-1 text-gray-400">({i.stepInfo.currentStepIndex + 1}/{i.stepInfo.totalSteps})</span>
          )}
        </Badge>
      ) : <span className="text-xs text-gray-400">-</span>,
    },
  ]

  const mapRecord = (a: any): ApprovalView => {
    const course = courseMap.get(a.targetId)
    const batch = course?.batchId ? batchMap.get(course.batchId) : undefined
    return {
      id: a.id,
      courseId: a.targetId,
      courseName: course?.name || a.targetId,
      courseCode: course?.code || "-",
      version: course?.version || "-",
      courseType: course?.type || "system",
      major: course?.majorName,
      batchName: batch?.name,
      submitterId: a.submitterId,
      status: a.status,
      submittedAt: new Date(a.createdAt).toLocaleDateString(),
      stepInfo: getStepInfo(a),
      history: a.history,
    }
  }

  return (
    <ApprovalListPage<ApprovalView>
      entityLabel="课程"
      pageDescription="审核课程提交申请，管理审批流程"
      emptyPendingText="所有提交的课程都已处理完毕"
      records={records}
      loading={loading}
      getStepInfo={getStepInfo}
      onApprove={approve}
      onReject={reject}
      onBatchApprove={batchApprove}
      onBatchReject={batchReject}
      mapRecord={mapRecord}
      detailHref={(item) => `/lesson/admin/courses/${item.courseId}/edit`}
      columns={columns}
    />
  )
}
