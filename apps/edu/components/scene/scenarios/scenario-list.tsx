'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { GitBranch } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { StatusBadge } from '@/components/shared/status-badge'
import { StatusActionBar } from '@/components/shared/status-action-bar'
import { cn } from '@/lib/utils'

export interface ScenarioListItem {
  id: string
  name: string
  code: string
  version: string
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'published' | 'archived'
  batchId?: string
  positionName?: string
  batchName?: string
  creatorName?: string
  publishTime?: string
  taskCount?: number
  tasks?: { length: number }
}

interface ScenarioListProps<T extends ScenarioListItem = ScenarioListItem> {
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
  if (scenarios.length === 0) return null

  const allSelected = scenarios.length > 0 && scenarios.every((s) => selectedIds.includes(s.id))
  const someSelected = scenarios.some((s) => selectedIds.includes(s.id)) && !allSelected

  return (
    <div className={cn('rounded-lg border border-slate-200 bg-white overflow-hidden', className)}>
      {/* Header */}
      <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-slate-50 text-xs font-medium text-slate-500 border-b border-slate-100 items-center">
        <div className="col-span-1 flex justify-center">
          <Checkbox
            checked={someSelected ? 'indeterminate' : allSelected}
            onCheckedChange={(checked) => onSelectAll?.(checked === true)}
            aria-label="全选"
          />
        </div>
        <div className="col-span-2 block">场景名称</div>
        <div className="col-span-1 block">场景编码</div>
        <div className="col-span-1 block text-center">版本</div>
        <div className="col-span-1 block">所属岗位</div>
        <div className="col-span-2 block">所属批次分组</div>
        <div className="col-span-1 block">创建人</div>
        <div className="col-span-1 block">发布时间</div>
        <div className="col-span-1 block text-center">场景任务数量</div>
        <div className="col-span-1 text-right">操作</div>
      </div>

      {/* Body */}
      <div className="divide-y divide-slate-100">
        {scenarios.map((scenario) => {
          const isSelected = selectedIds.includes(scenario.id)

          return (
            <div
              key={scenario.id}
              className={cn(
                'grid grid-cols-12 gap-4 px-4 py-3 items-center hover:bg-slate-50 transition-colors group relative',
                isSelected && 'bg-primary/5',
              )}
            >
              <div className="col-span-1 flex justify-center">
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={(checked) => onSelectId?.(scenario.id, checked === true)}
                  aria-label={`选择 ${scenario.name}`}
                />
              </div>
              <div className="col-span-2">
                <Link href={`${basePath}/${scenario.id}/edit`} className="block">
                  <p className="text-sm font-medium text-slate-900 line-clamp-1 hover:text-primary">
                    {scenario.name}
                  </p>
                </Link>
                <StatusBadge status={scenario.status} />
              </div>
              <div className="col-span-1 text-sm text-slate-600 truncate">{scenario.code}</div>
              <div className="col-span-1 text-center text-sm text-slate-600">
                {scenario.version}
              </div>
              <div className="col-span-1 text-sm text-slate-600 truncate">
                {scenario.positionName || '-'}
              </div>
              <div className="col-span-2 text-sm text-slate-600 truncate">
                {scenario.batchName || '-'}
              </div>
              <div className="col-span-1 text-xs text-slate-500 truncate">
                {scenario.creatorName}
              </div>
              <div className="col-span-1 text-xs text-slate-500 truncate">
                {scenario.publishTime || '-'}
              </div>
              <div className="col-span-1 text-center">
                <Link
                  href={`${basePath}/${scenario.id}/edit/tasks`}
                  className="inline-flex items-center justify-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                >
                  {scenario.taskCount ?? scenario.tasks?.length ?? 0}
                </Link>
              </div>
              <div className="col-span-1 text-right relative">
                <StatusActionBar
                  status={scenario.status}
                  onView={() => router.push(`/scene/landing/${scenario.id}`)}
                  onEdit={() => router.push(`${basePath}/${scenario.id}/edit`)}
                  onClone={onClone ? () => onClone(scenario) : undefined}
                  onSubmit={onSubmitApproval ? () => onSubmitApproval(scenario) : undefined}
                  onWithdraw={onWithdrawApproval ? () => onWithdrawApproval(scenario) : undefined}
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
                        编排任务
                      </Link>
                    </Button>
                  }
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
