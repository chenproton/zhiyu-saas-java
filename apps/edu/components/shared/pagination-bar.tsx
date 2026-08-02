'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface PaginationBarProps {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  disabled?: boolean
}

/**
 * 通用分页条（上一页/页码/下一页），替代各处手写分页。
 */
export function PaginationBar({ page, totalPages, onPageChange, disabled }: PaginationBarProps) {
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        disabled={page <= 1 || disabled}
        onClick={() => onPageChange(page - 1)}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="text-sm text-muted-foreground">
        {page} / {totalPages}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={page >= totalPages || disabled}
        onClick={() => onPageChange(page + 1)}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  )
}
