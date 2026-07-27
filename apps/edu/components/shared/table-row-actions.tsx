"use client"

import { type ReactNode } from "react"
import { TableCell } from "@/components/ui/table"

export function TableRowActions({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <TableCell className={`text-right relative ${className || ""}`}>
      <div className="flex items-center justify-end gap-1 absolute right-0 top-1/2 -translate-y-1/2 bg-white/95 backdrop-blur-sm z-10 px-2 py-1 rounded-lg shadow-sm border border-slate-100 opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity">
        {children}
      </div>
    </TableCell>
  )
}
