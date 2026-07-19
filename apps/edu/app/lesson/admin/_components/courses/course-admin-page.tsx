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
import { Button } from "@/components/ui/button"
import { Upload } from "lucide-react"
import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface CourseAdminPageProps {
  title: string
  subtitle: string
  courseType: CourseType
  addHref: string
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

export function CourseAdminPage({ title, subtitle, courseType, addHref }: CourseAdminPageProps) {
  const { user } = useAuth()
  const currentUserId = user?.id ?? ""
  const typeLabel = courseType === "system" ? "体系课" : courseType === "granular" ? "颗粒课" : "混合课"
  const [resourceImportOpen, setResourceImportOpen] = useState(false)

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
      listParams={{ type: courseType }}
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
        code: `${courseType.toUpperCase()}-${Date.now()}`,
        name: `新建${label}`,
        type: courseType,
        category: "default",
        status: "draft",
        creatorId: uid || "",
        coCreatorIds: uid ? [uid] : [],
      })}
      extraHeaderActions={
        <Button variant="outline" size="sm" onClick={() => setResourceImportOpen(true)}>
          <Upload className="mr-2 h-4 w-4" />
          导入资源包
        </Button>
      }
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
          onApprove={props.onApprove}
          onReject={props.onReject}
          onPublish={props.onPublish}
          onUnpublish={props.onUnpublish}
          onArchive={props.onArchive}
          onViewRejectReason={props.onViewRejectReason}
          onInviteCoBuild={props.onInviteCoBuild}
          className="border-0 rounded-none"
        />
      )}
    >
      <Dialog open={resourceImportOpen} onOpenChange={setResourceImportOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>资源包导入</DialogTitle>
          </DialogHeader>
          <div className="py-6">
            <div className="border-2 border-dashed border-slate-200 rounded-lg p-8 flex flex-col items-center justify-center text-center">
              <Upload className="h-10 w-10 text-slate-300 mb-3" />
              <p className="text-sm text-slate-600 font-medium">点击或拖拽资源包到此处上传</p>
              <p className="text-xs text-slate-400 mt-1">支持 .zip, .rar 格式</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResourceImportOpen(false)}>取消</Button>
            <Button disabled>开始导入</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ContentListPage>
  )
}
