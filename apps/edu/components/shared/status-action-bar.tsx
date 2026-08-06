'use client'

import { type ReactNode } from 'react'
import {
  Archive,
  ArrowDownFromLine,
  Copy,
  Eye,
  MessageSquare,
  Pencil,
  Rocket,
  Send,
  Trash2,
  Undo2,
  UserPlus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { HoverActionBar } from '@/components/shared/hover-action-bar'
import type { Status } from '@/lib/types'
import { canPerformAction } from '@/lib/types'

// 可编辑状态：draft/rejected/approved（pending 审批中、published 已发布不可再编辑）
const EDITABLE_STATUSES: Status[] = ['draft', 'rejected', 'approved']

interface StatusActionBarProps {
  status: Status
  isDraftPool?: boolean
  /** 公共库：仅保留查看详情 + 克隆，防止修改他人已发布资源 */
  isPublicPool?: boolean
  onView?: () => void
  onEdit?: () => void
  onClone?: () => void
  onSubmit?: () => void
  onWithdraw?: () => void
  /** 已不再渲染（审批统一走审批中心），仅保留接口兼容既有调用处 */
  onApprove?: () => void
  /** 已不再渲染（审批统一走审批中心），仅保留接口兼容既有调用处 */
  onReject?: () => void
  onPublish?: () => void
  onUnpublish?: () => void
  onArchive?: () => void
  onDelete?: () => void
  onInvite?: () => void
  onViewRejectReason?: () => void
  extraActions?: ReactNode
}

export function StatusActionBar({
  status,
  isDraftPool,
  isPublicPool,
  onView,
  onEdit,
  onClone,
  onSubmit,
  onWithdraw,
  onPublish,
  onUnpublish,
  onArchive,
  onDelete,
  onInvite,
  onViewRejectReason,
  extraActions,
}: StatusActionBarProps) {
  if (isDraftPool) {
    return (
      <HoverActionBar>
        {onView && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={(e) => {
              e.stopPropagation()
              onView()
            }}
          >
            <Eye className="mr-1 h-3 w-3" />
            查看
          </Button>
        )}
      </HoverActionBar>
    )
  }

  if (isPublicPool) {
    return (
      <HoverActionBar>
        {onView && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={(e) => {
              e.stopPropagation()
              onView()
            }}
          >
            <Eye className="mr-1 h-3 w-3" />
            查看详情
          </Button>
        )}
        {onClone && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={(e) => {
              e.stopPropagation()
              onClone()
            }}
          >
            <Copy className="mr-1 h-3 w-3" />
            克隆
          </Button>
        )}
      </HoverActionBar>
    )
  }

  return (
    <HoverActionBar>
      {onView && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={(e) => {
            e.stopPropagation()
            onView()
          }}
        >
          <Eye className="mr-1 h-3 w-3" />
          查看详情
        </Button>
      )}
      {EDITABLE_STATUSES.includes(status) && extraActions}
      {onEdit && EDITABLE_STATUSES.includes(status) && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={(e) => {
            e.stopPropagation()
            onEdit()
          }}
        >
          <Pencil className="mr-1 h-3 w-3" />
          编辑
        </Button>
      )}
      {onClone && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={(e) => {
            e.stopPropagation()
            onClone()
          }}
        >
          <Copy className="mr-1 h-3 w-3" />
          克隆
        </Button>
      )}
      {onSubmit && canPerformAction(status, 'submit') && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-blue-600 hover:text-blue-700"
          onClick={(e) => {
            e.stopPropagation()
            onSubmit()
          }}
        >
          <Send className="mr-1 h-3 w-3" />
          提交审批
        </Button>
      )}
      {onWithdraw && canPerformAction(status, 'withdraw') && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-amber-600 hover:text-amber-700"
          onClick={(e) => {
            e.stopPropagation()
            onWithdraw()
          }}
        >
          <Undo2 className="mr-1 h-3 w-3" />
          撤回审批
        </Button>
      )}
      {onViewRejectReason && status === 'rejected' && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-red-500 hover:text-red-600"
          onClick={(e) => {
            e.stopPropagation()
            onViewRejectReason()
          }}
        >
          <MessageSquare className="mr-1 h-3 w-3" />
          查看驳回原因
        </Button>
      )}
      {onPublish && canPerformAction(status, 'publish') && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-blue-600 hover:text-blue-700"
          onClick={(e) => {
            e.stopPropagation()
            onPublish()
          }}
        >
          <Rocket className="mr-1 h-3 w-3" />
          发布
        </Button>
      )}
      {onUnpublish && canPerformAction(status, 'unpublish') && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-red-500 hover:text-red-600"
          onClick={(e) => {
            e.stopPropagation()
            onUnpublish()
          }}
        >
          <ArrowDownFromLine className="mr-1 h-3 w-3" />
          取消发布
        </Button>
      )}
      {onArchive && canPerformAction(status, 'archive') && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-blue-600 hover:text-blue-700"
          onClick={(e) => {
            e.stopPropagation()
            onArchive()
          }}
        >
          <Archive className="mr-1 h-3 w-3" />
          归档
        </Button>
      )}
      {onInvite && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-blue-600 hover:text-blue-700"
          onClick={(e) => {
            e.stopPropagation()
            onInvite()
          }}
        >
          <UserPlus className="mr-1 h-3 w-3" />
          邀请共建
        </Button>
      )}
      {onDelete && status !== 'pending' && status !== 'published' && status !== 'approved' && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-red-500 hover:text-red-600"
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
        >
          <Trash2 className="mr-1 h-3 w-3" />
          删除
        </Button>
      )}
    </HoverActionBar>
  )
}
