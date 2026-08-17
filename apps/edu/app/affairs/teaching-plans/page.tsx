'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ContentListPage } from '@/components/shared/content-list-page'
import { StatusBadge } from '@/components/shared/status-badge'
import { StatusActionBar } from '@/components/shared/status-action-bar'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { teachingPlanApi, affairsBatchApi, approvalApi, importExportApi } from '@/lib/api'
import type { TeachingPlan, AffairsBatch } from '@/lib/types'
import { STATUS_FILTER_OPTIONS } from '@zhiyu/shared-types'
import { GeneratePlanDialog } from './_components/generate-plan-dialog'
import { useToast, TableEmptyRow } from '@zhiyu/ui'
import { useT } from '@/lib/i18n/locale-provider'

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
  const t = useT()
  const [generateOpen, setGenerateOpen] = useState(false)
  const [exportingId, setExportingId] = useState<string | null>(null)

  const handleExport = async (p: TeachingPlan) => {
    setExportingId(p.id)
    try {
      await teachingPlanApi.exportExcel(p.id)
      toast({ title: t('导出成功'), description: t('{name}已导出', { name: p.programName || '教学计划' }) })
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: t('导出失败'),
        description: err.message || t('导出教学计划失败'),
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
      title={t('教学计划')}
      subtitle={t('从已发布的人培方案按学期生成教学计划，审批发布后进入排课')}
      entityLabel={t('教学计划')}
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
        { value: 'unplanned', label: t('未排课'), statuses: ['draft', 'pending', 'approved', 'rejected'] },
        { value: 'published', label: t('已排课'), statuses: ['published'] },
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
            <Table resizable storageKey="affairs.teaching-plans.list">
              <TableHeader>
                <TableRow className="border-b">
                  <TableHead
                    columnKey="select"
                    defaultWidth={32}
                    minWidth={32}
                    resizable={false}
                    className="px-2 py-2"
                  >
                    <input type="checkbox" onChange={(e) => onSelectAll(e.target.checked)} />
                  </TableHead>
                  <TableHead
                    columnKey="program"
                    defaultWidth={180}
                    minWidth={120}
                    className="px-2 py-2 text-left text-xs font-medium text-muted-foreground"
                  >
                    {t('人培方案')}
                  </TableHead>
                  <TableHead
                    columnKey="term"
                    defaultWidth={120}
                    minWidth={80}
                    className="px-2 py-2 text-left text-xs font-medium text-muted-foreground"
                  >
                    {t('学期')}
                  </TableHead>
                  <TableHead
                    columnKey="major"
                    defaultWidth={120}
                    minWidth={80}
                    className="px-2 py-2 text-left text-xs font-medium text-muted-foreground"
                  >
                    {t('专业')}
                  </TableHead>
                  <TableHead
                    columnKey="entryYear"
                    defaultWidth={80}
                    minWidth={56}
                    className="px-2 py-2 text-left text-xs font-medium text-muted-foreground"
                  >
                    {t('年级')}
                  </TableHead>
                  <TableHead
                    columnKey="entryCount"
                    defaultWidth={80}
                    minWidth={56}
                    className="px-2 py-2 text-left text-xs font-medium text-muted-foreground"
                  >
                    {t('条目数')}
                  </TableHead>
                  <TableHead
                    columnKey="batch"
                    defaultWidth={120}
                    minWidth={80}
                    className="px-2 py-2 text-left text-xs font-medium text-muted-foreground"
                  >
                    {t('批次')}
                  </TableHead>
                  <TableHead
                    columnKey="status"
                    defaultWidth={80}
                    minWidth={56}
                    className="px-2 py-2 text-left text-xs font-medium text-muted-foreground"
                  >
                    {t('状态')}
                  </TableHead>
                  <TableHead
                    columnKey="actions"
                    defaultWidth={260}
                    minWidth={160}
                    className="sticky right-0 bg-white px-2 py-2 text-right text-xs font-medium text-muted-foreground"
                  >
                    {t('操作')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableEmptyRow colSpan={9}>{t('暂无教学计划')}</TableEmptyRow>
                ) : (
                  items.map((item: any) => (
                    <TableRow key={item.id} className="border-t hover:bg-muted/30 group">
                      <TableCell className="px-2 py-2">
                        <input
                          type="checkbox"
                          checked={selectedIds?.includes(item.id)}
                          onChange={() => onSelectId?.(item.id)}
                        />
                      </TableCell>
                      <TableCell className="px-2 py-2">
                        <div className="font-medium text-sm truncate">{item.programName || '-'}</div>
                      </TableCell>
                      <TableCell className="px-2 py-2 text-sm truncate">
                        {item.termName || '-'}
                      </TableCell>
                      <TableCell className="px-2 py-2 text-sm text-muted-foreground truncate">
                        {item.majorName || '-'}
                      </TableCell>
                      <TableCell className="px-2 py-2 text-sm">
                        {t('{n}级', { n: item.entryYear })}
                      </TableCell>
                      <TableCell className="px-2 py-2 text-sm">{item.entryCount}</TableCell>
                      <TableCell className="px-2 py-2 text-sm text-muted-foreground truncate">
                        {item.batchId ? batchMap?.get(item.batchId) || '-' : '-'}
                      </TableCell>
                      <TableCell className="px-2 py-2">
                        <StatusBadge status={item.status} />
                      </TableCell>
                      <TableCell className="sticky right-0 bg-white px-2 py-2">
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
                            alwaysExtraActions={
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
                                {exportingId === item.id ? t('导出中...') : t('导出')}
                              </Button>
                            }
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
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
