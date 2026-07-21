"use client"

import { ScenarioList, type ScenarioListItem } from "@/components/scene/scenarios/scenario-list"
import { scenarioApi, sceneBatchApi, taskApi, importExportApi, approvalApi } from "@/lib/api"
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

function generateCode(prefix: string) {
  return `${prefix}-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 10000)).padStart(4, "0")}`
}

function mapScenario(backend: any, _currentUserId: string): ScenarioListItem & { creatorId: string; coCreatorIds: string[] } {
  return {
    id: backend.id,
    name: backend.name,
    code: backend.code,
    version: backend.version,
    status: backend.status as ScenarioListItem["status"],
    batchId: backend.batchId,
    positionName: "-",
    batchName: undefined,
    creatorName: "-",
    creatorId: backend.creatorId,
    coCreatorIds: backend.coBuilderIds || [],
    publishTime: backend.publishTime,
    taskCount: 0,
  }
}

function mapSceneBatch(backend: any): ContentBatch {
  return { id: backend.id, name: backend.name, workflowId: backend.workflowId }
}

export default function SceneHallPage() {
  const { user } = useAuth()
  const currentUserId = user?.id ?? ""

  return (
    <ContentListPage<ScenarioListItem>
      title="场景大厅"
      subtitle="管理场景建设资源，支持场景创建、编辑、任务配置、审批发布等全流程管理"
      entityLabel="场景"
      addHref="/scene/scenarios"
      permissionModule="scene"
      permissionResource="scenarios"
      itemApi={scenarioApi as any}
      batchApi={sceneBatchApi}
      approvalApi={approvalApi}
      importExportApi={importExportApi}
      approvalTargetType="scenario"
      importEntityName="scenarios"
      exportEntityName="scenarios"
      statusFilterOptions={[
        { value: "draft", label: "草稿" },
        { value: "pending", label: "审批中" },
        { value: "approved", label: "已通过" },
        { value: "rejected", label: "已驳回" },
        { value: "published", label: "已发布" },
        { value: "archived", label: "已归档" },
      ]}
      mapItem={(b) => mapScenario(b, currentUserId)}
      mapBatch={mapSceneBatch}
      afterLoad={async (items, batches) => {
        const batchMap = new Map(batches.map((b) => [b.id, b.name]))
        try {
          const tasks = await taskApi.list({ limit: 10000 })
          const counts: Record<string, number> = {}
          tasks.items.forEach((t: any) => {
            counts[t.scenarioId] = (counts[t.scenarioId] || 0) + 1
          })
          return items.map((item) => ({
            ...item,
            batchName: item.batchId ? batchMap.get(item.batchId) || "-" : undefined,
            taskCount: counts[item.id] || 0,
          }))
        } catch {
          return items.map((item) => ({
            ...item,
            batchName: item.batchId ? batchMap.get(item.batchId) || "-" : undefined,
          }))
        }
      }}
      createRedirectUrl={(id) => `/scene/scenarios/${id}/edit?new=true`}
      coBuilderField="coBuilderIds"
      createPayload={(uid, _label) => ({
        name: `新建场景_${draftSuffix()}`,
        code: generateCode("SC"),
        difficulty: 1,
        version: "V1.0",
        status: "draft",
        creatorId: uid,
        coBuilderIds: [],
      })}
      renderList={(props) => (
        <ScenarioList
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
