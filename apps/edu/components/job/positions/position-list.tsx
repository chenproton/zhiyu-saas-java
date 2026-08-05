'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { GitBranch } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { StatusBadge } from '@/components/shared/status-badge'
import { StatusActionBar } from '@/components/shared/status-action-bar'
import type { Position } from '@/lib/types/job-source'

interface PositionListProps {
  activeTab?: 'my' | 'collab' | 'public'
  positions: Position[]
  selectedIds?: string[]
  onSelectId?: (id: string, checked: boolean) => void
  onSelectAll?: (checked: boolean) => void
  onClone?: (position: Position) => void
  onDelete?: (position: Position) => void
  onSubmitApproval?: (position: Position) => void
  onWithdrawApproval?: (position: Position) => void
  onViewRejectReason?: (position: Position) => void
  onPublish?: (position: Position) => void
  onUnpublish?: (position: Position) => void
  onArchive?: (position: Position) => void
  onInviteCoBuild?: (position: Position) => void
  className?: string
  basePath?: string
  configureStepParam?: string
  industryMap?: Map<string, string>
  majorMap?: Map<string, string>
  batchMap?: Map<string, string>
}

export function PositionList({
  activeTab,
  positions,
  selectedIds = [],
  onSelectId,
  onSelectAll,
  onClone,
  onDelete,
  onSubmitApproval,
  onWithdrawApproval,
  onViewRejectReason,
  onPublish,
  onUnpublish,
  onArchive,
  onInviteCoBuild,
  className,
  basePath = '/job/positions',
  configureStepParam = '1',
  industryMap,
  majorMap,
  batchMap,
}: PositionListProps) {
  const router = useRouter()
  const getIndustryName = (id?: string) => {
    if (!id) return '-'
    return industryMap?.get(id) || '-'
  }
  const getMajorNames = (ids: string[]) => {
    if (ids.length === 0) return '-'
    return ids.map((id) => majorMap?.get(id) || id).join('，')
  }
  if (positions.length === 0) return null

  const allSelected = positions.length > 0 && positions.every((p) => selectedIds.includes(p.id))
  const someSelected = positions.some((p) => selectedIds.includes(p.id)) && !allSelected

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
                  aria-label="全选"
                />
              </TableHead>
              <TableHead className="w-40 text-xs font-medium text-slate-500">岗位名称</TableHead>
              <TableHead className="w-24 text-xs font-medium text-slate-500">岗位编码</TableHead>
              <TableHead className="w-28 text-xs font-medium text-slate-500">所属行业</TableHead>
              <TableHead className="w-32 text-xs font-medium text-slate-500">所属专业</TableHead>
              <TableHead className="w-32 text-xs font-medium text-slate-500">
                所属批次分组
              </TableHead>
              <TableHead className="w-20 text-xs font-medium text-slate-500">共建人员</TableHead>
              <TableHead className="w-16 text-center text-xs font-medium text-slate-500">
                职责数
              </TableHead>
              <TableHead className="w-16 text-center text-xs font-medium text-slate-500">
                能力绑定
              </TableHead>
              <TableHead className="w-16 text-center text-xs font-medium text-slate-500">
                收藏
              </TableHead>
              <TableHead className="text-right text-xs font-medium text-slate-500">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {positions.map((position) => {
              const isSelected = selectedIds.includes(position.id)

              return (
                <TableRow
                  key={position.id}
                  className={cn(
                    'group border-slate-100 hover:bg-slate-50 transition-colors',
                    isSelected && 'bg-primary/5 hover:bg-primary/5',
                  )}
                >
                  <TableCell className="px-3">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(checked) => onSelectId?.(position.id, checked === true)}
                      aria-label={`选择 ${position.name}`}
                    />
                  </TableCell>
                  <TableCell>
                    <Link href={`${basePath}/${position.id}/edit`} className="block">
                      <p className="text-sm font-medium text-slate-900 line-clamp-1 max-w-40 hover:text-primary">
                        {position.name}
                      </p>
                    </Link>
                    <div className="flex items-center gap-1.5 mt-1">
                      <StatusBadge status={position.status} />
                      <span className="text-xs text-slate-400">v{position.version}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">
                    {position.code || position.id.slice(0, 8)}
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">
                    {getIndustryName(position.industry)}
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">
                    {getMajorNames(position.majors)}
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">
                    {batchMap?.get(position.batchId) || position.batchId || '-'}
                  </TableCell>
                  <TableCell className="text-xs text-slate-500">
                    {position.collaborators.length > 0 ? `${position.collaborators.length}人` : '-'}
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="inline-flex items-center justify-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-600">
                      {position.responsibilities.length}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="inline-flex items-center justify-center px-2 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-600">
                      {position.abilityBindings.length}
                    </span>
                  </TableCell>
                  <TableCell className="text-center text-xs text-slate-500">
                    {position.favoriteCount}
                  </TableCell>
                  <TableCell className="text-right relative">
                    <StatusActionBar
                      status={position.status}
                      isPublicPool={activeTab === 'public'}
                      onView={() => router.push(`/job/landing/${position.id}`)}
                      onEdit={() => router.push(`${basePath}/${position.id}/edit`)}
                      onClone={onClone ? () => onClone(position) : undefined}
                      onSubmit={onSubmitApproval ? () => onSubmitApproval(position) : undefined}
                      onWithdraw={
                        onWithdrawApproval ? () => onWithdrawApproval(position) : undefined
                      }
                      onPublish={onPublish ? () => onPublish(position) : undefined}
                      onUnpublish={onUnpublish ? () => onUnpublish(position) : undefined}
                      onArchive={onArchive ? () => onArchive(position) : undefined}
                      onDelete={onDelete ? () => onDelete(position) : undefined}
                      onInvite={onInviteCoBuild ? () => onInviteCoBuild(position) : undefined}
                      onViewRejectReason={
                        onViewRejectReason ? () => onViewRejectReason(position) : undefined
                      }
                      extraActions={
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" asChild>
                          <Link href={`${basePath}/${position.id}/edit?step=${configureStepParam}`}>
                            <GitBranch className="mr-1 h-3 w-3" />
                            配置能力
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
