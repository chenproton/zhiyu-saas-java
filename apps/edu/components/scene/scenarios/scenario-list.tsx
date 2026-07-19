"use client"

import { Copy, Eye, GitBranch, Pencil, Rocket, Send, Trash2, Undo2, CheckCircle, XCircle, ArrowDownFromLine, MessageSquare, UserPlus } from "lucide-react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { PrdAnnotation } from "@/components/prd-annotation"
import { getAnnotation } from "@/lib/prd-annotations"
import { cn } from "@/lib/utils"

const statusConfig = {
  draft: { label: "草稿", className: "bg-gray-100 text-gray-500" },
  pending: { label: "审批中", className: "bg-yellow-50 text-yellow-600" },
  approved: { label: "已通过", className: "bg-blue-50 text-blue-600" },
  rejected: { label: "已驳回", className: "bg-red-50 text-red-500" },
  published: { label: "已发布", className: "bg-green-50 text-green-600" },
  archived: { label: "已归档", className: "bg-purple-50 text-purple-600" },
}

export interface ScenarioListItem {
  id: string
  name: string
  code: string
  version: string
  status: "draft" | "pending" | "approved" | "rejected" | "published" | "archived"
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
  onApprove?: (scenario: T) => void
  onReject?: (scenario: T) => void
  onPublish?: (scenario: T) => void
  onUnpublish?: (scenario: T) => void
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
  onApprove,
  onReject,
  onPublish,
  onUnpublish,
  onViewRejectReason,
  onInviteCoBuild,
  className,
  basePath = "/scenarios",
}: ScenarioListProps<T>) {
  if (scenarios.length === 0) return null

  const allSelected = scenarios.length > 0 && scenarios.every((s) => selectedIds.includes(s.id))
  const someSelected = scenarios.some((s) => selectedIds.includes(s.id)) && !allSelected

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
        <PrdAnnotation data={getAnnotation("list-header-name")} className="col-span-2 block">
          <div>场景名称</div>
        </PrdAnnotation>
        <PrdAnnotation data={getAnnotation("list-header-code")} className="col-span-1 block">
          <div>场景编码</div>
        </PrdAnnotation>
        <PrdAnnotation data={getAnnotation("list-header-version")} className="col-span-1 block text-center">
          <div>版本</div>
        </PrdAnnotation>
        <PrdAnnotation data={getAnnotation("list-header-position")} className="col-span-1 block">
          <div>所属岗位</div>
        </PrdAnnotation>
        <PrdAnnotation data={getAnnotation("list-header-batch")} className="col-span-2 block">
          <div>所属批次分组</div>
        </PrdAnnotation>
        <PrdAnnotation data={getAnnotation("list-header-creator")} className="col-span-1 block">
          <div>创建人</div>
        </PrdAnnotation>
        <PrdAnnotation data={getAnnotation("list-header-publish-time")} className="col-span-1 block">
          <div>发布时间</div>
        </PrdAnnotation>
        <PrdAnnotation data={getAnnotation("list-header-task-count")} className="col-span-1 block text-center">
          <div>场景任务数量</div>
        </PrdAnnotation>
        <div className="col-span-1 text-right">操作</div>
      </div>

      {/* Body */}
      <div className="divide-y divide-slate-100">
        {scenarios.map((scenario) => {
          const status = statusConfig[scenario.status]
          const isSelected = selectedIds.includes(scenario.id)

          return (
            <div
              key={scenario.id}
              className={cn(
                "grid grid-cols-12 gap-4 px-4 py-3 items-center hover:bg-slate-50 transition-colors group relative",
                isSelected && "bg-primary/5"
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
                <PrdAnnotation data={getAnnotation("list-link-name")} className="block">
                  <Link href={`${basePath}/${scenario.id}/edit`} className="block">
                    <p className="text-sm font-medium text-slate-900 line-clamp-1 hover:text-primary">{scenario.name}</p>
                  </Link>
                </PrdAnnotation>
                <Badge variant="secondary" className={cn("text-xs mt-1", status.className)}>
                  {status.label}
                </Badge>
              </div>
              <div className="col-span-1 text-sm text-slate-600 truncate">{scenario.code}</div>
              <div className="col-span-1 text-center text-sm text-slate-600">{scenario.version}</div>
              <div className="col-span-1 text-sm text-slate-600 truncate">{scenario.positionName || "-"}</div>
              <div className="col-span-2 text-sm text-slate-600 truncate">{scenario.batchName || "-"}</div>
              <div className="col-span-1 text-xs text-slate-500 truncate">{scenario.creatorName}</div>
              <div className="col-span-1 text-xs text-slate-500 truncate">{scenario.publishTime || "-"}</div>
              <div className="col-span-1 text-center">
                <PrdAnnotation data={getAnnotation("list-link-tasks")}>
                  <Link
                    href={`${basePath}/${scenario.id}/edit/tasks`}
                    className="inline-flex items-center justify-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                  >
                    {scenario.taskCount ?? scenario.tasks?.length ?? 0}
                  </Link>
                </PrdAnnotation>
              </div>
              <div className="col-span-1 text-right relative">
                <div className="flex items-center justify-end gap-1 absolute right-0 top-1/2 -translate-y-1/2 bg-white/95 backdrop-blur-sm z-10 px-2 py-1 rounded-lg shadow-sm border border-slate-100">
                  <PrdAnnotation data={getAnnotation("row-action-view")}>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" asChild>
                      <Link href={`${basePath}/${scenario.id}/edit`}>
                        <Eye className="mr-1 h-3 w-3" />
                        查看详情
                      </Link>
                    </Button>
                  </PrdAnnotation>
                  <PrdAnnotation data={getAnnotation("row-action-edit")}>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" asChild>
                      <Link href={`${basePath}/${scenario.id}/edit`}>
                        <Pencil className="mr-1 h-3 w-3" />
                        编辑
                      </Link>
                    </Button>
                  </PrdAnnotation>
                  <PrdAnnotation data={getAnnotation("row-action-tasks")}>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" asChild>
                      <Link href={`${basePath}/${scenario.id}/edit/tasks`}>
                        <GitBranch className="mr-1 h-3 w-3" />
                        编排任务
                      </Link>
                    </Button>
                  </PrdAnnotation>
                  <PrdAnnotation data={getAnnotation("row-action-clone")}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={(e) => {
                        e.stopPropagation()
                        onClone?.(scenario)
                      }}
                    >
                      <Copy className="mr-1 h-3 w-3" />
                      克隆场景
                    </Button>
                  </PrdAnnotation>
                  <PrdAnnotation data={getAnnotation("row-action-invite")}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-emerald-600 hover:text-emerald-700"
                      onClick={(e) => {
                        e.stopPropagation()
                        onInviteCoBuild?.(scenario)
                      }}
                    >
                      <UserPlus className="mr-1 h-3 w-3" />
                      邀请共建
                    </Button>
                  </PrdAnnotation>
                  {(scenario.status === "draft" || scenario.status === "rejected") && onSubmitApproval && (
                    <PrdAnnotation data={getAnnotation("row-action-submit")}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-blue-600 hover:text-blue-700"
                        onClick={(e) => {
                          e.stopPropagation()
                          onSubmitApproval(scenario)
                        }}
                      >
                        <Send className="mr-1 h-3 w-3" />
                        提交审批
                      </Button>
                    </PrdAnnotation>
                  )}
                  {scenario.status === "pending" && onWithdrawApproval && (
                    <PrdAnnotation data={getAnnotation("row-action-withdraw")}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-amber-600 hover:text-amber-700"
                        onClick={(e) => {
                          e.stopPropagation()
                          onWithdrawApproval(scenario)
                        }}
                      >
                        <Undo2 className="mr-1 h-3 w-3" />
                        撤回审批
                      </Button>
                    </PrdAnnotation>
                  )}
                  {scenario.status === "pending" && onApprove && (
                    <PrdAnnotation data={getAnnotation("row-action-approve")}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-emerald-600 hover:text-emerald-700"
                        onClick={(e) => {
                          e.stopPropagation()
                          onApprove(scenario)
                        }}
                      >
                        <CheckCircle className="mr-1 h-3 w-3" />
                        通过
                      </Button>
                    </PrdAnnotation>
                  )}
                  {scenario.status === "pending" && onReject && (
                    <PrdAnnotation data={getAnnotation("row-action-reject")}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-red-500 hover:text-red-600"
                        onClick={(e) => {
                          e.stopPropagation()
                          onReject(scenario)
                        }}
                      >
                        <XCircle className="mr-1 h-3 w-3" />
                        驳回
                      </Button>
                    </PrdAnnotation>
                  )}
                  {scenario.status === "approved" && onPublish && (
                    <PrdAnnotation data={getAnnotation("row-action-publish")}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-indigo-600 hover:text-indigo-700"
                        onClick={(e) => {
                          e.stopPropagation()
                          onPublish(scenario)
                        }}
                      >
                        <Rocket className="mr-1 h-3 w-3" />
                        发布
                      </Button>
                    </PrdAnnotation>
                  )}
                  {scenario.status === "published" && onUnpublish && (
                    <PrdAnnotation data={getAnnotation("row-action-unpublish")}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-red-500 hover:text-red-600"
                        onClick={(e) => {
                          e.stopPropagation()
                          onUnpublish(scenario)
                        }}
                      >
                        <ArrowDownFromLine className="mr-1 h-3 w-3" />
                        取消发布
                      </Button>
                    </PrdAnnotation>
                  )}
                  {scenario.status === "rejected" && onViewRejectReason && (
                    <PrdAnnotation data={getAnnotation("row-action-reject-reason")}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-red-500 hover:text-red-600"
                        onClick={(e) => {
                          e.stopPropagation()
                          onViewRejectReason(scenario)
                        }}
                      >
                        <MessageSquare className="mr-1 h-3 w-3" />
                        查看驳回原因
                      </Button>
                    </PrdAnnotation>
                  )}
                  {onDelete && (
                    <PrdAnnotation data={getAnnotation("row-action-delete")}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-red-500 hover:text-red-600"
                        onClick={(e) => {
                          e.stopPropagation()
                          onDelete(scenario)
                        }}
                      >
                        <Trash2 className="mr-1 h-3 w-3" />
                        删除
                      </Button>
                    </PrdAnnotation>
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
