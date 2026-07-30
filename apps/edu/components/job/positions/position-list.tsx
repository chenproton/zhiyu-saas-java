"use client"

import { useRouter } from "next/navigation"
import Link from "next/link"
import { GitBranch } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import { StatusBadge } from "@/components/shared/status-badge"
import { StatusActionBar } from "@/components/shared/status-action-bar"
import type { Position } from "@/lib/types/job-source"

interface PositionListProps {
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
  basePath = "/job/positions",
  configureStepParam = "1",
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
    <div className={cn("rounded-lg border border-slate-200 bg-white overflow-hidden", className)}>
      {/* Header */}
      <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-slate-50 text-xs font-medium text-slate-500 border-b border-slate-100 items-center">
        <div className="col-span-1 flex justify-center">
          <Checkbox
            checked={someSelected ? "indeterminate" : allSelected}
            onCheckedChange={(checked) => onSelectAll?.(checked === true)}
            aria-label="全选"
          />
        </div>
        <div className="col-span-2">岗位名称</div>
        <div className="col-span-1">岗位编码</div>
        <div className="col-span-1">所属行业</div>
        <div className="col-span-1">所属专业</div>
        <div className="col-span-1">所属批次分组</div>
        <div className="col-span-1">共建人员</div>
        <div className="col-span-1 text-center">职责数</div>
        <div className="col-span-1 text-center">能力绑定</div>
        <div className="col-span-1 text-center">收藏</div>
        <div className="col-span-1 text-right">操作</div>
      </div>

      {/* Body */}
      <div className="divide-y divide-slate-100">
        {positions.map((position) => {
          const isSelected = selectedIds.includes(position.id)

          return (
            <div
              key={position.id}
              className={cn(
                "grid grid-cols-12 gap-4 px-4 py-3 items-center hover:bg-slate-50 transition-colors group relative",
                isSelected && "bg-primary/5"
              )}
            >
              <div className="col-span-1 flex justify-center">
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={(checked) => onSelectId?.(position.id, checked === true)}
                  aria-label={`选择 ${position.name}`}
                />
              </div>
              <div className="col-span-2">
                <Link href={`${basePath}/${position.id}/edit`} className="block">
                  <p className="text-sm font-medium text-slate-900 line-clamp-1 hover:text-primary">{position.name}</p>
                </Link>
                <div className="flex items-center gap-1.5 mt-1">
                  <StatusBadge status={position.status} />
                  <span className="text-xs text-slate-400">v{position.version}</span>
                </div>
              </div>
              <div className="col-span-1 text-sm text-slate-600 truncate">{position.code || position.id.slice(0, 8)}</div>
              <div className="col-span-1 text-sm text-slate-600 truncate">{getIndustryName(position.industry)}</div>
              <div className="col-span-1 text-sm text-slate-600 truncate">
                {getMajorNames(position.majors)}
              </div>
              <div className="col-span-1 text-sm text-slate-600 truncate">{batchMap?.get(position.batchId) || position.batchId || "-"}</div>
              <div className="col-span-1 text-xs text-slate-500 truncate">
                {position.collaborators.length > 0 ? `${position.collaborators.length}人` : "-"}
              </div>
              <div className="col-span-1 text-center">
                <span className="inline-flex items-center justify-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-600">
                  {position.responsibilities.length}
                </span>
              </div>
              <div className="col-span-1 text-center">
                <span className="inline-flex items-center justify-center px-2 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-600">
                  {position.abilityBindings.length}
                </span>
              </div>
              <div className="col-span-1 text-center text-xs text-slate-500">{position.favoriteCount}</div>
              <div className="col-span-1 text-right relative">
                <StatusActionBar
                  status={position.status}
                  onView={() => router.push(`/job/student/${position.id}`)}
                  onEdit={() => router.push(`${basePath}/${position.id}/edit`)}
                  onClone={onClone ? () => onClone(position) : undefined}
                  onSubmit={onSubmitApproval ? () => onSubmitApproval(position) : undefined}
                  onWithdraw={onWithdrawApproval ? () => onWithdrawApproval(position) : undefined}
                  onPublish={onPublish ? () => onPublish(position) : undefined}
                  onUnpublish={onUnpublish ? () => onUnpublish(position) : undefined}
                  onArchive={onArchive ? () => onArchive(position) : undefined}
                  onDelete={onDelete ? () => onDelete(position) : undefined}
                  onInvite={onInviteCoBuild ? () => onInviteCoBuild(position) : undefined}
                  onViewRejectReason={onViewRejectReason ? () => onViewRejectReason(position) : undefined}
                  extraActions={
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" asChild>
                      <Link href={`${basePath}/${position.id}/edit?step=${configureStepParam}`}>
                        <GitBranch className="mr-1 h-3 w-3" />
                        配置能力
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
