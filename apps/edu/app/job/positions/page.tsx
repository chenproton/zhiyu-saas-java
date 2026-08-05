'use client'

import { PositionList } from '@/components/job/positions/position-list'
import { positionApi, batchApi, approvalApi, importExportApi } from '@/lib/api'
import { useIndustryMap, useMajorMap } from '@/lib/use-resource-maps'
import {
  convertCareerPositionToPosition,
  convertJobBatchToBatch,
  positionToCreateRequest,
} from '@/lib/converters/job-converters'
import type { Position } from '@/lib/types/job-source'
import type { CareerPosition, JobBatch } from '@/lib/types/job'
import { useAuth } from '@/components/auth-provider'
import { ContentListPage, type ContentBatch } from '@/components/shared/content-list-page'
import { draftSuffix } from '@/lib/format-utils'
import { STATUS_FILTER_OPTIONS } from '@zhiyu/shared-types'

function mapPosition(
  backend: any,
  _currentUserId: string,
): Position & { creatorId: string; coCreatorIds: string[] } {
  const pos = convertCareerPositionToPosition(backend)
  return { ...pos, creatorId: pos.createdBy, coCreatorIds: pos.collaborators }
}

function mapPositionBatch(backend: any): ContentBatch {
  const batch = convertJobBatchToBatch(backend)
  return { id: batch.id, name: batch.name, workflowId: batch.workflowId }
}

export default function PositionsPage() {
  const { user } = useAuth()
  const currentUserId = user?.id ?? ''
  const industryMap = useIndustryMap()
  const majorMap = useMajorMap()

  return (
    <ContentListPage<Position, CareerPosition, JobBatch>
      title="岗位资源管理"
      subtitle="维护岗位信息、能力模型等岗位资源管理功能"
      entityLabel="岗位"
      addHref="/job/positions"
      permissionModule="job"
      permissionResource="positions"
      itemApi={positionApi}
      batchApi={batchApi}
      approvalApi={approvalApi}
      importExportApi={importExportApi}
      approvalTargetType="career_position"
      importEntityName="career_positions"
      exportEntityName="career_positions"
      importExcelEntity="positions"
      createRedirectUrl={(id) => `/job/positions/${id}/edit?new=true`}
      coBuilderField="collaborators"
      statusFilterOptions={STATUS_FILTER_OPTIONS}
      mapItem={(b) => mapPosition(b, currentUserId)}
      mapBatch={mapPositionBatch}
      createPayload={(uid, _label) =>
        positionToCreateRequest({
          batchId: '',
          name: `新建岗位_${draftSuffix()}`,
          shortName: '新岗位',
          industry: '',
          majors: [] as string[],
          positionType: 'enterprise',
          salaryRange: [0, 0],
          description: '',
          requirements: [] as string[],
          careerPath: '',
          version: 'V1.0',
          status: 'draft',
          createdBy: uid,
          collaborators: [] as string[],
        })
      }
      listExtraProps={{ configureStepParam: '2', industryMap, majorMap }}
      renderList={(props) => (
        <PositionList
          activeTab={props.activeTab}
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
