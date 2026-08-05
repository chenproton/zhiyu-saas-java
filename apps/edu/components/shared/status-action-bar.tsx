'use client'

import { Copy, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { HoverActionBar } from '@/components/shared/hover-action-bar'
import type { Status } from '@/lib/types'

interface StatusActionBarProps {
  status: Status
  isDraftPool?: boolean
  onView?: () => void
  onClone?: () => void
  // 以下字段仅保留接口兼容既有调用处，已不再渲染
  onEdit?: () => void
  onSubmit?: () => void
  onWithdraw?: () => void
  onApprove?: () => void
  onReject?: () => void
  onPublish?: () => void
  onUnpublish?: () => void
  onArchive?: () => void
  onDelete?: () => void
  onInvite?: () => void
  onViewRejectReason?: () => void
  extraActions?: React.ReactNode
}

export function StatusActionBar({ isDraftPool, onView, onClone }: StatusActionBarProps) {
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
