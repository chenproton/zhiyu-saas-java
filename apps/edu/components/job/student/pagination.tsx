"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"

interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
}

export function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null

  const pages: (number | string)[] = []
  const maxVisible = 5

  if (totalPages <= maxVisible + 2) {
    for (let i = 1; i <= totalPages; i++) pages.push(i)
  } else {
    if (currentPage <= 3) {
      pages.push(1, 2, 3, 4, "...", totalPages)
    } else if (currentPage >= totalPages - 2) {
      pages.push(1, "...", totalPages - 3, totalPages - 2, totalPages - 1, totalPages)
    } else {
      pages.push(1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages)
    }
  }

  return (
    <div className="flex items-center justify-center gap-2 mt-7">
      <button
        className="w-8 h-8 border border-[#e7e5e4] rounded-lg bg-white text-[#475569] flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:border-blue-500 hover:text-blue-500"
        disabled={currentPage <= 1}
        onClick={() => onPageChange(currentPage - 1)}
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <div className="flex items-center gap-1.5">
        {pages.map((p, i) =>
          p === "..." ? (
            <span key={`ellipsis-${i}`} className="px-2 text-[#94a3b8]">...</span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p as number)}
              className={`
                min-w-[32px] h-8 px-2 rounded-lg border text-[13px] flex items-center justify-center transition-colors
                ${currentPage === p
                  ? "bg-blue-500 border-blue-500 text-white font-medium"
                  : "bg-white border-[#e7e5e4] text-[#475569] hover:border-blue-500 hover:text-blue-500"
                }
              `}
            >
              {p}
            </button>
          )
        )}
      </div>
      <button
        className="w-8 h-8 border border-[#e7e5e4] rounded-lg bg-white text-[#475569] flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:border-blue-500 hover:text-blue-500"
        disabled={currentPage >= totalPages}
        onClick={() => onPageChange(currentPage + 1)}
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  )
}
