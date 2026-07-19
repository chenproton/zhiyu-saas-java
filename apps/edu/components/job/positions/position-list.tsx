"use client"

import { Copy, Eye, GitBranch, Pencil, Rocket, Send, Trash2, Undo2, ArrowDownFromLine, UserPlus, Archive, CheckCircle, XCircle, MessageSquare } from "lucide-react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import type { Position } from "@/lib/types/job-source"

const statusConfig: Record<string, { label: string; className: string }> = {
  draft: { label: "草稿", className: "bg-gray-100 text-gray-500" },
  pending: { label: "审批中", className: "bg-yellow-50 text-yellow-600" },
  approved: { label: "已通过", className: "bg-blue-50 text-blue-600" },
  rejected: { label: "已驳回", className: "bg-red-50 text-red-500" },
  published: { label: "已发布", className: "bg-green-50 text-green-600" },
  archived: { label: "已归档", className: "bg-gray-100 text-gray-400" },
}

interface PositionListProps {
  positions: Position[]
  selectedIds?: string[]
  onSelectId?: (id: string, checked: boolean) => void
  onSelectAll?: (checked: boolean) => void
  onClone?: (position: Position) => void
  onDelete?: (position: Position) => void
  onSubmitApproval?: (position: Position) => void
  onWithdrawApproval?: (position: Position) => void
  onApprove?: (position: Position) => void
  onReject?: (position: Position) => void
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
  onApprove,
  onReject,
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
        <div className="col-span-1 text-center">版本</div>
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
          const status = statusConfig[position.status] || statusConfig.draft
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
                <Badge variant="secondary" className={cn("text-xs mt-1", status.className)}>
                  {status.label}
                </Badge>
              </div>
              <div className="col-span-1 text-center text-sm text-slate-600">{position.version}</div>
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
                <div className="flex items-center justify-end gap-1 absolute right-0 top-1/2 -translate-y-1/2 bg-white/95 backdrop-blur-sm z-10 px-2 py-1 rounded-lg shadow-sm border border-slate-100 opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" asChild>
                    <Link href={`${basePath}/${position.id}/edit`} className="flex items-center">
                      <Eye className="mr-1 h-3 w-3" />
                      查看详情
                    </Link>
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" asChild>
                    <Link href={`${basePath}/${position.id}/edit`}>
                      <Pencil className="mr-1 h-3 w-3" />
                      编辑
                    </Link>
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" asChild>
                    <Link href={`${basePath}/${position.id}/edit?step=${configureStepParam}`}>
                      <GitBranch className="mr-1 h-3 w-3" />
                      配置能力
                    </Link>
                  </Button>
                  {onClone && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={(e) => {
                        e.stopPropagation()
                        onClone(position)
                      }}
                    >
                      <Copy className="mr-1 h-3 w-3" />
                      克隆
                    </Button>
                  )}
                  {(position.status === "draft" || position.status === "rejected") && onSubmitApproval && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-blue-600 hover:text-blue-700"
                      onClick={(e) => {
                        e.stopPropagation()
                        onSubmitApproval(position)
                      }}
                    >
                      <Send className="mr-1 h-3 w-3" />
                      提交审批
                    </Button>
                  )}
                  {position.status === "pending" && onWithdrawApproval && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-amber-600 hover:text-amber-700"
                      onClick={(e) => {
                        e.stopPropagation()
                        onWithdrawApproval(position)
                      }}
                    >
                      <Undo2 className="mr-1 h-3 w-3" />
                      撤回审批
                    </Button>
                  )}
                  {position.status === "pending" && onApprove && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-emerald-600 hover:text-emerald-700"
                      onClick={(e) => {
                        e.stopPropagation()
                        onApprove(position)
                      }}
                    >
                      <CheckCircle className="mr-1 h-3 w-3" />
                      通过
                    </Button>
                  )}
                  {position.status === "pending" && onReject && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-red-500 hover:text-red-600"
                      onClick={(e) => {
                        e.stopPropagation()
                        onReject(position)
                      }}
                    >
                      <XCircle className="mr-1 h-3 w-3" />
                      驳回
                    </Button>
                  )}
                  {position.status === "rejected" && onViewRejectReason && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-red-500 hover:text-red-600"
                      onClick={(e) => {
                        e.stopPropagation()
                        onViewRejectReason(position)
                      }}
                    >
                      <MessageSquare className="mr-1 h-3 w-3" />
                      查看驳回原因
                    </Button>
                  )}
                  {position.status === "approved" && onPublish && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-indigo-600 hover:text-indigo-700"
                      onClick={(e) => {
                        e.stopPropagation()
                        onPublish(position)
                      }}
                    >
                      <Rocket className="mr-1 h-3 w-3" />
                      发布
                    </Button>
                  )}
                  {position.status === "published" && onUnpublish && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-red-500 hover:text-red-600"
                      onClick={(e) => {
                        e.stopPropagation()
                        onUnpublish(position)
                      }}
                    >
                      <ArrowDownFromLine className="mr-1 h-3 w-3" />
                      取消发布
                    </Button>
                  )}
                  {position.status !== "pending" && position.status !== "archived" && onArchive && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-purple-600 hover:text-purple-700"
                      onClick={(e) => {
                        e.stopPropagation()
                        onArchive(position)
                      }}
                    >
                      <Archive className="mr-1 h-3 w-3" />
                      归档
                    </Button>
                  )}
                  {onInviteCoBuild && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-indigo-600 hover:text-indigo-700"
                      onClick={(e) => {
                        e.stopPropagation()
                        onInviteCoBuild(position)
                      }}
                    >
                      <UserPlus className="mr-1 h-3 w-3" />
                      邀请共建
                    </Button>
                  )}
                  {onDelete && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-red-500 hover:text-red-600"
                      onClick={(e) => {
                        e.stopPropagation()
                        onDelete(position)
                      }}
                    >
                      <Trash2 className="mr-1 h-3 w-3" />
                      删除
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
