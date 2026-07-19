import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type StatusBadgeType = 'position' | 'batch' | 'approval'

const STATUS_CONFIG: Record<string, { label: string; className: string; dotColor: string }> = {
  draft: { label: '草稿', className: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700', dotColor: 'bg-slate-400' },
  pending: { label: '审批中', className: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800', dotColor: 'bg-amber-500' },
  reviewing: { label: '审批中', className: 'bg-amber-100 text-amber-600 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800', dotColor: 'bg-amber-500' },
  approved: { label: '已通过', className: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800', dotColor: 'bg-green-500' },
  rejected: { label: '已驳回', className: 'bg-red-100 text-red-600 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800', dotColor: 'bg-red-500' },
  published: { label: '已发布', className: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800', dotColor: 'bg-green-500' },
  archived: { label: '已归档', className: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700', dotColor: 'bg-gray-400' },
  open: { label: '开放中', className: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800', dotColor: 'bg-green-500' },
  closed: { label: '已截止', className: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700', dotColor: 'bg-gray-400' },
  ready: { label: '待发布', className: 'bg-blue-100 text-blue-600 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800', dotColor: 'bg-blue-500' },
  none: { label: '无规则', className: 'bg-slate-50 text-slate-500 border-slate-100 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700', dotColor: 'bg-slate-400' },
}

const APPROVAL_LABEL_OVERRIDES: Record<string, string> = {
  pending: '待审批',
}

interface StatusBadgeProps {
  status: string
  type?: StatusBadgeType
  label?: string
  showDot?: boolean
  className?: string
}

export function StatusBadge({ status, type, label, showDot = false, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status]

  let displayLabel = label || config?.label || status
  if (!label && type === 'approval' && APPROVAL_LABEL_OVERRIDES[status]) {
    displayLabel = APPROVAL_LABEL_OVERRIDES[status]
  }

  return (
    <Badge
      variant="outline"
      className={cn(
        config?.className || 'bg-muted text-muted-foreground border-muted',
        className,
      )}
    >
      {showDot && (
        <span className={cn('mr-1.5 inline-block size-1.5 rounded-full', config?.dotColor || 'bg-slate-400')} />
      )}
      {displayLabel}
    </Badge>
  )
}
