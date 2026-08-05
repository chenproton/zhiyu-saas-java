'use client'

import { Children, type ReactNode, useState } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { Button } from '../ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '../ui/dropdown-menu'

export function HoverActionBar({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const hasActions = Children.toArray(children).length > 0

  return (
    <div
      className={`flex items-center justify-end absolute right-0 top-1/2 -translate-y-1/2 z-10 ${className || ''}`}
    >
      <div className="hidden md:flex items-center gap-1 bg-white/95 backdrop-blur-sm px-2 py-1 rounded-lg shadow-sm border border-slate-100 opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity">
        {children}
      </div>
      {hasActions && (
        <div className="md:hidden">
          <DropdownMenu open={open} onOpenChange={setOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="h-7 w-7 text-slate-500 hover:text-slate-700"
                aria-label="更多操作"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="flex flex-col items-stretch gap-0.5"
              onClickCapture={() => setOpen(false)}
            >
              {children}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  )
}
