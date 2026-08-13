'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { TableCell, TableRow } from '@/components/ui/table'

export interface EmptyStateProps {
  icon?: React.ReactNode
  title?: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  className?: string
  iconClassName?: string
  titleClassName?: string
  compact?: boolean
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  iconClassName,
  titleClassName,
  compact,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'py-6' : 'py-12',
        className,
      )}
    >
      {icon && <div className={cn('mb-3 text-muted-foreground/60', iconClassName)}>{icon}</div>}
      {title && (
        <p
          className={cn(
            'text-muted-foreground',
            compact ? 'text-xs' : 'text-sm font-medium',
            titleClassName,
          )}
        >
          {title}
        </p>
      )}
      {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export interface TableEmptyRowProps {
  colSpan: number
  children?: React.ReactNode
  className?: string
}

export function TableEmptyRow({ colSpan, children, className }: TableEmptyRowProps) {
  return (
    <TableRow>
      <TableCell
        colSpan={colSpan}
        className={cn('h-24 text-center text-sm text-muted-foreground', className)}
      >
        {children}
      </TableCell>
    </TableRow>
  )
}
