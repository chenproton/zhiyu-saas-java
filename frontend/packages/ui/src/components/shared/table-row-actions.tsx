'use client'

import { type ReactNode } from 'react'
import { TableCell } from '../ui/table'
import { HoverActionBar } from './hover-action-bar'

export function TableRowActions({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <TableCell className={`text-right relative ${className || ''}`}>
      <HoverActionBar>{children}</HoverActionBar>
    </TableCell>
  )
}
