"use client"

import { PositionList } from "@/components/job/positions/position-list"
import { positionApi, batchApi, approvalApi, importExportApi } from "@/lib/api"
import { useIndustryMap, useMajorMap } from "@/lib/use-resource-maps"
import {
  convertCareerPositionToPosition,
  convertJobBatchToBatch,
  positionToCreateRequest,
} from "@/lib/stores/job-converters"
import type { Position } from "@/lib/types/job-source"
import { useAuth } from "@/components/auth-provider"
import {
  ContentListPage,
  type ContentBatch,
} from "@/components/shared/content-list-page"

function draftSuffix() {
  const d = new Date()
  const ds = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  return `${ds}_${c[Math.floor(Math.random() * 36)]}${c[Math.floor(Math.random() * 36)]}`
}

function mapPosition(backend: any, _currentUserId: string): Position & { creatorId: string; coCreatorIds: string[] } {
  const pos = convertCareerPositionToPosition(backend)
  return { ...pos, creatorId: pos.createdBy, coCreatorIds: pos.collaborators }
}

function mapPositionBatch(backend: any): ContentBatch {
  const batch = convertJobBatchToBatch(backend)
  return { id: batch.id, name: batch.name, workflowId: batch.workflowId }
}

export default function PositionsPage() {
  const { user } = useAuth()
  const currentUserId = user?.id ?? ""
  const industryMap = useIndustryMap()
  const majorMap = useMajorMap()

  return (
    <ContentListPage<Position>
      title="岗位资源管理"
      subtitle="维护岗位信息、能力模型等岗位资源管理功能"
      entityLabel="岗位"
      addHref="/job/positions"
      permissionModule="job"
      permissionResource="positions"
      itemApi={positionApi as any}
      batchApi={batchApi as any}
      approvalApi={approvalApi as any}
      importExportApi={importExportApi}
      approvalTargetType="career_position"
      importEntityName="career_positions"
      exportEntityName="career_positions"
      importExcelEntity="positions"
      createRedirectUrl={(id) => `/job/positions/${id}/edit?new=true`}
      coBuilderField="collaborators"
      statusFilterOptions={[
        { value: "draft", label: "草稿" },
        { value: "pending", label: "审批中" },
        { value: "approved", label: "已通过" },
        { value: "rejected", label: "已驳回" },
        { value: "published", label: "已发布" },
        { value: "archived", label: "已归档" },
      ]}
      mapItem={(b) => mapPosition(b, currentUserId)}
      mapBatch={mapPositionBatch}
      createPayload={(uid, _label) => positionToCreateRequest({
        batchId: "",
        name: `新建岗位_${draftSuffix()}`,
        shortName: "新岗位",
        industry: "",
        majors: [],
        positionType: "enterprise",
        salaryRange: [0, 0],
        description: "",
        requirements: [],
        careerPath: "",
        version: "V1.0",
        status: "draft",
        createdBy: uid,
        collaborators: [],
      } as any)}
      listExtraProps={{ configureStepParam: "2", industryMap, majorMap }}
      renderList={(props) => (
        <PositionList
          positions={props.items}
          selectedIds={props.selectedIds}
          onSelectId={props.onSelectId}
          onSelectAll={props.onSelectAll}
          onClone={props.onClone}
          onDelete={props.onDelete}
          onSubmitApproval={props.onSubmitApproval}
          onWithdrawApproval={props.onWithdrawApproval}
          onViewRejectReason={props.onViewRejectReason}
          onPublish={props.onPublish}
          onUnpublish={props.onUnpublish}
          onArchive={props.onArchive}
          onInviteCoBuild={props.onInviteCoBuild}
          configureStepParam="2"
          className="border-0 rounded-none"
          industryMap={industryMap}
          majorMap={majorMap}
          batchMap={props.batchMap}
        />
      )}
    />
  )
}
