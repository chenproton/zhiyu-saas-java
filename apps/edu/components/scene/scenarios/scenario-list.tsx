'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { GitBranch } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { StatusBadge } from '@/components/shared/status-badge'
import { StatusActionBar } from '@/components/shared/status-action-bar'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n/locale-provider'

export interface ScenarioListItem {
  id: string
  name: string
  code: string
  version: string
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'published' | 'archived'
  /** 来源：school=学校自建（默认），enterprise=企业端资源共建写入（列表徽章用） */
  sourceType?: 'school' | 'enterprise'
  batchId?: string
  positionName?: string
  batchName?: string
  creatorName?: string
  publishTime?: string
  taskCount?: number
  tasks?: { length: number }
}

interface ScenarioListProps<T extends ScenarioListItem = ScenarioListItem> {
  activeTab?: 'my' | 'collab' | 'public'
  scenarios: T[]
  selectedIds?: string[]
  onSelectId?: (id: string, checked: boolean) => void
  onSelectAll?: (checked: boolean) => void
  onClone?: (scenario: T) => void
  onDelete?: (scenario: T) => void
  onSubmitApproval?: (scenario: T) => void
  onWithdrawApproval?: (scenario: T) => void
  onPublish?: (scenario: T) => void
  onUnpublish?: (scenario: T) => void
  onArchive?: (scenario: T) => void
  onViewRejectReason?: (scenario: T) => void
  onInviteCoBuild?: (scenario: T) => void
  className?: string
  basePath?: string
}

export function ScenarioList<T extends ScenarioListItem = ScenarioListItem>({
  activeTab,
  scenarios,
  selectedIds = [],
  onSelectId,
  onSelectAll,
  onClone,
  onDelete,
  onSubmitApproval,
  onWithdrawApproval,
  onPublish,
  onUnpublish,
  onArchive,
  onViewRejectReason,
  onInviteCoBuild,
  className,
  basePath = '/scenarios',
}: ScenarioListProps<T>) {
  const router = useRouter()
  const t = useT()
  if (scenarios.length === 0) return null

  const allSelected = scenarios.length > 0 && scenarios.every((s) => selectedIds.includes(s.id))
  const someSelected = scenarios.some((s) => selectedIds.includes(s.id)) && !allSelected

  return (
    <div className={cn('rounded-lg border border-slate-200 bg-white overflow-hidden', className)}>
      <div className="overflow-x-auto">
        <Table className="min-w-[900px]">
          <TableHeader>
            <TableRow className="bg-slate-50 border-b border-slate-100 hover:bg-slate-50">
              <TableHead className="w-10 px-3">
                <Checkbox
                  checked={someSelected ? 'indeterminate' : allSelected}
                  onCheckedChange={(checked) => onSelectAll?.(checked === true)}
                  aria-label={t('全选')}
                />
              </TableHead>
              <TableHead className="w-40 text-xs font-medium text-slate-500">
                {t('场景名称')}
              </TableHead>
              <TableHead className="w-28 text-xs font-medium text-slate-500">
                {t('场景编码')}
              </TableHead>
              <TableHead className="w-16 text-center text-xs font-medium text-slate-500">
                {t('版本')}
              </TableHead>
              <TableHead className="w-28 text-xs font-medium text-slate-500">
                {t('所属岗位')}
              </TableHead>
              <TableHead className="w-32 text-xs font-medium text-slate-500">
                {t('所属批次分组')}
              </TableHead>
              <TableHead className="w-24 text-xs font-medium text-slate-500">{t('创建人')}</TableHead>
              <TableHead className="w-28 text-xs font-medium text-slate-500">
                {t('发布时间')}
              </TableHead>
              <TableHead className="w-20 text-center text-xs font-medium text-slate-500">
                {t('任务数')}
              </TableHead>
              <TableHead className="text-right text-xs font-medium text-slate-500">
                {t('操作')}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {scenarios.map((scenario) => {
              const isSelected = selectedIds.includes(scenario.id)

              return (
                <TableRow
                  key={scenario.id}
                  className={cn(
                    'group border-slate-100 hover:bg-slate-50 transition-colors',
                    isSelected && 'bg-primary/5 hover:bg-primary/5',
                  )}
                >
                  <TableCell className="px-3">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(checked) => onSelectId?.(scenario.id, checked === true)}
                      aria-label={t('选择 {name}', { name: scenario.name })}
                    />
                  </TableCell>
                  <TableCell>
                    <Link href={`${basePath}/${scenario.id}/edit`} className="block">
                      <p className="text-sm font-medium text-slate-900 line-clamp-1 max-w-40 hover:text-primary">
                        {scenario.name}
                      </p>
                    </Link>
                    <div className="flex items-center gap-1.5 mt-1">
                      <StatusBadge status={scenario.status} />
                      {scenario.sourceType === 'enterprise' && (
                        <Badge variant="secondary">{t('企业共建')}</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">{scenario.code}</TableCell>
                  <TableCell className="text-center text-sm text-slate-600">
                    {scenario.version}
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">
                    {scenario.positionName || '-'}
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">
                    {scenario.batchName || '-'}
                  </TableCell>
                  <TableCell className="text-xs text-slate-500">{scenario.creatorName}</TableCell>
                  <TableCell className="text-xs text-slate-500">
                    {scenario.publishTime || '-'}
                  </TableCell>
                  <TableCell className="text-center">
                    <Link
                      href={`${basePath}/${scenario.id}/edit/tasks`}
                      className="inline-flex items-center justify-center px-2 py-0.5 rounded text-xs font-medium bg-primary/5 text-primary hover:bg-primary/10 transition-colors"
                    >
                      {scenario.taskCount ?? scenario.tasks?.length ?? 0}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right relative">
                    <StatusActionBar
                      status={scenario.status}
                      isPublicPool={activeTab === 'public'}
                      onView={() => router.push(`/scene/landing/${scenario.id}`)}
                      onEdit={() => router.push(`${basePath}/${scenario.id}/edit`)}
                      onClone={onClone ? () => onClone(scenario) : undefined}
                      onSubmit={onSubmitApproval ? () => onSubmitApproval(scenario) : undefined}
                      onWithdraw={
                        onWithdrawApproval ? () => onWithdrawApproval(scenario) : undefined
                      }
                      onPublish={onPublish ? () => onPublish(scenario) : undefined}
                      onUnpublish={onUnpublish ? () => onUnpublish(scenario) : undefined}
                      onArchive={onArchive ? () => onArchive(scenario) : undefined}
                      onDelete={onDelete ? () => onDelete(scenario) : undefined}
                      onInvite={onInviteCoBuild ? () => onInviteCoBuild(scenario) : undefined}
                      onViewRejectReason={
                        onViewRejectReason ? () => onViewRejectReason(scenario) : undefined
                      }
                      extraActions={
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" asChild>
                          <Link href={`${basePath}/${scenario.id}/edit/tasks`}>
                            <GitBranch className="mr-1 h-3 w-3" />
                            {t('编排任务')}
                          </Link>
                        </Button>
                      }
                    />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
