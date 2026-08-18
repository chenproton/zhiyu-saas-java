'use client'

import { useNavigate } from 'react-router'
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
import { programApi, affairsBatchApi, approvalApi, importExportApi } from '@/lib/api'
import type { TrainingProgram, AffairsBatch } from '@/lib/types'
import { STATUS_FILTER_OPTIONS } from '@zhiyu/shared-types'
import { TableEmptyRow } from '@zhiyu/ui'
import { useT } from '@/lib/i18n/locale-provider'

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
  const t = useT()
  const navigate = useNavigate()
  return (
    <ContentListPage<
      TrainingProgram & { creatorId: string; coCreatorIds: string[] },
      TrainingProgram,
      AffairsBatch
    >
      title={t('人才培养方案')}
      subtitle={t('维护专业人才培养方案及课程设置，发布后可生成学期教学计划')}
      entityLabel={t('人培方案')}
      addHref="/affairs/programs"
      permissionModule="affairs"
      permissionResource="programs"
      itemApi={programApi}
      batchApi={affairsBatchApi}
      approvalApi={approvalApi}
      importExportApi={importExportApi}
      approvalTargetType="training_program"
      coBuilderField="collaborators"
      createRedirectUrl={(id) => `/affairs/programs/${id}?new=true`}
      statusFilterOptions={STATUS_FILTER_OPTIONS}
      mapItem={mapProgram}
      mapBatch={mapBatch}
      createPayload={() => ({
        name: t('新建人培方案'),
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
            <Table resizable storageKey="affairs.programs.list">
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
                    columnKey="name"
                    defaultWidth={180}
                    minWidth={120}
                    className="px-2 py-2 text-left text-xs font-medium text-muted-foreground"
                  >
                    {t('方案名称')}
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
                    columnKey="courseCount"
                    defaultWidth={80}
                    minWidth={56}
                    className="px-2 py-2 text-left text-xs font-medium text-muted-foreground"
                  >
                    {t('课程数')}
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
                    defaultWidth={180}
                    minWidth={120}
                    className="sticky right-0 bg-white px-2 py-2 text-right text-xs font-medium text-muted-foreground"
                  >
                    {t('操作')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableEmptyRow colSpan={8}>{t('暂无人培方案')}</TableEmptyRow>
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
                        <div className="font-medium text-sm truncate">{item.name}</div>
                        {item.code && (
                          <div className="text-xs text-muted-foreground truncate">{item.code}</div>
                        )}
                      </TableCell>
                      <TableCell className="px-2 py-2 text-sm text-muted-foreground truncate">
                        {item.majorName || '-'}
                      </TableCell>
                      <TableCell className="px-2 py-2 text-sm">
                        {t('{n}级', { n: item.entryYear })}
                      </TableCell>
                      <TableCell className="px-2 py-2 text-sm">{item.courseCount}</TableCell>
                      <TableCell className="px-2 py-2 text-sm text-muted-foreground truncate">
                        {item.batchName || '-'}
                      </TableCell>
                      <TableCell className="px-2 py-2">
                        <StatusBadge status={item.status} />
                      </TableCell>
                      <TableCell className="sticky right-0 bg-white px-2 py-2">
                        <StatusActionBar
                          status={item.status}
                          isPublicPool={activeTab === 'public'}
                          onEdit={() => navigate(`/affairs/programs/${item.id}`)}
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
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )
      }}
    />
  )
}
