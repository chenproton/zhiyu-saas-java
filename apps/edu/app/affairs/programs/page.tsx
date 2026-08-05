'use client'

import { useRouter } from 'next/navigation'
import { ContentListPage } from '@/components/shared/content-list-page'
import { StatusBadge } from '@/components/shared/status-badge'
import { StatusActionBar } from '@/components/shared/status-action-bar'
import { programApi, affairsBatchApi, approvalApi, importExportApi } from '@/lib/api'
import type { TrainingProgram, AffairsBatch } from '@/lib/types'
import { STATUS_FILTER_OPTIONS } from '@zhiyu/shared-types'

function mapProgram(backend: any) {
  return {
    ...backend,
    creatorId: backend.createdBy || '',
    coCreatorIds: backend.collaborators || [],
  }
}
function mapBatch(backend: any) {
  return { id: backend.id, name: backend.name, workflowId: backend.workflowId }
}

export default function ProgramsPage() {
  const router = useRouter()
  return (
    <ContentListPage<
      TrainingProgram & { creatorId: string; coCreatorIds: string[] },
      TrainingProgram,
      AffairsBatch
    >
      title="人才培养方案"
      subtitle="维护专业人才培养方案及课程设置，发布后可生成学期教学计划"
      entityLabel="人培方案"
      addHref="/affairs/programs"
      permissionModule="affairs"
      permissionResource="programs"
      itemApi={programApi}
      batchApi={affairsBatchApi}
      approvalApi={approvalApi}
      importExportApi={importExportApi}
      approvalTargetType="training_program"
      importExcelEntity=""
      importEntityName=""
      exportEntityName=""
      coBuilderField="collaborators"
      createRedirectUrl={(id) => `/affairs/programs/${id}?new=true`}
      statusFilterOptions={STATUS_FILTER_OPTIONS}
      mapItem={mapProgram}
      mapBatch={mapBatch}
      createPayload={() => ({
        name: '新建人培方案',
        entryYear: new Date().getFullYear(),
        level: '本科',
        duration: 4,
        totalCredits: 0,
        status: 'draft',
        collaborators: [],
      })}
      renderList={(props: any) => {
        const {
          activeTab,
          items,
          selectedIds,
          onSelectId,
          onSelectAll,
          onClone,
          onDelete,
          onSubmitApproval,
          onWithdrawApproval,
          onPublish,
          onUnpublish,
          onArchive,
          onInviteCoBuild,
        } = props
        return (
          <div className="rounded-lg border bg-white px-4 py-3">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead>
                  <tr className="border-b">
                    <th className="w-8 px-2 py-2">
                      <input type="checkbox" onChange={(e) => onSelectAll(e.target.checked)} />
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-muted-foreground">
                      方案名称
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-muted-foreground">
                      专业
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-muted-foreground">
                      年级
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-muted-foreground">
                      课程数
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-muted-foreground">
                      批次
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-muted-foreground">
                      状态
                    </th>
                    <th className="sticky right-0 w-[180px] bg-white px-2 py-2 text-right text-xs font-medium text-muted-foreground">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="h-24 text-center text-sm text-muted-foreground">
                        暂无人培方案
                      </td>
                    </tr>
                  ) : (
                    items.map((item: any) => (
                      <tr key={item.id} className="border-t hover:bg-muted/30 group">
                        <td className="px-2 py-2">
                          <input
                            type="checkbox"
                            checked={selectedIds?.includes(item.id)}
                            onChange={() => onSelectId?.(item.id)}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <div className="font-medium text-sm">{item.name}</div>
                          {item.code && (
                            <div className="text-xs text-muted-foreground">{item.code}</div>
                          )}
                        </td>
                        <td className="px-2 py-2 text-sm text-muted-foreground">
                          {item.majorName || '-'}
                        </td>
                        <td className="px-2 py-2 text-sm">{item.entryYear}级</td>
                        <td className="px-2 py-2 text-sm">{item.courseCount}</td>
                        <td className="px-2 py-2 text-sm text-muted-foreground">
                          {item.batchName || '-'}
                        </td>
                        <td className="px-2 py-2">
                          <StatusBadge status={item.status} />
                        </td>
                        <td className="sticky right-0 bg-white px-2 py-2">
                          <StatusActionBar
                            status={item.status}
                            isPublicPool={activeTab === 'public'}
                            onEdit={() => router.push(`/affairs/programs/${item.id}`)}
                            onSubmit={onSubmitApproval ? () => onSubmitApproval(item) : undefined}
                            onWithdraw={
                              onWithdrawApproval ? () => onWithdrawApproval(item) : undefined
                            }
                            onPublish={onPublish ? () => onPublish(item) : undefined}
                            onUnpublish={onUnpublish ? () => onUnpublish(item) : undefined}
                            onArchive={onArchive ? () => onArchive(item) : undefined}
                            onClone={onClone ? () => onClone(item) : undefined}
                            onDelete={onDelete ? () => onDelete(item) : undefined}
                            onInvite={onInviteCoBuild ? () => onInviteCoBuild(item) : undefined}
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )
      }}
    />
  )
}
