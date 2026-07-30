"use client"

import { useAuth } from "@/components/auth-provider"
import { courseApi, lessonBatchApi, importExportApi, approvalApi } from "@/lib/api"
import { CourseList } from "./course-list"
import type { Course, CourseType } from "@/lib/types/lesson-source"
import type { Course as BackendCourse } from "@/lib/types/lesson"
import {
  ContentListPage,
  type ContentListItem,
  type ContentBatch,
} from "@/components/shared/content-list-page"
import { draftSuffix } from "@/lib/format-utils"

interface CourseAdminPageProps {
  title: string
  subtitle: string
  courseType: CourseType
  addHref: string
  importExcelEntity?: string
}

function mapCourse(backend: BackendCourse, currentUserId: string): Course {
  return {
    id: backend.id,
    code: backend.code,
    name: backend.name,
    type: backend.type as CourseType,
    category: backend.category,
    major: backend.majorName || "",
    teacher: backend.teacherId || "",
    industry: backend.industryName || "",
    version: backend.version || "V1.0",
    updateDate: backend.updatedAt,
    nodeCount: backend.nodeCount,
    lessonCount: 0,
    resourceCount: backend.resourceCount,
    studyCount: backend.studyCount,
    status: backend.status as Course["status"],
    coverColor: backend.coverColor || undefined,
    coverImage: backend.coverImage || undefined,
    courseTag: backend.courseTag || undefined,
    creator: currentUserId && backend.creatorId === currentUserId ? "杭州知与未来科技有限公司" : backend.creatorId,
    creatorId: backend.creatorId,
    createDate: backend.createdAt,
    coCreator: backend.coCreatorIds?.length ? backend.coCreatorIds.join(", ") : undefined,
    coCreatorIds: backend.coCreatorIds,
    batchId: backend.batchId || undefined,
    batchName: backend.batchName || undefined,
    onlineHours: backend.onlineHours,
    offlineHours: backend.offlineHours,
    onlineWeight: backend.onlineWeight,
    offlineWeight: backend.offlineWeight,
    semester: backend.semester || undefined,
    className: backend.className || undefined,
  } as Course
}

function mapCourseBatch(backend: any): ContentBatch {
  return { id: backend.id, name: backend.name, workflowId: backend.workflowId }
}

export function CourseAdminPage({ title, subtitle, courseType, addHref, importExcelEntity }: CourseAdminPageProps) {
  const { user } = useAuth()
  const currentUserId = user?.id ?? ""
  const typeLabel = courseType === "system" ? "体系课" : courseType === "granular" ? "颗粒课" : "混合课"

  return (
    <ContentListPage<Course>
      title={title}
      subtitle={subtitle}
      entityLabel={typeLabel}
      addHref={addHref}
      permissionModule="lesson"
      permissionResource="courses"
      itemApi={courseApi as any}
      batchApi={lessonBatchApi}
      approvalApi={approvalApi}
      importExportApi={importExportApi}
      approvalTargetType="course"
      importEntityName="courses"
      exportEntityName="courses"
      importExcelEntity={importExcelEntity ?? "courses"}
      listParams={{ type: courseType }}
      coBuilderField="coCreatorIds"
      statusFilterOptions={[
        { value: "draft", label: "草稿" },
        { value: "pending", label: "审批中" },
        { value: "approved", label: "已通过" },
        { value: "rejected", label: "已驳回" },
        { value: "published", label: "已发布" },
        { value: "archived", label: "已归档" },
      ]}
      mapItem={(b) => mapCourse(b, currentUserId)}
      mapBatch={mapCourseBatch}
      createPayload={(uid, label) => ({
        name: `新建${label}_${draftSuffix()}`,
        type: courseType,
        category: "default",
        status: "draft",
        creatorId: uid || "",
        coCreatorIds: [],
      })}
      listExtraProps={{ courseType }}
      renderList={(props) => (
        <CourseList
          courses={props.items}
          courseType={courseType}
          selectedIds={props.selectedIds}
          onSelectId={props.onSelectId}
          onSelectAll={props.onSelectAll}
          onClone={props.onClone}
          onDelete={props.onDelete}
          onSubmitApproval={props.onSubmitApproval}
          onWithdrawApproval={props.onWithdrawApproval}
          onPublish={props.onPublish}
          onUnpublish={props.onUnpublish}
          onArchive={props.onArchive}
          onViewRejectReason={props.onViewRejectReason}
          onInviteCoBuild={props.onInviteCoBuild}
          viewHref={(course) => `/lesson/landing/${course.id}`}
          className="border-0 rounded-none"
        />
      )}
    />
  )
}
