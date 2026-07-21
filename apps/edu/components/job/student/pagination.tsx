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
    <div className="flex items-center justify-center gap-2 mt-8">
      <button
        className="w-9 h-9 border border-slate-200 rounded-xl bg-white text-slate-500 flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50/50"
        disabled={currentPage <= 1}
        onClick={() => onPageChange(currentPage - 1)}
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <div className="flex items-center gap-1.5">
        {pages.map((p, i) =>
          p === "..." ? (
            <span key={`ellipsis-${i}`} className="px-2 text-slate-400">...</span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p as number)}
              className={`
                min-w-[36px] h-9 px-2.5 rounded-xl border text-[13px] flex items-center justify-center transition-all
                ${currentPage === p
                  ? "bg-blue-500 border-blue-500 text-white font-semibold shadow-md shadow-blue-500/20"
                  : "bg-white border-slate-200 text-slate-500 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50/50"
                }
              `}
            >
              {p}
            </button>
          )
        )}
      </div>
      <button
        className="w-9 h-9 border border-slate-200 rounded-xl bg-white text-slate-500 flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50/50"
        disabled={currentPage >= totalPages}
        onClick={() => onPageChange(currentPage + 1)}
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  )
}
