"use client"

import { useRouter } from "next/navigation"
import {
  Archive,
  ArrowDownFromLine,
  CheckCircle,
  Copy,
  Eye,
  MessageSquare,
  Pencil,
  Rocket,
  RotateCcw,
  Send,
  Trash2,
  Undo2,
  UserPlus,
  XCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { StatusBadge } from "@/components/shared/status-badge"
import { TableRowActions } from "@/components/shared/table-row-actions"
import { EvaluationStatusActions } from "@/components/evaluation/evaluation-status-actions"
import { cn } from "@/lib/utils"
import { useAuth } from "@/components/auth-provider"
import type { ContentListItem, ListRenderProps } from "@/components/shared/content-list-page"

interface EvalListItem extends ContentListItem {
  code: string
  description: string
  creatorName: string
  collaboratorNames: string[]
  questionCount: number
  totalScore?: number
  isDraftPool?: boolean
  updatedAt: string
  questions?: any[]
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
}

interface EvaluationListTableProps<T extends ContentListItem = ContentListItem> extends ListRenderProps<T> {
  type: "bank" | "exam"
  onReview?: (id: string, status: "approved" | "rejected") => void
}

export function EvaluationListTable<T extends ContentListItem = ContentListItem>(props: EvaluationListTableProps<T>) {
  const { items, selectedIds, onSelectId, onSelectAll, onClone, onDelete,
    onSubmitApproval, onWithdrawApproval, onViewRejectReason, onPublish,
    onUnpublish, onArchive, onInviteCoBuild, batchMap, type, onReview } = props

  const router = useRouter()
  const { hasPermission } = useAuth()

  const allSelectable = items.filter((b: any) => !b.isDraftPool)
  const allSelected = allSelectable.length > 0 && allSelectable.every((b: any) => selectedIds.includes(b.id))
  const someSelected = allSelectable.some((b: any) => selectedIds.includes(b.id)) && !allSelected

  const isBank = type === "bank"
  const detailHref = (id: string) => isBank ? `/evaluation/question-banks/${id}` : `/evaluation/exams/${id}`

  const handleHeaderCheckbox = (checked: boolean) => {
    if (checked) {
      allSelectable.forEach((b: any) => onSelectId(b.id, true))
    } else {
      onSelectAll(false)
    }
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[40px] text-center">
            <Checkbox
              checked={someSelected ? "indeterminate" : allSelected}
              onCheckedChange={(checked) => handleHeaderCheckbox(checked === true)}
              aria-label="全选"
            />
          </TableHead>
          <TableHead className="w-[160px]">{isBank ? "题库名称" : "试卷名称"}</TableHead>
          <TableHead className="w-[120px]">{isBank ? "题库编码" : "试卷编码"}</TableHead>
          <TableHead className="w-[120px]">{isBank ? "题库简介" : "试卷简介"}</TableHead>
          <TableHead className="w-[80px]">题目数量</TableHead>
          {!isBank && <TableHead className="w-[80px]">总分</TableHead>}
          <TableHead className="w-[120px]">所属批次</TableHead>
          <TableHead className="w-[100px]">创建人</TableHead>
          <TableHead className="w-[100px]">共建人</TableHead>
          <TableHead className="w-[70px]">状态</TableHead>
          <TableHead className="w-[100px]">更新时间</TableHead>
          <TableHead className="sticky right-0 w-[80px] bg-white text-right">操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item: any) => {
          const isSelected = selectedIds.includes(item.id)
          const batchName = item.batchId ? (batchMap.get(item.batchId) || "-") : "-"
          const isDraftPool = item.isDraftPool === true
          return (
            <TableRow key={item.id} className={cn("group", isSelected && "bg-primary/5")}>
              <TableCell className="text-center">
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={(checked) => onSelectId(item.id, checked === true)}
                  aria-label={`选择 ${item.name}`}
                  disabled={isDraftPool}
                />
              </TableCell>
              <TableCell className="truncate">
                <button
                  className="text-left text-sm font-medium hover:text-primary truncate w-full"
                  onClick={() => router.push(detailHref(item.id))}
                >
                  {item.name}
                  {isDraftPool && (
                    <span className="ml-2 shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700 align-middle">
                      草稿库
                    </span>
                  )}
                </button>
              </TableCell>
              <TableCell className="truncate">
                <span className="text-sm text-muted-foreground">{item.code || item.id.slice(0, 8)}</span>
              </TableCell>
              <TableCell className="truncate max-w-[120px]">
                <span className="text-sm text-muted-foreground truncate block">{item.description || "-"}</span>
              </TableCell>
              <TableCell>{item.questionCount} 题</TableCell>
              {!isBank && <TableCell>{item.totalScore ?? 0} 分</TableCell>}
              <TableCell className="text-sm text-muted-foreground">{batchName}</TableCell>
              <TableCell className="text-sm text-muted-foreground truncate">{item.creatorName || item.creatorId || "-"}</TableCell>
              <TableCell className="text-sm text-muted-foreground truncate">
                {item.collaboratorNames && item.collaboratorNames.length > 0 ? item.collaboratorNames.join(", ") : "-"}
              </TableCell>
              <TableCell>
                <StatusBadge status={item.status} />
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{formatDate(item.updatedAt)}</TableCell>
              <TableRowActions className="sticky right-0 bg-white">
                {isBank && isDraftPool ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => router.push(detailHref(item.id))}
                  >
                    <Eye className="mr-1 h-3 w-3" />
                    查看
                  </Button>
                ) : (
                  <>
                    <EvaluationStatusActions
                      type={type}
                      status={item.status}
                      onView={() => router.push(detailHref(item.id))}
                      onEdit={item.status !== "archived" ? () => router.push(detailHref(item.id)) : undefined}
                      onClone={() => onClone(item)}
                      onDelete={() => onDelete(item)}
                      onInvite={() => onInviteCoBuild(item)}
                      onStatusChange={(action) => {
                        switch (action) {
                          case 'submit': onSubmitApproval(item); break
                          case 'withdraw': onWithdrawApproval(item); break
                          case 'publish': onPublish(item); break
                          case 'unpublish': onUnpublish(item); break
                          case 'archive': onArchive(item); break
                          case 'approve': onReview?.(item.id, "approved"); break
                          case 'reject': onReview?.(item.id, "rejected"); break
                        }
                      }}
                    />
                    {item.status === "rejected" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-orange-600 hover:text-orange-700"
                        onClick={() => onViewRejectReason(item)}
                      >
                        <MessageSquare className="mr-1 h-3 w-3" />
                        查看驳回原因
                      </Button>
                    )}
                  </>
                )}
              </TableRowActions>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
