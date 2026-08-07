'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ContentListPage } from '@/components/shared/content-list-page'
import { StatusBadge } from '@/components/shared/status-badge'
import { StatusActionBar } from '@/components/shared/status-action-bar'
import { teachingPlanApi, affairsBatchApi, approvalApi, importExportApi } from '@/lib/api'
import type { TeachingPlan, AffairsBatch } from '@/lib/types'
import { STATUS_FILTER_OPTIONS } from '@zhiyu/shared-types'
import { GeneratePlanDialog } from './_components/generate-plan-dialog'
import { useToast } from '@zhiyu/ui'

// ContentListItem 需要 name/creatorId/coCreatorIds：教学计划无独立名称，以 方案+学期+专业 拼装（同时作为搜索串）
function mapPlan(backend: any, currentUserId: string) {
  return {
    ...backend,
    name: `${backend.programName || '教学计划'} · ${backend.termName || ''} · ${backend.majorName || ''}`,
    // 历史数据 created_by 为空时兜底归属当前用户，避免旧计划在「我的」页签中消失
    creatorId: backend.createdBy || currentUserId,
    coCreatorIds: backend.collaborators || [],
  }
}
function mapBatch(backend: any) {
  return { id: backend.id, name: backend.name, workflowId: backend.workflowId }
}

export default function TeachingPlansPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [generateOpen, setGenerateOpen] = useState(false)
  const [exportingId, setExportingId] = useState<string | null>(null)

  const handleExport = async (p: TeachingPlan) => {
    setExportingId(p.id)
    try {
      await teachingPlanApi.exportExcel(p.id)
      toast({ title: '导出成功', description: `${p.programName || '教学计划'}已导出` })
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: '导出失败',
        description: err.message || '导出教学计划失败',
      })
    } finally {
      setExportingId(null)
    }
  }

  return (
    <ContentListPage<
      TeachingPlan & { name: string; creatorId: string; coCreatorIds: string[] },
      TeachingPlan,
      AffairsBatch
    >
      title="教学计划"
      subtitle="从已发布的人培方案按学期生成教学计划，审批发布后进入排课"
      entityLabel="教学计划"
      addHref="/affairs/teaching-plans"
      permissionModule="affairs"
      permissionResource="teaching-plans"
      itemApi={teachingPlanApi}
      batchApi={affairsBatchApi}
      approvalApi={approvalApi}
      importExportApi={importExportApi}
      approvalTargetType="teaching_plan"
      coBuilderField="collaborators"
      createRedirectUrl={(id) => `/affairs/teaching-plans/${id}?new=true`}
      statusFilterOptions={STATUS_FILTER_OPTIONS}
      groupStatusFilterOptions={[
        { value: 'unplanned', label: '未排课', statuses: ['draft', 'pending', 'approved', 'rejected'] },
        { value: 'published', label: '已排课', statuses: ['published'] },
      ]}
      mapItem={mapPlan}
      mapBatch={mapBatch}
      createPayload={() => ({ programId: '', termId: '' })}
      enableClone={false}
      enableBatchExport={false}
      // 新增流程保持现状：先选择人培方案+学期生成草稿，再进入详情编辑表单
      onCreate={() => setGenerateOpen(true)}
      renderList={(props: any) => {
        const {
          activeTab,
          items,
          selectedIds,
          onSelectId,
          onSelectAll,
          onDelete,
          onSubmitApproval,
          onWithdrawApproval,
          onViewRejectReason,
          onPublish,
          onUnpublish,
          onArchive,
          onInviteCoBuild,
          batchMap,
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
                      人培方案
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-muted-foreground">
                      学期
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-muted-foreground">
                      专业
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-muted-foreground">
                      年级
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-muted-foreground">
                      条目数
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-muted-foreground">
                      批次
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-muted-foreground">
                      状态
                    </th>
                    <th className="sticky right-0 w-[260px] bg-white px-2 py-2 text-right text-xs font-medium text-muted-foreground">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="h-24 text-center text-sm text-muted-foreground">
                        暂无教学计划
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
                          <div className="font-medium text-sm">{item.programName || '-'}</div>
                        </td>
                        <td className="px-2 py-2 text-sm">{item.termName || '-'}</td>
                        <td className="px-2 py-2 text-sm text-muted-foreground">
                          {item.majorName || '-'}
                        </td>
                        <td className="px-2 py-2 text-sm">{item.entryYear}级</td>
                        <td className="px-2 py-2 text-sm">{item.entryCount}</td>
                        <td className="px-2 py-2 text-sm text-muted-foreground">
                          {item.batchId ? batchMap?.get(item.batchId) || '-' : '-'}
                        </td>
                        <td className="px-2 py-2">
                          <StatusBadge status={item.status} />
                        </td>
                        <td className="sticky right-0 bg-white px-2 py-2">
                          <div className="flex items-center justify-end gap-1">
                            <StatusActionBar
                              status={item.status}
                              isPublicPool={activeTab === 'public'}
                              onView={() => router.push(`/affairs/teaching-plans/${item.id}`)}
                              onEdit={() => router.push(`/affairs/teaching-plans/${item.id}`)}
                              onSubmit={onSubmitApproval ? () => onSubmitApproval(item) : undefined}
                              onWithdraw={
                                onWithdrawApproval ? () => onWithdrawApproval(item) : undefined
                              }
                              onViewRejectReason={
                                onViewRejectReason ? () => onViewRejectReason(item) : undefined
                              }
                              onPublish={onPublish ? () => onPublish(item) : undefined}
                              onUnpublish={onUnpublish ? () => onUnpublish(item) : undefined}
                              onArchive={onArchive ? () => onArchive(item) : undefined}
                              onDelete={onDelete ? () => onDelete(item) : undefined}
                              onInvite={onInviteCoBuild ? () => onInviteCoBuild(item) : undefined}
                              extraActions={
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-xs"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleExport(item)
                                  }}
                                  disabled={exportingId === item.id}
                                >
                                  <Download className="mr-1 h-3 w-3" />
                                  {exportingId === item.id ? '导出中...' : '导出'}
                                </Button>
                              }
                            />
                          </div>
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
    >
      <GeneratePlanDialog
        open={generateOpen}
        onOpenChange={setGenerateOpen}
        onGenerated={(plan) => {
          setGenerateOpen(false)
          router.push(`/affairs/teaching-plans/${plan.id}?new=true`)
        }}
      />
    </ContentListPage>
  )
}
