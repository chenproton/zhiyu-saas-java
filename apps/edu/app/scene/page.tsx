'use client'

import { ScenarioList, type ScenarioListItem } from '@/components/scene/scenarios/scenario-list'
import { scenarioApi, sceneBatchApi, importExportApi, approvalApi } from '@/lib/api'
import { useAuth } from '@/components/auth-provider'
import { ContentListPage, type ContentBatch } from '@/components/shared/content-list-page'
import { draftSuffix } from '@/lib/format-utils'
import { STATUS_FILTER_OPTIONS, type Scenario, type SceneBatch } from '@zhiyu/shared-types'
import { useT } from '@/lib/i18n/locale-provider'

function generateCode(prefix: string) {
  return `${prefix}-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`
}

function mapScenario(
  backend: any,
  _currentUserId: string,
): ScenarioListItem & { creatorId: string; coCreatorIds: string[] } {
  return {
    id: backend.id,
    name: backend.name,
    code: backend.code,
    version: backend.version,
    status: backend.status as ScenarioListItem['status'],
    sourceType: backend.sourceType,
    batchId: backend.batchId,
    positionName: '-',
    batchName: undefined,
    creatorName: '-',
    creatorId: backend.creatorId,
    coCreatorIds: backend.coBuilderIds || [],
    publishTime: backend.publishTime,
    taskCount: backend.taskCount || 0,
  }
}

function mapSceneBatch(backend: any): ContentBatch {
  return { id: backend.id, name: backend.name, workflowId: backend.workflowId }
}

export default function SceneHallPage() {
  const { user } = useAuth()
  const t = useT()
  const currentUserId = user?.id ?? ''

  return (
    <ContentListPage<ScenarioListItem, Scenario, SceneBatch>
      title={t('场景大厅')}
      subtitle={t('管理场景建设资源，支持场景创建、编辑、任务配置、审批发布等全流程管理')}
      entityLabel={t('场景')}
      addHref="/scene/scenarios"
      permissionModule="scene"
      permissionResource="scenarios"
      itemApi={scenarioApi}
      batchApi={sceneBatchApi}
      approvalApi={approvalApi}
      importExportApi={importExportApi}
      approvalTargetType="scenario"
      importEntityName="scenarios"
      exportEntityName="scenarios"
      importExcelEntity="scenarios"
      statusFilterOptions={STATUS_FILTER_OPTIONS}
      mapItem={(b) => mapScenario(b, currentUserId)}
      mapBatch={mapSceneBatch}
      afterLoad={async (items, batches) => {
        const batchMap = new Map(batches.map((b) => [b.id, b.name]))
        return items.map((item) => ({
          ...item,
          batchName: item.batchId ? batchMap.get(item.batchId) || '-' : undefined,
        }))
      }}
      createRedirectUrl={(id) => `/scene/scenarios/${id}/edit?new=true`}
      coBuilderField="coBuilderIds"
      createPayload={(uid, _label) => ({
        name: `${t('新建场景')}_${draftSuffix()}`,
        code: generateCode('SC'),
        difficulty: 1,
        version: 'v1.0',
        status: 'draft',
        creatorId: uid,
        coBuilderIds: [],
      })}
      renderList={(props) => (
        <ScenarioList
          activeTab={props.activeTab}
          scenarios={props.items}
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
          basePath="/scene/scenarios"
          className="border-0 rounded-none"
        />
      )}
    />
  )
}
