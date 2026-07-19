"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import {
  Edit,
  Trash2,
  Send,
  Undo2,
  CheckCircle,
  XCircle,
  Rocket,
  Eye,
  UserPlus,
  Copy,
} from "lucide-react"
import type { Status, StatusAction } from "@/lib/types"
import { canPerformAction } from "@/lib/types"

interface BankStatusActionsProps {
  status: Status
  onEdit?: () => void
  onDelete?: () => void
  onStatusChange: (action: StatusAction) => void
  onView?: () => void
  onInvite?: () => void
  onClone?: () => void
}

type ConfirmType = 'delete' | 'submit' | 'withdraw' | 'approve' | 'reject' | 'publish' | null

const confirmConfig: Record<Exclude<ConfirmType, null>, { title: string; description: string; variant: 'default' | 'destructive' }> = {
  delete: {
    title: "确认删除",
    description: "删除后将无法恢复，题库中的所有题目也会被删除。确定要删除吗？",
    variant: "destructive",
  },
  submit: {
    title: "提交审批",
    description: "提交后题库将进入审批流程，审批期间无法编辑。确定要提交吗？",
    variant: "default",
  },
  withdraw: {
    title: "撤回审批",
    description: "撤回后题库将回到未提交状态，可以继续编辑。确定要撤回吗？",
    variant: "default",
  },
  approve: {
    title: "审批通过",
    description: "通过后题库将进入已通过状态。确定要通过吗？",
    variant: "default",
  },
  reject: {
    title: "驳回审批",
    description: "驳回后题库将回到已驳回状态，需要修改后重新提交。确定要驳回吗？",
    variant: "destructive",
  },
  publish: {
    title: "发布题库",
    description: "发布后题库将对外可见，且无法再编辑。确定要发布吗？",
    variant: "default",
  },
}

export function BankStatusActions({
  status,
  onEdit,
  onDelete,
  onStatusChange,
  onView,
  onInvite,
  onClone,
}: BankStatusActionsProps) {
  const [confirmType, setConfirmType] = useState<ConfirmType>(null)

  const handleConfirm = () => {
    if (!confirmType) return

    switch (confirmType) {
      case 'delete':
        onDelete?.()
        break
      case 'submit':
        onStatusChange('submit')
        break
      case 'withdraw':
        onStatusChange('withdraw')
        break
      case 'approve':
        onStatusChange('approve')
        break
      case 'reject':
        onStatusChange('reject')
        break
      case 'publish':
        onStatusChange('publish')
        break
    }
    setConfirmType(null)
  }

  const canEdit = ['draft', 'rejected'].includes(status)
  const canDelete = ['draft', 'rejected'].includes(status)
  const canSubmit = canPerformAction(status, 'submit')
  const canWithdraw = canPerformAction(status, 'withdraw')
  const canApprove = canPerformAction(status, 'approve')
  const canReject = canPerformAction(status, 'reject')
  const canPublish = canPerformAction(status, 'publish')

  return (
    <>
      <div className="flex items-center justify-end gap-1 absolute right-0 top-1/2 -translate-y-1/2 bg-white/95 backdrop-blur-sm z-10 px-2 py-1 rounded-lg shadow-sm border border-slate-100 opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity">
        {onView && (
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={(e) => { e.stopPropagation(); onView() }}>
            <Eye className="mr-1 h-3 w-3" />
            查看详情
          </Button>
        )}
        {onClone && (
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={(e) => { e.stopPropagation(); onClone() }}>
            <Copy className="mr-1 h-3 w-3" />
            克隆
          </Button>
        )}
        {canEdit && onEdit && (
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={(e) => { e.stopPropagation(); onEdit() }}>
            <Edit className="mr-1 h-3 w-3" />
            编辑
          </Button>
        )}
        {onInvite && (
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={(e) => { e.stopPropagation(); onInvite() }}>
            <UserPlus className="mr-1 h-3 w-3" />
            邀请共建
          </Button>
        )}
        {canSubmit && (
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-blue-600 hover:text-blue-700" onClick={(e) => { e.stopPropagation(); setConfirmType('submit') }}>
            <Send className="mr-1 h-3 w-3" />
            提交审批
          </Button>
        )}
        {canWithdraw && (
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-amber-600 hover:text-amber-700" onClick={(e) => { e.stopPropagation(); setConfirmType('withdraw') }}>
            <Undo2 className="mr-1 h-3 w-3" />
            撤回
          </Button>
        )}
        {canApprove && (
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-emerald-600 hover:text-emerald-700" onClick={(e) => { e.stopPropagation(); setConfirmType('approve') }}>
            <CheckCircle className="mr-1 h-3 w-3" />
            通过
          </Button>
        )}
        {canReject && (
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-red-500 hover:text-red-600" onClick={(e) => { e.stopPropagation(); setConfirmType('reject') }}>
            <XCircle className="mr-1 h-3 w-3" />
            驳回
          </Button>
        )}
        {canPublish && (
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-indigo-600 hover:text-indigo-700" onClick={(e) => { e.stopPropagation(); setConfirmType('publish') }}>
            <Rocket className="mr-1 h-3 w-3" />
            发布
          </Button>
        )}
        {canDelete && onDelete && (
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-red-500 hover:text-red-600" onClick={(e) => { e.stopPropagation(); setConfirmType('delete') }}>
            <Trash2 className="mr-1 h-3 w-3" />
            删除
          </Button>
        )}
      </div>

      {confirmType && (
        <ConfirmDialog
          open={!!confirmType}
          onOpenChange={(open) => !open && setConfirmType(null)}
          title={confirmConfig[confirmType].title}
          description={confirmConfig[confirmType].description}
          variant={confirmConfig[confirmType].variant}
          onConfirm={handleConfirm}
        />
      )}
    </>
  )
}
